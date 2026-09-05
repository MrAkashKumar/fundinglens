# Verification — 5 September 2026

Passed:

- 10 Node tests on the supplied data: liquidity partition totals, overlap mapping, redemption distinction, mandate arithmetic, spending disagreement, template provenance, missing/conflicting data, duplicate handling, unknown liquidity, output validation, and review invalidation.
- TypeScript `tsc --noEmit`.
- Application lint (excluding untouched starter UI and hooks).
- Vinext production build, including server and browser bundles.
- Running HTTP checks: all three reviews return 200; all three drafting requests return explicitly labelled `template_fallback / api_not_configured`; invalid client returns 404; invalid comparison date returns 400; stale source hash returns 409; initial page renders successfully.
- Browser WebMCP registration: expected tool name, schema, and annotations. Calling `open_funding_review` with CL-0003 returned the matching client and visibly changed the review.

Limits:

- Live OpenAI generation was not exercised because no replacement secret was configured. Paid model availability, provider failures and timeouts were not tested against a live provider.
- UI review-state rules are unit-tested; exhaustive browser interaction, responsive, keyboard and accessibility tests have not been completed.
- Starter-wide lint has existing findings in untouched generated UI components and the mobile hook. `lint:all` preserves visibility of those findings.
- Build warns about a browser chunk over 500 kB and imperfect Vinext route classification. Build still succeeds. Lazy-loading the chart would be a later performance improvement.
- Installation reported 11 dependency audit findings (1 low, 2 moderate, 8 high). No forced dependency upgrades were applied; assess supported starter updates before deployment.
- Local storage is editable and the RM identity is a demo label. Review history is not a production audit trail.
- No public deployment, live customer records, message sending, trade execution, or measured outcome claims.

## Communication extension

Added two tests (12 total) covering evidence references and client isolation across all communication tasks, plus follow-up prerequisites, immutable recorded message snapshots, and review invalidation after editing. The new `/api/ai-status` endpoint returns only `configured` and `verified`; local verification returned both false. Communication drafts remain usable without a key. No live OpenAI call or external message was made. Browser interaction QA was not requested for this extension.

## Fast-intake extension

15 tests pass, including exact-excerpt enforcement, unknown/duplicate-field rejection, sparse-note handling, unchanged source facts and credential-pattern detection. Application lint, TypeScript and production build pass. The review-batch endpoint isolates per-client failures. PDF output uses the browser print dialog; full browser interaction, pagination and printed layout QA were not requested and have not been completed.

## Portfolio desk extension

20 tests pass. New checks cover all 20 clients / 24 portfolios and current holding coverage, the known 71.46% equity exception, custody exclusion, fail-closed incomplete data, injectable rule strategies, client-alert wording and evidence-version invalidation. Application lint, TypeScript and production build pass. Full browser interactions and responsive visual QA were not requested for this extension.

## Visual overview extension

22 tests pass, including chart reconciliation, suppression of incomplete charts, restricted-access totals and non-additive capital-call planning. TypeScript, application lint and production build pass. Responsive layouts and text equivalents for chart values are implemented; interactive browser and visual QA were not requested and were not run.

## Partial-sale planner

26 tests pass. Added checks cover minimum-sale cents arithmetic, equal funding across minimum/fewest variants, sale bounds, percentage caps, infeasible goals, zero-sale external-cash cases, restricted/collateral/out-of-scope exclusions and post-sale portfolio denominators with custody exclusion. TypeScript, application lint and production build pass. Browser chart interactions, clipboard actions and responsive visual QA have not been run. Minimum results are conditional estimates under the documented assumptions.

## Intelligence update

Added tests for annual compounding, end-year contributions, total-loss paths, goal gaps, invalid rates/horizons, scoped portfolio ownership, unknown/duplicate AI citations, invented numerical AI assertions, and communication wording. All 30 tests pass; typecheck and application lint pass. Production compilation is checked before publication. No browser interaction or screenshot QA was requested or performed.

Portfolio simulator: 32 tests pass, including cents-budget conservation, matched increases/reductions, identical zero-shock values, a concentrated negative-shock example, invalid budgets/classes/shocks, incomplete-source blocking, and custody exemption. Application lint and typecheck pass. No browser interaction QA performed.

World events update: 35 tests pass, including holding-to-portfolio reconciliation, ordered scenario outcomes, zero and total-loss shocks, incomplete data, missing/duplicate/unordered shock rows, and AI reference/numerical-output validation. Typecheck and application lint pass. Production build precedes publication; browser interaction QA was not requested.
