#!/usr/bin/env bash
# Every letter followed by every letter (the kk glyph set, as laid out by the real engine): lists the pairs whose connector CROSSES the first stroke of the next letter
# (owner 2026-11-01: in an animation the pen would jump over the stroke). Prints the pairs as «XY:crossings»; the full list is also in /tmp/kk/cross.txt.
set -e
K=tools/propis2/variants/kk; T=$(mktemp -d); mkdir -p /tmp/kk
python3 $K/build_glyphs.py > $T/g.json
cp $K/crosscheck.test.js src/topics/renderers/propis2/kkTmpCross.test.js
trap 'rm -f src/topics/renderers/propis2/kkTmpCross.test.js' EXIT
KK_GLYPHS=$T/g.json npx vitest run src/topics/renderers/propis2/kkTmpCross.test.js >/dev/null
cat /tmp/kk/cross.txt; echo
