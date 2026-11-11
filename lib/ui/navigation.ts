/**
 * Navigation model.
 *
 * PHASE 4: ONE INFORMATION ARCHITECTURE, SEVEN VOICES
 *
 * Every career now shares the same five destinations, in the same order,
 * with the same meanings:
 *
 *   Week    — what do I do this week? Plan, constraints, commit, review.
 *   Work    — the profession's own simulation: the practice, the kitchen,
 *             the chambers, the company, the seat, the boards, the bench.
 *   World   — where am I, and what is happening out there? Map, cities,
 *             rivals, opportunities.
 *   Career  — what am I becoming? Progression, standing, people, milestones.
 *   Life    — what is all this for?
 *
 * The voice stays with the career: the destinations carry neutral names, and
 * everything inside them keeps its own vocabulary — a Chef's Work is a larder
 * and a pass, a Solicitor's is instructions and casework. What is stable is
 * the *shape*: a player who has run one career knows where everything is in
 * the next one.
 *
 * Not every career has all five yet. Career and Life exist where there is
 * something real behind them (the Physician has both, the Chef has Career);
 * a destination with nothing behind it would be a tab that lies, so the
 * others simply do not show it until its systems exist. The order never
 * changes — a missing destination is skipped, not reshuffled.
 *
 * Before this, each career named its own bar (Overview / Kitchen / You /
 * Map…). Every screen id below predates the change and is unchanged: saves,
 * lessons, alerts and tests all address screens, and screens did not move
 * ids — only the destinations grouping them were renamed and re-ordered.
 */

export type ScreenId =
  | "overview"
  | "build"
  | "staff"
  | "supplies"
  | "caseload"
  | "contracts"
  | "team"
  | "money"
  | "rivals"
  | "cities"
  | "outbreaks"
  | "growth"
  | "career"
  | "standing"
  | "people"
  | "timeline"
  | "character"
  | "life"
  /* The two screens a career that is not the Physician has of its own. */
  | "operation"
  | "home"
  /* The Chef's own screens. Ids are deliberately distinct from the
     Physician's — `sectionOf` is a single index across every career, so a
     shared id would route a Chef into a medical section. */
  | "kitchen"
  | "larder"
  | "menu"
  | "pass"
  | "brigade"
  | "books"
  /* Phase 3: what the city thinks, and who else is cooking in it. */
  | "reviews"
  | "scene"
  /* Phase 4: the chef rather than the restaurant. */
  | "craft"
  | "beyond"
  /* The Solicitor's own screens, distinct from both other careers' for the
     same reason the Chef's are: `sectionOf` is a single flat index, and a
     shared id routes a solicitor into somebody else's section. `casework` is
     deliberately not the Physician's `caseload`, and `ledger` is deliberately
     not the Chef's `books`. */
  | "instructions"
  | "casework"
  | "ledger"
  | "firm"
  /* The Founder's own screens. `runway` is the career's binding constraint and
     deliberately not the Physician's `money`; `crew` is deliberately not
     `team`, which the Physician already owns. */
  | "runway"
  | "crew"
  | "raising"
  /* Phase 5: the product itself — discovery, the roadmap, experiments. */
  | "product"
  /* The Politician's own screens. `positions` is deliberately not the
     Physician's `standing`, which means something else entirely. */
  | "polling"
  | "blocs"
  | "positions"
  | "office"
  /* Phase 5: named constituents, the ground game and the fund. */
  | "constituents"
  /* The Architect's own screens. `boards` is deliberately not the Physician's
     `build`, and `atelier` is deliberately not the Chef's `kitchen`. */
  | "boards"
  | "offers"
  | "competitions"
  | "atelier"
  /* The Engineer's own two. */
  | "bench"
  | "newbuild";

/**
 * The five stable destinations. Every career's bar is a subsequence of this
 * list, in this order — never a reordering, never an addition.
 */
export type SectionId = "week" | "work" | "world" | "career" | "life";

export interface ScreenDef {
  id: ScreenId;
  label: string;
  /** One line shown under the sub-nav explaining what this screen decides. */
  purpose: string;
}

export interface SectionDef {
  id: SectionId;
  label: string;
  /** Icon key resolved by NavIcon. */
  icon: string;
  screens: ScreenDef[];
}

/** The Week destination is identical for every career, so it is written once.
    The screen keeps its historical id — `overview` is what saves, lessons and
    a hundred tests address. */
const WEEK: SectionDef = {
  id: "week",
  label: "Week",
  icon: "pulse",
  screens: [
    {
      id: "overview",
      label: "Week",
      purpose: "Your week, and everything that needs a decision.",
    },
  ],
};

/** The World destination for a career whose world is one map. */
const WORLD_MAP_ONLY: SectionDef = {
  id: "world",
  label: "World",
  icon: "globe",
  screens: [
    {
      id: "home",
      label: "Map",
      purpose: "Where you work, and how far that currently reaches.",
    },
  ],
};

/**
 * THE PHYSICIAN
 *
 * The oldest career and the largest section set — and, since Phase 4, no
 * longer a different shape: what was Overview / Practice / Network / Career /
 * Life is now Week / Work / World / Career / Life, the same frame every other
 * career uses. Nothing behind the destinations moved.
 */
export const SECTIONS: SectionDef[] = [
  WEEK,
  {
    id: "work",
    label: "Work",
    icon: "building",
    screens: [
      {
        id: "build",
        label: "Build",
        purpose: "Premises, departments and equipment — what you are able to treat.",
      },
      {
        id: "staff",
        label: "Staff",
        purpose: "Who does the work, and what they cost you every week.",
      },
      {
        id: "supplies",
        label: "Supplies",
        purpose:
          "Consumables the clinic burns through. Buy ahead for a discount, or pay spot forever.",
      },
      {
        id: "caseload",
        label: "Caseload",
        purpose: "Who arrived last week, who you treated, and who you turned away.",
      },
      {
        id: "contracts",
        label: "Assignments",
        purpose: "Assignments on offer, what you are carrying, and how it is going.",
      },
      {
        id: "team",
        label: "Team",
        purpose: "Who works here, how they are doing, and what this place is like.",
      },
      {
        id: "money",
        label: "Money",
        purpose: "What you owe, what you gave away, and what is still on offer.",
      },
    ],
  },
  {
    id: "world",
    label: "World",
    icon: "globe",
    screens: [
      {
        id: "cities",
        label: "Cities",
        purpose: "Where you operate and which markets are worth entering.",
      },
      {
        id: "outbreaks",
        label: "Outbreaks",
        purpose: "What is spreading, and how you intend to answer it.",
      },
      {
        id: "growth",
        label: "Growth",
        purpose: "Marketing, and the catchment it buys you.",
      },
      {
        id: "rivals",
        label: "Rivals",
        purpose: "The other careers running beside yours, and where they stand.",
      },
    ],
  },
  {
    id: "career",
    label: "Career",
    icon: "certificate",
    screens: [
      {
        id: "career",
        label: "Career",
        purpose: "Qualifications — what you can personally take on.",
      },
      {
        id: "character",
        label: "Character",
        purpose: "Where you came from, who you became, and what this is for.",
      },
      {
        id: "standing",
        label: "Standing",
        purpose: "What six different groups of people think of you, and why.",
      },
      {
        id: "people",
        label: "People",
        purpose: "The colleagues, rivals and backers who remember what you did.",
      },
      {
        id: "timeline",
        label: "Timeline",
        purpose: "What has actually happened in this career so far.",
      },
    ],
  },
  {
    id: "life",
    label: "Life",
    icon: "home",
    screens: [
      {
        id: "life",
        label: "Life",
        purpose: "What the money is for, and what it costs you to keep.",
      },
    ],
  },
];

/**
 * NAVIGATION FOR A CAREER THAT IS NOT YET ANYTHING IN PARTICULAR
 *
 * A career the app has no bespoke screens for gets three destinations: the
 * week, the work, and the world — the planner, the ledger and the events are
 * engine-level and already career-agnostic, and the one Work screen carries
 * the mechanic that makes the career different from the others.
 *
 * Every career that has ever used this has since outgrown it. What is left
 * here is the landing place for the *next* career, which is the job it was
 * written for. It is honestly a smaller shell than a finished career's, not a
 * claim of parity.
 */
const GENERIC_SECTIONS: SectionDef[] = [
  WEEK,
  {
    id: "work",
    label: "Work",
    icon: "building",
    screens: [
      {
        id: "operation",
        label: "Business",
        purpose: "What you are running, and the decision it puts in front of you.",
      },
    ],
  },
  WORLD_MAP_ONLY,
];

/**
 * THE CHEF
 *
 * The Chef outgrew the generic shell first, and under the old bar its fourth
 * destination was called "You" — the craft and the work beyond the kitchen,
 * the things that travel with the person rather than the premises. That is
 * exactly what Career means in the shared frame, so the destination kept its
 * two screens and took the shared name. The scene — who eats out in this
 * city, and the rivals cooking for them — lives in World beside the map,
 * which is where a Physician finds the same subjects.
 */
const CHEF_SECTIONS: SectionDef[] = [
  WEEK,
  {
    id: "work",
    label: "Work",
    icon: "building",
    screens: [
      {
        id: "kitchen",
        label: "The room",
        purpose:
          "Premises and equipment — how many you can seat, and how long food keeps.",
      },
      {
        id: "larder",
        label: "Larder",
        purpose:
          "What is in stock, what dies next week, and who you order the rest from.",
      },
      {
        id: "menu",
        label: "Menu",
        purpose:
          "What you cook, what it costs to make, and what you charge for it.",
      },
      {
        id: "pass",
        label: "The pass",
        purpose:
          "How much of the room you sell in advance, what you can serve, and how the last night went.",
      },
      {
        id: "brigade",
        label: "Brigade",
        purpose: "Who is on the line, how they are holding up, and who else you could take on.",
      },
      {
        id: "books",
        label: "Money",
        purpose: "Takings, the costs that arrive whether you open or not, and the loan.",
      },
      {
        id: "reviews",
        label: "Word of mouth",
        purpose:
          "What seven different groups of people think of you, what they wrote, and what needs an answer.",
      },
    ],
  },
  {
    id: "world",
    label: "World",
    icon: "globe",
    screens: [
      {
        id: "home",
        label: "Map",
        purpose: "Where you work, and how far that currently reaches.",
      },
      {
        id: "scene",
        label: "The scene",
        purpose:
          "Who eats out in this city, what the season is doing, and the three restaurants competing for them.",
      },
    ],
  },
  {
    id: "career",
    label: "Career",
    icon: "certificate",
    screens: [
      {
        id: "craft",
        label: "The craft",
        purpose:
          "What you can personally cook, what you are learning, and where you could go to learn faster.",
      },
      {
        id: "beyond",
        label: "Beyond the kitchen",
        purpose:
          "Books, television, consultancy and pop-ups — and the weeks they take out of your own pass.",
      },
    ],
  },
];

/**
 * THE SOLICITOR
 *
 * Work is the practice, split at the seams the career actually has — and,
 * crucially, the *reports* split from the *transactions*:
 *
 *   Instructions   what is on the table, who pays and when, what to decline
 *   Casework       what you are carrying, and what settling it pays today
 *   The books      cash, what you are owed, what is unbilled, what falls due
 *   The firm       who is billing hours, and what they cost every week
 *
 * Hiring and briefing counsel are not here: those are calls you make, and
 * they live on the handset under Roll and Listings.
 */
const LAWYER_SECTIONS: SectionDef[] = [
  WEEK,
  {
    id: "work",
    label: "Work",
    icon: "building",
    screens: [
      {
        id: "instructions",
        label: "Instructions",
        purpose:
          "What is on the table, who is paying and when, and what this market will ever send you.",
      },
      {
        id: "casework",
        label: "Casework",
        purpose:
          "The files you are carrying, what they are worth if they land, and what settling pays today.",
      },
      {
        id: "ledger",
        label: "The books",
        purpose:
          "Cash, what you are owed, what is unbilled, and the costs that fall due whatever happens.",
      },
      {
        id: "firm",
        label: "The firm",
        purpose:
          "Who is billing hours for you, what they cost every week, and what the record says you have done.",
      },
    ],
  },
  WORLD_MAP_ONLY,
];

/**
 * THE FOUNDER
 *
 * This career shipped as a single scrolling page, with a note at the top of
 * `FounderScreens.tsx` defending it: the run has one question in it — how many
 * weeks are left and what you are spending them on — and splitting that across
 * tabs would hide the arithmetic that makes each option a decision.
 *
 * That argument is right about the arithmetic and wrong about the tabs. What
 * makes a hire a decision is the line under it reading "costs you about three
 * weeks of runway", and that line is computed per-option, next to the option,
 * so it survives being moved. What does not survive is the *summary* — burn,
 * revenue, customers, equity — which is why every screen in this section
 * carries the runway strip at the top rather than leaving it behind on one.
 */
const FOUNDER_SECTIONS: SectionDef[] = [
  WEEK,
  {
    id: "work",
    label: "Work",
    icon: "building",
    screens: [
      {
        id: "runway",
        label: "Runway",
        purpose:
          "How many weeks are left, where the customers come from, and what you charge them.",
      },
      {
        id: "product",
        label: "The product",
        purpose:
          "What you know about your customers, the pace you build at, and the tests that move the funnel.",
      },
      {
        id: "crew",
        label: "Team",
        purpose:
          "Who is on the payroll, what they cost every week, and what taking somebody on costs in weeks.",
      },
      {
        id: "raising",
        label: "Raising",
        purpose:
          "What the company is worth, what a round would buy, and the share of it you would never get back.",
      },
    ],
  },
  WORLD_MAP_ONLY,
];

/**
 * THE POLITICIAN
 *
 * Support drifts every week toward wherever the positions have left it, and
 * none of it is banked until polling day — so a screen showing what a stance
 * does to the farmers is unreadable without the count it will be measured at.
 * The count therefore rides on every screen but its own, exactly as the
 * runway does for the Founder.
 */
const POLITICIAN_SECTIONS: SectionDef[] = [
  WEEK,
  {
    id: "work",
    label: "Work",
    icon: "building",
    screens: [
      {
        id: "polling",
        label: "The count",
        purpose:
          "What you would take if the vote were today, the bar you must clear, and every count so far.",
      },
      {
        id: "blocs",
        label: "The electorate",
        purpose:
          "Who is in this seat, where each bloc sits today, and which way it is drifting without you.",
      },
      {
        id: "constituents",
        label: "The postbag",
        purpose:
          "Named cases on your desk, the volunteers who knock doors, and the fund that pays for the campaign.",
      },
      {
        id: "positions",
        label: "Where you stand",
        purpose:
          "The questions you have answered in public, what each answer costs, and what changing it would.",
      },
      {
        id: "office",
        label: "The ladder",
        purpose:
          "The office above this one, what it pays, and how much harder its seat is to hold.",
      },
    ],
  },
  WORLD_MAP_ONLY,
];

/**
 * THE ARCHITECT
 *
 * The career is paid in stages and its risk is being made to draw one twice,
 * so the question behind every screen is the same: how much of the fee is
 * still unearned, and how much of it has already been redrawn. That pair
 * rides on every screen but the boards, which state it in full. The
 * portfolio sits with the boards rather than on a tab of its own — what you
 * have built is the reason you are offered what you are offered, and it
 * reads as the finished end of the same list.
 */
const ARCHITECT_SECTIONS: SectionDef[] = [
  WEEK,
  {
    id: "work",
    label: "Work",
    icon: "building",
    screens: [
      {
        id: "boards",
        label: "On the boards",
        purpose:
          "What you are drawing, which stage each building is at, and how likely the client is to send it back.",
      },
      {
        id: "offers",
        label: "Offered",
        purpose:
          "What you are being asked for, what it pays, and what turning it down costs you.",
      },
      {
        id: "competitions",
        label: "Competitions",
        purpose:
          "Months of unpaid drawing for a building nobody has promised you — and the only route to the ones that matter.",
      },
      {
        id: "atelier",
        label: "The studio",
        purpose:
          "Who draws for you, what they cost every week, and the one hire that is really about the clients.",
      },
    ],
  },
  WORLD_MAP_ONLY,
];

/**
 * THE ENGINEER
 *
 * The thinnest Work of the seven, and deliberately so: this career has two
 * subjects, not four. What is on the bench, and what could go on it.
 * Inventing a third to match the others would be a tab with nothing behind
 * it. What travels between them is the certifier — how many faults this
 * market accepts and how long it takes to say so.
 */
const ENGINEER_SECTIONS: SectionDef[] = [
  WEEK,
  {
    id: "work",
    label: "Work",
    icon: "building",
    screens: [
      {
        id: "bench",
        label: "The bench",
        purpose:
          "What you are building, how many faults are estimated to be in it, and what the certifier will accept.",
      },
      {
        id: "newbuild",
        label: "What you could build",
        purpose:
          "What is open to you, what each would earn, and what one fault in it would cost in the field.",
      },
    ],
  },
  WORLD_MAP_ONLY,
];

export function sectionsFor(careerId: string): SectionDef[] {
  if (careerId === "doctor") return SECTIONS;
  if (careerId === "chef") return CHEF_SECTIONS;
  if (careerId === "lawyer") return LAWYER_SECTIONS;
  if (careerId === "founder") return FOUNDER_SECTIONS;
  if (careerId === "politician") return POLITICIAN_SECTIONS;
  if (careerId === "architect") return ARCHITECT_SECTIONS;
  if (careerId === "engineer") return ENGINEER_SECTIONS;
  return GENERIC_SECTIONS;
}

const ALL_SECTION_SETS = [
  SECTIONS,
  GENERIC_SECTIONS,
  CHEF_SECTIONS,
  LAWYER_SECTIONS,
  FOUNDER_SECTIONS,
  POLITICIAN_SECTIONS,
  ARCHITECT_SECTIONS,
  ENGINEER_SECTIONS,
];

const SCREEN_INDEX = new Map<ScreenId, { section: SectionDef; screen: ScreenDef }>();
for (const set of ALL_SECTION_SETS) {
  for (const section of set) {
    for (const screen of section.screens) {
      if (!SCREEN_INDEX.has(screen.id)) {
        SCREEN_INDEX.set(screen.id, { section, screen });
      }
    }
  }
}

/**
 * The section a screen belongs to.
 *
 * `careerId` matters whenever two careers share a screen id, which `home` and
 * `overview` both do: the flat index answers with whichever career registered
 * first, and its section may carry different sibling screens (the Chef's
 * World has two, most others have one). Since Phase 4 the section *id* is at
 * least stable either way — every career's map lives under `world` — but the
 * sibling list still needs the right career, so pass it whenever you have it.
 */
export function sectionOf(screen: ScreenId, careerId?: string): SectionDef {
  if (careerId) {
    const owned = sectionsFor(careerId).find((section) =>
      section.screens.some((s) => s.id === screen),
    );
    if (owned) return owned;
  }
  return SCREEN_INDEX.get(screen)?.section ?? SECTIONS[0];
}

export function screenOf(screen: ScreenId): ScreenDef {
  return SCREEN_INDEX.get(screen)?.screen ?? SECTIONS[0].screens[0];
}

/**
 * Landing screen when a primary destination is tapped.
 *
 * Career-aware since Phase 4, and it has to be: `work` is every career's
 * section id now, and tapping it must land a Chef in the kitchen and a
 * Solicitor at the instructions — not whichever career registered the id
 * first. The flat fallback remains for callers that genuinely do not know
 * who is asking.
 */
export function defaultScreen(section: SectionId, careerId?: string): ScreenId {
  if (careerId) {
    const owned = sectionsFor(careerId).find((s) => s.id === section);
    if (owned) return owned.screens[0].id;
  }
  return (
    ALL_SECTION_SETS.flat().find((s) => s.id === section)?.screens[0].id ??
    "overview"
  );
}
