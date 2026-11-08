# SnippetShelf: Login und erste Startseite

Dieser zweite PR ergänzt nur die Anmeldung und eine leere Startseite. Die Snippet-Datenbank und API aus PR #1 bleiben die Grundlage. Die eigentliche Sammlung, Tabellen und Bearbeitungsdialoge folgen später.

## Dateien zum Lesen

1. `apps/web/src/theme.ts`: zentrale MUI-Palette, Schrift, Rundungen und Komponentenvorgaben. Für dein eigenes Aussehen hier anfangen; Abstände und Anordnung stehen in den Seiten.
2. `apps/web/src/api/client.ts`: gemeinsamer HTTP-Aufruf, Cookie-Transport, Zeitlimit und Prüfung von Antwortverträgen.
3. `apps/web/src/auth/api.ts`: Login, Sessionprüfung, Logout und Formik-Validierung aus den gemeinsamen Zod-Regeln.
4. `apps/web/src/router.tsx`: Route-Loader prüfen vor dem Anzeigen einer Seite die aktuelle Session.
5. `apps/web/src/pages/LoginPage.tsx` und `HomePage.tsx`: Formik-Formular und die kleine MUI-Oberfläche.
6. `apps/web/test/e2e/auth.spec.ts`: der Ablauf aus Sicht eines echten Browsers.

## Warum Login keine zweite Auth-Implementierung bekommt

Die API besitzt bereits Passport und PostgreSQL-Sessions. Das Frontend ruft deren Endpunkte auf. Das Session-Cookie ist `HttpOnly`; JavaScript kann es nicht auslesen. `credentials: 'include'` lässt den Browser das Cookie mitsenden. Ein eigener JWT oder ein zusätzlicher Auth-Provider würde hier nur einen zweiten Zustand schaffen.

Beim Start fragt der Route-Loader `GET /api/auth/me` ab. Nur `401 UNAUTHENTICATED` bedeutet „nicht angemeldet“. Netzwerk- und Datenbankfehler erzeugen eine Seite mit Wiederholen-Schaltfläche. Würden wir jede fehlgeschlagene Anfrage als Logout behandeln, sähe ein Serverausfall wie ein verlorener Login aus.

| Aktion                     | Ablauf                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `/` anonym öffnen          | Session prüfen, zu `/login` wechseln                                               |
| Formular absenden          | Gemeinsames Login-Schema prüfen, CSRF-Token holen, Login senden                    |
| Login erfolgreich          | Passwort aus Formik entfernen, Startseite laden und Session erneut prüfen          |
| Seite neu laden            | Session aus dem Cookie prüfen; kein Browser-Storage nötig                          |
| Abmelden                   | Frischen CSRF-Token holen, Session serverseitig zerstören, Login anzeigen          |
| Logout scheitert           | Fehler anzeigen und Wiederholung erlauben; keinen erfolgreichen Logout vortäuschen |
| Session bereits abgelaufen | `401` beim Logout als bereits abgemeldet behandeln                                 |

Das Backend bleibt für die Zugriffskontrolle zuständig. Ein Frontend-Loader schützt die Oberfläche, ersetzt aber niemals die Authentifizierung einer API-Route.

## Formik und Zod ohne doppelte Regeln

Formik verwaltet Werte, berührte Felder, Validierungsfehler und den Zustand während des Sendens. `validateLogin` prüft mit `loginSchema` aus `@snippet/contracts` und übersetzt dessen Fehler in deutsche Feldmeldungen. Es gibt keine zweite Yup-Definition.

Das gemeinsame Schema normalisiert E-Mail-Adressen. Passwörter bleiben unverändert: führende oder folgende Leerzeichen können Teil eines gültigen Passworts sein. Das Formular ist während eines Loginversuchs gesperrt; bei einem Fehler bleiben die Eingaben für die Korrektur erhalten. Nach Erfolg wird das Formular zurückgesetzt.

## Fehler, CSRF und Routing

`tca` erfasst Netzwerk- und API-Fehler. Der Client validiert sowohl erfolgreiche Antworten als auch Fehlerantworten mit den gemeinsamen Zod-Verträgen. Die Oberfläche verwendet feste deutsche Meldungen statt beliebiger Servertexte. Eine HTML-Fehlerseite eines Proxys wird so nicht als gültige Benutzerantwort behandelt.

Jeder Schreibzugriff holt einen frischen CSRF-Token. Der Token wird nur für diese Anfrage verwendet. Ein Formular kann dadurch auch nach einem Sessionwechsel einen aktuellen Token erhalten. Mutationen werden nicht automatisch wiederholt; die Wiederholung erfolgt bewusst über die Schaltfläche.

Navigation verwendet feste interne Ziele `/` und `/login`. Es gibt keinen `redirect`-Query-Parameter, der als Navigationsziel übernommen wird. Die App verwendet kein SSR und keine extern übergebenen Hydration-Daten.

Die Seiten werden über Route-Imports bei Bedarf geladen. Dadurch muss die Startseite den Formik-/Login-Code nicht sofort mitladen. Gemeinsame MUI-Komponenten und Theme bleiben geteilt.

## React Router v7 ohne neue Architektur

Ursprünglich war v6 vorgesehen. Nach deiner Freigabe verwendet die App die gepatchte Version **7.18.5**: Der v6-Zweig wurde beim Aufbau durch zwei moderate npm-Advisories markiert (GHSA-wrjc-x8rr-h8h6 und GHSA-337j-9hxr-rhxg). Der Wechsel beseitigt diese gemeldeten Abhängigkeiten, ohne das Arbeitsmodell zu ändern.

`createBrowserRouter`, die Route-Objekte, Loader, `redirect`, `useLoaderData` und die vorhandenen Imports aus `react-router-dom` bleiben bestehen. Es gibt weiterhin eine normale Vite-SPA, kein Framework-Setup und kein SSR. Lediglich die anfängliche Ladeanzeige liegt in v7 als `HydrateFallback` an den Routen statt als `fallbackElement` am `RouterProvider`; das frühere `v7_startTransition`-Flag entfällt. Trotz des Namens wird hier keine serverseitige Hydration eingeführt.

## Lokal testen

Die API mit `npm start` und das Frontend in einem zweiten Terminal mit `npm run dev:web` starten. Im Browser **http://localhost:5173** öffnen. Zugangsdaten sind die beim `owner:create` verwendeten Werte aus deiner lokalen `.env`.

```powershell
npm run format:check
npm run check
npm test
npx playwright install chromium
npm run test:web
```

`npm test` führt Vertrags-/Unit-Tests sowie die Backend-Integration inklusive Backups aus. `npm run test:web` baut die App und startet den Chromium-Durchlauf gegen den gebauten Vite-Stand. Der Runner erzeugt eine zufällig benannte PostgreSQL-Datenbank, migriert sie und legt einen eigenen Testnutzer mit zufälligem Passwort an. Er startet eine eigene API auf einem freien Port und das Test-Frontend auf `5174`. Danach werden genau diese Datenbank und diese Server wieder entfernt, auch bei Testfehlern.

Die Browser-Prüfung klickt echte MUI-Elemente und verwendet für erfolgreiche Logins den tatsächlichen Passport-/PostgreSQL-Ablauf. Zusätzliche abgefangene Antworten simulieren gezielt Netzwerk-, CSRF-, Ratelimit- und Logout-Fehler. Screenshots für Desktop und Mobilansicht liegen lokal unter `.artifacts/web/screenshots/`; Fehler-Traces unter `.artifacts/web/test-results/`. Beides ist von Git ausgeschlossen. Screenshots enthalten ausschließlich den isolierten Testnutzer.

### Geprüfter Stand vom 8. November 2026

Nach dem Wechsel auf React Router 7.18.5 liefen Build, Lint, Typprüfung, **97 Unit-/Vertragstests**, **66 Datenbank-Integrationstests** und der Backup-Roundtrip erfolgreich gegen Docker-PostgreSQL. **14 Chromium-Szenarien** prüfen unter anderem echte Anmeldung, Neuladen, Logout mit Wiederverwendung des alten Cookies, Browser-Zurück nach Logout, die anfängliche Ladeanzeige, Fehler-Wiederholung, Tastaturbedienung und die schmale Mobilansicht. Desktop- und Mobil-Screenshots wurden visuell kontrolliert. `npm audit --audit-level=moderate` meldete keine bekannten Schwachstellen.

Der separate API-Live-Test bestand alle **16 HTTP-Prüfungen**. Die Tests erzeugen ihre eigenen Datenbanken und entfernen sie anschließend. Die UI wurde mit Chromium geprüft; Firefox/Safari und produktives Hosting sind nicht Bestandteil dieses Durchlaufs. Den endgültigen Linux-CI-Status immer am aktuellen PR-Commit prüfen.

## Review-Fragen

- Warum darf `currentUser()` nur bei `UNAUTHENTICATED` `null` liefern?
- Warum reicht es beim Logout nicht, im Frontend auf `/login` zu navigieren?
- Wo würdest du später einen Snippet-Loader ergänzen, ohne Prisma in den Browser zu importieren?
- Welche Theme-Vorgaben möchtest du zentral ändern, und welche Abstände gehören nur zur jeweiligen Seite?

## Quellen

- [MUI: Theme-Konfiguration](https://mui.com/material-ui/customization/theming/)
- [Formik: Validierung](https://formik.org/docs/guides/validation)
- [React Router v7: createBrowserRouter](https://api.reactrouter.com/v7/functions/react-router.createBrowserRouter.html)
- [React Router: Änderungen und v6-Kompatibilität](https://reactrouter.com/changelog)
- [Playwright: Browser-Tests](https://playwright.dev/docs/writing-tests)
