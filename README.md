# PeakPlan – deine private Trainings-App (Version 1)

Eine mobile, offlinefähige Progressive Web App (PWA) für Bouldern, Maximalkraft und Laufen. **Kein Abo, keine Domain, kein Backend.**

## Funktionsumfang

- Monats- und Wochenkalender mit wiederkehrenden Vorlagen (Mo/Do Kraft, Mi Intervalle, So Lauf etc.).
- Einheiten ansehen, individuell anpassen, hinzufügen, verschieben und als ausgefallen markieren.
- Trainingsprogramme mit Übungen, Sätzen/Belastung und Notizen.
- Trainingstagebuch mit RPE, Fingerboardlast, Pull-up-Zusatzgewicht und Laufdaten.
- Diagramme aus den tatsächlich eingetragenen Daten.
- Kalenderexport (`.ics`) mit Alarmen und vollständigen Trainingseinheiten in der Beschreibung.
- JSON-Export und -Import als Datensicherung.
- Offline-Modus nach erstmaligem Laden über HTTPS und erfolgreichem Service-Worker-Caching.

## Auf dem iPhone veröffentlichen – ohne Computer

1. Ein **kostenloses GitHub-Konto** auf https://github.com erstellen bzw. anmelden.
2. Ein neues **öffentliches** Repository anlegen, zum Beispiel `peakplan` (GitHub Pages ist bei GitHub Free für öffentliche Repositories verfügbar).
3. Diese ZIP-Datei in der App **Dateien** antippen – iOS entpackt sie in einen Ordner.
4. Auf GitHub das Repository öffnen → **Add file → Upload files**. **Den Inhalt des Ordners `peakplan_pwa` hochladen**, insbesondere `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest` und beide PNG-Dateien. Die Dateien müssen direkt im Repository-Stamm liegen, nicht als ZIP oder in einem Unterordner. Bei Bedarf in Safari „Desktop-Website anfordern“.
5. Im Repository **Settings → Pages → Build and deployment → Deploy from a branch** auswählen. Branch `main` und Ordner `/(root)` wählen, **Save**.
6. Die fertige Adresse ist gewöhnlich `https://DEINNAME.github.io/peakplan/`. Die GitHub-Pages-Bereitstellung kann einige Minuten dauern.
7. Die Adresse **in Safari** öffnen → Teilen → **Zum Home-Bildschirm**. Danach PeakPlan über das neue App-Icon starten.
8. Unter **Plan & Backup** den Wochenplan und die Uhrzeiten anpassen.

## Erinnerung am iPhone

1. In der App **Plan & Backup → iPhone-Erinnerungen** wählen.
2. Vorlaufzeit und Exportzeitraum festlegen → **Kalenderdatei (.ics) erstellen**.
3. In der App **Dateien** die heruntergeladene `.ics` speichern. **Der zuverlässiger von Apple dokumentierte Importweg ist über einen Anhang in der Apple-Mail-App.** Daher die `.ics` bei Bedarf an die eigene Mail-Adresse schicken und aus dem Anhang mit der Kalender-App importieren. Je nach iOS-Version können auch andere Importwege verfügbar sein.
4. Benachrichtigungen für Kalender in den iPhone-Einstellungen zulassen. Nach dem Import sollte ein Testtermin kontrolliert werden, ob der Alarm übernommen wurde.

**Wichtige Grenze:** Das ist ein Export des aktuellen Stands, **keine automatische Synchronisation**. Wenn sich Termine ändern, musst du die betroffenen Termine in Apple Kalender aktualisieren oder den exportierten Kalender ersetzen, sonst entstehen veraltete bzw. doppelte Einträge. Echte automatische Web-Push-Benachrichtigungen benötigen einen zusätzlichen Push-Server, der hier noch nicht eingebaut ist.

## Datenschutz und Backups

Der App-Code liegt öffentlich auf GitHub, **aber deine persönlichen Trainingslogs werden nicht zu GitHub hochgeladen**. Sie liegen ausschließlich im lokalen Browser-App-Speicher (IndexedDB, im Fehlerfall localStorage). Daten können verlorengehen, insbesondere beim Löschen der Web-App / Browserdaten, beim Gerätewechsel oder bei Speicherbereinigung. Daher regelmäßig **Backup exportieren**, idealerweise in iCloud Drive. Backups enthalten persönliche Trainingsnotizen und sollten nicht öffentlich ins Repository hochgeladen werden.

## Technisch

Reine HTML/CSS/JavaScript-Dateien, kein Node, npm oder Build-Tool nötig. Zum Offline-Betrieb muss die App über **HTTPS** geladen sein. `file://` kann den Service Worker nicht nutzen. Öffne die App nicht nur als ZIP-Datei; sie muss auf einer HTTPS-Seite bereitgestellt werden.

## Status und Einschränkungen

Diese erste Version wurde mit einem automatisierten Chromium-Browsertest geprüft; sie wurde noch nicht auf einem echten iPhone / mit Apple Kalender validiert. Benutzeroberfläche und Exportfunktionen sind funktionsfähig, aber iOS-spezifische Eigenheiten beim `.ics`-Import müssen auf dem Gerät getestet werden.

**Training:** Die mitgelieferten Vorlagen orientieren sich an einem ambitionierten Boulder-/Kraft-/Laufwochenrhythmus, sind aber keine automatische Belastungssteuerung. Wegen der bestehenden Schulterbeschwerden Übungen mit Schmerzen auslassen und nach medizinischer Abklärung anpassen.
