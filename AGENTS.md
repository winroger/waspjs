# WaspJS instructions

Diese Anweisungen gelten für das gesamte Repository. Die Regeln für Struktur,
Header und Kommentare werden hier maßgeblich gepflegt.

## Ziel und Arbeitsumfang

- WaspJS zunächst in JavaScript weiterentwickeln. Priorität ist die Angleichung
  an den tatsächlichen GH-Wasp-Core. Eine TypeScript-Migration, ein neuer Core
  oder eine neue Komponenten-API benötigen einen eigenen Auftrag.
- Vor Arbeiten [README](README.md) und [Architektur](docs/ARCHITECTURE.md) lesen.
  Dokumentierte Aussagen am Quellcode prüfen; die Dokumentation ist kein
  vollständiger Kompatibilitätsnachweis.
- Wenn der gemeinsame Workspace vorhanden ist, zusätzlich
  [Workspace-Anweisungen](../wasp-workspace/AGENTS.md),
  [Architektur](../wasp-workspace/ARCHITECTURE.md),
  [Backlog](../wasp-workspace/backlog/README.md) und den zum Auftrag gehörenden
  Feature-Eintrag lesen. Dort bleiben repoübergreifende Regeln, Referenzstände,
  Prüfberichte und Release-Planung; diese Inhalte hier nicht kopieren.
- Das originale GH-Wasp ist ausschließlich lesende Referenz. Dort keine Dateien,
  Git-Zustände, Branches oder Remotes verändern und keine PRs oder Pushes anlegen.
- Neue Features vom aktuellen lokalen `main` auf einem passenden `feature/...`-
  Branch starten; Änderungen und Commits im beauftragten Umfang dort durchführen.
  Die ausdrückliche Feature-Abnahme durch den Benutzer gilt als dauerhafte
  Freigabe, den geprüften Stand lokal zu committen und nach `main` zu mergen,
  ohne erneut nach Merge-Erlaubnis zu fragen. Fast-forward bevorzugen und den
  vollständig integrierten lokalen Arbeitsbranch anschließend entfernen.
  Das nächste beauftragte Feature beginnt wieder auf dem aktualisierten `main`.
  Ein Arbeitsauftrag allein ist noch keine Abnahme. Push, Veröffentlichung und
  App-Updates benötigen weiterhin eigene Anweisungen. GH-Wasp bleibt ausgenommen.
- Änderungen an diesem Paket aktualisieren nicht automatisch die Anwendungen.
  Atlas/Explorer und Pipe einschließlich Dependencies und Lockfiles nur nach
  gesondertem Auftrag ändern. Der frühe `wasp-spec`-Draft ist ergänzende Referenz.

## Struktur am GH-Wasp-Core ausrichten

- Bei neuen oder fachlich geänderten Core-Funktionen das entsprechende
  Python-Modul sowie Klasse/Methode ermitteln. Diese Zuordnung im Kommentar oder
  einem verlinkten Prüfbericht nachvollziehbar machen.
- Klassen, Methoden und fachliche Abschnitte möglichst in derselben Reihenfolge
  wie im Python-Gegenstück halten. Bestehende öffentliche JS-Namen, Signaturen,
  Feldnamen und Exporte dabei erhalten; Umbenennungen sind eigene API-Änderungen.
- `ghComp` zusätzlich lesen, wenn eine Benutzerfunktion nachgebildet wird.
  Dort können Standardwerte, Eingabeprüfung und weitere Fachlogik liegen.
  Grasshopper-spezifische UI-, Datei- und Komponenten-Zustandsverwaltung getrennt
  vom JS-Core behandeln.
- Abweichungen vom Python-Verhalten ausdrücklich begründen und prüfen. Bekannte
  Upstream-Fehler nicht stillschweigend als gewünschtes Verhalten übernehmen.
- Bestehende Dateien bei fachlichen Änderungen schrittweise an diesen Stil
  anpassen. Keine ungefragte Massenformatierung, Umordnung oder Verhaltensänderung
  allein zur Vereinheitlichung der Kommentare.

## Header und Kommentare

- Kommentare und API-Dokumentation auf Englisch schreiben. Die fachliche
  Gliederung von GH-Wasp übernehmen und mit JavaScript-Kommentaren ausdrücken.
- Neue Core-Dateien mit einem kurzen `/** ... */`-Dateikopf beginnen: Projekt,
  Modulzweck und gegebenenfalls Pfad des Python-Gegenstücks. Vorhandene
  Herkunfts-, Copyright- und Lizenzhinweise erhalten.
- Copyright, Autor, Jahreszahlen und Lizenzangaben nicht pauschal aus einer
  Vorlage übernehmen oder ersetzen. WaspJS und die GH-Quelldateien enthalten
  unterschiedliche Lizenzangaben; ein Stilauftrag klärt oder ändert diese nicht.
- GH-Referenzversion und WaspJS-Paketversion getrennt behandeln. Kein
  `@version 0.7.003` in JS-Dateien als vermeintliche WaspJS-Version setzen.
  Den tatsächlich untersuchten GH-Commit, die Version und den geprüften Umfang
  zentral im zugehörigen Feature-/Kompatibilitätsbericht festhalten und bei Bedarf
  aus dem Code darauf verweisen. Keine verteilten Kopien des Referenzstands pflegen.
- Klassen bzw. größere fachliche Bereiche mit kurzen, konsistenten Trennern
  gliedern, etwa `// ==================== Connection ====================`.
- Ablaufabschnitte mit knappen `//`-Kommentaren kennzeichnen, etwa
  `// Read geometry`, `// Restore connections` oder `// Transform collider`.
  Kommentare sollen Absicht, Konventionen oder zusammengehörige Schritte erklären;
  nicht jede selbsterklärende Zuweisung kommentieren.
- Öffentliche Klassen und Methoden mit JSDoc beschreiben. Sinnvolle
  `@param`, `@returns` und bei tatsächlichen Ausnahmen `@throws` ergänzen.
  Transportdaten und Laufzeitobjekte unterscheiden; bestehende Typedefs nutzen
  und fehlende Typen im Rahmen des Auftrags ergänzen. Keine unzutreffenden Typen
  oder pauschales `any` zur Vervollständigung der Dokumentation einsetzen.
- Relevante geometrische Konventionen ausdrücklich erklären: Bezugssystem,
  Transformationsreihenfolge, bereits platzierte Geometrie, Mutationen/Kopien,
  Einheiten und Toleranzen. Nur tatsächlich geltende Eigenschaften zusichern.
- Bei einer absichtlichen Abweichung einen lokalen Kommentar mit
  `GH-Wasp difference:` und Begründung verwenden; bei bekannter unvollständiger
  Unterstützung `Compatibility limitation:` mit konkretem Umfang und möglichst
  einem Verweis auf Test, Bericht oder Backlog. Keine vagen Kompatibilitätsversprechen.

### Beispiel für die Gliederung

Dieses Beispiel zeigt nur die Kommentierung; es definiert keine neue API und
enthält bewusst keine Copyright-, Lizenz- oder Versionsvorlage.

```js
/**
 * WaspJS — Connection class.
 * Upstream module: src/wasp/core/connection.py
 */

// Imports

// ==================== Connection ====================

/**
 * Stores an attachment plane, connection type and rule state.
 */
export class Connection {
    // Constructor

    // Serialization

    // Transformation and copying

    // Rule tables
}
```

## Prüfung und Abschluss

- Änderungen am Verhalten mit passenden Regressionstests und vorhandenen
  Fixtures absichern. Relevante Projektprüfungen stehen in der README.
- Schema-Gültigkeit, JS-Regressionen, numerische Vergleiche und echte
  Rhino-/Grasshopper-Tests als getrennte Nachweise dokumentieren. Nur tatsächlich
  ausgeführte Prüfungen als bestanden melden; offene Unterschiede benennen.
- Bei reinen Markdown-/Anweisungsänderungen Links und Diff prüfen. Keine
  Installationen, Builds, neuen Tests oder Generatoren allein für diese
  Dokumentationsregeln hinzufügen.
