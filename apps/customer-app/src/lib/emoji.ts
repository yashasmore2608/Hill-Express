/**
 * Placeholder art until the real image pipeline (R2 + blurhash) lands.
 *
 * Two layers:
 *  1. PRODUCT match — a specific icon per item, so a grid of six vegetables
 *     doesn't read as six identical tiles.
 *  2. CATEGORY fallback — icon + a soft tint pair tuned for both grounds,
 *     which also makes the category grid scannable by colour before text.
 */

interface CategoryVisual {
  emoji: string;
  tintLight: string;
  tintDark: string;
}

const CATEGORIES: Array<{ match: RegExp; v: CategoryVisual }> = [
  { match: /fruit|vegetable/, v: { emoji: '🥬', tintLight: '#E7F3E3', tintDark: '#15241A' } },
  { match: /dairy|bread|egg/, v: { emoji: '🥛', tintLight: '#EEF2FA', tintDark: '#171F2B' } },
  { match: /atta|rice|dal/, v: { emoji: '🌾', tintLight: '#F7EFDE', tintDark: '#261F10' } },
  { match: /masala|oil/, v: { emoji: '🫙', tintLight: '#FAECE0', tintDark: '#271A0F' } },
  { match: /snack|biscuit/, v: { emoji: '🍪', tintLight: '#F6EBE3', tintDark: '#241A12' } },
  { match: /beverage|tea|coffee/, v: { emoji: '☕', tintLight: '#EDEAE4', tintDark: '#1F1D16' } },
  { match: /household/, v: { emoji: '🧽', tintLight: '#E6F0F2', tintDark: '#122225' } },
  { match: /personal/, v: { emoji: '🧼', tintLight: '#F0EAF4', tintDark: '#1E1826' } },
];

const FALLBACK: CategoryVisual = { emoji: '🛒', tintLight: '#EAF0EC', tintDark: '#17211D' };

/** Longest-match-first: 'coconut oil' must not match /oil/ before /coconut/. */
const PRODUCTS: Array<[RegExp, string]> = [
  // produce
  [/apple/, '🍎'],
  [/banana/, '🍌'],
  [/mango/, '🥭'],
  [/grape/, '🍇'],
  [/orange|kinnow|santra/, '🍊'],
  [/lemon|nimbu/, '🍋'],
  [/tomato/, '🍅'],
  [/onion|pyaz/, '🧅'],
  [/potato|aloo/, '🥔'],
  [/carrot|gajar/, '🥕'],
  [/chilli|mirch/, '🌶️'],
  [/cucumber|kheera/, '🥒'],
  [/garlic|lehsun/, '🧄'],
  [/corn|makka/, '🌽'],
  [/spinach|palak|coriander|dhania|methi|leaf/, '🥬'],
  // dairy & bakery
  [/milk|dahi|curd|yogurt|lassi/, '🥛'],
  [/butter|makhan/, '🧈'],
  [/cheese|paneer/, '🧀'],
  [/egg|anda/, '🥚'],
  [/bread|bun|pav/, '🍞'],
  // staples
  [/atta|flour|maida/, '🌾'],
  [/rice|chawal|basmati/, '🍚'],
  [/dal|lentil|pulse|rajma|chana/, '🫘'],
  [/salt|namak|sugar|cheeni/, '🧂'],
  [/oil|ghee/, '🫗'],
  [/masala|spice|garam|haldi|turmeric/, '🫙'],
  // snacks & drinks
  [/biscuit|cookie|parle|marie/, '🍪'],
  [/chips|lays|kurkure|bhujia|namkeen|mixture/, '🥨'],
  [/chocolate|cadbury|dairy milk/, '🍫'],
  [/tea|chai/, '🍵'],
  [/coffee|nescafe|bru/, '☕'],
  [/juice|drink|cola|soda|pepsi|coke/, '🥤'],
  [/water|bisleri/, '💧'],
  [/health drink|bournvita|horlicks|complan/, '🥛'],
  // household & care
  [/soap|sabun|dettol|lifebuoy/, '🧼'],
  [/detergent|surf|ariel|tide|wash/, '🧴'],
  [/dish|vim|scrub/, '🧽'],
  [/brush|paste|colgate|dabur/, '🪥'],
  [/shampoo|hair/, '🧴'],
  [/tissue|paper|napkin/, '🧻'],
];

export const categoryVisual = (name: string): CategoryVisual => {
  const n = name.toLowerCase();
  return CATEGORIES.find((c) => c.match.test(n))?.v ?? FALLBACK;
};

export const categoryEmoji = (name: string): string => categoryVisual(name).emoji;

export const categoryTint = (name: string, mode: 'light' | 'dark'): string => {
  const v = categoryVisual(name);
  return mode === 'dark' ? v.tintDark : v.tintLight;
};

/** Specific icon for a product; falls back to its category's icon. */
export const productEmoji = (productName: string, categoryName = ''): string => {
  const n = productName.toLowerCase();
  return PRODUCTS.find(([re]) => re.test(n))?.[1] ?? categoryEmoji(categoryName);
};
