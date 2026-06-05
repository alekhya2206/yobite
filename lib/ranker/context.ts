// Parse the optional "eaten anything today?" field into balancing signals.
// This is what lets YoBite say "you've already had rice today" — the small touch
// that makes the pick feel like it's actually paying attention.

import type { AteContext } from "./types";

const CARB_WORDS = ["rice", "biryani", "pulao", "naan", "roti", "bread", "pasta", "noodles", "paratha", "pizza", "sandwich", "burger", "fries", "potato", "poha", "idli", "dosa", "upma", "oats", "cereal", "toast", "bagel", "wrap", "maggi", "thali", "carbs", "carb"];
const FRIED_WORDS = ["fried", "samosa", "pakora", "pakoda", "vada", "puri", "bhatura", "chips", "fries", "fritter", "cutlet", "nuggets", "crispy", "tempura"];
const RICH_WORDS = ["butter", "cheese", "cream", "creamy", "paneer", "makhani", "korma", "gravy", "pizza", "burger", "biryani", "rich", "heavy", "ghee", "alfredo"];
const PROTEIN_WORDS = ["chicken", "egg", "eggs", "fish", "paneer", "mutton", "dal", "daal", "lentil", "protein", "tofu", "prawn", "meat", "whey", "shake", "yogurt", "curd", "chana", "rajma", "beans"];
const SWEET_WORDS = ["sweet", "dessert", "cake", "ice cream", "icecream", "chocolate", "sugar", "gulab", "jalebi", "halwa", "cookie", "pastry", "kheer", "ladoo", "barfi", "soda", "cola", "juice"];

function any(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function parseAte(raw: string | undefined): AteContext {
  const text = (raw || "").toLowerCase();
  if (!text.trim()) {
    return { raw: "", hadCarbs: false, hadFried: false, hadRich: false, hadProtein: false, hadSweet: false };
  }
  return {
    raw: raw!.trim(),
    hadCarbs: any(text, CARB_WORDS),
    hadFried: any(text, FRIED_WORDS),
    hadRich: any(text, RICH_WORDS),
    hadProtein: any(text, PROTEIN_WORDS),
    hadSweet: any(text, SWEET_WORDS),
  };
}
