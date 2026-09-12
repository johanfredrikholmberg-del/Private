# StudieLots frontend-arkitektur

`src/` är den aktiva frontend-strukturen. Nya frontendändringar ska göras här. Äldre versionsfiler i roten är historiska/legacy och får inte användas som ny runtime-källa.

## Struktur

- `app/` – gemensamt state/context och den tunna runtime som kopplar ihop sidmoduler.
- `core/` – examensmotor, examensregler och gemensam matchningskonsistens.
- `features/merit-import/` – import och normalisering av meriter.
- `features/programs/` – programindex, kanonisering och programvägar; sidrendering ligger inte här.
- `features/credit-transfer/` – historiska beslut, hp-allokering och etiketter.
- `features/fast-route/` – Snabbare väg och dess skydd/preload.
- `features/planner/` – planerarspecifik delad logik.
- `features/demo/` – demo- och exempeldataflöde.
- `pages/` – en mapp per sida. Sidans markup ligger i `page.js` och sidunik beteendelogik i `controller.js` där sådan behövs.
- `ui/` – endast gemensamma UI-komponenter. Laddningsindikatorer ligger under `ui/loading/`.
- `styles/` – gemensam styling och planerardesign.
- `bootstrap.js` – enda ingången som bestämmer laddningsordning och monterar sidorna.

## Regler

1. En funktion ska ha ett tydligt ägarområde. Lägg inte featurelogik i generiska UI-filer.
2. Ordinarie väg och Snabbare väg får dela rena hjälpfunktioner men ska inte skriva över varandras state.
3. Programdata, examenslogik och rendering ska hållas separerade.
4. `bootstrap.js` är enda platsen som bestämmer laddningsordningen för frontendmodulerna.
5. En sida ska äga sin markup i `pages/<sida>/page.js`; sidunik interaktion ska i första hand ägas av `pages/<sida>/controller.js`.
6. `app/runtime.js` ska förbli tunt och bara sköta appövergripande koordinering/navigation. Affärslogik hör inte hemma där.
7. Demo är en feature och ska därför ligga under `features/demo/`, inte under `ui/`.
8. Generella laddningsindikatorer är UI-komponenter och ligger under `ui/loading/`.
9. Nya stora filer i repo-roten är inte tillåtna. Runtimekod ska ligga under `src/`, serverkod under `api/`, databyggare/audits under `scripts/` och genererad data under `data/`.
10. Legacyfiler i roten får tas bort först när ingen workflow, regressionstest eller deploy längre refererar dem.
11. Ingen ny modul ska läggas till utan att den antingen laddas av runtime/test eller tydligt är bygg-/dokumentationskod; död experimentkod ska tas bort.

## Sidägarskap

- `pages/home/` – startsida och demo-entry.
- `pages/studies/` – meritimportflöde och val av meritkälla.
- `pages/opportunities/` – examensmatchningar, lärosätesval och programval.
- `pages/planner/` – Planeraren, ordinarie väg och presentationen av Snabbare väg.
- `pages/programs/` – programsök och programkatalogens sidcontroller.
- `pages/more/` – Mer-menyn.
- `pages/method/` – metod och datatransparens.

## Ändringsprincip

Vid en mindre ändring ska i första hand endast sidan eller featuremappen som äger funktionen behöva ändras. Om en ändring kräver flera orelaterade mappar ska beroendet först granskas och vid behov brytas ut till en gemensam modul.

Den tidigare stora app-runtimen är nu uppdelad: gemensamt state ligger i `app/context.js`, meritimport i `pages/studies/controller.js`, examensvägar i `pages/opportunities/controller.js` och planeraren i `pages/planner/controller.js`. `app/runtime.js` ska därför inte växa tillbaka till ett monolitiskt lager.
