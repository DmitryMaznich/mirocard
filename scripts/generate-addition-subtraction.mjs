import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const manifest = {
  meta: {
    id: "addition_subtraction",
    version: "1.2.0",
    minAppVersion: "1.0.2",
    language: "ru",
    cardType: "procedural",
    renderer: "addition_subtraction",
    title: { ru: "Плюс и минус", en: "Addition and Subtraction" },
    description: {
      ru: "Педагогическая лестница: от наблюдения и манипуляций с фишками — к знаку, примеру и цепочкам.",
      en: "A teaching ladder: from observation and object manipulation to signs, expressions, and chains.",
    },
    about: {
      ru: [
        "Тема учит не только считать, а понимать смысл операций: прибавить — стало больше, убрать — стало меньше.",
        "Сначала ребёнок выполняет действие с фишками на палке, затем связывает знак со словом действия, потом находит пропущенный знак в примере и вычисляет результат.",
        "Седьмой режим — цепочки из двух действий (A ± B ± C = ?) для закрепления навыка на более сложном материале.",
        "Рекомендуемый старт: диапазон до 5, изменение на 1 фишку, без нуля.",
      ],
      en: [
        "This topic teaches the meaning of operations before computation.",
      ],
    },
    conceptCount: 2,
    sessionConfig: { maxSize: 12 },
  },
  modes: [
    {
      id: "operation_observe",
      type: "operation_observe",
      evaluation: "auto",
      defaultCardId: "operation_plus",
      ui: { title: "1. Наблюдение (скоро)", instruction: "Смотрим, как меняется количество" },
      methodology: {
        text: "Первая ступень: ребёнок наблюдает за действием — специалист показывает добавление или убирание предметов. Цель — сформировать зрительный образ операции до того, как ребёнок будет выполнять её самостоятельно.",
        tips: [
          "Используйте реальные предметы параллельно с экраном: кубики, фишки, пуговицы.",
          "Называйте действие вслух: «Добавляю одну — стало три».",
        ],
        duration: "2–3 мин",
      },
    },
    {
      id: "operation_name_action",
      type: "operation_name_action",
      evaluation: "auto",
      defaultCardId: "operation_plus",
      ui: { title: "2. Назови действие (скоро)", instruction: "Что сделали с предметами?" },
      methodology: {
        text: "Вторая ступень: ребёнок называет, что произошло — «прибавили» или «убрали». Рецептивное понимание действия закрепляется до выражения через знак.",
        tips: [
          "Сначала предлагайте два явно разных примера: один на добавление, один на убирание.",
          "Используйте жест: открытая ладонь к себе — «прибавили», ладонь от себя — «убрали».",
        ],
        duration: "2–4 мин",
      },
    },
    {
      id: "operation_do_action",
      type: "operation_do_action",
      evaluation: "auto",
      defaultCardId: "operation_plus",
      ui: { title: "3. Сделай действие", instruction: "Покажи на палке и назови результат" },
      params: {
        maxNumber: { type: "enum", values: [5, 10, 20], labels: { ru: { "5": "до 5", "10": "до 10", "20": "до 20" } }, default: 5, label: { ru: "Максимальное число" } },
        changeMax: { type: "enum", values: [1, 3, 5, 10, 99], labels: { ru: { "1": "1", "3": "3", "5": "5", "10": "10", "99": "любое" } }, default: 1, label: { ru: "Максимальное изменение" } },
        includeZero: { type: "boolean", default: false, label: { ru: "Включить ноль" } },
        showInstruction: { type: "boolean", default: true, label: { ru: "Показывать инструкции" } },
      },
      methodology: {
        text: "Третья ступень: ребёнок выполняет действие на счётной палке — перемещает фишки и называет результат. Манипуляция с объектом закрепляет связь между физическим действием и арифметической операцией.",
        tips: [
          "Начинайте с +1 и -1 при maxNumber = 5.",
          "Обязательно называйте действие вслух вместе с ребёнком: «Прибавляем два — двигаем две фишки».",
          "Если ребёнок делает ошибку при перемещении фишек, замедлитесь и сделайте действие вместе.",
          "Постепенно увеличивайте changeMax, когда ребёнок уверен в +1/−1.",
        ],
        duration: "5–8 мин",
      },
    },
    {
      id: "operation_action_from_sign",
      type: "operation_action_from_sign",
      evaluation: "auto",
      defaultCardId: "operation_plus",
      ui: { title: "4. Знак ↔ Действие", instruction: "Связываем знак со словом действия" },
      params: {
        direction: {
          type: "enum",
          values: ["alternating", "sign_to_action", "action_to_sign", "random"],
          labels: { ru: { alternating: "Чередование", sign_to_action: "Знак → Слово", action_to_sign: "Слово → Знак", random: "Случайно" } },
          default: "alternating",
          label: { ru: "Направление" },
        },
      },
      methodology: {
        text: "Четвёртая ступень: ребёнок связывает математический знак со словом действия и обратно. Чередование направлений предотвращает механическое запоминание без понимания.",
        tips: [
          "Начинайте с направления «Знак → Слово»: покажите + и спросите «Что делаем?».",
          "Обратное направление «Слово → Знак» сложнее — вводите после уверенного освоения прямого.",
          "Используйте карточки-подсказки в начале: рядом со знаком изображение действия.",
          "Чередование — основной режим тренировки после освоения обоих направлений.",
        ],
        duration: "3–5 мин",
      },
    },
    {
      id: "operation_find_sign",
      type: "operation_find_sign",
      evaluation: "auto",
      defaultCardId: "operation_plus",
      ui: { title: "5. Найди знак", instruction: "Какой знак пропущен в примере?" },
      params: {
        maxNumber: { type: "enum", values: [5, 10, 20], labels: { ru: { "5": "до 5", "10": "до 10", "20": "до 20" } }, default: 5, label: { ru: "Максимальное число" } },
        changeMax: { type: "enum", values: [1, 3, 5, 10, 99], labels: { ru: { "1": "1", "3": "3", "5": "5", "10": "10", "99": "любое" } }, default: 3, label: { ru: "Максимальное изменение" } },
        includeZero: { type: "boolean", default: false, label: { ru: "Включить ноль" } },
        showHelper: { type: "boolean", default: false, label: { ru: "Кнопка счётного помощника" } },
      },
      methodology: {
        text: "Пятая ступень: ребёнок видит полный пример с пропущенным знаком и выбирает + или −. Задача требует понимания направления изменения через числа.",
        tips: [
          "Объясните стратегию: «Смотрим на первое и последнее число — стало больше или меньше?»",
          "Счётный помощник (🧮) ребёнок вызывает сам — это учит самостоятельно обращаться за поддержкой.",
          "Включайте showHelper на начальном этапе, постепенно уберите по мере уверенности.",
          "При ошибках называйте стратегию вслух, не указывая правильный ответ сразу.",
        ],
        duration: "4–6 мин",
      },
    },
    {
      id: "operation_result",
      type: "operation_result",
      evaluation: "auto",
      defaultCardId: "operation_plus",
      ui: { title: "6. Сколько стало?", instruction: "Вычисли результат примера" },
      params: {
        maxNumber: { type: "enum", values: [5, 10, 20], labels: { ru: { "5": "до 5", "10": "до 10", "20": "до 20" } }, default: 5, label: { ru: "Максимальное число" } },
        changeMax: { type: "enum", values: [1, 3, 5, 10, 99], labels: { ru: { "1": "1", "3": "3", "5": "5", "10": "10", "99": "любое" } }, default: 3, label: { ru: "Максимальное изменение" } },
        includeZero: { type: "boolean", default: false, label: { ru: "Включить ноль" } },
        inputMode: {
          type: "enum",
          values: ["choices", "pad"],
          labels: { ru: { choices: "Варианты ответа", pad: "Числовая клавиатура" } },
          default: "choices",
          label: { ru: "Тип ввода" },
        },
        timer: { type: "number", min: 0, max: 60, default: 0, label: { ru: "Таймер (сек, 0 = выкл)" } },
        showHelper: { type: "boolean", default: false, label: { ru: "Кнопка счётного помощника" } },
      },
      methodology: {
        text: "Шестая ступень: ребёнок вычисляет результат полного примера. Варианты ответа снижают нагрузку; числовая клавиатура требует точного воспроизведения. Таймер добавляет элемент автоматизации.",
        tips: [
          "Начинайте с вариантов ответа (choices) — меньше когнитивная нагрузка.",
          "Числовую клавиатуру вводите после уверенного освоения вариантов.",
          "Таймер применяйте только когда ребёнок устойчиво отвечает правильно без давления времени.",
          "Счётный помощник (🧮) помогает при затруднении, но не показывает ответ — это важно.",
        ],
        duration: "5–8 мин",
      },
    },
    {
      id: "operation_chain",
      type: "operation_chain",
      evaluation: "auto",
      defaultCardId: "operation_plus",
      ui: { title: "7. Цепочка", instruction: "Посчитай пример из двух действий" },
      params: {
        maxNumber: { type: "enum", values: [5, 10, 20], labels: { ru: { "5": "до 5", "10": "до 10", "20": "до 20" } }, default: 10, label: { ru: "Максимальное число" } },
        changeMax: { type: "enum", values: [1, 3, 5, 10, 99], labels: { ru: { "1": "1", "3": "3", "5": "5", "10": "10", "99": "любое" } }, default: 3, label: { ru: "Максимальное изменение" } },
        includeZero: { type: "boolean", default: false, label: { ru: "Включить ноль" } },
        inputMode: {
          type: "enum",
          values: ["choices", "pad"],
          labels: { ru: { choices: "Варианты ответа", pad: "Числовая клавиатура" } },
          default: "choices",
          label: { ru: "Тип ввода" },
        },
        timer: { type: "number", min: 0, max: 60, default: 0, label: { ru: "Таймер (сек, 0 = выкл)" } },
        showHelper: { type: "boolean", default: false, label: { ru: "Кнопка счётного помощника" } },
      },
      methodology: {
        text: "Седьмая ступень: пример из двух последовательных операций (A ± B ± C = ?). Требует удержания промежуточного результата в рабочей памяти. Высший уровень автоматизации счёта.",
        tips: [
          "Учите стратегию вслух: «Сначала считаем первую часть, запоминаем, потом считаем дальше».",
          "Начинайте с maxNumber=10 и changeMax=1 — маленькие изменения снижают ошибки.",
          "Счётный помощник (🧮) помогает удержать промежуточный результат.",
          "Таймер включайте только на этапе закрепления, когда ошибок почти нет.",
        ],
        duration: "5–10 мин",
      },
    },
  ],
  cards: [
    {
      id: "operation_plus",
      conceptId: "plus",
      primary: true,
      label: "Плюс",
      renderer: "addition_subtraction",
      params: { operation: "add" },
    },
    {
      id: "operation_minus",
      conceptId: "minus",
      primary: true,
      label: "Минус",
      renderer: "addition_subtraction",
      params: { operation: "subtract" },
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/addition_subtraction_v1.2.0.zip", buffer);
console.log("generated addition_subtraction_v1.2.0.zip");
