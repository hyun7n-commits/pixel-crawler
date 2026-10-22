// Numbers that shape how a run feels. Tune here first.

export const MAP_W = 44;
export const MAP_H = 32;
export const SIGHT = 7;            // view radius in tiles
export const LAST_FLOOR = 9;
export const FLOORS_PER_ZONE = 3;

// v0.15: level-ups come quicker, so relics grow and evolve within a run (BALL x PIT pace)
export const xpToLevel = lvl => 3 + lvl;
// chance a relic card turns into "both of these +1"
export const TWIN_CHANCE = 0.35;
// chance a card is the unseen other half of a recipe for a relic you are growing (nothing says so)
export const PARTNER_CHANCE = 0.55;
// 별사탕, BALL x PIT's fission: one candy grows this many relic levels in a row (다다다닥).
// Bosses, treasure critters, the oak stump and sparkle boulders (by vein size) drop them.
export const candySteps = floor => 3 + Math.floor((floor - 1) / FLOORS_PER_ZONE);
export const CANDY_BOSS = 2;              // extra steps in a boss's candy
export const CANDY_ORE = [0.3, 0.45, 0.65, 1];
export const UP_HP = 3;           // max HP per level of the shop's 튼튼한 몸
export const HP_PER_LEVEL = 1;     // a level up heals nothing (v0.20): health only comes back slowly, or from potions

// v0.15: the Shattered Pixel Dungeon way. Fewer monsters than v0.14, but each one hits hard
// (enemies.js), so walking in and trading blows with two at once loses;
// doorways, surprise hits, bombs and backing off are what win.
export const enemiesPerFloor = floor => 5 + floor;
// stat multiplier for enemies: grows within a zone and a lot per zone, because relics, candies and
// evolutions make you much stronger as you go (v0.19). Attack grows by ATK_SHARE of it, health in full.
export const enemyScale = floor => 1 + 0.18 * ((floor - 1) % 3) + 0.55 * Math.floor((floor - 1) / 3);
export const ATK_SHARE = 1.6;
export const POTION_CHANCE = 0.35;  // a potion lying somewhere on a floor (scarce: healing is precious)
export const bossScale = floor => 1 + 0.5 * (floor / 3 - 1);

export const GOLD_DROP_CHANCE = 0.4;
export const VICTORY_BONUS = 200;

// 토벌 단계: after the first win the fields get rowdier, one step per win, up to STEP_MAX. Picked at
// the guild (ui/hub.js). Each step makes every critter tougher and pays more gold.
export const STEP_MAX = 5;
export const stepFoe = s => 1 + 0.15 * s;   // critters' health and attack
export const stepGold = s => 1 + 0.2 * s;   // gold you pick up
// the highest step won so far (-1 before the first win; saves from before steps count a win as step 0)
export const topStep = m => m.stats.topStep ?? (m.stats.wins > 0 ? 0 : -1);
export const stepsOpen = m => Math.min(STEP_MAX, topStep(m) + 1);

export const POTION_HEAL = 0.6;

// Tension, the Shattered Pixel Dungeon way: you should often end up a hit or two from death and live.
// Enemy hits roll between these shares of their attack, so you never quite know if the next one is the one.
// Wide (v0.20): now and then one lands much harder than you planned for, and nothing saves you at 1 HP.
export const HIT_ROLL = [0.5, 1.6];
// Wounds close slowly on their own (1 HP every this many turns), so backing off and catching your
// breath is worth it, but monsters keep wandering in while you wait.
export const REGEN_TURNS = 15;

// The big ore on each floor: how many swings it takes, how far each swing is heard,
// how much mine gas the crack beside it puffs per swing, and what it pays.
// One big ore a field (v0.20: fewer things on the map, so each one matters).
// From the third swing the mine answers: monsters crawl out of the dark and head for the sound.
export const ORES_PER_FLOOR = 1;
export const ORE_HITS = 5;
export const ORE_NOISE = [3, 5, 7, 10, 14];
export const ORE_WAVE = [0, 0, 1, 2, 2];
// Veins come in sizes: most ores are one block, some run two or three tiles, and now and then a
// 2x2 jackpot. A bigger vein pays more on every swing and when it breaks, and draws a bigger crowd.
export const ORE_SIZE_CHANCE = [0.5, 0.3, 0.13, 0.07];
export const ORE_SIZE_MULT = [1, 1.5, 2, 3];
export const ORE_SIZE_WAVE = [0, 0, 1, 1];
export const ORE_GAS = 10;
export const oreGold = floor => 2 + floor;
export const oreJackpot = floor => 18 + 5 * floor;
// Ore grades (data/ores.js): each zone starts one grade higher, sometimes one more.
// Every swing but the last may crack into the next grade (harder for each grade above the
// zone's own; the pick relics' bonus is not reduced, so gems are what an ore build hunts),
// and later swings pay more. Now and then a swing hits a bonanza ("노다지"):
// many times the gold, and always a better grade.
export const ORE_START_BONUS = 0.3;
export const ORE_RISE = [0.08, 0.1, 0.12, 0.15];
export const ORE_RISE_DECAY = 0.6;
export const ORE_SWING = [1, 1.25, 1.5, 1.8];
export const ORE_NUGGET = [0.03, 0.04, 0.05, 0.06];
export const ORE_NUGGET_MULT = 5;
export const bombDamage = floor => 12 + 2 * floor;

// Enemies: most start asleep. Once you thin a floor out, a wanderer comes in every so often.
export const START_ASLEEP = 0.6;
// ...and every one closer than this to where you arrive is asleep (SPD v4.0's calm vault entrance)
export const CALM_START = 10;
// awake critters moving out of sight this close leave footprints you can hear (scenes/DungeonScene.js)
export const HEAR_STEPS = 6;
export const RESPAWN_TURNS = 40;
// Asleep, you snore: enemies this close hear it and come looking.
export const SNORE_NOISE = 8;
// The ore turtle: a calm, tough monster that carries treasure
export const TURTLE_CHANCE = 0.5;
export const turtleGold = floor => 15 + 5 * floor;

// Tall grass: chance that flattening it turns up a few coins.
export const GRASS_COIN = 0.04;

// Traps (data/terrain.js). How many per floor, how many of them start hidden,
// the chance per turn to spot a hidden one next to you, and what they do.
export const trapsPerFloor = floor => Math.min(5, 1 + Math.floor(floor / 2));
export const trapHidden = floor => (floor < 2 ? 0 : Math.min(0.5, 0.15 * floor));
export const TRAP_SPOT = 0.35;
export const trapSpike = floor => 5 + 2 * floor;
export const trapSummon = floor => Math.min(5, 2 + Math.floor(floor / 3) + (Math.random() < 0.5 ? 1 : 0));

// Special rooms (core/specials.js) and the things in them.
// gimmickScale: mimics, statues, wraiths and quest monsters get tougher zone by zone.
export const gimmickScale = floor => enemyScale(floor) * (1 + 0.5 * Math.floor((floor - 1) / FLOORS_PER_ZONE));
export const MIMIC_CHANCE = 0.18;      // a chest from floor 2 on is a mimic
export const VAULT_CHANCE = 0.45;      // floor 2 on: a locked crystal vault, its key elsewhere on the floor
export const LOCKED_CHEST_CHANCE = 0.55; // otherwise: a locked chest and its key
export const SPECIAL_CHANCE = 0.55;    // each of grave room, statue room and trap room
export const HIVE_CHANCE = 0.35;       // the honey stump, a little rarer
// the honey stump: its honey pot adds max HP for the run; its bees (normal zone strength, not a
// gimmick's) give up once you are farther than BEE_HOME from it; a fire within HIVE_SMOKE smokes them to sleep
export const honeyHp = floor => 3 + Math.floor((floor - 1) / FLOORS_PER_ZONE);
export const BEE_HOME = 6;
// 요정 고리: the chance a field has a pair of fairy rings, by zone (most in the deep forest)
export const RING_CHANCE = [0.2, 0.7, 0.3];
// 온천: the chance a flooded room's pool is a hot spring, by zone (most up the rocky hills); anyone
// standing in it gets SPRING_HEAL back every other turn, critters too
export const SPRING_CHANCE = [0, 0.25, 0.7];
export const SPRING_HEAL = 1;
export const HIVE_SMOKE = 2;
// 풀뽑기 밭: the chance a field has a weed patch, by zone (most out on the meadow); each weed pulled
// pays a little, one or two are screaming roots that run off yelling (heard SCREAM_RANGE away) for
// ROOT_TURNS turns before they dig back in, and the last weed of the patch hides a star candy
export const WEED_CHANCE = [0.65, 0.35, 0.15];
export const weedGold = floor => (1 + Math.floor((floor - 1) / FLOORS_PER_ZONE)) * (2 + Math.floor(Math.random() * 2));
export const SCREAM_RANGE = 7;
// the smith's gift for every BOOK_GIFT_EVERY recipes in the book: the k-th one (from 1) is bookGift(k) gold
export const BOOK_GIFT_EVERY = 10;
export const bookGift = k => 100 + 100 * k;
export const bookGiftsDue = (found, claimed) => Math.floor(found / BOOK_GIFT_EVERY) - (claimed || 0);
export const ROOT_TURNS = 8;
export const graveGold = floor => (2 + Math.floor((floor - 1) / FLOORS_PER_ZONE)) * (3 + Math.floor(Math.random() * 4));
