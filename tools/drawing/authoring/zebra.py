"""Rebuild the owner's approved zebra mockup, using shared curve boundaries.

Native 640×640 coordinates. Standard library only. Four separate legs and
hoof caps; stripe roots and muzzle borders are extracted from the body curves.
"""
import json
import math
from pathlib import Path
from geometry import at, line, oval, reverse, section

BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE / 'pencils.json').read_text())
STEPS = []


def point(p):
    return f'{p[0]:.5f} {p[1]:.5f}'


def path(curves, closed=False):
    return 'M '+point(curves[0][0])+''.join(' C '+' '.join(point(p) for p in c[1:]) for c in curves)+(' Z' if closed else '')


def stroke(title, curves, part=None, tool='black', closed=False, background=False):
    STEPS.append(dict(kind='stroke', title=title, paths=[path(curves, closed)], tool=tool,
                      **({'part': part} if part else {}), **({'background': True} if background else {})))


def colour(title, d, tool, part, clip=None, background=False):
    STEPS.append(dict(kind='color', title=title, d=d, fill=PENCILS[tool]['color'], tool=tool, part=part,
                      **({'clip': clip} if clip else {}), **({'background': True} if background else {})))


def parameter_y(c, y):
    lo, hi = 0., 1.
    rising = c[-1][1] > c[0][1]
    for _ in range(45):
        mid = (lo+hi)/2
        if (at(c, mid)[1] < y) == rising:
            lo = mid
        else:
            hi = mid
    return (lo+hi)/2


def boundary_y(curves, y):
    for i, c in enumerate(curves):
        if min(c[0][1], c[-1][1]) <= y <= max(c[0][1], c[-1][1]):
            return i+parameter_y(c, y)
    raise ValueError(y)


def segment(curves, start, end):
    result = []
    for i, c in enumerate(curves):
        lo, hi = max(0, start-i), min(1, end-i)
        if hi-lo > 1e-9:
            result.append(section(c, lo, hi))
    return result


ear = [((142, 114), (128, 102), (123, 91), (127, 81)),
       ((127, 81), (121, 50), (130, 29), (144, 27)),
       ((144, 27), (168, 21), (178, 72), (176, 99))]
back_ear = [((190, 98), (181, 64), (182, 27), (202, 26)),
            ((202, 26), (224, 21), (231, 65), (220, 96))]
head_top = [((176, 99), (221, 95), (257, 94), (289, 97)),
            ((289, 97), (348, 99), (382, 120), (383, 161)),
            ((383, 161), (386, 190), (379, 213), (367, 215))]
head_lower = [((367, 215), (345, 216), (313, 214), (288, 214)),
              ((288, 214), (255, 218), (235, 233), (235, 270)),
              ((235, 270), (234, 291), (241, 306), (260, 310))]
back_top = ((260, 310), (302, 311), (331, 302), (366, 305))
shoulder = ((366, 305), (404, 304), (423, 322), (437, 355))
hind_outer = ((437, 355), (451, 392), (456, 475), (455, 600))
hind_base = line((455, 600), (423, 600))
hind_inner = line((423, 600), (405, 452))
back_body = [back_top, shoulder, hind_outer, hind_base, hind_inner]
belly = ((405, 452), (334, 461), (270, 460), (204, 456))
front_inner = line((204, 456), (200, 601))
front_base = line((200, 601), (168, 601))
front_outer = line((168, 601), (156, 451))
belly_front = [belly, front_inner, front_base, front_outer]
neck = [((156, 451), (144, 419), (137, 385), (130, 350)),
        ((130, 350), (127, 282), (126, 176), (142, 114))]
body = path(ear+head_top+head_lower+back_body+belly_front+neck, True)

stroke('Первое ушко', ear, 'ear-1')
stroke('Второе ушко', back_ear, 'ear-2')
stroke('Верх головы и округлая мордочка', head_top, 'body')
stroke('Низ мордочки и изгиб шеи', head_lower, 'body')
hip_t = parameter_y(hind_outer, 456)
hind_run = [section(hind_outer, hip_t, 1), hind_base, hind_inner]
front_run = [front_inner, front_base, front_outer]
STEPS.append(dict(kind='stroke', title='Спина и задняя опорная нога', tool='black', part='body', paths=[
    dict(d=path([back_top, shoulder, section(hind_outer, 0, hip_t)]), part='body'),
    dict(d=path(hind_run), part='leg-hind')]))
STEPS.append(dict(kind='stroke', title='Живот и передняя опорная нога', tool='black', part='body', paths=[
    dict(d=path([belly]), part='body'), dict(d=path(front_run), part='leg-front')]))
stroke('Длинная сторона шеи', neck, 'body')
stroke('Дуга гривы', [((125, 80), (81, 158), (85, 275), (130, 350))], 'mane')

far_front = [(at(neck[0], .12), (110, 474), (80, 526), (81, 574)),
             line((81, 574), (111, 575)),
             ((111, 575), (121, 538), (137, 503), at(front_outer, (601-472)/150))]
far_hind = [(at(belly, .25), (342, 492), (337, 535), (337, 572)),
            line((337, 572), (368, 572)),
            ((368, 572), (375, 534), (385, 494), at(belly, .04))]
stroke('Передняя нога, вытянутая вперёд', far_front, 'leg-far-front')
stroke('Задняя нога за животом', far_hind, 'leg-far-hind')
far_front_mask_curves = far_front+[line(far_front[-1][-1], (156, 451)), section(neck[0], 0, .12)]
far_hind_mask_curves = far_hind+[section(belly, .04, .25)]
far_front_mask = path(far_front_mask_curves, True)
far_hind_mask = path(far_hind_mask_curves, True)

ear_pink = [oval(150, 73, 11, 28), oval(204, 69, 10, 25)]
for i, curves in enumerate(ear_pink, 1):
    stroke(f'Внутренняя часть ушка {i}', curves, f'inner-ear-{i}', closed=True)
muzzle_border = ((289, 97), (269, 126), (269, 170), (288, 214))
stroke('Граница светлой мордочки', [muzzle_border], 'muzzle')
eye = oval(238, 138, 5, 7)
nostrils = [oval(346, 153, 6, 8), oval(366, 149, 6, 8)]
stroke('Один видимый глаз', eye, 'eye', closed=True)
STEPS.append(dict(kind='stroke', title='Две ноздри', paths=[path(c, True) for c in nostrils], tool='black', part='nostrils'))
stroke('Улыбка зебры', [((300, 168), (298, 190), (305, 209), (318, 214))], 'smile')
tail = [((414, 320), (473, 315), (512, 353), (520, 405))]
tuft = [((520, 405), (541, 401), (551, 426), (538, 455)),
        ((538, 455), (517, 443), (504, 421), (520, 405))]
stroke('Изогнутый хвостик', tail, 'tail')
stroke('Кисточка хвоста', tuft, 'tail-tuft', closed=True)

hoof_regions = []
def hoof(title, c1, base, c2, y, part):
    t1, t2 = parameter_y(c1, y), parameter_y(c2, y)
    a, b = at(c1, t1), at(c2, t2)
    top = (a, (a[0]+(b[0]-a[0])/3, y+2), (a[0]+2*(b[0]-a[0])/3, y+2), b)
    # Follow the two side boundaries down to the sole and back up.
    region = [top]+reverse([section(c2, 0, t2)])+reverse([base])+reverse([section(c1, t1, 1)])
    stroke(title, [top], part)
    hoof_regions.append((part, path(region, True)))

hoof('Копыто вытянутой передней ноги', *far_front, 558, 'hoof-1')
hoof('Копыто передней опорной ноги', front_inner, front_base, front_outer, 582, 'hoof-2')
hoof('Копыто дальней задней ноги', *far_hind, 556, 'hoof-3')
hoof('Копыто задней опорной ноги', hind_outer, hind_base, hind_inner, 582, 'hoof-4')

stripe_regions = []
def stripe(title, roots, tip, name):
    a, b = roots[0][0], roots[-1][-1]
    # One continuous V for the two free edges. The root is already outlined.
    edges = [line(b, tip), line(tip, a)]
    stroke(title, edges, name)
    stripe_regions.append((name, path(roots+edges, True)))

for i, (low, high, tip) in enumerate([(167, 143, (177, 137)), (221, 183, (198, 177)),
                                    (269, 234, (192, 226)), (312, 282, (192, 273)),
                                    (385, 335, (197, 303))], 1):
    roots = segment(neck, boundary_y(neck, low), boundary_y(neck, high))
    stripe(f'Полоска на шее {i}', roots, tip, f'stripe-neck-{i}')
stripe('Длинная диагональная полоска на груди', [section(head_lower[-1], .10, .85)], (179, 386), 'stripe-chest')
for i, (curve, lo, hi, tip) in enumerate([
        (back_top, .02, .22, (235, 426)), (back_top, .45, .65, (278, 436)),
        (back_top, .86, 1., (314, 436)), (shoulder, .08, .32, (349, 435)),
        (shoulder, .50, .72, (374, 434)), (hind_outer, .08, .20, (400, 440)),
        (hind_outer, .26, .36, (416, 439))], 1):
    stripe(f'Полоска на туловище {i}', [section(curve, lo, hi)], tip, f'stripe-body-{i}')

butterfly_right = ((468, 144), (478, 160), (491, 178), (511, 195))
butterfly_body = [butterfly_right, ((511, 195), (497, 191), (476, 176), (466, 157)),
                  ((466, 157), (461, 145), (459, 137), (468, 144))]
a, b, c = (at(butterfly_right, t) for t in (.28, .64, .88))
upper_wing = [(a, (476, 140), (485, 114), (501, 112)),
              ((501, 112), (526, 108), (533, 132), (520, 154)),
              ((520, 154), (513, 165), (503, 173), b)]
lower_wing = [(b, (511, 176), (544, 173), (549, 183)),
              ((549, 183), (555, 199), (527, 205), c)]
stroke('Верхнее крыло бабочки', upper_wing, 'butterfly-upper')
stroke('Нижнее крыло бабочки', lower_wing, 'butterfly-lower')
stroke('Тельце бабочки', butterfly_body, 'butterfly-body', closed=True)
antennae = [[((466, 143), (458, 132), (454, 123), (454, 118))],
           [((469, 144), (467, 131), (472, 124), (472, 117))]]
STEPS.append(dict(kind='stroke', title='Два усика бабочки', paths=[path(cs) for cs in antennae], tool='black', part='butterfly-antennae'))
antenna_tips = [oval(454, 118, 2.6, 2.6), oval(472, 117, 2.6, 2.6)]
STEPS.append(dict(kind='stroke', title='Концы усиков', paths=[path(cs, True) for cs in antenna_tips], tool='black', part='antenna-tips'))

# Catmull–Rom interpolation makes five broad rounded petals, one closed outline.
anchors = []
for i in range(20):
    angle = math.pi/2+i*math.pi/10
    r = [36, 31, 18, 31][i%4]
    anchors.append((550+r*math.cos(angle), 520+r*math.sin(angle)))
petals = []
for i, p1 in enumerate(anchors):
    p0, p2, p3 = anchors[(i-1)%20], anchors[(i+1)%20], anchors[(i+2)%20]
    petals.append((p1, tuple(p1[n]+(p2[n]-p0[n])/6 for n in (0, 1)),
                   tuple(p2[n]-(p3[n]-p1[n])/6 for n in (0, 1)), p2))
flower_centre = oval(550, 520, 12, 12)
stem = [line((546.5, 605), (546.5, 555)), line((546.5, 555), (553.5, 555)),
        line((553.5, 555), (553.5, 605)), line((553.5, 605), (546.5, 605))]
leaves = [[((548, 588), (531, 560), (511, 558), (510, 570)),
           ((510, 570), (514, 586), (534, 593), (548, 588))],
          [((552, 588), (567, 561), (590, 561), (590, 569)),
           ((590, 569), (585, 584), (568, 593), (552, 588))]]
stroke('Пять лепестков цветка', petals, 'flower-petals', closed=True)
stroke('Серединка цветка', flower_centre, 'flower-centre', closed=True)
stroke('Стебелёк цветка', stem, 'flower-stem', closed=True)
STEPS.append(dict(kind='stroke', title='Два листочка цветка', paths=[path(cs, True) for cs in leaves], tool='black', part='flower-leaves'))

for name, d in stripe_regions:
    colour('Закрашиваем '+next(s['title'].lower() for s in STEPS if s.get('part') == name), d, 'black', name, clip=body)
for i, (name, d) in enumerate(hoof_regions, 1):
    colour(f'Чёрное копыто {i}', d, 'black', name)
colour('Чёрный глаз', path(eye, True), 'black', 'eye')
colour('Чёрная кисточка хвоста', path(tuft, True), 'black', 'tail-tuft')
colour('Чёрные кончики усиков', ' '.join(path(cs, True) for cs in antenna_tips), 'black', 'antenna-tips')
muzzle = head_top[1:]+[head_lower[0]]+reverse([muzzle_border])
colour('Светло-серая мордочка', path(muzzle, True)+' '+' '.join(path(cs, True) for cs in nostrils), 'light_gray', 'muzzle')
for i, curves in enumerate(ear_pink, 1):
    colour(f'Розовое ушко {i}', path(curves, True), 'light_pink', f'inner-ear-{i}')
colour('Голубое крыло бабочки', path(upper_wing+reverse([section(butterfly_right, .28, .64)]), True), 'light_blue', 'butterfly-upper')
colour('Оранжевое крыло бабочки', path(lower_wing+reverse([section(butterfly_right, .64, .88)]), True), 'fox_orange', 'butterfly-lower')
colour('Светло-коричневое тельце бабочки', path(butterfly_body, True), 'tan', 'butterfly-body')
colour('Коралловые лепестки', path(petals, True)+' '+path(flower_centre, True), 'coral', 'flower-petals')
colour('Жёлтая серединка цветка', path(flower_centre, True), 'yellow', 'flower-centre')
colour('Зелёный стебелёк', path(stem, True), 'green', 'flower-stem')
colour('Зелёные листочки', ' '.join(path(cs, True) for cs in leaves), 'green', 'flower-leaves')

grass = [
    'M 18 607 Q 35 601 52 605 L 39 590 Q 45 586 55 600 L 54 581 Q 60 577 61 601 L 74 587 Q 81 588 66 605 Q 105 601 155 606 L 155 611 L 18 612 Z',
    'M 210 606 L 221 587 Q 228 585 225 604 L 240 590 Q 246 592 231 607 Q 267 602 294 605 L 284 586 Q 290 582 299 601 L 303 581 Q 310 580 306 604 L 320 588 Q 327 590 313 606 Q 365 601 415 606 L 415 612 L 210 612 Z',
    'M 465 607 L 475 590 Q 481 588 480 602 L 487 582 Q 494 582 489 604 L 501 592 Q 508 594 496 607 Q 552 603 590 606 L 600 591 Q 608 590 603 604 L 616 597 L 621 611 L 465 612 Z',
]
STEPS.append(dict(kind='stroke', title='Контур травки под зеброй', paths=grass, tool='green', part='grass', background=True))
colour('Зелёная травка под ногами', ' '.join(grass), 'green', 'grass', background=True)

# Group repeated details without merging their masks or jumping between shapes.
def group_details(kind, prefix, part, title):
    members = [s for s in STEPS if s['kind'] == kind and s.get('part', '').startswith(prefix)]
    grouped = dict(kind=kind, title=title, tool='black', part=part)
    if kind == 'stroke':
        grouped['paths'] = [dict(d=d, part=s['part']) for s in members for d in s['paths']]
    else:
        grouped.update(fill=PENCILS['black']['color'], d=' '.join(s['d'] for s in members),
                       regions=[dict(d=s['d'], part=s['part']) for s in members])
        if members[0].get('clip'):
            grouped['clip'] = members[0]['clip']
    first = STEPS.index(members[0])
    STEPS[:] = [s for s in STEPS if s not in members]
    STEPS.insert(first, grouped)
    return grouped


stripe_contours = group_details('stroke', 'stripe-', 'zebra-stripes', 'Все полоски зебры — контуры')
hoof_contours = group_details('stroke', 'hoof-', 'zebra-hooves', 'Все копыта — границы закрашивания')
STEPS.remove(hoof_contours)
STEPS.insert(STEPS.index(stripe_contours)+1, hoof_contours)
group_details('color', 'stripe-', 'zebra-stripes', 'Закрашиваем все полоски зебры')
group_details('color', 'hoof-', 'zebra-hooves', 'Закрашиваем все четыре копыта')

zebra_parts = {'body', 'ear-1', 'ear-2', 'mane', 'leg-far-front', 'leg-front',
               'leg-far-hind', 'leg-hind', 'inner-ear-1', 'inner-ear-2',
               'muzzle', 'eye', 'nostrils', 'smile', 'tail', 'tail-tuft',
               'zebra-stripes', 'zebra-hooves'}
for step in STEPS:
    if step.get('part') in zebra_parts:
        step['actor'] = 'zebra'
    elif step.get('part', '').startswith('butterfly-') or step.get('part') == 'antenna-tips':
        step['actor'] = 'butterfly'

front_run_mask_curves = front_run+[line(front_outer[-1], front_inner[0])]
hind_run_mask_curves = hind_run+[line(hind_inner[-1], hind_run[0][0])]
front_run_mask = path(front_run_mask_curves, True)
hind_run_mask = path(hind_run_mask_curves, True)
mane_mask = path([((125, 80), (81, 158), (85, 275), (130, 350)), neck[1], ear[0], line((127, 81), (125, 80))], True)
back_ear_mask = path(back_ear+[line(back_ear[-1][-1], back_ear[0][0])], True)

def run_leg(part, hoof_part, curves, mask, root, cap, phase):
    def divide(cs):
        divided = []
        for c in cs:
            if min(c[0][1], c[-1][1]) < cap < max(c[0][1], c[-1][1]):
                t = parameter_y(c, cap)
                divided += [section(c, 0, t), section(c, t, 1)]
            else:
                divided.append(c)
        return divided
    # Explicit endpoints at the hoof border keep the hoof and bending leg joined.
    return dict(part=part, hoof=hoof_part, root=root, cap=cap, phase=phase,
                path=path(divide(curves)), mask=path(divide(mask), True))

lesson = dict(
    id='zebra_butterfly', title='Зебра и бабочка', viewBox='0 0 640 640',
    progressRevision=2,
    finale=dict(type='zebra-run', torso=body+' '+front_run_mask+' '+hind_run_mask,
                extraBody=[mane_mask, back_ear_mask],
                legs=[run_leg('leg-far-front', 'hoof-1', far_front, far_front_mask_curves, 472, 558, 0),
                      run_leg('leg-front', 'hoof-2', front_run, front_run_mask_curves, 456, 582, math.pi),
                      run_leg('leg-far-hind', 'hoof-3', far_hind, far_hind_mask_curves, 458, 556, math.pi),
                      run_leg('leg-hind', 'hoof-4', hind_run, hind_run_mask_curves, 456, 582, 0)],
                tail=[414, 320],
                butterfly=dict(anchor=[468, 144], wings=[
                    dict(part='butterfly-upper', hinge=a, angle=math.degrees(math.atan2(b[1]-a[1], b[0]-a[0])), phase=0),
                    dict(part='butterfly-lower', hinge=b, angle=math.degrees(math.atan2(c[1]-b[1], c[0]-b[0])), phase=.5)])),
    source=dict(title='Зебра с бабочкой по фотографии владельца',
                origin='Фото и одобренный цветной макет предоставлены владельцем 2026-11-25.',
                note='Четыре раздельные ноги с чёрными копытами, 13 полосок, розовые ушки, '
                     'светло-серая мордочка, голубая и оранжевая бабочка, коралловый цветок '
                     'с жёлтой серединкой и зелёная травка. Геометрия адаптирована '
                     'для пошагового рисования. Исходное фото в ZIP не включено.'),
    palette=['black', 'light_gray', 'light_pink', 'light_blue', 'fox_orange', 'tan', 'coral', 'yellow', 'green'],
    steps=STEPS,
    geometry=dict(body=body, legs=[far_front_mask, body, far_hind_mask, body]),
)
(BASE / 'lessons/zebra_butterfly.json').write_text(json.dumps(lesson, ensure_ascii=False, indent=2)+'\n')
print(f'Built zebra_butterfly: {len(STEPS)} steps, {len(stripe_regions)} stripes, {len(hoof_regions)} hooves')
