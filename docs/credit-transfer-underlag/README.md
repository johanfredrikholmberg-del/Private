# Underlag för tillgodoräknande — parkerat koncept

**Status:** Designförslag godkänt som utgångspunkt, vidare arbete pausat. **Ingen implementering eller integration av denna mapp i appen.** Ändra inte Snabbare väg, matchningsmotor, bootstrap eller andra aktiva moduler som del av detta dokument.

## Syfte och placering

Underlag för tillgodoräknande är en **separat vy som öppnas från Snabbare väg**, inte en lång motivering i samma vy. Snabbare väg visar en komprimerad studieplan med återstående kurser, hp och verifierbara studietillfällen. Underlaget ska senare hjälpa studenten att förbereda en ansökan till lärosätet. Lärosätet beslutar om tillgodoräknande; StudieLots bedömning är preliminär.

## Sparad skiss för senare utveckling

- Sidhuvud: «Underlag för tillgodoräknande» och länk tillbaka till Snabbare väg.
- Sammanfattning: preliminärt antal hp och antal kursmatchningar som studenten valt att ta med. Inga exempelvärden får presenteras som verkliga data.
- Separata, expanderbara kort per matchning. Studenten kan markera vilka som ska ingå i ansökningsunderlaget.
- Matchningsstatus använder **Starkt underlag (grönt), Relevant underlag (gult), Begränsat underlag (rött)**. Endast starkt underlag får räknas av preliminärt enligt den gemensamma matchnings- och hp-logiken; relevant och begränsat är information och kräver vidare bedömning. Enbart lärosätet kan besluta att en kurs är tillgodoräknad.
- Ett expanderat kort ska visa tidigare kurs, föreslaget examenskrav eller programkurs, **exakt styrkta överlappande kursmoment**, jämförd omfattning i hp och antal **unika verifierade historiska bifall som är relevanta för just matchningen**. Saknas tillförlitliga uppgifter ska det uttryckligen framgå; hitta inte på kursmoment, beslut eller antal.
- Valbart utrymme: visa vilket faktiskt examenskrav som föreslås täckas och belägg för ämne, nivå och hp. Valbara kurser får inte antas tillgodoräknade enbart för att ämnesnamnet liknar huvudområdet; kontrollera programmets och examens krav. Samma merit får inte användas två gånger.
- Avsnitt «Inför ansökan»: checklista för kursplan, Ladok-resultatintyg och eventuell litteraturlista/annat som lärosätet begär.
- Framtida funktion: förhandsgranska och exportera ett dokument/PDF med kursuppgifter, jämförelser och källhänvisningar. **Ingen automatisk inskickning till universitetet.**

## Avgränsning

Den tidigare interaktiva skissen använde **påhittade exempel** (bland annat Statistik, 8 hp, tre bifall och valbart utrymme). Dessa är enbart illustrationer och ska inte importeras som fakta eller testförväntningar. Ingen separat beräkningsmotor får skapas här; underlagsvyn ska i framtiden konsumera samma matchningsresultat och hp-ledger som Snabbare väg. Återuppta denna mapp först när arbetet med Snabbare väg prioriterar ansökningsunderlaget.
