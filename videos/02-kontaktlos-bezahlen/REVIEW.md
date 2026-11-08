# Review – 02 Kontaktlos bezahlen

Reine 3D-Animation, kein Text, keine Stimme, 34 s, 1080×1920, eine durchgehende Kamerafahrt.

Ablauf: Karte im Dunkeln mit Lichtstreif → Terminal erwacht → Karte dockt an, Magnetfeld-Ringe →
Röntgen: Kupferspule + Chip → Induktionsstrom läuft zum Chip → Chip-Makro, Datenpakete hin und zurück,
4 Status-LEDs → grüner Haken + Ringburst → Karte hebt ab, Heldendrehung, Abblende.

Technik: Three.js r160 + eigene Nachbearbeitung (HDR, 3-stufiger Bloom, ACES, Vignette, Filmkorn) in
`assets/lib/kit3d.js` (`KIT.post`). Kamera aus benannten Einstellungen A–G mit weichen Übergängen.
Sound: nur SFX (Whoosh, Riser, Pops auf den LEDs, Ping + Bass beim Bezahlen). Keine Musik (kein Katalog).
Ton nur gemessen, nicht gehört.

Schwächen: beim Andocken leichter Glanzpunkt auf der Karte; Terminal ohne echte Spiegelung im Boden.
