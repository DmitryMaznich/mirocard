const BUILTIN_ASSETS = {
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
  "media/icons/reading_mode.svg": `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#f5f0ff"/>
  <rect x="28" y="28" width="72" height="72" rx="14" fill="#fff" stroke="#c8bde8" stroke-width="4"/>
  <path d="M44 52h40M44 68h30M44 84h40" stroke="#4a9b8f" stroke-width="7" stroke-linecap="round"/>
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
};

function svgToDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`;
}

export function getBuiltinTopicAvatarPath(topicId) {
  if (topicId === "comparison") return "media/avatar_comparison.svg";
  if (topicId === "math_houses") return "media/avatar.svg";
  if (topicId === "addition_subtraction") return "media/avatar_operations.svg";
  if (topicId?.startsWith("reading_")) return "media/avatar_reading.svg";
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
