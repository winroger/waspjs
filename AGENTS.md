# WaspJS instructions

Diese Anweisungen gelten für das gesamte Repository. Die Regeln für Struktur,
Header und Kommentare werden hier maßgeblich gepflegt.

## Ziel und Arbeitsumfang

- WaspJS zunächst in JavaScript weiterentwickeln. Priorität ist die Angleichung
  an den tatsächlichen GH-Wasp-Core. Eine TypeScript-Migration, ein neuer Core
  oder eine neue Komponenten-API benötigen einen eigenen Auftrag.
- Vor Arbeiten [README](README.md), [Referenz](REFERENCE.md) und
  [Entwicklung/Release](CONTRIBUTING.md) lesen.
  Dokumentierte Aussagen am Quellcode prüfen; die Dokumentation ist kein
  vollständiger Kompatibilitätsnachweis.
- Wenn der gemeinsame Workspace vorhanden ist, zusätzlich
  `../wasp-workspace/AGENTS.md`,
  `../wasp-workspace/ARCHITECTURE.md`,
  `../wasp-workspace/backlog/README.md` und den zum Auftrag gehörenden
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
- DisCo vollständig auslassen, einschließlich seiner Komponenten, Integrationen
  und Import-/Exporttests; gemeinsame Core-Funktionen unabhängig davon angleichen.
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
- `src/core/` enthält das Datenmodell und dessen Klassenverhalten.
  `src/operations/` bildet die funktionsorientierte Fachschicht: dort eigenständige
  Abläufe ablegen, die Core-Objekte erzeugen oder verarbeiten, einschließlich
  zusätzlicher Fachlogik aus GH-Komponenten. `generateRules.js` ist das erste
  Beispiel. Operations sind unabhängig von Grasshopper und Viewer/UI; vorhandene
  Core-Methoden verwenden und deren Logik nicht nochmals implementieren.
- Nicht jede GH-Komponente benötigt eine eigene Operation oder Datei. Ein reiner
  Aufruf einer vorhandenen Core-Methode begründet keinen zusätzlichen Wrapper.
  Die Schicht im beauftragten Umfang schrittweise ausbauen; keine ungefragte
  Massenmigration vorhandener Funktionen oder Komponenten-API einführen.
- Öffentliche Klassen und Operations über `src/index.js` bereitstellen. Ordner
  bestimmen die Zuständigkeit, nicht automatisch die öffentliche API. Bei einer
  Verschiebung bestehende Paketnamen und Signaturen erhalten; notwendige bisherige
  Modul-Exporte als Re-Export derselben Implementierung erhalten.
  Aggregationsabfragen und Zustandsverhalten maßgeblich in der Core-Klasse
  pflegen; globale und eingeschränkte Abfragen nutzen dieselben internen
  Auswertungen ohne unnötige Suche außerhalb ihres Umfangs. Keine parallele
  Aggregations-Operations-Schicht anlegen. Die sechs vorhandenen Paket-Helfer
  bleiben als veraltete Core-lokale Delegates für bestehende Importe erhalten;
  neue Beispiele verwenden die Klassenmethoden. Unterschiedliche Regelprojektionen
  nicht in solchen Helfern pflegen. Eine spätere Entfernung öffentlicher Namen
  benötigt einen eigenen Auftrag. Die öffentliche Schnittstelle umfasst alle
  Paketexporte und Klassenmethoden, nicht allein diese Hilfsfunktionen.
  Der Benutzer hat die alte Forwarding-Datei ausdrücklich entfernen lassen;
  dafür keinen Kompatibilitäts-Re-Export wieder einführen.
- Abweichungen vom Python-Verhalten ausdrücklich begründen und prüfen. Bekannte
  Upstream-Fehler nicht stillschweigend als gewünschtes Verhalten übernehmen.
- Bestehende Dateien bei fachlichen Änderungen schrittweise an diesen Stil
  anpassen. Keine ungefragte Massenformatierung, Umordnung oder Verhaltensänderung
  allein zur Vereinheitlichung der Kommentare.
- Gemeinsame Host-/Three.js-Helfer nach Möglichkeit in `src/core/utilities.js`
  halten; eigenständige Fachabläufe gehören in `src/operations/`.
  In Utilities und Operations pro Funktion die Herkunft mit Quellpfad kennzeichnen:
  `GH-Wasp utility counterpart`, `GH-Wasp component counterpart`,
  `JS host-API adapter` oder `JS-specific helper`. Einen Rhino-API-Ersatz nicht
  als ursprüngliche Python-Utility ausgeben; bekannte Unterschiede ergänzen.
  Die Herkunftszuordnung ist kein Paritätsnachweis. Interne Helfer mit
  `@internal` markieren und aus dem Paket-Einstieg `src/index.js` ausschließen;
  bestehende öffentliche Utility-Exporte erhalten.

## Header und Kommentare

- Kommentare und API-Dokumentation auf Englisch schreiben. Die fachliche
  Gliederung von GH-Wasp übernehmen und mit JavaScript-Kommentaren ausdrücken.
- Neue Core- und Operations-Dateien mit einem kurzen `/** ... */`-Dateikopf beginnen: Projekt,
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

## Öffentliche Dokumentation

- README auf Installation, ausführbare Beispiele und Anwendungsnutzung ausrichten.
  Detaillierte öffentliche Verträge in `REFERENCE.md`, Entwicklung/Release in
  `CONTRIBUTING.md` pflegen. Änderungen derselben Aussage nur dort nachführen.
- Öffentliche Nutzungsdokumentation muss ohne benachbarte Repositories lesbar sein.
  Keine lokalen absoluten Pfade, Workspace-Links oder Links zu ignorierten Dateien.
  Optionale lokale Agenten-Anweisungen sind keine Installationsvoraussetzung.
- JSDoc mit Signaturen, Standardwerten, ID-Typen, Mutation und Rückgaben abstimmen.
  Vorhandene API-/Host-Grenzen ausdrücklich belassen; keine vollständige GH-Parität
  oder TypeScript-Typdeklarationen aus Kommentaren ableiten.
- Das veröffentlichte Archiv enthält `dist`, `REFERENCE.md`, README und Lizenz.
  `prepack` erzeugt frische Bundles; keine Version, Tags oder Veröffentlichung
  allein aus Dokumentations-/Paketprüfungen ableiten.

## Prüfung und Abschluss

- Änderungen am Verhalten mit passenden Regressionstests und vorhandenen
  Fixtures absichern. Relevante Projektprüfungen stehen in der README.
- Schema-Gültigkeit, JS-Regressionen, numerische Vergleiche und echte
  Rhino-/Grasshopper-Tests als getrennte Nachweise dokumentieren. Nur tatsächlich
  ausgeführte Prüfungen als bestanden melden; offene Unterschiede benennen.
- Bei reinen Markdown-/Anweisungsänderungen Links und Diff prüfen. Keine
  Installationen, Builds, neuen Tests oder Generatoren allein für diese
  Dokumentationsregeln hinzufügen.
