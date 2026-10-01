import { useAppStore } from "@/core/store";
import { api, setApiToken } from "@/core/api";
import { getDb, kv } from "@/core/db";
import { persistBootstrap, applyBootstrapToStore, indexStudentTopicLinks, mergeStudents, clearUserIdbData } from "@/core/bootstrap";

// Everything after the server has handed us { account, token }: shared by
// password login and Google sign-in so both keep offline edits for the same
// account, never leak another account's local data, and land on home.
export async function completeLogin({ account, token }) {
  setApiToken(token);

  const db = await getDb();

  // Check whether IDB holds data for this same account (offline edits to preserve)
  // or for a different account (stale data that must not leak into this login).
  const storedAccountId = await kv.get(db, "accountId");
  const isSameAccount = storedAccountId === account.id;

  let localStudents = null;
  let localSessions;
  let localLinks;

  if (isSameAccount) {
    // Same user re-logging in — read local data to merge (preserves offline edits)
    [localStudents, localSessions, localLinks] = await Promise.all([
      kv.get(db, "students"),
      kv.get(db, "sessions"),
      kv.get(db, "studentTopicLinks"),
    ]);

    // Push local data to server before fetching bootstrap (so it isn't lost)
    const uploadOps = [];
    for (const s of (localStudents ?? [])) {
      const { photo, closeAdults, ...rest } = s;
      const adultsNoPhoto = (closeAdults ?? []).map(({ photo: _p, ...a }) => a);
      uploadOps.push({ type: "student.upsert", data: { ...rest, closeAdults: adultsNoPhoto } });
    }
    for (const sess of (localSessions ?? [])) {
      uploadOps.push({ type: "session.append", data: { ...sess, mode: sess.modeId } });
    }
    const linksMap = indexStudentTopicLinks(localLinks);
    for (const link of Object.values(linksMap)) {
      if (link.studentId && link.topicId) {
        uploadOps.push({
          type: "student_topic_link.upsert",
          data: {
            id: link.id ?? `${link.studentId}_${link.topicId}`,
            studentId: link.studentId,
            topicId: link.topicId,
            selectedConceptIds: link.selectedConceptIds ?? [],
            selectionMode: link.selectionMode ?? "auto",
            repsPerConcept: link.repsPerConcept ?? 1,
            params: link.params ?? {},
            videoRewardEnabled: link.videoRewardEnabled ?? true,
            rewardThreshold: link.rewardThreshold ?? 90,
          },
        });
      }
    }
    if (uploadOps.length > 0) {
      try { await api.post("/sync", { operations: uploadOps }); } catch { /* best-effort: the server copy still loads below */ }
    }
  } else {
    // Different account logging in — clear stale IDB data so nothing leaks
    await clearUserIdbData(db);
  }

  // Подгружаем все данные аккаунта с сервера
  const [bootstrap, sessionsRaw] = await Promise.all([
    api.get("/account/bootstrap"),
    api.get("/sessions?limit=200"),
  ]);

  // Merge only when the same user is re-logging in (preserves offline edits).
  // For a new/different account, use server data only.
  const students = isSameAccount
    ? mergeStudents(localStudents ?? [], bootstrap.students ?? [])
    : (bootstrap.students ?? []);

  const payload = {
    token,
    account,
    subscription: bootstrap.subscription ?? null,
    settings: bootstrap.settings,
    students,
    ownedTopics: bootstrap.ownedTopics,
    studentTopicLinks: bootstrap.studentTopicLinks,
    conceptProgress: bootstrap.conceptProgress,
    sessions: sessionsRaw,
  };

  await persistBootstrap(db, payload);
  // Tag IDB with the current account so future logins can detect account switches.
  await kv.set(db, "accountId", account.id);
  applyBootstrapToStore(payload);
  useAppStore.getState().setScreen("home");
}
