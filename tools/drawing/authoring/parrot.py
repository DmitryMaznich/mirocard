"""Parrot from the owner's 640×360 video. Shared Bezier boundaries, no raster tracing.

Run with Python's standard library. Coordinates match the reference frames;
export at 2× so line weight and pencil texture match the existing lessons.
"""
import json
import math
from pathlib import Path
BASE = Path(__file__).resolve().parents[1]
PENCILS = json.loads((BASE / 'pencils.json').read_text())
STEPS = []
def pt(p): return f'{p[0]*2:.6f} {p[1]*2:.6f}'
def move(p): return 'M ' + pt(p)
def curve(c): return ' C ' + ' '.join(pt(p) for p in c[1:])
def chain(cs): return move(cs[0][0]) + ''.join(curve(c) for c in cs)
def reverse(c): return tuple(reversed(c))
def line(a,b):
    return (a,tuple((2*x+y)/3 for x,y in zip(a,b)),tuple((x+2*y)/3 for x,y in zip(a,b)),b)
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

# The supplied video's centreline fits are independent reference data. The
# straight back is regularised; all attached paths use points on that line.
REF=json.loads((BASE/'authoring/parrot-reference.json').read_text())['curves']
def ref(name): return [tuple(tuple(p) for p in c) for c in REF[name]]
def reverse_chain(cs): return [reverse(c) for c in reversed(cs)]
def nearest(cs,target):
    best=min(((sum((at(c,t)[i]-target[i])**2 for i in (0,1)),n,t)
              for n,c in enumerate(cs) for t in [i/1000 for i in range(1001)]))
    _,n,t=best
    return at(cs[n],t),n,t

def through(cs,n,t): return cs[:n]+[section(cs[n],0,t)]

def point_on_back(p):
    vx,vy=H[0]-T[0],H[1]-T[1]
    t=((p[0]-T[0])*vx+(p[1]-T[1])*vy)/(vx*vx+vy*vy)
    return at(back,t),t

T,H=(201,286),(359,105)
back=line(T,H)
crown=ref('crown');crown[0]=(H,*crown[0][1:])
F=crown[-1][-1]
cere_curves=ref('cere');cere_curves[0]=(F,*cere_curves[0][1:])
beak_curves=ref('beak');A=beak_curves[0][0]
cere_curves[-1]=(*cere_curves[-1][:-1],A)
C,_,_=nearest(beak_curves,(403,148));J,_,_=nearest(beak_curves,(418,155))
cup=ref('cup');cup[0]=(C,*cup[0][1:3],J)
B,_,_=nearest(cup,(413,157))
breast=ref('breast');breast[0]=(B,*breast[0][1:])
tail=ref('tail');R,rn,rt=nearest(breast,tail[-1][-1]);tail[-1]=(*tail[-1][:-1],R)
base_t=(R[1]-T[1])/(H[1]-T[1]);E=at(back,base_t)
main_body_curves=[section(back,base_t,1)]+crown+[line(F,B)]+through(breast,rn,rt)+[line(R,E)]
main_body=chain(main_body_curves)+' Z'
tail_region=chain([section(back,0,base_t),line(E,R)]+reverse_chain(tail))+' Z'
body=main_body

stroke('Спинка и округлая голова',chain([back]+crown),26)
eye=oval(379.7,121.7,5.1,6.3)
stroke('Глаз',eye,36)
color('Чёрный зрачок с белым бликом',oval(379.7,121.7,3.9,5.1)+' '+oval(379.0,120.8,1.6,2.3),'black',36)
stroke('Дужка над клювом',[chain(cere_curves),chain([((409,128.8),(409.2,129.8),(410.1,130.4),(410.4,131))]),chain([((418.7,129),(419.7,129.7),(419.1,130.4),(420,131))])],44)
beak=chain(beak_curves)+' Z'
# The cup is an exposed lower jaw, not a second oversized beak outline.
stroke('Загнутый клюв',[chain(beak_curves),chain(cup)],49)
# The cere's lower boundary is precisely the beak's upper arc.
K,kn,kt=nearest(beak_curves,(423,135))
cere=chain(cere_curves)+''.join(curve(c) for c in through(beak_curves,kn,kt))+curve(line(K,F))+' Z'
wing_curves=ref('wing');W,_=point_on_back(wing_curves[0][0]);wing_curves[0]=(W,*wing_curves[0][1:])
feather_curves=[ref('feather'+str(i)) for i in range(4)]
wing_end=(254,214.5);wing_curves[-1]=(*wing_curves[-1][:-1],wing_end)
feather_curves[-1][-1]=(*feather_curves[-1][-1][:-1],wing_end)
for cs in feather_curves[1:3]:
    end,_=point_on_back(cs[-1][-1]);cs[-1]=(*cs[-1][:-1],end)
wing_visible=chain(wing_curves);wing=wing_visible+curve(line(wing_end,W))+' Z'
stroke('Большая дуга крыла',wing_visible,64)
stroke('Грудка и животик',chain(breast),76)
stroke('Длинный хвост',chain(tail),84)

# The original has two upright legs and short toes wrapped around the branch;
# the right foot sits directly below the belly, without invented long stems.
stem1=[((302.3,238),(302.7,242),(301.4,247.5),(303.5,251.5)),((303.5,251.5),(305,254.8),(309.5,254.5),(309.5,250))]
stem2=[((307.5,238.5),(307,242.5),(307,247),(309.5,250))]
left_toe=[((309.5,250),(315,247),(319.5,249),(319.5,254)),((319.5,254),(319.8,258),(316,261),(313.5,260)),((313.5,260),(314.1,256.5),(313.8,255),(309.5,254)),line((309.5,254),(309.5,250))]
right_toe=[((327.5,244),(334.8,239.8),(342.8,242.8),(341,248)),((341,248),(339.8,251.2),(335.2,254.7),(331,254)),((331,254),(332.5,251.4),(328.3,248.5),(327.5,244))]
right_details=[chain([((328.5,245.5),(326.7,251.2),(330.6,253.3),(333.2,249.1)),((333.2,249.1),(334,246.2),(332.8,244.5),(331.5,243.5))]),chain([((335.4,243.5),(337.6,247.3),(334.3,251.6),(334.3,253.2))])]
left_fill=chain(left_toe)+' Z'+' '+oval(306.2,251.3,2.7,2.4)
right_fill=chain(right_toe)+' Z'
feet=[left_fill,right_fill]
stroke('Левая лапка: пальчики на ветке',[chain(stem1),chain(stem2),chain(left_toe)],90)
stroke('Правая лапка: пальчики на ветке',[chain(right_toe)]+right_details,94)
branch_upper=[((263,278),(281,267),(299,256),(313,250)),((313,250),(316,248),(319,245),(327,243)),((327,243),(349,237),(370,231),(388,227))]
branch_lower=((267,285),(311,259),(350,245),(394,233))
branch=chain(branch_upper+[line(branch_upper[-1][-1],branch_lower[-1]),reverse(branch_lower),line(branch_lower[0],branch_upper[0][0])])+' Z'
# Use geometric toe masks to split the visible edges, rather than guessed gaps.
def polygon(cs): return [at(c,i/30) for c in cs for i in range(31)]
polygons=[polygon(left_toe),polygon(right_toe),polygon(main_body_curves)]
def in_poly(p,vs):
    x,y=p;inside=False
    for a,b in zip(vs,vs[1:]+vs[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:inside=not inside
    return inside

def visible_branch(c):
    # The circular left grip is also foreground.
    def hidden(t):
        q=at(c,t)
        return any(in_poly(q,p) for p in polygons) or ((q[0]-306.2)/2.7)**2+((q[1]-251.3)/2.4)**2<1
    def long_enough(a,b):
        return sum(math.dist(at(c,a+(b-a)*i/20),at(c,a+(b-a)*(i+1)/20)) for i in range(20))>1.2
    spans=[];start=0;last=False
    for i in range(1,1001):
        t=i/1000;now=hidden(t)
        if now!=last:
            lo,hi=(i-1)/1000,t
            for _ in range(24):
                mid=(lo+hi)/2
                if hidden(mid)==last:lo=mid
                else:hi=mid
            edge=(lo+hi)/2
            if not last and edge>start and long_enough(start,edge):spans.append(chain([section(c,start,edge)]))
            start=edge;last=now
    if not last and long_enough(start,1):spans.append(chain([section(c,start,1)]))
    return spans
stroke('Веточка под лапками',[d for c in branch_upper for d in visible_branch(c)]+visible_branch(branch_lower),100)

# Independent video reference fits keep the small curls and their spacing.
for n in range(3):stroke(f'Волнистые пёрышки: ряд {n+1}',chain(ref('wave'+str(n+1))),108+n*3)
for n in range(2):stroke(f'Пёрышки на щёчке: ряд {n+1}',chain(ref('cheek'+str(n+1))),104+n*2)
feathers=[chain(cs) for cs in feather_curves]
stroke('Длинные перья крыла',feathers,122)

# Base yellow surrounds the wing and leaves the eye and cere untouched.
color('Жёлтая голова и грудка',body+' '+wing+' '+eye+' '+beak+' '+cere,'yellow',188,clip=body)
# Feathers occupy the lower wing; the upper wing remains pink.
# The pink and yellow areas tile the wing along one identical curve.
# Partition the new wing using a point on its actual outer boundary.
wing_left=at(line(wing_end,W),.30)
wing_right,wn,wt=nearest(wing_curves,(362,187))
wing_border=(wing_left,(309,194),(344,201),wing_right)
wing_remainder=[section(wing_curves[wn],wt,1)]+wing_curves[wn+1:]
wing_yellow=chain([wing_border]+wing_remainder+[line(wing_end,wing_left)])+' Z'
color('Жёлтые длинные перья крыла',wing_yellow,'yellow',194,clip=body)
color('Жёлтый клюв',beak,'yellow',150)
for i in range(2): color(('Левая' if i==0 else 'Правая')+' жёлтая лапка',feet[i],'yellow',153+i)
color('Жёлтый кончик хвоста',tail_region,'yellow',196)
# Pink areas are distinct patches bounded by the canonical outer regions.
pink_wing = chain(through(wing_curves,wn,wt)+[reverse(wing_border),line(wing_left,W)])+' Z'
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
color('Коричневая веточка',branch+' '+' '.join(feet)+' '+body,'brown',240,clip=branch)
color('Зелёная дужка над клювом',cere+' '+beak,'light_green',247,clip=cere)
# Leaves use black outlines; the planner groups their hatching with green.
leaves=[]
for root,tip in [((366,236),(415,204)),((357,246),(402,263)),((318,259),(345,289)),((284,275),(309,304))]:
    vx,vy=tip[0]-root[0],tip[1]-root[1]
    length=(vx*vx+vy*vy)**.5; nx,ny=-vy/length*7,vx/length*7
    def side(t,sign): return (root[0]+vx*t+nx*sign,root[1]+vy*t+ny*sign)
    leaf=chain([(root,side(.35,1),side(.75,1),tip),(tip,side(.75,-1),side(.35,-1),root)])+' Z'
    leaves.append(leaf)
stroke('Листочки на веточке',leaves,252,tool='light_green')
for i,d in enumerate(leaves):
    color(f'Зелёный листочек {i+1}',d,'light_green',253+i)

lesson=dict(id='parrot',title='Попугай',viewBox='368 142 534 496',progressRevision=2,
    source=dict(title='РыбаКит — Как нарисовать ПОПУГАЯ',url='https://drive.google.com/file/d/1ytapWeHOumoFvPrwg8c6YUkb4zB-SkR1/view',durationSeconds=279.684,
    note='Контуры восстановлены по опорным кадрам видео владельца. Волнистый ряд — одно движение, пальчики и длинные перья сгруппированы. sourceTime приблизительный; учебный порядок сгруппирован по карандашам. Границы головы, крыла и хвоста общие с областями раскраски.'),
    palette=['black','yellow','pink','purple','orange','brown','light_green'],steps=STEPS)
(BASE/'lessons/parrot.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n')
print(f'{len(STEPS)} steps ({sum(s["kind"]=="stroke" for s in STEPS)} contour, {sum(s["kind"]=="color" for s in STEPS)} colour)')
