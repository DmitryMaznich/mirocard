"""Rebuild goldfish.json from shared curve anchors; Python standard library only.

Run from any directory. Coordinates follow the supplied 640x360 video frame.
Open strokes never include colour-region closing edges. Every outline step is
one continuous hand movement. Shared boundaries are extracted by de Casteljau,
so colour masks, fin roots and the body meet at exactly the same coordinates.
"""
from pathlib import Path
import json

BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE / 'pencils.json').read_text())
STEPS = []


def point(p):
    return f'{p[0]*2:.6f} {p[1]*2:.6f}'


def move(p):
    return 'M ' + point(p)


def curve(c):
    return ' C ' + ' '.join(point(p) for p in c[1:])


def path(c):
    return move(c[0]) + curve(c)


def reverse(c):
    return tuple(reversed(c))


def split(c, t):
    def mix(a, b):
        return tuple(x+(y-x)*t for x, y in zip(a, b))
    a, b, d = (mix(c[i], c[i+1]) for i in range(3))
    e, f = mix(a, b), mix(b, d)
    g = mix(e, f)
    return (c[0], a, e, g), (g, f, d, c[3])


def section(c, start, end):
    left = split(c, end)[0]
    return split(left, start/end)[1] if start else left


def oval(cx, cy, rx, ry):
    k = .55228475
    return (move((cx-rx, cy))
            + curve(((cx-rx, cy), (cx-rx, cy-k*ry), (cx-k*rx, cy-ry), (cx, cy-ry)))
            + curve(((cx, cy-ry), (cx+k*rx, cy-ry), (cx+rx, cy-k*ry), (cx+rx, cy)))
            + curve(((cx+rx, cy), (cx+rx, cy+k*ry), (cx+k*rx, cy+ry), (cx, cy+ry)))
            + curve(((cx, cy+ry), (cx-k*rx, cy+ry), (cx-rx, cy+k*ry), (cx-rx, cy))) + ' Z')


def stroke(title, d, time):
    STEPS.append(dict(kind='stroke', title=title, paths=[d], sourceTime=time, tool='black'))


def color(title, d, tool, time, **extra):
    STEPS.append(dict(kind='color', title=title, d=d, fill=PENCILS[tool]['color'],
                      sourceTime=time, tool=tool, **extra))


# The four body arcs and the head divider are canonical: reused verbatim in
# masks. There are no second, approximate outlines for colour or fin bases.
L, A, T, B = (244, 184), (297, 133), (420, 177), (298, 234)
upper_head = (L, (254, 159), (276, 139), A)
upper_body = (A, (338, 116), (391, 137), T)
lower_body = (T, (400, 211), (344, 250), B)
lower_head = (B, (274, 231), (250, 210), L)
divider = (A, (320, 154), (319, 208), B)
body = path(upper_head) + curve(upper_body) + curve(lower_body) + curve(lower_head) + ' Z'
head = path(upper_head) + curve(divider) + curve(lower_head) + ' Z'

stroke('Верхняя дуга тела', path(upper_head) + curve(upper_body), 22)
stroke('Нижняя дуга тела', path(lower_body) + curve(lower_head), 28)

# Tail roots are points on the body, never floating nearby. Its colour closes
# along that same body boundary; that hidden closing edge is not stroked.
u_t, d_t = .86, .20
U, D = section(upper_body, 0, u_t)[3], section(lower_body, 0, d_t)[3]
notch = (436, 175)
tail_top = [
    (U, (429, 145), (429, 130), (440, 121)),
    ((440, 121), (452, 110), (465, 121), (463, 136)),
    ((463, 136), (461, 153), (441, 160), notch)]
tail_bottom = [
    (notch, (430, 182), (453, 184), (461, 195)),
    ((461, 195), (477, 215), (458, 232), (443, 221)),
    ((443, 221), (427, 209), (418, 199), D)]
tail_upper_path = path(tail_top[0]) + ''.join(curve(c) for c in tail_top[1:])
tail_lower_path = path(tail_bottom[0]) + ''.join(curve(c) for c in tail_bottom[1:])
tail = tail_upper_path + ''.join(curve(c) for c in tail_bottom)
tail += curve(reverse(section(lower_body, 0, d_t)))
tail += curve(reverse(section(upper_body, u_t, 1))) + ' Z'
stroke('Верхняя лопасть хвоста', tail_upper_path, 36)
stroke('Нижняя лопасть хвоста', tail_lower_path, 41)
stroke('Дуга за глазом', path(divider), 48)

# Lips attach to distinct points on the head outline and meet at the nose.
lip1_start = section(upper_head, 0, .10)[3]
lip2_end = section(lower_head, 0, .78)[3]
lip1_curve = (lip1_start, (228, 158), (223, 185), L)
lip2_curve = (L, (222, 181), (229, 215), lip2_end)
lip1 = path(lip1_curve) + curve(section(upper_head, 0, .10)) + ' Z'
lip2 = path(lip2_curve) + curve(section(lower_head, .78, 1)) + ' Z'
stroke('Верхняя губа', path(lip1_curve), 54)
stroke('Нижняя губа', path(lip2_curve), 57)
eye = oval(279, 182, 14, 16)
pupil = oval(278, 182, 7, 9) + ' ' + oval(276, 179, 2.2, 2.7)
stroke('Круглый глаз', eye, 61)
color('Чёрный зрачок с белым бликом', pupil, 'black', 65)
# The black pupil is shaded as its own black-pencil step instead of appearing
# as an instant solid fill after an unrelated outline animation.

# Each dorsal lobe is an open arch whose two endpoints sit on upper_body.
fins = []
dorsal_outline = None
for n, (start, end, apex) in enumerate([
        (.065, .22, (330, 91)), (.22, .37, (347, 98)),
        (.37, .52, (365, 103)), (.52, .67, (382, 111)),
        (.67, .81, (399, 119))]):
    base = section(upper_body, start, end)
    a, b, peak = base[0], base[3], apex
    c1 = (a, (a[0]+7, a[1]-20), (peak[0]-7, peak[1]-6), peak)
    c2 = (peak, (peak[0]+9, peak[1]+1), (b[0]+4, b[1]-10), b)
    outline = path(c1) + curve(c2)
    fins.append(outline + curve(reverse(base)) + ' Z')
    dorsal_outline = (dorsal_outline + curve(c1) + curve(c2)) if dorsal_outline else outline
stroke('Волнистый верхний плавник', dorsal_outline, 70)

# Fore-fin starts exactly on the divider and ends on the lower body. Its lower
# scallops form one continuous gesture; no diagonal Z strokes through it.
f_divider = .72
F = section(divider, 0, f_divider)[3]
fin_end_t = .61
N = section(lower_body, 0, fin_end_t)[3]
front_top = (F, (329, 215), (344, 226), N)
fin_lobes = [
    (N, (359, 251), (350, 260), (338, 249)),
    ((338, 249), (334, 269), (325, 270), (317, 252)),
    ((317, 252), (315, 266), (305, 266), (302, 253)),
    ((302, 253), (295, 270), (279, 259), B)]
stroke('Большой нижний плавник', path(front_top) + ''.join(curve(c) for c in fin_lobes), 84)
front = path(front_top) + ''.join(curve(c) for c in fin_lobes)
front += curve(reverse(section(divider, f_divider, 1))) + ' Z'
# Small fin behind it, also rooted in an exact section of the body.
back_base = section(lower_body, .28, .45)
ba, bb = back_base[0], back_base[3]
mid = section(lower_body, 0, .365)[3]
valley = (mid[0], mid[1]+6)
back_c1 = (ba, (ba[0]+4, ba[1]+16), (valley[0]+5, valley[1]+8), valley)
back_c2 = (valley, (valley[0]-1, valley[1]+13), (bb[0]-2, bb[1]+14), bb)
back_outline = path(back_c1) + curve(back_c2)
back = back_outline + curve(reverse(back_base)) + ' Z'
stroke('Маленький нижний плавник', back_outline, 98)

# One whole wavy column per tap. Each curve starts at the previous end;
# the previous version's repeated x-offset produced zigzags and tiny hooks.
scale_regions = []
for column, (x, y, count, height) in enumerate([
        (315, 137, 4, 17), (339, 144, 4, 17),
        (362, 147, 4, 17), (383, 153, 3, 17)]):
    curves = []
    for n in range(count):
        a = (x+n*1.8, y+n*height)
        b = (x+(n+1)*1.8, y+(n+1)*height)
        c = (a, (a[0]+11, a[1]+1), (b[0]+11, b[1]-2), b)
        curves.append(c)

    stripe = path(curves[0]) + ''.join(curve(c) for c in curves[1:])
    stroke(f'Волнистая линия чешуи {column+1}', stripe, 104+column*4)
    end = curves[-1][3]
    stripe += ' L ' + point((end[0]-4, end[1]))
    for c in reversed(curves):
        rc = tuple((p[0]-4, p[1]) for p in reverse(c))
        stripe += curve(rc)
    stripe += ' Z'
    scale_regions.append(stripe)

# Every decorative tail line is one independent stroke and one step.
for n, c in enumerate([
        ((423, 157), (438, 149), (446, 139), (451, 130)),
        ((427, 168), (438, 161), (443, 157), (447, 151)),
        ((424, 188), (436, 194), (444, 200), (451, 209)),
        ((419, 195), (426, 199), (432, 204), (436, 208))]):
    stroke(f'Линия на хвосте {n+1}', path(c), 122+n)
bubbles = [oval(213, 105, 7, 10), oval(241, 125, 6, 8)]
for n, d in enumerate(bubbles):
    stroke(f'Пузырёк {n+1}', d, 127+n*3)
# All colour boundaries reuse the actual contour paths. The front fin is cut
# out of yellow; head is cut out of yellow and eye out of orange.
yellow = path(upper_body) + curve(lower_body)
yellow += curve(reverse(divider)) + ' Z'
color('Жёлтое тело', yellow + ' ' + front, 'yellow', 141, clip=yellow)
color('Оранжевая голова', head + ' ' + eye, 'orange', 157)
for n, d in enumerate(scale_regions):
    color(f'Оранжевые чешуйки ряда {n+1}', d, 'orange', 221+n*2, clip=yellow)
for n, d in enumerate(fins):
    color(f'Красный верхний плавник {n+1}', d, 'red', 174+n*2)
color('Красный большой нижний плавник', front, 'red', 185)
color('Красный маленький нижний плавник', back, 'red', 189)
color('Красный хвост', tail, 'red', 194)
color('Красная верхняя губа', lip1, 'red', 201)
color('Красная нижняя губа', lip2, 'red', 203)
for n, d in enumerate(bubbles):
    color(f'Голубой пузырёк {n+1}', d, 'light_blue', 209+n*2)
for n, (x, y, r) in enumerate([(173, 115, 2.8), (271, 95, 3.2), (183, 166, 5.5), (193, 225, 8), (238, 241, 5)]):
    d = oval(x, y, r, r*1.1)
    if n == 3:
        d += ' ' + oval(x, y, r-2.4, (r-2.4)*1.1)
    color(f'Маленький голубой пузырёк {n+3}', d, 'light_blue', 214+n)

# Internal authoring assertions catch accidental disconnected gestures before
# exporting; actual SVG clip coverage is checked in the browser as well.
assert all(len(s['paths']) == 1 and s['paths'][0].count('M ') == 1
           for s in STEPS if s['kind'] == 'stroke')
lesson = dict(id='goldfish', title='Золотая рыбка', viewBox='320 155 640 395',
              source=dict(title='РыбаКит / Папа рисует — Золотая рыбка',
                          origin='Полное видео «Рисуем ЗОЛОТУЮ Рыбку - Урок рисования для детей» предоставлено владельцем приложения.',
                          durationSeconds=250.868,
                          note='Контуры восстановлены по кадрам; один шаг контура — одно непрерывное движение. Общие границы вычисляются из одних кривых, без повторной обводки. sourceTime — примерная отметка времени; порядок группируется по карандашам.'),
              steps=STEPS, palette=['black', 'yellow', 'orange', 'red', 'light_blue'])
(BASE / 'lessons/goldfish.json').write_text(json.dumps(lesson, ensure_ascii=False, indent=2)+'\n')
print(f'{len(STEPS)} steps, {sum(s["kind"] == "stroke" for s in STEPS)} single-gesture outlines')
