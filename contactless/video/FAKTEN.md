# Faktencheck Storyboard „Kontaktlos bezahlen“

| # | Aussage im Storyboard | Urteil | Begründung / Änderung |
|---|---|---|---|
| 1 | „Deine Karte hat **keinen** Akku.“ | ✅ korrekt | Kontaktlose Karten (ISO/IEC 14443, NFC) sind passiv: keine Batterie, kein Akku. |
| 2 | „Trotzdem **funkt** sie.“ | ✅ bleibt (vereinfacht) | Streng genommen erzeugt die Karte kein eigenes Funksignal: Sie antwortet per *Lastmodulation*, indem sie das Feld des Terminals im Takt ihrer Daten belastet. Für ein Erklärvideo ist „funkt“ als Vereinfachung vertretbar. |
| 3 | Kupferspule läuft mehrfach am Kartenrand entlang | ✅ korrekt | Die Antenne ist eine flache Spule mit einigen Windungen entlang des Kartenrands. Im Video sind es 4 Windungen. [unsicher]: Die Zahl der Windungen (meist ca. 3–6) und das Material (Kupferdraht oder geätztes Kupfer bzw. Aluminium) sind je nach Hersteller verschieden. |
| 3/4 | „Im Inneren steckt eine **Antenne**.“ / „verbunden mit einem winzigen **Chip**.“ | ✏️ Satzzeichen korrigiert | Satz 4 setzt Satz 3 fort, sonst stünde ein Fragment mit kleinem Anfangsbuchstaben allein. Neu: „Im Inneren steckt eine **Antenne**,“ → „verbunden mit einem winzigen **Chip**.“ Inhaltlich korrekt: Die Spule ist mit dem Chipmodul verbunden. Das Goldfeld sind genau genommen die Kontakte, der eigentliche Chip sitzt als winziges Siliziumplättchen darunter. Gezeigt wird das Goldmodul als „CHIP“. |
| 5 | Terminal versorgt die Karte mit Strom, 13,56 MHz | ✅ korrekt | Induktive Kopplung: Das magnetische Wechselfeld des Terminals (13,56 MHz) induziert in der Kartenspule eine Spannung, die den Chip versorgt. Die grünen Linien sind magnetische Feldlinien und wurden für die Lesbarkeit nach oben gestreckt (stilisiert). |
| 6 | Reichweite etwa 4 cm | ✅ korrekt | EMVCo legt für Bezahlterminals einen Arbeitsbereich von 0 bis 4 cm fest. ISO 14443 erlaubt bis ca. 10 cm, in der Praxis klappt es meist nur auf 1–4 cm. Beschriftung im Video: „MAX. CA. 4 CM“. |
| 7 | „Und **statt deiner Kartennummer** schickt sie einen **Einmal-Code**.“ | ❌ falsch → korrigiert | Eine physische EMV-Karte überträgt ihre Kartennummer (PAN) beim kontaktlosen Bezahlen in der Regel **mit**. Den Schutz liefert ein **zusätzliches** Kryptogramm, das für jede Zahlung neu berechnet wird. Ein Ersatz der Kartennummer durch einen Token gilt für Smartphone-Wallets (Apple Pay, Google Pay), nicht für die Plastikkarte. **Neu:** „Und für jede Zahlung schickt sie einen neuen **Einmal-Code**.“ [unsicher]: Einzelne Herausgeber und Kartentypen weichen davon ab. |

Weitere Punkte:
- Szene 1: Der grüne Haken auf dem Display stimmt (Bestätigung nach erfolgreicher Zahlung). Bei höheren Beträgen kann zusätzlich eine PIN nötig sein. Das wird im Video nicht gezeigt.
- Die Spule ist im Video viel dicker gezeichnet als der echte Draht (ca. 0,1 mm), damit man sie sieht.
