import { getUiLanguage } from "./uiLanguage.js";
import { getTopicTitle } from "../utils/format.js";

const SLOVENIAN_TOPIC_TITLES = {
  "streak_tracker": "5 od 5",
  "reading_dad_poems": "Branje: pesmi",
  "reading_short_stories": "Branje: kratke zgodbe",
  "reading_dad_instructions": "Branje: navodila",
  "emotions_v2": "Čustva",
  "people_names": "Spol, starost, imena",
  "clothes_basic": "Oblačila",
  "verbs_v2": "Glagoli",
  "transport_photo": "Prevozna sredstva",
  "comparison": "Primerjanje",
  "math_houses": "Številske hišice",
  "addition_subtraction": "Plus in minus",
  "sentence_puzzle": "Sestavljanje povedi",
  "tools_functions": "Orodja in njihova uporaba",
  "place_value": "Mestne vrednosti",
  "column_addition": "Pisno seštevanje in odštevanje",
  "word_formation_soup": "Besedotvorje",
  "phonetic_analysis": "Glasovi in črke",
  "written_letters": "Pisane črke",
  "letter_writing": "Pisanje črk",
  "propis": "Stari zvezki za pisanje",
  "propis2": "Vaje za pisanje",
  "vowel_consonant_ru": "Samoglasniki in soglasniki",
  "magnetic_alphabet": "Magnetna abeceda",
  "opposites": "Nasprotja",
  "first_then": "Najprej – potem",
  "spatial_prepositions_ru": "Predlogi: kje je predmet?",
  "word_agreement_ru": "Ujemanje besed",
  "symmetry_draw": "Risanje po mreži",
  "print_materials": "Gradivo za tiskanje",
  "my_people": "Moji ljudje",
  "daily_orientation": "Danes",
  "shopping_list": "Nakupovalni seznam",
  "chat_with_mom": "Pogovor z mamo",
  "spatial_prepositions": "Predlogi: kje je predmet?"
};

// For library/home navigation only. Never use this to select lesson content/audio.
export function getInterfaceTopicTitle(id, title, language = getUiLanguage()) {
  if (language === "sl") {
    if (typeof title === "object" && !Array.isArray(title) && title?.sl) return getTopicTitle(title, "sl");
    if (SLOVENIAN_TOPIC_TITLES[id]) return SLOVENIAN_TOPIC_TITLES[id];
  }
  return getTopicTitle(title, language);
}
