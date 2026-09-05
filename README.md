# FundingLens — Client Funding Review

A local RM workspace built from the Julius Baer SingHacks challenge data. It helps an RM identify the exact funding question, inspect evidence, prepare a client update, and review its wording before previewing it.

## Run

Requires Node 22.13+.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5187
```

Open http://localhost:5187. Synthetic data is bundled; no database or paid API is required for the demo.

## Enable OpenAI drafting

An ignored `.env.local` file exists with an empty key. Revoke the key shared in conversation and enter its replacement directly into that local file. Never paste keys into chat, source files, or browser code.

```dotenv
OPENAI_API_KEY=your-replacement-key
OPENAI_MODEL=gpt-5.4-mini
```

Restart the dev server. The server uses the OpenAI Responses API with structured outputs. An optional `OPENAI_BASE_URL` supports an HTTPS Responses-compatible gateway; compatibility and model access must be verified with that provider. No Gemini API is used. API model access is separate from a Codex subscription. `.env.example` contains placeholders only. The local Cloudflare runtime loads `.env.local`; build output may contain development environment files, so never distribute `dist`, `.wrangler`, or `.env*` with secrets.

Without a key, on provider failure, or on invalid output, the app clearly labels an evidence-based template. The supplied exposed key was not stored or used; live paid generation has not been tested.

## Specific cases

| Case                          | User pain                                                                                       | What the app does                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Tran, CL-0006 / PF-0008       | USD obligations coexist with deposit restrictions and gated holdings                            | Separates liquidity tiers, links overlapping capital-call records, and keeps redemption requests distinct from proceeds |
| Margarethe, CL-0003 / PF-0005 | Inherited equity allocation conflicts with conservative limits alongside a recorded EUR payment | Calculates portfolio-level equity weight against the supplied mandate and shows the payment record                      |
| Cheung, CL-0012 / PF-0014     | Retirement spending differs between the objective and planned-needs record                      | Shows both amounts and their USD 180,000 difference, then asks which is current                                         |

This reduces record switching and arithmetic during meeting preparation. Time savings and outcomes have not been measured. It is a three-case prototype, not a claim of serving millions.

## Interface

1. **Client selector:** three named cases with a specific issue. On narrow screens use Toggle Sidebar.
2. **Check facts:** the client's objective, relevant obligations, restrictions or discrepancies, and unresolved questions.
3. **Source buttons:** open exact dataset records with IDs, fields, and calculation inputs.
4. **Portfolio context:** five dated snapshots, selectable comparison start, and relevant event context. Value changes are not investment returns.
5. **Review draft:** edit the message, inspect evidence, reject it, or attest to checking this revision.
6. **Client preview:** available only for a reviewed revision matching the current client and source selection. Editing invalidates approval. It does not send anything.
7. **Review history:** browser-local actions and revisions. This is not an authenticated or tamper-proof bank audit log; Priscilla Ong is the demo RM identity.

## Architecture

```text
Synthetic CSV + RM notes
        ↓
Server CSV parser → deterministic review/calculation layer
        ↓                          ↓
GET /api/reviews/:clientId    source version hash
        ↓                          ↓
React review desk → POST /api/briefing → OpenAI Responses API
        ↑                                  ↓
Validated qualitative draft ← schema + source-ID + quantity checks
        ↓
RM editing → revision review gate → client preview
        ↓
Browser-local history
```

- React 19 + TypeScript; Vinext Next-compatible app routing on Vite/Cloudflare Workers.
- Tailwind, shadcn/Base UI controls, Lucide icons, Recharts.
- CSV parsing and financial calculations run server-side. LLM does not calculate portfolio values.
- OpenAI JS SDK, Zod structured output, one request with a timeout and labelled fallback.
- No vector database, generic chatbot, live-market feed, brokerage API, CRM integration, automated trades, or email delivery.
- `lib/reviews.ts`: evidence joins, calculations, case mappings and source versions.
- `lib/llm.ts`: bounded drafting and sanitized failures.
- `lib/briefing.ts`: schema and review-state rules.
- `components/FundingDesk.tsx`: application workflow.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

The lint command covers application code. `npm run lint:all` additionally checks untouched starter components, which currently report upstream lint errors. See VERIFICATION.md for exact checks and limitations.

## Data provenance and limits

Source: https://github.com/Singhacks-2026/juliusbaer. The supplied synthetic snapshot date is 26 August 2026. See `data/DATA_DICTIONARY.md`. No live bank connection or real customer data is used. Essential missing/conflicting records block a review; identical duplicates are removed with a warning. Unclassified liquidity stays Unknown. Explicit curated overlap mapping is used for CN-008 and COM-003; this is not a general entity-resolution system.

The public demonstration uses synthetic source data; each visitor’s communication drafts remain in their own browser. Real bank use would require identity and entitlements, secure persistence, data-governance review, provider arrangements, stronger semantic evaluations, operational monitoring, and validated RM outcomes. Numeric/citation checks do not prove semantic correctness; every message requires human review.

## Case-specific communication workspace

Each review now includes **Resolve the missing information**. Tran has payment-schedule and investment-access requests; Margarethe has payment-arrangement and portfolio-priority requests; Cheung has a spending-confirmation request. Every topic links to the supporting source records.

Prepare or edit a request, attest to checking the recipient and facts, mark the revision reviewed, then preview or copy it. After using your approved external channel, explicitly record the communication as sent externally. Set an RM follow-up date and prepare a related follow-up. Capture reply notes and their source location, then close or reopen the request. Message snapshots, reply summaries and follow-up dates are preserved at recorded actions in this browser. Editing subject or body invalidates review. Source-version changes also invalidate review.

Requests and follow-ups are deterministic case-specific templates, independent of the optional OpenAI client-update drafting. The AI status indicator checks access to the configured OpenAI model without generating text. Successful checks are reused for five minutes within a worker; failures for thirty seconds. It never exposes secrets, and connection availability does not guarantee generation success. No email delivery, automatic reminder, inbox sync or background scheduling is implemented. Reply notes never automatically change portfolio facts. Browser-local history is not a production audit trail.

## Public demo configuration

The OpenAI key is configured as a Sites runtime secret, not included in source or build artifacts. Paid drafting uses fixed synthetic case inputs only. Completed drafts are reused for up to 24 hours within a running worker isolate, with concurrent request deduplication; failures are reused for one minute. This reduces duplicate calls but is not a global quota or billing cap. Review usage in the OpenAI project. No real customer information should be entered in this public demo.

## Fast intake and batch preparation

1. Select a client, or use **Prepare all 3 reviews** to calculate the supported cases together.
2. The client profile, obligations, restrictions and relevant figures are filled from existing data. The RM does not re-enter holdings.
3. Enter one short synthetic meeting note and choose **Extract details with AI**. This explicitly sends the note to OpenAI. At most four case-specific fields are returned as exact excerpts; unsupported or missing information is not invented. Manual entry is always available.
4. Review and correct the extracted details, then prepare a client draft. It combines the existing record context, RM-checked conversation details and unanswered questions. The note does not overwrite original records or automatically resolve contradictions.
5. Review the full message using the existing approval gate. Copy the reviewed message or use Print / save as PDF from the client preview. No automatic delivery occurs.

Intake drafts are stored in this browser per client. Source-selection changes invalidate extracted fields; editing a note clears its previous extraction. Note requests and outputs are not cached across visitors. The intake API has a 6,000-character note limit, 19-second provider timeout, schema validation, literal-excerpt validation, credential detection and per-worker concurrency backpressure. These are not a global billing quota. Use synthetic notes only in this public demonstration.

### Extension points

| Layer | Current implementation | Extension path |
|---|---|---|
| Source adapter | CSV/JSON parsed into `DataSet` in `lib/data.ts` | Add an authenticated CRM or document adapter that produces the same normalised records, preserving source IDs and timestamps |
| Deterministic review | `buildReview` creates the `Review` contract | Add case mappings and domain-specific calculations with evidence-based tests |
| Intake fields | `intakeFields` registry in `lib/intake.ts` | Add explicit fields and questions for each new case type, keeping exact-excerpt validation |
| Batch orchestration | Three supported cases, per-case error isolation | Add server-side pagination, queues and durable job state for larger datasets |
| Client output | Deterministic composition plus the existing RM review gate | Add approved language templates or export adapters; preserve review invalidation |

The supplied dataset contains 1,015 holding rows. The batch demo processes three supported cases; arbitrary-client imports, asynchronous ingestion, large-scale throughput, live CRM integration and production multi-user isolation are not implemented or claimed.

## Private-wealth portfolio review desk

The home page now reviews every client and portfolio in the supplied book (20 clients, 24 portfolios). Select a client, filter a portfolio, inspect current holdings, and open an individual finding to see its evidence and next step. The earlier focused payment, intake and communication workflow remains at `/funding-review`.

Rules include portfolio-level asset allocation against supplied mandate bands, applicable single-position concentration limits, restricted holdings alongside a payment window within 90 days, and valuations more than 30 days older than the source snapshot. These are transparent review candidates; the time windows are explicit demo rules, not regulatory thresholds. Custody portfolios are not assessed against mandate limits. Funding records are not added together or interpreted as a deficit.

Missing/conflicting holdings, ownership mismatches and missing/inconsistent asset classifications block weights and portfolio totals. Unknown liquidity remains unknown. Source-quality findings require internal reconciliation before the UI permits a client alert for that portfolio. An older private-asset valuation is an internal review prompt, not an investment loss.

Client alerts use deterministic issue-specific wording. The RM edits and reviews the message before copying it into an approved external channel. No alert is automatically sent. The recipient, reporting language and source date are visible. Edits invalidate review; saved drafts are isolated by client and a hash of the finding/evidence. Review approval is intentionally not restored after a reload.

### Reusable structure and design decisions

- `lib/portfolio/contracts.ts`: narrow repository, rule and view-model contracts.
- `lib/portfolio/repository.ts`: dataset adapter; storage details stay outside analysis. A future integration can hydrate the same contracts from approved records.
- `lib/portfolio/rules.ts`: independent rule strategies. Add a `ReviewRule` implementation to extend analysis without changing the UI.
- `lib/portfolio/service.ts`: dependency-injected repository and rule collection; validates records and orchestrates results.
- `lib/portfolio/alerts.ts`: client-message composition, independent of UI controls.
- `components/portfolio/PortfolioDesk.tsx`: client selection, findings and holdings presentation.
- `components/portfolio/AlertComposer.tsx`: editable draft and review gate.

This applies single responsibility, dependency inversion and extension through small interfaces. It does not claim production-scale throughput, live monitoring, complete investment-risk detection, real customer identity/permissions or automatic delivery. Coverage is limited to supplied records; external assets and later transactions are not visible. Absence of a finding is not assurance of suitability or safety.

## Visual wealth overview

The default client view now shows selected portfolio value, investment count and restricted-access value, an investment-mix donut with a numerical legend, and liquidity-tier bars. Totals and segments come from a reusable summary function; incomplete portfolios suppress aggregated charts. Combined allocation is descriptive only; mandate rules still run per portfolio. Rounded visual numbers have exact values available in the holdings table or tooltips.

The overview shows the first three findings, with all findings and holdings on separate tabs. A client-wide timeline surfaces supplied current/future education, retirement, property, tax and other planned needs. Private-market uncalled commitments appear separately and create portfolio-specific planning findings; they are not automatically due today and are never added to overlapping cash-needs records. No speculative pain point, investment loss, FX hedge exposure or liquidity deficit is inferred from these panels.

## Cash-goal and partial-sale scenario planner

Open **Goal & sale scenarios** on a client. Enter a USD cash objective, deadline, separately confirmed external cash and a uniform sale-cost allowance. Explicitly select eligible holdings and confirm the assumptions. Compare minimum proportional sales, the same modeled funding from the fewest positions, and gross sales of 10%, 20% or 50% of selected portfolio value. Caps are rounded down to cents and cannot exceed eligible holdings. Infeasible goals retain a visible funding gap; sufficient external cash produces a zero-sale minimum.

Only daily-dealing, non-cash holdings valued at the snapshot are candidates. Credit-linked collateral portfolios, unresolved data-quality issues and restricted holdings are excluded. This is conservative record-based screening, not verified sale eligibility. The deadline is recorded but settlement and FX timing are not modeled. Costs default to an illustrative 1%; actual tax, fee, slippage and trade-lot data are not available. The minimum assumes divisible positions and equal proportional costs; it is not a tax-optimal or suitability-constrained trading recommendation. The fewest-position strategy uses largest eligible positions first and may materially change concentration.

Outputs include proceeds versus goal, remaining asset values, per-holding sale amounts and percentages, and post-sale asset allocation against each non-custody portfolio's supplied bands. Sale proceeds are assumed removed from the portfolio. Full suitability, single-position concentrations and execution timing require additional review. The client summary must be checked before copying and does not send a message or trade.

`lib/scenarios/model.ts` is a pure calculation module using cents for allocation; `allocation.ts` performs separate post-sale asset-class checks. The server recomputes scenarios from the supplied dataset before requesting an OpenAI explanation. AI provides qualitative trade-offs and checks, not the financial calculations or a trade selection. User scenarios and explanations are not cached across visitors.

References for the modeled limitations: [Investor.gov on transaction costs and tax when rebalancing](https://www.investor.gov/additional-resources/general-resources/publications-research/info-sheets/beginners-guide-asset) and [FINRA on securities-backed credit and collateral](https://www.finra.org/investors/insights/securities-backed-lines-credit).

## Portfolio intelligence and wealth projections

The home view now opens on Intelligence: a source-linked lead finding, supporting checks, and on-demand OpenAI explanations/questions. `/api/portfolio-intelligence` re-reads the selected client portfolios on the server, rejects unknown or repeated portfolio IDs, and validates each AI finding reference against the computed findings. AI prose cannot introduce digits or currency amounts; it remains reviewable interpretation, not an independently verified fact or trade recommendation. The existing configured server secret is reused. No new data provider or market feed is implied.

Scenario explorer retains the cash-goal sale planner and adds a separate Wealth projections view. This is a pure constant-rate calculator: `next = previous * (1 + rate / 100) + annual contribution`. Three editable ordered rates, a whole-year horizon and a custom wealth goal generate a chart, exact annual table and end-goal gaps. Example −5/0/+5 rates are arbitrary, not a forecast, probability range or confidence interval. Fees, tax, inflation, withdrawals, FX and asset correlations are excluded; cash-goal sales and planned spending are not automatically deducted. Incomplete/source-blocked portfolios cannot be projected. Source snapshot timing is visible.

Conversation brief offers review, information-request and check-in drafts grounded in a selected eligible finding. Each purpose has a separate local draft; edits invalidate review. Check-ins never assert that a prior message or meeting happened. Internal/source-blocked findings cannot become client drafts. Nothing sends automatically.

Reference: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) for response validation; [Investor.gov asset allocation](https://www.investor.gov/introduction-investing/getting-started/asset-allocation) for the role of goals, horizon and risk tolerance. No recommended return assumption is drawn from either source.

## Portfolio simulator

Scenario explorer → Portfolio simulator compares current and RM-entered asset-class weights for one selected portfolio. Target weights use up to two decimal places and must total 100%. A largest-remainder cents allocation preserves the current USD budget. The result shows hypothetical increases/reductions, supplied mandate-band checks (not applied to custody), and current/proposed values under identical user-entered one-time asset-class shocks. Zero shock is the default; no forecast probabilities or recommended weights are supplied. These are allocation illustrations, not executable trades: liquidity, collateral, lots, tax, fees, security selection and FX require separate review. Source-blocked portfolios cannot be simulated.

## World events & impact

Scenario explorer now defaults to World events & impact. Hypothetical Fed rate increases, US tariff announcements, conflict escalation and custom events load editable downside/middle/upside asset-class price-shock assumptions. Every preset is explicitly arbitrary, uncalibrated and unassigned a probability. They are not upcoming news, expected returns, or bounds on possible outcomes. Sources linked in the UI explain broad mechanisms only, never the numeric presets.

The deterministic event model applies each entered class shock to every holding in that class, rounds individual changes to cents, and aggregates separately per portfolio. It shows percentage changes, USD differences, resulting values and a holding-level contribution table. Source-blocked portfolios stay visibly unassessed. Alternatives and structured-product proxies are expressly limited; duration, sectors, currency, nonlinear payoffs, income and liquidity are not modeled.

`/api/event-intelligence` validates scope and inputs, rebuilds portfolio results from the server snapshot, then asks OpenAI for qualitative interpretation. The response must cite unique assessed portfolio IDs and cannot introduce numerical claims. Input edits/client changes invalidate results and cancel pending AI requests. No live news provider, market prediction or trade execution is implied.
