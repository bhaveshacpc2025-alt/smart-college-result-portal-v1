import express from 'express';
import { randomBytes } from 'node:crypto';
import { getRepo, withTransaction } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { DEFAULT_GRADE_BOUNDARIES, normalizeGradeBoundaries } from '../utils/grading.js';
import { emitEventToUsers } from '../utils/events.js';

const router = express.Router();
router.use(authenticate, requireRole('HOD'));

function generateInviteCode() {
  return `CLS-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function parseWhitelist(input) {
  if (Array.isArray(input)) {
    return [...new Set(input.map((x) => String(x || '').trim().toUpperCase()).filter(Boolean))];
  }
  return [
    ...new Set(
      String(input || '')
        .split(/[\n,;\s]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean)
    ),
  ];
}

async function buildClassHydrated(repo, cls) {
  const [subjects, permissions, enrollments, marks] = await Promise.all([
    repo.listSubjectsByClass(cls.id),
    repo.listSubjectPermissionsByClass(cls.id),
    repo.listEnrollmentsByClass(cls.id),
    repo.listMarksByClass(cls.id),
  ]);

  const userIds = new Set();
  subjects.forEach((s) => s.assignedProfessorId && userIds.add(s.assignedProfessorId));
  permissions.forEach((p) => userIds.add(p.professorId));
  enrollments.forEach((e) => userIds.add(e.studentId));

  const usersMap = new Map();
  for (const uid of userIds) {
    const u = await repo.findUserById(uid);
    if (u) usersMap.set(uid, u);
  }

  const subjectsMap = new Map(subjects.map((s) => [s.id, s]));
  const marksBySubject = new Map();
  for (const m of marks) {
    marksBySubject.set(m.subjectId, (marksBySubject.get(m.subjectId) || 0) + 1);
  }

  const approvedStudentsCount = enrollments.filter((e) => e.status === 'APPROVED').length;
  const hydratedSubjects = subjects.map((s) => {
    const prof = s.assignedProfessorId ? usersMap.get(s.assignedProfessorId) : null;
    return {
      ...s,
      assignedProfessorName: prof ? prof.name : null,
      assignedProfessorIdentifier: prof ? prof.identifier : null,
      marksEnteredCount: marksBySubject.get(s.id) || 0,
      approvedStudentsCount,
    };
  });

  const hydratedPermissions = permissions.map((p) => {
    const prof = usersMap.get(p.professorId);
    const subj = subjectsMap.get(p.subjectId);
    return {
      ...p,
      professorName: prof?.name || 'Professor',
      professorIdentifier: prof?.identifier || '',
      professorDepartment: prof?.department || '',
      subjectCode: subj?.code || '',
      subjectName: subj?.name || '',
    };
  });

  const hydratedEnrollments = enrollments.map((e) => {
    const stu = usersMap.get(e.studentId);
    return {
      ...e,
      studentName: stu?.name || 'Student',
      studentDepartment: stu?.department || '',
    };
  });

  const allSubjectsLocked =
    hydratedSubjects.length > 0 && hydratedSubjects.every((s) => s.status === 'LOCKED');

  return {
    ...cls,
    subjects: hydratedSubjects,
    permissions: hydratedPermissions,
    enrollments: hydratedEnrollments,
    allSubjectsLocked,
    lockedSubjectsCount: hydratedSubjects.filter((s) => s.status === 'LOCKED').length,
    totalSubjectsCount: hydratedSubjects.length,
    approvedStudentsCount,
  };
}

router.get('/classes', async (req, res, next) => {
  try {
    const repo = getRepo();
    const classes = await repo.listClassesByHod(req.user.id);
    const hydrated = await Promise.all(classes.map((c) => buildClassHydrated(repo, c)));
    res.json({ classes: hydrated });
  } catch (err) {
    next(err);
  }
});

router.post('/classes', async (req, res, next) => {
  try {
    const className = String(req.body.className || '').trim();
    const courseProgram = String(req.body.courseProgram || '').trim();
    const semesterYear = String(req.body.semesterYear || '').trim();
    const examMonthYear = String(req.body.examMonthYear || '').trim();
    const passingPercentage = Number(req.body.passingPercentage ?? 40);
    const preparedBy = String(req.body.preparedBy || req.user.name || '').trim();
    const checkedBy = String(req.body.checkedBy || '').trim();
    const dateOfIssue = String(req.body.dateOfIssue || new Date().toISOString().slice(0, 10)).trim();
    const controllerTitle = String(req.body.controllerTitle || 'Controller of Examinations').trim();

    const subjectsInput = Array.isArray(req.body.subjects) ? req.body.subjects : [];
    const whitelist = parseWhitelist(req.body.whitelist);
    const gradeBoundaries = normalizeGradeBoundaries(
      req.body.gradeBoundaries || DEFAULT_GRADE_BOUNDARIES
    );

    if (!className || !courseProgram || !semesterYear || !examMonthYear) {
      return res.status(400).json({
        error: 'Class Name, Course / Program, Semester / Year, and Examination Month & Year are required.',
      });
    }
    if (subjectsInput.length === 0) {
      return res.status(400).json({ error: 'At least one subject (Code, Name, Max Marks) is required.' });
    }
    if (!Number.isFinite(passingPercentage) || passingPercentage <= 0 || passingPercentage > 100) {
      return res.status(400).json({ error: 'Passing percentage must be between 1 and 100.' });
    }

    const cleanedSubjects = [];
    const seenCodes = new Set();
    for (const s of subjectsInput) {
      const code = String(s.code || '').trim().toUpperCase();
      const name = String(s.name || '').trim();
      const maxMarks = Number(s.maxMarks || 100);
      if (!code || !name || !Number.isFinite(maxMarks) || maxMarks <= 0) {
        return res.status(400).json({ error: 'Each subject needs a valid Code, Name, and positive Max Marks.' });
      }
      if (seenCodes.has(code)) {
        return res.status(400).json({ error: `Duplicate subject code "${code}".` });
      }
      seenCodes.add(code);
      cleanedSubjects.push({ code, name, maxMarks: Math.round(maxMarks) });
    }

    const created = await withTransaction(async (tx) => {
      let inviteCode = generateInviteCode();
      while (await tx.findClassByInviteCode(inviteCode)) {
        inviteCode = generateInviteCode();
      }

      const cls = await tx.createClass({
        hodId: req.user.id,
        className,
        courseProgram,
        semesterYear,
        examMonthYear,
        inviteCode,
        passingPercentage,
        gradeBoundariesJson: JSON.stringify(gradeBoundaries),
        preparedBy,
        checkedBy,
        dateOfIssue,
        controllerTitle,
        whitelistJson: JSON.stringify(whitelist),
        isDeployed: false,
      });

      for (const s of cleanedSubjects) {
        await tx.createSubject({
          classId: cls.id,
          code: s.code,
          name: s.name,
          maxMarks: s.maxMarks,
          status: 'PENDING_PROFESSOR',
        });
      }

      return buildClassHydrated(tx, cls);
    });

    emitEventToUsers([req.user.id], 'CLASS_SYNC', { classId: created.id });
    res.status(201).json({ class: created });
  } catch (err) {
    next(err);
  }
});

router.put('/classes/:classId/settings', async (req, res, next) => {
  try {
    const { classId } = req.params;
    const notifyUserIds = new Set();

    const updated = await withTransaction(async (tx) => {
      const cls = await tx.findClassById(classId);
      if (!cls || cls.hodId !== req.user.id) {
        const err = new Error('Class not found or unauthorized.');
        err.statusCode = 404;
        throw err;
      }

      const patch = {};
      if (req.body.className !== undefined) patch.className = String(req.body.className).trim();
      if (req.body.courseProgram !== undefined) patch.courseProgram = String(req.body.courseProgram).trim();
      if (req.body.semesterYear !== undefined) patch.semesterYear = String(req.body.semesterYear).trim();
      if (req.body.examMonthYear !== undefined) patch.examMonthYear = String(req.body.examMonthYear).trim();
      if (req.body.passingPercentage !== undefined) {
        const p = Number(req.body.passingPercentage);
        if (!Number.isFinite(p) || p <= 0 || p > 100) {
          const err = new Error('Passing percentage must be between 1 and 100.');
          err.statusCode = 400;
          throw err;
        }
        patch.passingPercentage = p;
      }
      if (req.body.gradeBoundaries !== undefined) {
        patch.gradeBoundariesJson = JSON.stringify(normalizeGradeBoundaries(req.body.gradeBoundaries));
      }
      if (req.body.preparedBy !== undefined) patch.preparedBy = String(req.body.preparedBy).trim();
      if (req.body.checkedBy !== undefined) patch.checkedBy = String(req.body.checkedBy).trim();
      if (req.body.dateOfIssue !== undefined) patch.dateOfIssue = String(req.body.dateOfIssue).trim();
      if (req.body.controllerTitle !== undefined) patch.controllerTitle = String(req.body.controllerTitle).trim();
      if (req.body.whitelist !== undefined) {
        patch.whitelistJson = JSON.stringify(parseWhitelist(req.body.whitelist));
      }

      const expectedVersion = req.body.version ?? cls.version;
      const savedCls = await tx.updateClassWithVersion(classId, expectedVersion, patch);

      // Optional subject maxMarks updates
      if (Array.isArray(req.body.subjects)) {
        const existingSubjects = await tx.listSubjectsByClass(classId);
        const byId = new Map(existingSubjects.map((s) => [s.id, s]));
        for (const sUpdate of req.body.subjects) {
          const subj = byId.get(sUpdate.id);
          if (subj && sUpdate.maxMarks !== undefined) {
            const m = Number(sUpdate.maxMarks);
            if (Number.isFinite(m) && m > 0) {
              await tx.updateSubjectWithVersion(subj.id, subj.version, {
                maxMarks: Math.round(m),
                name: sUpdate.name ? String(sUpdate.name).trim() : subj.name,
              });
            }
          }
        }
      }

      const subjects = await tx.listSubjectsByClass(classId);
      const enrollments = await tx.listEnrollmentsByClass(classId);
      subjects.forEach((s) => s.assignedProfessorId && notifyUserIds.add(s.assignedProfessorId));
      enrollments.forEach((e) => notifyUserIds.add(e.studentId));
      notifyUserIds.add(req.user.id);

      return buildClassHydrated(tx, savedCls);
    });

    emitEventToUsers([...notifyUserIds], 'CLASS_SYNC', { classId });
    res.json({ class: updated });
  } catch (err) {
    next(err);
  }
});

router.patch('/permissions/:permissionId', async (req, res, next) => {
  try {
    const action = String(req.body.action || '').trim().toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be APPROVE or REJECT.' });
    }

    const notifyTargets = [];
    const result = await withTransaction(async (tx) => {
      const perm = await tx.findSubjectPermissionById(req.params.permissionId);
      if (!perm) {
        const err = new Error('Subject permission request not found.');
        err.statusCode = 404;
        throw err;
      }

      const cls = await tx.findClassById(perm.classId);
      if (!cls || cls.hodId !== req.user.id) {
        const err = new Error('Unauthorized to manage this class permission.');
        err.statusCode = 403;
        throw err;
      }

      const subj = await tx.findSubjectById(perm.subjectId);
      if (!subj) {
        const err = new Error('Subject not found.');
        err.statusCode = 404;
        throw err;
      }

      if (action === 'APPROVE') {
        if (subj.status === 'LOCKED') {
          const err = new Error('Cannot reassign a subject that is already locked.');
          err.statusCode = 400;
          throw err;
        }
        await tx.updateSubjectPermission(perm.id, {
          status: 'APPROVED',
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        });
        await tx.rejectOtherPendingPermissions(subj.id, perm.id, req.user.id);
        await tx.updateSubjectWithVersion(subj.id, subj.version, {
          assignedProfessorId: perm.professorId,
          status: 'IN_PROGRESS',
        });

        await tx.createNotification({
          userId: perm.professorId,
          role: 'PROFESSOR',
          type: 'SUBJECT_APPROVED',
          title: 'Subject Permission Approved',
          message: `HOD approved your access for ${subj.code} - ${subj.name} (${cls.className}). Marks entry is now unlocked.`,
          relatedClassId: cls.id,
        });
        notifyTargets.push(perm.professorId, req.user.id);
      } else {
        await tx.updateSubjectPermission(perm.id, {
          status: 'REJECTED',
          reviewedById: req.user.id,
          reviewedAt: new Date(),
        });
        await tx.createNotification({
          userId: perm.professorId,
          role: 'PROFESSOR',
          type: 'SUBJECT_REJECTED',
          title: 'Subject Request Declined',
          message: `Your request for ${subj.code} - ${subj.name} (${cls.className}) was declined by HOD.`,
          relatedClassId: cls.id,
        });
        notifyTargets.push(perm.professorId, req.user.id);
      }

      return buildClassHydrated(tx, cls);
    });

    emitEventToUsers(notifyTargets, 'CLASS_SYNC', { classId: result.id });
    res.json({ class: result });
  } catch (err) {
    next(err);
  }
});

router.patch('/enrollments/:enrollmentId', async (req, res, next) => {
  try {
    const action = String(req.body.action || '').trim().toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ error: 'Action must be APPROVE or REJECT.' });
    }

    const notifyTargets = [];
    const result = await withTransaction(async (tx) => {
      const enr = await tx.findEnrollmentById(req.params.enrollmentId);
      if (!enr) {
        const err = new Error('Enrollment request not found.');
        err.statusCode = 404;
        throw err;
      }

      const cls = await tx.findClassById(enr.classId);
      if (!cls || cls.hodId !== req.user.id) {
        const err = new Error('Unauthorized to manage enrollment for this class.');
        err.statusCode = 403;
        throw err;
      }

      const nextStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      await tx.updateEnrollment(enr.id, {
        status: nextStatus,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
      });

      await tx.createNotification({
        userId: enr.studentId,
        role: 'STUDENT',
        type: nextStatus === 'APPROVED' ? 'ENROLLMENT_APPROVED' : 'ENROLLMENT_REJECTED',
        title: nextStatus === 'APPROVED' ? 'Class Enrollment Approved' : 'Class Enrollment Rejected',
        message:
          nextStatus === 'APPROVED'
            ? `Your enrollment in ${cls.className} has been verified and approved by HOD.`
            : `Your enrollment request for ${cls.className} was rejected by HOD.`,
        relatedClassId: cls.id,
      });

      notifyTargets.push(enr.studentId, req.user.id);
      const subjects = await tx.listSubjectsByClass(cls.id);
      subjects.forEach((s) => s.assignedProfessorId && notifyTargets.push(s.assignedProfessorId));

      return buildClassHydrated(tx, cls);
    });

    emitEventToUsers(notifyTargets, 'CLASS_SYNC', { classId: result.id });
    res.json({ class: result });
  } catch (err) {
    next(err);
  }
});

router.post('/classes/:classId/deploy', async (req, res, next) => {
  try {
    const notifyTargets = [];
    const deployedClass = await withTransaction(async (tx) => {
      const cls = await tx.findClassById(req.params.classId);
      if (!cls || cls.hodId !== req.user.id) {
        const err = new Error('Class not found or unauthorized.');
        err.statusCode = 404;
        throw err;
      }

      const subjects = await tx.listSubjectsByClass(cls.id);
      if (subjects.length === 0) {
        const err = new Error('Cannot deploy results for a class with no subjects.');
        err.statusCode = 400;
        throw err;
      }

      const unlocked = subjects.filter((s) => s.status !== 'LOCKED');
      if (unlocked.length > 0) {
        const names = unlocked.map((s) => `${s.code} (${s.status})`).join(', ');
        const err = new Error(
          `Synchronized Release Rule: All subjects must be Locked & Submitted before deploying. Pending: ${names}`
        );
        err.statusCode = 400;
        throw err;
      }

      const updatedCls = await tx.updateClassWithVersion(cls.id, cls.version, {
        isDeployed: true,
        deployedAt: new Date(),
      });

      const enrollments = await tx.listEnrollmentsByClass(cls.id);
      const approvedEnrollments = enrollments.filter((e) => e.status === 'APPROVED');

      for (const enr of approvedEnrollments) {
        await tx.createNotification({
          userId: enr.studentId,
          role: 'STUDENT',
          type: 'RESULT_DEPLOYED',
          title: 'Official Result Deployed!',
          message: `Final results for ${cls.className} (${cls.examMonthYear}) are now live. Open your Official Report Card.`,
          relatedClassId: cls.id,
        });
        notifyTargets.push(enr.studentId);
      }

      for (const s of subjects) {
        if (s.assignedProfessorId) {
          await tx.createNotification({
            userId: s.assignedProfessorId,
            role: 'PROFESSOR',
            type: 'RESULT_DEPLOYED',
            title: 'Class Results Deployed',
            message: `HOD has deployed final results for ${cls.className}.`,
            relatedClassId: cls.id,
          });
          notifyTargets.push(s.assignedProfessorId);
        }
      }

      notifyTargets.push(req.user.id);
      return buildClassHydrated(tx, updatedCls);
    });

    emitEventToUsers(notifyTargets, 'RESULT_DEPLOYED', { classId: deployedClass.id });
    res.json({ class: deployedClass });
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', async (req, res, next) => {
  try {
    const repo = getRepo();
    const { classId } = req.query;
    let logs = [];
    if (classId) {
      const cls = await repo.findClassById(String(classId));
      if (!cls || cls.hodId !== req.user.id) {
        return res.status(404).json({ error: 'Class not found or unauthorized.' });
      }
      logs = await repo.listAuditLogsByClass(cls.id);
    } else {
      logs = await repo.listAuditLogsByHod(req.user.id);
    }
    res.json({ auditLogs: logs });
  } catch (err) {
    next(err);
  }
});

export default router;
