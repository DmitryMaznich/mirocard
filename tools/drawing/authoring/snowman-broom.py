"""Snowman with a broom: native 640×360 video coordinates, exported at 2×.

Contours stay continuous; shared foot attachments are sampled from the same
bottom snowball curves. Raw reference video stays in ignored output/.
"""
import json
import re
from pathlib import Path
from geometry import Path as CurvePath, oval, chain, pt

BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE/'pencils.json').read_text())
STEPS = []

def d(raw):
    # All authoring commands below are absolute M/L/C/Q/Z (no arc flags).
    return re.sub(r'-?\d+(?:\.\d+)?', lambda m: f'{float(m[0])*2:g}', raw)

def stroke(title, paths, part, time=None, background=False, tool='black'):
    STEPS.append(dict(kind='stroke', title=title, paths=paths, tool=tool, part=part,
                      **({'sourceTime': time} if time is not None else {}),
                      **({'background': True} if background else {})))

def colour(title, shape, tool, part, background=False):
    STEPS.append(dict(kind='color', title=title, d=shape, fill=PENCILS[tool]['color'], tool=tool, part=part,
                      **({'background': True} if background else {})))

def circle(x, y, rx, ry):
    return CurvePath(oval(x, y, rx, ry)).d(True)

head = circle(309, 104, 29, 29)
middle = circle(310, 167, 45, 39)
base = CurvePath(oval(311, 245, 64, 52))
bottom = base.d(True)
# Head is drawn first in the source, then progressively larger snowballs.
stroke('Маленький снежный шар — голова', [head], 'head', 25)
stroke('Средний снежный шар', [middle], 'middle', 31)
stroke('Большой снежный шар внизу', [bottom], 'bottom', 35)
left_hand = circle(262, 136, 18, 21)
right_hand = circle(354, 128, 18, 18)
stroke('Левая круглая ручка', [left_hand], 'hand-left', 40)
stroke('Правая круглая ручка', [right_hand], 'hand-right', 43)

feet = []
for part, start, end, controls in [
    ('foot-left', (251, 272), (271, 286), ((231, 263), (236, 311), (260, 296))),
    ('foot-right', (372, 267), (355, 283), ((395, 251), (388, 289), (372, 291))),
]:
    a, b = base.nearest(start), base.nearest(end)
    pa, pb = base.point(a), base.point(b)
    c1, c2, c3 = controls
    outer = f'M {pt(pa)} C {pt(c1)} {pt(c2)} {pt(c3)} Q {pt(c3)} {pt(pb)}'
    # Close only the colour mask along the actual snowball. The child draws
    # just the visible outer foot curve, not a second line inside the body.
    arc = chain(base.short_arc(b, a))
    shape = outer+arc[arc.index(' C '):]+' Z'
    feet.append((part, outer, shape))
    stroke('Левая ножка' if part.endswith('left') else 'Правая ножка', [outer], part, 46)

# Five tiny dark details are deliberately grouped into one contour step and
# one colouring step, rather than asking for each eye/button separately.
eyes = [circle(298, 96, 2.2, 2.7), circle(322, 94, 2.2, 2.7)]
buttons = [circle(311, 145, 2.2, 3), circle(312, 160, 2, 2.8), circle(312, 175, 2, 2.8)]
carrot = d('M 309 99 L 332 101 L 309 110 Z')
smile = d('M 294 113 Q 310 128 325 112')
dark_parts = ['eye-left', 'eye-right', 'button-1', 'button-2', 'button-3']
stroke('Два глаза и три пуговицы', [dict(d=shape, part=part) for shape, part in zip(eyes+buttons, dark_parts)], 'eyes-buttons', 51)
stroke('Нос-морковка', [carrot], 'carrot', 53)
stroke('Весёлая улыбка', [smile], 'smile', 55)

# A tilted bucket, with its handle outside the face. Split at actual shared
# brim anchors so the top contour never stops halfway round a visible line.
brim_curve = CurvePath([((294, 72), (302, 69), (328, 73), (336, 80))])
a, b = brim_curve.nearest((302, 72)), brim_curve.nearest((333, 78))
pa, pb = brim_curve.point(a), brim_curve.point(b)
bucket_top = f'M {pt(pa)} L {pt((310, 54))} L {pt((338, 60))} L {pt(pb)}'
back = chain(list(reversed([tuple(reversed(c)) for c in brim_curve.sub(a, b)])))
bucket = bucket_top+back[back.index(' C '):]+' Z'
brim_outline = brim_curve.d()+d(' C 341 87 333 87 328 81 C 318 77 304 75 294 81 C 288 80 288 75 294 72 Z')
stroke('Ведёрко на голове', [bucket_top], 'bucket', 59)
stroke('Край ведёрка целиком', [brim_outline], 'bucket-brim', 63)
stroke('Ручка ведёрка сбоку', [d('M 303 64 C 285 60 285 77 295 78')], 'bucket-handle', 65)

shaft = d('M 259 149 L 263 148 L 312 294 Q 311 296 308 295 Z')
upper_shaft = d('M 250 106 L 254 105 L 258 118 L 254 119 Z')
stroke('Длинная ручка метлы', [shaft, upper_shaft], 'broom-handle', 78)
strands = [d(raw) for raw in [
    'M 219 63 Q 230 87 248 101', 'M 226 59 Q 237 87 250 102',
    'M 232 53 Q 238 80 250 101', 'M 239 58 Q 243 86 251 102',
    'M 244 49 Q 244 79 252 101', 'M 248 55 Q 249 82 253 102',
    'M 252 61 Q 251 84 254 102',
]]
stroke('Семь прутиков метлы', strands, 'broom-twigs', 84)
band = d('M 245 101 Q 251 98 258 104 L 256 108 Q 249 103 244 105 Z')
stroke('Перевязка на метле', [band], 'broom-band', 86)

small_tree = d('M 168 175 L 199 220 L 180 222 L 200 258 L 136 258 L 155 223 L 143 221 Z')
big_tree = d('M 441 136 L 494 184 L 464 188 L 499 233 L 465 236 L 494 270 L 400 270 L 432 237 L 400 233 L 432 187 L 406 184 Z')
small_trunk = d('M 161 258 L 181 258 L 181 282 L 161 279 Z')
big_trunk = d('M 435 270 L 449 270 L 448 289 L 435 293 Z')
stroke('Большая ёлочка справа одним контуром', [big_tree], 'tree-right', 97, True)
stroke('Маленькая ёлочка слева одним контуром', [small_tree], 'tree-left', 115, True)
stroke('Два ствола под ёлочками', [small_trunk, big_trunk], 'tree-trunks', 119, True)
ground_lines = [d('M 125 297 Q 133 278 151 279 Q 174 278 185 294 Q 193 304 207 297 Q 224 286 239 293'),
                d('M 385 291 Q 403 280 418 299 Q 430 296 437 289 Q 450 283 466 296 Q 480 293 495 299')]
stroke('Волнистые сугробы по бокам', ground_lines, 'snowdrifts', 124, True)

colour('Чёрные глаза и пуговицы вместе', ' '.join(eyes+buttons), 'black', 'eyes-buttons')
STEPS[-1]['regions'] = [dict(d=shape, part=part) for shape, part in zip(eyes+buttons, dark_parts)]
# Snowball masks remove the foreground carrot and broom handle; their light
# blue texture never stains the bright nose or the wooden broom.
colour('Нежно-голубая голова', head+' '+carrot+' '+' '.join(eyes), 'pale_blue', 'head')
colour('Нежно-голубой средний шар', middle+' '+shaft+' '+' '.join(buttons), 'pale_blue', 'middle')
STEPS[-1]['clip'] = middle
colour('Нежно-голубой большой шар', bottom+' '+shaft, 'pale_blue', 'bottom')
STEPS[-1]['clip'] = bottom
colour('Две круглые ручки', left_hand+' '+right_hand, 'pale_blue', 'hands')
colour('Две снежные ножки', ' '.join(shape for _, _, shape in feet), 'pale_blue', 'feet')
colour('Красная морковка', carrot, 'red', 'carrot')
colour('Зелёная большая ёлочка', big_tree, 'green', 'tree-right', True)
colour('Зелёная маленькая ёлочка', small_tree, 'green', 'tree-left', True)
colour('Коричневое ведёрко', bucket, 'brown', 'bucket')
colour('Коричневый край ведёрка', brim_outline, 'brown', 'bucket-brim')
colour('Коричневая ручка метлы', shaft+' '+upper_shaft, 'brown', 'broom-handle')
colour('Перевязка на прутиках', band, 'brown', 'broom-band')
colour('Два коричневых ствола', small_trunk+' '+big_trunk, 'brown', 'tree-trunks', True)
ground = d('M 125 302 Q 147 289 178 301 Q 197 311 214 302 Q 228 297 239 302 Q 309 310 385 302 Q 404 290 418 304 Q 439 289 460 302 Q 479 296 495 302 L 495 316 Q 310 322 125 314 Z')
colour('Голубые тени на снегу', ground, 'pale_blue', 'snow-shadows', True)
# Each snowflake is one child-controlled step: three straight lines meeting
# at the same centre. The sky stays white; there is no background shading.
snowflakes = [(188, 95, 8), (385, 77, 8), (407, 116, 7), (218, 196, 7), (396, 249, 7)]
for i, (x, y, radius) in enumerate(snowflakes, 1):
    lines = []
    for dx, dy in [(radius, 0), (radius/2, radius*.8660254), (radius/2, -radius*.8660254)]:
        lines.append(d(f'M {x-dx:g} {y-dy:g} L {x+dx:g} {y+dy:g}'))
    stroke(f'Голубая снежинка {i} — три пересекающиеся линии', lines,
           f'snowflake-{i}', background=True, tool='light_blue')

lesson = dict(id='snowman_broom', title='Снеговик с метлой', viewBox='232 80 780 570', paperOrientation='landscape',
              finale=dict(type='snowfall', part='snowflake-1', centre=[376, 190],
                          drawnFlakes=[dict(part=f'snowflake-{i+1}', centre=[x*2, y*2]) for i, (x, y, _) in enumerate(snowflakes)],
                          eyes=[dict(part='eye-left', centre=[596, 192]), dict(part='eye-right', centre=[644, 188])]),
              palette=['black', 'pale_blue', 'red', 'green', 'brown', 'light_blue'], steps=STEPS,
              source=dict(title='РыбаКит — Как нарисовать Снеговика. Урок рисования для детей от 3 лет',
                          url='https://drive.google.com/file/d/1-jk7W_KC_kjTp7h2SdZmJce0PnRFCLG_/view',
                          durationSeconds=284.839, referenceFrameSeconds=264,
                          note='Ручная адаптация по видео владельца: три снежных шара, ведёрко, метла, две ёлочки и сугробы. Пастель заменена карандашной штриховкой. По согласованию с владельцем цветной фон убран, вместо него пять простых снежинок из трёх линий.'))
(BASE/'lessons/snowman_broom.json').write_text(json.dumps(lesson, ensure_ascii=False, indent=2)+'\n')
print(f'Built snowman with broom: {len(STEPS)} steps')
