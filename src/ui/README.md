# UI

`ui/` innehåller gemensamt appskal och UI-beteenden som används av flera sidor.

Sidunik rendering ska ligga under `pages/`. Affärslogik ska ligga under `core/` eller `features/`. Målet är att `ui/app.js` successivt blir ett tunt lager för navigation, globalt state och koordinering.
