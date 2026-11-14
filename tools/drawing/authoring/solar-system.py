"""Two paper lessons adapted from the supplied Solar System video.

Standard library only. Fitted source-frame paths are reused for strokes,
colour boundaries and occlusion. Object transforms only rearrange/enlarge the
original objects; the dark full-page background and unused planets are omitted.
"""
import json
import math
from pathlib import Path as FilePath
from geometry import Path, chain, line, reverse, at, section

BASE=FilePath(__file__).resolve().parents[1]
REFERENCE=json.loads((BASE/'authoring/solar-system-reference.json').read_text())
REF=REFERENCE['curves'];PENCILS=json.loads((BASE/'pencils.json').read_text())
URL='https://drive.google.com/file/d/1r3Y6FDQqPTwQK0JmCWX12ICzgATCCsr3/view'

def region(cs):return chain(cs)+' Z'
def polygon(ps):return region([line(a,b) for a,b in zip(ps,ps[1:]+ps[:1])])
def inside(p,poly):
    x,y=p;hit=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hit=not hit
    return hit
def sample(cs):return [at(c,j/30) for c in cs for j in range(30)]+[cs[-1][-1]]
def attach(detail,parent):
    a=parent.nearest(detail.cs[0][0]);b=parent.nearest(detail.cs[-1][-1])
    detail.attach_start(parent.point(a));detail.attach_end(parent.point(b))
    return a,b,region(detail.cs+parent.short_arc(b,a))

def clip_stroke(path,shape):
    poly=sample(shape.cs);chunks=[];active=[]
    def keep(c,t):return inside(at(c,t),poly)
    for c in path.cs:
        lo=0;state=keep(c,0)
        for j in range(1,81):
            end=j/80;new=keep(c,end)
            if new!=state:
                a,b=(j-1)/80,end
                for _ in range(30):
                    mid=(a+b)/2
                    if keep(c,mid)==state:a=mid
                    else:b=mid
                cut=(a+b)/2
                if state:active.append(section(c,lo,cut));chunks.append(active);active=[]
                lo=cut;state=new
        if state:active.append(section(c,lo,1))
    if active:chunks.append(active)
    if len(chunks)>1 and math.dist(chunks[-1][-1][-1],chunks[0][0][0])<1e-6:chunks[0]=chunks.pop()+chunks[0]
    return [chain(cs) for cs in chunks if sum(math.dist(at(c,0),at(c,1)) for c in cs)>.2]

class Object:
    def __init__(self,name,source_center,target_center,scale,bounds):
        self.name=name;self.source_center=source_center;self.target_center=target_center;self.scale=scale;self.bounds=bounds
    def point(self,p):return tuple(self.target_center[k]+(p[k]-self.source_center[k])*self.scale for k in (0,1))
    def unmap(self,p):return tuple(self.source_center[k]+(p[k]-self.target_center[k])/self.scale for k in (0,1))
    def path(self,name):return Path([[self.point(p) for p in c] for c in REF[name]])
    def data(self):return dict(id=self.name,sourceCenter=self.source_center,targetCenter=self.target_center,scale=self.scale,sourceBounds=self.bounds)

class Lesson:
    def __init__(self,id,title,objects,palette):self.id=id;self.title=title;self.objects=objects;self.palette=palette;self.steps=[]
    def stroke(self,title,paths,time,obj,tool='black'):
        self.steps.append(dict(kind='stroke',title=title,paths=paths if isinstance(paths,list) else [paths],tool=tool,sourceTime=time,referenceObject=obj.name,reference=tool=='black'))
    def color(self,title,d,tool,time,**extra):
        self.steps.append(dict(kind='color',title=title,d=d,tool=tool,fill=PENCILS[tool]['color'],sourceTime=time,**extra))
    def save(self):
        lesson=dict(id=self.id,title=self.title,viewBox='0 0 1000 720',source=dict(title='Super Easy Drawings — Draw and Color the Solar System',url=URL,durationSeconds=417.319,referenceFrameSeconds=158,occlusionRepairFrameSeconds=162,videoSize=[854,480],objects=[o.data() for o in self.objects],note='Учебная адаптация части общего листа: объекты увеличены и переставлены, тёмный фон и остальные планеты опущены. Исходные контуры сохранены; участок Сатурна под служебным указателем сверен с кадром 162 секунды. sourceTime приблизительный, раскраска сгруппирована по карандашам.'),palette=self.palette,steps=self.steps)
        (BASE/f'lessons/{self.id}.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n')
        print(self.id,len(self.steps),'steps')

sun=Object('sun',[289.8,159.3],[130,183],.90,[163,30,410,284])
earth=Object('earth',[480.6,145.9],[361,185],1.15,[407,72,556,222])
moon=Object('moon',[594,72],[418,64],1,[563,40,628,105])
first=Lesson('sun_earth_moon','Солнце, Земля и Луна',[sun,earth,moon],['black','light_gray','yellow','orange','blue','green'])
core=sun.path('sun_core');flames=sun.path('sun_flames')
first.stroke('Круг Солнца',core.d(True),8,sun)
first.stroke('Лучи Солнца',flames.d(True),20,sun)
world=earth.path('earth');lands=[];coasts=[]
for name in ['earth_north','earth_south','earth_east']:
    coast=earth.path(name)
    if name=='earth_south':d=coast.d(True)
    else:_,_,d=attach(coast,world)
    coasts.append(coast.d(name=='earth_south'));lands.append(d)
first.stroke('Круг Земли',world.d(True),29,earth)
first.stroke('Материки Земли',coasts,41,earth)
moon_disc=moon.path('moon')
first.stroke('Луна и кратеры',[moon_disc.d(True)]+[moon.path('moon_crater_'+str(i)).d() for i in range(1,5)],51,moon)
first.color('Светло-серая Луна',moon_disc.d(True),'light_gray',211)
first.color('Жёлтое Солнце',core.d(True),'yellow',182)
first.color('Оранжевые лучи',flames.d(True)+' '+core.d(True),'orange',193,clip=flames.d(True))
land=' '.join(lands)
first.color('Синие океаны',world.d(True)+' '+land,'blue',214,clip=world.d(True))
first.color('Зелёные материки',land,'green',222,clip=world.d(True))
first.save()

jupiter=Object('jupiter',[766,107],[126,130],1.15,[697,34,837,178])
saturn=Object('saturn',[583,341],[328,230],1.05,[451,248,704,435])
satellite=Object('satellite',[762,252],[416,65],.8,[710,201,812,304])
second=Lesson('jupiter_saturn','Юпитер, Сатурн и спутник',[jupiter,saturn,satellite],['black','light_gray','pink','purple','orange','red','yellow'])
gas=jupiter.path('jupiter');bands=[]
for i in range(1,9):
    band=jupiter.path('jupiter_band_'+str(i));a,b,_=attach(band,gas);bands.append((band,a,b))
second.stroke('Круг Юпитера',gas.d(True),65,jupiter)
second.stroke('Верхние полосы Юпитера',[p.d() for p,_,_ in bands[:4]],73,jupiter)
second.stroke('Нижние полосы Юпитера',[p.d() for p,_,_ in bands[4:]],80,jupiter)
spot=jupiter.path('jupiter_spot_outer');_,_,spot_d=attach(spot,gas)
spot_inner=jupiter.path('jupiter_spot_inner');inner_d=spot_inner.d(True)
second.stroke('Большое пятно Юпитера',[spot.d()]+clip_stroke(spot_inner,gas),84,jupiter)

globe=saturn.path('saturn_globe');rings=[];ring_regions=[]
for i in range(1,5):
    ring=saturn.path('saturn_ring_'+str(i));_,_,d=attach(ring,globe)
    rings.append(ring);ring_regions.append(d)

def visible_globe():
    # Only the front diagonal band hides the globe. Closing arcs at the back
    # coincide with its silhouette and must not erase the upper hemisphere.
    polys=[sample(rings[i].cs+globe.short_arc(globe.nearest(rings[i].cs[-1][-1]),globe.nearest(rings[i].cs[0][0]))) for i in (0,3)]
    def visible(c,t):
        p=at(c,t);x,y=saturn.unmap(p)
        return y+.7*x<750 or inside(p,polys[0])==inside(p,polys[1])
    chunks=[];active=[]
    for c in globe.cs:
        lo=0;state=visible(c,0)
        for j in range(1,81):
            end=j/80;new=visible(c,end)
            if new!=state:
                a,b=(j-1)/80,end
                for _ in range(30):
                    mid=(a+b)/2
                    if visible(c,mid)==state:a=mid
                    else:b=mid
                cut=(a+b)/2
                if state:active.append(section(c,lo,cut));chunks.append(active);active=[]
                lo=cut;state=new
        if state:active.append(section(c,lo,1))
    if active:chunks.append(active)
    if len(chunks)>1 and math.dist(chunks[-1][-1][-1],chunks[0][0][0])<1e-6:chunks[0]=chunks.pop()+chunks[0]
    return [chain(cs) for cs in chunks if sum(math.dist(at(c,0),at(c,1)) for c in cs)>.5]

globe_strokes=visible_globe()
second.stroke('Шар Сатурна',globe_strokes,118,saturn)
second.stroke('Наружные кольца Сатурна',[p.d() for p in rings[:2]],128,saturn)
second.stroke('Внутренние кольца Сатурна',[p.d() for p in rings[2:]],134,saturn)
stripes=[saturn.path('saturn_stripe_'+str(i)) for i in range(1,8)]
# Full stripes share their roots with the globe; the source's short decorative
# curves deliberately stop in the interior and are preserved as such.
for i in (0,2,4,5):attach(stripes[i],globe)
second.stroke('Полосы Сатурна',[p.d() for p in stripes],137,saturn)

companion=satellite.path('satellite')
craters=[satellite.path('satellite_crater_'+str(i)).d(True) for i in range(1,8)]
second.stroke('Спутник и кратеры',[companion.d(True)]+craters+[satellite.path('satellite_shadow').d()],146,satellite)
second.color('Тёмные кратеры спутника',' '.join(craters),'black',338)
second.color('Светло-серый спутник',companion.d(True)+' '+' '.join(craters),'light_gray',334,clip=companion.d(True))
second.color('Розовая основа Сатурна',globe.d(True),'pink',310)

def shadow(path,width):
    points=[]
    for c in path.cs:
        for j in range(10):
            t=j/10;p=at(c,t)
            dx=3*((1-t)**2*(c[1][0]-c[0][0])+2*(1-t)*t*(c[2][0]-c[1][0])+t*t*(c[3][0]-c[2][0]))
            dy=3*((1-t)**2*(c[1][1]-c[0][1])+2*(1-t)*t*(c[2][1]-c[1][1])+t*t*(c[3][1]-c[2][1]))
            norm=max(math.hypot(dx,dy),1e-9);points.append((p[0]-dy/norm*width,p[1]+dx/norm*width))
    points.append(path.cs[-1][-1]);return region([line(a,b) for a,b in zip(points,points[1:])]+reverse(path.cs))
second.color('Фиолетовые полосы Сатурна',' '.join(shadow(p,5.5) for p in stripes),'purple',316,clip=globe.d(True))
second.color('Фиолетовое внутреннее кольцо',ring_regions[2]+' '+ring_regions[3],'purple',323)
second.color('Оранжевая основа Юпитера',gas.d(True),'orange',246)
second.color('Оранжевое наружное кольцо',ring_regions[0]+' '+ring_regions[1],'orange',327)

def strip(top,bottom):
    p,a,b=top;q,c,d=bottom
    # A cloud strip follows both existing wavy boundaries and the same globe
    # arcs on the left/right; no approximate horizontal cut is introduced.
    return region(p.cs+gas.short_arc(b,d)+reverse(q.cs)+gas.short_arc(c,a))
red=' '.join(strip(bands[i],bands[i+1]) for i in (0,2,4,6))
second.color('Красные полосы Юпитера',red+' '+spot_d,'red',255,clip=red)
second.color('Красная середина пятна',inner_d,'red',258,clip=spot_d)
second.color('Жёлтая окантовка пятна',spot_d+' '+inner_d,'yellow',260,clip=spot_d)
second.color('Жёлтое среднее кольцо',ring_regions[1]+' '+ring_regions[2],'yellow',329)
second.save()
