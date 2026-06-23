# Chat Practice — Design Spec
_2026-06-23_

## Goal

Учебный чат для детей с РАС — тренажёр функциональной переписки с близкими взрослыми. Ребёнок проходит заскриптованные диалоговые сценарии в интерфейсе, максимально похожем на WhatsApp. Цель — автоматизация 5–10 жизненно важных коммуникативных паттернов (приветствие, ответ на вопрос, выражение потребности) до переноса в реальный мессенджер.

---

## Педагогические принципы

- **Предсказуемость**: скрипт фиксирован, ребёнок знает чего ожидать → снижение тревоги
- **Повторяемость**: один сценарий можно проходить 50 раз подряд без участия взрослого
- **Постепенная вариативность**: сначала `anyIsCorrect` (любой ответ верный), затем `correct: true/false`
- **Мягкое перенаправление**: при неверном ответе — "попробуй ещё", без красных крестов и звуков ошибки
- **Функциональность**: каждый сценарий решает реальную бытовую задачу

---

## Архитектура

### Место в системе

`chat_practice` — новый тип темы (topic type), полностью совместимый с существующей ZIP/каталог инфраструктурой. При открытии темы типа `chat_practice` приложение запускает `ChatSessionScreen` вместо стандартного `SessionScreen`.

```
TopicCard (HomeScreen)
  → detect type === "chat_practice"
  → ChatSessionScreen (новый экран)
      → useConversation(scriptSource)   ← абстракция источника данных
          → ChatView (рендер)
```

### Абстракция `useConversation`

Хук изолирует источник данных от рендеринга. Сейчас `scriptSource` читает скрипт из `topic.json`. В будущем тот же хук может читать из WebSocket (живой чат) — `ChatView` не изменится.

```js
// Интерфейс хука
const {
  messages,      // [{id, from, text, timestamp, isCorrect?}]
  currentChoices,// [{text, correct?, next?}] | null
  isTyping,      // bool — анимация "печатает..."
  sendChoice,    // (choice) => void
  isComplete,    // bool
  score,         // {correct, total}
} = useConversation(scriptSource)
```

### Интеграция с системой прогресса

**Подход C (гибрид)**: `ChatSessionScreen` управляет своим state, но по завершении сессии передаёт итог в общую аналитику:

```js
onSessionComplete({ topicId, studentId, score, durationMs, completedAt })
```

Это достаточно для экрана истории и базовой аналитики без переделки SessionScreen.

---

## Формат `topic.json`

```json
{
  "id": "morning_greeting",
  "type": "chat_practice",
  "version": "1.0.0",
  "title": "Утреннее приветствие",
  "contact": {
    "name": "Мама",
    "avatar": "mom.png",
    "color": "#25d366"
  },
  "turns": [
    {
      "id": "t1",
      "from": "contact",
      "text": "Доброе утро! ☀️",
      "anyIsCorrect": true,
      "choices": [
        { "text": "Доброе утро!" },
        { "text": "Привет, мам!" },
        { "text": "Доброе!" }
      ],
      "reactionOnSend": "Мама: Хорошо! ☀️"
    },
    {
      "id": "t2",
      "from": "contact",
      "text": "Ты хочешь кушать?",
      "choices": [
        { "text": "Да, хочу",    "correct": true,  "next": "t3" },
        { "text": "Нет",         "correct": true,  "next": "t3" },
        { "text": "Не знаю",     "correct": false              }
      ],
      "reactionOnCorrect": "Мама: Хорошо, иду готовить!",
      "reactionOnWrong":   null
    },
    {
      "id": "t3",
      "from": "contact",
      "text": "Хорошо! Жди меня.",
      "anyIsCorrect": true,
      "choices": [
        { "text": "Ок" },
        { "text": "Хорошо" }
      ]
    }
  ]
}
```

### Ключевые поля

| Поле | Описание |
|------|----------|
| `anyIsCorrect: true` | Любой ответ засчитывается как верный (приветствия, предпочтения) |
| `correct: true/false` | Для ходов с семантически правильным ответом |
| `next` | ID следующего хода (ветвление). Без `next` — линейный порядок |
| `reactionOnSend` | Сообщение контакта после любого ответа — только при `anyIsCorrect: true`. Взаимоисключает `reactionOnCorrect/Wrong` |
| `reactionOnCorrect` | Сообщение при верном выборе — только при `correct: true/false` схеме |
| `reactionOnWrong` | Сообщение при неверном (можно `null` — тогда только подсказка в UI) |
| `next` | ID следующего хода. Если ID не найден или поле отсутствует — линейный порядок по массиву |

---

## Визуальный дизайн

**Палитра**: WhatsApp-style

| Элемент | Цвет |
|---------|------|
| Header | `#075e54` |
| Header text | `#ffffff` |
| Background | `#ece5dd` |
| Incoming bubble | `#ffffff` |
| Outgoing bubble | `#dcf8c6` |
| Accent / border | `#25d366` |
| Кнопки выбора (активные) | белый + граница `#25d366` |

### Структура экрана (сверху вниз)

```
┌─────────────────────────────────┐
│  ← [Аватар] Мама  •  в сети    │  ← Header (#075e54)
├─────────────────────────────────┤
│                                 │
│  [👩] Привет!          09:12   │  ← Incoming (left)
│                                 │
│             Привет! ✓✓  09:12  │  ← Outgoing (right, #dcf8c6)
│                                 │
│  [👩] Как дела?        09:13   │
│                                 │
│  [👩] •••                      │  ← Typing indicator (animated)
│                                 │
│       [scroll area, flex:1]     │
├─────────────────────────────────┤
│  Выбери ответ                   │
│  ┌───────────────────────────┐  │
│  │  Хорошо              │  │  ← Кнопки выбора (крупные, ≥48px)
│  │  Нормально           │  │
│  │  Плохо               │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Размеры и доступность

- Шрифт сообщений: **18px минимум**
- Кнопки выбора: **min-height 52px**, `font-size: 18px`
- Аватар в шапке: 40px
- Аватар у пузырька: 28px

---

## Логика обратной связи (Feedback)

### Когда `anyIsCorrect: true`

1. Ребёнок нажимает кнопку
2. Кнопка кратко подсвечивается зелёным (150мс)
3. Выбранный текст анимируется в исходящий пузырёк (справа)
4. Пауза 600мс → typing indicator
5. Пауза 800мс → появляется `reactionOnSend` от контакта
6. Переход к следующему ходу

### Когда `correct: true`

То же что выше, но с `reactionOnCorrect`.

### Когда `correct: false`

1. Ребёнок нажимает кнопку
2. Кнопка кратко подсвечивается оранжевым (150мс) → возвращается в исходное состояние
3. **Кнопки НЕ скрываются** — ребёнок видит варианты снова
4. Над кнопками появляется подсказка: _"Попробуй ещё раз"_ (мягкий серый текст)
5. Кнопки с `correct: true` получают лёгкую зелёную подсветку (намёк)
6. Неверная кнопка становится серой (disabled)
7. Ошибка записывается в score, но сценарий не прерывается

**Чего нет**: красные X, звуки ошибки, тряска, попап "неправильно".

---

## State Machine хода

```
IDLE
  → (turn starts) → CONTACT_TYPING
CONTACT_TYPING (700–1200мс)
  → CONTACT_MESSAGE_VISIBLE
CONTACT_MESSAGE_VISIBLE
  → AWAITING_CHILD_RESPONSE
AWAITING_CHILD_RESPONSE
  → (correct/anyIsCorrect) → CHILD_RESPONDED_CORRECT
  → (incorrect)            → CHILD_RESPONDED_WRONG
CHILD_RESPONDED_CORRECT
  → REACTION_TYPING (500мс) → REACTION_VISIBLE → NEXT_TURN
CHILD_RESPONDED_WRONG
  → SHOW_HINT → AWAITING_CHILD_RESPONSE  (retry)
NEXT_TURN
  → (if turns remain) → CONTACT_TYPING
  → (if done)         → SESSION_COMPLETE
SESSION_COMPLETE
  → onSessionComplete(score) → SessionSummary
```

---

## Компоненты

| Компонент | Ответственность |
|-----------|----------------|
| `ChatSessionScreen` | Корневой экран, оркестрирует запуск и завершение |
| `useConversation(source)` | Хук: state machine + логика переходов |
| `ChatView` | Рендер: шапка + список сообщений + кнопки выбора |
| `ChatHeader` | Аватар, имя, статус "в сети" |
| `MessageBubble` | Один пузырёк (incoming/outgoing) |
| `TypingIndicator` | Анимация "•••" |
| `ChoicePanel` | Панель кнопок выбора, управляет disabled/hint состоянием |
| `ChatSummary` | Экран завершения с результатом |

---

## MVP scope (не входит в v1)

- Редактор сценариев в приложении → отдельная фича
- Живой чат учитель↔ученик → отдельный проект (другой data source для `useConversation`)
- Свободный ввод текста (клавиатура) → после v1
- Голосовые, эмодзи, фото → после v1
- Уведомления → после v1

---

## Файловая структура (новые файлы)

```
src/
  features/
    chat/
      ChatSessionScreen.jsx
      ChatSummary.jsx
      useConversation.js
      chat.css
  shared/
    components/
      chat/
        ChatView.jsx
        ChatHeader.jsx
        MessageBubble.jsx
        TypingIndicator.jsx
        ChoicePanel.jsx
```

### Создание тем-сценариев

Топики `chat_practice` собираются как обычный ZIP и импортируются через существующий TopicImport UI. Структура ZIP:

```
morning_greeting.zip
  topic.json
  mom.png
```

Аватары контактов (`mom.png`, `dad.png`) хранятся в том же ZIP и читаются через `useTopicFile` хук, как любые другие ассеты темы. Первая версия сценариев собирается вручную разработчиком.
