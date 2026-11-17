# Лист покрытия словаря: по каждой букве — слова для первой буквы, начала, середины, конца.
import json, os
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '..', '..'))
words = json.load(open(os.path.join(here, 'words.json')))['words']
ABC = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'
IMPOSSIBLE = {
  ('Б','end'):'оглушается',('В','end'):'оглушается',('Г','end'):'оглушается',('Д','end'):'оглушается',
  ('Ж','end'):'оглушается',('З','end'):'оглушается',
  ('Ы','start'):'слов нет',('Ы','first'):'слов нет',
  ('Э','middle'):'почти не бывает',('Э','end'):'почти не бывает',('Щ','middle'):'знакомых слов нет',
}
for L in 'ЕЁЮЯ':
    for p in ('start','middle','end'): IMPOSSIBLE[(L,p)] = 'буква ≠ звук'
for L in 'ЪЬ':
    for p in ('first','start','middle','end'): IMPOSSIBLE[(L,p)] = 'нет звука'
def chip(w, extra=''):
    cls = 'c'
    if w['only'] == 'letter': cls += ' let'
    elif w['only'] == 'lotto': cls += ' lot'
    t = f' title="{w["note"]}"' if w['note'] else ''
    return f'<span class="{cls}"{t}>{w["word"]}{extra}</span>'
rows = []
tot = {'first':0,'start':0,'middle':0,'end':0}
for L in ABC:
    cols = {}
    cols['first'] = [w for w in words if w['firstLetter'] == L]
    for p in ('start','middle','end'):
        cols[p] = [w for w in words if any(t['letter']==L and t['position']==p for t in w['targets'])]
    tds = []
    for p in ('first','start','middle','end'):
        ws = cols[p]; n = len(ws); tot[p] += n
        if (L,p) in IMPOSSIBLE and n == 0:
            tds.append(f'<td class="na">{IMPOSSIBLE[(L,p)]}</td>'); continue
        need = 3 if p in ('first','start') else 2
        cls = 'ok' if n >= need else ('low' if n else 'zero')
        tds.append(f'<td class="{cls}"><b>{n}</b> ' + ''.join(chip(w) for w in ws) + '</td>')
    rows.append(f'<tr><th>{L}</th>' + ''.join(tds) + '</tr>')
html = f'''<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Буквы и звуки — словарь v02</title><style>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
body{{margin:0;font-family:Nunito,sans-serif;background:#f3f1ea;color:#1f2937}}
.page{{max-width:1320px;margin:0 auto;padding:24px 18px 60px}}
h1{{margin:0 0 6px;font-size:26px}} p{{margin:0 0 14px;color:#4b5563;line-height:1.5;max-width:980px}}
table{{border-collapse:separate;border-spacing:4px;width:100%}}
th{{font-size:26px;font-weight:900;width:46px;text-align:center}}
thead th{{font-size:14px;font-weight:800;color:#374151;text-align:left;padding:4px 6px}}
td{{background:#fff;border-radius:10px;padding:6px 8px;vertical-align:top;font-size:14px;line-height:1.9}}
td b{{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:6px;font-size:12px;margin-right:4px;vertical-align:middle}}
td.ok b{{background:#dcfce7;color:#15803d}} td.low{{background:#fffbeb}} td.low b{{background:#fde68a;color:#92400e}}
td.zero{{background:#fef2f2}} td.zero b{{background:#fecaca;color:#b91c1c}}
td.na{{background:transparent;border:2px dashed #d6d3cb;color:#9ca3af;font-size:13px}}
.c{{display:inline-block;padding:0 8px;margin:2px 3px 2px 0;border-radius:99px;background:#eef2f7;font-weight:700;line-height:24px}}
.c.let{{background:#ffedd5;color:#9a3412}} .c.lot{{background:#e5e7eb;color:#6b7280}}
.c[title]{{text-decoration:underline dotted #94a3b8}}
.legend span{{margin-right:14px;font-size:14px;font-weight:700}}
</style></head><body><div class="page">
<h1>Словарь «Буквы и звуки» — v02, {len(words)} слов</h1>
<p>Слова подобраны так, чтобы <b>звук совпадал с буквой</b>: твёрдый звук, без оглушения на конце, ударная гласная,
буква в слове один раз. Наведите на подчёркнутое слово — там пометка.</p>
<p class="legend"><span><span class="c">кот</span> годится везде</span><span><span class="c let">ёлка</span> только «с какой буквы» (Е Ё Ю Я = два звука)</span>
<span><span class="c lot">мышь</span> только первая буква (ь — клетки не совпадут)</span>
<span style="color:#15803d">■ хватает</span><span style="color:#b45309">■ мало</span><span style="color:#b91c1c">■ нет</span></p>
<table><thead><tr><th></th><th>Первая буква<br><small>лото, «С какой буквы?»</small></th><th>Звук в начале</th><th>Звук в середине</th><th>Звук в конце</th></tr></thead>
{''.join(rows)}</table></div></body></html>'''
out = os.path.join(root, 'docs/mockups/letters-and-sounds/words-v02.html')
open(out, 'w').write(html)
print('written', tot)
