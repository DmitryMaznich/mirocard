"""Glyph outlines for the PDF the app makes (src/topics/renderers/propis/printPdf.js): every text of a printed notebook (the cover,
the logo, the page numbers, the Mironium marks) goes into the PDF as vector OUTLINES, not as embedded fonts — nothing for a PDF viewer
to get wrong (owner, 2026-10-15: the first PDFs showed no Cyrillic and a wrong logo — the font files had never reached the server).

Reads the fonts in tools/propis2/pdf-fonts (Nunito 400/700/800/900 — static cuts of the variable font — and DM Serif Display
regular/italic, and the cover's «Mironium Cover Sans» 400/700 — Liberation Sans; subset to Latin + Cyrillic; OFL, licences beside them) and writes public/fonts/pdf/glyphs.json:
  { fonts: { "<name>": { upm, ascent, descent, glyphs: { "<char>": [advance, "<svg path d, font units, y up>"] } } } }

Run: python3 tools/propis2/build_pdf_glyphs.py   (needs fontTools)
"""
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "tools" / "propis2" / "pdf-fonts"
OUT = ROOT / "public" / "fonts" / "pdf" / "glyphs.json"
FONTS = {
    "Nunito-400": "Nunito-400.ttf", "Nunito-700": "Nunito-700.ttf", "Nunito-800": "Nunito-800.ttf", "Nunito-900": "Nunito-900.ttf",
    "DMSerif": "DMSerifDisplay-Regular.ttf", "DMSerif-Italic": "DMSerifDisplay-Italic.ttf",
    # the cover's stamp: the face of the printed series' cover (Arial there) — Liberation Sans, metric-compatible with Arial, renamed
    # «Mironium Cover Sans» as the OFL asks of a subset; the same files as public/fonts/cover/*.woff
    "CoverSans-400": "CoverSans-400.ttf", "CoverSans-700": "CoverSans-700.ttf",
}

# what a notebook's texts can hold: Latin, Cyrillic, digits and the usual punctuation (« » © № · – — …); DM Serif writes only «Mironium»
TEXT = set(chr(c) for c in range(0x20, 0x7F)) | set(chr(c) for c in range(0x410, 0x450)) | set("Ёё«»©№·–—…‐’“”„")
LATIN = set(chr(c) for c in range(0x20, 0x7F))

out = {}
for name, file in FONTS.items():
    f = TTFont(SRC / file)
    gs = f.getGlyphSet()
    hhea = f["hhea"]
    glyphs = {}
    keep = LATIN if name.startswith("DMSerif") else TEXT
    for code, gname in sorted(f.getBestCmap().items()):
        if chr(code) not in keep:
            continue
        pen = SVGPathPen(gs, ntos=lambda v: str(round(v)))
        gs[gname].draw(pen)
        glyphs[chr(code)] = [gs[gname].width, pen.getCommands()]
    out[name] = {"upm": f["head"].unitsPerEm, "ascent": hhea.ascent, "descent": -hhea.descent, "glyphs": glyphs}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"fonts": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size // 1024} KB, {sum(len(v['glyphs']) for v in out.values())} glyphs")
