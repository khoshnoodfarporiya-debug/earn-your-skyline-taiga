import type { LifestyleItem, MedicalState } from "./types";

/**
 * LIFESTYLE
 *
 * Everything here has to earn its place mechanically, or it is a trophy case
 * bolted onto a management game.
 *
 * Two things make these real decisions rather than rewards:
 *
 *  1. Most of them DESTROY net worth, which is half the win condition. A
 *     sports car keeps 40% of its price; a yacht is a hole in the balance
 *     sheet. You buy them for burnout relief and standing, and you pay for
 *     that in the thing you are being scored on.
 *  2. A few are genuinely better stores of value than cash — art appreciates.
 *     Knowing which is which is the game.
 *
 * Status attracts better recruits, which is how a penthouse ends up affecting
 * whether you can treat a stroke.
 */

export const LIFESTYLE: LifestyleItem[] = [
  // ------------------------------------------------------------------ homes
  {
    id: "townhouse",
    label: "Town house",
    blurb: "Out of the rented flat at last. A door that locks behind you.",
    category: "home",
    cost: 180_000,
    upkeep: 420,
    retention: 0.95,
    restBonus: 2,
    status: 4,
  },
  {
    id: "suburban_house",
    label: "House with a garden",
    blurb: "Quiet street, room to breathe, twenty minutes from the practice.",
    category: "home",
    cost: 430_000,
    upkeep: 900,
    retention: 0.95,
    restBonus: 4,
    status: 10,
  },
  {
    id: "penthouse",
    label: "City penthouse",
    blurb: "Above the noise, and a very short walk to the hospital.",
    category: "home",
    cost: 980_000,
    upkeep: 2_300,
    retention: 0.92,
    restBonus: 6,
    status: 22,
  },
  {
    id: "country_estate",
    label: "Country estate",
    blurb: "Land, silence, and somewhere to put the people you want to impress.",
    category: "home",
    cost: 2_300_000,
    upkeep: 5_200,
    retention: 0.93,
    restBonus: 9,
    status: 38,
  },

  // ------------------------------------------------------------------- cars
  {
    id: "reliable_saloon",
    label: "Reliable saloon",
    blurb: "Starts every morning. That is the entire specification.",
    category: "car",
    cost: 34_000,
    upkeep: 95,
    retention: 0.5,
    status: 2,
  },
  {
    id: "luxury_saloon",
    label: "Luxury saloon",
    blurb: "Quiet, heavy, and it says something in the consultants' car park.",
    category: "car",
    cost: 98_000,
    upkeep: 250,
    retention: 0.45,
    status: 9,
  },
  {
    id: "estate_car",
    label: "Estate car",
    blurb:
      "Room for the dog, the bikes and a week's shopping. Nobody has ever been impressed by one and it has never once let anybody down.",
    category: "car",
    cost: 52_000,
    upkeep: 130,
    retention: 0.52,
    status: 3,
  },
  {
    id: "electric_saloon",
    label: "Electric saloon",
    blurb:
      "Silent, quick, and cheap to run. The only car on this list whose weekly cost is genuinely low.",
    category: "car",
    cost: 71_000,
    upkeep: 70,
    retention: 0.42,
    status: 6,
  },
  {
    id: "sports_car",
    label: "Sports car",
    blurb: "Impractical, loud, and worth substantially less the moment you drive it away.",
    category: "car",
    cost: 265_000,
    upkeep: 620,
    retention: 0.4,
    status: 18,
  },
  {
    id: "classic_car",
    label: "Classic car",
    blurb:
      "Unreliable, uncomfortable, and the only car here that will be worth more in ten years than it is today. It will also spend a fortnight a year with a specialist.",
    category: "car",
    cost: 340_000,
    upkeep: 890,
    /* The one appreciating vehicle, and the reason the car ladder is not
       simply "spend more, lose more". It costs the most to keep. */
    retention: 1.08,
    status: 21,
  },
  {
    id: "supercar",
    label: "Supercar",
    blurb:
      "Two seats, no luggage, and a service bill that reads like a small mortgage. It is the loudest possible way to say the practice is doing well.",
    category: "car",
    cost: 720_000,
    upkeep: 2_100,
    retention: 0.38,
    status: 32,
  },

  // ------------------------------------------------------------------ perks
  {
    id: "gym",
    label: "Gym membership",
    blurb: "The cheapest thing on this page and close to the most effective.",
    category: "perk",
    cost: 3_800,
    upkeep: 180,
    retention: 0,
    burnoutRelief: 1.5,
  },
  {
    id: "housekeeper",
    label: "Housekeeper",
    blurb: "You stop losing Sundays to the things that are not medicine.",
    category: "perk",
    cost: 5_500,
    upkeep: 560,
    retention: 0,
    burnoutRelief: 2,
  },
  {
    id: "trainer",
    label: "Personal trainer",
    blurb: "Someone whose actual job is noticing that you are running yourself down.",
    category: "perk",
    cost: 12_000,
    upkeep: 720,
    retention: 0,
    burnoutRelief: 2.5,
    status: 2,
  },
  {
    id: "private_chef",
    label: "Private chef",
    blurb: "You eat properly for the first time since medical school.",
    category: "perk",
    cost: 21_000,
    upkeep: 1_450,
    retention: 0,
    burnoutRelief: 2.5,
    status: 6,
  },
  {
    id: "chauffeur",
    label: "Chauffeur",
    blurb:
      "Ninety minutes a day you were spending on the ring road, handed back to you as working time.",
    category: "perk",
    cost: 15_000,
    upkeep: 1_750,
    retention: 0,
    timeBlocks: 1,
    status: 7,
  },
  {
    id: "holiday_home",
    label: "Holiday home",
    blurb: "Somewhere that is not here, that you might occasionally go to.",
    category: "perk",
    cost: 490_000,
    upkeep: 1_150,
    retention: 0.95,
    restBonus: 3,
    burnoutRelief: 1,
    status: 13,
  },
  {
    id: "yacht",
    label: "Yacht",
    blurb:
      "A very large boat. It will impress people and it will cost you a fortune to keep floating.",
    category: "perk",
    cost: 1_450_000,
    upkeep: 9_400,
    retention: 0.35,
    status: 27,
  },
  {
    id: "private_jet",
    label: "Private jet",
    blurb:
      "The most expensive way to save four hours. Nobody has ever justified one on the numbers.",
    category: "perk",
    cost: 4_100_000,
    upkeep: 27_000,
    retention: 0.4,
    status: 44,
  },

  {
    id: "concierge",
    label: "Concierge service",
    blurb:
      "Someone else queues, books, chases and waits in. It buys back the evenings you were spending on admin that is not medicine.",
    category: "perk",
    cost: 9_000,
    upkeep: 1_100,
    retention: 0,
    burnoutRelief: 1.5,
    status: 3,
  },
  {
    id: "sabbatical_cabin",
    label: "Cabin in the hills",
    blurb:
      "Two hours away, no signal, and a wood burner. The cheapest thing here that genuinely resets you.",
    category: "perk",
    cost: 185_000,
    upkeep: 460,
    retention: 0.9,
    restBonus: 4,
    status: 5,
  },
  {
    id: "racehorse",
    label: "Racehorse",
    blurb:
      "A share in something fast and expensive. It will introduce you to people who fund hospitals, and it will eat money every single week.",
    category: "perk",
    cost: 620_000,
    upkeep: 4_800,
    retention: 0.3,
    status: 24,
  },
  {
    id: "helicopter",
    label: "Helicopter",
    blurb:
      "Turns the far side of the network into a forty-minute trip. Also the single most conspicuous object a doctor can own.",
    category: "perk",
    cost: 2_400_000,
    upkeep: 16_000,
    retention: 0.42,
    timeBlocks: 1,
    status: 36,
  },

  // ----------------------------------------------------------- collectibles
  {
    id: "watches",
    label: "Watch collection",
    blurb: "Small, portable, and it holds its value better than the car does.",
    category: "collectible",
    cost: 125_000,
    upkeep: 130,
    retention: 1.05,
    status: 6,
  },
  {
    id: "wine_cellar",
    label: "Wine cellar",
    blurb:
      "It appreciates quietly, it impresses the people worth impressing, and you are allowed to drink the mistakes.",
    category: "collectible",
    cost: 78_000,
    upkeep: 210,
    retention: 1.06,
    status: 4,
  },
  {
    id: "art",
    label: "Art collection",
    blurb:
      "The only thing on this page that is worth more each year than the last. Also the least ostentatious.",
    category: "collectible",
    cost: 270_000,
    upkeep: 320,
    retention: 1.18,
    status: 13,
  },
  {
    id: "rare_books",
    label: "Medical library",
    blurb:
      "First editions of the texts the profession was built on. It appreciates, and it is the only thing on this page that your colleagues will actually envy.",
    category: "collectible",
    cost: 210_000,
    upkeep: 240,
    retention: 1.12,
    status: 11,
  },
  {
    id: "vineyard",
    label: "Vineyard",
    blurb:
      "Land that makes something. It holds its value better than anything else here at this price, and it will want your attention every autumn whether you have any to give or not.",
    category: "collectible",
    cost: 1_650_000,
    upkeep: 6_200,
    retention: 1.02,
    status: 31,
  },
];

export const LIFESTYLE_BY_ID = new Map(LIFESTYLE.map((l) => [l.id, l]));

const owned = (m: MedicalState) =>
  m.lifestyle
    .map((id) => LIFESTYLE_BY_ID.get(id))
    .filter((x): x is LifestyleItem => !!x);

export function lifestyleUpkeep(m: MedicalState): number {
  return owned(m).reduce((sum, l) => sum + l.upkeep, 0);
}

/** What lifestyle contributes to net worth — often far less than it cost. */
export function lifestyleValue(m: MedicalState): number {
  return owned(m).reduce((sum, l) => sum + l.cost * l.retention, 0);
}

export function statusOf(m: MedicalState): number {
  return owned(m).reduce((sum, l) => sum + (l.status ?? 0), 0);
}

export function restBonus(m: MedicalState): number {
  return owned(m).reduce((sum, l) => sum + (l.restBonus ?? 0), 0);
}

export function burnoutRelief(m: MedicalState): number {
  return owned(m).reduce((sum, l) => sum + (l.burnoutRelief ?? 0), 0);
}

export function bonusTimeBlocks(m: MedicalState): number {
  return owned(m).reduce((sum, l) => sum + (l.timeBlocks ?? 0), 0);
}

/** Homes and cars replace each other rather than stacking. */
export function supersedes(m: MedicalState, item: LifestyleItem): string[] {
  if (item.category !== "home" && item.category !== "car") return [];
  return owned(m)
    .filter((l) => l.category === item.category)
    .map((l) => l.id);
}
