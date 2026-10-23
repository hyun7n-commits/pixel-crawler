# Fonts

Jua (BM JUA) 1.001 by Woowahan Brothers, SIL Open Font License 1.1 (see OFL.txt).
https://fonts.google.com/specimen/Jua

`Jua.woff2` is a subset: ASCII, the 2,350 common Hangul syllables (KS X 1001) and every character the
game's text uses.

To rebuild after adding text with a rare syllable: `pyftsubset Jua.ttf --text-file=chars.txt --flavor=woff2 --output-file=Jua.woff2`
with chars.txt holding those characters plus every character in `src/`.
