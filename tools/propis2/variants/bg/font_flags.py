#!/usr/bin/env python3
"""The exact centre line of the top-left flag of К Н Ф Ю Ъ, taken from the Boyan Maga outline at a fine raster (the draft's
centre line, boyan_glyphs.draft.json, was smoothed when it was made and flattens the flag's first wave: owner, 2026-10-18,
«первую волну крючка ты сильно сгладил ... нужна точно форма из шрифта»).

  python3 tools/propis2/variants/bg/font_flags.py <Boyan_Maga-Regular.ttf>

Writes font_flags.json: label -> the flag's centre line (and "label:stroke" -> a whole stroke's, WHOLE), bank units (font_glyphs.to_bank), from its start to where it has come
down into the stem. The skeleton of the letter's fill at PX px per font unit; of its points those near the draft's flag, each
put at the draft's place it is nearest to and averaged there, so the line keeps the draft's order and the outline's shape.
"""
import sys, json
from pathlib import Path
import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw
from skimage.morphology import skeletonize

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import font_glyphs as fg  # noqa: E402
import tidy_trace as tt  # noqa: E402

PX = 1.5          # raster pixels per font unit
NEAR = 6.0        # bank units: skeleton points this close to the draft's flag belong to it
LETTERS = "КНФЮЪ"
# strokes taken whole, not just their flag: П's hat (owner, 2026-10-19, drawn over the font); А's only stroke, for the bow of its
# rise (owner, 2026-10-19: «первый штрих должен иметь чуть больший прогиб в середине вправо ... максимально приближенное к линиям
# шрифта»; build_glyphs.rise_like_font)
WHOLE = {"П": 2, "А": 0, "Л": 0, "Т": 3}
SKELETON = "БВГДЕЖЗИЙКЛМНОРСХЦЧШЩЯб"  # letters snapped onto the font's lines whole (build_glyphs.snap_to_font; owner, 2026-10-19, Б: «сделай всё то же самое»)


def flag_of_draft(p):
    """The draft's flag: from its start over the top until it has come down a quarter of the capital's height below the top."""
    top = int(np.argmin(p[: len(p) // 2, 1]))
    cut = top + int(np.argmax(p[top:, 1] >= p[top, 1] + 26))
    return p[:cut + 1]


def main():
    f = TTFont(sys.argv[1]); gs = f.getGlyphSet(); cm = f.getBestCmap()
    draft = {g["label"]: g for g in json.loads((HERE / "boyan_glyphs.draft.json").read_text())}
    out = {}
    for ch in LETTERS + "".join(WHOLE):
        pen = fg.Flat(gs); gs[cm[ord(ch)]].draw(pen)
        xs = [x for poly in pen.polys for x, _ in poly]; ys = [y for poly in pen.polys for _, y in poly]
        x0, y1 = min(xs) - 10, max(ys) + 10
        W, H = int((max(xs) - x0 + 10) * PX) + 2, int((y1 - min(ys) + 10) * PX) + 2
        wind = np.zeros((H, W), int)
        for poly in pen.polys:
            m = Image.new("1", (W, H), 0); ImageDraw.Draw(m).polygon([((x - x0) * PX, (y1 - y) * PX) for x, y in poly], fill=1)
            area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1]))
            wind += np.where(np.array(m), 1 if area > 0 else -1, 0)
        rr, cc = np.nonzero(skeletonize(wind != 0))
        sk = np.array([fg.to_bank(c / PX + x0, y1 - r / PX) for r, c in zip(rr, cc)])
        k = WHOLE.get(ch, 0)
        d = tt.dg.resample(np.array(tt.parse_path(draft[ch]["strokes"][k]["d"])), 0.5)
        flag = d if ch in WHOLE else flag_of_draft(d)
        dist = np.hypot(sk[:, None, 0] - flag[None, :, 0], sk[:, None, 1] - flag[None, :, 1])
        idx, dmin = dist.argmin(axis=1), dist.min(axis=1)
        keep = dmin < NEAR
        line = []
        for i in range(len(flag)):
            m = keep & (idx == i)
            if m.any(): line.append(sk[m].mean(axis=0))
        line = np.array(line)
        # a light running mean along it: the raster's one-pixel steps, nothing of the shape
        w = 3
        sm = np.array([line[max(0, i - w):i + w + 1].mean(axis=0) for i in range(len(line))])
        sm[0], sm[-1] = line[0], line[-1]
        out[f"{ch}:{k}" if ch in WHOLE else ch] = [[round(float(x), 3), round(float(y), 3)] for x, y in sm]
        print(ch, len(out[f"{ch}:{k}" if ch in WHOLE else ch]), "points")
    (HERE / "font_flags.json").write_text(json.dumps({"note": __doc__.strip().splitlines()[0], "flags": out}, ensure_ascii=False))
    # the whole skeleton of some letters (build_glyphs.snap_to_font): every point, and the forks (where strokes join, the skeleton
    # bends off into the other stroke there and is not the line)
    skel = {}
    for ch in SKELETON:
        sk, fork = skeleton_of(gs, cm, ch)
        pen = fg.Flat(gs); gs[cm[ord(ch)]].draw(pen)
        ink = [[[round(float(v), 2) for v in fg.to_bank(x, y)] for x, y in poly] for poly in pen.polys]
        skel[ch] = {"pts": [[round(float(x), 2), round(float(y), 2)] for x, y in sk], "forks": [[round(float(x), 2), round(float(y), 2)] for x, y in fork],
                    "outline": ink}
        print(ch, len(sk), "skeleton points,", len(fork), "forks")
    (HERE / "font_skeleton.json").write_text(json.dumps({"note": "The Boyan Maga skeleton (font_flags.py SKELETON), bank units", "letters": skel}, ensure_ascii=False))


def skeleton_of(gs, cm, ch):
    """The skeleton of a letter's fill (PX px per font unit) in bank units, and its fork points (more than two neighbours)."""
    pen = fg.Flat(gs); gs[cm[ord(ch)]].draw(pen)
    xs = [x for poly in pen.polys for x, _ in poly]; ys = [y for poly in pen.polys for _, y in poly]
    x0, y1 = min(xs) - 10, max(ys) + 10
    W, H = int((max(xs) - x0 + 10) * PX) + 2, int((y1 - min(ys) + 10) * PX) + 2
    wind = np.zeros((H, W), int)
    for poly in pen.polys:
        m = Image.new("1", (W, H), 0); ImageDraw.Draw(m).polygon([((x - x0) * PX, (y1 - y) * PX) for x, y in poly], fill=1)
        area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(poly, poly[1:] + poly[:1]))
        wind += np.where(np.array(m), 1 if area > 0 else -1, 0)
    sk = skeletonize(wind != 0)
    from scipy.ndimage import convolve
    nb = convolve(sk.astype(int), np.ones((3, 3), int), mode="constant") - 1
    to = lambda rr, cc: np.array([fg.to_bank(c / PX + x0, y1 - r / PX) for r, c in zip(rr, cc)]).reshape(-1, 2)
    return to(*np.nonzero(sk)), to(*np.nonzero(sk & (nb > 2)))


if __name__ == "__main__":
    main()
