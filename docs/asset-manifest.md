# Visual system — asset manifest

Every visual in the game, what job it does, and where it lives. The Physician
is most of it; section 1a is the Chef's environment pack.

The registry in [`lib/ui/visuals.ts`](../lib/ui/visuals.ts) is the machine-readable
half of this document: paths, intrinsic dimensions, alt text and focal points.
This file is the half a person needs — why each asset exists, and why it is a
raster, an SVG or neither.

---

## The rule that decided most of it

**Do not generate an image when a diagram would explain the system better.**

Every question about *how the simulation works* — where do my patients go, what
limits capacity, which department is thin, where is the money going — is
answered by a number the simulation computes, and a photograph cannot carry a
number. Those stayed as SVG diagrams: twenty-six symbols and nine data-driven
visuals, none of which loads anything.

The exception is a **purchase**. Choosing between a dialysis unit and an MRI is
not a question about a mechanism, it is a question about a thing — and a thing
is what a picture is for. So the purchasable catalogue is photographed and the
explanatory layer is not.

That line is why the collection grew in exactly one direction: 45 purchasable
items, each with its own artwork, and no new imagery anywhere else.

---

## 0. Purchase artwork (WebP, generated)

Forty-five purchasable items, each with a card image and a detail image, built
by `npm run build:art` from the PNG masters in
`art-source/visuals/purchases/`. The masters are never served.

The registry is [`lib/ui/purchaseArt.ts`](../lib/ui/purchaseArt.ts), keyed by
the **game's own item ids** — `clinic`, `cardiology`, `mri`, `country_estate` —
so a card cannot point at the wrong picture and an item without artwork fails a
test rather than leaving a hole in a screen. Intrinsic dimensions come from
[`purchaseArt.generated.ts`](../lib/ui/purchaseArt.generated.ts), written by the
same script that emits the files, because the masters arrive at ten different
aspect ratios and a hardcoded size would reserve the wrong box.

| Group | Items | Runtime path | Sizes |
| --- | --- | --- | --- |
| Facilities | 4 | `purchases/facilities/facility-*.webp` | 720w card, 1200w detail |
| **Departments** | **12** | `purchases/departments/department-*.webp` | 720w card, 1200w detail |
| Equipment | 12 | `purchases/equipment/equipment-*.webp` | 720w card, 1200w detail |
| Homes | 4 | `purchases/homes/home-*.webp` | 720w card, 1200w detail |
| Lifestyle | 13 | `purchases/lifestyle/lifestyle-*.webp` | 720w card, 1200w detail |

**Versioning.** Runtime names drop the `-vN` suffix and the highest version
wins, so `equipment-mri-v2.png` ships as `equipment-mri.webp` and the `-v1`
master stays in `art-source` as history. Twelve equipment scenes and three cars
have been re-shot this way; the superseded masters are kept, not deleted.

**Alt text** is written per item and describes the subject, because on a
purchase card the picture is often the fastest way to tell a rehabilitation
suite from an endoscopy unit. Cards render lazily; the detail drawer's image is
`priority`, since by then the player has asked for it.

**Fallback.** `purchaseArt(id)` returns `null` rather than a placeholder path.
The card then draws a typographic tile carrying the item's own icon. A broken
`<img>` is worse than no image, and a shared "coming soon" graphic is worse
than both.

---

## 0.5 Character portraits (WebP, generated)

Eighteen faces, each at two sizes, built by `npm run build:art` from the PNG
masters in `art-source/visuals/characters/`. The registry is
[`lib/ui/portraits.ts`](../lib/ui/portraits.ts); every surface draws through the
one shared [`Avatar`](../components/ui/Avatar.tsx).

| Set | Count | Runtime path |
| --- | --- | --- |
| Main cast | 13 | `characters/cast/character-*.webp` |
| Social-only | 5 | `characters/social/social-*.webp` |

**Sizes.** `160×160` for circular avatars (24–64px on screen, lazy) and
`512×512` for expanded profiles and conversation headers (eager, because by
then the player has asked for it). Both are square, and the box is reserved at
its rendered size so a feed of thirty rows does not reflow as the faces arrive.

### Two keyspaces, and the collision between them

A character is reached by `PersonDef.id` in the relationship model and by an
**exact social handle** on the phone. They agree for most people and diverge
for two:

| Id | The person | The handle | The account |
| --- | --- | --- | --- |
| `meridian` | Dr Anneke Roth | `@meridian` | Meridian Health Group |
| `northgate` | Dr Sofia Aranda | `@northgate` | Northgate Private |

Resolving a phone avatar by person id would put Roth's face on a corporate
press release, so `portraitForSocialHandle` is keyed by handle, checks the
organisation set first, and returns `null` for both. Asserted in
`npm run check`, in both directions.

### Shared and institutional accounts

- **Sand** (`@h_sand`) and **Duarte** (`@i.duarte`) reuse their cast files.
  Same person, same face, whether you are reading their message or their post.
- Cast members are additionally indexed by `@` + their own `PersonDef.handle`,
  so a message addressed to `@p.raman` finds Dr Raman without the message
  carrying a person id — which would be a save-shape change for a presentation
  problem. A check asserts no cast handle ever equals an organisation handle.
- **`@meridian` `@northgate` `@clinicallede` `@rhb_press` `@wellwise`** are
  institutions. They keep initials, marked as organisations, and render as a
  rounded square rather than a circle so a masthead reads differently from a
  colleague. No spokesperson is invented for them.

### Fallback

Initials on a deterministic tint, and they are the guaranteed floor:

1. no portrait registered — an unknown person, a role account like `@team`, or
   any procedurally generated employee;
2. the image **fails to load** — `onError` swaps to initials rather than
   leaving the browser's broken-image glyph.

Alt text is empty throughout: every surface prints the name beside the face, so
a described portrait would read it twice. The `label` prop exists for a future
surface that shows a face without one.

Someone `gone` is desaturated and dimmed — always alongside the word, never
instead of it.

---

## 1. Raster artwork (WebP, reused)

All masters are PNG in `art-source/visuals/`, outside the deployed bundle. All
runtime files are WebP in `public/visuals/`. None contains text, watermarks or
branding. Alt is empty where the surrounding HTML already carries the meaning —
which is every one of them, because none is informational.

| ID | File (`public/visuals/…`) | Screen | Purpose | Dimensions | Focal point | Alt | Role | Loading |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `career-physician` | `careers/career-physician.webp` | Career select | Establishes the profession before a run exists | 1448×1086 | `center 35%` | `""` | Decorative | Lazy |
| `career-chef` | `careers/career-chef.webp` | Career select | Same, for the Chef | 1448×1086 | `center 40%` | `""` | Decorative | Lazy |
| `career-solicitor` | `careers/career-solicitor.webp` | Career select | Same, for a career with no environment art yet | 1448×1086 | `center 35%` | `""` | Decorative | Lazy |
| `practice-progression` | `practice-progression.webp` | Practice → Build | The street your practice stands on, filling in as you buy | 1672×941 | `center 72%` | `""` | Decorative | **Priority** (LCP) |
| `section-overview` | `sections/section-overview.webp` | Overview | Place, under the week's headline | 1672×941 | `center 42%` | `""` | Decorative | Lazy |
| `section-staff` | `sections/section-staff.webp` | Practice → Staff | Place | 1919×820 | `center 40%` | `""` | Decorative | Lazy |
| `section-caseload` | `sections/section-caseload.webp` | Practice → Caseload | Place | 1942×809 | `center 45%` | `""` | Decorative | Lazy |
| `section-career` | `sections/section-career.webp` | Career | Place | 1935×813 | `center 38%` | `""` | Decorative | Lazy |
| `section-life` | `sections/section-life.webp` | Life | Place | 1935×813 | `center 45%` | `""` | Decorative | Lazy |
| `section-expansion` | `sections/section-expansion.webp` | Network → Growth | Place | 2172×724 | `center 45%` | `""` | Decorative | Lazy |
| `city-*` (14) | `cities/city-<name>.webp` | Network → city detail | Establishes a market you are considering | 1672×941 | `center 45%` | `""` | Decorative | Lazy, **one at a time** |
| `event-regulatory-inspection` | `event-regulatory-inspection.webp` | Week review | Supports a major event | 1536×1024 | `center 38%` | *described* | **Informational** | Lazy (behind a dialog) |
| `event-equipment-failure` | `events/event-equipment-failure.webp` | Week review | Supports a major event | 1672×941 | `center 45%` | *described* | **Informational** | Lazy |
| `event-staff-resignation` | `events/event-staff-resignation.webp` | Week review | Supports a major event | 1672×941 | `center 42%` | *described* | **Informational** | Lazy |
| `event-insurer-contract` | `events/event-insurer-contract.webp` | Week review | Supports a major event | 1672×941 | `center 45%` | *described* | **Informational** | Lazy |
| `event-malpractice-claim` | `events/event-malpractice-claim.webp` | Week review | Supports a major event | 1672×941 | `center 48%` | *described* | **Informational** | Lazy |
| `event-outbreak-response` | `events/event-outbreak-response.webp` | Network → Outbreaks | Present only while an outbreak runs | 1672×941 | `center 45%` | `""` | Decorative | Lazy |
| `milestone-hospital-victory` | `milestones/milestone-hospital-victory.webp` | Retirement summary | Marks the largest milestone in the run | 1672×941 | `center 40%` | `""` | Decorative | Lazy |
| `healthcare-network-map` | `healthcare-network-map.webp` | *(not rendered)* | Kept as a possible backdrop; the map is SVG | 1672×941 | `center` | `""` | Decorative | Not loaded |

Mobile crops are handled by `object-position` from the `focus` column plus
`object-cover` on a fixed-height box — never by a second file. Every focal point
was chosen so a hard portrait crop keeps its subject.

### 1a. The Chef's environment pack

Fourteen images, built by `npm run build:art` from the 1536×1024 masters in
`art-source/visuals/careers/`, at the same two widths as a purchase — 720px
for a card, 1200px for a screen's lead image. The registry is
[`lib/ui/chefArt.ts`](../lib/ui/chefArt.ts), and like `purchaseArt.ts` it is
keyed by **the simulation's own ids** rather than by filenames, so a screen
cannot show a flagship dining room to a player standing at a market stall.

Every one of them is a *state*, not scenery. That is the rule the pack was
integrated against: if an image could be swapped for another without the
player being misinformed, it does not belong on the screen.

| ID | File (`public/visuals/careers/…`) | Shown when | Alt | Loading |
| --- | --- | --- | --- | --- |
| `stall` | `chef-market-kitchen.webp` | premises is the market stall | Descriptive | **Priority** (screen lead) |
| `bistro` | `chef-premises-bistro.webp` | premises is the bistro — and on its upgrade card | Descriptive / `""` on cards | Priority / lazy |
| `restaurant` | `chef-premises-restaurant.webp` | premises is the restaurant — and on its upgrade card | Descriptive / `""` on cards | Priority / lazy |
| `flagship` | `chef-premises-flagship.webp` | premises is the flagship — and on its upgrade card | Descriptive / `""` on cards | Priority / lazy |
| `larder.fresh` | `chef-larder-fresh.webp` | stock held, none within a week of its life | Descriptive | Priority (screen lead) |
| `larder.expiring` | `chef-larder-expiring.webp` | any lot is on its last week or already over | Descriptive | Priority (screen lead) |
| `supplier` | `chef-supplier-delivery.webp` | beside the ordering panel | `""` | Lazy |
| `lunch` | `chef-service-lunch.webp` | the lunch card, and the lead if lunch ran | Descriptive / `""` | Lazy |
| `dinner` | `chef-dinner-service.webp` | the dinner card, and the lead if dinner ran | Descriptive / `""` | Lazy |
| `event` | `chef-service-private-event.webp` | the private-event card, and the lead if it ran | Descriptive / `""` | Lazy |
| `catering` | `chef-service-catering.webp` | the catering card, and the lead if it ran | Descriptive / `""` | Lazy |
| `tasting` | `chef-service-tasting.webp` | the tasting card, and the lead if it ran | Descriptive / `""` | Lazy |
| `brigade` | `chef-brigade-briefing.webp` | the Brigade screen, once anybody is employed | Descriptive | Priority (screen lead) |
| `critic` | `chef-event-critic.webp` | the `critic` event fires, via `EVENT_VISUALS` | Descriptive | Lazy |

Two of these are derived rather than chosen. `larderArt()` reads the lots and
returns the expiring picture only when stock is genuinely within a week of
being written off — the same arithmetic the rows underneath print — and the
"last service" lead is the service with the most covers in `lastService.lines`,
so the picture is a report rather than a mood. Both are asserted in
`npm run check` under **The Chef's artwork**.

The critic is registered in `EVENT_VISUALS` like every other career's events,
so the dialog that renders a Physician's inspection renders it with no
knowledge of which career raised it.

### 1b. The Solicitor, which still has none

The Solicitor ships with a career cover (`careers/career-solicitor.webp`) and
shares the world map. **Everything else on its screens is typographic.**
Nothing is faked: its cards and panels are built to read without artwork
rather than pointing at images that do not exist.

Outstanding: borrowed desk, small chambers, established firm, court corridor,
client meeting room, case files, evidence review, negotiation, hearing, legal
staff roles, and a regulatory investigation.

These are not registered anywhere — there is no entry pointing at a missing
file, so no check passes on their behalf. When the masters arrive they go
through the same pipeline the Chef's did.

### 1c. Awaiting artwork

Fourteen purchasable items — the three ambulances and eleven new lifestyle
items — have shipped their gameplay ahead of their masters. They are listed by
id in `AWAITING_ART` (`lib/ui/purchaseArt.ts`) and briefed in
[`artwork-shot-list.md`](./artwork-shot-list.md). Their cards render the
typographic fallback until the files land. `missingArt()` still fails for any
item *not* on that list, so the coverage guarantee holds for everything else.

### 1d. Brand

All five are cut by `buildBrand()` in `scripts/build-purchase-art.ts` from one
master, `art-source/branding/earn-your-skyline-logo-v1.png` — there is no
per-file master, which is why the harness checks this collection by asserting
that the single master is present rather than by deriving a filename.

| ID | File | Screen | Purpose | Dimensions | Alt | Role | Loading |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `logo-lockup` | `brand/logo-lockup.webp` | Career select | The title lockup, emblem and wordmark | 640×261 | *described* | **Informational** | **Priority** |
| `logo-lockup@2x` | `brand/logo-lockup@2x.webp` | Career select | The same at 2× for dense displays | 1280×523 | — | — | via `srcset` |
| `logo-mark-64` | `brand/logo-mark-64.webp` | *(not rendered)* | Square emblem, for a surface that needs the mark alone | 64×64 | `""` | Decorative | Not loaded |
| `logo-mark-128` | `brand/logo-mark-128.webp` | *(not rendered)* | Same, larger | 128×128 | `""` | Decorative | Not loaded |
| `logo-mark-256` | `brand/logo-mark-256.webp` | *(not rendered)* | Same, larger again | 256×256 | `""` | Decorative | Not loaded |

The tab icon and the link-unfurl card are **not** in this table and not in
`public/`: they are `app/icon.png` and `app/opengraph-image.png`, written by the
same function into Next's file conventions, which serve them automatically.
That is why the browser tab has an icon although no mark below is referenced.

The three `logo-mark-*` files ship 28KB that nothing currently requests. They
are kept rather than pruned because the emblem-alone crop is what a touch icon
or a web-app manifest would need, and regenerating them means re-deriving the
measured bounding box. Anything added that uses one should be recorded here.

---

## 2. Symbols — `components/visuals/MedIcon.tsx`

Twenty-six glyphs on a 24×24 grid, **1.6 stroke, round caps and joins, no
fills**, enforced by a shared props object rather than by convention. No emoji
anywhere in the career. The cross appears on exactly one glyph.

**Practice:** `stethoscope` `clinic` `bed` `patient` `pulse` `microscope`
`flask` `ecg` `capsule` `shield` `certificate` `team` `globe` `alert`
`clipboard` `money` `clock`

**Departments:** `heart` `brain` `bone` `child` `skin` `mind` `scan`
`maternity` `emergency` `scalpel` `cell`

An icon is never the only carrier of meaning: a text label sits beside it, or
`label` supplies an `aria-label`. Unlabelled icons are `aria-hidden`.

---

## 3. Diagrams — data-driven, no assets

Each of these is React and CSS reading the simulation's own functions. None
loads anything over the network.

| Component | Screen | What it explains | Source of truth |
| --- | --- | --- | --- |
| `PatientFlow` | Caseload | Where every arriving patient went, and why the ones who left, left | `m.lastCases` via `lib/ui/flow.ts` |
| `CapacityPipeline` | Caseload | Which of eight terms is limiting the week | `computeCapacity` via `lib/ui/capacity.ts` |
| `CaseCard` | Caseload | One condition: what it demands, pays, costs and risks | `CONDITIONS` |
| `CoverageGrid` | Team | Which departments can take the top of their own field | `coverageFor` via `lib/ui/departments.ts` |
| `CareerPathway` | Career | The qualification ladder, and each locked rung's exact requirement | `enrolBlocker` |
| `FinanceWaterfall` | Money | The shape of a normal week, and the runway | `lib/ui/finance.ts` |
| `BurnoutBalance` | Life | What each block costs you and what takes it back | `applyAction` rates |
| `PracticeEvolution` | Build | Five rungs with slots, departments, price and upkeep | `FACILITY_TYPES` |
| `Sparkline` | Standing | Twelve-week direction per reputation category | `repLog` via `lib/ui/standing.ts` |

Every one carries a plain-language summary sentence that says the same thing as
the picture, so the meaning survives a screen reader, a monochrome display and a
narrow phone.

---

## 4. Department identity — `lib/ui/departments.ts`

Twelve departments, each with an icon, an accent from the existing wayfinding
palette (`DEPARTMENT_COLOUR`), a one-line purpose, and a set of derived facts:
case types, gating equipment, severity ceiling, capacity per case, upkeep.

Only the icon and the purpose are authored. Everything else is computed from
`CONDITIONS` and `SPECIALTIES` — the same tables the resolver reads — so a card
cannot drift from the week.

None of the twelve accents collides with a semantic colour (alarm `#EF6461`,
caution `#F59E55`, good `#43C78B`), which is asserted by a test.

---

## 5. What is deliberately not here

- **No raster artwork for the explanatory layer.** The funnel, the capacity
  pipeline, the waterfall and the ladder are diagrams because they carry
  numbers. Photography sits behind purchases, where the subject is a thing
  rather than a mechanism.
- **No portraits for procedurally generated staff.** There are hundreds of
  possible names against eighteen portraits, so handing any of them a face
  would put a named colleague's photograph on a stranger. They keep the
  deterministic initials — see §0.5.
- **No charts beyond the sparkline.** Everything else is proportional bars,
  which reflow and stay legible at 375px.
- **No patient identities.** The simulation models conditions and counts, not
  people. There is nobody to name, so nothing here could be mistaken for a real
  record.

## 6. Gaps worth filling later

1. **Setback artwork** — the four setbacks (signed off, suspended, insolvent,
   disgraced) are the most dramatic beats in a run and have no visual at all.
2. **Milestones beyond the hospital** — only one milestone has an image.
3. **Solicitor environments** — the career has a cover image and nothing else.
   The Chef's pack (section 1a) is the template: fourteen images, each tied to
   a state the simulation already tracks.
4. **A second outbreak image** — one response photograph serves every pathogen.
5. **Staff roles** — seven roles on the hire screen are still icon-only. They
   are the last purchase in the game rendered without a picture, and unlike
   named individuals a *role* can be depicted without inventing a person.
