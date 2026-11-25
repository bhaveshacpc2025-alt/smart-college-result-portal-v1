import jwt from 'jsonwebtoken';
import { getRepo, initDatabase } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'smart-college-result-portal-dev-secret-2026';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      identifier: user.identifier,
      name: user.name,
      department: user.department || '',
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function authenticate(req, res, next) {
  try {
    await initDatabase();
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token.trim();
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const decoded = verifyToken(token);
    const repo = getRepo();
    const user = await repo.findUserById(decoded.sub);
    if (!user) {
      return res.status(401).json({ error: 'Session expired or user not found.' });
    }

    req.user = {
      id: user.id,
      role: user.role,
      identifier: user.identifier,
      name: user.name,
      department: user.department || '',
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
}
