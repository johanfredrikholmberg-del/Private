# StudieLots frontend-arkitektur

`src/` är den aktiva frontend-strukturen. Nya frontendändringar ska göras här. Äldre versionsfiler i roten är historiska/legacy och får inte användas som ny runtime-källa.

## Struktur

- `core/` – examensmotor, examensregler och gemensam matchningskonsistens.
- `features/merit-import/` – import och normalisering av meriter.
- `features/programs/` – programindex, kanonisering, programsök och programvägar.
- `features/credit-transfer/` – historiska beslut, hp-allokering och etiketter.
- `features/fast-route/` – Snabbare väg och dess skydd/preload.
- `features/planner/` – planerarspecifik logik som delas mellan ordinarie och snabbare väg.
- `features/demo/` – demo- och exempeldataflöde.
- `pages/` – en mapp per sida med sidans markup och senare även sidunik logik.
- `ui/` – endast gemensamma UI-komponenter. Laddningsindikatorer ligger under `ui/loading/`.
- `styles/` – gemensam styling och planerardesign.
- `bootstrap.js` – enda ingången som bestämmer laddningsordning och monterar sidorna.

## Regler

1. En funktion ska ha ett tydligt ägarområde. Lägg inte featurelogik i generiska UI-filer.
2. Ordinarie väg och Snabbare väg får dela rena hjälpfunktioner men ska inte skriva över varandras state.
3. Programdata, examenslogik och rendering ska hållas separerade.
4. `bootstrap.js` är enda platsen som bestämmer laddningsordningen för frontendmodulerna.
5. En sida ska äga sin markup i `pages/<sida>/page.js`; `index.html` ska bara innehålla appskal och navigation.
6. Demo är en feature och ska därför ligga under `features/demo/`, inte under `ui/`.
7. Generella laddningsindikatorer är UI-komponenter och ligger under `ui/loading/`.
8. Nya stora filer i repo-roten är inte tillåtna. Runtimekod ska ligga under `src/`, serverkod under `api/`, databyggare/audits under `scripts/` och genererad data under `data/`.
9. Legacyfiler i roten får tas bort först när ingen workflow, regressionstest eller deploy längre refererar dem.
10. Ingen ny modul ska läggas till utan att den antingen laddas av runtime/test eller tydligt är bygg-/dokumentationskod; död experimentkod ska tas bort.

## Sidägarskap

- `pages/home/` – startsida och demo-entry.
- `pages/studies/` – meritimportflöde.
- `pages/opportunities/` – examensmatchningar och vägar.
- `pages/planner/` – Planeraren och växlare mellan ordinarie/snabbare väg.
- `pages/programs/` – programsök.
- `pages/more/` – Mer-menyn.
- `pages/method/` – metod och datatransparens.

## Ändringsprincip

Vid en mindre ändring ska i första hand endast sidan eller featuremappen som äger funktionen behöva ändras. Om en ändring kräver flera orelaterade mappar ska beroendet först granskas och vid behov brytas ut till en gemensam modul.

Den största kvarvarande frontendfilen är app-runtime. Den ska delas stegvis: navigation/state först, därefter Möjligheter och Planeraren. Varje steg ska behålla befintliga regressionstester och inte blanda in funktionsändringar i samma refaktorering.
