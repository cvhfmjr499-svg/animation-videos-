# Spotify 2.0 – „Live Rooms“ (Fan-Konzept, 10 s)

Konzeptvideo im Stil eines App-Feature-Teasers: dunkle UI mit grünem Leuchten, eine durchgehende Kamerafahrt
(Hermite-Spline, kein Abbremsen zwischen Keyframes) mit 180°-Bewegungsunschärfe auf jedem Frame, weiche kinetische Typo. 1920×1080, 30 fps, 120 BPM, synthetisierter Sound.
Personen, Räume, Songs und Cover sind erfunden; das Spotify-Logo-Symbol wird nicht nachgebildet.
Inoffizielles Fan-Konzept, nicht mit Spotify verbunden.

▶ **Video:** [`out/spotify-live-rooms-10s.mp4`](out/spotify-live-rooms-10s.mp4) · Storyboard: [`out/storyboard.png`](out/storyboard.png)

| Zeit | Szene |
|---|---|
| 0–2,6 s | Startseite, Finger tippt auf den neuen Chip „● Live“ → Liste „Live Rooms · 3 active now“ |
| 2,6–4,6 s | Kamera gleitet weiter nach unten in den Raum „Late Night Drive“: alle Abspielköpfe übereinander („In sync · 0 ms“), Ringe pulsieren im Takt, Kommentare, Emoji-Reaktionen |
| 4,6–8,3 s | Unschärfe-Blende → „Listen with your [Freunde] *friends.*“ → „Same song. Same *second.*“ |
| 8,3–10 s | Grünes Live-Badge, Schriftzug „Spotify 2.0“, „Introducing Live Rooms“ |

## Rendern

```bash
node audio.cjs     # → out/soundtrack.wav
node render.cjs    # → out/spotify-live-rooms-10s.mp4
```
