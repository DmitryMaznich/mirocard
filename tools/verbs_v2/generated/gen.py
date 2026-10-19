import json, base64, os, sys, urllib.request, time
MODEL = "gemini-3-pro-image"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
def generate(prompt, out, refs=()):
    parts = [{"text": prompt}]
    for r in refs:
        parts.append({"inlineData": {"mimeType": "image/png", "data": base64.b64encode(open(r, "rb").read()).decode()}})
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "1:1"}}}
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                d = json.load(r)
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if e.code in (429, 500, 503) and attempt < 2: time.sleep(10 * (attempt + 1)); continue
            raise SystemExit(f"HTTP {e.code}: {msg}")
    for c in d.get("candidates", []):
        for p in c.get("content", {}).get("parts", []):
            if "inlineData" in p:
                open(out, "wb").write(base64.b64decode(p["inlineData"]["data"]))
                return out
    raise SystemExit("no image: " + json.dumps(d)[:400])
if __name__ == "__main__":
    spec = json.load(open(sys.argv[1]))
    for item in spec:
        print(generate(item["prompt"], item["out"], item.get("refs", [])), flush=True)
