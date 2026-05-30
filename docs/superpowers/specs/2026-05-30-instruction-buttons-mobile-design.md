---
name: instruction-buttons-mobile
description: Кнопки Редактировать/Сбросить/Скачать в строке "Инструкция" переносятся на следующую строку на узком экране
metadata:
  type: project
---

# Мобильный layout кнопок инструкции

## Проблема

В `InstructionParamsContent.jsx` строка «Инструкция» содержит три кнопки в `display: flex; gap: 12px`. На узком экране телефона они выходят за пределы экрана.

## Решение

Добавить `flexWrap: "wrap"` к inline-стилю контейнера кнопок.

**Файл:** `src/features/reading/InstructionParamsContent.jsx`

**До:**
```jsx
<div style={{ display: "flex", gap: "12px" }}>
```

**После:**
```jsx
<div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
```

Если три кнопки не помещаются в одну строку — последняя(ие) переносятся на следующую строку.
