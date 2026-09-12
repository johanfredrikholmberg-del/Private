# Features

Featuremappar äger sammanhängande användarfunktioner och får inte bero på sidornas HTML mer än genom tydliga publika gränssnitt.

- `merit-import/` – meritimport.
- `programs/` – programsök och programvägar.
- `credit-transfer/` – tillgodoräknande och historik.
- `fast-route/` – Snabbare väg.
- `planner/` – gemensam planerarlagik.

När en funktion växer ska nya filer skapas i dess egen featuremapp i stället för att lägga mer kod i `ui/app.js`.
