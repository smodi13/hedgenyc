# Three flagship business cases | Decision-grade analyst notes

Date: November 6, 2026. Independent, illustrative financial analysis. No actual company losses, hedges, risk preferences, Kalshi relationship, or willingness to participate are established.

## CASE 01 | Brooklyn Sail | Weather cancellations

**Evidence**: https://www.bksail.com/details publicly discusses when voyages cancel for bad weather, refund and rescheduling options. https://www.bksail.com/pricing lists private and group ticket prices. These are advertised service details, not income statements or demand elasticity estimates.

**Exposure mechanism**: Severe weather can cancel a prepaid voyage, requiring a refund or rescheduling, creating lost contribution margin, crew availability complications, scheduling friction, and potentially a lost customer. A cancellation is not the same as a full lost sale if the customer reschedules. A weather contract paying on measurable rainfall will frequently settle YES even when the vessel safely sails, and may settle NO when high wind makes sailing unsafe despite little rain.

**Illustrative underwriting inputs only**: One hypothetical $550 private charter, 40% assumed avoidable variable operating expense, 60% hypothetical lost contribution margin = $330 when an eligible charter is permanently lost. The 40% was NOT provided by the business. An illustrative market price of $0.43 YES per $1 notional, 250 contracts, a general 7% fee multiplier, and independent joint state probabilities are EXAMPLES for demonstrating calculation only, NOT current quotes or Kalshi implied probabilities.

**State grid**: Business cancellation / contract YES (12%); cancellation / contract NO (8%); no cancellation / YES (23%); no cancellation / NO (57%). These four probabilities are invented, sum to 100%, and deliberately demonstrate the impact of false positives and false negatives. Conditional probabilities were NOT estimated from historical business or weather data. Risk of model error is high.

**Matched-market discovery**: https://kalshi.com/markets/kxrainwknd/where-will-it-rain-this-weekend/kxrainwknd-26nov07 ; consider KXRAINWKND-26NOV07-NYC solely as a proxy test. Verify contract resolution, observation site and available executable offers through official API. The site must label this a dated discovery and not automatically assert it remains available.

**Disposition: NOT A READY-MADE HEDGE.** Hold customer pitch pending evidence that cancellation losses statistically co-move with the contract's exact settlement and that liquidity/pricing are adequate. Better potential market concept: forecasted **measurable extreme winds or safety warnings over a local period** with reproducible settlement, provided compliant and liquid enough to list.

**Owner discovery questions**: What specific wind/gust/precipitation conditions trigger cancellation? What share of canceled journeys reschedule? What is lost contribution margin versus lost gross bookings? How many exposed sailings in each month? Would avoiding a bad weekend loss matter more than monthly profit volatility? Who decides cancellations and how? Are any insurance/force majeure protections in place?

## CASE 02 | Xentra Transport | Fuel and contract pricing

**Evidence**: https://www.xentratransport.com/ describes service operations spanning sedans and larger transport vehicles, and publicly advertises no fuel surcharges. Its fleet, actual mix of gasoline versus diesel, gallons purchased, pass-through opportunities, and current operating margin are NOT verified.

**Exposure mechanism**: When an operator cannot promptly reprice deliveries, rising fuel costs may compress contribution margin on existing jobs. A national diesel-threshold event might pay if its specified AAA national price passes a threshold. Actual local purchasing prices, gasoline/diesel mix, weekly timing, and gallons are different risk variables.

**Illustrative underwriting inputs only**: 1,200 gallons purchased in one month and a local $0.40/gallon pump increase = $480 incremental cash cost, assuming zero offsetting customer pass-through. Both gallons and shock are entirely hypothetical. DO NOT display them as actual Xentra consumption. The minimum objective is a financial-risk conversation, not a presumption that any listed contract covers the shock.

**Matched-market discovery**: https://kalshi.com/markets/kxdieselw/diesel-prices-this-week/kxdieselw-26nov09, a November 9 dated **national price threshold** market. Check exact reference series and rules. EIA regional diesel prices at https://www.eia.gov/petroleum/gasdiesel/ are useful context only; the Kalshi contract's AAA-defined series must not be mistaken for EIA weekly regional figures. A WTI crude oil contract https://kalshi.com/markets/kxwti/wti-oil-on-day/kxwti-26nov0914 is even further removed from actual pump expenses.

**Disposition: QUALIFY FIRST.** No transaction recommended until the operator confirms diesel fleet gallons, exposure tenor, hedging budget, ability to price fuel pass-through, and precise correlation of proposed settlement index with underlying business cost.

**Owner discovery questions**: Monthly or weekly diesel gallons by vehicle? Petrol gallons? Current fuel expense share of direct costs? Spot vs fixed-price contracts and renewal cycle? Fuel card or price contracts already in use? What magnitude of margin shock is material? Could a fuel surcharge be introduced instead of buying a financial hedge?

## CASE 03 | Arborpolitan | Storm work has two signs

**Evidence**: https://arborpolitan.com/ and https://arborpolitan.com/tree-care describe tree care and storm-related response, with trucks and service operations. We do NOT know the seasonality or profitability of each job type.

**Exposure mechanism**: A severe storm can postpone planned tree maintenance or require extra safety/insurance costs, but may increase demand for post-storm emergency removal or remediation. These are **offsetting revenue channels**. A model showing only lost scheduled maintenance would be economically incomplete.

**Illustrative underwriting inputs only**: Scheduled planned-care contribution margin lost = $1,000 in a storm; emergency storm-work margin earned = $1,400, producing net +$400 on an illustrative storm. Both amounts are made-up analyst scenarios. A second sensitivity with only $500 emergency margin yields net -$500. These contrasts show why same-day weather may create **long** financial exposure to storms, not just downside.

**Matched-market discovery**: The project does not identify an eligible, suitably matched contract that definitively fits Arborpolitan's net cash flow. Broad rainfall contracts are insufficient, and a gusts/storm-warning contract remains only a research concept. Do not manufacture a trade recommendation.

**Disposition: NO HEDGE RECOMMENDATION.** First interview owner, segment storm-related income and costs, distinguish severe versus routine weather, and quantify contribution margin by job type. If emergency work reliably rises in storms, hedging against storms may be counterproductive.

**Owner discovery questions**: How do scheduled work cancellations compare with emergency work revenues? Timing of emergency payables/receivables? Which storm triggers generate profit versus cost? Impact of storm warning lead time? How often do capacity constraints prevent monetizing spike demand? Are there pre-paid crew overtime or insurer reimbursement issues?

## Negative-control pair | Foods of NY Tours and Like A Local Tours

https://www.foodsofny.com/faq/ and https://likealocaltours.com/faq: both explain that their tours generally proceed in ordinary rain, with cancellations mainly for exceptional conditions. This is primary-source evidence AGAINST a naive strategy of marketing any-rain NYC contracts to all outdoor tour operators. Site should show a redacted/non-sensational 'Do not pitch' outcome where appropriate.

## General fee mechanics for model

The July 7 2026 Kalshi fee PDF at https://kalshi.com/docs/kalshi-fee-schedule.pdf describes the **general** taker-fee formula for a $1 contract: `round up to nearest cent of (0.07 * N * price * (1-price))`; possible contract/category/fee exceptions and actual pricing/rounding at fills may apply. Cash at risk includes purchase premium plus fee. If YES wins, settlement receipt = N. If it loses, receipt = 0. Other charges and bid-ask or partial fills not modeled. Never present these illustrations as executable trades.
