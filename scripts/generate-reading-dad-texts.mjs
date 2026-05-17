import JSZip from "jszip";
import { writeFileSync } from "node:fs";

const omeletSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background circle -->
  <circle cx="120" cy="120" r="116" fill="#fff9ed" stroke="#f0e4c4" stroke-width="3"/>

  <!-- Plate shadow -->
  <ellipse cx="122" cy="178" rx="68" ry="10" fill="#e0c890" opacity="0.35"/>

  <!-- Plate -->
  <circle cx="120" cy="130" r="72" fill="#fffdf5" stroke="#e8dfc0" stroke-width="2.5"/>
  <circle cx="120" cy="130" r="64" fill="none" stroke="#f5edda" stroke-width="1.5"/>

  <!-- Omelet body (base) -->
  <ellipse cx="120" cy="146" rx="54" ry="20" fill="#f0b820"/>

  <!-- Omelet dome (fold) -->
  <path d="M 66 146 Q 70 94 120 92 Q 170 94 174 146 Z" fill="#f5c830"/>

  <!-- Omelet highlight -->
  <path d="M 78 132 Q 90 104 120 100 Q 150 104 162 132"
        fill="none" stroke="#fde88a" stroke-width="3" stroke-linecap="round" opacity="0.7"/>

  <!-- Omelet edge (browned) -->
  <path d="M 66 146 Q 70 94 120 92 Q 170 94 174 146"
        fill="none" stroke="#d4920a" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>

  <!-- Sausage slice 1 -->
  <circle cx="90" cy="124" r="14" fill="#b83228"/>
  <circle cx="90" cy="124" r="11" fill="#d44840"/>
  <circle cx="90" cy="124" r="6"  fill="#c03830"/>
  <circle cx="87" cy="121" r="2"  fill="#e06050" opacity="0.6"/>

  <!-- Sausage slice 2 -->
  <circle cx="120" cy="116" r="14" fill="#b83228"/>
  <circle cx="120" cy="116" r="11" fill="#d44840"/>
  <circle cx="120" cy="116" r="6"  fill="#c03830"/>
  <circle cx="117" cy="113" r="2"  fill="#e06050" opacity="0.6"/>

  <!-- Sausage slice 3 -->
  <circle cx="150" cy="124" r="14" fill="#b83228"/>
  <circle cx="150" cy="124" r="11" fill="#d44840"/>
  <circle cx="150" cy="124" r="6"  fill="#c03830"/>
  <circle cx="147" cy="121" r="2"  fill="#e06050" opacity="0.6"/>

  <!-- Herb specks -->
  <circle cx="104" cy="136" r="2.5" fill="#5a9040" opacity="0.8"/>
  <circle cx="132" cy="133" r="2"   fill="#5a9040" opacity="0.8"/>
  <circle cx="113" cy="141" r="2"   fill="#5a9040" opacity="0.7"/>
  <circle cx="142" cy="138" r="2.5" fill="#5a9040" opacity="0.8"/>
</svg>`;


const mashedPotatoesSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background circle -->
  <circle cx="120" cy="120" r="116" fill="#fdf6e3" stroke="#e8d9b0" stroke-width="3"/>

  <!-- Plate shadow -->
  <ellipse cx="122" cy="182" rx="70" ry="10" fill="#d4b870" opacity="0.3"/>

  <!-- Plate -->
  <circle cx="120" cy="134" r="74" fill="#fffef8" stroke="#e8dfc0" stroke-width="2.5"/>
  <circle cx="120" cy="134" r="66" fill="none" stroke="#f5edda" stroke-width="1.5"/>

  <!-- Mashed potato mound -->
  <ellipse cx="120" cy="152" rx="52" ry="16" fill="#e8d89a"/>
  <path d="M 68 152 Q 72 100 120 96 Q 168 100 172 152 Z" fill="#f0e4b0"/>

  <!-- Mound highlight -->
  <path d="M 82 138 Q 98 110 120 106 Q 142 110 158 138"
        fill="none" stroke="#fdf5d0" stroke-width="4" stroke-linecap="round" opacity="0.7"/>

  <!-- Mound shading left -->
  <path d="M 68 152 Q 72 124 86 112" fill="none" stroke="#d4b870" stroke-width="2" opacity="0.4"/>

  <!-- Butter pat -->
  <rect x="106" y="102" width="28" height="16" rx="3" fill="#f5c830" opacity="0.9"/>
  <rect x="106" y="102" width="28" height="16" rx="3" fill="none" stroke="#d4a020" stroke-width="1" opacity="0.5"/>

  <!-- Melting butter drips -->
  <path d="M 110 118 Q 108 128 106 134" fill="none" stroke="#f0b820" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>
  <path d="M 130 118 Q 132 128 134 136" fill="none" stroke="#f0b820" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>

  <!-- Steam wisps -->
  <path d="M 100 90 Q 96 78 100 68" fill="none" stroke="#c8b888" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  <path d="M 120 86 Q 116 74 120 62" fill="none" stroke="#c8b888" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  <path d="M 140 90 Q 144 78 140 68" fill="none" stroke="#c8b888" stroke-width="2" stroke-linecap="round" opacity="0.45"/>

  <!-- Herb specks (parsley) -->
  <circle cx="96"  cy="140" r="2.5" fill="#4a8030" opacity="0.75"/>
  <circle cx="144" cy="138" r="2"   fill="#4a8030" opacity="0.75"/>
  <circle cx="118" cy="148" r="2"   fill="#4a8030" opacity="0.7"/>
  <circle cx="108" cy="144" r="1.5" fill="#4a8030" opacity="0.65"/>
</svg>`;

const omeletTxt = `\
Готовим омлет

1. Вымой руки.
2. Достань нужную посуду:
- сковородку
- лопатку
- миску
- вилку
- тарелку
- доску
- нож
3. Достань продукты:
- 2 яйца
- колбасу
- соль
- масло
4. Поставь сковородку на плиту.
5. Нарежь колбасу кружочками на доске.
6. Разбей два яйца в миску.
7. Добавь щепотку соли.
8. Взбей яйца вилкой.
9. Включи плиту на 10.
10. Растопи масло на сковороде.
11. Положи колбасу на сковородку.
12. Перемешай колбасу лопаткой.
13. Немного подожди.
14. Вылей яйца на колбасу.
15. Убавь нагрев до 6.
16. Смотри, чтобы омлет не сгорел.
17. Подвинь омлет лопаткой.
18. Немного подожди.
19. Сложи омлет пополам лопаткой.
20. Аккуратно переверни омлет.
21. Немного подожди.
22. Выключи плиту.
23. Переложи омлет на тарелку и поставь тарелку на стол.
24. Поставь сковородку обратно на плиту.
25. Убери колбасу в холодильник.
26. Положи грязную посуду в раковину, а мусор выброси в мусорку.
27. Достань нож и вилку и положи возле тарелки с омлетом.
28. Можно завтракать!
`;

const mashedPotatoesTxt = `\
Готовим картофельное пюре

1. Вымой руки.
2. Достань нужную посуду:
- кастрюлю
- овощечистку
- нож
- доску
- толкушку
- дуршлаг
- ложку
- тарелку
3. Достань продукты:
- 4 большие картошки
- масло
- молоко
- соль
4. Помой картошку в раковине.
5. Почисти картошку овощечисткой.
6. Нарежь каждую картошку на 4 части.
7. Положи картошку в кастрюлю.
8. Залей картошку водой — вода должна покрывать картошку.
9. Добавь в воду 2 щепотки соли.
10. Поставь кастрюлю на плиту.
11. Включи плиту на 10.
12. Подожди, пока вода закипит.
13. Убавь нагрев до 6.
14. Вари картошку 20 минут.
15. Проткни картошку вилкой — если мягкая, готова.
16. Выключи плиту.
17. Осторожно слей воду через дуршлаг.
18. Верни картошку обратно в кастрюлю.
19. Добавь кусочек масла — размером с большой палец.
20. Разомни картошку толкушкой.
21. Влей полстакана молока.
22. Взбей пюре толкушкой до гладкости.
23. Попробуй пюре.
24. Добавь соли, если нужно.
25. Положи пюре на тарелку.
26. Убери молоко и масло в холодильник.
27. Положи грязную посуду в раковину, а мусор выброси в мусорку.
28. Можно есть!
`;

const manifest = {
  meta: {
    id: "reading_dad_texts",
    version: "1.13.0",
    minAppVersion: "1.0.2",
    language: "ru",
    renderer: "reading",
    avatar: "media/omelet.svg",
    title: { ru: "Чтение. Готовим еду", en: "Reading: Cooking" },
    description: {
      ru: "Пошаговые инструкции для самостоятельных действий.",
      en: "Step-by-step instructions for independent tasks.",
    },
    about: {
      ru: ["Тема предназначена для работы логопеда с ребёнком."],
      en: ["Designed for therapist-led sessions."],
    },
    conceptCount: 2,
    sessionConfig: { maxSize: 8 },
  },
  modes: [],
  cards: [],
  texts: [
    {
      id: "omelet_instruction",
      kind: "instruction",
      title: { ru: "Готовим омлет", en: "Cooking: Omelette" },
      image: "media/omelet.svg",
      file: "recipes/omelet.txt",
      stepCount: 28,
    },
    {
      id: "mashed_potatoes_instruction",
      kind: "instruction",
      title: { ru: "Готовим картофельное пюре", en: "Cooking: Mashed Potatoes" },
      image: "media/mashed_potatoes.svg",
      file: "recipes/mashed_potatoes.txt",
      stepCount: 28,
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/omelet.svg", omeletSvg);
zip.file("media/mashed_potatoes.svg", mashedPotatoesSvg);
zip.file("recipes/omelet.txt", omeletTxt);
zip.file("recipes/mashed_potatoes.txt", mashedPotatoesTxt);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_texts_v1.13.0.zip", buffer);
