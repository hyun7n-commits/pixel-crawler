// Playable characters. `start` is the relics (and levels) a run begins with.
// The others are not bought: each one is locked in a cage (우리) on one stage at one 회차
// (FRIENDS in data/stages.js). Break the lock and they move into the village (core/run.js).

// `kind` is what they are (a raccoon, a sheep...), shown small beside the name.
// Each one plays differently because of one trait of their own (`note` says it in a line):
//   dodge · sneak: added to the surprise multiplier · hush: how fast sleepers notice you (1 = normal)
//   choices: relic cards per pick · block: chance to stop a blow on the shield
//   lifesteal: HP back per hit · noRegen: no slow healing
//   hop: every nth step is so quick nobody else moves · pouch: extra potions, gold rolls in from nearby
//   lives: get up again after being knocked out · thorns: hitting you hurts
//   sight: wider view · sniff: every field's chests, keys and hidden traps show on arrival
//   swim: stronger standing in water · graze: tall grass heals as you trample it
//   shell: waiting hides you in your shell, halving the next blows · quiet · dig: sparkle rocks come
//   apart a swing sooner · bombs: starting bombs, your own blasts don't hurt you
//   shove: every hit knocks the critter back a tile · ram: a run-up makes the next blow double
//   breath: breathes fire on someone close every nth turn · stink: a stink when badly hurt dazes
//   everyone close (once a field) · blend: standing still, only a critter right beside you can see you
export const CHARACTERS = {
  // the one you start as: no trait, no relic, nothing but a pickaxe and a lantern
  adv: {
    name: '일꾼', kind: '밀짚모자', sprite: 'adv', hp: 30, atk: 3, def: 0,
    start: {}, note: '재주도 유물도 없는 평범한 일꾼. 그래서 뭐든 될 수 있다',
  },
  rogue: {
    name: '도적', kind: '너구리', sprite: 'rogue', hp: 27, atk: 4, def: 0, dodge: 0.2, sneak: 1, hush: 0.5,
    start: { boots: 1 }, note: '날렵해서 잘 피하고, 자는 적이 늦게 깨며, 기습이 훨씬 아프다',
  },
  mage: {
    name: '마법사', kind: '양', sprite: 'mage', hp: 25, atk: 3, def: 0, choices: 4,
    start: { bolt: 2 }, note: '유물을 고를 때 하나 더 보고 고른다',
  },
  knight: {
    name: '기사', kind: '강아지', sprite: 'knightP', hp: 32, atk: 3, def: 1, block: 0.17,
    start: { shield: 1 }, note: '여섯 번에 한 번꼴로 공격을 방패로 막아 낸다',
  },
  vamp: {
    name: '흡혈귀', kind: '박쥐', sprite: 'vamp', hp: 31, atk: 4, def: 0, lifesteal: 1, noRegen: true,
    start: { fang: 1 }, note: '때릴 때마다 체력 +1, 대신 가만히 있어서는 낫지 않는다',
  },

  // ---------- the sixteen friends met from the second 회차 on ----------
  rabbit: {
    name: '배달부', kind: '토끼', sprite: 'hero_rabbit', hp: 26, atk: 3, def: 0, hop: 3,
    start: { cloak: 1 }, note: '세 걸음에 한 번은 깡충 뛰어서, 그동안 아무도 움직이지 못한다',
  },
  hamster: {
    name: '짐꾼', kind: '햄스터', sprite: 'hero_hamster', hp: 30, atk: 3, def: 0, pouch: 2,
    start: { coin: 1 }, note: '볼주머니에 물약을 2개 더 넣어 가고, 두 칸 안의 골드가 저절로 들어온다',
  },
  cat: {
    name: '곡예사', kind: '고양이', sprite: 'hero_cat', hp: 27, atk: 4, def: 0, lives: 1,
    start: { bandage: 1 }, note: '아홉 목숨: 탐험마다 한 번, 쓰러져도 체력 절반으로 다시 일어난다',
  },
  hedgehog: {
    name: '문지기', kind: '고슴도치', sprite: 'hero_hedgehog', hp: 30, atk: 3, def: 0, thorns: 3,
    start: { heart: 1 }, note: '나를 때린 적은 가시에 3씩 찔린다',
  },
  owl: {
    name: '야경꾼', kind: '부엉이', sprite: 'hero_owl', hp: 28, atk: 4, def: 0, sight: 3,
    start: { lantern: 1 }, note: '밤눈이 밝아서 시야가 3칸 더 넓다',
  },
  fox: {
    name: '탐정', kind: '여우', sprite: 'hero_fox', hp: 28, atk: 4, def: 0, sniff: true,
    start: { coin: 1 }, note: '들판에 들어서자마자 상자와 열쇠, 숨은 함정이 어디 있는지 안다',
  },
  frog: {
    name: '뱃사공', kind: '개구리', sprite: 'hero_frog', hp: 28, atk: 3, def: 0, swim: true,
    start: { heart: 1 }, note: '물웅덩이에 서 있으면 공격 +3, 피하기 +25%',
  },
  panda: {
    name: '정원사', kind: '판다', sprite: 'hero_panda', hp: 34, atk: 3, def: 0, graze: 2,
    start: { heart: 1 }, note: '키 큰 풀을 밟을 때마다 우물우물 체력 +2',
  },
  turtle: {
    name: '수호자', kind: '거북이', sprite: 'hero_turtle', hp: 34, atk: 3, def: 0, shell: true,
    start: { shield: 1 }, note: '쉬면 등껍질에 쏙 숨어서 그 사이 받는 피해가 절반이 된다',
  },
  mole: {
    name: '광부', kind: '두더지', sprite: 'hero_mole', hp: 30, atk: 3, def: 0, quiet: true, dig: 1,
    start: { pick: 1 }, note: '반짝 바위를 한 번 덜 쳐도 깨고, 캘 때 소리도 작다',
  },
  penguin: {
    name: '폭파공', kind: '펭귄', sprite: 'hero_penguin', hp: 28, atk: 3, def: 0, bombs: 3,
    start: { bombbag: 1 }, note: '폭탄 3개를 들고 나가고, 내 폭탄에는 다치지 않는다',
  },
  bear: {
    name: '씨름꾼', kind: '곰', sprite: 'hero_bear', hp: 34, atk: 4, def: 0, shove: true,
    start: { hammer: 1 }, note: '때린 적을 한 칸 밀쳐 낸다. 벽이나 다른 적에 부딪히면 더 아프다',
  },
  goat: {
    name: '돌격대', kind: '염소', sprite: 'hero_goat', hp: 30, atk: 4, def: 0, ram: true,
    start: { blade: 1 }, note: '같은 쪽으로 두 칸 이상 달려와서 들이받으면 두 배로 아프다',
  },
  dragon: {
    name: '불꽃술사', kind: '아기 용', sprite: 'hero_dragon', hp: 28, atk: 3, def: 0, breath: 5,
    start: { ring: 1 }, note: '다섯 턴마다 두 칸 안의 적에게 불을 훅 뿜는다',
  },
  skunk: {
    name: '조향사', kind: '스컹크', sprite: 'hero_skunk', hp: 30, atk: 3, def: 0, stink: true,
    start: { cloak: 1 }, note: '체력이 1/3 아래로 떨어지면 (구역마다 한 번) 지독한 냄새로 주변 적이 2턴 동안 어질어질',
  },
  chameleon: {
    name: '첩보원', kind: '카멜레온', sprite: 'hero_chameleon', hp: 26, atk: 4, def: 0, blend: true,
    start: { boots: 1 }, note: '가만히 쉬면 몸 색이 바뀌어 바로 옆이 아니면 적이 나를 놓친다',
  },
};
