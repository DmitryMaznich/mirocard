// Authored combinations: never infer a new word or reuse a picture of another object.
const EXAMPLES = {
  ryba: ["пирог из рыбы", "рыбный пирог"],
  myaso: ["пирог из мяса", "мясной пирог"],
  grib: ["соус из грибов", "грибной соус"],
  kapusta: ["пирог из капусты", "капустный пирог"],
  tikva: ["пюре из тыквы", "тыквенное пюре"],
  yabloko: ["пюре из яблок", "яблочное пюре"],
  morkov: ["пюре из моркови", "морковное пюре"],
  malina: ["джем из малины", "малиновый джем"],
  klubnika: ["джем из клубники", "клубничный джем"],
  sliva: ["джем из слив", "сливовый джем"],
  kasha_ris: ["суп из риса", "рисовый суп"],
  kasha_grechka: ["суп из гречки", "гречневый суп"],
  kasha_kukuruza: ["суп из кукурузы", "кукурузный суп"],
  dom_kamen: ["стена из камня", "каменная стена"],
  dom_derevo: ["стол из дерева", "деревянный стол"],
  dom_steklo: ["стакан из стекла", "стеклянный стакан"],
  dom_zhelezo: ["ключ из железа", "железный ключ"],
  dom_plastelin: ["фигурка из пластилина", "пластилиновая фигурка"],
  dom_led: ["фигурка изо льда", "ледяная фигурка"],
  dom_soloma: ["шляпа из соломы", "соломенная шляпа"],
  dom_kirpich: ["стена из кирпича", "кирпичная стена"],
  dom_bumaga: ["кораблик из бумаги", "бумажный кораблик"],
  dom_plastik: ["стакан из пластика", "пластиковый стакан"],
};
const SEASON_ADJECTIVES = {
  sea_osen_overview: ["осенний", "осенняя", "осеннее", "осенние"],
  sea_zima_overview: ["зимний", "зимняя", "зимнее", "зимние"],
  sea_vesna_overview: ["весенний", "весенняя", "весеннее", "весенние"],
  sea_leto_overview: ["летний", "летняя", "летнее", "летние"],
};
const SEASON_NOUNS = ["день", "прогулка", "утро", "каникулы"];

export function transferCards(cards) {
  return cards.flatMap(card => {
    if (SEASON_ADJECTIVES[card.id]) return [{
      ...card,
      backgroundImage: undefined,
      items: SEASON_ADJECTIVES[card.id].map((adj, index) => ({
        id: `transfer_${index}`, adjPhrase: `${adj} ${SEASON_NOUNS[index]}`,
      })),
    }];
    const example = EXAMPLES[card.id];
    if (!example) return [];
    return [{ ...card, conceptId: card.conceptId ?? card.id,
      id: `${card.id}:transfer`, nounPhrase: example[0], adjPhrase: example[1],
      questionText: undefined, image: undefined, ingredientImage: undefined, vesselImage: undefined,
    }];
  });
}
