/**
 * Generates real photos and audio for word_formation_soup deck.
 * Output: public/decks/word_formation_soup_v1.0.1.zip
 *
 * Credentials:
 *   GEMINI_API_KEY — from c:/Users/dmazn/Projects/Mirocard/.env.local
 *   Google TTS SA  — c:/Users/dmazn/Projects/Mirocard/cardgen-studio/credentials/google-tts-sa.json
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import JSZip from "jszip";
import { getGeminiApiKey } from "./lib/gemini-key.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".cache", "word_formation_soup");

const TOPIC_ID  = "word_formation_soup";
const VERSION   = "1.0.16";
const ZIP_PATH  = path.join(ROOT, "public", "decks", `${TOPIC_ID}_v${VERSION}.zip`);
// Old ZIP cleaned up automatically in catalog update below

const GEMINI_KEY   = getGeminiApiKey();
const GEMINI_MODEL = "gemini-2.5-flash-image";

const Q_SOUP    = "какой?";
const Q_JUICE   = "какой?";
const Q_JAM     = "какое?";
const Q_KASHA   = "какая?";
const Q_WEATHER = "какой?";

const POT_PROMPT    = "a large stainless steel cooking pot on a gas stove with blue flame burning underneath, steam rising from the pot, kitchen setting, warm natural lighting, top-down 3/4 view, clean white background, square composition, no text, no watermark, photorealistic educational photo";
const JUICER_PROMPT = "a modern electric centrifugal juicer machine alone on a clean kitchen counter, NO glass of juice and NO fruit nearby, just the appliance by itself, white and stainless steel, bright natural lighting, square 1:1 composition, no text, no watermark, child-friendly educational photo";
const BASIN_PROMPT  = "a wide traditional enamel basin or preserving pan filled with boiling red berry jam, foam and bubbles on the surface, steam rising, classic Russian jam-making style, warm kitchen lighting, top-down 3/4 view, square composition, no text, no watermark, child-friendly educational photo";

const SKY_DAY_PROMPT     = "a simple clean sky, soft blue with white fluffy clouds, neutral pleasant daytime, no horizon line, square 1:1 composition, flat child-friendly illustration style, no text, no watermark";
const SEASON_WINTER_PROMPT = "a snowy winter landscape: bare trees covered in white snow, snowflakes gently falling, cold blue-white color palette, flat child-friendly illustration style, square 1:1 composition, no text, no watermark";
const SEASON_AUTUMN_PROMPT = "a colorful autumn scene: trees with orange, red and yellow falling leaves, warm golden tones, flat child-friendly illustration style, square 1:1 composition, no text, no watermark";
const SEASON_SUMMER_PROMPT = "a bright summer scene: lush green trees, sunny clear sky, flowers blooming, warm cheerful yellow tones, flat child-friendly illustration style, square 1:1 composition, no text, no watermark";
const SEASON_SPRING_PROMPT = "a fresh spring scene: pink cherry blossoms, bright green new leaves, light blue sky, cheerful pastel tones, flat child-friendly illustration style, square 1:1 composition, no text, no watermark";

const AVATAR_TOPIC_PROMPT      = "a simple flat cartoon icon: a whole fish on the left, a bold arrow pointing right, a steaming bowl of soup on the right, bright cheerful colors, thick outlines, white background, square 1:1 composition, no text, no letters, child-friendly educational icon";
const AVATAR_PAIR_INTRO_PROMPT = "a simple flat cartoon icon: two square flashcards side by side, left card shows a fish illustration, right card shows bold text-like marks suggesting a word, a small arrow pointing from left to right between them, bright cheerful colors, thick outlines, white background, square 1:1 composition, no text, no letters";
const AVATAR_PICK_FORM_PROMPT  = "a simple flat cartoon icon: a fish illustration at the top, below it four rounded rectangular buttons in a 2x2 grid, one button highlighted in green, the others in light grey, bright cheerful colors, thick outlines, white background, square 1:1 composition, no text, no letters, child-friendly";

// each concept must have: category, vesselImage, questionText, audioQuestion
const CONCEPTS = [
  // ── супы ────────────────────────────────────────────────────────────────────
  { id: "ryba",     noun: "рыба",     nounPhrase: "суп из рыбы",          adjPhrase: "рыбный суп",          difficulty: "easy",   color: "#2196F3", category: "soup", wrongForms: ["рыбовый суп", "рыбяной суп", "рыбский суп"],
    imgPrompt: "a steaming bowl of fish soup, clear broth with pieces of white fish and vegetables, rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a fresh whole raw fish, lying on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "myaso",    noun: "мясо",     nounPhrase: "суп из мяса",          adjPhrase: "мясной суп",          difficulty: "easy",   color: "#F44336", category: "soup", wrongForms: ["мясовый суп", "мяский суп", "мясяной суп"],
    imgPrompt: "a steaming bowl of meat soup, rich broth with chunks of tender beef, carrots, potatoes, rustic setting, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a piece of fresh raw beef meat, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "grib",     noun: "гриб",     nounPhrase: "суп из грибов",        adjPhrase: "грибной суп",         difficulty: "easy",   color: "#795548", category: "soup", wrongForms: ["грибовый суп", "грибовной суп", "грибяной суп"],
    imgPrompt: "a steaming bowl of mushroom soup, creamy or clear broth with sliced mushrooms and herbs, rustic wooden bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh whole champignon mushrooms, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kapusta",  noun: "капуста",  nounPhrase: "суп из капусты",       adjPhrase: "капустный суп",       difficulty: "easy",   color: "#4CAF50", category: "soup", wrongForms: ["капустовый суп", "капустяной суп", "капустинный суп"],
    imgPrompt: "a steaming bowl of cabbage soup, clear broth with shredded cabbage and vegetables, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a whole fresh white cabbage head, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kuritsa",  noun: "курица",   nounPhrase: "суп из курицы",        adjPhrase: "куриный суп",         difficulty: "medium", color: "#FF9800", category: "soup", wrongForms: ["курочный суп", "курицовый суп", "куриской суп"],
    imgPrompt: "a steaming bowl of chicken soup, golden clear broth with chicken pieces, carrots, noodles, rustic setting, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a whole fresh raw chicken, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "goroh",    noun: "горох",    nounPhrase: "суп из гороха",        adjPhrase: "гороховый суп",       difficulty: "medium", color: "#8BC34A", category: "soup", wrongForms: ["горохный суп", "горошный суп", "горохистый суп"],
    imgPrompt: "a steaming bowl of pea soup, thick creamy green soup with split peas, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "fresh green peas in pods, a small pile, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "luk",      noun: "лук",      nounPhrase: "суп из лука",          adjPhrase: "луковый суп",         difficulty: "medium", color: "#9C27B0", category: "soup", wrongForms: ["лучный суп", "луковной суп", "луковист��й суп"],
    imgPrompt: "a steaming bowl of French onion soup, rich brown broth with caramelized onions and melted cheese crouton on top, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a few whole onions, one peeled, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "ovoschi",  noun: "овощи",    nounPhrase: "суп из овощей",        adjPhrase: "овощной суп",         difficulty: "medium", color: "#009688", category: "soup", wrongForms: ["овощевый суп", "овощинный суп", "овощеской суп"],
    imgPrompt: "a steaming bowl of vegetable soup, colorful clear broth with carrots, peas, zucchini, tomatoes, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a colorful mix of fresh vegetables: carrot, zucchini, tomato, bell pepper, arranged together on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "fasolj",   noun: "фасоль",   nounPhrase: "суп из фасоли",        adjPhrase: "фасолевый суп",       difficulty: "hard",   color: "#E91E63", category: "soup", wrongForms: ["фасольный суп", "фасолинный суп", "фасоляной суп"],
    imgPrompt: "a steaming bowl of bean soup, thick soup with red and white beans, tomatoes and herbs, rustic ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of dry red and white beans, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "tikva",    noun: "тыква",    nounPhrase: "суп из тыквы",         adjPhrase: "тыквенный суп",       difficulty: "hard",   color: "#FF6F00", category: "soup", wrongForms: ["тыквовый суп", "тыквяной суп", "тыквиный суп"],
    imgPrompt: "a steaming bowl of pumpkin soup, smooth bright orange creamy soup, rustic ceramic bowl with a swirl of cream and pumpkin seeds on top, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small bright orange pumpkin and a slice showing the orange flesh, on a rustic wooden table, warm natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },

  // ── соки ────────────────────────────────────────────────────────────────────
  { id: "yabloko",  noun: "яблоко",   nounPhrase: "сок из яблок",         adjPhrase: "яблочный сок",        difficulty: "easy",   color: "#8BC34A", category: "juice", wrongForms: ["яблоковый сок", "яблоньный сок", "яблочаный сок"],
    imgPrompt: "a tall clear glass of fresh apple juice, bright golden-yellow juice, a whole green apple beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "two fresh whole green apples, one whole and one cut in half showing the white flesh, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "morkov",   noun: "морковь",  nounPhrase: "сок из моркови",       adjPhrase: "морковный сок",       difficulty: "easy",   color: "#FF9800", category: "juice", wrongForms: ["морковочный сок", "морковистый сок", "морковяной сок"],
    imgPrompt: "a tall clear glass of fresh carrot juice, bright orange juice, a whole carrot beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "two fresh whole bright orange carrots with green tops, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "vinograd", noun: "виноград", nounPhrase: "сок из винограда",     adjPhrase: "виноградный сок",     difficulty: "medium", color: "#9C27B0", category: "juice", wrongForms: ["виноградовый сок", "виноградинный сок", "виноградской сок"],
    imgPrompt: "a tall clear glass of fresh grape juice, deep purple juice, a small bunch of dark purple grapes beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small bunch of dark purple grapes, glistening with freshness, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "apelsin",  noun: "апельсин", nounPhrase: "сок из апельсинов",    adjPhrase: "апельсиновый сок",    difficulty: "medium", color: "#FF5722", category: "juice", wrongForms: ["апельсинный сок", "апельсинской сок", "апельсинёный сок"],
    imgPrompt: "a tall clear glass of fresh orange juice, bright vivid orange juice with pulp, a whole orange and a halved orange beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "two fresh whole oranges and one halved orange showing the bright orange flesh, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "vishnya",  noun: "вишня",    nounPhrase: "сок из вишни",         adjPhrase: "вишнёвый сок",        difficulty: "hard",   color: "#E91E63", category: "juice", wrongForms: ["вишняной сок", "вишнинный сок", "вишневской сок"],
    imgPrompt: "a tall clear glass of fresh cherry juice, deep red cherry juice, a handful of dark red cherries with stems beside the glass, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh dark red cherries with green stems, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },

  // ── варенье ─────────────────────────────────────────────────────────────────
  { id: "klubnika", noun: "клубника", nounPhrase: "варенье из клубники",  adjPhrase: "клубничное варенье",  difficulty: "easy",   color: "#E91E63", category: "jam", wrongForms: ["клубниковое варенье", "клубничаное варенье", "клубничковое варенье"],
    imgPrompt: "a glass jar of homemade strawberry jam, bright red jam with whole strawberry pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh ripe red strawberries, glistening and juicy, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "malina",   noun: "малина",   nounPhrase: "варенье из малины",    adjPhrase: "малиновое варенье",   difficulty: "easy",   color: "#F06292", category: "jam", wrongForms: ["м��линное варенье", "малиновное варенье", "малинистое варенье"],
    imgPrompt: "a glass jar of homemade raspberry jam, deep red-pink jam with raspberry pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh ripe red raspberries, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sliva",    noun: "слива",    nounPhrase: "варенье из слив",      adjPhrase: "сливовое варенье",    difficulty: "medium", color: "#7B1FA2", category: "jam", wrongForms: ["сливное варенье", "сливяное варенье", "сливиновое варенье"],
    imgPrompt: "a glass jar of homemade plum jam, deep dark purple jam with plum pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a few fresh whole dark purple plums, one cut in half showing the yellow flesh and stone, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "abrikos",  noun: "абрикос",  nounPhrase: "варенье из абрикосов", adjPhrase: "абрикосовое варенье", difficulty: "medium", color: "#FF9800", category: "jam", wrongForms: ["абрикосное варенье", "абрикосяное варенье", "абрикосинное варенье"],
    imgPrompt: "a glass jar of homemade apricot jam, bright golden-orange jam with apricot pieces, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a few fresh whole ripe orange apricots, one cut in half showing the stone, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "chernika", noun: "черника",  nounPhrase: "варенье из черники",   adjPhrase: "черничное варенье",   difficulty: "hard",   color: "#3F51B5", category: "jam", wrongForms: ["черниковое варенье", "черничаное варенье", "черничковое варенье"],
    imgPrompt: "a glass jar of homemade blueberry jam, deep dark blue-purple jam, open jar with a wooden spoon, white background, bright natural lighting, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fresh dark blue blueberries, on a white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },

  // ── каша ────────────────────────────────────────────────────────────────────
  { id: "kasha_ris",      noun: "рис",      nounPhrase: "каша из риса",     adjPhrase: "рисовая каша",    difficulty: "easy",   color: "#F5DEB3", category: "kasha", wrongForms: ["рисная каша", "рисовная каша", "рисяная каша"],
    imgPrompt: "a bowl of steaming white rice porridge, smooth creamy texture, simple white ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of dry white rice grains on a clean wooden surface, bright natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kasha_grechka",  noun: "гречка",   nounPhrase: "каша из гречки",   adjPhrase: "гречневая каша",  difficulty: "easy",   color: "#8B4513", category: "kasha", wrongForms: ["гречкаяная каша", "гречковая каша", "гречняная каша"],
    imgPrompt: "a bowl of steaming buckwheat porridge, dark brown grains, simple white ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of dry dark brown buckwheat grains on a clean wooden surface, bright natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kasha_psheno",   noun: "пшено",    nounPhrase: "каша из пшена",    adjPhrase: "пшённая каша",    difficulty: "easy",   color: "#FFD700", category: "kasha", wrongForms: ["пшеновая каша", "пшенная каша", "пшёновая каша"],
    imgPrompt: "a bowl of bright yellow millet porridge, steaming hot, simple white ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of dry bright yellow millet grains on a clean wooden surface, bright natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kasha_ovos",     noun: "овёс",     nounPhrase: "каша из овса",     adjPhrase: "овсяная каша",    difficulty: "medium", color: "#D2B48C", category: "kasha", wrongForms: ["овсовая каша", "овёсная каша", "овсиная каша"],
    imgPrompt: "a bowl of creamy oatmeal porridge, smooth texture, simple white ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of dry rolled oat flakes on a clean wooden surface, bright natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kasha_kukuruza", noun: "кукуруза", nounPhrase: "каша из кукурузы", adjPhrase: "кукурузная каша", difficulty: "medium", color: "#FFCA28", category: "kasha", wrongForms: ["кукурузовая каша", "кукурузяная каша", "кукурузинная каша"],
    imgPrompt: "a bowl of bright yellow corn porridge, smooth and creamy, simple white ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a fresh yellow corn cob on a clean wooden surface, bright natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kasha_manka",    noun: "манка",    nounPhrase: "каша из манки",    adjPhrase: "манная каша",     difficulty: "hard",   color: "#F5F5DC", category: "kasha", wrongForms: ["манкаяная каша", "манковая каша", "манкинная каша"],
    imgPrompt: "a bowl of smooth white semolina porridge, thick and creamy, simple white ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of fine white semolina grains on a clean wooden surface, bright natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "kasha_perlovka", noun: "перловка", nounPhrase: "каша из перловки", adjPhrase: "перловая каша",   difficulty: "hard",   color: "#C8A882", category: "kasha", wrongForms: ["перловочная каша", "перловатая каша", "перловочная каша"],
    imgPrompt: "a bowl of pearl barley porridge, round grey-beige grains, simple white ceramic bowl, warm natural lighting, top-down view, square composition, no text, no watermark",
    ingredientPrompt: "a small pile of dry pearl barley grains, round and beige-grey, on a clean wooden surface, bright natural lighting, top-down view, square composition, no text, no watermark, child-friendly educational photo" },

  // ── материалы ───────────────────────────────────────────────────────────────
  { id: "mat_derevo",  noun: "дерево",  nounPhrase: "стол из дерева",       adjPhrase: "деревянный стол",      questionText: "какой?", difficulty: "easy",   color: "#8B4513", category: "materials", wrongForms: ["деревной стол", "деревской стол", "деревый стол"],
    imgPrompt: "a simple wooden table, natural warm wood grain, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo",
    ingredientPrompt: "a piece of natural wood with visible wood grain texture, warm brown color, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "mat_steklo",  noun: "стекло",  nounPhrase: "стакан из стекла",     adjPhrase: "стеклянный стакан",    questionText: "какой?", difficulty: "easy",   color: "#87CEEB", category: "materials", wrongForms: ["стекловый стакан", "стекловатый стакан", "стекляной стакан"],
    imgPrompt: "a transparent drinking glass, clear glass smooth surface, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo",
    ingredientPrompt: "a flat piece of transparent glass, clear and shiny, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "mat_glina",   noun: "глина",   nounPhrase: "ваза из глины",         adjPhrase: "глиняная ваза",        questionText: "какая?", difficulty: "easy",   color: "#C47A39", category: "materials", wrongForms: ["глинная ваза", "глиновая ваза", "глинаяная ваза"],
    imgPrompt: "a traditional terracotta clay vase, handmade look with visible clay texture, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo",
    ingredientPrompt: "a lump of raw grey-brown clay, soft moldable texture, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "mat_zoloto",  noun: "золото",  nounPhrase: "кольцо из золота",      adjPhrase: "золотое кольцо",       questionText: "какое?", difficulty: "medium", color: "#FFD700", category: "materials", wrongForms: ["золотовое кольцо", "золотяное кольцо", "золотское кольцо"],
    imgPrompt: "a simple shiny gold ring, yellow gold metal, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo",
    ingredientPrompt: "a small gold nugget, shiny yellow metal, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "mat_serebro", noun: "серебро", nounPhrase: "браслет из серебра",    adjPhrase: "серебряный браслет",   questionText: "какой?", difficulty: "medium", color: "#C0C0C0", category: "materials", wrongForms: ["серебровый браслет", "серебряной браслет", "серебный браслет"],
    imgPrompt: "a simple silver bracelet, shiny silver metal, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo",
    ingredientPrompt: "a small silver piece of metal, shiny grey-white, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "mat_kozha",   noun: "кожа",    nounPhrase: "куртка из кожи",        adjPhrase: "кожаная куртка",       questionText: "какая?", difficulty: "medium", color: "#3E2723", category: "materials", wrongForms: ["кожевая куртка", "кожаяная куртка", "кожистая куртка"],
    imgPrompt: "a classic black leather jacket, smooth shiny leather surface, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo",
    ingredientPrompt: "a piece of natural brown leather material, smooth texture with visible grain, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "mat_sherst",  noun: "шерсть",  nounPhrase: "шарф из шерсти",        adjPhrase: "шерстяной шарф",       questionText: "какой?", difficulty: "hard",   color: "#FF5722", category: "materials", wrongForms: ["шерстной шарф", "шерстевой шарф", "шерстинный шарф"],
    imgPrompt: "a cozy knitted wool scarf, warm red-orange color with textured knit pattern, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo",
    ingredientPrompt: "a ball of soft natural wool yarn, fluffy and warm, beige-white color, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "mat_plastik", noun: "пластик", nounPhrase: "игрушка из пластика",   adjPhrase: "пластиковая игрушка",  questionText: "какая?", difficulty: "hard",   color: "#E91E63", category: "materials", wrongForms: ["пластиковная игрушка", "пластинная игрушка", "пластяная игрушка"],
    imgPrompt: "a simple colorful plastic toy, bright primary colors, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo",
    ingredientPrompt: "a flat piece of colorful plastic material, smooth shiny surface, bright red or yellow, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },

  // ── погода ───────────────────────────────────────────────────────────────────
  { id: "wea_dozhd",  noun: "дождь",  nounPhrase: "день с дождём",  adjPhrase: "дождливый день",  difficulty: "easy",   color: "#607D8B", category: "weather", wrongForms: ["дождной день", "дождевной день", "дождяной день"],
    ingredientPrompt: "heavy raindrops falling, close-up of rain splashing in puddles on a wet surface, grey rainy atmosphere, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "wea_sneg",   noun: "снег",   nounPhrase: "день со снегом", adjPhrase: "снежный день",    difficulty: "easy",   color: "#90CAF9", category: "weather", wrongForms: ["снеговой день", "снеговитый день", "снегный день"],
    ingredientPrompt: "soft white snowflakes falling, close-up of fresh fluffy snow, white and clean winter snow, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "wea_solnce", noun: "солнце", nounPhrase: "день с солнцем", adjPhrase: "солнечный день",  difficulty: "easy",   color: "#FFCA28", category: "weather", wrongForms: ["солнцевой день", "солнцеватый день", "солнцный день"],
    ingredientPrompt: "bright yellow sun shining in a clear blue sky, warm golden sunshine, no clouds, cheerful weather, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "wea_veter",  noun: "ветер",  nounPhrase: "день с ветром",  adjPhrase: "ветреный день",   difficulty: "medium", color: "#78909C", category: "weather", wrongForms: ["ветровой день", "ветровитый день", "ветерный день"],
    ingredientPrompt: "strong wind blowing through tree branches, leaves flying through the air, dynamic wind effect, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "wea_tuman",  noun: "туман",  nounPhrase: "день с туманом", adjPhrase: "туманный день",   difficulty: "medium", color: "#B0BEC5", category: "weather", wrongForms: ["туманной день", "туманистый день", "туманинный день"],
    ingredientPrompt: "thick white fog or mist in an outdoor scene, soft blurry visibility, mysterious foggy morning, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "wea_groza",  noun: "гроза",  nounPhrase: "день с грозой",  adjPhrase: "грозовой день",   difficulty: "hard",   color: "#37474F", category: "weather", wrongForms: ["грозаяной день", "грозовной день", "грозной день"],
    ingredientPrompt: "dramatic lightning bolt in a dark stormy sky, thunderstorm with dark storm clouds, dramatic natural scene, square composition, no text, no watermark, child-friendly educational photo" },

  // ── времена года ─────────────────────────────────────────────────────────────
  { id: "sea_zima_sharf",   noun: "зима",  nounPhrase: "шарф для зимы",    adjPhrase: "зимний шарф",    questionText: "какой?", vesselImageSeason: "winter", difficulty: "easy",   color: "#90CAF9", category: "seasons", wrongForms: ["зимный шарф", "зимистый шарф", "зимовый шарф"],
    ingredientPrompt: "a cozy knitted winter scarf, warm and soft, bright red color, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sea_zima_shuba",   noun: "зима",  nounPhrase: "шуба для зимы",    adjPhrase: "зимняя шуба",    questionText: "какая?", vesselImageSeason: "winter", difficulty: "easy",   color: "#90CAF9", category: "seasons", wrongForms: ["зимная шуба", "зимовая шуба", "зимистая шуба"],
    ingredientPrompt: "a warm fluffy fur coat, soft and cozy, light beige color, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sea_osen_sapogi",  noun: "осень", nounPhrase: "сапоги для осени", adjPhrase: "осенние сапоги", questionText: "какие?", vesselImageSeason: "autumn", difficulty: "easy",   color: "#FF8F00", category: "seasons", wrongForms: ["осенные сапоги", "осенистые сапоги", "осеновые сапоги"],
    ingredientPrompt: "a pair of tall rubber rain boots, classic dark green or brown color, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sea_osen_kurtka",  noun: "осень", nounPhrase: "куртка для осени", adjPhrase: "осенняя куртка", questionText: "какая?", vesselImageSeason: "autumn", difficulty: "easy",   color: "#FF8F00", category: "seasons", wrongForms: ["осенная куртка", "осенистая куртка", "осеновая куртка"],
    ingredientPrompt: "a light autumn jacket, warm orange or olive green color, medium weight, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sea_leto_sarafan", noun: "лето",  nounPhrase: "сарафан для лета", adjPhrase: "летний сарафан", questionText: "какой?", vesselImageSeason: "summer", difficulty: "medium", color: "#FFD740", category: "seasons", wrongForms: ["летовый сарафан", "летный сарафан", "летяной сарафан"],
    ingredientPrompt: "a light colorful summer sundress, bright cheerful colors with thin straps, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sea_leto_shorty",  noun: "лето",  nounPhrase: "шорты для лета",   adjPhrase: "летние шорты",   questionText: "какие?", vesselImageSeason: "summer", difficulty: "medium", color: "#FFD740", category: "seasons", wrongForms: ["летовые шорты", "летные шорты", "летские шорты"],
    ingredientPrompt: "a pair of colorful summer shorts, light fabric, bright cheerful yellow or blue color, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sea_vesna_plash",  noun: "весна", nounPhrase: "плащ для весны",   adjPhrase: "весенний плащ",  questionText: "какой?", vesselImageSeason: "spring", difficulty: "hard",   color: "#81C784", category: "seasons", wrongForms: ["весенный плащ", "весновый плащ", "веснистый плащ"],
    ingredientPrompt: "a light spring raincoat, thin waterproof jacket, soft mint green or light blue color, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
  { id: "sea_vesna_zontik", noun: "весна", nounPhrase: "зонтик для весны", adjPhrase: "весенний зонтик", questionText: "какой?", vesselImageSeason: "spring", difficulty: "hard",   color: "#81C784", category: "seasons", wrongForms: ["весенный зонтик", "весновый зонтик", "веснистый зонтик"],
    ingredientPrompt: "a colorful open umbrella, cheerful bright colors, clean white background, bright natural lighting, square composition, no text, no watermark, child-friendly educational photo" },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function ensureDir(p) { mkdirSync(p, { recursive: true }); }

function cached(name) { return path.join(CACHE_DIR, name); }

function isCached(name) { return existsSync(cached(name)); }

// ─── Gemini Imagen ───────────────────────────────────────────────────────────

async function generateImageFromPrompt(filename, prompt, label) {
  if (isCached(filename)) {
    console.log(`  [cache] image ${filename}`);
    return readFileSync(cached(filename));
  }

  process.stdout.write(`  [img]  ${label}: generating ... `);

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
      }),
    }
  );

  const body = await resp.json();
  if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${body?.error?.message}`);

  const parts = body.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find(p => p.inlineData || p.inline_data);
  const inlineData = imgPart?.inlineData || imgPart?.inline_data;
  if (!inlineData?.data) throw new Error(`No image in response for ${label}`);

  const raw = Buffer.from(inlineData.data, "base64");
  const webp = await sharp(raw).resize(512, 512, { fit: "cover", position: "centre" }).webp({ quality: 82 }).toBuffer();

  writeFileSync(cached(filename), webp);
  console.log(`OK (${Math.round(webp.length / 1024)} KB)`);
  await sleep(500);
  return webp;
}

function generateSoupImage(concept) {
  return generateImageFromPrompt(`${concept.id}.webp`, concept.imgPrompt, concept.id);
}

function generateIngredientImage(concept) {
  return generateImageFromPrompt(`${concept.id}_ingredient.webp`, concept.ingredientPrompt, `${concept.id} (ingredient)`);
}

function generatePotImage() {
  return generateImageFromPrompt("pot.webp", POT_PROMPT, "pot");
}


const VESSEL = {
  soup:    { image: "media/pot.webp",     question: Q_SOUP    },
  juice:   { image: "media/juicer.webp",  question: Q_JUICE   },
  jam:     { image: "media/basin.webp",   question: Q_JAM     },
  kasha:   { image: "media/pot.webp",     question: Q_KASHA   },
  weather: { image: "media/sky_day.webp", question: Q_WEATHER },
};

// ─── Build topic.json ────────────────────────────────────────────────────────

function buildTopic() {
  const cards = CONCEPTS.map(c => ({
    id:              c.id,
    category:        c.category,
    noun:            c.noun,
    nounPhrase:      c.nounPhrase,
    adjPhrase:       c.adjPhrase,
    difficulty:      c.difficulty,
    color:           c.color,
    image:           c.category === "weather"   ? VESSEL.weather.image
                   : c.category === "seasons"   ? `media/season_${c.vesselImageSeason}.webp`
                   : `media/${c.id}.webp`,
    ingredientImage: c.category === "materials" ? `media/${c.id}.webp`
                   : `media/${c.id}_ingredient.webp`,
    vesselImage:     (c.category === "materials" || c.category === "weather") ? null
                   : c.category === "seasons"   ? `media/season_${c.vesselImageSeason}.webp`
                   : VESSEL[c.category]?.image  ?? "media/pot.webp",
    questionText:    c.questionText ?? VESSEL[c.category]?.question ?? "какой?",
    wrongForms:      c.wrongForms ?? [],
  }));

  return {
    meta: {
      id: TOPIC_ID, renderer: "word_formation", version: VERSION,
      title: { ru: "Словообразование" }, language: "ru",
      avatar: "media/avatar_topic.webp",
    },
    modes: [
      { id: "pair_intro", type: "pair_intro", evaluation: "none", requirePin: false,
        ui: { title: { ru: "Знакомство с парами" }, instruction: { ru: "Листайте пары и называйте прилагательное" }, icon: "media/avatar_pair_intro.webp" },
        params: {
          category: { type: "enum", label: { ru: "Категория" }, values: ["soup", "juice", "jam", "kasha", "materials", "weather", "seasons", "all"], labels: { ru: { soup: "Суп", juice: "Сок", jam: "Варенье", kasha: "Каша", materials: "Материалы", weather: "Погода", seasons: "Времена года", all: "Все" } }, default: "soup" },
        },
      },
      { id: "pick_form", type: "pick_form", evaluation: "auto", requirePin: false,
        ui: { title: { ru: "Выбери правильную форму" }, instruction: { ru: "Нажми на правильное слово" }, icon: "media/avatar_pick_form.webp" },
        params: {
          category:   { type: "enum", label: { ru: "Категория" }, values: ["soup", "juice", "jam", "kasha", "materials", "weather", "seasons", "all"], labels: { ru: { soup: "Суп", juice: "Сок", jam: "Варенье", kasha: "Каша", materials: "Материалы", weather: "Погода", seasons: "Времена года", all: "Все" } }, default: "soup" },
          difficulty: { type: "enum", label: { ru: "Сложность дистракторов" }, values: ["easy", "hard"], labels: { ru: { easy: "Лёгкий: слова из разных пар", hard: "Сложный: похожие формы одного корня" } }, default: "easy" },
        },
      },
    ],
    cards,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  ensureDir(CACHE_DIR);

  console.log("\n=== Генерация аватарок ===");
  const avatarTopic     = await generateImageFromPrompt("avatar_topic.webp",      AVATAR_TOPIC_PROMPT,      "avatar_topic");
  const avatarPairIntro = await generateImageFromPrompt("avatar_pair_intro.webp", AVATAR_PAIR_INTRO_PROMPT, "avatar_pair_intro");
  const avatarPickForm  = await generateImageFromPrompt("avatar_pick_form.webp",  AVATAR_PICK_FORM_PROMPT,  "avatar_pick_form");

  console.log("\n=== Генерация изображений ===");
  const vessels = {
    "media/pot.webp":           await generateImageFromPrompt("pot.webp",           POT_PROMPT,           "pot"),
    "media/juicer.webp":        await generateImageFromPrompt("juicer.webp",        JUICER_PROMPT,        "juicer"),
    "media/basin.webp":         await generateImageFromPrompt("basin.webp",         BASIN_PROMPT,         "basin"),
    "media/sky_day.webp":       await generateImageFromPrompt("sky_day.webp",       SKY_DAY_PROMPT,       "sky_day"),
    "media/season_winter.webp": await generateImageFromPrompt("season_winter.webp", SEASON_WINTER_PROMPT, "season_winter"),
    "media/season_autumn.webp": await generateImageFromPrompt("season_autumn.webp", SEASON_AUTUMN_PROMPT, "season_autumn"),
    "media/season_summer.webp": await generateImageFromPrompt("season_summer.webp", SEASON_SUMMER_PROMPT, "season_summer"),
    "media/season_spring.webp": await generateImageFromPrompt("season_spring.webp", SEASON_SPRING_PROMPT, "season_spring"),
  };
  const resultImages = {};
  const ingredientImages = {};
  for (const c of CONCEPTS) {
    if (c.imgPrompt) {
      resultImages[c.id] = await generateImageFromPrompt(`${c.id}.webp`, c.imgPrompt, c.id);
    }
    ingredientImages[c.id] = await generateImageFromPrompt(`${c.id}_ingredient.webp`, c.ingredientPrompt, `${c.id} (ingredient)`);
  }

  console.log("\n=== Упаковка ZIP ===");
  const topic = buildTopic();
  const zip = new JSZip();
  zip.file("topic.json", JSON.stringify(topic, null, 2));
  zip.file("media/avatar_topic.webp",      avatarTopic);
  zip.file("media/avatar_pair_intro.webp", avatarPairIntro);
  zip.file("media/avatar_pick_form.webp",  avatarPickForm);
  for (const [filePath, buf] of Object.entries(vessels)) zip.file(filePath, buf);
  for (const c of CONCEPTS) {
    if (resultImages[c.id]) zip.file(`media/${c.id}.webp`, resultImages[c.id]);
    zip.file(`media/${c.id}_ingredient.webp`, ingredientImages[c.id]);
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  writeFileSync(ZIP_PATH, buf);
  console.log(`✓ ${ZIP_PATH} (${(buf.length / 1024).toFixed(0)} KB)`);

  const catalogPath = path.join(ROOT, "public", "decks", "catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  // Remove old versions of this deck AND the separate juice/jam decks
  catalog.decks = catalog.decks.filter(
    d => d.id !== TOPIC_ID && d.id !== "word_formation_juice" && d.id !== "word_formation_jam"
  );
  catalog.decks.push({
    id: TOPIC_ID, version: VERSION,
    url: `./decks/${TOPIC_ID}_v${VERSION}.zip`,
    zipUrl: `${TOPIC_ID}_v${VERSION}.zip`,
    title: { ru: "Словообразование" },
    renderer: "word_formation",
  });
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  console.log("✓ catalog.json updated");
}

main().catch(e => { console.error(e); process.exit(1); });
