#!/usr/bin/env bash
# Real-page gaps between a connector and the next letter: tools/propis2/variants/kk/pairs.sh '["әл","ол"]'  -> prints JSON {word: {gap, tailEnd, nextStart}}
set -e
K=tools/propis2/variants/kk; T=$(mktemp -d)
python3 $K/build_glyphs.py > $T/g.json
cp $K/pairs.test.jsx src/topics/renderers/propis2/kkTmpPairs.test.jsx
trap 'rm -f src/topics/renderers/propis2/kkTmpPairs.test.jsx' EXIT
KK_MODE="${2:-}" KK_GLYPHS=$T/g.json KK_WORDS="$1" KK_OUT=$T/out.json npx vitest run src/topics/renderers/propis2/kkTmpPairs.test.jsx --testTimeout=600000 >/dev/null
cat $T/out.json
