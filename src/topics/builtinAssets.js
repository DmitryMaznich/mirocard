const BUILTIN_ASSETS = {
  "media/avatar_streak_tracker.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fffbeb"/>
  <text x="19" y="58" font-family="Arial,sans-serif" font-size="26" fill="#f5c42c">★</text>
  <text x="44" y="44" font-family="Arial,sans-serif" font-size="26" fill="#f5c42c">★</text>
  <text x="70" y="40" font-family="Arial,sans-serif" font-size="32" fill="#f5c42c">★</text>
  <text x="96" y="44" font-family="Arial,sans-serif" font-size="26" fill="#f5c42c">★</text>
  <text x="88" y="70" font-family="Arial,sans-serif" font-size="20" fill="#fbbf24">★</text>
  <rect x="20" y="84" width="88" height="22" rx="11" fill="#4caf50"/>
  <text x="64" y="100" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="900" fill="#fff">5 ИЗ 5</text>
</svg>`,
  "media/avatar_flashcards.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f4efe6"/>
  <rect x="20" y="28" width="54" height="72" rx="12" fill="#fff" stroke="#dfc9a7" stroke-width="4" transform="rotate(-8 47 64)"/>
  <rect x="54" y="24" width="54" height="72" rx="12" fill="#fffdf7" stroke="#d7b98c" stroke-width="4" transform="rotate(6 81 60)"/>
  <circle cx="44" cy="56" r="12" fill="#ef6f5e"/>
  <rect x="66" y="45" width="26" height="8" rx="4" fill="#4a9b8f"/>
  <rect x="34" y="78" width="22" height="8" rx="4" fill="#f3c969"/>
  <rect x="66" y="68" width="18" height="18" rx="5" fill="#7bb0ff"/>
</svg>`,
  "media/avatar_comparison.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <circle cx="40" cy="66" r="24" fill="#7bb0ff"/>
  <circle cx="88" cy="58" r="16" fill="#f3c969"/>
  <path d="M61 58h12l-6 10z" fill="#1f4f8a"/>
  <path d="M52 94h40" stroke="#1f4f8a" stroke-width="8" stroke-linecap="round"/>
  <path d="M64 30l12 10H52z" fill="#ef6f5e"/>
</svg>`,
  "media/avatar.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="26" fill="#f8e7bd"/>
  <path d="M25 58 64 25l39 33v48H25z" fill="#2d6fb5"/>
  <path d="M18 61 64 21l46 40-8 10-38-33-38 33z" fill="#ef6f5e"/>
  <rect x="36" y="62" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="70" y="62" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="36" y="88" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="70" y="88" width="22" height="20" rx="5" fill="#fff"/>
  <circle cx="64" cy="45" r="13" fill="#fbbf24" stroke="#fff" stroke-width="4"/>
  <text x="64" y="50" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#422006">7</text>
</svg>`,
  "media/icons/flashcards_intro.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff8ec"/>
  <rect x="28" y="24" width="72" height="80" rx="16" fill="#fff" stroke="#e3c38e" stroke-width="4"/>
  <circle cx="64" cy="49" r="15" fill="#4a9b8f"/>
  <path d="M64 40v18M55 49h18" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
  <rect x="42" y="74" width="44" height="8" rx="4" fill="#ef6f5e"/>
</svg>`,
  "media/icons/flashcards_find_n.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eefaf5"/>
  <rect x="24" y="26" width="34" height="34" rx="8" fill="#ef6f5e"/>
  <rect x="70" y="26" width="34" height="34" rx="8" fill="#7bb0ff"/>
  <rect x="24" y="68" width="34" height="34" rx="8" fill="#f3c969"/>
  <rect x="70" y="68" width="34" height="34" rx="8" fill="#d9d6ff"/>
  <circle cx="87" cy="85" r="13" fill="none" stroke="#1f4f8a" stroke-width="6"/>
  <path d="m96 94 10 10" stroke="#1f4f8a" stroke-width="6" stroke-linecap="round"/>
</svg>`,
  "media/icons/flashcards_yes_no.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f7f7ff"/>
  <circle cx="43" cy="64" r="24" fill="#d7f5de"/>
  <circle cx="85" cy="64" r="24" fill="#fde0dd"/>
  <path d="m32 64 8 8 14-18" fill="none" stroke="#1f7a3f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m75 54 20 20M95 54 75 74" stroke="#c43d32" stroke-width="7" stroke-linecap="round"/>
</svg>`,
  "media/icons/flashcards_choose_word.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <rect x="18" y="28" width="44" height="54" rx="10" fill="#7bb0ff"/>
  <rect x="70" y="30" width="40" height="12" rx="6" fill="#4a9b8f"/>
  <rect x="70" y="52" width="28" height="12" rx="6" fill="#f3c969"/>
  <rect x="70" y="74" width="34" height="12" rx="6" fill="#ef6f5e"/>
  <path d="m79 101 10 10 20-24" fill="none" stroke="#1f7a3f" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  "media/icons/flashcards_choose_all.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f4fff7"/>
  <rect x="22" y="24" width="24" height="24" rx="6" fill="#7bb0ff"/>
  <rect x="52" y="24" width="24" height="24" rx="6" fill="#ef6f5e"/>
  <rect x="82" y="24" width="24" height="24" rx="6" fill="#f3c969"/>
  <rect x="22" y="54" width="24" height="24" rx="6" fill="#ef6f5e"/>
  <rect x="52" y="54" width="24" height="24" rx="6" fill="#4a9b8f"/>
  <rect x="82" y="54" width="24" height="24" rx="6" fill="#7bb0ff"/>
  <path d="m34 97 12 12 24-28" fill="none" stroke="#1f7a3f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m70 97 12 12 24-28" fill="none" stroke="#1f7a3f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  "media/icons/flashcards_question_answer.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff7ef"/>
  <rect x="18" y="24" width="92" height="64" rx="14" fill="#fff" stroke="#dfc9a7" stroke-width="4"/>
  <path d="M44 112v-20h24z" fill="#fff" stroke="#dfc9a7" stroke-width="4" stroke-linejoin="round"/>
  <text x="45" y="59" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#1f4f8a">?</text>
  <rect x="62" y="44" width="28" height="10" rx="5" fill="#4a9b8f"/>
  <rect x="62" y="62" width="18" height="10" rx="5" fill="#ef6f5e"/>
</svg>`,
  "media/icons/flashcards_sort_by_attribute.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f4fff7"/>
  <rect x="46" y="16" width="36" height="46" rx="8" fill="#fff" stroke="#dfc9a7" stroke-width="4"/>
  <circle cx="64" cy="34" r="9" fill="#f3c969"/>
  <rect x="54" y="48" width="20" height="6" rx="3" fill="#ef6f5e"/>
  <path d="M64 62v14M57 70l7 7 7-7" fill="none" stroke="#1f4f8a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M14 94h40l-6 18H20z" fill="#7bb0ff"/>
  <path d="M74 94h40l-6 18H80z" fill="#4a9b8f"/>
</svg>`,
  "media/icons/flashcards_probe.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <circle cx="64" cy="64" r="40" fill="none" stroke="#7bb0ff" stroke-width="7"/>
  <circle cx="64" cy="64" r="26" fill="none" stroke="#4a9b8f" stroke-width="7"/>
  <circle cx="64" cy="64" r="10" fill="#ef6f5e"/>
  <path d="M64 14v14M64 100v14M14 64h14M100 64h14" stroke="#1f4f8a" stroke-width="4" stroke-linecap="round"/>
</svg>`,
  "media/icons/flashcards_pictogram.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <circle cx="64" cy="42" r="16" fill="#1f4f8a"/>
  <path d="M64 58c-16 0-26 10-26 24h52c0-14-10-24-26-24z" fill="#1f4f8a"/>
  <rect x="50" y="80" width="10" height="30" rx="4" fill="#1f4f8a"/>
  <rect x="68" y="80" width="10" height="30" rx="4" fill="#1f4f8a"/>
</svg>`,
  "media/icons/flashcards_illustration.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff7ef"/>
  <path d="M30 96c0-30 15-52 34-52s34 22 34 52" fill="none" stroke="#263131" stroke-width="6" stroke-linecap="round"/>
  <circle cx="64" cy="46" r="20" fill="#f3d9b5" stroke="#263131" stroke-width="5"/>
  <circle cx="57" cy="44" r="3" fill="#263131"/>
  <circle cx="71" cy="44" r="3" fill="#263131"/>
  <path d="M57 53q7 5 14 0" fill="none" stroke="#263131" stroke-width="4" stroke-linecap="round"/>
  <rect x="30" y="96" width="68" height="16" rx="8" fill="#4a9b8f"/>
</svg>`,
  "media/icons/flashcards_find_person_by_name.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff7ef"/>
  <circle cx="46" cy="56" r="26" fill="#f3d9b5"/>
  <circle cx="38" cy="50" r="4" fill="#263131"/>
  <circle cx="56" cy="50" r="4" fill="#263131"/>
  <path d="M38 66q8 6 16 0" fill="none" stroke="#263131" stroke-width="4" stroke-linecap="round"/>
  <path d="M78 44q10 12 0 24" fill="none" stroke="#ef6f5e" stroke-width="6" stroke-linecap="round"/>
  <path d="M86 36q18 20 0 40" fill="none" stroke="#ef6f5e" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
  <circle cx="86" cy="90" r="16" fill="none" stroke="#1f4f8a" stroke-width="7"/>
  <path d="m97 101 14 14" stroke="#1f4f8a" stroke-width="7" stroke-linecap="round"/>
</svg>`,
  "media/avatar_sentence_puzzle.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0fdf4"/>
  <rect x="12" y="30" width="46" height="28" rx="8" fill="#7bb0ff"/>
  <circle cx="58" cy="44" r="7" fill="#7bb0ff"/>
  <rect x="65" y="30" width="51" height="28" rx="8" fill="#4a9b8f"/>
  <rect x="12" y="68" width="104" height="28" rx="8" fill="#fbbf24"/>
  <rect x="20" y="40" width="26" height="7" rx="3" fill="rgba(255,255,255,0.8)"/>
  <rect x="73" y="40" width="32" height="7" rx="3" fill="rgba(255,255,255,0.8)"/>
  <rect x="30" y="78" width="68" height="7" rx="3" fill="rgba(255,255,255,0.8)"/>
</svg>`,
  "media/icons/sentence_puzzle_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0fdf4"/>
  <rect x="14" y="18" width="44" height="24" rx="6" fill="none" stroke="#7bb0ff" stroke-width="3" stroke-dasharray="6,3"/>
  <rect x="70" y="18" width="44" height="24" rx="6" fill="none" stroke="#4a9b8f" stroke-width="3" stroke-dasharray="6,3"/>
  <rect x="10" y="66" width="42" height="24" rx="7" fill="#7bb0ff" transform="rotate(-6 31 78)"/>
  <rect x="58" y="72" width="42" height="24" rx="7" fill="#4a9b8f" transform="rotate(5 79 84)"/>
  <rect x="84" y="58" width="34" height="22" rx="7" fill="#fbbf24" transform="rotate(-4 101 69)"/>
  <path d="M36 62 L36 48" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M31 52 L36 46 L41 52" fill="none" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M79 68 L79 48" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M74 52 L79 46 L84 52" fill="none" stroke="#94a3b8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  "media/icons/listen_build_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fef9ee"/>
  <rect x="16" y="50" width="18" height="28" rx="4" fill="#374151"/>
  <path d="M34 52 L52 38 L52 90 L34 76z" fill="#374151"/>
  <path d="M59 50 Q72 64 59 78" fill="none" stroke="#fbbf24" stroke-width="6" stroke-linecap="round"/>
  <path d="M67 42 Q86 64 67 86" fill="none" stroke="#fbbf24" stroke-width="5" stroke-linecap="round" opacity="0.55"/>
  <rect x="84" y="46" width="30" height="36" rx="8" fill="#4a9b8f"/>
  <circle cx="84" cy="64" r="7" fill="#4a9b8f"/>
  <rect x="90" y="56" width="18" height="6" rx="3" fill="rgba(255,255,255,0.85)"/>
  <rect x="90" y="68" width="12" height="6" rx="3" fill="rgba(255,255,255,0.65)"/>
</svg>`,
  "media/icons/flashcards_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f4efe6"/>
  <rect x="24" y="26" width="42" height="58" rx="10" fill="#fff" stroke="#dfc9a7" stroke-width="4" transform="rotate(-6 45 55)"/>
  <rect x="60" y="34" width="42" height="58" rx="10" fill="#fffdf7" stroke="#d7b98c" stroke-width="4" transform="rotate(5 81 63)"/>
  <rect x="40" y="95" width="48" height="10" rx="5" fill="#4a9b8f"/>
</svg>`,
  "media/icons/comparison_numbers.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <text x="40" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#1f4f8a">3</text>
  <text x="88" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#ef6f5e">8</text>
  <path d="M58 64h12l-6 10z" fill="#4a9b8f"/>
</svg>`,
  "media/icons/comparison_sign.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f4fff7"/>
  <text x="34" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#1f4f8a">4</text>
  <text x="94" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#ef6f5e">2</text>
  <path d="M56 50 82 64 56 78" fill="#22c55e"/>
</svg>`,
  "media/icons/comparison_equal.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff8ec"/>
  <text x="34" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#1f4f8a">6</text>
  <text x="94" y="74" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#ef6f5e">6</text>
  <path d="M55 56h18M55 72h18" stroke="#f59e0b" stroke-width="7" stroke-linecap="round"/>
</svg>`,
  "media/icons/comparison_evaluate.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <text x="30" y="76" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#1f4f8a">5</text>
  <text x="98" y="76" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#ef6f5e">8</text>
  <rect x="51" y="49" width="26" height="30" rx="8" fill="none" stroke="#94a3b8" stroke-width="4" stroke-dasharray="5 5"/>
  <text x="64" y="73" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#94a3b8">?</text>
</svg>`,
  "media/icons/comparison_first_number.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f4fff7"/>
  <rect x="18" y="28" width="36" height="52" rx="12" fill="#dcfce7" stroke="#22c55e" stroke-width="4"/>
  <rect x="74" y="28" width="36" height="52" rx="12" fill="#fff" stroke="#cbd5e1" stroke-width="4"/>
  <text x="36" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="900" fill="#166534">7</text>
  <text x="92" y="62" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="900" fill="#1f2937">9</text>
  <rect x="24" y="92" width="80" height="14" rx="7" fill="#22c55e"/>
  <text x="64" y="103" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="800" fill="#fff">ПЕРВОЕ ЧИСЛО</text>
</svg>`,
  "media/icons/comparison_apply.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0f9ff"/>
  <rect x="24" y="76" width="22" height="30" rx="6" fill="#93c5fd"/>
  <rect x="53" y="58" width="22" height="48" rx="6" fill="#60a5fa"/>
  <rect x="82" y="34" width="22" height="72" rx="6" fill="#2563eb"/>
  <path d="M30 30h24l-8-8m8 8-8 8" fill="none" stroke="#166534" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="rotate(45 42 30)"/>
</svg>`,
  "media/icons/comparison_real_life.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fef3c7"/>
  <circle cx="38" cy="46" r="14" fill="#f59e0b"/>
  <path d="M18 96c0-16 9-26 20-26s20 10 20 26" fill="#f59e0b"/>
  <circle cx="92" cy="38" r="16" fill="#ef6f5e"/>
  <path d="M68 96c0-18 11-30 24-30s24 12 24 30" fill="#ef6f5e"/>
  <circle cx="38" cy="106" r="12" fill="#fff" stroke="#f59e0b" stroke-width="3"/>
  <text x="38" y="111" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#92400e">3</text>
  <circle cx="92" cy="106" r="12" fill="#fff" stroke="#ef6f5e" stroke-width="3"/>
  <text x="92" y="111" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#b91c1c">7</text>
</svg>`,
  "media/icons/comparison_test.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff8ec"/>
  <rect x="30" y="20" width="68" height="88" rx="10" fill="#fff" stroke="#e3c38e" stroke-width="4"/>
  <rect x="42" y="38" width="44" height="7" rx="3.5" fill="#cbd5e1"/>
  <rect x="42" y="54" width="44" height="7" rx="3.5" fill="#cbd5e1"/>
  <rect x="42" y="70" width="30" height="7" rx="3.5" fill="#cbd5e1"/>
  <circle cx="92" cy="88" r="20" fill="#22c55e"/>
  <path d="M83 88l6 7 14-15" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`,
  "media/icons/comparison_visual.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f7f7ff"/>
  <circle cx="32" cy="48" r="8" fill="#7bb0ff"/>
  <circle cx="52" cy="48" r="8" fill="#7bb0ff"/>
  <circle cx="42" cy="68" r="8" fill="#7bb0ff"/>
  <circle cx="78" cy="40" r="8" fill="#ef6f5e"/>
  <circle cx="98" cy="40" r="8" fill="#ef6f5e"/>
  <circle cx="78" cy="60" r="8" fill="#ef6f5e"/>
  <circle cx="98" cy="60" r="8" fill="#ef6f5e"/>
  <circle cx="88" cy="80" r="8" fill="#ef6f5e"/>
</svg>`,
  "media/icons/comparison_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <circle cx="36" cy="72" r="16" fill="#7bb0ff"/>
  <circle cx="92" cy="56" r="16" fill="#ef6f5e"/>
  <path d="M54 54h20l-10 16z" fill="#4a9b8f"/>
  <path d="M34 28h60" stroke="#1f4f8a" stroke-width="8" stroke-linecap="round"/>
</svg>`,
  "media/icons/math_houses_read.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#edf5ff"/>
  <path d="M28 55 64 25l36 30v50H28z" fill="#2d6fb5"/>
  <path d="M22 57 64 20l42 37-7 9-35-30-35 30z" fill="#ef6f5e"/>
  <rect x="39" y="62" width="21" height="18" rx="5" fill="#fff"/>
  <rect x="68" y="62" width="21" height="18" rx="5" fill="#fff"/>
  <rect x="39" y="86" width="21" height="18" rx="5" fill="#fff"/>
  <rect x="68" y="86" width="21" height="18" rx="5" fill="#fff"/>
  <path d="M35 114h58" stroke="#1f4f8a" stroke-width="6" stroke-linecap="round"/>
  <path d="M48 114h4m12 0h4m12 0h4" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
</svg>`,
  "media/icons/math_houses.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eefaf5"/>
  <path d="M28 55 64 25l36 30v50H28z" fill="#2d6fb5"/>
  <path d="M22 57 64 20l42 37-7 9-35-30-35 30z" fill="#ef6f5e"/>
  <rect x="37" y="63" width="22" height="19" rx="5" fill="#fff"/>
  <rect x="69" y="63" width="22" height="19" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <rect x="37" y="88" width="22" height="19" rx="5" fill="#fff"/>
  <rect x="69" y="88" width="22" height="19" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <text x="80" y="79" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#92400e">?</text>
  <text x="80" y="104" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#92400e">?</text>
</svg>`,
  "media/icons/math_houses_recall.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff4ee"/>
  <path d="M28 55 64 25l36 30v50H28z" fill="#2d6fb5"/>
  <path d="M22 57 64 20l42 37-7 9-35-30-35 30z" fill="#ef6f5e"/>
  <rect x="37" y="63" width="22" height="19" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <rect x="69" y="63" width="22" height="19" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <rect x="37" y="88" width="22" height="19" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <rect x="69" y="88" width="22" height="19" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <text x="48" y="79" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#92400e">?</text>
  <text x="80" y="79" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#92400e">?</text>
  <text x="48" y="104" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#92400e">?</text>
  <text x="80" y="104" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#92400e">?</text>
</svg>`,
  "media/icons/math_houses_selective.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f1efff"/>
  <path d="M28 55 64 25l36 30v50H28z" fill="#2d6fb5"/>
  <path d="M22 57 64 20l42 37-7 9-35-30-35 30z" fill="#8b5cf6"/>
  <rect x="37" y="64" width="22" height="20" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <rect x="69" y="64" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="37" y="89" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="69" y="89" width="22" height="20" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <path d="M62 74h4m-2-2v4M62 99h4m-2-2v4" stroke="#e9efff" stroke-width="3" stroke-linecap="round"/>
  <text x="48" y="81" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#92400e">?</text>
  <text x="80" y="106" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#92400e">?</text>
</svg>`,
  "media/icons/math_houses_grow.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0fdf4"/>
  <path d="M28 55 64 25l36 30v50H28z" fill="#2d6fb5"/>
  <path d="M22 57 64 20l42 37-7 9-35-30-35 30z" fill="#22c55e"/>
  <rect x="39" y="88" width="50" height="18" rx="5" fill="#d1fae5"/>
  <rect x="39" y="66" width="50" height="18" rx="5" fill="#d1fae5"/>
  <rect x="39" y="44" width="50" height="18" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <path d="M64 116V99M55 108l9 9 9-9" stroke="#15803d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  "media/icons/math_houses_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f8e7bd"/>
  <path d="M25 58 64 25l39 33v48H25z" fill="#2d6fb5"/>
  <path d="M18 61 64 21l46 40-8 10-38-33-38 33z" fill="#ef6f5e"/>
  <rect x="36" y="62" width="22" height="20" rx="5" fill="#fff8c7" stroke="#f59e0b" stroke-width="4"/>
  <rect x="70" y="62" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="36" y="88" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="70" y="88" width="22" height="20" rx="5" fill="#fff"/>
</svg>`,
  "media/avatar_column_addition.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0f6ff"/>
  <text x="58" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="#5b8def">1</text>
  <text x="58" y="52" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#1a1a2e">3</text>
  <text x="90" y="52" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#1a1a2e">5</text>
  <text x="26" y="78" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" font-weight="700" fill="#4a9b8f">+</text>
  <text x="58" y="78" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#1a1a2e">1</text>
  <text x="90" y="78" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#1a1a2e">7</text>
  <line x1="16" y1="86" x2="106" y2="86" stroke="#1a1a2e" stroke-width="2.5"/>
  <text x="58" y="114" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#1a1a2e">5</text>
  <text x="90" y="114" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="#1a1a2e">2</text>
</svg>`,
  "media/icons/fingers_count_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0f6ff"/>
  <path fill="#FEB16B" d="M 33.4 25.1 Q 35.8 24.7 36.4 26.0 L 37.2 28.6 L 37.5 50.8 L 37.7 55.5 L 38.4 56.7 L 38.9 57.0 L 39.8 56.3 L 43.8 32.8 L 45.8 29.8 Q 48.1 29.4 48.8 30.7 L 49.3 35.2 L 46.4 59.5 L 47.1 60.4 L 47.9 60.6 L 49.1 59.7 L 54.9 43.9 L 56.8 41.4 Q 59.2 41.0 59.6 42.3 Q 60.0 46.7 58.8 49.4 L 53.3 66.6 L 51.2 82.4 L 46.7 94.8 L 46.4 102.9 L 46.6 103.3 L 25.6 103.2 L 25.9 95.6 Q 25.5 92.1 23.4 90.4 L 21.7 89.0 L 14.3 80.0 Q 10.5 69.7 4.3 61.8 L 4.0 59.7 Q 5.0 58.1 8.1 58.5 Q 11.6 59.8 13.5 62.6 L 18.9 70.9 L 20.2 71.4 L 21.1 70.8 Q 22.9 67.8 22.2 62.4 L 18.0 37.8 L 17.7 32.8 L 19.2 30.6 L 21.0 30.3 L 22.4 31.5 L 23.8 34.9 L 28.2 55.8 L 29.2 57.0 L 30.0 57.2 L 30.6 56.8 L 31.1 51.8 L 30.9 36.5 L 31.1 28.4 L 32.9 25.3 L 33.4 25.1 Z"/>
  <path fill="#FEB16B" d="M 94.6 25.1 Q 92.2 24.7 91.6 26.0 L 90.8 28.6 L 90.5 50.8 L 90.3 55.5 L 89.6 56.7 L 89.1 57.0 L 88.2 56.3 L 84.2 32.8 L 82.2 29.8 Q 79.9 29.4 79.2 30.7 L 78.7 35.2 L 81.6 59.5 L 80.9 60.4 L 80.1 60.6 L 78.9 59.7 L 73.1 43.9 L 71.2 41.4 Q 68.8 41.0 68.4 42.3 Q 68.0 46.7 69.2 49.4 L 74.7 66.6 L 76.8 82.4 L 81.3 94.8 L 81.6 102.9 L 81.4 103.3 L 102.4 103.2 L 102.1 95.6 Q 102.5 92.1 104.6 90.4 L 106.3 89.0 L 113.7 80.0 Q 117.5 69.7 123.7 61.8 L 124.0 59.7 Q 123.0 58.1 119.9 58.5 Q 116.4 59.8 114.5 62.6 L 109.1 70.9 L 107.8 71.4 L 106.9 70.8 Q 105.1 67.8 105.8 62.4 L 110.0 37.8 L 110.3 32.8 L 108.8 30.6 L 107.0 30.3 L 105.6 31.5 L 104.2 34.9 L 99.8 55.8 L 98.8 57.0 L 98.0 57.2 L 97.4 56.8 L 96.9 51.8 L 97.1 36.5 L 96.9 28.4 L 95.1 25.3 L 94.6 25.1 Z"/>
</svg>`,
  "media/icons/fingers_show_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff4ec"/>
  <g transform="translate(-7, 10) scale(0.32)">
    <path d="M 129.346 18.054 C 121.971 22.779, 121.242 29.771, 121.088 97.250 C 121.013 130.282, 120.787 136, 119.559 136 C 118.766 136, 117.870 135.599, 117.567 135.109 C 116.762 133.806, 104.376 79.893, 101.075 63.325 C 99.521 55.528, 97.233 47.047, 95.989 44.477 C 88.747 29.517, 72 35.618, 72 53.216 C 72 58.901, 78.975 104.506, 83.590 129 C 84.989 136.425, 86.393 147.969, 86.708 154.654 L 87.283 166.809 79.395 170.453 C 67.509 175.945, 63.488 180.642, 61.123 191.799 C 56.033 215.813, 66.982 244.248, 90.078 267 C 98.812 275.605, 99.846 277.018, 101.043 282 C 102.473 287.951, 102.811 307.569, 101.616 315.250 L 100.877 320 142.757 320 L 184.637 320 184.194 306.124 C 183.611 287.832, 184.827 281.322, 191.505 267 C 200.570 247.556, 202.972 235.353, 208.493 180.671 C 212.229 143.670, 211.875 137.942, 205.458 131.524 C 200.967 127.034, 195.209 125.264, 189.793 126.710 L 185.757 127.787 186.394 123.143 C 189.359 101.521, 194.098 53.183, 193.796 47.637 C 193.329 39.069, 189 34, 182.150 34 C 173.640 34, 169.715 40.546, 166.975 59.306 C 165.916 66.563, 163.740 79.700, 162.141 88.500 C 160.542 97.300, 158.440 110.350, 157.471 117.500 C 154.503 139.402, 152.053 140.970, 152 121 C 151.954 103.666, 149.135 30.411, 148.392 27.257 C 146.065 17.374, 137.139 13.061, 129.346 18.054" fill="#FBBF8A"/>
    <path d="M 134.073 16.782 C 130.507 17.375, 127.103 19.900, 125.380 23.232 C 122.405 28.985, 121.853 38.746, 121.832 86 C 121.809 135.551, 121.742 137, 119.468 137 C 117.172 137, 116.376 134.486, 109.944 106.915 C 103.888 80.953, 102.807 75.995, 99.495 59 C 96.469 43.468, 91.763 36.497, 84.445 36.704 C 73.454 37.016, 70.752 46.936, 74.834 72 C 75.954 78.875, 77.160 86.525, 77.515 89 C 78.174 93.603, 82.573 119.361, 85.456 135.500 C 86.341 140.450, 87.328 149.543, 87.651 155.707 L 88.238 166.915 79.881 170.999 C 67.418 177.089, 63.912 181.044, 61.927 191.251 C 58.047 211.209, 64.731 235.621, 79.150 254.155 C 83.037 259.151, 87.608 263.849, 96.329 271.810 C 101.674 276.689, 102.500 280.698, 102.500 301.750 L 102.499 320 143.207 320 L 183.915 320 183.352 307.750 C 182.521 289.663, 183.897 282.043, 190.597 267.616 C 197.920 251.849, 201.810 235.323, 204.985 206.500 C 205.591 201, 206.266 194.925, 206.484 193 C 207.522 183.880, 208.013 178.882, 208.596 171.500 C 208.944 167.100, 209.417 163.182, 209.647 162.793 C 209.877 162.404, 210.120 157.387, 210.187 151.644 C 210.295 142.482, 210.015 140.609, 207.905 136.351 C 203.897 128.266, 193.697 124.347, 187.400 128.473 L 184.847 130.147 185.488 124.823 C 185.841 121.895, 186.291 118.375, 186.488 117 C 186.855 114.440, 187.865 105.637, 188.611 98.500 C 188.841 96.300, 189.208 92.925, 189.426 91 C 189.645 89.075, 190.106 84.575, 190.450 81 C 190.795 77.425, 191.658 70, 192.367 64.500 C 193.957 52.164, 193.718 45.315, 191.536 40.717 C 188.532 34.386, 179.932 32.774, 174.897 37.598 C 170.854 41.472, 169.678 45.604, 166.387 67.500 C 166.139 69.150, 164.630 77.925, 163.034 87 C 161.437 96.075, 159.395 108.675, 158.495 115 C 157.595 121.325, 156.630 128.075, 156.350 130 C 156.070 131.925, 155.221 134.140, 154.462 134.923 C 151.883 137.584, 151.293 132.216, 150.518 99 C 150.101 81.125, 149.645 62.900, 149.505 58.500 C 149.365 54.100, 149.134 46.225, 148.992 41 C 148.731 31.440, 147.127 23.981, 144.639 20.761 C 142.851 18.447, 137.096 16.280, 134.073 16.782 M 130.289 20.772 C 124.452 25.334, 124.009 30.664, 123.679 100.291 L 123.500 138.082 129 137.312 C 132.025 136.889, 138.166 136.609, 142.647 136.691 L 150.794 136.839 149.993 133.669 C 149.552 131.926, 148.913 118.125, 148.573 103 C 147.787 68.096, 146.215 30.310, 145.403 26.774 C 143.853 20.034, 135.486 16.711, 130.289 20.772 M 175.615 40.045 C 172.534 43.707, 171.523 47.223, 169.587 61 C 168.775 66.775, 166.990 77.575, 165.620 85 C 164.250 92.425, 161.966 106.309, 160.544 115.853 C 159.123 125.398, 157.519 134.031, 156.980 135.038 C 155.385 138.018, 155.785 138.619, 160.250 139.953 C 162.588 140.651, 166.170 142.073, 168.210 143.111 C 173.370 145.738, 173.246 145.801, 178.213 138.022 C 182.609 131.137, 182.692 130.846, 184.402 116.272 C 189.689 71.223, 191.698 49.819, 190.999 45.993 C 189.369 37.083, 180.873 33.797, 175.615 40.045 M 79.127 41.096 C 76.013 43.998, 75 47.160, 75 53.983 C 75 59.847, 81.593 103.214, 86.481 129.500 C 87.913 137.200, 89.359 148.563, 89.695 154.750 C 90.031 160.938, 90.476 166, 90.685 166 C 90.893 166, 95.437 163.780, 100.782 161.066 C 115.566 153.561, 114.399 153.794, 139 153.428 C 164.190 153.053, 164.707 153.118, 166.146 156.836 C 167.160 159.455, 167.225 159.399, 169.969 153.500 L 172.759 147.500 170.704 146 C 155.659 135.021, 114.658 135.898, 96.750 147.582 C 94.688 148.927, 93 149.578, 93 149.029 C 93 148.479, 95.588 146.731, 98.750 145.145 C 104.621 142.200, 105.354 141.932, 112.748 140.021 C 116.891 138.951, 116.959 138.867, 115.489 136.624 C 114.660 135.359, 113.059 130.088, 111.932 124.912 C 110.804 119.735, 107.852 106.950, 105.372 96.500 C 102.891 86.050, 99.803 71.795, 98.510 64.823 C 94.991 45.853, 91.323 39, 84.689 39 C 82.709 39, 80.472 39.843, 79.127 41.096 M 187.350 130.928 C 182.937 133.619, 178.954 139.806, 170.937 156.420 C 163.353 172.139, 162.728 175.335, 166.452 179.354 C 172.613 186.002, 181.081 181.442, 188.008 167.746 C 190.274 163.267, 193.627 157.941, 195.461 155.911 C 197.295 153.882, 199.099 151.265, 199.470 150.096 C 199.840 148.927, 200.535 148.212, 201.012 148.508 C 202.508 149.432, 200.064 154.545, 196.456 158.043 C 193.667 160.746, 191.954 163.937, 193.250 164.015 C 195.157 164.130, 200.993 166.886, 200.273 167.332 C 199.735 167.664, 197.639 167.091, 195.615 166.058 L 191.934 164.182 188.568 170.841 C 184.670 178.554, 181.685 181.656, 176.422 183.466 C 169.776 185.751, 163.634 182.419, 162.312 175.812 C 161.615 172.325, 161.529 172.328, 157.347 176 C 155.468 177.650, 153.496 179, 152.965 179 C 152.434 179, 152 179.411, 152 179.912 C 152 181.302, 167.060 186.754, 180.500 190.231 C 187.100 191.939, 192.950 193.742, 193.500 194.239 C 194.681 195.305, 192.855 194.897, 176.197 190.370 C 169.430 188.530, 160.880 185.707, 157.197 184.096 L 150.500 181.167 143 183.682 C 138.875 185.066, 135.390 186.301, 135.255 186.428 C 135.120 186.554, 138.490 188.862, 142.744 191.557 C 152.823 197.941, 162.412 206.255, 167.891 213.358 C 174.202 221.540, 172.451 221.251, 165.708 212.998 C 156.232 201.398, 136.191 187, 129.522 187 C 127.990 187, 125.252 187.917, 123.437 189.039 L 120.139 191.077 124.821 197.289 C 130.223 204.454, 135.149 214.677, 137.693 224 C 139.873 231.987, 140.159 255.122, 138.161 261.851 C 136.139 268.657, 135.881 266.207, 137.643 256.936 C 141.509 236.591, 134.940 210.666, 122.258 196.219 L 118.500 191.939 113.239 193.969 C 107.676 196.117, 101 196.679, 101 195 C 101 194.450, 102.688 194.001, 104.750 194.002 C 107.074 194.003, 112.113 192.334, 118 189.614 C 123.225 187.199, 130.425 184.697, 134 184.053 C 146.665 181.770, 160.363 173.097, 163.648 165.282 C 165.714 160.364, 165.276 159.660, 162.250 163.037 C 159.718 165.862, 154.534 167.911, 149.750 167.976 C 146.702 168.018, 144 164.336, 144 160.142 L 144 156.283 132.181 155.592 C 118.151 154.771, 116.555 155.190, 98 164.550 C 91.125 168.019, 83.001 171.950, 79.946 173.286 C 66.867 179.009, 63.500 185.195, 63.500 203.500 C 63.500 227.316, 72.031 245.454, 92.661 265.500 C 104.503 277.007, 105.382 279.688, 104.852 302.676 L 104.499 318 143 318 L 181.500 317.999 181.502 301.250 C 181.503 282.634, 182.087 279.899, 189.024 266 C 197.148 249.725, 200.383 232.917, 206.057 177.500 C 209.537 143.513, 208.942 137.144, 201.804 131.973 C 196.939 128.449, 192.001 128.092, 187.350 130.928 M 150.250 154.737 L 145 155.105 145 159.052 C 145 165.597, 148.304 167.920, 154.917 166.024 C 164.357 163.317, 166.147 153.154, 157 154.199 C 156.175 154.293, 153.137 154.535, 150.250 154.737 M 169.783 165.750 C 163.373 173.099, 165.726 180.630, 174.179 179.819 C 180.093 179.251, 182.853 169.996, 178.427 165.570 C 176.335 163.478, 171.681 163.575, 169.783 165.750 M 170.051 167.662 C 166.959 171.593, 166.451 174.736, 168.536 177.040 C 171.111 179.885, 175.573 179.581, 177.644 176.421 C 182.562 168.915, 175.486 160.752, 170.051 167.662" fill="#5b280f" fill-rule="evenodd"/>
  </g>
  <text x="96" y="80" text-anchor="middle" font-family="Arial,sans-serif" font-size="54" font-weight="900" fill="#1a1a2e">3</text>
</svg>`,
  "media/icons/column_copy_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef3ff"/>
  <rect x="14" y="14" width="100" height="100" rx="10" fill="#fff" stroke="#c3cff5" stroke-width="3"/>
  <line x1="66" y1="18" x2="66" y2="110" stroke="#e8eeff" stroke-width="1.5"/>
  <line x1="18" y1="66" x2="110" y2="66" stroke="#e8eeff" stroke-width="1.5"/>
  <text x="56" y="36" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1a1a2e">35</text>
  <text x="22" y="48" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#4a9b8f">+</text>
  <text x="56" y="48" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1a1a2e">12</text>
  <line x1="22" y1="52" x2="58" y2="52" stroke="#1a1a2e" stroke-width="2"/>
  <line x1="40" y1="60" x2="56" y2="60" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,2"/>
  <text x="104" y="36" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1a1a2e">47</text>
  <text x="70" y="48" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#4a9b8f">+</text>
  <text x="104" y="48" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1a1a2e">25</text>
  <line x1="70" y1="52" x2="106" y2="52" stroke="#1a1a2e" stroke-width="2"/>
  <line x1="88" y1="60" x2="104" y2="60" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,2"/>
  <text x="56" y="82" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1a1a2e">63</text>
  <text x="22" y="94" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#ef4444">−</text>
  <text x="56" y="94" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1a1a2e">31</text>
  <line x1="22" y1="98" x2="58" y2="98" stroke="#1a1a2e" stroke-width="2"/>
  <line x1="40" y1="106" x2="56" y2="106" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,2"/>
  <text x="104" y="82" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1a1a2e">78</text>
  <text x="70" y="94" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#ef4444">−</text>
  <text x="104" y="94" text-anchor="end" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#1a1a2e">42</text>
  <line x1="70" y1="98" x2="106" y2="98" stroke="#1a1a2e" stroke-width="2"/>
  <line x1="88" y1="106" x2="104" y2="106" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,2"/>
</svg>`,
  "media/icons/column_addition_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef3ff"/>
  <rect x="20" y="18" width="88" height="92" rx="12" fill="#fff" stroke="#c3cff5" stroke-width="3"/>
  <rect x="52" y="26" width="24" height="24" rx="5" fill="#f0f4ff" stroke="#c3cff5" stroke-width="1.5"/>
  <text x="64" y="44" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#1a1a2e">4</text>
  <rect x="78" y="26" width="24" height="24" rx="5" fill="#f0f4ff" stroke="#c3cff5" stroke-width="1.5"/>
  <text x="90" y="44" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#1a1a2e">7</text>
  <text x="38" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="900" fill="#4a9b8f">+</text>
  <rect x="52" y="50" width="24" height="24" rx="5" fill="#f0f4ff" stroke="#c3cff5" stroke-width="1.5"/>
  <text x="64" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#1a1a2e">3</text>
  <rect x="78" y="50" width="24" height="24" rx="5" fill="#f0f4ff" stroke="#c3cff5" stroke-width="1.5"/>
  <text x="90" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#1a1a2e">5</text>
  <line x1="28" y1="80" x2="108" y2="80" stroke="#1a1a2e" stroke-width="3"/>
  <rect x="52" y="84" width="24" height="24" rx="5" fill="#dcfce7" stroke="#86efac" stroke-width="1.5"/>
  <text x="64" y="102" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#059669">8</text>
  <rect x="78" y="84" width="24" height="24" rx="5" fill="#dcfce7" stroke="#86efac" stroke-width="1.5"/>
  <text x="90" y="102" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#059669">2</text>
</svg>`,
  "media/icons/place_value_build.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff8ec"/>
  <rect x="30" y="12" width="68" height="34" rx="10" fill="#ffffff" stroke="#e4c98a" stroke-width="3"/>
  <text x="64" y="36" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" font-weight="900" fill="#1a1a2e">24</text>
  <path d="M42 76V54" stroke="#c9a227" stroke-width="4" stroke-linecap="round"/>
  <path d="M36 60 42 52 48 60" fill="none" stroke="#c9a227" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M86 76V54" stroke="#2563eb" stroke-width="4" stroke-linecap="round"/>
  <path d="M80 60 86 52 92 60" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="24" y="80" width="36" height="36" rx="9" fill="#fffaf0" stroke="#d9a441" stroke-width="3"/>
  <text x="42" y="104" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="900" fill="#92400e">10</text>
  <rect x="68" y="80" width="36" height="36" rx="9" fill="#93c5fd" stroke="#2563eb" stroke-width="3"/>
  <text x="86" y="104" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="900" fill="#1e3a8a">1</text>
</svg>`,
  "media/icons/place_value_identify.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <rect x="24" y="20" width="34" height="34" rx="8" fill="#fffaf0" stroke="#d9a441" stroke-width="3"/>
  <text x="41" y="43" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="900" fill="#92400e">10</text>
  <rect x="70" y="20" width="34" height="34" rx="8" fill="#93c5fd" stroke="#2563eb" stroke-width="3"/>
  <text x="87" y="43" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" font-weight="900" fill="#1e3a8a">1</text>
  <rect x="28" y="70" width="32" height="38" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="3" stroke-dasharray="4,3"/>
  <text x="44" y="97" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="900" fill="#64748b">?</text>
  <rect x="68" y="70" width="32" height="38" rx="8" fill="#ffffff" stroke="#94a3b8" stroke-width="3" stroke-dasharray="4,3"/>
  <text x="84" y="97" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="900" fill="#64748b">?</text>
</svg>`,
  "media/icons/place_value_regroup.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fef9ee"/>
  <rect x="12" y="46" width="40" height="40" rx="9" fill="#fffaf0" stroke="#d9a441" stroke-width="3"/>
  <text x="32" y="72" text-anchor="middle" font-family="Arial,sans-serif" font-size="19" font-weight="900" fill="#92400e">10</text>
  <path d="M56 66h16" stroke="#c9a227" stroke-width="4" stroke-linecap="round"/>
  <path d="M66 60 74 66 66 72" fill="none" stroke="#c9a227" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="74" y="57" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
  <rect x="84" y="57" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
  <rect x="94" y="57" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
  <rect x="104" y="57" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
  <rect x="114" y="57" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
  <rect x="74" y="67" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
  <rect x="84" y="67" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
  <rect x="94" y="67" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
  <rect x="104" y="67" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
  <rect x="114" y="67" width="8" height="8" rx="2" fill="#60a5fa" stroke="#2563eb" stroke-width="1"/>
</svg>`,
  "media/avatar_operations.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eefaf5"/>
  <rect x="20" y="32" width="88" height="52" rx="18" fill="#ffffff" stroke="#c9dfdb" stroke-width="4"/>
  <path d="M28 64h72" stroke="#9fb8b4" stroke-width="5" stroke-linecap="round"/>
  <circle cx="42" cy="64" r="10" fill="#4a9b8f"/>
  <circle cx="64" cy="64" r="10" fill="#4a9b8f"/>
  <circle cx="86" cy="64" r="10" fill="#ef6f5e"/>
  <text x="44" y="108" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#1f7a6f">+</text>
  <text x="84" y="106" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="#c04040">-</text>
</svg>`,
  "media/icons/operations_action_from_sign.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eefaf5"/>
  <rect x="20" y="26" width="88" height="44" rx="14" fill="#fff" stroke="#c9dfdb" stroke-width="4"/>
  <text x="64" y="59" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="900" fill="#1f7a6f">+</text>
  <path d="M37 92h44" stroke="#4a9b8f" stroke-width="8" stroke-linecap="round"/>
  <path d="M75 80 95 92 75 104" fill="none" stroke="#4a9b8f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  "media/icons/operations_sign_from_action.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff7ed"/>
  <circle cx="38" cy="64" r="11" fill="#4a9b8f"/>
  <circle cx="64" cy="64" r="11" fill="#4a9b8f"/>
  <path d="M82 64h22" stroke="#ef6f5e" stroke-width="8" stroke-linecap="round"/>
  <text x="64" y="106" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#1f4f8a">?</text>
</svg>`,
  "media/icons/operations_more_less.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <circle cx="36" cy="70" r="10" fill="#7bb0ff"/>
  <circle cx="58" cy="70" r="10" fill="#7bb0ff"/>
  <circle cx="80" cy="70" r="10" fill="#f3c969"/>
  <path d="M36 38h26m-13-13v26" stroke="#1f7a6f" stroke-width="8" stroke-linecap="round"/>
  <path d="M75 38h28" stroke="#c04040" stroke-width="8" stroke-linecap="round"/>
</svg>`,
  "media/icons/operations_result.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f7f7ff"/>
  <text x="35" y="69" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#1f4f8a">3</text>
  <text x="62" y="69" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#1f7a6f">+</text>
  <text x="89" y="69" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#ef6f5e">2</text>
  <path d="M31 91h66" stroke="#d0dedd" stroke-width="7" stroke-linecap="round"/>
  <text x="64" y="109" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#263131">?</text>
</svg>`,
  "media/icons/operations_missing_sign.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff8ec"/>
  <text x="30" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#1f4f8a">6</text>
  <text x="62" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#c07a20">?</text>
  <text x="94" y="72" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#ef6f5e">2</text>
  <path d="M39 96h18m-9-9v18" stroke="#1f7a6f" stroke-width="7" stroke-linecap="round"/>
  <path d="M74 96h22" stroke="#c04040" stroke-width="7" stroke-linecap="round"/>
</svg>`,
  "media/icons/operations_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eefaf5"/>
  <rect x="22" y="36" width="84" height="46" rx="16" fill="#fff" stroke="#c9dfdb" stroke-width="4"/>
  <circle cx="42" cy="59" r="9" fill="#4a9b8f"/>
  <circle cx="62" cy="59" r="9" fill="#4a9b8f"/>
  <circle cx="82" cy="59" r="9" fill="#ef6f5e"/>
  <text x="45" y="108" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="900" fill="#1f7a6f">+</text>
  <text x="84" y="106" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="900" fill="#c04040">-</text>
</svg>`,
  "media/avatar_reading.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f5f0ff"/>
  <rect x="25" y="24" width="78" height="84" rx="12" fill="#fff" stroke="#c8bde8" stroke-width="4"/>
  <path d="M43 45h42M43 62h34M43 79h42" stroke="#4a9b8f" stroke-width="8" stroke-linecap="round"/>
  <circle cx="39" cy="96" r="11" fill="#f3c969"/>
  <path d="M35 96h8m-4-4v8" stroke="#8a5a10" stroke-width="4" stroke-linecap="round"/>
</svg>`,
  "media/icons/reading_read.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0fdf4"/>
  <rect x="22" y="30" width="84" height="68" rx="14" fill="#fff" stroke="#b7dccf" stroke-width="4"/>
  <path d="M40 52h48M40 69h36" stroke="#4a9b8f" stroke-width="8" stroke-linecap="round"/>
  <path d="M36 99h56" stroke="#f3c969" stroke-width="8" stroke-linecap="round"/>
</svg>`,
  "media/icons/reading_understand.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <rect x="22" y="28" width="84" height="58" rx="14" fill="#fff" stroke="#b7cce8" stroke-width="4"/>
  <text x="48" y="66" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#2d6fb5">?</text>
  <path d="M67 50h24M67 68h16" stroke="#4a9b8f" stroke-width="8" stroke-linecap="round"/>
  <path d="m44 101 10 10 28-32" fill="none" stroke="#22c55e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  "media/icons/reading_assemble.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff8ec"/>
  <rect x="22" y="28" width="84" height="18" rx="9" fill="#e6d8c4"/>
  <rect x="22" y="56" width="34" height="18" rx="9" fill="#4a9b8f"/>
  <rect x="62" y="56" width="44" height="18" rx="9" fill="#f3c969"/>
  <rect x="31" y="88" width="26" height="18" rx="9" fill="#fff" stroke="#cbbca8" stroke-width="4"/>
  <rect x="65" y="88" width="32" height="18" rx="9" fill="#fff" stroke="#cbbca8" stroke-width="4"/>
</svg>`,
  "media/icons/sort_letters.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0fdf4"/>
  <rect x="8" y="48" width="52" height="68" rx="10" fill="#d1fae5" stroke="#10b981" stroke-width="2.5"/>
  <rect x="68" y="48" width="52" height="68" rx="10" fill="#fee2e2" stroke="#ef4444" stroke-width="2.5"/>
  <text x="34" y="96" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" fill="#059669" font-weight="900">А</text>
  <text x="94" y="96" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" fill="#dc2626" font-weight="900">Б</text>
  <rect x="44" y="8" width="40" height="32" rx="7" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>
  <text x="64" y="31" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#374151" font-weight="900">В</text>
  <path d="M64 42 L64 50 M59 47 L64 53 L69 47" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`,
  "media/icons/written_sort_case.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f0f4ff"/>
  <rect x="8" y="52" width="52" height="64" rx="10" fill="#ede9fe" stroke="#6366f1" stroke-width="2.5"/>
  <rect x="68" y="52" width="52" height="64" rx="10" fill="#e0f2fe" stroke="#0ea5e9" stroke-width="2.5"/>
  <text x="34" y="99" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="38" fill="#4338ca" font-weight="bold">А</text>
  <text x="94" y="104" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="28" fill="#0369a1">а</text>
  <rect x="46" y="8" width="36" height="32" rx="7" fill="#fff" stroke="#b8d8e8" stroke-width="2"/>
  <text x="64" y="30" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="20" fill="#1d4ed8">Б</text>
  <path d="M64 42 L64 50 M59 47 L64 53 L69 47" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`,
  "media/icons/written_match_print.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f8faff"/>
  <rect x="10" y="28" width="48" height="72" rx="10" fill="#fff" stroke="#94a3b8" stroke-width="2.5"/>
  <line x1="16" y1="60" x2="52" y2="60" stroke="#6ab4cc" stroke-width="1"/>
  <line x1="16" y1="73" x2="52" y2="73" stroke="#2a82a0" stroke-width="1.5"/>
  <text x="34" y="73" text-anchor="middle" font-family="Arial,sans-serif" font-size="30" fill="#1e293b" font-weight="900">А</text>
  <path d="M62 64 L74 64 M70 59 L75 64 L70 69" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="78" y="18" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <rect x="104" y="18" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <rect x="78" y="50" width="22" height="24" rx="5" fill="#dcfce7" stroke="#16a34a" stroke-width="2.5"/>
  <rect x="104" y="50" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <rect x="78" y="82" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <rect x="104" y="82" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <text x="89" y="66" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="14" fill="#15803d" font-weight="bold">А</text>
</svg>`,
  "media/icons/written_match_written.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f8faff"/>
  <rect x="10" y="28" width="48" height="72" rx="10" fill="#fefef6" stroke="#b8d8e8" stroke-width="2.5"/>
  <line x1="16" y1="60" x2="52" y2="60" stroke="#6ab4cc" stroke-width="1"/>
  <line x1="16" y1="73" x2="52" y2="73" stroke="#2a82a0" stroke-width="1.5"/>
  <text x="34" y="73" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="28" fill="#1d4ed8" font-weight="bold">А</text>
  <path d="M62 64 L74 64 M70 59 L75 64 L70 69" stroke="#94a3b8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="78" y="18" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <rect x="104" y="18" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <rect x="78" y="50" width="22" height="24" rx="5" fill="#dcfce7" stroke="#16a34a" stroke-width="2.5"/>
  <rect x="104" y="50" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <rect x="78" y="82" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <rect x="104" y="82" width="22" height="24" rx="5" fill="#f1f5f9"/>
  <text x="89" y="66" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#15803d" font-weight="900">А</text>
</svg>`,
  "media/icons/written_match_pair.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff7ed"/>
  <rect x="10" y="30" width="46" height="60" rx="10" fill="#fefef6" stroke="#b8d8e8" stroke-width="2"/>
  <line x1="16" y1="60" x2="50" y2="60" stroke="#6ab4cc" stroke-width="1"/>
  <line x1="16" y1="72" x2="50" y2="72" stroke="#2a82a0" stroke-width="1.5"/>
  <text x="33" y="72" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="30" fill="#1d4ed8" font-weight="bold">А</text>
  <rect x="72" y="30" width="46" height="60" rx="10" fill="#fefef6" stroke="#b8d8e8" stroke-width="2"/>
  <line x1="78" y1="60" x2="112" y2="60" stroke="#6ab4cc" stroke-width="1"/>
  <line x1="78" y1="72" x2="112" y2="72" stroke="#2a82a0" stroke-width="1.5"/>
  <text x="95" y="72" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="22" fill="#1d4ed8">а</text>
  <path d="M58 58 L70 58 M62 53 L56 58 L62 63" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M58 72 L70 72 M66 67 L72 72 L66 77" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`,
  "media/icons/reading_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f5f0ff"/>
  <rect x="28" y="28" width="72" height="72" rx="14" fill="#fff" stroke="#c8bde8" stroke-width="4"/>
  <path d="M44 52h40M44 68h30M44 84h40" stroke="#4a9b8f" stroke-width="7" stroke-linecap="round"/>
</svg>`,
  "media/icons/safe_code_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fbf3e3"/>
  <rect x="24" y="20" width="80" height="88" rx="10" fill="#8a6329" stroke="#5c421a" stroke-width="4"/>
  <rect x="34" y="30" width="60" height="68" rx="6" fill="#b8873f"/>
  <circle cx="64" cy="56" r="16" fill="#fbf3e3" stroke="#5c421a" stroke-width="4"/>
  <circle cx="64" cy="56" r="4" fill="#5c421a"/>
  <rect x="60" y="60" width="8" height="14" rx="2" fill="#5c421a"/>
  <rect x="46" y="84" width="36" height="8" rx="4" fill="#fbf3e3" opacity="0.8"/>
</svg>`,
  "media/icons/reading_daily_sentences.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff4ee"/>
  <rect x="20" y="24" width="72" height="60" rx="12" fill="#fff" stroke="#f0c9a8" stroke-width="4"/>
  <path d="M34 44h44M34 58h32M34 72h44" stroke="#ef6f5e" stroke-width="7" stroke-linecap="round"/>
  <circle cx="96" cy="90" r="22" fill="#4a9b8f"/>
  <path d="M86 90 93 98 108 80" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  // Прописи (propis) topic avatar -- 2026-08-20. Solid illustrated icon (cream card, ruled
  // notebook page, cursive wave, pencil accent) -- kept as the ORIGINAL well-received design
  // (a later transparent-line-on-color-gradient variant was tried for the topic-catalog tile
  // specifically, but that whole tile treatment was reverted, and the transparent style also
  // read as illegible on the plain/transparent HomeScreen avatar bubble background, which
  // this same asset feeds too -- see TopicCover usage in HomeScreen.jsx).
  "media/avatar_propis.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="26" fill="#f7ecd8"/>
  <rect x="16" y="16" width="96" height="96" rx="12" fill="#fffdf8" stroke="#e3cfa0" stroke-width="3"/>
  <path d="M28 42h72" stroke="#e3cfa0" stroke-width="1.5" opacity="0.6"/>
  <path d="M28 60h72" stroke="#bcd8ec" stroke-width="2"/>
  <path d="M28 84h72" stroke="#bcd8ec" stroke-width="2"/>
  <path d="M28 102h72" stroke="#e3cfa0" stroke-width="1.5" opacity="0.6"/>
  <path d="M32 78c5-16 11-16 16 0s11 16 16 0 11-16 16 0" fill="none" stroke="#1d4ed8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <g transform="rotate(40 100 32)">
    <rect x="92" y="4" width="13" height="44" rx="6" fill="#ef6f5e"/>
    <path d="M92 44h13l-6.5 13z" fill="#fbbf24"/>
    <circle cx="98.5" cy="10" r="3.5" fill="#fff" opacity="0.55"/>
  </g>
</svg>`,
  // Прописи (propis) mode icons -- restored 2026-08-21 (originally added 2026-08-20 in
  // f50f5670, then reverted along with an unrelated topic-catalog-tile experiment; the
  // topic.json "icon" fields were dropped at the same time and are added back alongside
  // this). Shared visual language across all four: a ruled notebook card (echoing
  // propisRuling.js's own thin/bold horizontal lines) and the same continuous wavy stroke
  // standing in for real cursive ink (INK_COLOR #1d4ed8), rather than an actual glyph, which
  // stays legible/recognizable at icon scale a rendered letterform wouldn't. Each mode's row
  // count/keyboard hint differentiates it from the others at a glance -- one wave (single
  // letter/word) vs three (a whole text) vs a screen-to-paper arrow (copying, not typing).
  "media/icons/propis_practice.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eaf2fb"/>
  <rect x="18" y="18" width="92" height="92" rx="14" fill="#fffdf8" stroke="#bcd8ec" stroke-width="3"/>
  <path d="M30 60h68" stroke="#dcebf6" stroke-width="2"/>
  <path d="M30 86h68" stroke="#6fa3e0" stroke-width="2.6"/>
  <path d="M46 86c-2-14 6-24 18-24 10 0 17 8 17 18s-7 16-15 16c-7 0-12-5-12-12s5-11 11-11" fill="none" stroke="#1d4ed8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  "media/icons/propis_write_words.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eaf2fb"/>
  <rect x="16" y="16" width="96" height="62" rx="12" fill="#fffdf8" stroke="#bcd8ec" stroke-width="3"/>
  <path d="M28 60h72" stroke="#6fa3e0" stroke-width="2.4"/>
  <path d="M32 58c3-12 8-12 11 0s8 12 11 0 8-12 11 0 8 12 11 0 8-12 11 0" fill="none" stroke="#1d4ed8" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="#8d8177">
    <rect x="20" y="90" width="16" height="14" rx="4"/>
    <rect x="40" y="90" width="16" height="14" rx="4"/>
    <rect x="60" y="90" width="16" height="14" rx="4"/>
    <rect x="80" y="90" width="16" height="14" rx="4"/>
  </g>
</svg>`,
  "media/icons/propis_write_text.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eaf2fb"/>
  <rect x="16" y="12" width="96" height="66" rx="12" fill="#fffdf8" stroke="#bcd8ec" stroke-width="3"/>
  <path d="M28 34h72M28 54h72M28 74h56" stroke="#6fa3e0" stroke-width="2.2"/>
  <path d="M32 32c2-8 6-8 8 0s6 8 8 0 6-8 8 0 6 8 8 0 6-8 8 0 6 8 8 0" fill="none" stroke="#1d4ed8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 52c2-8 6-8 8 0s6 8 8 0 6-8 8 0 6 8 8 0 6-8 8 0" fill="none" stroke="#1d4ed8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 72c2-8 6-8 8 0s6 8 8 0 6-8 8 0" fill="none" stroke="#1d4ed8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="#8d8177">
    <rect x="20" y="90" width="16" height="14" rx="4"/>
    <rect x="40" y="90" width="16" height="14" rx="4"/>
    <rect x="60" y="90" width="16" height="14" rx="4"/>
    <rect x="80" y="90" width="16" height="14" rx="4"/>
  </g>
</svg>`,
  "media/icons/propis_read_text.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eaf2fb"/>
  <rect x="20" y="10" width="88" height="58" rx="10" fill="#2b2b2b"/>
  <rect x="26" y="16" width="76" height="46" rx="4" fill="#fffdf8"/>
  <path d="M34 34h60M34 48h44" stroke="#6fa3e0" stroke-width="2.2"/>
  <path d="M38 32c2-6 5-6 7 0s5 6 7 0 5-6 7 0 5 6 7 0 5-6 7 0" fill="none" stroke="#1d4ed8" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M64 70v20" stroke="#ef6f5e" stroke-width="6" stroke-linecap="round"/>
  <path d="M52 84l12 14 12-14z" fill="#ef6f5e"/>
  <rect x="24" y="104" width="80" height="18" rx="4" fill="#fffdf8" stroke="#bcd8ec" stroke-width="2.5"/>
  <path d="M32 113c2-4 4-4 6 0s4 4 6 0 4-4 6 0 4 4 6 0 4-4 6 0 4 4 6 0 4-4 6 0" fill="none" stroke="#1d4ed8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
};

const TOPIC_AVATAR_VARIANTS = {
  clothes_basic: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#fff7ed"/>
  <circle cx="92" cy="34" r="14" fill="#fdba74"/>
  <path d="M40 28h48l12 18-16 12-9-10v48H53V48l-9 10-16-12z" fill="#fb7185"/>
  <path d="M50 28h28v14H50z" fill="#fff"/>
  <path d="M58 66h12" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
</svg>`,
  emotions_v2: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eefaf5"/>
  <circle cx="44" cy="64" r="22" fill="#fbbf24"/>
  <circle cx="88" cy="64" r="22" fill="#60a5fa"/>
  <circle cx="37" cy="57" r="3.5" fill="#1f2937"/>
  <circle cx="51" cy="57" r="3.5" fill="#1f2937"/>
  <path d="M34 72c5 8 15 8 20 0" fill="none" stroke="#1f2937" stroke-width="5" stroke-linecap="round"/>
  <circle cx="81" cy="57" r="3.5" fill="#1f2937"/>
  <circle cx="95" cy="57" r="3.5" fill="#1f2937"/>
  <path d="M78 78c3-9 19-9 22 0" fill="none" stroke="#1f2937" stroke-width="5" stroke-linecap="round"/>
</svg>`,
  tools_basic: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eff6ff"/>
  <rect x="24" y="80" width="80" height="14" rx="7" fill="#cbd5e1"/>
  <path d="M50 34 74 58 64 68 40 44z" fill="#94a3b8"/>
  <path d="M68 28h18v26H68z" fill="#f59e0b"/>
  <path d="M74 54 94 74" stroke="#475569" stroke-width="10" stroke-linecap="round"/>
  <path d="M44 68 68 44" stroke="#0f766e" stroke-width="12" stroke-linecap="round"/>
  <circle cx="39" cy="73" r="8" fill="#14b8a6"/>
</svg>`,
  transport_photo: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#ecfeff"/>
  <rect x="22" y="42" width="84" height="34" rx="14" fill="#38bdf8"/>
  <rect x="34" y="52" width="20" height="12" rx="4" fill="#e0f2fe"/>
  <rect x="58" y="52" width="20" height="12" rx="4" fill="#e0f2fe"/>
  <rect x="82" y="52" width="12" height="12" rx="4" fill="#e0f2fe"/>
  <path d="M32 76h64v10H32z" fill="#0f172a"/>
  <circle cx="44" cy="88" r="10" fill="#1f2937"/>
  <circle cx="84" cy="88" r="10" fill="#1f2937"/>
  <circle cx="44" cy="88" r="4" fill="#cbd5e1"/>
  <circle cx="84" cy="88" r="4" fill="#cbd5e1"/>
</svg>`,
  verbs_v2: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f5f3ff"/>
  <circle cx="40" cy="38" r="12" fill="#fb7185"/>
  <path d="M38 52 56 66 50 76 32 62z" fill="#fb7185"/>
  <path d="M56 66 74 56 80 66 62 76z" fill="#8b5cf6"/>
  <path d="M50 76 40 98" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <path d="M62 76 84 96" stroke="#1f2937" stroke-width="8" stroke-linecap="round"/>
  <path d="M76 36h20l-8-8m8 8-8 8" fill="none" stroke="#22c55e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  comparison: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#eef6ff"/>
  <circle cx="40" cy="66" r="24" fill="#7bb0ff"/>
  <circle cx="88" cy="58" r="16" fill="#f3c969"/>
  <path d="M61 58h12l-6 10z" fill="#1f4f8a"/>
  <path d="M52 94h40" stroke="#1f4f8a" stroke-width="8" stroke-linecap="round"/>
  <path d="M64 30l12 10H52z" fill="#ef6f5e"/>
</svg>`,
  math_houses: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="26" fill="#f8e7bd"/>
  <path d="M25 58 64 25l39 33v48H25z" fill="#2d6fb5"/>
  <path d="M18 61 64 21l46 40-8 10-38-33-38 33z" fill="#ef6f5e"/>
  <rect x="36" y="62" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="70" y="62" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="36" y="88" width="22" height="20" rx="5" fill="#fff"/>
  <rect x="70" y="88" width="22" height="20" rx="5" fill="#fff"/>
  <circle cx="64" cy="45" r="13" fill="#fbbf24" stroke="#fff" stroke-width="4"/>
  <text x="64" y="50" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#422006">7</text>
</svg>`,
  written_letters: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#dbeafe"/>
  <rect x="16" y="12" width="96" height="104" rx="10" fill="#fefef6" stroke="#b8d8e8" stroke-width="2"/>
  <line x1="32" y1="110" x2="58" y2="18" stroke="#cde8f0" stroke-width="1"/>
  <line x1="54" y1="110" x2="80" y2="18" stroke="#cde8f0" stroke-width="1"/>
  <line x1="76" y1="110" x2="102" y2="18" stroke="#cde8f0" stroke-width="1"/>
  <line x1="24" y1="47" x2="104" y2="47" stroke="#6ab4cc" stroke-width="1.5"/>
  <line x1="24" y1="61" x2="104" y2="61" stroke="#2a82a0" stroke-width="2.5"/>
  <line x1="24" y1="76" x2="104" y2="76" stroke="#6ab4cc" stroke-width="1.5"/>
  <line x1="24" y1="90" x2="104" y2="90" stroke="#2a82a0" stroke-width="2.5"/>
  <text x="36" y="61" font-family="Georgia,serif" font-style="italic" font-size="24" fill="#1d4ed8" font-weight="bold">А</text>
  <text x="68" y="90" font-family="Georgia,serif" font-style="italic" font-size="18" fill="#1d4ed8">а</text>
</svg>`,
};

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

export function getBuiltinTopicAvatarPath(topicId) {
  if (topicId === "comparison") return "media/avatar_comparison.svg";
  if (topicId === "math_houses") return "media/avatar.svg";
  if (topicId === "propis") return "media/avatar_propis.svg";
  if (topicId === "addition_subtraction") return "media/avatar_operations.svg";
  if (topicId?.startsWith("reading_")) return "media/avatar_reading.svg";
  if (topicId === "sentence_puzzle") return "media/avatar_sentence_puzzle.svg";
  if (topicId === "streak_tracker") return "media/avatar_streak_tracker.svg";
  return "media/avatar_flashcards.svg";
}

export function getBuiltinTopicAsset(topicId, assetPath) {
  if (
    (assetPath === "media/avatar_flashcards.svg"
      || assetPath === "media/avatar_comparison.svg"
      || assetPath === "media/avatar.svg")
    && TOPIC_AVATAR_VARIANTS[topicId]
  ) {
    return svgToDataUrl(TOPIC_AVATAR_VARIANTS[topicId]);
  }
  const svg = BUILTIN_ASSETS[assetPath];
  return svg ? svgToDataUrl(svg) : null;
}

export function getMathHousesAssetEntries() {
  return Object.entries(BUILTIN_ASSETS)
    .filter(([path]) => path === "media/avatar.svg" || path.startsWith("media/icons/math_houses"))
    .map(([path, svg]) => [path, svg.trim()]);
}
