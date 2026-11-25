"""Rebuild the graphic fish from the owner's photo; standard library only.

Thirteen closed capsule outlines and thirteen separately coloured regions.
Coordinates are an adaptation of the large dark fish, not a pixel tracing.
"""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE / 'pencils.json').read_text())
INK = PENCILS['navy']['color']
head = 'M 75 150 L 175 105 L 175 195 Z'
eye = 'M 139 135 A 4 4 0 1 0 131 135 A 4 4 0 1 0 139 135 Z'
neck = 'M 445 138 L 469 150 L 445 162 Z'
tail = 'M 470 150 L 525 105 L 515 150 L 525 195 Z'
heights = [98, 108, 116, 122, 126, 124, 116, 104, 90, 76, 62, 48, 34]


def capsule(x, height):
    """14 units wide, one continuous closed outline, shared with its fill."""
    y, bottom, r = 150-height/2, 150+height/2, 7
    return (f'M {x-r} {y+r:g} A {r} {r} 0 0 1 {x+r} {y+r:g} '
            f'L {x+r} {bottom-r:g} A {r} {r} 0 0 1 {x-r} {bottom-r:g} Z')


stripes = [capsule(188+i*20, h) for i, h in enumerate(heights)]
parts = [f'stripe-{i+1}' for i in range(13)]
colours = ['red', 'orange', 'yellow', 'light_green', 'green', 'turquoise',
           'light_blue', 'blue', 'purple', 'pink', 'coral', 'orange', 'yellow']
steps = [
    dict(kind='stroke', title='Треугольная голова и маленький глаз',
         paths=[head, eye], tool='black', part='head'),
    dict(kind='stroke', title='Маленький треугольник и раздвоенный хвост',
         paths=[neck, tail], tool='black', part='tail'),
]
for i, (d, part) in enumerate(zip(stripes, parts), 1):
    steps.append(dict(kind='stroke', title=f'Контур полоски {i}', paths=[d],
                      tool='black', part=part))
steps += [
    dict(kind='color', title='Тёмно-синяя голова: глаз оставляем белым',
         d=head+' '+eye, fill=INK, tool='navy', part='head'),
    dict(kind='color', title='Тёмно-синий хвост',
         d=neck+' '+tail, fill=INK, tool='navy', part='tail'),
]
for i, (d, part, tool) in enumerate(zip(stripes, parts, colours), 1):
    steps.append(dict(kind='color', title=f'Закрашиваем полоску {i}', d=d,
                      fill=PENCILS[tool]['color'], tool=tool, part=part))
ground = 'M 18 256 C 35 253 55 251 74 251 C 146 246 172 264 246 254 C 340 241 440 265 578 251'
leaves = [
    ('M 24 254 C 9 220 9 180 20 141 C 34 183 37 220 31 254 Z', 'green', [28, 254]),
    ('M 39 252 C 28 204 35 155 45 109 C 59 158 56 209 47 252 Z', 'light_green', [43, 252]),
    ('M 54 252 C 44 223 49 193 65 169 C 73 203 68 230 61 252 Z', 'green', [58, 252]),
]
stones = [f'M {x-rx} {y} A {rx} {ry} 0 1 0 {x+rx} {y} A {rx} {ry} 0 1 0 {x-rx} {y} Z'
          for x, y, rx, ry in [(200, 269, 10, 5), (350, 267, 7, 4), (484, 270, 12, 5)]]
steps.append(dict(kind='stroke', title='Волнистая линия дна', paths=[ground],
                  tool='brown', part='seabed', background=True))
for i, (d, _, _) in enumerate(leaves, 1):
    steps.append(dict(kind='stroke', title=f'Контур листа водоросли {i}', paths=[d],
                      tool='black', part=f'seaweed-{i}', background=True))
steps.append(dict(kind='stroke', title='Три камешка на дне', paths=stones,
                  tool='black', part='pebbles', background=True))
steps.append(dict(kind='color', title='Закрашиваем дно песочным цветом',
                  d=ground+' L 578 288 L 18 288 Z '+' '.join(stones),
                  fill=PENCILS['beige']['color'], tool='beige', part='seabed', background=True))
for i, (d, tool, _) in enumerate(leaves, 1):
    steps.append(dict(kind='color', title=f'Закрашиваем лист водоросли {i}', d=d,
                      fill=PENCILS[tool]['color'], tool=tool, part=f'seaweed-{i}', background=True))
steps.append(dict(kind='color', title='Серые камешки', d=' '.join(stones),
                  fill=PENCILS['gray']['color'], tool='gray', part='pebbles', background=True))
lesson = dict(
    id='striped_fish', title='Полосатая рыбка', viewBox='0 0 600 300',
    paperOrientation='landscape', progressRevision=4, stepOrder='authored',
    source=dict(title='Графическая рыбка с фотографии владельца',
                origin='Фото предоставлено владельцем приложения 2026-11-25.',
                note='Крупная тёмная рыбка справа: 13 вертикальных линий тела, '
                     'треугольная голова с белым глазом и раздвоенный хвост. '
                     'По макету, согласованному 2026-11-25, полоски расширены '
                     'в замкнутые формы с разноцветной штриховкой. '
                     'Каждый контур и каждое закрашивание — отдельный шаг. '
                     'Фото, надпись и фон в урок не включены.'),
    finale=dict(type='striped-fish', tail=[470, 150], stripes=parts,
                seaweedForeground=True,
                seaweed=[dict(part=f'seaweed-{i}', root=root) for i, (_, _, root) in enumerate(leaves, 1)]),
    palette=list(dict.fromkeys(['black', 'navy']+colours+['brown', 'beige', 'gray'])), steps=steps,
)
(BASE / 'lessons/striped_fish.json').write_text(
    json.dumps(lesson, ensure_ascii=False, indent=2)+'\n')
print(f'Built striped_fish: {len(steps)} steps, {len(stripes)} closed coloured stripes')
