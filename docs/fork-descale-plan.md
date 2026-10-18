# Konzept: Entkalkungs-Erinnerung mit geführtem Ablauf (Fork-Wunsch A3)

Stand: 2026-10-18 · Status: **Konzept, noch nicht gebaut**

## Wunsch

Analog zur vorhandenen Backflush-Erinnerung soll Beanie an das Entkalken
erinnern. Man stellt den Zyklus ein und sieht, wann zuletzt entkalkt wurde.

Entscheidungen vom 2026-10-18:

| Frage      | Entscheidung                                                                        |
| ---------- | ----------------------------------------------------------------------------------- |
| Zyklus     | zeitbasiert: **Off / 3 / 6 / 12 / 24 Monate**                                       |
| Erfassung  | **automatisch** (Maschine durchläuft Entkalkungszyklus) **+ manuell** (heute / Datum nachtragen) |
| Assistent  | **geführter Ablauf gleich mit einbauen**                                            |
| Ort        | **zweite Leiste unter der Backflush-Leiste** auf der Steam · Water · Flush-Seite    |

## Was es heute schon gibt

**Backflush-Erinnerung (Vorbild)**
- Domain-Logik in `src/domain/cleaning.ts`: Zustand `{ shotsSinceClean, lastCleanedAt }`
  und Schwelle (Off/40/80/120 Shots).
- Gespeichert wird im Gateway-KV unter `beanie.cleaning.*`, also auf allen
  Geräten gleich.
- Anzeige mit `renderCleaningBar` in `src/views/machineView.ts`, unten auf der
  Steam · Water · Flush-Seite. Ist die Reinigung fällig, wird die Leiste
  eingefärbt, und der „Water“-Knopf auf dem Hauptschirm bekommt ein Badge
  (`workbenchView`, `cleaningDue`).
- Den Assistenten bilden `cleaningWizardController.ts` (eine reine
  Zustandsmaschine), `cleaningWizardView.ts` und `cleaningExecutionFlow.ts`
  (Maschinenaktionen, Rezept danach wiederherstellen).

**Entkalken**
- Unter Einstellungen → Wartung gibt es nur „Descale · Start descale“. Der Knopf
  schaltet die Maschine direkt in den Zustand `descaling`
  (`PUT /api/v1/machine/state/descaling`), ohne Anleitung und ohne Protokoll.
- Decaid kennt den Maschinenzustand `descaling`. Beanie bekommt Zustand,
  Unterzustand und Steam-Temperatur live über den Snapshot-WebSocket.
- Seit v0.3.9 lässt sich die Steam-Heizung in Beanie ausschalten
  (`steamHeaterOn()`, Steam-Preset mit 0°).

## Decents Vorgaben zum Entkalken

Quelle: [DE1 Descaling Instruction](https://decentespresso.com/docs/de1_descaling_instruction)

1. **Steam-Heizung ausschalten** und warten, bis der Steam-Boiler ≤ 60 °C hat.
   Das kann bis zu einer Stunde dauern.
2. **Lösung ansetzen:** nur Zitronensäure, 5 %, also 80 g auf 1.540 ml
   weiches oder destilliertes Wasser bei 20–40 °C. Bei DE1 v1.0/v1.1 nie mehr
   als 5 %.
3. **Steam-Spitze abschrauben**, Lösung in den Tank füllen, Descale starten.
   Ein Durchgang dauert etwa 6 Minuten. Bis zu 3 Durchgänge sind möglich, dabei
   jedes Mal die Tropfschale leeren.
4. **Spülen (nicht auslassen):** Steam-Heizung wieder an, Tank leeren und
   reinigen, mit frischem gefiltertem Wasser füllen.
   - Durch die Brühgruppe spülen, bis die Nachfüll-Meldung kommt. Nachfüllen und
     wiederholen. Schmeckt es sauer, weiterspülen.
   - Steam-Zeit auf 100 s stellen und 5 Steam-Durchgänge laufen lassen, die
     Steam-Spitze bleibt dabei ab. Danach probieren.
   - Gesamtbedarf: etwa 7–8 l Wasser.
5. **Steam-Spitze wieder montieren.**

Intervall laut Decent: weiches Wasser (TDS < 120 ppm) alle 1–2 Jahre.
Umkehrosmose- oder destilliertes Wasser: nicht nötig.

## Konzept

### 1. Daten (Gateway-KV, auf allen Geräten gleich)

| Key                              | Inhalt                                                                    |
| -------------------------------- | ------------------------------------------------------------------------- |
| `beanie.fork.descale.state`      | `{ lastDescaledAt: ISO \| null, history: [{ at: ISO, source: 'machine' \| 'manual' \| 'wizard' }] }` (letzte 10 Einträge) |
| `beanie.fork.descale.interval`   | Monate: `0` (aus) / `3` / `6` / `12` / `24`. Standard ist `12`.           |

- **Präfix `beanie.fork.`:** Das Original-Beanie auf derselben Maschine nutzt
  denselben Namespace. Mit dem eigenen Präfix kann es keine Kollision mit
  künftigen Original-Keys geben.
- **Fälligkeit:** `fälligAm = lastDescaledAt + Intervall` in Kalendermonaten.
  - fällig, wenn `jetzt ≥ fälligAm`;
  - „bald fällig“ in den letzten 14 Tagen davor;
  - kein Datum erfasst: nie fällig, stattdessen der Hinweis „Datum nachtragen“.
    So wird man nicht sofort angemahnt.

### 2. Erfassung

- **Automatisch:** Wechselt die Maschine von `descaling` zurück in einen
  Ruhezustand und lief der Zyklus mindestens 3 Minuten, setzt Beanie
  `lastDescaledAt` auf das Ende des Zyklus (Quelle `machine`).
  - Ein abgebrochener Kurzlauf zählt nicht.
  - Mehrere Durchgänge am selben Tag ergeben einen Eintrag.
  - Das funktioniert unabhängig vom Assistenten, solange Beanie auf dem Tablet
    läuft.
- **Manuell** in der Leiste:
  - „Heute entkalkt“ setzt den aktuellen Zeitpunkt (Quelle `manual`).
  - Ein Tipp auf das Datum öffnet einen Datumsdialog zum Nachtragen oder
    Korrigieren, z. B. für den ersten Eintrag oder für Entkalken außerhalb von
    Beanie.
- **Assistent:** Nach dem ersten erfolgreichen Durchgang ist das Datum über die
  automatische Erfassung gesetzt. Der Abschluss des Assistenten bestätigt den
  Eintrag nur noch (Quelle `wizard`).

### 3. Leiste „Descaling“ (zweite Leiste unter Backflush)

Aufbau wie bei der Backflush-Leiste:

```
[Beaker] Descaling                          LAST           REMIND (MONTHS)          [ Run descale ]
         last descaled 3 Okt. · due in 9 mo [3 Okt. ✎]     Off  3  6  [12]  24
```

| Element        | Inhalt                                                                        |
| -------------- | ----------------------------------------------------------------------------- |
| Statuszeile    | `last descaled 3. Okt. 2026 · due in 9 months`. Später `due in 12 days` (bald fällig), `overdue by 5 days` (fällig, Zeile eingefärbt) oder `never recorded · set the date`. |
| Feld „Last“    | Datum als Knopf. Ein Tipp öffnet den Dialog mit „Today“ und Datumsauswahl.    |
| Feld „Remind“  | Segmentknöpfe Off / 3 / 6 / 12 / 24, wie die Backflush-Stufen.                |
| Hauptknopf     | „Run descale“ öffnet den Assistenten, auch mit Erinnerung „Off“.              |

- **Fälligkeit:** Die Leiste bekommt den `due`-Stil, und der „Water“-Knopf auf
  dem Hauptschirm zeigt dasselbe Badge wie bei fälliger Reinigung. Der Tooltip
  nennt den Grund („Descaling due“, „Cleaning due“ oder beides).
- **Platz:** Die Seite ist heute bei 1280×800 voll (Spalten 647 px, Leiste
  67 px). Die zweite Leiste kostet ~75 px. Die großen Symbol-Kacheln oben in den
  drei Spalten müssen entsprechend niedriger werden. Das ist beim Bauen im
  Browser bei Tablet-Größe zu prüfen.
- **Sprache der Oberfläche:** Englisch wie der Rest von Beanie. Datum und Dauer
  folgen der Gerätesprache.

### 4. Assistent „Descale“

Eine eigene Zustandsmaschine nach dem Muster des Backflush-Assistenten. Jeder
Maschinenschritt läuft nur auf Antippen. Beim Schließen wird alles
zurückgestellt, was der Assistent geändert hat.

| # | Schritt          | Inhalt / Aktion                                                                                         | Weiter, wenn …                         |
| - | ---------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1 | **Cool down**    | „Turn steam heater off“ (merkt sich die vorherige Steam-Einstellung). Live-Anzeige der Steam-Temperatur bis ≤ 60 °C. Hinweis: kann bis zu 1 h dauern, man kann den Assistenten schließen und später fortsetzen. | ≤ 60 °C (oder bewusst überspringen)    |
| 2 | **Solution**     | Rezept: 80 g Zitronensäure + 1.540 ml Wasser (20–40 °C). Nur Zitronensäure. Steam-Spitze abschrauben, Tropfschale leeren, Lösung in den Tank. | bestätigt                              |
| 3 | **Descale**      | „Start descale“ (Maschinenzustand `descaling`). Fortschritt mit Laufzeit gegen ~6 min und Unterzustand. Danach Durchgang 1/3 erledigt, Angebot „Run another cycle“ (Tropfschale leeren) oder weiter. | ≥ 1 Durchgang fertig                   |
| 4 | **Refill**       | „Turn steam heater back on“ (stellt die gemerkte Einstellung wieder her). Tank leeren, reinigen, mit frischem gefiltertem Wasser füllen. | bestätigt                              |
| 5 | **Rinse group**  | Flushen, bis die Nachfüll-Meldung kommt (Beanie zeigt den Wasserstand und erkennt `needsWater`). Nachfüllen und wiederholen. Probieren. | „Tastes clean“                         |
| 6 | **Rinse steam**  | Steam-Zeit vorübergehend 100 s. 5 Steam-Durchgänge, Beanie zählt sie mit (0/5). Steam-Spitze bleibt ab. Probieren. | 5 Durchgänge + „Tastes clean“          |
| 7 | **Done**         | Steam-Spitze wieder montieren. Steam-Zeit auf den vorherigen Wert. Eintrag bestätigen.                 | –                                      |

- **Group Head Controller (GHC):** Flush und Steam startet man am GHC der
  Maschine. Der Assistent zeigt dann „Start on the group head“ statt eines
  Start-Knopfs, so wie der Backflush-Assistent.
- **Abbruch:** Wird der Assistent mittendrin geschlossen, stellt er die
  Steam-Einstellungen zurück, auf Wunsch auch die ausgeschaltete Heizung. Er
  warnt, falls schon entkalkt, aber noch nicht gespült wurde.
- **Einstellungen → Wartung:** „Start descale“ öffnet künftig den Assistenten.
  Damit startet niemand mehr ohne abgekühlte Heizung und ohne Spülanleitung.

### 5. Umsetzung im Fork (konfliktarm)

**Neue Fork-Module** (keine Original-Dateien):

| Datei                                          | Inhalt                                                          |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `src/domain/forkDescale.ts`                    | Typen, Intervalle, Fälligkeit, Zyklus-Erkennung (rein, testbar), Lesen und Schreiben der KV-Keys |
| `src/domain/forkSettingsKeys.ts`               | Fork-Keys und `FORK_SYNCED_SETTING_KEYS`                        |
| `src/controllers/forkDescaleWizardController.ts` | Zustandsmaschine des Assistenten                              |
| `src/controllers/forkDescaleFlow.ts`           | Maschinenaktionen über die vorhandenen typisierten Owner (`MachineWorkflowCommands`, Steam-Preset-Befehle), keine eigenen Gateway-Aufrufe |
| `src/views/forkDescaleBar.ts`                  | Leiste                                                          |
| `src/views/forkDescaleWizardView.ts`           | Assistent                                                       |
| `src/fork.css`                                 | Styles, getrennt von der 11.000-Zeilen-`styles.css`             |

**Eingriffe in Original-Dateien** (klein, in FORK.md festzuhalten):

| Datei                          | Änderung                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `src/domain/settingsStore.ts`  | eine Zeile `...FORK_SYNCED_SETTING_KEYS`                                         |
| `src/main.ts`                  | `import './fork.css'`                                                            |
| `src/views/machineView.ts`     | Platz für die zweite Leiste in `renderMachinePage`                               |
| `src/views/workbenchView.ts`   | Badge und Tooltip für „fällig“ mit Grund                                         |
| `src/components/SettingsShell.ts` | „Start descale“ öffnet den Assistenten                                        |
| `src/app.ts`                   | Zustandsfelder, Aktions-Handler, Beobachter für den Maschinenzustand, Verdrahtung. Ziel: wenige, gebündelte Stellen |

Vor dem Bauen sind laut `CLAUDE.md` `docs/architecture.md` und
`docs/runtime-ownership-and-consistency.md` zu lesen, weil der Assistent die
Maschine steuert. Architektur-Guard und Dependency-Test müssen grün bleiben.

**Tests**
- Unit-Tests für Fälligkeit (Monatsgrenzen, bald/fällig/aus, kein Datum),
  Zyklus-Erkennung (kurzer Abbruch, mehrere Durchgänge) und Assistent
  (Schrittfolge, Zurückstellen bei Abbruch).
- View-Tests für Leiste und Assistent.
- Prüfung im Demo-Modus im Browser bei 1280×800.

### 6. Prüfen auf der echten Maschine

- Lokal wird nur im Demo-Modus gebaut und getestet.
- Ob der DE1 Pro den Entkalkungszustand per API annimmt (auch mit GHC) und wie
  sich die Unterzustände währenddessen melden, lässt sich nur beim echten
  Entkalken sehen. Dafür braucht es dich an der Maschine und deine Freigabe.
  Bis dahin bleibt die automatische Erfassung defensiv: Sie zählt nur einen
  vollständigen Wechsel `descaling` → Ruhezustand.

## Offene Punkte

1. **Sprache:** Neue Texte auf Englisch wie der Rest der App, oder auf Deutsch?
   Vorschlag: Englisch.
2. **Standard-Intervall:** 12 Monate. Passt das zu deinem Wasser?
3. **Letztes Entkalken:** Kennst du das Datum? Es lässt sich nach dem Einbau in
   der Leiste nachtragen.
