"""Build the car lesson from the owner's approved window-colouring mockup.

Standard library only. Shared curves define the body, wheel arches and masks;
the three blue pencil regions share the exact outlines of the window frames.
"""
import json
import math
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE / 'pencils.json').read_text())
STEPS = []


def stroke(title, paths, tool='black', part=None, background=False):
    STEPS.append(dict(kind='stroke', title=title, paths=paths, tool=tool,
                      **({'part': part} if part else {}),
                      **({'background': True} if background else {})))


def colour(title, d, tool, part=None, background=False):
    STEPS.append(dict(kind='color', title=title, d=d, tool=tool,
                      fill=PENCILS[tool]['color'],
                      **({'part': part} if part else {}),
                      **({'background': True} if background else {})))


def oval(x, y, rx, ry):
    return f'M {x-rx} {y} A {rx} {ry} 0 1 0 {x+rx} {y} A {rx} {ry} 0 1 0 {x-rx} {y} Z'


def road_dash(x, y, angle):
    a = math.radians(angle)
    def point(px, py):
        return f'{x+px*math.cos(a)-py*math.sin(a):.3f} {y+px*math.sin(a)+py*math.cos(a):.3f}'
    return (f'M {point(-18, -4)} L {point(18, -4)} A 4 4 0 0 1 {point(18, 4)} '
            f'L {point(-18, 4)} A 4 4 0 0 1 {point(-18, -4)} Z')


roof = 'C 162 248 187 194 216 177 C 225 170 236 168 252 168 C 360 167 470 172 535 187 C 580 198 604 229 615 280 C 619 295 620 313 620 329'
front = 'C 645 329 662 344 667 368 C 670 379 669 389 660 393 L 613 396 C 613 375 600 358 575 358 C 550 358 537 375 537 394'
back = 'L 273 389 C 273 368 260 355 235 355 C 210 355 197 368 197 387 L 165 385 C 150 384 143 378 144 364 L 150 310'
body = 'M 150 310 '+roof+' '+front+' '+back+' Z'
windows = [
    ('rear', 'M 170 301 C 179 251 195 207 220 185 C 224 181 230 180 239 180 L 326 181 L 321 307 Z'),
    ('middle', 'M 343 182 C 390 183 441 187 472 193 L 465 313 L 338 308 Z'),
    ('front', 'M 489 197 C 551 205 587 235 601 281 C 604 292 606 306 607 318 L 481 313 Z'),
]
wheels = [oval(235, 393, 29, 29), oval(575, 400, 29, 29)]
hubs = [oval(235, 393, 9, 9), oval(575, 400, 9, 9)]
lights = [oval(157, 335, 6, 12), oval(655, 357, 7, 11)]
stroke('Крыша и кабина машинки', ['M 150 310 '+roof], part='body')
stroke('Капот и передняя колёсная арка', ['M 620 329 '+front], part='body')
stroke('Низ кузова, задняя арка и багажник', ['M 537 394 '+back], part='body')
for name, frame in windows:
    stroke({'rear': 'Заднее окно', 'middle': 'Среднее окно', 'front': 'Переднее окно'}[name],
           [frame], part='window-'+name)
stroke('Линия под окнами', ['M 150 310 L 620 329'])
stroke('Задняя дверца', ['M 330 317.277 L 330 390.080'])
stroke('Передняя дверца', ['M 475 323.138 L 475 392.826'])
stroke('Две дверные ручки', ['M 346 332 L 358 332', 'M 490 339 L 502 339'])
for i, d in enumerate(wheels, 1):
    stroke(f'Колесо {i}', [d], part=f'wheel-{i}')
for i, d in enumerate(hubs, 1):
    stroke(f'Серединка колеса {i}', [d], part=f'hub-{i}')
for i, d in enumerate(lights, 1):
    stroke(f'Фара {i}', [d], part=f'light-{i}')

stones = [
    'M 45 354 Q 49 342 59 342 Q 70 340 78 354 Q 65 359 45 354 Z',
    'M 102 364 Q 103 354 114 352 Q 126 352 132 365 Q 118 370 102 364 Z',
    'M 701 387 Q 704 373 717 374 Q 729 374 733 387 Q 718 392 701 387 Z',
    'M 748 376 Q 752 365 763 367 Q 774 369 779 380 Q 762 383 748 376 Z',
]
stroke('Четыре камешка вдоль обочины', stones, part='roadside-stones', background=True)

road_top = 'M 20 352 C 165 384 280 401 400 404 C 550 410 660 411 780 386'
road_bottom = 'M 780 458 C 660 482 550 478 400 474 C 240 469 100 438 20 418'
road = road_top+' L 780 458 '+road_bottom.split(' ', 3)[3]+' L 20 352 Z'
dashes = [road_dash(x, y, angle) for x, y, angle in
          [(76, 405, 14), (179, 422, 9), (282, 435, 5), (385, 441, 2),
           (488, 444, -1), (591, 441, -4), (694, 430, -9)]]
stroke('Верхний край дороги', [road_top], 'light_gray', 'road', True)
stroke('Нижний край дороги', [road_bottom], 'light_gray', 'road', True)
stroke('Семь коротких полосок на дороге', dashes, 'light_gray', 'road-marks', True)
colour('Серая дорога — полоски оставляем белыми', road+' '+' '.join(dashes), 'light_gray', 'road', True)
colour('Серые камешки на обочине', ' '.join(stones), 'light_gray', 'roadside-stones', True)
colour('Зелёный кузов — окна, арки и фары не закрашиваем',
       body+' '+' '.join(frame for _, frame in windows)+' '+' '.join(lights), 'sage', 'body')
for i, (wheel, hub) in enumerate(zip(wheels, hubs), 1):
    colour(f'Тёмно-синее колесо {i}', wheel+' '+hub, 'navy', f'wheel-{i}')
for i, hub in enumerate(hubs, 1):
    colour(f'Светлая серединка колеса {i}', hub, 'pale_mint', f'hub-{i}')
clouds = [
    'M 205 120 C 194 120 190 113 193 106 C 196 97 205 99 207 98 C 209 86 224 80 229 89 C 240 84 252 89 255 97 C 269 94 279 102 276 112 C 274 119 263 122 252 122 Z',
    'M 465 95 C 448 94 442 79 447 58 C 452 45 468 44 476 45 C 480 23 499 16 515 18 C 530 20 538 28 540 34 C 554 28 570 29 579 37 C 591 42 596 49 600 59 C 619 58 627 69 624 79 C 622 91 609 96 598 96 Z',
]
for i, d in enumerate(clouds, 1):
    stroke(f'Контур облачка {i}', [d], 'pale_blue', f'cloud-{i}')
for i, d in enumerate(clouds, 1):
    colour(f'Голубое облачко {i}', d, 'pale_blue', f'cloud-{i}')
for name, frame in windows:
    colour({'rear': 'Полностью закрашиваем заднее окно голубым',
            'middle': 'Полностью закрашиваем среднее окно голубым',
            'front': 'Полностью закрашиваем переднее окно голубым'}[name],
           frame, 'pale_blue', 'window-'+name)
for i, d in enumerate(lights, 1):
    colour(f'Жёлтая фара {i}', d, 'yellow', f'light-{i}')
sun = oval(705, 100, 29, 29)
rays = []
for i in range(8):
    angle = -math.pi/2+i*math.pi/4
    rays.append(f'M {705+35*math.cos(angle):.3f} {100+35*math.sin(angle):.3f} '
                f'L {705+47*math.cos(angle):.3f} {100+47*math.sin(angle):.3f}')
stroke('Круг солнышка', [sun], 'yellow', 'sun')
stroke('Восемь коротких лучиков', rays, 'yellow', 'sun-rays')
colour('Закрашиваем солнышко жёлтым', sun, 'yellow', 'sun')

lesson = dict(
    id='green_car', title='Зелёная машинка', viewBox='0 0 800 500', paperOrientation='landscape',
    progressRevision=3,
    source=dict(title='Машинка на дороге по фотографии владельца',
                origin='Фото и согласование макета предоставлены владельцем приложения 2026-11-25.',
                note='Последний выбранный вариант: без людей и бликов; три окна полностью '
                     'закрашены голубым до рамок. Зелёный кузов, два колеса, две фары, '
                     'изогнутая серая дорога с белыми полосками и два облака. '
                     'По уточнению владельца добавлены солнышко с восемью лучами '
                     'и четыре камня на обочине. '
                     'Геометрия адаптирована для пошагового рисования. Фото в ZIP не входит.'),
    palette=['black', 'light_gray', 'sage', 'navy', 'pale_mint', 'pale_blue', 'yellow'], steps=STEPS,
)
(BASE / 'lessons/green_car.json').write_text(json.dumps(lesson, ensure_ascii=False, indent=2)+'\n')
print(f'Built green_car: {len(STEPS)} steps, three fully coloured blue windows')
