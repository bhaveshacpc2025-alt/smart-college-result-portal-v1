import 'dotenv/config';
import { initDatabase, getDbMode } from './index.js';

async function main() {
  await initDatabase();
  console.log(`[DB Init] Database ready in '${getDbMode()}' mode with clean slate (no dummy seed data).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[DB Init] Failed:', err);
  process.exit(1);
});
