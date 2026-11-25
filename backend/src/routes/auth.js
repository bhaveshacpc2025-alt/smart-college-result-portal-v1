import express from 'express';
import bcrypt from 'bcryptjs';
import { getRepo, withTransaction } from '../db/index.js';
import { authenticate, signToken } from '../middleware/auth.js';

const router = express.Router();
const VALID_ROLES = new Set(['HOD', 'PROFESSOR', 'STUDENT']);

function normalizeIdentifier(id) {
  return String(id || '').trim().toUpperCase();
}

router.get('/bootstrap-status', async (req, res, next) => {
  try {
    const repo = getRepo();
    const hodCount = await repo.countUsersByRole('HOD');
    res.json({ hodExists: hodCount > 0, hodCount });
  } catch (err) {
    next(err);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const role = String(req.body.role || '').trim().toUpperCase();
    const identifier = normalizeIdentifier(req.body.identifier);
    const name = String(req.body.name || '').trim();
    const department = String(req.body.department || '').trim();
    const password = String(req.body.password || '');

    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be HOD, PROFESSOR, or STUDENT.' });
    }
    if (!identifier || identifier.length < 2) {
      return res.status(400).json({ error: 'Valid ID / Enrollment Number is required (min 2 chars).' });
    }
    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await withTransaction(async (tx) => {
      const existing = await tx.findUserByRoleAndIdentifier(role, identifier);
      if (existing) {
        const err = new Error(`An account for ${role} with ID "${identifier}" already exists.`);
        err.statusCode = 409;
        throw err;
      }
      return tx.createUser({
        role,
        identifier,
        name,
        department,
        passwordHash,
      });
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        role: user.role,
        identifier: user.identifier,
        name: user.name,
        department: user.department,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const role = String(req.body.role || '').trim().toUpperCase();
    const identifier = normalizeIdentifier(req.body.identifier);
    const password = String(req.body.password || '');

    if (!VALID_ROLES.has(role) || !identifier || !password) {
      return res.status(400).json({ error: 'Role, ID / Enrollment Number, and Password are required.' });
    }

    const repo = getRepo();
    const user = await repo.findUserByRoleAndIdentifier(role, identifier);
    if (!user) {
      return res.status(401).json({ error: `No ${role} account found for "${identifier}". Please register first.` });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
        identifier: user.identifier,
        name: user.name,
        department: user.department,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;
