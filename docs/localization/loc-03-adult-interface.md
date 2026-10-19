# Adult interface localization — release 1.0.2670

This increment extends the saved RU/SL interface preference beyond login and settings.

## Included

- Home: greeting, lesson assembly controls, menu, tabs, empty states and guided hints.
- Students: list and tablet detail, create/edit form, validation, data explanations, guided hints, video controls and deletion confirmation.
- Topic library: search, stable category filters, catalog states, badges, import/install/update controls and dialogs, topic action sheet and continuation banner.
- Mode picker: navigation, empty states and common controls. The mode's teaching instructions, methodology and lesson-specific names remain content.
- Shared modal, hint and sync labels; locale-aware interface dates.
- Slovenian topic names are display labels in home/library navigation. Catalog IDs, category filter values, downloaded lesson packages and user data remain unchanged.

## Boundaries

This is not complete application localization. Account/subscription/help, statistics/history, lesson parameters and the additional planner/instructions/lesson-plan screens need separate passes. Embedded content in those screens, lesson text, mode instructions, audio and topic descriptions keep their content language. No Slovenian lesson availability is implied by a translated library title. The scope note in the language picker explains this staged rollout.

The small existing translator now selects CLDR plural forms using Intl.PluralRules. RU and SL messages use full sentences with named placeholders; Slovenian dual forms are covered. This does not introduce an external i18n dependency or change account-language reconciliation.

## Validation

- Full frontend suite: 190 files, 2233 tests passed.
- UI language unit suite: 8 passed, including SL/RU counts 0, 1, 2, 3, 4, 5, 11, 12, 101, 102 and a decimal.
- Three mounted navigation scenarios cover live switching, selected lesson preservation, unsaved name and hint preservation, student save/delete dialog and stable catalog filters/search.
- Production build passed.
- Changed components lint clean apart from existing HomeScreen effect/unused-prop debt; no CSS or screen-edge positioning changed.
- Chromium mobile walkthrough at 390px with simulated iOS safe areas: home/menu → students → edit and library, no page errors.

## Next

Translate the remaining adult screens and lesson setup, then localize teaching content through explicit language packages. Slovenian copy still needs native editorial review.

## Release and rollback

Deploy through the versioned PR and main CI. Baseline is 1.0.2669 (`9dd139a630a3dd27498937488ded2cf701fb108d`); keep a rollback ref before merging. No database/schema or deck ZIP changes are required.
