# Snippet-Ablage – ExpressTestApp

Eine kleine persönliche Ablage für Befehle, Code und Text. Dieses PR liefert **nur Datenbank und Backend**. Ein Frontend folgt später mit Vite, React Router **v6**, Formik, MUI und Material React Table.

Du kannst Snippets erstellen, lesen, teilweise ändern, löschen, durchsuchen, nach Kategorie/Favorit filtern und sortiert seitenweise abrufen. Es gibt einen lokal angelegten Nutzer und einen Passport-Login mit Cookie-Session. Kopieren und Vorschau sind Aufgaben des späteren Frontends.

## Voraussetzungen

- Node.js 22 ab 22.13, npm 10 oder neuer; Node 22 wird in CI verwendet.
- Docker Desktop mit **laufender Linux-Engine** und Docker Compose v2, oder eine eigene PostgreSQL-17-Instanz.
- Freie lokale Ports: `5433` für PostgreSQL und `3000` für die API.

Prisma bleibt bewusst auf der stabilen Version `7.10.1`. Die Pakete werden über `package-lock.json` reproduzierbar installiert.

## Lokal starten

Alle folgenden Befehle im Repository-Hauptordner ausführen.

```powershell
Copy-Item .env.example .env
```

In `.env` **SESSION_SECRET und OWNER_PASSWORD ersetzen**. Ein Session-Secret erzeugst du mit:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`OWNER_EMAIL` auf deine gewünschte Login-Adresse setzen. `OWNER_PASSWORD` benötigt mindestens 12 Zeichen. Die Beispielwerte für Session-Secret und Owner-Passwort werden vom Setup abgewiesen.

```powershell
npm ci
docker compose up -d --wait
npm run build
npm run db:migrate
npm run owner:create
npm start
```

Die Startmeldung ist strukturiertes JSON mit `event: "server.listening"`, `host: "127.0.0.1"` und `port: 3000`.

In einem zweiten Terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/ready
npm run smoke
```

`/health` prüft den Prozess. `/ready` prüft zusätzlich die Datenbank und die drei erforderlichen Tabellen. Der Smoke-Test meldet die Zahl erfolgreicher HTTP-Prüfungen, erzeugt genau ein temporäres Snippet und entfernt es wieder. Er verwendet die Zugangsdaten aus deiner lokalen `.env`.

Für Entwicklung mit automatischem API-Neustart: `npm run dev`. Nach Änderungen an `contracts` oder `database` erneut bauen bzw. `npm run dev` neu starten; der Watcher beobachtet nur die API-Quellen.

`owner:create` ist wiederholbar: Ein bestehender Nutzer wird erkannt; sein Passwort bleibt unverändert. Bei einer anderen bereits vorhandenen E-Mail wird kein weiterer Nutzer angelegt. Es gibt keinen öffentlichen Registrierungs-Endpunkt. Die Owner-Zugangsdaten werden nur beim Anlegen gebraucht; ein späteres Ändern von `.env` setzt das gespeicherte Passwort nicht zurück.

## Monorepo

```text
apps/api/                       Express, Passport, HTTP-Middleware, Snippet-Service
packages/contracts/             Zod-Eingaben und öffentliche TypeScript-Typen
packages/database/              Prisma-Schema, SQL-Migration, PostgreSQL-Adapter
docs/                           API-Beispiele, Lern-Doku, Backup- und Review-Anleitung
```

`api` verwendet `contracts` und `database`. `contracts` kennt weder Express noch Prisma und enthält gemeinsame **Request-, Response- und Fehler-Schemas**. Öffentliche Typen werden daraus mit `z.infer` abgeleitet. Das spätere Frontend kann dieselben Verträge verwenden. Der Prisma-Client wird generiert und nicht eingecheckt.

Die erste Funktionalität ist vollständig getrennt: **Route → Service → Repository**. Die Route prüft Eingaben und Antwortverträge, der Service enthält Anwendungsregeln und DTO-Konvertierung, das Repository kapselt Prisma. ESLint schützt die Schichtgrenze des Services. Ein späterer NestJS-Wechsel kann Verträge und Datenmodell übernehmen; HTTP- und Auth-Anbindung werden dann bewusst angepasst.

## Datenmodell und Standardverhalten

| Bereich       | Entscheidung                                                                               |
| ------------- | ------------------------------------------------------------------------------------------ |
| Nutzer        | UUID, normalisierte eindeutige E-Mail, Passwort-Hash, Erstellungszeit                      |
| Snippet       | UUID, Besitzer, Titel, Inhalt, Kategorie, Favorit, Zeitstempel                             |
| Session       | Session-ID, JSON-Sitzungsdaten, Ablaufzeit; gespeichert in PostgreSQL                      |
| Kategorien    | `GIT`, `DOCKER`, `SQL`, `JAVASCRIPT`, `TYPESCRIPT`, `OTHER`                                |
| Neue Snippets | Kategorie `OTHER`, Favorit `false`                                                         |
| Titel         | Pflicht, außen getrimmt, 1–120 Zeichen; doppelte Titel erlaubt                             |
| Inhalt        | Pflicht, maximal 50.000 Zeichen; reiner Leerraum ungültig; Code-Einrückung bleibt erhalten |
| Liste         | Seite 1, 20 Einträge, zuletzt geändert zuerst; maximal 100 Einträge je Seite               |
| Suche         | Teiltext in Titel/Inhalt, ohne Groß-/Kleinschreibung; `%` und `_` sind normale Suchzeichen |
| PATCH         | Nur gesendete Felder ändern; `{}` ist ungültig; `false` ist ein gültiger Wert              |
| Löschen       | Dauerhaft; erneutes Löschen liefert `404`                                                  |
| Besitzprüfung | Alle Snippet-Abfragen berücksichtigen den eingeloggten Nutzer                              |

Die API läuft standardmäßig nur auf `127.0.0.1`. Sessions dauern bis zu sieben Tage; der Store verlängert die Ablaufzeit bei aktiver Nutzung. Bei Logout wird die Sitzung gelöscht. Browser-Schreibzugriffe benötigen einen CSRF-Token und eine erlaubte Origin. Login-Versuche werden nach zehn Fehlschlägen in 15 Minuten begrenzt.

Titel, Inhalt und Suchtext lehnen Nullbytes und ungültige Unicode-Surrogate ab, damit Daten unverändert in PostgreSQL gespeichert werden können. Query-Seitennummern müssen positive Dezimalzahlen sein; Arrays, `0x10`, `1e2` und `01` werden abgewiesen. Neue Passwort-Hashes speichern explizite scrypt-Parameter; alte Hashes werden bei erfolgreichem Login aktualisiert. Gleichzeitiges Owner-Provisionieren ist durch eine PostgreSQL-Advisory-Lock serialisiert.

## Fehlerbehandlung und Betrieb

- `@itsezz/try-catch` (`tca`) erfasst Fehler an asynchronen Grenzen. Der globale Handler gibt einen gemeinsamen Fehlervertrag mit `code`, sicherer `message` und `requestId` zurück.
- Ein eigener Prisma-Mapper übersetzt bekannte Konflikte, Constraints und Verbindungsfehler. Unbekannte Datenbank-/Programmierfehler bleiben generische `500`-Antworten; SQL und interne Fehlermeldungen werden nicht ausgeliefert.
- Request- und Fehlerlogs sind strukturiertes JSON. Sie enthalten keine Bodies, Query-Strings, Cookies, Zugangsdaten oder ungefilterten Error-Messages. `LOG_LEVEL` steuert die Ausgabe.
- `TRUST_PROXY_HOPS=0` vertraut standardmäßig keinem Proxy. Bei späterem Hosting nur setzen, wenn die Netzwerkarchitektur diese feste Hop-Zahl garantiert.
- Der HTTP-Server begrenzt Header-/Request-Zeit und schließt bei SIGINT/SIGTERM seine Ressourcen. Während des Herunterfahrens meldet Readiness `503`.

## API

| Methode              | Pfad                       | Zweck                                  |
| -------------------- | -------------------------- | -------------------------------------- |
| GET                  | `/health`, `/ready`        | Betriebszustand                        |
| GET                  | `/api/auth/csrf`           | CSRF-Token und Sitzung holen           |
| POST                 | `/api/auth/login`          | Login; neuer CSRF-Token in der Antwort |
| GET                  | `/api/auth/me`             | Eingeloggten Nutzer lesen              |
| POST                 | `/api/auth/logout`         | Sitzung beenden                        |
| GET                  | `/api/snippets/categories` | Feste Kategorien lesen                 |
| GET / POST           | `/api/snippets`            | Liste / neues Snippet                  |
| GET / PATCH / DELETE | `/api/snippets/:id`        | Lesen / teilweise ändern / löschen     |

**Direkt ausführbare PowerShell-Beispiele und genaue Antworten:** [docs/API.md](docs/API.md).

## Prüfen

```powershell
npm run format:check
npm run check
npm test
npm run smoke
```

- `check`: prüft ESLint und Schichtgrenzen, baut alle Pakete und prüft zusätzlich Tests sowie Hilfsskripte mit TypeScript.
- `test:unit`: Validierung, Konfiguration, Passwort-Hashing; ohne Datenbank ausführbar.
- `test:integration`: legt eine zufällig benannte Testdatenbank an, migriert sie und testet echte HTTP-Requests. Danach prüft ein automatischer Backup-Roundtrip Inhalte, Migrationen, ausgelassene Sessions und eine falsche Prüfsumme. Test- und Restore-Datenbanken werden anschließend entfernt. Der lokale Datenbanknutzer benötigt `CREATEDB`; der Compose-Entwicklungsnutzer hat diese Berechtigung.
- `smoke`: prüft den separat gestarteten API-Prozess. Die Integrationstests starten ihren eigenen HTTP-Server auf einem freien Port.

Die Unit-/Vertragstests bauen ihre benötigten Pakete selbst und benötigen keinen laufenden Datenbankserver; die HTTP-Middleware-Tests verwenden lokale TCP-Ports. Für die vollständige Integrationsteststrecke Docker Compose starten. Bei eigener nativer PostgreSQL-Instanz `PG_TOOLS_BIN` auf den Ordner mit passenden `pg_dump`/`pg_restore`-Programmen setzen; der Backup-Test verwendet dann den nativen Modus.

Das `minimatch`-Override betrifft die Entwicklungswerkzeuge und zieht die gepatchte Hauptversion ein. `npm audit` wird auch für die Entwicklungsabhängigkeiten geprüft; das Override bei zukünftigen Tool-Updates erneut bewerten.

GitHub Actions führt Formatprüfung, TypeScript-Prüfung, Migrationen, Tests, API-Start sowie einen Docker-Backup-/Restore-Durchlauf aus. Der aktuelle Prüfstand und die manuelle Review-Reihenfolge stehen in [docs/REVIEW.md](docs/REVIEW.md).

## Backup und Restore

Bei laufender Compose-Datenbank:

```powershell
npm run db:backup
npm run db:restore -- --file backups/DEINE-DATEI.dump
```

Das Backup liegt mit SHA-256-Prüfsumme unter `backups/`. Restore erzeugt **immer eine neue Datenbank**; deine aktive Datenbank und `.env` werden nicht überschrieben. Session-Inhalte werden nicht gesichert. Details und native PostgreSQL-Alternative: [docs/BACKUP.md](docs/BACKUP.md).

## Lernen und Erweitern

Starte mit [docs/BACKEND.md](docs/BACKEND.md). Dort werden Request-Ablauf, PATCH-Regeln, Besitzerfilter, Transaktionen, Session-Login, CSRF und SQL-Migration erklärt, mit kleinen Übungsaufgaben.

Der Umfang dieses Backends ist abgeschlossen mit CRUD und Login. CASL, Frontend, KI-/MCP-Anbindung, Generatoren, Dateiuploads und Tags sind mögliche separate Erweiterungen.

## Häufige Startprobleme

- **Docker-Pipe/Engine nicht erreichbar:** Docker Desktop starten und warten, bis die Linux-Engine bereit ist. `docker version` muss einen Server anzeigen. Alternativ eigenes PostgreSQL verwenden und `DATABASE_URL` anpassen.
- **Port 5433 belegt:** `POSTGRES_PORT` und den Port in `DATABASE_URL` gemeinsam ändern.
- **Falsches Datenbankpasswort nach Änderung von `.env`:** Das Postgres-Volume behält bestehende Zugangsdaten. Änderungen an `POSTGRES_PASSWORD` initialisieren ein vorhandenes Volume nicht neu.
- **`@snippet/contracts` nicht gefunden:** zuerst `npm run build` ausführen.
- **Login `403`:** erst CSRF-Token holen, Cookies behalten, Token mitsenden; nach Login den neuen Token verwenden.
- **Login scheitert nach Änderung von `OWNER_PASSWORD`:** Provisionierung setzt ein vorhandenes Passwort absichtlich nicht zurück.
- **Tests können keine Datenbank anlegen:** Testnutzer mit `CREATEDB` verwenden; keine Tests gegen eine verwaltete Produktionsdatenbank starten.

## Betrieb außerhalb des lokalen Rechners

Das Standardsetup ist für lokales Lernen und eine einzelne API-Instanz. Ein späteres Hosting braucht eine konkrete HTTPS-/Proxy-Konfiguration, passende Cookie- und Origin-Einstellungen und einen eingeschränkten Datenbanknutzer. `NODE_ENV=production` aktiviert Secure-Cookies; `trust proxy` wird über `TRUST_PROXY_HOPS` ausdrücklich konfiguriert. Der Login-Ratelimiter ist pro Prozess; mehrere Instanzen benötigen dafür einen gemeinsamen Store. Eine Veröffentlichung sollte als eigener Schritt geprüft werden.

Lizenz: [MIT](LICENSE).
