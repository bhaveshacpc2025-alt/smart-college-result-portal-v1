import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SQLITE_DDL } from './sqliteSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..', '..');

let mode = 'sqlite'; // 'mysql' | 'sqlite'
let prismaClient = null;
let sqliteDb = null;

function nowIso() {
  return new Date().toISOString();
}

function toBool(v) {
  return Boolean(v);
}

function normalizeClassRow(row) {
  if (!row) return null;
  return {
    ...row,
    isDeployed: toBool(row.isDeployed),
    gradeBoundaries: safeJsonParse(row.gradeBoundariesJson, []),
    whitelist: safeJsonParse(row.whitelistJson, []),
  };
}

function normalizeEnrollmentRow(row) {
  if (!row) return null;
  return {
    ...row,
    whitelistMatched: toBool(row.whitelistMatched),
  };
}

function normalizeNotificationRow(row) {
  if (!row) return null;
  return {
    ...row,
    isRead: toBool(row.isRead),
  };
}

export function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export class ConflictError extends Error {
  constructor(message = 'Concurrent modification detected. Please retry.') {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

function createPrismaRepo(client) {
  return {
    async findUserById(id) {
      return client.user.findUnique({ where: { id } });
    },
    async findUserByRoleAndIdentifier(role, identifier) {
      return client.user.findUnique({
        where: { role_identifier: { role, identifier } },
      });
    },
    async countUsersByRole(role) {
      return client.user.count({ where: { role } });
    },
    async createUser(data) {
      return client.user.create({ data: { id: randomUUID(), ...data } });
    },
    async listUsersByRole(role) {
      return client.user.findMany({ where: { role }, orderBy: { createdAt: 'desc' } });
    },

    async createClass(data) {
      const row = await client.collegeClass.create({
        data: { id: randomUUID(), ...data },
      });
      return normalizeClassRow(row);
    },
    async findClassById(id) {
      const row = await client.collegeClass.findUnique({ where: { id } });
      return normalizeClassRow(row);
    },
    async findClassByInviteCode(inviteCode) {
      const row = await client.collegeClass.findUnique({ where: { inviteCode } });
      return normalizeClassRow(row);
    },
    async listClassesByHod(hodId) {
      const rows = await client.collegeClass.findMany({
        where: { hodId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(normalizeClassRow);
    },
    async updateClassWithVersion(id, expectedVersion, patch) {
      const res = await client.collegeClass.updateMany({
        where: { id, version: expectedVersion },
        data: { ...patch, version: expectedVersion + 1 },
      });
      if (res.count === 0) throw new ConflictError('Class was updated concurrently. Please refresh and try again.');
      return this.findClassById(id);
    },

    async createSubject(data) {
      return client.subject.create({ data: { id: randomUUID(), ...data } });
    },
    async findSubjectById(id) {
      return client.subject.findUnique({ where: { id } });
    },
    async listSubjectsByClass(classId) {
      return client.subject.findMany({ where: { classId }, orderBy: { code: 'asc' } });
    },
    async listSubjectsByProfessor(professorId) {
      return client.subject.findMany({
        where: { assignedProfessorId: professorId },
        orderBy: { createdAt: 'desc' },
      });
    },
    async updateSubjectWithVersion(id, expectedVersion, patch) {
      const res = await client.subject.updateMany({
        where: { id, version: expectedVersion },
        data: { ...patch, version: expectedVersion + 1 },
      });
      if (res.count === 0) throw new ConflictError('Subject state changed concurrently. Please retry.');
      return this.findSubjectById(id);
    },

    async upsertSubjectPermission({ classId, subjectId, professorId }) {
      return client.subjectPermission.upsert({
        where: { subjectId_professorId: { subjectId, professorId } },
        create: {
          id: randomUUID(),
          classId,
          subjectId,
          professorId,
          status: 'PENDING',
        },
        update: {
          status: 'PENDING',
          reviewedById: null,
          reviewedAt: null,
        },
      });
    },
    async findSubjectPermissionById(id) {
      return client.subjectPermission.findUnique({ where: { id } });
    },
    async listSubjectPermissionsByClass(classId) {
      return client.subjectPermission.findMany({
        where: { classId },
        orderBy: { createdAt: 'desc' },
      });
    },
    async listSubjectPermissionsByProfessor(professorId) {
      return client.subjectPermission.findMany({
        where: { professorId },
        orderBy: { createdAt: 'desc' },
      });
    },
    async updateSubjectPermission(id, patch) {
      return client.subjectPermission.update({ where: { id }, data: patch });
    },
    async rejectOtherPendingPermissions(subjectId, approvedPermissionId, reviewedById) {
      await client.subjectPermission.updateMany({
        where: {
          subjectId,
          id: { not: approvedPermissionId },
          status: 'PENDING',
        },
        data: {
          status: 'REJECTED',
          reviewedById,
          reviewedAt: new Date(),
        },
      });
    },

    async upsertEnrollment({ classId, studentId, enrollmentNo, whitelistMatched }) {
      const row = await client.enrollment.upsert({
        where: { classId_studentId: { classId, studentId } },
        create: {
          id: randomUUID(),
          classId,
          studentId,
          enrollmentNo,
          status: 'PENDING',
          whitelistMatched: Boolean(whitelistMatched),
        },
        update: {
          enrollmentNo,
          whitelistMatched: Boolean(whitelistMatched),
          status: 'PENDING',
          reviewedById: null,
          reviewedAt: null,
        },
      });
      return normalizeEnrollmentRow(row);
    },
    async findEnrollmentById(id) {
      const row = await client.enrollment.findUnique({ where: { id } });
      return normalizeEnrollmentRow(row);
    },
    async findEnrollmentByClassAndStudent(classId, studentId) {
      const row = await client.enrollment.findUnique({
        where: { classId_studentId: { classId, studentId } },
      });
      return normalizeEnrollmentRow(row);
    },
    async listEnrollmentsByClass(classId) {
      const rows = await client.enrollment.findMany({
        where: { classId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(normalizeEnrollmentRow);
    },
    async listEnrollmentsByStudent(studentId) {
      const rows = await client.enrollment.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
      });
      return rows.map(normalizeEnrollmentRow);
    },
    async updateEnrollment(id, patch) {
      const row = await client.enrollment.update({ where: { id }, data: patch });
      return normalizeEnrollmentRow(row);
    },

    async findMark(subjectId, studentId) {
      return client.mark.findUnique({
        where: { subjectId_studentId: { subjectId, studentId } },
      });
    },
    async listMarksBySubject(subjectId) {
      return client.mark.findMany({ where: { subjectId } });
    },
    async listMarksByClass(classId) {
      return client.mark.findMany({ where: { classId } });
    },
    async listMarksByClassAndStudent(classId, studentId) {
      return client.mark.findMany({ where: { classId, studentId } });
    },
    async listMarksByStudent(studentId) {
      return client.mark.findMany({ where: { studentId } });
    },
    async upsertMarkWithOcc({ classId, subjectId, studentId, marksObtained, aiRemark, enteredById, expectedVersion }) {
      const existing = await client.mark.findUnique({
        where: { subjectId_studentId: { subjectId, studentId } },
      });
      if (!existing) {
        if (expectedVersion !== undefined && expectedVersion !== null && expectedVersion !== 0) {
          throw new ConflictError('Mark record changed concurrently. Please reload.');
        }
        const created = await client.mark.create({
          data: {
            id: randomUUID(),
            classId,
            subjectId,
            studentId,
            marksObtained,
            aiRemark: aiRemark ?? '',
            enteredById,
            version: 1,
          },
        });
        return { mark: created, oldMarks: null };
      }
      const targetVersion = expectedVersion ?? existing.version;
      const res = await client.mark.updateMany({
        where: { id: existing.id, version: targetVersion },
        data: {
          marksObtained,
          aiRemark: aiRemark !== undefined ? aiRemark : existing.aiRemark,
          enteredById,
          version: targetVersion + 1,
        },
      });
      if (res.count === 0) {
        throw new ConflictError('Concurrent mark update detected. Please refresh and retry.');
      }
      const updated = await client.mark.findUnique({ where: { id: existing.id } });
      return { mark: updated, oldMarks: existing.marksObtained };
    },

    async createAuditLog(data) {
      return client.auditLog.create({ data: { id: randomUUID(), ...data } });
    },
    async listAuditLogsByClass(classId) {
      return client.auditLog.findMany({
        where: { classId },
        orderBy: { createdAt: 'desc' },
      });
    },
    async listAuditLogsByHod(hodId) {
      const classes = await client.collegeClass.findMany({
        where: { hodId },
        select: { id: true },
      });
      const classIds = classes.map((c) => c.id);
      if (classIds.length === 0) return [];
      return client.auditLog.findMany({
        where: { classId: { in: classIds } },
        orderBy: { createdAt: 'desc' },
        take: 300,
      });
    },

    async createNotification(data) {
      const row = await client.notification.create({
        data: { id: randomUUID(), ...data },
      });
      return normalizeNotificationRow(row);
    },
    async listNotificationsByUser(userId) {
      const rows = await client.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return rows.map(normalizeNotificationRow);
    },
    async markNotificationRead(id, userId) {
      await client.notification.updateMany({
        where: { id, userId },
        data: { isRead: true },
      });
    },
    async markAllNotificationsRead(userId) {
      await client.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    },
  };
}

function createSqliteRepo(db) {
  return {
    async findUserById(id) {
      return db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
    },
    async findUserByRoleAndIdentifier(role, identifier) {
      return db.prepare('SELECT * FROM users WHERE role = ? AND identifier = ?').get(role, identifier) ?? null;
    },
    async countUsersByRole(role) {
      const row = db.prepare('SELECT COUNT(*) as cnt FROM users WHERE role = ?').get(role);
      return Number(row.cnt);
    },
    async createUser(data) {
      const id = randomUUID();
      const now = nowIso();
      db.prepare(
        'INSERT INTO users (id, role, identifier, name, department, passwordHash, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, data.role, data.identifier, data.name, data.department ?? '', data.passwordHash, now, now);
      return this.findUserById(id);
    },
    async listUsersByRole(role) {
      return db.prepare('SELECT * FROM users WHERE role = ? ORDER BY createdAt DESC').all(role);
    },

    async createClass(data) {
      const id = randomUUID();
      const now = nowIso();
      db.prepare(
        `INSERT INTO college_classes
          (id, hodId, className, courseProgram, semesterYear, examMonthYear, inviteCode,
           passingPercentage, gradeBoundariesJson, preparedBy, checkedBy, dateOfIssue,
           controllerTitle, whitelistJson, isDeployed, deployedAt, version, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).run(
        id,
        data.hodId,
        data.className,
        data.courseProgram,
        data.semesterYear,
        data.examMonthYear,
        data.inviteCode,
        data.passingPercentage ?? 40.0,
        data.gradeBoundariesJson,
        data.preparedBy ?? '',
        data.checkedBy ?? '',
        data.dateOfIssue ?? '',
        data.controllerTitle ?? 'Controller of Examinations',
        data.whitelistJson ?? '[]',
        data.isDeployed ? 1 : 0,
        data.deployedAt ? new Date(data.deployedAt).toISOString() : null,
        now,
        now
      );
      return this.findClassById(id);
    },
    async findClassById(id) {
      const row = db.prepare('SELECT * FROM college_classes WHERE id = ?').get(id);
      return normalizeClassRow(row);
    },
    async findClassByInviteCode(inviteCode) {
      const row = db.prepare('SELECT * FROM college_classes WHERE inviteCode = ?').get(inviteCode);
      return normalizeClassRow(row);
    },
    async listClassesByHod(hodId) {
      const rows = db.prepare('SELECT * FROM college_classes WHERE hodId = ? ORDER BY createdAt DESC').all(hodId);
      return rows.map(normalizeClassRow);
    },
    async updateClassWithVersion(id, expectedVersion, patch) {
      const allowed = [
        'className',
        'courseProgram',
        'semesterYear',
        'examMonthYear',
        'passingPercentage',
        'gradeBoundariesJson',
        'preparedBy',
        'checkedBy',
        'dateOfIssue',
        'controllerTitle',
        'whitelistJson',
        'isDeployed',
        'deployedAt',
      ];
      const sets = ['version = version + 1', 'updatedAt = ?'];
      const vals = [nowIso()];
      for (const key of allowed) {
        if (patch[key] !== undefined) {
          sets.push(`${key} = ?`);
          if (key === 'isDeployed') vals.push(patch[key] ? 1 : 0);
          else if (key === 'deployedAt') vals.push(patch[key] ? new Date(patch[key]).toISOString() : null);
          else vals.push(patch[key]);
        }
      }
      vals.push(id, expectedVersion);
      const info = db
        .prepare(`UPDATE college_classes SET ${sets.join(', ')} WHERE id = ? AND version = ?`)
        .run(...vals);
      if (info.changes === 0) {
        throw new ConflictError('Class was updated concurrently. Please refresh and try again.');
      }
      return this.findClassById(id);
    },

    async createSubject(data) {
      const id = randomUUID();
      const now = nowIso();
      db.prepare(
        `INSERT INTO subjects
          (id, classId, code, name, maxMarks, status, assignedProfessorId, lockedAt, version, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).run(
        id,
        data.classId,
        data.code,
        data.name,
        data.maxMarks ?? 100,
        data.status ?? 'PENDING_PROFESSOR',
        data.assignedProfessorId ?? null,
        data.lockedAt ? new Date(data.lockedAt).toISOString() : null,
        now,
        now
      );
      return this.findSubjectById(id);
    },
    async findSubjectById(id) {
      return db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) ?? null;
    },
    async listSubjectsByClass(classId) {
      return db.prepare('SELECT * FROM subjects WHERE classId = ? ORDER BY code ASC').all(classId);
    },
    async listSubjectsByProfessor(professorId) {
      return db
        .prepare('SELECT * FROM subjects WHERE assignedProfessorId = ? ORDER BY createdAt DESC')
        .all(professorId);
    },
    async updateSubjectWithVersion(id, expectedVersion, patch) {
      const allowed = ['code', 'name', 'maxMarks', 'status', 'assignedProfessorId', 'lockedAt'];
      const sets = ['version = version + 1', 'updatedAt = ?'];
      const vals = [nowIso()];
      for (const key of allowed) {
        if (patch[key] !== undefined) {
          sets.push(`${key} = ?`);
          if (key === 'lockedAt') vals.push(patch[key] ? new Date(patch[key]).toISOString() : null);
          else vals.push(patch[key]);
        }
      }
      vals.push(id, expectedVersion);
      const info = db
        .prepare(`UPDATE subjects SET ${sets.join(', ')} WHERE id = ? AND version = ?`)
        .run(...vals);
      if (info.changes === 0) {
        throw new ConflictError('Subject state changed concurrently. Please retry.');
      }
      return this.findSubjectById(id);
    },

    async upsertSubjectPermission({ classId, subjectId, professorId }) {
      const now = nowIso();
      const existing = db
        .prepare('SELECT * FROM subject_permissions WHERE subjectId = ? AND professorId = ?')
        .get(subjectId, professorId);
      if (!existing) {
        const id = randomUUID();
        db.prepare(
          `INSERT INTO subject_permissions (id, classId, subjectId, professorId, status, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`
        ).run(id, classId, subjectId, professorId, now, now);
        return this.findSubjectPermissionById(id);
      }
      db.prepare(
        `UPDATE subject_permissions SET status = 'PENDING', reviewedById = NULL, reviewedAt = NULL, updatedAt = ? WHERE id = ?`
      ).run(now, existing.id);
      return this.findSubjectPermissionById(existing.id);
    },
    async findSubjectPermissionById(id) {
      return db.prepare('SELECT * FROM subject_permissions WHERE id = ?').get(id) ?? null;
    },
    async listSubjectPermissionsByClass(classId) {
      return db
        .prepare('SELECT * FROM subject_permissions WHERE classId = ? ORDER BY createdAt DESC')
        .all(classId);
    },
    async listSubjectPermissionsByProfessor(professorId) {
      return db
        .prepare('SELECT * FROM subject_permissions WHERE professorId = ? ORDER BY createdAt DESC')
        .all(professorId);
    },
    async updateSubjectPermission(id, patch) {
      const sets = ['updatedAt = ?'];
      const vals = [nowIso()];
      if (patch.status !== undefined) {
        sets.push('status = ?');
        vals.push(patch.status);
      }
      if (patch.reviewedById !== undefined) {
        sets.push('reviewedById = ?');
        vals.push(patch.reviewedById);
      }
      if (patch.reviewedAt !== undefined) {
        sets.push('reviewedAt = ?');
        vals.push(patch.reviewedAt ? new Date(patch.reviewedAt).toISOString() : null);
      }
      vals.push(id);
      db.prepare(`UPDATE subject_permissions SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      return this.findSubjectPermissionById(id);
    },
    async rejectOtherPendingPermissions(subjectId, approvedPermissionId, reviewedById) {
      const now = nowIso();
      db.prepare(
        `UPDATE subject_permissions
         SET status = 'REJECTED', reviewedById = ?, reviewedAt = ?, updatedAt = ?
         WHERE subjectId = ? AND id != ? AND status = 'PENDING'`
      ).run(reviewedById, now, now, subjectId, approvedPermissionId);
    },

    async upsertEnrollment({ classId, studentId, enrollmentNo, whitelistMatched }) {
      const now = nowIso();
      const existing = db
        .prepare('SELECT * FROM enrollments WHERE classId = ? AND studentId = ?')
        .get(classId, studentId);
      if (!existing) {
        const id = randomUUID();
        db.prepare(
          `INSERT INTO enrollments
            (id, classId, studentId, enrollmentNo, status, whitelistMatched, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)`
        ).run(id, classId, studentId, enrollmentNo, whitelistMatched ? 1 : 0, now, now);
        return this.findEnrollmentById(id);
      }
      db.prepare(
        `UPDATE enrollments
         SET enrollmentNo = ?, whitelistMatched = ?, status = 'PENDING', reviewedById = NULL, reviewedAt = NULL, updatedAt = ?
         WHERE id = ?`
      ).run(enrollmentNo, whitelistMatched ? 1 : 0, now, existing.id);
      return this.findEnrollmentById(existing.id);
    },
    async findEnrollmentById(id) {
      const row = db.prepare('SELECT * FROM enrollments WHERE id = ?').get(id);
      return normalizeEnrollmentRow(row);
    },
    async findEnrollmentByClassAndStudent(classId, studentId) {
      const row = db
        .prepare('SELECT * FROM enrollments WHERE classId = ? AND studentId = ?')
        .get(classId, studentId);
      return normalizeEnrollmentRow(row);
    },
    async listEnrollmentsByClass(classId) {
      const rows = db.prepare('SELECT * FROM enrollments WHERE classId = ? ORDER BY createdAt DESC').all(classId);
      return rows.map(normalizeEnrollmentRow);
    },
    async listEnrollmentsByStudent(studentId) {
      const rows = db.prepare('SELECT * FROM enrollments WHERE studentId = ? ORDER BY createdAt DESC').all(studentId);
      return rows.map(normalizeEnrollmentRow);
    },
    async updateEnrollment(id, patch) {
      const sets = ['updatedAt = ?'];
      const vals = [nowIso()];
      if (patch.status !== undefined) {
        sets.push('status = ?');
        vals.push(patch.status);
      }
      if (patch.reviewedById !== undefined) {
        sets.push('reviewedById = ?');
        vals.push(patch.reviewedById);
      }
      if (patch.reviewedAt !== undefined) {
        sets.push('reviewedAt = ?');
        vals.push(patch.reviewedAt ? new Date(patch.reviewedAt).toISOString() : null);
      }
      vals.push(id);
      db.prepare(`UPDATE enrollments SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      return this.findEnrollmentById(id);
    },

    async findMark(subjectId, studentId) {
      return db.prepare('SELECT * FROM marks WHERE subjectId = ? AND studentId = ?').get(subjectId, studentId) ?? null;
    },
    async listMarksBySubject(subjectId) {
      return db.prepare('SELECT * FROM marks WHERE subjectId = ?').all(subjectId);
    },
    async listMarksByClass(classId) {
      return db.prepare('SELECT * FROM marks WHERE classId = ?').all(classId);
    },
    async listMarksByClassAndStudent(classId, studentId) {
      return db.prepare('SELECT * FROM marks WHERE classId = ? AND studentId = ?').all(classId, studentId);
    },
    async listMarksByStudent(studentId) {
      return db.prepare('SELECT * FROM marks WHERE studentId = ?').all(studentId);
    },
    async upsertMarkWithOcc({ classId, subjectId, studentId, marksObtained, aiRemark, enteredById, expectedVersion }) {
      const now = nowIso();
      const existing = db
        .prepare('SELECT * FROM marks WHERE subjectId = ? AND studentId = ?')
        .get(subjectId, studentId);
      if (!existing) {
        if (expectedVersion !== undefined && expectedVersion !== null && expectedVersion !== 0) {
          throw new ConflictError('Mark record changed concurrently. Please reload.');
        }
        const id = randomUUID();
        db.prepare(
          `INSERT INTO marks
            (id, classId, subjectId, studentId, marksObtained, aiRemark, enteredById, version, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
        ).run(id, classId, subjectId, studentId, marksObtained, aiRemark ?? '', enteredById, now, now);
        return { mark: await this.findMark(subjectId, studentId), oldMarks: null };
      }
      const targetVersion = expectedVersion ?? existing.version;
      const nextRemark = aiRemark !== undefined ? aiRemark : existing.aiRemark;
      const info = db
        .prepare(
          `UPDATE marks
           SET marksObtained = ?, aiRemark = ?, enteredById = ?, version = version + 1, updatedAt = ?
           WHERE id = ? AND version = ?`
        )
        .run(marksObtained, nextRemark, enteredById, now, existing.id, targetVersion);
      if (info.changes === 0) {
        throw new ConflictError('Concurrent mark update detected. Please refresh and retry.');
      }
      return { mark: await this.findMark(subjectId, studentId), oldMarks: existing.marksObtained };
    },

    async createAuditLog(data) {
      const id = randomUUID();
      const now = nowIso();
      db.prepare(
        `INSERT INTO audit_logs
          (id, classId, subjectId, studentId, professorId, professorName, subjectCode, subjectName,
           studentEnrollmentNo, studentName, oldMarks, newMarks, action, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        data.classId,
        data.subjectId,
        data.studentId,
        data.professorId,
        data.professorName,
        data.subjectCode,
        data.subjectName,
        data.studentEnrollmentNo,
        data.studentName,
        data.oldMarks ?? null,
        data.newMarks,
        data.action,
        now
      );
      return db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
    },
    async listAuditLogsByClass(classId) {
      return db.prepare('SELECT * FROM audit_logs WHERE classId = ? ORDER BY createdAt DESC').all(classId);
    },
    async listAuditLogsByHod(hodId) {
      return db
        .prepare(
          `SELECT a.* FROM audit_logs a
           INNER JOIN college_classes c ON c.id = a.classId
           WHERE c.hodId = ?
           ORDER BY a.createdAt DESC
           LIMIT 300`
        )
        .all(hodId);
    },

    async createNotification(data) {
      const id = randomUUID();
      const now = nowIso();
      db.prepare(
        `INSERT INTO notifications
          (id, userId, role, type, title, message, relatedClassId, isRead, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
      ).run(id, data.userId, data.role, data.type, data.title, data.message, data.relatedClassId ?? null, now);
      const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
      return normalizeNotificationRow(row);
    },
    async listNotificationsByUser(userId) {
      const rows = db
        .prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50')
        .all(userId);
      return rows.map(normalizeNotificationRow);
    },
    async markNotificationRead(id, userId) {
      db.prepare('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?').run(id, userId);
    },
    async markAllNotificationsRead(userId) {
      db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ? AND isRead = 0').run(userId);
    },
  };
}

let initPromise = null;

export async function initDatabase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('mysql://')) {
      try {
        const { PrismaClient } = await import('@prisma/client');
        const client = new PrismaClient();
        await Promise.race([
          client.$connect(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('MySQL connection timeout')), 2000)),
        ]);
        await client.$queryRaw`SELECT 1`;
        prismaClient = client;
        mode = 'mysql';
        console.log('[DB] Connected to MySQL via Prisma ORM.');
        return { mode };
      } catch (err) {
        console.warn(`[DB] MySQL unavailable (${err.message}). Activating embedded transactional SQLite fallback.`);
      }
    }

    const { DatabaseSync } = await import('node:sqlite');
    const relPath = process.env.SQLITE_FALLBACK_PATH || './data/portal.db';
    const fullPath = path.isAbsolute(relPath) ? relPath : path.resolve(backendRoot, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    sqliteDb = new DatabaseSync(fullPath);
    sqliteDb.exec(SQLITE_DDL);
    mode = 'sqlite';
    console.log(`[DB] Embedded transactional SQLite initialized cleanly at ${fullPath}`);
    return { mode };
  })();
  return initPromise;
}

export function getDbMode() {
  return mode;
}

export function getRepo() {
  if (mode === 'mysql' && prismaClient) {
    return createPrismaRepo(prismaClient);
  }
  if (!sqliteDb) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }
  return createSqliteRepo(sqliteDb);
}

let sqliteTxTail = Promise.resolve();

export async function withTransaction(fn) {
  await initDatabase();
  if (mode === 'mysql' && prismaClient) {
    return prismaClient.$transaction(
      async (tx) => fn(createPrismaRepo(tx)),
      { isolationLevel: 'Serializable', maxWait: 5000, timeout: 15000 }
    );
  }

  // Serialize SQLite write transactions cleanly in-process + BEGIN IMMEDIATE on disk
  const run = async () => {
    sqliteDb.exec('BEGIN IMMEDIATE');
    try {
      const result = await fn(createSqliteRepo(sqliteDb));
      sqliteDb.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        sqliteDb.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  };

  const next = sqliteTxTail.then(run, run);
  sqliteTxTail = next.catch(() => {});
  return next;
}
