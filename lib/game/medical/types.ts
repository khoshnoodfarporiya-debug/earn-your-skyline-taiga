/** Domain model for the medical career. */

import type { CityMarket } from "./economy";
export type SpecialtyId =
  | "general"
  | "paediatrics"
  | "cardiology"
  | "orthopaedics"
  | "emergency"
  | "radiology"
  | "surgery"
  | "oncology"
  | "maternity"
  | "psychiatry"
  | "neurology"
  | "dermatology";

export type EquipmentId =
  | "ecg"
  | "lab"
  | "ultrasound"
  | "xray"
  | "ct"
  | "mri"
  | "theatre"
  | "icu"
  | "pharmacy"
  | "endoscopy"
  | "dialysis"
  | "physio";

export type FacilityTypeId = "room" | "clinic" | "centre" | "hospital";

export type StaffRoleId =
  | "gp"
  | "specialist"
  | "surgeon"
  | "nurse"
  | "technician"
  | "admin"
  | "comms"
  | "paramedic";

export interface Specialty {
  id: SpecialtyId;
  label: string;
  blurb: string;
  /** Cost to open the department. */
  unlockCost: number;
  /** Weekly cost of keeping the department open. */
  upkeep: number;
  /** Reputation gained per successful case, scaled by severity. */
  prestige: number;
}

export interface Equipment {
  id: EquipmentId;
  label: string;
  blurb: string;
  cost: number;
  upkeep: number;
  /** Needs a technician on staff to run at all. */
  needsTechnician: boolean;
  /** Success-chance bonus for cases that require it. */
  qualityBonus: number;
}

export interface Condition {
  id: string;
  label: string;
  specialty: SpecialtyId;
  /** 1 (minor) to 5 (critical). Drives reputation swing and risk. */
  severity: 1 | 2 | 3 | 4 | 5;
  /** Relative frequency in the incoming case mix. */
  prevalence: number;
  /** Payment on a successful treatment. */
  fee: number;
  /** Treatment capacity consumed. */
  units: number;
  /** Staff skill needed for a reliable outcome. */
  minSkill: number;
  /** All of these must be owned (and staffed) to treat the case at all. */
  equipment?: EquipmentId[];
}

/**
 * AN AMBULANCE
 *
 * Not equipment, and the difference is the whole point of the type. A machine
 * makes you better at treating the people who reach you; a vehicle changes
 * *who reaches you at all*.
 *
 * Two levers, and they pull in tension:
 *
 *   `reach`   more of the surrounding population becomes yours to see
 *   `acuity`  and a harder share of it arrives — critical work pays more and
 *             punishes you when you cannot take it
 *
 * Both are worth nothing without `crew`. An ambulance with nobody qualified to
 * ride in it is exactly the ornament an unstaffed scanner is, and it is
 * modelled the same way rather than as a purchase block, because owning the
 * thing and being able to use it are different states a player should be able
 * to get themselves into.
 */
export interface FleetVehicle {
  id: string;
  label: string;
  blurb: string;
  cost: number;
  upkeep: number;
  /** Added to the catchment multiplier. 0.14 means "+14% of the population". */
  reach: number;
  /** How far the arriving case mix tilts toward severity. 0 leaves it alone. */
  acuity: number;
  /** Paramedics this vehicle needs before it does anything at all. */
  crew: number;
  /** Share of cost that still counts toward net worth. */
  retention: number;
}

export interface FacilityType {
  id: FacilityTypeId;
  label: string;
  blurb: string;
  cost: number;
  upkeep: number;
  /** Weekly treatment capacity this building can physically host. */
  slots: number;
  /** How many departments it can run. */
  departmentSlots: number;
}

export interface StaffRole {
  id: StaffRoleId;
  label: string;
  blurb: string;
  /** One-off recruitment cost. */
  hireCost: number;
  /** Weekly salary. */
  salary: number;
  /** Treatment units contributed per week. */
  units: number;
  /** True when the hire is tied to a specific specialty. */
  specialised: boolean;
}

/** A hired individual. */
/** Fixed dispositions a staff member has. See `culture.ts`. */
export type StaffTrait =
  | "meticulous"
  | "fast"
  | "mentor"
  | "abrasive"
  | "steady"
  | "restless";

export interface StaffMember {
  id: string;
  role: StaffRoleId;
  name: string;
  specialty: SpecialtyId | null;
  skill: number;
  salary: number;

  /*
   * Everything below is OPTIONAL, and that is load-bearing rather than lazy.
   *
   * A v9 roster has six fields per person. Making these required would reject
   * every existing save at the validator, so instead `hydrateStaff` fills them
   * on read and the migration writes them once. The cost is that every reader
   * must go through `hydrateStaff` — which is also what stops a missing field
   * turning into a NaN three systems downstream.
   */

  /** How they feel about this week. Moves fast. */
  morale?: number;
  /** Whether they would leave for ten percent. Moves slowly. */
  loyalty?: number;
  /** How much they want more. Fixed per person. */
  ambition?: number;
  /** The salary they believe they are worth. Only ever rises. */
  expects?: number;
  /** 0..100, derived from the practice's actual pressure. */
  workload?: number;
  /** Weeks left on a course you paid for. */
  training?: number;
  traits?: StaffTrait[];
  /** Recent performance scores, newest last, capped at six. */
  record?: number[];
  joinedWeek?: number;
  /** Formal warnings. Visible in the culture score. */
  warnings?: number;
  /** Delegated responsibility: covers admin load, expects to be paid for it. */
  lead?: boolean;
}

/** An owned building. */
export interface Facility {
  id: string;
  type: FacilityTypeId;
  name: string;
  city: CityId;
}

// ------------------------------------------------------------------ cities

export type CityId =
  | "lyon"
  | "madrid"
  | "milan"
  | "berlin"
  | "amsterdam"
  | "paris"
  | "london"
  | "dubai"
  | "singapore"
  | "tokyo"
  | "newyork"
  | "saopaulo"
  | "mumbai"
  | "lagos";

export interface City {
  id: CityId;
  name: string;
  country: string;
  blurb: string;
  /** Millions of people. Caps the panel you can hold here. */
  population: number;
  /** Licence and registration to practise. */
  entryCost: number;
  /** Multiplier on what treatment bills for. */
  feeIndex: number;
  /** Multiplier on upkeep and wages. */
  costIndex: number;
  /** Multiplier on the price of premises. */
  propertyIndex: number;
  /** Share of the market incumbents already hold. Reputation prises it loose. */
  competition: number;
  /** Per-specialty case-mix multipliers. */
  bias: Partial<Record<SpecialtyId, number>>;
  /**
   * Where this market sits on the network map, as percentages of a 0–100
   * square. Roughly geographic, but adjusted: Europe is spread wider than a
   * true projection allows so that seven cities inside it stay far enough
   * apart to label and to tap. Legibility beats accuracy here.
   */
  map: { x: number; y: number };
  /**
   * Where the city's name sits relative to its marker, in the same 0–100
   * units. Crowded markets push their labels apart by hand — there is no
   * automatic layout that beats a person looking at it — and any label moved
   * sideways gets a leader line back to its marker so the pairing stays
   * unambiguous.
   */
  label: { dx: number; dy: number; anchor: "start" | "middle" | "end" };
}

// --------------------------------------------------------------- outbreaks

export interface OutbreakDef {
  id: string;
  label: string;
  /** The organism, for flavour and for the research write-up. */
  pathogen: string;
  blurb: string;
  /** Specialties whose caseload surges while it runs. */
  affects: SpecialtyId[];
  severity: 1 | 2 | 3 | 4 | 5;
  /** Case-mix multiplier applied to the affected specialties. */
  surge: number;
  /** Weeks it lasts if left alone. */
  duration: number;
  riskPerWeek: number;
  reputationPerWeek: number;
  /** CPD spent to solve it — this is your own time, not money. */
  researchCpd: number;
  researchCost: number;
  containCost: number;
  /** 0 when there is nothing to vaccinate against. */
  vaccineCost: number;
}

/** An outbreak currently running in a city. */
export interface ActiveOutbreak {
  id: string;
  city: CityId;
  /** Weeks remaining. */
  weeksLeft: number;
  startedWeek: number;
  contained: boolean;
}

/** Per-city read-out for the network table. */
export interface CityReport {
  city: CityId;
  slots: number;
  capacity: number;
  panel: number;
  catchment: number;
  arrived: number;
  treated: number;
  turnedAway: number;
  revenue: number;
}

/** Result of one condition's caseload for the week. */
export interface CaseResult {
  conditionId: string;
  label: string;
  specialty: SpecialtyId;
  severity: number;
  arrived: number;
  treated: number;
  succeeded: number;
  failed: number;
  turnedAway: number;
  revenue: number;
  /** Why any were turned away, for the player's benefit. */
  blockedBy: "capacity" | "department" | "equipment" | "staff" | null;
}

export type TriagePolicy = "urgent" | "profitable" | "volume";

// ------------------------------------------------------------ progression

export type QualificationId =
  | "md"
  | "membership"
  | "fellowship"
  | "surgical"
  | "doctorate"
  | "professorship";

export interface Qualification {
  id: QualificationId;
  label: string;
  postNominal: string;
  blurb: string;
  tuition: number;
  /** Continuing professional development points, earned by studying. */
  cpd: number;
  minSkill: number;
  requires: QualificationId[];
  /** Bound to a specialty at enrolment (clinical ladder) or not (academic). */
  specialised: boolean;
  effect: string[];
}

export interface HeldQualification {
  id: QualificationId;
  specialty: SpecialtyId | null;
}

// --------------------------------------------------------------- marketing

export type CampaignId =
  | "flyers"
  | "localPress"
  | "website"
  | "socialMedia"
  | "reviews"
  | "referralNetwork"
  | "healthCamps"
  | "billboards"
  | "broadcast";

export interface Campaign {
  id: CampaignId;
  label: string;
  blurb: string;
  setupCost: number;
  weeklyCost: number;
  /** Flat increase to the catchment multiplier. */
  reach: number;
  /**
   * Extra reach scaled by (reputation - 50)/50. Channels with a high coupling
   * amplify whatever you actually are — brilliant when outcomes are good,
   * actively destructive when they are not.
   */
  coupling: number;
  minReputation?: number;
}

// --------------------------------------------------------------- lifestyle

export type LifestyleCategory = "home" | "car" | "perk" | "collectible";

export interface LifestyleItem {
  id: string;
  label: string;
  blurb: string;
  category: LifestyleCategory;
  cost: number;
  upkeep: number;
  /** Share of cost that still counts toward net worth. >1 appreciates. */
  retention: number;
  /** Extra burnout removed per Rest block. */
  restBonus?: number;
  /** Passive burnout removed every week. */
  burnoutRelief?: number;
  /** Standing, which attracts better recruits. */
  status?: number;
  /** Extra time blocks per week. */
  timeBlocks?: number;
}

// --------------------------------------------------------------- consumables

export interface SupplyTier {
  id: string;
  label: string;
  /** Weeks of cover this order buys. */
  weeks: number;
  /** Stock received per pound spent. Above 1 is the bulk discount. */
  yield: number;
  blurb: string;
}

export interface SupplyState {
  /** Value of consumables on hand, in the same units as consumption. */
  stock: number;
  /** Pay spot for any shortfall rather than running dry. On by default. */
  autoOrder: boolean;
  /** Last week's draw, used to size orders and estimate cover. */
  lastConsumption: number;
  /** Weeks of reduced capacity still to serve after a stock-out. */
  throttleWeeks: number;
}

// ------------------------------------------------------------------- phone

/**
 * Three audiences, deliberately not collapsed into `reputation`.
 *
 * Reputation is clinical standing earned by outcomes. These are what the
 * *world* thinks, and they are earned by what you say:
 *
 *   followers  — reach. How many people see anything you publish.
 *   trust      — what clinicians think of you. Buys you better recruits.
 *   sentiment  — what the public thinks. Moves your catchment.
 *   scrutiny   — how closely you are being watched. Raises malpractice risk.
 *
 * All four start at values where their gameplay effect is exactly zero, so a
 * run that never opens the phone plays identically to one before it existed.
 */
export interface SocialMetrics {
  followers: number;
  /** 0–100, neutral at 50. */
  trust: number;
  /** 0–100, neutral at 50. */
  sentiment: number;
  /** 0–100, neutral at 0. */
  scrutiny: number;
}

export type PostCategory =
  | "education"
  | "caseStudy"
  | "hiring"
  | "department"
  | "expansion"
  | "credential"
  | "research"
  | "outbreak"
  | "milestone"
  | "staff"
  | "lifestyle"
  | "promotion"
  | "response";

/** What publishing a post does. Every field is optional and additive. */
export interface PostEffect {
  followers?: number;
  trust?: number;
  sentiment?: number;
  scrutiny?: number;
  reputation?: number;
  cpd?: number;
  /** Patients who join the home city's panel next week. */
  panel?: number;
  /** Banked bonus applied to the skill roll of your next hire. */
  recruitBoost?: number;
}

/** Everything a post definition needs to know about the run. */
export interface PostContext {
  week: number;
  cityName: string;
  departmentLabel: string | null;
  newestFacility: string | null;
  newestQualification: string | null;
  solvedPathogen: string | null;
  outbreakLabel: string | null;
  outbreakCity: string | null;
  staffName: string | null;
  staffCount: number;
  panel: number;
  luxuryItem: string | null;
  followers: number;
  trust: number;
  sentiment: number;
}

export interface PostDef {
  id: string;
  category: PostCategory;
  /** Composer button label. */
  label: string;
  /** One line on what this post is. */
  blurb: string;
  /** The authored post text. Deterministic from context — never generated. */
  body: (c: PostContext) => string;
  /** Whether the run is currently in a state that makes this postable. */
  available: (c: PostContext) => boolean;
  /** Only offerable once per run (credentials, launches). */
  once?: boolean;
  /**
   * Chance this post backfires on confidentiality or accuracy. Sensational
   * variants trade a real risk for a bigger payoff.
   */
  hazard?: number;
  /** Applied on publish. */
  effect: PostEffect;
  /** Consequence lines shown before publishing, so the trade is legible. */
  preview: string[];
  /** Applied instead of `effect` when the hazard lands. */
  backfire?: { effect: PostEffect; note: string };
}

export interface FeedComment {
  author: string;
  handle: string;
  body: string;
}

export interface FeedPost {
  id: string;
  week: number;
  author: string;
  handle: string;
  /** Player posts are shown as yours and can be reacted to differently. */
  kind: "player" | "world";
  body: string;
  likes: number;
  comments: FeedComment[];
  tone: "good" | "bad" | "neutral";
}

export interface MessageChoice {
  label: string;
  detail: string;
  effect: PostEffect;
  /** Line appended to the thread once chosen. */
  reply: string;
}

export interface PhoneMessage {
  id: string;
  week: number;
  from: string;
  handle: string;
  /** Who this is: colleague, recruiter, journalist, regulator, rival. */
  role: "staff" | "recruiter" | "journalist" | "regulator" | "rival" | "peer";
  body: string;
  read: boolean;
  choices?: MessageChoice[];
  /** Index of the choice taken, once answered. */
  answered?: number;
}

export interface NewsItem {
  id: string;
  week: number;
  outlet: string;
  headline: string;
  body: string;
  tone: "good" | "bad" | "neutral";
  read: boolean;
}

export interface PhoneState {
  social: SocialMetrics;
  feed: FeedPost[];
  messages: PhoneMessage[];
  news: NewsItem[];
  /** Week of the most recent player post. 0 means never. */
  lastPostWeek: number;
  /** Post ids already used, for once-per-run posts. */
  postsMade: string[];
  /** Banked skill bonus for the next hire, from hiring announcements. */
  recruitBoost: number;
}

/** Structured, non-numeric career state carried on RunState.data. */
export interface MedicalState {
  facilities: Facility[];
  staff: StaffMember[];
  departments: SpecialtyId[];
  equipment: EquipmentId[];
  triage: TriagePolicy;
  lastCases: CaseResult[];
  qualifications: HeldQualification[];
  campaigns: CampaignId[];
  lifestyle: string[];
  /** Cities you hold a licence in. */
  cities: CityId[];
  /** Where you personally work — your own hours only count here. */
  homeCity: CityId;
  /** Panel held in each city, keyed by CityId. */
  panels: Record<string, number>;
  lastCityReports: CityReport[];
  /** Outbreaks currently running somewhere in the network. */
  outbreaks: ActiveOutbreak[];
  /** Pathogens you have solved by research — they never return. */
  solved: string[];
  /** The narrative and public-reputation layer. */
  phone: PhoneState;
  /** Consumables the clinic burns through treating people. */
  supplies: SupplyState;
  /**
   * Ambulances on the road.
   *
   * Optional so a v11 save written before the fleet existed still loads — the
   * same treatment `markets` gets. Every reader goes through the helpers in
   * `fleet.ts`, which read an absent fleet as an empty one, so an un-migrated
   * run behaves exactly like a practice that never bought a vehicle.
   */
  fleet?: string[];
  /**
   * Live market conditions per city.
   *
   * Optional so a v9 save loads; `ensureSeeded` fills it on the first resolved
   * week, and every reader goes through `marketOf` which returns a neutral
   * market for a city that has none. That means an un-migrated object behaves
   * exactly like the old static world rather than producing NaN prices.
   */
  markets?: Record<string, CityMarket>;
  nextId: number;
}
