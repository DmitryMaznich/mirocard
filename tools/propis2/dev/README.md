# Как смотреть буквы и слова так, как их печатает приложение

1. `cp tools/propis2/dev/harness.jsx tmp-pdf.jsx && cp tools/propis2/dev/harness.html tmp-pdf.html` (в КОРЕНЬ репозитория).
2. `(nohup npx vite --port 5199 --host 127.0.0.1 >/tmp/v.log 2>&1 &); sleep 8`. Vite между сессиями умирает: перезапускать. `pkill -f vite` убивает и оболочку (код 144): не использовать.
3. `node tools/propis2/dev/shot-words.mjs '["Вчера мы с папой"]' dense /tmp/out.png 0.2` и посмотреть картинку (Read на PNG).
   Сетки: `dense` (частая, с нарисованными линиями), `regular` (редкая, скрытая решётка). Проверять ОБЕ: правила привязки у них разные.
4. Перед коммитом удалить `tmp-pdf.*` (и не делать `git add -A` с ними в корне).

Для проверок без браузера: временный vitest-файл в `src/` с `buildGlyphMap({ wide })` и `layoutWideLinesIntoRows([слово], map, snap, false, масштаб)`.
Чтобы ветки, зависящие от привязки к линиям, сработали, передавать функцию `snap` (как в тесте «слово после пробела» в `model.test.js`), а не `undefined`.
`console.log` в vitest не виден: результат писать в файл (`writeFileSync`). Печать страниц целиком: `renderToStaticMarkup(<PrintPageView ... bare />)`.
