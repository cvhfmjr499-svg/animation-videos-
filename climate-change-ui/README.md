# Klimawandel – UI-Motion-Film (16:9, 20 s)

Erklärvideo im Stil moderner Produkt-Launch-Filme: schwebende UI-Karten, große Zahlen mit Serif-Kursive,
Regenbogen-Suchleiste, Lichtspuren, helle App-Ansichten. 1920×1080, 30 fps, synthetisierter Soundtrack.

▶ **Video:** [`out/klimawandel-ui.mp4`](out/klimawandel-ui.mp4) · Storyboard: [`out/storyboard.png`](out/storyboard.png)

| Zeit | Szene |
|---|---|
| 0–3 s | Kamera fliegt durch eine Wolke aus Klima-UI-Karten (Hitzewarnung, Waldbrände, CO₂-Chart, Meeresspiegel …) |
| 3–6,6 s | „Jeden Tag stößt die Menschheit **102.000.000** *Tonnen CO₂ aus.*“ |
| 6,6–9,4 s | Regenbogen-Suchleiste tippt „Was ist der Klimawandel?“ |
| 9,4–12,4 s | Lichtspuren: „Die Erde ist heute **+1,3 °C** *wärmer.*“ |
| 12,4–16,8 s | Helle UI: Erklärung + **424 ppm** CO₂ → Temperatur seit 1880 → Folgen (Hitze, Dürre, Waldbrände, Fluten, Eisschmelze, Stürme) |
| 16,8–20 s | Suchleiste wird zur Linie → „**max. 1,5 °C** – *Jedes Zehntelgrad zählt.*“ |

## Rendern

```bash
node audio.cjs     # → out/soundtrack.wav
node render.cjs    # → out/klimawandel-ui.mp4  (Playwright + ffmpeg)
node render.cjs --stills 3.5,10.5   # Einzelbilder
```

`index.html` öffnen für die Live-Vorschau (Klick = Play/Pause, ←/→ = scrubben).
Schrift *Instrument Serif* liegt unter `fonts/` (SIL Open Font License).
