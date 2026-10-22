// The story, panel by panel. Each panel builds its diorama once (`build`, on a StoryScene `k`) and
// returns what its lines need; each line is shown in the text box under it, and `at` stages what
// happens on that line. `who` puts a name tag on a spoken line; narration has none.
// The view is 8 x 5 tiles (StoryScene VIEW); ground and hedges run on past it for wide screens.
//
// The story in short: a new worker moves to the little village at the edge of the fields with nothing
// but a straw hat and a debt. The fields toss and turn every night, so every morning the paths are
// new. The guild pays for 탐험 jobs and the sparkle boulders are money; whoever faints out there is
// carried home by the guild. Beat the boss at the end of a zone and you get that zone's license;
// all three, and there is a big prize. (The prize is a house of your own.)

const HOME = { id: 'home', w: 5, h: 4, roof: '#f4cf4f', sign: 'heart', chimney: true };
const GUILD = { id: 'guild', w: 5, h: 4, roof: '#3f6fb3', sign: 'flag', chimney: true };
const SHOP = { id: 'shop', w: 5, h: 4, roof: '#d9454a', sign: 'coin', awning: true };
const NEIGHBOR = { id: 'neighbor', w: 5, h: 4, roof: '#f29bb2', sign: 'heart' };
// license colours: meadow, forest, rock
export const LICENSE = { ratking: 0x6fbf4e, skelking: 0x2f7a46, lord: 0x8a7aa8 };
const NIGHT = 0x7880c0, DUSK = 0xffe2cc, HOUSE_NIGHT = 0xa8aee0;
const L = -14, R = 22;

// the dream house's texture (built off screen)
function homeKey(k) {
  k.house(HOME, -40, -40);
  return 'story_house_home_1';
}

// the guild with its master at the door and the hero in front: the opening's job talk, the licenses
function atGuild(k) {
  k.sky('day');
  k.ground(0, 3);
  k.hedge(0, L, R, 2);
  k.house(GUILD, 1.5, -1.5);
  const boss = k.actor('guildBoss', 4, 1.6);
  const hero = k.actor('adv', 3, 3.1);
  k.breathe(boss); k.breathe(hero, 200);
  return { boss, hero };
}

// the village at night, lamps lit
function villageNight(k) {
  k.sky('night');
  k.ground(0, 3, NIGHT);
  const back = k.hedge(0, L, R, 2, NIGHT);
  k.house(SHOP, -5, -1.5, true, HOUSE_NIGHT);
  k.house(GUILD, 1.5, -1.5, true, HOUSE_NIGHT);
  k.house(NEIGHBOR, 8, -1.5, true, HOUSE_NIGHT);
  k.lamp(0, 2); k.lamp(7, 2);
  return back;
}

const intro = [
  { // the village at night, and the fields that toss in their sleep
    build(k) {
      const back = villageNight(k);
      const front = [...k.hedge(0, L, 1, 4, NIGHT), ...k.hedge(0, 6, R, 4, NIGHT)];
      return { hedges: [...back, ...front] };
    },
    lines: [
      { text: '들판 끝에 작은 마을이 있다.' },
      { text: '이 들판은 밤마다 뒤척인다. 아침이면 길이 몽땅 바뀌어 있다.', at: (k, c) => k.toss(c.hedges) },
    ],
  },
  { // the new worker moves in
    build(k) {
      k.sky('day');
      k.ground(0, 2);
      k.hedge(0, L, R, 1);
      k.house(NEIGHBOR, 5.5, -2.5);
      const hero = k.actor('adv', -4, 2.8);
      k.walk(hero, 2.5, 1500, () => k.breathe(hero));
      return { hero };
    },
    lines: [
      { text: '그 마을에 오늘, 신입 일꾼이 이사 왔다.' },
      { text: '가진 거라곤 밀짚모자, 그리고 빚 문서 한 장.', at: (k, c) => { k.face(c.hero, 'teary'); c.note = k.mark(c.hero, '빚 문서…', 0); } },
      { text: '꿈은 하나. 빚 다 갚고, 언젠가 내 집 마련!', at: (k, c) => { c.note?.destroy(); k.face(c.hero, 'sparkle'); k.dream(c.hero, homeKey(k)); k.hop(c.hero, 2); } },
    ],
  },
  { // the guild and its jobs
    build: atGuild,
    lines: [
      { who: '조합장', text: '일하러 왔다고? 마침 잘됐네.', at: (k, c) => k.hop(c.boss) },
      {
        who: '조합장', text: '들판엔 말썽쟁이들이 산다네. 탐험하고 오면 일당을 주지.',
        at: (k, c) => {
          const rat = k.actor('rat', 0.5, 2.4), slime = k.actor('slime', 7, 2.4, { flip: true });
          for (const m of [rat, slime]) { m.setAlpha(0); m.y -= 10; k.tweens.add({ targets: m, alpha: 1, y: m.y + 10, duration: 260, ease: 'Back.out' }); }
          k.time.delayedCall(300, () => { k.mark(rat, '!'); k.mark(slime, '!'); k.face(c.hero, 'shock'); });
        },
      },
    ],
  },
  { // the sparkle boulders: money, but loud
    build(k) {
      k.sky('day');
      k.ground(0, 2);
      k.hedge(0, L, R, 1);
      const rock = k.keep(k.add.image(4.6 * 16 + 8, 3 * 16 + 16, 't_ore_gold').setOrigin(0.5, 1).setDepth(4.03).setScale(1.5));
      const hero = k.actor('adv', 3, 3, { face: 'grit' });
      k.breathe(hero);
      return { rock, hero };
    },
    lines: [
      {
        text: '들판 곳곳의 반짝 바위. 깨면 반짝돌이 쏟아진다.',
        at: (k, c) => {
          for (let i = 0; i < 3; i++) k.time.delayedCall(i * 380, () => { k.tweens.add({ targets: c.hero, x: c.hero.x + 4, duration: 70, yoyo: true }); k.sparkle(4.6, 3, 6); });
          k.time.delayedCall(1200, () => { k.tweens.add({ targets: c.rock, alpha: 0, scale: 2, duration: 220 }); k.coins(4.6, 2.6, 7); k.sparkle(4.6, 3, 30); k.face(c.hero, 'sparkle'); k.hop(c.hero, 2); });
        },
      },
      {
        text: '반짝돌은 곧 돈! 대신 시끄러워서 말썽쟁이들이 몰려온다.',
        at: (k, c) => {
          k.face(c.hero, 'shock');
          [[-4, 2.6], [12, 3.3], [12, 1.9]].forEach(([x, y], i) => {
            const r = k.actor(i === 2 ? 'goblin' : 'rat', x, y, { flip: x > 4 });
            k.walk(r, x > 4 ? 6.2 + (i - 1) * 0.7 : 1, 700, () => k.mark(r, '!'));
          });
        },
      },
    ],
  },
  { // fainting is not the end
    build(k) {
      k.sky('dusk');
      k.ground(0, 2, DUSK);
      k.hedge(0, L, R, 1, DUSK);
      const hero = k.actor('adv', 3.5, 3, { face: 'hit' });
      hero.setAngle(-90).setOrigin(0.5, 0.75);
      const rescuer = k.actor('rescuer', 12, 3, { flip: true });
      return { hero, rescuer };
    },
    lines: [
      {
        text: '쓰러져도 괜찮다. 조합 구조대가 업어 온다.',
        at: (k, c) => {
          k.walk(c.rescuer, 4.3, 1000, () => {
            k.mark(c.rescuer, '영차!', 900);
            c.hero.setAngle(0).setOrigin(0.5, 1).setDepth(c.rescuer.depth + 0.01);
            c.hero.setPosition(c.rescuer.x + 1, c.rescuer.y - 9);
            k.face(c.hero, 'teary');
            k.time.delayedCall(500, () => { k.walk(c.rescuer, -5, 1800); k.walk(c.hero, -5, 1800); });
          });
        },
      },
      { text: '번 돈은 그대로 내 것. 내일 또 나가면 된다.', at: k => { k.coins(3.5, 2, 5); k.sparkle(3.5, 2, 10); } },
    ],
  },
  { // the licenses, and the big prize
    build: atGuild,
    lines: [
      { who: '조합장', text: '구역 끝의 대장을 잡으면 탐험 자격증을 주지.', at: k => { k.badge(4.8, 2.7, LICENSE.ratking); k.badge(5.9, 2.7, LICENSE.skelking, 250); k.badge(7, 2.7, LICENSE.lord, 500); } },
      { who: '조합장', text: '초원, 깊은숲, 돌산. 셋 다 따 오면… 큰 상이 있다네.', at: (k, c) => k.hop(c.boss) },
      { text: '좋아, 첫 탐험 나가 보자!', at: (k, c) => { k.face(c.hero, 'sparkle'); k.hop(c.hero, 3, 6); k.sparkle(3, 3, 20); } },
    ],
  },
];

// the guild master hands over a license (the first time a zone boss falls)
const ratking = [{
  build: atGuild,
  lines: [
    { who: '조합장', text: '왕쥐를 잡았다고? 합격이네!', at: (k, c) => { k.badge(3, 1.9, LICENSE.ratking); k.hop(c.boss); } },
    { who: '조합장', text: '초원 탐험 자격증이야. 이제 깊은숲도 맡겨 보지.', at: (k, c) => { k.face(c.hero, 'sparkle'); k.hop(c.hero, 2); } },
  ],
}];

const skelking = [{
  build: atGuild,
  lines: [
    { who: '조합장', text: '버섯 왕까지! 깊은숲 탐험 자격증이네.', at: (k, c) => { k.badge(3, 1.9, LICENSE.skelking); k.hop(c.boss); k.face(c.hero, 'sparkle'); } },
    { who: '조합장', text: '…그런데 말이야. 돌산 꼭대기에서 누가 뒤척일 때마다 들판도 같이 뒤척인다는 소문이 있네.', at: (k, c) => { k.face(c.hero, 'shock'); } },
    { who: '조합장', text: '마지막 자격증은 돌산에 있다네. 조심하게.' },
  ],
}];

const ending = [
  { // the bat lord falls asleep at last
    build(k) {
      k.sky('dusk');
      k.ground(2, 2, DUSK);
      k.hedge(2, L, R, 1, DUSK);
      const lord = k.actor('vampLord', 5, 2.8);
      const hero = k.actor('adv', 2, 2.8, { face: 'grit' });
      return { lord, hero };
    },
    lines: [
      { text: '박쥐 대왕이 쓰러졌다.', at: (k, c) => { k.tweens.add({ targets: c.lord, angle: 90, duration: 500, ease: 'Bounce.out' }); k.sparkle(5, 2.6, 20); } },
      { text: '돌산 꼭대기에서 뒤척이던 건 바로 이 녀석이었다. 대왕이 쿨쿨 잠들자 들판의 뒤척임도 뚝 멎었다.', at: (k, c) => { k.face(c.hero, 'sparkle'); k.mark(c.lord, 'zZ', 0); } },
    ],
  },
  { // the village celebrates
    build(k) {
      villageNight(k);
      const folk = ['guildBoss', 'shopkeep', 'adv', 'neighbor', 'rescuer', 'rival'].map((s, i) => k.actor(s, -0.6 + i * 1.65, 3 + (i % 2) * 0.5, { face: s === 'adv' ? 'sparkle' : undefined }));
      return { folk };
    },
    lines: [
      {
        text: '그날 밤, 들판은 처음으로 조용히 잠들었다. 마을은 밤새 잔치를 벌였다.',
        at: (k, c) => {
          c.folk.forEach((f, i) => k.time.addEvent({ delay: 500 + i * 90, loop: true, callback: () => k.hop(f, 1, 4) }));
          k.time.addEvent({ delay: 400, loop: true, callback: () => k.sparkle(Math.random() * 8, -1 + Math.random() * 3, 8) });
        },
      },
    ],
  },
  { // the big prize
    build(k) {
      k.sky('day');
      k.ground(0, 3);
      k.hedge(0, L, R, 2);
      const home = k.house(HOME, 3, -1.5);
      home.setAlpha(0);
      const gm = k.actor('guildBoss', 1, 2.4);
      const hero = k.actor('adv', 5.5, 3.1);
      k.breathe(gm); k.breathe(hero, 200);
      return { gm, hero, home };
    },
    lines: [
      { who: '조합장', text: '돌산 탐험 자격증. 이걸로 셋 다 땄군!', at: k => { k.badge(-0.2, 0.6, LICENSE.ratking); k.badge(1, 0.3, LICENSE.skelking, 200); k.badge(2.2, 0.6, LICENSE.lord, 400); } },
      {
        who: '조합장', text: '약속한 큰 상이네. 창고 구석 말고… 자네 집이야!',
        at: (k, c) => { k.tweens.add({ targets: c.home, alpha: 1, duration: 600 }); k.sparkle(5.5, 0.5, 40); k.face(c.hero, 'sparkle'); k.hop(c.hero, 3, 6); k.mark(c.hero, '내 집!', 0); },
      },
    ],
  },
  { // and the next morning...
    build(k) {
      k.sky('day');
      k.ground(0, 2);
      const back = k.hedge(0, L, R, 1);
      const front = [...k.hedge(0, L, 0, 4), ...k.hedge(0, 7, R, 4)];
      const gm = k.actor('guildBoss', 2.5, 2.6);
      const hero = k.actor('adv', 4.5, 2.6, { flip: true });
      k.breathe(gm); k.breathe(hero, 200);
      return { hedges: [...back, ...front], gm, hero };
    },
    lines: [
      { text: '…그리고 다음 날 아침.' },
      { text: '들판은 또 뒤척였다.', at: (k, c) => { k.toss(c.hedges); k.face(c.hero, 'shock'); } },
      { who: '조합장', text: '돌산 너머에 뭐가 또 있는 모양이군. 자, 오늘도 탐험 부탁하네!', at: (k, c) => { k.hop(c.gm, 2); k.face(c.hero); } },
    ],
  },
];

export const STORIES = { intro, ratking, skelking, ending };
