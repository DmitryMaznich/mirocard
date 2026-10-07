import { shuffle } from "@/shared/utils/shuffle";
import { choiceCount } from "./renderers/word_formation/exerciseModel";
// Explicitly authored agreement forms, separate from word formation.
const FORMS = {
  ryba: ["рыбный", "рыбная", "рыбное", "рыбные"],
  myaso: ["мясной", "мясная", "мясное", "мясные"],
  grib: ["грибной", "грибная", "грибное", "грибные"],
  kapusta: ["капустный", "капустная", "капустное", "капустные"],
  kuritsa: ["куриный", "куриная", "куриное", "куриные"],
  goroh: ["гороховый", "гороховая", "гороховое", "гороховые"],
  luk: ["луковый", "луковая", "луковое", "луковые"],
  ovoschi: ["овощной", "овощная", "овощное", "овощные"],
  fasolj: ["фасолевый", "фасолевая", "фасолевое", "фасолевые"],
  tikva: ["тыквенный", "тыквенная", "тыквенное", "тыквенные"],
};
const NOUNS = ["суп", "котлета", "блюдо", "котлеты"];
const KINDS = ["soup", "cutlet", "dish", "cutlets"];

export function soupAgreementTasks(cards, params) {
  return cards.filter(c => c.category === "soup" && FORMS[c.id]).flatMap(card =>
    FORMS[card.id].map((adj, index) => {
      const item = { id: `agreement_${index}`, noun: NOUNS[index], dishKind: KINDS[index],
        adjPhrase: `${adj} ${NOUNS[index]}`, sourcePhrase: card.nounPhrase.replace(/^суп/i, NOUNS[index]) };
      const alternatives = shuffle(FORMS[card.id].filter(word => word !== adj)).slice(0, choiceCount(params.optionCount) - 1);
      const options = shuffle([adj, ...alternatives].map(word => ({ key: word, ending: word.slice(-2), isTarget: word === adj })));
      return { type: "season_form_pick", card, item, params, options };
    })
  );
}
