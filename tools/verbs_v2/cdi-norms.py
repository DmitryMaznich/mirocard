# Russian MacArthur-Bates CDI norms for action words (Wordbank raw data, CC BY 4.0).
# Used for docs/verbs-research.md. Downloads only from raw.githubusercontent.com
# (the session proxy blocks wordbank.stanford.edu itself).
#
#   python3 -I tools/verbs_v2/cdi-norms.py <empty-dir>
#
# Prints, per action word: share of children who SAY it (WS form, 18-36 months)
# and who UNDERSTAND it (WG form, 8-18 months).
import sys, os, urllib.request, urllib.parse
import pandas as pd

BASE = 'https://raw.githubusercontent.com/langcog/wordbank/master/raw_data/'
FILES = {
    'WS': ['RussianWS_CLEX_data.csv', 'RussianWS_CLEX_fields.csv', '[Russian_WS].csv'],
    'WG': ['RussianWG_CLEX_data.csv', 'RussianWG_CLEX_fields.csv', '[Russian_WG].csv'],
}
out = sys.argv[1]
os.makedirs(out, exist_ok=True)


def load(form):
    paths = []
    for name in FILES[form]:
        p = os.path.join(out, name)
        if not os.path.exists(p):
            urllib.request.urlretrieve(BASE + f'Russian_{form}/' + urllib.parse.quote(name), p)
        paths.append(p)
    data, fields, items = (pd.read_csv(p) for p in paths)
    col = dict(zip(fields.field, fields.column))
    items = items[(items.type == 'word') & (items.category == 'action_words')]
    return data, col, items


def share(data, col, items, bands, threshold):
    rows = []
    for _, it in items.iterrows():
        c = col.get(it.itemID)
        if c not in data:
            continue
        y = pd.to_numeric(data[c], errors='coerce').fillna(0)
        row = {'word': it.definition}
        for label, (lo, hi) in bands.items():
            row[label] = (y[(data.month >= lo) & (data.month <= hi)] >= threshold).mean()
        rows.append(row)
    return pd.DataFrame(rows).set_index('word')


ws = share(*load('WS'), {'say_18_20': (18, 20), 'say_24_26': (24, 26), 'say_30_32': (30, 32)}, 1)
# WG coding: 0 none, 1 understands, 2 understands and says
wg = share(*load('WG'), {'und_12_14': (12, 14), 'und_16_18': (16, 18)}, 1)
table = ws.join(wg, how='outer').sort_values('say_24_26', ascending=False)
pd.set_option('display.width', 200)
pd.set_option('display.max_rows', 300)
print(table.round(2).to_string())
