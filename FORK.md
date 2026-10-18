# Beanie-Fork

Dieser Fork ([The-Walker443/Beanie](https://github.com/The-Walker443/Beanie)) führt
[giladger/Beanie](https://github.com/giladger/Beanie) weiter und legt eigene
Anpassungen obendrauf.

## Grundsätze

- **Nah am Original bleiben.** Änderungen aus dem Original werden regelmäßig
  übernommen. Eigene Anpassungen sollen das Mergen so wenig wie möglich stören.
- **Anpassungen klein und isoliert halten.** Wenn möglich gehören sie in neue
  Dateien oder Module statt in Umbauten von Original-Code. Konflikt-Schwerpunkte
  sind `src/app.ts`, `src/styles.css`, `CHANGELOG.md`, die Versionsfelder und
  die Key-Liste in `src/domain/settingsStore.ts`.
- **Jede Fork-Änderung steht in der Liste unten.** So lässt sich nach jedem
  Update gezielt prüfen, ob sie noch greift.
- **Was auch dem Original nützt, wird dort als Pull Request angeboten.** Sobald
  das Original es übernimmt, verschwindet die Abweichung von selbst.
- Die Regeln aus `CLAUDE.md` und `AGENTS.md` gelten weiter: direkt auf `main`
  committen und vor Architektur-Änderungen den Guard-Test laufen lassen.

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
danach auf der neuen Grundlage wieder eingebaut. Anschließend die Liste unten
durchgehen und jede Anpassung kurz prüfen.

## Fork-Änderungen

| # | Änderung                                                         | Dateien                                                                 | Fürs Original geeignet? |
| - | ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------- |
| 1 | Unit-Tests laufen unter Windows (Import-Pfad, Pfadtrenner, Datumsformat, Release-Test übersprungen) | `src/test/runAll.ts`, `renderGuard`, `historyView`, `phoneView`, `releaseTag` (`*.test.ts`) | ja, als PR anbieten     |
| 2 | Diese Datei und ein Fork-Hinweis in `CLAUDE.md`                  | `FORK.md`, `CLAUDE.md`                                                  | nein                    |

## Lokale Einrichtung (Windows)

- Node 24 (wie in der CI des Originals).
- Das Repo nutzt LF-Zeilenenden: `git config core.autocrlf false` und
  `git config core.eol lf`. Das Original hat keine `.gitattributes`.
- Die npm-Skripte brauchen Bash-Syntax. Eine lokale, nicht eingecheckte `.npmrc`
  (in `.git/info/exclude` eingetragen) setzt dafür
  `script-shell=C:\Program Files\Git\bin\bash.exe`.
- Die Browser-Tests (`npm run test:browser`) brauchen einmalig
  `npx playwright install chromium`.
- `npm run release` ruft `npm` per `execFileSync` auf. Das scheitert unter
  Windows, und `release:zip` braucht das Programm `zip`. Releases laufen deshalb
  über die GitHub-Action (Tag pushen), nicht lokal.

## Offene Entscheidungen

- **Skin-Identität:** Soll die Skin eine eigene `id`/`name` in
  `public/manifest.json` bekommen und neben dem Original installiert werden, oder
  das Original ersetzen? Der Settings-Namespace `beanie` im Gateway bleibt in
  beiden Fällen gleich, Rezepte und Einstellungen werden also geteilt.
- **Versionierung der Releases:** Die Versionen des Originals (`vX.Y.Z`) dürfen
  nicht mit eigenen Tags kollidieren. Ein Vorschlag sind Tags wie
  `v0.3.9-fork.1`; dafür müsste `scripts/release-tag.mjs` angepasst werden.
