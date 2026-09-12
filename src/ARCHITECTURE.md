# StudieLots frontend-arkitektur

`src/` är nu den aktiva frontend-strukturen. Nya ändringar ska göras här, inte i de äldre `v2-*`-filerna i roten.

## Struktur

- `core/` – examensmotor, examensregler och gemensam matchningskonsistens.
- `features/merit-import/` – import och normalisering av meriter.
- `features/programs/` – programsök, programindex, kanonisering och programvägar.
- `features/credit-transfer/` – historiska beslut, hp-allokering och etiketter.
- `features/fast-route/` – Snabbare väg och dess skydd/preload.
- `features/planner/` – planerarspecifik logik som delas mellan ordinarie och snabbare väg.
- `ui/` – appskal, loading-overlay och demo.
- `styles/` – gemensam styling och planerardesign.
- `pages/` – ägarskap per sida. Sidunik logik ska flyttas hit när den bryts ut ur appskalet.

## Regler

1. En funktion ska ha ett tydligt ägarområde. Ändra inte `app.js` för funktioner som hör hemma i en feature.
2. Ordinarie väg och Snabbare väg får dela rena hjälpfunktioner men ska inte skriva över varandras state.
3. Programdata och examenslogik ska hållas separerade från rendering/UI.
4. `bootstrap.js` är enda platsen som bestämmer laddningsordningen för frontendmodulerna.
5. Rotens äldre `v2-*`-filer är tillfälliga kompatibilitetskopior för befintliga tester. De ska inte vara runtime-källa och kan tas bort när testerna flyttats till `src/`.

## Sidägarskap

- `pages/home/` – startsida och demo-entry.
- `pages/studies/` – meritimportflöde.
- `pages/opportunities/` – examensmatchningar och vägar.
- `pages/planner/` – Planeraren, inklusive växlare mellan ordinarie/snabbare väg.
- `pages/programs/` – programsök.
- `pages/more/` – Mer-menyn.
- `pages/method/` – metod och datatransparens.
