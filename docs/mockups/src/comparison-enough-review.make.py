import base64, json, os
ROOT='/home/user/mirocard'
D=ROOT+'/tools/comparison/media/enough'
sprites={f[:-5]: 'data:image/webp;base64,'+base64.b64encode(open(os.path.join(D,f),'rb').read()).decode() for f in sorted(os.listdir(D)) if f.endswith('.webp')}
SETS=[
 dict(id="chairs",who="kid",thing="chair",q="Всем хватает стульев?",whoGen="детей",thingGen="стульев",whoBtn="Детей",thingBtn="Стульев",
      lack=["Одному не хватает стула.","Двоим не хватает стульев."],spare=["Один стул лишний.","Два стула лишних."],
      place=dict(anchor="bottom",dy=0.08,size=0.62,front=True)),
 dict(id="cups",who="cup",thing="saucer",q="Всем чашкам хватает блюдец?",whoGen="чашек",thingGen="блюдец",whoBtn="Чашек",thingBtn="Блюдец",
      lack=["Одной чашке не хватает блюдца.","Двум чашкам не хватает блюдец."],spare=["Одно блюдце лишнее.","Два блюдца лишних."],
      place=dict(anchor="bottom",dy=0.06,size=1.15,front=False)),
 dict(id="dogs",who="dog",thing="bone",q="Всем собакам хватает косточек?",whoGen="собак",thingGen="косточек",whoBtn="Собак",thingBtn="Косточек",
      lack=["Одной собаке не хватает косточки.","Двум собакам не хватает косточек."],spare=["Одна косточка лишняя.","Две косточки лишние."],
      place=dict(anchor="bottom",dy=0.12,size=0.6,front=True)),
 dict(id="rabbits",who="rabbit",thing="carrot",q="Всем кроликам хватает морковок?",whoGen="кроликов",thingGen="морковок",whoBtn="Кроликов",thingBtn="Морковок",
      lack=["Одному кролику не хватает морковки.","Двум кроликам не хватает морковок."],spare=["Одна морковка лишняя.","Две морковки лишние."],
      place=dict(anchor="bottom",dy=0.12,size=0.55,front=True)),
 dict(id="cars",who="car",thing="garage",q="Всем машинкам хватает гаражей?",whoGen="машинок",thingGen="гаражей",whoBtn="Машинок",thingBtn="Гаражей",
      lack=["Одной машинке не хватает гаража.","Двум машинкам не хватает гаражей."],spare=["Один гараж лишний.","Два гаража лишних."],
      place=dict(anchor="bottom",dy=0.02,size=1.0,front=False),whoSize=0.78),
 dict(id="hats",who="kid",thing="hat",q="Всем хватает шапок?",whoGen="детей",thingGen="шапок",whoBtn="Детей",thingBtn="Шапок",
      lack=["Одному не хватает шапки.","Двоим не хватает шапок."],spare=["Одна шапка лишняя.","Две шапки лишние."],
      place=dict(anchor="top",dy=-0.14,size=0.3,front=True)),
]
OUTCOMES=[("lack1",4,3),("lack2",5,3),("equal",4,4),("spare1",3,4),("spare2",3,5)]
def cap(w): return w[0].upper()+w[1:]
cards=[]; n=0
for s in SETS:
    for oid,who,things in OUTCOMES:
        n+=1
        short,extra=who-things,things-who
        if short>0: cur=f"{cap(s['thingGen'])} не хватает. {s['lack'][short-1]}"; new=f"{cap(s['whoGen'])} больше, чем {s['thingGen']}. {s['lack'][short-1]}"; ans="who"
        elif extra>0: cur=f"{cap(s['thingGen'])} хватает всем. {s['spare'][extra-1]}"; new=f"{cap(s['thingGen'])} больше, чем {s['whoGen']}. {s['spare'][extra-1]}"; ans="thing"
        else: cur=f"{cap(s['thingGen'])} хватает всем: {s['whoGen']} и {s['thingGen']} поровну."; new=f"{cap(s['whoGen'])} и {s['thingGen']} поровну. {cap(s['thingGen'])} хватает всем."; ans="eq"
        cards.append(dict(n=n,set=s['id'],who=who,things=things,whoSp=[f"{s['who']}_{(i%6)+1}" for i in range(who)],thingSp=s['thing'],
          place=s['place'],whoSize=s.get('whoSize',1),curQ=s['q'],curAns=("Хватает" if things>=who else "Не хватает"),cur=cur,
          newQ=f"Чего больше: {s['whoGen']} или {s['thingGen']}?",btns=[s['whoBtn'],"Поровну",s['thingBtn']],newAns=ans,new=new))
src=open(ROOT+'/docs/mockups/src/comparison-enough-review.page.html').read()
out=src.replace('__SPRITES__',json.dumps(sprites)).replace('__CARDS__',json.dumps(cards,ensure_ascii=False))
open(ROOT+'/docs/mockups/comparison-enough-review.html','w').write(out)
print(len(out), n)
