import express from 'express';
import { getRepo, withTransaction } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { extractInviteCode } from './professor.js';
import {
  calculateSubjectResult,
  computeOverallSummary,
  generateStudentInsights,
} from '../utils/grading.js';
import { emitEventToUsers } from '../utils/events.js';

const router = express.Router();
router.use(authenticate, requireRole('STUDENT'));

router.post('/join', async (req, res, next) => {
  try {
    const code = extractInviteCode(req.body.inviteCode);
    if (!code) {
      return res.status(400).json({ error: 'Please enter or scan a valid Class Invite Code / Link.' });
    }

    let hodId = null;
    const enrollment = await withTransaction(async (tx) => {
      const cls = await tx.findClassByInviteCode(code);
      if (!cls) {
        const err = new Error(`No class found for invite code "${code}".`);
        err.statusCode = 404;
        throw err;
      }

      const existing = await tx.findEnrollmentByClassAndStudent(cls.id, req.user.id);
      if (existing && existing.status === 'APPROVED') {
        const err = new Error(`You are already enrolled in ${cls.className}.`);
        err.statusCode = 400;
        throw err;
      }

      const studentEnrollmentNo = req.user.identifier.trim().toUpperCase();
      const whitelist = Array.isArray(cls.whitelist) ? cls.whitelist : [];
      const whitelistMatched = whitelist.includes(studentEnrollmentNo);

      if (whitelist.length > 0 && !whitelistMatched) {
        const err = new Error(
          `Enrollment Rejected: Your Enrollment No. (${studentEnrollmentNo}) is not on the HOD's valid whitelist for ${cls.className}.`
        );
        err.statusCode = 403;
        throw err;
      }

      const enr = await tx.upsertEnrollment({
        classId: cls.id,
        studentId: req.user.id,
        enrollmentNo: studentEnrollmentNo,
        whitelistMatched,
      });

      hodId = cls.hodId;
      await tx.createNotification({
        userId: cls.hodId,
        role: 'HOD',
        type: 'ENROLLMENT_REQUEST',
        title: 'New Student Enrollment Request',
        message: `${req.user.name} (${studentEnrollmentNo}) requested to join ${cls.className}${
          whitelistMatched ? ' (Whitelist Verified)' : ''
        }.`,
        relatedClassId: cls.id,
      });

      return { ...enr, className: cls.className };
    });

    emitEventToUsers([hodId, req.user.id], 'CLASS_SYNC', { classId: enrollment.classId });
    res.status(201).json({ enrollment });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const repo = getRepo();
    // 100% PRIVATE: Strictly queries only req.user.id
    const enrollments = await repo.listEnrollmentsByStudent(req.user.id);

    const classesData = [];
    const deployedReportCards = [];

    for (const enr of enrollments) {
      const cls = await repo.findClassById(enr.classId);
      if (!cls) continue;

      const subjects = await repo.listSubjectsByClass(cls.id);
      const lockedSubjectsCount = subjects.filter((s) => s.status === 'LOCKED').length;
      const totalSubjectsCount = subjects.length;

      let statusLabel = 'Pending HOD Verification';
      if (enr.status === 'REJECTED') {
        statusLabel = 'Enrollment Rejected by HOD';
      } else if (enr.status === 'APPROVED' && !cls.isDeployed) {
        statusLabel = 'Enrolled — Awaiting All Subjects & Result Deployment';
      } else if (enr.status === 'APPROVED' && cls.isDeployed) {
        statusLabel = 'Result Deployed';
      }

      let reportCard = null;

      // CRITICAL PRIVACY & SYNCHRONIZED RELEASE RULE:
      // Only expose marks and report card when enrollment is APPROVED AND HOD has deployed final results
      if (enr.status === 'APPROVED' && cls.isDeployed) {
        const myMarks = await repo.listMarksByClassAndStudent(cls.id, req.user.id);
        const myMarksBySubject = new Map(myMarks.map((m) => [m.subjectId, m]));

        // Compute anonymized cohort average & topper percentage per subject for AI Weak-Area Insight
        const allClassMarks = await repo.listMarksByClass(cls.id);
        const marksBySubj = new Map();
        for (const m of allClassMarks) {
          if (!marksBySubj.has(m.subjectId)) marksBySubj.set(m.subjectId, []);
          marksBySubj.get(m.subjectId).push(Number(m.marksObtained));
        }

        const subjectRows = subjects.map((subj) => {
          const m = myMarksBySubject.get(subj.id);
          const marksObtained = m ? Number(m.marksObtained) : 0;
          const calc = calculateSubjectResult(
            marksObtained,
            subj.maxMarks,
            cls.passingPercentage,
            cls.gradeBoundaries
          );

          const cohortScores = marksBySubj.get(subj.id) || [];
          const cohortAvg =
            cohortScores.length > 0
              ? cohortScores.reduce((a, b) => a + b, 0) / cohortScores.length
              : marksObtained;
          const cohortTopper = cohortScores.length > 0 ? Math.max(...cohortScores) : marksObtained;

          return {
            subjectId: subj.id,
            code: subj.code,
            name: subj.name,
            maxMarks: subj.maxMarks,
            marksObtained,
            aiRemark: m?.aiRemark || '',
            ...calc,
            classAveragePercentage: Number(((cohortAvg / subj.maxMarks) * 100).toFixed(2)),
            classTopperPercentage: Number(((cohortTopper / subj.maxMarks) * 100).toFixed(2)),
          };
        });

        const summary = computeOverallSummary(
          subjectRows,
          cls.passingPercentage,
          cls.gradeBoundaries
        );

        reportCard = {
          student: {
            name: req.user.name,
            enrollmentNo: enr.enrollmentNo,
            department: req.user.department,
          },
          classInfo: {
            id: cls.id,
            className: cls.className,
            courseProgram: cls.courseProgram,
            semesterYear: cls.semesterYear,
            examMonthYear: cls.examMonthYear,
            passingPercentage: cls.passingPercentage,
            gradeBoundaries: cls.gradeBoundaries,
            preparedBy: cls.preparedBy,
            checkedBy: cls.checkedBy,
            dateOfIssue: cls.dateOfIssue,
            controllerTitle: cls.controllerTitle,
            deployedAt: cls.deployedAt,
          },
          subjects: subjectRows,
          summary,
        };

        deployedReportCards.push(reportCard);
      }

      classesData.push({
        enrollmentId: enr.id,
        classId: cls.id,
        className: cls.className,
        courseProgram: cls.courseProgram,
        semesterYear: cls.semesterYear,
        examMonthYear: cls.examMonthYear,
        enrollmentStatus: enr.status,
        isDeployed: cls.isDeployed,
        lockedSubjectsCount,
        totalSubjectsCount,
        statusLabel,
        reportCard,
      });
    }

    const insights = generateStudentInsights(deployedReportCards);

    res.json({
      student: req.user,
      classes: classesData,
      insights,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
