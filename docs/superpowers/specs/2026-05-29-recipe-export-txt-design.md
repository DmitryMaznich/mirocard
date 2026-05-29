---
name: recipe-export-txt
description: Кнопка скачивания рецепта в .txt рядом с кнопкой «Редактировать» в настройках рецепта
metadata:
  type: project
---

# Экспорт рецепта в .txt

## Контекст

Экран настроек рецепта — `InstructionParamsContent.jsx`. Там уже есть строка:

```
Инструкция     [Редактировать]
```

`rawRecipe` (сырой текст рецепта) загружается в state при монтировании через `getRawRecipeTxt` / `getRecipeOverrideForMode`.

## Цель

Добавить кнопку «Скачать» рядом с «Редактировать». При клике браузер скачивает `.txt`-файл с сырым текстом текущего рецепта (с учётом переопределений из IndexedDB).

## UI

Строка «Инструкция» после изменения:
```
Инструкция     [Редактировать]  [Скачать]
```

- Кнопка «Скачать» — стиль `link-btn` (идентично «Редактировать»).
- Кнопка отключена (`disabled`), пока `rawRecipe` пустой.

## Логика

Функция `handleDownload()` в `InstructionParamsContent`:

1. Берёт `rawRecipe` из state.
2. Создаёт `Blob` с `type: "text/plain;charset=utf-8"`.
3. Создаёт временный `<a>` с `href = URL.createObjectURL(blob)` и `download = "<textTitle>.txt"`. Если `textTitle` отсутствует — `recipe.txt`.
4. Программный клик → скачивание → `URL.revokeObjectURL(url)`.

## Ограничения

- Логика загрузки `rawRecipe` не меняется.
- Модал редактирования не меняется.
- Новые файлы не создаются.
- Никаких новых состояний.

## Файл для изменения

- `src/features/reading/InstructionParamsContent.jsx` — единственный файл.
