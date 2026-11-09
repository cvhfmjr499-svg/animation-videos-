# Blood Falls: „Warum blutet dieser Gletscher?“

Format: 1080×1920, 30 fps, 30 s, MP4, ohne Ton. 7 Szenen, weiche Übergänge (Zoom-Durchflug oder Überblendung).
Stil und Technik wie `contactless/video/` (HyperFrames 0.9.26, Three.js für 3D, GSAP für Animation, Untertitel und Beschriftungen als HTML-Ebenen).
**Fett** = Schlüsselwort (weiß, fett, kurz blauer Auswahlrahmen mit Eckpunkten).

| # | Bild | Untertitel |
|---|---|---|
| 1 | Ein weißer Gletscher, an der Kante läuft ein blutroter Streifen herab. Kamera fährt langsam heran. | „Dieser Gletscher **blutet**.“ |
| 2 | Kamerafahrt rückwärts, eine Karte der Antarktis wird sichtbar. Beschriftung „TAYLOR-GLETSCHER“. | „Seit über **100** Jahren rätseln Forscher.“ |
| 3 | Röntgenblick in den Gletscher: Darunter liegt ein Netz aus Salzwasser. Beschriftung „SALZWASSER“. | „Unter dem Eis liegt uraltes **Salzwasser**.“ |
| 4 | Makrofahrt ins Wasser: winzige Eisenteilchen, kein Licht, kein Sauerstoff. | „Voller **Eisen**, ohne einen Hauch Sauerstoff.“ |
| 5 | Das Wasser tritt aus dem Gletscher aus, Sauerstoff trifft auf das Eisen, die Farbe kippt von klar zu rot. | „Erst an der Luft **rostet** es.“ |
| 6 | Makro: Bakterien als Lichtpunkte im Dunkeln. Beschriftung „MIKROBEN“. | „Und darin **leben** Bakterien, ohne Sonnenlicht.“ |
| 7 | Zurück zur roten Kante, Kamera fährt zurück. | „Ein Gletscher, der **rostet**.“ |

## Faktencheck

- ✅ Die Blood Falls liegen am Taylor-Gletscher in den McMurdo-Trockentälern der Antarktis. Entdeckt 1911; zuerst hielt man das Rot für Algen.
- ✅ Die Farbe entsteht, weil eisenhaltiges, sauerstofffreies Salzwasser an der Luft oxidiert (rostet).
- ✅ Wegen des hohen Salzgehalts bleibt das Wasser auch bei etwa −7 °C flüssig.
- ✅ Radarmessungen von 2017 zeigen ein Netz aus Salzwasser unter dem Gletscher.
- ✅ Im Wasser leben Mikroben, die ohne Licht und Sauerstoff auskommen und Eisen und Sulfat nutzen.
- [unsicher] Wie lange das Wasser abgeschlossen ist: oft genannt werden etwa 1,5 Millionen Jahre, das ist eine Schätzung.
- [unsicher] Eine Studie von 2023 fand, dass das Eisen vor allem in winzigen Nanokügelchen steckt. Nur andeuten.

## Ablauf (wie beim Kontaktlos-Video)

1. Komposition bauen, `lint` und `check` ohne Fehler.
2. Von jeder Szene ein Standbild aus der Vorschau zeigen.
3. Erst nach OK die finale MP4 rendern.
4. Außer HyperFrames und seinen Erweiterungen nichts ohne Rückfrage installieren.
