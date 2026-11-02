import base64, json, os
ROOT='/home/user/mirocard'
D=ROOT+'/tools/comparison/media/enough'
sprites={f[:-5]: 'data:image/webp;base64,'+base64.b64encode(open(os.path.join(D,f),'rb').read()).decode() for f in sorted(os.listdir(D)) if f.endswith('.webp')}
SETS=[
 dict(id="chairs",who="kid",thing="chair",whoGen="детей",thingGen="стульев",whoDat="детям",each="каждому ребёнку по стулу",match="Дай каждому ребёнку стул",
      lack=["Одному не хватает стула.","Двоим не хватает стульев."],spare=["Один стул лишний.","Два стула лишних."],
      place=dict(anchor="bottom",dy=0.08,size=0.62,front=True)),
 dict(id="cups",who="cup",thing="saucer",whoGen="чашек",thingGen="блюдец",whoDat="чашкам",each="каждой чашке по блюдцу",match="Поставь каждую чашку на блюдце",
      lack=["Одной чашке не хватает блюдца.","Двум чашкам не хватает блюдец."],spare=["Одно блюдце лишнее.","Два блюдца лишних."],
      mover="who",place=dict(anchor="bottom",dy=-0.4,size=0.8,front=True)),
 dict(id="dogs",who="dog",thing="bone",whoGen="собак",thingGen="косточек",whoDat="собакам",each="каждой собаке по косточке",match="Дай каждой собаке косточку",
      lack=["Одной собаке не хватает косточки.","Двум собакам не хватает косточек."],spare=["Одна косточка лишняя.","Две косточки лишние."],
      place=dict(anchor="bottom",dy=0.12,size=0.6,front=True)),
 dict(id="rabbits",who="rabbit",thing="carrot",whoGen="кроликов",thingGen="морковок",whoDat="кроликам",each="каждому кролику по морковке",match="Дай каждому кролику морковку",
      lack=["Одному кролику не хватает морковки.","Двум кроликам не хватает морковок."],spare=["Одна морковка лишняя.","Две морковки лишние."],
      place=dict(anchor="bottom",dy=0.12,size=0.55,front=True)),
 dict(id="cars",who="car",thing="garage",whoGen="машинок",thingGen="гаражей",whoDat="машинкам",each="каждой машинке по гаражу",match="Поставь каждую машинку в гараж",
      lack=["Одной машинке не хватает гаража.","Двум машинкам не хватает гаражей."],spare=["Один гараж лишний.","Два гаража лишних."],
      mover="who",place=dict(anchor="bottom",dy=-0.15,size=0.72,front=True)),
 dict(id="hats",who="kid",thing="hat",whoGen="детей",thingGen="шапок",whoDat="детям",each="каждому ребёнку по шапке",match="Надень каждому ребёнку шапку",
      lack=["Одному не хватает шапки.","Двоим не хватает шапок."],spare=["Одна шапка лишняя.","Две шапки лишние."],
      place=dict(anchor="top",dy=-0.14,size=0.3,front=True)),
]
OUTCOMES=[("lack1",4,3),("lack2",5,3),("equal",4,4),("spare1",3,4),("spare2",3,5)]
def cap(w): return w[0].upper()+w[1:]
cards=[]; n=0
for s_ in SETS:
    for oid,who,things in OUTCOMES:
        n+=1
        short,extra=who-things,things-who
        right=["whoMore","thingLess"] if short>0 else (["thingMore","whoLess"] if extra>0 else ["same"])
        whyQ=f"Почему {s_['thingGen']} {'не хватает' if short>0 else 'хватает'}?"
        opts=[("whoMore",f"{s_['whoGen']} больше"),("thingMore",f"{s_['thingGen']} больше"),("whoLess",f"{s_['whoGen']} меньше"),("thingLess",f"{s_['thingGen']} меньше"),("same",f"сколько {s_['whoGen']}, столько и {s_['thingGen']}")]
        cards.append(dict(n=n,set=s_['id'],who=who,things=things,whoSp=[f"{s_['who']}_{(i%6)+1}" for i in range(who)],thingSp=s_['thing'],
          place=s_['place'],whoSize=1,mover=s_.get('mover','thing'),match=s_['match'],q=f"Всем {s_['whoDat']} хватает {s_['thingGen']}?",
          right=("Хватает" if things>=who else "Не хватает"),whyQ=whyQ,whyOpts=[dict(id=i,label=l,ok=i in right) for i,l in opts]))
src=open(ROOT+'/docs/mockups/src/comparison-enough-review.page.html').read()
out=src.replace('__SPRITES__',json.dumps(sprites)).replace('__CARDS__',json.dumps(cards,ensure_ascii=False))
open(ROOT+'/docs/mockups/comparison-enough-review.html','w').write(out)
print(len(out), n)
