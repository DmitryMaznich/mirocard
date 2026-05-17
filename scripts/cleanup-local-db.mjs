import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('C:/Users/dmazn/Projects/Mirocard2/runtime/data/mirocard.db');
const acc = db.prepare("SELECT id FROM accounts WHERE email='dmaznichenko@gmail.com'").get();
if (acc) {
  db.prepare('DELETE FROM account_settings WHERE account_id=?').run(acc.id);
  db.prepare('DELETE FROM accounts WHERE id=?').run(acc.id);
  console.log('Removed test account:', acc.id);
} else {
  console.log('Not found');
}
db.close();
