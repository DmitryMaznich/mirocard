import base64, os

FONTSOURCE = r"c:\Users\dmazn\Projects\Mirocard2\node_modules\@fontsource\nunito\files"

def b64font(subset, weight):
    path = os.path.join(FONTSOURCE, f"nunito-{subset}-{weight}-normal.woff")
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def face(weight, css_weight, style="normal"):
    srcs = ", ".join(
        f"url('data:font/woff;base64,{b64font(s, weight)}') format('woff')"
        for s in ["latin", "cyrillic"]
    )
    return f"""@font-face {{
  font-family: 'Nunito';
  font-weight: {css_weight};
  font-style: {style};
  src: {srcs};
}}"""

css_faces = face("400", "400") + "\n" + face("700", "700")

html = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
{css_faces}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{
  font-family: 'Nunito', sans-serif;
  font-size: 17pt;
  line-height: 1.7;
  color: #1a1a1a;
  padding: 22mm 22mm 20mm 22mm;
  background: white;
}}
h1 {{
  font-weight: 700;
  font-size: 22pt;
  line-height: 1.3;
  margin-bottom: 6mm;
  color: #111;
}}
hr {{
  border: none;
  border-top: 1.5px solid #b89030;
  margin-bottom: 6mm;
}}
p {{
  margin-bottom: 5mm;
}}
.final {{
  font-weight: 700;
  font-size: 20pt;
  color: #8c5a0a;
}}
@media print {{
  body {{ padding: 0; }}
}}
</style></head><body>
<h1>Как я делаю капучино</h1>
<hr>
<p>Сначала я взвешиваю кофейные зёрна — 17 граммов. Потом засыпаю их в кофемолку, подставляю холдер и нажимаю кнопку до тех пор, пока не наступит тишина. Потом беру темпер и утрамбовываю кофе в холдере. Вставляю холдер в кофемашину, ставлю чашку на весы, выставляю ноль и включаю пролив. Выключаю, когда весы показывают 30 граммов.</p>
<p>Ставлю питчер на весы. Наливаю в него примерно 150 граммов молока и взбиваю его паром до гладкой пены. Выключаю пар, когда питчер становится горячим на ощупь.</p>
<p>Беру питчер и стучу им по столу три раза, потом кручу его круговыми движениями. Повторяю, пока не исчезнут все пузыри.</p>
<p>Беру чашку с кофе в левую руку и немного кручу её. Потом плавно вливаю молоко в кофе.</p>
<p>Ставлю чашку на блюдце.</p>
<p class="final">Капучино готов! Наслаждайся!</p>
</body></html>"""

out = r"C:\Users\dmazn\OneDrive\Desktop\cappuccino.html"
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print("HTML:", out)
