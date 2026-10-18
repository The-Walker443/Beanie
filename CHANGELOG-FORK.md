# Changelog (Fork)

Änderungen dieses Forks gegenüber [giladger/Beanie](https://github.com/giladger/Beanie).
Die Änderungen des Originals stehen in `CHANGELOG.md`. Jede Überschrift ist
ein Release-Tag (siehe `FORK.md`, Abschnitt „Release“).

## 0.3.9-fork.3 - 2026-10-18

- **Entkalkungs-Erinnerung.** Auf der Steam · Water · Flush-Seite gibt es unter
  der Backflush-Leiste eine Leiste „Descaling“.
  - Man wählt den Zyklus (Off / 3 / 6 / 12 / 24 Monate, Standard 12) und sieht,
    wann zuletzt entkalkt wurde und wann es wieder fällig ist.
  - Das letzte Datum lässt sich nachtragen oder korrigieren.
  - Ist das Entkalken fällig, wird die Leiste eingefärbt, und der „Water“-Knopf
    bekommt ein Badge.
  - Läuft ein Entkalkungszyklus der Maschine fertig durch, merkt Beanie sich das
    Datum selbst.
- **Geführtes Entkalken** nach Decents Anleitung, über „Run descale“ oder
  Einstellungen → Wartung → Descale. Die Schritte:
  - Steam-Heizung ausschalten und bis 60 °C abkühlen lassen;
  - Zitronensäure-Lösung ansetzen;
  - bis zu 3 Entkalkungsdurchgänge;
  - Heizung wieder an und frisches Wasser;
  - Brühgruppe spülen;
  - Steam-Leitung mit 5 × 100 s spülen.

  Steam-Zeit und Heizung stellt der Ablauf am Ende zurück. Schließen pausiert
  ihn, „Cancel“ bricht ab.

## 0.3.9-fork.2 - 2026-10-18

- Im Verlauf stehen bei Shots von heute und gestern die Wörter „Heute“ und
  „Gestern“ statt des Datums, z. B. „Heute 13:08 · D-Flow“. Ältere Shots zeigen
  weiter das Datum. Maßgeblich ist der Kalendertag; nach Mitternacht werden die
  Zeilen beim nächsten Neuzeichnen korrigiert.

## 0.3.9-fork.1 - 2026-10-18

Basiert auf Beanie v0.3.9 und ersetzt die bisherige Skin „Beanie (0-10 Fix)“.
Die Skin-ID `beanie-fix` bleibt gleich.

- Bewertungen funktionieren wieder mit Decaid 0.8.7 und neuer. Decaid speichert
  den Genuss-Wert seit 0.8.7 auf einer Skala von 0 bis 10. Beanie erwartete noch
  0 bis 100: Jede Bewertung wurde als „Bad“ angezeigt, und neue Bewertungen
  lehnte der Gateway ab. Beanie liest und schreibt jetzt 2/4/6/8/10. Werte über
  10 von älteren Gateways rechnet Beanie um, wie es die Decaid-Migration tut.
  Das Original-Issue dazu ist giladger/Beanie#4.
- Neue Darstellung der Shot-Zeilen im Verlauf. Oben stehen Dauer und Mahlgrad
  („59s · 4.0“), darunter Datum, Uhrzeit und Profil („18. Okt. 13:08 · D-Flow“).
  Numerische Mahlgrade werden mit mindestens einer Nachkommastelle angezeigt.
- Die Skin heißt „Beanie (Fork)“ und lässt sich neben dem Original „Beanie“
  auswählen.
