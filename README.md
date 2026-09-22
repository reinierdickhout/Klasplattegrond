# Klasplattegrond

Lokale hulptool voor klassenmanagement en het leren van namen. Draait als losse Windows-app (Tauri + React);
alle gegevens staan als JSON-bestanden op de eigen computer. Er is geen netwerkverbinding, account of cloud nodig.

## AVG: studentgegevens gaan nooit naar git

Klassen, lessen en aanwezigheid staan lokaal in een `data/`-map (`klassen.json`, `lessen.json`, `lokalen.json`).
Die map staat in `.gitignore` en wordt dus **nooit** meegecommit of gepusht — ook niet per ongeluk, ook niet bij `git add -A`.

Je hoeft zelf niets aan te maken: de app maakt `data/` en de JSON-bestanden zelf aan zodra je voor het eerst een
klas of les opslaat. Iedereen die dit project clonet start dus met een lege, eigen `data/`-map, ook al werkt een
collega al met een gevulde. Zie [Gegevens (AVG)](#gegevens-avg) hieronder voor de precieze locatie.

## Downloaden en gebruiken (geen technische kennis nodig)

Je hoeft niets te installeren of te bouwen om de app te *gebruiken*:

1. Ga naar de [Releases-pagina](https://github.com/reinierdickhout/Klasplattegrond/releases/latest) van deze repository.
2. Download onder **Assets** het bestand `Klasplattegrond.exe`.
3. Zet dat bestand in een eigen map, bijvoorbeeld `C:\Users\<jouw-naam>\Klasplattegrond\` — **niet** in OneDrive of een
   andere gesynchroniseerde map (zie AVG hierboven).
4. Dubbelklik de exe om te starten. Windows kan bij de eerste keer een "onbekende uitgever"-waarschuwing tonen
   (SmartScreen) omdat het bestand niet digitaal ondertekend is — kies *Meer info* > *Toch uitvoeren*.

Bij de eerste opslag maakt de app zelf een `data`-map naast de exe aan; daar hoef je niets voor te doen.

Staat er een nieuwere versie op de Releases-pagina dan die je hebt? Download die en vervang de oude .exe — je eigen
`data`-map blijft gewoon staan, want die staat los van de exe.

## Meebouwen / de broncode gebruiken

Dit heb je alleen nodig als je aan de app wilt *ontwikkelen*, niet om hem te gebruiken (zie hierboven).

**Eenmalig installeren:**

- [Node.js](https://nodejs.org) (LTS)
- Rust via [rustup](https://rustup.rs) (installeert automatisch de juiste `stable-x86_64-pc-windows-msvc`-toolchain)
- Microsoft C++ Build Tools ("Desktop development with C++" workload) via de
  [Visual Studio Build Tools-installer](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- WebView2 runtime — zit standaard al in Windows 10/11

Controleren of alles gevonden wordt (open een **nieuwe** terminal na installeren, zodat PATH ververst is):

```
node -v
cargo -v
```

**Project ophalen en draaien:**

```
git clone <repo-url>
cd Klasplattegrond
npm install
npm run dev          # opent de app; live herladen bij codewijzigingen
```

De eerste keer `npm run dev` duurt de Rust-compilatie een paar minuten; daarna is het snel.

**Een standalone .exe bouwen:**

```
npm run build
```

De exe komt in `C:\tauri-build\klasplattegrond\release\klasplattegrond.exe` (bewust buiten deze projectmap,
zodat een OneDrive-gesynchroniseerde kloon de build-output niet meesynchroniseert). Kopieer hem naar een eigen map
om te gebruiken, bijvoorbeeld `C:\Users\<jouw-naam>\Klasplattegrond\`.

**Tests:**

```
npm test              # unit-tests (indeling, rotatie, namen, aanwezigheid)
npx tsc                # typecheck
```

## Gebruik

1. **Klassen** > *Importeren uit Excel / CSV*: kies een `.xlsx`/`.csv` (of plak namen). Kolommen voornaam / tussenvoegsel / achternaam /
   studentnummer worden herkend en zijn aan te passen. Opnieuw importeren in een bestaande klas voegt nieuwe studenten toe.
2. **Lessen** > *Nieuwe les*: kies klas, datum en lokaalgrootte (18, 24, 32, 48 of een eigen aantal). Je krijgt een standaardindeling in
   blokken van 2 tafels breed (18 = 3 blokken van 2 breed x 3 diep).
3. **Eén scherm, in willekeurige volgorde**: tafels en namen kun je door elkaar doen, er zijn geen modi.
   - *Tafels*: slepen (snapt op een raster), draaien in kwartslagen (knoppen of `Ctrl+←/→`), meerdere tafels selecteren
     (kader of Shift-klik) om een blok te verplaatsen of samen te draaien, uitlijnen, toevoegen/verwijderen, `Ctrl+Z`. De naam gaat mee met de tafel.
   - *Namen slepen*: uit de lijst naar een tafel; via de greep (⠿) op een bezette tafel naar een andere tafel (vrij = verhuizen,
     bezet = wisselen; tijd en 'later'-status blijven behouden); naar de lijst = losmaken. `Esc` annuleert tijdens het slepen.
   - *Namen klikken*: klik een tafel en typ een naam (het zoekveld hoef je niet aan te klikken), `Enter` = eerste treffer; of klik eerst
     een naam en dan een tafel.
   - De les start vanzelf bij de eerste koppeling (of met *Start les*). *Aanvang afsluiten* markeert iedereen die daarna wordt gekoppeld
     als *later binnengekomen* (amber, met tijd). *Namen oefenen* verbergt de namen zodat je jezelf kunt overhoren.
   - *Lokaal en standaardindeling* (inklapbaar in de zijbalk): grootte kiezen en de standaardindeling opnieuw maken, lokaal breder/dieper,
     indeling bewaren voor hergebruik.
4. Het plattegrond staat vanuit de docent: bord onderaan, voorste rij het dichtst bij het bord, stoelen aan de kant van het bord af.
5. **Aanwezigheidslijst**: per student *bij aanvang* / *later* / *afwezig*; afdrukken/PDF, opslaan als CSV (opent in Excel) of kopiëren.

## Gegevens (AVG)

| Situatie | Map |
|---|---|
| Geïnstalleerde app (de .exe die je zelf gebruikt) | `data\` naast de exe |
| `npm run dev` | `%LOCALAPPDATA%\nl.avans.klasplattegrond\dev-data` (bewust buiten het projectpad/OneDrive) |
| Overschrijven | omgevingsvariabele `KLASPLATTEGROND_DATA` |

Bestanden: `klassen.json`, `lessen.json`, `lokalen.json` (+ `.json.bak` = vorige versie). Schrijven gebeurt atomair (tmp + hernoemen).
Ze worden pas aangemaakt bij de eerste opslag — er is niets om vooraf handmatig te maken.

**Zet de app-map (of, tijdens ontwikkelen, deze geclonede projectmap) niet in OneDrive of een andere gesynchroniseerde map**,
en zeker niet in een map die je met collega's deelt buiten git om — dan staan de namen alsnog ergens buiten je eigen computer.
*Privacy > Alle gegevens wissen* in de app verwijdert alles. De release-build heeft een strikte CSP (`default-src 'self'`);
de app kan sowieso geen externe verbindingen maken.

## Bijdragen / updates ophalen

```
git pull
npm install           # als package.json is gewijzigd
npm run dev
```

Je eigen `data/`-map (buiten git) blijft altijd staan en wordt nooit overschreven door een `git pull` — die map bestaat
voor git simpelweg niet.

Houd de npm-pakketten `@tauri-apps/*` op dezelfde minor-versie als de Rust-crates (`tauri` 2.10, `tauri-plugin-dialog` 2.6);
bij een mismatch weigert `tauri build`. Bouw vanuit het echte projectpad, niet via een junction/symlink (rollup faalt dan).

## Een nieuwe versie publiceren (voor de beheerder)

Zo komt een nieuwe .exe op de [Releases-pagina](https://github.com/reinierdickhout/Klasplattegrond/releases) te staan,
zodat collega's zonder git of build-tools de update kunnen downloaden:

1. Verhoog het versienummer in `package.json` en `src-tauri/tauri.conf.json` (bv. `0.1.0` → `0.2.0`), commit en push.
2. Bouw de exe: `npm run build`.
3. Maak een git-tag en push die: `git tag -a v0.2.0 -m "Omschrijving van de wijzigingen"` en `git push origin v0.2.0`.
4. Ga op GitHub naar **Releases > Draft a new release**, kies de zojuist gepushte tag, geef de release een titel/omschrijving,
   en sleep `C:\tauri-build\klasplattegrond\release\klasplattegrond.exe` in het vak *Attach binaries* — hernoem het bestand
   daar naar `Klasplattegrond.exe`. Klik op **Publish release**.

De link naar `/releases/latest` in dit document wijst dan automatisch naar de nieuwste versie.
