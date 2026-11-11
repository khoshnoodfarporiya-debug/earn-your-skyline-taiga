import type { City, CityId, MedicalState, SpecialtyId } from "./types";
import { CITY_POSITIONS } from "@/lib/ui/worldmap.generated";

/**
 * CITIES
 *
 * A city is not a skin on the same market. Each one changes four things at
 * once, and they pull against each other:
 *
 *   - `population` caps how large a panel you can ever hold there
 *   - `feeIndex` is what the work bills for
 *   - `costIndex` / `propertyIndex` are what it costs to be there at all
 *   - `bias` reshapes the case mix, so the departments worth opening differ
 *
 * New York bills at 2.1x and costs 1.7x to run: brilliant once you can fill
 * it, ruinous before. Lagos bills at 0.4x against fifteen million people:
 * margin per case is terrible and the ceiling is enormous. Tokyo's ageing
 * population wants oncology and cardiology, not paediatrics.
 *
 * `competition` is the share of the market already spoken for, and it is the
 * one thing reputation can beat — a well-regarded practice takes patients
 * from incumbents.
 */

export const CITIES: City[] = [
  {
    id: "lyon",
    name: "Lyon",
    country: "France",
    blurb:
      "Where you trained and where your licence already works. Modest, affordable, and entirely yours.",
    population: 2.3,
    entryCost: 0,
    feeIndex: 1.0,
    costIndex: 1.0,
    propertyIndex: 1.0,
    competition: 0.12,
    bias: {},
    map: CITY_POSITIONS.lyon,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "madrid",
    name: "Madrid",
    country: "Spain",
    blurb: "Young, growing, and cheap to operate in. The easiest first move.",
    population: 6.7,
    entryCost: 24_000,
    feeIndex: 1.0,
    costIndex: 0.95,
    propertyIndex: 1.0,
    competition: 0.2,
    bias: { maternity: 1.25, paediatrics: 1.2 },
    map: CITY_POSITIONS.madrid,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "milan",
    name: "Milan",
    country: "Italy",
    blurb:
      "An older population with money. Hearts and tumours, not vaccinations.",
    population: 3.2,
    entryCost: 28_000,
    feeIndex: 1.1,
    costIndex: 1.05,
    propertyIndex: 1.2,
    competition: 0.24,
    bias: { cardiology: 1.35, oncology: 1.3, paediatrics: 0.75 },
    map: CITY_POSITIONS.milan,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "berlin",
    name: "Berlin",
    country: "Germany",
    blurb: "Well-run, well-insured, and unglamorously profitable.",
    population: 3.7,
    entryCost: 32_000,
    feeIndex: 1.15,
    costIndex: 1.15,
    propertyIndex: 1.15,
    competition: 0.26,
    bias: { orthopaedics: 1.25, neurology: 1.2 },
    map: CITY_POSITIONS.berlin,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "amsterdam",
    name: "Amsterdam",
    country: "Netherlands",
    blurb:
      "Small city, large wallets. Not enough people to build an empire on.",
    population: 1.2,
    entryCost: 34_000,
    feeIndex: 1.32,
    costIndex: 1.25,
    propertyIndex: 1.5,
    competition: 0.18,
    bias: { psychiatry: 1.35, dermatology: 1.2 },
    map: CITY_POSITIONS.amsterdam,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "paris",
    name: "Paris",
    country: "France",
    blurb:
      "Eleven million people and every one of them already has a doctor. Winning share here takes a reputation.",
    population: 11,
    entryCost: 34_000,
    feeIndex: 1.25,
    costIndex: 1.35,
    propertyIndex: 1.6,
    competition: 0.36,
    bias: { psychiatry: 1.3, emergency: 1.2, dermatology: 1.2 },
    map: CITY_POSITIONS.paris,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    blurb:
      "Expensive in every direction and the fees follow. The prestige address.",
    population: 9.5,
    entryCost: 44_000,
    feeIndex: 1.38,
    costIndex: 1.5,
    propertyIndex: 1.9,
    competition: 0.4,
    bias: { emergency: 1.3, psychiatry: 1.25, cardiology: 1.15 },
    map: CITY_POSITIONS.london,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "dubai",
    name: "Dubai",
    country: "United Arab Emirates",
    blurb:
      "Private-pay medicine at private-pay prices. Elective work, cosmetic work, and very little of it urgent.",
    population: 3.6,
    entryCost: 50_000,
    feeIndex: 1.72,
    costIndex: 1.2,
    propertyIndex: 1.45,
    competition: 0.3,
    bias: { dermatology: 1.55, surgery: 1.3, emergency: 0.7 },
    map: CITY_POSITIONS.dubai,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "singapore",
    name: "Singapore",
    country: "Singapore",
    blurb:
      "A regional referral hub. Complex cases arrive from four countries away.",
    population: 5.9,
    entryCost: 52_000,
    feeIndex: 1.6,
    costIndex: 1.4,
    propertyIndex: 1.85,
    competition: 0.34,
    bias: { oncology: 1.35, cardiology: 1.25, surgery: 1.2 },
    map: CITY_POSITIONS.singapore,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    blurb:
      "The oldest population you will ever treat, and fourteen million of them.",
    population: 14,
    entryCost: 48_000,
    feeIndex: 1.2,
    costIndex: 1.3,
    propertyIndex: 1.7,
    competition: 0.44,
    bias: {
      oncology: 1.4,
      cardiology: 1.3,
      neurology: 1.35,
      paediatrics: 0.6,
      maternity: 0.6,
    },
    map: CITY_POSITIONS.tokyo,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "newyork",
    name: "New York",
    country: "United States",
    blurb:
      "Bills more than anywhere on earth and costs almost as much. Get it wrong and it will take the whole business with it.",
    population: 8.3,
    entryCost: 62_000,
    feeIndex: 2.1,
    costIndex: 1.72,
    propertyIndex: 2.05,
    competition: 0.5,
    bias: { emergency: 1.35, psychiatry: 1.3, surgery: 1.25 },
    map: CITY_POSITIONS.newyork,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "saopaulo",
    name: "São Paulo",
    country: "Brazil",
    blurb:
      "Twelve million people, thin margins, and more work than you can ever clear.",
    population: 12,
    entryCost: 22_000,
    feeIndex: 0.6,
    costIndex: 0.55,
    propertyIndex: 0.62,
    competition: 0.3,
    bias: { maternity: 1.3, emergency: 1.25, paediatrics: 1.2 },
    map: CITY_POSITIONS.saopaulo,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "mumbai",
    name: "Mumbai",
    country: "India",
    blurb:
      "Twenty-one million people. The fee per case is derisory and the ceiling is effectively unlimited.",
    population: 21,
    entryCost: 18_000,
    feeIndex: 0.45,
    costIndex: 0.4,
    propertyIndex: 0.5,
    competition: 0.28,
    bias: { paediatrics: 1.4, emergency: 1.3, maternity: 1.35 },
    map: CITY_POSITIONS.mumbai,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
  {
    id: "lagos",
    name: "Lagos",
    country: "Nigeria",
    blurb:
      "The fastest-growing city here and the least served. Volume medicine at the sharp end.",
    population: 15,
    entryCost: 15_000,
    feeIndex: 0.4,
    costIndex: 0.36,
    propertyIndex: 0.46,
    competition: 0.22,
    bias: { paediatrics: 1.5, maternity: 1.4, emergency: 1.35 },
    map: CITY_POSITIONS.lagos,
    label: { dx: 0, dy: 3.4, anchor: "middle" },
  },
];

export const CITY_BY_ID = new Map(CITIES.map((c) => [c.id, c]));

export const cityOf = (id: CityId) => CITY_BY_ID.get(id) ?? CITIES[0];

export const HOME_CITY: CityId = "lyon";

/** Cities you hold a licence to practise in. */
export const isOpen = (m: MedicalState, id: CityId) =>
  m.cities.includes(id);

/** Case-mix weight for a condition in a given city. */
export const biasFor = (id: CityId, specialty: SpecialtyId) =>
  cityOf(id).bias[specialty] ?? 1;

/**
 * The hard ceiling a city's population puts on your panel there. No amount of
 * marketing sells to people who do not exist.
 */
export const populationCeiling = (id: CityId) =>
  cityOf(id).population * 1_300;

/**
 * How much of the market is open to you at all.
 *
 * Incumbents hold the rest, and reputation is the only thing that prises it
 * loose. This is a ceiling on what you could ever reach — NOT a measure of
 * what you hold. A brand-new practice with ninety patients still has most of
 * Lyon "accessible"; it has captured almost none of it. The interface must
 * label this as access, never as share.
 */
export const contestedShare = (id: CityId, reputation: number) => {
  const c = cityOf(id);
  return Math.max(0.25, 1 - c.competition * (1 - reputation / 120));
};

/**
 * The share of a city you have actually taken: patients on your books against
 * everyone the city could ever supply. This is the honest "how big am I here"
 * number, and it starts near zero as it should.
 */
export const capturedShare = (id: CityId, panel: number) => {
  const ceiling = populationCeiling(id);
  if (!(ceiling > 0) || !Number.isFinite(panel)) return 0;
  return Math.min(1, Math.max(0, panel) / ceiling);
};

/** Weighted cost index across everywhere you operate, for the wage bill. */
export function payrollIndex(m: MedicalState): number {
  if (m.facilities.length === 0) return cityOf(m.homeCity).costIndex;
  let weighted = 0;
  let total = 0;
  for (const f of m.facilities) {
    const c = cityOf(f.city);
    weighted += c.costIndex;
    total += 1;
  }
  return total > 0 ? weighted / total : 1;
}
