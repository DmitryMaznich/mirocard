// Shared content for the "Согласование слов" (word_agreement) topic.
// Used by both build-word-agreement-deck.mjs (packages the deck) and
// generate-word-agreement-audio.mjs (synthesizes one .wav per card's full
// sentence via Gemini TTS). Keeping the sentences in one place avoids the
// two scripts drifting apart.

// Full spoken text for a card (context + sentence with the blank filled in)
// — matches FillBlankTask's fillSentence() at runtime. Used both for the
// summary screen's mistake list and as the text fed to TTS synthesis, so it
// must include the context line or generated audio would skip it.
function fullLabel(card) {
  const sentence = card.sentence.replace("{blank}", card.answer);
  return card.context ? `${card.context} ${sentence}` : sentence;
}

// Case-question hint shown next to the blank once the marker unlocks (see
// FillBlankTask's MARKER_ATTEMPT_THRESHOLD) — derived from the preposition
// that already marks the sentence, since that preposition deterministically
// picks the case in every sentence below. A handful of cards put the noun in
// an oblique case without any preposition at all (e.g. "рисует карандашом",
// "угостила яблоком") — those set `question` explicitly since there's no
// marker to derive it from.
const MARKER_TO_QUESTION = {
  "нет": "чего?", "без": "чего?", "много": "чего?",
  "к": "чему?",
  "на": "на чём?",
  "в": "в чём?",
  "с": "с чем?",
  "за": "за чем?",
  "между": "между чем?",
  "о": "о чём?", "об": "о чём?",
};

function questionFor(card) {
  return card.question ?? MARKER_TO_QUESTION[card.marker] ?? "что?";
}

// Four lexical sets for the case_agreement mode. Each card targets a form
// that's actually distinct from a form already covered elsewhere in the same
// set — for inanimate masc./neuter nouns (мяч, карандаш, яблоко) accusative
// is spelled identically to nominative, so no separate accusative card is
// needed there; машина (fem.) gets one, since its accusative genuinely
// differs from nominative (машина → машину).
// See src/topics/renderers/word_agreement/engine.js: FORMS_BY_WORD.
export const CASE_AGREEMENT_CARDS = [
  // Иван и мяч
  { id: "myach_01", word: "myach", sentence: "У Ивана один {blank}.",                                answer: "мяч",    optionSet: "singular" },
  { id: "myach_02", word: "myach", context: "Иван потерял мяч.",   sentence: "Теперь у него нет {blank}.",   answer: "мяча",   optionSet: "singular", marker: "нет" },
  { id: "myach_03", word: "myach", sentence: "Иван хотел играть во дворе, но пришёл без {blank}.",               answer: "мяча",   optionSet: "singular", marker: "без" },
  { id: "myach_04", word: "myach", context: "На полу лежит мяч.", sentence: "Иван подошёл к {blank}.",      answer: "мячу",   optionSet: "singular", marker: "к" },
  { id: "myach_05", word: "myach", context: "Иван вышел во двор.", sentence: "Он играет с {blank}.",        answer: "мячом",  optionSet: "singular", marker: "с" },
  { id: "myach_06", word: "myach", context: "Иван посмотрел на мяч.", sentence: "На {blank} было пятно.",   answer: "мяче",   optionSet: "singular", marker: "на" },
  { id: "myach_07", word: "myach", sentence: "Папа купил Ивану {blank} для футбола и баскетбола.",    answer: "мячи",   optionSet: "plural" },
  { id: "myach_08", word: "myach", sentence: "У Ивана много {blank}.",                                answer: "мячей",  optionSet: "plural", marker: "много" },
  { id: "myach_09", word: "myach", context: "Во дворе лежат мячи.", sentence: "Иван подошёл к {blank}, чтобы выбрать один.",      answer: "мячам",  optionSet: "plural", marker: "к" },
  { id: "myach_10", word: "myach", sentence: "Иван отнёс коробку с {blank} домой.",    answer: "мячами", optionSet: "plural", marker: "с" },
  { id: "myach_11", word: "myach", context: "Иван любит футбол.", sentence: "Он думает о {blank} для футбола.", answer: "мячах", optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Алина и карандаш
  { id: "karandash_01", word: "karandash", sentence: "У Алины один {blank}.",                              answer: "карандаш",    optionSet: "singular" },
  { id: "karandash_02", word: "karandash", context: "Алина потеряла карандаш.", sentence: "Теперь у неё нет {blank}.", answer: "карандаша",   optionSet: "singular", marker: "нет" },
  { id: "karandash_03", word: "karandash", sentence: "Алина пришла в школу без своего {blank}.",           answer: "карандаша",   optionSet: "singular", marker: "без" },
  { id: "karandash_04", word: "karandash", sentence: "Папа приклеил к {blank} наклейку с именем Алины.", answer: "карандашу",   optionSet: "singular", marker: "к" },
  { id: "karandash_05", word: "karandash", context: "Алина села за стол.", sentence: "Она рисует {blank}.",         answer: "карандашом",  optionSet: "singular", question: "чем?" },
  { id: "karandash_06", word: "karandash", context: "Алина взяла карандаш.", sentence: "На {blank} была наклейка.", answer: "карандаше", optionSet: "singular", marker: "на" },
  { id: "karandash_07", word: "karandash", sentence: "Папа купил Алине новые {blank}.",                    answer: "карандаши",   optionSet: "plural" },
  { id: "karandash_08", word: "karandash", sentence: "У Алины много {blank}.",                             answer: "карандашей",  optionSet: "plural", marker: "много" },
  { id: "karandash_09", word: "karandash", sentence: "Папа привязал к {blank} воздушные шарики.", answer: "карандашам",  optionSet: "plural", marker: "к" },
  { id: "karandash_10", word: "karandash", sentence: "Алина любит рисовать цветными {blank}.",   answer: "карандашами", optionSet: "plural", question: "чем?" },
  { id: "karandash_11", word: "karandash", context: "Алина любит рисовать.", sentence: "Она думает о цветных {blank}.", answer: "карандашах", optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Папа, Иван и машина (настоящая машина, не игрушка)
  { id: "mashina_01", word: "mashina", sentence: "У папы одна {blank}.",                                answer: "машина",   optionSet: "singular" },
  { id: "mashina_02", word: "mashina", sentence: "Папа моет свою {blank}.",                             answer: "машину",   optionSet: "singular" },
  { id: "mashina_03", word: "mashina", context: "Папа отвёз машину в ремонт.", sentence: "Сегодня он без {blank}.", answer: "машины", optionSet: "singular", marker: "без" },
  { id: "mashina_04", word: "mashina", context: "Папа продал старую машину.", sentence: "Теперь у него нет {blank}.",     answer: "машины",   optionSet: "singular", marker: "нет" },
  { id: "mashina_05", word: "mashina", context: "Машина стоит во дворе.", sentence: "Папа подошёл к {blank}.", answer: "машине",   optionSet: "singular", marker: "к" },
  { id: "mashina_06", word: "mashina", context: "Папа едет на работу.", sentence: "Он едет на {blank}.",      answer: "машине",   optionSet: "singular", marker: "на" },
  { id: "mashina_07", word: "mashina", context: "Папа купил новую машину.", sentence: "Иван стоит рядом с {blank}.", answer: "машиной", optionSet: "singular", marker: "с" },
  { id: "mashina_08", word: "mashina", sentence: "Во дворе стоят разные {blank}.",                      answer: "машины",   optionSet: "plural" },
  { id: "mashina_09", word: "mashina", sentence: "На парковке много {blank}.",                          answer: "машин",    optionSet: "plural", marker: "много" },
  { id: "mashina_10", word: "mashina", context: "На парковке стоят машины.", sentence: "Папа идёт к {blank}, чтобы найти свою.", answer: "машинам", optionSet: "plural", marker: "к" },
  { id: "mashina_11", word: "mashina", sentence: "Папа паркуется рядом с другими {blank}.",             answer: "машинами", optionSet: "plural", marker: "с" },
  { id: "mashina_12", word: "mashina", context: "Иван любит машины.", sentence: "Он думает о {blank}.", answer: "машинах",  optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Мама, папа и яблоко
  { id: "yabloko_01", word: "yabloko", sentence: "У папы в сумке было одно {blank}.",                  answer: "яблоко",   optionSet: "singular" },
  { id: "yabloko_02", word: "yabloko", context: "Папа уронил яблоко.", sentence: "Теперь у него нет {blank}.", answer: "яблока",   optionSet: "singular", marker: "нет" },
  { id: "yabloko_03", word: "yabloko", sentence: "Иван пришёл в школу без своего {blank}.",             answer: "яблока",   optionSet: "singular", marker: "без" },
  { id: "yabloko_04", word: "yabloko", context: "На столе лежит яблоко.", sentence: "Папа потянулся к {blank}.", answer: "яблоку",   optionSet: "singular", marker: "к" },
  { id: "yabloko_05", word: "yabloko", sentence: "Мама угостила папу {blank}.",      answer: "яблоком",  optionSet: "singular", question: "чем?" },
  { id: "yabloko_06", word: "yabloko", context: "Мама посмотрела на яблоко.", sentence: "На {blank} было пятно.", answer: "яблоке", optionSet: "singular", marker: "на" },
  { id: "yabloko_07", word: "yabloko", sentence: "Мама купила детям {blank}.",                   answer: "яблоки",   optionSet: "plural" },
  { id: "yabloko_08", word: "yabloko", sentence: "У мамы много {blank}.",                              answer: "яблок",    optionSet: "plural", marker: "много" },
  { id: "yabloko_09", word: "yabloko", context: "В корзине лежат яблоки.", sentence: "Папа потянулся к {blank}, чтобы взять два.", answer: "яблокам",  optionSet: "plural", marker: "к" },
  { id: "yabloko_10", word: "yabloko", sentence: "Мама испекла пирог с {blank}.", answer: "яблоками", optionSet: "plural", marker: "с" },
  { id: "yabloko_11", word: "yabloko", context: "В саду растут разные яблоки.", sentence: "Мама думает о {blank}.", answer: "яблоках", optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Иван и стол (твёрдая основа, не шипящая — контраст с мяч/карандаш)
  { id: "stol_01", word: "stol", sentence: "У Ивана в комнате один {blank}.",                                    answer: "стол",    optionSet: "singular" },
  { id: "stol_02", word: "stol", context: "Папа забрал стол на дачу.", sentence: "Теперь в комнате нет {blank}.", answer: "стола",   optionSet: "singular", marker: "нет" },
  { id: "stol_03", word: "stol", sentence: "Иван делает уроки без {blank}, прямо на полу.",                       answer: "стола",   optionSet: "singular", marker: "без" },
  { id: "stol_04", word: "stol", context: "Стол стоит у окна.", sentence: "Иван подошёл к {blank}.",              answer: "столу",   optionSet: "singular", marker: "к" },
  { id: "stol_05", word: "stol", context: "Алина проголодалась.", sentence: "Она сидела за {blank} и ждала обед.", answer: "столом",  optionSet: "singular", marker: "за" },
  { id: "stol_06", word: "stol", context: "Иван посмотрел на стол.", sentence: "На {blank} лежала книга.",        answer: "столе",   optionSet: "singular", marker: "на" },
  { id: "stol_07", word: "stol", sentence: "В школе стоят новые {blank}.",                                        answer: "столы",   optionSet: "plural" },
  { id: "stol_08", word: "stol", sentence: "В школе много {blank}.",                                              answer: "столов",  optionSet: "plural", marker: "много" },
  { id: "stol_09", word: "stol", context: "В столовой стоят столы.", sentence: "Дети подошли к {blank}, чтобы сесть обедать.", answer: "столам",  optionSet: "plural", marker: "к" },
  { id: "stol_10", word: "stol", context: "В классе расставили столы.", sentence: "Учитель ходит между {blank}.", answer: "столами", optionSet: "plural", marker: "между" },
  { id: "stol_11", word: "stol", context: "Иван хочет купить себе новый стол.", sentence: "Он думает о {blank}, которые видел в магазине.",      answer: "столах",  optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Алина и книга
  { id: "kniga_01", word: "kniga", sentence: "У Алины одна {blank}.",                                     answer: "книга",   optionSet: "singular" },
  { id: "kniga_02", word: "kniga", context: "Алина отдала книгу подруге.", sentence: "Теперь у неё нет {blank}.", answer: "книги",   optionSet: "singular", marker: "нет" },
  { id: "kniga_03", word: "kniga", sentence: "Алина пришла в школу без своей {blank}.",                   answer: "книги",   optionSet: "singular", marker: "без" },
  { id: "kniga_04", word: "kniga", context: "Книга лежит на полке.", sentence: "Алина потянулась к {blank}.", answer: "книге",   optionSet: "singular", marker: "к" },
  { id: "kniga_05", word: "kniga", sentence: "Алина поменялась {blank} с Иваном.",                        answer: "книгой",  optionSet: "singular", question: "чем?" },
  { id: "kniga_06", word: "kniga", context: "Алина посмотрела на книгу.", sentence: "На {blank} была картинка.", answer: "книге", optionSet: "singular", marker: "на" },
  { id: "kniga_07", word: "kniga", sentence: "Мама купила Алине новые {blank}.",                          answer: "книги",   optionSet: "plural" },
  { id: "kniga_08", word: "kniga", sentence: "У Алины много {blank}.",                                    answer: "книг",    optionSet: "plural", marker: "много" },
  { id: "kniga_09", word: "kniga", context: "На полке стоят книги.", sentence: "Алина подошла к {blank}, чтобы выбрать одну.", answer: "книгам",  optionSet: "plural", marker: "к" },
  { id: "kniga_10", word: "kniga", context: "На полке много книг.", sentence: "Алина положила карандаши рядом с {blank}.", answer: "книгами", optionSet: "plural", marker: "с" },
  { id: "kniga_11", word: "kniga", context: "Алина любит читать.", sentence: "Она думает о {blank}.", answer: "книгах",  optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Алина и кукла
  { id: "kukla_01", word: "kukla", sentence: "У Алины одна {blank}.",                                     answer: "кукла",   optionSet: "singular" },
  { id: "kukla_02", word: "kukla", context: "Алина подарила куклу подруге.", sentence: "Теперь у неё нет {blank}.", answer: "куклы",   optionSet: "singular", marker: "нет" },
  { id: "kukla_03", word: "kukla", sentence: "Алина пошла гулять без своей {blank}.",                     answer: "куклы",   optionSet: "singular", marker: "без" },
  { id: "kukla_04", word: "kukla", context: "Кукла сидит на кровати.", sentence: "Алина подошла к {blank}.", answer: "кукле",   optionSet: "singular", marker: "к" },
  { id: "kukla_05", word: "kukla", context: "Алина сидит в своей комнате.", sentence: "Она играет с {blank}.", answer: "куклой",  optionSet: "singular", marker: "с" },
  { id: "kukla_06", word: "kukla", context: "Алина посмотрела на куклу.", sentence: "На {blank} было красивое платье.", answer: "кукле", optionSet: "singular", marker: "на" },
  { id: "kukla_07", word: "kukla", sentence: "Папа купил Алине новые {blank}.",                           answer: "куклы",   optionSet: "plural" },
  { id: "kukla_08", word: "kukla", sentence: "У Алины много {blank}.",                                    answer: "кукол",   optionSet: "plural", marker: "много" },
  { id: "kukla_09", word: "kukla", context: "На полке сидят куклы.", sentence: "Алина подошла к {blank}, чтобы выбрать одну.", answer: "куклам",  optionSet: "plural", marker: "к" },
  { id: "kukla_10", word: "kukla", context: "В коробке лежат куклы.", sentence: "Алина играет с {blank}.", answer: "куклами", optionSet: "plural", marker: "с" },
  { id: "kukla_11", word: "kukla", context: "Алина любит играть в куклы.", sentence: "Она думает о {blank}.", answer: "куклах",  optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Иван, мама и окно
  { id: "okno_01", word: "okno", sentence: "В комнате Ивана одно {blank}.",                                answer: "окно",   optionSet: "singular" },
  { id: "okno_02", word: "okno", context: "Рабочие меняют окно на кухне.", sentence: "Пока там нет {blank}.", answer: "окна",   optionSet: "singular", marker: "нет" },
  { id: "okno_03", word: "okno", sentence: "В кладовке темно, потому что там нет {blank}.",                answer: "окна",   optionSet: "singular", marker: "нет" },
  { id: "okno_04", word: "okno", context: "Окно открыто.", sentence: "Иван подошёл к {blank}.",             answer: "окну",   optionSet: "singular", marker: "к" },
  { id: "okno_05", word: "okno", context: "Пошёл дождь.", sentence: "Иван смотрит на капли за {blank}.",    answer: "окном",  optionSet: "singular", marker: "за" },
  { id: "okno_06", word: "okno", context: "Мама посмотрела на окно.", sentence: "На {blank} сидела птица.", answer: "окне",   optionSet: "singular", marker: "на" },
  { id: "okno_07", word: "okno", sentence: "В новом доме большие {blank}.",                                answer: "окна",   optionSet: "plural" },
  { id: "okno_08", word: "okno", sentence: "В школе много {blank}.",                                       answer: "окон",   optionSet: "plural", marker: "много" },
  { id: "okno_09", word: "okno", context: "В доме несколько окон.", sentence: "Иван подошёл к {blank}, чтобы посмотреть на улицу.", answer: "окнам",  optionSet: "plural", marker: "к" },
  { id: "okno_10", word: "okno", context: "Иван увидел новый дом.", sentence: "Это дом с большими {blank}.", answer: "окнами", optionSet: "plural", marker: "с" },
  { id: "okno_11", word: "okno", context: "Иван любит разглядывать дома.", sentence: "Он думает об {blank}.", answer: "окнах",  optionSet: "plural", marker: "об", difficulty: "advanced" },

  // Мама и яйцо
  { id: "yaytso_01", word: "yaytso", context: "Мама заглянула в холодильник.", sentence: "Там было одно {blank}.", answer: "яйцо",   optionSet: "singular" },
  { id: "yaytso_02", word: "yaytso", context: "Мама разбила яйцо на завтрак.", sentence: "Теперь у неё нет {blank}.", answer: "яйца",   optionSet: "singular", marker: "нет" },
  { id: "yaytso_03", word: "yaytso", context: "Иван вчера забыл купить яйца.", sentence: "В холодильнике не было ни одного {blank}.", answer: "яйца",   optionSet: "singular", question: "чего?" },
  { id: "yaytso_04", word: "yaytso", context: "Яйцо лежит на столе.", sentence: "Мама потянулась к {blank}.", answer: "яйцу",   optionSet: "singular", marker: "к" },
  { id: "yaytso_05", word: "yaytso", context: "Мама печёт пирог.", sentence: "Она смазывает тесто {blank}.", answer: "яйцом",  optionSet: "singular", question: "чем?" },
  { id: "yaytso_06", word: "yaytso", context: "Мама посмотрела на яйцо.", sentence: "На {blank} была трещинка.", answer: "яйце", optionSet: "singular", marker: "на" },
  { id: "yaytso_07", word: "yaytso", sentence: "Мама купила свежие {blank}.",                              answer: "яйца",   optionSet: "plural" },
  { id: "yaytso_08", word: "yaytso", sentence: "У мамы много {blank}.",                                    answer: "яиц",    optionSet: "plural", marker: "много" },
  { id: "yaytso_09", word: "yaytso", context: "На столе лежат яйца.", sentence: "Мама подошла к {blank}, чтобы выбрать два для омлета.", answer: "яйцам",  optionSet: "plural", marker: "к" },
  { id: "yaytso_10", word: "yaytso", context: "В корзине лежат яйца.", sentence: "Мама печёт кекс с {blank}.", answer: "яйцами", optionSet: "plural", marker: "с" },
  { id: "yaytso_11", word: "yaytso", context: "В корзине лежат разные яйца.", sentence: "Мама думает о {blank}.", answer: "яйцах",  optionSet: "plural", marker: "о", difficulty: "advanced" },

  // Иван и кот — единственное одушевлённое существительное в наборе.
  // Специально ради того, чтобы показать: у одушевлённых слов мужского
  // рода винительный падеж совпадает с родительным, а не с именительным
  // ("кот" -> "вижу кота" / "нет кота"), в отличие от всех неодушевлённых
  // слов выше ("мяч" -> "вижу мяч", как именительный). kot_02 и kot_03
  // нарочно дают один и тот же ответ "кота" двумя разными триггерами —
  // ребёнок слышит совпадение форм, а не просто угадывает по маркеру.
  { id: "kot_01", word: "kot", sentence: "У Ивана дома живёт {blank}.",                                    answer: "кот",   optionSet: "singular", question: "кто?" },
  { id: "kot_02", word: "kot", context: "Кот спрятался под диван.", sentence: "Иван ищет {blank} по всей квартире.", answer: "кота",  optionSet: "singular", question: "кого?" },
  { id: "kot_03", word: "kot", context: "Кот убежал погулять.", sentence: "Уже вечер, а у Ивана всё ещё нет {blank}.", answer: "кота",  optionSet: "singular", marker: "нет" },
  { id: "kot_04", word: "kot", context: "Кота отвезли к ветеринару.", sentence: "Дома скучно без {blank}.",  answer: "кота",  optionSet: "singular", marker: "без" },
  { id: "kot_05", word: "kot", context: "Кот сидит у окна.", sentence: "Иван подошёл к {blank}, чтобы погладить.", answer: "коту",  optionSet: "singular", marker: "к" },
  { id: "kot_06", word: "kot", sentence: "Вечером Иван играет с {blank}.",                                  answer: "котом", optionSet: "singular", marker: "с" },

  // Дательный без предлога — впервые в теме сами имена персонажей стоят не
  // в именительном, а в роли адресата ("подарил кому"). Раньше Иван/Алина/
  // мама/папа были только тем, кто действует, никогда — тем, кому дают.
  { id: "ivan_dat",  word: "ivan",  context: "У Ивана сегодня день рождения.",  sentence: "Папа подарил {blank} мяч.",    answer: "Ивану", optionSet: "singular", question: "кому?" },
  { id: "alina_dat", word: "alina", context: "У Алины сегодня день рождения.",  sentence: "Мама подарила {blank} куклу.", answer: "Алине", optionSet: "singular", question: "кому?" },
  { id: "mama_dat",  word: "mama",  context: "Приближается праздник.",         sentence: "Иван подарил {blank} цветы.",  answer: "маме",  optionSet: "singular", question: "кому?" },
  { id: "papa_dat",  word: "papa",  context: "У папы сегодня день рождения.",  sentence: "Алина подарила {blank} книгу.", answer: "папе",  optionSet: "singular", question: "кому?" },

  // Предлог «в» + предложный — раньше предложный падеж проверялся только
  // через «на» и «о/об». Ответ здесь совпадает с уже проверенной «на»-
  // карточкой того же слова — это нарочно: показываем, что предложный
  // падеж требуют разные предлоги, а не только «на».
  { id: "mashina_v", word: "mashina", sentence: "Иван сидел в {blank} и ждал папу.",       answer: "машине", optionSet: "singular", marker: "в" },
  { id: "yabloko_v", word: "yabloko", sentence: "В {blank} был червячок.",                  answer: "яблоке", optionSet: "singular", marker: "в" },
  { id: "yaytso_v",  word: "yaytso",  sentence: "В {blank} был жёлтый желток.",              answer: "яйце",   optionSet: "singular", marker: "в" },
  { id: "stol_v",    word: "stol",    context: "Иван искал карандаш.", sentence: "Карандаш лежал в {blank}.", answer: "столе",  optionSet: "singular", marker: "в" },
  { id: "myach_v",   word: "myach",   context: "Мяч сдулся.",          sentence: "В {blank} была дырка.",     answer: "мяче",   optionSet: "singular", marker: "в" },
].map((c) => ({
  ...c,
  skill:    "case_agreement",
  context:  c.context ?? null,
  marker:   c.marker ?? null,
  question: questionFor(c),
  label:    fullLabel(c),
}));

// verb_number_agreement: subject noun is already spelled out in the
// sentence (singular or plural) — the child looks at it and picks the
// matching verb form. Each pair below expands into two cards (singular
// subject / plural subject); the marker highlighted after 2 wrong attempts
// is the subject itself, drawing attention to its ending.
const VERB_NUMBER_PAIRS = [
  // Предметы
  { word: "Мяч",      wordPl: "Мячи",      place: "на полу",      verb: "lezhat",   sing: "лежит",   pl: "лежат" },
  { word: "Мяч",      wordPl: "Мячи",      place: "по двору",     verb: "katitsya", sing: "катится", pl: "катятся" },
  { word: "Мяч",      wordPl: "Мячи",      place: "с полки",      verb: "padat",    sing: "падает",  pl: "падают" },
  { word: "Карандаш", wordPl: "Карандаши", place: "в коробке",    verb: "lezhat",   sing: "лежит",   pl: "лежат" },
  { word: "Карандаш", wordPl: "Карандаши", place: "со стола",     verb: "padat",    sing: "падает",  pl: "падают" },
  { word: "Машина",   wordPl: "Машины",    place: "во дворе",     verb: "stoyat",   sing: "стоит",   pl: "стоят" },
  { word: "Машина",   wordPl: "Машины",    place: "по дороге",    verb: "ekhat",    sing: "едет",    pl: "едут" },
  { word: "Яблоко",   wordPl: "Яблоки",    place: "в корзине",    verb: "lezhat",   sing: "лежит",   pl: "лежат" },
  { word: "Яблоко",   wordPl: "Яблоки",    place: "на дереве",    verb: "viset",    sing: "висит",   pl: "висят" },
  { word: "Яблоко",   wordPl: "Яблоки",    place: "с дерева",     verb: "padat",    sing: "падает",  pl: "падают" },
  // Люди (собирательное множественное — «дети», «родители»)
  { word: "Иван",  wordPl: "Дети",     place: "во дворе",  verb: "igrat",   sing: "играет", pl: "играют" },
  { word: "Алина", wordPl: "Дети",     place: "за столом", verb: "risovat", sing: "рисует", pl: "рисуют" },
  { word: "Мама",  wordPl: "Родители", place: "домой",     verb: "idti",    sing: "идёт",   pl: "идут" },
  { word: "Папа",  wordPl: "Родители", place: "в парке",   verb: "gulyat",  sing: "гуляет", pl: "гуляют" },
];

export const VERB_NUMBER_CARDS = VERB_NUMBER_PAIRS.flatMap((p, i) => {
  const n = String(i + 1).padStart(2, "0");
  return [
    {
      id: `verbnum_${n}_sing`, skill: "verb_number_agreement", verb: p.verb,
      sentence: `${p.word} {blank} ${p.place}.`, answer: p.sing, marker: p.word,
    },
    {
      id: `verbnum_${n}_pl`, skill: "verb_number_agreement", verb: p.verb,
      sentence: `${p.wordPl} {blank} ${p.place}.`, answer: p.pl, marker: p.wordPl,
    },
  ];
}).map((c) => ({
  ...c,
  context: null,
  label: fullLabel(c),
}));

// verb_gender_agreement: past-tense verbs agree with the subject's gender
// (and have a separate plural form). Six verbs across the established
// vocabulary (Иван/Алина/мама/папа/дети, мяч, карандаш, машина, яблоко)
// give 15 cards balanced across masc/fem/neut/plural (4/4/3/4) — neuter is
// one card lighter than the rest because яблоко is the only neuter noun in
// the vocabulary so far; a second neuter word would be needed to close it.
const VERB_GENDER_ITEMS = [
  { id: "verbgen_01", verb: "poyti",      subject: "Иван",         rest: "в школу",     answer: "пошёл" },
  { id: "verbgen_02", verb: "poyti",      subject: "Алина",        rest: "в школу",     answer: "пошла" },
  { id: "verbgen_03", verb: "poyti",      subject: "Мама и папа",  rest: "гулять",      answer: "пошли" },
  { id: "verbgen_04", verb: "priti",      subject: "Папа",         rest: "с работы",    answer: "пришёл" },
  { id: "verbgen_05", verb: "priti",      subject: "Мама",         rest: "с работы",    answer: "пришла" },
  { id: "verbgen_06", verb: "priti",      subject: "Дети",         rest: "из школы",    answer: "пришли" },
  { id: "verbgen_07", verb: "upast",      subject: "Мяч",          rest: "со стола",    answer: "упал" },
  // 08/10/12/15 use stative verbs (лежать/стоять), which read equally
  // naturally in present tense ("лежит"/"стоит") without any cue — unlike
  // the one-time events above (пошёл/упал/...), past tense here isn't
  // self-evident, so a "Вчера" anchor makes it explicit.
  { id: "verbgen_08", verb: "lezhat",     subject: "Карандаш",     rest: "на столе",    answer: "лежал",       lead: "Вчера" },
  { id: "verbgen_09", verb: "upast",      subject: "Алина",        rest: "на льду",     answer: "упала" },
  { id: "verbgen_10", verb: "stoyat",     subject: "Машина",       rest: "в гараже",    answer: "стояла",      lead: "Вчера" },
  { id: "verbgen_11", verb: "upast",      subject: "Яблоко",       rest: "с дерева",    answer: "упало" },
  { id: "verbgen_12", verb: "lezhat",     subject: "Яблоко",       rest: "в корзине",   answer: "лежало",      lead: "Вчера" },
  // покатилось implies an unstated cause (apples don't roll on their own) —
  // a one-line context supplies it instead of a temporal marker.
  { id: "verbgen_13", verb: "pokatitsya", subject: "Яблоко",       rest: "по столу",    answer: "покатилось", context: "Иван задел яблоко локтем." },
  { id: "verbgen_14", verb: "upast",      subject: "Карандаши",    rest: "со стола",    answer: "упали" },
  { id: "verbgen_15", verb: "lezhat",     subject: "Мячи",         rest: "в коробке",   answer: "лежали",      lead: "Вчера" },
  // Балансировка: раньше средний род был на одну карточку короче остальных
  // (яблоко — единственное среднее слово в момент, когда придумывался этот
  // режим). Окно уже давно есть в словаре — используем его.
  { id: "verbgen_16", verb: "otkrytsya",  subject: "Окно",         rest: "от ветра",    answer: "открылось" },
];

export const VERB_GENDER_CARDS = VERB_GENDER_ITEMS.map((item) => {
  const leadSubject = item.lead ? item.subject.charAt(0).toLowerCase() + item.subject.slice(1) : item.subject;
  const sentence = item.lead
    ? `${item.lead} ${leadSubject} {blank} ${item.rest}.`
    : `${item.subject} {blank} ${item.rest}.`;
  return {
    id: item.id,
    skill: "verb_gender_agreement",
    verb: item.verb,
    sentence,
    answer: item.answer,
    marker: item.subject,
    context: item.context ?? null,
  };
}).map((c) => ({ ...c, label: fullLabel(c) }));

// numeral_agreement: 2-4 govern genitive singular, 5+ govern genitive
// plural — both forms already exist in FORMS_BY_WORD (built for
// case_agreement), so this mode reuses the same word/optionSet/answer shape
// and just swaps the trigger from a preposition to a numeral. "один"
// (nominative) isn't retested here — it's already the very first
// case_agreement card for every word ("У Ивана один мяч"), so a numeral card
// with the same answer would just duplicate that skill under a new mode.
// "два/две" is picked to agree with each word's gender; три/четыре/5+ don't
// change by gender, so those are free to vary for exposure.
const NUMERAL_AGREEMENT_ITEMS = [
  { id: "numeral_myach_few",      word: "myach",     numeral: "два",    sentence: "Папа купил Ивану два {blank}.",              answer: "мяча",     optionSet: "singular" },
  { id: "numeral_myach_many",     word: "myach",     numeral: "пять",   sentence: "У Ивана в шкафу пять {blank}.",              answer: "мячей",    optionSet: "plural" },
  { id: "numeral_karandash_few",  word: "karandash", numeral: "три",    sentence: "У Алины в рюкзаке три {blank}.",             answer: "карандаша", optionSet: "singular" },
  { id: "numeral_karandash_many", word: "karandash", numeral: "восемь", sentence: "В коробке лежит восемь {blank}.",            answer: "карандашей", optionSet: "plural" },
  { id: "numeral_stol_few",       word: "stol",      numeral: "четыре", sentence: "В классе стоят четыре {blank}.",             answer: "стола",    optionSet: "singular" },
  { id: "numeral_stol_many",      word: "stol",      numeral: "десять", sentence: "В школе десять {blank}.",                    answer: "столов",   optionSet: "plural" },
  { id: "numeral_mashina_few",    word: "mashina",   numeral: "две",    sentence: "На парковке стоят две {blank}.",             answer: "машины",   optionSet: "singular" },
  { id: "numeral_mashina_many",   word: "mashina",   numeral: "шесть",  sentence: "На парковке стоит шесть {blank}.",           answer: "машин",    optionSet: "plural" },
  { id: "numeral_kniga_few",      word: "kniga",     numeral: "четыре", sentence: "Мама купила Алине четыре {blank}.",          answer: "книги",    optionSet: "singular" },
  { id: "numeral_kniga_many",     word: "kniga",     numeral: "семь",   sentence: "На полке стоит семь {blank}.",               answer: "книг",     optionSet: "plural" },
  { id: "numeral_kukla_few",      word: "kukla",     numeral: "три",    sentence: "У Алины три {blank}.",                       answer: "куклы",    optionSet: "singular" },
  { id: "numeral_kukla_many",     word: "kukla",     numeral: "девять", sentence: "В коробке лежит девять {blank}.",            answer: "кукол",    optionSet: "plural" },
  { id: "numeral_yabloko_few",    word: "yabloko",   numeral: "два",    sentence: "Мама купила два {blank}.",                   answer: "яблока",   optionSet: "singular" },
  { id: "numeral_yabloko_many",   word: "yabloko",   numeral: "шесть",  sentence: "В корзине лежит шесть {blank}.",             answer: "яблок",    optionSet: "plural" },
  { id: "numeral_okno_few",       word: "okno",      numeral: "четыре", sentence: "В новом доме было четыре {blank}.",          answer: "окна",     optionSet: "singular" },
  { id: "numeral_okno_many",      word: "okno",      numeral: "восемь", sentence: "В новом доме восемь {blank}.",               answer: "окон",     optionSet: "plural" },
  { id: "numeral_yaytso_few",     word: "yaytso",    numeral: "три",    sentence: "Мама взяла три {blank}.",                    answer: "яйца",     optionSet: "singular" },
  { id: "numeral_yaytso_many",    word: "yaytso",    numeral: "десять", sentence: "В коробке лежит десять {blank}.",            answer: "яиц",      optionSet: "plural" },
];

export const NUMERAL_AGREEMENT_CARDS = NUMERAL_AGREEMENT_ITEMS.map((item) => ({
  id: item.id,
  skill: "numeral_agreement",
  word: item.word,
  optionSet: item.optionSet,
  sentence: item.sentence,
  answer: item.answer,
  marker: item.numeral,
  question: "чего?",
  context: null,
})).map((c) => ({ ...c, label: fullLabel(c) }));

// adjective_agreement: three adjective roots (маленький — velar stem, новый
// — unstressed hard stem, большой — stressed hushing stem, so the three
// common masc.sg spelling patterns are all represented), each shown once
// against a masc/fem/neut noun from the existing vocabulary plus once in
// plural — the same descriptive word, four different endings depending on
// what it describes. No new nouns needed.
const GENDER_QUESTION = { masc: "какой?", fem: "какая?", neut: "какое?", plural: "какие?" };

const ADJECTIVE_AGREEMENT_ITEMS = [
  { id: "adjagr_myach_sg",     adjective: "malenkiy", gender: "masc",   noun: "мяч",      sentence: "У Ивана {blank} мяч.",              answer: "маленький" },
  { id: "adjagr_myach_pl",     adjective: "malenkiy", gender: "plural", noun: "мячи",     sentence: "У Ивана {blank} мячи.",             answer: "маленькие" },
  { id: "adjagr_kukla_sg",     adjective: "malenkiy", gender: "fem",    noun: "кукла",    sentence: "У Алины {blank} кукла.",            answer: "маленькая" },
  { id: "adjagr_kukla_pl",     adjective: "malenkiy", gender: "plural", noun: "куклы",    sentence: "У Алины {blank} куклы.",            answer: "маленькие" },
  { id: "adjagr_okno_sg_malenkiy",      adjective: "malenkiy", gender: "neut",   noun: "окно",      sentence: "Мама открыла {blank} окно.",        answer: "маленькое" },
  { id: "adjagr_karandash_pl_malenkiy", adjective: "malenkiy", gender: "plural", noun: "карандаши", sentence: "У Алины были {blank} карандаши.",   answer: "маленькие" },
  { id: "adjagr_karandash_sg", adjective: "novy",     gender: "masc",   noun: "карандаш", sentence: "У Алины {blank} карандаш.",         answer: "новый" },
  { id: "adjagr_karandash_pl", adjective: "novy",     gender: "plural", noun: "карандаши", sentence: "У Алины {blank} карандаши.",       answer: "новые" },
  { id: "adjagr_kniga_sg",     adjective: "novy",     gender: "fem",    noun: "книга",    sentence: "У Алины {blank} книга.",            answer: "новая" },
  { id: "adjagr_kniga_pl",     adjective: "novy",     gender: "plural", noun: "книги",    sentence: "У Алины {blank} книги.",            answer: "новые" },
  { id: "adjagr_okno_sg",      adjective: "novy",     gender: "neut",   noun: "окно",     sentence: "В доме {blank} окно.",              answer: "новое" },
  { id: "adjagr_okno_pl",      adjective: "novy",     gender: "plural", noun: "окна",     sentence: "В доме {blank} окна.",              answer: "новые" },
  { id: "adjagr_stol_sg",      adjective: "bolshoy",  gender: "masc",   noun: "стол",     sentence: "В классе {blank} стол.",            answer: "большой" },
  { id: "adjagr_stol_pl",      adjective: "bolshoy",  gender: "plural", noun: "столы",    sentence: "В классе {blank} столы.",           answer: "большие" },
  { id: "adjagr_mashina_sg",   adjective: "bolshoy",  gender: "fem",    noun: "машина",   sentence: "У папы {blank} машина.",            answer: "большая" },
  { id: "adjagr_mashina_pl",   adjective: "bolshoy",  gender: "plural", noun: "машины",   sentence: "На парковке стоят {blank} машины.", answer: "большие" },
  { id: "adjagr_yabloko_sg",   adjective: "bolshoy",  gender: "neut",   noun: "яблоко",   sentence: "На столе лежит {blank} яблоко.",    answer: "большое" },
  { id: "adjagr_yabloko_pl",   adjective: "bolshoy",  gender: "plural", noun: "яблоки",   sentence: "В корзине лежат {blank} яблоки.",   answer: "большие" },
];

export const ADJECTIVE_AGREEMENT_CARDS = ADJECTIVE_AGREEMENT_ITEMS.map((item) => ({
  id: item.id,
  skill: "adjective_agreement",
  adjective: item.adjective,
  sentence: item.sentence,
  answer: item.answer,
  marker: item.noun,
  question: GENDER_QUESTION[item.gender],
  context: null,
})).map((c) => ({ ...c, label: fullLabel(c) }));

// possessive_agreement: свой (reflexive — "взял свой мяч") is the most
// distinctively Russian and most clinically relevant of the possessives for
// this app's audience (children on the autism spectrum commonly show
// deictic pronoun confusion — mixing up "my"/"your" — which is exactly what
// мой/твой drill, more centrally than свой's third-person reflexive does).
// So all four get tested: свой in plain third-person narrative (works
// without any new sentence shape), мой/твой/наш need a speaker, so those
// use short quoted dialogue instead — a new shape for this topic, but a
// natural, common one, not an artificial construction.
//
// свой is tested as a direct object ("нашёл свой мяч"), so its answers are
// the accusative forms — masc/neut/plural match nominative for inanimate
// nouns, only fem changes (своя -> свою). мой/твой/наш are tested as a
// predicate ("Это мой мяч"), so those stay nominative. See POSSESSIVE_FORMS
// in engine.js for the exact forms used.
const POSSESSIVE_AGREEMENT_ITEMS = [
  // свой (свой/свою/своё/свои)
  { id: "poss_svoy_myach",     possessive: "svoy", gender: "masc",   noun: "мяч",      sentence: "Иван нашёл {blank} мяч.",         answer: "свой" },
  { id: "poss_svoy_karandash", possessive: "svoy", gender: "masc",   noun: "карандаш", sentence: "Алина взяла {blank} карандаш.",   answer: "свой" },
  { id: "poss_svoy_stol",      possessive: "svoy", gender: "masc",   noun: "стол",     sentence: "Иван сел за {blank} стол.",       answer: "свой" },
  { id: "poss_svoy_mashina",   possessive: "svoy", gender: "fem",    noun: "машину",   sentence: "Папа паркует {blank} машину.",    answer: "свою" },
  { id: "poss_svoy_kniga",     possessive: "svoy", gender: "fem",    noun: "книгу",    sentence: "Алина взяла {blank} книгу.",      answer: "свою" },
  { id: "poss_svoy_kukla",     possessive: "svoy", gender: "fem",    noun: "куклу",    sentence: "Алина нашла {blank} куклу.",      answer: "свою" },
  { id: "poss_svoy_yabloko",   possessive: "svoy", gender: "neut",   noun: "яблоко",   sentence: "Иван взял {blank} яблоко.",       answer: "своё" },
  { id: "poss_svoy_okno",      possessive: "svoy", gender: "neut",   noun: "окно",     sentence: "Иван открыл {blank} окно.",       answer: "своё" },
  { id: "poss_svoy_yaytso",    possessive: "svoy", gender: "neut",   noun: "яйцо",     sentence: "Мама разбила {blank} яйцо.",      answer: "своё" },
  { id: "poss_svoy_myachi",    possessive: "svoy", gender: "plural", noun: "мячи",     sentence: "Дети взяли {blank} мячи.",        answer: "свои" },
  { id: "poss_svoy_karandashi", possessive: "svoy", gender: "plural", noun: "карандаши", sentence: "Дети взяли {blank} карандаши.", answer: "свои" },
  { id: "poss_svoy_knigi",     possessive: "svoy", gender: "plural", noun: "книги",    sentence: "Дети взяли {blank} книги.",       answer: "свои" },
  { id: "poss_svoy_yabloki",   possessive: "svoy", gender: "plural", noun: "яблоки",   sentence: "Дети взяли {blank} яблоки.",      answer: "свои" },

  // мой (Иван/Алина о своём — говорящий сам)
  { id: "poss_moy_myach",   possessive: "moy", gender: "masc",   noun: "мяч",   context: "Иван говорит:",  sentence: "«Это {blank} мяч.»",   answer: "мой" },
  { id: "poss_moy_kukla",   possessive: "moy", gender: "fem",    noun: "кукла", context: "Алина говорит:", sentence: "«Это {blank} кукла.»", answer: "моя" },
  { id: "poss_moy_yabloko", possessive: "moy", gender: "neut",   noun: "яблоко", context: "Иван говорит:", sentence: "«Это {blank} яблоко.»", answer: "моё" },
  { id: "poss_moy_knigi",   possessive: "moy", gender: "plural", noun: "книги", context: "Алина говорит:", sentence: "«Это {blank} книги.»", answer: "мои" },

  // твой (мама/папа обращаются к ребёнку)
  { id: "poss_tvoy_myach",       possessive: "tvoy", gender: "masc",   noun: "мяч",       context: "Мама говорит Ивану:",  sentence: "«Это {blank} мяч.»",       answer: "твой" },
  { id: "poss_tvoy_kukla",       possessive: "tvoy", gender: "fem",    noun: "кукла",     context: "Мама говорит Алине:",  sentence: "«Это {blank} кукла.»",     answer: "твоя" },
  { id: "poss_tvoy_yabloko",     possessive: "tvoy", gender: "neut",   noun: "яблоко",    context: "Папа говорит Ивану:",  sentence: "«Это {blank} яблоко.»",    answer: "твоё" },
  { id: "poss_tvoy_karandashi",  possessive: "tvoy", gender: "plural", noun: "карандаши", context: "Мама говорит Алине:",  sentence: "«Это {blank} карандаши.»", answer: "твои" },

  // наш (мама и папа — говорят вместе)
  { id: "poss_nash_stol",    possessive: "nash", gender: "masc",   noun: "стол",    context: "Мама и папа говорят:", sentence: "«Это {blank} стол.»",    answer: "наш" },
  { id: "poss_nash_mashina", possessive: "nash", gender: "fem",    noun: "машина",  context: "Мама и папа говорят:", sentence: "«Это {blank} машина.»",  answer: "наша" },
  { id: "poss_nash_okno",    possessive: "nash", gender: "neut",   noun: "окно",    context: "Мама и папа говорят:", sentence: "«Это {blank} окно.»",    answer: "наше" },
  { id: "poss_nash_yabloki", possessive: "nash", gender: "plural", noun: "яблоки",  context: "Мама и папа говорят:", sentence: "«Это {blank} яблоки.»",  answer: "наши" },
];

const POSSESSIVE_QUESTION = { masc: "чей?", fem: "чья?", neut: "чьё?", plural: "чьи?" };

export const POSSESSIVE_AGREEMENT_CARDS = POSSESSIVE_AGREEMENT_ITEMS.map((item) => ({
  id: item.id,
  skill: "possessive_agreement",
  possessive: item.possessive,
  sentence: item.sentence,
  answer: item.answer,
  marker: item.noun,
  question: POSSESSIVE_QUESTION[item.gender],
  context: item.context ?? null,
})).map((c) => ({ ...c, label: fullLabel(c) }));

// Prepositions start as visible, static "where?" relations. Each card has a
// physically meaningful contrast for the same landmark, so the app never
// asks a child to dismiss an implausible scene before they understand the
// target relation. The renderer reuses a card for understanding, action and
// sentence-completion practice.
export const PREPOSITION_CARDS = [
  {
    id: "prep_ball_box_in",
    skill: "prepositions",
    relation: "in",
    distractorRelations: ["on"],
    object: "ball",
    landmark: "box",
    locatePrompt: "Где мяч? Покажи: в коробке.",
    actionPrompt: "Положи мяч в коробку.",
    resultPhrase: "Мяч в коробке.",
    sentence: "Мяч лежит {blank} коробке.",
    answer: "в",
    label: "Мяч в коробке.",
  },
  {
    id: "prep_cube_box_in",
    skill: "prepositions",
    relation: "in",
    distractorRelations: ["on"],
    object: "cube",
    landmark: "box",
    locatePrompt: "Где кубик? Покажи: в коробке.",
    actionPrompt: "Положи кубик в коробку.",
    resultPhrase: "Кубик в коробке.",
    sentence: "Кубик лежит {blank} коробке.",
    answer: "в",
    label: "Кубик в коробке.",
  },
  {
    id: "prep_book_table_on",
    skill: "prepositions",
    relation: "on",
    distractorRelations: ["under"],
    object: "book",
    landmark: "table",
    locatePrompt: "Где книга? Покажи: на столе.",
    actionPrompt: "Положи книгу на стол.",
    resultPhrase: "Книга на столе.",
    sentence: "Книга лежит {blank} столе.",
    answer: "на",
    label: "Книга на столе.",
  },
  {
    id: "prep_ball_table_on",
    skill: "prepositions",
    relation: "on",
    distractorRelations: ["under"],
    object: "ball",
    landmark: "table",
    locatePrompt: "Где мяч? Покажи: на столе.",
    actionPrompt: "Положи мяч на стол.",
    resultPhrase: "Мяч на столе.",
    sentence: "Мяч лежит {blank} столе.",
    answer: "на",
    label: "Мяч на столе.",
  },
  {
    id: "prep_car_table_under",
    skill: "prepositions",
    relation: "under",
    distractorRelations: ["on"],
    object: "car",
    landmark: "table",
    locatePrompt: "Где машинка? Покажи: под столом.",
    actionPrompt: "Положи машинку под стол.",
    resultPhrase: "Машинка под столом.",
    sentence: "Машинка стоит {blank} столом.",
    answer: "под",
    label: "Машинка под столом.",
  },
  {
    id: "prep_ball_chair_under",
    skill: "prepositions",
    relation: "under",
    distractorRelations: ["on"],
    object: "ball",
    landmark: "chair",
    locatePrompt: "Где мяч? Покажи: под стулом.",
    actionPrompt: "Положи мяч под стул.",
    resultPhrase: "Мяч под стулом.",
    sentence: "Мяч лежит {blank} стулом.",
    answer: "под",
    label: "Мяч под стулом.",
  },
];

export const ALL_CARDS = [
  ...CASE_AGREEMENT_CARDS,
  ...VERB_NUMBER_CARDS,
  ...VERB_GENDER_CARDS,
  ...NUMERAL_AGREEMENT_CARDS,
  ...ADJECTIVE_AGREEMENT_CARDS,
  ...POSSESSIVE_AGREEMENT_CARDS,
  ...PREPOSITION_CARDS,
];
