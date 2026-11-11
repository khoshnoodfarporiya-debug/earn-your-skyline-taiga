# Earn Your Skyline — Full Codebase Audit, Visual Handoff, Product Roadmap and Monetization Plan

**Prepared:** 27 August 2026  
**Repository:** `C:\Users\khosh\Desktop\KhoshWorks\ACTIVE\career-tycoon`  
**Audience:** Claude or another implementation agent continuing work in this exact repository

## How to use this document

This is a self-contained handoff describing the audited state of the game, the work already completed, the remaining defects, the proposed product direction, all seventy career-feature ideas, the recommended redesign, and the commercial model.

Before changing anything:

1. Work only in the repository named above.
2. Inspect `git status` and preserve all existing user changes. The worktree is intentionally dirty and contains a large in-progress integration batch.
3. Do not use destructive Git commands or rewrite unrelated files.
4. Do not build all feature ideas at once. Follow the dependency order near the end of this document.
5. Fix reliability and economy blockers before adding paid-content systems.
6. Keep the game endless. Milestones and optional retirement are allowed; forced endings are not part of the design.
7. Keep all artwork paths in registries/components rather than scattering literal paths through career screens.
8. After any meaningful change, run TypeScript, lint, the command-contract suite, production build and relevant Playwright coverage.

## Executive verdict

The game is a strong closed alpha, but it is not ready for a paid public release.

**Current quality: 76/100 — B-.**

| Area | Score | Assessment |
|---|---:|---|
| Simulation and mechanics | 18/20 | Deterministic weekly loops, meaningful profession rules, and recovery instead of forced game-over endings |
| Career depth | 14/20 | Physician and Chef are strong; the four newest careers are noticeably smaller |
| UX and accessibility | 16/20 | Good keyboard, mobile and map coverage; navigation and weekly planning need consolidation |
| Visual presentation | 13/15 | Coherent cinematic identity with the new visual batch integrated |
| Reliability and data | 8/15 | Save, validation and balance defects block a commercial release |
| Maintainability and release readiness | 7/10 | Excellent test investment, but large monoliths, messy integration state, and no release infrastructure |
| **Total** | **76/100** | **Good closed alpha; not commercial-ready** |

There are no known P0 catastrophes in the normal tested path. The game compiles, builds and its tested flows work. The P1 issues below concern corrupted or cross-profile data, unvalidated states, balance, and production readiness.

## Current career health

| Career | Quality | Approximate implemented depth | Main weakness |
|---|---:|---:|---|
| Physician | 8.5/10 | 18 screens, 20 events, 13 named characters | Needs deeper long-term patient continuity |
| Chef | 8.5/10 | 12 screens, 17 events | No authored career cast and no restaurant-group layer |
| Solicitor | 7.5/10 | 6 screens, 3 events, 6 named characters | Casework needs more procedural depth |
| Founder | 5.5/10 | 5 screens, 4 events | Thin customer, product and sales layer |
| Politician | 5.5/10 | 6 screens, 4 events | Campaigning exists; governing remains shallow |
| Architect | 5.5/10 | 6 screens, 4 events | Strong premise, limited full-project lifecycle |
| Engineer | 4.5/10 | 4 screens, 4 events | Smallest career and needs substantial expansion |

All seven careers do have distinct simulation identities:

- Physician: clinical capability and treatment capacity.
- Chef: perishability, menu construction and service execution.
- Solicitor: matters consume hours and only pay through settlement/judgment/billing.
- Founder: runway, customer growth, product quality and dilution.
- Politician: support drifts toward positions and only polling day counts.
- Architect: staged fees, client revision risk and work on the boards.
- Engineer: hidden true defects, uncertain estimates, testing and certification.

## P1 defects — fix before accepting money

### 1. Cross-profile archive writes to the wrong key

`lib/game/save.ts` reads retired characters using `scoped(ARCHIVE_KEY)` around line 827, but `saveArchive` writes directly to `ARCHIVE_KEY` around line 842.

Impact:

- A signed-in profile can archive a character and then fail to read it back.
- Different local profiles can overwrite the same unscoped archive.
- Legacy-adoption behavior can move or expose data inconsistently.

Required fix:

- Make both read and write use the same scoped key.
- Add tests for two profiles archiving independently.
- Add migration handling for any already-written unscoped archive.

### 2. Numeric-map validation does not require expected keys

`lib/game/validate.ts:34` defines `numberMap` as “every value that exists is finite.” It accepts `{}` and incomplete maps.

Observed behavior: removing a required resource such as `cash` from an otherwise valid run can still be accepted by the root save validator.

Required fix:

- Introduce a required-key validator or validate every resource field explicitly.
- Reject missing, extra-dangerous, non-finite and incorrectly typed values.
- Add mutation tests that remove every required field one at a time.

### 3. Phone message answers are not bounded

`lib/game/medical/validate.ts` around lines 216–227 accepts arbitrary choice objects and any integer `answered` value. `components/phone/MessagesApp.tsx` around lines 93–95 dereferences `msg.choices[msg.answered].reply` without a range check.

Observed behavior: an answer index such as `99` passes validation and can crash the interface.

Required fix:

- Validate every choice’s exact shape.
- Require `answered >= 0 && answered < choices.length`.
- Render defensively even if a corrupted save gets through.

### 4. New career validators ignore phone state

The following validators validate their career model but not their phone object:

- `lib/game/careers/founder.ts:584`
- `lib/game/careers/politician.ts:526`
- `lib/game/careers/architect.ts:643`
- `lib/game/careers/engineer.ts:565`

Replacing the phone with malformed data can still pass those career validators.

Required fix:

- Create one shared strict phone validator.
- Use it in all seven careers.
- Test malformed feeds, messages, news, social metrics and answered choices.

### 5. Economy balance is not commercially acceptable

The diagnostic runs were small four-seed smoke tests, so the figures are signals rather than final statistical conclusions. They are nevertheless severe:

- Chef and Solicitor bots reached their objectives in 0% of tested starting cities.
- An ambitious Chef spent 33 weeks overdrawn in Paris.
- A Solicitor in New York spent 82 weeks overdrawn and reached approximately `-$311,000`.
- Singapore produced 76 overdrawn weeks for the Solicitor strategy.
- A Physician strategy could reach its milestone while averaging roughly `-$4.9M` net worth.
- Founder, Politician, Architect and Engineer do not have equivalent balance bots.

Required fix:

- Define success, solvency, progress and recovery contracts per career.
- Build deterministic bots for every career and every starting market.
- Run at least 40–100 seeds per strategy before release decisions.
- Treat reaching a milestone with catastrophic negative worth as a failed balance outcome.

### 6. Local accounts are not real authentication

`lib/game/account.ts` provides local-browser profiles. Passcodes are not stored in plaintext, which is good, but the system is explicitly not a server authentication boundary.

`app/page.tsx` around line 36 trusts the active-profile ID before confirming the profile still exists. A stale ID can open a scoped game with a blank identity.

This is acceptable for an offline alpha. It is not sufficient for cloud saves, account recovery, purchases, cross-device play or multiplayer/community functions.

## P2 engineering and release problems

### Maintainability

- `scripts/commands.ts` is roughly 16,000 lines.
- `e2e/app.spec.ts` is roughly 7,000 lines.
- `lib/game/careers/chef.ts` is roughly 3,456 lines.
- `lib/game/careers/kitchen.ts` is roughly 2,695 lines.
- `lib/game/careers/doctor.ts` is roughly 2,681 lines.
- `lib/game/careers/lawyer.ts` is roughly 1,983 lines.
- `lib/game/careers/casework.ts` is roughly 1,411 lines.
- `components/careers/LawyerScreens.tsx` is roughly 1,230 lines.

Split by coherent domain, not arbitrary line count. Keep pure calculations independent from commands, validation, weekly resolution, content catalogues and UI.

### Worktree and line endings

At the audit snapshot, 37 tracked files were modified, with many new modules and assets untracked. `scripts/commands.ts` also has a full-file line-ending conversion, making the diff far larger than its semantic changes.

Required cleanup:

- Add a deliberate text EOL policy to `.gitattributes`.
- Normalize in a separate, clearly identified commit.
- Stage explicit files, not `git add -A`.
- Keep functional changes separate from mechanical formatting.

### Missing release infrastructure

No repository-level implementation was found for:

- CI workflows.
- Deployment configuration.
- Error boundary and user-friendly recovery screen.
- Crash reporting.
- Product analytics.
- Player feedback reporting.
- Cloud saves and backup/restore.
- Real account recovery.
- PWA/offline-install metadata.

### Stale documentation and metadata

- `README.md` still presents only Physician, Chef and Solicitor near lines 14–16.
- `README.md` still says the Playwright suite contains 64 tests near line 850.
- Several art counts and implementation notes are outdated.
- `app/layout.tsx:59` still describes only a Physician starting with debt and an exam room.
- Public title/description/store copy should present the seven-career product.

### Build reproducibility

The production build uses Google-hosted Barlow, IBM Plex Mono and Saira Condensed through `next/font/google`. It passes with network access, but an offline/restricted build fails while fetching fonts. Consider preserving the licenses and self-hosting the required font files through `next/font/local`.

### Browser-test shutdown

All 390 Playwright cases reported as passing. After the final case, the Windows runner did not terminate its Next.js preview server and had to be stopped manually. The tests completed, but the process did not provide a clean final exit code.

Investigate process-tree shutdown so CI cannot hang after a green suite.

## Visual work already completed

Thirteen missing screen-level career scenes were generated, preserved as source masters, optimized, registered and placed in the UI.

### Founder

- `art-source/visuals/careers/founder-runway-v1.png`
- `art-source/visuals/careers/founder-team-v1.png`
- `art-source/visuals/careers/founder-raising-v1.png`

### Politician

- `art-source/visuals/careers/politician-polling-v1.png`
- `art-source/visuals/careers/politician-electorate-v1.png`
- `art-source/visuals/careers/politician-positions-v1.png`
- `art-source/visuals/careers/politician-office-v1.png`

### Architect

- `art-source/visuals/careers/architect-boards-v1.png`
- `art-source/visuals/careers/architect-offers-v1.png`
- `art-source/visuals/careers/architect-competitions-v1.png`
- `art-source/visuals/careers/architect-studio-v1.png`

### Engineer

- `art-source/visuals/careers/engineer-bench-v1.png`
- `art-source/visuals/careers/engineer-newbuild-v1.png`

Each scene has 720px and 1200px WebP derivatives in `public/visuals/careers/`.

Integration points:

- `scripts/build-purchase-art.ts` owns and converts the new masters.
- `lib/ui/purchaseArt.generated.ts` records their measured dimensions.
- `lib/ui/careerSceneArt.ts` maps career screen IDs to artwork and focal points.
- `components/careers/CareerSceneBanner.tsx` provides the reusable banner.
- Founder, Politician, Architect and Engineer screens render that banner.

Current inventory after the batch:

- 311 optimized runtime WebP files.
- 186 preserved PNG masters.
- All seven career covers present.
- All fourteen cities have artwork.
- Current purchase, department and equipment catalogues have artwork.
- Chef and Solicitor already have environment packs.
- Every currently implemented Founder, Politician, Architect and Engineer profession screen now has a scene.

Do not fabricate portraits before characters are authored. Founder, Politician, Architect and Engineer need named casts and relationship mechanics first; portrait generation should follow a locked character bible.

### Image-generation direction

The completed batch used built-in image generation with this shared direction:

> Premium realistic management-sim environment, dark navy cinematic lighting, grounded professional setting, restrained career-specific accent light, wide 3:2 composition, high detail, believable materials, calmer negative space for live UI overlays, no readable text, no labels, no logo, no baked UI and no watermark.

The Engineer New Build scene was regenerated because the first version contained readable generated labels. The replacement contains only physical prototypes and unmarked equipment.

## Unified layout and design proposal

The current interface has strong individual screens but exposes too much profession-specific navigation. The weekly planner also loses prominence outside Overview. All careers should share five stable destinations:

1. **Week** — plan, constraints, commit and review.
2. **Work** — the profession’s core simulation screens.
3. **World** — map, cities, rivals and opportunities.
4. **Career** — progression, reputation, skills, people and milestones.
5. **Life** — home, lifestyle, relationships, legacy and optional retirement.

The Phone should remain a utility action, not a sixth primary navigation destination.

### Desktop structure

```text
┌────────────────┬────────────────────────────────┬──────────────────┐
│ Career rail    │ Current decision screen        │ Weekly plan      │
│ identity       │ scene banner                   │ money/runway     │
│ destinations   │ constraints                    │ urgent warnings  │
│ progression    │ decisions and comparison       │ Commit week      │
└────────────────┴────────────────────────────────┴──────────────────┘
   208–224px               flexible                 300–340px
```

- The weekly plan remains visible on every normal desktop screen.
- The main region should usually resolve to 700–900px of decision space.
- World/Map can expand the main stage while the right rail becomes city intelligence.
- Avoid nested horizontal tab bars.

### Tablet behavior

- Collapse the right planner into a persistent drawer button.
- Keep the career rail compact or convert it to an icon-and-label strip.
- Preserve the same five destinations and screen URLs/state.

### Mobile structure

```text
Career · Week · main constraint · Phone
────────────────────────────────────────
Current scene and decisions
────────────────────────────────────────
Sticky “Week plan” control → full-height sheet
────────────────────────────────────────
Week     Work     World     Career     Life
```

- Use a compact top bar with career, week, binding constraint and Phone.
- Use a five-item bottom navigation.
- The weekly plan opens as a full-height sheet and remains one tap away.
- Replace long horizontal screen strips with a grouped screen selector.
- Map opens full-screen with city details in a bottom sheet.
- Phone opens full-screen.
- Detail drawers become consistent mobile sheets.

### Map redesign

The map is already active SVG geography with fourteen real markets, zooming, clustering, keyboard navigation, state-aware markers and routes. Keep that foundation.

Improve it by:

- Letting it fill the primary content region.
- Placing zoom, filters and route toggles over the map.
- Opening selected-city intelligence in the desktop right rail or mobile sheet.
- Adding compare mode for up to three cities.
- Showing profession-specific opportunity layers.
- Drawing operating routes and future expansion paths distinctly.
- Keeping locked cities visible while stating exact unlock requirements.
- Reducing decorative grids that compete with geographic shapes.
- Using subtle route animation only when reduced motion is not requested.
- Keeping labels and markers readable at every supported zoom.

### Shared design components to build

- `CareerScreenHeader`
- `ConstraintStrip`
- `WeeklyPlanRail`
- `WeeklyPlanSheet`
- `DecisionCard`
- `CareerSceneBanner` (already created; evolve rather than duplicate)
- `WorldMapShell`
- `ProgressionTrack`
- `CompareDrawer`

### Color system

Shared foundation:

- Background: `#07111F`
- Surface: `#101D2E`
- Raised surface: `#17273B`
- Main text: `#F7FAFC`
- Secondary text: `#9FB0C4`
- Divider: `#24364B`

Career accents:

| Career | Accent |
|---|---|
| Physician | `#2DD4BF` |
| Chef | `#F97316` |
| Solicitor | `#D6A94D` |
| Founder | `#8B5CF6` |
| Politician | `#818CF8` |
| Architect | `#4C8DFF` |
| Engineer | `#A3E635` |

Warning, failure, success and accessibility semantics must remain stable across careers. Do not turn a semantic red/green state into a profession-specific accent.

## Seventy-feature career roadmap

`[Base]` means the feature should strengthen and help sell the base game rather than be charged separately. `[Expansion]` means it is suitable for a coherent post-launch career pack. Do not sell individual mechanics one by one.

### Physician — ten features

1. `[Base]` Persistent named patients with longitudinal histories.
2. `[Base]` Diagnostic encounters with differentials, tests and referrals.
3. `[Base]` Appointment book, waiting lists and urgent scheduling.
4. `[Base]` Cross-department treatment pathways.
5. `[Base]` Insurer and reimbursement contracts.
6. `[Expansion]` Teaching hospital, residents and supervision.
7. `[Expansion]` Research portfolios, sponsors and ethics approval.
8. `[Expansion]` Telemedicine and home-care networks.
9. `[Expansion]` Accreditation, audits and patient-safety systems.
10. `[Expansion]` Hospital boards, ownership and governance.

### Chef — ten features

1. `[Base]` Restaurant concept and evolving culinary identity.
2. `[Base]` Reservations and a live table board.
3. `[Base]` Multi-course menu architecture and tasting menus.
4. `[Base]` Supplier contracts, provenance and seasonal availability.
5. `[Base]` Persistent allergen, hygiene and food-safety management.
6. `[Expansion]` Front-of-house service and guest recovery.
7. `[Expansion]` Rotas, mentorship and brigade succession.
8. `[Expansion]` Second restaurants and group management.
9. `[Expansion]` Cookbooks, sauces and retail product lines.
10. `[Expansion]` Preservation, fermentation and zero-waste systems.

### Solicitor — ten features

1. `[Base]` Client interviews covering objectives and credibility.
2. `[Base]` Evidence and disclosure boards.
3. `[Base]` Procedural calendars and missed-deadline risk.
4. `[Base]` Negotiation ladders, mediation and settlement strategy.
5. `[Base]` Hearing strategy involving witnesses, submissions and counsel.
6. `[Base]` Matter teams, time recording and utilization.
7. `[Base]` Conflicts, client money, confidentiality and professional risk.
8. `[Expansion]` Precedent and knowledge-management library.
9. `[Expansion]` Trainee-to-partner progression.
10. `[Expansion]` Regional offices and cross-border jurisdictions.

### Founder — ten features

1. `[Base]` Customer interviews and problem validation.
2. `[Base]` Product roadmap and technical-debt decisions.
3. `[Base]` Acquisition funnel and experiment system.
4. `[Base]` Pricing, packaging and unit economics.
5. `[Base]` Competitor companies that react to the player.
6. `[Base]` Reliability, privacy and security incidents.
7. `[Expansion]` Enterprise sales pipelines and procurement.
8. `[Expansion]` Ownership, culture and staff-retention systems.
9. `[Expansion]` Investor clauses, boards and governance.
10. `[Expansion]` International expansion and localization.

### Politician — ten features

1. `[Base]` Named constituent casework.
2. `[Base]` Volunteers, field offices and get-out-the-vote operations.
3. `[Base]` Fundraising, donors and compliance.
4. `[Base]` Polling uncertainty, turnout models and focus groups.
5. `[Base]` Debates, speeches and hostile interviews.
6. `[Base]` Party factions and coalition management.
7. `[Expansion]` Legislation, amendments and committees.
8. `[Expansion]` Government budgets and delivery performance.
9. `[Expansion]` Investigations, scandals and crisis response.
10. `[Expansion]` Wards, boundaries and regional campaigns.

### Architect — ten features

1. `[Base]` Interactive client briefs and trade-offs.
2. `[Base]` Sites, zoning, planning and heritage constraints.
3. `[Base]` Cost planning and value engineering.
4. `[Base]` Material selection and embodied-carbon consequences.
5. `[Base]` Consultant and BIM coordination.
6. `[Base]` Public consultation and objection handling.
7. `[Expansion]` Procurement routes and contracts.
8. `[Expansion]` Construction administration and site inspections.
9. `[Expansion]` Portfolio identity, publications and awards.
10. `[Expansion]` Collaborations and international studios.

### Engineer — ten features

1. `[Base]` Requirements and constraint negotiation.
2. `[Base]` System architecture decisions.
3. `[Base]` Prototypes, test plans and laboratory equipment.
4. `[Base]` Mechanical, electrical, software and manufacturing teams.
5. `[Base]` Bills of materials and supplier risk.
6. `[Base]` Standards and jurisdiction-specific certification.
7. `[Expansion]` Production scaling and quality control.
8. `[Expansion]` Patents and technology licensing.
9. `[Expansion]` Customer pilots and engineering contracts.
10. `[Expansion]` Installed-product telemetry, maintenance and recalls.

## Market and commercial strategy

Recommended positioning:

> One persistent life, seven genuinely different professional empires, and one living global map.

### Market signal

Newzoo estimated the 2025 global games market at $201.6B, including $113.3B mobile and $43.6B PC. It also reported rising mobile acquisition costs and declining downloads. That supports a PC-first premium approach rather than an advertising-funded mobile-first launch.

Source: https://newzoo.com/articles/global-games-market-2025

### Comparable official-store prices

Low tier:

- Game Dev Tycoon — $9.99: https://store.steampowered.com/app/239820/Game_Dev_Tycoon/
- Startup Company — $12.99: https://store.steampowered.com/app/606800/startup_company/
- The Political Process — $14.99: https://store.steampowered.com/app/1184770/

Mid tier:

- PC Building Simulator — $19.99: https://store.steampowered.com/app/621060/PC_Building_Simulator/
- Software Inc. — $22.99: https://store.steampowered.com/app/362620/Software_Inc/
- Project Hospital — $24.99: https://store.steampowered.com/app/868360/Project_Hospital/
- Big Ambitions — $25.99: https://store.steampowered.com/app/1331550/Big_Ambitions/

High tier:

- Democracy 4 — $29.99: https://store.steampowered.com/app/1410710/Democracy_4/
- Chef Life — $29.99: https://store.steampowered.com/app/1122340
- Architect Life — $29.99: https://store.steampowered.com/app/1296400/Architect_Life_A_House_Design_Simulator/

Architect Life’s weak user reception at the audit date is an important warning: attractive career fantasy and visuals cannot compensate for insufficient depth or polish.

Mobile comparisons:

- Game Dev Tycoon — €5.99 premium: https://apps.apple.com/fr/app/game-dev-tycoon/id1162580001
- Pocket City 2 — €5.99 premium: https://apps.apple.com/fr/app/pocket-city-2/id1533709428
- Business Inc. — free with IAP: https://apps.apple.com/fr/app/business-inc-tycoon-simulateur/id6754616988
- BitLife — free with IAP: https://apps.apple.com/fr/app/bitlife-simulateur-de-vie/id1374403536

The premium/no-manipulation route fits Earn Your Skyline better than selling currency, energy or time skips.

## Recommended pricing

- Browser demo: free, approximately 45–60 minutes.
- Steam Early Access: **€14.99**, only after save and balance blockers are fixed.
- Version 1.0: **€19.99**.
- Launch discount: 10%, giving **€17.99**.
- Mature game after major free improvements: **€24.99**.
- Mobile: **€7.99 premium**, or a substantial free demo with an **€8.99 permanent unlock**.
- Supporter Edition: **€27.99**, including soundtrack, artbook and cosmetic themes.
- Later Complete Edition: **€29.99–34.99**.

Steam discount guidance: https://partner.steamgames.com/doc/marketing/discounts

## Career expansion pricing

| Expansion | PC | Mobile |
|---|---:|---:|
| Physician — Hospital Network | €7.99 | €4.99 |
| Chef — Culinary Capitals | €6.99 | €4.99 |
| Solicitor — International Chambers | €6.99 | €4.99 |
| Founder — IPO & Acquisitions | €7.99 | €4.99 |
| Politician — National Office | €7.99 | €4.99 |
| Architect — World Landmarks | €6.99 | €4.99 |
| Engineer — Industrial Frontier | €6.99 | €4.99 |

Do not remove essential depth from launch careers to sell it back later. The `[Base]` items above are part of making the base game worth €19.99. Expansion packs should extend a career after it already feels complete.

Other suitable monetization:

- Three-to-five-city pack: €4.99–5.99.
- Scenario pack: €3.99–5.99.
- Cross-career dynasty/legacy system: €9.99–12.99.
- Home, office and phone cosmetic themes: €1.99–3.99 each or €7.99 bundles.
- Soundtrack/artbook/supporter cosmetics: €6.99–9.99.
- Seasonal gameplay events: free; optional cosmetic collection €2.99–3.99.
- Cloud saves, accessibility, balance fixes, map functionality, modding and leaderboards: included.

The Phone/social feature should remain free because it can generate organic acquisition. Produce attractive external share cards instead of immediately creating an internal public network with moderation costs.

Avoid paid cash, energy, time skips, loot boxes and a subscription. They conflict with the strategic identity and create consumer-protection risk.

European Commission virtual-currency work:
https://commission.europa.eu/news-and-media/news/european-commission-hosts-stakeholders-talks-application-cpc-networks-key-principles-games-virtual-2025-06-03_en

FTC Epic dark-pattern action:
https://www.ftc.gov/news-events/news/press-releases/2023/03/ftc-finalizes-order-requiring-fortnite-maker-epic-games-pay-245-million-tricking-users-making

## Illustrative unit economics

Assumptions: French 20% VAT-inclusive sticker price, standard platform percentage, before refunds, income tax, currency conversion and support costs.

| Price | Steam, 30% | Apple/Google, 15% | Epic first-$1M tier | Direct Stripe |
|---:|---:|---:|---:|---:|
| €7.99 | €4.66 | €5.66 | €6.66 | €6.29 |
| €14.99 | €8.74 | €10.62 | €12.49 | €12.02 |
| €19.99 | €11.66 | €14.16 | €16.66 | €16.11 |
| €24.99 | €14.58 | €17.70 | €20.83 | €20.20 |

References:

- Steam app fee: https://partner.steamgames.com/doc/gettingstarted/appfee
- Steam revenue split: https://steamcommunity.com/groups/steamworks/announcements/detail/1697191267930157838
- Epic first-$1M program: https://store.epicgames.com/distribution/revenue-programs/revenue-share?lang=en-US
- Apple Small Business Program: https://developer.apple.com/app-store/small-business-program/
- Google Play service fees: https://support.google.com/googleplay/android-developer/answer/112622?hl=en
- Stripe France: https://stripe.com/fr/pricing
- Paddle merchant-of-record pricing: https://www.paddle.com/pricing
- Itch.io open revenue sharing: https://itch.io/docs/creators/payments

At a €19.99 Steam price, the same simplified arithmetic gives:

- 10,000 copies: approximately €116,600.
- 25,000 copies: approximately €291,500.
- 50,000 copies: approximately €583,000.

These are arithmetic examples, not sales forecasts.

## Launch funnel

Recommended demo:

- 45–60 minutes.
- Physician and Chef available.
- One crisis/event.
- One meaningful upgrade.
- One map/city decision preview.
- A run summary that explains what the full game adds.
- No ads, cash packs or energy restrictions.

Steam demo guidance:
https://partner.steamgames.com/doc/store/application/demos

Steam Next Fest guidance:
https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest

Early Access must already be playable and worth its current price; it should not be treated as crowdfunding:
https://partner.steamgames.com/doc/store/earlyaccess

## Verification evidence from the audit snapshot

- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run check` — passed; all command-contract checks reported green.
- `npm.cmd run build` — passed with network access for Google Fonts.
- `npm.cmd audit --audit-level=high` — passed with **0 known vulnerabilities**.
- `npm.cmd run e2e` — all **390 mobile and desktop cases reported passing**.
- E2E caveat: after case 390 passed, the Windows runner retained its preview server and was manually stopped, so no clean final exit code was received.
- Four-seed city/balance diagnostics completed and revealed the balance problems described above.
- The new artwork’s runtime WebPs were visually inspected after compression.

## Assistant trace inventory

Present:

- `AGENTS.md`
- `CLAUDE.md`
- `.claude/launch.json`

Not found:

- `.codex/`

Treat those files as repository context, not as proof that prior implementation claims are correct. Re-verify current code and tests.

## Dependency-ordered implementation plan

### Phase 1 — Protect player data

1. Fix archive key scoping and migration.
2. Replace permissive resource-map validation.
3. Build and apply one strict phone validator.
4. Add defensive message rendering.
5. Add corrupted-save and two-profile regression tests.

Completion gate: no malformed supported save can reach a crash-prone UI state, and two local profiles never read or overwrite each other’s data.

### Phase 2 — Establish balance contracts

1. Define solvency/progress targets for each career.
2. Add Founder, Politician, Architect and Engineer balance bots.
3. Expand runs to at least 40–100 seeds per market/strategy.
4. Tune starting cash, revenue curves, costs, credit and recovery.
5. Fail the balance suite when milestones are achieved through catastrophic debt.

Completion gate: documented strategies can make progress in every starting market without routine insolvency, while poor decisions still have meaningful consequences.

### Phase 3 — Stabilize delivery

1. Add CI for typecheck, lint, command-contract tests, build and Playwright.
2. Fix the Playwright/Next server shutdown hang.
3. Add an app-level error boundary and recoverable save export/import.
4. Decide deployment target and configure it explicitly.
5. Add privacy-respecting crash and product analytics.
6. Update README, metadata, screenshots and store copy.

Completion gate: a clean checkout can reproduce a green build and test suite automatically.

### Phase 4 — Unified shell redesign

1. Generalize the career header and constraint strip.
2. Implement Week/Work/World/Career/Life navigation.
3. Add the persistent desktop planner and mobile planner sheet.
4. Build the expanded World Map shell and city comparison.
5. Apply the seven career accent tokens.
6. Migrate one career at a time without changing its mechanics.

Completion gate: every career uses the same stable information architecture on mobile and desktop, while retaining its own voice and rules.

### Phase 5 — Career depth

Do not implement all seventy ideas simultaneously. Start with the minimum base-game vertical slice for the four newest careers:

- Founder: customer discovery, roadmap, funnel and pricing.
- Politician: constituent casework, campaign organization, fundraising and polling uncertainty.
- Architect: briefs, planning, costs and materials.
- Engineer: requirements, architecture, prototypes and team disciplines.

Then improve Solicitor procedural depth. Physician and Chef can receive smaller continuity/polish work while the newer four catch up.

Completion gate: external playtesters cannot identify four careers as obviously smaller or less authored than the first three.

### Phase 6 — Closed playtest and commercial proof

1. Recruit testers who like management/tycoon games.
2. Measure first-session completion, week-10 retention, confusion points and preferred careers.
3. Tune onboarding, economy and decision clarity from evidence.
4. Produce the 45–60-minute demo.
5. Publish the Steam page only when screenshots and messaging represent the real game.

### Phase 7 — Paid expansions

Only after the base game feels complete and retention is proven:

1. Select the most-played career.
2. Build one coherent expansion pack for it.
3. Test price sensitivity around €6.99–7.99.
4. Keep balance, accessibility, cloud saves, fixes and core events free.

## Final direction

Do not chase seventy simultaneous features or monetize incompleteness. The strongest next version is a reliable, balanced, visually coherent €19.99 game in which all seven included careers feel intentional and complete.

The immediate priority order is:

1. Save integrity.
2. Strict validation.
3. Seven-career balance coverage.
4. CI and release reliability.
5. Unified layout.
6. Depth for the four newest careers.
7. Closed playtesting.
8. Demo and store launch.
9. Paid expansion content.
