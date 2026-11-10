# Plan: „Was steckt in einem AirPod?“

**Was ist es?** Ein 20-s-Erklärvideo, wie In-Ear-Kopfhörer vom Typ AirPods Pro funktionieren.
**Für wen?** Alle, die AirPods täglich tragen und nie hineingeschaut haben.
**Hook:** „Was steckt in einem AirPod?“, dazu ein weißer Ohrhörer, der sich langsam dreht.
**Stärkster Moment:** Lärm plus Gegensignal ergibt Stille. Die Musik verstummt an genau dieser Stelle für einen Schlag.
**Lustigster Moment:** Ohrhörer raus, „Pausiert“, und der Soundtrack pausiert für einen Schlag mit.
**Ton:** `default`, im Look der Reihe (Anthrazit #111, glänzender Boden, Inter, eine Akzentfarbe pro Szene).
**Share-Zeile:** Was in einem AirPod steckt, in 20 Sekunden.

**Format:** 1920×1080, 30 fps, 20 s. 3D mit Three.js in HyperFrames, Animation mit GSAP.
**Musik:** 120 BPM (Schlag 0,5 s), a-Moll, Am – F – C – G. Alle Schnitte auf Schlägen.
**Marke:** Eigener, schlichter Ohrhörer im AirPods-Pro-Stil, kein Apple-Logo, keine Apple-Grafiken.

## Storyboard

| # | Zeit | Bild | Text | Akzent |
|---|---|---|---|---|
| 1 Hook | 0–2,5 s | Weißer Ohrhörer schwebt über dem Boden und dreht sich. | „Was steckt in einem AirPod?“ | – |
| 2 Röntgen | 2,5–6 s | Die Hülle wird durchsichtig. Auf den Schlägen 3,0 / 3,5 / 4,0 / 4,5 leuchten nacheinander auf: CHIP, AKKU, LAUTSPRECHER, MIKROFONE. | „Chip, Akku, Lautsprecher, Mikrofone.“ | Cyan |
| 3 ANC | 6–11 s | Drei Wellen untereinander: LÄRM (grau), GEGENSIGNAL (blau, gespiegelt), ERGEBNIS (wird flach). Am Ohrhörer leuchten Mikrofon und Lautsprecher. | „Mikrofone hören den Lärm. / Der Lautsprecher spielt das Gegenteil. / Ergebnis: Stille.“ | Blau |
| 4 Sensor | 11–14,5 s | Der Hautsensor an der Innenseite leuchtet. Der Ohrhörer wird „herausgenommen“, das Leuchten erlischt, die Anzeige springt von „Musik läuft“ auf „Pausiert“. | „Ein Hautsensor merkt, wenn du ihn rausnimmst.“ | Bernstein |
| 5 Case | 14,5–17 s | Das Ladecase erscheint, der Ohrhörer gleitet in den Schacht, die Kontakte am Stielende leuchten, eine Akku-Anzeige füllt sich. | „Im Case lädt er wieder auf.“ | Grün |
| 6 Outro | 17–20 s | Der zweite Ohrhörer gleitet ins Case, die Kamera kreist langsam. | „So funktionieren AirPods.“ / „Sensor · Chip · Mikrofone · Akku“ | – |

Summe: 2,5 + 3,5 + 5 + 3,5 + 2,5 + 3 = 20 s.

## Faktencheck

- ✅ AirPods Pro (und AirPods 4 mit ANC) haben aktive Geräuschunterdrückung: Ein nach außen gerichtetes Mikrofon nimmt den Umgebungslärm auf, der Chip berechnet ein Gegensignal, und der Lautsprecher spielt es mit ab. Ein nach innen gerichtetes Mikrofon prüft das Ergebnis im Ohr.
- ✅ Die Geräuschunterdrückung löscht vor allem gleichmäßigen, tiefen Lärm. „Stille“ ist also eine Vereinfachung: Es wird deutlich leiser, aber nicht völlig still.
- ✅ AirPods Pro erkennen per Hautsensor, ob sie im Ohr stecken, und pausieren die Wiedergabe beim Herausnehmen (Automatische Ohrerkennung).
- ✅ Geladen wird im Case über Kontakte am unteren Ende des Stiels.
- ✅ In den aktuellen Modellen arbeitet ein Apple-Chip (H2), der unter anderem die Geräuschunterdrückung berechnet.
- [unsicher] Die Lage der Bauteile im Inneren ist stark vereinfacht. Bei AirPods Pro sitzt der Akku als Knopfzelle im Kopfteil; die genaue Anordnung von Chip und Mikrofonen weicht im Original ab.
- Die Wellen sind schematisch dargestellt und keine Messung.
