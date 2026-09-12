# StudieLots frontend-arkitektur

`src/` är den aktiva frontend-strukturen. Nya frontendändringar ska göras här. Äldre versionsfiler i roten är historiska/legacy och får inte användas som ny runtime-källa.

## Struktur

- `core/` – examensmotor, examensregler och gemensam matchningskonsistens.
- `features/merit-import/` – import och normalisering av meriter.
- `features/programs/` – programindex, kanonisering, programsök och programvägar.
- `features/credit-transfer/` – historiska beslut, hp-allokering och etiketter.
- `features/fast-route/` – Snabbare väg och dess skydd/preload.
- `features/planner/` – planerarspecifik logik som delas mellan ordinarie och snabbare väg.
- `pages/` – en mapp per sida med sidans markup och senare även sidunik logik.
- `ui/` – appskal och helt gemensam UI-logik.
- `styles/` – gemensam styling och planerardesign.
- `bootstrap.js` – enda ingången som bestämmer laddningsordning och monterar sidorna.

## Regler

1. En funktion ska ha ett tydligt ägarområde. Lägg inte featurelogik i `ui/app.js` om den hör hemma i en feature.
2. Ordinarie väg och Snabbare väg får dela rena hjälpfunktioner men ska inte skriva över varandras state.
3. Programdata, examenslogik och rendering ska hållas separerade.
4. `bootstrap.js` är enda platsen som bestämmer laddningsordningen för frontendmodulerna.
5. En sida ska äga sin markup i `pages/<sida>/page.js`; `index.html` ska bara innehålla appskal och navigation.
6. Nya stora filer i repo-roten är inte tillåtna. Runtimekod ska ligga under `src/`, serverkod under `api/`, databyggare/audits under `scripts/` och genererad data under `data/`.
7. Legacyfiler i roten får tas bort först när ingen workflow, regressionstest eller deploy längre refererar dem.

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
