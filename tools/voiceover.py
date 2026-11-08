#!/usr/bin/env python3
"""Deutsches Voiceover mit der Microsoft-Stimme "Andrew" (edge-tts). Die Stimme gibt den Takt vor.

Nutzung: python3 -I tools/voiceover.py videos/<projekt> [--voice en-US-AndrewMultilingualNeural] [--target 60]

1. Liest script.json: Gruppen mit "t" (geplante Zeit, wird beim ersten Lauf als "t0" gesichert),
   "text" (Untertitel, *Schlüsselwort*) und optional "say" (gesprochene Form, z. B. Zahlen ausgeschrieben).
2. Erzeugt je Satz (Ende bei . ? !) eine MP3 in assets/voice/ und legt die Sätze lückenlos hintereinander.
   Das Tempo wird global so gewählt, dass das Video etwa --target Sekunden lang wird.
3. Schreibt echte Wortzeiten nach script.json ("t", "words").
4. Verzerrt die Zeit aller Szenen stückweise linear (Anker = Gruppenstarts), damit jede Animation
   auf ihrem Wort landet: Szenen-Hosts, SFX und Root-Dauer in index.html, Warp-Block in jeder Szene.
Danach: node tools/build-captions.mjs videos/<projekt>
"""
import asyncio, json, os, re, ssl, subprocess, sys

import edge_tts
import edge_tts.communicate as ec

if os.path.exists("/root/.ccr/ca-bundle.crt"):  # Proxy-Zertifikat der Cloud-Umgebung
    ec._SSL_CTX = ssl.create_default_context(cafile="/root/.ccr/ca-bundle.crt")

proj = sys.argv[1]
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
voice = arg("--voice", "de-DE-FlorianMultilingualNeural")
target = float(arg("--target", "60"))
GAP, HOLD, LEAD = 0.22, 2.0, 0.15

sp = os.path.join(proj, "script.json")
data = json.load(open(sp))
groups = data["groups"]
for g in groups:
    g.setdefault("t0", g["t"])
old_end = max(g["t0"][1] for g in groups)
os.makedirs(os.path.join(proj, "assets", "voice"), exist_ok=True)

clean = lambda t: t.replace("*", "")
spoken = lambda g: g.get("say") or clean(g["text"])

sentences, cur = [], []
for i, g in enumerate(groups):
    cur.append(i)
    if re.search(r"[.?!]$", clean(g["text"]).strip()) or i == len(groups) - 1:
        sentences.append(cur); cur = []

async def synth(text, rate, out):
    c = edge_tts.Communicate(text, voice, rate=f"{rate:+d}%", boundary="WordBoundary")
    bounds = []
    with open(out, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                bounds.append((ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7))
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).decode())
    return bounds, dur

def synth_retry(text, rate, out):
    for attempt in range(6):  # der Dienst antwortet gelegentlich leer
        try:
            b, d = asyncio.run(synth(text, rate, out))
            if b: return b, d
        except Exception as e:
            print(f"  Wiederholung: {e.__class__.__name__}")
    raise SystemExit("Voiceover konnte nicht erzeugt werden")

# Ganzer Text in EINEM Durchgang (natürliche Betonung und Pausen)
full = " ".join(spoken(g) for g in groups)
out_rel = "assets/voice/vo.mp3"
for f in os.listdir(os.path.join(proj, "assets", "voice")):
    if f.endswith(".mp3"): os.remove(os.path.join(proj, "assets", "voice", f))
rate = int(arg("--rate", "0"))
b, d = synth_retry(full, rate, os.path.join(proj, out_rel))
T = LEAD + b[-1][1] + HOLD
new_rate = max(-10, min(25, int(round(rate + (T / target - 1) * 100))))
if abs(T - target) > 1.5 and new_rate != rate and "--rate" not in sys.argv:
    rate = new_rate; b, d = synth_retry(full, rate, os.path.join(proj, out_rel)); T = LEAD + b[-1][1] + HOLD
T = round(T, 2)
print(f"Stimme {voice}, Tempo {rate:+d}%, Länge {T}s")
audio_tags = [f'      <audio id="vo-00" class="clip" src="{out_rel}" data-start="{LEAD}" data-duration="{d - 0.01:.2f}" data-track-index="20" data-volume="1"></audio>']
n_sp = [len(spoken(g).split()) for g in groups]
ok = len(b) == sum(n_sp)
if not ok: print(f"  Hinweis: {len(b)} Wortmarken für {sum(n_sp)} Wörter, proportionale Zeiten")
k = 0
for gi, g in enumerate(groups):
    cw = clean(g["text"]).split()
    if ok:
        bb = b[k:k + n_sp[gi]]
        times = [LEAD + bb[int(j * len(bb) / len(cw))][0] for j in range(len(cw))]
    else:
        f0 = k / sum(n_sp); f1 = (k + n_sp[gi]) / sum(n_sp); span = b[-1][1]
        times = [LEAD + span * (f0 + (f1 - f0) * j / len(cw)) for j in range(len(cw))]
    k += n_sp[gi]
    g["words"] = [round(x, 3) for x in times]
for i, g in enumerate(groups):
    s0 = round(max(0.05, g["words"][0] - 0.08), 3)
    e = round(groups[i + 1]["words"][0] - 0.08, 3) if i + 1 < len(groups) else T
    g["t"] = [s0, e]
    g["words"] = [max(w, s0) for w in g["words"]]
json.dump(data, open(sp, "w"), ensure_ascii=False, indent=1)
sentences = [None]

# Globale Zeitverzerrung alt -> neu
anchors = [(0.0, 0.0)] + [(g["t0"][0], g["t"][0]) for g in groups] + [(old_end, T)]
anchors = sorted(set(anchors))
def warp(x):
    for (a0, b0), (a1, b1) in zip(anchors, anchors[1:]):
        if a0 <= x <= a1:
            return b0 + (b1 - b0) * (x - a0) / (a1 - a0) if a1 > a0 else b0
    return x - old_end + T

ip = os.path.join(proj, "index.html")
html = open(ip).read()
block = "<!-- VOICE START -->\n" + "\n".join(audio_tags) + "\n      <!-- VOICE END -->"
if "<!-- VOICE START -->" in html:
    html = re.sub(r"<!-- VOICE START -->.*?<!-- VOICE END -->", block, html, flags=re.S)
else:
    html = html.replace("    </div>\n    <script>", "      " + block + "\n    </div>\n    <script>", 1)

def retime(m):
    tag = m.group(0)
    if 'id="vo-' in tag or "data-start" not in tag or 'id="watermark"' in tag or 'id="root"' in tag or 'id="captions"' in tag:
        return tag
    if "data-orig-start" not in tag:
        os_ = re.search(r'data-start="([\d.]+)"', tag).group(1)
        od = re.search(r'data-duration="([\d.]+)"', tag)
        tag = tag.replace("data-start=", f'data-orig-start="{os_}" ' + (f'data-orig-duration="{od.group(1)}" ' if od else "") + "data-start=", 1)
    s0 = float(re.search(r'data-orig-start="([\d.]+)"', tag).group(1))
    od = re.search(r'data-orig-duration="([\d.]+)"', tag)
    ns = round(warp(s0), 3)
    tag = re.sub(r' data-start="[\d.]+"', f' data-start="{ns}"', tag)
    if od and "data-composition-src" in tag:
        nd = round(warp(s0 + float(od.group(1))) - ns, 3)
        tag = re.sub(r' data-duration="[\d.]+"', f' data-duration="{nd}"', tag)
        src = re.search(r'data-composition-src="([^"]+)"', tag).group(1)
        loc = [(a - s0, b - ns) for a, b in anchors if s0 <= a <= s0 + float(od.group(1))]
        loc = sorted(set([(0.0, 0.0)] + loc + [(float(od.group(1)), nd)]))
        loc = [(round(a, 3), round(b, 3)) for a, b in loc]
        cid = re.search(r'data-composition-id="([^"]+)"', tag).group(1)
        fp = os.path.join(proj, src)
        sc = open(fp).read()
        warp_js = ("/* WARP START */\n    (function () {\n      const tl = window.__timelines[\"%s\"].__src || window.__timelines[\"%s\"];\n"
                   "      const w = %s;\n      const o = gsap.timeline({ paused: true }); o.__src = tl;\n"
                   "      for (let i = 0; i < w.length - 1; i++) o.fromTo(tl, { time: w[i][0] }, { time: w[i + 1][0], duration: Math.max(0.001, w[i + 1][1] - w[i][1]), ease: \"none\", immediateRender: false }, w[i][1]);\n"
                   "      window.__timelines[\"%s\"] = o;\n    })();\n    /* WARP END */") % (cid, cid, json.dumps(loc), cid)
        if "/* WARP START */" in sc:
            sc = re.sub(r"/\* WARP START \*/.*?/\* WARP END \*/", warp_js, sc, flags=re.S)
        else:
            sc = sc.replace("  </script>\n</template>", "  </script>\n  <script>\n    " + warp_js + "\n  </script>\n</template>")
        open(fp, "w").write(sc)
    return tag

html = re.sub(r"<(?:div|audio) [^>]*data-start=[^>]*>", retime, html)
html = re.sub(r'(id="root" [^>]*data-duration=")[\d.]+', lambda m: m.group(1) + str(T), html)
html = re.sub(r'(id="(?:watermark|captions)" [^>]*data-duration=")[\d.]+', lambda m: m.group(1) + str(T), html)
open(ip, "w").write(html)
print(f"{len(sentences)} Sätze, Video {T}s, Szenen/SFX neu getaktet")
