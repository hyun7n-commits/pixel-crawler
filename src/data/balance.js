// Numbers that shape how a run feels. Tune here first.

export const MAP_W = 44;
export const MAP_H = 32;
export const SIGHT = 7;            // view radius in tiles
export const LAST_FLOOR = 9;
export const FLOORS_PER_ZONE = 3;

export const xpToLevel = lvl => 3 + lvl * 4;
export const HP_PER_LEVEL = 3;
export const LEVEL_UP_HEAL = 0.3;  // share of max HP restored on level up

export const enemiesPerFloor = floor => 6 + floor;
// stat multiplier for enemies: grows within a zone and a little per zone
export const enemyScale = floor => 1 + 0.15 * ((floor - 1) % 3) + 0.1 * Math.floor((floor - 1) / 3);
export const bossScale = floor => 1 + 0.1 * (floor / 3 - 1);

export const GOLD_DROP_CHANCE = 0.4;
export const VICTORY_BONUS = 200;

export const POTION_HEAL = 0.6;

// The big ore on each floor: how many swings it takes, how far each swing is heard,
// how much mine gas the crack beside it puffs per swing, and what it pays.
export const ORE_HITS = 5;
export const ORE_NOISE = [3, 5, 7, 10, 14];
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
export const START_ASLEEP = 0.85;
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
