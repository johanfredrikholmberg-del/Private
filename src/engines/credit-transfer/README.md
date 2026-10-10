# Preliminär tillgodoräkning

`engine.js` bedömer kursunderlag. `historical-evidence.js` lägger till verifierade historiska beslut som information, och `adapter.js` fördelar starka matchningar mot programkurser och fritt valbara block. `history.js` tillhandahåller beslutsunderlag. `src/core/match-consistency.js` summerar samma resultat för programkort och Planeraren.

Endast direkt matchade programkurser, `strong` (Starkt underlag) och `relevant` med minst ett verifierat historiskt bifall får preliminärt räknas av. Historiskt bifall visas separat och ändrar inte evidensklassningen i sig. `limited` visas som möjligt underlag utan avräkning. En tidigare merit får inte fördelas till flera obligatoriska kurser.

Bedömningen är vägledande. Lärosätet fattar beslut om tillgodoräknande.
