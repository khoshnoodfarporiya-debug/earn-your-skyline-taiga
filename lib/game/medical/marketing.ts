import type { Campaign, CampaignId, MedicalState } from "./types";

/**
 * MARKETING
 *
 * Every channel raises your catchment — the ceiling the patient panel drifts
 * toward. What makes them different is `coupling`: the share of their reach
 * that is multiplied by how well regarded you actually are.
 *
 * A billboard says what you paid it to say. Social media and a reviews
 * programme say what your patients say, so they amplify whatever you really
 * are. Run them on the back of good outcomes and they are the cheapest growth
 * in the game; run them while failing cases and they will actively shrink
 * your catchment. That asymmetry is the point: marketing is a multiplier on
 * substance, not a substitute for it.
 */

export const CAMPAIGNS: Campaign[] = [
  {
    id: "flyers",
    label: "Leaflets & posters",
    blurb: "Pharmacy windows, community boards, the school gate. Unglamorous and it works.",
    setupCost: 800,
    weeklyCost: 220,
    reach: 0.06,
    coupling: 0,
  },
  {
    id: "website",
    label: "Website & search",
    blurb: "Be the practice people find when they search at eleven at night.",
    setupCost: 9_000,
    weeklyCost: 380,
    reach: 0.15,
    coupling: 0.04,
  },
  {
    id: "localPress",
    label: "Local press & radio",
    blurb: "A column in the paper, a slot on the morning show. Trusted by exactly the people you want.",
    setupCost: 2_800,
    weeklyCost: 640,
    reach: 0.11,
    coupling: 0.03,
  },
  {
    id: "reviews",
    label: "Patient reviews programme",
    blurb: "Ask every satisfied patient to say so publicly. Only works if they are.",
    setupCost: 4_200,
    weeklyCost: 420,
    reach: 0.05,
    coupling: 0.22,
  },
  {
    id: "socialMedia",
    label: "Social media",
    blurb:
      "Short health explainers, behind-the-scenes, answers to what people are too embarrassed to ask. Enormous upside, and it broadcasts your failures just as efficiently.",
    setupCost: 6_500,
    weeklyCost: 950,
    reach: 0.08,
    coupling: 0.34,
  },
  {
    id: "referralNetwork",
    label: "Referral network",
    blurb: "Formal arrangements with practices who cannot do what you do.",
    setupCost: 16_000,
    weeklyCost: 1_250,
    reach: 0.21,
    coupling: 0.08,
    minReputation: 55,
  },
  {
    id: "healthCamps",
    label: "Community screening",
    blurb: "Free checks in church halls and shopping centres. Finds disease and makes friends.",
    setupCost: 13_000,
    weeklyCost: 1_900,
    reach: 0.24,
    coupling: 0.05,
  },
  {
    id: "billboards",
    label: "Billboards",
    blurb: "Your name on the ring road. Says nothing, reaches everyone.",
    setupCost: 32_000,
    weeklyCost: 3_400,
    reach: 0.32,
    coupling: 0,
  },
  {
    id: "broadcast",
    label: "Television campaign",
    blurb: "Regional TV. Absurdly expensive, and nothing else moves a catchment like it.",
    setupCost: 80_000,
    weeklyCost: 7_800,
    reach: 0.48,
    coupling: 0.06,
  },
];

export const CAMPAIGN_BY_ID = new Map(CAMPAIGNS.map((c) => [c.id, c]));

/** Multiplier applied to the catchment ceiling. */
export function catchmentMultiplier(
  m: MedicalState,
  reputation: number,
): number {
  const standing = (reputation - 50) / 50; // -1 at zero, +1 at full
  let total = 1;
  for (const id of m.campaigns) {
    const c = CAMPAIGN_BY_ID.get(id);
    if (!c) continue;
    total += c.reach + c.coupling * standing;
  }
  return Math.max(0.4, total);
}

export function marketingSpend(m: MedicalState): number {
  return m.campaigns.reduce(
    (sum, id) => sum + (CAMPAIGN_BY_ID.get(id)?.weeklyCost ?? 0),
    0,
  );
}

/** Per-channel contribution, so the UI can show what is actually working. */
export function campaignEffect(
  c: Campaign,
  reputation: number,
): { total: number; fromReputation: number } {
  const standing = (reputation - 50) / 50;
  const fromReputation = c.coupling * standing;
  return { total: c.reach + fromReputation, fromReputation };
}

export function isRunning(m: MedicalState, id: CampaignId) {
  return m.campaigns.includes(id);
}
