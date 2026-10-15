// What a «Мои люди» mode still needs from the student's profile, said in the
// adult's words, plus which tab of «Окружение ребёнка» fixes it. One place
// for the mode picker and the params screen, which used to keep two copies
// of the check and only said "fill in the data" without saying which.
import { useAppStore } from "@/core/store";
import { generateTasks, hasEnoughAboutMeFacts, hasEnoughAboutMeQuestions, labelAxes, peopleInCircle } from "@/topics/renderers/my_people/engine";

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

// `params` are the session params when known (the params screen): then
// «Подпиши фото» is checked for the chosen circle. Without them (the mode
// list) it only needs two people somewhere.
export function myPeopleModeReadiness(mode, student, params = null) {
  if (!student) return { ready: false, reason: "Выберите ученика: задания строятся из его окружения.", tab: null };
  const people = activeMyPeople(student);

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

  if (people.length < 2) {
    return { ready: false, reason: "Нужно хотя бы 2 человека с фото.", tab: "family" };
  }

  if (mode.type === "people_album") {
    const circle = mode.id === "label_photos"
      ? (params ? (params.circle ?? mode.params?.circle?.default) : "all")
      : Object.keys(CIRCLES).find((context) => mode.id.startsWith(`${context}_`)) ?? "all";
    // Without params (the list) any word will do; the params screen knows.
    const [firstAxis] = mode.id === "label_photos" && !params ? ["name"] : labelAxes(mode, { ...params, circle });
    const inCircle = peopleInCircle(student, circle).filter((person) => firstAxis !== "relation" || person.relation?.trim());
    if (inCircle.length < 2) {
      const where = CIRCLES[circle] ? `В круге «${CIRCLES[circle]}»` : "В окружении";
      return {
        ready: false,
        reason: `${where} нужно хотя бы 2 человека с фото${firstAxis === "relation" ? " и подписью «кто это»" : ""}.`,
        tab: CIRCLES[circle] ? circle : "family",
      };
    }
    return ready;
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
