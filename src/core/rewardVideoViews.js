import { getDb } from "@/core/db";
import { useAppStore } from "@/core/store";
import { mergeStudents } from "@/core/bootstrap";
import { flushQueue } from "@/core/syncApi";
import { mergeRewardVideoViews } from "@/shared/utils/rewardVideoViews";

export async function recordRewardVideoView(studentId, videoId) {
  if (!studentId || !/^[\w-]{11}$/.test(videoId ?? "")) return;
  const db = await getDb();
  // Commit the count and outgoing operation together. Serialize increments
  // across tabs, and keep the operation if the app closes while offline.
  const updated = await new Promise((resolve, reject) => {
    const tx = db.transaction(["keyval", "syncQueue"], "readwrite");
    const kvStore = tx.objectStore("keyval");
    const studentsReq = kvStore.get("students");
    const replicaReq = kvStore.get("rewardVideoViewsReplica");
    let next;
    replicaReq.onsuccess = () => {
      const students = studentsReq.result ?? [];
      const student = students.find((s) => s.id === studentId && !s.deletedAt);
      if (!student) return;
      const replica = replicaReq.result || crypto.randomUUID();
      kvStore.put(replica, "rewardVideoViewsReplica");
      const views = mergeRewardVideoViews(student.rewardVideoViews);
      const count = (views[videoId]?.[replica] ?? 0) + 1;
      const rewardVideoViews = mergeRewardVideoViews(views, { [videoId]: { [replica]: count } });
      next = students.map((s) => s.id === studentId ? { ...s, rewardVideoViews } : s);
      kvStore.put(next, "students");
      tx.objectStore("syncQueue").add({
        type: "student.video_view.record",
        data: { studentId, views: { [videoId]: { [replica]: count } } },
      });
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  if (!updated) return;
  useAppStore.getState().setStudents(mergeStudents(useAppStore.getState().students, updated));
  flushQueue().catch(() => {});
}
