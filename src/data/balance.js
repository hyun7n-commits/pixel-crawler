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
export const bombDamage = floor => 12 + 2 * floor;
