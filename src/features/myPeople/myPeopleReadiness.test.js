import { describe, expect, it } from "vitest";
import { isMyPeopleProfileEmpty, myPeopleModeReadiness } from "./myPeopleReadiness";

const person = (id, extra = {}) => ({
  id, name: id, relation: "", type: "person", contexts: ["family"], photos: [`/p/${id}`], introducedAxes: [], enabled: true, ...extra,
});

describe("«Мои люди» readiness", () => {
  it("treats fewer than two people with photos as an empty profile", () => {
    expect(isMyPeopleProfileEmpty({ myPeople: [person("a")] })).toBe(true);
    expect(isMyPeopleProfileEmpty({ myPeople: [person("a"), person("b", { photos: [] })] })).toBe(true);
    expect(isMyPeopleProfileEmpty({ myPeople: [person("a"), person("b")] })).toBe(false);
  });

  it("opens «Подпиши фото» in the list with two people anywhere", () => {
    const student = { myPeople: [person("a", { contexts: ["school"] }), person("b", { contexts: ["school"] })] };
    expect(myPeopleModeReadiness({ id: "label_photos", type: "people_album" }, student).ready).toBe(true);
  });

  it("on the params screen names the chosen circle and the tab that fixes it", () => {
    const mode = { id: "label_photos", type: "people_album", params: { circle: { default: "family" } } };
    const student = { myPeople: [person("a", { relation: "мама" }), person("b", { relation: "папа" })] };
    expect(myPeopleModeReadiness(mode, student, { circle: "family", labelKind: "relation" }).ready).toBe(true);
    const school = myPeopleModeReadiness(mode, student, { circle: "school", labelKind: "name" });
    expect(school).toMatchObject({ ready: false, tab: "school" });
    expect(school.reason).toContain("Школа");
    const noRelations = { myPeople: [person("a"), person("b")] };
    expect(myPeopleModeReadiness(mode, noRelations, { labelKind: "relation" })).toMatchObject({ ready: false, tab: "family" });
    expect(myPeopleModeReadiness(mode, noRelations, { labelKind: "name" }).ready).toBe(true);
  });

  it("sends «Обо мне» to «Личные данные»", () => {
    expect(myPeopleModeReadiness({ id: "about_me" }, { name: "Петя", myPeople: [] })).toMatchObject({ ready: false, tab: "personal" });
  });

  it("closes «Кто это?» until «Покажи» introduced someone, without a profile link", () => {
    const student = { myPeople: [person("a"), person("b")] };
    expect(myPeopleModeReadiness({ id: "who_is_this" }, student)).toMatchObject({ ready: false, tab: null });
    const met = { myPeople: [person("a", { introducedAxes: ["name"] }), person("b")] };
    expect(myPeopleModeReadiness({ id: "who_is_this" }, met).ready).toBe(true);
  });
});
