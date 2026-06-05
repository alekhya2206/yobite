// The YoBite food knowledge base.
//
// Local restaurants don't publish nutrition data, so the brain reads the *name*.
// These token tables are how it does that — cooking methods, proteins, carbs, and
// the warm-region dishes (Indian/Indo-Chinese) the product is built for first.
//
// Honesty over precision: weights are coarse on purpose. They exist to *rank*, not
// to claim a calorie count nobody can actually verify.

export interface Token {
  /** Lowercased phrase to match as a whole word/phrase in the dish name. */
  match: string;
}

/** Cooking methods that keep a dish lean & light. */
export const LEAN_METHODS = [
  "grilled", "grill", "tandoori", "tandoor", "tikka", "roasted", "roast",
  "steamed", "steam", "boiled", "poached", "seared", "char", "charred",
  "chargrilled", "bbq", "barbecue", "barbeque", "smoked", "baked",
  "clear soup", "broth",
];

/** Methods/ingredients that mean deep oil. */
export const FRIED_METHODS = [
  "fried", "deep fried", "deep-fried", "deep fry", "crispy", "crisp",
  "batter", "battered", "pakora", "pakoda", "bhaji", "bhajji", "koliwada",
  "chicken 65", "fish 65", "65", "golden fried", "tempura", "katsu",
  "schnitzel", "nuggets", "fingers", "popcorn", "wedges", "fritter",
  "spring roll", "samosa", "cutlet", "vada", "bonda", "manchurian",
];

// Rich signals come in two strengths. A single heavy token (butter, cream, cheese)
// is enough to mark a dish as genuinely rich; mild ones (curry, gravy) only nudge,
// so a plain "Chicken Curry" isn't unfairly flagged heavy.
export const RICH_HEAVY = [
  "butter", "makhani", "makhanwala", "malai", "korma", "kurma", "shahi",
  "mughlai", "creamy", "cream", "alfredo", "cheese", "cheesy", "queso",
  "white sauce", "carbonara", "au gratin", "lasagne", "lasagna",
  "loaded", "peri peri mayo", "mayo", "afghani",
];
export const RICH_MILD = [
  "rogan josh", "rogan", "gravy", "curry", "masala gravy", "stuffed",
];

/** Animal + plant proteins, with a coarse grams-per-serving read. */
export interface ProteinToken {
  match: string;
  /** Rough protein grams contributed when this is the dish's hero ingredient. */
  grams: number;
  /** True for meat/fish/egg — flips the vegetarian flag off. */
  animal: boolean;
}

export const PROTEINS: ProteinToken[] = [
  // lean animal protein
  { match: "chicken breast", grams: 34, animal: true },
  { match: "grilled chicken", grams: 33, animal: true },
  { match: "chicken", grams: 28, animal: true },
  { match: "fish", grams: 28, animal: true },
  { match: "pomfret", grams: 28, animal: true },
  { match: "surmai", grams: 28, animal: true },
  { match: "bekti", grams: 28, animal: true },
  { match: "basa", grams: 26, animal: true },
  { match: "salmon", grams: 27, animal: true },
  { match: "tuna", grams: 30, animal: true },
  { match: "prawn", grams: 24, animal: true },
  { match: "prawns", grams: 24, animal: true },
  { match: "shrimp", grams: 24, animal: true },
  { match: "crab", grams: 20, animal: true },
  { match: "squid", grams: 22, animal: true },
  { match: "egg white", grams: 22, animal: true },
  { match: "egg", grams: 13, animal: true },
  { match: "omelette", grams: 16, animal: true },
  { match: "turkey", grams: 30, animal: true },
  // heavier animal protein
  { match: "mutton", grams: 25, animal: true },
  { match: "lamb", grams: 25, animal: true },
  { match: "keema", grams: 22, animal: true },
  { match: "beef", grams: 26, animal: true },
  { match: "steak", grams: 32, animal: true },
  { match: "pork", grams: 25, animal: true },
  { match: "bacon", grams: 14, animal: true },
  { match: "ham", grams: 16, animal: true },
  { match: "sausage", grams: 14, animal: true },
  // veg protein
  { match: "paneer", grams: 20, animal: false },
  { match: "cottage cheese", grams: 20, animal: false },
  { match: "tofu", grams: 17, animal: false },
  { match: "soya", grams: 18, animal: false },
  { match: "soy", grams: 18, animal: false },
  { match: "tempeh", grams: 19, animal: false },
  { match: "rajma", grams: 13, animal: false },
  { match: "chana", grams: 12, animal: false },
  { match: "chickpea", grams: 12, animal: false },
  { match: "chole", grams: 12, animal: false },
  { match: "lentil", grams: 11, animal: false },
  { match: "dal", grams: 10, animal: false },
  { match: "daal", grams: 10, animal: false },
  { match: "lobia", grams: 12, animal: false },
  { match: "sprout", grams: 9, animal: false },
  { match: "sprouts", grams: 9, animal: false },
  { match: "beans", grams: 9, animal: false },
  { match: "hummus", grams: 8, animal: false },
];

/** Refined / heavy carbohydrate signals (0–1 weight in `weight`). */
export interface CarbToken {
  match: string;
  weight: number;
}

export const REFINED_CARBS: CarbToken[] = [
  { match: "biryani", weight: 0.9 },
  { match: "biriyani", weight: 0.9 },
  { match: "pulao", weight: 0.8 },
  { match: "pulav", weight: 0.8 },
  { match: "fried rice", weight: 0.9 },
  { match: "rice", weight: 0.7 },
  { match: "noodles", weight: 0.85 },
  { match: "hakka", weight: 0.85 },
  { match: "chowmein", weight: 0.85 },
  { match: "chow mein", weight: 0.85 },
  { match: "pasta", weight: 0.8 },
  { match: "spaghetti", weight: 0.8 },
  { match: "penne", weight: 0.8 },
  { match: "mac and cheese", weight: 0.9 },
  { match: "naan", weight: 0.85 },
  { match: "kulcha", weight: 0.85 },
  { match: "bhatura", weight: 0.9 },
  { match: "bhature", weight: 0.9 },
  { match: "puri", weight: 0.85 },
  { match: "poori", weight: 0.85 },
  { match: "paratha", weight: 0.75 },
  { match: "parantha", weight: 0.75 },
  { match: "bread", weight: 0.7 },
  { match: "bun", weight: 0.7 },
  { match: "burger", weight: 0.75 },
  { match: "pizza", weight: 0.8 },
  { match: "wrap", weight: 0.6 },
  { match: "roll", weight: 0.6 },
  { match: "frankie", weight: 0.65 },
  { match: "sandwich", weight: 0.6 },
  { match: "fries", weight: 0.85 },
  { match: "chips", weight: 0.8 },
  { match: "potato", weight: 0.6 },
  { match: "aloo", weight: 0.6 },
  { match: "maggi", weight: 0.8 },
  { match: "momos", weight: 0.5 },
  { match: "momo", weight: 0.5 },
  { match: "dumpling", weight: 0.5 },
  { match: "thali", weight: 0.6 },
];

/** Lighter wholegrain carbs — present but not the villain. */
export const LIGHT_CARBS: CarbToken[] = [
  { match: "roti", weight: 0.35 },
  { match: "chapati", weight: 0.35 },
  { match: "chapathi", weight: 0.35 },
  { match: "phulka", weight: 0.3 },
  { match: "brown rice", weight: 0.4 },
  { match: "quinoa", weight: 0.25 },
  { match: "millet", weight: 0.3 },
  { match: "oats", weight: 0.3 },
];

/** Vegetable / freshness signals. */
export const VEG_SIGNALS = [
  "salad", "greens", "spinach", "palak", "broccoli", "vegetable", "veg ",
  "veggie", "lettuce", "cucumber", "tomato", "kale", "avocado", "beetroot",
  "carrot", "mushroom", "bhindi", "okra", "gobi", "cauliflower", "baingan",
  "brinjal", "capsicum", "bell pepper", "zucchini", "asparagus", "edamame",
  "stir fry", "stir-fried", "sauteed", "soup", "clear soup",
];

/** Dessert / sweet signals. */
export const DESSERTS = [
  "cake", "ice cream", "icecream", "gulab jamun", "jalebi", "halwa",
  "brownie", "pastry", "kheer", "rasgulla", "rasmalai", "pudding",
  "mousse", "sundae", "falooda", "tiramisu", "cheesecake", "donut",
  "doughnut", "waffle", "pancake", "muffin", "cookie", "chocolate",
  "sweet", "dessert", "phirni", "souffle", "custard",
];

/** Drink signals. */
export const DRINKS = [
  "tea", "coffee", "latte", "cappuccino", "juice", "soda", "cola", "pepsi",
  "coke", "water", "mojito", "lassi", "buttermilk", "chaas", "smoothie",
  "shake", "milkshake", "cocktail", "mocktail", "beer", "wine", "iced tea",
  "lemonade", "nimbu", "sherbet", "frappe",
];

/** Lines that are section headers, not dishes. */
export const SECTION_WORDS = [
  "starters", "starter", "appetizer", "appetizers", "soups", "salads",
  "mains", "main course", "main courses", "maincourse", "breads", "rice",
  "rice & breads", "sides", "desserts", "beverages", "drinks", "specials",
  "chef special", "chef specials", "veg", "non veg", "non-veg", "vegetarian",
  "non vegetarian", "menu", "tandoor", "chinese", "continental", "indian",
  "south indian", "north indian", "à la carte", "a la carte", "combos",
  "extras", "add ons", "add-ons", "accompaniments", "from the grill",
];
