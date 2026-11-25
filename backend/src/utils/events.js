// In-memory Server-Sent Events (SSE) broadcaster for real-time cross-portal sync
const clientsByUser = new Map(); // userId -> Set<{ res, role }>

export function addSseClient(userId, role, res) {
  if (!clientsByUser.has(userId)) {
    clientsByUser.set(userId, new Set());
  }
  const entry = { res, role };
  clientsByUser.get(userId).add(entry);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  return () => {
    clearInterval(heartbeat);
    const set = clientsByUser.get(userId);
    if (set) {
      set.delete(entry);
      if (set.size === 0) clientsByUser.delete(userId);
    }
  };
}

export function emitEventToUsers(userIds, eventName, payload = {}) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const dataStr = JSON.stringify({ ...payload, timestamp: new Date().toISOString() });
  for (const uid of uniqueIds) {
    const set = clientsByUser.get(uid);
    if (!set) continue;
    for (const { res } of set) {
      try {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${dataStr}\n\n`);
      } catch {
        // Ignore broken pipe; close handler cleans up
      }
    }
  }
}

export function emitEventToRole(role, eventName, payload = {}) {
  const dataStr = JSON.stringify({ ...payload, timestamp: new Date().toISOString() });
  for (const [, set] of clientsByUser.entries()) {
    for (const { res, role: clientRole } of set) {
      if (clientRole === role) {
        try {
          res.write(`event: ${eventName}\n`);
          res.write(`data: ${dataStr}\n\n`);
        } catch {
          // ignore
        }
      }
    }
  }
}
