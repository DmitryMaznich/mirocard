import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const VERSION = "2.3.0";

const manifest = {
  meta: {
    id: "comparison",
    title: { ru: "Сравнение" },
    version: VERSION,
    renderer: "comparison",
    cardType: "procedural",
    about: {
      text: "Тема «Сравнение» обучает ребёнка понимать отношения больше, меньше и равно. Занятия выстроены по лестнице сложности: от наглядного сравнения кружков до самостоятельной постановки знака между числами.",
      tips: [
        "Начинайте с режима «Где больше?» — ребёнок опирается на зрительный образ, а не на счёт",
        "Переходите к следующему режиму только после уверенного прохождения предыдущего",
        "Крокодил помогает запомнить направление знака: пасть всегда открыта в сторону большего числа",
      ],
    },
  },
  modes: [
    {
      id: "compare_visual",
      type: "compare_visual",
      evaluation: "auto",
      defaultCardId: "compare_easy",
      ui: {
        title: "1. Где больше?",
        instruction: "Нажми на сторону, где больше",
      },
      methodology: {
        text: "Ребёнок сравнивает два набора кружков. Вид можно настроить: только точки или точки с цифрами. Вопрос («больше» или «меньше») тоже выбирается в параметрах. Задача опирается на subitizing — мгновенное восприятие количества без пересчёта.",
        tips: [
          "Начните с режима «Точки» — ребёнок опирается на зрительный образ, а не на счёт",
          "Переключитесь на «Точки + цифра», когда ребёнок уверенно различает количества",
          "Не торопите — пусть смотрит и чувствует разницу",
        ],
        duration: "3–5 минут",
      },
    },
    {
      id: "compare_numbers",
      type: "compare_numbers",
      evaluation: "auto",
      defaultCardId: "compare_medium",
      ui: {
        title: "2. Какое больше?",
        instruction: "Нажми на большее число",
      },
      methodology: {
        text: "Сравнение двух чисел без визуальных подсказок. Ребёнок опирается только на знание числового ряда.",
        tips: [
          "Если ребёнок затрудняется — предложите мысленно нарисовать кружки",
          "Хвалите за правильный выбор, не акцентируйте ошибки",
        ],
        duration: "5–7 минут",
      },
    },
    {
      id: "compare_sign",
      type: "compare_sign",
      evaluation: "auto",
      defaultCardId: "compare_medium",
      ui: {
        title: "3. Крокодил",
        instruction: "Нажми на большее число",
      },
      methodology: {
        text: "Знак сравнения показан как «пасть крокодила» — она всегда открыта в сторону большего числа. Метафора помогает ребёнку запомнить направление знака.",
        tips: [
          "Объясните правило крокодила: «Он всегда кушает большее»",
          "После нескольких занятий ребёнок начнёт предсказывать направление пасти сам",
        ],
        duration: "5–7 минут",
      },
    },
    {
      id: "compare_first_number",
      type: "compare_first_number",
      evaluation: "auto",
      defaultCardId: "compare_medium",
      ui: {
        title: "4. Первое число",
        instruction: "Первое число — больше, меньше или равно второму?",
      },
      methodology: {
        text: "Ребёнок оценивает первое число относительно второго. Задача тренирует направленное мышление: не «какое из двух больше», а «чем является первое по отношению к второму». Это ключевой навык для понимания числового ряда и работы с выражениями типа 3 < 7.",
        tips: [
          "Учите читать задание слева направо: «Число 3… по отношению к 7… — меньше»",
          "После ответа произнесите полную фразу вслух: «Три меньше семи»",
          "Если ребёнок затрудняется — предложите вспомнить числовой ряд и найти оба числа на нём",
        ],
        duration: "5–8 минут",
      },
    },
    {
      id: "compare_put_sign",
      type: "compare_put_sign",
      evaluation: "auto",
      defaultCardId: "compare_hard",
      ui: {
        title: "5. Поставь знак",
        instruction: "Поставь правильный знак между числами",
      },
      methodology: {
        text: "Финальный уровень: ребёнок самостоятельно выбирает и ставит знак между числами. Проверка полного понимания сравнения.",
        tips: [
          "Это самый сложный режим — используйте его только после уверенного прохождения предыдущих",
          "Хвалите за каждую верную постановку знака",
        ],
        duration: "5–10 минут",
      },
    },
    {
      id: "compare_draw_sign",
      type: "compare_draw_sign",
      evaluation: "auto",
      defaultCardId: "compare_hard",
      ui: {
        title: "6. Нарисуй знак",
        instruction: "Нарисуй правильный знак пальцем",
      },
      methodology: {
        text: "Ребёнок рисует знак пальцем на экране. Моторная активность укрепляет связь между символом и его значением.",
        tips: [
          "Покажите правильное написание знака перед началом",
          "Не требуйте точности рисунка — важна правильная форма (угол в нужную сторону)",
        ],
        duration: "5–10 минут",
      },
    },
  ],
  cards: [
    {
      id: "compare_easy",
      conceptId: "compare_easy",
      primary: true,
      label: "Много / мало (1–10, разница ≥3)",
      params: { min: 1, max: 10, minDiff: 3, allowEqual: false },
    },
    {
      id: "compare_medium",
      conceptId: "compare_medium",
      primary: true,
      label: "Числа 1–10",
      params: { min: 1, max: 10, minDiff: 1, allowEqual: false },
    },
    {
      id: "compare_hard",
      conceptId: "compare_hard",
      primary: true,
      label: "Числа 1–20 с равными",
      params: { min: 1, max: 20, minDiff: 1, allowEqual: true },
    },
  ],
};

const zip = new JSZip();
zip.file("deck.json", JSON.stringify(manifest, null, 2));

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const outPath = `public/decks/comparison_v${VERSION}.zip`;
writeFileSync(outPath, buffer);
console.log(`✓ ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
