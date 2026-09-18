# Låst studieplan – fastställt upplägg för kursunderlag

Beslutat i dialog 2026-09-18. Denna specifikation är referens vid utveckling av matchningsmotorn, låst studieplan och Snabbare väg. Dokumentation är inte samma sak som implementerad funktion.

## Visning för en kurs med starkt underlag

Visa en grön bock och etiketten **Starkt underlag**. När användaren öppnar kursen visas rubriken **Varför starkt underlag?** och en kort punktlista:

- **Matchande kursinnehåll:** ange exakt vilka dokumenterade kursmoment/lärandemål som överlappar mellan användarens tidigare kurs och målkursen. Använd inte den generiska formuleringen ”jämförbart innehåll” utan konkretisering. Hitta aldrig på kursmoment; om detaljer saknas, säg att de inte kan fastställas och visa inte påhittade exempel som fakta.
- **Omfattning:** ange tidigare kurs hp, målkurs hp och hur många hp som faktiskt matchas; skriv att båda är 7,5 hp endast om det stämmer.
- **Historiska bifall:** ange antalet **unika, relevanta och belagda bifallsbeslut** för just den aktuella kursmatchningen, t.ex. ”Historiska bifall: 3 st”. Visa inte ett exempelantal som verklig data. Om antalet inte kan beläggas ska inget antal hittas på; använd ”Inga verifierade historiska bifall i underlaget” om noll är säkerställt eller ”Uppgift saknas” om täckningen är okänd.

**Ingen fjärde punkt** om att besluten gäller jämförbara kurser vid aktuellt lärosäte. Underliggande beslutsuppgifter/källor får finnas i en separat detaljvy när de är tillgängliga, men inte som ytterligare standardpunkt i motiveringen.

## Bedömnings- och beräkningsregler

- En direkt, välunderbyggd kursmatchning kan ge **Starkt underlag**. Ett historiskt bifall kan höja **Relevant underlag** till **Starkt underlag** om beslutet avser en tillräckligt jämförbar kurs, relevant omfattning och belagda uppgifter. Ett godtyckligt bifall eller oklart hp räcker inte.
- **Starkt underlag** får preliminärt räknas av med högst faktiskt matchade hp i både låst studieplan och Snabbare väg. **Relevant underlag** utan tillräckligt stöd visas som möjlighet men räknas inte av. Kvarstående hp måste vara konsistenta mellan vyerna. Samma tidigare kurs/hp får inte användas dubbelt; begränsa till tillgängliga käll-hp, mål-hp och programmets hp.
- Kalla inte en preliminär kursmatchning **tillgodoräknad** eller ett historiskt bifall ett beslut för den aktuella användaren. Diskret förtydligande: ”Starkt underlag är StudieLots preliminära bedömning. Lärosätet beslutar om tillgodoräknande.”
- Historiska bifall ska vara spårbara till faktiska beslut. Räkna varje unikt beslut högst en gång per relevant matchning; filtrera bort avslag, dubbletter, valbara/ospecificerade fall och poster där berörda kurser eller hp inte kan utläsas tillförlitligt.
- Motiveringen ska genereras från samma evidens och hp-beräkning som den gröna bocken, inte från fristående exempeltexter. Saknas belägg för ett påstående ska det inte visas som ett konstaterande.

## Status

Detta dokument låser det överenskomna **produktupplägget**, inte koden eller en publicerad funktion. Implementering och verifiering återstår tills de uttryckligen har genomförts och testats.
