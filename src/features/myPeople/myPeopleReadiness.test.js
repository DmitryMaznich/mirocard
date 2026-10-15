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

  it("names the circle and the tab that fixes a circle mode", () => {
    const student = { myPeople: [person("a"), person("b")] };
    expect(myPeopleModeReadiness({ id: "family_names" }, student).ready).toBe(true);
    const school = myPeopleModeReadiness({ id: "school_names" }, student);
    expect(school).toMatchObject({ ready: false, tab: "school" });
    expect(school.reason).toContain("Школа");
    expect(myPeopleModeReadiness({ id: "family_relations" }, student)).toMatchObject({ ready: false, tab: "family" });
  });

  it("sends a switched-off circle to «Порядок»", () => {
    const student = { myPeople: [person("a"), person("b")], myPeopleProfile: { enabledBlocks: { family: false } } };
    expect(myPeopleModeReadiness({ id: "family_names" }, student)).toMatchObject({ ready: false, tab: "order" });
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
