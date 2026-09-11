import { getDb, kv } from "@/core/db";
import { useAppStore } from "@/core/store";
import { pushOp } from "@/core/syncApi";

// Keep this update on the existing per-person myPeople transport. The server
// and bootstrap merge records by person id and updatedAt, so this is safe to
// call while another device is editing a different person.
export async function markPersonAxisIntroduced(studentId, personId, axis) {
  if (!studentId || !personId || !axis) return false;

  const store = useAppStore.getState();
  const student = store.students.find((candidate) => candidate.id === studentId);
  const person = student?.myPeople?.find((candidate) => candidate.id === personId);
  if (!student || !person) return false;

  const introducedAxes = Array.isArray(person.introducedAxes)
    ? [...new Set(person.introducedAxes.filter(Boolean))]
    : [];
  if (introducedAxes.includes(axis)) return false;

  const updatedAt = new Date().toISOString();
  const people = student.myPeople.map((candidate) => (
    candidate.id === personId
      ? { ...candidate, introducedAxes: [...introducedAxes, axis], updatedAt }
      : candidate
  ));
  const updatedStudent = { ...student, myPeople: people, myPeopleUpdatedAt: updatedAt };
  const students = store.students.map((candidate) => (
    candidate.id === studentId ? updatedStudent : candidate
  ));

  store.setStudents(students);
  const db = await getDb();
  await kv.set(db, "students", students);
  await pushOp("student.my_people.upsert", { studentId, people, updatedAt });
  return true;
}
