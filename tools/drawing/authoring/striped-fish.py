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
lesson = dict(
    id='striped_fish', title='Полосатая рыбка', viewBox='0 0 600 300',
    paperOrientation='landscape', progressRevision=2, stepOrder='authored',
    source=dict(title='Графическая рыбка с фотографии владельца',
                origin='Фото предоставлено владельцем приложения 2026-11-25.',
                note='Крупная тёмная рыбка справа: 13 вертикальных линий тела, '
                     'треугольная голова с белым глазом и раздвоенный хвост. '
                     'По макету, согласованному 2026-11-25, полоски расширены '
                     'в замкнутые формы с разноцветной штриховкой. '
                     'Каждый контур и каждое закрашивание — отдельный шаг. '
                     'Фото, надпись и фон в урок не включены.'),
    finale=dict(type='striped-fish', tail=[470, 150], stripes=parts),
    palette=list(dict.fromkeys(['black', 'navy']+colours)), steps=steps,
)
(BASE / 'lessons/striped_fish.json').write_text(
    json.dumps(lesson, ensure_ascii=False, indent=2)+'\n')
print(f'Built striped_fish: {len(steps)} steps, {len(stripes)} closed coloured stripes')
