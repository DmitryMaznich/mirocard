import {
  findAccountById, getAccountSettings, getRevision,
  getStudents, getAccountTopics,
  getStudentTopicLinks, getAllConceptProgress,
  getAllAccountKv, serializeAccount,
} from "./account-repository.mjs";

function safeJson(value, fallback) {
  try { return JSON.parse(value ?? "null") ?? fallback; }
  catch { return fallback; }
}

export function buildBootstrap(db, accountId, sinceRevision = 0) {
  const account  = findAccountById(db, accountId);
  const settings = getAccountSettings(db, accountId);
  const revision = getRevision(db, accountId);

  const students          = getStudents(db, accountId);
  const ownedTopics       = getAccountTopics(db, accountId);
  const studentTopicLinks = getStudentTopicLinks(db, accountId);
  const conceptProgress   = getAllConceptProgress(db, accountId);
  const kvStore           = getAllAccountKv(db, accountId);

  return {
    account: serializeAccount(account),
    settings: {
      uiLanguage:       settings?.ui_language ?? "ru",
      cardLanguage:     settings?.card_language ?? "ru",
      adultPinHash:     settings?.adult_pin_hash ?? null,
      pushAppUpdates:   Boolean(settings?.push_app_updates ?? 1),
      pushTopicUpdates: Boolean(settings?.push_topic_updates ?? 1),
      pushReminders:    Boolean(settings?.push_reminders ?? 0),
    },
    students: students.map((s) => ({
      id:              s.id,
      name:            s.name,
      comment:         s.comment,
      primaryLanguage: s.primary_language,
      sex:             s.sex ?? null,
      photo:           s.photo ?? null,
      photoUpdatedAt:  s.photo_updated_at ?? null,
      rewardVideos:    safeJson(s.reward_videos, []),
      closeAdults:     safeJson(s.close_adults, []),
      createdAt:       s.created_at,
      updatedAt:       s.updated_at,
    })),
    ownedTopics: ownedTopics.map((t) => ({
      id:           t.id,
      topicId:      t.topic_id,
      topicVersion: t.topic_version,
      acquiredAt:   t.acquired_at,
      source:       t.source,
    })),
    studentTopicLinks: studentTopicLinks.map((l) => ({
      id:                 l.id,
      studentId:          l.student_id,
      topicId:            l.topic_id,
      selectionMode:      l.selection_mode,
      selectedConceptIds: safeJson(l.selected_concept_ids, []),
      repsPerConcept:     l.reps_per_concept,
      params:             safeJson(l.params, {}),
      videoRewardEnabled: Boolean(l.video_reward_enabled ?? 1),
      rewardThreshold:    l.reward_threshold ?? 90,
      updatedAt:          l.updated_at,
    })),
    conceptProgress: conceptProgress.map((p) => ({
      studentId:  p.student_id,
      topicId:    p.topic_id,
      conceptId:  p.concept_id,
      level:      p.level,
      lastSeenAt: p.last_seen_at,
      updatedAt:  p.updated_at,
    })),
    kvStore,
    revision,
    generatedAt: new Date().toISOString(),
  };
}
