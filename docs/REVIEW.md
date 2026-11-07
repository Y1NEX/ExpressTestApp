# Review-Anleitung

## Empfohlene Reihenfolge

1. **README:** Ziel, Standardverhalten, Startbefehle und Grenzen prüfen.
2. **`packages/database/prisma/schema.prisma`:** Beziehungen und Feldtypen ansehen; anschließend die initiale SQL-Migration lesen.
3. **`packages/contracts/src/index.ts`:** Create- und PATCH-Schema vergleichen. Welche Defaults wären bei einem Update gefährlich?
4. **`apps/api/src/snippets/service.ts`:** Besitzerfilter, Pagination und Update in einem Datenbankbefehl nachvollziehen.
5. **Auth und `app.ts`:** Login, Session-Regenerierung, CSRF und Middleware-Reihenfolge ansehen.
6. **Integrationstests:** Besonders „updates one field“, „favorite to false“, „invalid PATCH“ und „isolates … by owner“ lesen.
7. **[Lern-Doku](BACKEND.md):** Erklärungen und kleine Erweiterungsaufgaben durcharbeiten.

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

Prüfdatum: 7. November 2026. Node.js `22.17.1`, npm `10.9.2`, native PostgreSQL-Testinstanz `17.11` auf Windows.

| Prüfung                                                           | Ergebnis                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| TypeScript-Build aller drei Workspaces                            | erfolgreich                                                                |
| Zusätzliche Typprüfung von Tests, Konfiguration und Hilfsskripten | erfolgreich                                                                |
| Unit-Tests                                                        | 37 erfolgreich                                                             |
| Integrationstests mit PostgreSQL und echtem HTTP-Server           | 56 erfolgreich                                                             |
| API separat mit `npm start` gestartet                             | erfolgreich                                                                |
| Live-Smoke-Test gegen diesen Prozess                              | 16 HTTP-Prüfungen erfolgreich                                              |
| Initiale Migration und erneutes Provisionieren des Owners         | erfolgreich; Passwort nicht überschrieben                                  |
| Native Sicherung und Restore in neue Datenbank                    | erfolgreich                                                                |
| Restore-Inhalt                                                    | Unicode/Code, Kategorie, Favorit, Nutzer und Migrationstabelle geprüft     |
| Session-Inhalte im Restore                                        | leer wie vorgesehen                                                        |
| Falsche Backup-Prüfsumme                                          | Abbruch vor Datenbankanlage                                                |
| Compose-Konfiguration                                             | `docker compose config --quiet` erfolgreich                                |
| Laufzeitabhängigkeiten                                            | `npm audit --omit=dev --audit-level=high`: keine gemeldeten Schwachstellen |

**Lokale Einschränkung:** Docker Desktop startet auf diesem Rechner wegen eines internen `dockerInference`-Socket-Fehlers nicht erfolgreich. Deshalb wurden die Datenbank-Lauftests gegen eine portable native PostgreSQL-17-Instanz ausgeführt. Die Docker-Laufstrecke wird zusätzlich durch den GitHub-Workflow geprüft; dessen Status direkt im PR kontrollieren. Portable Testwerkzeuge, Daten, Zugangsdaten und Dumps sind ignoriert und werden nicht eingecheckt.

## Bewusste Grenzen

- Persönliche lokale App; Hosting/HTTPS und Proxy-Konfiguration kommen separat.
- Keine öffentliche Registrierung, Passwort-Reset-Oberfläche, Rollen oder CASL-Regeln.
- Gleichzeitige Änderungen desselben Felds: letzter Schreibzugriff gewinnt.
- Feste Kategorien, einfache Teiltextsuche und Offset-Pagination.
- API-Neustarts behalten Sessions, setzen aber den Login-Ratelimiter zurück.
- Ein Schema- und API-PR; das Frontend folgt nach deinem Review.
