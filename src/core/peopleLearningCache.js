// The cache is local to the account and pupil, including offline photo bytes.
// Administrative erasure must remove it along with the canonical pupil data.
export function erasePeopleLearningCache(db, studentIds) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('keyval', 'readwrite');
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    const request = tx.objectStore('keyval').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const key = String(cursor.key);
      if ((key.startsWith('peopleLearning:') || key.startsWith('peoplePhoto:') || key.startsWith('my_people:v2:')) && studentIds.some(id => key.split(':').includes(id))) cursor.delete();
      cursor.continue();
    };
  });
}
