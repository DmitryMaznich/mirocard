#!/usr/bin/env bash
# Real-notebook preview of the Kazakh glyphs: runs them through PrintPageView (stretch, slant, ruling), not raw bank coordinates.
#   tools/propis2/variants/kk/preview.sh out.png '["Г Г","Ғ Ғ","Ғалым"]' [crop x,y,w,h] [grid regular|square|ruled]
set -e
K=tools/propis2/variants/kk; OUT=$(realpath -m "$1"); T=$(mktemp -d)
python3 $K/build_glyphs.py > $T/g.json
cp $K/preview.test.jsx src/topics/renderers/propis2/kkTmpPreview.test.jsx
trap 'rm -f src/topics/renderers/propis2/kkTmpPreview.test.jsx' EXIT
KK_GLYPHS=$T/g.json KK_OUT=$T/page.svg KK_LINES="$2" KK_GRID="${4:-regular}" npx vitest run src/topics/renderers/propis2/kkTmpPreview.test.jsx >/dev/null
node $K/shot.cjs $T/page.svg "$OUT" "${3:-0,0,1000,420}"
