"""Rebuild Korzhik using shared boundaries (native 1280x720 video coordinates).

Visible contours omit occluded edges; colour regions close along the exact
existing head, hat and clothing curves, never independently guessed lines.
"""
from pathlib import Path
import json
import math

BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE / 'pencils.json').read_text())
STEPS = []


def pt(p): return f'{p[0]:.6f} {p[1]:.6f}'
def move(p): return 'M ' + pt(p)
def curve(c): return ' C ' + ' '.join(pt(p) for p in c[1:])
def path(c): return move(c[0]) + curve(c)
def rev(c): return tuple(reversed(c))
def line(a, b): return (a, a, b, b)
def split(c, t):
    def mix(a, b): return tuple(x+(y-x)*t for x, y in zip(a, b))
    a, b, d = (mix(c[i], c[i+1]) for i in range(3))
    e, f = mix(a, b), mix(b, d)
    g = mix(e, f)
    return (c[0], a, e, g), (g, f, d, c[3])
def section(c, start, end):
    left = split(c, end)[0]
    return split(left, start/end)[1] if start else left
def at(c, t): return split(c, t)[0][3]
def chain(cs): return path(cs[0]) + ''.join(curve(c) for c in cs[1:])
def oval(cx, cy, rx, ry, angle=0):
    k = .55228475
    c = [((-rx, 0), (-rx, -k*ry), (-k*rx, -ry), (0, -ry)),
         ((0, -ry), (k*rx, -ry), (rx, -k*ry), (rx, 0)),
         ((rx, 0), (rx, k*ry), (k*rx, ry), (0, ry)),
         ((0, ry), (-k*rx, ry), (-rx, k*ry), (-rx, 0))]
    a = math.radians(angle)
    def transform(p): return (cx+p[0]*math.cos(a)-p[1]*math.sin(a), cy+p[0]*math.sin(a)+p[1]*math.cos(a))
    return chain([tuple(transform(p) for p in segment) for segment in c]) + ' Z'
def stroke(title, paths, time):
    STEPS.append(dict(kind='stroke', title=title, paths=paths if isinstance(paths, list) else [paths], tool='black', sourceTime=time))
def color(title, d, tool, time, **extra):
    STEPS.append(dict(kind='color', title=title, d=d, tool=tool, fill=PENCILS[tool]['color'], sourceTime=time, **extra))

# Head: clockwise, smooth at the crown and left shoulder. Every attached
# element uses a section of these same curves rather than a nearby point.
H, R, B, L, S = (632, 193), (794, 311), (665, 450), (528, 325), (571, 223)
h = [(H, (707, 174), (801, 225), R), (R, (798, 392), (736, 454), B),
     (B, (590, 446), (521, 400), L), (L, (535, 250), (543, 244.777778), S),
     (S, (589, 209), (612, 198), H)]
head = chain(h) + ' Z'
stroke('Контур головы', head, 17)

# The top oval must exist before its band and pompon. The lower oval edge
# supplies the band's upper boundary; the head supplies its lower boundary.
cap = [((548, 158), (570, 145), (601, 133), (621, 130)),
       ((621, 130), (638, 126), (645, 144), (629, 153)),
       ((629, 153), (606, 165), (575, 182), (554, 186)),
       ((554, 186), (536, 189), (529, 171), (548, 158))]
brim = chain(cap) + ' Z'
BL, BS, BR = at(h[4], .12), at(h[4], .26), H
TL, TS, TR = at(cap[2], .88), at(cap[2], .71), at(cap[2], .08)
left_band, right_band, seam = line(TL, BL), line(TR, BR), line(TS, BS)
front = path(section(cap[2], .08, .71)) + curve(seam)
front += curve(section(h[4], .26, 1)) + curve(rev(right_band)) + ' Z'
stroke('Овальный верх бескозырки', brim, 30)
stroke('Боковины и полоска бескозырки', [path(left_band), path(right_band), path(seam)], 34)
KA, KB = at(cap[0], .38), at(cap[0], .62)
knob_curves = [(KA, (559, 125), (572, 107), (586, 114)), ((586, 114), (600, 116), (600, 130), KB)]
knob_visible = chain(knob_curves)
knob = knob_visible + curve(rev(section(cap[0], .38, .62))) + ' Z'
stroke('Помпон бескозырки', knob_visible, 37)
color('Чёрный помпон', knob, 'black', 37)
stroke('Якорь на бескозырке', [oval(607, 177, 3.2, 3.2), 'M 607 180.2 L 609 197', 'M 598 187 C 597 202 618 201 618 185'], 40)

# Left ear: both contours stop at the cap. The omitted sections are already
# supplied by the cap's outline, band and head. No line runs through the hat.
EL, IL = at(h[3], .27), at(h[3], .72)
ear_left_rise = (EL, (525, 223), (510, 150), (509, 124))
ear_left_tip = ((509, 124), (509, 118), (513, 121), cap[0][0])
left_outer_visible = path(ear_left_rise) + curve(ear_left_tip)
left_shared = curve(rev(cap[3])) + curve(rev(section(cap[2], .88, 1)))
left_shared += curve(left_band) + curve(rev(section(h[4], 0, .12)))
left_outer = left_outer_visible + left_shared + curve(rev(section(h[3], .27, 1))) + ' Z'
JL = at(cap[3], .70)
left_inner_visible = move(IL) + ' L 526 150 L ' + pt(JL)
left_inner = left_inner_visible + curve(rev(section(cap[3], 0, .70)))
left_inner += curve(rev(section(cap[2], .88, 1))) + curve(left_band)
left_inner += curve(rev(section(h[4], 0, .12))) + curve(rev(section(h[3], .72, 1))) + ' Z'
stroke('Левое ушко', [left_outer_visible, left_inner_visible], 69)

# Right ear starts on the oval above and joins the same head arc below.
OR, ER, IR, JR = at(cap[0], .97), at(h[0], .38), at(h[0], .27), at(cap[1], .50)
right_outer_visible = move(OR) + ' L 638 79 L ' + pt(ER)
right_shared = curve(rev(section(h[0], 0, .38))) + curve(rev(right_band))
right_shared += curve(rev(section(cap[2], 0, .08))) + curve(rev(cap[1])) + curve(rev(section(cap[0], .97, 1)))
right_outer = right_outer_visible + right_shared + ' Z'
right_inner_visible = move(JR) + ' L 640 110 L ' + pt(IR)
right_inner = right_inner_visible + curve(rev(section(h[0], 0, .27))) + curve(rev(right_band))
right_inner += curve(rev(section(cap[2], 0, .08))) + curve(rev(section(cap[1], .50, 1))) + ' Z'
stroke('Правое ушко', [right_outer_visible, right_inner_visible], 74)

# Black details are actually shaded, not instantly filled at the end of a
# contour animation. White eye and mouth cutouts reuse these exact paths.
eye_l, eye_r = oval(617, 275, 32, 34, 12), oval(712, 245, 29, 32, -9)
nose = oval(689, 322, 29, 23, -20)
mouth_cs = [((633, 363), (667, 384), (720, 374), (744, 341)),
            ((744, 341), (756, 370), (739, 409), (711, 420)),
            ((711, 420), (675, 425), (643, 401), (633, 363))]
mouth = chain(mouth_cs) + ' Z'
for title, d, pupil, time in [('Левый глаз', eye_l, oval(617, 276, 8.5, 10, 5), 51), ('Правый глаз', eye_r, oval(712, 245, 8, 9.5), 55)]:
    stroke(title, d, time)
    color('Чёрный зрачок: '+title.lower(), pupil, 'black', time)
stroke('Контур носа', nose, 45)
color('Чёрный нос', nose, 'black', 45)
stroke('Улыбка', mouth, 60)

# Ribbons close against the ear/head; their attachment edges are not redrawn.
RA, RB = at(ear_left_rise, .34), at(ear_left_rise, .14)
ribbon_top_visible = move(RA) + ' C 496 241 477 240 457 234 L 475 250 L 454 265 C 481 274 509 270 ' + pt(RB)
ribbon_top = ribbon_top_visible + curve(section(ear_left_rise, .14, .34)) + ' Z'
RA2, RB2 = at(h[3], .23), at(h[3], .02)
ribbon_bottom_visible = move(RA2) + ' C 486 304 453 301 429 297 L 443 314 L 427 335 C 476 340 508 331 ' + pt(RB2)
ribbon_bottom = ribbon_bottom_visible + curve(section(h[3], .02, .23)) + ' Z'
for title, visible, mask, time in [('Верхняя ленточка', ribbon_top_visible, ribbon_top, 82), ('Нижняя ленточка', ribbon_bottom_visible, ribbon_bottom, 88)]:
    stroke(title, visible, time)
    color('Чёрная '+title.lower(), mask, 'black', 250)

# Clothing joins the existing head, not an approximately matching new line.
SA, SB = at(h[2], .18), at(h[1], .70)
SC, SD = (633, 562), (738, 558)
shirt_left, shirt_right = line(SA, SC), line(SD, SB)
shirt_bottom = (SC, (662, 566), (711, 564), SD)
shirt_visible = path(shirt_left) + curve(shirt_bottom) + curve(shirt_right)
shirt = shirt_visible + curve(section(h[1], .70, 1)) + curve(section(h[2], 0, .18)) + ' Z'
stroke('Тельняшка', shirt_visible, 102)
SU, SL = at(h[2], .24), at(shirt_left, .25)
sleeve_l_visible = move(SU) + ' L 581 473 L 596 491 L ' + pt(SL)
sleeve_l = sleeve_l_visible + curve(rev(section(shirt_left, 0, .25))) + curve(section(h[2], .18, .24)) + ' Z'
RU, RL = at(h[1], .62), at(shirt_right, .75)
sleeve_r_visible = move(RU) + ' L 763 443 L 752 469 L ' + pt(RL)
sleeve_r = sleeve_r_visible + curve(section(shirt_right, .75, 1)) + curve(rev(section(h[1], .62, .70))) + ' Z'
stroke('Левый рукав', sleeve_l_visible, 106)
stroke('Правый рукав', sleeve_r_visible, 109)
legs, cuffs = [], []
for title, start, end, bottom_a, bottom_b, time in [
        ('Левая штанина', .08, .34, (638, 619), (666, 621), 114),
        ('Правая штанина', .60, .88, (696, 615), (729, 615), 117)]:
    base = section(shirt_bottom, start, end)
    side = line(base[0], bottom_a)
    cuff = line(bottom_a, bottom_b)
    visible = path(side) + curve(cuff) + curve(line(bottom_b, base[3]))
    legs.append(visible + curve(rev(base)) + ' Z'); cuffs.append(cuff)
    stroke(title, visible, time)
    if title == 'Левая штанина': left_leg_side = side
FA, FB = at(cuffs[0], .10), at(cuffs[0], .82)
foot_l_visible = move(FA) + ' L 641 636 C 637 648 646 650 651 650 L 674 652 C 687 650 686 640 682 637 C 677 633 670 635 661 635 L ' + pt(FB)
foot_l = foot_l_visible + curve(rev(section(cuffs[0], .10, .82))) + ' Z'
FA2, FB2 = at(cuffs[1], .18), at(cuffs[1], .58)
foot_r_visible = move(FA2) + ' L 701 639 C 698 643 706 644 711 644 L 750 645 C 766 644 766 634 764 629 C 760 621 753 624 750 624 L 715 626 L ' + pt(FB2)
foot_r = foot_r_visible + curve(rev(section(cuffs[1], .18, .58))) + ' Z'
stroke('Левая ступня', foot_l_visible, 122)
stroke('Правая ступня', foot_r_visible, 126)
TA, TB = at(shirt_left, .98), at(left_leg_side, .62)
tail_visible = move(TA) + ' C 617 588 596 581 571 561 C 550 541 530 548 516 554 C 498 563 495 584 505 602 C 531 636 600 634 ' + pt(TB)
tail = tail_visible + curve(rev(section(left_leg_side, 0, .62)))
tail += curve(rev(section(shirt_bottom, 0, .08))) + curve(rev(section(shirt_left, .98, 1))) + ' Z'
stroke('Хвост', tail_visible, 132)

# Hands begin and end on their sleeve cuffs. One complete hand per step.
cuff_l, cuff_r = line((581, 473), (596, 491)), line((763, 443), (752, 469))
AU, AD, RU2, RD2 = at(cuff_l, .35), at(cuff_l, .75), at(cuff_r, .40), at(cuff_r, .80)
arm_l_visible = move(AU) + ' C 566 500 545 498 534 480 C 537 466 551 443 545 437 C 539 431 526 449 522 456 C 515 440 510 423 504 429 C 496 433 507 452 512 460 C 500 456 489 458 490 466 C 491 472 510 473 519 474 C 527 492 538 500 548 501 C 568 503 582 494 ' + pt(AD)
arm_l = arm_l_visible + curve(rev(section(cuff_l, .35, .75))) + ' Z'
arm_r_visible = move(RU2) + ' C 787 467 805 453 820 434 C 814 424 809 406 817 405 C 824 403 828 423 830 425 C 837 410 848 396 852 402 C 858 407 842 424 841 428 C 850 427 864 430 860 437 C 852 445 835 439 829 436 C 809 462 785 476 ' + pt(RD2)
arm_r = arm_r_visible + curve(rev(section(cuff_r, .40, .80))) + ' Z'
stroke('Левая лапка', arm_l_visible, 139)
stroke('Правая лапка', arm_r_visible, 145)
stroke('Три уса слева', ['M 536 353 L 489 358', 'M 543 371 L 489 392', 'M 560 394 L 518 423'], 151)
stroke('Три уса справа', ['M 780 300 L 833 267', 'M 783 319 L 838 303', 'M 781 338 L 829 344'], 154)

color('Оранжевая мордочка', head+' '+eye_l+' '+eye_r+' '+mouth+' '+nose, 'orange', 168)
color('Оранжевое левое ушко', left_outer+' '+left_inner, 'orange', 178)
color('Оранжевое правое ушко', right_outer+' '+right_inner, 'orange', 183)
color('Оранжевый хвост', tail, 'orange', 190)
for title, d, time in [('Улыбка', mouth, 197), ('Левая лапка', arm_l, 205), ('Правая лапка', arm_r, 208), ('Левая ступня', foot_l, 214), ('Правая ступня', foot_r, 216)]:
    color('Коричневая: '+title.lower(), d, 'brown', time)
left_marks = 'M 530 322 Q 563 317 583 321 Q 590 328 582 333 Q 560 337 530 336 Z M 530 354 Q 559 345 580 349 Q 584 355 575 361 L 530 370 Z M 540 386 Q 567 376 584 376 Q 591 381 582 388 L 550 405 Z'
right_marks = 'M 781 298 Q 802 293 807 301 L 807 313 L 779 316 Z M 783 323 Q 807 321 807 330 L 805 341 L 779 337 Z M 775 349 Q 803 350 802 360 L 795 370 L 772 361 Z'
color('Три коричневые полоски слева', left_marks, 'brown', 218, clip=head)
color('Три коричневые полоски справа', right_marks, 'brown', 220, clip=head)
tail_marks = 'M 529 548 L 544 554 Q 539 583 522 610 L 511 605 Q 522 575 529 548 Z M 568 556 L 581 570 Q 576 598 565 628 L 552 625 Q 562 592 568 556 Z M 613 574 L 633 569 L 636 610 L 614 615 Q 613 595 613 574 Z'
color('Полоски на хвосте', tail_marks, 'brown', 222, clip=tail)
color('Голубая передняя часть бескозырки', front, 'light_blue', 231)
inner_cap = [tuple((588.5+(p[0]-588.5)*.90, 158+(p[1]-158)*.74) for p in c) for c in cap]
color('Голубой край бескозырки', brim+' '+chain(inner_cap)+' Z', 'light_blue', 234)
color('Полоска левого рукава', 'M 592 463 L 598 459 L 615 477 L 608 482 Z', 'light_blue', 241, clip=sleeve_l)
color('Полоска правого рукава', 'M 730 441 L 737 436 L 757 449 L 753 457 Z', 'light_blue', 243, clip=sleeve_r)
for n, y in enumerate([456, 474, 490, 506, 522, 538, 554]):
    band = f'M 615 {y} Q 675 {y+5} 745 {y-1} L 746 {y+6} Q 675 {y+11} 615 {y+7} Z'
    color(f'Голубая полоска тельняшки {n+1}', band, 'light_blue', 245+n*1.5, clip=shirt)
color('Голубая левая штанина', legs[0], 'light_blue', 258)
color('Голубая правая штанина', legs[1], 'light_blue', 260)
color('Середина левого ушка', left_inner, 'beige', 268)
color('Середина правого ушка', right_inner, 'beige', 270)

lesson = dict(id='korzhik', title='Коржик', progressRevision=2, viewBox='410 60 470 620',
              source=dict(title='РыбаКит / Папа рисует — Коржик',
                          origin='Полное видео «Мультик ТРИ КОТА - Как нарисовать КОРЖИКА для детей» предоставлено владельцем приложения.',
                          durationSeconds=284.803,
                          note='Сначала голова, овальный верх шапки, боковины, помпон и уши. Общие границы и скрытые участки вычисляются из одних кривых; чёрные детали штрихуются. sourceTime — примерная отметка времени, порядок группируется по карандашам.'),
              steps=STEPS, palette=['black', 'orange', 'brown', 'light_blue', 'beige'])
(BASE / 'lessons/korzhik.json').write_text(json.dumps(lesson, ensure_ascii=False, indent=2)+'\n')
print(len(STEPS), 'steps;', sum(s['kind'] == 'stroke' for s in STEPS), 'outline;', sum(s['kind'] == 'color' for s in STEPS), 'colour')
