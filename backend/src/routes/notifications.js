import express from 'express';
import { getRepo, withTransaction } from '../db/index.js';
import { authenticate } from '../middleware/auth.js';
import { addSseClient } from '../utils/events.js';

const router = express.Router();

router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const repo = getRepo();
    const list = await repo.listNotificationsByUser(req.user.id);
    const unreadCount = list.filter((n) => !n.isRead).length;
    res.json({ notifications: list, unreadCount });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    await withTransaction(async (tx) => {
      await tx.markNotificationRead(req.params.id, req.user.id);
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    await withTransaction(async (tx) => {
      await tx.markAllNotificationsRead(req.user.id);
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/events/stream', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`event: CONNECTED\ndata: ${JSON.stringify({ userId: req.user.id, role: req.user.role })}\n\n`);
  const cleanup = addSseClient(req.user.id, req.user.role, res);

  req.on('close', () => {
    cleanup();
  });
});

export default router;
