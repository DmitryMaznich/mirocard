"""A simple yellow house from the owner's 2026-11-25 video.

Native frame coordinates are exported at 2×. Shared corners define the walls,
roof, gable, window and door cutouts. The smoke is one continuous pencil line.
"""
import json
import math
import re
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE/'pencils.json').read_text())
STEPS = []

def d(raw):
    # Only absolute M/L/C/Q/Z commands, so every number is a coordinate.
    return re.sub(r'-?\d+(?:\.\d+)?', lambda m: f'{float(m[0])*2:g}', raw)

def stroke(title, paths, part, time=None, tool='black', background=False):
    STEPS.append(dict(kind='stroke', title=title, paths=paths, tool=tool, part=part,
                      **({'sourceTime': time} if time is not None else {}),
                      **({'background': True} if background else {})))

def colour(title, shape, tool, part, background=False):
    STEPS.append(dict(kind='color', title=title, d=shape, fill=PENCILS[tool]['color'], tool=tool, part=part,
                      **({'background': True} if background else {})))

# One rectangle and one vertical line establish the two visible walls.
left_wall = d('M 218 125 L 306 125 L 306 225 L 218 225 Z')
front_wall = d('M 306 125 L 374 125 L 374 225 L 306 225 Z')
roof = d('M 218 125 L 254 78 L 337 78 L 306 125 Z')
gable = d('M 306 125 L 337 78 L 374 125 Z')
chimney = d('M 288 58 L 308 58 L 308 78 L 288 78 Z')
window = d('M 241 152 L 276 152 L 276 191 L 241 191 Z')
attic = d('M 331 102 L 344 100 L 344 114 L 331 115 Z')
door = d('M 326 151 L 362 148 L 362 225 L 326 225 Z')

stroke('Четыре стены домика одним контуром', [d('M 218 125 L 218 225 L 374 225 L 374 125 Z')], 'walls', 35)
stroke('Вертикальный угол — делим дом на две стороны', [d('M 306 125 L 306 225')], 'house-corner', 47)
stroke('Треугольная передняя часть крыши', [d('M 306 125 L 337 78 L 374 125')], 'gable', 54)
stroke('Большой скат крыши — от стены до конька', [d('M 218 125 L 254 78 L 337 78')], 'roof', 64)
stroke('Труба на крыше', [d('M 288 78 L 288 58 L 308 58 L 308 78')], 'chimney', 72)
stroke('Короткая линия на трубе', [d('M 298 58 L 298 78')], 'chimney-corner', 74)
stroke('Дверь целиком — от земли до земли', [d('M 326 225 L 326 151 L 362 148 L 362 225')], 'door', 85)
stroke('Дверная ручка', [d('M 332 184 L 337 184 L 337 202 L 332 202')], 'door-handle', 91)
stroke('Большое квадратное окно', [window], 'window-side', 97)
stroke('Две линии делят окно на четыре стёклышка', [d('M 258.5 152 L 258.5 191'), d('M 241 171.5 L 276 171.5')], 'window-cross', 103)
stroke('Маленькое окошко под крышей', [attic], 'window-attic', 110)
# Interpolate both ends on the actual roof edges: ribs can never overshoot.
ribs = [d(f'M {254+83*f:g} 78 L {218+88*f:g} 125') for f in [.27, .54, .78]]
stroke('Три длинные линии на скате крыши', ribs, 'roof-ribs', 116)
left_ground = 'M 150 233 Q 182 225 218 225'
right_ground = 'M 374 225 Q 393 225 414 233'
stroke('Земля по обе стороны домика', [d(left_ground), d(right_ground)], 'ground', 124, background=True)

colour('Жёлтая большая стена — окошко остаётся чистым', left_wall+' '+window, 'yellow', 'wall-side')
colour('Жёлтая стена у входа — дверь остаётся чистой', front_wall+' '+door, 'yellow', 'wall-front')
colour('Голубые стёкла в двух окнах', window+' '+attic, 'light_blue', 'windows')
STEPS[-1]['regions'] = [dict(d=window, part='window-side'), dict(d=attic, part='window-attic')]
colour('Красная крыша', roof, 'red', 'roof')
colour('Светло-коричневая дверь', door, 'tan', 'door')
colour('Серая часть под крышей — окошко остаётся голубым', gable+' '+attic, 'gray', 'gable')
colour('Серая труба', chimney, 'gray', 'chimney')

# Five loose curls form one unbroken line. Cubic Hermite segments preserve
# smooth tangents even where the smoke doubles back to make each curl.
def smoke_point(t):
    return 298-4*t+9*math.sin(t), 51+7*math.cos(t)
def smoke_tangent(t):
    return -4+9*math.cos(t), -7*math.sin(t)
smoke = 'M 298 58'
segments = 60
for i in range(segments):
    a, b = i*10*math.pi/segments, (i+1)*10*math.pi/segments
    pa, pb = smoke_point(a), smoke_point(b)
    va, vb = smoke_tangent(a), smoke_tangent(b)
    c1 = [pa[j]+va[j]*(b-a)/3 for j in (0, 1)]
    c2 = [pb[j]-vb[j]*(b-a)/3 for j in (0, 1)]
    smoke += f' C {c1[0]:.5f} {c1[1]:.5f} {c2[0]:.5f} {c2[1]:.5f} {pb[0]:.5f} {pb[1]:.5f}'
stroke('Дым из трубы — пять завитков одним движением', [d(smoke)], 'smoke', 294, tool='gray', background=True)
lawn = d(left_ground+' L 374 225 '+right_ground.replace('M 374 225 ', '')+' L 414 259 Q 282 266 150 257 Z')
colour('Зелёная лужайка под домиком', lawn, 'green', 'lawn', background=True)

lesson = dict(id='yellow_house', title='Домик с красной крышей', viewBox='280 60 580 500', paperOrientation='landscape',
              finale=dict(type='house-evening', smoke=dict(part='smoke', origin=[596, 116], helix=dict(pitch=8, radiusX=18, radiusY=14, turns=5)), windows=['window-side', 'window-attic']),
              palette=['black', 'yellow', 'light_blue', 'red', 'tan', 'gray', 'green'], steps=STEPS,
              source=dict(title='РыбаКит — Как рисовать Дом. Урок рисования для детей от 3 лет',
                          url='https://drive.google.com/file/d/1zx5AGqAkM-AdbfACCRz8BJs0ohQ4DZHR/view',
                          durationSeconds=308.779, referenceFrameSeconds=296,
                          note='Ручная учебная адаптация видео владельца. Крупные контуры и общие границы, окна и дверь не закрашиваются цветом стены. Дым — одна линия, две голубые области — один шаг. Небо оставлено белым.'))
(BASE/'lessons/yellow_house.json').write_text(json.dumps(lesson, ensure_ascii=False, indent=2)+'\n')
print(f'Built yellow house: {len(STEPS)} steps')
