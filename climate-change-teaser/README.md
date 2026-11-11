# Klimawandel in 15 Sekunden

Dynamisches Motion-Graphics-Erklärvideo (1920×1080, 30 fps, mit synthetisiertem Soundtrack).

▶ **Video:** [`out/klimawandel-15s.mp4`](out/klimawandel-15s.mp4) · Storyboard: [`out/storyboard.png`](out/storyboard.png)

| Zeit | Szene | Aussage |
|---|---|---|
| 0–3 s | Sonne → Erde | Sonnenlicht wärmt die Erde, ein Teil der Wärme strahlt zurück ins All. |
| 3–6 s | Schornsteine, CO₂-Moleküle | Wir verbrennen Kohle, Öl und Gas → CO₂ steigt von 280 auf über 420 ppm. |
| 6–9 s | Wärmestrahlen prallen ab | CO₂ hält die Wärme fest – wie eine Decke. Die Erde erwärmt sich: +1,3 °C seit 1850. |
| 9–12 s | 4 Karten | Die Folgen: Hitzewellen, Eis schmilzt, Meeresspiegel steigt, Extremwetter. |
| 12–15 s | Titel | **KLIMAWANDEL** – Weniger CO₂ = weniger Erwärmung (die Erde kühlt ab). |

## Selbst rendern

```bash
node audio.cjs            # → out/soundtrack.wav  (Sounddesign aus timeline.js)
node render.cjs           # → out/klimawandel-15s.mp4  (Playwright + ffmpeg)
node render.cjs --stills 2.5,8,14.9   # Einzelbilder zum Prüfen
```

`index.html` im Browser öffnen für eine Live-Vorschau (Klick = Play/Pause, ←/→ = scrubben).

- `timeline.js` – gemeinsames Cue-Sheet, damit Bild und Ton auf denselben Frames treffen
- `teaser.js` – deterministischer Canvas-Renderer (`window.__maTimeline.seek(t)`), alle Texte im Objekt `T` oben
- `audio.cjs` – Soundtrack ohne Samples: Drone, Pulse, Herzschlag, Impacts, Riser, Reverb; Am → C-Dur zur hoffnungsvollen Auflösung
