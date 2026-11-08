# API ausprobieren

Voraussetzung: API läuft, Migration angewendet, `owner:create` ausgeführt. Die Beispiele sind für PowerShell. Cookies bleiben in `$webSession`; Tokens werden separat als Header gesendet.

## Login

```powershell
$base = 'http://127.0.0.1:3000'
$csrf = Invoke-RestMethod "$base/api/auth/csrf" -SessionVariable webSession
$headers = @{ 'X-CSRF-Token' = $csrf.csrfToken }
$credentials = @{
  email = 'owner@example.com' # Deine OWNER_EMAIL verwenden
  password = 'DEIN_OWNER_PASSWORD'
} | ConvertTo-Json

$login = Invoke-RestMethod "$base/api/auth/login" `
  -Method Post -WebSession $webSession -Headers $headers `
  -ContentType 'application/json' -Body $credentials

# Login ersetzt die Session und den CSRF-Token.
$headers = @{ 'X-CSRF-Token' = $login.csrfToken }
Invoke-RestMethod "$base/api/auth/me" -WebSession $webSession
```

Erfolgreicher Login: `200` mit `{ "user": { "id": "…", "email": "…" }, "csrfToken": "…" }`. Passwort und Passwort-Hash werden nie zurückgegeben. Falsches Passwort und unbekannte E-Mail ergeben dieselbe `401`-Antwort. Ein fehlender CSRF-Token führt vor der Loginprüfung zu `403`.

## Anlegen und lesen

```powershell
$body = @{
  title = 'Docker-Logs'
  content = 'docker logs --tail 100 mein-container'
  category = 'DOCKER'
  favorite = $true
} | ConvertTo-Json

$created = Invoke-RestMethod "$base/api/snippets" `
  -Method Post -WebSession $webSession -Headers $headers `
  -ContentType 'application/json' -Body $body

$id = $created.data.id
Invoke-RestMethod "$base/api/snippets/$id" -WebSession $webSession
```

Anlegen liefert `201`, einen `Location`-Header und `{ "data": { … } }`. Erforderlich sind nur `title` und `content`; Kategorie und Favorit haben Standardwerte. Antworten enthalten `createdAt` und `updatedAt` als ISO-Zeitstempel.

## Teilweise ändern – der wichtige Lernfall

```powershell
# Genau EIN Feld ändern. Inhalt, Kategorie und Favorit bleiben erhalten.
$patch = @{ title = 'Docker-Logs, letzte 100 Zeilen' } | ConvertTo-Json
Invoke-RestMethod "$base/api/snippets/$id" `
  -Method Patch -WebSession $webSession -Headers $headers `
  -ContentType 'application/json' -Body $patch

# false ist ein Wert und darf nicht als "fehlt" behandelt werden.
Invoke-RestMethod "$base/api/snippets/$id" `
  -Method Patch -WebSession $webSession -Headers $headers `
  -ContentType 'application/json' -Body '{"favorite":false}'

# Erwartet: 400 VALIDATION_ERROR, Datensatz unverändert.
Invoke-RestMethod "$base/api/snippets/$id" `
  -Method Patch -WebSession $webSession -Headers $headers `
  -ContentType 'application/json' -Body '{}'
```

| Eingabe                    | Ergebnis                                                |
| -------------------------- | ------------------------------------------------------- |
| `{ "title": "Neu" }`       | Nur Titel ändern                                        |
| `{ "favorite": false }`    | Favorit deaktivieren                                    |
| `{}` oder kein JSON-Body   | `400`, kein Update                                      |
| `{ "title": "" }`          | `400`, Pflichtfeld darf nicht leer sein                 |
| `{ "content": " \n " }`    | `400`, reiner Leerraum ungültig                         |
| `{ "title": null }`        | `400`, `null` ist kein erlaubter Feldwert               |
| `{ "category": "PYTHON" }` | `400`, unbekannte Kategorie                             |
| `{ "favorite": "false" }`  | `400`, String statt Boolean                             |
| `{ "ownerId": "…" }`       | `400`, unbekanntes Feld; Besitzer kommt aus der Session |

HTTP kennt kein JSON-`undefined`. Fehlende Felder werden weggelassen. Die API bietet bewusst `PATCH`, keinen vollständigen Ersatz per `PUT`. Erfolgreiche Updates liefern `200`; auch beim Setzen desselben Werts darf `updatedAt` fortgeschrieben werden. Gleichzeitige Änderungen desselben Felds verwenden zunächst „letzter Schreibzugriff gewinnt“.

## Suche, Filter und Pagination

```powershell
Invoke-RestMethod "$base/api/snippets?search=docker&category=DOCKER&favorite=false&page=1&pageSize=10&sortBy=title&sortOrder=asc" `
  -WebSession $webSession
```

Antwort bei null Treffern:

```json
{
  "data": [],
  "pagination": { "page": 1, "pageSize": 10, "total": 0, "totalPages": 0 }
}
```

- `search`: optional, maximal 200 Zeichen, Titel **oder** Inhalt; außen getrimmt. Leerer Suchtext bedeutet alle eigenen Snippets.
- `category`: eine feste Kategorie.
- `favorite`: exakt `true` oder `false` als Query-String; Weglassen filtert nicht nach Favorit.
- `page`: 1 bis 100.000; `pageSize`: 1 bis 100.
- `sortBy`: `updatedAt`, `createdAt` oder `title`; `sortOrder`: `asc` oder `desc`.
- Gleiche Sortierwerte werden zusätzlich über die UUID stabil sortiert. Textsortierung folgt der Datenbank-Collation.
- Eine Seite hinter dem Listenende liefert eine leere `data`-Liste. `totalPages` ist bei null Treffern `0`.
- Unbekannte oder wiederholte Query-Parameter werden abgewiesen. Sonderzeichen im Client URL-kodieren.

## Löschen und Logout

```powershell
Invoke-RestMethod "$base/api/snippets/$id" `
  -Method Delete -WebSession $webSession -Headers $headers

Invoke-RestMethod "$base/api/auth/logout" `
  -Method Post -WebSession $webSession -Headers $headers `
  -ContentType 'application/json' -Body '{}'
```

Beide liefern `204` ohne Body. Ein gelöschtes oder fremdes Snippet liefert bei Lesen, Update oder Löschen `404`.

## Fehlerformat

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "requestId": "12345678-1234-4234-8234-123456789abc",
    "issues": [{ "path": ["title"], "message": "…" }]
  }
}
```

| HTTP | Bedeutung                                                         |
| ---- | ----------------------------------------------------------------- |
| 400  | Schemafehler, ungültige UUID oder kaputtes JSON                   |
| 401  | Kein Login oder falsche Zugangsdaten                              |
| 403  | CSRF-Token fehlt/falsch oder unerlaubte Origin                    |
| 404  | Route oder eigenes Snippet nicht gefunden                         |
| 409  | Konflikt mit vorhandenen Daten oder einer parallelen Änderung     |
| 413  | Request größer als 512 KB                                         |
| 415  | JSON erforderlich oder Charset/Encoding nicht unterstützt         |
| 429  | Zu viele fehlgeschlagene Logins                                   |
| 500  | Unerwarteter Fehler; Details nur im Serverlog                     |
| 503  | Datenbank vorübergehend nicht verfügbar oder Instanz nicht bereit |

Bei mehreren gleichzeitig ungültigen Eigenschaften entscheidet die Middleware-Reihenfolge: beispielsweise kann fehlender CSRF-Schutz vor der Payload-Validierung `403` liefern.

Jede API-Antwort enthält `X-Request-Id`; Fehler verwenden denselben Wert im Body. Bei `503` aus dem globalen Handler wird `Retry-After: 5` gesetzt. Die Readiness-Antwort bleibt der einfache Statusvertrag. Passwörter, SQL, Tabellen-/Constraint-Namen und Stacks erscheinen nicht in Fehlerantworten. Datenbankkonflikte ergeben `409`; vorübergehende Datenbankfehler ergeben `503`.

Auch ausgehende Antworten werden mit den gemeinsamen Zod-Verträgen geprüft. Eine kaputte Serverantwort ist `500 INTERNAL_ERROR`, kein Eingabefehler des Clients. JSON-Primitiven, Arrays und `null` werden als gültiges JSON eingelesen und anschließend vom Objektschema abgewiesen. Ungültiges komprimiertes JSON wird als Clientfehler behandelt; ein nicht unterstütztes Encoding oder Charset ergibt `415`.

Nullbytes und isolierte Unicode-Surrogate in Titel, Inhalt und Suchtext sind ungültig. `page`/`pageSize` akzeptieren ausschließlich positive dezimale Ziffernfolgen ohne führende Null.

## Späteres Frontend

`WEB_ORIGIN` ist standardmäßig `http://localhost:5173`. Requests aus dem Frontend brauchen `credentials: 'include'` und für Schreibzugriffe den aktuellen `X-CSRF-Token`. Im lokalen Browser auf beiden Seiten denselben Hostnamen verwenden, etwa Vite unter `localhost:5173` und API unter `localhost:3000`. `127.0.0.1` und `localhost` nicht mischen. Ein Vite-Proxy kann beide später unter einer Origin bereitstellen.
