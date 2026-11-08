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
voice = arg("--voice", "en-US-AndrewMultilingualNeural")
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

def render_all(rate):
    res = []
    for si, idx in enumerate(sentences):
        out_rel = f"assets/voice/v{si:02d}.mp3"
        text = " ".join(spoken(groups[i]) for i in idx)
        for attempt in range(5):  # der Dienst antwortet gelegentlich leer
            try:
                b, d = asyncio.run(synth(text, rate, os.path.join(proj, out_rel)))
                if b: break
            except Exception as e:
                print(f"  Wiederholung Satz {si}: {e.__class__.__name__}")
        else:
            raise SystemExit(f"Satz {si} konnte nicht erzeugt werden")
        res.append((out_rel, b, d))
    return res

def total_len(res):
    return LEAD + sum(b[-1][1] + GAP for _, b, _ in res) - GAP + HOLD

rate = int(arg("--rate", "5"))
res = render_all(rate)
T = total_len(res)
new_rate = max(-10, min(30, int(round(rate + (T / target - 1) * 100))))
if abs(T - target) > 1.5 and new_rate != rate:
    rate = new_rate; res = render_all(rate); T = total_len(res)
print(f"Tempo {rate:+d}%, Länge {T:.2f}s")

# Sätze hintereinander legen, Wortzeiten auf Untertitelwörter verteilen
t = LEAD
audio_tags = []
for si, (idx, (out_rel, b, d)) in enumerate(zip(sentences, res)):
    start = round(t, 3)
    audio_tags.append(f'      <audio id="vo-{si:02d}" class="clip" src="{out_rel}" data-start="{start}" data-duration="{d - 0.01:.2f}" data-track-index="{20 + si % 2}" data-volume="1"></audio>')
    n_sp = [len(spoken(groups[i]).split()) for i in idx]
    ok = len(b) == sum(n_sp)
    k = 0
    for gi, i in enumerate(idx):
        cw = clean(groups[i]["text"]).split()
        if ok:
            bb = b[k:k + n_sp[gi]]
            times = [start + bb[int(j * len(bb) / len(cw))][0] for j in range(len(cw))]
        else:
            span = b[-1][1]; f0 = sum(n_sp[:gi]) / sum(n_sp); f1 = sum(n_sp[:gi + 1]) / sum(n_sp)
            times = [start + span * (f0 + (f1 - f0) * j / len(cw)) for j in range(len(cw))]
            print(f"  Satz {si}: Fallback-Zeiten")
        k += n_sp[gi]
        groups[i]["words"] = [round(x, 3) for x in times]
    t = start + b[-1][1] + GAP
T = round(t - GAP + HOLD, 2)
for i, g in enumerate(groups):
    s = round(max(0.05, g["words"][0] - 0.08), 3)
    e = round(groups[i + 1]["words"][0] - 0.08, 3) if i + 1 < len(groups) else T
    g["t"] = [s, e]
    g["words"] = [max(w, s) for w in g["words"]]
json.dump(data, open(sp, "w"), ensure_ascii=False, indent=1)

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
