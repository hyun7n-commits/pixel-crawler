// 친밀도 (v0.30): how close you are with each of the village's folk (data/village.js FOLK) and with each
// friend living here (data/characters.js), and how close the folk are with each other.
// Hearts: HEART_PTS points a heart, ten hearts at most, kept in meta.hearts (who -> { p, chat, gift, ms,
// ask }). The first chat on a village day (meta.day: one a trip) gives a little; a present from the
// basket gives more, once a village day each: what they love, like, do not mind or would rather not
// have (data/affinity-people.js). Nobody ever says what they love; what they chat about may give it
// away. At 2, 4, 6, 8 and 10 hearts something happens (MILESTONES): a thank-you present (something for
// the basket, a little off at the shop, a 꾸미기, a word about cooking), and further on a short scene in
// the village (scenes/village-hearts.js). Each one is a page in the 비밀 도감's 하트 chapter
// (heart:<who>:<n>).
// Bonds: folk who get on (PAIRS, data/affinity-pairs.js) stop for a chat when they come across each
// other, and every village day they do, they get on a little better (meta.bonds: 'a-b' -> { p, day, ms
// }). At BOND_AT the village sees it (a walk together, a visit, a present for each other) and the 단짝
// chapter gets a page (pair:<a>-<b>:<n>). Now and then one of them asks you to take something over to
// the other (meta.errand): that brings the two closer, and you closer to both.

import { FOLK } from './village.js';
import { CHARACTERS } from './characters.js';
import { ITEM, TAGS, DISHES, FORAGE, addToBag } from './life.js';
import { josa } from '../core/util.js';
import { PEOPLE_DATA } from './affinity-people.js';
import { PAIR_LIST } from './affinity-pairs.js';

export const HEART_PTS = 10;
export const MAX_HEARTS = 10;
export const MILESTONES = [2, 4, 6, 8, 10];
// what each thing is worth, in points
export const CHAT_PTS = 2;
export const GIFT_PTS = { love: 10, like: 5, meh: 2, hate: -3 };
export const ERRAND_PTS = 5, ERRAND_BOND = 2;
// a pair's bond: one a village day they meet; the village sees it at these
export const BOND_AT = [2, 5, 9];

// ---------- who ----------
// the folk first, then the friends in the order they are found
export const PEOPLE = [...Object.keys(FOLK), ...Object.keys(CHARACTERS)].filter(id => PEOPLE_DATA[id]);
export const isFolk = id => !!FOLK[id];
export const whoName = id => FOLK[id]?.name || CHARACTERS[id]?.name || id;
export const whoSprite = id => FOLK[id]?.sprite || CHARACTERS[id]?.sprite;
export const personOf = id => PEOPLE_DATA[id];

// ---------- what someone thinks of a thing ----------
// kinds over and above data/life.js TAGS, for tastes
const DISH_IDS = Object.keys(DISHES).filter(id => id !== 'mystery');
const KINDS = {
  dish: DISH_IDS,
  crop: ['turnip', 'carrot', 'potato', 'cabbage', 'strawberry', 'pepper', 'tomato', 'corn', 'eggplant', 'sunflower', 'pumpkin', 'watermelon'],
  root: ['turnip', 'carrot', 'potato'],
  sweet: ['honey', 'strawberry', 'watermelon', 'rasp', 'strawjam', 'raspjam', 'honeycarrot', 'pumpkinmash', 'gangjeong', 'berrytart', 'honeywater', 'mooncookie', 'punch', 'fruitbowl', 'fruitskewer'],
  hot: ['pepper', 'kimchi', 'spicyfish'],
  warm: ['hotpot', 'fishsoup', 'cornsoup', 'pumpkinsoup', 'tomatostew', 'steamegg', 'herbtea', 'flowertea', 'eelbowl', 'pinerice', 'vegsoup', 'honeywater'],
  cold: ['punch', 'fruitbowl', 'watermelon'],
  grill: ['grilledfish', 'grillmush', 'roastnut', 'sashimi', 'potatocake'],
  shiny: ['goldcarp', 'goldbeetle', 'jewel', 'goldfish', 'koi', 'rainbow', 'moonfish', 'lantern', 'firefly'],
  rare: Object.values(ITEM).filter(it => it.rare).map(it => it.id),
  sturdy: ['rhino', 'stag', 'sturgeon', 'chestnut', 'potato', 'longhorn', 'jewel', 'goldbeetle', 'snail'],
  tree: Object.values(FORAGE).filter(f => f.where === 'tree').map(f => f.id),
  dfly: ['reddfly', 'bigdfly', 'damsel'],
  hopper: ['grasshopper', 'cricket', 'longhopper', 'mantis'],
  beetle: ['chafer', 'rhino', 'stag', 'jewel', 'longhorn', 'goldbeetle', 'ladybug', 'yladybug'],
  night: ['moth', 'firefly', 'cricket'],
  bee: ['honeybee', 'bumble'],
};
const inKind = (id, k) => (KINDS[k] || TAGS[k] || []).includes(id);

// 'love' | 'like' | 'meh' | 'hate'. The thing itself named anywhere beats a kind it is of; nobody
// minds a cooked dish; nobody wants rubbish (unless they say so)
export function tasteOf(who, id) {
  const t = PEOPLE_DATA[who];
  if (!t || !ITEM[id]) return 'meh';
  for (const k of ['love', 'hate', 'like']) if (t[k]?.includes(id)) return k;
  for (const k of ['love', 'hate', 'like']) if (t[k]?.some(kind => inKind(id, kind))) return k;
  if (TAGS.junk.includes(id)) return 'hate';
  if (id !== 'mystery' && ITEM[id].cat === 'dish') return 'like';
  return 'meh';
}

// a line with the thing's name in it: '@을' '@이' '@은' '@와' '@이야' '@이네' '@이라' '@으로', or a bare '@'
const FINAL = w => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 ? c % 28 : 0; };
export function fill(line, name) {
  return line.replace(/@(이야|이네|이라|으로|을|를|이|가|은|는|와|과)?/g, (_, p) => {
    if (!p) return name;
    if (p === '으로') return name + (FINAL(name) && FINAL(name) !== 8 ? '으로' : '로');
    const pairs = { 이야: ['이야', '야'], 이네: ['이네', '네'], 이라: ['이라', '라'], 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 와: ['과', '와'], 과: ['과', '와'] };
    return josa(name, ...pairs[p]);
  });
}

// ---------- hearts ----------
const rec = (meta, who) => ((meta.hearts ||= {})[who] ||= { p: 0 });
const day = meta => meta.day || 0;
export const heartPts = (meta, who) => meta.hearts?.[who]?.p || 0;
export const heartsOf = (meta, who) => Math.min(MAX_HEARTS, Math.floor(heartPts(meta, who) / HEART_PTS));
// points into the heart being filled now (0..HEART_PTS)
export const heartPart = (meta, who) => (heartsOf(meta, who) >= MAX_HEARTS ? 0 : heartPts(meta, who) % HEART_PTS);
export function addHeart(meta, who, n) {
  const h = rec(meta, who);
  h.p = Math.max(0, Math.min(MAX_HEARTS * HEART_PTS, h.p + n));
  return h.p;
}
// the next milestone reached and not yet had (0: none)
export function dueMilestone(meta, who) {
  const lv = heartsOf(meta, who), done = meta.hearts?.[who]?.ms || 0;
  return MILESTONES.find(m => m <= lv && m > done) || 0;
}
export function doneMilestone(meta, who, n) { const h = rec(meta, who); h.ms = Math.max(h.ms || 0, n); }
export const hadMilestone = (meta, who, n) => (meta.hearts?.[who]?.ms || 0) >= n;
export const milestoneOf = (who, n) => PEOPLE_DATA[who]?.ms[n] || null;

// the first chat on a village day: true when it counted
export function chatToday(meta, who) {
  const h = rec(meta, who);
  if (h.chat === day(meta)) return false;
  h.chat = day(meta);
  addHeart(meta, who, CHAT_PTS);
  return true;
}
export const giftedToday = (meta, who) => meta.hearts?.[who]?.gift === day(meta);
// what can be given: whatever is in the basket but seeds and maps
export const giftable = id => !!ITEM[id];
// A present from the basket: out of it, what they make of it, and the line they say
export function give(meta, who, id) {
  const taste = tasteOf(who, id), h = rec(meta, who), t = PEOPLE_DATA[who];
  h.gift = day(meta);
  addToBag(meta, id, -1);
  addHeart(meta, who, GIFT_PTS[taste]);
  // rubbish nobody asked for gets its own line, where they have one (their `hate` may be about something else)
  const junk = taste === 'hate' && TAGS.junk.includes(id) && !t.hate?.includes(id) && t.say.junk;
  const line = t.per?.[id] || junk || pick(t.say[taste]);
  return { taste, line: fill(line, ITEM[id].name) };
}
const pick = l => (Array.isArray(l) ? l[Math.floor(Math.random() * l.length)] : l);

// What they say when you bump into them: now and then something that gives away what they love
// (more often the better you know them); a friend's own chatter otherwise. Null: their usual.
export function chatLine(meta, who, rnd = Math.random) {
  const t = PEOPLE_DATA[who];
  if (!t) return null;
  if (t.hint && rnd() < 0.18 + 0.03 * heartsOf(meta, who)) return pick(t.hint);
  return t.talk ? pick(t.talk) : null;
}

// ---------- what the milestones give ----------
// A shop discount (shop ♥4) and a better price for what you sell (shop ♥8)
export const SEED_CUT = 0.8, SELL_UP = 1.1;
export const seedCut = meta => (hadMilestone(meta, 'shop', 4) ? SEED_CUT : 1);
export const sellUp = meta => (hadMilestone(meta, 'shop', 8) ? SELL_UP : 1);
// what a present gives, put away (the scene shows it): { item, n } | { seed, n } | { wear } | { gold } |
// { cut } | { sell } (the last two are only had: seedCut, sellUp)
export function takePresent(meta, g) {
  if (!g) return;
  if (g.item) addToBag(meta, g.item, g.n || 1);
  if (g.seed) addToBag(meta, `seed:${g.seed}`, g.n || 1);
  if (g.gold) meta.gold += g.gold;
  if (g.wear) {
    meta.wardrobe = { ...meta.wardrobe, [g.wear]: true };
  }
}

// ---------- bonds ----------
export const PAIRS = PAIR_LIST.map(p => ({ ...p, key: `${p.a}-${p.b}` }));
export const PAIR = Object.fromEntries(PAIRS.map(p => [p.key, p]));
export const pairsOf = who => PAIRS.filter(p => p.a === who || p.b === who);
export const otherOf = (p, who) => (p.a === who ? p.b : p.a);
const brec = (meta, key) => ((meta.bonds ||= {})[key] ||= { p: 0 });
export const bondPts = (meta, key) => meta.bonds?.[key]?.p || 0;
export const bondLevel = (meta, key) => BOND_AT.filter(n => bondPts(meta, key) >= n).length;
// one more for a village day they met: true when it counted
export function meetToday(meta, key) {
  const b = brec(meta, key);
  if (b.day === day(meta)) return false;
  b.day = day(meta);
  b.p += 1;
  return true;
}
export const metToday = (meta, key) => meta.bonds?.[key]?.day === day(meta);
export function addBond(meta, key, n) { brec(meta, key).p += n; }
export const dueBond = (meta, key) => { const lv = bondLevel(meta, key), done = meta.bonds?.[key]?.ms || 0; return lv > done ? done + 1 : 0; };
export function doneBond(meta, key, n) { const b = brec(meta, key); b.ms = Math.max(b.ms || 0, n); }

// ---------- errands ----------
// what is carried over, and its little picture (data/finds-art.js)
export const ERRAND_ITEMS = {
  letter: { name: '편지', pic: ['letter', 'w'] },
  note: { name: '쪽지', pic: ['letter', 'iY'] },
  lunch: { name: '도시락', pic: ['basket', 'nN'] },
  tea: { name: '따뜻한 차', pic: ['cup', 'g'] },
  crystal: { name: '반짝돌 조각', pic: ['crystal', 'c'] },
  seed: { name: '나무 씨앗', pic: ['seed', 'n'] },
  shell: { name: '조개껍데기', pic: ['shell', 'q'] },
  honey: { name: '꿀', pic: ['comb', 'yY'] },
  perfume: { name: '향수병', pic: ['bottle', 'q'] },
  yarn: { name: '털실 공', pic: ['yarn', 'r'] },
  whistle: { name: '호루라기', pic: ['whistle', 'y'] },
};
// Someone you chat with today may ask you to take something to their friend: on about one village
// day in three for each of them, once you know them a little, when the friend is about and you are not
// carrying something already. `here(id)`: is that one in the village now.
export function errandAsk(meta, who, here) {
  if (meta.errand || heartsOf(meta, who) < 1) return null;
  const h = meta.hearts?.[who];
  if (h?.ask === day(meta)) return null;
  const p = PAIRS.find(q => q.errand?.from === who && here(otherOf(q, who)));
  if (!p) return null;
  const roll = [...`${who}${day(meta)}`].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7);
  return roll % 3 === 0 ? { key: p.key, from: who, to: otherOf(p, who), what: p.errand.what, ask: p.errand.ask } : null;
}
export function takeErrand(meta, e) {
  rec(meta, e.from).ask = day(meta);
  meta.errand = { key: e.key, from: e.from, to: e.to, what: e.what };
}
// handed over: closer with both, and they with each other
export function doneErrand(meta) {
  const e = meta.errand;
  if (!e) return null;
  meta.errand = null;
  addHeart(meta, e.from, ERRAND_PTS);
  addHeart(meta, e.to, ERRAND_PTS);
  addBond(meta, e.key, ERRAND_BOND);
  return { ...e, thanks: PAIR[e.key]?.errand?.thanks || '고마워!' };
}

// ---------- the book's pages (data/book.js) ----------
const presentPic = g => (g?.item ? ITEM[g.item]?.pic : g?.seed ? { find: ['seed', 'n'] } : g?.wear ? { wear: g.wear } : g?.gold ? { find: ['coin', 'Y'] } : null);
export const heartId = (who, n) => `heart:${who}:${n}`;
export const pairId = (key, n) => `pair:${key}:${n}`;
export const HEART_PAGES = PEOPLE.flatMap(who => MILESTONES.map(n => {
  const m = PEOPLE_DATA[who].ms[n];
  const pic = (!m.steps && presentPic(m.give)) || { spr: whoSprite(who), mark: '♥' };
  return { id: heartId(who, n), name: `${whoName(who)} · ${m.name}`, line: m.line, pic, who, n };
}));
export const PAIR_PAGES = PAIRS.flatMap(p => p.lv.map((l, i) => ({
  id: pairId(p.key, i + 1), name: `${whoName(p.a)} · ${whoName(p.b)} · ${l.name}`, line: l.line,
  pic: { spr: whoSprite(p.a), tool: whoSprite(p.b) }, key: p.key, n: i + 1,
})));
