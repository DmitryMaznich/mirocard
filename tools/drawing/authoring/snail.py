"""Rebuild the snail lesson from fitted 640×360 source-frame curves.

Only Python's standard library is needed. The canonical curves, rather than
separately sketched colour boundaries, define the shell/body/eye junctions.
"""
import json
import math
from pathlib import Path as FilePath
from geometry import Path, chain, line, reverse, oval, at

BASE=FilePath(__file__).resolve().parents[1]
REF=json.loads((BASE/'authoring/snail-reference.json').read_text())['curves']
PENCILS=json.loads((BASE/'pencils.json').read_text())
STEPS=[]
def ref(name):return Path(REF[name])
def region(cs):return chain(cs)+' Z'
def stroke(title,paths,time,tool='black',**extra):
    STEPS.append(dict(kind='stroke',title=title,paths=paths if isinstance(paths,list) else [paths],sourceTime=time,tool=tool,**extra))
def color(title,d,tool,time,**extra):
    STEPS.append(dict(kind='color',title=title,d=d,tool=tool,fill=PENCILS[tool]['color'],sourceTime=time,**extra))
def polygon(points):return region([line(a,b) for a,b in zip(points,points[1:]+points[:1])])

shell=ref('shell');shell_d=shell.d(True)
stroke('Левая дуга раковины',chain(shell.cs[:4]),15)
stroke('Правая дуга раковины',chain(shell.cs[4:]),24)

tail=ref('tail');lower=ref('lower_body');head=ref('head')
left=shell.nearest(tail.cs[0][0]);bottom=shell.nearest(lower.cs[0][0]);right=shell.nearest(head.cs[-1][-1])
tail.attach_start(shell.point(left));tail.attach_end(shell.point(bottom))
lower.attach_start(shell.point(bottom));head.attach_end(shell.point(right))
joint=tuple((lower.cs[-1][-1][i]+head.cs[0][0][i])/2 for i in (0,1))
lower.attach_end(joint);head.attach_start(joint)
tail_d=region(tail.cs+shell.short_arc(bottom,left))
body_d=region(lower.cs+head.cs+shell.short_arc(right,bottom))
stroke('Заострённый хвостик',chain(tail.cs[:2]),31)
stroke('Нижняя линия тела',[chain(tail.cs[2:]),lower.d()],35)
stroke('Округлая голова и шея',head.d(),39)

eyes=[];stalks=[];irises=[]
for side,title,time in [('left','Левый',44),('right','Правый',47)]:
    eye=ref('eye_'+side);iris=ref('iris_'+side)
    eyes.append(eye.d(True));irises.append(iris.d(True))
    stroke(title+' глазок',eye.d(True),time)
    stroke(title+' зрачок',iris.d(True),time+2)
    stalk_l,stalk_r=ref('stem_'+side+'_l'),ref('stem_'+side+'_r')
    if side=='right':
        stalk_l=Path(reverse(stalk_l.cs));stalk_r=Path(reverse(stalk_r.cs))
    a,b=eye.nearest(stalk_l.cs[0][0]),eye.nearest(stalk_r.cs[0][0])
    c,d=head.nearest(stalk_l.cs[-1][-1]),head.nearest(stalk_r.cs[-1][-1])
    stalk_l.attach_start(eye.point(a));stalk_r.attach_start(eye.point(b))
    stalk_l.attach_end(head.point(c));stalk_r.attach_end(head.point(d))
    stalks.append(region(stalk_l.cs+head.short_arc(c,d)+reverse(stalk_r.cs)+eye.short_arc(b,a)))
    stroke(title+' стебелёк — первая линия',stalk_l.d(),52)
    stroke(title+' стебелёк — вторая линия',stalk_r.d(),54)
    # The source has white reflections within each black pupil, no extra rings.
    cx,cy=(403.2,136.2) if side=='left' else (445.3,145.7)
    highlights=region(oval(cx+1,cy+1.7,1.15,2.1))+' '+region(oval(cx+.3,cy-3.4,1.1,.75))
    color('Чёрный зрачок с бликами: '+title.lower(),iris.d(True)+' '+highlights,'black',time+3,clip=iris.d(True))
stroke('Улыбка улитки',ref('smile').d(),59)

spiral=ref('spiral');spiral.attach_start(shell.point(shell.nearest(spiral.cs[0][0])))
stroke('Большой виток спирали',chain(spiral.cs[:2]),68)
stroke('Средний виток спирали',chain(spiral.cs[2:5]),76)
stroke('Маленький завиток в центре',chain(spiral.cs[5:]),83)
color('Розовая основа раковины',shell_d,'pink',100)

# Soft shadows and thin radial pastel marks follow the original shell pattern.
centre=(308,180)
inner=[tuple(tuple(centre[k]+(p[k]-centre[k])*.915 for k in (0,1)) for p in c) for c in shell.cs]
color('Фиолетовый край раковины',shell_d+' '+region(inner),'purple',128,clip=shell_d)
samples=[]
for i,c in enumerate(spiral.cs):
    for j in range(13):
        t=j/13;p=at(c,t)
        dx=3*((1-t)**2*(c[1][0]-c[0][0])+2*(1-t)*t*(c[2][0]-c[1][0])+t*t*(c[3][0]-c[2][0]))
        dy=3*((1-t)**2*(c[1][1]-c[0][1])+2*(1-t)*t*(c[2][1]-c[1][1])+t*t*(c[3][1]-c[2][1]))
        norm=max(math.hypot(dx,dy),1e-6);u=(i+t)/len(spiral.cs)
        width=(2.5+3.5*(1-u))*math.sin(math.pi*min(1,u*7))
        samples.append((p[0]-dy/norm*width,p[1]+dx/norm*width))
samples.append(spiral.cs[-1][-1])
band=region([line(a,b) for a,b in zip(samples,samples[1:])]+reverse(spiral.cs))
color('Тень вдоль спирали',band,'purple',138,clip=shell_d)

# Intersect outward rays with the actual next spiral turn or shell boundary.
# Hatching stops before the next black line, including the tight inner curl.
edges=[]
for path in (shell,spiral):
    for c in path.cs:
        ps=[at(c,j/40) for j in range(41)]
        edges.extend(zip(ps,ps[1:]))
def cross(a,b):return a[0]*b[1]-a[1]*b[0]
rays=[];origin=(299,189)
for i in range(38):
    u=.16+i*6.35/37;c=spiral.cs[min(int(u),len(spiral.cs)-1)];q=at(c,u-int(u))
    v=(q[0]-origin[0],q[1]-origin[1]);size=math.hypot(*v)
    if size<4:continue
    v=(v[0]/size,v[1]/size);hits=[]
    for a,b in edges:
        w=(b[0]-a[0],b[1]-a[1]);delta=(a[0]-q[0],a[1]-q[1]);den=cross(v,w)
        if abs(den)<1e-9:continue
        distance=cross(delta,w)/den;t=cross(delta,v)/den
        if distance>1.5 and 0<=t<=1:hits.append(distance)
    if not hits or min(hits)<7:continue
    distance=min(hits);a=(q[0]+v[0]*2.1,q[1]+v[1]*2.1);b=(q[0]+v[0]*(distance-2.4),q[1]+v[1]*(distance-2.4))
    dx,dy=b[0]-a[0],b[1]-a[1]
    rays.append(chain([(a,(a[0]+dx*.30-dy*.12,a[1]+dy*.30+dx*.12),(a[0]+dx*.67-dy*.08,a[1]+dy*.67+dx*.08),b)]))
for i in range(0,len(rays),3):stroke(f'Фиолетовые лучики раковины {i//3+1}',rays[i:i+3],145+i/3,tool='purple',reference=False)

color('Жёлтый хвостик',tail_d,'yellow',169)
color('Жёлтое тело и голова',body_d,'yellow',178)
for i,d in enumerate(stalks):color(f'Жёлтый стебелёк {i+1}',d,'yellow',185+i)
for i,d in enumerate(eyes):color(f'Жёлтая окантовка глазка {i+1}',d+' '+irises[i],'yellow',188+i,clip=d)

shade_return=[(joint,(423,190),(415,203),(405,214)),((405,214),(381,233),(346,240),shell.point(bottom))]
color('Зелёная тень на теле',region(lower.cs+shade_return),'green',204,clip=body_d)
tail_return=[(shell.point(bottom),(280,247),(247,242),tail.cs[0][0])]
color('Зелёная тень на хвостике',region(tail.cs+tail_return),'green',207,clip=tail_d)

slime=[((232,250),(223,247),(218,253),(206,252)),((206,252),(192,250),(184,251),(181,255)),
    ((181,255),(190,257),(203,253),(213,256)),((213,256),(225,263),(235,251),(243,256)),
    ((243,256),(250,264),(260,254),(267,259)),((267,259),(278,268),(286,252),(294,257)),
    ((294,257),(307,260),(310,252),(321,256)),((321,256),(334,261),(339,252),(350,256)),
    ((350,256),(362,259),(370,252),(380,254)),((380,254),(390,256),(403,252),(397,248)),
    ((397,248),(386,245),(366,250),(349,249)),((349,249),(326,249),(314,251),(301,251)),
    ((301,251),(278,251),(252,249),(232,250))]
slime_d=region(slime)
stroke('Зелёный контур следа',chain(slime)+' Z',217,tool='green',reference=False)
hole=region(oval(284,254,47,1.8))+' '+region(oval(367,251,23,1.5))
color('Зелёный след под улиткой',slime_d+' '+hole,'green',220,clip=slime_d)
drops=[(163,254,6.8,1.6),(181,269,4.7,1.5),(213,267,5.0,2.4),(250,270,6.7,1.8),(393,262,6.5,1.6),(421,245,6.8,2.1)]
for group in range(2):
    ds=[region(oval(*p)) for p in drops[group*3:group*3+3]]
    stroke(f'Зелёные капельки {group+1}',ds,226+group,tool='green',reference=False)
    color(f'Раскрасим капельки {group+1}',' '.join(ds),'green',228+group)
stroke('Голубые штрихи на следе слева',[
    chain([((181,255),(194,253),(201,254),(208,254))]),
    chain([((223,258),(230,258),(236,252),(243,255))])],236,tool='blue',reference=False)
stroke('Голубые штрихи на следе справа',[
    chain([((320,255),(329,259),(340,252),(351,255))]),
    chain([((370,254),(381,255),(391,254),(397,250))])],240,tool='blue',reference=False)

lesson=dict(id='snail',title='Улитка',viewBox='298 192 640 372',
    source=dict(title='РыбаКит — Рисуем УЛИТКУ масляной пастелью',
        url='https://drive.google.com/file/d/1QfPhIZi4nFFKpKyG28rTtL4pIjWhMzSx/view',
        durationSeconds=253.028,referenceFrameSeconds=82,
        note='Контуры восстановлены по независимому кадру 640×360. Пастельная раскраска адаптирована к карандашной: розовая основа, фиолетовые тени и лучики, жёлтое тело, зелёные тени и след, голубые штрихи. Порядок сгруппирован по карандашам, sourceTime приблизительный.'),
    palette=['black','pink','purple','yellow','green','blue'],steps=STEPS)
(BASE/'lessons/snail.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n')
print(len(STEPS),'steps;',len(rays),'shell rays')
