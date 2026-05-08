import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const manifest = {
  meta: {
    id: "addition_subtraction",
    version: "1.1.1",
    minAppVersion: "1.0.2",
    language: "ru",
    cardType: "procedural",
    renderer: "addition_subtraction",
    title: { ru: "Плюс и минус", en: "Addition and Subtraction" },
    description: {
      ru: "Педагогическая лестница: быстрая связь знак-действие, фишки на палке, было-стало, больше/меньше, пример и результат.",
      en: "A teaching ladder: object actions, before-after meaning, more/less, action-to-sign mapping, expressions, and result.",
    },
    about: {
      ru: [
        "Тема учит не только считать, а понимать смысл операций: прибавить — стало больше, убрать — стало меньше.",
        "Сначала ребенок коротко закрепляет связь +/− с глаголами прибавить/убрать в обе стороны. Затем выполняет действие с фишками, называет действие, сравнивает было/стало и переходит к записи примера.",
        "Рекомендуемый старт: диапазон до 5, изменение на 1 фишку, без нуля.",
      ],
      en: [
        "This topic teaches the meaning of operations before computation.",
      ],
    },
    conceptCount: 2,
    sessionConfig: { maxSize: 12 },
  },
  modes: [],
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
writeFileSync("public/decks/addition_subtraction_v1.1.1.zip", buffer);
