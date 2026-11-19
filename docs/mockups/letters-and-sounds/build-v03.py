base = open('docs/mockups/letters-and-sounds/base.css').read()
css = base + r"""
  .phone { width: 300px; height: 590px; } .shot { width: 300px; } .row { gap: 18px; } .page { max-width: 1320px; }
  .picture { width: 140px; height: 124px; font-size: 76px; }
  .picture.tap { position: relative; }
  .picture .wave { position: absolute; right: 8px; bottom: 8px; width: 22px; height: 22px; fill: none; stroke: #cbd5e1; stroke-width: 2.4; stroke-linecap: round; }
  .picture.playing { border-color: #4a9b8f; box-shadow: 0 0 0 6px rgba(74,155,143,.22), 0 0 0 14px rgba(74,155,143,.10); }
  .picture.playing .wave { stroke: #4a9b8f; width: 28px; height: 28px; }
  .big-letter.tap { position: relative; }
  .big-letter .wave { position: absolute; right: 5px; bottom: 5px; width: 16px; height: 16px; fill: none; stroke: #cbd5e1; stroke-width: 2.6; stroke-linecap: round; }
  .big-letter.playing { box-shadow: 0 0 0 6px rgba(74,155,143,.22), 0 0 0 14px rgba(74,155,143,.10); }
  .big-letter.playing .wave { stroke: #4a9b8f; width: 20px; height: 20px; }
  .bubble { font-size: 15px; font-weight: 800; color: #2a6b60; background: #e7f3f1; padding: 4px 12px; border-radius: 99px; }
  .rules { background: #fff; border-radius: 14px; padding: 14px 18px; max-width: 900px; font-size: 14.5px; line-height: 1.55; border-left: 5px solid #f59e0b; }
  .rules b { color: #111827; }

  .tray { display: flex; gap: 10px; justify-content: center; }
  .tray .tile { width: 64px; font-size: 38px; }
  .tray .tile.ghost { opacity: .25; }
  .cell .tl { font-size: 38px; font-weight: 800; }
  .cell.slot { border-style: dashed; border-color: #3b82f6; background: #eff6ff; }
  .cell.fade .ltr { color: #94a3b8; }
  .match { display: flex; flex-direction: column; gap: 14px; width: 100%; }
  .mrow { display: flex; align-items: center; gap: 12px; }
  .mrow .picture { width: 84px; height: 76px; font-size: 48px; border-radius: 14px; }
  .mrow .scheme { justify-content: flex-start; }
  .mrow .cell { width: 54px; height: 54px; font-size: 32px; }
  .mrow .cell.wide { width: 96px; }
  .matrix { border-collapse: separate; border-spacing: 10px; }
  .matrix th { font-size: 15px; text-align: left; color: #374151; padding: 0 6px; }
  .matrix td { background: #fff; border-radius: 14px; padding: 12px 14px; vertical-align: middle; min-width: 250px; }
  .matrix td.rowh { background: transparent; font-weight: 800; font-size: 15px; min-width: 120px; }
  .matrix td.na { background: transparent; border: 2px dashed #d6d3cb; color: #9ca3af; font-size: 13px; }
  .mini { display: flex; align-items: center; gap: 12px; }
  .mini .scheme { justify-content: flex-start; }
  .mini .cell { width: 34px; height: 34px; font-size: 20px; border-width: 2.5px; margin-left: -2.5px; }
  .mini .cell.wide { width: 70px; }
  .mini .chipdot { width: 20px; height: 20px; box-shadow: none; }
  .mini .lbl { font-size: 14px; font-weight: 700; color: #1f2937; line-height: 1.3; }
  .mini .lbl small { display: block; color: #6b7280; font-weight: 600; }
  .mini .read-arrow, .mrow .read-arrow { display: none; }
  .num { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #4a9b8f; color: #fff; font-size: 13px; font-weight: 900; margin-right: 4px; }
  .num.b { background: #2563eb; }
  .cell.lit { background: #fef3c7; border-color: #f59e0b; z-index: 3; box-shadow: 0 0 0 5px rgba(245,158,11,.25); }
  .cell.lit.long { box-shadow: 0 0 0 9px rgba(245,158,11,.30); }
  .cell.done { background: #fffbeb; }
  .say { font-size: 22px; font-weight: 900; color: #b45309; letter-spacing: 1px; min-height: 30px; }
  .say i { color: #d6d3d1; font-style: normal; }
  .slowbtn { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 800; color: #b45309; background: #fffbeb; border: 2px solid #fcd34d; border-radius: 99px; padding: 6px 14px; }
  .fade-ladder { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; }
  .fade-ladder div { background: #fff; border-radius: 12px; padding: 10px 14px; font-size: 14px; font-weight: 700; min-width: 220px; }
  .fade-ladder small { display: block; color: #6b7280; font-weight: 600; }
  .lotto { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%; }
  .lp { position: relative; aspect-ratio: 1; border-radius: 16px; background: #fff; border: 2.5px solid #e2e8f0; display: grid; place-items: center; font-size: 50px; }
  .lp .ov { position: absolute; inset: 6px; border-radius: 12px; display: grid; place-items: center; font-size: 58px; font-weight: 900;
    background: rgba(255,255,255,.45); border: 2px solid rgba(37,99,235,.55); color: rgba(29,78,216,.85); backdrop-filter: blur(0.5px); }
  .lp.ok { border-color: #22c55e; }
  .lp.ok .ov { border-color: rgba(22,163,74,.7); color: rgba(21,128,61,.85); background: rgba(220,252,231,.40); }
  .lp.bad { border-color: #ef4444; }
  .lp.bad .ov { border-color: rgba(239,68,68,.8); color: rgba(185,28,28,.85); background: rgba(254,242,242,.45); }
  .lp.hover { border-color: #3b82f6; box-shadow: 0 0 0 4px rgba(59,130,246,.3); }
  .ltray { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  .ltray .card { width: 54px; height: 54px; border-radius: 12px; display: grid; place-items: center; font-size: 36px; font-weight: 900;
    color: #1d4ed8; background: rgba(239,246,255,.7); border: 2px solid rgba(37,99,235,.5); box-shadow: 0 3px 0 rgba(37,99,235,.25); }
  .ltray .card.gone { opacity: 0; }
  .ltray .card.drag { transform: translate(-30px,-120px) rotate(-6deg) scale(1.08); box-shadow: 0 10px 20px rgba(0,0,0,.18); }
  .scheme { display: flex; justify-content: center; }
  .cell { width: 64px; height: 64px; border: 3px solid #334155; margin-left: -3px; background: #fff;
    display: grid; place-items: center; font-size: 40px; font-weight: 800; color: #1f2937; position: relative; }
  .cell:first-child { margin-left: 0; border-radius: 10px 0 0 10px; }
  .cell:last-child { border-radius: 0 10px 10px 0; }
  .cell:only-child { border-radius: 10px; }
  .cell.wide { width: 170px; }
  .cell.off { background: repeating-linear-gradient(45deg,#f1f5f9 0 6px,#e2e8f0 6px 12px); border-color: #94a3b8; z-index: 0; }
  .cell.ok { background: #dcfce7; border-color: #16a34a; z-index: 2; }
  .cell.bad { background: #fef2f2; border-color: #ef4444; z-index: 2; }
  .cell.here { box-shadow: 0 0 0 5px rgba(34,197,94,.45); border-color: #16a34a; z-index: 2; }
  .cell .ltr { color: #cbd5e1; }
  .cell .ltr.show { color: #1f2937; }
  .cell.ok .ltr { color: #15803d; }
  .chipdot { width: 36px; height: 36px; border-radius: 50%; background: #2563eb; box-shadow: 0 3px 0 #1e40af; }
  .cell .chipdot.on-letter { position: absolute; top: -20px; right: -14px; width: 28px; height: 28px; }
  .cell .chipdot.bad { background: #ef4444; box-shadow: 0 3px 0 #b91c1c; }
  .cell .mark { position: absolute; bottom: -30px; font-size: 22px; }
  .read-arrow { display: flex; align-items: center; justify-content: center; gap: 0; width: 100%; margin-top: 8px; }
  .read-arrow i { display: block; height: 3px; background: #94a3b8; width: 70%; }
  .read-arrow b { width: 0; height: 0; border-left: 12px solid #94a3b8; border-top: 7px solid transparent; border-bottom: 7px solid transparent; }
  .pool { display: flex; gap: 10px; justify-content: center; }
  .pool .chipdot { width: 44px; height: 44px; }
  .pool.empty .chipdot { opacity: .25; }
  .tiles .tile.small { font-size: 36px; }
  .step-n { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: #1f2937; color: #fff; font-size: 15px; margin-right: 6px; }
  .cap { margin-top: 10px; font-size: 15px; font-weight: 700; color: #1f2937; line-height: 1.35; }
  .cap span { display: block; font-weight: 600; color: #6b7280; font-size: 13.5px; }
  .sound { font-weight: 900; color: #2563eb; }
  .vs { display: flex; gap: 26px; flex-wrap: wrap; align-items: flex-start; }
  .legend { display: flex; gap: 18px; flex-wrap: wrap; margin: 4px 0 18px; font-size: 14px; font-weight: 700; color: #374151; align-items: center; }
  .legend .cell { width: 34px; height: 34px; border-radius: 6px !important; margin: 0; font-size: 18px; display: inline-grid; vertical-align: middle; }
  .legend .chipdot { width: 24px; height: 24px; display: inline-block; vertical-align: middle; }
"""

def phone(stage, counter="5 / 10", stars="★★★☆"):
    return f'''<div class="phone"><div class="screen">
  <div class="topbar"><span class="x">✕</span><span>{counter}</span><span class="stars">{stars}</span></div>
  <div class="stage">{stage}</div></div></div>'''

WAVE = '<svg class="wave" viewBox="0 0 24 24"><path d="M8 9 Q11 12 8 15" /><path d="M12 6 Q17 12 12 18" /><path d="M16 3 Q23 12 16 21" /></svg>'
def pic(emoji, playing=False):
    return f'<div class="picture tap {"playing" if playing else ""}">{emoji}{WAVE}</div>'
def target(letter, emoji, sound, small=False, playing=False, letter_playing=False):
    return f'''<div class="with-letter"><div class="big-letter tap {"playing" if letter_playing else ""}" style="width:80px;height:80px;font-size:54px">{letter}{WAVE}</div>
  {pic(emoji, playing)}</div>
  <div class="instr" style="font-size:17px">Где звук <span class="sound">[{sound}]</span>?</div>'''

def scheme(cells):
    out = []
    for c in cells:
        cls = c.get('cls', '')
        inner = ''
        if 'letter' in c:
            inner += f'<span class="ltr {"show" if c.get("show") else ""}">{c["letter"]}</span>'
        if c.get('chip') == 'in':
            inner += '<span class="chipdot"></span>'
        elif c.get('chip'):
            inner += f'<span class="chipdot on-letter {"bad" if c["chip"]=="bad" else ""}"></span>'
        if c.get('mark'):
            inner += f'<span class="mark">{c["mark"]}</span>'
        out.append(f'<div class="cell {cls}">{inner}</div>')
    return '<div class="scheme">' + ''.join(out) + '</div><div class="read-arrow"><i></i><b></b></div>'

def pool(empty=False):
    return f'<div class="pool {"empty" if empty else ""}"><span class="chipdot"></span></div>'

def shot(title, phone_html, cap, sub=''):
    return f'<div class="shot"><h3>{title}</h3>{phone_html}<div class="cap">{cap}<span>{sub}</span></div></div>'

S = '<div class="spacer"></div>'

# ---- ladder ----
l1 = phone(target('М','🌺','м', playing=True) + S + scheme([{'cls':'ok','chip':'in'},{'cls':'wide'}]) + S + pool(True))
l2 = phone(target('Т','🐱','т') + S + scheme([{}, {'cls':'off'}, {'cls':'ok','chip':'in'}]) + S + pool(True))
l3 = phone(target('З','🐐','з') + S + scheme([{}, {}, {'cls':'ok','chip':'in'}, {}]) + S + pool(True))
l4 = phone(pic('🐱') + '''
  <div class="instr" style="font-size:17px">Звуки по порядку</div>''' + S +
  scheme([{'cls':'ok','letter':'К','show':True},{'cls':'ok','letter':'О','show':True},{}]) + S +
  '<div class="tiles c4" style="width:80%"><div class="tile small dim">К</div><div class="tile small dim">О</div><div class="tile small">Т</div><div class="tile small">М</div></div>',
  "2 / 6", "★☆☆☆")

ladder = ''.join([
  shot('<span class="step-n">1</span>Первый звук', l1, 'Клетка + полоса', 'Длину слова ещё не показываем'),
  shot('<span class="step-n">2</span>Начало или конец', l2, 'Клетка на каждый звук', 'Внутренние закрыты'),
  shot('<span class="step-n">3</span>Где угодно', l3, 'Любая клетка', 'Внутренние = «середина»'),
  shot('<span class="step-n">4</span>Все звуки <small>потолок</small>', l4, 'Буквы в клетки по порядку', 'Не в первой версии'),
])

# ---- storyboard: correct ----
def word_cells(chip_idx=None, show=False, ok_idx=None, bad_idx=None, here_idx=None, chip_state='in'):
    cells = []
    for i, ch in enumerate('КОЗА'):
        c = {}
        if show: c['letter'] = ch; c['show'] = True
        cls = []
        if ok_idx == i: cls.append('ok')
        if bad_idx == i: cls.append('bad')
        if here_idx == i: cls.append('here')
        c['cls'] = ' '.join(cls)
        if chip_idx == i:
            c['chip'] = 'in' if not show else ('bad' if bad_idx == i else 'top')
        if here_idx == i: c['mark'] = '👆'
        cells.append(c)
    return scheme(cells)

goat = target('З','🐐','з')
goat_play = target('З','🐐','з', playing=True)
f1 = phone(goat_play + S + word_cells() + S + pool(), "6 / 10")
f2 = phone(goat + S + word_cells(chip_idx=2) + S + pool(True), "6 / 10")
f3 = phone(goat + S + word_cells(chip_idx=2, show=True) + S + pool(True), "6 / 10")
f4 = phone(goat + S + word_cells(chip_idx=2, show=True, ok_idx=2) + S + '<div class="instr" style="color:#16a34a;font-size:44px">✓</div>', "6 / 10", "★★★★")
story = ''.join([
  shot('<span class="step-n">1</span>Слушает слово', f1, 'Пустая схема + фишка', 'Можно вести пальцем по клеткам'),
  shot('<span class="step-n">2</span>Ставит фишку', f2, 'Фишка в 3-ю клетку', ''),
  shot('<span class="step-n">3</span>Появляются буквы', f3, 'Схема → слово', 'Фишка поднимается над буквой'),
  shot('<span class="step-n">4</span>Совпало', f4, 'З под фишкой — зелёная', ''),
])

# ---- wrong ----
w1 = phone(goat + S + word_cells(chip_idx=1) + S + pool(True), "6 / 10")
w2 = phone(goat + S + word_cells(chip_idx=1, show=True, bad_idx=1, here_idx=2) + S + '<div class="instr" style="font-size:16px;color:#6b7280">Звук <span class="sound">[з]</span> здесь</div>', "6 / 10")
w3 = phone(goat + S + word_cells(chip_idx=2) + S + pool(True), "6 / 10")
wrong = ''.join([
  shot('<span class="step-n">1</span>Ставит не туда', w1, 'Фишка во 2-ю клетку', ''),
  shot('<span class="step-n">2</span>Буквы показывают', w2, 'Красная — где фишка, палец — где звук', 'Без штрафа, это объяснение'),
  shot('<span class="step-n">3</span>Сам переставляет', w3, 'Буквы снова прячутся, фишку — в 3-ю', 'Засчитывается как с подсказкой'),
])

# ---- compare ----
train = '''<div class="train">
  <div class="train-col" style="flex:0 0 96px"><div class="car loco"><span class="chim"></span><span class="cab"></span></div><div class="car-label">начало</div></div>
  <div class="train-col" style="flex:1 1 0"><div class="car hint"></div><div class="car-label">середина</div></div>
  <div class="train-col" style="flex:1 1 0"><div class="car"></div><div class="car-label">конец</div></div></div>'''
cmp1 = phone(goat + S + train + S, "6 / 10")
cmp2 = phone(goat + S + word_cells(chip_idx=2) + S + pool(True), "6 / 10")
h1p = phone(target('З','🐐','з', playing=True) + S + word_cells() + S + pool(), "6 / 10")
h2p = phone(goat + S + word_cells() + S + pool(), "6 / 10")
h3p = phone(target('З','🐐','з', letter_playing=True) + '<div class="bubble">[ззз…]</div>' + S + word_cells() + S + pool(), "6 / 10")
hear = shot('<span class="step-n">1</span>Задание открылось', h1p, 'Слово звучит само', 'Картинка «дышит», пока звучит') + \
       shot('<span class="step-n">2</span>Тишина', h2p, 'Нажал на картинку — ещё раз', 'Значок волн — тихий, в углу') + \
       shot('<span class="step-n">3</span>Нужна опора', h3p, 'Нажал на букву — звучит звук', 'Только звук, не название: [ззз], не «зэ»')
compare = shot('Было: поезд', cmp1, '3 части на любое слово', 'Где «середина» в длинном слове — непонятно') + \
          shot('Стало: схема', cmp2, 'Клетка на каждый звук', 'Середина — любая внутренняя клетка')


def tray(letters, used=None, small=False):
    used = used or []
    return '<div class="tray">' + ''.join(f'<div class="tile {"ghost" if l in used else ""}">{l}</div>' for l in letters) + '</div>'

def mini(cells, label, sub):
    return f'<div class="mini">{scheme(cells)}<div class="lbl">{label}<small>{sub}</small></div></div>'

L = lambda ch, cls='': {'cls': cls, 'letter': ch, 'show': True}

# ---- matrix ----
matrix = f"""<table class="matrix">
<tr><th></th><th><span class="num">Б</span>Какая буква? <small style="font-weight:600;color:#6b7280">— тянем букву</small></th><th><span class="num b">Ф</span>Где звук? <small style="font-weight:600;color:#6b7280">— ставим фишку</small></th></tr>
<tr><td class="rowh">Начало</td>
 <td>{mini([{'cls':'ok','letter':'М','show':True},{'cls':'wide'}], '<span class="num">2</span>С какой буквы?', 'ваше упражнение · одна или три картинки')}</td>
 <td>{mini([{'cls':'ok','chip':'in'},{'cls':'wide'}], '<span class="num b">1</span>Звук в начале?', 'есть / нет · самое простое')}</td></tr>
<tr><td class="rowh">Конец</td>
 <td>{mini([{},{'cls':'off'},{'cls':'ok','letter':'Т','show':True}], '<span class="num">3</span>Какой буквой кончается?', 'последняя клетка')}</td>
 <td>{mini([{},{'cls':'off'},{'cls':'ok','chip':'in'}], '<span class="num b">4</span>Начало или конец?', 'внутренние закрыты')}</td></tr>
<tr><td class="rowh">Где угодно</td>
 <td>{mini([L('К'),L('О'),{}], '<span class="num">6</span>Все буквы по порядку', 'потолок, не в 1-й версии')}</td>
 <td>{mini([{},{},{'cls':'ok','chip':'in'},{}], '<span class="num b">5</span>Где звук?', 'любая клетка = «середина»')}</td></tr>
</table>"""

# ---- first letter: one picture ----
mak = lambda **k: target('М','🌺','м', **k)
def pic_only(emoji, playing=False):
    return pic(emoji, playing) + '<div class="instr" style="font-size:17px">С какой буквы?</div>'
a1 = phone(pic_only('🌺', True) + S + scheme([{'cls':'slot'},{'cls':'wide'}]) + S + tray(['С','М','Ш']), "1 / 10", "☆☆☆☆")
a2 = phone(pic_only('🌺') + S + scheme([{'cls':'bad','letter':'С','show':True},{'cls':'wide'}]) + S + tray(['С','М','Ш'], used=['С']), "1 / 10", "☆☆☆☆")
a3 = phone(pic_only('🌺') + S + scheme([{'cls':'ok','letter':'М','show':True},{'cls':'wide'}]) + S + tray(['С','М','Ш'], used=['М']), "1 / 10", "★☆☆☆")
a4 = phone(pic_only('🌺') + S + scheme([{'cls':'ok','letter':'М','show':True},{'cls':'fade','letter':'А','show':True},{'cls':'fade','letter':'К','show':True}]) + S + '<div class="instr" style="color:#16a34a;font-size:44px">✓</div>', "1 / 10", "★☆☆☆")
first = ''.join([
  shot('<span class="step-n">1</span>Слово звучит', a1, 'Под картинкой — пустая первая клетка', 'Три буквы — из пройденных'),
  shot('<span class="step-n">2</span>Не та буква', a2, 'С краснеет и уезжает обратно', 'Без штрафа, можно снова'),
  shot('<span class="step-n">3</span>Тянет М', a3, 'М встаёт в первую клетку', ''),
  shot('<span class="step-n">4</span>Слово дописывается', a4, 'Полоса делится на клетки: М А К', 'Та же проверка по слову, что у фишки'),
])

# ---- matching: three pictures ----
def mrow(emoji, cell):
    return f'<div class="mrow"><div class="picture">{emoji}</div>{scheme([cell, {"cls":"wide"}])}</div>'
m1 = phone('<div class="instr" style="font-size:17px">С какой буквы?</div>' +
  '<div class="match">' + mrow('🌺', {'cls':'ok','letter':'М','show':True}) + mrow('🧀', {'cls':'slot'}) + mrow('🎈', {}) + '</div>' + S +
  tray(['Ш','С','М'], used=['М']), "3 / 8", "★★☆☆")
match = shot('<span class="step-n">1</span>Разложи буквы', m1, 'Три картинки — три буквы', 'Нажал на картинку — звучит её слово') 

# ---- last letter ----
kot = phone(pic('🐱') + '<div class="instr" style="font-size:17px">Какой буквой кончается?</div>' + S +
  scheme([{}, {'cls':'off'}, {'cls':'slot'}]) + S + tray(['Т','К','М']), "4 / 10", "★★☆☆")
last = shot('<span class="num">3</span>Какой буквой кончается', kot, 'Открыта только последняя клетка', '')

goatq = target('З','🐐','з')
def kz(lit=None, done=(), chip=None, longlit=False):
    cells=[]
    for i in range(4):
        cls=[]
        if i==lit: cls.append('lit'); 
        if i==lit and longlit: cls.append('long')
        if i in done: cls.append('done')
        c={'cls':' '.join(cls)}
        if chip==i: c['chip']='in'; c['cls']+=' ok'
        cells.append(c)
    return scheme(cells)
SLOW = '<div class="slowbtn">🐢 медленно</div>'
o1 = phone(goatq + S + kz() + SLOW + S + pool(), "6 / 10")
o2 = phone(goatq + '<div class="say">к<i>…о…з…а</i></div>' + S + kz(lit=0) + SLOW + S + pool(), "6 / 10")
o3 = phone(goatq + '<div class="say"><i>к‑о‑</i>ззз<i>…а</i></div>' + S + kz(lit=2, done=(0,1), longlit=True) + SLOW + S + pool(), "6 / 10")
o4 = phone(goatq + '<div class="say"></div>' + S + kz(chip=2) + SLOW + S + pool(True), "6 / 10")
slow = ''.join([
  shot('<span class="step-n">1</span>Не знает, куда', o1, 'Нажимает «медленно» (или на схему)', ''),
  shot('<span class="step-n">2</span>«к…»', o2, 'Слово звучит по звукам', 'Клетка горит, пока звучит её звук'),
  shot('<span class="step-n">3</span>«ззз»', o3, 'Нужный звук — дольше и громче', 'Ребёнок видит, где он загорелся'),
  shot('<span class="step-n">4</span>Ставит фишку', o4, 'Туда, где горело «ззз»', 'Засчитывается как с подсказкой'),
])
fade = '''<div class="fade-ladder">
<div>Уровень А<small>медленно + клетки горят</small></div>
<div>Уровень Б<small>медленно, клетки не горят</small></div>
<div>Уровень В<small>только обычное слово</small></div></div>'''
BOARD = [('🏠','Д'),('🎈','Ш'),('🐱','К'),('🦊','Л'),('🧀','С'),('🚂','П'),('🐟','Р'),('🌺','М'),('👃','Н')]
def board(placed=None, bad=None, hover=None):
    placed = placed or {}
    out=[]
    for i,(e,l) in enumerate(BOARD):
        cls=''; ov=''
        if i in placed: cls='ok'; ov=f'<div class="ov">{placed[i]}</div>'
        if bad and bad[0]==i: cls='bad'; ov=f'<div class="ov">{bad[1]}</div>'
        if hover==i: cls='hover'
        out.append(f'<div class="lp {cls}">{e}{ov}</div>')
    return '<div class="lotto">'+''.join(out)+'</div>'
def ltray(letters, gone=(), drag=None):
    return '<div class="ltray">'+''.join(f'<div class="card {"gone" if l in gone else ""} {"drag" if l==drag else ""}">{l}</div>' for l in letters)+'</div>'
LET = ['Д','П','К','Л']
INS = '<div class="instr" style="font-size:17px">Положи букву на картинку</div>'
b1 = phone(INS + board() + S + ltray(LET), "1 / 3", "☆☆☆☆")
b2 = phone(INS + board(placed={0:'Д'}, hover=5) + S + ltray(LET, gone=['Д'], drag='П'), "1 / 3", "☆☆☆☆")
b3 = phone(INS + board(placed={0:'Д',5:'П'}, bad=(3,'К')) + S + ltray(LET, gone=['Д','П','К']), "1 / 3", "☆☆☆☆")
b4 = phone(INS + board(placed={0:'Д',5:'П',2:'К',3:'Л'}) + S + '<div class="instr" style="color:#16a34a;font-size:40px">✓</div>', "1 / 3", "★☆☆☆")
lotto = ''.join([
  shot('<span class="step-n">1</span>Поле', b1, '9 картинок, 4 буквы', 'Картинок больше, чем букв — не угадать «по остатку»'),
  shot('<span class="step-n">2</span>Тянет П', b2, 'Д уже лежит на домике', 'Картинка видна сквозь букву'),
  shot('<span class="step-n">3</span>Не туда', b3, 'К на лисе — краснеет, уезжает', 'Нажал на картинку — звучит слово'),
  shot('<span class="step-n">4</span>Всё разложено', b4, 'Следующее поле', ''),
])
legend2 = legend = """<div class="legend">
  <span><span class="cell slot"></span> сюда тянуть букву</span>
  <span><span class="cell off"></span> закрыто</span>
  <span><span class="chipdot"></span> фишка</span>
  <span><span class="cell ok"></span> верно</span>
  <span><span class="cell bad"></span> не та</span></div>"""

html = f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Буквы и звуки — система v03</title><style>{css}</style></head>
<body><div class="page">
<h1>Звук и буква в слове — одна система (v03)</h1>
<p class="lead">Один экран на всё: картинка, под ней клетки. Отличается только то, <b>что</b> ребёнок кладёт
(букву или фишку) и <b>какие</b> клетки открыты. Цифры — порядок ступеней.</p>
{legend2}
<h2 class="block">Карта: 6 ступеней</h2>{matrix}
<h2 class="block">Ступень 2 — «С какой буквы?» (ваше упражнение)</h2><div class="row">{first}</div>
<h2 class="block">Вариант ступени 2 (три картинки) и ступень 3</h2><div class="row">{match}{last}</div>
<h2 class="block">Лото «Буквы на картинки» — ваша настольная игра</h2>
<p class="block-note">Поле с картинками, прозрачные карточки букв. Буква ложится прямо на картинку, картинка остаётся видна.</p>
<div class="row">{lotto}</div>
<h2 class="block">Как ребёнок находит место звука — «слово по звукам»</h2>
<p class="block-note">Ребёнок не считает клетки и не пишет слово в уме. Приложение проговаривает слово медленно, протягивая звуки,
и клетки загораются по очереди — то, что логопед делает пальцем по схеме.</p>
<div class="row">{slow}</div>
<p class="block-note" style="margin-top:14px"><b>Опора убирается постепенно</b> (по ученику, не по ступени):</p>{fade}
<p class="block-note" style="margin-top:22px">Ступени с фишкой (1, 4, 5) и проверка по слову — в v02, без изменений.</p>
</div></body></html>"""
open('/home/user/mirocard/docs/mockups/letters-and-sounds/letters-and-sounds-v03.html', 'w').write(html)
