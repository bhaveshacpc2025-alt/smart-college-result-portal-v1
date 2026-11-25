import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');

// Use an isolated temporary SQLite DB for E2E verification so the main portal.db stays a clean slate
const testDbPath = path.join(backendRoot, 'data', 'e2e_test.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
process.env.SQLITE_FALLBACK_PATH = testDbPath;
process.env.DATABASE_URL = ''; // Force embedded transactional SQLite during test
process.env.PORT = '4055';

const { default: express } = await import('express');
const { initDatabase } = await import('../src/db/index.js');
const { default: authRoutes } = await import('../src/routes/auth.js');
const { default: notificationRoutes } = await import('../src/routes/notifications.js');
const { default: hodRoutes } = await import('../src/routes/hod.js');
const { default: professorRoutes } = await import('../src/routes/professor.js');
const { default: studentRoutes } = await import('../src/routes/student.js');

await initDatabase();

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', notificationRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/student', studentRoutes);
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({ error: err.message });
});

const server = app.listen(4055, '127.0.0.1');
const BASE = 'http://127.0.0.1:4055/api';

async function req(urlPath, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

try {
  // 1. Clean slate check
  const boot0 = await req('/auth/bootstrap-status');
  assert.equal(boot0.data.hodExists, false);

  // 2. Register HOD, 2 Professors, 2 Whitelisted Students, 1 Outsider Student
  const hodReg = await req('/auth/register', 'POST', {
    role: 'HOD',
    identifier: 'HOD-01',
    name: 'Dr. Ananya Sharma',
    department: 'CSE',
    password: 'pass',
  });
  assert.equal(hodReg.status, 201);
  const hodToken = hodReg.data.token;

  const prof1Reg = await req('/auth/register', 'POST', {
    role: 'PROFESSOR',
    identifier: 'PROF-01',
    name: 'Prof. Rajesh Verma',
    department: 'CSE',
    password: 'pass',
  });
  const prof2Reg = await req('/auth/register', 'POST', {
    role: 'PROFESSOR',
    identifier: 'PROF-02',
    name: 'Prof. Meera Nair',
    department: 'CSE',
    password: 'pass',
  });
  const stu1Reg = await req('/auth/register', 'POST', {
    role: 'STUDENT',
    identifier: 'ENR2026001',
    name: 'Aarav Patel',
    department: 'B.Tech CSE',
    password: 'pass',
  });
  const stu2Reg = await req('/auth/register', 'POST', {
    role: 'STUDENT',
    identifier: 'ENR2026002',
    name: 'Diya Kapoor',
    department: 'B.Tech CSE',
    password: 'pass',
  });
  const outsiderReg = await req('/auth/register', 'POST', {
    role: 'STUDENT',
    identifier: 'OUTSIDER999',
    name: 'Unauthorized User',
    department: 'Unknown',
    password: 'pass',
  });

  // 3. HOD creates class with 2 subjects + whitelist + custom grading
  const clsRes = await req(
    '/hod/classes',
    'POST',
    {
      className: 'B.Tech CSE Sem-5 Div-A',
      courseProgram: 'B.Tech Computer Science',
      semesterYear: 'Semester V / 2026',
      examMonthYear: 'November 2026',
      passingPercentage: 40,
      preparedBy: 'Exam Cell',
      checkedBy: 'Dr. Ananya Sharma',
      whitelist: ['ENR2026001', 'ENR2026002'],
      subjects: [
        { code: 'CS501', name: 'Operating Systems', maxMarks: 100 },
        { code: 'CS502', name: 'Database Systems', maxMarks: 100 },
      ],
    },
    hodToken
  );
  assert.equal(clsRes.status, 201);
  const cls = clsRes.data.class;
  assert.ok(cls.inviteCode.startsWith('CLS-'));
  const subj1 = cls.subjects.find((s) => s.code === 'CS501');
  const subj2 = cls.subjects.find((s) => s.code === 'CS502');

  // 4. Outsider student blocked by whitelist!
  const outsiderJoin = await req('/student/join', 'POST', { inviteCode: cls.inviteCode }, outsiderReg.data.token);
  assert.equal(outsiderJoin.status, 403);

  // 5. Valid students join via Invite Code
  const s1Join = await req('/student/join', 'POST', { inviteCode: cls.inviteCode }, stu1Reg.data.token);
  const s2Join = await req('/student/join', 'POST', { inviteCode: cls.inviteCode }, stu2Reg.data.token);
  assert.equal(s1Join.status, 201);
  assert.equal(s2Join.status, 201);

  // 6. Professors lookup class & request subject permissions concurrently
  const lookup1 = await req(`/professor/classes/lookup?code=${cls.inviteCode}`, 'GET', null, prof1Reg.data.token);
  assert.equal(lookup1.status, 200);
  const [perm1, perm2] = await Promise.all([
    req('/professor/request-permission', 'POST', { classId: cls.id, subjectId: subj1.id }, prof1Reg.data.token),
    req('/professor/request-permission', 'POST', { classId: cls.id, subjectId: subj2.id }, prof2Reg.data.token),
  ]);
  assert.equal(perm1.status, 201);
  assert.equal(perm2.status, 201);

  // 7. HOD approves both professors & both students
  await req(`/hod/permissions/${perm1.data.permission.id}`, 'PATCH', { action: 'APPROVE' }, hodToken);
  await req(`/hod/permissions/${perm2.data.permission.id}`, 'PATCH', { action: 'APPROVE' }, hodToken);
  await req(`/hod/enrollments/${s1Join.data.enrollment.id}`, 'PATCH', { action: 'APPROVE' }, hodToken);
  await req(`/hod/enrollments/${s2Join.data.enrollment.id}`, 'PATCH', { action: 'APPROVE' }, hodToken);

  // 8. Synchronized Release Rule check: Deploy must FAIL before all subjects locked
  const prematureDeploy = await req(`/hod/classes/${cls.id}/deploy`, 'POST', {}, hodToken);
  assert.equal(prematureDeploy.status, 400);

  // 9. Both professors enter marks concurrently + generate AI Auto-Remarks + lock subj1 only
  const [m1Res, m2Res] = await Promise.all([
    req(
      `/professor/subjects/${subj1.id}/marks`,
      'PUT',
      {
        entries: [
          { studentId: stu1Reg.data.user.id, marksObtained: 91 },
          { studentId: stu2Reg.data.user.id, marksObtained: 72 },
        ],
      },
      prof1Reg.data.token
    ),
    req(
      `/professor/subjects/${subj2.id}/marks`,
      'PUT',
      {
        entries: [
          { studentId: stu1Reg.data.user.id, marksObtained: 84 },
          { studentId: stu2Reg.data.user.id, marksObtained: 34 },
        ],
      },
      prof2Reg.data.token
    ),
  ]);
  assert.equal(m1Res.status, 200);
  assert.equal(m1Res.data.workspace.topper.enrollmentNo, 'ENR2026001');
  assert.equal(m2Res.status, 200);

  const remarks1 = await req(`/professor/subjects/${subj1.id}/auto-remarks`, 'POST', {}, prof1Reg.data.token);
  assert.equal(remarks1.status, 200);
  assert.ok(remarks1.data.workspace.students[0].aiRemark.length > 20);

  await req(`/professor/subjects/${subj1.id}/lock`, 'POST', {}, prof1Reg.data.token);

  // 10. Privacy & Pre-deployment check: student sees Awaiting, reportCard === null
  const stuPre = await req('/student/dashboard', 'GET', null, stu1Reg.data.token);
  assert.equal(stuPre.status, 200);
  assert.equal(stuPre.data.classes[0].reportCard, null);
  assert.equal(stuPre.data.classes[0].lockedSubjectsCount, 1);

  // 11. Lock subj2, then HOD deploys final results!
  await req(`/professor/subjects/${subj2.id}/lock`, 'POST', {}, prof2Reg.data.token);
  const deployRes = await req(`/hod/classes/${cls.id}/deploy`, 'POST', {}, hodToken);
  assert.equal(deployRes.status, 200);
  assert.equal(deployRes.data.class.isDeployed, true);

  // 12. Verify Student 1 & Student 2 private report cards & AI insights
  const stu1Dash = await req('/student/dashboard', 'GET', null, stu1Reg.data.token);
  const stu2Dash = await req('/student/dashboard', 'GET', null, stu2Reg.data.token);
  assert.equal(stu1Dash.data.classes[0].reportCard.summary.totalObtained, 175);
  assert.equal(stu1Dash.data.classes[0].reportCard.summary.resultStatus, 'PASS');
  assert.equal(stu1Dash.data.classes[0].reportCard.student.enrollmentNo, 'ENR2026001');

  assert.equal(stu2Dash.data.classes[0].reportCard.summary.resultStatus, 'FAIL');
  assert.ok(stu2Dash.data.insights.weakAreas.length >= 1);

  // 13. Verify HOD Audit Logs recorded all 4 mark entries
  const auditRes = await req('/hod/audit-logs', 'GET', null, hodToken);
  assert.equal(auditRes.status, 200);
  assert.equal(auditRes.data.auditLogs.length, 4);

  // 14. Verify Role Isolation (Student cannot access HOD or Professor endpoints)
  const forbiddenHod = await req('/hod/classes', 'GET', null, stu1Reg.data.token);
  assert.equal(forbiddenHod.status, 403);

  console.log('ALL E2E VERIFICATION CHECKS PASSED!');
} finally {
  server.close();
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch {
      // ignore if locked briefly on Windows
    }
  }
}
