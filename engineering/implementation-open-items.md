# Implementation open items (for the analyst, not invented by engineering)

1. `KXWTI-26NOV0914` is an event identifier, not a single strike; the site shows the event's market count/status only. Analyst to name a strike if wanted.
2. UNRESOLVED: which diesel strike, if any, suits Xentra. The site does not select one; the opt-in observed-ask display for `KXDIESELW-26NOV09-T6.18` (the ticker in markets.json) is labelled UNVERIFIED CONTRACT SELECTION.
3. Only the general taker fee formula is modelled; category/order-type exceptions are flagged, not modelled.
4. Pipeline "Exposure hypothesis" count (47) = records with a written hypothesis, not confirmed exposure.
5. Triage factors (0-5) come from the workbook's Business Screen sheet (`src/data/score-factors.json`); tests confirm they reproduce every `analyst_screen_score`.
6. No owner interviews, outreach, pilots or trading exist; none are displayed.
