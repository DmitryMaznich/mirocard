import { test } from "node:test";
import assert from "node:assert/strict";
import { initDb } from "../lib/db.mjs";
import {
  createAccount,
  activateAccount,
  storeAuthToken,
  findAccountByToken,
  upsertStudent,
} from "../lib/account-repository.mjs";
import {
  prepareDeletion,
  confirmDeletion,
  blockAccount,
  restoreAccount,
  cancelScheduledErasure,
} from "../lib/account-lifecycle.mjs";
import { grantTrialSubscription } from "../lib/billing-repository.mjs";
function fixture(active = true) {
  const db = initDb(":memory:");
  const a = createAccount(db, {
    email: "owner@example.test",
    passwordHash: "hash",
    firstName: "Owner",
  });
  if (active) activateAccount(db, a.id);
  storeAuthToken(db, {
    tokenHash: "session",
    accountId: a.id,
    expiresAt: "2099-01-01T00:00:00Z",
  });
  upsertStudent(db, a.id, { id: "student", name: "Student" });
  grantTrialSubscription(db, a.id);
  return { db, a };
}
function input(p) {
  return {
    mode: "archive",
    confirmationToken: p.confirmationToken,
    confirmEmail: p.email,
    confirmWord: "УДАЛИТЬ",
    reason: "Тестовый перенос",
    acknowledgeData: true,
    acknowledgeRetention: true,
  };
}
const fail = (status) => (e) => e.status === status;
test("archive retains identity, students, entitlements and assignments; restoration never revives sessions", () => {
  const { db, a } = fixture();
  const student = db.prepare("SELECT * FROM students").get();
  const ent = db.prepare("SELECT * FROM entitlements").get();
  db.prepare(
    "INSERT INTO account_kv (account_id,key,value,updated_at) VALUES (?,?,?,?)",
  ).run(a.id, "private-data", '{"text":"preserve"}', new Date().toISOString());
  const p = prepareDeletion(db, a.id, "archive");
  assert.equal(confirmDeletion(db, a.id, input(p)).status, "archived");
  const archived = db.prepare("SELECT * FROM accounts WHERE id=?").get(a.id);
  assert.equal(archived.email, a.email);
  assert.equal(archived.password_hash, "hash");
  assert.equal(archived.first_name, "Owner");
  assert.deepEqual(db.prepare("SELECT * FROM students").get(), student);
  assert.deepEqual(db.prepare("SELECT * FROM entitlements").get(), ent);
  assert.equal(
    db.prepare("SELECT value FROM account_kv").get().value,
    '{"text":"preserve"}',
  );
  assert.equal(findAccountByToken(db, "session"), null);
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM admin_account_events").get().n,
    1,
  );
  assert.equal(
    restoreAccount(db, a.id, "restore", "Возвращён доступ").status,
    "active",
  );
  assert.equal(findAccountByToken(db, "session"), null);
  db.close();
});
test("archive requires complete fresh account-bound confirmation and rejects old destructive modes", () => {
  const { db, a } = fixture();
  for (const mode of ["immediate", "scheduled"])
    assert.throws(() => prepareDeletion(db, a.id, mode), fail(410));
  const p = prepareDeletion(db, a.id, "archive");
  for (const patch of [
    { confirmEmail: "wrong" },
    { confirmWord: "wrong" },
    { acknowledgeData: false },
    { acknowledgeRetention: false },
  ])
    assert.throws(
      () => confirmDeletion(db, a.id, { ...input(p), ...patch }),
      fail(400),
    );
  assert.throws(
    () => confirmDeletion(db, a.id, { ...input(p), mode: "immediate" }),
    fail(410),
  );
  assert.throws(
    () => confirmDeletion(db, a.id, input(p), { now: Date.now() + 6 * 60000 }),
    fail(409),
  );
  confirmDeletion(db, a.id, input(p));
  assert.throws(() => confirmDeletion(db, a.id, input(p)), fail(409));
  db.close();
});
test("pending and blocked accounts restore their original status", () => {
  for (const blocked of [false, true]) {
    const { db, a } = fixture(false);
    if (blocked) blockAccount(db, a.id, "Блокировка");
    confirmDeletion(db, a.id, input(prepareDeletion(db, a.id, "archive")));
    assert.equal(
      restoreAccount(db, a.id, "restore", "Восстановление").status,
      blocked ? "blocked" : "pending",
    );
    if (blocked)
      assert.equal(
        restoreAccount(db, a.id, "unblock", "Проверено").status,
        "pending",
      );
    db.close();
  }
});
test("startup cancels even overdue erasure schedules without removing data and is idempotent", () => {
  const { db, a } = fixture();
  db.prepare("UPDATE accounts SET status='deletion_pending' WHERE id=?").run(
    a.id,
  );
  db.prepare(
    "INSERT INTO account_lifecycle (account_id,deletion_previous_status,delete_after) VALUES (?,?,?)",
  ).run(a.id, "active", "2000-01-01T00:00:00Z");
  assert.equal(cancelScheduledErasure(db).archived, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM students").get().n, 1);
  assert.equal(
    db.prepare("SELECT delete_after FROM account_lifecycle").get().delete_after,
    null,
  );
  assert.equal(cancelScheduledErasure(db).archived, 0);
  assert.equal(restoreAccount(db, a.id, "restore", "Возврат").status, "active");
  db.close();
});
test("legacy deleted accounts restore to pending, purged accounts cannot be restored", () => {
  const { db, a } = fixture();
  db.prepare("UPDATE accounts SET status='deleted' WHERE id=?").run(a.id);
  assert.equal(
    restoreAccount(db, a.id, "restore", "Возврат").status,
    "pending",
  );
  db.prepare("UPDATE accounts SET status='purged' WHERE id=?").run(a.id);
  assert.throws(
    () => restoreAccount(db, a.id, "restore", "Возврат"),
    fail(409),
  );
  db.close();
});


test("direct self-archive revokes every token and preserves data and restoration status", async () => {
  const {archiveAccount} = await import("../lib/account-lifecycle.mjs");
  const {db,a}=fixture();
  storeAuthToken(db,{tokenHash:"second",accountId:a.id,expiresAt:"2099-01-01T00:00:00Z"});
  archiveAccount(db,a.id,"self");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM auth_tokens").get().n,0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM students").get().n,1);
  assert.equal(db.prepare("SELECT actor FROM admin_account_events ORDER BY created_at DESC").get().actor,"self");
  restoreAccount(db,a.id,"restore","Восстановление");
  assert.equal(db.prepare("SELECT status FROM accounts WHERE id=?").get(a.id).status,"active");
  db.close();
});

test("student erasure is scoped, removes history and rejects stale resurrection", async () => {
  const {eraseStudent}=await import("../lib/account-lifecycle.mjs");
  const {appendSession,upsertAccountKv}=await import("../lib/account-repository.mjs");
  const {buildBootstrap}=await import("../lib/snapshot-builder.mjs");
  const {db,a}=fixture();
  upsertStudent(db,a.id,{id:"other",name:"Other"});
  appendSession(db,a.id,{id:"lesson",studentId:"student",topicId:"t",topicVersion:"1",mode:"m",startedAt:"2026-10-12",completedAt:"2026-10-12"});
  upsertAccountKv(db,a.id,"planner:plan:student",{private:"data"});
  assert.throws(()=>eraseStudent(db,"wrong","student"),fail(404));
  eraseStudent(db,a.id,"student");
  upsertStudent(db,a.id,{id:"student",name:"stale"});
  appendSession(db,a.id,{id:"stale",studentId:"student"});
  upsertAccountKv(db,a.id,"planner:plan:student",{private:"stale"});
  assert.equal(db.prepare("SELECT COUNT(*) n FROM students").get().n,1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sessions").get().n,0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM account_kv").get().n,0);
  assert.deepEqual(buildBootstrap(db,a.id).erasedStudentIds,["student"]);
  db.close();
});

test("permanent account erasure removes billing children, private resources and credentials, preserves other accounts", async () => {
  const {eraseAccount}=await import("../lib/account-lifecycle.mjs");
  const {createOrder,getOrderByExternalId}=await import("../lib/billing-repository.mjs");
  const {upsertAccountKv,extractAndStorePhoto}=await import("../lib/account-repository.mjs");
  const {db,a}=fixture();
  const other=createAccount(db,{email:"other@example.test",passwordHash:"other"});
  const photo=extractAndStorePhoto(db,"data:image/png;base64,YWJj");
  upsertStudent(db,a.id,{id:"photo-student",name:"Photo",photo});
  upsertAccountKv(db,other.id,"shared-photo",photo);
  createOrder(db,a.id,{provider:"stripe",plan:"monthly",orderId:"order",currency:"EUR",amountMinor:990});
  const order=getOrderByExternalId(db,"order");
  db.prepare("INSERT INTO checkout_consents (id,account_id,order_id,legal_docs_version,terms_accepted,price_period_confirmed,digital_content_ack,created_at) VALUES ('c',?,?,'1',1,1,1,'2026-10-12')").run(a.id,order.id);
  eraseAccount(db,a.id);
  assert.equal(db.prepare("SELECT id FROM accounts WHERE id=?").get(a.id),undefined);
  assert.ok(db.prepare("SELECT id FROM accounts WHERE id=?").get(other.id));
  for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
    if(name==="admin_account_events")continue;
    if(db.prepare(`PRAGMA table_info(${name})`).all().some(c=>c.name==="account_id"))
      assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${name} WHERE account_id=?`).get(a.id).n,0,name);
  }
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length,0);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM photos").get().n,1,"shared photos retained");
  assert.ok(createAccount(db,{email:a.email,passwordHash:"fresh"}));
  db.close();
});
