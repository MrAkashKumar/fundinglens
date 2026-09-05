# FundingLens

**A private-wealth portfolio review and scenario workspace for relationship managers (RMs).**

FundingLens brings the client’s supplied investments, objectives, portfolio exceptions and communication drafts into one place. An RM can inspect the evidence, compare hypothetical scenarios and prepare a message for review before using an approved communication channel.

**Demo:** [Open FundingLens](https://fundinglens-rm-review.mrakashkum.chatgpt.site/)

**Data:** 20 synthetic clients, 24 portfolios; current snapshot **26 August 2026**.

**Status:** Functional demonstration. No live bank connection, automatic message delivery or trade execution.

## Contents

- [What you can do](#what-you-can-do)
- [Requirements](#requirements)
- [Run locally](#run-locally)
- [Configure OpenAI](#configure-openai)
- [How to use the app](#how-to-use-the-app)
- [Validate and preview the production build](#validate-and-preview-the-production-build)
- [Deploy to ChatGPT Sites](#deploy-to-chatgpt-sites)
- [Architecture and code structure](#architecture-and-code-structure)
- [Data, calculations and limitations](#data-calculations-and-limitations)
- [Troubleshooting](#troubleshooting)
- [Extending the project](#extending-the-project)

## What you can do

| Workspace | User problem | What FundingLens provides |
|---|---|---|
| Intelligence | The RM must connect portfolio numbers to a useful client conversation | Source-linked findings, next review steps and optional AI explanations |
| Overview and investments | Holdings and access restrictions are difficult to compare | Portfolio values, allocation and liquidity charts, holdings and source dates |
| World events & impact | The client asks how a rate increase, policy announcement or conflict could affect their investments | Editable downside/middle/upside shocks, separate portfolio outcomes, holding contributions and AI interpretation |
| Goal & sale scenarios | The client needs cash without selling the entire portfolio | Conditional minimum sale, fewest-position and 10% / 20% / 50% comparisons with gaps and remaining allocations |
| Portfolio simulator | The RM wants to compare a different asset mix | Budget-preserving allocation changes, mandate checks and identical market shocks applied to current/proposed portfolios |
| Wealth projections | The client wants to explore a future wealth objective | Three user-controlled annual return assumptions, contributions, charts and goal gaps |
| Conversation brief | The RM needs a specific, reviewable client message | Portfolio alerts, information requests and check-in drafts; review before copying |
| Focused funding desk | A particular cash need or discrepancy needs follow-up | Three detailed cases, note intake, batch preparation and browser-local communication tracking |

AI explains supplied evidence and scenarios. Financial calculations are performed in TypeScript, not by the language model. The app uses OpenAI, not Gemini.

## Requirements

| Requirement | Local use | Public deployment |
|---|---|---|
| Node.js | **22.13 or newer**, as declared in `package.json` | Needed to build locally |
| npm | Included with Node; use the committed `package-lock.json` | Needed for install/build |
| Project source | This complete `fundinglens` directory, including `data/` and `.openai/` | Same source plus Git |
| Browser | A modern browser | Same; HTTPS enables browser clipboard features |
| Network | Needed to install dependencies and call optional AI | Needed for source upload and deployment |
| OpenAI API credentials | Optional for calculations/templates; required for live AI | Set as a **server-side Sites runtime secret** |
| Sites access | Not required to browse the local app | Codex with Sites capabilities enabled and permission to edit/deploy the target Site |
| Database | Not required | No D1 or R2 binding is currently configured |

This is a **Vinext/Vite app with Cloudflare Worker API routes**, not a static-only website. Dependencies are already declared; do not run a new framework initializer over this checkout.

The [Julius Baer challenge repository](https://github.com/Singhacks-2026/juliusbaer) is the **data source**, not the FundingLens application repository. Obtain the complete application checkout or export from its owner. No separate market-data, brokerage, email, CRM or vector-database account is required for this demo.

## Run locally

Run commands from the directory containing this README and `package.json`. If you opened the parent `SingHacks` workspace, enter `fundinglens` first.

```sh
cd fundinglens
node --version
npm --version
npm ci
```

Skip `cd fundinglens` if you are already inside this directory.

For a first-time configuration, copy the example **only if `.env.local` does not already exist**:

```sh
cp -n .env.example .env.local
```

Leave the key empty to use deterministic calculations and templates. To enable AI, edit `.env.local` as described below.

```sh
npm run dev -- --host 127.0.0.1 --port 5187
```

Open [http://localhost:5187](http://localhost:5187). Follow the URL printed by the server if you choose another port. Stop the server with **Ctrl+C**.

The CSV/JSON demonstration data is bundled with the app. There is no database migration, seed command or external data import to run.

## Configure OpenAI

Edit the ignored `.env.local` file using a text editor. Do not place a real key in this README, Git, client components or a browser form.

```dotenv
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-5.4-mini
```

| Variable | Required? | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | For live AI only | API credential with access to the configured model; usage is billed to its API project |
| `OPENAI_MODEL` | Optional | Defaults in the application to `gpt-5.4-mini`; use a model your provider supports with Responses structured outputs |
| `OPENAI_BASE_URL` | Optional | HTTPS OpenAI Responses-compatible gateway; omit for the standard OpenAI API |

A ChatGPT/Codex subscription alone is not an API credential. A custom gateway must support the Responses API, structured outputs and the configured model. The health probe additionally uses model retrieval; gateway compatibility must be checked.

Restart the development server after changing local values. To check model access:

```sh
curl http://localhost:5187/api/ai-status
```

A response with `configured: true` means a key exists. `verified: true` means the model-access check succeeded; it does not guarantee every generation will succeed. Successful checks are cached for five minutes within a worker, failed checks for thirty seconds.

Without working AI, calculations and deterministic drafts remain usable. AI-only explanation buttons display an unavailable/error message. The focused client-update workflow can return an explicitly labelled template fallback; the app does not present that fallback as live AI.

**Hosted configuration is separate:** `.env.local` does not configure the public Site. Set `OPENAI_API_KEY` through Sites runtime-secret management. Never use `VITE_` or `NEXT_PUBLIC_` for this key. Rotate any credential exposed in chat or committed source. Do not distribute development environment files or an unfiltered build directory.

## How to use the app

### Portfolio desk — `/`

1. Select a client and, optionally, a specific portfolio.
2. Open **Intelligence** to inspect findings. Use **Show supporting evidence** to check records and **Analyse with AI** for qualitative interpretation.
3. Open **Scenario explorer**, then choose a tool:
   - **World events & impact:** choose a hypothetical event, review/edit all class shocks, and run the comparison. Expand a portfolio to trace individual contributions. **Explain with AI** interprets up to three assessed portfolios.
   - **Goal & sale scenarios:** enter a USD objective, deadline, external cash and cost allowance. Select eligible holdings and confirm assumptions before calculating.
   - **Portfolio simulator:** select one portfolio, set asset weights totaling exactly 100%, enter market shocks and compare the proposed mix.
   - **Wealth projections:** enter a future goal, horizon, annual contributions and three ordered return assumptions.
4. Open **Conversation brief**, choose an eligible finding and message purpose, edit the draft, check the evidence/recipient, then review and copy it.
5. Use **Overview**, **Review findings** and **Investments** for the broader context and all available records.

Changing relevant scenario inputs clears old results. Changing clients resets scenario state. Editing a communication draft invalidates its review. Saved approval is not restored after reloading.

### Focused funding desk — `/funding-review`

The header’s **Funding & communication desk** link opens three curated cases:

| Client / portfolio | Specific case |
|---|---|
| Tran · `CL-0006` / `PF-0008` | Cash obligations alongside restricted or gated investments |
| Margarethe · `CL-0003` / `PF-0005` | Inherited allocation versus supplied conservative mandate |
| Cheung · `CL-0012` / `PF-0014` | Conflicting retirement-spending records |

Use **Prepare all 3 reviews** for batch calculation, or enter a short synthetic meeting note for optional AI excerpt extraction. Review extracted details before preparing the client draft. The communication workflow supports requests, externally recorded sending, follow-up dates and reply notes. It does not send messages, monitor inboxes or schedule background reminders. Recording “sent externally” is a manual record of an action taken in another channel.

## Validate and preview the production build

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

| Command | Purpose |
|---|---|
| `npm test` | Domain, scenario and validation tests; 35 tests passed at the latest feature verification |
| `npm run typecheck` | TypeScript checks |
| `npm run lint` | Application code checks |
| `npm run lint:all` | Also checks untouched starter components; historical starter findings are documented separately |
| `npm run build` | Builds browser assets and Cloudflare Worker output |
| `npm start` | Starts a **local Wrangler preview** of the built output; it does not publish the Site |

After a successful build, stop the development server if necessary and run:

```sh
npm start
```

Use the URL printed by Wrangler. Runtime secrets for this preview may need separate local Wrangler configuration; they are not inherited from the public Site. Do not copy the public secret into source or generated files.

Feature verification history is in [VERIFICATION.md](VERIFICATION.md). Its early sections describe older milestones; later entries supersede those earlier deployment/AI limitations. Tests are not a substitute for full browser, security, accessibility or bank acceptance testing.

## Deploy to ChatGPT Sites

### Existing FundingLens Site

This checkout is linked to the existing Site through `.openai/hosting.json`. **Preserve its `project_id` when updating FundingLens.** Do not create another Site just to publish an update.

Requirements:

- Access to the complete application source and a working Git checkout rooted in `fundinglens`.
- Codex with the Sites building/hosting skills and connector available.
- Permission to update the linked Site and publish to its intended audience.
- A successful production build and network access for upload.
- An OpenAI runtime secret on that Site if live AI is needed. A key configured on another Site or in `.env.local` is not automatically available here.

Open this folder in Codex and request:

> Validate this FundingLens project and deploy it to the existing ChatGPT Site referenced in `.openai/hosting.json`. Preserve the existing project and public URL. Use server-side Sites secrets for OpenAI, and verify deployment success before returning the link.

The Sites workflow performs these steps:

1. Read the existing Site and confirm the intended access level. Configure missing runtime secrets securely through Sites; do not store them in the hosting manifest.
2. Run the validation commands and production build above.
3. Commit the validated application source and push it to the Site’s source repository using a short-lived Sites write credential. Keep that credential out of Git configuration and remote URLs.
4. Package the build with the installed Sites plugin’s `scripts/package-site.sh` helper. The helper takes the project directory and output archive path; Codex resolves its location from the installed plugin.
5. Save a Site version using the full pushed commit SHA and packaged archive.
6. Deploy the saved version to the authorized audience. Poll until the deployment reports `succeeded` or `failed`.
7. Open the deployed URL. Check the page and `/api/ai-status`; try one synthetic AI request if AI is enabled.

**Expected build inputs to packaging:** `dist/server/index.js`, generated Worker configuration, browser assets under `dist/client/`, and `.openai/hosting.json`. Use the packaging helper rather than uploading the complete project or raw `dist` tree, which can contain local development artifacts.

Current public URL: [FundingLens](https://fundinglens-rm-review.mrakashkum.chatgpt.site/).

### Publish your own separate copy

Ask Codex to create a **new Sites project for your copy** and associate that copy with the returned project ID. Keep the original FundingLens checkout and Site association intact. Configure your copy’s own secrets, choose its audience explicitly, then build, save and deploy it. Do not invent a project ID or reuse this Site’s ID for an unrelated deployment.

### Hosting constraints

`npm run build` creates an artifact; `npm start` previews it locally. Neither command publishes to `chatgpt.site`. Publishing there requires Sites access and its version/deployment workflow.

Uploading only `dist/client` to GitHub Pages or another static host will not preserve the server-backed AI routes. This README does not claim a tested Vercel, Netlify or standalone Cloudflare deployment path. Moving hosts requires adapting the Worker runtime, secret bindings and Sites integration.

### Deployment acceptance checks

- The deployed page loads at the returned URL and the intended audience can access it.
- Client/portfolio selection and all four scenario tools are available.
- Unknown or incomplete data remains visibly unassessed.
- `/api/ai-status` reports the expected configuration; a synthetic generation succeeds when enabled.
- Failed AI requests leave the deterministic results usable.
- Drafts require review before copying; no message or trade is sent automatically.

Review provider usage before exposing paid AI to unrestricted visitors. Per-worker concurrency controls and caches are **not global rate limits or spending caps**. The current public Site is a synthetic demonstration, not an authenticated client portal.

## Architecture and code structure

```text
Bundled CSV / JSON snapshot
         │
         ▼
Dataset repository → Portfolio review service → Rules + evidence
         │                                      │
         ▼                                      ▼
React RM workspace                    Server-side AI endpoints
         │                                      │
         ├─ TypeScript scenario calculations    ├─ Recompute / validate inputs
         ├─ Recharts visualizations             ├─ OpenAI Responses API
         └─ Editable client drafts              └─ Validate structured output
                        │
                        ▼
              RM review → preview / copy
              Browser-local draft history
```

The stack is React 19, TypeScript, Vinext, Vite, Cloudflare Workers, Recharts, shadcn/Base UI, Lucide, the OpenAI JavaScript SDK and Zod. Versions are pinned or constrained in [package.json](package.json); `npm ci` uses the lockfile.

| Location | Responsibility |
|---|---|
| `app/page.tsx` | Main portfolio desk |
| `app/funding-review/` | Focused three-case workflow |
| `app/api/` | AI and review HTTP endpoints |
| `components/portfolio/` | Intelligence, charts, simulations and draft review |
| `lib/data.ts` | CSV/JSON loading, snapshot dates and dataset contract |
| `lib/portfolio/contracts.ts` | Repository, rule and result interfaces |
| `lib/portfolio/repository.ts` | Dataset adapter |
| `lib/portfolio/service.ts` | Record validation and review orchestration |
| `lib/portfolio/rules.ts` | Independent evidence-backed review rules |
| `lib/scenarios/model.ts` / `allocation.ts` | Cash-goal calculations and post-sale checks |
| `lib/scenarios/portfolio-simulator.ts` | Allocation budgets and shock comparison |
| `lib/scenarios/events.ts` | Event presets, per-holding impacts and AI validation |
| `lib/intelligence/model.ts` | Scope validation and annual wealth projections |
| `lib/reviews.ts`, `lib/intake.ts`, `lib/communications.ts` | Focused review, note intake and communication state |
| `data/` | Synthetic source records and [data dictionary](data/DATA_DICTIONARY.md) |
| `tests/review.test.ts` | Domain and validation regression coverage |
| `vite.config.ts` | Vinext, Sites and Cloudflare integration |
| `.openai/hosting.json` | Site identity and logical storage bindings; no secrets |

Repositories, rules, calculations and UI are separate so new adapters or checks can be added without replacing the entire workflow.

### API map

| Method / path | Purpose |
|---|---|
| `GET /api/ai-status` | Check configured model access |
| `GET /api/reviews/:clientId` | Build a supported focused case review |
| `GET /api/review-batch` | Prepare the curated case batch |
| `POST /api/briefing` | Optional AI client-update drafting |
| `POST /api/intake` | Extract supported literal excerpts from a synthetic note |
| `POST /api/portfolio-intelligence` | Explain computed findings |
| `POST /api/scenario-explanation` | Explain validated cash-sale comparisons |
| `POST /api/event-intelligence` | Interpret validated event scenarios |

Refer to each route’s implementation for its request schema. The main portfolio desk covers the whole supplied book; the focused review endpoints do not imply arbitrary-client case coverage.

## Data, calculations and limitations

Source: [SingHacks 2026 Julius Baer dataset](https://github.com/Singhacks-2026/juliusbaer). The application bundles synthetic data; no live bank or news feed is connected. Historical value snapshots are not a performance attribution or total-return series.

| Calculation | Method and practical limit |
|---|---|
| Portfolio checks | Supplied mandate bands and explicit demo rules; custody mandate checks are excluded. Findings are review candidates, not suitability conclusions. |
| Cash objective | Cents-based sales under divisible-position and uniform-cost assumptions. Eligible assets are screened conservatively; actual lots, settlement and tax need verification. |
| Reallocation | Target weights total 100%; rounding preserves the existing USD budget. Proposed allocations are not executable orders. |
| Wealth projection | Each year: prior value × (1 + assumed rate) + year-end contribution. Excludes withdrawals, costs, taxes and inflation. |
| Event impact | Holding value × entered asset-class shock, rounded to cents and aggregated per portfolio. No probabilities or calibrated expected returns. |
| Communication | Drafts and history are stored locally in the browser. They are editable and are not an authenticated, tamper-proof audit log. |

World-event presets are arbitrary illustrations, not predictions that a Fed, political or conflict event will occur. “Downside” and “upside” are selected examples, not worst/best possible bounds. Broad asset classes cannot accurately price bond-duration effects, individual sectors, currency movements or nonlinear structured products.

Missing or conflicting essential records block relevant assessments. External accounts, later trades and unsupplied client facts are not visible. AI output validation reduces some errors but does not establish semantic correctness. No measured time savings, guaranteed investment outcomes or production-scale throughput are claimed.

Real-client deployment requires authenticated identities, portfolio entitlements, secure persistent storage, auditable approvals, approved data/provider arrangements, monitoring, global abuse/spending controls and validated financial models. Do not enter real client information in the public demo.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Install or startup fails | Confirm Node ≥ 22.13, run from this project directory, and use `npm ci` with the lockfile. Check network access. |
| Port 5187 is occupied | Stop the existing process you own or run the dev command with another port, such as `--port 5188`. |
| Local server cannot bind a port | Check local firewall/sandbox permissions. In Codex, allow the development-server action when required. |
| Key configured, connection not verified | Confirm model access, credential validity and gateway compatibility. Restart locally after edits; allow the short failed-check cache to expire. |
| AI works locally but fails publicly | Set the key/model on the correct Site as runtime configuration. Local environment files are not hosted configuration. |
| AI explanation fails | Check model support, quota and provider availability. Use the deterministic results while retrying. Never print keys when diagnosing errors. |
| Scenario results disappear after editing | Intended: input changes invalidate previous results and AI explanations. Run the calculation again. |
| Portfolio cannot be simulated | Inspect its source-quality findings and missing values. Do not replace missing values with zero. |
| Allocation simulation will not run | Every target must be valid and the total must equal 100%, with at most two decimal places. |
| Copy is unavailable | Use HTTPS or localhost and browser clipboard permissions; manually copy the reviewed preview if needed. |
| Draft history is missing | It belongs to that browser/origin. Clearing storage or switching browsers/local/public URLs does not migrate drafts. |
| Build warns about large chunks or route classification | These have appeared in successful builds; check the actual exit status and final build result. Investigate runtime failures separately. |
| Deployment fails | Inspect Sites deployment status/logs, fix the source or runtime configuration, rebuild if needed and publish a new validated version. |

## Extending the project

- **Data:** implement an approved repository adapter preserving ownership, source IDs and dates. Validate new records before analysis.
- **Review rules:** add an independent `ReviewRule` and regression tests for evidence and edge cases.
- **Scenarios:** keep numerical logic in pure modules; expose assumptions and verify budget conservation and missing-data behavior.
- **Forecasting:** add licensed market history, instrument-level exposures and a separately calibrated/backtested model before making probability or expected-return claims. An LLM narrative alone is not such a model.
- **Communications:** integrate only an approved channel; preserve recipient authorization, reviewed revisions and durable audit records before enabling delivery.
- **Storage and access:** implement authentication, authorization and migrations before adding real multi-user customer data.

Keep `.env.local`, `.dev.vars*`, `.wrangler/`, `node_modules/` and unfiltered `dist/` output out of source control and public exports. The committed `.env.example` should contain placeholders only.
