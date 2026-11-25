export const SQLITE_DDL = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('HOD', 'PROFESSOR', 'STUDENT')),
  identifier TEXT NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(role, identifier)
);
CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);

CREATE TABLE IF NOT EXISTS college_classes (
  id TEXT PRIMARY KEY,
  hodId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  className TEXT NOT NULL,
  courseProgram TEXT NOT NULL,
  semesterYear TEXT NOT NULL,
  examMonthYear TEXT NOT NULL,
  inviteCode TEXT NOT NULL UNIQUE,
  passingPercentage REAL NOT NULL DEFAULT 40.0,
  gradeBoundariesJson TEXT NOT NULL,
  preparedBy TEXT NOT NULL DEFAULT '',
  checkedBy TEXT NOT NULL DEFAULT '',
  dateOfIssue TEXT NOT NULL DEFAULT '',
  controllerTitle TEXT NOT NULL DEFAULT 'Controller of Examinations',
  whitelistJson TEXT NOT NULL DEFAULT '[]',
  isDeployed INTEGER NOT NULL DEFAULT 0,
  deployedAt TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_classes_hod ON college_classes(hodId);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  classId TEXT NOT NULL REFERENCES college_classes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  maxMarks INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'PENDING_PROFESSOR' CHECK(status IN ('PENDING_PROFESSOR', 'IN_PROGRESS', 'LOCKED')),
  assignedProfessorId TEXT REFERENCES users(id) ON DELETE SET NULL,
  lockedAt TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(classId, code)
);
CREATE INDEX IF NOT EXISTS idx_subjects_prof ON subjects(assignedProfessorId);

CREATE TABLE IF NOT EXISTS subject_permissions (
  id TEXT PRIMARY KEY,
  classId TEXT NOT NULL REFERENCES college_classes(id) ON DELETE CASCADE,
  subjectId TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  professorId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewedById TEXT,
  reviewedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(subjectId, professorId)
);
CREATE INDEX IF NOT EXISTS idx_sp_class_status ON subject_permissions(classId, status);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  classId TEXT NOT NULL REFERENCES college_classes(id) ON DELETE CASCADE,
  studentId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollmentNo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
  whitelistMatched INTEGER NOT NULL DEFAULT 0,
  reviewedById TEXT,
  reviewedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(classId, studentId)
);
CREATE INDEX IF NOT EXISTS idx_enr_class_status ON enrollments(classId, status);
CREATE INDEX IF NOT EXISTS idx_enr_no ON enrollments(enrollmentNo);

CREATE TABLE IF NOT EXISTS marks (
  id TEXT PRIMARY KEY,
  classId TEXT NOT NULL REFERENCES college_classes(id) ON DELETE CASCADE,
  subjectId TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  studentId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marksObtained REAL NOT NULL,
  aiRemark TEXT NOT NULL DEFAULT '',
  enteredById TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(subjectId, studentId)
);
CREATE INDEX IF NOT EXISTS idx_marks_class_student ON marks(classId, studentId);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  classId TEXT NOT NULL REFERENCES college_classes(id) ON DELETE CASCADE,
  subjectId TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  studentId TEXT NOT NULL,
  professorId TEXT NOT NULL,
  professorName TEXT NOT NULL,
  subjectCode TEXT NOT NULL,
  subjectName TEXT NOT NULL,
  studentEnrollmentNo TEXT NOT NULL,
  studentName TEXT NOT NULL,
  oldMarks REAL,
  newMarks REAL NOT NULL,
  action TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_class_time ON audit_logs(classId, createdAt);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('HOD', 'PROFESSOR', 'STUDENT')),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  relatedClassId TEXT,
  isRead INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(userId, isRead, createdAt);
`;
