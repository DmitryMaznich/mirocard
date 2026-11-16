# Стенд частей букв (`propis2`, «Что пишем»)

Картинка всех букв стиля, каждая часть (`src/handwriting/letterParts.js`) своим цветом, число частей у буквы — серым.
По ней владелец проверяет автоматическую нарезку прописных; где она неверна — свой разрез в `partCuts` буквы.

```bash
cp tools/propis2/parts-review/sheet.test.jsx.txt src/topics/renderers/propis2/zzParts.test.jsx
LETTERS="абвгдеёжзийклмнопрстуфхцчшщъыьэюя" OUT=/abs/path/parts.html npx vitest run src/topics/renderers/propis2/zzParts.test.jsx
rm src/topics/renderers/propis2/zzParts.test.jsx   # не коммитить
```
Стиль — в тексте теста (`languageView(..., "ru", "cursive")`); колода — опубликованный ZIP `propis2`.
