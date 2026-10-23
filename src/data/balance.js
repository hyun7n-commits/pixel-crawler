// Numbers that shape how a run feels. Tune here first.

export const MAP_W = 44;
export const MAP_H = 32;
export const SIGHT = 7;            // view radius in tiles
// A trip is one stage (data/stages.js): FLOORS_PER_ZONE fields of one zone, the last its boss. Floors
// are numbered across all ten stages (stage 2 starts at floor 5), so a floor says which zone it is in.
export const FLOORS_PER_ZONE = 4;
export const LAST_FLOOR = 20;
export const stageOf = floor => Math.floor((floor - 1) / FLOORS_PER_ZONE);
export const localOf = floor => ((floor - 1) % FLOORS_PER_ZONE) + 1;   // 1..FLOORS_PER_ZONE; the last is the boss
// v0.23, ten stages: past the fifth, gold, hazards and candy climb at a third of the pace (the first five keep
// the numbers they were tuned with), so the late fields pay well without one trip buying out the village.
// gs: a stage on that slower scale; gfl: a floor on it (the formulas below that take a floor use gfl).
export const gs = stage => stage <= 4 ? stage : 4 + (stage - 4) / 3;
export const gfl = floor => FLOORS_PER_ZONE * gs(stageOf(floor)) + localOf(floor);

// v0.15: level-ups come quicker, so relics grow and evolve within a run (BALL x PIT pace)
export const xpToLevel = lvl => 3 + lvl;
// chance a relic card turns into "both of these +1"
export const TWIN_CHANCE = 0.35;
// chance a card is the unseen other half of a recipe for a relic you are growing (nothing says so)
export const PARTNER_CHANCE = 0.55;
// 별사탕, BALL x PIT's fission: one candy grows this many relic levels in a row (다다다닥).
// Bosses, treasure critters, the oak stump and sparkle boulders (by vein size) drop them.
export const candySteps = floor => 3 + Math.floor((gfl(floor) - 1) / FLOORS_PER_ZONE);
export const CANDY_BOSS = 2;              // extra steps in a boss's candy
export const CANDY_ORE = [0.3, 0.45, 0.65, 1];
export const UP_HP = 3;           // max HP per level of the shop's 튼튼한 몸
export const HP_PER_LEVEL = 1;     // a level up heals nothing (v0.20): health only comes back slowly, or from potions

// v0.15: the Shattered Pixel Dungeon way. Fewer monsters than v0.14, but each one hits hard
// (enemies.js), so walking in and trading blows with two at once loses;
// doorways, surprise hits, bombs and backing off are what win.
// (no more than the fifth stage's crowd: the later fields are harder one critter at a time, not by numbers)
export const enemiesPerFloor = floor => 5 + localOf(floor) + Math.min(4, stageOf(floor));
// stat multiplier for enemies: grows field by field within a trip (and with STAGE_UP from stage to
// stage, none for now: each zone's critters are tougher to begin with, and the 회차 adds the rest).
// Attack grows by ATK_SHARE of it, health in full.
export const STAGE_UP = +(globalThis.process?.env?.STAGE_UP ?? 0);
// ...but the five later stages' critters get this much more on top (the forest a touch less), tuned with the bot so a fresh save
// with the stage's 출발 보급 finds each of them about as hard as the meadow (FOE_UP env: a test override).
// v0.25: the legends' moves made the later stages' kit hands stronger, so those critters went up a little
// (160 bot runs a stage, a fresh worker wins about one in five everywhere)
const FOE_UP = (globalThis.process?.env?.FOE_UP || '0,-0.12,0,0.08,0.09,0.42,0.46,0.6,0.18,0.66').split(',').map(Number);
export const foeUp = s => FOE_UP[Math.min(s, FOE_UP.length - 1)] + 0.1 * Math.max(0, s - (FOE_UP.length - 1));
// 출발 보급: a deeper stage is entered as a seasoned explorer, the guild sees to that. You start at a
// higher level, a little stronger and sturdier, and pick some relics (two levels each) before the
// first step. Tuned with the bot (relicsim) so each stage is about as hard as the first, fresh.
const ENV = globalThis.process?.env || {};
export const stageKit = stage => ({
  lvl: 1 + 2 * stage, picks: Math.round(+(ENV.KIT ?? 1.5) * stage),
  atk: Math.round(+(ENV.KIT_ATK ?? 1.5) * stage), hp: Math.round(+(ENV.KIT_HP ?? 6) * stage),
});
export const enemyScale = floor => 1 + 0.15 * (localOf(floor) - 1) + STAGE_UP * stageOf(floor) + foeUp(stageOf(floor));
export const ATK_SHARE = 1.6;
export const POTION_CHANCE = 0.35;  // a potion lying somewhere on a floor (scarce: healing is precious)
// 깊은 곳: each floor down past the boss, critters this much stronger again
export const DEEP_UP = +(globalThis.process?.env?.DEEP_UP ?? 0.25);
export const bossScale = floor => 1 + STAGE_UP * stageOf(floor) + foeUp(stageOf(floor));
// 우두머리: the crowned mid-boss that carries a caged friend's key (data/stages.js): this many times a
// critter of its kind on that field, in health and in attack
export const CHIEF_HP = 3, CHIEF_ATK = 1.4;
// v0.23: jumping or being knocked down a drop costs this share of your health; lava burns this much
export const FALL_HURT = 0.2;
export const lavaHurt = floor => 6 + Math.floor(gfl(floor) / 3);
// how long a snail's slime and the queen bee's honey stay on the ground
export const GOO_TURNS = 14;
// v0.26 들판 도구 (data/items.js): a meadow tool lies somewhere on a field this often (one of the ones
// opened so far), and a second one now and then
export const TOOL_CHANCE = 0.6, TOOL_MORE = 0.2;
export const pineDamage = floor => 3 + Math.floor(gfl(floor) / 3);
export const BELL_TURNS = 4, BELL_RANGE = 7, PINE_NOISE = 3;
export const CHILI_TURNS = 5, CHILI_BOSS = 2;
// 민들레 홀씨 carries you at least this many steps' walk from where you were
export const BLOW_MIN = 10;
// 갈림길 (data/routes.js): the second burrow is at least this many steps from where you come in and from the first
export const FORK_APART = 10;

// v0.21 zones. The marsh is darker (MARSH_DARK tiles of sight) but its fireflies light FLY_LIGHT tiles
// around them, and each one caught in a jar gives a tile of sight back for the trip (FLY_MAX at most).
export const MARSH_DARK = 2, FLY_LIGHT = 2, FLY_MAX = 2, FLIES_PER_FLOOR = [3, 5];
// The cave: stalactites over the rooms (DRIPS_PER_ROOM), shaken loose by a noise within DRIP_SHAKE tiles.
// A falling stone (theirs, or the boar chief's) hits for rockDmg, critters twice as hard.
export const DRIPS_PER_ROOM = [0, 1], DRIP_SHAKE = 5;
export const rockDmg = floor => 4 + Math.floor(gfl(floor) / 2);

// field terrain (v0.21): a berry bush heals a little; lone bushes and boulders stand in bigger rooms
export const BERRY_CHANCE = 0.55;
export const berryHeal = floor => 4 + Math.floor(gfl(floor) / 3);
export const PROPS_PER_ROOM = [0, 2];

export const GOLD_DROP_CHANCE = 0.4;
// beating a stage's boss pays this much on top (times the 회차's and the dares' gold)
export const stageBonus = stage => 80 + 40 * stage;

// 라이벌의 내기 (data/dares.js): what each dare does
export const DARE_FOE = 1.4;            // 사나운 들판: critters' health and attack
export const DARE_DARK = 3;             // 작은 등불: tiles less sight
export const DARE_CALL = 8;             // 소문 빠른 들판: how far a critter that spots you is heard
export const DARE_BOSS_HP = 1.5, DARE_BOSS_ATK = 1.25;   // 화난 대장
export const DARE_SLOTS = 2;            // 가벼운 가방: relic slots fewer

export const POTION_HEAL = 0.6;

// Tension, the Shattered Pixel Dungeon way: you should often end up a hit or two from death and live.
// Enemy hits roll between these shares of their attack, so you never quite know if the next one is the one.
// Wide (v0.20): now and then one lands much harder than you planned for, and nothing saves you at 1 HP.
export const HIT_ROLL = [0.5, 1.6];
// Wounds close slowly on their own (1 HP every this many turns), so backing off and catching your
// breath is worth it, but monsters keep wandering in while you wait.
export const REGEN_TURNS = 15;
// 연속 처치 (v0.23): how many turns may pass between two kills for the second to count on, and the
// gold for the n-th one in a row (n × (stage + 1) × this)
export const COMBO_TURNS = 2, COMBO_GOLD = 1;
// 마법사's wand (v0.23): how far a spark reaches, how many the wand holds, and how many turns each one
// takes to come back
export const WAND_RANGE = 4, WAND_CHARGES = 3, WAND_RECHARGE = 4, WAND_POWER = 1.5;

// The big ore on each floor: how many swings it takes, how far each swing is heard,
// how much mine gas the crack beside it puffs per swing, and what it pays.
// One big ore a field (v0.20: fewer things on the map, so each one matters).
// From the third swing the mine answers: monsters crawl out of the dark and head for the sound
// (not on the first field, where only those already there wake up).
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
export const oreGold = floor => 2 + gfl(floor);
export const oreJackpot = floor => 18 + 5 * gfl(floor);
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
export const bombDamage = floor => 12 + 2 * gfl(floor);
// 반짝돌 왕관: a critter set into a pebble of sparkle rock pays this share of a one-tile vein's haul (and no chest)
export const PEBBLE_HAUL = 0.4;

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
export const turtleGold = floor => 15 + 5 * gfl(floor);

// Tall grass: chance that flattening it turns up a few coins.
export const GRASS_COIN = 0.04;

// Traps (data/terrain.js). How many per floor, how many of them start hidden,
// the chance per turn to spot a hidden one next to you, and what they do.
export const trapsPerFloor = floor => Math.min(5, 1 + Math.floor(gfl(floor) / 2));
export const trapHidden = floor => (floor < 2 ? 0 : Math.min(0.5, 0.15 * floor));
export const TRAP_SPOT = 0.35;
export const trapSpike = floor => 5 + 2 * gfl(floor);
export const trapSummon = floor => Math.min(5, 2 + Math.floor(gfl(floor) / 3) + (Math.random() < 0.5 ? 1 : 0));

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
export const honeyHp = floor => 3 + Math.floor(gs(stageOf(floor)));
export const BEE_HOME = 6;
// 요정 고리: the chance a field has a pair of fairy rings, by zone (most in the deep forest)
export const RING_CHANCE = [0.2, 0.7, 0.3, 0.2, 0.3, 0.5, 0.2, 0.25, 0.1, 0.3];
// 온천: the chance a flooded room's pool is a hot spring, by zone (most up the rocky hills); anyone
// standing in it gets SPRING_HEAL back every other turn, critters too
export const SPRING_CHANCE = [0, 0.25, 0.2, 0.15, 0.7, 0.1, 0.6, 0.4, 0, 0.1];
export const SPRING_HEAL = 1;
export const HIVE_SMOKE = 2;
// 풀뽑기 밭: the chance a field has a weed patch, by zone (most out on the meadow); each weed pulled
// pays a little, one or two are screaming roots that run off yelling (heard SCREAM_RANGE away) for
// ROOT_TURNS turns before they dig back in, and the last weed of the patch hides a star candy
export const WEED_CHANCE = [0.65, 0.35, 0.3, 0.2, 0.15, 0.45, 0.05, 0.1, 0.05, 0.2];
export const weedGold = floor => (1 + Math.floor(gs(stageOf(floor)))) * (2 + Math.floor(Math.random() * 2));
export const SCREAM_RANGE = 7;
// the smith's gift for every BOOK_GIFT_EVERY recipes in the book: the k-th one (from 1) is bookGift(k) gold
export const BOOK_GIFT_EVERY = 10;
export const bookGift = k => 100 + 100 * k;
export const bookGiftsDue = (found, claimed) => Math.floor(found / BOOK_GIFT_EVERY) - (claimed || 0);
export const ROOT_TURNS = 8;
export const graveGold = floor => (2 + Math.floor(gs(stageOf(floor)))) * (3 + Math.floor(Math.random() * 4));

// 낡은 일꾼 명찰 (v0.23): rare from the second stage on, a few on every floor of the ruins (stage 10)
export const TAG_GOLD = 2;
export const tagsPerFloor = (stage) => stage === 9 ? 2 + (Math.random() < 0.5) : stage >= 1 && Math.random() < 0.15 ? 1 : 0;
