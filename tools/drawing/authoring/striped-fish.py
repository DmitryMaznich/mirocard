"""Rebuild the graphic fish from the owner's photo; standard library only.

Thirteen single top-to-bottom strokes, not outlined narrow rectangles.
Coordinates are an adaptation of the large dark fish, not a pixel tracing.
"""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
INK = json.loads((BASE / 'pencils.json').read_text())['navy']['color']
head = 'M 75 150 L 175 105 L 175 195 Z'
eye = 'M 139 135 A 4 4 0 1 0 131 135 A 4 4 0 1 0 139 135 Z'
neck = 'M 445 138 L 469 150 L 445 162 Z'
tail = 'M 470 150 L 525 105 L 515 150 L 525 195 Z'
heights = [98, 108, 116, 122, 126, 124, 116, 104, 90, 76, 62, 48, 34]
stripes = [f'M {188 + i*20} {150-h/2:g} L {188 + i*20} {150+h/2:g}'
           for i, h in enumerate(heights)]
steps = [
    dict(kind='stroke', title='Треугольная голова и маленький глаз',
         paths=[head, eye], tool='black', part='head'),
    dict(kind='stroke', title='Маленький треугольник и раздвоенный хвост',
         paths=[neck, tail], tool='black', part='tail'),
    dict(kind='color', title='Тёмно-синяя голова: глаз оставляем белым',
         d=head+' '+eye, fill=INK, tool='navy', part='head'),
    dict(kind='color', title='Тёмно-синий хвост',
         d=neck+' '+tail, fill=INK, tool='navy', part='tail'),
]
for first, end, title in [(0, 4, 'Первые четыре полоски — всё длиннее'),
                          (4, 9, 'Пять средних полосок — начинаем укорачивать'),
                          (9, 13, 'Последние четыре полоски — к хвосту')]:
    steps.append(dict(kind='stroke', title=title, paths=stripes[first:end],
                      tool='navy', part='stripes'))
lesson = dict(
    id='striped_fish', title='Полосатая рыбка', viewBox='0 0 600 300',
    paperOrientation='landscape',
    source=dict(title='Графическая рыбка с фотографии владельца',
                origin='Фото предоставлено владельцем приложения 2026-11-25.',
                note='Крупная тёмная рыбка справа: 13 вертикальных линий тела, '
                     'треугольная голова с белым глазом и раздвоенный хвост. '
                     'Пропорции адаптированы для детского рисунка. '
                     'Фото, надпись и фон в урок не включены.'),
    finale=dict(type='striped-fish', tail=[470, 150]),
    palette=['black', 'navy'], steps=steps,
)
(BASE / 'lessons/striped_fish.json').write_text(
    json.dumps(lesson, ensure_ascii=False, indent=2)+'\n')
print(f'Built striped_fish: {len(steps)} steps, {len(stripes)} body strokes')
