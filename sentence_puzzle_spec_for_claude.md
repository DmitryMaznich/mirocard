# Техническая спецификация v0.1
# Приложение: “Пазл предложений”

## 1. Product Concept

**“Пазл предложений”** — планшетное приложение для логопедических занятий, в котором ребёнок собирает простые фразы из визуальных пазл-карточек.

Каждая карточка соответствует определённой части предложения:

```text
КТО? → ЧТО ДЕЛАЕТ? → КАКОЙ/КАКУЮ? → ЧТО?
```

Грамматически:

```text
Подлежащее → Сказуемое → Определение → Дополнение
```

Пример:

```text
Мама → моет → красную → чашку
```

Итоговая фраза:

```text
Мама моет красную чашку.
```

Главная идея: **ребёнок не просто выбирает слова, а физически собирает структуру предложения в правильном порядке**.

---

## 2. Цель приложения

Приложение должно помогать ребёнку тренировать:

1. понимание структуры простого предложения;
2. составление фраз;
3. различение смысловых ролей слов;
4. понимание вопросов:
   - кто?
   - что делает?
   - что?
   - какой / какая / какое?
5. связь между изображением, словом и устной фразой;
6. подготовку к ответам на вопросы логопеда.

Приложение не должно быть перегружено игровыми эффектами. Это **терапевтический инструмент**, а не обычная развлекательная игра.

---

## 3. Основной пользовательский сценарий

### Сценарий занятия

1. Ребёнок видит пустую цепочку предложения.
2. Внизу экрана лежат карточки в случайном порядке.
3. Ребёнок перетаскивает карточки в правильные слоты.
4. Карточка принимается только в слот своего типа.
5. После заполнения всех слотов приложение показывает готовую фразу.
6. Логопед переходит к экрану вопросов.
7. Приложение показывает вопросы по собранной фразе.
8. Логопед задаёт вопросы ребёнку устно.
9. После завершения можно собрать новую фразу.

---

## 4. Главная механика

На экране есть четыре фиксированных слота:

```text
[КТО?] → [ЧТО ДЕЛАЕТ?] → [КАКОЙ/КАКУЮ?] → [ЧТО?]
```

Каждый слот принимает только один тип карточки:

| Слот | Тип карточки | Вопрос |
|---|---|---|
| Subject Slot | `subject` | Кто? |
| Verb Slot | `verb` | Что делает? |
| Adjective Slot | `adjective` | Какой / какую? |
| Object Slot | `object` | Что? |

Карточки нельзя соединять в другом порядке.

То есть ребёнок не может собрать:

```text
чашку → Мама → красную → моет
```

Он может собрать только:

```text
Мама → моет → красную → чашку
```

---

## 5. Визуальная концепция

### 5.1. Общий стиль

Интерфейс должен быть:

- планшетным;
- крупным;
- спокойным;
- без визуального шума;
- с большими зонами для нажатия;
- понятным для ребёнка и логопеда.

### 5.2. Цветовое кодирование

Каждая часть предложения имеет свой цвет:

| Тип | Цвет | Значение |
|---|---|---|
| `subject` | синий | Кто? |
| `verb` | зелёный | Что делает? |
| `adjective` | оранжевый | Какой / какую? |
| `object` | фиолетовый | Что? |

Важно: цвет должен использоваться и на карточке, и на слоте.

### 5.3. Форма пазла

Карточки должны визуально напоминать пазлы или соединяемые блоки.

MVP может использовать упрощённую визуализацию:

- прямоугольные карточки с “выступом” справа;
- слоты с соответствующей “выемкой”;
- стрелки между слотами;
- визуальная цепочка слева направо.

Для первого прототипа не обязательно реализовывать настоящую физическую геометрию пазла. Достаточно, чтобы визуально было понятно:

```text
КТО? → ЧТО ДЕЛАЕТ? → КАКОЙ/КАКУЮ? → ЧТО?
```

Но логика приложения должна строго запрещать неправильный порядок.

---

## 6. Экраны приложения

### 6.1. Screen 1 — Sentence Builder

Главный экран сборки предложения.

#### Верхняя зона

Показывает текущее состояние фразы.

До начала:

```text
___ ___ ___ ___.
```

После частичной сборки:

```text
Мама ___ ___ ___.
Мама моет ___ ___.
Мама моет красную ___.
```

После завершения:

```text
Мама моет красную чашку.
```

#### Центральная зона

Четыре слота:

```text
[КТО?] → [ЧТО ДЕЛАЕТ?] → [КАКУЮ?] → [ЧТО?]
```

Каждый слот должен содержать:

- вопрос;
- цветовую маркировку;
- место для карточки;
- визуальную подсказку, что сюда нужно положить.

#### Нижняя зона

Перемешанные карточки текущего задания.

Например:

```text
[чашку] [Мама] [красную] [моет]
```

Ребёнок должен перетащить их в правильные места.

---

### 6.2. Screen 2 — Questions

Экран для логопеда после сборки фразы.

Показывает:

1. готовое предложение;
2. вопросы по предложению;
3. кнопку “Новое предложение”;
4. кнопку “Назад к пазлу”.

Пример:

```text
Мама моет красную чашку.

Вопросы:
1. Кто моет чашку?
2. Что делает мама?
3. Что мама моет?
4. Какая чашка?
```

На первом этапе приложение **не проверяет ответы ребёнка автоматически**.
Оно только помогает логопеду быстро получить правильные вопросы.

---

## 7. Компоненты интерфейса

### 7.1. `App`

Главный компонент приложения.

Отвечает за:

- текущий экран;
- выбранные карточки;
- собранное предложение;
- генерацию нового задания.

### 7.2. `SentenceBuilder`

Экран сборки предложения.

Содержит:

- `SentencePreview`;
- `DropZoneRow`;
- `CardTray`;
- кнопку перехода к вопросам после завершения.

### 7.3. `SentencePreview`

Показывает фразу в процессе сборки.

Пример:

```text
Мама моет красную чашку.
```

Если слот пустой, показывает пропуск:

```text
Мама ___ красную ___.
```

### 7.4. `DropZoneRow`

Горизонтальная цепочка из четырёх слотов.

```text
SubjectSlot → VerbSlot → AdjectiveSlot → ObjectSlot
```

### 7.5. `DropZone`

Один слот.

Props:

```ts
type DropZoneProps = {
  type: CardType;
  label: string;
  placedCard?: PuzzleCard;
  isActive?: boolean;
};
```

### 7.6. `PuzzleCard`

Одна карточка.

Содержит:

- изображение или emoji;
- слово;
- вопрос;
- цвет типа;
- тип карточки.

### 7.7. `CardTray`

Нижняя зона с карточками.

Показывает карточки, которые ещё не размещены.

### 7.8. `QuestionsScreen`

Экран вопросов.

Показывает:

- итоговое предложение;
- список вопросов;
- кнопку нового задания.

---

## 8. Data Model

### 8.1. Типы данных

```ts
type CardType = "subject" | "verb" | "adjective" | "object";

type PuzzleCard = {
  id: string;
  type: CardType;
  label: string;
  question: string;
  image?: string;
  emoji?: string;
  color?: string;
};
```

### 8.2. Subject

```ts
type SubjectCard = PuzzleCard & {
  type: "subject";
};
```

Пример:

```json
{
  "id": "mom",
  "type": "subject",
  "label": "Мама",
  "question": "Кто?",
  "emoji": "👩"
}
```

### 8.3. Verb

```ts
type VerbCard = PuzzleCard & {
  type: "verb";
};
```

Пример:

```json
{
  "id": "wash",
  "type": "verb",
  "label": "моет",
  "question": "Что делает?",
  "emoji": "🧼"
}
```

### 8.4. Adjective

```ts
type AdjectiveCard = PuzzleCard & {
  type: "adjective";
};
```

Пример:

```json
{
  "id": "red_f_acc",
  "type": "adjective",
  "label": "красную",
  "question": "Какую?",
  "emoji": "🔴"
}
```

### 8.5. Object

```ts
type ObjectCard = PuzzleCard & {
  type: "object";
  nominative?: string;
  accusative?: string;
  gender?: "masculine" | "feminine" | "neuter" | "plural";
};
```

Пример:

```json
{
  "id": "cup",
  "type": "object",
  "label": "чашку",
  "nominative": "чашка",
  "accusative": "чашку",
  "gender": "feminine",
  "question": "Что?",
  "emoji": "☕"
}
```

---

## 9. Данные для MVP

Для первого прототипа нужно использовать **только существительные женского рода в винительном падеже**, чтобы избежать сложной русской морфологии.

### Subjects

```ts
const subjects = [
  { id: "mom", type: "subject", label: "Мама", question: "Кто?", emoji: "👩" },
  { id: "dad", type: "subject", label: "Папа", question: "Кто?", emoji: "👨" },
  { id: "grandma", type: "subject", label: "Бабушка", question: "Кто?", emoji: "👵" },
  { id: "grandpa", type: "subject", label: "Дедушка", question: "Кто?", emoji: "👴" },
  { id: "therapist", type: "subject", label: "Логопед", question: "Кто?", emoji: "👩‍🏫" }
];
```

### Verbs

```ts
const verbs = [
  { id: "wash", type: "verb", label: "моет", question: "Что делает?", emoji: "🧼" },
  { id: "carry", type: "verb", label: "несёт", question: "Что делает?", emoji: "🤲" },
  { id: "look_for", type: "verb", label: "ищет", question: "Что делает?", emoji: "🔍" },
  { id: "take", type: "verb", label: "берёт", question: "Что делает?", emoji: "✋" },
  { id: "give", type: "verb", label: "даёт", question: "Что делает?", emoji: "🎁" },
  { id: "show", type: "verb", label: "показывает", question: "Что делает?", emoji: "👉" }
];
```

### Adjectives

```ts
const adjectives = [
  { id: "red_f_acc", type: "adjective", label: "красную", question: "Какую?", emoji: "🔴" },
  { id: "blue_f_acc", type: "adjective", label: "синюю", question: "Какую?", emoji: "🔵" },
  { id: "big_f_acc", type: "adjective", label: "большую", question: "Какую?", emoji: "⬆️" },
  { id: "small_f_acc", type: "adjective", label: "маленькую", question: "Какую?", emoji: "⬇️" },
  { id: "clean_f_acc", type: "adjective", label: "чистую", question: "Какую?", emoji: "✨" },
  { id: "dirty_f_acc", type: "adjective", label: "грязную", question: "Какую?", emoji: "🟤" }
];
```

### Objects

```ts
const objects = [
  { id: "cup", type: "object", label: "чашку", nominative: "чашка", question: "Что?", emoji: "☕", gender: "feminine" },
  { id: "car", type: "object", label: "машинку", nominative: "машинка", question: "Что?", emoji: "🚗", gender: "feminine" },
  { id: "book", type: "object", label: "книгу", nominative: "книга", question: "Что?", emoji: "📕", gender: "feminine" },
  { id: "spoon", type: "object", label: "ложку", nominative: "ложка", question: "Что?", emoji: "🥄", gender: "feminine" },
  { id: "plate", type: "object", label: "тарелку", nominative: "тарелка", question: "Что?", emoji: "🍽️", gender: "feminine" },
  { id: "toy", type: "object", label: "игрушку", nominative: "игрушка", question: "Что?", emoji: "🧸", gender: "feminine" }
];
```

---

## 10. Interaction Logic

### 10.1. Создание задания

При запуске нового задания приложение выбирает случайно:

- 1 subject;
- 1 verb;
- 1 adjective;
- 1 object.

Затем перемешивает эти четыре карточки и показывает их внизу.

Пример выбранного задания:

```ts
[
  { type: "object", label: "чашку" },
  { type: "subject", label: "Мама" },
  { type: "adjective", label: "красную" },
  { type: "verb", label: "моет" }
]
```

Правильная сборка:

```text
Мама моет красную чашку.
```

---

### 10.2. Drag-and-drop

Если карточку перетащили в слот:

#### Проверка

```ts
if (card.type === dropZone.type) {
  placeCard(card, dropZone);
} else {
  returnCardToTray(card);
}
```

#### При правильном размещении

- карточка фиксируется в слоте;
- исчезает из нижней зоны;
- фраза сверху обновляется;
- слот подсвечивается мягким цветом.

#### При неправильном размещении

- карточка возвращается назад;
- слот не принимает карточку;
- можно показать короткую подсказку.

Пример подсказки:

```text
Сюда нужно: Кто?
```

или:

```text
Это “Что?”, а здесь место для “Кто?”.
```

---

### 10.3. Завершение задания

Когда все четыре слота заполнены:

```ts
const isComplete =
  placed.subject &&
  placed.verb &&
  placed.adjective &&
  placed.object;
```

Приложение показывает полную фразу:

```text
Мама моет красную чашку.
```

Появляется кнопка:

```text
Вопросы
```

---

## 11. Генерация предложения

Фраза собирается по фиксированному шаблону:

```ts
function buildSentence(placed: PlacedCards): string {
  return [
    placed.subject?.label ?? "___",
    placed.verb?.label ?? "___",
    placed.adjective?.label ?? "___",
    placed.object?.label ?? "___"
  ].join(" ") + ".";
}
```

---

## 12. Генерация вопросов

После сборки предложения приложение генерирует четыре вопроса.

Для предложения:

```text
Мама моет красную чашку.
```

Вопросы:

```text
Кто моет чашку?
Что делает мама?
Что мама моет?
Какая чашка?
```

### MVP-логика

```ts
function generateQuestions(placed: PlacedCards): string[] {
  const subject = placed.subject?.label.toLowerCase();
  const verb = placed.verb?.label;
  const objectAcc = placed.object?.label;
  const objectNom = placed.object?.nominative ?? placed.object?.label;

  return [
    `Кто ${verb} ${objectAcc}?`,
    `Что делает ${subject}?`,
    `Что ${subject} ${verb}?`,
    `Какая ${objectNom}?`
  ];
}
```

Важно: для MVP все объекты женского рода, поэтому вопрос **“Какая?”** подходит ко всем объектам.

---

## 13. MVP Scope

В первый прототип входит:

1. React + TypeScript приложение.
2. Один экран сборки предложения.
3. Один экран вопросов.
4. Drag-and-drop карточек.
5. Проверка типа карточки и слота.
6. Фиксированный порядок предложения.
7. Локальные данные.
8. Emoji или image placeholders.
9. Цветовое кодирование.
10. Кнопка “Новое предложение”.
11. Кнопка “Вопросы”.
12. Адаптация под планшет.

---

## 14. Не входит в MVP

В первый прототип **не нужно** включать:

- backend;
- авторизацию;
- базу данных;
- личные профили детей;
- автоматическую оценку речи;
- распознавание голоса;
- сложную морфологию русского языка;
- загрузку фото взрослых;
- аудиозапись;
- статистику прогресса;
- родительский кабинет;
- сложные анимации;
- синтез речи.

Это можно добавить позже.

---

## 15. Future Extensions

### 15.1. Фото близких взрослых

Позже вместо emoji для subject можно использовать реальные фотографии:

```ts
{
  id: "mom",
  type: "subject",
  label: "Мама",
  image: "/images/subjects/mom.jpg"
}
```

### 15.2. Озвучка

Каждая карточка может иметь аудиофайл:

```ts
audio: "/audio/mom.mp3"
```

Можно озвучивать:

- отдельное слово;
- всю фразу;
- вопрос.

### 15.3. Расширенная грамматика

Позже можно добавить:

```text
красный мяч
красную чашку
красное яблоко
красные кубики
```

Для этого нужно хранить род, число и падеж.

### 15.4. Смысловая совместимость

Можно добавить группы совместимости:

```ts
verb.compatibleObjectGroups = ["food", "toy", "household"];
object.group = "household";
```

Например:

- “ест” → только еду;
- “пьёт” → только напитки;
- “надевает” → только одежду;
- “моет” → предметы / руки / посуду;
- “несёт” → почти всё.

### 15.5. Режим ответа ребёнка

После вопроса ребёнок может:

- нажать на правильную карточку;
- перетащить карточку-ответ;
- ответить голосом;
- повторить всю фразу.

### 15.6. Уровни сложности

Уровень 1:

```text
Кто? → Что делает?
```

Уровень 2:

```text
Кто? → Что делает? → Что?
```

Уровень 3:

```text
Кто? → Что делает? → Какую? → Что?
```

Уровень 4:

```text
Кто? → Что делает? → Какую? → Что? → Где?
```

---

## 16. UX Requirements

### 16.1. Для ребёнка

Интерфейс должен быть:

- крупный;
- простой;
- без мелких элементов;
- с понятными картинками;
- с мягкой обратной связью;
- без наказаний за ошибку.

### 16.2. Для логопеда

Логопед должен быстро понимать:

- какую фразу собрал ребёнок;
- какие вопросы можно задать;
- какие части предложения уже собраны;
- где ребёнок ошибается.

### 16.3. Ошибки

Ошибки не должны подаваться агрессивно.

Не использовать:

```text
Неправильно!
Ошибка!
Ты ошибся!
```

Лучше использовать:

```text
Попробуй сюда: Кто?
Это карточка “Что?”, а здесь нужно “Кто?”.
Посмотри на цвет.
```

---

## 17. Recommended Tech Stack

Для первого прототипа:

```text
React + TypeScript + Vite
```

Drag-and-drop:

```text
@dnd-kit/core
```

Стили:

```text
CSS Modules или Tailwind CSS
```

Хранение данных:

```text
local TypeScript file / JSON
```

Backend:

```text
не нужен
```

---

## 18. Suggested File Structure

```text
src/
  App.tsx
  main.tsx
  data/
    cards.ts
  types/
    cards.ts
  components/
    SentenceBuilder.tsx
    SentencePreview.tsx
    DropZoneRow.tsx
    DropZone.tsx
    PuzzleCard.tsx
    CardTray.tsx
    QuestionsScreen.tsx
  utils/
    sentence.ts
    questions.ts
    shuffle.ts
  styles/
    app.css
```

---

## 19. Full Prompt for Claude Code / Codex

```text
Create a React + TypeScript + Vite tablet-friendly prototype of a speech therapy sentence puzzle app.

App name:
Sentence Puzzle / Пазл предложений

Purpose:
The app helps a child build simple Russian sentences from visual puzzle cards. It is intended for speech therapy sessions. The child physically assembles the grammatical structure of a sentence, and then the therapist asks comprehension questions based on the completed sentence.

Core sentence structure:
Subject → Verb → Adjective → Object

Russian labels:
КТО? → ЧТО ДЕЛАЕТ? → КАКУЮ? → ЧТО?

Example:
Мама → моет → красную → чашку
Completed sentence:
Мама моет красную чашку.

Main requirements:
1. Build a React + TypeScript app.
2. Use Vite.
3. Make the UI tablet-first.
4. Use large cards and large drop zones.
5. Use drag-and-drop.
6. Use @dnd-kit/core for drag-and-drop.
7. No backend.
8. No authentication.
9. No database.
10. Use local TypeScript arrays for data.
11. Use emoji placeholders instead of real images for MVP.

Screens:
The app has two screens.

Screen 1: Sentence Builder
- Show the sentence preview at the top.
- Show four fixed drop zones in the middle:
  1. КТО? / subject
  2. ЧТО ДЕЛАЕТ? / verb
  3. КАКУЮ? / adjective
  4. ЧТО? / object
- Show draggable cards at the bottom in shuffled order.
- Each card has:
  - id
  - type: subject | verb | adjective | object
  - label
  - question
  - emoji
  - optional nominative form for objects
- A card can only be dropped into the matching drop zone.
- If a card is dropped into the wrong zone, it must return to the card tray.
- If a card is dropped into the correct zone, it stays inside the slot and disappears from the tray.
- The sentence preview updates after each correct placement.
- When all four zones are filled, show the completed sentence and a button: “Вопросы”.

Screen 2: Questions
- Show the completed sentence.
- Generate and show four therapist questions:
  1. Кто [verb] [object accusative]?
  2. Что делает [subject lowercase]?
  3. Что [subject lowercase] [verb]?
  4. Какая [object nominative]?
- Add a “Новое предложение” button that returns to the builder and generates a new sentence.
- Add a “Назад” button to return to the builder without generating a new sentence.

Design:
- Calm, simple, child-friendly.
- No distracting animations.
- Use role colors:
  - subject = blue
  - verb = green
  - adjective = orange
  - object = purple
- Cards should visually resemble puzzle pieces or connected blocks.
- Use arrows between slots to emphasize fixed order.
- Wrong drops should not show aggressive error messages.
- If needed, show a gentle hint like:
  “Сюда нужно: Кто?”

Data for MVP:
Use only feminine accusative object forms to avoid Russian morphology complexity.

Subjects:
- Мама 👩
- Папа 👨
- Бабушка 👵
- Дедушка 👴
- Логопед 👩‍🏫

Verbs:
- моет 🧼
- несёт 🤲
- ищет 🔍
- берёт ✋
- даёт 🎁
- показывает 👉

Adjectives:
- красную 🔴
- синюю 🔵
- большую ⬆️
- маленькую ⬇️
- чистую ✨
- грязную 🟤

Objects:
- чашку ☕, nominative: чашка
- машинку 🚗, nominative: машинка
- книгу 📕, nominative: книга
- ложку 🥄, nominative: ложка
- тарелку 🍽️, nominative: тарелка
- игрушку 🧸, nominative: игрушка

Suggested architecture:
src/
  App.tsx
  main.tsx
  data/cards.ts
  types/cards.ts
  components/SentenceBuilder.tsx
  components/SentencePreview.tsx
  components/DropZoneRow.tsx
  components/DropZone.tsx
  components/PuzzleCard.tsx
  components/CardTray.tsx
  components/QuestionsScreen.tsx
  utils/sentence.ts
  utils/questions.ts
  utils/shuffle.ts
  styles/app.css

Implementation details:
- Define CardType as:
  type CardType = "subject" | "verb" | "adjective" | "object";

- Define PuzzleCard as:
  type PuzzleCard = {
    id: string;
    type: CardType;
    label: string;
    question: string;
    emoji?: string;
    nominative?: string;
  };

- Define placed cards state as:
  {
    subject?: PuzzleCard;
    verb?: PuzzleCard;
    adjective?: PuzzleCard;
    object?: PuzzleCard;
  }

- Generate a task by randomly selecting one card from each category, then shuffling the four selected cards.

- The drop validation rule is:
  card.type === dropZone.type

- Sentence preview should always show four positions:
  [subject or ___] [verb or ___] [adjective or ___] [object or ___].

- Completed sentence is:
  subject.label + " " + verb.label + " " + adjective.label + " " + object.label + "."

- Question generation:
  const subject = placed.subject.label.toLowerCase();
  const verb = placed.verb.label;
  const objectAcc = placed.object.label;
  const objectNom = placed.object.nominative ?? placed.object.label;

  Questions:
  - `Кто ${verb} ${objectAcc}?`
  - `Что делает ${subject}?`
  - `Что ${subject} ${verb}?`
  - `Какая ${objectNom}?`

Do not implement:
- backend
- user accounts
- speech recognition
- automatic answer evaluation
- real audio
- real photo upload
- advanced Russian morphology
- progress tracking

Focus only on the core working prototype.
```

---

## 20. Критическое замечание

Для первого прототипа лучше **жёстко ограничить грамматику женским родом и винительным падежом**. Это правильное MVP-решение.

Иначе проект сразу утонет в русской морфологии:

```text
красный мяч
красную чашку
красное яблоко
красные кубики
```

Сейчас важнее проверить терапевтическую механику:

```text
ребёнок видит → выбирает → перетаскивает → собирает → слышит фразу → отвечает на вопросы
```

После этого можно расширять словарь и грамматику.
