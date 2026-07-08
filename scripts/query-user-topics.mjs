import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Database = require('./backend/node_modules/better-sqlite3');

const db = new Database('./runtime/data/mirocard.db', { readonly: true });

const email = process.argv[2] || 'hello@smart-wash.si';
const account = db.prepare("SELECT id, email FROM accounts WHERE email = ?").get(email);
if (!account) { console.log('Account not found:', email); process.exit(1); }

console.log('Account:', account.id, account.email);

const topics = db.prepare(`
  SELECT topic_id, source, acquired_at, deleted_at
  FROM account_topics WHERE account_id = ? ORDER BY acquired_at
`).all(account.id);

if (topics.length === 0) {
  console.log('No owned topics at all');
} else {
  console.log('\nOwned topics:');
  topics.forEach(t => console.log(`  ${t.topic_id}  source=${t.source}  deleted=${t.deleted_at ?? 'no'}`));
}

db.close();
