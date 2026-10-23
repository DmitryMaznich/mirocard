import { markLoginFailure } from "./loginDiagnostics";
import { useAppStore } from "@/core/store";
import { migrateStudentPeople } from "../../../shared/student-people.mjs";
import { api, setApiToken } from "@/core/api";
import { getDb, kv } from "@/core/db";
import { persistBootstrap, applyBootstrapToStore, indexStudentTopicLinks, mergeStudents, clearUserIdbData } from "@/core/bootstrap";

// Everything after the server has handed us { account, token }: shared by
// password login and Google sign-in so both keep offline edits for the same
// account, never leak another account's local data, and land on home.
export async function completeLogin({ account, token }) {
  let stage = "open-storage";
  let localDatabaseName;
  useAppStore.setState({ loginRecovery: null });
  try {
    setApiToken(token);

    const db = await getDb();
    localDatabaseName = db.name;

    // Check whether IDB holds data for this same account (offline edits to preserve)
    // or for a different account (stale data that must not leak into this login).
    stage = "read-local-owner";
    const storedAccountId = await kv.get(db, "accountId");
    const isSameAccount = storedAccountId === account.id;

    let localStudents = null;
    let localSessions;
    let localLinks;

    if (isSameAccount) {
      // Same user re-logging in — read local data to merge (preserves offline edits)
      stage = "read-local-data";
      [localStudents, localSessions, localLinks] = await Promise.all([
        kv.get(db, "students"),
        kv.get(db, "sessions"),
        kv.get(db, "studentTopicLinks"),
      ]);

      // Push local data to server before fetching bootstrap (so it isn't lost)
      stage = "prepare-local-data";
      const uploadOps = [];
      for (const rawStudent of (localStudents ?? [])) {
        const s = migrateStudentPeople(rawStudent);
        // Explicit lesson-language edits already have their own durable queued
        // student.upsert. A login replay must not overwrite a newer remote choice.
        const { photo, closeAdults, preferredLessonLanguage: _lessonLanguage, myPeople: _people, myPeopleProfile: _profile, ...rest } = s;
        const adultsNoPhoto = (closeAdults ?? []).map(({ photo: _p, ...a }) => a);
        uploadOps.push({ type: "student.upsert", data: { ...rest, closeAdults: adultsNoPhoto } });
        if (s.rewardSettingsUpdatedAt) uploadOps.push({ type: "student.reward_settings.upsert", data: {
          studentId: s.id, settings: s.rewardSettings, updatedAt: s.rewardSettingsUpdatedAt,
        } });
        if (s.myPeople?.length) uploadOps.push({ type: 'student.my_people.upsert', data: {
          studentId: s.id, people: s.myPeople, updatedAt: s.myPeopleUpdatedAt ?? s.closeAdultsUpdatedAt ?? s.updatedAt,
        } });
        if (s.myPeopleProfile) uploadOps.push({ type: 'student.my_people_profile.upsert', data: {
          studentId: s.id, profile: s.myPeopleProfile, updatedAt: s.myPeopleProfileUpdatedAt ?? s.updatedAt,
        } });
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
              answersPerStar: link.answersPerStar ?? null,
              strictStars: link.strictStars ?? null,
              deckPosition: link.deckPosition ?? null,
            },
          });
        }
      }
      if (uploadOps.length > 0) {
        try { await api.post("/sync", { operations: uploadOps }); } catch { /* best-effort: the server copy still loads below */ }
      }
    } else {
      // Different account logging in — clear stale IDB data so nothing leaks
      stage = "switch-account";
      await clearUserIdbData(db);
    }

    // Подгружаем все данные аккаунта с сервера
    stage = "load-account";
    const [bootstrap, sessionsRaw] = await Promise.all([
      api.get("/account/bootstrap"),
      api.get("/sessions?limit=200"),
    ]);

    // Merge only when the same user is re-logging in (preserves offline edits).
    // For a new/different account, use server data only.
    stage = "merge-data";
    const students = isSameAccount
      ? mergeStudents(localStudents ?? [], bootstrap.students ?? [])
      : (bootstrap.students ?? []);

    const payload = {
      token,
      account,
      builtinVisibility: bootstrap.builtinVisibility ?? {},
      archivedTopicIds: bootstrap.archivedTopicIds ?? [],
            erasedStudentIds: bootstrap.erasedStudentIds ?? [],
            subscription: bootstrap.subscription ?? null,
      settings: bootstrap.settings,
      students,
      ownedTopics: bootstrap.ownedTopics,
      studentTopicLinks: bootstrap.studentTopicLinks,
      conceptProgress: bootstrap.conceptProgress,
      sessions: sessionsRaw,
    };

    stage = "save-local-data";
    await persistBootstrap(db, payload);
    // Tag IDB with the current account so future logins can detect account switches.
    stage = "save-local-owner";
    await kv.set(db, "accountId", account.id);
    stage = "apply-account";
    applyBootstrapToStore(payload);
    useAppStore.getState().setScreen("home");
  } catch (error) {
    markLoginFailure(error, stage);
    if (stage === "read-local-data") {
      // The server has authenticated this account, and the local owner matched.
      // Offer a separate cloud copy; never skip or overwrite the unreadable data.
      useAppStore.setState({ loginRecovery: { account, token, databaseName: localDatabaseName } });
    }
    throw error;
  }
}
