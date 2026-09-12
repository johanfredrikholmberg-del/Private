# Pages

Varje huvudsida i StudieLots har en egen mapp och registrerar sin markup via `pages/registry.js`.

Sidunik rendering, events och state ska successivt flyttas från `ui/app.js` till rätt sidmapp. Delad affärslogik hör inte hemma här utan i `core/` eller `features/`.
