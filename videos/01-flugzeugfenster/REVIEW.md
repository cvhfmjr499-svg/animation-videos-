# Review – 01 Flugzeugfenster

**Thema:** Was würde passieren, wenn in 11.000 m Höhe dein Flugzeugfenster bricht? (60 s, 9:16, deutsch)

## Entscheidungen
- Stil 1:1 nach den drei Referenzen: dunkler Raster-Grund, Wort-für-Wort-Untertitel oben, Schlüsselwort mit
  blauem Auswahlrahmen + Anfassern, VERSAL-Labels mit Führungslinien, große Zähler oben links, graue Fußnoten,
  eine helle Szene (Dreifach-Scheibe) als Kontrast, Wasserzeichen-Handle als Variable `handle`.
- Szenen: Hook (Fenster, Höhe 11.000 m, Haarriss) → Querschnitt Kabine/außen (Luftteilchen, 0,75 vs 0,23 bar)
  → Kraft 510 kg ≈ Konzertflügel → drei Scheiben + Entlüftungsloch (Zoom) → Bruch, Sturm, Nebel, −56 °C
  → Masken + Countdown 30→15 s → Notabstieg-Kurve auf 3.000 m → Gurt rastet ein.
- Fakten: Kabinendruck ≈ 0,75 bar (≈ 2.400 m Kabinenhöhe), außen ≈ 0,23 bar (ISA 11 km), Fenster ≈ 26×37 cm
  → ≈ 5 kN ≈ 510 kg; Außentemperatur ISA −56 °C; Time of Useful Consciousness bei schneller Dekompression
  in ~11 km ≈ 15–30 s; Notabstieg auf 10.000 ft (≈ 3.000 m), typ. ~4 min.

## Geprüft
- `hyperframes check`: 0 Fehler; verbleibende Warnungen bewusst (Untertitel-Datei groß/dicht, weil generiert;
  z-index des Auswahlrahmens).
- Review-Sheets inkl. Handybreite (360 px) angesehen; Text im Band 168–1330 px.
- Ton nur gemessen, nicht gehört: Bundled SFX (Whoosh, Pop, Riser→Impact, Klick). Keine Musik und kein Voiceover
  (kein HeyGen-Login; lokaler TTS kann kein Deutsch).

## Schwächste Stelle / nächster Schritt
- Ohne Voiceover tragen nur Untertitel + SFX. Mit deutschem Voiceover (HeyGen) Wortzeiten per transcribe
  übernehmen und `script.json` neu bauen.
- Figuren (Szene 6) sind sehr reduziert; mit mehr Zeit detailliertere Personen-Illustrationen.
