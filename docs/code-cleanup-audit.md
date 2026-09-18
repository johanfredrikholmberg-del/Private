# StudieLots v2 – kodstädning och beroendekontroll

Status: första kartläggning, **ingen modul är ännu bevisat oanvänd**. Arbeta enbart på `studielots-v2`; radera inte historiska importdata eller universitetsspecifika källor på antaganden.

## Aktiv laddningskedja

`src/bootstrap.js` laddar i ordning: pages → app-context → core → merit-import → degree-rules → programs → credit-transfer → fast-route → page-controllers → app-runtime → post-processing. Filer i denna lista får inte tas bort enbart för att de ser äldre ut.

## Verifierade överlappningar och risker

- `src/core/match-consistency.js`: `ledger()` räknar av hp och `fixPlanner()` skriver sedan om både `plannerData.rows`, progress och kursstatus i DOM. `MutationObserver` anropar `apply()` vid DOM-ändringar, som i sin tur kan beräkna ledger på nytt. Flytta på sikt beräkningen till en enda datakälla före rendering; ta inte bort modulen innan både programkort och planerare använder den ersättningen.
- `src/features/planner/planner-summary.js`: ytterligare en `MutationObserver` och en separat DOM-genererad översikt som läser `creditLedger`. Den är aktiv och får inte tas bort utan att översikten flyttas till ordinarie rendering.
- `src/features/planner/route-clarity.js`: en tredje observer som ändrar visning av Ordinarie/Snabbare väg. Den innehåller även CSS-regler som döljer äldre CTA-element. Kontrollera först att ersättningsknapparna fungerar innan de gamla elementen och reglerna rensas.
- `api/program-index.js`: HT26-program utan komplett terminsstruktur måste fortfarande kunna visas i sökningen; `metadata-only` får inte tyst filtreras bort. Separera synlighet i katalogen från möjligheten att räkna program-hp.

## Säker ordning för faktisk borttagning

1. Inventera referenser till varje kandidat i bootstrap, HTML, API, tester, GitHub Actions och importskript. Kontrollera även dynamiska sökvägar och Vercel-rutter.
2. Skriv regressionstest för samma program och meriter genom Möjligheter → programkort → Planeraren → Ordinarie/Snabbare väg. Kräv samma avräknade hp och kvarvarande hp; generell examensmatchning ska redovisas separat.
3. Testa både demo och importerade Ladok-meriter; kontrollera GU och Karlstad i lärosäteslistan samt metadata-only-program.
4. Flytta funktionalitet, ta bort **en** verifierat överflödig modul i taget och uppdatera bootstrap/importreferenser i samma ändring. Kör tester och verifiera preview innan nästa borttagning.
5. Radera aldrig `data/HT26`, `data/kau` eller äldre datakällor innan datamigrering och samtliga konsumenter är verifierade.

## Avgränsning

Denna kartläggning är inte ett godkänt funktionstest och innebär inte att några gamla filer har raderats. Nästa kodändring bör prioritera en gemensam, testbar hp-ledger och avveckla DOM-efterhandskorrigeringarna stegvis.