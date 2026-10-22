# Fonts

Galmuri 2.40.3 by Lee Minseo (quiple), SIL Open Font License 1.1 (see OFL.txt).
https://github.com/quiple/galmuri

These are subsets: ASCII, the 2,350 common Hangul syllables (KS X 1001), Hangul jamo and the symbols
the game uses. Each face is crisp at its own size and at whole multiples of it:

| file | size |
| --- | --- |
| Galmuri9 | 10px |
| Galmuri11 (and Bold) | 12px, 24px |
| Galmuri14 | 15px, 30px |

To rebuild after adding text with a rare syllable: `pyftsubset Galmuri11.ttf --text-file=chars.txt --flavor=woff2`
with chars.txt holding those characters plus every character in `src/`.
