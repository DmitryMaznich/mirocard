"""Donkey lesson from independent video centreline fits. Standard library only."""
import json
import math
from pathlib import Path as FilePath
from geometry import Path,chain,line,reverse,oval,at
BASE=FilePath(__file__).resolve().parents[1]
PENCILS=json.loads((BASE/'pencils.json').read_text())
REF=json.loads((BASE/'authoring/donkey-reference.json').read_text())['curves']
STEPS=[]
def ref(name): return Path(REF[name])
def stroke(title,paths,time,tool='black'):
    STEPS.append(dict(kind='stroke',title=title,paths=paths if isinstance(paths,list) else [paths],tool=tool,sourceTime=time))
def color(title,d,tool,time,**extra):
    STEPS.append(dict(kind='color',title=title,d=d,tool=tool,fill=PENCILS[tool]['color'],sourceTime=time,**extra))
def region(cs): return chain(cs)+' Z'
body,head=ref('body'),ref('head')
stroke('Овальное туловище',body.d(True),28)
stroke('Голова ослика',head.d(True),42)
neck_l,neck_r=ref('neck_left'),ref('neck_right')
hl,hr=head.nearest(neck_l.cs[0][0]),head.nearest(neck_r.cs[0][0])
bl,br=body.nearest(neck_l.cs[-1][-1]),body.nearest(neck_r.cs[-1][-1])
neck_l.attach_start(head.point(hl));neck_l.attach_end(body.point(bl))
neck_r.attach_start(head.point(hr));neck_r.attach_end(body.point(br))
stroke('Две линии шеи',[neck_l.d(),neck_r.d()],49)
neck=region(neck_l.cs+body.short_arc(bl,br)+reverse(neck_r.cs)+head.short_arc(hr,hl))
muzzle=ref('muzzle');u,v=head.nearest(muzzle.cs[0][0]),head.nearest(muzzle.cs[-1][-1])
muzzle.attach_start(head.point(u));muzzle.attach_end(head.point(v))
stroke('Линия мордочки',muzzle.d(),58)
muzzle_shape=region(head.short_arc(u,v)+reverse(muzzle.cs))
nostril=ref('nostril').d(True)
stroke('Ноздря',nostril,59)
color('Тёмная ноздря с бликом',region(oval(251.1,133.3,2.0,2.7))+' '+region(oval(251.2,132.2,.65,1.15)),'black',59,clip=nostril)
stroke('Улыбка',ref('smile').d(),61)
eye=region(oval(297.2,115.0,9.4,10.6))
stroke('Круглый глаз',eye,63)
color('Чёрный зрачок с белым бликом',region(oval(293.3,114.6,6.2,7.0))+' '+region(oval(291.9,110.8,1.8,2.0)),'black',63,clip=eye)
ears=[]
for name,title,time in [('ear_up','Верхнее длинное ухо',69),('ear_back','Второе длинное ухо',73)]:
    ear=ref(name);a,b=head.nearest(ear.cs[0][0]),head.nearest(ear.cs[-1][-1])
    ear.attach_start(head.point(a));ear.attach_end(head.point(b))
    stroke(title,ear.d(),time)
    ears.append(region(ear.cs+head.short_arc(b,a)))
tail=ref('tail');tail.attach_start(body.point(body.nearest(tail.cs[0][0])));tip=tail.cs[-1][-1]
# The small brush has three branches, all sharing the end of the tail.
brush=[chain([line(tip,p)]) for p in [(432,119),(442,119),(445,127),(440,133)]]
stroke('Хвост с кисточкой',[tail.d()]+brush,79)
legs=[];uppers=[];hooves=[];hoof_lines=[]
for name,title,time,left_target,right_target in [
    ('leg_far_left','Левая дальняя ножка',88,(286,255),(301,256)),
    ('leg_near_left','Левая ближняя ножка',91,(309,259),(329,260)),
    ('leg_near_right','Правая ближняя ножка',94,(366,263),(382,261)),
    ('leg_far_right','Правая дальняя ножка',97,(392,247),(407,243)),
]:
    leg=ref(name);a,b=body.nearest(leg.cs[0][0]),body.nearest(leg.cs[-1][-1])
    leg.attach_start(body.point(a));leg.attach_end(body.point(b))
    root=body.short_arc(b,a)
    full=region(leg.cs+root)
    ul,ur=leg.nearest(left_target),leg.nearest(right_target)
    p,q=leg.point(ul),leg.point(ur);divider=line(p,q)
    stroke(title,leg.d(),time)
    legs.append(full);hoof_lines.append(chain([divider]))
    uppers.append(region(leg.sub(0,ul)+[divider]+leg.sub(ur,len(leg.cs))+root))
    hooves.append(region(leg.sub(ul,ur)+reverse([divider])))
stroke('Четыре копытца',hoof_lines,101)

color('Серое туловище',body.d(True),'gray',151)
color('Серая часть головы',head.d(True)+' '+muzzle_shape+' '+eye,'gray',151,clip=head.d(True))
color('Серая шея',neck,'gray',156)
for i,d in enumerate(ears):color(f'Серое ухо {i+1}',d,'gray',118+i*5)
for i,d in enumerate(uppers):color(f'Серая ножка {i+1}',d,'gray',134+i)
for i,d in enumerate(hooves):color(f'Коричневое копытце {i+1}',d,'brown',148+i)
flower_x,flower_y=259,234
flower_centre=region(oval(flower_x,flower_y,2.1,2.1))
color('Серединка цветка',flower_centre,'brown',192)
color('Жёлтая мордочка',muzzle_shape+' '+nostril,'yellow',140,clip=muzzle_shape)
# Six round petals form one continuous coloured outline.
points=[]
for i in range(73):
    a=2*math.pi*i/72;r=5.0+1.25*math.cos(6*a)
    points.append((flower_x+math.cos(a)*r,flower_y+math.sin(a)*r))
petal_curves=[]
# Periodic Catmull-Rom to smooth cubic petals, with a shared closing point.
for i in range(72):
    p0,p1,p2,p3=points[(i-1)%72],points[i],points[(i+1)%72],points[(i+2)%72]
    petal_curves.append((p1,tuple(p1[n]+(p2[n]-p0[n])/6 for n in (0,1)),tuple(p2[n]-(p3[n]-p1[n])/6 for n in (0,1)),p2))
flower=region(petal_curves)
stroke('Жёлтые лепестки',flower,192,tool='yellow')
color('Раскрасим лепестки',flower+' '+flower_centre,'yellow',193,clip=flower)
# Flower and grass positions are aligned to the original black-outline frame.
stem=[((259,240),(258,247),(259,252),(258,263))]
leaf_l=[((258.7,249),(252,245),(251,252),(258.3,254)),((258.3,254),(255,251),(256,250),(258.7,249))]
leaf_r=[((258.3,254),(264,248),(267,254),(258,259)),((258,259),(260,255),(260,254),(258.3,254))]
leaves=[region(leaf_l),region(leaf_r)]
stroke('Зелёный стебелёк и листочки',[chain(stem),*leaves],194,tool='green')
color('Зелёные листочки',' '.join(leaves),'green',195)
# A single gradual grass step, behind the four legs, rather than many blades.
grass_points=[(246,278),(245,258),(251,266),(250,253),(257,270),(261,262),(267,278),(270,261),(274,269),(276,254),(282,271),(286,264),(292,278),(299,264),(302,279),(308,268),(310,282),(315,265),(320,278),(325,260),(329,273),(334,254),(337,274),(342,262),(347,275),(352,255),(356,269),(362,257),(366,272),(373,258),(377,270),(384,251),(389,265),(397,251),(399,265),(407,250),(409,263),(419,249),(417,264),(429,250),(426,263),(440,253),(433,269),(446,258),(439,276),(420,282),(390,283),(361,284),(330,288),(303,289),(280,284),(260,285)]
grass=region([line(a,b) for a,b in zip(grass_points,grass_points[1:]+grass_points[:1])])
color('Зелёная травка',grass+' '+' '.join(legs),'green',183,clip=grass)
lesson=dict(id='donkey',title='Ослик',viewBox='440 76 500 536',progressRevision=1,
    source=dict(title='РыбаКит — Учимся рисовать ОСЛИКА',url='https://drive.google.com/file/d/1zAVfuOW7_fHCDXkdTiD8eAPJhRd4vnu2/view',durationSeconds=215.829,referenceFrameSeconds=102,note='Контуры сверены по исходным кадрам 640×360. Уши, шея, ножки и копытца используют общие границы. Раскраска сгруппирована по карандашам; sourceTime приблизительный.'),
    palette=['black','gray','brown','yellow','green'],steps=STEPS)
(BASE/'lessons/donkey.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n')
print(len(STEPS),'steps;',sum(s['kind']=='stroke' for s in STEPS),'contour,',sum(s['kind']=='color' for s in STEPS),'colour')
