"""
Generate a print-ready PDF for the cappuccino story using Nunito font.
Converts WOFF → TTF on the fly (struct + zlib, no extra deps).
Uses fpdf2 fallback font mechanism to combine Latin + Cyrillic subsets.
"""
import struct, zlib, os, tempfile, ctypes, ctypes.wintypes
from fpdf import FPDF

# ── Story ─────────────────────────────────────────────────────────────────────

TITLE = "Как я делаю капучино"

PARAGRAPHS = [
    "Сначала я взвешиваю кофейные зёрна — 17 граммов. Потом засыпаю их в кофемолку, "
    "подставляю холдер и нажимаю кнопку до тех пор, пока не наступит тишина. "
    "Потом беру темпер и утрамбовываю кофе в холдере. Вставляю холдер в кофемашину, "
    "ставлю чашку на весы, выставляю ноль и включаю пролив. "
    "Выключаю, когда весы показывают 30 граммов.",

    "Потом наливаю в питчер примерно 150 граммов молока и взбиваю его паром "
    "до гладкой пены. Выключаю пар, когда питчер становится горячим на ощупь.",

    "Беру питчер и стучу им по столу три раза, потом кручу его круговыми движениями. "
    "Повторяю, если молоко ещё не стало однородным и блестящим.",

    "Беру чашку с кофе в левую руку и немного кручу её. "
    "Потом плавно вливаю молоко в кофе.",

    "Ставлю чашку на блюдце.",

    "Капучино готов!",
]

# ── WOFF → TTF (built-ins only) ───────────────────────────────────────────────

def woff_to_ttf(woff_path):
    with open(woff_path, "rb") as f:
        data = f.read()
    if struct.unpack_from(">I", data, 0)[0] != 0x774F4646:
        raise ValueError(f"Not a WOFF file: {woff_path}")

    flavor    = struct.unpack_from(">I", data, 4)[0]
    numTables = struct.unpack_from(">H", data, 12)[0]

    tables = []
    for i in range(numTables):
        tag, off, compLen, origLen, checksum = struct.unpack_from(">IIIII", data, 44 + i * 20)
        chunk = data[off : off + compLen]
        if compLen < origLen:
            chunk = zlib.decompress(chunk)
        tables.append((tag, origLen, checksum, chunk))

    tables.sort(key=lambda t: t[0])
    n = len(tables)
    sr = 1
    while sr * 2 <= n:
        sr *= 2
    es = sr.bit_length() - 1
    rs = n * 16 - sr * 16
    sr *= 16

    header_size = 12 + n * 16
    offsets, cur = [], header_size
    for _, origLen, _, _ in tables:
        offsets.append(cur)
        cur += (origLen + 3) & ~3

    out = bytearray()
    out += struct.pack(">IHHHH", flavor, n, sr, es, rs)
    for (tag, origLen, checksum, _), off in zip(tables, offsets):
        out += struct.pack(">IIII", tag, checksum, off, origLen)
    for _, origLen, _, chunk in tables:
        out += chunk
        out += b"\x00" * ((4 - len(chunk) % 4) % 4)
    return bytes(out)


# ── Convert fonts ─────────────────────────────────────────────────────────────

FONTSOURCE = r"c:\Users\dmazn\Projects\Mirocard2\node_modules\@fontsource\nunito\files"
tmpdir = tempfile.mkdtemp()

fonts = {
    ("latin",    "400"): "NunitoLat",
    ("latin",    "700"): "NunitoLat-Bold",
    ("cyrillic", "400"): "NunitoCyr",
    ("cyrillic", "700"): "NunitoCyr-Bold",
}

ttf_paths = {}
for (subset, weight), alias in fonts.items():
    src  = os.path.join(FONTSOURCE, f"nunito-{subset}-{weight}-normal.woff")
    dest = os.path.join(tmpdir, f"{alias}.ttf")
    with open(dest, "wb") as f:
        f.write(woff_to_ttf(src))
    ttf_paths[alias] = dest
    print(f"  {alias}.ttf OK")

# ── Build PDF ─────────────────────────────────────────────────────────────────

# Output path — OneDrive Desktop on this machine
_buf = ctypes.create_unicode_buffer(ctypes.wintypes.MAX_PATH)
ctypes.windll.shell32.SHGetFolderPathW(None, 0x0010, None, 0, _buf)
OUT = os.path.join(_buf.value, "cappuccino.pdf")

MM = 2.834645669  # 1 mm in PDF points
W, H = 210 * MM, 297 * MM
ML = MR = 22 * MM
MT = 24 * MM

pdf = FPDF(unit="pt", format="A4")
pdf.set_margins(ML, MT, MR)
pdf.set_auto_page_break(auto=True, margin=20 * MM)
pdf.add_page()

# Register fonts: Latin (primary) + Cyrillic (fallback)
pdf.add_font("Nunito",      fname=ttf_paths["NunitoLat"])
pdf.add_font("Nunito",      style="B", fname=ttf_paths["NunitoLat-Bold"])
pdf.add_font("NunitoCyr",   fname=ttf_paths["NunitoCyr"])
pdf.add_font("NunitoCyr",   style="B", fname=ttf_paths["NunitoCyr-Bold"])
pdf.set_fallback_fonts(["NunitoCyr"])

LINE_H_BODY  = 26   # pt
LINE_H_TITLE = 34   # pt
BODY_SIZE    = 17
TITLE_SIZE   = 22

# Title
pdf.set_font("Nunito", style="B", size=TITLE_SIZE)
pdf.set_text_color(30, 30, 30)
pdf.multi_cell(0, LINE_H_TITLE, TITLE, align="L")
pdf.ln(4 * MM)

# Divider
pdf.set_draw_color(180, 145, 60)
pdf.set_line_width(1.2)
pdf.line(ML, pdf.get_y(), W - MR, pdf.get_y())
pdf.ln(5 * MM)

# Body paragraphs
for i, para in enumerate(PARAGRAPHS):
    is_last = i == len(PARAGRAPHS) - 1
    if is_last:
        pdf.set_font("Nunito", style="B", size=20)
        pdf.set_text_color(140, 88, 10)
    else:
        pdf.set_font("Nunito", size=BODY_SIZE)
        pdf.set_text_color(25, 25, 25)
    pdf.multi_cell(0, LINE_H_BODY, para, align="L")
    pdf.ln(5 * MM if not is_last else 0)

pdf.output(OUT)
print(f"\nСохранено: {OUT}")
