"""Rebuild the paper lesson from hand-authored curves in the 640×360 video frame.

No video or frame downloads are needed to rebuild. Coordinates follow the wide
shot near 108 seconds; the hand obscures the feet there, so those use 100/200s.
The marker colouring is adapted to the existing gradual pencil renderer.
"""
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE / 'pencils.json').read_text())
STEPS = []

def svg(d):
    return re.sub(r'-?\d+(?:\.\d+)?', lambda m: f'{float(m[0])*2:g}', d)

def stroke(title, d, time):
    STEPS.append(dict(kind='stroke', title=title, paths=[svg(d)], tool='black', sourceTime=time))

def color(title, d, tool, time):
    STEPS.append(dict(kind='color', title=title, d=svg(d), tool=tool,
                      fill=PENCILS[tool]['color'], sourceTime=time))

def oval(x, y, rx, ry):
    k = .55228475
    return (f'M {x-rx} {y} C {x-rx} {y-k*ry} {x-k*rx} {y-ry} {x} {y-ry} '
            f'C {x+k*rx} {y-ry} {x+rx} {y-k*ry} {x+rx} {y} '
            f'C {x+rx} {y+k*ry} {x+k*rx} {y+ry} {x} {y+ry} '
            f'C {x-k*rx} {y+ry} {x-rx} {y+k*ry} {x-rx} {y} Z')

g_head = 'M 271 128 C 245 129 204 160 187 187 C 168 216 176 254 199 273 C 220 292 262 280 285 262 C 309 244 302 211 286 192 C 297 184 305 166 299 151 C 294 137 282 127 271 128 Z'
g_nose = 'M 261 130 C 251 145 263 170 283 174 C 292 177 299 171 301 164'
g_ear1 = 'M 204 166 C 188 140 170 150 188 176'
g_ear2 = 'M 181 204 C 149 191 155 166 173 180 L 187 187'
g_body = 'M 209 279 C 204 291 208 306 219 313 C 244 326 284 315 308 298 C 328 283 328 251 306 232'
g_body_fill = g_body + ' C 307 248 296 262 285 262 C 260 281 230 288 209 279 Z'
g_cheek = oval(212, 241, 16, 17)
g_mouth = 'M 245 232 C 257 228 270 216 274 206 C 288 214 292 234 279 244 C 266 252 251 247 245 232 Z'
g_inner = 'M 253 234 C 265 230 273 222 276 216 C 284 228 279 240 267 241 C 261 242 256 239 253 234 Z'
g_arm1 = 'M 291 244 L 283 273 C 273 270 273 277 279 280 C 267 280 270 288 279 286 C 278 298 287 298 289 287 C 300 294 302 286 296 281 L 308 250'
g_arm2 = 'M 279 279 L 257 284 C 244 286 245 292 255 292 L 279 290 C 279 299 286 301 289 292 C 300 296 302 289 293 285'
g_leg1 = 'M 265 316 L 286 337 L 294 331 L 274 311'
g_leg2 = 'M 309 293 L 319 299 L 324 290 L 315 286'
g_shoe1 = 'M 286 337 C 297 329 315 321 318 327 C 320 335 296 347 288 345 Z'
g_shoe2 = 'M 319 299 C 324 291 333 278 336 282 C 339 288 329 303 323 307 L 313 303 Z'
g_tail = 'M 210 308 C 192 299 188 318 199 318 C 211 320 211 304 201 309 C 194 313 202 322 191 322 C 187 332 206 327 219 313'
stroke('Голова Джорджа', g_head, 8)
stroke('Пятачок Джорджа', g_nose, 10)
for i, (x,y) in enumerate([(279,144),(273,154)]):
    color(f'Ноздря Джорджа {i+1}', oval(x,y,1.8,2), 'black', 11)
stroke('Первое ушко Джорджа', g_ear1, 13)
stroke('Второе ушко Джорджа', g_ear2, 15)
stroke('Первый зажмуренный глаз', 'M 231 184 C 225 172 237 162 245 171', 17)
stroke('Второй зажмуренный глаз', 'M 212 207 C 204 194 216 185 225 193', 19)
stroke('Щёчка Джорджа', g_cheek, 21)
stroke('Улыбка Джорджа', g_mouth, 23)
stroke('Внутри улыбки Джорджа', g_inner, 25)
stroke('Туловище Джорджа', g_body, 29)
stroke('Поднятая ручка Джорджа', g_arm1, 32)
stroke('Вторая ручка Джорджа', g_arm2, 35)
stroke('Первая ножка Джорджа', g_leg1, 38)
stroke('Вторая ножка Джорджа', g_leg2, 40)
stroke('Первый ботинок Джорджа', g_shoe1, 41)
color('Закрасим первый ботинок Джорджа', g_shoe1, 'black', 41)
stroke('Второй ботинок Джорджа', g_shoe2, 42)
color('Закрасим второй ботинок Джорджа', g_shoe2, 'black', 42)
stroke('Хвостик Джорджа', g_tail, 44)

p_head = 'M 443 24 C 418 30 404 52 403 68 C 402 84 426 105 444 115 C 429 137 423 167 431 191 C 445 222 494 236 529 225 C 564 214 589 186 592 150 C 597 112 575 81 544 62 C 513 43 477 39 443 24 Z'
p_nose = 'M 452 28 C 463 42 446 80 426 83 C 415 86 406 81 403 73'
p_ear1 = 'M 511 48 C 521 11 542 9 550 21 C 556 30 546 43 539 58'
p_ear2 = 'M 553 68 C 569 30 587 33 592 45 C 597 55 584 73 575 83'
p_eye1 = oval(490,64,16,17)
p_eye2 = oval(527,82,16,16)
p_cheek = oval(555,145,25,24)
p_mouth = 'M 452 129 C 470 145 495 153 524 156 C 511 185 487 197 467 186 C 450 178 440 145 452 129 Z'
p_inner = 'M 456 140 C 475 154 496 161 514 163 C 501 183 477 188 465 174 C 458 166 454 151 456 140 Z'
p_body = 'M 435 197 C 404 222 387 266 386 310 L 571 333 C 574 300 572 264 559 214'
p_body_fill = p_body + ' C 552 219 540 223 529 225 C 494 236 452 220 435 197 Z'
p_arm1 = 'M 423 211 L 397 179 C 382 182 381 171 392 170 C 387 157 397 156 400 168 C 404 152 415 158 408 173 L 433 202'
p_arm2 = 'M 550 231 L 590 208 C 591 192 603 194 600 208 C 616 198 623 207 610 215 C 626 218 622 229 608 224 C 605 239 594 234 597 223 L 555 241 C 548 245 544 235 550 231 Z'
p_leg1 = 'M 390 309 L 381 316 L 382 323 L 418 314'
p_leg2 = 'M 477 322 L 459 340 L 452 334 L 463 321'
p_shoe1 = 'M 381 316 C 379 302 373 282 377 280 C 385 274 391 310 390 317 L 382 323 Z'
p_shoe2 = 'M 459 340 C 455 325 452 307 446 307 C 438 310 444 339 450 346 Z'
p_tail = 'M 570 276 C 579 258 599 260 601 275 C 606 291 584 298 583 284 C 583 271 598 272 597 281 C 597 287 588 285 592 281 M 571 289 C 581 294 587 295 592 290'
stroke('Голова Пеппы', p_head, 50)
stroke('Пятачок Пеппы', p_nose, 53)
for i,(x,y) in enumerate([(421,49),(435,56)]):
    color(f'Ноздря Пеппы {i+1}', oval(x,y,2,2.5), 'black', 54)
stroke('Первый глаз Пеппы', p_eye1, 58)
color('Первый зрачок Пеппы', oval(491,63,5,6), 'black', 59)
stroke('Второй глаз Пеппы', p_eye2, 61)
color('Второй зрачок Пеппы', oval(527,81,5,6), 'black', 62)
stroke('Первое ушко Пеппы', p_ear1, 65)
stroke('Второе ушко Пеппы', p_ear2, 67)
stroke('Щёчка Пеппы', p_cheek, 70)
stroke('Улыбка Пеппы', p_mouth, 73)
stroke('Внутри улыбки Пеппы', p_inner, 76)
stroke('Платье Пеппы', p_body, 81)
stroke('Поднятая ручка Пеппы', p_arm1, 86)
stroke('Вторая ручка Пеппы', p_arm2, 90)
stroke('Первая ножка Пеппы', p_leg1, 94)
stroke('Вторая ножка Пеппы', p_leg2, 97)
stroke('Первый ботинок Пеппы', p_shoe1, 99)
color('Закрасим первый ботинок Пеппы', p_shoe1, 'black', 99)
stroke('Второй ботинок Пеппы', p_shoe2, 100)
color('Закрасим второй ботинок Пеппы', p_shoe2, 'black', 100)
for d in p_tail.split(' M '):
    stroke('Хвостик Пеппы', d if d.startswith('M ') else 'M '+d, 103)
stroke('Горка слева', 'M 137 282 Q 159 268 185 260', 108)
stroke('Горка между героями', 'M 306 232 Q 355 218 409 229', 109)
stroke('Горка справа', 'M 601 276 Q 623 287 637 301', 110)
# Black mouth borders remain hollow until the later red/pink colouring.
color('Тёмная кайма улыбки Джорджа', g_mouth+' '+g_inner, 'black', 25)
color('Тёмная кайма улыбки Пеппы', p_mouth+' '+p_inner, 'black', 76)
for who,head,cheek,mouth,eyes,time in [
    ('Джорджа',g_head,g_cheek,g_mouth,'',116),
    ('Пеппы',p_head,p_cheek,p_mouth,p_eye1+' '+p_eye2,153),
]:
    color('Розовая голова '+who, head+' '+cheek+' '+mouth+' '+eyes, 'pink',time)
for title,d,time in [
    ('Первое ушко Джорджа',g_ear1+' Z',118),('Второе ушко Джорджа',g_ear2+' Z',119),
    ('Ручка Джорджа',g_arm1+' Z',124),('Вторая ручка Джорджа',g_arm2+' Z',125),
    ('Первая ножка Джорджа',g_leg1+' Z',127),('Вторая ножка Джорджа',g_leg2+' Z',128),
    ('Хвостик Джорджа',g_tail+' Z',129),
    ('Первое ушко Пеппы',p_ear1+' Z',157),('Второе ушко Пеппы',p_ear2+' Z',158),
    ('Ручка Пеппы',p_arm1+' Z',162),('Вторая ручка Пеппы',p_arm2,163),
    ('Первая ножка Пеппы',p_leg1+' Z',165),('Вторая ножка Пеппы',p_leg2+' Z',166),
    ('Хвостик Пеппы','M 570 276 C 579 258 599 260 601 275 C 606 291 584 298 583 284 L 571 289 Z',167),
]:
    color('Розовый цвет: '+title,d,'pink',time)
color('Розовая улыбка Джорджа', g_inner, 'pink', 131)
color('Фиолетовая щёчка Джорджа', g_cheek, 'purple',133)
color('Фиолетовая щёчка Пеппы', p_cheek, 'purple',173)
# Arms are holes in the clothing regions, keeping the shared boundaries intact.
color('Голубая одежда Джорджа',g_body_fill+' '+g_arm1+' Z '+g_arm2+' Z','light_blue',140)
STEPS[-1]['clip'] = svg(g_body_fill)
color('Красная улыбка Пеппы',p_inner,'red',177)
color('Красное платье Пеппы',p_body_fill+' '+p_arm2,'red',187)
STEPS[-1]['clip'] = svg(p_body_fill)
# Explicit foreground boundary avoids green showing through the figures.
grass = ('M 137 282 Q 159 268 185 260 C 192 269 199 275 209 279 '
         'C 204 291 208 302 210 305 C 193 299 188 318 199 318 '
         'C 194 322 188 321 191 325 C 195 330 208 324 219 313 '
         'Q 241 323 265 316 L 286 337 L 288 345 C 296 347 320 335 318 327 '
         'C 315 321 303 326 294 331 L 282 319 Q 298 312 313 303 '
         'L 323 307 C 329 303 339 288 336 282 C 333 278 324 291 319 299 '
         'L 309 293 Q 336 261 306 232 Q 355 218 409 229 '
         'Q 389 268 386 310 L 390 317 C 391 310 385 274 377 280 '
         'C 373 282 379 302 381 316 L 382 323 L 418 314 L 445 317 '
         'C 441 313 440 322 450 346 L 459 340 L 477 322 L 571 333 '
         'L 571 289 Q 583 297 592 290 C 603 292 605 283 601 276 '
         'Q 623 287 637 301 L 637 358 L 137 358 Z')
color('Зелёная горка',grass,'green',198)

lesson = dict(id='peppa_george',title='Пеппа и Джордж',viewBox='260 10 1030 710',
    source=dict(title='Super Easy Drawings — Пеппа и Джордж',
        url='https://drive.google.com/file/d/1TXjRL5uiFjGpBmAIo9WXDKnmgehVs-tT/view',
        durationSeconds=210.048,referenceFrameSeconds=108,
        note='Ручная реконструкция по кадрам видео. sourceTime приблизительный. Маркерная раскраска адаптирована к карандашной; цвета сгруппированы. Логотип и фломастеры вне рисунка не включены.'),
    palette=['black','pink','purple','light_blue','red','green'],steps=STEPS)
(BASE/'lessons/peppa_george.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n')
print(len(STEPS),'steps')
