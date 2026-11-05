// «Видео в конце занятия» (ParamsScreen → mode params `videoAtEnd`): «Смотреть видео» on the summary
// when the setting was on, the session was gone through to the end (not stopped with ✕ — that would
// make ✕ a short cut to the video), video rewards are on for this topic and the student has videos.
export function endVideoAvailable(session, student) {
  return Boolean(session?.paramsSnapshot?.videoAtEnd)
    && session?.completionReason === "series_completed"
    && session?.reward?.videoEnabled !== false
    && (student?.rewardVideos?.length ?? 0) > 0;
}
