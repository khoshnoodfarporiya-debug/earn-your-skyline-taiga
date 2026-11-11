# Earn Your Skyline

A turn-based management sim where **each career runs on its own rules**, not a
shared economy with a different skin. Inspired by Business Inc. Tycoon
Simulator, built against the opposite principle: there, every player is a
generic owner optimising the same cash loop. Here, what constrains you depends
on who you are.

Seven careers are playable, and they are not the same game with different
nouns — each is built around a different binding constraint:

| Career | What constrains you | State |
| --- | --- | --- |
| **Physician** | Capability — you cannot treat what you have no department for | The most complete career, and the baseline the others are built against |
| **Chef** | Spoilage — stock decays and is served oldest-first | Playable: recipes, a menu, an ingredient pantry, and a service pipeline worked by a brigade of positions |
| **Solicitor** | The case pipeline — nothing pays until it settles, and it might not | Playable: casework, chambers, staff, counsel, retainers and bill factoring |
| **Founder** | Runway — everything is priced in weeks of survival, and raising more time costs ownership | Playable: product, users, pricing, a team, funding rounds and a market that saturates |
| **Politician** | The electoral cycle — support decays continuously and is only banked on polling day | Playable: a ward, a party, issues, canvassing and elections |
| **Architect** | The long commission — payment is staged against milestones you do not control | Playable: competitions, commissions, a studio and a reputation built in years |
| **Engineer** | Defect risk — everything shipped carries latent faults that surface weeks later | Playable: prototypes, certification, contracts and the liability curve |

A run has **no forced ending**. Failure produces setbacks with recovery routes,
never a game-over screen, and retirement is something you choose.

```bash
npm install
npm run dev          # http://localhost:3500
```

---

## The design

One turn is one week. You get six time blocks. Between weeks you buy premises,
open departments, install equipment and hire staff — then commit the week and
watch the caseload resolve.

### The Physician's rule

> **Cases arrive whether or not you can treat them.**

A stroke walks in and either you have a CT scanner, an ICU bed and a
neurologist, or you refer it out and take the reputation hit. Growth is not
"buy the next tier" — it is deciding which medicine you are actually in the
business of practising.

Treating a case needs **three things at once**, and the scarcest one binds:

| | Provided by | Fails as |
| --- | --- | --- |
| **Space** | Facilities | out of physical space |
| **People** | Staff roster | out of clinical hours |
| **Capability** | Departments + equipment + a qualified clinician | no department / no equipment / nobody qualified |

Every week's ledger names which of these actually turned patients away, and
the Caseload tab breaks it down condition by condition. That is the game's
main teaching signal: it tells you what to buy next.

### Delegation is the arc

Your own hours are most of your capacity at week 1 and almost irrelevant by
week 100. Burnout still gates *you* — it blunts your skill and your personal
clinical hours, and at 100 you collapse — but hired clinicians contribute
capacity independent of you. Growing means building an organisation, not
grinding yourself.

### Content

50+ conditions across 12 specialties, from an upper respiratory infection at
$150 to a tumour resection at $17,000. 12 pieces of equipment, 4 facility
tiers, 6 staff roles, and a triage policy that decides who gets seen when more
arrives than you can handle.

### Outbreaks

An outbreak is not an event with a button — it is a condition that sits on a
city for weeks and reshapes the caseload while it runs. Affected specialties
surge (up to 2.6×) whether or not you are equipped for them, and it bleeds
risk and reputation every week.

You cannot pay it away. The three responses are the three things a clinician
actually has:

| | Cost | Effect |
| --- | --- | --- |
| **Contain** | Cheap, immediate | Isolation and screening — blunts the surge and slows it, does not end it |
| **Research** | Money **and your own CPD** | Solves the pathogen permanently, everywhere, and it never returns |
| **Vaccinate** | Expensive, needs a pharmacy | Ends it in that city and wins enormous public standing |

Research spends the same CPD the qualification ladder needs, so an epidemic
competes directly with your own career. Vaccination requires a dispensing
pharmacy, so the response depends on what you built years earlier.

**Doing nothing is a real option** and sometimes correct — a mild outbreak in a
city with spare capacity is a surge of billable work, not a crisis.

Eight pathogens, from a seasonal influenza surge to a novel respiratory virus
and a carbapenem-resistant Klebsiella loose in your own wards (which has no
vaccine at all — you research it or you ride it out).

**Pressure, not a window.** There is no week after which outbreaks stop, and
none before which they cannot start. Each week the simulation rolls against
`outbreakPressure(week, cities)` — a base rate so no week is truly safe, plus
a term for how long the run has gone on, plus a term for how many cities you
operate in. Reach is exposure: a fourteen-city empire in the endgame sits near
the 22% cap, a single Lyon practice in week three sits at 3.3%.

`severityCeiling(week)` gates what the world is allowed to send. Severity 2
before week 16, 3 before 40, 4 before 80, and the novel respiratory virus only
past that. Without the ramp a week-four run could draw a severity-five
pathogen and simply lose, which reads as unfairness rather than difficulty.

Both are pure functions, and the Outbreaks screen shows the player the same
numbers the simulation rolls against — the percentage, the band, and the worst
pathogen currently possible — rather than hiding the curve.

### Cities

You choose which of the fourteen markets your licence works in before week
one, and the rest are open to expand into — Paris, London, New York, Tokyo, Dubai, Singapore,
Mumbai, Lagos and more — and a city is not a skin on the same market. Each
changes four things at once, pulling against each other:

| | Effect |
| --- | --- |
| `population` | Hard-caps the panel you can ever hold there |
| `feeIndex` | What the work bills for |
| `costIndex` / `propertyIndex` | What it costs to be there at all |
| `bias` | Reshapes the case mix, so different departments pay off |

New York bills at 2.10× and costs 1.72× to run: superb once filled, ruinous
before. Lagos bills at 0.40× against fifteen million people — terrible margin,
enormous ceiling. Tokyo's ageing population sends tumours and strokes, not
vaccinations, so the departments worth opening there are different.

`competition` is the share incumbents already hold, and reputation is the one
thing that prises it loose. Your **own clinical hours only count where you
are**, so a second site has to be staffed rather than visited — but staff
spread across the network in proportion to the space each city has.

Because population is a hard cap, a single mid-size city eventually walls you
in no matter how much you hire. Expanding is not optional flavour; it is how
the late game exists at all.

---

## Where the run begins

Every career now asks a second question before week one: **which city**. It is
one choice, made once, and there is no moving afterwards — a licence, a
kitchen and a set of chambers are all things you are in rather than things you
carry.

It is not a difficulty slider. A city moves several numbers at once and they
pull against each other, so the best one depends on how you intend to play:

| | The Chef | The Solicitor | The Physician |
| --- | --- | --- | --- |
| **Money in** | spend per head | what an instruction bills | the fee index |
| **Money out** | rent, produce, wages | chambers, salaries | costs, property, wages |
| **Who turns up** | how many want a table | how often work comes in | population and competition |
| **The signature axis** | **shelf life** — Milan gains a week, New York and Mumbai lose one | **reach** — a quiet market never sends the group claim, however good you get | **case mix** — Tokyo sends tumours, Madrid sends babies |

Seven cities for the Chef, six for the Solicitor, all fourteen markets for the
Physician. The card for each states what it changes, and those lines are
generated from the same tables the simulation reads — a city cannot advertise
a rate it does not have.

### Everything is in local money

The rule that makes this work, and it was learned the hard way: **if any part
of a run is denominated locally, all of it must be.** The first pass scaled
rent, produce and takings but left wages, equipment, event costs and the
insolvency threshold at their Lyon values, so a kitchen in Mumbai took 45% of
Lyon's money at the till and paid 100% of Lyon's wages at the pass. The
simulation was insolvent for 119 weeks out of 120 there and it was arithmetic,
not difficulty.

So the opening loan and float, wages and hiring, equipment and its upkeep,
premises, one-off sums in events, the insolvency line and **the target itself**
all scale with the city. What is left is the trade — and the trade is the
point.

### Scaling with *what*, though — the second half of the lesson

Making everything local was necessary and not sufficient. The follow-up
question is which local number each thing scales with, and getting it wrong
cost the expensive cities tens of thousands a run in arithmetic rather than in
difficulty.

There are two indices, and the split is the whole of it:

| | scales with | because |
| --- | --- | --- |
| Rent | the city's own rent | the city's premium, and the dial the cities differ on |
| Wages, hiring | **what a cover is worth** | a wage is a cost of producing revenue, exactly as produce is |
| Equipment, the lease, the fit-out loan, upkeep | **the blend of the two** | a thing you buy is priced off the local cost base |

Wages used to sit on the blend, on the reasoning that a cook is not paid in
menu prices. True of the world, wrong for this model: it left London labour
costing 19% more *relative to takings* than Lyon's, on top of a lease that was
being charged the city's property premium twice — once as capital when you took
the room, and again as rent every week you held it.

Compounded up a four-rung ladder the result was a kitchen that could not grow.
`npm run cities` showed it plainly: a competent London or New York operator was
**still on the market stall after a hundred and twenty weeks**, and finished
tens of thousands worse than the same operator in Lyon for no reason anybody
had chosen. Putting labour on takings and capital on the blend moved New York
from −$88,572 to −$48,062 and London from −$69,669 to −$53,487, while Lyon and
Milan did not move at all — which is what a fix to an asymmetry should look
like.

The residual is deliberate. New York and Mumbai are still the hardest places to
run a kitchen, because a lorry and a hot climate are what those cards promise.

Lyon (Chef, Physician) and London (Solicitor) are neutral on every axis. That
is deliberate: they are where every run before this feature started, so a save
written then reads as its career's default and plays exactly as it did, and
every published figure below is still measured against the same conditions
that produced it.

### Does every city play?

```bash
npm run cities            # both new careers, every city, one control bot
npm run balance -- 40 --city=lagos    # the Physician's whole table, elsewhere
```

`scripts/cities.ts` plays one deliberately unclever bot — identical rules in
every city — and reports what happened. It is a control, not a player: it
exists to catch a city where an ordinary approach is insolvent for the whole
run, not to prove the cities are equal, which they are not meant to be.

At 24 seeds over 120 weeks, **no city leaves the bot overdrawn** (Chef) and
none of the six legal markets is worse than a firm carrying its work in
progress ought to be. The bot reaches the target in **none** of them, in the
neutral city as well as the hard ones — that is a limitation of the bot, which
never grows past its first room, not a verdict on any market. Treat these as a
solvency check; the Chef's and Solicitor's balance remains first-pass.

### The clinical ladder

Qualifications are not a score — each rung changes what *you* are allowed to
treat, checked at exactly the same gate as "do I employ a consultant for
this". So every rung is a real choice between **becoming** the specialist and
**employing** one.

| | Unlocks |
| --- | --- |
| MRCP (Membership) | Severity 3 yourself in one field; your full skill counts there |
| FRCP (Fellowship) | Severity 4; you *are* the consultant for that field |
| FRCS (Surgery) | Severity 5 — the biggest cases without a surgeon on payroll |
| PhD (Doctorate) | +10 skill on every future recruit |
| Professorship | Staff gain skill every week; +18 on recruits |

Tuition is paid in cash and **CPD points**, earned only by studying — so the
ladder competes with clinic time for your week.

### Marketing

Every channel raises your catchment. What separates them is `coupling` — the
share of reach multiplied by how well regarded you actually are. A billboard
says what you paid it to say; social media and a reviews programme say what
your patients say.

That makes word-of-mouth channels **a multiplier on substance, not a
substitute for it**: run them on good outcomes and they are the cheapest
growth in the game, run them while failing cases and they will actively shrink
your catchment.

### Lifestyle

Houses, cars, a chauffeur, a yacht. These are decisions, not rewards, because:

1. **Most of them destroy net worth**, which is half the win condition. A
   sports car keeps 40% of its price; a yacht is a hole in the balance sheet.
   You buy them for burnout relief and standing, and pay for that in the thing
   you are scored on.
2. **A few are better stores of value than cash** — an art collection
   appreciates. Knowing which is which is the game.

Status attracts better recruits, which is how a penthouse ends up affecting
whether you can treat a stroke. A chauffeur hands you a seventh time block.

### Setbacks

Nothing ends a run except the player choosing to retire. The five conditions
that used to terminate one are now **setbacks**: states you enter, that cost
you a great deal, and that you climb out of through the recovery steps in
`lib/game/setbacks.ts`. Clearing the old win condition is a milestone on the
timeline, not a credits roll.

| Setback | Trigger |
| --- | --- |
| Signed off | Burnout reaches 100 |
| Practising rights suspended | Three malpractice claims upheld |
| Business failure | Cash below −$60,000 |
| Public disgrace | Ethical standing collapses |

---

---

## Phase 1 — the interconnected simulation

Five systems added at once, on purpose: each is only worth having because the
others read it. A reputation category nothing consumes is a scoreboard; an NPC
who forgets is a name; a delayed consequence with nothing to depend on is a
timer.

### Data flow

```
loadRun()  ->  migrateRun()  ->  validateRun()  ->  RunState | null
                                                        |
Game.tsx -- setState --> saveRun()                      |
                                                        v
advanceWeek(career, state, alloc):
  0. takeDue()          consequences armed weeks ago fire FIRST, on their
                        own RNG stream, and may raise a follow-up event
  1. applyAction xN     the planner's blocks, one call per unit
  2. resolveWeek        caseload, payroll, upkeep, the six standing
                        categories, cast arrivals, phone, milestones
  3. history.push
  4. driftPeople        relationships cool if you never speak
  5. rollEvent          a raised follow-up outranks the weighted pool
  6. checkOutcome
```

### 1. The planner

Five new blocks beside the original five, each existing because a category or
a relationship had no way to be moved deliberately:

| | Cap | What it is for |
| --- | --- | --- |
| **See the people who matter** | 2 | Goes to whoever you have neglected longest. +2 staff loyalty |
| **Work the profession** | 2 | +1.6 industry influence — the category that gates chairs and contracts |
| **Look after yourself** | 2 | Builds a *fitness* stock: −0.12/wk burnout per point, decays if you stop |
| **Feed the feed** | 2 | +2.2 public popularity. Not the weekly post — the other six days |
| **Visit another site** | 2 | Lifts the city doing worst, not the biggest. Needs two cities |

Every one is capped. Without caps the dominant line is "six blocks into
whichever number is cheapest this week", which is an exploit rather than a
plan — and `npm run check` asserts the caps rather than trusting them.

Presets are **Career focus / Balanced / Growth / Recovery**, and they respect
`unlocked`: a plan can never assign a block to an action this run has no
stepper for. While burnout is high, any preset with no rest in it is marked.

### 2. Reputation, in six parts

The hard constraint was that `s.r.reputation` is written from about thirty
places and read by panel growth, recruiting, events and the objective.
Replacing it with a derived value would have meant rewriting all of them, and
any one missed would be a silent balance change.

So it is not replaced. **`s.r.reputation` keeps its key, its range and every
existing write, and is now named professional credibility** — which is what
those writes always meant. The other five are new state beside it.

| | Stored as | Moved by | Read by |
| --- | --- | --- | --- |
| Professional credibility | `reputation` *(existing)* | Outcomes, referrals, publications | Panel ceiling, recruiting, events |
| Patient trust | `repPatients` | Share of arrivals turned away | Catchment multiplier |
| Staff loyalty | `repLoyalty` | Rota, pay, firings, whether you take the blame | **Attrition — staff resign below 40** |
| Industry influence | `repInfluence` | Qualifications, publications, networking | Hiring quality, the chair |
| Public popularity | `repPopularity` | Posts, press, content blocks | Reach |
| Ethical standing | `repEthics` | Confidentiality, scrutiny, what it costs you | **Multiplies the overall** |

The derived overall is a stated formula, not a mean: a weighted sum of the
five, scaled by ethics (0.72x at zero, 1.09x at 100). Being trusted is worth a
little; being distrusted costs a lot.

Every movement goes through `applyRep(s, id, delta, why)` and the reason is
stored. The Standing screen reads those reasons back — a bar that moves without
saying why is the failure this system exists to fix.

### 3. People

Ten written characters, not a generated contact list. Three numbers, kept
separate because the interesting positions are the mixed ones — a rival who
respects you and does not like you is a different problem from a friend who
likes you and thinks you are careless.

- **warmth** −100…100 · **trust** 0…100 · **respect** 0…100
- **traits** scale reactions: a *proud* person takes a slight 1.35x harder, a
  *loyal* one 0.7x, a *cynic* was never surprised
- **memory** is a list of facts. Week 12's decision is why someone refuses you
  in week 80
- Neglect cools a relationship and never manufactures hostility: warmth decays
  toward zero after eight weeks of silence, and stops there
- Entry is gated: an investor does not call a one-room practice, so he joins
  the run the week it earns him

`lib/game/people.ts` is career-agnostic; `lib/game/medical/cast.ts` is the
Physician's cast. Chef and Solicitor bring their own people to the same
machinery.

### 4. Event chains

Four storylines with delayed consequences, rather than more one-shot alerts.

| Chain | Opens on | The fuse |
| --- | --- | --- |
| **The registrar** | Staff, week 14+, credibility 40+ | 14 / 9 / **22** weeks |
| **The audit** | Two sites, week 22+ | 11 / 16 weeks |
| **The partnership** | Two cities, Thorne's respect 25+ | 18 / 20 weeks |
| **The chair** | Week 45+, opportunity score 58+, Hallam's respect 45+ | 8 weeks |

A pending consequence is **data, not a closure** — a closure cannot be
serialised, so the effect is a named kind the career resolves. A save carrying
a kind from a build where that storyline existed is dropped harmlessly rather
than crashing on a missing function.

Several re-check the state that armed them and *fizzle* if it changed. The
registrar you covered for only comes back if your ethics never recovered; the
contested audit closes quietly if you cleaned the practice up afterwards. A
threat that fires regardless of whether you fixed the thing is not a
consequence, it is a timer.

The chair is decided by `opportunityScore` plus your mentor's respect — not by
a die. A player who built popularity instead of influence loses it, and should.

Two engine rules keep a storyline readable: a chain gets **one event at a
time** (no two beats of the same story in one week), and follow-ups are
`followUp: true` so they can only ever be pulled by id — the sequel can never
arrive before the original.

### 5. The timeline

Every entry is something that actually happened. `mark` is idempotent per id,
so call sites can be blunt: the moment something is true, mark it, and the
second call does nothing.

A run migrated from an older save **starts with an empty timeline** and fills
from that week forward. Inventing a first promotion the player may never have
had would make the whole feature untrustworthy, so the gap is the honest
answer.

### Save migration, v8 → v9

The old rule was "an unreadable save must be discarded, not salvaged". For a
*corrupt* save that is still right. But a save from an older build is not
corrupt — it is complete and correct for the game that wrote it. The two cases
are now separated:

- **Older but structurally sound** → migrated forward with safe defaults
- **Malformed, or for a career that no longer exists** → still rejected

`loadRun` reads the newest key present, migrates, validates the *result*, then
writes it back at the current key and removes the old one — so the upgrade is
paid once. Migration is additive, idempotent, and never changes a value the
player earned.

The new categories are seeded from signals the old save already carried, so a
well-run practice does not arrive claiming neutral everything:

```
credibility <- s.r.reputation                        (unchanged)
patients    <- 50 + (credibility - 50) x 0.5
influence   <- 20 + (phone trust - 50) x 0.6
popularity  <- 10 + (phone sentiment - 50) x 0.8
ethics      <- 70 - (phone scrutiny x 0.4)
loyalty     <- 50
```

`migrateRun` runs *before* validation, so it is the one place in the codebase
that copes with genuinely unknown input. It reads defensively and returns
neutral values rather than throwing.


## Consumables

Dressings, cannulas, reagents, the drugs you hand over. Every treated case
burns some, priced **per case by severity** ($4 minor → $45 critical) rather
than as a share of revenue.

That choice was made by simulation. A revenue share was tried first and
flattened the strategy space — it taxes whichever line is winning hardest, so
expansion and marketing lost most of their advantage and four separate
strategies converged on the same win rate. Consumables track clinical
*activity*: a dressing costs the same whoever is paying for it.

The decision is not whether to buy, it is whether to tie up cash for a
discount:

| | |
| --- | --- |
| **Auto-order** (default on) | Any shortfall is bought at short notice, full price. Never blocked, worst rate. |
| **Standing order** (4 wks) | 12% cheaper per case |
| **Bulk order** (12 wks) | 20% cheaper |
| **Annual contract** (26 wks) | 28% cheaper |

Turn auto-order off and running dry cuts capacity to 60% for two weeks — the
gamble, and the reason the stock room is worth looking at.

## Communications manager

A non-clinical hire ($5,200, $1,450/wk) that makes the one post you publish
each week land better and hurt less. Deliberately **not** a second post per
week — one meaningful post is the rule that stops Pulse becoming a lever you
pull six times.

- **+35% reach** on everything you publish
- **−40% hazard** — they read it before it goes out
- **−2 scrutiny per week** — they answer the press so the story closes

All three return the no-op value at zero comms staff, so the balance contract
holds for a run that never hires one. They are also listed explicitly in
`computeCapacity`, because the fallback branch there would otherwise count a
new role as a treating clinician.

## The phone

The management screens show what the practice is *doing*. The phone shows how
everyone else reacts to it — a fictional device with a fictional network. It
connects to nothing: every line is authored and selected deterministically
from run state and a seeded stream.

Three apps: **Pulse** (post, and see the feed react), **Messages** (staff,
recruiters, journalists, regulators — some carrying decisions), and **News**
(outbreaks, competitors, regulation, written from your own run).

The handset is 400px wide and had two stacked bars of chrome above any content
— a "Personal device / Close" strip from the dialog and a "WK n / Pulse OS"
strip from the shell. One status bar now carries both, the way a real one
does. The composer is collapsed by default: by mid-run eleven posts are
eligible, and rendered open they filled the entire screen, so the feed — the
thing you open the phone to read — started below the fold. Each app closes
with a quiet end-of-list line, because a one-message inbox otherwise ends in
half a screen of blank navy that reads as a failed load.

### Four audiences, kept separate from reputation

Reputation is clinical standing, earned by treating people well. These are
earned by what you *say*, and they pay out differently:

| | Effect |
| --- | --- |
| **Followers** | Reach. Sizes the reaction to everything you publish. |
| **Trust** | What clinicians think. Better recruits. |
| **Sentiment** | What the public thinks. Wider catchment. |
| **Scrutiny** | How closely you are watched. More malpractice risk. |

**Balance contract:** every coupling returns exactly zero at the starting
values (trust 50, sentiment 50, scrutiny 0), and the phone draws from its own
RNG stream. The engine rolls events from the shared stream *after*
`resolveWeek` returns, so a single extra draw there would shift every event in
the game. A run that never opens the phone therefore plays bit-identically to
one from before it existed — which is what keeps the balance harness
meaningful.

### Posting

One meaningful post per week, enforced in the command layer rather than by a
disabled button. Seventeen authored posts across thirteen categories, each
offered only when the run supports it and each stating its trade before you
publish.

Confidentiality is a real mechanic. The anonymised case study is always
available and always slightly worse than the vivid one; the vivid one carries
a 40% chance a patient recognises herself, and the regulator writes to you
when she does. The same applies to outbreak warnings: accurate ones build
trust and sentiment together, exaggerated ones reach four times as far and
carry a 50% chance of public correction.

Identity is a derived label, not a progression system — *Trusted educator*,
*Celebrity doctor*, *Luxury influencer*, *Controversial disruptor* and so on
are read off the shape of your standing.

### The cast

`lib/game/medical/bots.ts` — twelve named accounts across six roles (peers,
rivals, press, public, authorities, influencers) who post in your feed and
reply to what you publish. Previously the feed carried one random rival line a
week, which read as a screensaver; the accounts now post about what is
actually happening in the run, guarded on real state:

```ts
{
  role: "press",
  when: (c) => c.outbreak !== null,
  body: (c) => `We are hearing ${c.outbreak!.city} clinics are seeing
                ${c.outbreak!.pathogen} presentations well above baseline…`,
}
```

Zero to two posts a week, at most one per role, with ambient chatter as the
fallback so a quiet week is quiet rather than empty. Who replies to your own
posts is your standing: trust decides the warmth of the pool, scrutiny brings
the press and the regulator in, reach decides how many bother at all.

Every line is authored and selected deterministically — **no LLM, no network,
no external service**. The cast draws from the phone's own RNG stream, so the
same seed and the same play produce the same feed, and adding it did not move
a single balance figure.

---

## Interface structure

The game's systems grew faster than its navigation did: nine equally-weighted
tabs, wrapping onto three rows at 375px, with the single most important
control — Commit week — about 1,700px down the page. A new player could not
tell which of the nine mattered, and a returning one had to audit every panel
to find what needed attention.

### Five destinations, not nine tabs

| | Answers |
| --- | --- |
| **Overview** | What do I do this week? |
| **Practice** | What am I able to treat? (Build · Staff · Caseload) |
| **Network** | Where am I, and what is happening out there? (Cities · Outbreaks · Growth) |
| **Career** | What am I qualified to do myself? |
| **Life** | What is all this for? |

### The network map

Network → Cities opens on a live world board. Every market is a marker; the
marker says whether it is unlicensed, licensed-but-empty, or operating;
outbreaks show which city they broke out in and when; and selecting one gives
you that market's figures and its buy controls in place.

The map is **drawn, not photographed**. `lib/ui/worldmap.ts` holds a stylised
world as a couple of dozen SVG polygons — no tile server, no mapping library,
no API key, a few hundred bytes that render at any size. The original artwork
survives only as a 7% luminosity texture behind it, because a picture of a
place cannot tell you where your clinics are.

It is a strategy board, not an atlas. Europe is drawn larger than a true
projection allows, because seven of the fourteen markets are inside it and they
have to stay far enough apart to label and to tap; `cities.ts` carries both the
coordinate and a hand-tuned label offset for each one. Two invariants are
tested rather than eyeballed: every city sits on a landmass (ray-cast against
the real path data), and every pair of markers clears a 40px touch target at
the narrowest board the layout allows.

Below the map, a city navigator lists all fourteen markets and stays
synchronised with it in both directions. On a phone the board keeps its full
width and pans sideways; picking a city from the navigator centres it. That is
also the reliable path for a screen reader, and it means nothing on the map is
ever the only way to reach something.

`networkNodes()` and `networkRoutes()` derive everything from run state alone,
so a marker can never imply premises you have not bought, and routes always
originate from wherever you currently work.

Nothing was removed. The screens that are *consequences* of other decisions —
Caseload, Growth — moved inside the section that causes them rather than
competing with it. A thumb-reachable bar on mobile, a rail in the header on
desktop, identical hierarchy in both.

### Overview

One screen carrying the whole loop, ordered by urgency: vitals → what is on
fire → what to do next → the objective → your week → commit. Supporting detail
(meters, trend, case notes) sits below on mobile and beside on desktop.

- **Status strip** — week, cash against weekly burn, debt and unspent time,
  sticky so it stays true while scrolling.
- **Alerts** are derived, not stored (`lib/ui/alerts.ts`). Each names the
  problem, says why it matters, and links to the exact screen that fixes it.
  Severity carries an icon and a written word as well as a colour.
- **Quick plan** — a row above the allocation board. A full week is six blocks
  across five steppers, 156 times a run, and most of those weeks are a week the
  player has already decided on. So: **Repeat last week**, or one of four named
  plans (See patients / Balanced / Grow / Recover), then adjust with the
  steppers for the weeks that actually differ. Every plan is expressed purely
  in blocks the player could have assigned by hand — nothing here can produce
  an allocation the board could not.
  The remembered plan lives under its own storage key
  (`career-tycoon:lastplan:v1`), deliberately **not** in the save: it is a
  convenience, not a fact about the run, and it would otherwise mean a save
  version bump and a validator change for something that alters nothing in the
  simulation. It is re-clamped to the current budget and the current action
  list on every use, so a stale or hand-edited value cannot inject an action.
  While burnout is high (≥ 68, the same threshold the alert panel uses), any
  plan that assigns no rest is marked — a one-tap button must not be able to
  quietly end a run at burnout 100.
- **Commit bar** — pinned above the nav on mobile, showing remaining blocks and
  whichever forecast figure is currently a warning.
- **Trend** — recent net results as columns above and below a zero rule, so
  "is this improving?" reads as a shape. The engine records each resolved week
  to `RunState.history` once the ledger is complete (after the outlay line is
  added, or the net would be wrong), so the trend is saved with the run.

### Onboarding

Progressive disclosure with no tutorial modal. `lib/ui/guidance.ts` derives a
single next step from where the run actually is — how a week works, then
committing, then capacity, then departments, then delegation, and only later
qualifications and expansion. Each is dismissible and never returns.

### Accessibility

The weekly review is a real dialog: `role="dialog"`, `aria-modal`, labelled by
its heading, focus moved in and trapped, background scroll locked, and focus
returned to `<main>` on close — not to the commit button, which is disabled
the moment the week is committed and so cannot hold focus. Escape closes a
quiet week but deliberately not one carrying an event, because the event is a
decision the run cannot continue without.

Every text/surface pair in the new components clears WCAG AA (5.75–14:1).

---

## Visual direction

A career-tycoon interface, not a hospital admin tool. The earlier pass leaned
on atmosphere — layered navy grounds, top-lit panel edges, borders on
everything, segmented instrument gauges — and the result read as a dense
medical dashboard: every element bordered, every figure the same size, nothing
telling you what mattered.

The current system is flat surfaces and typographic hierarchy. Depth comes
from three surface levels, not from lighting effects.

- **Surfaces** — `void` → `paper` → `card` → `card-high`, borderless. A panel
  is distinguished from its ground by *being lighter*, not by being outlined.
  Rules (`rule`, `rule-soft`) are hairlines between rows, not frames.
- **Type scale** — `.t-page` / `.t-section` / `.t-card` / `.t-body` /
  `.t-label` / `.t-value`, so size carries rank. Saira Condensed for signage,
  Barlow for body, IBM Plex Mono with tabular figures for every number.
- **Accent economy** — mint (`clinical`) means *yours / active / do this*, and
  is spent sparingly. Gold marks a market you can afford but have not entered.
  Everything else is `good` / `caution` / `alarm` / `info`, each with a tint
  for backgrounds.
- **Signature: the department colour system.** Twelve colours, one per
  specialty, applied as a left spine to anything belonging to a department —
  the department card, a staff member, a ward-list row, a qualification, an
  outbreak. Colour always means the same thing, so the caseload reads without
  a legend. It encodes the game's central question: which medicine are you
  actually in?
- **Motion** — panels rise on entry, the week's result slams in like a result
  screen. `prefers-reduced-motion` disables all of it.

Token names were kept across the rewrite, so roughly four hundred call sites
re-skinned from one file rather than being edited individually.

### Shared primitives

Practice, Career, Life, Staff and Supplies are all the same decision wearing
five different costumes: what is it, what does it do, what does it cost, can I
afford it, do I own it. That shape is now one component.

| | |
| --- | --- |
| `Panel` | Section frame — title, right-hand figure, one-line purpose note |
| `StatRow` | Hairline-separated figures under a panel header |
| `ItemCard` | A purchasable: spine, title, blurb, price, chips, details, blocker, actions |
| `Chip` / `ChipRow` | Short tokens — `+34 slots`, `40 CPD`, `$420/wk` |
| `ActionButton` | The one purchase button, in `primary` / `quiet` / `danger` |

Three decisions inside `ItemCard` changed how the screens read:

- **The price is the largest thing in the card.** It is what the player is
  deciding about, and it used to be small grey text sharing a baseline with
  the title.
- **Out of reach is not disabled.** Everything unaffordable rendered at 60%
  opacity, which reads as broken rather than as something to save toward. The
  card stays fully legible, only the action dims, and the gap is stated in
  cash — *"$546,323 short"*. The same applies to an event choice you cannot
  afford, which used to hide the very line explaining what you were losing.
- **A card is an `<article>`, not a `<button>`.** Practice wrapped each card in
  a button, so its accessible name was the title, the blurb and every figure
  read as one label. Now the card is an article a screen reader can move
  between, and the button is named `Buy`.

Every text/background pair clears WCAG AA, focus is visible, and the layout
holds from 375px up with no horizontal overflow.

---

## Architecture

The engine knows nothing about medicine. It hands out time blocks, applies
actions, asks the career to resolve the week, rolls events, and checks for an
outcome. Everything career-specific lives in one `CareerDef`.

```
lib/game/
  types.ts            CareerDef contract — the whole extension surface
  engine.ts           turn resolution, event rolling, command dispatch
  rng.ts              seeded mulberry32 (runs are reproducible)
  careers/doctor.ts   the Physician: resources, actions, weekly maths, events
  medical/
    types.ts          domain model
    data.ts           all content — conditions, specialties, equipment, staff
    sim.ts            capacity, case generation, triage, treatment outcomes
    cities.ts         markets, their economics and their epidemiology
    outbreaks.ts      pathogens, their surges and the three responses
    supplies.ts       consumables, bulk tiers and the stock-out throttle
    social.ts         the four audiences and how they touch gameplay
    posts.ts          the authored Pulse catalogue
    phone.ts          phone state, weekly world generation, storage caps
    progression.ts    the qualification ladder and what it lets you treat
    marketing.ts      campaigns and the catchment multiplier
    lifestyle.ts      homes, cars, perks, and what they cost you
lib/ui/
  navigation.ts       the five-section nav model
  alerts.ts           urgent state derived from the run
  guidance.ts         the next-step onboarding sequence
  visuals.ts          artwork registry: paths, framing, alt text, stage bands,
                      networkNodes() and networkRoutes()
  worldmap.ts         the stylised world as SVG polygons, plus route curves
                      and the on-land test
components/
  Game.tsx            shell only: routing, the week transaction, the header
  nav/                PrimaryNav (mobile bar / desktop rail), SectionNav
  overview/           StatusStrip, AlertStack, NextStep, CommitBar, TrendCard
  phone/              Phone (dialog), PhoneShell, PulseApp, PostComposer,
                      MessagesApp, NewsApp, Avatar
  visuals/            ArtFrame (the shared image+scrim frame), PracticeEvolution,
                      NetworkMap, CityDetail, EventVisual
  medical/            the management screens
public/visuals/       runtime WebP only — this directory ships
art-source/visuals/   PNG masters, ~51MB, never deployed
e2e/                  Playwright specs and engine-written save fixtures
scripts/              balance harness, tracer, command checks, fixture builder
```

`lib/ui/*` is pure and dependency-free, so what counts as urgent and what the
game teaches next can be reasoned about without rendering anything.

Stability measures worth knowing about: the run log is capped at 120 entries
(it is re-serialised to `localStorage` every week), `clampResources` resets any
non-finite value so a single bad divide cannot poison a run permanently, and
the save key is versioned with full field validation on load.

Careers carry structured state on `RunState.data` and expose a `command`
handler, so all purchasing and hiring routes through one audited path
(`runCommand`) that clones state, applies, and clamps. Adding medicine is
adding rows to `data.ts`, not writing code.

---

## Verification

The economy is too interlocking to hand-tune, so it is simulated rather than
guessed.

```bash
npm run typecheck
npm run lint                 # TypeScript, React hooks, Next, a11y, dead code
npm run check                # command contracts, save validation, visual registry
npm run balance              # win rates per strategy, 40 seeds each
npm run cities               # every start city of the Chef and the Solicitor
npm run balance -- 250       # the authoritative pass; 250 seeds, 95% intervals
npm run trace builder 1074   # week-by-week table for one run
npm run fixtures             # regenerate the deterministic browser fixtures
npm run e2e                  # Playwright: 404 tests across mobile 375 and desktop 1440
npm run build
npm audit --omit=dev --audit-level=moderate
```

`npm run e2e` preloads saves written by the real engine (`e2e/fixtures/`,
produced by `npm run fixtures`) rather than clicking through twenty weeks or
exposing debug controls. Regenerate them whenever the save shape changes: a
fixture that no longer validates fails loudly instead of silently testing a
shape the app has moved past.

Balance harness, current results:

Run `npm run balance` for a fast 40-seed pass, or `npm run balance -- 250`
when a difference actually needs to be believed. The figures below are 250
seeds per strategy, with 95% confidence intervals.

| Strategy | Win rate (250 seeds) |
| --- | --- |
| Grind (all clinic, no hiring) | 0% |
| Coast (all rest) | 0% |
| Generalist (capacity only) | 0% |
| **Influencer (standing over substance)** | **0%** |
| Baller (builder + lifestyle) | 39% ±6.0 |
| Builder (follows the caseload) | 44% ±6.2 |
| Marketer (builder + campaigns) | 46% ±6.2 |
| Empire (builder + cities) | 49% ±6.2 |
| Magnate (cities + campaigns) | 51% ±6.2 |
| Epidemiologist (magnate + response) | 65% ±5.9 |
| **Academic (builder + ladder)** | **74% ±5.5** |

**Phase 1 moved these materially, and downward.** The previous table had
Academic at 91% and Epidemiologist at 89% — close enough to guaranteed that
the top of the game was solved. Adding five competing activities, staff who
resign, and patients who notice being turned away compresses the field into a
39–74% band. By the design's own criteria that is healthier, but it is a real
change and not a rounding difference.

The harness itself was updated too, because it had to be: every strategy now
spends its first blocks on `upkeep` — seeing your people when loyalty dips,
exercising when burnout climbs. Without that the bots took all of Phase 1's
penalties and none of its benefits, which measured an out-of-date bot rather
than the design, and cost every line about thirty points.

**Influencer** is in the harness permanently as an exploit check. It leans as
hard as the caps allow on networking, content, relationships and fitness, and
buys nothing clever. It exists to fail: if soft standing were a shortcut, it
would beat the strategies that build a practice, and the reputation system
would be an exploit wearing six labels. **0% at 250 seeds.**

A difference is only claimed below when the two 95% intervals do not overlap.
Everything else is recorded as untested, however suggestive the point estimate
looks.

#### Proven — the intervals do not overlap

- **The degenerate lines never win.** Grind collapses early; Coast and
  Generalist go bankrupt. Generalist is the pointed one: it buys premises and
  hires freely but never opens new departments, which is why the medical layer
  is not decoration.
- **Standing is not a shortcut.** Influencer spends every block the caps allow
  on networking, content, relationships and fitness. 0%. Reputation opens
  doors; it does not treat anybody.
- **The clinical ladder is still the strongest line measured.** Academic 74%
  (68.5–79.5), clear of Magnate 51% (44.8–57.2) and of everything below it.
- **Answering outbreaks is worth having.** Epidemiologist 65% (59.1–70.9)
  against Magnate 51% (44.8–57.2) — the same expansion plan, plus a response,
  and the intervals are clear.

#### Not proven — the intervals overlap

- **The mid-table is a plateau, and it got flatter.** Baller 39, Builder 44,
  Marketer 46, Empire 49 and Magnate 51 all sit inside each other's intervals.
- **Academic over Epidemiologist.** 74% (68.5–79.5) against 65% (59.1–70.9) —
  they now touch, where the previous build separated them.
- **Expansion over marketing — RETRACTED.** The last phase claimed Empire
  (71%) beat Marketer (54%) with non-overlapping intervals. After Phase 1 it
  is Empire 49% (42.8–55.2) against Marketer 46% (39.8–52.2), which overlap
  substantially. That claim no longer holds and is withdrawn rather than
  quietly dropped.

Treat the mid-table as flat until a strategy is written that separates from
it. The harness always takes the *first* option on events, so every figure is
a floor, not a ceiling — and Phase 1's chains make that floor more pessimistic
than before, since the first option is often the expensive or effortful one.

### Bugs these caught

Worth recording, because none were visible from reading the code:

- **Demand oscillated violently.** Panel growth compounded off its own size,
  so a good reputation grew the panel far past any possible capacity, the
  resulting referrals destroyed that reputation, and the panel collapsed —
  repeatedly. Demand now approaches a ceiling set by your premises and
  standing instead of compounding.
- **General practice was unplayable.** Nearly every GP condition was gated
  behind a lab or ECG, so a starting doctor could treat two of seven and bled
  cash from week 1. A GP now diagnoses most of it clinically.
- **The ledger blamed the wrong thing.** It reported "out of clinical hours"
  whenever anyone was turned away, including when the real gap was a missing
  department — sending the player to hire staff who would have had nothing to
  do. It now names the dominant blocker.
- **Rapid clicks were lost.** The allocation control rebuilt state from a prop
  captured at render, so several quick clicks collapsed into one and a click
  on a *different* action discarded everything before it. Now a guarded
  functional update that also enforces the time budget.
- **A whole system was silently disabled.** The marketing strategy required
  1.6× capacity headroom before buying a campaign — a bar that was never met
  once in 126 weeks, so the branch never ran and the results were identical to
  the baseline *to the dollar*. Matching numbers are a symptom worth chasing.
- **Old saves crashed the game.** Adding qualifications, campaigns and
  lifestyle changed the shape of `RunState.data`; a save from the previous
  build loaded into a UI expecting arrays that were not there. The save key is
  versioned and `loadRun` now validates every expected field.
- **Outreach ignored the population cap.** A city's panel could be pushed past
  the number of people who live there, so one mid-size city grew without limit
  and expanding never paid. Lyon was sitting at 3,569 against a ceiling of
  2,070.
- **Expanding reliably bankrupted you.** A new market's upkeep starts on day
  one while its panel takes twenty weeks to fill. Opening now seeds a panel
  scaled by reputation — a practice with a name arrives with patients waiting.
- **The expansion bot settled for the cheapest market.** Filtering candidate
  cities by affordability *before* ranking them meant it always took Mumbai or
  Lagos and never reached Paris or Tokyo at all. It now picks the best market
  and waits to afford it.
- **A wide table broke the mobile layout.** The city table's `min-w` forced
  its grid column past the viewport, because grid children default to `auto`
  and will not shrink below their content. `min-w-0` on both columns.
- **The bottom bar detached at tablet width.** The shell renders one nav
  instance below `lg` and another above it, but the component's own classes
  still switched at `md` — so between 768 and 1023px the mobile bar went
  `static` and dropped into the page flow. Every internal breakpoint now
  matches the gate the shell renders it behind.
- **Outbreaks stopped mattering after the opening.** Spawning was gated on
  `week > 8` with a flat rate, so a long run's danger did not grow with it.
  Replaced with a pressure curve and a severity ceiling — and re-measured,
  because it moved the numbers: Marketer fell 65 → 54, and **Empire (71 ±5.6)
  separated from Marketer (54 ±6.2) for the first time**, so expansion is now
  demonstrably better than marketing rather than merely believed to be.
- **A card was its own button.** Practice wrapped every purchasable in a
  `<button>`, so a screen reader announced the title, the blurb and every
  figure as a single label three sentences long. Found while writing the
  browser test that now asserts a purchase control's name is the verb alone.
- **Patient trust was pinned at zero for entire runs.** Phase 1 penalised
  turning people away at 0.02 per person, but referring work out is the
  *normal* state of this game — cases arrive whether or not you can treat
  them. The threshold fired every week from about week 60 onward, and because
  patient trust multiplies the catchment ceiling it became a permanent tax on
  the whole economy worth about twenty points of win rate. Found by probing a
  run and printing the category each thirty weeks, not by reading the code.
  Now a share-based signal with its neutral point at a third of arrivals.
- **A preview promised an effect that was never implemented.** The exercise
  block advertised "a permanent −X/wk on burnout" and built a `_fitness`
  stock that nothing read. It cost a block and did nothing beyond the one-off
  −5. Caught while hunting the balance drop.
- **`startRun` ignored its own cast gates.** Every person joined at week one,
  including the investor who is supposed to appear once you run two cities,
  making the `appears` predicates decorative. Caught by the test asserting a
  gated person is *absent*.
- **A whole validator branch was passing vacuously.** `startRun` never
  initialised `repLog`, so `validateRun` rejected a fresh save — which meant
  every "malformed input is rejected" assertion was true for the wrong
  reason. The suite now asserts the unmutated save is *accepted* first.
- **A convenience button could end the run.** The first quick-plan pass
  offered "Balanced" and "Grow" unconditionally; at the mid-run fixture's
  burnout of 81 either one is fatal, turning six deliberate clicks into a
  single fatal tap. Restless plans are now marked whenever burnout is high.
  Caught by the browser suite, not by review.

---

## Assets

Two directories, and the distinction matters for deployment size:

| | Contents | Shipped? |
| --- | --- | --- |
| `public/visuals/` | 25 runtime WebP files, ~4MB total | yes |
| `art-source/visuals/` | 26 PNG masters, ~51MB total | **no** |

The masters were moved out of `public/` because Next copies that directory
verbatim into the production output — the PNGs were adding ~51MB to every
deploy while the browser only ever requested the WebP. Both trees keep the
same subfolder layout (`careers/`, `cities/`, `events/`, `milestones/`).

Nothing in the application builds an image path by hand: every path lives in
`lib/ui/visuals.ts`, and `npm run check` asserts that each one resolves on
disk, that no PNG has crept back into `public/`, and that the 26 masters are
still where they belong.

To add artwork: put the master in `art-source/visuals/…`, generate a WebP
beside it in `public/visuals/…`, and add one registry entry.

---

## The Chef's dishes

The Chef shipped with produce and no food: crates of "basic", "market" and
"luxury" bought *covers*, and a cover was an abstraction — nobody ever chose a
dish. Recipes, a menu and a pantry of named ingredients are the layer where
that choice lives.

### It sits on top of the crates, not instead of them

The load-bearing decision in the whole feature. A crate is still the staple —
the stock, the trimmings, the things a kitchen buys by the box and does not
write down — and it still meters covers, ages, feeds plate quality through
freshness and grade, and writes off what it loses. **Every figure this career
was balanced against is that system, and it is untouched.**

A recipe is what turns one of those covers into a *dish*: it costs the staple
cover plus its own named ingredients, and in exchange it sets what the cover
sells for and how good it is. A kitchen with no menu plays exactly as it did
before the feature existed — which is what lets an old save carry on without
being quietly re-balanced, and is asserted in `npm run check`.

### The loop

1. **Develop a dish.** Twelve recipes, gated on craft, on the room and on
   standing. Three are what any cook already knows; the rest cost money and a
   week's attention. An original can be given a house name — the catalogue
   keeps its own id and name, so a rename can never orphan the row.
2. **Put it on the menu, and price it.** The price is yours. What the room
   *expects* to pay is the premises' spend per head, in the money of the city.
3. **Order the ingredients it is made of.** Fourteen ingredients across six
   categories, each with a unit, a shelf life, a storage requirement and a
   supplier who decides what it costs and how much life it lands with. Two are
   seasonal and cost 55% more out of season.
4. **Serve.** A cover orders one main and is tempted by the rest in proportion
   to how popular each dish is — so breadth genuinely earns more a head, and
   only if the pantry can carry all of it. Ingredients come out oldest first.
5. **Read it back.** Money → Food cost gives takings, what the crates and the
   pantry cost to put on plates, what was thrown away, the food-cost share and
   every dish's own covers, revenue and margin.

### The trades

| | |
| --- | --- |
| **A broad menu** | reaches more people and earns more a head — and holds more perishable stock for dishes nobody ordered |
| **A short menu** | is a sharper kitchen: consistency rises as the list shrinks |
| **A high price** | earns more per cover and empties tables. Priced above what the room expects, covers fall away |
| **A slow menu** | eats the pass. The same brigade plates fewer covers of a tasting course than of soup |
| **Premium ingredients** | lift the plate and die faster. Truffle is one week of life at $46 a portion |
| **A dish beyond the brigade** | is not refused — it goes out *worse*, which is the outcome a player can learn from |

Every one of those is a real number in `menuFactors`, and every one is printed
on the Menu screen rather than left to be inferred from a bad week.

### Freshness, and the rule the system rests on

Ingredients age **by game week**, never by wall-clock time, so a save closed
for a month opens exactly as it was left. Four states — fresh, fine, use this
week, gone — because "62% fresh" is not a decision and "use it this week" is.

**Nothing spoiled can ever be served.** It is swept before service, at the top
of the week, so it is not in the pantry by the time a plate is called; the
count that decides what can be cooked excludes it; and `consumeForCovers`
skips it even if a caller forgets to sweep. The player can also bin it
deliberately, and both routes cost exactly the same.

Refrigeration is the modifier, as it is for the crates: a cold room adds real
weeks to **chilled** stock, does nothing for a sack of flour, and frozen stock
barely ages at all.

### One source of financial truth

Ingredients are paid for **when the order is placed**, like every other
purchase in this career. Consumption and spoilage therefore move no cash: what
they change is the *stock*, which stops counting towards what the business is
worth the moment it leaves the shelf. The weekly ledger reports both as
information lines carrying the money, and `npm run check` asserts that cash
movement equals the ledger's own arithmetic — the check that caught the first
version charging for every ingredient twice.

---

---

## The service, order by order

Phase 1 asked how much food should be in the building. This asks what happens
on the night: tickets arrive, somebody preps them, somebody cooks them,
somebody plates them, and a table either gets what it ordered while it still
wanted it or does not.

### Why it is a recording, not a timer

There is no `setInterval` anywhere in this feature, and that is a design
decision rather than a shortcut. A service played against a wall clock cannot
be paused, cannot be saved mid-night, cannot be replayed and cannot be tested —
and this game is played a week at a time on a save that has to survive being
closed for a month.

So the night runs as **ticks**, all of them, when the week resolves, on the
run's own seeded stream. Every tick is recorded, and the dashboard renders the
recording: the player steps through the service that happened with a scrubber,
watches the queues build, and sees the moment the pass fell behind. Leaving the
screen, reloading the save and coming back later all show the same night,
because the night is data.

The player's decisions are the **policies** — how the kitchen behaves when the
tickets come — and the hires, the kit and the menu that decide what each
station can move. Staff process the orders; the player decides how.

### The stations

Six queues, each with a throughput built from three things a player controls:
who is standing there, what is installed, and how complicated the menu is.

| | Fed by | Fails as |
| --- | --- | --- |
| **Preparation** | Commis, prep station | Tickets never start |
| **Hot line** | Chef de partie, range, deck oven | Food is not cooked |
| **Pastry** | Pastry chef, pastry section | Puddings jam the mains |
| **The pass** | Sous chef, you | Everything backs up at the end |
| **Wash-up** | Kitchen porter, dishwasher | Nothing clean to plate on |
| **Front of house** | Servers, manager | Food goes cold under the lamp |

The station whose queue grows worst against its capacity is **named** in the
report, with the hire or the purchase that fixes it. "Efficiency low" is not
something a player can act on; "the pass is drowning and a sous chef runs the
pass" is.

**The scale is borrowed, not invented.** Total capacity comes from
`brigadeCovers` — the figure the whole career is balanced against — and the
pipeline only decides *where* it sits. A brigade with no pastry chef has the
same total capacity and a pastry queue that ruins the night.

### The five services are five different nights

Not one calculation with five labels. Each changes how the room arrives, how
long it will wait, and what it is judging:

| | Arrives | Patience | Judged on | Plates a cover |
| --- | --- | --- | --- | --- |
| **Lunch** | Steadily, in a rush | 3 ticks | Speed — a plain plate is forgiven, a wait is not | 1 |
| **Dinner** | Steadily | 5 ticks | The whole thing: wait, plate and room | 1.4 |
| **Private event** | **All at once** | 9 ticks | The contract — everybody eats or it failed | 2 |
| **Catering** | **One batch, no room** | n/a | A complete, on-time delivery | 1 |
| **Tasting menu** | All at once | 12 ticks | The plate, and almost nothing else | **4** |

A tasting menu is four tickets a cover, which is why twelve diners can drown a
kitchen that serves a hundred at dinner. Catering has nobody sitting in your
dining room, so nobody walks out — the deadline is the van. A private event
paid in advance for a stated number of covers, so failing to feed them is a
breach rather than a busy night.

### Policies, with costs

| | Buys | Costs |
| --- | --- | --- |
| Prioritise late tickets | Far fewer walkouts | The line loses its rhythm — more mistakes |
| Simplify the plating | A third more through the pass | Presentation drops on every dish |
| Push the brigade | Every station moves faster | Real fatigue, lower morale, more mistakes |
| Hold the walk-ins | Nobody seated into a queue | Covers you turned away are covers unpaid |
| Comp the worst delays | The table stays, and forgives | You cooked it and it was free |

### The brigade, as positions

Eight roles, and a role now says *where* somebody can stand rather than how
many covers they are worth. Executive chef (you), sous chef, chef de partie,
pastry chef, commis, kitchen porter, restaurant manager and server.

Each person carries skill, salary, morale, loyalty, **fatigue**, **experience**,
**training progress** and one or two **traits** — calm under pressure, fast
learner, perfectionist, creative, reliable, team player, wasteful,
temperamental. Every trait states its modifier on the card: a calm cook halves
their share of the mistakes, a perfectionist is slower and better, a reliable
one tires a third more slowly.

Fatigue is distinct from morale on purpose. Morale is how somebody feels about
working here and moves slowly; fatigue is how much service they have absorbed
and moves every week. A tired cook makes mistakes; an unhappy one leaves. A
week off clears most of a month of nights and costs you the week — they work no
services and learn nothing, and you pay them anyway.

Experience is earned by working, not bought, and a commis who has cooked enough
services can be **promoted** — at which point paying them properly is the only
decision left.

### What lands where

Every night's outcome flows into the systems that already existed: revenue and
ingredient cost into the weekly ledger, satisfaction and walkouts into the
reviews, fatigue and experience onto the people, dishes served onto the recipes
that sold them. Nothing is settled twice, and `npm run check` asserts that cash
moved by exactly what the ledger says.

---

## What the city thinks

The third layer on the Chef: **why** the numbers move. Everything below is
built out of what the restaurant actually did, and every one of it is readable
by the player at the point it happens.

### Reputation, in seven parts

"Reputation 62" answered no useful question. A kitchen whose food is superb and
whose service is chaos, and one that is merely competent at everything, had the
same number — and the player had no way to know which of their problems was
costing them covers.

| | Moved by |
| --- | --- |
| **Food quality** | Plate quality, freshness, who cooked it |
| **Service** | Waits, walkouts, mistakes, covers turned away |
| **Value** | Your prices against the plate and against the city |
| **Atmosphere** | The room, how full it is, how calm the brigade looked |
| **Consistency** | How much plate quality moves from week to week |
| **Hygiene** | Spoilage, waste, inspections, allergy handling |
| **Innovation** | Original dishes, signatures, how long the menu has stood still |

**`s.r.reputation` is unchanged.** That number is written from about twenty
places and read by the forecast, hiring, events, the objective and every
setback check. Replacing it would have meant rewriting all of them and any one
missed would be a silent balance change. So every existing write now goes
through `applyStanding`, which moves the overall by exactly what it always
moved *and* files the move under the part of the restaurant that caused it,
with the sentence the simulation wrote at the moment it decided.

There are two kinds of movement, and the distinction is the whole compatibility
story:

- **`applyStanding` is for news** — a bad night, a critic, a complaint. It
  moves the category and the overall together, by the same amount.
- **`settleStanding` is for facts** — atmosphere is a property of the room you
  bought, value of the prices you set. It moves the category toward what is
  demonstrably true and **never touches the overall**, because pushing
  reputation every week for owning a nice dining room would run it to 100
  inside a season.

There is no random drift term anywhere in either. If a bar moves, the screen
can say what moved it.

### Who is in the room

Eight segments, and what separates them is *which of the seven they weigh*.

| | Wants most | Pays | Patience |
| --- | --- | --- | --- |
| Budget diners | Value (55%) | 72% | short |
| Local regulars | Consistency (34%) | 95% | long |
| Business customers | Service (36%) | 130% | very short |
| Tourists | Atmosphere (34%) | 110% | fair |
| Families | Value (34%) | 85% | shortest |
| Food enthusiasts | Food (42%) | 125% | longest |
| Luxury diners | Food (30%), room (28%) | 195% | fair |
| Event clients | Service (34%) | 140% | longest |

The mix decides how many people want a table, what they spend per head, how
long they will wait before walking, and **who writes the reviews and about
what**. It is per city and per season: Mumbai is twice as price-sensitive as
Paris, summer nearly doubles the tourist share and empties the regulars', and
winter is when the event bookings come.

Both the demand and the spend figures are expressed **against the ordinary
restaurant in that city and season**, and that is not a stylistic choice.
`city.spend` already says Mumbai eats cheaply; if the mix also reported a low
spend there — because Mumbai's mix is mostly budget diners, which it is — the
city's poverty would be charged twice. It was, when this was first written, and
`npm run cities` found it: a competently run Mumbai kitchen was overdrawn for
91 weeks in 120. The same correction applies to appeal, which is measured
relative to your own reputation rather than absolutely, because the forecast
has priced general attractiveness since this career shipped.

### Reviews

Concise, fictional, and assembled entirely from facts the service produced: the
dish that table ordered, how many ticks it waited, whether a plate went back,
what it cost, and which categories the segment writing it cares about.

Nothing appears in a review that did not happen. A complaint about the wait is
only written when the wait exceeded what that segment bears; a compliment names
a dish that was actually sent out. `recurringProblems` counts the tags across
recent reviews and answers the question the player is really asking — not "what
did somebody say" but "what do I keep getting wrong" — and names the control
that fixes each one.

### The phone, earning its place

The handset had followers and a sentiment score and neither did anything. Now:

- **`interest`** — people who want a table because of something you said.
  Decays weekly. This is the upside, and it is real money.
- **`expectation`** — how good a night now has to be to count as good. Raised
  by every promise and every review, and subtracted from what the room thinks
  of an ordinary night. This is the price, and it is paid later.
- **`reach`** — posting three weeks running reaches about half as many people.
  Not a punishment; an audience that hears from you weekly stops looking.

Promoting a dish raises its share of the room's orders for three weeks, which
is a mechanical statement rather than a claim on a card. A player who promotes
hard and cooks well is rewarded twice. One who promotes hard and cooks
adequately ends up with a full room of people who were told to expect better.

### Complaints, and six ways to answer one

When a customer post gains attention it becomes a complaint that sits open,
spreading while you think about it. Six answers — apologise, compensate,
investigate, explain, ignore, defend — and **no universally correct one**. The
outcome depends on whether the complaint is accurate, which answer was chosen,
your standing, whether anybody in the building can find out what happened, how
long you took, and how many times you have answered the same thing before.

Whether it is true is *not* printed on the card. The service dashboard for that
week says exactly what the waits and the mistakes were; reading it is the skill.
`npm run check` asserts that at least three different answers win outright in
different situations.

### Critics

Five, and none of them tells you what they want.

| | Weighs | Also checks |
| --- | --- | --- |
| **Pascale Arnaud**, *La Table* | Food, consistency | Whether two nights a fortnight apart were the same night |
| **Ines Gallo**, *Course* | Innovation, food | Whether one dish on the menu is original |
| **Tom Rowntree**, *The Weekly Table* | Value, food | Your prices against what the room is |
| **Margit Halász**, *Front of House* | Service, atmosphere | Consistency across two visits |
| **Ola Fenn**, *Ground Up* | Hygiene, food, innovation | How much of your larder is out of season |

You get a window and partial clues, drawn from that critic's real weights, and
never a date. A verdict moves the categories that critic weighs, raises
expectations, and can produce an award — which is a record and a burden, never
an ending. Nothing in this phase can terminate a run.

### The other kitchens

Three per city, named, and no more: two hundred invisible restaurants produce a
number you cannot argue with, three named ones produce a decision. Each has a
concept, a price level, a strength, a weakness, the segments it is built for
and a current strategy — and pressure is computed **per segment**, so the cheap
neighbourhood room takes your families and cannot touch your luxury table.

Strategies are reactive, hold for at least four weeks, and are announced when
they change: being beaten on their own strength sends a rival to compete on
price, a signature dish of yours gets copied, a brigade with collapsing morale
gets raided, and occasionally somebody suggests working together.

### Twelve things that happen to restaurants

Supplier shortage · equipment breakdown · a surprise large booking · staff
illness · a hygiene inspection · the city food festival · a seasonal window ·
an influencer's request · a celebrity reservation · a power cut · an allergy
incident · a rival's promotion.

Every one is attached to a system already being run — the shortage moves the
supplier account, the breakdown removes a piece of equipment from the list it
was bought from, the inspection reads the actual state of the pantry, the
festival only happens in autumn. Each states what is true now, offers two or
more choices with the cost on the card, and several schedule a **delayed
consequence** that arrives weeks later.

Their cash costs scale with the room as well as the city: a market stall does
not pay a flagship's price for a generator. Without that, every one of them was
a flat Lyon-sized bill landing on a Mumbai market stall, and the city harness
showed what that does.

### Save compatibility

Ten new fields on the kitchen, all optional, all validated when present and all
bounded. Absent is the correct reading of every save written before this phase:
no breakdown, no reviews, no rivals, and a reputation that is exactly the
single number it always was. A save with no `standing` reads as a kitchen whose
seven parts all agree with its reputation, which is the only honest thing to
say about a run that was never measured in parts.

Reloading cannot duplicate anything: the week is resolved once on commit, the
pending queue hands each consequence over exactly once, and `npm run check`
asserts that a serialise-parse-migrate-validate round trip leaves the review
count, the verdict count and the reputation unchanged.

---

## The craft, and the top of the trade

The fourth layer on the Chef, and the first that is about **the person rather
than the restaurant**. It has its own destination in the bar — "You" — for the
same reason the Physician's Career section exists: a player deciding whether to
spend a week learning to fillet fish is not thinking about their larder.

### Fourteen techniques, five disciplines

Skill used to be one number that went up when you spent a week on it. That is a
progress bar, not a craft: it answered "how good are you" and never "good at
what", so a chef who had spent three years on pastry and one who had spent them
on butchery were the same person.

| | Techniques | What the discipline does |
| --- | --- | --- |
| **Butchery** | Breaking down a carcass · Filleting · Dry-ageing | Recovers waste, opens the langoustine and the aged rib |
| **Sauce** | Stocks · Emulsions · Classical jus | Lifts every sauced dish, cuts mistakes on the hot line |
| **Pastry** | Doughs · Sugarwork · Petits fours | Lifts every pudding, and the last thing anybody eats |
| **Larder** | Curing · Fermentation · Caviar service | Waste, originality, and the ability to serve caviar at all |
| **Modern** | Precision cooking · Plating at the pass | Fewer mistakes everywhere, and the counter's own course |

There is no technique whose effect is "+2 skill". Each one either unlocks a
dish that cannot otherwise be cooked, lets you handle an ingredient that would
otherwise be wasted, lifts every dish in *its own discipline*, or takes real
money off the waste line — and a player who learns butchery can point at the
dishes it opened and the write-off that fell.

Three ways to learn, and all of them cost the week rather than money:

- **Cooking it.** A menu that uses a discipline teaches it, slowly. About
  twenty weeks a technique.
- **A block of practice.** Twenty-two points, and it comes out of *working the
  room* rather than out of a service — the honest cost is the hour you would
  have spent being charming at table six.
- **A stage.** A week in somebody else's kitchen: unpaid, exhausting, and the
  fastest thing there is. It clears your services for that week, because you
  are not there to cook them. Five of them, and the three-star kitchen in Tokyo
  does not answer a stall-holder's letter.

### What other chefs think you are

Out of all of it comes `chefRank` — Nobody in particular → A working chef →
Chef-patron → A name other chefs know → One of the serious ones → One of the
best in the country. It is computed from technique, stars, the room you run and
whether the city has a dish it associates with you, and it is **not a
scoreboard**: it decides who will come and work for you, which kitchens will
have you for a stage, and which of the offers below get made at all.

### The cellar

The one thing in a restaurant that gets *better* while it sits there, and that
inversion is why it exists as its own system rather than as another shelf in
the larder. Everything else in this career is about spoilage. Wine is the
opposite trade: money you take off the floor and put in a rack, worth more
every week you leave it and worth nothing at all if you needed it on Tuesday.

Nine wines from house red to grand cru burgundy. Four rules keep it a
restaurant's cellar rather than a wine fund with a kitchen attached:

1. **You need somewhere to put it.** Without the wine store it is a rack behind
   the bar — enough to pour with, nothing you would age.
2. **Bottles are drunk.** Covers open them, oldest-first within each wine, and
   a list that runs out stops earning.
3. **It peaks and then it fades.** Held past its peak a bottle declines, and
   maturity is capped at 2.4× cost. The sale price compresses the markup as the
   bottle appreciates — a £100 bottle worth £240 later does not go on the list
   at £720.
4. **A sommelier sells it.** The role earns its salary here and nowhere else,
   pouring about half again as much and selling from the top of the list.

The cellar counts on the balance sheet at what a *merchant* would pay — the
same 72% `sellWine` pays out — because you cannot realise a wine list at list
prices.

### The guide, and what a star costs

Not another critic. A critic writes a piece and moves on; the guide comes back
every year and can take back what it gave. It measures six things — the
cooking, technique, the personality of the menu, the room and service, the
list, and the kitchen itself — publishes in the same week every year, and gives
no reasons.

A star is three things at once, and the third is the point: a **draw** (people
plan journeys around starred restaurants), a **premium** on every cover, and a
**standard you now have to hold**. Expectations rise permanently while you hold
it, every service is judged against them, and a year of coasting loses it.
Winning is harder than keeping — the thresholds are deliberately asymmetric, so
a restaurant on the boundary does not gain and lose a star every year — and
nobody goes from nothing to two in one edition.

**Three stars is not a win screen.** Nothing in this phase writes `outcome`.
The week after the guide publishes is an ordinary Monday with a harder problem
in it.

### Beyond the kitchen

A pop-up, a consultancy, a masterclass series, the book, the television series.
All five are paid for out of the same thing: **weeks you are not on your own
pass.** A venture takes blocks out of every week it runs — the same blocks that
would have opened a service — and there is a six-week gap before the next
commitment, because a chef who is permanently on contract is not making a
decision.

The book and the series pay royalties afterwards: the only money in this career
that arrives whether or not the doors opened, which is exactly why a chef
writes one. The series is also the single most expensive line in the file — it
raises expectations sixteen points, permanently, and everybody who books
afterwards has seen you on television and expects to be able to tell.

### The luxury tier

- **The destination** — the fifth premises, and deliberately *not* a bigger
  flagship. Forty covers a night at nearly twice the spend: the room at the top
  of this trade is small and expensive, not large.
- **The chef's counter** — eight stools facing the pass, six times the spend
  per cover, and the most exposed service in the game. It has the highest
  review weight and by far the highest walkout cost, because a table that gets
  up and leaves the counter does it in front of everybody else eating there.
- **Porcelain and glassware**, and a **private dining room**.
- **Three luxury ingredients** — live langoustines, dry-aged rib, caviar — each
  gated on a *technique* rather than on money, and each sharing one property
  that makes it a decision: the better it is, the faster it dies.
- **Five luxury dishes**, each behind both a technique and the ordinary craft,
  room and reputation gates.

### What the balance harness found

`npm run cities` now runs **two** bots: the plain kitchen that has always been
the control, and an ambitious one that practises, builds a cellar, hires a
sommelier and takes every offer. The comparison caught three real faults that
were invisible in review:

- **Technique paid four times over.** It lifted the plate, cut the waste and
  opened dishes — and then also multiplied every cover by up to +55%. The
  ambitious bot ended a hundred and twenty weeks three and a half million ahead
  of the plain one. The multiplier is now capped at +18%.
- **The venture fee was an unstable feedback loop.** Tied to the restaurant's
  own takings, it raised the cash, which bought the room, which raised the
  takings, which raised the fee. A thirty per cent change to one number moved a
  run by seven million in both directions. Fees are now flat and localised, with
  no feedback in them at all.
- **A flat repair bill in Mumbai** is two weeks of takings, so the equipment
  breakdown is scaled to the room as well as to the city.

The plain bot's figures are **unchanged** by this phase in every city, which is
the compatibility guarantee: none of it is on the critical path of running a
restaurant.

---

## Status

Playable end to end: career select → weekly allocation → live forecast →
ledger → events with choices → setbacks with recovery routes. Progress saves
to `localStorage`, and a save that fails validation is discarded rather than
repaired.

There is **no win or lose screen**. Reaching the objective marks a milestone
and the run continues; falling apart produces a recoverable setback. The only
thing that ends a run is choosing to retire, which is optional and previewed
before you commit.

### Where each career stands

**Physician — the most complete.** Seventeen screens: premises, departments,
equipment, staff, caseload, supplies, contracts, the fourteen-market network
map, outbreaks, qualifications, standing, people, timeline, phone, money and
lifestyle. This is the career the others are measured against.

**Chef — playable, smaller.** The spoilage model is real and simulated: lots
age, are drawn oldest-first, and what expires is written off as a cost that
also shows up in the reviews. Buying produce, hiring a brigade, taking on
premises and running services all work through the interface, and the run
saves and reloads. It has **twelve screens** against the Physician's seventeen:
Overview, plus one Kitchen destination carrying seven — the room (premises and
equipment), the larder (crates, the pantry and suppliers), the menu (recipes,
prices and margins), the pass (the book, what you can serve, and the last
service report), the brigade, money, and word of mouth (the seven standing
categories, the reviews and any complaint waiting for an answer) — plus a Map
destination carrying two, the base map and the scene (who eats out in this
city, what the season is doing, and the three restaurants competing for the
same tables) — and a fourth destination, "You", carrying the craft (fourteen
techniques, five stages and what the trade thinks you are) and the work beyond
the kitchen (books, television, consultancy and pop-ups).

On top of the crate economy it runs **recipes, a menu and a pantry of named
ingredients** ([The Chef's dishes](#the-chefs-dishes)) and a **service
pipeline** where tickets move through six kitchen sections while the brigade
works them ([The service, order by order](#the-service-order-by-order)). A
kitchen with no menu still plays exactly as it did before either existed.

On top of both it runs **reputation in seven parts, eight customer segments,
generated reviews, an in-game social profile with real trade-offs, complaints
you have to answer, five critics, three rival restaurants per city and twelve
dynamic events** ([What the city thinks](#what-the-city-thinks)), and on top
of *that* a **craft of fourteen techniques, a wine cellar, a guide that awards
and withdraws stars, and the four things every chef is eventually offered**
([The craft, and the top of the trade](#the-craft-and-the-top-of-the-trade)).

**Solicitor — playable, and no longer small.** The case pipeline is real:
instructions arrive, hours accumulate against a deadline, preparation moves
the odds without ever reaching certainty, and every live case carries a
settlement you can take instead. Around it now sit chambers and staff,
instructed counsel, retainers, bill factoring, practice areas, crises and a
phone — four screens plus the handset's apps, up from the two screens it
started with.

**Founder, Politician, Architect, Engineer — playable, with their depth
slices in.** Each runs its own model (a venture, a campaign, a studio, a
workshop), its own events, its own phone and its own briefing — and each now
carries the systems its profession is actually about: the Founder's customer
discovery, roadmap-with-technical-debt, acquisition funnel and experiments;
the Politician's named constituent casework, volunteers, campaign fund and
polling uncertainty; the Architect's client briefs, planning consent, cost
plans and materials with embodied-carbon consequences; the Engineer's
requirements negotiation, architecture decisions, prototypes, lab rigs and
four-discipline bench. Every system is optional in the save (older runs load
untouched and play identically — the engine suite proves it to nine decimal
places), and each career holds TWO balance contracts in `npm run cities`: a
plain bot that ignores the new systems, and an engaged one, printed side by
side so a trap or a free lunch shows on sight. They remain the careers with
the least human playtesting.

### Honest gaps

- **Two Chef catalogue entries are waiting for their masters** — the
  destination dining room and the chef's counter, both named in
  `AWAITING_CHEF_ART` and rendering the typographic fallback until the art
  lands. **The Solicitor has no bespoke artwork** beyond its career cover and
  a shared world map. Fourteen purchase images are also still outstanding —
  they are listed by id in `AWAITING_ART` and briefed in
  [`docs/artwork-shot-list.md`](docs/artwork-shot-list.md), and their cards
  render a typographic fallback until the masters land.
- **Browser coverage is no longer the gap it was**: every career has its own
  Playwright block (the Solicitor alone has over twenty tests across its
  casework, retainers, counsel, people and crises). What remains thin is
  human playtesting — the suites prove the screens work, not that the pacing
  is fun.
- **The shared systems are unevenly adopted.** The Solicitor now has people,
  crises and a handset with its own apps, and the Chef has a phone, its own
  news, reviews and city rivals — but neither has engine-level `timeline` or
  `ambitions`, and no career outside the Physician can expand between cities.
  Their maps show every city the trade is done in, mark the one you chose,
  and say plainly that you cannot move — rather than implying a network that
  does not exist.
- **Time-block cash costs are still global.** Developing a menu is $150 and
  pitching for work is $250 wherever you are, because those are properties of
  the action rather than of the run. They are small enough not to distort a
  week and large enough to be worth fixing when actions learn about the city.
- **Their balance is first-pass.** Tuned against a simple bot over 120-week
  simulations, not playtested by a human.

Not built anywhere: sound, difficulty modes, meta-progression between runs.
