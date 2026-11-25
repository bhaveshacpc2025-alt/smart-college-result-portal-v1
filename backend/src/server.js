import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { initDatabase, getDbMode } from './db/index.js';
import authRoutes from './routes/auth.js';
import notificationRoutes from './routes/notifications.js';
import hodRoutes from './routes/hod.js';
import professorRoutes from './routes/professor.js';
import studentRoutes from './routes/student.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder'],
  })
);
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', async (req, res) => {
  await initDatabase();
  res.json({ status: 'ok', dbMode: getDbMode(), timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api', notificationRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/student', studentRoutes);

// Serve built frontend in production if present
const frontendDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status >= 500) {
    console.error('[API Error]', err);
  }
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = Number(process.env.PORT || 5000);

initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Smart College Result Portal API listening on http://localhost:${PORT} (DB: ${getDbMode()})`);
    });
  })
  .catch((err) => {
    console.error('[Startup Failed]', err);
    process.exit(1);
  });
