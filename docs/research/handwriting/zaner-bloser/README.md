# Zaner-Bloser — источники для разработки прописей Mironium

Исследовательская папка: американские школьные формы букв (**manuscript** и **cursive**), направления штрихов, соединения и разлиновка. Список проверен 2026-11-05.

**В репозиторий включены каталог источников и инструмент для их скачивания. Сами PDF в GitHub не копируются:** свободный доступ к учебным пособиям не означает свободу повторного размещения. Официальные PDF Zaner-Bloser охраняются авторским правом; некоторые ограничивают воспроизведение и хранение. Материалы KSM тоже не имеют явной лицензии на перепубликацию. Для анализа открывайте оригинальные ссылки, а для использования в продукте отдельно согласуйте права.

## Что смотреть сначала

1. **2025 Student Edition Sample (Grade 2C)** — формы, базовые штрихи, методика cursive. [PDF](https://www.zaner-bloser.com/sites/default/files/2025-03/Zaner-Bloser-Handwriting-G2C-Student-Edition-Sample.pdf). Проверен: открывается.
2. **2025 Teacher Edition Sampler (Grade 2C)** — методика, группы букв и соединения. [PDF](https://media.zaner-bloser.com/handwriting/pdfs/Zaner-Bloser-Handwriting-2025-Sampler-Teacher-2C-H3158.pdf). При проверке ошибка 502.
3. **KSM cursive capitals** — все заглавные. [PDF](https://www.ksmwritingtutor.com/wp-content/uploads/2020/04/CursiveCaps.pdf). Ссылка присутствует на сайте автора, скачивание не подтверждено.
4. **KSM cursive lowercase, right-handed** — все строчные. [PDF](https://www.ksmwritingtutor.com/wp-content/uploads/2020/04/CursiveLowerCaseRighties.pdf). Скачивание не подтверждено.
5. **KSM cursive lowercase, left-handed**. [PDF](https://www.ksmwritingtutor.com/wp-content/uploads/2020/04/CursiveLowerCaseLefties.pdf). Скачивание не подтверждено.
6. **Cursive Paper Templates** — разлиновка. [PDF](https://go.zaner-bloser.com/ZB_HW_Cursive_Paper_Templates.pdf). При проверке тайм-аут.
7. **Manuscript Practice Pack** — полезен для сравнения с несвязным письмом. [PDF](https://media.zaner-bloser.com/handwriting/pdfs/ZB_HW_Manuscript_Practice_Package.pdf). Проверен: открывается.

Полный машинно-читаемый перечень, включая шесть материалов KSM, **sources.json**. В нём указаны статус проверки и источник каждого документа.

**Исправление предыдущего списка:** URL `ZB_HW_Cursive_Practice_Package.pdf` на момент проверки перенаправлял к *Manuscript Practice Pack*; использовать его как образец cursive нельзя. Старый *Cursive Fundamentals Pack* издатель сейчас продаёт. Не подменяйте это новым «бесплатным пособием».

## Скачивание для локального изучения

Из папки выполните:

```bash
python3 download_references.py
```

Скрипт скачает доступные PDF в `local/` и сформирует `local/download-report.json`. Неработающие ссылки отразятся в отчёте. Файлы в `local/` игнорируются Git. Скрипт не обходит авторизацию и не приобретает платные материалы.

## Правовая и методическая граница

- *Free to read/download* ≠ разрешено хранить в общем репозитории, переиздавать или встраивать в коммерческое приложение.
- Не копировать издательские шрифты, исходные векторные контуры или целые страницы в Mironium без лицензии.
- Для учебной методики анализируйте построение букв; собственные графические ресурсы и траектории необходимо создавать самостоятельно и проверять на соответствие требуемой школьной традиции.
- [Условия сайта издателя](https://www.zaner-bloser.com/policies/terms-of-use) · [каталог KSM](https://www.ksmwritingtutor.com/handwriting-guides/) · [официальные бесплатные материалы](https://www.zaner-bloser.com/handwriting/zaner-bloser-handwriting/free-resources).
