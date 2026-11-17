base = open('docs/mockups/letters-and-sounds/base.css').read()
css = base + r"""
  .phone { width: 300px; height: 590px; } .shot { width: 300px; } .row { gap: 18px; } .page { max-width: 1320px; }
  .picture { width: 140px; height: 124px; font-size: 76px; }
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

def target(letter, emoji, sound, small=False):
    return f'''<div class="with-letter"><div class="big-letter" style="width:80px;height:80px;font-size:54px">{letter}</div>
  <div class="picture">{emoji}<div class="speaker">🔊</div></div></div>
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
l1 = phone(target('М','🌺','м') + S + scheme([{'cls':'ok','chip':'in'},{'cls':'wide'}]) + S + pool(True))
l2 = phone(target('Т','🐱','т') + S + scheme([{}, {'cls':'off'}, {'cls':'ok','chip':'in'}]) + S + pool(True))
l3 = phone(target('З','🐐','з') + S + scheme([{}, {}, {'cls':'ok','chip':'in'}, {}]) + S + pool(True))
l4 = phone('''<div class="picture">🐱<div class="speaker">🔊</div></div>
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
f1 = phone(goat + S + word_cells() + S + pool(), "6 / 10")
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
compare = shot('Было: поезд', cmp1, '3 части на любое слово', 'Где «середина» в длинном слове — непонятно') + \
          shot('Стало: схема', cmp2, 'Клетка на каждый звук', 'Середина — любая внутренняя клетка')

legend = '''<div class="legend">
  <span><span class="cell" style="border-radius:6px"></span> звук</span>
  <span><span class="cell off"></span> закрыто на этой ступени</span>
  <span><span class="chipdot"></span> фишка ребёнка</span>
  <span><span class="cell ok"></span> верно</span>
  <span><span class="cell bad"></span> не туда</span>
  <span>→ направление чтения</span></div>'''

html = f'''<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Буквы и звуки — звуковая схема v02</title><style>{css}</style></head>
<body><div class="page">
<h1>Звук в слове — схема Эльконина (v02)</h1>
<p class="lead">Вместо поезда — клетки: одна клетка = один звук. Ребёнок ставит фишку в клетку со звуком.
Буквенные режимы (найди букву, почини, найди все) — без изменений, в v01.</p>
{legend}
<h2 class="block">Сравнение</h2><div class="vs">{compare}</div>
<h2 class="block">Лестница: 4 ступени</h2><div class="row">{ladder}</div>
<h2 class="block">Проверка по слову — если верно</h2><div class="row">{story}</div>
<h2 class="block">Проверка по слову — если ошибся</h2><div class="row">{wrong}</div>
</div></body></html>'''
open('/home/user/mirocard/docs/mockups/letters-and-sounds/letters-and-sounds-v02.html', 'w').write(html)
