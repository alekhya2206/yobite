// lib/data/foodReference.ts
// YoBite's research-grounded food reference (Track 2 — v1 starter set).
//
// Each row is a common dish/ingredient seen on Indian restaurant menus (all cuisines available
// in India) with coarse, RESEARCH-BACKED attributes used to ground the ranking — so "which carb
// is better" is decided by data we own, not the model's mood. Levels are low | med | high.
// `quality` = whole-food & minimally-processed (high) vs refined/ultra-processed (low).
// `glycemic` = glycemic load. `note` is the cited reason shown/served to the AI as grounding.
//
// Sources/principles: USDA FoodData Central, Indian Food Composition Tables (IFCT/NIN),
// published glycemic-index tables. Curated starter set; grows via free batch classification.

export type Level = "low" | "med" | "high";

export interface FoodRef {
  /** lowercase phrase matched as a whole word/phrase inside a dish name */
  match: string;
  carbs: Level;
  protein: Level;
  fat: Level;
  fiber: Level;
  calories: Level;
  quality: Level;
  glycemic: Level;
  vegetarian: boolean;
  note: string;
}

// Order is irrelevant; lookup picks the LONGEST matching phrase so "fried rice" beats "rice".
export const FOOD_REFERENCE: FoodRef[] = [
  // ---- carbs: whole-food → refined → ultra-processed -----------------------
  { match: "mashed potato", carbs: "high", protein: "low", fat: "med", fiber: "med", calories: "med", quality: "high", glycemic: "med", vegetarian: true, note: "Whole potato — complex carbs + potassium & fibre; far less processed than refined noodles." },
  { match: "baked potato", carbs: "high", protein: "low", fat: "low", fiber: "high", calories: "med", quality: "high", glycemic: "med", vegetarian: true, note: "Whole potato with skin — high fibre, minimally processed." },
  { match: "aloo", carbs: "high", protein: "low", fat: "med", fiber: "med", calories: "med", quality: "high", glycemic: "med", vegetarian: true, note: "Potato-based — whole-food carb with fibre." },
  { match: "brown rice", carbs: "high", protein: "low", fat: "low", fiber: "high", calories: "med", quality: "high", glycemic: "med", vegetarian: true, note: "Whole grain — bran intact, more fibre and lower GI than white rice." },
  { match: "biryani", carbs: "high", protein: "med", fat: "med", fiber: "low", calories: "high", quality: "med", glycemic: "med", vegetarian: false, note: "Basmati rice (lower GI than sticky rice) with protein, but oil-rich." },
  { match: "pulao", carbs: "high", protein: "low", fat: "med", fiber: "low", calories: "med", quality: "med", glycemic: "med", vegetarian: true, note: "Basmati rice dish — moderate GI, some added oil." },
  { match: "fried rice", carbs: "high", protein: "low", fat: "med", fiber: "low", calories: "high", quality: "med", glycemic: "high", vegetarian: true, note: "Refined white rice plus oil — a better carb than refined-flour noodles, but high GI." },
  { match: "white rice", carbs: "high", protein: "low", fat: "low", fiber: "low", calories: "med", quality: "med", glycemic: "high", vegetarian: true, note: "Refined grain — high GI, low fibre, but a single ingredient (not ultra-processed)." },
  { match: "chow mein", carbs: "high", protein: "low", fat: "med", fiber: "low", calories: "high", quality: "low", glycemic: "high", vegetarian: true, note: "Refined-flour (maida) noodles, oil-fried — more processed than rice, low fibre." },
  { match: "hakka noodle", carbs: "high", protein: "low", fat: "med", fiber: "low", calories: "high", quality: "low", glycemic: "high", vegetarian: true, note: "Refined-flour noodles, oil-fried — low fibre, highly refined." },
  { match: "pasta", carbs: "high", protein: "low", fat: "med", fiber: "low", calories: "high", quality: "med", glycemic: "med", vegetarian: true, note: "Refined wheat; durum has moderate GI but low fibre unless whole-grain." },
  { match: "maggi", carbs: "high", protein: "low", fat: "med", fiber: "low", calories: "med", quality: "low", glycemic: "high", vegetarian: true, note: "Instant noodles — ultra-processed refined maida, high GI, negligible fibre/micronutrients." },
  { match: "instant noodle", carbs: "high", protein: "low", fat: "med", fiber: "low", calories: "med", quality: "low", glycemic: "high", vegetarian: true, note: "Ultra-processed refined flour, high sodium, negligible nutrition." },
  { match: "french fries", carbs: "high", protein: "low", fat: "high", fiber: "low", calories: "high", quality: "low", glycemic: "high", vegetarian: true, note: "Deep-fried refined potato — high fat & GI, the whole-food benefit is lost to frying." },

  // ---- breads --------------------------------------------------------------
  { match: "whole wheat roti", carbs: "high", protein: "low", fat: "low", fiber: "high", calories: "med", quality: "high", glycemic: "med", vegetarian: true, note: "Whole-wheat flatbread — fibre-rich, moderate GI." },
  { match: "roti", carbs: "high", protein: "low", fat: "low", fiber: "med", calories: "med", quality: "high", glycemic: "med", vegetarian: true, note: "Whole-wheat flatbread — more fibre than naan/refined breads." },
  { match: "naan", carbs: "high", protein: "low", fat: "med", fiber: "low", calories: "med", quality: "med", glycemic: "high", vegetarian: true, note: "Refined-flour (maida) bread, often buttered — low fibre." },
  { match: "bhatura", carbs: "high", protein: "low", fat: "high", fiber: "low", calories: "high", quality: "low", glycemic: "high", vegetarian: true, note: "Deep-fried refined-flour bread — high fat & GI." },

  // ---- proteins: lean/grilled → fried --------------------------------------
  { match: "grilled chicken breast", carbs: "low", protein: "high", fat: "low", fiber: "low", calories: "low", quality: "high", glycemic: "low", vegetarian: false, note: "Lean grilled protein — high protein, low fat, minimal processing." },
  { match: "grilled chicken", carbs: "low", protein: "high", fat: "low", fiber: "low", calories: "low", quality: "high", glycemic: "low", vegetarian: false, note: "Lean grilled protein, low added fat." },
  { match: "tandoori", carbs: "low", protein: "high", fat: "low", fiber: "low", calories: "low", quality: "high", glycemic: "low", vegetarian: false, note: "Clay-oven roasted — lean, no deep-frying." },
  { match: "tikka", carbs: "low", protein: "high", fat: "low", fiber: "low", calories: "low", quality: "high", glycemic: "low", vegetarian: false, note: "Grilled/roasted marinated protein — lean cooking method." },
  { match: "boiled egg", carbs: "low", protein: "high", fat: "med", fiber: "low", calories: "low", quality: "high", glycemic: "low", vegetarian: false, note: "Whole-food complete protein, no added fat." },
  { match: "fish", carbs: "low", protein: "high", fat: "low", fiber: "low", calories: "low", quality: "high", glycemic: "low", vegetarian: false, note: "Lean complete protein, omega-3s." },
  { match: "paneer tikka", carbs: "low", protein: "high", fat: "med", fiber: "low", calories: "med", quality: "high", glycemic: "low", vegetarian: true, note: "Grilled cottage cheese — high veg protein, some dairy fat." },
  { match: "paneer", carbs: "low", protein: "high", fat: "high", fiber: "low", calories: "med", quality: "med", glycemic: "low", vegetarian: true, note: "Cottage cheese — good protein but fat-rich, dish often creamy." },
  { match: "grilled", carbs: "low", protein: "med", fat: "low", fiber: "low", calories: "low", quality: "high", glycemic: "low", vegetarian: true, note: "Grilling is a lean, low-oil cooking method." },
  { match: "fried chicken", carbs: "med", protein: "high", fat: "high", fiber: "low", calories: "high", quality: "low", glycemic: "med", vegetarian: false, note: "Battered & deep-fried — protein present but high fat & refined coating." },

  // ---- fibre / legumes / veg ----------------------------------------------
  { match: "dal", carbs: "med", protein: "med", fat: "low", fiber: "high", calories: "med", quality: "high", glycemic: "low", vegetarian: true, note: "Lentils — high fibre & plant protein, low GI." },
  { match: "rajma", carbs: "med", protein: "med", fat: "low", fiber: "high", calories: "med", quality: "high", glycemic: "low", vegetarian: true, note: "Kidney beans — high fibre & protein, low GI." },
  { match: "chana", carbs: "med", protein: "med", fat: "low", fiber: "high", calories: "med", quality: "high", glycemic: "low", vegetarian: true, note: "Chickpeas — high fibre & protein, low GI." },
  { match: "chole", carbs: "med", protein: "med", fat: "med", fiber: "high", calories: "med", quality: "high", glycemic: "low", vegetarian: true, note: "Chickpea curry — high fibre & protein." },
  { match: "salad", carbs: "low", protein: "low", fat: "low", fiber: "high", calories: "low", quality: "high", glycemic: "low", vegetarian: true, note: "Raw vegetables — high fibre, low calorie, minimally processed." },
  { match: "sprout", carbs: "low", protein: "med", fat: "low", fiber: "high", calories: "low", quality: "high", glycemic: "low", vegetarian: true, note: "Sprouted legumes — high fibre & protein, low GI." },

  // ---- rich / sweet --------------------------------------------------------
  { match: "butter chicken", carbs: "low", protein: "high", fat: "high", fiber: "low", calories: "high", quality: "med", glycemic: "low", vegetarian: false, note: "High protein but cream- and butter-rich — calorie dense." },
  { match: "paneer butter masala", carbs: "low", protein: "med", fat: "high", fiber: "low", calories: "high", quality: "med", glycemic: "low", vegetarian: true, note: "Veg protein in a cream- and butter-heavy gravy — rich." },
  { match: "gulab jamun", carbs: "high", protein: "low", fat: "high", fiber: "low", calories: "high", quality: "low", glycemic: "high", vegetarian: true, note: "Deep-fried dough in sugar syrup — dessert, high sugar & fat." },
  { match: "jalebi", carbs: "high", protein: "low", fat: "high", fiber: "low", calories: "high", quality: "low", glycemic: "high", vegetarian: true, note: "Deep-fried refined flour in sugar syrup — dessert." },
  { match: "ice cream", carbs: "high", protein: "low", fat: "high", fiber: "low", calories: "high", quality: "low", glycemic: "high", vegetarian: true, note: "Sugar- and fat-rich dessert." },
  { match: "kheer", carbs: "high", protein: "low", fat: "med", fiber: "low", calories: "high", quality: "low", glycemic: "high", vegetarian: true, note: "Sweetened milk-rice pudding — dessert, high sugar." },
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;

/** Find the grounded record for a dish name — the LONGEST matching phrase wins, so
 *  "fried rice" beats "rice" and "grilled chicken breast" beats "grilled". */
export function lookupFood(dishName: string): FoodRef | null {
  const padded = norm(dishName);
  let best: FoodRef | null = null;
  for (const ref of FOOD_REFERENCE) {
    const phrase = ref.match;
    const hit = phrase.includes(" ") ? padded.includes(` ${phrase} `) || padded.includes(`${phrase} `) || padded.includes(` ${phrase}`) : padded.includes(` ${phrase} `);
    if (hit && (!best || phrase.length > best.match.length)) best = ref;
  }
  return best;
}
