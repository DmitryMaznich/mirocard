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

const pastaTxt = `\
Готовим макароны с маслом и сыром

1. Вымой руки.
2. Достань нужную посуду:
- кастрюлю
- дуршлаг
- ложку
- тёрку
- тарелку
3. Достань продукты:
- 2 горсти макарон
- масло
- сыр
- соль
4. Налей воды в кастрюлю — примерно наполовину.
5. Поставь кастрюлю на плиту.
6. Включи плиту на 10.
7. Подожди, пока вода закипит.
8. Добавь щепотку соли.
9. Всыпь макароны в кипящую воду.
10. Убавь нагрев до 6.
11. Вари макароны 8 минут — помешивай иногда ложкой.
12. Проверь: попробуй одну макаронину — она должна быть мягкой.
13. Выключи плиту.
14. Осторожно слей воду через дуршлаг.
15. Верни макароны обратно в кастрюлю.
16. Добавь кусочек масла.
17. Перемешай ложкой.
18. Натри сыр на тёрке.
19. Положи макароны на тарелку.
20. Посыпь сыром сверху.
21. Убери сыр в холодильник.
22. Положи грязную посуду в раковину, а мусор выброси в мусорку.
23. Можно есть!
`;

const friedEggsTxt = `\
Готовим яичницу-глазунью

1. Вымой руки.
2. Достань нужную посуду:
- сковородку
- лопатку
- тарелку
3. Достань продукты:
- 2 яйца
- масло
- соль
4. Поставь сковородку на плиту.
5. Включи плиту на 8.
6. Положи кусочек масла на сковородку.
7. Подожди, пока масло растает.
8. Осторожно разбей первое яйцо о край сковородки.
9. Вылей яйцо на сковородку — не задень желток.
10. Осторожно разбей второе яйцо и вылей рядом.
11. Посоли яйца.
12. Смотри, чтобы белок стал белым.
13. Немного подожди.
14. Когда белок полностью белый — яичница готова.
15. Выключи плиту.
16. Переложи яичницу лопаткой на тарелку.
17. Поставь сковородку обратно на плиту.
18. Положи грязную посуду в раковину, а мусор выброси в мусорку.
19. Можно завтракать!
`;

const oatmealTxt = `\
Готовим овсяную кашу на молоке

1. Вымой руки.
2. Достань нужную посуду:
- кастрюлю
- ложку
- тарелку
- стакан
3. Достань продукты:
- 1 стакан овсяных хлопьев
- 2 стакана молока
- соль
- сахар
- масло
4. Налей молоко в кастрюлю.
5. Поставь кастрюлю на плиту.
6. Включи плиту на 8.
7. Подожди, пока молоко начнёт закипать — смотри внимательно.
8. Добавь щепотку соли и чайную ложку сахара.
9. Всыпь овсяные хлопья и сразу помешай ложкой.
10. Убавь нагрев до 4.
11. Вари кашу 5 минут — постоянно помешивай, чтобы не пригорела.
12. Выключи плиту.
13. Добавь кусочек масла и перемешай.
14. Положи кашу в тарелку.
15. Убери молоко в холодильник.
16. Положи грязную посуду в раковину, а мусор выброси в мусорку.
17. Можно завтракать!
`;

const saladTxt = `\
Готовим салат из огурцов и помидоров

1. Вымой руки.
2. Достань нужную посуду:
- доску
- нож
- миску
- ложку
- тарелку
3. Достань продукты:
- 2 огурца
- 2 помидора
- соль
- растительное масло
4. Помой огурцы и помидоры под водой.
5. Положи огурец на доску и нарежь кружочками.
6. Положи кружочки в миску.
7. Положи помидор на доску и нарежь дольками.
8. Добавь помидоры в миску.
9. Посоли овощи.
10. Полей одной ложкой масла.
11. Перемешай ложкой.
12. Попробуй салат.
13. Добавь соли или масла, если нужно.
14. Положи салат на тарелку.
15. Положи грязную посуду в раковину, а мусор выброси в мусорку.
16. Можно есть!
`;

const chickenTxt = `\
Готовим курицу в сливочном соусе

1. Вымой руки.
2. Достань нужную посуду:
- сковородку
- доску
- нож
- лопатку
- ложку
- тарелку
3. Достань продукты:
- 2 куриных филе
- сливки
- масло
- соль
- чеснок
4. Положи куриное филе на доску.
5. Нарежь курицу небольшими кусочками.
6. Поставь сковородку на плиту.
7. Включи плиту на 8.
8. Положи кусочек масла на сковородку.
9. Подожди, пока масло растает.
10. Выложи курицу на сковородку.
11. Обжарь курицу с одной стороны 3 минуты — не трогай.
12. Переверни кусочки лопаткой.
13. Обжарь ещё 3 минуты.
14. Убавь нагрев до 5.
15. Вылей сливки на курицу.
16. Добавь щепотку соли.
17. Помешивай ложкой.
18. Туши курицу в сливках 5 минут — помешивай иногда.
19. Попробуй соус.
20. Добавь соли, если нужно.
21. Выключи плиту.
22. Положи курицу с соусом на тарелку.
23. Положи грязную посуду в раковину, а мусор выброси в мусорку.
24. Можно есть!
`;

const syrnikTxt = `\
Готовим сырники

1. Вымой руки.
2. Достань нужную посуду:
- миску
- вилку
- ложку
- доску
- сковородку
- лопатку
- тарелку
3. Достань продукты:
- 250 г творога
- 1 яйцо
- 2 ложки сахара
- щепотку соли
- 3 ложки муки
- масло для жарки
4. Положи творог в миску.
5. Разомни творог вилкой до однородности.
6. Вбей яйцо в миску к творогу.
7. Всыпь сахар и соль.
8. Перемешай вилкой.
9. Добавь 2 ложки муки.
10. Замеси тесто ложкой — оно должно быть мягким, но не липнуть к рукам.
11. Насыпь оставшуюся муку на доску.
12. Возьми одну ложку теста и положи на муку.
13. Слепи из теста круглую лепёшку.
14. Обваляй лепёшку в муке с двух сторон.
15. Отложи на край доски.
16. Повтори шаги 12–15 с остальным тестом.
17. Поставь сковородку на плиту.
18. Включи плиту на 6.
19. Добавь масло на сковородку.
20. Подожди, пока масло нагреется.
21. Выложи сырники на сковородку.
22. Обжарь 3 минуты до золотистого цвета.
23. Переверни сырники лопаткой.
24. Обжарь ещё 3 минуты.
25. Выключи плиту.
26. Переложи сырники на тарелку.
27. Положи грязную посуду в раковину, а мусор выброси в мусорку.
28. Можно завтракать!
`;

const teaTxt = `\
Готовим чай с мёдом

1. Вымой руки.
2. Достань нужную посуду:
- чайник
- кружку
- ложку
3. Достань продукты:
- чайный пакетик
- мёд
4. Налей воды в чайник.
5. Вскипяти воду в чайнике.
6. Положи чайный пакетик в кружку.
7. Осторожно залей кипяток в кружку.
8. Подожди 3 минуты, пока чай заварится.
9. Достань пакетик ложкой и выброси в мусорку.
10. Подожди ещё немного, пока чай немного остынет.
11. Добавь чайную ложку мёда.
12. Размешай мёд ложкой.
13. Попробуй чай.
14. Добавь ещё мёда, если нужно.
15. Убери мёд на место.
16. Можно пить!
`;

const cocoaTxt = `\
Готовим какао

1. Вымой руки.
2. Достань нужную посуду:
- кастрюлю
- ложку
- кружку
- стакан
3. Достань продукты:
- 2 стакана молока
- 2 чайные ложки какао-порошка
- 2 чайные ложки сахара
4. Налей молоко в кастрюлю.
5. Поставь кастрюлю на плиту.
6. Включи плиту на 6.
7. Всыпь какао-порошок в молоко.
8. Добавь сахар.
9. Начни помешивать ложкой.
10. Помешивай постоянно — не отходи от плиты.
11. Доведи какао почти до кипения — когда появятся пузырьки по краям.
12. Не давай кипеть — сразу выключи плиту.
13. Разлей какао по кружкам.
14. Подожди немного, пока остынет.
15. Положи грязную посуду в раковину, а мусор выброси в мусорку.
16. Можно пить!
`;

const kompotTxt = `\
Готовим компот из ягод

1. Вымой руки.
2. Достань нужную посуду:
- кастрюлю
- ложку
- дуршлаг или сито
- кружку или стакан
3. Достань продукты:
- 2 горсти ягод (свежих или замороженных)
- сахар
- воду
4. Промой ягоды под водой в дуршлаге.
5. Залей кастрюлю водой — примерно 1 литр.
6. Поставь кастрюлю на плиту.
7. Включи плиту на 10.
8. Подожди, пока вода закипит.
9. Всыпь ягоды в кипящую воду.
10. Добавь 3 ложки сахара.
11. Перемешай ложкой.
12. Убавь нагрев до 5.
13. Вари компот 10 минут.
14. Попробуй — добавь сахара, если нужно.
15. Выключи плиту.
16. Подожди, пока компот остынет.
17. Процеди компот через сито в другую ёмкость.
18. Разлей компот по стаканам.
19. Положи грязную посуду в раковину, а мусор выброси в мусорку.
20. Можно пить!
`;

const lemonadeTxt = `\
Готовим лимонад

1. Вымой руки.
2. Достань нужную посуду:
- нож
- доску
- соковыжималку или вилку
- сито
- кувшин или кастрюлю
- ложку
- стакан
3. Достань продукты:
- 2 лимона
- сахар
- воду
4. Помой лимоны под водой.
5. Разрежь каждый лимон пополам на доске.
6. Выжми сок из каждой половинки.
7. Процеди сок через сито в кувшин — чтобы убрать косточки.
8. Добавь 3 ложки сахара.
9. Налей стакан воды.
10. Перемешай ложкой до растворения сахара.
11. Попробуй лимонад.
12. Добавь сахара или воды, если нужно.
13. Добавь ещё воды по вкусу.
14. Разлей лимонад по стаканам.
15. Положи грязную посуду в раковину, а мусор выброси в мусорку.
16. Можно пить!
`;

// ─── SVG illustrations ───────────────────────────────────────────────────────

const pastaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#fffbf0" stroke="#e8d9b0" stroke-width="3"/>
  <!-- Plate shadow -->
  <ellipse cx="122" cy="182" rx="70" ry="10" fill="#d4b870" opacity="0.3"/>
  <!-- Plate -->
  <circle cx="120" cy="134" r="74" fill="#fffef8" stroke="#e8dfc0" stroke-width="2.5"/>
  <circle cx="120" cy="134" r="66" fill="none" stroke="#f5edda" stroke-width="1.5"/>
  <!-- Pasta nest -->
  <ellipse cx="120" cy="154" rx="52" ry="14" fill="#f5d88a"/>
  <!-- Pasta strands -->
  <path d="M 80 140 Q 100 120 120 138 Q 140 120 160 140" fill="none" stroke="#e8c060" stroke-width="4" stroke-linecap="round"/>
  <path d="M 78 148 Q 98 128 118 146 Q 138 128 158 148" fill="none" stroke="#e8c060" stroke-width="4" stroke-linecap="round"/>
  <path d="M 82 156 Q 102 136 122 154 Q 142 136 162 156" fill="none" stroke="#e8c060" stroke-width="4" stroke-linecap="round"/>
  <!-- Butter pat -->
  <rect x="108" y="118" width="24" height="14" rx="3" fill="#f5c830" opacity="0.9"/>
  <!-- Cheese -->
  <circle cx="96" cy="142" r="4" fill="#f0e0a0" opacity="0.9"/>
  <circle cx="144" cy="138" r="3.5" fill="#f0e0a0" opacity="0.9"/>
  <circle cx="118" cy="150" r="3" fill="#f0e0a0" opacity="0.8"/>
  <circle cx="130" cy="145" r="2.5" fill="#f0e0a0" opacity="0.8"/>
</svg>`;

const friedEggsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#fff9ed" stroke="#f0e4c4" stroke-width="3"/>
  <!-- Plate shadow -->
  <ellipse cx="122" cy="180" rx="68" ry="10" fill="#e0c890" opacity="0.35"/>
  <!-- Plate -->
  <circle cx="120" cy="132" r="72" fill="#fffdf5" stroke="#e8dfc0" stroke-width="2.5"/>
  <circle cx="120" cy="132" r="64" fill="none" stroke="#f5edda" stroke-width="1.5"/>
  <!-- Egg white 1 -->
  <ellipse cx="100" cy="142" rx="30" ry="18" fill="#fffef8"/>
  <path d="M 72 142 Q 80 122 100 120 Q 120 122 130 142" fill="#fffef8"/>
  <!-- Egg white 2 -->
  <ellipse cx="142" cy="142" rx="28" ry="16" fill="#fffef8"/>
  <path d="M 116 142 Q 124 124 142 122 Q 160 124 168 142" fill="#fffef8"/>
  <!-- Yolk 1 -->
  <circle cx="100" cy="134" r="16" fill="#f5c830"/>
  <circle cx="100" cy="134" r="13" fill="#f0b820"/>
  <circle cx="95" cy="130" r="4" fill="#fde088" opacity="0.6"/>
  <!-- Yolk 2 -->
  <circle cx="142" cy="134" r="15" fill="#f5c830"/>
  <circle cx="142" cy="134" r="12" fill="#f0b820"/>
  <circle cx="137" cy="130" r="3.5" fill="#fde088" opacity="0.6"/>
</svg>`;

const oatmealSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#fdf8f0" stroke="#e8d9b0" stroke-width="3"/>
  <!-- Bowl shadow -->
  <ellipse cx="122" cy="186" rx="66" ry="8" fill="#c8a870" opacity="0.3"/>
  <!-- Bowl -->
  <path d="M 54 130 Q 54 190 120 190 Q 186 190 186 130 Z" fill="#fffef8" stroke="#e8dfc0" stroke-width="2.5"/>
  <ellipse cx="120" cy="130" rx="66" ry="18" fill="#fffef8" stroke="#e8dfc0" stroke-width="2.5"/>
  <!-- Oatmeal surface -->
  <ellipse cx="120" cy="130" rx="58" ry="14" fill="#e8d8a8"/>
  <!-- Oatmeal texture -->
  <ellipse cx="98" cy="128" rx="8" ry="4" fill="#d8c890" opacity="0.6"/>
  <ellipse cx="130" cy="126" rx="7" ry="3" fill="#d8c890" opacity="0.6"/>
  <ellipse cx="114" cy="134" rx="9" ry="3.5" fill="#d8c890" opacity="0.5"/>
  <ellipse cx="146" cy="132" rx="6" ry="3" fill="#d8c890" opacity="0.5"/>
  <!-- Butter -->
  <rect x="108" y="116" width="24" height="14" rx="3" fill="#f5c830" opacity="0.9"/>
  <!-- Steam -->
  <path d="M 96 108 Q 92 96 96 86" fill="none" stroke="#c8b888" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  <path d="M 120 104 Q 116 92 120 80" fill="none" stroke="#c8b888" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  <path d="M 144 108 Q 148 96 144 86" fill="none" stroke="#c8b888" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
</svg>`;

const saladSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#f0f8f0" stroke="#c8dfc0" stroke-width="3"/>
  <!-- Bowl shadow -->
  <ellipse cx="122" cy="186" rx="66" ry="8" fill="#90b890" opacity="0.25"/>
  <!-- Bowl -->
  <path d="M 54 132 Q 54 192 120 192 Q 186 192 186 132 Z" fill="#fffef8" stroke="#d8e8d0" stroke-width="2.5"/>
  <ellipse cx="120" cy="132" rx="66" ry="18" fill="#fffef8" stroke="#d8e8d0" stroke-width="2.5"/>
  <!-- Cucumber slices -->
  <circle cx="94" cy="138" r="14" fill="#78c870"/>
  <circle cx="94" cy="138" r="11" fill="#90d888"/>
  <circle cx="94" cy="138" r="5" fill="#b0e8a0" opacity="0.8"/>
  <circle cx="118" cy="128" r="13" fill="#78c870"/>
  <circle cx="118" cy="128" r="10" fill="#90d888"/>
  <circle cx="118" cy="128" r="4.5" fill="#b0e8a0" opacity="0.8"/>
  <!-- Tomato slices -->
  <circle cx="142" cy="136" r="15" fill="#e84040"/>
  <circle cx="142" cy="136" r="12" fill="#f06060"/>
  <line x1="142" y1="124" x2="142" y2="148" stroke="#e05050" stroke-width="1.5" opacity="0.5"/>
  <line x1="130" y1="136" x2="154" y2="136" stroke="#e05050" stroke-width="1.5" opacity="0.5"/>
  <circle cx="114" cy="148" r="12" fill="#e84040"/>
  <circle cx="114" cy="148" r="9" fill="#f06060"/>
</svg>`;

const chickenSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#fdf6e8" stroke="#e8d0a0" stroke-width="3"/>
  <!-- Plate shadow -->
  <ellipse cx="122" cy="182" rx="70" ry="10" fill="#d4b060" opacity="0.3"/>
  <!-- Plate -->
  <circle cx="120" cy="134" r="74" fill="#fffef8" stroke="#e8dfc0" stroke-width="2.5"/>
  <circle cx="120" cy="134" r="66" fill="none" stroke="#f5edda" stroke-width="1.5"/>
  <!-- Cream sauce pool -->
  <ellipse cx="120" cy="152" rx="54" ry="16" fill="#fdf0d8"/>
  <!-- Chicken pieces -->
  <ellipse cx="96" cy="138" rx="22" ry="14" fill="#e8a050"/>
  <ellipse cx="96" cy="136" rx="20" ry="12" fill="#f0b868"/>
  <ellipse cx="144" cy="140" rx="20" ry="13" fill="#e8a050"/>
  <ellipse cx="144" cy="138" rx="18" ry="11" fill="#f0b868"/>
  <ellipse cx="120" cy="126" rx="18" ry="12" fill="#e8a050"/>
  <ellipse cx="120" cy="124" rx="16" ry="10" fill="#f0b868"/>
  <!-- Sauce drizzle -->
  <path d="M 76 152 Q 100 158 120 155 Q 140 158 164 152" fill="none" stroke="#fde0a0" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
  <!-- Herb -->
  <circle cx="104" cy="148" r="2.5" fill="#4a9040" opacity="0.8"/>
  <circle cx="136" cy="150" r="2" fill="#4a9040" opacity="0.8"/>
  <circle cx="120" cy="153" r="2" fill="#4a9040" opacity="0.7"/>
</svg>`;

const syrnikSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#fffbf0" stroke="#e8d9b0" stroke-width="3"/>
  <!-- Plate shadow -->
  <ellipse cx="122" cy="184" rx="70" ry="9" fill="#d4b870" opacity="0.3"/>
  <!-- Plate -->
  <circle cx="120" cy="136" r="74" fill="#fffef8" stroke="#e8dfc0" stroke-width="2.5"/>
  <circle cx="120" cy="136" r="66" fill="none" stroke="#f5edda" stroke-width="1.5"/>
  <!-- Syrniki (3 pieces) -->
  <ellipse cx="96" cy="148" rx="22" ry="14" fill="#d4882a"/>
  <ellipse cx="96" cy="145" rx="20" ry="12" fill="#e8a040"/>
  <ellipse cx="96" cy="144" rx="17" ry="9" fill="#f0b858" opacity="0.8"/>
  <ellipse cx="142" cy="150" rx="21" ry="13" fill="#d4882a"/>
  <ellipse cx="142" cy="147" rx="19" ry="11" fill="#e8a040"/>
  <ellipse cx="142" cy="146" rx="16" ry="8" fill="#f0b858" opacity="0.8"/>
  <ellipse cx="120" cy="130" rx="22" ry="14" fill="#d4882a"/>
  <ellipse cx="120" cy="127" rx="20" ry="12" fill="#e8a040"/>
  <ellipse cx="120" cy="126" rx="17" ry="9" fill="#f0b858" opacity="0.8"/>
  <!-- Sour cream dollop -->
  <ellipse cx="120" cy="148" rx="14" ry="8" fill="#fffdf0" opacity="0.9"/>
</svg>`;

const teaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#fff8f0" stroke="#e8d0b0" stroke-width="3"/>
  <!-- Saucer -->
  <ellipse cx="120" cy="178" rx="64" ry="12" fill="#fffef8" stroke="#e8dfc0" stroke-width="2"/>
  <!-- Cup body -->
  <path d="M 76 110 L 82 172 Q 120 180 158 172 L 164 110 Z" fill="#fffef8" stroke="#e8dfc0" stroke-width="2.5"/>
  <!-- Tea liquid -->
  <path d="M 80 130 L 83 168 Q 120 176 157 168 L 160 130 Z" fill="#d4784a" opacity="0.7"/>
  <!-- Cup rim -->
  <ellipse cx="120" cy="110" rx="44" ry="10" fill="#fffef8" stroke="#e8dfc0" stroke-width="2.5"/>
  <!-- Tea surface -->
  <ellipse cx="120" cy="130" rx="40" ry="8" fill="#c86838" opacity="0.5"/>
  <!-- Handle -->
  <path d="M 164 122 Q 190 122 190 148 Q 190 168 164 164" fill="none" stroke="#e8dfc0" stroke-width="6" stroke-linecap="round"/>
  <!-- Steam -->
  <path d="M 104 100 Q 100 88 104 78" fill="none" stroke="#c8a888" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <path d="M 120 96 Q 116 84 120 72" fill="none" stroke="#c8a888" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <path d="M 136 100 Q 140 88 136 78" fill="none" stroke="#c8a888" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
</svg>`;

const cocoaSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#f8f0e8" stroke="#d4b888" stroke-width="3"/>
  <!-- Saucer -->
  <ellipse cx="120" cy="178" rx="64" ry="12" fill="#fffef8" stroke="#e8dfc0" stroke-width="2"/>
  <!-- Cup body -->
  <path d="M 76 110 L 82 172 Q 120 180 158 172 L 164 110 Z" fill="#fffef8" stroke="#d8c0a0" stroke-width="2.5"/>
  <!-- Cocoa liquid -->
  <path d="M 80 128 L 83 168 Q 120 176 157 168 L 160 128 Z" fill="#6b3820" opacity="0.8"/>
  <!-- Cup rim -->
  <ellipse cx="120" cy="110" rx="44" ry="10" fill="#fffef8" stroke="#d8c0a0" stroke-width="2.5"/>
  <!-- Cocoa surface -->
  <ellipse cx="120" cy="128" rx="40" ry="8" fill="#5a2e18" opacity="0.6"/>
  <!-- Foam -->
  <ellipse cx="110" cy="126" rx="10" ry="5" fill="#d4a880" opacity="0.5"/>
  <ellipse cx="132" cy="124" rx="9" ry="4" fill="#d4a880" opacity="0.4"/>
  <!-- Handle -->
  <path d="M 164 122 Q 190 122 190 148 Q 190 168 164 164" fill="none" stroke="#d8c0a0" stroke-width="6" stroke-linecap="round"/>
  <!-- Steam -->
  <path d="M 104 100 Q 100 88 104 78" fill="none" stroke="#a08878" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <path d="M 120 96 Q 116 84 120 72" fill="none" stroke="#a08878" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <path d="M 136 100 Q 140 88 136 78" fill="none" stroke="#a08878" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
</svg>`;

const kompotSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#fdf0f8" stroke="#e0b8d0" stroke-width="3"/>
  <!-- Glass body -->
  <path d="M 84 86 L 90 186 Q 120 194 150 186 L 156 86 Z" fill="#e8f0f8" stroke="#c0d0e0" stroke-width="2" opacity="0.8"/>
  <!-- Kompot liquid -->
  <path d="M 86 104 L 90 184 Q 120 192 150 184 L 154 104 Z" fill="#c050a0" opacity="0.4"/>
  <!-- Glass rim -->
  <ellipse cx="120" cy="86" rx="36" ry="8" fill="#e8f0f8" stroke="#c0d0e0" stroke-width="2"/>
  <!-- Berries in glass -->
  <circle cx="102" cy="140" r="8" fill="#a03080" opacity="0.8"/>
  <circle cx="138" cy="150" r="7" fill="#c04060" opacity="0.8"/>
  <circle cx="120" cy="160" r="8" fill="#a03080" opacity="0.7"/>
  <circle cx="106" cy="162" r="6" fill="#c04060" opacity="0.6"/>
  <!-- Glass highlights -->
  <path d="M 90 100 L 88 170" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.4" stroke-linecap="round"/>
  <path d="M 98 94 L 96 176" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.2" stroke-linecap="round"/>
</svg>`;

const lemonadeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <!-- Background -->
  <circle cx="120" cy="120" r="116" fill="#fffff0" stroke="#e0e090" stroke-width="3"/>
  <!-- Glass body -->
  <path d="M 84 86 L 90 186 Q 120 194 150 186 L 156 86 Z" fill="#f0f8e0" stroke="#c8d890" stroke-width="2" opacity="0.9"/>
  <!-- Lemonade liquid -->
  <path d="M 86 102 L 90 184 Q 120 192 150 184 L 154 102 Z" fill="#e8e840" opacity="0.35"/>
  <!-- Glass rim -->
  <ellipse cx="120" cy="86" rx="36" ry="8" fill="#f0f8e0" stroke="#c8d890" stroke-width="2"/>
  <!-- Lemon slice -->
  <circle cx="120" cy="86" r="20" fill="#f8f040" stroke="#e0d030" stroke-width="1.5"/>
  <circle cx="120" cy="86" r="15" fill="#f0e830"/>
  <line x1="120" y1="72" x2="120" y2="100" stroke="#e0d020" stroke-width="1.5" opacity="0.6"/>
  <line x1="106" y1="86" x2="134" y2="86" stroke="#e0d020" stroke-width="1.5" opacity="0.6"/>
  <line x1="110" y1="76" x2="130" y2="96" stroke="#e0d020" stroke-width="1" opacity="0.4"/>
  <line x1="130" y1="76" x2="110" y2="96" stroke="#e0d020" stroke-width="1" opacity="0.4"/>
  <!-- Bubbles -->
  <circle cx="104" cy="140" r="4" fill="#ffffff" opacity="0.5"/>
  <circle cx="136" cy="156" r="3" fill="#ffffff" opacity="0.4"/>
  <circle cx="118" cy="168" r="3.5" fill="#ffffff" opacity="0.4"/>
  <circle cx="130" cy="130" r="2.5" fill="#ffffff" opacity="0.5"/>
  <!-- Glass highlights -->
  <path d="M 90 100 L 88 170" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.4" stroke-linecap="round"/>
</svg>`;

const manifest = {
  meta: {
    id: "reading_dad_texts",
    version: "1.14.0",
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
    conceptCount: 12,
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
    {
      id: "pasta_instruction",
      kind: "instruction",
      title: { ru: "Готовим макароны с маслом и сыром", en: "Cooking: Pasta with Butter" },
      image: "media/pasta.svg",
      file: "recipes/pasta.txt",
      stepCount: 23,
    },
    {
      id: "fried_eggs_instruction",
      kind: "instruction",
      title: { ru: "Готовим яичницу-глазунью", en: "Cooking: Fried Eggs" },
      image: "media/fried_eggs.svg",
      file: "recipes/fried_eggs.txt",
      stepCount: 19,
    },
    {
      id: "oatmeal_instruction",
      kind: "instruction",
      title: { ru: "Готовим овсяную кашу на молоке", en: "Cooking: Oatmeal" },
      image: "media/oatmeal.svg",
      file: "recipes/oatmeal.txt",
      stepCount: 17,
    },
    {
      id: "salad_instruction",
      kind: "instruction",
      title: { ru: "Готовим салат из огурцов и помидоров", en: "Cooking: Salad" },
      image: "media/salad.svg",
      file: "recipes/salad.txt",
      stepCount: 16,
    },
    {
      id: "chicken_instruction",
      kind: "instruction",
      title: { ru: "Готовим курицу в сливочном соусе", en: "Cooking: Chicken in Cream Sauce" },
      image: "media/chicken.svg",
      file: "recipes/chicken.txt",
      stepCount: 24,
    },
    {
      id: "syrnik_instruction",
      kind: "instruction",
      title: { ru: "Готовим сырники", en: "Cooking: Cottage Cheese Pancakes" },
      image: "media/syrnik.svg",
      file: "recipes/syrnik.txt",
      stepCount: 28,
    },
    {
      id: "tea_instruction",
      kind: "instruction",
      title: { ru: "Готовим чай с мёдом", en: "Cooking: Tea with Honey" },
      image: "media/tea.svg",
      file: "recipes/tea.txt",
      stepCount: 16,
    },
    {
      id: "cocoa_instruction",
      kind: "instruction",
      title: { ru: "Готовим какао", en: "Cooking: Cocoa" },
      image: "media/cocoa.svg",
      file: "recipes/cocoa.txt",
      stepCount: 16,
    },
    {
      id: "kompot_instruction",
      kind: "instruction",
      title: { ru: "Готовим компот из ягод", en: "Cooking: Berry Compote" },
      image: "media/kompot.svg",
      file: "recipes/kompot.txt",
      stepCount: 20,
    },
    {
      id: "lemonade_instruction",
      kind: "instruction",
      title: { ru: "Готовим лимонад", en: "Cooking: Lemonade" },
      image: "media/lemonade.svg",
      file: "recipes/lemonade.txt",
      stepCount: 16,
    },
  ],
};

const zip = new JSZip();
zip.file("topic.json", JSON.stringify(manifest, null, 2));
zip.file("media/omelet.svg", omeletSvg);
zip.file("media/mashed_potatoes.svg", mashedPotatoesSvg);
zip.file("recipes/omelet.txt", omeletTxt);
zip.file("recipes/mashed_potatoes.txt", mashedPotatoesTxt);
zip.file("media/pasta.svg", pastaSvg);
zip.file("media/fried_eggs.svg", friedEggsSvg);
zip.file("media/oatmeal.svg", oatmealSvg);
zip.file("media/salad.svg", saladSvg);
zip.file("media/chicken.svg", chickenSvg);
zip.file("media/syrnik.svg", syrnikSvg);
zip.file("media/tea.svg", teaSvg);
zip.file("media/cocoa.svg", cocoaSvg);
zip.file("media/kompot.svg", kompotSvg);
zip.file("media/lemonade.svg", lemonadeSvg);
zip.file("recipes/pasta.txt", pastaTxt);
zip.file("recipes/fried_eggs.txt", friedEggsTxt);
zip.file("recipes/oatmeal.txt", oatmealTxt);
zip.file("recipes/salad.txt", saladTxt);
zip.file("recipes/chicken.txt", chickenTxt);
zip.file("recipes/syrnik.txt", syrnikTxt);
zip.file("recipes/tea.txt", teaTxt);
zip.file("recipes/cocoa.txt", cocoaTxt);
zip.file("recipes/kompot.txt", kompotTxt);
zip.file("recipes/lemonade.txt", lemonadeTxt);
const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("public/decks/reading_dad_texts_v1.14.0.zip", buffer);
