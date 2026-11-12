"""Parrot from the owner's 640×360 video. Shared Bezier boundaries, no raster tracing.

Run with Python's standard library. Coordinates match the reference frames;
export at 2× so line weight and pencil texture match the existing lessons.
"""
import json
from pathlib import Path
BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE / 'pencils.json').read_text())
STEPS = []
def pt(p): return f'{p[0]*2:.6f} {p[1]*2:.6f}'
def move(p): return 'M ' + pt(p)
def curve(c): return ' C ' + ' '.join(pt(p) for p in c[1:])
def chain(cs): return move(cs[0][0]) + ''.join(curve(c) for c in cs)
def reverse(c): return tuple(reversed(c))
def line(a,b): return (a,a,b,b)
def split(c,t):
    def mix(a,b): return tuple(x+(y-x)*t for x,y in zip(a,b))
    a,b,d = [mix(c[i],c[i+1]) for i in range(3)]
    e,f = mix(a,b),mix(b,d); g=mix(e,f)
    return (c[0],a,e,g),(g,f,d,c[3])
def section(c,a,b): return split(split(c,b)[0],a/b)[1] if a else split(c,b)[0]
def at(c,t): return split(c,t)[0][3]
def oval(x,y,rx,ry):
    k=.55228475
    return chain([((x-rx,y),(x-rx,y-k*ry),(x-k*rx,y-ry),(x,y-ry)),((x,y-ry),(x+k*rx,y-ry),(x+rx,y-k*ry),(x+rx,y)),((x+rx,y),(x+rx,y+k*ry),(x+k*rx,y+ry),(x,y+ry)),((x,y+ry),(x-k*rx,y+ry),(x-rx,y+k*ry),(x-rx,y))])+' Z'
def stroke(title,paths,time,tool='black'):
    STEPS.append(dict(kind='stroke',title=title,paths=paths if isinstance(paths,list) else [paths],tool=tool,sourceTime=time))
def color(title,d,tool,time,**kwargs):
    STEPS.append(dict(kind='color',title=title,d=d,tool=tool,fill=PENCILS[tool]['color'],sourceTime=time,**kwargs))

# One diagonal back, a gently rounded crown, and the exposed forehead.
T,H,F=(201,286),(359,106),(429,132)
back=line(T,H)
crown=(H,(389,72),(443,89),F)
# The cere and beak supply the right silhouette between F and B.
B=(413,157)
breast=(B,(404,216),(364,254),(248,246))
body=chain([back,crown,line(F,B),breast,line(breast[3],T)])+' Z'
stroke('Спинка и округлая голова',chain([back,crown]),26)
eye=oval(380,122,5.1,6.4)
stroke('Глаз',eye,36)
color('Чёрный зрачок с белым бликом',oval(380.6,122.5,3.2,4.3)+' '+oval(379.8,120.8,1.2,1.5),'black',36)
cere_curves=[(F,(420,121),(407,123),(404,135)),((404,135),(402,145),(406,153),B)]
cere=chain(cere_curves)+curve(line(B,F))+' Z'
stroke('Дужка над клювом',chain(cere_curves),44)
beak_curves=[(F,(434,141),(425,152),(424,161)),((424,161),(417,158),(410,154),(406,148)),((406,148),(403,141),(408,133),(416,135)),((416,135),(423,135),(428,138),(429,144))]
beak=chain(beak_curves[:3])+curve(((416,135),(422,134),(426,134),F))+' Z'
stroke('Загнутый клюв',chain(beak_curves),49)

# Wing root is a point on the back, with no closing line across the feathers.
W=at(back,.888)
wing_curves=[(W,(361,131),(377,145),(370,168)),((370,168),(364,202),(332,216),(260,216)),((260,216),(250,217),(241,214),(246,211))]
wing_visible=chain(wing_curves)
wing=wing_visible+curve(line(wing_curves[-1][3],W))+' Z'
stroke('Большая дуга крыла',wing_visible,64)
stroke('Грудка и животик',chain([breast]),76)
# Tail closes exactly at the body's lower-left point and the original back tip.
tail=(breast[3],(238,264),(216,282),T)
stroke('Длинный хвост',chain([tail]),84)
tail_region=chain([tail,line(T,breast[3])])+' Z'

# Each foot is a single step containing its three short gripping toes.
feet=[]
for side,cx,time in [('Левая',307,90),('Правая',331,94)]:
    toes=[]
    for dx in [-5,0,5]:
        x=cx+dx; y=255-(cx-307)*.43
        d=chain([((x-1.2,y-14),(x-2,y-7),(x+3.1,y+2),(x+3,y+6)),((x+3,y+6),(x+1,y+10),(x-1,y+7),(x-1.2,y+1))])
        toes.append(d); feet.append(d+' Z')
    stroke(side+' лапка: три пальчика',toes,time)
# The branch is interrupted under the toes instead of drawing across them.
upper=[((260,278),(280,267),(290,262),(302,256)),((319,249),(323,247),(325,246),(326,245)),((342,239),(359,233),(374,229),(388,225))]
lower=[((265,285),(281,277),(295,270),(309,263)),((319,258),(323,256),(327,254),(330,252)),((341,247),(362,238),(377,236),(394,232))]
stroke('Веточка под лапками',[chain([c]) for c in upper+lower],100)
branch=chain([((260,278),(300,257),(352,235),(388,225)),line((388,225),(394,232)),((394,232),(350,245),(300,267),(265,285)),line((265,285),(260,278))])+' Z'

# Three rows of ripples, each row is one connected hand movement.
def ripples(x,y,count=4,span=6):
    cs=[]
    for n in range(count):
        a=(x+n*span,y+n*1.8); b=(a[0]+span,a[1]+1.8)
        cs.append((a,(a[0]-1,a[1]+6),(b[0]-3,b[1]+5),b))
    return chain(cs)
for n,(x,y) in enumerate([(335,141),(327,153),(321,165)]): stroke(f'Волнистые пёрышки: ряд {n+1}',ripples(x,y),108+n*3)
for n,(x,y) in enumerate([(362,128),(369,136)]): stroke(f'Пёрышки на щёчке: ряд {n+1}',ripples(x,y,3,4.5),104+n*2)
cheek=oval(383,145,4,1.8)
stroke('Маленькое пёрышко на щёчке',cheek,114)
feathers=[]
# Long feathers sweep back towards the same diagonal back edge.
for root,tip,end in [((316,174),(276,186),(307,189)),((328,184),(258,199),(317,199)),((340,193),(247,211),(329,209))]:
    cs=[(root,(root[0]-14,root[1]+10),(tip[0]+8,tip[1]-2),tip),
        (tip,(tip[0]-9,tip[1]-1),(end[0]-28,end[1]+9),end)]
    feathers.append(chain(cs))
stroke('Три длинных пера крыла',feathers,122)

# Base yellow surrounds the wing and leaves the eye and cere untouched.
color('Жёлтая голова и грудка',body+' '+wing+' '+eye+' '+cere+' '+beak,'yellow',188,clip=body)
# Feathers occupy the lower wing; the upper wing remains pink.
# The pink and yellow areas tile the wing along one identical curve.
wing_left = at(line(wing_curves[-1][3], W), .30)
wing_right = at(wing_curves[1], .23)
wing_border = (wing_left, (309,194), (344,201), wing_right)
wing_yellow = chain([wing_border, section(wing_curves[1], .23, 1), wing_curves[2], line(wing_curves[-1][3], wing_left)])+' Z'
color('Жёлтые длинные перья крыла',wing_yellow,'yellow',194,clip=body)
color('Жёлтый клюв',beak,'yellow',150)
for i in range(2): color(('Левая' if i==0 else 'Правая')+' жёлтая лапка',' '.join(feet[i*3:i*3+3]),'yellow',153+i)
color('Жёлтый кончик хвоста',tail_region,'yellow',196)
# Pink areas are distinct patches bounded by the canonical outer regions.
pink_wing = chain([wing_curves[0], section(wing_curves[1], 0, .23), reverse(wing_border), line(wing_left, W)])+' Z'
color('Розовая верхняя часть крыла',pink_wing,'pink',164,clip=body)
pink_crown=chain([((349,118),(378,88),(419,91),(425,104)),((425,104),(396,98),(386,103),(377,114)),((377,114),(366,121),(359,122),(349,118))])+' Z'
color('Розовая макушка',pink_crown,'pink',215,clip=body)
pink_tail=chain([((214,277),(238,241),(252,238),(269,237)),line((269,237),(254,258)),((254,258),(242,262),(224,272),(214,277))])+' Z'
color('Розовая середина хвоста',pink_tail,'pink',174,clip=tail_region)
# Purple tips and a small crown accent, never a second full base coat.
for i,d in enumerate(feathers): color(f'Фиолетовый кончик пера {i+1}',d+' Z','purple',209+i,clip=chain([line((240,170),(294,170)),line((294,170),(294,225)),line((294,225),(240,225)),line((240,225),(240,170))])+' Z')
purple_crown=chain([((349,118),(376,88),(404,84),(417,96)),((417,96),(387,88),(369,106),(349,118))])+' Z'
color('Фиолетовый край макушки',purple_crown,'purple',216,clip=body)
purple_tail=chain([((232,253),(245,237),(260,237),(272,239)),line((272,239),(259,250)),((259,250),(246,247),(239,253),(232,253))])+' Z'
color('Фиолетовое основание хвоста',purple_tail,'purple',212,clip=tail_region)
orange_breast=chain([((394,192),(382,222),(344,239),(282,245)),((282,245),(339,251),(386,228),(403,196)),line((403,196),(394,192))])+' Z'
color('Оранжевое пёрышко на животике',orange_breast,'orange',230,clip=body)
color('Оранжевый кончик клюва',chain([((407,142),(414,146),(424,143),(428,142)),line((428,142),(424,161)),((424,161),(414,156),(409,153),(407,142))])+' Z','orange',225,clip=beak)
# Branch excludes toes so pencil colour cannot cover them.
color('Коричневая веточка',branch+' '+' '.join(feet),'brown',240,clip=branch)
color('Зелёная дужка над клювом',cere+' '+beak,'light_green',247,clip=cere)
# Leaves use black outlines; the planner groups their hatching with green.
leaves=[]
for root,tip in [((366,236),(415,204)),((357,246),(402,263)),((318,259),(345,289)),((284,275),(309,304))]:
    vx,vy=tip[0]-root[0],tip[1]-root[1]
    length=(vx*vx+vy*vy)**.5; nx,ny=-vy/length*7,vx/length*7
    def side(t,sign): return (root[0]+vx*t+nx*sign,root[1]+vy*t+ny*sign)
    leaf=chain([(root,side(.35,1),side(.75,1),tip),(tip,side(.75,-1),side(.35,-1),root)])+' Z'
    leaves.append(leaf)
stroke('Листочки на веточке',leaves,252)
for i,d in enumerate(leaves):
    color(f'Зелёный листочек {i+1}',d,'light_green',253+i)

lesson=dict(id='parrot',title='Попугай',viewBox='368 142 534 496',progressRevision=1,
    source=dict(title='РыбаКит — Как нарисовать ПОПУГАЯ',url='https://drive.google.com/file/d/1ytapWeHOumoFvPrwg8c6YUkb4zB-SkR1/view',durationSeconds=279.684,
    note='Контуры восстановлены по опорным кадрам видео владельца. Волнистый ряд — одно движение, пальчики и длинные перья сгруппированы. sourceTime приблизительный; учебный порядок сгруппирован по карандашам. Границы головы, крыла и хвоста общие с областями раскраски.'),
    palette=['black','yellow','pink','purple','orange','brown','light_green'],steps=STEPS)
(BASE/'lessons/parrot.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n')
print(f'{len(STEPS)} steps ({sum(s["kind"]=="stroke" for s in STEPS)} contour, {sum(s["kind"]=="color" for s in STEPS)} colour)')
