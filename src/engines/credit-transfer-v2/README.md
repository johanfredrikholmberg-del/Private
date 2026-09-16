# Credit Transfer V2

Isolerad StudieLots-motor för preliminär bedömning av möjliga tillgodoräknanden.

## Gräns mot äldre motor

Den här mappen får inte skriva över `StudieLotsV2.paths`, `StudieLotsV2.engine` eller äldre credit-transfer-moduler. Motorn exponeras endast som `window.StudieLotsEngines.creditTransferV2`.

Integration mot Ordinarie väg och Snabbare väg ska ske genom en separat adapter. Adaptern får läsa resultatet från denna motor men får inte ändra motorns regler eller äldre matchningsmotor.

## Regel

- `strong` / Starkt underlag: får preliminärt räknas av i StudieLots studieplan.
- `relevant` / Relevant underlag: visas som möjlighet men räknas inte av.
- `limited` / Begränsat underlag: räknas inte av.

StudieLots bedömning är vägledande. Lärosätet fattar alltid det slutliga beslutet om tillgodoräknande.

## Ändringar framåt

Ändringar av TG-bedömningen ska i första hand göras i denna mapp. Integrationskod ska hållas separat så att TG-motorn kan utvecklas eller bytas utan att påverka resten av StudieLots.