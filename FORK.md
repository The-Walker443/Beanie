# Beanie-Fork

Dieser Fork ([The-Walker443/Beanie](https://github.com/The-Walker443/Beanie)) führt
[giladger/Beanie](https://github.com/giladger/Beanie) weiter und legt eigene
Anpassungen obendrauf. Auf der Maschine läuft er als eigene Skin
**„Beanie (Fork)“** neben dem Original „Beanie“.

## Grundsätze

- **Nah am Original bleiben.** Änderungen aus dem Original werden regelmäßig
  übernommen. Eigene Anpassungen sollen das Mergen so wenig wie möglich stören.
- **Anpassungen klein und isoliert halten.** Fork-Logik gehört in eigene Module
  mit `fork` im Namen (z. B. `src/views/forkShotListRow.ts`). Original-Code wird
  nur an der Aufrufstelle angefasst: Der Original-Code berechnet seine Bausteine
  weiter selbst und reicht sie an das Fork-Modul weiter. Konflikt-Schwerpunkte
  sind `src/app.ts`, `src/styles.css`, `CHANGELOG.md`, die Versionsfelder und
  die Key-Liste in `src/domain/settingsStore.ts`.
- **Jeder Wunsch ist unten als Spezifikation beschrieben**, also das
  Soll-Verhalten und nicht nur der Code. Baut das Original eine betroffene Stelle
  um, lässt sich der Wunsch auf der neuen Grundlage neu umsetzen.
- **Was auch dem Original nützt, wird dort angeboten.** Das gilt nicht für Fixes
  zu Issues, die der Entwickler selbst bearbeitet (z. B. #4). Sobald das
  Original eine Änderung übernimmt, verschwindet die Abweichung.
- **Auf der Maschine keine inhaltlichen Eingriffe.** Bohnen, Shots, Profile,
  Workflows und Einstellungen werden nicht verändert, außer es ist ausdrücklich
  freigegeben. Freigegeben ist nur, die Skin `beanie-fix` zu installieren und zu
  aktualisieren. Lokale Tests laufen im Demo-Modus, nie gegen die echte Maschine.
- Die Regeln aus `CLAUDE.md` und `AGENTS.md` gelten weiter: direkt auf `main`
  committen und vor Architektur-Änderungen den Guard-Test laufen lassen.

## Anpassungswünsche

### A1 – Shot-Zeilen im Verlauf: Dauer · Mahlgrad, darunter Datum Uhrzeit · Profil

**Wunsch (2026-10-18):** In der Shot-Liste des Verlaufs sollen Dauer und
Mahlgrad oben stehen, also z. B. „59s · 4.0“. Darunter sollen Datum, Uhrzeit und
Profilname stehen: „18. Okt 13:08 · Profilname“.

**Soll-Verhalten**

| Zeile        | Original                       | Fork                       |
| ------------ | ------------------------------ | -------------------------- |
| oben         | `18g → 35.6g @ 59s`            | `59s · 4.0`                |
| darunter     | `68d · D-Flow · 18. Okt.`      | `18. Okt. 13:08 · D-Flow`  |

- **Dauer:** wie im Original (`59s`, gerundete Sekunden).
- **Mahlgrad:** `grinderSetting` aus dem Workflow-Kontext des Shots. Reine Zahlen
  bekommen mindestens eine Nachkommastelle (`4` → `4.0`, `3.9` bleibt, `12` →
  `12.0`). Alles andere wird angezeigt wie eingegeben.
- **Fehlende Werte:** Fehlt eine der beiden Angaben, steht nur die andere da.
  Fehlen beide, erscheint die Original-Zeile `18g → 35.6g`.
- **Datum und Uhrzeit:** Das Format folgt der Sprache des Geräts, auf Deutsch
  `18. Okt. 13:08`. Der Punkt nach „Okt“ ist die deutsche Standard-Abkürzung.
- **Profil:** wie im Original, ohne Profil steht „No profile“.
- **Bewusst entfallen** in der Zeile: Dosis → Ertrag und das Bohnenalter
  (`68d`). Das Bewertungs-Badge und die Derek- und Overlay-Markierungen bleiben.
- Nur der Verlauf (Tablet) ist betroffen. Workbench-Liste und Handy-Ansicht
  bleiben wie im Original.

**Umsetzung:** In `src/views/forkShotListRow.ts` steckt die Logik. In
`src/views/historyView.ts` (`renderShotListItem`) gibt es nur den Aufruf und die
zwei Textstellen. Tests liegen in `src/test/forkShotListRow.test.ts`. In
`src/test/historyView.test.ts` prüft der frühere Bohnenalter-Test jetzt die
Fork-Zeile.

**Beim Merge beachten:** Ändert das Original `renderShotListItem` oder die
Zeilen-Bausteine (Dauer, Datum, Freshness), übergibt der Aufruf weiterhin die
Original-Bausteine an `forkShotListRowText`, und das Soll-Verhalten oben gilt.

### A2 – „Heute“ und „Gestern“ statt Datum in den Verlaufszeilen

**Wunsch (2026-10-18):** Das Datum von heute und gestern soll durch die Wörter
„Heute“ und „Gestern“ ersetzt werden.

**Soll-Verhalten** (ergänzt A1, Zeile darunter):

| Shot von      | Anzeige                     |
| ------------- | --------------------------- |
| heute         | `Heute 13:08 · D-Flow`      |
| gestern       | `Gestern 07:23 · D-Flow`    |
| älter         | `16. Okt. 13:50 · D-Flow`   |

- „Heute“ und „Gestern“ richten sich nach dem Kalendertag in der Ortszeit des
  Geräts, nicht nach 24 Stunden. Ein Shot von 23:55 heißt nach Mitternacht
  „Gestern“. Auch an Tagen mit Zeitumstellung stimmt das.
- Die Wörter kommen aus der Sprache des Geräts (`Intl.RelativeTimeFormat`) und
  werden großgeschrieben: auf Deutsch „Heute“ und „Gestern“, auf Englisch
  „Today“ und „Yesterday“.
- Die Uhrzeit bleibt immer dabei.
- Nach Mitternacht werden die Zeilen beim nächsten Neuzeichnen des Verlaufs
  korrigiert. Ein „Heute“ von gestern bleibt also nicht stehen.

**Umsetzung:** Steckt in `src/views/forkShotListRow.ts` (`relativeDayLabel`,
`shotRowDayKey`). In `src/views/historyView.ts` gibt es zusätzlich das Feld
`forkDay` im Zeilen-Cache (`ShotListItemCacheEntry`). Es sorgt dafür, dass
gespeicherte Zeilen beim Tageswechsel neu berechnet werden. Tests liegen in
`src/test/forkShotListRow.test.ts`.

**Beim Merge beachten:** Baut das Original den Zeilen-Cache in
`renderShotListItem` um, muss der Tages-Schlüssel wieder in die Cache-Prüfung.
Sonst bleibt nach Mitternacht „Heute“ stehen.

## Fixes, die im Original noch fehlen

### F1 – Bewertungen auf Decaids 0–10-Skala ([giladger/Beanie#4](https://github.com/giladger/Beanie/issues/4))

- Seit Decaid 0.8.7 speichert der Gateway Bewertungen von 0 bis 10 und lehnt
  größere Werte ab (HTTP 400). Die Knöpfe schreiben deshalb 2/4/6/8/10 (Bad …
  Great).
- Werte über 10 von älteren Gateways oder aus dem Cache rechnet
  `src/domain/shotEnjoyment.ts` um, wie es die Decaid-Migration tut. Das gilt für
  die Anzeige, für Dereks Shot-Beschreibung („good (8/10)“) und für den
  Entwurf im Shot-Editor.
- **Beim Merge:** Behebt das Original #4 selbst, gilt dessen Lösung. Die
  Fork-Variante samt Test-Anpassungen fällt dann weg.

## Technische Fork-Änderungen

| #  | Änderung                                                          | Dateien                                                                 |
| -- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| T1 | Unit-Tests laufen unter Windows (Import-Pfad, Pfadtrenner, Datumsformat, Release-Test übersprungen); fürs Original geeignet | `src/test/runAll.ts`, `renderGuard`, `historyView`, `phoneView`, `releaseTag` (`*.test.ts`) |
| T2 | Fork-Doku und Hinweis für Agenten                                 | `FORK.md`, `CHANGELOG-FORK.md`, `CLAUDE.md` (Abschnitt „Fork“)          |
| T3 | Skin-Identität `beanie-fix` / „Beanie (Fork)“                     | `public/manifest.json` (nur `id` und `name`)                            |
| T4 | Fork-Releases per Tag `<Original-Version>-fork.<n>`               | `.github/workflows/fork-release.yml`, `scripts/fork-release-version.mjs` |

## Remotes

| Remote     | Ziel                         | Zweck                                         |
| ---------- | ---------------------------- | --------------------------------------------- |
| `origin`   | `The-Walker443/Beanie`       | dieser Fork; `main` trackt `origin/main`      |
| `upstream` | `giladger/Beanie`            | Original, nur lesen (Push-URL ist `DISABLED`) |

## Änderungen aus dem Original übernehmen

```bash
git fetch upstream
git log --oneline main..upstream/main   # was ist neu?
git merge upstream/main                 # Merge, kein Rebase – der Fork ist veröffentlicht
npm ci
npm test
npm run build
git push origin main
```

Bei Konflikten gewinnt im Zweifel das Original. Die eigene Anpassung wird
danach auf der neuen Grundlage wieder eingebaut, nach der Spezifikation oben.
Anschließend jeden Wunsch (A…) und jeden Fix (F…) kurz prüfen, dann ein neues
Fork-Release erstellen.

## Skin auf der Maschine

- **Maschine:** Decaid auf `10.100.100.171`. Die REST-API läuft auf Port 8080,
  der Einstiegspunkt der Skin auf Port 3000. Von außen geht das nur über das
  WireGuard-VPN nach Hause.
- **Skin:** ID `beanie-fix`, Name „Beanie (Fork)“. Daneben bleibt das Original
  `beanie` installiert und wählbar.
- **ID bewusst beibehalten:** Die ID stammt von der früheren Skin „Beanie (0-10
  Fix)“. So bleiben die Standard-Skin-Auswahl und der Browser-Speicher dieser
  Skin erhalten (Theme, Fotos, Scanner-Key). Decaid vergibt den Ursprung (Port)
  pro Skin-ID.
- **Geteilte Daten:** Fork und Original nutzen denselben Settings-Namespace
  `beanie` im Gateway. Rezepte und Einstellungen sind also in beiden Skins gleich.
- **Installation und Updates** kommen aus den GitHub-Releases dieses Forks.
  Decaid merkt sich die Quelle `github_release:The-Walker443/Beanie@<tag>` und
  spielt neuere Releases bei seiner regelmäßigen Update-Prüfung selbst ein.
  Gezielt anstoßen lässt sich das so (betrifft nur diese Skin):

  ```bash
  curl -X POST http://10.100.100.171:8080/api/v1/webui/skins/install/github-release -H "Content-Type: application/json" -d '{"repo":"The-Walker443/Beanie"}'
  ```

## Release

1. In `CHANGELOG-FORK.md` einen Abschnitt `## <version> - <datum>` anlegen.
   Die Version ist `<Original-Version>-fork.<n>`, z. B. `0.3.9-fork.1`. `n`
   beginnt nach jedem Original-Update wieder bei 1.
2. Committen und `main` pushen.
3. Den Tag mit genau der Version setzen und pushen, ohne `v` davor:
   `git tag -a 0.3.9-fork.1 -m "Release 0.3.9-fork.1"`, danach
   `git push origin 0.3.9-fork.1`.
4. Ab hier übernimmt `.github/workflows/fork-release.yml`:
   - Es trägt die Version in `package.json` und Manifest ein. Auf `main` bleiben
     diese Felder wie im Original, damit Versionssprünge des Originals
     konfliktfrei gemerged werden.
   - Es lässt Tests und Browser-Tests laufen.
   - Es baut `beanie-v<version>.zip` und veröffentlicht das Release.
5. Danach die Skin auf der Maschine aktualisieren, siehe oben.

`npm run release` und `release.yml` gehören zum Original (Tags `v*`) und werden
im Fork nicht benutzt.

## Lokale Einrichtung (Windows)

- Node 24 (wie in der CI des Originals).
- Das Repo nutzt LF-Zeilenenden: `git config core.autocrlf false` und
  `git config core.eol lf`. Das Original hat keine `.gitattributes`.
- Die npm-Skripte brauchen Bash-Syntax. Eine lokale, nicht eingecheckte `.npmrc`
  (in `.git/info/exclude` eingetragen) setzt dafür
  `script-shell=C:\Program Files\Git\bin\bash.exe`.
- Die Browser-Tests (`npm run test:browser`) brauchen einmalig
  `npx playwright install chromium`. In der CI laufen sie bei jedem Release mit.
- Lokale Vorschau: `beanie-dev` aus `.claude/launch.json`. Ohne erreichbaren
  Gateway (`decent:8080` löst lokal nicht auf) startet Beanie im Demo-Modus.
