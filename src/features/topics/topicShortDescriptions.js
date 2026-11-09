import { getUiLanguage } from "@/shared/i18n/uiLanguage.js";

// One line for a topic tile on the home screen (topic UI preview): what the
// topic teaches, not how many modes it has. Up to ~45 characters so it fits
// two lines of a half-width tile. Kept in the app bundle, not in the deck
// ZIP or the catalog: it works offline, for built-in topics and for an
// installed topic whose catalog entry has not loaded yet, and wording can
// change without rebuilding a deck. Drafts from 2026-11-09, pending review.
const SHORT_DESCRIPTIONS = {
  ru: {
    streak_tracker: "Счёт верных ответов для любого занятия",
    games: "Гонки и башни из кубиков вместе со взрослым",
    my_people: "Имена и роли близких по вашим фото",
    daily_orientation: "День недели, погода, план и праздники",
    shopping_list: "Список покупок с картинками",
    chat_with_mom: "Короткий разговор с мамой по картинкам",
    first_then: "Сначала одно, потом другое — по картинкам",
    reading_dad_poems: "Стихи: читаем вместе и собираем из слов",
    reading_short_stories: "Микрорассказы с вопросами по тексту",
    reading_dad_instructions: "Читаю и делаю: короткие инструкции",
    emotions_v2: "Радость, грусть, злость — на лицах и в сценах",
    people_names: "Мальчик, девочка, взрослый; мужские и женские имена",
    clothes_basic: "Одежда на фото: узнать и назвать",
    verbs_v2: "Действия на фото: ест, пьёт, спит, даёт",
    transport_photo: "Машины, поезда, самолёты — на фото",
    comparison: "Больше, меньше, поровну и знаки < > =",
    math_houses: "Состав чисел от 2 до 10",
    addition_subtraction: "Сложение и вычитание на пальцах и фишках",
    sentence_puzzle: "Предложение из слов-карточек",
    tools_functions: "Молоток, пила, отвёртка: что чем делают",
    place_value: "Единицы, десятки, сотни на монетах",
    column_addition: "Сложение и вычитание в столбик по шагам",
    word_formation_soup: "Суп из капусты — капустный: слова от слов",
    phonetic_analysis: "Звуки в слове и буквы",
    written_letters: "Рукописные буквы: узнать и найти пару",
    letter_writing: "Заглавные буквы по штрихам",
    propis2: "Тетради по письму: буквы, слова, диктант",
    propis2_lang: "Английские прописи: печатные и британские",
    learn_slovene: "Словенские буквы и слова через русские",
    vowel_consonant_ru: "Разложить буквы на гласные и согласные",
    magnetic_alphabet: "Слова из букв на магнитной доске",
    opposites: "Большой — маленький, полный — пустой",
    spatial_prepositions_ru: "В, на, под, рядом: где предмет?",
    spatial_prepositions: "В, на, под, рядом: где предмет?",
    word_agreement_ru: "Правильная форма слова в предложении",
    symmetry_draw: "Рисуем по клеткам и графический диктант",
    print_materials: "Тетради и рабочие листы для печати",
    print_letters: "Печатные буквы: листы и письмо на экране",
  },
  sl: {
    streak_tracker: "Štetje pravilnih odgovorov za vsako uro",
    games: "Dirke in stolpi iz kock z odraslim",
    my_people: "Imena in vloge bližnjih na vaših fotografijah",
    daily_orientation: "Dan v tednu, vreme, načrt in prazniki",
    shopping_list: "Nakupovalni seznam s slikami",
    first_then: "Najprej eno, potem drugo — s slikami",
    reading_short_stories: "Kratke zgodbe z vprašanji",
    emotions_v2: "Veselje, žalost, jeza — na obrazih in v prizorih",
    clothes_basic: "Oblačila na fotografijah",
    verbs_v2: "Dejanja na fotografijah: je, pije, spi",
    transport_photo: "Avtomobili, vlaki, letala na fotografijah",
    comparison: "Več, manj, enako in znaki < > =",
    math_houses: "Sestava števil od 2 do 10",
    addition_subtraction: "Seštevanje in odštevanje na prstih in žetonih",
    sentence_puzzle: "Poved iz besednih kartic",
    place_value: "Enice, desetice, stotice s kovanci",
    column_addition: "Pisno seštevanje in odštevanje po korakih",
    propis2: "Zvezki za pisanje: črke, besede, narek",
    learn_slovene: "Slovenske črke in besede prek ruskih",
    magnetic_alphabet: "Besede iz črk na magnetni tabli",
    opposites: "Velik — majhen, poln — prazen",
    symmetry_draw: "Risanje po mreži in grafični narek",
    print_letters: "Tiskane črke: listi in pisanje na zaslon",
  },
};

export function getTopicShortDescription(topicId, language = getUiLanguage()) {
  return SHORT_DESCRIPTIONS[language]?.[topicId] ?? null;
}
