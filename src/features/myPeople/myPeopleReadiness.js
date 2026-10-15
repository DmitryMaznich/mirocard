// What a «Мои люди» mode still needs from the student's profile, said in the
// adult's words, plus which tab of «Окружение ребёнка» fixes it. One place
// for the mode picker and the params screen, which used to keep two copies
// of the check and only said "fill in the data" without saying which.
import { useAppStore } from "@/core/store";
import { generateTasks, hasEnoughAboutMeFacts, hasEnoughAboutMeQuestions } from "@/topics/renderers/my_people/engine";

export const MY_PEOPLE_SECTION_TITLE = "Окружение ребёнка";

const CIRCLES = {
  family: "Семья и питомцы",
  home: "Люди дома",
  school: "Школа",
};

export function activeMyPeople(student) {
  return (student?.myPeople ?? []).filter((person) => (
    !person.deletedAt && person.enabled !== false && person.name?.trim() && person.photos?.some(Boolean)
  ));
}

// Fewer than two people with photos: every photo mode is closed, so the
// whole topic reads as "not set up yet".
export function isMyPeopleProfileEmpty(student) {
  return activeMyPeople(student).length < 2;
}

const ready = { ready: true, reason: "", tab: null };

export function myPeopleModeReadiness(mode, student) {
  if (!student) return { ready: false, reason: "Выберите ученика: задания строятся из его окружения.", tab: null };
  const people = activeMyPeople(student);
  const profile = student.myPeopleProfile ?? {};

  if (mode.id === "about_me") {
    return hasEnoughAboutMeQuestions(student) ? ready : {
      ready: false,
      reason: "Нужно хотя бы 2 вопроса: дата рождения в «Личных данных» или близкие с фото, у которых указано «мама», «папа»…",
      tab: "personal",
    };
  }
  if (mode.id === "introduce_self") {
    return hasEnoughAboutMeFacts(student) ? ready : {
      ready: false,
      reason: "Отметьте в «Личных данных» хотя бы два факта: имя, фамилию, название семьи или город.",
      tab: "personal",
    };
  }

  const circle = Object.keys(CIRCLES).find((context) => mode.id.startsWith(`${context}_`));
  if (circle) {
    if (profile.enabledBlocks?.[circle] === false) {
      return { ready: false, reason: `Круг «${CIRCLES[circle]}» выключен на вкладке «Порядок».`, tab: "order" };
    }
    const needsRelation = mode.id.endsWith("_relations");
    const inCircle = people.filter((person) => person.contexts?.includes(circle) && (!needsRelation || person.relation?.trim()));
    return inCircle.length >= 2 ? ready : {
      ready: false,
      reason: `В круге «${CIRCLES[circle]}» нужно хотя бы 2 человека с фото${needsRelation ? " и подписью «кто это»" : ""}.`,
      tab: circle,
    };
  }

  if (mode.id === "mix" && profile.enabledBlocks?.mix === false) {
    return { ready: false, reason: "«Все люди» выключены на вкладке «Порядок».", tab: "order" };
  }
  if (people.length < 2) {
    return { ready: false, reason: "Нужно хотя бы 2 человека с фото.", tab: "family" };
  }
  if (mode.id === "who_is_this" && !generateTasks(mode, student).length) {
    // Not a profile gap: «Кто это?» asks only about people already met.
    return { ready: false, reason: "Сначала пройдите «Покажи»: здесь спрашиваем только о людях, которых ребёнок уже находил.", tab: null };
  }
  return ready;
}

// Opens «Окружение ребёнка» for the student on the tab that fixes the gap
// and comes back to `returnScreen` on the back arrow.
export function openMyPeopleSettings({ studentId, returnScreen, tab = null }) {
  const state = useAppStore.getState();
  if (studentId) state.setEditingStudentId(studentId);
  state.setMyPeopleReturnScreen(returnScreen);
  state.setMyPeopleInitialTab(tab);
  state.setScreen("my_people_settings");
}
