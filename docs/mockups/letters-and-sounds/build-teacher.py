# Чистая версия макетов для учителя. Берёт функции и стили из build-v03.py.
import os
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'build-v03.py')).read()
src = src.replace("open('/home/user/mirocard/docs/mockups/letters-and-sounds/letters-and-sounds-v03.html', 'w').write(html)", "")
src = src.replace("docs/mockups/letters-and-sounds/base.css", os.path.join(here, 'base.css'))
exec(src)

css2 = css + r"""
  .page { max-width: 1320px; }
  h1 { font-size: 30px; }
  .lead { font-size: 16px; }
  .sec { margin-top: 42px; padding-top: 6px; border-top: 2px solid #d9d4c8; }
  .sec h2 { margin: 18px 0 6px; font-size: 23px; }
  .sec p.intro { margin: 0 0 18px; color: #4b5563; font-size: 15.5px; line-height: 1.5; max-width: 860px; }
  .board-s { width: 240px; height: 240px; border-radius: 14px; background-color: #fff;
    background-image: linear-gradient(#dbe7f3 1px, transparent 1px), linear-gradient(90deg, #dbe7f3 1px, transparent 1px);
    background-size: 24px 24px; border: 2px solid #e2e8f0; }
  .qs { background: #fff; border-radius: 16px; padding: 18px 22px; max-width: 860px; font-size: 15.5px; line-height: 1.6; }
  .qs ol { margin: 6px 0 0; padding-left: 22px; }
  .qs li { margin-bottom: 6px; }
  .shot h3 { min-height: 30px; display: flex; align-items: center; }
  .adult .screen { background: #f7f6f2; }
  .adult .stage { align-items: stretch; gap: 10px; padding: 12px; }
  .adult .abc { grid-template-columns: repeat(7, 1fr); }
"""

# ---------- 1. Пройденные буквы ----------
on = set('АУОМСХШЫ')
vow = set('АЕЁИОУЫЭЮЯ')
abc = ''.join(f'<span class="{"on" if l in on else ""} {"v" if l in vow else ""}">{l}</span>' for l in 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ')
adult = f'''<div class="phone adult"><div class="screen">
  <div class="topbar"><span>← Буквы и звуки</span><span>Ученик</span></div>
  <div class="stage">
    <div class="sect">Группы</div>
    <div class="groups"><span class="on">А У О М С</span><span class="on">Х Ш Ы</span><span>Л Н Р</span><span>К П Т И</span><span>…</span></div>
    <div class="sect">Пройденные буквы — 8</div>
    <div class="abc">{abc}</div>
    <div class="spacer"></div>
    <div class="btn">Начать</div>
  </div></div></div>'''
sec1 = shot('Выбор букв', adult, 'Отмечаете буквы, которые ученик прошёл', 'Целой группой или по одной. Все игры берут только их.')

# ---------- 2. Буква ----------
fa = phone('''<div class="instr">Найди букву</div>
  <div class="target"><div class="big-letter tap">Ш''' + WAVE + '''</div></div><div class="spacer"></div>
  <div class="tiles c3"><div class="tile">М</div><div class="tile bad">Щ</div><div class="tile">С</div>
  <div class="tile ok">Ш</div><div class="tile">Х</div><div class="tile">И</div></div><div class="spacer"></div>''', "4 / 10", "★★★☆")
fix = phone('''<div class="instr">Почини букву</div><div class="spacer"></div><div class="board-s">
  <svg viewBox="0 0 300 300" width="240" height="240">
  <g stroke="#e2e8f0" stroke-width="16" stroke-linecap="round" fill="none"><line x1="105" y1="60" x2="105" y2="240"/><line x1="105" y1="150" x2="195" y2="60"/><line x1="105" y1="150" x2="195" y2="240"/></g>
  <line x1="105" y1="60" x2="105" y2="240" stroke="#1f2937" stroke-width="14" stroke-linecap="round"/>
  <line x1="170" y1="200" x2="250" y2="130" stroke="#1f2937" stroke-width="14" stroke-linecap="round"/>
  <line x1="140" y1="40" x2="240" y2="70" stroke="#3b82f6" stroke-width="14" stroke-linecap="round"/>
  <circle cx="190" cy="55" r="9" fill="#3b82f6"/></svg></div><div class="spacer"></div>''', "3 / 8", "★★☆☆")
fld = 'СОАУСМУСОАОХМАСУАШУОМСУХМ'
circ = {1, 8}
findall = phone('''<div class="target"><div class="big-letter tap" style="width:74px;height:74px;font-size:50px">О''' + WAVE + '''</div></div>
  <div class="counter"><i class="on"></i><i class="on"></i><i></i><i></i></div>
  <div class="field">''' + ''.join(f'<span class="{"circ" if i in circ else ""}">{c}</span>' for i, c in enumerate(fld)) + '</div>', "1 / 5", "☆☆☆☆")
sec2 = ''.join([
  shot('Найди букву', fa, 'Среди 3–6 букв', 'Сначала непохожие, потом похожие: Ш — Щ — И'),
  shot('Почини букву', fix, 'Части буквы сдвинуты — вернуть на место', 'Деталь «примагничивается». Легко / Средне / Трудно'),
  shot('Найди все', findall, 'Найти все О на поле', 'Кружки сверху — сколько осталось'),
])

# ---------- 3. Карта ----------
matrix = f"""<table class="matrix">
<tr><th></th><th><span class="num b">Ф</span>Где звук? <small style="font-weight:600;color:#6b7280">— ребёнок ставит фишку</small></th><th><span class="num">Б</span>Какая буква? <small style="font-weight:600;color:#6b7280">— ребёнок тянет букву</small></th></tr>
<tr><td class="rowh">Начало</td>
 <td>{mini([{'cls':'ok','chip':'in'},{'cls':'wide'}], '<span class="num b">1</span>Звук в начале?', 'самое простое')}</td>
 <td>{mini([{'cls':'ok','letter':'М','show':True},{'cls':'wide'}], '<span class="num">2</span>С какой буквы?', 'одна картинка или лото')}</td></tr>
<tr><td class="rowh">Конец</td>
 <td>{mini([{},{'cls':'off'},{'cls':'ok','chip':'in'}], '<span class="num b">4</span>Начало или конец?', 'внутренние клетки закрыты')}</td>
 <td>{mini([{},{'cls':'off'},{'cls':'ok','letter':'Т','show':True}], '<span class="num">3</span>Какой буквой кончается?', 'последняя клетка')}</td></tr>
<tr><td class="rowh">Где угодно</td>
 <td>{mini([{},{},{'cls':'ok','chip':'in'},{}], '<span class="num b">5</span>Где звук?', 'середина — любая внутренняя клетка')}</td>
 <td>{mini([L('К'),L('О'),{}], '<span class="num">6</span>Все буквы по порядку', 'самый высокий уровень')}</td></tr>
</table>"""

# ---------- 4. Ступени ----------
def cells_word(word, chip=None, show=False, ok=None, bad=None, here=None, lit=None, done=()):
    out = []
    for i, ch in enumerate(word):
        c = {'cls': ''}
        if show: c['letter'] = ch; c['show'] = True
        cls = []
        if ok == i: cls.append('ok')
        if bad == i: cls.append('bad')
        if here == i: cls.append('here')
        if lit == i: cls += ['lit', 'long']
        if i in done: cls.append('done')
        c['cls'] = ' '.join(cls)
        if chip == i: c['chip'] = 'in' if not show else ('bad' if bad == i else 'top')
        if here == i: c['mark'] = '👆'
        out.append(c)
    return scheme(out)

def tq(letter, emoji, sound, **k):
    return target(letter, emoji, sound, **k)

s1 = phone(tq('М', '🌺', 'м', playing=True) + S + scheme([{'cls':'ok','chip':'in'},{'cls':'wide'}]) + S + pool(True), "2 / 10", "★☆☆☆")
st1 = shot('<span class="step-n">1</span>Звук в начале?', s1, 'Фишка — в первую клетку или в полосу', 'Слово звучит само')

st2 = ''.join([
  shot('<span class="step-n">2</span>С какой буквы?', a1, 'Пустая первая клетка, три буквы', 'Буквы — только пройденные'),
  shot('&nbsp;', a2, 'Не та буква краснеет и возвращается', ''),
  shot('&nbsp;', a3, 'Нужная встаёт в клетку', ''),
  shot('&nbsp;', a4, 'Слово дописывается: М А К', 'Видно, что М — действительно первая'),
])
lot = ''.join([
  shot('Лото: буквы на картинки', b1, 'Поле картинок, прозрачные буквы', 'Картинок больше, чем букв'),
  shot('&nbsp;', b2, 'Буква ложится на картинку', 'Картинка видна сквозь букву'),
  shot('&nbsp;', b4, 'Всё разложено — следующее поле', ''),
])
kotp = phone(pic('🐱') + '<div class="instr" style="font-size:17px">Какой буквой кончается?</div>' + S +
  scheme([{}, {'cls':'off'}, {'cls':'ok','letter':'Т','show':True}]) + S + tray(['Т','К','М'], used=['Т']), "4 / 10", "★★☆☆")
s4 = phone(tq('С', '👃', 'с') + S + scheme([{}, {'cls':'off'}, {'cls':'ok','chip':'in'}]) + S + pool(True), "5 / 10", "★★☆☆")
mid = ''.join([
  shot('<span class="step-n">3</span>Какой буквой кончается?', kotp, 'Открыта только последняя клетка', ''),
  shot('<span class="step-n">4</span>Начало или конец?', s4, 'Внутренние клетки закрыты', ''),
])
NG = 'НОГА'
g = lambda **k: tq('Г', '🦵', 'г', **k)
st5 = ''.join([
  shot('<span class="step-n">5</span>Где звук?', phone(g(playing=True) + S + cells_word(NG) + S + pool(), "6 / 10"), 'Клетка на каждый звук', 'Середина — любая внутренняя клетка'),
  shot('&nbsp;', phone(g() + S + cells_word(NG, chip=2) + S + pool(True), "6 / 10"), 'Фишка — в третью клетку', ''),
  shot('&nbsp;', phone(g() + S + cells_word(NG, chip=2, show=True) + S + pool(True), "6 / 10"), 'В клетках появляется слово', ''),
  shot('&nbsp;', phone(g() + S + cells_word(NG, chip=2, show=True, ok=2) + S + '<div class="instr" style="color:#16a34a;font-size:44px">✓</div>', "6 / 10", "★★★★"), 'Под фишкой — Г. Верно', ''),
])
wrong5 = ''.join([
  shot('Если ошибся', phone(g() + S + cells_word(NG, chip=1, show=True, bad=1, here=2) + S, "6 / 10"), 'Показываем, где звук', 'Без наказания: это объяснение'),
  shot('&nbsp;', phone(g() + S + cells_word(NG, chip=2) + S + pool(True), "6 / 10"), 'Ребёнок сам переставляет фишку', ''),
])
SLOWB = '<div class="slowbtn">🐢 медленно</div>'
slow = ''.join([
  shot('Опора: слово по звукам', phone(g() + S + cells_word(NG, lit=0) + SLOWB + S + pool(), "6 / 10"), 'Слово звучит медленно, по звукам', 'Клетка горит, пока звучит её звук'),
  shot('&nbsp;', phone(g() + S + cells_word(NG, lit=2, done=(0,1)) + SLOWB + S + pool(), "6 / 10"), 'Нужный звук — протяжнее', 'Ребёнок видит, где он прозвучал'),
])
st6 = shot('<span class="step-n">6</span>Все буквы по порядку', l4, 'Самый высокий уровень', 'Позже, после первых ступеней')

# ---------- Звук ----------
snd = ''.join([
  shot('Слово', phone(g(playing=True) + S + cells_word(NG) + S + pool(), "6 / 10"), 'Звучит само, когда появилось задание', 'Нажать на картинку — ещё раз'),
  shot('Звук буквы', phone(target('Г','🦵','г', letter_playing=True) + S + cells_word(NG) + S + pool(), "6 / 10"), 'Звучит по нажатию на букву', 'Звук, а не название: [г], а не «гэ»'),
])

qs = '''<div class="qs"><b>Хотелось бы узнать ваше мнение</b><ol>
<li>Кто ваши ученики: возраст, говорят ли, читают ли? От этого зависит, сколько вариантов показывать сразу.</li>
<li>В каком порядке вы проходите буквы (по какому букварю)? Так мы соберём группы букв.</li>
<li>Какие игры из блока «Буква» вам ближе всего? Чего не хватает?</li>
<li>Порядок ступеней в блоке «Звук и буква» — такой подходит?</li>
<li>Твёрдые и мягкие звуки ([л] и [л’]) на первых ступенях считаем одним звуком или разными?</li>
<li>Звуки букв лучше записать живым голосом (синтез не умеет правильно произносить [б], [т], [к]). Согласились бы вы записать около 30 коротких звуков?</li>
<li>Работают ли дети сами на планшете или с вами рядом?</li>
</ol></div>'''

html = f'''<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Буквы и звуки — набросок игры</title><style>{css2}</style></head>
<body><div class="page">
<h1>Буквы и звуки — набросок игры</h1>
<p class="lead">По вашей просьбе: повторение пройденных букв и звуков. Это картинки экранов, ещё не готовая игра.
Картинки-эмодзи — временные, в игре будут нормальные иллюстрации или фото.</p>

<div class="sec"><h2>1. Пройденные буквы</h2>
<p class="intro">Вы отмечаете, какие буквы ученик уже прошёл. Все игры дальше используют только эти буквы.</p>
<div class="row">{sec1}</div></div>

<div class="sec"><h2>2. Буква</h2>
<p class="intro">Узнать букву, собрать её из частей, найти среди многих. Нажать на букву — прозвучит её звук.</p>
<div class="row">{sec2}</div></div>

<div class="sec"><h2>3. Звук и буква в слове</h2>
<p class="intro">Под картинкой — клетки: одна клетка = один звук (звуковая схема). Ребёнок кладёт в клетку
<b>фишку</b>, когда вопрос «где звук?», или <b>букву</b>, когда вопрос «какая буква?». Шесть ступеней от простого к сложному:</p>
{matrix}</div>

<div class="sec"><h2>Ступень 1</h2><div class="row">{st1}</div></div>
<div class="sec"><h2>Ступень 2</h2><div class="row">{st2}</div>
<p class="intro" style="margin-top:20px">То же самое в виде игры-лото:</p><div class="row">{lot}</div></div>
<div class="sec"><h2>Ступени 3 и 4</h2><div class="row">{mid}</div></div>
<div class="sec"><h2>Ступень 5 — звук в любом месте слова</h2><div class="row">{st5}</div>
<div class="row" style="margin-top:20px">{wrong5}{slow}</div></div>
<div class="sec"><h2>Ступень 6</h2><div class="row">{st6}</div></div>

<div class="sec"><h2>Что звучит</h2><div class="row">{snd}</div></div>

<div class="sec"><h2>Вопросы</h2>{qs}</div>
</div></body></html>'''
open(os.path.join(here, 'letters-and-sounds-teacher.html'), 'w').write(html)
