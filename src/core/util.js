export const rnd = n => Math.floor(Math.random() * n);
export const rint = (a, b) => a + rnd(b - a + 1);
export const pick = a => a[rnd(a.length)];
export const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Picks the Korean particle that fits the last syllable: josa('왕쥐', '이', '가') -> '왕쥐가'
export const josa = (word, withFinal, withoutFinal) => {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  // a number is read out: 일, 삼, 육, 칠, 팔, 영 end on a consonant; 이, 사, 오, 구 do not
  const digit = /[0-9]$/.test(word) && '013678'.includes(word.at(-1));
  return word + ((c >= 0 && c < 11172 && c % 28) || digit ? withFinal : withoutFinal);
};
