# Sicherheitskonzept

Ziel: Wer die Seite besucht, kann sich **keinen Virus einfangen**, und ein Angreifer findet möglichst
**nichts, was er angreifen kann**.

## 1. Die wichtigste Maßnahme: Es gibt fast nichts zum Angreifen

| Was viele Websites haben | Hier |
|---|---|
| Server-Programm (PHP, Node, WordPress …) | **keins**, nur fertige Dateien |
| Datenbank | **keine** |
| Login, Formulare, Uploads | **keine** |
| Fremde Skripte (Werbung, Analytics, Fonts, CDNs) | **keine**, alles kommt von der eigenen Adresse |
| npm-Pakete | **keine**, also auch keine verseuchten Pakete möglich |
| Cookies | **keine** (der Rekord liegt nur im `localStorage` des Besuchers) |

Die meisten gehackten Websites werden über veraltete Plugins, Server-Software oder Logins geknackt.
Das alles gibt es hier nicht. Ein Hoster wie Cloudflare Pages liefert nur Dateien aus und kümmert sich
selbst um die Updates seiner Server, um Firewall und um DDoS-Schutz.

## 2. Security-Header (`public/_headers`)

Diese Header schickt der Server bei jeder Seite mit. Der Browser des Besuchers hält sich daran:

| Header | Was er bewirkt |
|---|---|
| `Content-Security-Policy` | Der Browser führt **nur** Skripte, Styles und Bilder von der eigenen Adresse aus. Kein Inline-Code, keine fremden Server, keine Verbindungen nach außen (`connect-src 'none'`), keine Formulare, keine iframes. Selbst wenn jemand bösen Code einschleusen könnte, würde der Browser ihn blockieren. |
| `require-trusted-types-for 'script'` | Blockiert die typischen Einfallstore für eingeschleusten HTML-Code (`innerHTML` u. ä.). |
| `Strict-Transport-Security` | Browser nutzen ein Jahr lang **nur noch HTTPS**, kein Abfangen über unverschlüsselte Verbindungen. |
| `X-Frame-Options: DENY`, `frame-ancestors 'none'` | Fremde Seiten dürfen das Spiel nicht unsichtbar einbetten (Clickjacking). |
| `X-Content-Type-Options: nosniff` | Der Browser rät keine Dateitypen und führt z. B. ein Bild nicht als Skript aus. |
| `Referrer-Policy: no-referrer` | Es werden keine Infos über den Besucher an andere Seiten weitergegeben. |
| `Permissions-Policy` | Kamera, Mikrofon, Standort, Zahlungen usw. sind komplett gesperrt. |
| `Cross-Origin-*-Policy` | Trennt die Seite strikt von anderen Seiten im selben Browser (Schutz vor Spectre-artigen Angriffen). |

Prüfen kann man das nach dem Veröffentlichen auch extern, z. B. auf https://securityheaders.com
(Ziel: Note A+) und https://observatory.mozilla.org.

## 3. Sicherer Code

- `spiel.js` verändert die Seite nur über `textContent` und CSS-Klassen, nie über `innerHTML`.
- Kein `eval`, kein Netzwerkzugriff. Zufall per `crypto.getRandomValues`.
- `scripts/pruefen.mjs` prüft das bei jedem Push automatisch. Baut jemand (oder eine KI) aus Versehen
  `innerHTML`, `fetch`, fremde Skripte oder Inline-Code ein, schlägt der Test fehl.

## 4. Automatische Prüfungen und Updates (GitHub)

| Was | Wann | Wozu |
|---|---|---|
| Workflow „Sicherheit“: Selbsttest | jeder Push + montags | Code-Regeln, Header, Dateien |
| Workflow „Sicherheit“: Live-Check | montags (wenn `SITE_URL` gesetzt) | Live-Seite: HTTPS, Header, Dateien == Repo |
| Gitleaks | jeder Push | findet versehentlich eingecheckte Passwörter/Schlüssel |
| CodeQL | jeder Push + montags | Sicherheitsanalyse von JavaScript und den Workflows |
| Dependabot | wöchentlich | hält GitHub-Actions (und ggf. spätere Pakete) aktuell |
| Secret-Scanning + Push-Protection | immer | GitHub blockiert Pushes mit echten Tokens |

Die Workflows haben nur **Lese-Rechte** (`permissions: contents: read`).

## 5. Keine Geheimnisse im Repo

- Für den Betrieb wird **kein einziges Passwort oder Token** gebraucht. Cloudflare holt den Code über die
  GitHub-App-Verbindung.
- `.gitignore` sperrt `.env`, Schlüsseldateien und Wächter-Protokolle.
- Konten absichern: **GitHub und Cloudflare mit 2FA** (am besten Passkey oder Authenticator-App).
  Das ist der wichtigste Punkt überhaupt, denn wer dein GitHub-Konto übernimmt, kann die Seite verändern.

## 6. Claude-Wächter

**Was er macht** (`waechter/waechter.ps1`, täglich per Windows-Aufgabe oder von Hand mit `npm run waechter`):

1. Ein **festes Skript** (kein KI-Raten) prüft die Live-Seite: HTTPS, Umleitung von http, alle Header,
   und ob **jede Datei Byte für Byte** mit dem Repo übereinstimmt. Damit wird erkannt, wenn jemand die Seite
   verändert hat (Defacement, eingeschleuster Schadcode).
2. Es sammelt die Commits der letzten 7 Tage, offene Dependabot-, CodeQL- und Secret-Scanning-Meldungen
   und den Status der GitHub-Prüfungen.
3. **Claude** liest diesen Bericht und bewertet ihn: Ist ein Commit verdächtig (CSP gelockert, fremdes Skript,
   neuer Autor, Workflow mit mehr Rechten)? Was soll der Nutzer konkret tun? Antwort auf Deutsch, für Einsteiger.
4. Bei **WARNUNG** oder **ALARM** kommt eine ntfy-Nachricht aufs Handy. Protokoll in `waechter/logs/`.

**Sicherheitsregeln für den Wächter selbst:**
- Claude darf dabei **nur lesen**: keine Befehle, kein Schreiben, kein Internet. Es kann also nichts kaputt
  machen und auch nicht durch einen präparierten Commit-Text zu etwas „überredet“ werden.
- Schlägt der feste Check fehl, ist der Status **immer ALARM**, auch wenn Claude „OK“ sagen würde.
- Der Wächter läuft auf dem Laptop. Schläft der Laptop, holt Windows den Lauf beim Aufwachen nach.
  Zusätzlich prüft GitHub die Live-Seite jeden Montag unabhängig vom Laptop.

**Was er ehrlich NICHT kann:**
- Er ist **kein Virenscanner und keine Firewall**. Er blockiert keine Angriffe in Echtzeit, er **meldet**
  Auffälligkeiten nachträglich (bis zu 24 h später).
- Er ersetzt weder den DDoS-Schutz, die Firewall und die Server-Updates des Hosters (macht Cloudflare)
  noch Updates und 2FA bei deinen Konten (machst du).
- Claude kann sich irren. Darum entscheidet bei Datei- oder Header-Abweichungen das feste Skript, nicht Claude.
- Er sieht nur, was auf GitHub und auf der Live-Seite passiert. Wird dein Laptop selbst verseucht, hilft
  nur der normale Windows-Schutz (Defender, Updates).

## 7. Wenn Alarm kommt

1. Protokoll in `waechter/logs/` lesen.
2. „Datei weicht ab“, aber du hast gerade nichts veröffentlicht: In Cloudflare Pages unter **Deployments**
   die letzte gute Version mit **Rollback** wiederherstellen. Dann GitHub- und Cloudflare-Passwort ändern
   und die angemeldeten Geräte prüfen.
3. Unbekannter Commit: auf GitHub ansehen, mit `git revert` rückgängig machen und das Konto absichern.
4. Dependabot/CodeQL-Meldung: den Pull Request von Dependabot prüfen und mergen bzw. die Meldung lesen.
