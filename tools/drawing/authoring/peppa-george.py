"""Rebuild the paper lesson from hand-authored curves in the 640×360 video frame.

No video or frame downloads are needed to rebuild. Coordinates follow the wide
shot near 108 seconds; the hand obscures the feet there, so those use 100/200s.
The marker colouring is adapted to the existing gradual pencil renderer.
"""
import json
import re
from pathlib import Path
from geometry import Path as CurvePath, chain, line, at, reverse, length

BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE / 'pencils.json').read_text())
STEPS = []

def svg(d):
    return re.sub(r'-?\d+(?:\.\d+)?', lambda m: f'{float(m[0])*2:g}', d)

def curves(d):
    """Read the native absolute M/L/C/Q/Z authoring paths into cubic curves."""
    tokens = iter(re.findall(r'[MLCQZ]|-?\d+(?:\.\d+)?', d))
    out = []
    def point(): return (float(next(tokens)), float(next(tokens)))
    for command in tokens:
        if command == 'M': current = start = point()
        elif command == 'C':
            a, b, end = point(), point(), point()
            out.append((current, a, b, end)); current = end
        elif command == 'L':
            end = point(); out.append(line(current, end)); current = end
        elif command == 'Q':
            control, end = point(), point()
            a = tuple(current[i]+2*(control[i]-current[i])/3 for i in (0, 1))
            b = tuple(end[i]+2*(control[i]-end[i])/3 for i in (0, 1))
            out.append((current, a, b, end)); current = end
        elif command == 'Z':
            if current != start: out.append(line(current, start))
            current = start
        else: raise ValueError(command)
    return CurvePath(out)

def native(cs):
    # geometry.chain exports at 2×; keep the rest of this author's data native.
    return re.sub(r'-?\d+(?:\.\d+)?', lambda m: f'{float(m[0])/2:.6f}', chain(cs))

def attached(detail, parent):
    """One open stroke joins the existing outline at both ends.

    Its fill closes along that exact existing outline, never an implicit chord
    across an unoutlined gap. The parent is already drawn before the detail.
    """
    child, boundary = curves(detail), curves(parent)
    a = boundary.nearest(child.cs[0][0]); b = boundary.nearest(child.cs[-1][-1])
    child.attach_start(boundary.point(a)); child.attach_end(boundary.point(b))
    return native(child.cs), native(child.cs + boundary.short_arc(b, a)) + ' Z'

def intersections(first, second):
    """Cubic intersections: polyline candidates refined on the actual curves."""
    def cross(a, b): return a[0]*b[1]-a[1]*b[0]
    def sub(a, b): return (a[0]-b[0], a[1]-b[1])
    def tangent(c, t):
        return tuple(3*((1-t)**2*(c[1][k]-c[0][k])+2*(1-t)*t*(c[2][k]-c[1][k])+t*t*(c[3][k]-c[2][k])) for k in (0, 1))
    hits = []
    for i,c in enumerate(first.cs):
        for j,d in enumerate(second.cs):
            for n in range(24):
                p,q=at(c,n/24),at(c,(n+1)/24);v=sub(q,p)
                for m in range(24):
                    r,s=at(d,m/24),at(d,(m+1)/24);w=sub(s,r);den=cross(v,w)
                    if abs(den)<1e-10:continue
                    delta=sub(r,p);a,b=cross(delta,w)/den,cross(delta,v)/den
                    if not (0<=a<=1 and 0<=b<=1):continue
                    t,u=(n+a)/24,(m+b)/24
                    for _ in range(8):
                        delta=sub(at(d,u),at(c,t));v,w=tangent(c,t),tangent(d,u);den=cross(v,w)
                        if abs(den)<1e-12:break
                        t+=cross(delta,w)/den;u+=cross(delta,v)/den
                    if 0<=t<=1 and 0<=u<=1 and not any(abs(i+t-x)<1e-6 and abs(j+u-y)<1e-6 for x,y in hits):
                        hits.append((i+t,j+u))
    return sorted(hits)

def body_behind_leg(outline, fill, leg):
    body, full, foreground = curves(outline), curves(fill), curves(leg)
    hits=intersections(body,foreground)
    if len(hits)!=2:raise ValueError(f'Expected two leg/body junctions, got {hits}')
    (a,u),(b,v)=hits
    strokes=[native(body.sub(0,a)),native(body.sub(b,len(body.cs)))]
    colour=native(full.sub(0,a)+foreground.short_arc(u,v)+full.sub(b,len(full.cs)))+' Z'
    return strokes,colour

def long_arc(path, a, b):
    forward=path.sub(a,b);backward=reverse(path.sub(b,a))
    return forward if length(forward)>length(backward) else backward

def outside_shoe(leg, shoe):
    """Replace the common ankle edge with the shoe's outer silhouette."""
    foot=curves(shoe)
    hits=intersections(leg,foot)
    # Shared endpoints need no intersection solve; all shoes share their ankle
    # with two explicit leg vertices. Find those vertices on the shoe boundary.
    matches=[]
    for i,c in enumerate(leg.cs):
        p=c[0];u=foot.nearest(p)
        if sum((p[k]-foot.point(u)[k])**2 for k in (0,1))<1e-6:matches.append((i,u))
    if len(matches)!=2:raise ValueError(f'Expected two ankle vertices: {matches}; intersections {hits}')
    (a,u),(b,v)=matches
    return leg.sub(0,a)+long_arc(foot,u,v)+leg.sub(b,len(leg.cs))

def ground_george():
    body,head,near,far=curves(g_body),curves(g_head),curves(g_leg1),curves(g_leg2)
    (a,u),(b,v)=intersections(body,near)
    near_outer=CurvePath(long_arc(near,u,v))
    start,end=far.cs[0][0],far.cs[-1][-1]
    c,d=body.nearest(start),body.nearest(end)
    if c>d:far=CurvePath(reverse(far.cs));c,d=d,c
    tail_start=body.nearest(curves(g_tail).cs[0][0]);tail_end=body.nearest(curves(g_tail).cs[-1][-1])
    tail=curves('M 210 308 C 193 298 187 311 192 320 C 186 320 187 326 194 326 C 203 327 211 321 219 313')
    tail.attach_start(body.point(tail_start));tail.attach_end(body.point(tail_end))
    root=head.nearest(body.cs[0][0]);hill=head.nearest((185,260))
    return head.short_arc(hill,root)+body.sub(0,tail_start)+tail.cs+body.sub(tail_end,a)+outside_shoe(near_outer,g_shoe1)+body.sub(b,c)+outside_shoe(far,g_shoe2)+body.sub(d,len(body.cs))

def ground_peppa():
    body=curves(p_body)
    legs=[]
    for d,shoe in [(p_leg1,p_shoe1),(p_leg2,p_shoe2)]:
        leg=curves(d);a=body.nearest(leg.cs[0][0]);b=body.nearest(leg.cs[-1][-1])
        if a>b:leg=CurvePath(reverse(leg.cs));a,b=b,a
        legs.append((a,b,outside_shoe(leg,shoe)))
    out=[];cursor=0
    for a,b,leg in sorted(legs):out+=body.sub(cursor,a)+leg;cursor=b
    # Stop at the lower tail attachment; the remaining right side is above the hill.
    tail=curves(p_tail);end=body.nearest(tail.cs[-1][-1]);start=body.nearest(tail.cs[0][0])
    out+=body.sub(cursor,end)+reverse(tail.cs)
    return out,body.point(start)

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
g_body = 'M 209 279 C 204 291 208 306 219 313 C 237 323 276 316 298 303 C 319 289 331 255 306 232'
g_body_fill = g_body + ' C 307 248 296 262 285 262 C 260 281 230 288 209 279 Z'
g_cheek = oval(212, 241, 16, 17)
g_mouth = 'M 245 232 C 257 228 270 216 274 206 C 288 214 292 234 279 244 C 266 252 251 247 245 232 Z'
g_inner = 'M 253 234 C 265 230 273 222 276 216 C 284 228 279 240 267 241 C 261 242 256 239 253 234 Z'
# Independent closed arms, fitted to the unobscured 110-second wide frame.
# Their fingertips approach each other but never attach to the other hand.
g_arm1 = 'M 308.5 240 C 305.5 239 302.5 248 295.7 266.4 C 291.8 265.2 288.4 269 287.3 271.3 C 286.6 273.8 291.2 274.4 295 273.8 C 292.6 277.7 292.5 281.1 295.4 281.3 C 298.2 281.2 299.4 278.8 300.2 276.8 C 300.6 280.7 305.4 282.1 307.2 279.9 C 309.1 276.1 307.8 272.2 307.3 270.8 C 307.2 264.4 312.1 249 311 242 C 310.8 240.5 309.7 239.8 308.5 240 Z'
g_arm2 = 'M 277.8 281.6 C 268 281.5 256.5 280.6 250 286.9 C 244.9 291.2 248 294.3 253.8 294 L 274.3 294 C 278.3 294 281.5 298.8 285.8 300.7 C 291 302.9 294.2 295.8 289.9 292.1 C 294.6 290.5 295.3 287 293.8 284.5 C 292.7 283.1 290.3 283.8 287.3 284 C 285.8 283.8 287.4 279.2 286.1 277.2 C 283.8 273.7 280.8 278.7 277.8 281.6 Z'
# The near leg has a rounded root on the shirt, like the source. The shoe
# shares the two ankle points, rather than cutting diagonally through the leg.
g_leg1 = 'M 279.8 327.7 C 273.3 321.5 265.5 314.7 263.4 310.1 C 260.3 304.6 263.1 302.5 267.3 305.2 C 272 308.5 280.9 316.8 287 321.9 L 279.8 327.7 Z'
g_leg2 = 'M 307.2 293 L 314 296.5 L 319 290.5 L 312 286'
g_shoe1 = 'M 279.8 327.7 L 287 321.9 C 293.2 317.9 302 314.8 305.2 317.5 C 312.7 320.8 286.6 335.6 281.7 334.4 C 280.4 333.9 279.5 330.8 279.8 327.7 Z'
g_shoe2 = 'M 314 296.5 L 319 290.5 C 324 282 331 276 333 279 C 337 284 325 301 321 303 L 310.5 300.5 Z'
g_tail = 'M 210 308 C 192 299 188 318 199 318 C 211 320 211 304 201 309 C 194 313 202 322 191 322 C 187 332 206 327 219 313'
g_body, g_body_fill = attached(g_body, g_head)
g_ear1, g_ear1_fill = attached(g_ear1, g_head)
g_ear2, g_ear2_fill = attached(g_ear2, g_head)
g_arm1_fill, g_arm2_fill = g_arm1, g_arm2
g_leg1_fill = g_leg1
g_leg2, g_leg2_fill = attached(g_leg2, g_body)
g_tail, g_tail_fill = attached(g_tail, g_body)
g_body_paths, g_body_fill = body_behind_leg(g_body, g_body_fill, g_leg1)
stroke('Голова Джорджа', g_head, 8)
stroke('Пятачок Джорджа', g_nose, 10)
for i, (x,y) in enumerate([(279,144),(273,154)]):
    stroke(f'Контур ноздри Джорджа {i+1}', oval(x,y,1.8,2), 11)
    color(f'Ноздря Джорджа {i+1}', oval(x,y,1.8,2), 'black', 11)
stroke('Первое ушко Джорджа', g_ear1, 13)
stroke('Второе ушко Джорджа', g_ear2, 15)
stroke('Первый зажмуренный глаз', 'M 231 184 C 225 172 237 162 245 171', 17)
stroke('Второй зажмуренный глаз', 'M 212 207 C 204 194 216 185 225 193', 19)
stroke('Щёчка Джорджа', g_cheek, 21)
stroke('Улыбка Джорджа', g_mouth, 23)
stroke('Внутри улыбки Джорджа', g_inner, 25)
stroke('Туловище Джорджа', g_body_paths[0], 29)
STEPS[-1]['paths'].append(svg(g_body_paths[1]))
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
p_leg1 = 'M 390 309 L 387 314 L 384 323 L 418 314'
p_leg2 = 'M 502 321 L 457 338 L 454 329 L 480 319'
p_shoe1 = 'M 387 314 L 384 323 L 382 323 C 379 310 373 282 377 280 C 385 274 386 305 387 314 Z'
p_shoe2 = 'M 454 329 C 452 316 454 298 447 298 C 434 296 441 333 448 341 C 450 345 455 342 457 338 L 454 329 Z'
p_tail = 'M 570 276 C 579 258 599 260 601 275 C 606 291 587 298 579 290 L 571 289'
p_curl = 'M 579 290 C 573 277 588 270 594 277 C 599 285 587 290 586 282 C 585 279 590 277 592 281'
p_body, p_body_fill = attached(p_body, p_head)
p_ear1, p_ear1_fill = attached(p_ear1, p_head)
p_ear2, p_ear2_fill = attached(p_ear2, p_head)
p_arm1, p_arm1_fill = attached(p_arm1, p_body)
p_leg1, p_leg1_fill = attached(p_leg1, p_body)
p_leg2, p_leg2_fill = attached(p_leg2, p_body)
p_tail, p_tail_fill = attached(p_tail, p_body)
stroke('Голова Пеппы', p_head, 50)
stroke('Пятачок Пеппы', p_nose, 53)
for i,(x,y) in enumerate([(421,49),(435,56)]):
    stroke(f'Контур ноздри Пеппы {i+1}', oval(x,y,2,2.5), 54)
    color(f'Ноздря Пеппы {i+1}', oval(x,y,2,2.5), 'black', 54)
stroke('Первый глаз Пеппы', p_eye1, 58)
stroke('Контур первого зрачка Пеппы', oval(491,63,5,6), 59)
color('Первый зрачок Пеппы', oval(491,63,5,6), 'black', 59)
stroke('Второй глаз Пеппы', p_eye2, 61)
stroke('Контур второго зрачка Пеппы', oval(527,81,5,6), 62)
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
stroke('Хвостик Пеппы', p_tail, 103)
stroke('Завиток хвостика Пеппы', p_curl, 103)
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
    ('Первое ушко Джорджа',g_ear1_fill,118),('Второе ушко Джорджа',g_ear2_fill,119),
    ('Ручка Джорджа',g_arm1_fill,124),('Вторая ручка Джорджа',g_arm2_fill,125),
    ('Первая ножка Джорджа',g_leg1_fill,127),('Вторая ножка Джорджа',g_leg2_fill,128),
    ('Хвостик Джорджа',g_tail_fill,129),
    ('Первое ушко Пеппы',p_ear1_fill,157),('Второе ушко Пеппы',p_ear2_fill,158),
    ('Ручка Пеппы',p_arm1_fill,162),('Вторая ручка Пеппы',p_arm2,163),
    ('Первая ножка Пеппы',p_leg1_fill,165),('Вторая ножка Пеппы',p_leg2_fill,166),
    ('Хвостик Пеппы',p_tail_fill,167),
]:
    color('Розовый цвет: '+title,d,'pink',time)
color('Розовая улыбка Джорджа', g_inner, 'pink', 131)
color('Фиолетовая щёчка Джорджа', g_cheek, 'purple',133)
color('Фиолетовая щёчка Пеппы', p_cheek, 'purple',173)
# Arms are holes in the clothing regions, keeping the shared boundaries intact.
color('Голубая одежда Джорджа',g_body_fill+' '+g_arm1_fill+' '+g_arm2_fill,'light_blue',140)
STEPS[-1]['clip'] = svg(g_body_fill)
color('Красная улыбка Пеппы',p_inner,'red',177)
color('Красное платье Пеппы',p_body_fill+' '+p_arm2+' '+p_shoe2,'red',187)
STEPS[-1]['clip'] = svg(p_body_fill)
# Reuse the actual feet and lower body boundaries in the hill, so moving a
# foot cannot leave a white footprint or paint grass through an ankle.
george=ground_george();peppa,tail_tip=ground_peppa()
left=curves(f'M 137 282 Q 159 268 {george[0][0][0]} {george[0][0][1]}')
middle=curves(f'M {george[-1][-1][0]} {george[-1][-1][1]} Q 355 218 409 229')
# The upper left dress is behind the raised hand; join the hill to its exact
# curve at y≈229, then follow only the visible lower silhouette.
# ground_peppa starts at the neck; omit its initial curve above the hill.
peppa_path=CurvePath(peppa);entry=peppa_path.nearest((409,229))
peppa=peppa_path.sub(entry,len(peppa_path.cs));middle.attach_end(peppa[0][0])
right=curves(f'M {tail_tip[0]} {tail_tip[1]} Q 623 287 637 301 L 637 358 L 137 358 L 137 282')
grass=native(left.cs+george+middle.cs+peppa+right.cs)+' Z'
color('Зелёная горка',grass+' '+p_shoe2,'green',198)
STEPS[-1]['clip']=svg(grass)

lesson = dict(id='peppa_george',title='Пеппа и Джордж',viewBox='260 10 1030 710',progressRevision=3,
    source=dict(title='Super Easy Drawings — Пеппа и Джордж',
        url='https://drive.google.com/file/d/1TXjRL5uiFjGpBmAIo9WXDKnmgehVs-tT/view',
        durationSeconds=210.048,referenceFrameSeconds=110,
        note='Ручная реконструкция по кадрам видео. sourceTime приблизительный. Маркерная раскраска адаптирована к карандашной; цвета сгруппированы. Логотип и фломастеры вне рисунка не включены.'),
    palette=['black','pink','purple','light_blue','red','green'],steps=STEPS)
(BASE/'lessons/peppa_george.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n')
print(len(STEPS),'steps')
