---
name: tiktok-erklaervideo
description: Erstellt deutsche TikTok-Erklärvideos (9:16, 1080×1920) im Stil „Wie funktioniert das / Was würde passieren, wenn …“ mit HyperFrames – dunkler Raster-Hintergrund, Wort-für-Wort-Untertitel oben mit blau markiertem Schlüsselwort, technische Illustrationen mit Labels, Zählern und Diagrammen. Nutzen, wenn der Nutzer ein neues Video für seinen Kanal will („mach ein Video über …“, „neues TikTok“, „Erklärvideo“).
---

# TikTok-Erklärvideo (deutsch, HyperFrames)

Alle Videos dieses Kanals sind **auf Deutsch**, **im Code mit HyperFrames** gebaut und folgen exakt dem
Stil der drei Referenzvideos (Erklärvideos über Alltagstechnik, z. B. Diebstahlsicherung im Supermarkt).
Vor dem Bauen: `/hyperframes` laden (Render-Vertrag), für Bewegung `/motion-anything` (MOTION-SPEC: Timing-
und Easing-Tokens, Zurückhaltung). Vorlage im Repo: `videos/01-flugzeugfenster/`.

## 1. Aufbau eines Videos (Dramaturgie)

1. **Hook (0–6 s):** Eine Frage, die jeder kennt, über einem sofort erkennbaren Objekt.
   Frame 0 ist schon das Objekt (Thumbnail), nie schwarz. Beispiel: „Was würde passieren, wenn … ?“
2. **Grundlage (≈10 s):** Das unsichtbare Prinzip sichtbar machen (Luftteilchen, Feldlinien, Querschnitt).
3. **Zahl mit Vergleich:** Eine harte Zahl, die hochzählt (Zähler groß oben links), dann ein
   greifbarer Vergleich („so viel wie ein Konzertflügel“).
4. **Das Objekt ist die Erklärung:** Explosionsansicht / Nahaufnahme / Zoom auf das winzige Detail,
   Teile erscheinen genau dann, wenn sie genannt werden. Gern **eine helle Szene** als Kontrast.
5. **Der Moment (Payoff):** Das, wonach die Frage gefragt hat, passiert – mit Kamerawackeln, Riss, Sturm.
6. **Folgen in Schritten:** jeweils eine Zahl/ein Diagramm pro Schritt (Countdown, Kurve).
7. **Schluss (≥2 s Halt):** Zurück zur Person, ein Satz, der hängen bleibt. Keine End-Card.

Länge: 30–60 s. Ein neuer Beat alle 2–4 s. Ca. 2,5 Wörter pro Sekunde Sprechtempo.
Jede Zahl stimmt und ist geprüft; Quelle/Annahme steht als Fußnote im Bild.

## 2. Look (verbindlich)

- **Format:** 1080×1920, 30 fps. Text nur im Band 168–1330 px; darunter nur Textur (TikTok-UI).
- **Grund:** `#0d0c0f`, feines Raster 54 px mit `rgba(255,255,255,.035)`, weiche Vignette/Lichtfleck in der Mitte.
  Helle Szenen: `#ecebe8` mit Raster `rgba(0,0,0,.045)`.
- **Schrift:** Inter. Lesbarer Text ≥ 28 px.
- **Untertitel (das Markenzeichen):** oben mittig (top 300 px), 68 px, max. 920 px breit, 1–2 Zeilen.
  - Wörter erscheinen einzeln synchron zum Sprechen (blur 8 px → 0, 0,16 s, `power3.out`).
  - Das aktuelle Wort ist **fett weiß**, bereits gesprochene werden **regulär grau** (`#8d8b90`).
  - **Schlüsselwort** (`*Wort*` im Skript): bleibt fett weiß und bekommt den **blauen Auswahlrahmen**
    (`#2f6fe8`, 3 px, leicht blau gefüllt) mit **zwei runden Anfassern** oben links und unten rechts
    – wie eine Auswahl in Figma. Pro Gruppe höchstens ein Schlüsselwort.
  - Gruppen von 2–5 Wörtern; Ausgang mit Blur 0,14 s.
  - Helle Szene: `"theme": "light"` (Text dunkel).
- **Labels:** VERSALIEN, 28 px, 600, Laufweite 0,14 em, weiß, mit dünner Führungslinie (2 px) zum Teil.
- **Zähler:** 96–120 px, 800, oben links (left 70, top ≈ 470–500), Einheit kleiner daneben, Unterzeile grau.
- **Fußnote:** 28 px grau unten links (top ≈ 1290): „Verlangsamt“, „Vereinfachte Darstellung“,
  „Schematisch, Abstände übertrieben“, Quellenangabe.
- **Wasserzeichen:** nur `@HANDLE` (Oswald, Versalien) rechts bei top 500, `mix-blend-mode: difference`
  (funktioniert auf hell und dunkel). **Kein Instagram-Logo.** Handle ist die Variable `handle`.
- **Illustrationen:** flaches, sauberes SVG mit weichen Verläufen, Glanzlichtern und Glow; Akzentfarben:
  Luft/Feld `#8fc8ff`, Warnung `#ff4d4d`, sicher `#1fbf7a`/`#4fe0a0`, Signal gelb `#ffcf4a`.
  Diagramme: weiße Linie 5 px, graue Achsen, wandernder Punkt mit Halo.

## 3. Bewegung (motion-anything + HyperFrames)

- Ankünfte `expo.out`/`power3.out`, Ausgänge 40–50 % kürzer mit `power2.in` + Blur.
- Szenenwechsel mit Ursache: Zoom durchs Objekt (Fenster → Querschnitt), Blur-Swap, Farbflutung (dunkel → hell).
- Ambient-Bewegung nur sinnvoll (Teilchen zittern, Wolken ziehen) – deterministisch über eine Uhr-Tween mit
  `onUpdate` und gesäten Zufall (mulberry32). Kein `Math.random()`, kein `repeat:-1`.
- Pro Szene höchstens ein großer Moment (Wackeln, Riss, Zoom).

## 4. Ton

- **Voiceover (Pflicht):** Microsoft-Stimme **Andrew** (`en-US-AndrewMultilingualNeural`, spricht Deutsch) über
  `edge-tts` (`pip install edge-tts`). `python3 -I tools/voiceover.py videos/<projekt> --target 60`:
  erzeugt je Satz eine MP3, nimmt die echten Wortzeiten für die Untertitel und **verzerrt die Szenen-Zeit
  stückweise**, sodass jede Animation auf ihrem Wort landet (Anker = Gruppenstarts, Warp-Block am Ende jeder
  Szene, `data-orig-start` in index.html). Zahlen im Feld `"say"` ausschreiben („elftausend“, „null Komma
  fünfundsiebzig“). Danach immer `node tools/build-captions.mjs videos/<projekt>`.
- Bundled SFX aus `/media-use` (`assets/sfx/`): Whoosh beim Szenenwechsel, Pop wenn eine Zahl landet,
  Riser → Impact genau einmal beim Payoff, Klick bei echten Klicks (Gurt, Klappe). Jede `<audio>` mit `id`,
  `data-duration` = Dateilänge. Leise genug unter der Stimme (0,4–0,6).

## 5. Arbeitsablauf

1. Thema → Skript in `script.json` (Gruppen mit `t: [start, ende]`, `*Schlüsselwort*`, optional `theme`).
   Fakten prüfen.
2. `npx hyperframes init videos/<nr>-<thema> --skip-skills --skill=hyperframes`, dann `index.html` nach Vorlage
   (`videos/01-flugzeugfenster/index.html`: 1080×1920, `#ground`, Szenen-Hosts, Wasserzeichen, Untertitel, Audio).
3. Je Szene eine Datei `compositions/sN-<name>.html` (SVG + GSAP, IDs mit Szenen-Präfix, `fromTo`),
   zunächst auf die geplanten Zeiten aus `script.json` getaktet.
4. Voiceover + Zeit-Warp: `python3 -I tools/voiceover.py videos/<projekt>`, dann
   `node tools/build-captions.mjs videos/<projekt>`. Text geändert? Einfach beide erneut ausführen
   (Originalzeiten bleiben in `t0` / `data-orig-start` erhalten).
5. `npx hyperframes check --json` → Fehler beheben; `npx hyperframes snapshot --review` → Sheets ansehen
   (Überlappungen, Lesbarkeit am Handy, Text im Band).
6. Rendern: `npx hyperframes render -q delivery -o renders/<projekt>.mp4`. Renders nicht committen.
