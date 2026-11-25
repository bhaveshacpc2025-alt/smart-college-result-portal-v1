# Smart College Result & AI Report Card Portal

Full-stack academic evaluation portal featuring three interconnected, role-isolated dashboards (**HOD / Class Admin**, **Professor / Subject**, and **Student**), real-time SSE synchronization, optimistic concurrency control, and official A4 certificate PDF export.

## Quick Start

1. **Initialize database (MySQL via Prisma ORM, with automatic embedded SQLite fallback):**
   ```bash
   npm run init:db
   ```
2. **Build frontend (optional for production single-port serving on `:4000`):**
   ```bash
   npm run build
   ```
3. **Run in development (Backend `:4000` + Vite `:5173`):**
   ```bash
   npm run dev
   ```
   Or start the unified production server (serves API + built frontend on `http://127.0.0.1:4000`):
   ```bash
   npm start
   ```

## MySQL Setup (Optional)
Edit `backend/.env` and point `DATABASE_URL` to your MySQL instance, then run:
```bash
cd backend
npx prisma db push
```
If MySQL is unreachable, the server automatically activates its embedded transactional SQLite fallback (`backend/data/portal.db`) so the application works immediately out-of-the-box with a clean slate (HOD registers first).
