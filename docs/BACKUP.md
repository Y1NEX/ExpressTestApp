# Backup und Restore

## Was gesichert wird

Ein PostgreSQL-Custom-Dump enthält Schema, Migrationstabelle, Nutzer und Snippets. Passwort-Hashes gehören zur Sicherung. Die Session-Tabelle wird angelegt, ihre Daten werden bewusst ausgelassen: Nach einer Wiederherstellung soll eine erneute Anmeldung nötig sein.

Die Sicherung ist ein logischer Snapshot einer Datenbank. Sie enthält keine globalen PostgreSQL-Rollen und keine `.env`. Die Skripte verändern keine Passwörter und stellen keine externen Dateien wieder her. Das reicht für diese kleine lokale App; Point-in-Time-Recovery und automatisierte Cloud-Backups wären separate Betriebsthemen.

## Sicherung mit Docker

Vom Repository-Hauptordner, bei laufender Compose-Datenbank:

```powershell
npm run db:backup
```

Ergebnis unter `backups/`:

```text
snippets-<UTC-Zeit>-<Zufallskennung>.dump
snippets-<UTC-Zeit>-<Zufallskennung>.dump.sha256
```

Der Dateiname ist eindeutig. Das Skript schreibt zunächst `.partial` und benennt die Datei erst nach erfolgreichem `pg_dump` um. Die SHA-256-Datei enthält den Hash des vollständigen Dumps. Node transportiert die Binärdaten direkt; eine PowerShell-Textumleitung mit `>` ist nicht beteiligt.

Fehler werden über `tca` erfasst. Das Skript wartet auf Prozess und Dateistream, bevor es eine unvollständige Datei entfernt. Scheitert auch das Aufräumen, werden beide Fehler gemeldet. Eine Erfolgsmeldung gibt es nur nach vollständig erfolgreicher Sicherung.

Die Standardbefehle erwarten den Compose-Service `db`. Host-Verbindung und Container müssen zur selben Datenbank gehören; bei einem anderen PostgreSQL-Server den nativen Modus verwenden.

## Restore in eine neue Datenbank

```powershell
npm run db:restore -- --file backups/DEINE-DATEI.dump
```

1. Das Skript prüft die danebenliegende `.sha256`-Datei.
2. Bei fehlender/falscher Prüfsumme endet es vor dem Anlegen einer Datenbank.
3. Es erzeugt eine neue Datenbank `snippets_restore_<Zufallskennung>`.
4. `pg_restore` stellt den Dump in einer Transaktion wieder her. Fehler brechen den Vorgang ab.
5. Deine bestehende Datenbank und die aktive `DATABASE_URL` bleiben erhalten.

Die Datenbankrolle benötigt für Restore `CREATEDB`; der lokale Compose-Nutzer hat diese Rechte. Scheitert die Wiederherstellung nach dem Anlegen, bleibt die neue Datenbank zur Untersuchung bestehen. Der Name steht in der Ausgabe. Sie wird nicht automatisch gelöscht.

Zum Prüfen kannst du in Prisma Studio auf die neue Datenbank zeigen. Erst nach erfolgreicher Kontrolle `.env` auf deren Namen umstellen und API neu starten. Das Provisionierungsskript muss vorhandene Nutzer nicht neu anlegen. Mit dem bisherigen Passwort erneut anmelden; bei einem Wechsel der Datenbank das gleiche `SESSION_SECRET` allein reaktiviert keine ausgelassenen Sessions.

## Native PostgreSQL-Werkzeuge

Mit `pg_dump` und `pg_restore` in PATH:

```powershell
npm run db:backup -- --native
npm run db:restore -- --native --file backups/DEINE-DATEI.dump
```

Oder mit explizitem Werkzeugordner:

```powershell
npm run db:backup -- --native --bin-dir 'C:/Tools/PostgreSQL/17/bin'
npm run db:restore -- --native --bin-dir 'C:/Tools/PostgreSQL/17/bin' --file backups/DEINE-DATEI.dump
```

Verbindungen verwenden Host, Port, Nutzer und Passwort aus `DATABASE_URL`. Das Passwort wird dem Tool per Prozessumgebung übergeben und nicht als Kommandozeilenargument ausgegeben. Die Werkzeuge sollten zur PostgreSQL-Hauptversion passen. Pfade und Dateinamen werden als Argumente ohne zusätzliche Shell verarbeitet.

## Kleine persönliche Backup-Routine

- Vor einer Schemaänderung und nach größeren Eingaben eine Sicherung erstellen.
- Beispielsweise die letzten sieben Sicherungen behalten; ältere Sicherungen manuell prüfen und entfernen. Die Skripte löschen keine vorhandenen Backups.
- Dump **und** Prüfsummendatei gemeinsam zusätzlich auf einem anderen Datenträger ablegen.
- `.env` und Zugangsdaten getrennt und privat sichern. Backups enthalten persönliche Inhalte und Passwort-Hashes und gehören nicht in das öffentliche GitHub-Repository.
- Gelegentlich in eine neue Datenbank zurückspielen und einen Login sowie Snippet-Inhalte prüfen.

Eine Prüfsumme erkennt Dateiveränderungen, beweist aber keine vertrauenswürdige Herkunft. Nur eigene bzw. vertrauenswürdige Dumps zurückspielen.

## Automatischer Inhaltstest

`npm test` prüft den vollständigen Roundtrip in einer zufällig benannten Testdatenbank: Code mit Einrückung und Unicode, Kategorie, Favorit, Nutzer-Hash, Migrationen und das Auslassen aller Session-Inhalte. Eine absichtlich falsche Prüfsumme muss vor dem Anlegen einer Restore-Datenbank scheitern. Der Test räumt nur seine erzeugten Datenbanken und Dump-Dateien auf. Er läuft lokal und in GitHub Actions.

Zusätzlich muss der Backup-Befehl mit Fehlerstatus enden, wenn `pg_dump` fehlt oder der Export scheitert. Dabei dürfen weder neue Dump-Dateien noch `.partial`-Dateien zurückbleiben.

## Quellen

- [PostgreSQL: Custom-Dumps mit pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
- [PostgreSQL: Wiederherstellung mit pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
