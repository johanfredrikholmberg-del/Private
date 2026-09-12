# Core

`core/` innehåller domänlogik som ska kunna användas oberoende av en viss sida: examensmotor, examensregler och matchningskonsistens.

Core ska inte rendera HTML eller styra navigation. UI- och sidkod får anropa core, inte tvärtom.
