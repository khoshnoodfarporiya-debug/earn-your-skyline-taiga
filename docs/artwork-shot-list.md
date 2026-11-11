# Artwork shot list — 14 pending items

Gameplay for these has shipped; the masters have not. Each one is listed in
`AWAITING_ART` in `lib/ui/purchaseArt.ts`, so the coverage test reports them as
a known gap rather than passing silently. Their cards currently render the
typographic fallback, which is a supported state, not a broken one.

## How to deliver

1. Generate the PNG at **1536×1024** (3:2) — the size every existing purchase
   master uses. Do not pre-crop; `object-position` handles framing per card.
2. Save it to the path in the table below, exactly as named. The `-v1` suffix
   is the revision marker: a later `-v2` automatically supersedes it, and the
   shipped WebP drops the suffix.
3. Run `npm run build:art`. It writes the 720px and 1200px WebPs and measures
   their real dimensions into `lib/ui/purchaseArt.generated.ts`.
4. Tell me, and I'll add the registry entries and delete the ids from
   `AWAITING_ART`. `npm run check` then proves coverage is complete.

The `fleet/` folder already exists and the build script already knows about it.

## Rules that apply to every one of these

- **No text, numerals, watermarks or signage** anywhere in the frame. Nothing
  here may bake a price, a name or a label into pixels.
- **No real badges or marque-identifiable vehicles.** Three cars were already
  re-shot once for this reason — the `-v2` files exist because the first pass
  produced recognisable badging. Silhouettes should read as a *type* of car,
  not a model you could name.
- **No real people's faces**, and no invented medical data on any screen shown.
- Match the existing lighting: naturalistic, slightly cool, mid-afternoon.
  These sit beside the current 33 purchase images and must not look like a
  different game.
- Shoot the **object in its setting**, not on a white studio background.

## The fleet — `art-source/visuals/purchases/fleet/`

Three vehicles. They must read as a progression: bigger, more serious, more
equipment visible. Generic livery only — plain block colours, no crests, no
service names, no lettering of any kind.

| id | Filename | Subject |
| --- | --- | --- |
| `patient_transport` | `fleet-patient-transport-v1.png` | A small white patient-transport van parked outside a low clinic, side door open, a folded wheelchair visible inside. Unhurried, domestic, no blue lights. |
| `emergency_ambulance` | `fleet-emergency-ambulance-v1.png` | A full-size emergency ambulance, rear doors open on a stretcher and monitoring equipment, parked under a canopy at dusk. Lights present but not flashing. |
| `mobile_icu` | `fleet-mobile-icu-v1.png` | A large mobile intensive care unit, interior visible through open rear doors: a ventilator, infusion pumps, an intensive-care bed. Reads as a hospital room on wheels. |

## Vehicles — `art-source/visuals/purchases/lifestyle/`

| id | Filename | Subject |
| --- | --- | --- |
| `estate_car` | `lifestyle-estate-car-v1.png` | A practical estate car on a suburban driveway, tailgate up, dog guard and muddy boots in the back. Deliberately unglamorous. |
| `electric_saloon` | `lifestyle-electric-saloon-v1.png` | A clean-lined electric saloon on a home charger at night, cable connected, soft light from the porch. Calm rather than flashy. |
| `classic_car` | `lifestyle-classic-car-v1.png` | A mid-century classic car in a private garage, bonnet open, tools laid on a cloth. Beautiful and obviously high-maintenance. |
| `supercar` | `lifestyle-supercar-v1.png` | A low, wide two-seat supercar in an underground car park under a single light. Generic wedge silhouette — no identifiable marque. |

## Services and prestige — `art-source/visuals/purchases/lifestyle/`

| id | Filename | Subject |
| --- | --- | --- |
| `concierge` | `lifestyle-concierge-v1.png` | A hotel-style concierge desk in a residential lobby: a bell, a ledger, packages waiting to be collected. No people in frame. |
| `sabbatical_cabin` | `lifestyle-cabin-v1.png` | A small timber cabin in wooded hills, wood burner lit and visible through the window, no other buildings in sight. |
| `racehorse` | `lifestyle-racehorse-v1.png` | A thoroughbred being led across a stable yard at dawn, rug on, breath visible. Expensive and demanding. |
| `helicopter` | `lifestyle-helicopter-v1.png` | A light civilian helicopter on a private pad, rotors still, hills behind. Plain paintwork, no registration lettering. |

## Collectibles — `art-source/visuals/purchases/lifestyle/`

These three appreciate in the model, so they should look like stores of value
rather than toys.

| id | Filename | Subject |
| --- | --- | --- |
| `wine_cellar` | `lifestyle-wine-cellar-v1.png` | A brick-vaulted cellar with racked bottles receding into low warm light. Labels indistinct — no readable text. |
| `rare_books` | `lifestyle-medical-library-v1.png` | A private library of antique leather medical volumes behind glass, an anatomical plate open on a stand. Titles must not be legible. |
| `vineyard` | `lifestyle-vineyard-v1.png` | Ordered rows of vines on a slope in late afternoon, a stone press-house at the end of the rows. |

## When they land

Delete the id from `AWAITING_ART` and add its registry entry beside the others
in `PURCHASE_ART` — group, filename stem, focal point, and alt text describing
the subject in a sentence. `missingArt()` will then fail for anything still
undrawn, which is the guarantee the list is temporarily standing in for.
