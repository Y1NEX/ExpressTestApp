# Review-Anleitung

## Empfohlene Reihenfolge

1. **README:** Ziel, Standardverhalten, Startbefehle und Grenzen prüfen.
2. **`packages/database/prisma/schema.prisma`:** Beziehungen und Feldtypen ansehen; anschließend die initiale SQL-Migration lesen.
3. **`packages/contracts/src/index.ts`:** Create- und PATCH-Schema vergleichen. Welche Defaults wären bei einem Update gefährlich?
4. **Service und Repository:** DTO-Konvertierung in `snippets/service.ts`, danach Besitzerfilter, Pagination und atomare Updates in `snippets/repository.ts` nachvollziehen.
5. **Auth und `app.ts`:** Login, Session-Regenerierung, CSRF und Middleware-Reihenfolge ansehen.
6. **Integrationstests:** Besonders „updates one field“, „favorite to false“, „invalid PATCH“ und „isolates … by owner“ lesen.
7. **Globale Fehlergrenze:** `http/async-handler.ts`, `http/prisma-errors.ts` und `http/error-handler.ts` zusammen mit den Fehlerpfadtests lesen.
8. **[Lern-Doku](BACKEND.md):** Erklärungen und kleine Erweiterungsaufgaben durcharbeiten.

## Selbst ausprobieren

```powershell
npm ci
npm run check
npm test
```

Die Datenbank muss laufen und `.env` eingerichtet sein; siehe README. Dann die API mit `npm start` starten und in einem zweiten Terminal `npm run smoke` ausführen. Einzelschritte stehen in [API.md](API.md).

Prüfe insbesondere:

- Ein Snippet mit Kategorie und Favorit anlegen, dann nur den Titel ändern. Alles andere bleibt erhalten.
- Favorit mit `false` deaktivieren.
- `{}`, leeren Titel, `null`, unbekannte Eigenschaften und falsche Typen senden. Erwartet: `400`, vorheriger Datensatz bleibt unverändert.
- Einrückungen und Zeilenumbrüche im Inhalt erhalten.
- Suche und Filter kombinieren; Seiten ohne Treffer liefern `[]`.
- Ausloggen und die vorherige Session erneut verwenden. Erwartet: `401`.

## Tatsächlich durchgeführte lokale Prüfungen

Erneuter vollständiger Review: **8. November 2026**. Node.js `22.17.1`, npm `10.9.2`, PostgreSQL `17.11` aus dem Docker-Compose-Service auf Windows.

| Prüfung                                                           | Ergebnis                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| TypeScript-Build aller drei Workspaces                            | erfolgreich                                                                |
| Zusätzliche Typprüfung von Tests, Konfiguration und Hilfsskripten | erfolgreich                                                                |
| Vertrags-/Unit-/Middleware-Tests                                  | 84 erfolgreich                                                             |
| Integrationstests mit PostgreSQL und echtem HTTP-Server           | 66 erfolgreich                                                             |
| API separat mit `npm start` gestartet                             | erfolgreich                                                                |
| Live-Smoke-Test gegen diesen Prozess                              | 16 HTTP-Prüfungen erfolgreich                                              |
| Initiale Migration und erneutes Provisionieren des Owners         | erfolgreich; Passwort nicht überschrieben                                  |
| Docker-Sicherung und Restore in neue Datenbank                    | erfolgreich; automatischer Inhaltstest in `npm test`                       |
| Restore-Inhalt                                                    | Unicode/Code, Kategorie, Favorit, Nutzer und Migrationstabelle geprüft     |
| Session-Inhalte im Restore                                        | leer wie vorgesehen                                                        |
| Falsche Backup-Prüfsumme                                          | Abbruch vor Datenbankanlage                                                |
| Compose-Konfiguration                                             | `docker compose config --quiet` erfolgreich                                |
| Laufzeitabhängigkeiten                                            | `npm audit --omit=dev --audit-level=high`: keine gemeldeten Schwachstellen |

**Docker-Start wiederhergestellt:** Der erste Durchgang am 7. November lief wegen eines `dockerInference`-Socket-Fehlers gegen natives PostgreSQL. Beim erneuten Review wurde bei vollständig gestopptem Docker ausschließlich der temporäre Runtime-Ordner unter einem eindeutigen `.stale-…`-Namen erhalten und neu erstellt. Die Engine startete danach; Images, Volumes und Einstellungen wurden erhalten. Dieser Durchgang lief vollständig gegen den lokalen Compose-Service. Ein späteres Wiederauftreten des Docker-/Windows-Problems ist damit nicht grundsätzlich ausgeschlossen.

Zusätzlich geprüft: fehlerhafte Konfiguration und belegter Port am echten Server-Einstiegspunkt, kontrollierter Runtime-Shutdown, Readiness beim Herunterfahren, parallele Owner-Provisionierung, Legacy-Passwort-Upgrade, reale Prisma-Constraint-/Verbindungsfehler, unsupported Charset/Encoding, defektes gzip sowie JSON-Primitive und Nullwerte. Die Logs und Fehlerantworten wurden auf unbeabsichtigte sensible Inhalte geprüft. `npm audit --audit-level=moderate` meldet auch einschließlich Entwicklungswerkzeugen keine Schwachstellen.

Portable Hilfswerkzeuge, Testdaten, Zugangsdaten und Dumps bleiben ignoriert. Die endgültige Docker-CI und ihren Commit direkt im PR prüfen.

### Nachprüfung der konsequenten tca-Nutzung

Am 8. November wurden auch die CLI-Skripte auf `tca` umgestellt und die verbliebenen Test-Cleanup-Blöcke durch Vitest-Hooks ersetzt. ESLint prüft, dass eigener TypeScript-Code keine klassischen `try`-Blöcke oder Promise-`.catch()`-Aufrufe enthält. Siehe [Fehlerbehandlung und Aufräumen](BACKEND.md#8-fehler-behandeln-und-ressourcen-schließen).

Die 150 Tests und der Backup-Roundtrip wurden erneut erfolgreich gegen Docker-PostgreSQL ausgeführt. Zwei zusätzliche Backup-Fehlerfälle prüfen den Fehlerstatus und fehlende Dateireste bei fehlendem `pg_dump` sowie fehlgeschlagenem Export. Manuell geprüfte CLI-Fehlerfälle: ungültige Owner-Zugangsdaten, unerreichbare Datenbank bei Owner-Provisionierung und Integrationstest-Start sowie unerreichbare API beim Smoke-Test. Alle vier Prozesse endeten mit Status 1, ohne falsche Erfolgsmeldung oder Hängenbleiben. Der reguläre Live-Smoke-Test bestand wieder alle 16 HTTP-Prüfungen.

Beim Neustart trat der dokumentierte Docker-Socket-Fehler erneut auf. Der temporäre Runtime-Ordner wurde bei gestopptem Docker erneut gesichert und neu erstellt; danach war der vorhandene PostgreSQL-Container wieder gesund. Dieser Betriebssystem-/Docker-Fehler ist kein Fehler des Backend-Codes.

## Bewusste Grenzen

- Persönliche lokale App; Hosting/HTTPS und Proxy-Konfiguration kommen separat.
- Keine öffentliche Registrierung, Passwort-Reset-Oberfläche, Rollen oder CASL-Regeln.
- Gleichzeitige Änderungen desselben Felds: letzter Schreibzugriff gewinnt.
- Feste Kategorien, einfache Teiltextsuche und Offset-Pagination.
- API-Neustarts behalten Sessions, setzen aber den Login-Ratelimiter zurück.
- Ein Schema- und API-PR; das Frontend folgt nach deinem Review.
