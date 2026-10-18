# Changelog (Fork)

Änderungen dieses Forks gegenüber [giladger/Beanie](https://github.com/giladger/Beanie).
Die Änderungen des Originals stehen in `CHANGELOG.md`. Jede Überschrift ist
ein Release-Tag (siehe `FORK.md`, Abschnitt „Release“).

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
