import express from 'express';
import { getRepo, withTransaction } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import {
  calculateSubjectResult,
  generateDeterministicRemark,
} from '../utils/grading.js';
import { emitEventToUsers } from '../utils/events.js';

const router = express.Router();
router.use(authenticate, requireRole('PROFESSOR'));

export function extractInviteCode(rawInput) {
  const str = String(rawInput || '').trim();
  if (!str) return '';
  const match = str.match(/CLS-[A-Z0-9]{4,12}/i);
  if (match) return match[0].toUpperCase();
  try {
    const u = new URL(str);
    const param = u.searchParams.get('code') || u.searchParams.get('invite');
    if (param) return param.trim().toUpperCase();
  } catch {
    // not a URL
  }
  return str.toUpperCase();
}

async function buildSubjectWorkspace(repo, subj) {
  const cls = await repo.findClassById(subj.classId);
  if (!cls) return null;

  const [enrollments, marks] = await Promise.all([
    repo.listEnrollmentsByClass(cls.id),
    repo.listMarksBySubject(subj.id),
  ]);

  const approvedEnrollments = enrollments.filter((e) => e.status === 'APPROVED');
  const marksByStudent = new Map(marks.map((m) => [m.studentId, m]));

  const rows = [];
  for (const enr of approvedEnrollments) {
    const stu = await repo.findUserById(enr.studentId);
    const mark = marksByStudent.get(enr.studentId) || null;
    const calc = mark
      ? calculateSubjectResult(
          mark.marksObtained,
          subj.maxMarks,
          cls.passingPercentage,
          cls.gradeBoundaries
        )
      : null;

    rows.push({
      studentId: enr.studentId,
      enrollmentNo: enr.enrollmentNo,
      studentName: stu?.name || 'Student',
      marksObtained: mark ? mark.marksObtained : '',
      aiRemark: mark ? mark.aiRemark : '',
      markVersion: mark ? mark.version : 0,
      percentage: calc ? calc.percentage : null,
      grade: calc ? calc.grade : null,
      result: calc ? calc.result : null,
      passed: calc ? calc.passed : null,
    });
  }

  rows.sort((a, b) => a.enrollmentNo.localeCompare(b.enrollmentNo));

  // Compute live topper & average
  const entered = rows.filter((r) => r.marksObtained !== '' && r.marksObtained !== null);
  let topper = null;
  let classAverage = 0;
  if (entered.length > 0) {
    const sum = entered.reduce((acc, r) => acc + Number(r.marksObtained), 0);
    classAverage = Number((sum / entered.length).toFixed(2));
    const best = entered.reduce((max, r) =>
      Number(r.marksObtained) > Number(max.marksObtained) ? r : max
    );
    topper = {
      studentId: best.studentId,
      name: best.studentName,
      enrollmentNo: best.enrollmentNo,
      marksObtained: Number(best.marksObtained),
      maxMarks: subj.maxMarks,
      percentage: Number(((Number(best.marksObtained) / subj.maxMarks) * 100).toFixed(2)),
    };
  }

  return {
    subject: subj,
    classInfo: {
      id: cls.id,
      className: cls.className,
      courseProgram: cls.courseProgram,
      semesterYear: cls.semesterYear,
      examMonthYear: cls.examMonthYear,
      inviteCode: cls.inviteCode,
      passingPercentage: cls.passingPercentage,
      gradeBoundaries: cls.gradeBoundaries,
      isDeployed: cls.isDeployed,
      deployedAt: cls.deployedAt,
    },
    students: rows,
    topper,
    classAverage,
    enteredCount: entered.length,
    totalApprovedStudents: rows.length,
  };
}

router.get('/classes/lookup', async (req, res, next) => {
  try {
    const code = extractInviteCode(req.query.code);
    if (!code) {
      return res.status(400).json({ error: 'Please provide a valid Class Invite Code or QR link.' });
    }
    const repo = getRepo();
    const cls = await repo.findClassByInviteCode(code);
    if (!cls) {
      return res.status(404).json({ error: `No class found for invite code "${code}".` });
    }

    const [subjects, myPerms] = await Promise.all([
      repo.listSubjectsByClass(cls.id),
      repo.listSubjectPermissionsByProfessor(req.user.id),
    ]);

    const myPermBySubject = new Map(myPerms.map((p) => [p.subjectId, p]));
    const enrichedSubjects = subjects.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      maxMarks: s.maxMarks,
      status: s.status,
      isAssignedToMe: s.assignedProfessorId === req.user.id,
      isAssignedToOther: Boolean(s.assignedProfessorId && s.assignedProfessorId !== req.user.id),
      myPermissionStatus: myPermBySubject.get(s.id)?.status || null,
    }));

    res.json({
      classInfo: {
        id: cls.id,
        className: cls.className,
        courseProgram: cls.courseProgram,
        semesterYear: cls.semesterYear,
        examMonthYear: cls.examMonthYear,
        inviteCode: cls.inviteCode,
      },
      subjects: enrichedSubjects,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/request-permission', async (req, res, next) => {
  try {
    const { classId, subjectId } = req.body;
    if (!classId || !subjectId) {
      return res.status(400).json({ error: 'classId and subjectId are required.' });
    }

    let hodId = null;
    const permission = await withTransaction(async (tx) => {
      const cls = await tx.findClassById(classId);
      if (!cls) {
        const err = new Error('Class not found.');
        err.statusCode = 404;
        throw err;
      }
      const subj = await tx.findSubjectById(subjectId);
      if (!subj || subj.classId !== cls.id) {
        const err = new Error('Subject not found in this class.');
        err.statusCode = 404;
        throw err;
      }
      if (subj.assignedProfessorId === req.user.id) {
        const err = new Error('You are already approved for this subject.');
        err.statusCode = 400;
        throw err;
      }
      if (subj.status === 'LOCKED' || (subj.assignedProfessorId && subj.assignedProfessorId !== req.user.id)) {
        const err = new Error('This subject is already assigned to another professor.');
        err.statusCode = 409;
        throw err;
      }

      const perm = await tx.upsertSubjectPermission({
        classId: cls.id,
        subjectId: subj.id,
        professorId: req.user.id,
      });

      hodId = cls.hodId;
      await tx.createNotification({
        userId: cls.hodId,
        role: 'HOD',
        type: 'SUBJECT_PERMISSION_REQUEST',
        title: 'New Subject Permission Request',
        message: `${req.user.name} (${req.user.identifier}) requested access to ${subj.code} - ${subj.name} in ${cls.className}.`,
        relatedClassId: cls.id,
      });

      return perm;
    });

    emitEventToUsers([hodId, req.user.id], 'CLASS_SYNC', { classId });
    res.status(201).json({ permission });
  } catch (err) {
    next(err);
  }
});

router.get('/workspaces', async (req, res, next) => {
  try {
    const repo = getRepo();
    const [assignedSubjects, myPermissions] = await Promise.all([
      repo.listSubjectsByProfessor(req.user.id),
      repo.listSubjectPermissionsByProfessor(req.user.id),
    ]);

    const workspaces = (
      await Promise.all(assignedSubjects.map((s) => buildSubjectWorkspace(repo, s)))
    ).filter(Boolean);

    const pendingRequests = [];
    for (const p of myPermissions) {
      if (p.status === 'APPROVED') continue;
      const cls = await repo.findClassById(p.classId);
      const subj = await repo.findSubjectById(p.subjectId);
      if (cls && subj) {
        pendingRequests.push({
          ...p,
          className: cls.className,
          semesterYear: cls.semesterYear,
          subjectCode: subj.code,
          subjectName: subj.name,
        });
      }
    }

    res.json({ workspaces, pendingRequests });
  } catch (err) {
    next(err);
  }
});

router.put('/subjects/:subjectId/marks', async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const entries = Array.isArray(req.body.entries) ? req.body.entries : [];
    const action = req.body.action === 'BULK_IMPORT' ? 'BULK_IMPORT' : null;

    if (entries.length === 0) {
      return res.status(400).json({ error: 'No mark entries provided.' });
    }

    const notifyTargets = new Set();

    const workspace = await withTransaction(async (tx) => {
      const subj = await tx.findSubjectById(subjectId);
      if (!subj) {
        const err = new Error('Subject not found.');
        err.statusCode = 404;
        throw err;
      }
      if (subj.assignedProfessorId !== req.user.id) {
        const err = new Error('You are not authorized to enter marks for this subject.');
        err.statusCode = 403;
        throw err;
      }

      const cls = await tx.findClassById(subj.classId);
      const enrollments = await tx.listEnrollmentsByClass(cls.id);
      const approvedByStudentId = new Map(
        enrollments.filter((e) => e.status === 'APPROVED').map((e) => [e.studentId, e])
      );
      const approvedByEnrollmentNo = new Map(
        enrollments
          .filter((e) => e.status === 'APPROVED')
          .map((e) => [e.enrollmentNo.toUpperCase(), e])
      );

      for (const item of entries) {
        let enr = item.studentId ? approvedByStudentId.get(item.studentId) : null;
        if (!enr && item.enrollmentNo) {
          enr = approvedByEnrollmentNo.get(String(item.enrollmentNo).trim().toUpperCase());
        }
        if (!enr) continue; // skip unapproved / non-enrolled rows on bulk import

        const marksVal = Number(item.marksObtained);
        if (!Number.isFinite(marksVal) || marksVal < 0 || marksVal > subj.maxMarks) {
          const err = new Error(
            `Invalid marks (${item.marksObtained}) for ${enr.enrollmentNo}. Must be between 0 and ${subj.maxMarks}.`
          );
          err.statusCode = 400;
          throw err;
        }

        const stu = await tx.findUserById(enr.studentId);
        const { mark, oldMarks } = await tx.upsertMarkWithOcc({
          classId: cls.id,
          subjectId: subj.id,
          studentId: enr.studentId,
          marksObtained: marksVal,
          aiRemark: item.aiRemark !== undefined ? String(item.aiRemark) : undefined,
          enteredById: req.user.id,
          expectedVersion: item.markVersion,
        });

        // Log every entry or modification in immutable AuditLog
        const marksChanged = oldMarks === null || Number(oldMarks) !== Number(mark.marksObtained);
        if (marksChanged) {
          await tx.createAuditLog({
            classId: cls.id,
            subjectId: subj.id,
            studentId: enr.studentId,
            professorId: req.user.id,
            professorName: req.user.name,
            subjectCode: subj.code,
            subjectName: subj.name,
            studentEnrollmentNo: enr.enrollmentNo,
            studentName: stu?.name || 'Student',
            oldMarks,
            newMarks: mark.marksObtained,
            action: action || (oldMarks === null ? 'ENTRY' : 'UPDATE'),
          });
        }

        if (cls.isDeployed) {
          notifyTargets.add(enr.studentId);
        }
      }

      if (subj.status === 'PENDING_PROFESSOR') {
        await tx.updateSubjectWithVersion(subj.id, subj.version, { status: 'IN_PROGRESS' });
      }

      notifyTargets.add(cls.hodId);
      notifyTargets.add(req.user.id);

      const refreshedSubj = await tx.findSubjectById(subj.id);
      return buildSubjectWorkspace(tx, refreshedSubj);
    });

    emitEventToUsers([...notifyTargets], 'CLASS_SYNC', { classId: workspace.classInfo.id });
    res.json({ workspace });
  } catch (err) {
    next(err);
  }
});

router.post('/subjects/:subjectId/auto-remarks', async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const notifyTargets = new Set();

    const workspace = await withTransaction(async (tx) => {
      const subj = await tx.findSubjectById(subjectId);
      if (!subj || subj.assignedProfessorId !== req.user.id) {
        const err = new Error('Subject not found or unauthorized.');
        err.statusCode = 403;
        throw err;
      }
      const cls = await tx.findClassById(subj.classId);
      const marks = await tx.listMarksBySubject(subj.id);
      if (marks.length === 0) {
        const err = new Error('Enter marks for at least one student before generating AI Auto-Remarks.');
        err.statusCode = 400;
        throw err;
      }

      const avg = marks.reduce((acc, m) => acc + Number(m.marksObtained), 0) / marks.length;
      const topper = Math.max(...marks.map((m) => Number(m.marksObtained)));

      for (const m of marks) {
        const stu = await tx.findUserById(m.studentId);
        const remark = generateDeterministicRemark({
          studentName: stu?.name || 'Student',
          subjectName: subj.name,
          marksObtained: m.marksObtained,
          maxMarks: subj.maxMarks,
          classAverage: avg,
          topperMarks: topper,
          passingPercentage: cls.passingPercentage,
        });
        await tx.upsertMarkWithOcc({
          classId: cls.id,
          subjectId: subj.id,
          studentId: m.studentId,
          marksObtained: m.marksObtained,
          aiRemark: remark,
          enteredById: req.user.id,
          expectedVersion: m.version,
        });
      }

      notifyTargets.add(req.user.id);
      if (cls.isDeployed) {
        marks.forEach((m) => notifyTargets.add(m.studentId));
      }

      return buildSubjectWorkspace(tx, subj);
    });

    emitEventToUsers([...notifyTargets], 'CLASS_SYNC', { classId: workspace.classInfo.id });
    res.json({ workspace });
  } catch (err) {
    next(err);
  }
});

router.post('/subjects/:subjectId/lock', async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    let hodId = null;

    const workspace = await withTransaction(async (tx) => {
      const subj = await tx.findSubjectById(subjectId);
      if (!subj || subj.assignedProfessorId !== req.user.id) {
        const err = new Error('Subject not found or unauthorized.');
        err.statusCode = 403;
        throw err;
      }

      const cls = await tx.findClassById(subj.classId);
      const enrollments = await tx.listEnrollmentsByClass(cls.id);
      const approvedCount = enrollments.filter((e) => e.status === 'APPROVED').length;
      const marks = await tx.listMarksBySubject(subj.id);

      if (approvedCount > 0 && marks.length < approvedCount) {
        const err = new Error(
          `Please enter marks for all ${approvedCount} approved students before locking (${marks.length}/${approvedCount} entered).`
        );
        err.statusCode = 400;
        throw err;
      }

      const lockedSubj = await tx.updateSubjectWithVersion(subj.id, subj.version, {
        status: 'LOCKED',
        lockedAt: new Date(),
      });

      hodId = cls.hodId;
      await tx.createNotification({
        userId: cls.hodId,
        role: 'HOD',
        type: 'SUBJECT_LOCKED',
        title: 'Subject Marks Locked & Submitted',
        message: `${req.user.name} locked & submitted ${subj.code} - ${subj.name} for ${cls.className}.`,
        relatedClassId: cls.id,
      });

      return buildSubjectWorkspace(tx, lockedSubj);
    });

    emitEventToUsers([hodId, req.user.id], 'CLASS_SYNC', { classId: workspace.classInfo.id });
    res.json({ workspace });
  } catch (err) {
    next(err);
  }
});

export default router;
