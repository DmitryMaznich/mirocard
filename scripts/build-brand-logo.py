"""Собирает логотип Mironium в кривых (без зависимости от шрифтов).

Логотип: знак-профиль + слово «Mironium» шрифтом Nunito 800, фирменная «u» —
курсив DM Serif Display, золото. Раскладка (позиции букв, размер и смещение «u»,
размер знака) снята из браузера с утверждённой HTML-версии лендинга
(landing/cards.css, блок «логотип») при font-size 200px — ниже в LAYOUT.

Шрифты:
  Nunito 800      — node_modules/@fontsource/nunito/files/nunito-latin-800-normal.woff2
  DM Serif italic — путь передаётся аргументом (woff2 с Google Fonts, latin subset)

Запуск:
  python scripts/build-brand-logo.py <путь к DM Serif Display Italic .woff2>

Пишет:
  public/brand/mironium-logo.svg        — тёмный, для светлого фона
  public/brand/mironium-logo-white.svg  — белый, для тёмного фона
  landing/mironium-logo.svg, landing/mironium-logo-white.svg — копии для лендинга
  src/shared/brand/mironiumLogoPaths.js — те же контуры для инлайн-логотипа в приложении
"""
import io
import os
import sys

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NUNITO = os.path.join(ROOT, 'node_modules', '@fontsource', 'nunito', 'files', 'nunito-latin-800-normal.woff2')

INK = '#1C3634'
GOLD = '#C18B22'
WHITE = '#FFFFFF'
GOLD_ON_DARK = '#F2C45A'

# снято с HTML-логотипа при font-size 200px: x — начало буквы, base — базовая линия, size — кегль
LAYOUT = [
    ('M', 191.45, 198.8875, 200, 'nunito'),
    ('i', 361.65, 198.8875, 200, 'nunito'),
    ('r', 410.25, 198.8875, 200, 'nunito'),
    ('o', 485.9125, 198.8875, 200, 'nunito'),
    ('n', 598.7125, 198.8875, 200, 'nunito'),
    ('i', 712.7125, 198.8875, 200, 'nunito'),
    ('u', 760.05, 216.8, 256, 'dm'),
    ('m', 913.65, 198.8875, 200, 'nunito'),
]
MARK_BOX = (0.0, 41.3875, 151.45, 170.0)  # x, y, w, h инлайн-SVG знака (viewBox 20 0 392 440)
MARK_POINTS = [
    (98, 0), (376, 0), (401, 5), (401, 7), (388, 12), (382, 20), (379, 17), (369, 15), (342, 24), (319, 23),
    (291, 29), (291, 31), (297, 29), (313, 29), (313, 31), (279, 41), (229, 67), (219, 67), (209, 61), (215, 69),
    (233, 71), (245, 67), (265, 55), (268, 56), (247, 71), (204, 88), (198, 96), (196, 112), (200, 102), (209, 93),
    (219, 91), (206, 102), (199, 125), (188, 136), (200, 132), (194, 142), (193, 151), (201, 143), (198, 156),
    (203, 167), (206, 148), (209, 147), (207, 151), (209, 155), (216, 150), (213, 159), (214, 200), (212, 206),
    (196, 224), (176, 236), (171, 245), (173, 255), (191, 273), (190, 284), (185, 289), (186, 296), (197, 303),
    (198, 310), (209, 311), (213, 309), (215, 311), (212, 316), (199, 317), (194, 322), (195, 331), (202, 338),
    (204, 344), (203, 365), (205, 375), (214, 386), (224, 390), (274, 390), (294, 396), (304, 406), (311, 421),
    (316, 440), (92, 440), (75, 435), (54, 422), (42, 408), (35, 395), (30, 374), (31, 61), (40, 36), (59, 15),
    (77, 5),
]


def r(v):
    s = ('%.2f' % v).rstrip('0').rstrip('.')
    return '0' if s == '-0' else s


def glyph_path(font, ch, x, base, size):
    gs = font.getGlyphSet()
    name = font.getBestCmap()[ord(ch)]
    k = size / font['head'].unitsPerEm
    t = (k, 0, 0, -k, x, base)  # y вверх в шрифте → вниз в SVG
    sp = SVGPathPen(gs, ntos=r)
    gs[name].draw(TransformPen(sp, t))
    bp = BoundsPen(gs)
    gs[name].draw(TransformPen(bp, t))
    return sp.getCommands(), bp.bounds


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    fonts = {'nunito': TTFont(NUNITO), 'dm': TTFont(sys.argv[1])}

    mx, my, mw, mh = MARK_BOX
    k = mh / 440.0
    pts = [(mx + (px - 20) * k, my + py * k) for px, py in MARK_POINTS]
    mark_d = 'M' + ' L'.join('%s %s' % (r(a), r(b)) for a, b in pts) + ' Z'
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    bounds = [min(xs), min(ys), max(xs), max(ys)]

    word_d, u_d = [], ''
    for ch, x, base, size, f in LAYOUT:
        d, b = glyph_path(fonts[f], ch, x, base, size)
        if b:
            bounds = [min(bounds[0], b[0]), min(bounds[1], b[1]), max(bounds[2], b[2]), max(bounds[3], b[3])]
        if ch == 'u':
            u_d = d
        else:
            word_d.append(d)

    # сдвигаем всё в 0,0 и оставляем 2 % воздуха
    pad = (bounds[3] - bounds[1]) * 0.02
    ox, oy = bounds[0] - pad, bounds[1] - pad
    w, h = bounds[2] - bounds[0] + 2 * pad, bounds[3] - bounds[1] + 2 * pad
    g = '<g transform="translate(%s %s)">' % (r(-ox), r(-oy))

    def svg(ink, gold):
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" role="img" aria-label="Mironium">'
                '<title>Mironium</title>%s<path fill="%s" d="%s"/><path fill="%s" d="%s"/>'
                '<path fill="%s" d="%s"/></g></svg>\n') % (r(w), r(h), g, ink, mark_d, ink, ' '.join(word_d), gold, u_d)

    out = {
        os.path.join(ROOT, 'public', 'brand', 'mironium-logo.svg'): svg(INK, GOLD),
        os.path.join(ROOT, 'public', 'brand', 'mironium-logo-white.svg'): svg(WHITE, GOLD_ON_DARK),
        os.path.join(ROOT, 'landing', 'mironium-logo.svg'): svg(INK, GOLD),
        os.path.join(ROOT, 'landing', 'mironium-logo-white.svg'): svg(WHITE, GOLD_ON_DARK),
    }
    for path, text in out.items():
        io.open(path, 'w', encoding='utf-8', newline='\n').write(text)
        print('wrote', os.path.relpath(path, ROOT), len(text), 'bytes')

    js = ('// Generated by scripts/build-brand-logo.py — do not edit by hand.\n'
          '// Mironium logo in outlines: the mark, the word (Nunito 800) and the gold italic «u»\n'
          '// (DM Serif Display), so it renders the same everywhere without loading any font.\n'
          'export const LOGO_VIEWBOX = "0 0 %s %s";\n'
          'export const LOGO_TRANSLATE = "translate(%s %s)";\n'
          'export const LOGO_MARK_PATH = "%s";\n'
          'export const LOGO_WORD_PATH = "%s";\n'
          'export const LOGO_U_PATH = "%s";\n') % (r(w), r(h), r(-ox), r(-oy), mark_d, ' '.join(word_d), u_d)
    jp = os.path.join(ROOT, 'src', 'shared', 'brand', 'mironiumLogoPaths.js')
    io.open(jp, 'w', encoding='utf-8', newline='\n').write(js)
    print('wrote', os.path.relpath(jp, ROOT), '; viewBox', r(w), r(h), '; ratio %.2f' % (w / h))


if __name__ == '__main__':
    main()
