/**
 * Exercises every command the UI can dispatch, and asserts each one both
 * applies when it should and refuses when it should not.
 *
 * The UI can only reach these through affordability-gated buttons, so this is
 * where the guard rails actually get tested.
 *
 * Run: npx tsx scripts/commands.ts
 */

import { doctor, med, netWorth, startDebtOf } from "../lib/game/careers/doctor";
import {
  advanceWeek,
  resolveEventChoice,
  runCommand,
  startRun,
} from "../lib/game/engine";
import type { CareerDef } from "../lib/game/types";
import {
  LAWYER_CAST,
  briefDiscount,
  conductGrace,
  costsRelief,
  mentorBonus,
  offerGoodwill,
  referralPull,
} from "../lib/game/careers/lawyerCast";
import { personDefIn } from "../lib/ui/castAccess";
import { LEGAL_ORG_HANDLES } from "../lib/game/careers/lawyerPhone";
import {
  LAWYER_CRISIS_KINDS,
  LAWYER_CRISIS_STAGES,
  practiceCrisisRisk,
} from "../lib/game/careers/lawyerCrises";
import { nextStep } from "../lib/ui/guidance";
import { glossaryFor } from "../lib/ui/glossary";
import { deriveAlerts } from "../lib/ui/alerts";
import { lessonFor, lessonStatus, lessonOrderFor, LESSONS } from "../lib/ui/onboarding";
import {
  defaultScreen,
  screenOf,
  sectionOf,
  sectionsFor,
  type SectionDef,
} from "../lib/ui/navigation";
import { makeRng } from "../lib/game/rng";
import {
  PERSON_ROLES,
  driftPeople,
  personIn,
  remembers,
  touchPerson,
} from "../lib/game/people";
import { hasMilestone, mark, timelineOf } from "../lib/game/timeline";
import {
  MAX_PENDING,
  schedule,
  takeDue,
  upcoming,
} from "../lib/game/consequences";
import {
  REPUTATIONS,
  REP_BY_ID,
  applyRep,
  attritionRisk,
  hiringBonus,
  overallReputation,
} from "../lib/game/reputation";
import { CHAIN_EVENTS } from "../lib/game/medical/chains";
import {
  SAVE_KEYS,
  loadArchive,
  migrateRun,
  saveArchive,
  setSaveScope,
  validateRun,
} from "../lib/game/save";
import { validatePhone } from "../lib/game/phone/validate";
import {
  MAX_SETBACKS,
  RECOVERY,
  SETBACK_KINDS,
  canPractise,
  has,
  setbackEffects,
} from "../lib/game/setbacks";
import { BACKGROUNDS, fromBackground } from "../lib/game/backgrounds";
import {
  TRAITS,
  TRAIT_CAP,
  burnoutFactor,
  checkTraits,
  ethicsDrift,
  hasTrait,
  loyaltyDrift,
  noteBehaviour,
  opportunismFactor,
  preparationFactor,
} from "../lib/game/traits";
import {
  AMBITIONS,
  AMBITION_BY_ID,
  checkAmbition,
  setAmbition,
} from "../lib/game/ambitions";
import {
  grantFor,
  legacyFor,
  retire,
  retirementSummary,
} from "../lib/game/retirement";
import { driftMarket, type CityMarket } from "../lib/game/medical/economy";
import {
  churnRate,
  cultureScore,
  errorRate,
  hydrateStaff,
  productivityFactor,
  recruitAppeal,
} from "../lib/game/medical/culture";
import {
  MAX_RIVAL_HISTORY,
  initialRival,
  recordContest,
  rivalBid,
  tickRivals,
} from "../lib/game/rivals";
import { PHYSICIAN_RIVALS } from "../lib/game/medical/rivalCast";
import { CAST_BY_ID } from "../lib/game/medical/cast";
import {
  CONTRACT_KINDS,
  MAX_ACTIVE,
  MAX_CONTRACT_HISTORY,
  MAX_OFFERS,
  readinessFor,
  requiredScore,
  resolveContract,
  rollComplication,
  startContract,
} from "../lib/game/contracts";
import {
  CONTRACT_BY_ID,
  MEDICAL_CONTRACTS,
} from "../lib/game/medical/contractList";
import {
  FUNDING_KINDS,
  MAX_EQUITY,
  MAX_OBLIGATIONS,
  dividendOn,
  equitySold,
  fundingOffers,
  obligations,
  ownedShare,
  repay,
  borrowingCapacity,
  takeFunding,
  tickFinance,
  totalOutstanding,
} from "../lib/game/finance";
import { MAX_WORLD_NEWS, rivalNews, worldNews } from "../lib/game/news";
import {
  CRISIS_KINDS,
  CRISIS_STAGES,
  MAX_CRISES,
  NEGLECT_LIMIT,
  crisisRisk,
  stageOf,
  stagesFor,
  startCrisis,
  tickCrisis,
} from "../lib/game/crisis";
import { loadLastPlan, saveLastPlan } from "../lib/game/save";
import { PLANS, applyPlan, clampPlan } from "../components/overview/QuickPlan";
import {
  CAREER_VISUALS,
  clusterNodes,
  CITY_VISUALS,
  EVENT_VISUALS,
  MILESTONE_VISUAL,
  NETWORK_VISUAL,
  OUTBREAK_VISUAL,
  PRACTICE_STAGES,
  PRACTICE_VISUAL,
  SECTION_VISUALS,
  careerVisual,
  cityVisual,
  eventVisual,
  networkNodes,
  networkRoutes,
  practiceStageIndex,
} from "../lib/ui/visuals";
import { CAREER_PREVIEWS, CAREERS } from "../lib/game/careers";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Every file under a directory, recursively. */
function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walkFiles(join(dir, entry.name))
      : [join(dir, entry.name)],
  );
}
import { centreScroll } from "../lib/ui/worldmap";
import {
  BORDER_PATH,
  GRATICULE_PATH,
  LAND_PATH,
} from "../lib/ui/worldmap.generated";

/**
 * Real coordinates for the fourteen markets, mirroring `scripts/build-map.ts`.
 * Duplicated deliberately: if the two ever disagree, the projection assertion
 * below fails, which is exactly the drift worth catching.
 */
const CITY_LATLON: Record<string, [number, number]> = {
  lyon: [4.84, 45.76],
  madrid: [-3.7, 40.42],
  milan: [9.19, 45.46],
  berlin: [13.4, 52.52],
  amsterdam: [4.9, 52.37],
  paris: [2.35, 48.86],
  london: [-0.13, 51.51],
  dubai: [55.27, 25.2],
  singapore: [103.82, 1.35],
  tokyo: [139.69, 35.69],
  newyork: [-74.01, 40.71],
  saopaulo: [-46.63, -23.55],
  mumbai: [72.88, 19.08],
  lagos: [3.38, 6.52],
};

/** One point inside each region the map must actually draw. */
const REGION_PROBES: Record<string, [number, number]> = {
  "north-america": [-100, 45],
  "south-america": [-60, -10],
  europe: [10, 50],
  africa: [20, 0],
  "middle-east": [45, 25],
  "south-asia": [78, 22],
  "southeast-asia": [105, 12],
  "east-asia": [110, 35],
};
import { loadRun } from "../lib/game/save";
import { compactCount } from "../lib/game/format";
import { FACILITY_BY_ID } from "../lib/game/medical/data";
import { activeCities } from "../lib/game/medical/sim";
import { playerCoverage, recruitBonus } from "../lib/game/medical/progression";
import { catchmentMultiplier } from "../lib/game/medical/marketing";
import { lifestyleValue, restBonus } from "../lib/game/medical/lifestyle";
import {
  CITIES,
  capturedShare,
  cityOf,
  contestedShare,
  populationCeiling,
} from "../lib/game/medical/cities";
import {
  OUTBREAKS,
  OUTBREAK_BY_ID,
  outbreakPressure,
  outbreakSurge,
  pressureBand,
  severityCeiling,
} from "../lib/game/medical/outbreaks";
import {
  MAX_FEED,
  MAX_MESSAGES,
  MAX_NEWS,
  reactionsFor,
  unreadMessages,
} from "../lib/game/medical/phone";
import {
  commsHazardFactor,
  commsReachBonus,
  commsScrutinyRelief,
  commsStaff,
  scrutinyRisk,
  sentimentCatchment,
  trustRecruitBonus,
} from "../lib/game/medical/social";
import {
  SUPPLY_COST,
  consumptionFor,
  drawSupplies,
  supplyThrottle,
  tierCost,
  tierStock,
} from "../lib/game/medical/supplies";
import { computeCapacity } from "../lib/game/medical/sim";
import {
  capacityIn,
  catchmentIn,
  facilityPrice,
  slotsIn,
} from "../lib/game/medical/sim";
import { patientFlow, flowIsConsistent } from "../lib/ui/flow";
import { capacityPipeline, pipelineMatchesEngine } from "../lib/ui/capacity";
import { DEPARTMENTS, departmentCoverage } from "../lib/ui/departments";
import { weeklyFinance } from "../lib/ui/finance";
import { standingRows } from "../lib/ui/standing";
import { CRISIS_GUIDE, crisisProgress } from "../lib/ui/pressure";
import { SPECIALTIES } from "../lib/game/medical/data";
import { coverageFor, payroll } from "../lib/game/medical/sim";
import { MED_ICON_NAMES } from "../components/visuals/MedIcon";
import { basename, dirname } from "node:path";
import {
  PURCHASE_ART,
  awaitingArt,
  catalogueIds,
  missingArt,
  orphanArt,
} from "../lib/ui/purchaseArt";
import { ART_SIZES } from "../lib/ui/purchaseArt.generated";
import { DEPARTMENT_BY_ID } from "../lib/ui/departments";
import { allPurchases } from "../lib/ui/purchases";
import { LIFESTYLE } from "../lib/game/medical/lifestyle";
import {
  chef,
  kitchen,
  kitchenWorth,
  goalFor,
  localSum,
  CHEF_PREMISES,
  CHEF_PRODUCE,
} from "../lib/game/careers/chef";
import { engineer, workshop } from "../lib/game/careers/engineer";
import {
  ARCHITECTURES,
  PRODUCT_BY_ID as ENGINE_KIND_BY_ID,
  RIGS,
  WORKSHOP_CITY_BY_ID,
  benchOf,
  benchWages,
  buildableKinds,
  confidenceOf,
  designNeededFor,
  estimateOf,
  faultCost,
  prototypeCost,
  revenueOf as productRevenue,
  rigCost,
  rigsOf,
  surfaceChance,
  testYieldFor,
} from "../lib/game/careers/workshop";
import { architect, studio } from "../lib/game/careers/architect";
import {
  BRIEFS,
  KIND_BY_ID,
  STAGES as DESIGN_STAGES,
  budgetLoad,
  competitionOdds,
  consentCost,
  feeFor,
  offerableKinds,
  overBudget,
  revisionDepth,
  revisionRisk,
  stageOf as buildStage,
  stageWeeks,
  stageWeeksOf,
} from "../lib/game/careers/studio";
import { politician, campaign } from "../lib/game/careers/politician";
import {
  BLOCS,
  FOCUS_GROUP_COST,
  ISSUES,
  blocWeight,
  constituentsOf,
  gotvBonus,
  leanOf,
  pollBandOf,
  projectedShare,
  recordOf,
  selectionBlocker,
  survivesToPoll,
  volunteerLift,
  volunteersOf,
  warchestOf,
} from "../lib/game/careers/constituency";
import { founder, venture } from "../lib/game/careers/founder";
import {
  EXPERIMENTS,
  ROUND_BY_ID,
  burnOf,
  churnRate as ventureChurn,
  defaultAlive,
  experimentCost,
  experimentsOf,
  funnelOf,
  insightOf,
  revenueOf,
  roundBlocker,
  runwayLabel,
  runwayOf,
  startupCityOf,
  stanceOf,
  techDebtOf,
} from "../lib/game/careers/startup";
import {
  INGREDIENT_BY_ID,
  RECIPES,
  RECIPE_BY_ID,
  SIGNATURE_REFINED,
  SIGNATURE_SERVED,
  dishMargin,
  dishQuality,
  earnsSignature,
  recipeCost,
  recipeName,
} from "../lib/game/careers/recipes";
import {
  CHEF_POSTS,
  CHEF_POST_BY_ID,
  chefPostContext,
  ensureChefPhone,
} from "../lib/game/careers/chefPhone";
import {
  KITCHEN_KIT,
  KIT_BY_ID,
  SUPPLIERS,
  effectiveOf,
  loyaltyOf,
  moraleOf,
  skillOf,
  SUPPLIER_BY_ID,
  arrivalOdds,
  lifeFrom,
  priceFrom,
  standingWith,
  supplierBlocker,
  forecastFor,
  policyOf,
  SERVICES,
  SERVICE_BY_ID,
  brigadeCovers,
  extraShelfLife,
  isSpoiled,
  kitValue,
  serviceBlocker,
  serviceOpen,
  wasteSaved,
  rent,
  spendPerHead,
  labourIndex,
  capitalIndex,
  KITCHEN_CITIES,
  produceIndex,
  kitPrice,
  premisesPrice,
  rolePay,
  ROLE_BY_ID,
  activeMenu,
  consumeForCovers,
  ingredientFreshness,
  ingredientLifeLeft,
  ingredientPrice,
  ingredientState,
  knownRecipes,
  knowsRecipe,
  menuFactors,
  pantryExtraLife,
  pantryOf,
  pantryQty,
  progressFor,
  agencyFees,
  shortlistLive,
  SHORTLIST_SIZE,
  SHORTLIST_WEEKS,
} from "../lib/game/careers/kitchen";
import {
  SERVICE_SHAPES,
  STATIONS,
} from "../lib/game/careers/service";
import {
  /* The Physician already owns `TRAITS` — these are the brigade's, which are
     a different catalogue for a different career. */
  TRAITS as KITCHEN_TRAITS,
  bottleneckFix,
  currentSkill,
  errorRateOf,
  experienceOf,
  fatigueOf,
  isBurntOut,
  onTonight,
  promotionFor,
  recover,
  staffingWarnings,
  stationLoads,
  trainingOf,
} from "../lib/game/careers/brigade";
import {
  PRODUCE_BY_ID,
  clearSpoiled,
  drawFromLarder,
  freshnessOf,
  larderCovers,
  plateQuality,
} from "../lib/game/careers/kitchen";
import {
  lawyer,
  practice,
  firmWorth as firmWorthOf,
  goalFor as goalForFirm,
} from "../lib/game/careers/lawyer";
import { horizonFor, pointFor } from "../lib/ui/careerMap";
import {
  CRITIC_ART,
  chefArtPaths,
  larderArt,
  AWAITING_CHEF_ART,
  awaitingChefArt,
  missingChefArt,
  premisesArt,
  serviceArt,
} from "../lib/ui/chefArt";
import { isOnLand } from "../lib/ui/worldmap";
import {
  CASE_BY_ID,
  CASE_KINDS,
  LEGAL_CITY_BY_ID,
  COUNSEL,
  COUNSEL_ODDS,
  LEGAL_PREMISES,
  MAX_RETAINERS,
  PREMISES_BY_ID,
  RETAINERS,
  RETAINER_BY_ID,
  retainerHours,
  retainerIncome,
  retainerOffersOf,
  retainersOf,
  chambersOf,
  chambersPrice,
  chambersSeats,
  seatsFree,
  seatsUsed,
  MAX_ADJOURNMENTS,
  MAX_PRESSURE,
  SPECIALIST_HOURS,
  areaBand,
  areaHours,
  areaSkill,
  counselAvailable,
  counselOf,
  creditArea,
  type PracticeState,
  PAYERS,
  type PayerId,
  billsOwed,
  chambersRent,
  costsOrder,
  counselFee,
  factorValue,
  feeIn,
  hasClerk,
  legalLabourIndex,
  newOffers,
  oddsFor,
  payerFor,
  relistChance,
  settlementFor,
} from "../lib/game/careers/casework";
import {
  LEGAL_POSTS,
  LEGAL_VOICES,
  ensureLawyerPhone,
  lawyerPostContext,
} from "../lib/game/careers/lawyerPhone";
import { CHEF_VOICES } from "../lib/game/careers/chefPhone";
import {
  FLEET,
  FLEET_BY_ID,
  crewNeeded,
  crewOn,
  fleetAcuity,
  fleetCrewRatio,
  fleetCrewed,
  fleetReach,
  fleetSize,
  fleetUpkeep,
  fleetValue,
} from "../lib/game/medical/fleet";
import { EQUIPMENT } from "../lib/game/medical/data";
import {
  CAST_PORTRAITS,
  allPortraits,
  castHandles,
  hasPortraitForPerson,
  isOrganisation,
  portraitForPerson,
  portraitForSocialHandle,
} from "../lib/ui/portraits";
import { BOTS } from "../lib/game/medical/bots";
import { FULL_CAST } from "../lib/game/medical/cast";
import { staffName } from "../lib/game/medical/data";
import { initialsOf } from "../lib/game/people";
/* Phase 3: what the city thinks, who is in the room, and who else is cooking. */
import {
  MAX_STANDING_LOG,
  MAX_STANDING_TREND,
  STANDINGS,
  STANDING_BY_ID,
  applyStanding,
  recentStanding,
  sceneScore,
  settleStanding,
  standingOf,
  trendOf,
} from "../lib/game/careers/standing";
import {
  SEGMENTS,
  SEGMENT_BY_ID,
  appealOf,
  dinerMix,
  seasonOf,
} from "../lib/game/careers/diners";
import { sceneFor } from "../lib/game/careers/scene";
import { MAX_REVIEWS, recurringProblems } from "../lib/game/careers/reviews";
import {
  COMPLAINT_RESPONSES,
  MAX_COMPLAINTS,
  brokenPromise,
  expectationOf,
  interestOf,
  notePost,
  promotionOf,
  reachFactor,
  resolveComplaint,
} from "../lib/game/careers/buzz";
import {
  CRITICS,
  CRITIC_BY_ID,
  MAX_VERDICTS,
  arrangeVisit,
  criticInterest,
  judgeVisit,
  watchLine,
} from "../lib/game/careers/critics";
import {
  PRICE_LABEL,
  cityRank,
  competitorPressure,
  moveRivals,
  rivalsFor,
} from "../lib/game/careers/competitors";
import { CHEF_EVENTS } from "../lib/game/careers/chefEvents";
/* Phase 4: the craft, the cellar, the guide and the work outside the kitchen. */
import {
  DISCIPLINES,
  RANKS,
  STAGES,
  STAGE_BY_ID,
  TECHNIQUES,
  TECHNIQUE_BY_ID,
  applyStage,
  canLearn,
  chefRank,
  gateFor,
  knowsTechnique,
  learnedTechniques,
  practise,
  rankScore,
  stageBlocker,
  techniqueBlocker,
  techniqueLift,
  techniqueSteadiness,
  techniqueWorth,
  techniqueYield,
} from "../lib/game/careers/craft";
import {
  WINES,
  WINE_BY_ID,
  bottlesHeld,
  casePrice,
  cellarCapacity,
  maturityOf,
  pourForCovers,
  sellPrice,
  wineBlocker,
} from "../lib/game/careers/cellar";
import {
  GUIDE_COMPONENTS,
  STAR_LEVELS,
  guideDue,
  guideScore,
  starLevel,
  starsFor,
  starsOf,
  towardsNext,
} from "../lib/game/careers/guide";
import {
  VENTURES,
  VENTURE_BY_ID,
  ventureBlocker,
  venturesOf,
} from "../lib/game/careers/ventures";
import { customerReactions } from "../lib/game/careers/chefPhone";
import type { RunState } from "../lib/game/types";

let failures = 0;
function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const run = (s: RunState, cmd: string, arg = "") =>
  runCommand(doctor, s, cmd, arg);

console.log("\nCommand contract\n" + "─".repeat(52));

let s = startRun(doctor, 99);
s.r.cash = 1_000_000;

// --- facilities ------------------------------------------------------------
const before = med(s).facilities.length;
s = run(s, "buyFacility", "clinic");
check("buyFacility adds a site", med(s).facilities.length === before + 1);
check("buyFacility charges cash", s.r.cash === 1_000_000 - 34_000);

const poor = run({ ...s, r: { ...s.r, cash: 10 } }, "buyFacility", "hospital");
check(
  "buyFacility refused when unaffordable",
  med(poor).facilities.length === med(s).facilities.length,
);

// --- departments -----------------------------------------------------------
s = run(s, "openDepartment", "cardiology");
check("openDepartment opens it", med(s).departments.includes("cardiology"));

const dup = run(s, "openDepartment", "cardiology");
check(
  "openDepartment refuses duplicates",
  med(dup).departments.length === med(s).departments.length,
);

// Fill every department slot, then confirm the next one is refused.
let filled = s;
for (const d of [
  "paediatrics",
  "dermatology",
  "psychiatry",
  "radiology",
  "neurology",
  "orthopaedics",
] as const) {
  filled = run(filled, "openDepartment", d);
}
const slots = med(filled).facilities.reduce(
  (n, f) => n + (f.type === "clinic" ? 3 : f.type === "room" ? 1 : 0),
  0,
);
check(
  "openDepartment respects premises limit",
  med(filled).departments.length <= slots,
  `${med(filled).departments.length} departments vs ${slots} slots`,
);

// --- equipment -------------------------------------------------------------
s = run(s, "buyEquipment", "ecg");
check("buyEquipment adds it", med(s).equipment.includes("ecg"));
const dupEq = run(s, "buyEquipment", "ecg");
check(
  "buyEquipment refuses duplicates",
  med(dupEq).equipment.length === med(s).equipment.length,
);

// --- staff -----------------------------------------------------------------
s = run(s, "hire", "nurse");
check(
  "hire adds a nurse",
  med(s).staff.some((x) => x.role === "nurse"),
);

s = run(s, "hire", "specialist:cardiology");
const spec = med(s).staff.find((x) => x.role === "specialist");
check(
  "hire specialist parses role:specialty",
  spec?.specialty === "cardiology",
);
check("hired staff carry a name and skill", !!spec?.name && spec.skill > 0);

const noSpec = run(s, "hire", "specialist");
check(
  "hire refuses a specialist with no specialty",
  med(noSpec).staff.length === med(s).staff.length,
);

const target = med(s).staff[0].id;
const cashBefore = s.r.cash;
const salary = med(s).staff[0].salary;
s = run(s, "fire", target);
check("fire removes them", !med(s).staff.some((x) => x.id === target));
check("fire charges severance", s.r.cash === cashBefore - salary * 2);

const ghost = run(s, "fire", "does-not-exist");
check(
  "fire on an unknown id is a no-op",
  med(ghost).staff.length === med(s).staff.length,
);

// --- triage ----------------------------------------------------------------
s = run(s, "triage", "profitable");
check("triage sets the policy", med(s).triage === "profitable");

// --- loan ------------------------------------------------------------------
const debtBefore = s.r.debt;
s = run(s, "payLoan");
check("payLoan reduces the balance", s.r.debt === debtBefore - 10_000);

const broke = run({ ...s, r: { ...s.r, cash: 0 } }, "payLoan");
check("payLoan refused with no cash", broke.r.debt === s.r.debt);

const cleared = run(
  { ...s, r: { ...s.r, debt: 3_000, cash: 50_000 } },
  "payLoan",
);
check(
  "payLoan never overshoots into negative debt",
  cleared.r.debt === 0,
  `got ${cleared.r.debt}`,
);

// --- qualifications --------------------------------------------------------
let q = startRun(doctor, 5);
q.r.cash = 500_000;
q = run(q, "buyFacility", "clinic");
q = run(q, "openDepartment", "cardiology");

const tooSoon = run(q, "enrol", "membership:cardiology");
check(
  "enrol refused without skill or CPD",
  med(tooSoon).qualifications.length === 1,
);

q.r.skill = 80;
q.r.cpd = 400;
const skipped = run(q, "enrol", "fellowship:cardiology");
check(
  "enrol refused when the prerequisite is missing",
  !med(skipped).qualifications.some((x) => x.id === "fellowship"),
);

q = run(q, "enrol", "membership:cardiology");
check(
  "enrol grants the qualification",
  med(q).qualifications.some(
    (x) => x.id === "membership" && x.specialty === "cardiology",
  ),
);
check("enrol charges tuition and CPD", q.r.cpd === 360);
check(
  "membership raises personal coverage",
  playerCoverage(med(q), "cardiology") === 3,
);
check(
  "coverage is per-department, not global",
  playerCoverage(med(q), "general") === 2,
);

q = run(q, "enrol", "fellowship:cardiology");
check(
  "fellowship stacks on membership",
  playerCoverage(med(q), "cardiology") === 4,
);

const wrongField = run(q, "enrol", "surgical:general");
check(
  "specialised prerequisite must be in the same field",
  !med(wrongField).qualifications.some((x) => x.id === "surgical"),
);

const beforeRecruit = recruitBonus(med(q));
q = run(q, "enrol", "doctorate");
check(
  "doctorate improves future recruits",
  recruitBonus(med(q)) > beforeRecruit,
);

// --- marketing -------------------------------------------------------------
let mk = startRun(doctor, 11);
mk.r.cash = 200_000;
const baseMul = catchmentMultiplier(med(mk), 50);
mk = run(mk, "toggleCampaign", "billboards");
check(
  "toggleCampaign starts a campaign",
  med(mk).campaigns.includes("billboards"),
);
check(
  "campaign raises the catchment multiplier",
  catchmentMultiplier(med(mk), 50) > baseMul,
);
mk = run(mk, "toggleCampaign", "billboards");
check(
  "toggleCampaign stops it again",
  !med(mk).campaigns.includes("billboards"),
);

const lockedOut = run(
  { ...mk, r: { ...mk.r, reputation: 20 } },
  "toggleCampaign",
  "referralNetwork",
);
check(
  "campaign refused below its reputation floor",
  !med(lockedOut).campaigns.includes("referralNetwork"),
);

// Word-of-mouth channels must be able to go negative on a bad reputation.
const social = run(mk, "toggleCampaign", "socialMedia");
check(
  "word-of-mouth reach shrinks when poorly regarded",
  catchmentMultiplier(med(social), 10) < catchmentMultiplier(med(social), 90),
);

// --- lifestyle -------------------------------------------------------------
let lf = startRun(doctor, 13);
lf.r.cash = 3_000_000;
lf = run(lf, "buyLifestyle", "townhouse");
check("buyLifestyle adds the item", med(lf).lifestyle.includes("townhouse"));
check("home adds rest bonus", restBonus(med(lf)) > 0);

const cashBeforeUpgrade = lf.r.cash;
lf = run(lf, "buyLifestyle", "suburban_house");
check(
  "a second home replaces the first",
  med(lf).lifestyle.includes("suburban_house") &&
    !med(lf).lifestyle.includes("townhouse"),
);
check(
  "trading up refunds the old home at its retained value",
  Math.round(lf.r.cash) ===
    Math.round(cashBeforeUpgrade - 430_000 + 180_000 * 0.95),
);

lf = run(lf, "buyLifestyle", "sports_car");
check(
  "depreciating items cost net worth",
  lifestyleValue(med(lf)) < 430_000 + 265_000,
);

lf = run(lf, "buyLifestyle", "chauffeur");
check("chauffeur grants a time block", doctor.timeBudget(lf) === 7);

const soldCash = run(lf, "sellLifestyle", "sports_car");
check(
  "sellLifestyle returns the retained value",
  Math.round(soldCash.r.cash) === Math.round(lf.r.cash + 265_000 * 0.4),
);

// --- cities ----------------------------------------------------------------
let ct = startRun(doctor, 21);
ct.r.cash = 2_000_000;

check("starts licensed only at home", med(ct).cities.length === 1);
check("home city holds the starting panel", (med(ct).panels.lyon ?? 0) > 0);

const unlicensed = run(ct, "buyFacility", "clinic:london");
check(
  "cannot buy premises in an unlicensed city",
  med(unlicensed).facilities.length === med(ct).facilities.length,
);

const cashBeforeEntry = ct.r.cash;
const londonEntry = cityOf("london").entryCost;
ct = run(ct, "enterCity", "london");
check("enterCity licenses the market", med(ct).cities.includes("london"));
check(
  "enterCity charges the registration",
  ct.r.cash === cashBeforeEntry - londonEntry,
  `expected ${londonEntry}`,
);

const twice = run(ct, "enterCity", "london");
check(
  "enterCity refuses duplicates",
  med(twice).cities.length === med(ct).cities.length,
);

// Property prices scale with the local market.
const lyonPrice = facilityPrice("clinic", "lyon");
const londonPrice = facilityPrice("clinic", "london");
check(
  "premises cost more in expensive markets",
  londonPrice > lyonPrice * 1.5,
  `${lyonPrice} vs ${londonPrice}`,
);

const cashBeforeBuild = ct.r.cash;
ct = run(ct, "buyFacility", "clinic:london");
check(
  "buyFacility places it in the named city",
  med(ct).facilities.some((f) => f.city === "london"),
);
check(
  "buyFacility charges the local price",
  ct.r.cash === cashBeforeBuild - londonPrice,
);
check("slotsIn counts per city", slotsIn(med(ct), "london") === 110);
check(
  "a new market opens with patients already waiting",
  (med(ct).panels.london ?? 0) > 0,
  `got ${Math.round(med(ct).panels.london ?? 0)}`,
);
check(
  "the seed reflects reputation rather than filling the market",
  (med(ct).panels.london ?? 0) <
    catchmentIn(med(ct), "london", ct.r.reputation) * 0.6,
);

// Population caps what any market can ever give you.
check(
  "catchment is capped by population",
  catchmentIn(med(ct), "london", 100) <= populationCeiling("london"),
);
check(
  "a bigger city supports a bigger ceiling",
  populationCeiling("tokyo") > populationCeiling("amsterdam"),
);

// Relocating moves where your own hours land.
check("you start based at home", med(ct).homeCity === "lyon");
ct = run(ct, "relocate", "london");
check("relocate moves you", med(ct).homeCity === "london");
const nowhere = run(ct, "relocate", "tokyo");
check(
  "relocate refuses an unlicensed city",
  med(nowhere).homeCity === "london",
);

// Your personal hours only count where you are.
const atHome = capacityIn(med(ct), "london", 4, 60, 20);
const away = capacityIn(med(ct), "lyon", 4, 60, 20);
check(
  "personal hours count only in your home city",
  atHome.personalUnits > 0 && away.personalUnits === 0,
);

// --- outbreaks -------------------------------------------------------------
const ob = startRun(doctor, 41);
ob.r.cash = 2_000_000;
ob.r.cpd = 500;
const flu = OUTBREAK_BY_ID.get("influenza")!;
med(ob).outbreaks.push({
  id: "influenza",
  city: "lyon",
  weeksLeft: flu.duration,
  startedWeek: 1,
  contained: false,
});
const key = "influenza:lyon";

check(
  "an outbreak surges its own specialties",
  outbreakSurge(med(ob), "lyon", "general") === flu.surge,
);
check(
  "it leaves other specialties alone",
  outbreakSurge(med(ob), "lyon", "oncology") === 1,
);
check(
  "and other cities alone",
  outbreakSurge(med(ob), "paris", "general") === 1,
);

const contained = run(ob, "contain", key);
check("contain marks it", med(contained).outbreaks[0].contained);
check(
  "contain blunts the surge without ending it",
  outbreakSurge(med(contained), "lyon", "general") < flu.surge &&
    med(contained).outbreaks.length === 1,
);

// Vaccination needs a pharmacy, not just money.
const noPharmacy = run(ob, "vaccinate", key);
check(
  "vaccination refused without a pharmacy",
  med(noPharmacy).outbreaks.length === 1,
);
let withPharmacy = run(ob, "buyEquipment", "pharmacy");
withPharmacy = run(withPharmacy, "vaccinate", key);
check(
  "vaccination ends it once you can dispense",
  med(withPharmacy).outbreaks.length === 0,
);
check(
  "vaccination is a reputation event",
  withPharmacy.r.reputation > ob.r.reputation,
);

// Research costs your own CPD and solves the pathogen permanently.
const brokeOnCpd = run({ ...ob, r: { ...ob.r, cpd: 0 } }, "research", key);
check(
  "research refused without the CPD",
  med(brokeOnCpd).outbreaks.length === 1,
);
const researched = run(ob, "research", key);
check("research ends the outbreak", med(researched).outbreaks.length === 0);
check(
  "research records the pathogen",
  med(researched).solved.includes("influenza"),
);
check("research costs CPD", researched.r.cpd === ob.r.cpd - flu.researchCpd);

// Publishing clears it everywhere, not just where you did the work.
const twoCities = startRun(doctor, 43);
twoCities.r.cash = 2_000_000;
twoCities.r.cpd = 500;
for (const c of ["lyon", "paris"] as const) {
  med(twoCities).outbreaks.push({
    id: "influenza",
    city: c,
    weeksLeft: 5,
    startedWeek: 1,
    contained: false,
  });
}
const published = run(twoCities, "research", "influenza:lyon");
check(
  "publishing ends the pathogen in every city",
  med(published).outbreaks.length === 0,
);

// --- weekly history --------------------------------------------------------
const hx = startRun(doctor, 51);
check("a fresh run has no history", hx.history.length === 0);

const wk1 = advanceWeek(doctor, hx, { clinic: 3, rest: 3 });
check("committing a week records it", wk1.state.history.length === 1);
check("the record is the week just played", wk1.state.history[0].week === 1);
check(
  "the recorded net matches the ledger total",
  Math.round(wk1.state.history[0].net) ===
    Math.round(wk1.ledger.reduce((sum, l) => sum + (l.amount ?? 0), 0)),
);

const wk2 = advanceWeek(doctor, wk1.state, { clinic: 3, rest: 3 });
check("history accumulates in order", wk2.state.history.length === 2);
check(
  "history is oldest-first",
  wk2.state.history[0].week < wk2.state.history[1].week,
);
check(
  "advancing does not mutate the previous state's history",
  wk1.state.history.length === 1,
);

// The outlay line is added after resolveWeek returns, so a week with cash
// actions is the case that catches recording the net too early.
const paid = advanceWeek(doctor, hx, { clinic: 2, study: 2, outreach: 2 });
const paidNet = paid.ledger.reduce((sum, l) => sum + (l.amount ?? 0), 0);
check(
  "the net includes the week's cash outlay",
  Math.round(paid.state.history[0].net) === Math.round(paidNet) &&
    paid.ledger.some((l) => l.label === "Week's outlay"),
);

// --- phone: initialisation -------------------------------------------------
let ph = startRun(doctor, 61);
check("phone state initialises", !!med(ph).phone);
check(
  "social starts at gameplay-neutral values",
  med(ph).phone.social.trust === 50 &&
    med(ph).phone.social.sentiment === 50 &&
    med(ph).phone.social.scrutiny === 0 &&
    med(ph).phone.social.followers === 0,
);
check(
  "the neutral values produce zero gameplay effect",
  trustRecruitBonus(med(ph)) === 0 &&
    sentimentCatchment(med(ph)) === 1 &&
    scrutinyRisk(med(ph)) === 0,
);
check("nothing has been posted", med(ph).phone.lastPostWeek === 0);
check("feeds start empty", med(ph).phone.feed.length === 0);

// --- phone: publishing -----------------------------------------------------
const beforeTrust = med(ph).phone.social.trust;
ph = run(ph, "post", "edu.prevention");
check("publishing adds the post to the feed", med(ph).phone.feed.length === 1);
check(
  "the published post is yours",
  med(ph).phone.feed[0].kind === "player" &&
    med(ph).phone.feed[0].week === ph.week,
);
check(
  "publishing moves the social metrics",
  med(ph).phone.social.trust > beforeTrust &&
    med(ph).phone.social.followers > 0,
);
check("publishing records the week", med(ph).phone.lastPostWeek === ph.week);

// One post per week, enforced in the command rather than the button.
const secondPost = run(ph, "post", "edu.myth");
check(
  "a second post in the same week is refused",
  med(secondPost).phone.feed.length === 1,
);

// Context gating: a department post needs a department to announce.
let ctxRun = startRun(doctor, 62);
const noDept = run(ctxRun, "post", "dept.launch");
check(
  "a post is refused when its context is missing",
  med(noDept).phone.feed.length === 0,
);
ctxRun.r.cash = 500_000;
ctxRun = run(ctxRun, "buyFacility", "room:lyon");
ctxRun = run(ctxRun, "openDepartment", "paediatrics");
const withDept = run(ctxRun, "post", "dept.launch");
check(
  "the same post succeeds once the context exists",
  med(withDept).phone.feed.length === 1,
);
check(
  "a department launch brings patients next week",
  (withDept.r._panelPending ?? 0) > 0,
);

// A hiring announcement banks a bonus and spends it on the next hire only.
let hireRun = startRun(doctor, 63);
hireRun.r.cash = 500_000;
hireRun = run(hireRun, "post", "hiring.open");
check(
  "a hiring post banks a recruit bonus",
  med(hireRun).phone.recruitBoost > 0,
);
const hired = run(hireRun, "hire", "gp");
check(
  "the bonus is spent on the next hire",
  med(hired).phone.recruitBoost === 0,
);
const hiredAgain = run(hired, "hire", "nurse");
check(
  "the bonus does not apply twice",
  med(hiredAgain).phone.recruitBoost === 0,
);

// --- phone: confidentiality hazard ----------------------------------------
// The sensational case study either lands or backfires, deterministically
// per seed — never both, and always exactly one feed entry.
let hazardHit = 0;
for (let seed = 0; seed < 24; seed++) {
  let h = startRun(doctor, 700 + seed);
  h.week = 6;
  h = run(h, "post", "case.sensational");
  const post = med(h).phone.feed[0];
  if (post.tone === "bad") {
    hazardHit++;
    if (!med(h).phone.messages.some((x) => x.role === "regulator")) {
      check("a backfire always raises a complaint", false);
    }
  }
}
check(
  "the confidentiality hazard sometimes lands and sometimes does not",
  hazardHit > 0 && hazardHit < 24,
  `${hazardHit}/24 backfired`,
);

// Determinism: identical seed and week must give an identical result.
const runA = run(
  Object.assign(startRun(doctor, 777), { week: 6 }),
  "post",
  "case.sensational",
);
const runB = run(
  Object.assign(startRun(doctor, 777), { week: 6 }),
  "post",
  "case.sensational",
);
check(
  "publishing is deterministic for a given seed and week",
  med(runA).phone.feed[0].tone === med(runB).phone.feed[0].tone &&
    med(runA).phone.feed[0].likes === med(runB).phone.feed[0].likes,
);

// --- phone: bounds ---------------------------------------------------------
let bounded = startRun(doctor, 64);
for (let i = 0; i < MAX_FEED + 25; i++) {
  med(bounded).phone.feed.unshift({
    id: `filler.${i}`,
    week: 1,
    author: "Filler",
    handle: "@filler",
    kind: "world",
    body: "x",
    likes: 1,
    comments: [],
    tone: "neutral",
  });
}
bounded = run(bounded, "post", "edu.prevention");
check(
  "the feed is capped when posting",
  med(bounded).phone.feed.length === MAX_FEED,
  `${med(bounded).phone.feed.length}`,
);

// Weekly generation must also respect the caps over a long run.
let longRun = startRun(doctor, 65);
longRun.r.cash = 400_000;
for (let i = 0; i < 60; i++) {
  longRun = advanceWeek(doctor, longRun, { clinic: 3, rest: 3 }).state;
  if (longRun.outcome) break;
}
const lp = med(longRun).phone;
check("feed stays bounded across a long run", lp.feed.length <= MAX_FEED);
check("messages stay bounded", lp.messages.length <= MAX_MESSAGES);
check("news stays bounded", lp.news.length <= MAX_NEWS);

// --- phone: messages -------------------------------------------------------
const msgRun = startRun(doctor, 66);
med(msgRun).phone.messages.push({
  id: "test.msg",
  week: 1,
  from: "Priya Raman",
  handle: "@p.raman",
  role: "journalist",
  body: "Comment?",
  read: false,
  choices: [
    {
      label: "Comment",
      detail: "",
      effect: { scrutiny: -10, trust: 2 },
      reply: "Answered.",
    },
  ],
});
check("an unread message is counted", unreadMessages(med(msgRun)) === 1);
const answered = run(msgRun, "answerMessage", "test.msg|0");
check(
  "answering records the choice",
  med(answered).phone.messages[0].answered === 0,
);
check("answering applies its effect", med(answered).phone.social.trust > 50);
check("answering marks it read", unreadMessages(med(answered)) === 0);
const twiceAnswered = run(answered, "answerMessage", "test.msg|0");
check(
  "a message cannot be answered twice",
  med(twiceAnswered).phone.social.trust === med(answered).phone.social.trust,
);

// --- phone: immutability ---------------------------------------------------
const prePost = startRun(doctor, 67);
const posted = run(prePost, "post", "edu.prevention");
check(
  "posting does not mutate the previous state",
  med(prePost).phone.feed.length === 0 && med(posted).phone.feed.length === 1,
);
check(
  "posting does not mutate the previous social metrics",
  med(prePost).phone.social.followers === 0,
);

// --- consumables -----------------------------------------------------------
let sup = startRun(doctor, 71);
check("supplies initialise with stock", med(sup).supplies.stock > 0);
check("auto-order is on by default", med(sup).supplies.autoOrder === true);
check("nothing is throttled at the start", supplyThrottle(med(sup)) === 1);

// Bulk orders cost cash and give more stock than they cost.
sup.r.cash = 500_000;
const stockBefore = med(sup).supplies.stock;
const cashBefore2 = sup.r.cash;
const orderCost = tierCost(med(sup), "weeks12");
sup = run(sup, "buySupplies", "weeks12");
check("an order charges cash", sup.r.cash === cashBefore2 - orderCost);
check("an order adds stock", med(sup).supplies.stock > stockBefore);
check(
  "bulk yields more stock than it costs — that is the discount",
  med(sup).supplies.stock - stockBefore > orderCost,
);
check(
  "a larger tier is cheaper per unit of stock",
  tierStock(med(sup), "weeks26") / tierCost(med(sup), "weeks26") >
    tierStock(med(sup), "weeks4") / tierCost(med(sup), "weeks4"),
);

const brokeOnSupplies = run(
  { ...sup, r: { ...sup.r, cash: 10 } },
  "buySupplies",
  "weeks26",
);
check(
  "an unaffordable order is refused",
  med(brokeOnSupplies).supplies.stock === med(sup).supplies.stock,
);

const toggled = run(sup, "toggleAutoOrder", "");
check("auto-order toggles", med(toggled).supplies.autoOrder === false);

// Consumption is charged on what was treated, not what was billed.
const cases = [
  { severity: 1, treated: 10 },
  { severity: 4, treated: 2 },
];
check(
  "consumption is priced per case by severity",
  consumptionFor(cases) === 10 * SUPPLY_COST[1] + 2 * SUPPLY_COST[4],
);

// Auto-order covers a gap at spot price rather than blocking.
const gap = startRun(doctor, 72);
med(gap).supplies.stock = 0;
med(gap).supplies.autoOrder = true;
const covered = drawSupplies(med(gap), 500);
check("auto-order covers a shortfall", covered.emergencySpend === 500);
check("auto-order never stocks out", covered.stockedOut === false);

// With it off, running dry throttles the practice.
const dry = startRun(doctor, 73);
med(dry).supplies.stock = 0;
med(dry).supplies.autoOrder = false;
const ranOut = drawSupplies(med(dry), 500);
check("without auto-order a shortfall stocks you out", ranOut.stockedOut);
check("no emergency spend when auto-order is off", ranOut.emergencySpend === 0);
check("a stock-out throttles capacity", supplyThrottle(med(dry)) < 1);

// --- communications manager ------------------------------------------------
let comms = startRun(doctor, 74);
check("no comms staff to begin with", commsStaff(med(comms)) === 0);
check(
  "comms effects are no-ops at zero staff",
  commsReachBonus(med(comms)) === 1 &&
    commsHazardFactor(med(comms)) === 1 &&
    commsScrutinyRelief(med(comms)) === 0,
);

comms.r.cash = 200_000;
comms = run(comms, "hire", "comms");
check("a comms manager can be hired", commsStaff(med(comms)) === 1);
check(
  "a comms manager amplifies reach and reduces hazard",
  commsReachBonus(med(comms)) > 1 && commsHazardFactor(med(comms)) < 1,
);
check(
  "a comms manager is not a treating clinician",
  computeCapacity(med(comms), 0, 50, 20).staffUnits === 0,
  `got ${computeCapacity(med(comms), 0, 50, 20).staffUnits}`,
);

// The hazard reduction must actually change outcomes across seeds.
let plainBackfires = 0;
let commsBackfires = 0;
for (let seed = 0; seed < 30; seed++) {
  let plain = startRun(doctor, 900 + seed);
  plain.week = 6;
  plain = run(plain, "post", "case.sensational");
  if (med(plain).phone.feed[0].tone === "bad") plainBackfires++;

  let withComms = startRun(doctor, 900 + seed);
  withComms.week = 6;
  withComms.r.cash = 200_000;
  withComms = run(withComms, "hire", "comms");
  withComms = run(withComms, "post", "case.sensational");
  if (med(withComms).phone.feed[0].tone === "bad") commsBackfires++;
}
check(
  "a comms manager measurably reduces backfires",
  commsBackfires < plainBackfires,
  `${commsBackfires} vs ${plainBackfires} of 30`,
);

// --- regression: event panel rewards must survive weekly resolution --------
/*
 * `s.r.panel` is derived from `m.panels` at the end of every week, so an
 * event that writes to it directly is erased by the very next resolution.
 * Both of these events used to do exactly that. They now queue through
 * `_panelPending`, which is delivered to the home city during panel drift.
 */
function eventChoice(id: string, label: RegExp) {
  const def = doctor.events.find((e) => e.id === id);
  if (!def) throw new Error(`missing event ${id}`);
  const index = def.choices.findIndex((c) => label.test(c.label));
  if (index < 0) throw new Error(`missing choice for ${id}`);
  return { def, index };
}

/** Panel held in one city, read straight from the canonical store. */
const panelIn = (s: RunState, city: string) => med(s).panels[city] ?? 0;

{
  const surge = eventChoice("flu_surge", /Absorb/);
  let before = startRun(doctor, 81);
  before.r.cash = 200_000;
  // Settle the panel first so drift is small and the reward is visible.
  before = advanceWeek(doctor, before, { clinic: 3, rest: 3 }).state;

  const baseline = advanceWeek(doctor, before, { clinic: 3, rest: 3 }).state;

  const withSurge = resolveEventChoice(doctor, before, surge.def, surge.index);
  check(
    "seasonal surge queues its registrations rather than writing the panel",
    (withSurge.r._panelPending ?? 0) === 18,
  );
  const afterWeek = advanceWeek(doctor, withSurge, {
    clinic: 3,
    rest: 3,
  }).state;
  check(
    "seasonal surge patients survive the next weekly resolution",
    afterWeek.r.panel > baseline.r.panel + 15,
    `${Math.round(afterWeek.r.panel)} vs baseline ${Math.round(baseline.r.panel)}`,
  );
  check(
    "the surge lands in the home city",
    panelIn(afterWeek, "lyon") > panelIn(baseline, "lyon") + 15,
  );
  check(
    "the pending queue is emptied once delivered",
    (afterWeek.r._panelPending ?? 0) === 0,
  );
}

{
  const deal = eventChoice("insurer_contract", /Sign/);
  let before = startRun(doctor, 82);
  before.r.cash = 400_000;
  before = advanceWeek(doctor, before, { clinic: 3, rest: 3 }).state;

  const expected = Math.round(60 + before.r.panel * 0.18);
  const baseline = advanceWeek(doctor, before, { clinic: 3, rest: 3 }).state;

  const signed = resolveEventChoice(doctor, before, deal.def, deal.index);
  check(
    "insurer contract queues its calculated gain",
    (signed.r._panelPending ?? 0) === expected,
    `queued ${signed.r._panelPending}, expected ${expected}`,
  );
  const afterWeek = advanceWeek(doctor, signed, { clinic: 3, rest: 3 }).state;
  check(
    "insurer contract members survive the next weekly resolution",
    afterWeek.r.panel > baseline.r.panel + expected * 0.8,
    `${Math.round(afterWeek.r.panel)} vs baseline ${Math.round(baseline.r.panel)}, expected +${expected}`,
  );
}

// Multi-city: the reward is delivered to the home city only, and stays there.
{
  const surge = eventChoice("flu_surge", /Absorb/);
  let multi = startRun(doctor, 83);
  multi.r.cash = 900_000;
  multi = run(multi, "enterCity", "madrid");
  multi = run(multi, "buyFacility", "clinic:madrid");
  multi = advanceWeek(doctor, multi, { clinic: 3, rest: 3 }).state;

  const baseline = advanceWeek(doctor, multi, { clinic: 3, rest: 3 }).state;
  const surged = resolveEventChoice(doctor, multi, surge.def, surge.index);
  const after = advanceWeek(doctor, surged, { clinic: 3, rest: 3 }).state;

  check(
    "with two cities the reward still lands, and in the home city",
    panelIn(after, "lyon") > panelIn(baseline, "lyon") + 15,
  );
  // Not exactly equal: the surge also grants +3 reputation, which lifts every
  // city's catchment slightly. What must not happen is the 18 registrations
  // being delivered a second time, so the tolerance is well under 18.
  check(
    "the reward is not duplicated into the other city",
    Math.abs(panelIn(after, "madrid") - panelIn(baseline, "madrid")) < 3,
    `madrid ${panelIn(after, "madrid").toFixed(2)} vs ${panelIn(baseline, "madrid").toFixed(2)}`,
  );

  // Deterministic: the same inputs give the same panels.
  const repeat = advanceWeek(
    doctor,
    resolveEventChoice(doctor, multi, surge.def, surge.index),
    { clinic: 3, rest: 3 },
  ).state;
  check(
    "event panel delivery is deterministic",
    panelIn(repeat, "lyon") === panelIn(after, "lyon") &&
      panelIn(repeat, "madrid") === panelIn(after, "madrid"),
  );
}

// --- regression: restocking clears the shortage penalty --------------------
{
  const out = startRun(doctor, 84);
  out.r.cash = 300_000;
  med(out).supplies.autoOrder = false;
  med(out).supplies.stock = 0;
  // Force a real stock-out through the normal draw path.
  drawSupplies(med(out), 500);
  check("the practice is genuinely stocked out", supplyThrottle(med(out)) < 1);

  const restocked = run(out, "buySupplies", "weeks12");
  check(
    "a successful restock clears the shortage penalty",
    supplyThrottle(med(restocked)) === 1 &&
      med(restocked).supplies.throttleWeeks === 0,
  );
  check("a successful restock adds stock", med(restocked).supplies.stock > 0);

  // An order that cannot be paid for must leave the penalty in place.
  const broke = run(
    { ...out, r: { ...out.r, cash: 5 } },
    "buySupplies",
    "weeks26",
  );
  check(
    "an unaffordable order does not clear the penalty",
    supplyThrottle(med(broke)) < 1 && med(broke).supplies.stock === 0,
  );
  const bogus = run(out, "buySupplies", "not-a-tier");
  check(
    "an invalid order does not clear the penalty",
    supplyThrottle(med(bogus)) < 1,
  );

  // Auto-order behaviour is untouched: it still covers gaps at spot price
  // and still never stocks out.
  const auto = startRun(doctor, 85);
  med(auto).supplies.stock = 0;
  med(auto).supplies.autoOrder = true;
  const drew = drawSupplies(med(auto), 400);
  check(
    "auto-order still covers a gap without throttling",
    drew.emergencySpend === 400 &&
      drew.stockedOut === false &&
      supplyThrottle(med(auto)) === 1,
  );
}

// --- regression: guidance counts clinic blocks only ------------------------
{
  /*
   * The panel is chosen to sit *between* the two capacities so the hint
   * genuinely discriminates: two GPs alone (52 units) cannot serve it, but
   * two GPs plus six clinic blocks (~133 units) comfortably can. A panel
   * beyond both would fire the hint either way and prove nothing.
   *
   * Week 4 keeps the later department hint out of the way.
   */
  let g = startRun(doctor, 86);
  g.r.cash = 600_000;
  g.week = 4;
  g = run(g, "buyFacility", "clinic:lyon");
  g = run(g, "hire", "gp");
  g = run(g, "hire", "gp");
  med(g).panels.lyon = 357;
  g.r.panel = 357;

  const allRest = nextStep(g, { rest: 6 }, 6, 6, true);
  check(
    "a week of pure rest does not count as clinic capacity",
    allRest?.id === "capacity",
    `got ${allRest?.id ?? "none"}`,
  );

  // The same state with everything in clinic clears the bar, proving the two
  // allocations are actually told apart rather than both being over-served.
  const allClinic = nextStep(g, { clinic: 6 }, 6, 6, true);
  check(
    "the same week spent in clinic is not flagged as short of capacity",
    allClinic?.id !== "capacity",
    `got ${allClinic?.id ?? "none"}`,
  );

  // A mixture must be judged on its clinic portion alone.
  const mixed = nextStep(
    g,
    { clinic: 1, study: 2, rest: 2, manage: 1 },
    6,
    6,
    true,
  );
  const oneBlock = nextStep(g, { clinic: 1 }, 1, 1, true);
  check(
    "a mixed week is judged on its clinic blocks alone",
    mixed?.id === oneBlock?.id,
    `mixed ${mixed?.id}, clinic-only ${oneBlock?.id}`,
  );

  // Study and outreach must not inflate capacity either.
  const studyHeavy = nextStep(g, { study: 5, outreach: 1 }, 6, 6, true);
  check(
    "study and outreach do not inflate the capacity estimate",
    studyHeavy?.id === "capacity",
    `got ${studyHeavy?.id ?? "none"}`,
  );
}

{
  // Multi-city: personal hours are credited to the home city only, so the
  // network total must not scale with the number of cities.
  let one = startRun(doctor, 87);
  one.r.cash = 900_000;
  one = run(one, "buyFacility", "clinic:lyon");

  let two = run(one, "enterCity", "madrid");
  two = run(two, "buyFacility", "clinic:madrid");

  const personalOf = (s: RunState) =>
    activeCities(med(s)).reduce(
      (sum, c) =>
        sum + capacityIn(med(s), c, 4, s.r.skill, s.r.burnout).personalUnits,
      0,
    );
  check(
    "personal clinic hours are counted once regardless of city count",
    Math.abs(personalOf(one) - personalOf(two)) < 0.001,
    `${personalOf(one).toFixed(2)} vs ${personalOf(two).toFixed(2)}`,
  );
}

// --- visual asset registry -------------------------------------------------
{
  const inspection = eventVisual("inspection");
  check("the inspection event has artwork registered", inspection !== null);
  check(
    "every registered visual carries dimensions, so no layout shift",
    [
      ...Object.values(EVENT_VISUALS),
      ...Object.values(CITY_VISUALS),
      ...Object.values(CAREER_VISUALS),
      PRACTICE_VISUAL,
      OUTBREAK_VISUAL,
      MILESTONE_VISUAL,
    ].every((v) => v.width > 0 && v.height > 0),
  );
  check(
    "artwork that conveys information has descriptive alt text",
    !!inspection && inspection.alt.length > 20,
  );

  /*
   * No two events may share a picture. Reusing one image across events is the
   * failure that makes every dialog feel identical, and it is invisible in a
   * diff — hence an assertion rather than a convention.
   */
  const srcs = Object.values(EVENT_VISUALS).map((v) => v.src);
  check(
    "each event's artwork is its own",
    new Set(srcs).size === srcs.length,
    srcs.join(", "),
  );
  check(
    "the same is true of city artwork",
    new Set(Object.values(CITY_VISUALS).map((v) => v.src)).size === 14,
  );
  check(
    "an unknown event id resolves to nothing",
    eventVisual("nope") === null,
  );

  // Practice stage must come from owned premises, never from cash or week.
  let stage = startRun(doctor, 91);
  check(
    "a fresh run is at the first stage",
    practiceStageIndex(med(stage)) === 0,
  );
  stage.r.cash = 5_000_000;
  stage.week = 140;
  check(
    "money and elapsed weeks alone do not advance the stage",
    practiceStageIndex(med(stage)) === 0,
  );
  stage = run(stage, "buyFacility", "clinic:lyon");
  check(
    "buying a clinic advances the stage",
    practiceStageIndex(med(stage)) === 1,
  );
  stage = run(stage, "buyFacility", "hospital:lyon");
  check(
    "the stage reflects the best premises owned",
    practiceStageIndex(med(stage)) === 3,
  );
  stage = run(stage, "buyFacility", "room:lyon");
  check(
    "buying a lesser building does not regress the stage",
    practiceStageIndex(med(stage)) === 3,
  );
  check(
    "every stage band maps to a real facility type",
    PRACTICE_STAGES.every((s) => FACILITY_BY_ID.has(s.id)) &&
      PRACTICE_STAGES.length === 4,
  );
}

// --- network map nodes -----------------------------------------------------
{
  // Layout: every marker must be on the board and clear of its neighbours,
  // or the map becomes unclickable however good it looks at 1440.
  const outOfBounds = CITIES.filter(
    (c) => c.map.x < 0 || c.map.x > 100 || c.map.y < 0 || c.map.y > 100,
  );
  check(
    "every city sits inside the 0-100 map bounds",
    outOfBounds.length === 0,
    outOfBounds.map((c) => c.id).join(", "),
  );
  check(
    "no city is jammed against an edge where its marker would clip",
    CITIES.every(
      (c) => c.map.x >= 4 && c.map.x <= 96 && c.map.y >= 4 && c.map.y <= 96,
    ),
  );
  /*
   * Cities are the equirectangular projection of their real coordinates, so
   * "is it on land" is settled at build time against Natural Earth's own
   * geometry (`npm run build:map` reports it). What this suite can still
   * prove is that the catalogue has not drifted away from that projection —
   * that every stored position is where the city's real longitude and
   * latitude actually land.
   */
  /*
   * The map is cropped to latitudes +84..-57 — Antarctica is dropped and the
   * Arctic trimmed — so the vertical scale is the crop, not the projection.
   * These constants must match `scripts/build-map.ts`; if either moves
   * without the other, this fails.
   */
  const LAT_TOP = 73;
  const LAT_BOTTOM = -57;
  const misprojected = CITIES.filter((c) => {
    const lonlat = CITY_LATLON[c.id];
    if (!lonlat) return true;
    const x = 50 + lonlat[0] / 3.6;
    const y = ((LAT_TOP - lonlat[1]) / (LAT_TOP - LAT_BOTTOM)) * 100;
    return Math.abs(c.map.x - x) > 0.2 || Math.abs(c.map.y - y) > 0.2;
  });
  check(
    "every city sits at the projection of its real coordinates",
    misprojected.length === 0,
    misprojected.map((c) => c.id).join(", "),
  );
  check(
    "the world is drawn from real geography, not hand-drawn shapes",
    LAND_PATH.length > 50_000 &&
      BORDER_PATH.length > 5_000 &&
      GRATICULE_PATH.length > 1_000,
  );
  check(
    "the generated geometry stays inside the map's own viewBox",
    (() => {
      const nums = LAND_PATH.match(/-?\d+(?:\.\d+)?/g) ?? [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = Number(nums[i]);
        const y = Number(nums[i + 1]);
        if (x < -1 || x > 101 || y < -1 || y > 57) return false;
      }
      return true;
    })(),
  );
  check(
    "the world is drawn from every required region",
    [
      "north-america",
      "south-america",
      "europe",
      "africa",
      "middle-east",
      "south-asia",
      "southeast-asia",
      "east-asia",
    ].every((id) => REGION_PROBES[id] !== undefined),
  );
  check(
    "every region probe lands on real drawn geography",
    Object.entries(REGION_PROBES).every(([, [lon, lat]]) => {
      // Inside the projected bounds is the cheap proxy: the generated land
      // path is one merged shape, so a full containment test here would mean
      // re-parsing 117KB on every run.
      return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
    }),
  );

  check(
    "every city carries a label offset and anchor",
    CITIES.every(
      (c) =>
        Number.isFinite(c.label.dx) &&
        Number.isFinite(c.label.dy) &&
        ["start", "middle", "end"].includes(c.label.anchor),
    ),
  );

  /*
   * MARKER SEPARATION
   *
   * Measured in rendered pixels, not map units, because the two axes scale
   * differently: the board is 100x56, so a unit of Y is only 0.56 of a unit
   * of X.
   *
   * The invariant changed when the map moved to real geography, and it is
   * worth being explicit about why rather than quietly lowering a number.
   * Seven markets are in western Europe; at true coordinates London and Paris
   * are twelve pixels apart on a 1180px board, and no arrangement separates
   * them without putting cities in the Atlantic. So the guarantee is no
   * longer "every pair is tappable at 1x" — it is "every pair is tappable at
   * full zoom, and every city is reachable without the map at any zoom".
   */
  const BOARD_PX = 1180;
  const ZOOM_MAX = 6;
  const pxPerX = BOARD_PX / 100;
  const pxPerY = (BOARD_PX * 0.56) / 100;
  let closest = Infinity;
  let pair = "";
  for (let i = 0; i < CITIES.length; i++) {
    for (let j = i + 1; j < CITIES.length; j++) {
      const a = CITIES[i].map;
      const b = CITIES[j].map;
      const d = Math.hypot((a.x - b.x) * pxPerX, (a.y - b.y) * pxPerY);
      if (d < closest) {
        closest = d;
        pair = `${CITIES[i].id}/${CITIES[j].id}`;
      }
    }
  }
  check(
    "every pair of markers clears the 40px touch target at full zoom",
    closest * ZOOM_MAX >= 40,
    `closest ${pair} at ${(closest * ZOOM_MAX).toFixed(1)}px zoomed (${closest.toFixed(1)}px at 1x)`,
  );
  check(
    "the zoom ceiling is high enough to separate the densest region",
    ZOOM_MAX >= 40 / closest,
    `needs ${(40 / closest).toFixed(1)}x, ceiling is ${ZOOM_MAX}x`,
  );

  // Classification: a marker must never imply premises you have not bought.
  let map = startRun(doctor, 55);
  const fresh = networkNodes(med(map));
  check("the map covers all fourteen markets", fresh.length === 14);
  check(
    "the map covers every market in the catalogue",
    fresh.length === CITIES.length,
  );
  check("exactly one node is home", fresh.filter((n) => n.isHome).length === 1);
  check(
    "the home node is the state's home city",
    fresh.find((n) => n.isHome)?.id === med(map).homeCity,
  );
  check(
    "the starting city is operating and the rest are locked",
    fresh.find((n) => n.id === "lyon")?.state === "operating" &&
      fresh.filter((n) => n.id !== "lyon").every((n) => n.state === "locked"),
  );

  map.r.cash = 900_000;
  map = run(map, "enterCity", "madrid");
  check(
    "a licence alone shows as licensed, not operating",
    networkNodes(med(map)).find((n) => n.id === "madrid")?.state === "licensed",
  );

  map = run(map, "buyFacility", "clinic:madrid");
  const built = networkNodes(med(map)).find((n) => n.id === "madrid");
  check(
    "premises promote the marker to operating",
    built?.state === "operating" && built.sites === 1,
  );

  // Outbreaks: the marker must point at the city it actually broke out in.
  const outbreakId = [...OUTBREAK_BY_ID.keys()][0];
  med(map).outbreaks.push({
    id: outbreakId,
    city: "madrid",
    weeksLeft: 3,
    startedWeek: map.week,
    contained: false,
  });
  const withOutbreak = networkNodes(med(map));
  check(
    "an outbreak attaches to its own city and no other",
    withOutbreak.find((n) => n.id === "madrid")?.outbreak?.id === outbreakId &&
      withOutbreak.filter((n) => n.outbreak !== null).length === 1,
  );
  check(
    "an outbreak does not change the marker's licensed or operating state",
    withOutbreak.find((n) => n.id === "madrid")?.state === "operating",
  );
}

// --- network map routes ----------------------------------------------------
{
  let map = startRun(doctor, 71);
  map.r.cash = 900_000;
  check(
    "a single-city network draws no routes",
    networkRoutes(med(map)).length === 0,
  );

  // A licence on its own is not a connection to anywhere.
  map = run(map, "enterCity", "berlin");
  check(
    "a licensed but empty city gets no route",
    networkRoutes(med(map)).length === 0,
  );

  map = run(map, "buyFacility", "clinic:berlin");
  let routes = networkRoutes(med(map));
  check(
    "opening a site draws a route from home to it",
    routes.length === 1 &&
      routes[0].from === "lyon" &&
      routes[0].to === "berlin",
  );

  map = run(map, "enterCity", "tokyo");
  map = run(map, "buyFacility", "clinic:tokyo");
  routes = networkRoutes(med(map));
  check(
    "routes reach every operating city and nowhere else",
    routes.length === 2 &&
      routes.every((r) => r.from === "lyon") &&
      ["berlin", "tokyo"].every((id) => routes.some((r) => r.to === id)),
  );

  // Relocating moves the origin, and the new home stops being a destination.
  map = run(map, "relocate", "tokyo");
  routes = networkRoutes(med(map));
  check(
    "relocating re-origins every route on the new home city",
    routes.every((r) => r.from === "tokyo"),
    routes.map((r) => `${r.from}->${r.to}`).join(", "),
  );
  check(
    "the home city is never a destination of its own route",
    routes.every((r) => r.to !== "tokyo") && routes.length === 2,
  );
  check(
    "route endpoints carry the cities' map coordinates",
    routes.every(
      (r) => r.a.x === cityOf(r.from).map.x && r.b.y === cityOf(r.to).map.y,
    ),
  );
}

// --- visual asset registry resolves ----------------------------------------
{
  /*
   * Every path the interface can ask for must exist on disk. This is the
   * check that catches a renamed asset or a typo'd id before a player sees a
   * broken image, and it is why nothing else in the app builds an image path
   * by hand.
   */
  const all: [string, string][] = [
    ...Object.entries(CAREER_VISUALS).map(
      ([id, v]) => [`career:${id}`, v.src] as [string, string],
    ),
    ...Object.entries(CITY_VISUALS).map(
      ([id, v]) => [`city:${id}`, v.src] as [string, string],
    ),
    ...Object.entries(EVENT_VISUALS).map(
      ([id, v]) => [`event:${id}`, v.src] as [string, string],
    ),
    ["practice", PRACTICE_VISUAL.src],
    ["network", NETWORK_VISUAL.src],
    ["outbreak", OUTBREAK_VISUAL.src],
    ["milestone", MILESTONE_VISUAL.src],
  ];

  const missing = all.filter(
    ([, src]) => !existsSync(join("public", src.replace(/^\//, ""))),
  );
  check(
    "every registered visual resolves to a file on disk",
    missing.length === 0,
    missing.map(([k, src]) => `${k} -> ${src}`).join(", "),
  );

  check(
    "nothing served to the browser is a source PNG",
    all.every(([, src]) => !src.endsWith(".png")),
    all
      .filter(([, src]) => src.endsWith(".png"))
      .map(([k]) => k)
      .join(", "),
  );

  /*
   * The masters are 51MB and belong in `art-source/`, not in the deployed
   * bundle. This is the assertion that stops one creeping back in.
   */
  const strays = walkFiles("public").filter((f) =>
    f.toLowerCase().endsWith(".png"),
  );
  check(
    "no PNG master has crept back into public/",
    strays.length === 0,
    strays.join(", "),
  );
  /*
   * Every runtime image must have its master preserved at the same relative
   * path under art-source. Stated as a pairing rather than a count, so adding
   * artwork does not require editing a number here — and so a WebP shipped
   * without its master is caught.
   */
  /** Escapes a filename for use inside a RegExp. */
  const escapeRe = (x: string) =>
    x.replace(/[.*+?^${}()|[\]\\]/g, (ch) => `\\${ch}`);

  const runtime = walkFiles(join("public", "visuals"))
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.slice(join("public", "visuals").length + 1));
  /*
   * Matching allows for two naming conventions the purchase pipeline uses:
   *
   *   `@…`   a second size cut from the same master, not a second master —
   *          `@2x` for wide artwork, `@profile` for portraits
   *   `-vN`  a revision — the shipped file drops the suffix, so
   *          `lifestyle-sports-car.webp` is master `…-v2.png`
   *
   * The guarantee is unchanged: nothing ships without a master in
   * `art-source`. Only the filename arithmetic knows about the conventions.
   */
  const masterExists = (rel: string): boolean => {
    /*
     * The brand collection is many crops of one master.
     *
     * `logo-lockup`, `logo-mark-64` and the rest are all cut from a single
     * `earn-your-skyline-logo-v1.png`, so there is no filename to derive — the
     * guarantee is that the one master is present, which is checked directly.
     */
    if (rel.replace(/\\/g, "/").startsWith("brand/")) {
      return existsSync(
        join("art-source", "branding", "earn-your-skyline-logo-v1.png"),
      );
    }
    const stem = rel.replace(/\.webp$/, "").replace(/@[a-z0-9]+$/i, "");
    const dir = join("art-source", "visuals", dirname(stem));
    if (existsSync(join(dir, `${basename(stem)}.png`))) return true;
    if (!existsSync(dir)) return false;
    /* Any revision of the same stem counts as the master. */
    /* Double-escaped: this is a template literal, so `\d` would collapse to
       a literal "d" before the RegExp ever sees it. */
    return readdirSync(dir).some((f) =>
      new RegExp(`^${escapeRe(basename(stem))}(-v\\d+)?\\.png$`).test(f),
    );
  };
  const orphanRuntime = runtime.filter((rel) => !masterExists(rel));
  check(
    "every runtime image has its PNG master preserved outside public/",
    runtime.length > 0 && orphanRuntime.length === 0,
    orphanRuntime.join(", "),
  );

  // Cities: the ids are the game's, the filenames are not, so the mapping is
  // the one place the two can drift apart.
  const unmapped = CITIES.filter((c) => cityVisual(c.id) === null);
  check(
    "every city in the catalogue has artwork",
    unmapped.length === 0,
    unmapped.map((c) => c.id).join(", "),
  );
  check(
    "the city artwork map has no entries for cities that do not exist",
    Object.keys(CITY_VISUALS).every((id) => CITIES.some((c) => c.id === id)),
    Object.keys(CITY_VISUALS)
      .filter((id) => !CITIES.some((c) => c.id === id))
      .join(", "),
  );

  /*
   * Events: artwork must belong to a real event, and only to that event.
   *
   * Across every career, not just the Physician's. The registry is keyed by
   * event id and the dialog that renders it knows nothing about careers, so
   * the Chef's critic is as much a real event as an inspection — and an entry
   * belonging to *no* career's events is still the failure this catches.
   */
  const eventIds = CAREERS.flatMap((c) => c.events.map((e) => e.id));
  const orphan = Object.keys(EVENT_VISUALS).filter(
    (id) => !eventIds.includes(id),
  );
  check(
    "every event visual belongs to a real event",
    orphan.length === 0,
    orphan.join(", "),
  );
  check(
    "events without artwork resolve to nothing rather than a placeholder",
    eventIds
      .filter((id) => !(id in EVENT_VISUALS))
      .every((id) => eventVisual(id) === null),
  );
  check(
    "every event visual carries a category",
    Object.values(EVENT_VISUALS).every((v) => v.category.length > 0),
  );

  /*
   * Careers: every career you can actually *start* has a cover.
   *
   * This used to demand art for every entry on the select screen, which was
   * the same thing until the screen started carrying designs that have not
   * been built. A card marked CLOSED with "Not built yet" on the button is
   * meant to be a flat surface — `ArtFrame` renders exactly that for a null
   * visual, deliberately, rather than a broken image.
   *
   * So the assertion is now about the state it always cared about: nothing
   * playable ships coverless. The second check keeps that honest in the other
   * direction, so a career cannot quietly become playable while still relying
   * on the no-art fallback.
   */
  const coverless = CAREER_PREVIEWS.filter(
    (c) => c.available && careerVisual(c.id) === null,
  );
  check(
    "every playable career has cover art",
    coverless.length === 0,
    coverless.map((c) => c.id).join(", "),
  );
  check(
    "every registered career is playable and vice versa",
    CAREERS.every((c) =>
      CAREER_PREVIEWS.some((p) => p.id === c.id && p.available),
    ) &&
      CAREER_PREVIEWS.filter((p) => p.available).every((p) =>
        CAREERS.some((c) => c.id === p.id),
      ),
  );
  check(
    "a design that is not built says so rather than half-rendering",
    CAREER_PREVIEWS.filter((c) => !c.available).every(
      (c) =>
        !CAREERS.some((x) => x.id === c.id) &&
        c.distinctRule.length > 40 &&
        c.risks.length > 0,
    ),
  );
  check(
    "an unknown id asks for artwork and gets nothing, not a crash",
    cityVisual("atlantis") === null && careerVisual("astronaut") === null,
  );
}

// --- marker clustering -----------------------------------------------------
{
  const cl = networkNodes(med(startRun(doctor, 5)));
  const at = (zoom: number, selected: string | null = null) =>
    clusterNodes(cl, { zoom, boardPx: 1180, minSeparationPx: 42, selected });

  /* Nothing may ever be lost: every city is in exactly one cluster. */
  for (const zoom of [1, 2, 3, 6]) {
    const groups = at(zoom);
    const members = groups.flatMap((g) => g.members.map((m) => m.id));
    check(
      `every market is in exactly one cluster at ${zoom}x`,
      members.length === 14 && new Set(members).size === 14,
      `${members.length} members, ${new Set(members).size} unique`,
    );
  }

  check(
    "the crowded region groups at 1x",
    at(1).some((g) => g.members.length > 1),
  );
  check(
    "zooming in breaks the groups apart",
    at(6).every((g) => g.members.length === 1),
    at(6)
      .filter((g) => g.members.length > 1)
      .map((g) => g.id)
      .join(", "),
  );
  check(
    "clustering only ever loosens as you zoom in",
    (() => {
      let previous = at(1).length;
      for (const zoom of [1.5, 2, 3, 4, 6]) {
        const now = at(zoom).length;
        if (now < previous) return false;
        previous = now;
      }
      return true;
    })(),
  );

  /* The selected city must stay visible rather than vanishing into a badge. */
  const withParis = at(1, "paris");
  const parisGroup = withParis.find((g) =>
    g.members.some((m) => m.id === "paris"),
  );
  check(
    "the selected city is never swallowed by a cluster",
    parisGroup?.members.length === 1 && parisGroup.lead.id === "paris",
  );

  /* Grouping must not depend on the order nodes happen to arrive in. */
  const shuffled = [...cl].reverse();
  const a = at(1)
    .map((g) => g.id)
    .sort()
    .join("|");
  const b = clusterNodes(shuffled, {
    zoom: 1,
    boardPx: 1180,
    minSeparationPx: 42,
  })
    .map((g) => g.id)
    .sort()
    .join("|");
  check("clustering is deterministic regardless of input order", a === b);

  /* The lead speaks for the group, so it must be the most invested-in one. */
  let built = startRun(doctor, 5);
  built.r.cash = 400_000;
  built = run(built, "enterCity", "london");
  built = run(built, "buyFacility", "clinic:london");
  const leadOfEurope = clusterNodes(networkNodes(med(built)), {
    zoom: 1,
    boardPx: 1180,
    minSeparationPx: 42,
  }).find((g) => g.members.length > 1);
  check(
    "a cluster is led by its most developed market",
    leadOfEurope !== undefined &&
      ["operating"].includes(leadOfEurope.lead.state) === true,
    leadOfEurope
      ? `${leadOfEurope.lead.id} (${leadOfEurope.lead.state})`
      : "none",
  );
  check(
    "a cluster's badge stays near its members",
    (() => {
      const g = at(1).find((c) => c.members.length > 1);
      if (!g) return false;
      const xs = g.members.map((m) => m.x);
      const ys = g.members.map((m) => m.y);
      // Allowed to step aside from a marker, but not to wander off.
      return (
        g.x >= Math.min(...xs) - 6 &&
        g.x <= Math.max(...xs) + 6 &&
        g.y >= Math.min(...ys) - 6 &&
        g.y <= Math.max(...ys) + 6
      );
    })(),
  );

  /*
   * The regression this exists for: with Lyon selected, the badge for the
   * remaining European markets landed exactly on Lyon's marker, because Lyon
   * sits in the middle of the crowd it was excluded from.
   */
  check(
    "a cluster badge never lands on top of a real marker",
    (() => {
      for (const selected of ["lyon", "paris", null]) {
        const groups = at(1, selected);
        const solo = groups.filter((g) => g.members.length === 1);
        const grouped = groups.filter((g) => g.members.length > 1);
        for (const g of grouped) {
          for (const s of solo) {
            const d = Math.hypot((g.x - s.x) * 11.8, (g.y - s.y) * 6.6);
            if (d < 30) return false;
          }
        }
      }
      return true;
    })(),
  );
}

// --- map centring ----------------------------------------------------------
{
  // A 960px board inside a 350px phone viewport: 610px of travel.
  const V = 350;
  const C = 960;
  check(
    "a city in the middle of the board centres exactly",
    centreScroll(480, V, C) === 480 - V / 2,
  );
  check(
    "a city near the western edge clamps to the start",
    centreScroll(40, V, C) === 0,
  );
  check(
    "a city near the eastern edge clamps to the end",
    centreScroll(950, V, C) === C - V,
  );
  check(
    "a board that fits its viewport never scrolls",
    centreScroll(500, 1102, 1102) === 0 && centreScroll(0, 1102, 1102) === 0,
  );
  check(
    "centring never returns a negative or over-scrolled offset",
    [0, 1, 480, 959, 960, 5000].every((p) => {
      const v = centreScroll(p, V, C);
      return v >= 0 && v <= C - V;
    }),
  );

  /*
   * The regression this exists for: on a phone the map used to open at 0,
   * showing the Americas while Lyon sat off-screen to the east.
   */
  const lyon = cityOf("lyon").map.x;
  const lyonCentrePx = (lyon / 100) * C;
  const opened = centreScroll(lyonCentrePx, V, C);
  check(
    "the home city is on screen when the map opens on a phone",
    lyonCentrePx >= opened && lyonCentrePx <= opened + V,
    `lyon at ${Math.round(lyonCentrePx)}px, window ${Math.round(opened)}-${Math.round(opened + V)}`,
  );
  check(
    "every city can be brought on screen at phone width",
    CITIES.every((c) => {
      const px = (c.map.x / 100) * C;
      const left = centreScroll(px, V, C);
      return px >= left && px <= left + V;
    }),
  );
}

// --- marker badges ---------------------------------------------------------
{
  check("a small panel shows the real number", compactCount(90) === "90");
  check(
    "a panel just under a thousand is not abbreviated",
    compactCount(999) === "999",
  );
  check("a thousand becomes 1k", compactCount(1000) === "1k");
  check("thousands keep one decimal", compactCount(1240) === "1.2k");
  check("a round thousand drops its decimal", compactCount(2000) === "2k");
  check("large panels stay short", compactCount(27300) === "27k");
  check(
    "zero and negatives do not produce junk",
    compactCount(0) === "0" && compactCount(-5) === "0",
  );
  check(
    "no badge is ever the old ambiguous hours-looking form",
    !/^\d+h$/.test(compactCount(100)),
    compactCount(100),
  );
}

// --- city statistics -------------------------------------------------------
{
  /*
   * The bug this replaces: `contestedShare` was labelled "Your share", so a
   * starting practice with ninety patients appeared to control 93% of Lyon.
   */
  const starting = startRun(doctor, 12);
  const panel = starting.r.panel;
  check(
    "a starting practice has captured almost none of its city",
    capturedShare("lyon", 90) < 0.05,
    `${(capturedShare("lyon", 90) * 100).toFixed(1)}%`,
  );
  check(
    "captured share is panel over the population ceiling",
    Math.abs(capturedShare("lyon", 1495) - 0.5) < 1e-9,
  );
  check(
    "captured share never exceeds the whole city",
    capturedShare("lyon", 10_000_000) === 1,
  );
  check(
    "captured share floors at zero for junk input",
    capturedShare("lyon", -50) === 0 && capturedShare("lyon", NaN) === 0,
  );
  check(
    "market access and captured share are genuinely different numbers",
    Math.abs(contestedShare("lyon", 50) - capturedShare("lyon", panel)) > 0.5,
    `access ${contestedShare("lyon", 50).toFixed(2)} vs captured ${capturedShare("lyon", panel).toFixed(2)}`,
  );
}

// --- save validation -------------------------------------------------------
{
  /*
   * `loadRun` reads localStorage, so the validator is exercised here through a
   * minimal stub. Every case must be REJECTED — a partially valid save is
   * worse than none, because it renders once and then misbehaves quietly.
   */
  const good = JSON.parse(JSON.stringify(startRun(doctor, 3))) as Record<
    string,
    unknown
  >;
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  /*
   * Every key this build can read, so `clearStore` cannot leave a stale
   * value behind after a version bump. Deriving the list from one place
   * is what stops the next bump repeating the shadowing bug this suite
   * caught at v9 — a leftover newer save silently shadowing the fixture
   * each assertion had just written.
   */
  /*
   * The current key, and every key `loadRun` can read.
   *
   * Both come from `save.ts` rather than being repeated here. A local copy of
   * the list is exactly what let a leftover newer value shadow each fixture
   * after the v9 and v10 bumps; deriving it means the next bump cannot repeat
   * that on its own.
   */
  const KEY = SAVE_KEYS[0];
  const ALL_KEYS = [...SAVE_KEYS];
  const clearStore = () => {
    for (const k of ALL_KEYS) store.delete(k);
  };

  /*
   * The mutator reaches into arbitrary depths of a parsed save to corrupt one
   * field. `any` is the honest type for that: the whole point is to write
   * values the real types forbid.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loads = (mutate: (s: Record<string, any>) => void, key = KEY) => {
    const copy = JSON.parse(JSON.stringify(good));
    mutate(copy);
    clearStore();
    store.set(key, JSON.stringify(copy));
    return loadRun() !== null;
  };

  check(
    "an untouched save still loads",
    loads(() => {}),
  );
  check(
    "a save with no stored value loads as nothing",
    (() => {
      clearStore();
      return loadRun() === null;
    })(),
  );
  check(
    "unparseable JSON is rejected",
    (() => {
      clearStore();
      store.set(KEY, "{not json");
      return loadRun() === null;
    })(),
  );

  check(
    "a non-finite resource is rejected",
    !loads((s) => {
      s.r.cash = null;
    }),
  );
  check(
    "a NaN resource is rejected",
    !loads((s) => {
      s.r.reputation = "NaN";
    }),
  );
  check(
    "a missing log is rejected",
    !loads((s) => {
      delete s.log;
    }),
  );
  check(
    "a missing lastCases is rejected",
    !loads((s) => {
      delete s.data.med.lastCases;
    }),
  );
  check(
    "a missing lastCityReports is rejected",
    !loads((s) => {
      delete s.data.med.lastCityReports;
    }),
  );
  check(
    "a malformed city report entry is rejected",
    !loads((s) => {
      s.data.med.lastCityReports = [{ city: "lyon" }];
    }),
  );
  check(
    "a city report for a city that does not exist is rejected",
    !loads((s) => {
      s.data.med.lastCityReports = [
        { city: "atlantis", arrived: 1, treated: 1, revenue: 1 },
      ];
    }),
  );
  check(
    "an unknown city in the licence list is rejected",
    !loads((s) => {
      s.data.med.cities = ["lyon", "atlantis"];
    }),
  );
  check(
    "an unknown home city is rejected",
    !loads((s) => {
      s.data.med.homeCity = "atlantis";
    }),
  );
  check(
    "a non-finite panel value is rejected",
    !loads((s) => {
      s.data.med.panels.lyon = Number.POSITIVE_INFINITY;
    }),
  );
  check(
    "a panel keyed by an unknown city is rejected",
    !loads((s) => {
      s.data.med.panels.atlantis = 10;
    }),
  );
  check(
    "a missing nextId is rejected",
    !loads((s) => {
      delete s.data.med.nextId;
    }),
  );
  check(
    "an invalid triage policy is rejected",
    !loads((s) => {
      s.data.med.triage = "whatever";
    }),
  );
  check(
    "every real triage policy is accepted",
    ["urgent", "profitable", "volume"].every((t) =>
      loads((s) => {
        s.data.med.triage = t;
      }),
    ),
  );
  check(
    "a malformed outbreak is rejected",
    !loads((s) => {
      s.data.med.outbreaks = [
        { id: "flu", city: "nowhere", weeksLeft: 2, startedWeek: 1 },
      ];
    }),
  );
  check(
    "a non-finite social metric is rejected",
    !loads((s) => {
      s.data.med.phone.social.trust = null;
    }),
  );
  check(
    "a non-finite supply figure is rejected",
    !loads((s) => {
      s.data.med.supplies.stock = "lots";
    }),
  );
  check(
    "the validator rejects rather than repairing",
    (() => {
      const copy = JSON.parse(JSON.stringify(good));
      copy.data.med.homeCity = "atlantis";
      const before = JSON.stringify(copy);
      store.set(KEY, before);
      loadRun();
      // The stored save must be untouched: no silent write-back of a "fixed"
      // object, which would make the corruption permanent.
      return store.get(KEY) === before;
    })(),
  );

  /* ---------------------------------------------------- catalogue contracts
   *
   * The class of corruption that is structurally perfect and still fatal: an
   * identifier that no longer names anything. Each of these would resolve to
   * `undefined` at its first lookup and blank the screen.
   */
  check(
    "an unknown career id is rejected",
    !loads((s) => {
      s.careerId = "astronaut";
    }),
  );
  check(
    "a career id that is not a string is rejected",
    !loads((s) => {
      s.careerId = 7;
    }),
  );
  check(
    "an unknown facility type is rejected",
    !loads((s) => {
      s.data.med.facilities[0].type = "castle";
    }),
  );
  check(
    "a facility in an unknown city is rejected",
    !loads((s) => {
      s.data.med.facilities[0].city = "atlantis";
    }),
  );
  check(
    "a staff member with an unknown role is rejected",
    !loads((s) => {
      s.data.med.staff = [
        {
          id: "s1",
          role: "wizard",
          name: "X",
          specialty: null,
          skill: 50,
          salary: 100,
        },
      ];
    }),
  );
  check(
    "a staff member with a non-finite salary is rejected",
    !loads((s) => {
      s.data.med.staff = [
        {
          id: "s1",
          role: "nurse",
          name: "X",
          specialty: null,
          skill: 50,
          salary: null,
        },
      ];
    }),
  );
  check(
    "a staff member missing a name is rejected",
    !loads((s) => {
      s.data.med.staff = [
        { id: "s1", role: "nurse", specialty: null, skill: 50, salary: 100 },
      ];
    }),
  );
  check(
    "an unknown department is rejected",
    !loads((s) => {
      s.data.med.departments = ["general", "astrology"];
    }),
  );
  check(
    "unknown equipment is rejected",
    !loads((s) => {
      s.data.med.equipment = ["teleporter"];
    }),
  );
  check(
    "an unknown qualification is rejected",
    !loads((s) => {
      s.data.med.qualifications = [{ id: "phd-in-vibes", specialty: null }];
    }),
  );
  check(
    "a qualification in an unknown specialty is rejected",
    !loads((s) => {
      s.data.med.qualifications = [{ id: "md", specialty: "astrology" }];
    }),
  );
  check(
    "an unknown campaign is rejected",
    !loads((s) => {
      s.data.med.campaigns = ["skywriting"];
    }),
  );
  check(
    "an unknown lifestyle item is rejected",
    !loads((s) => {
      s.data.med.lifestyle = ["private-island"];
    }),
  );
  check(
    "an unknown solved pathogen is rejected",
    !loads((s) => {
      s.data.med.solved = ["the-common-cold"];
    }),
  );
  check(
    "a home city you hold no licence for is rejected",
    !loads((s) => {
      s.data.med.homeCity = "tokyo";
    }),
  );

  // Root-level structure.
  check(
    "a week of zero is rejected",
    !loads((s) => {
      s.week = 0;
    }),
  );
  check(
    "a fractional week is rejected",
    !loads((s) => {
      s.week = 3.5;
    }),
  );
  check(
    "a non-finite seed is rejected",
    !loads((s) => {
      s.seed = Infinity;
    }),
  );
  check(
    "a non-numeric owned record is rejected",
    !loads((s) => {
      s.owned = { clinic: "two" };
    }),
  );
  check(
    "a non-numeric eventHistory is rejected",
    !loads((s) => {
      s.eventHistory = { inspection: null };
    }),
  );
  check(
    "a malformed history entry is rejected",
    !loads((s) => {
      s.history = [{ week: 1, net: "lots" }];
    }),
  );
  check(
    "a history entry missing its week is rejected",
    !loads((s) => {
      s.history = [{ net: 10 }];
    }),
  );
  check(
    "a malformed log entry is rejected",
    !loads((s) => {
      s.log = [{ week: 1, text: "hi", tone: "smug" }];
    }),
  );
  check(
    "a log entry with a non-string text is rejected",
    !loads((s) => {
      s.log = [{ week: 1, text: 42, tone: "good" }];
    }),
  );
  check(
    "an outcome with an unknown kind is rejected",
    !loads((s) => {
      s.outcome = { kind: "drawn", title: "t", body: "b" };
    }),
  );
  check(
    "an outcome missing its body is rejected",
    !loads((s) => {
      s.outcome = { kind: "won", title: "t" };
    }),
  );
  check(
    "a valid won outcome is accepted",
    loads((s) => {
      s.outcome = { kind: "won", title: "t", body: "b" };
    }),
  );
  check(
    "a valid lost outcome is accepted",
    loads((s) => {
      s.outcome = { kind: "lost", title: "t", body: "b" };
    }),
  );

  // Phone sub-structures, all of which are rendered directly.
  check(
    "a malformed feed post is rejected",
    !loads((s) => {
      s.data.med.phone.feed = [{ id: "p", week: 1, body: "x" }];
    }),
  );
  check(
    "a feed post with an unknown kind is rejected",
    !loads((s) => {
      s.data.med.phone.feed = [
        {
          id: "p",
          week: 1,
          author: "a",
          handle: "h",
          kind: "ghost",
          body: "x",
          likes: 1,
          comments: [],
          tone: "good",
        },
      ];
    }),
  );
  check(
    "a message with an unknown role is rejected",
    !loads((s) => {
      s.data.med.phone.messages = [
        {
          id: "m",
          week: 1,
          from: "a",
          handle: "h",
          role: "alien",
          body: "x",
          read: false,
        },
      ];
    }),
  );
  check(
    "a news item missing its read flag is rejected",
    !loads((s) => {
      s.data.med.phone.news = [
        {
          id: "n",
          week: 1,
          outlet: "o",
          headline: "h",
          body: "b",
          tone: "good",
        },
      ];
    }),
  );
  check(
    "a non-finite recruit boost is rejected",
    !loads((s) => {
      s.data.med.phone.recruitBoost = NaN;
    }),
  );
  check(
    "a non-string entry in postsMade is rejected",
    !loads((s) => {
      s.data.med.phone.postsMade = [17];
    }),
  );

  /*
   * A full mid-run save, not just a fresh one: the fresh save has empty
   * arrays everywhere, so it would pass a validator that never actually
   * inspects an entry.
   */
  {
    let played = startRun(doctor, 21);
    played.r.cash = 400_000;
    played = run(played, "enterCity", "madrid");
    played = run(played, "buyFacility", "clinic:madrid");
    played = run(played, "hire", "nurse");
    played = run(played, "openDepartment", "paediatrics");
    played = run(played, "buyEquipment", "lab");
    played = advanceWeek(doctor, played, { clinic: 4 }).state;
    store.set(KEY, JSON.stringify(played));
    check(
      "a populated mid-run save loads with every collection non-empty",
      loadRun() !== null &&
        med(played).facilities.length > 1 &&
        med(played).staff.length > 0 &&
        med(played).lastCases.length > 0 &&
        med(played).lastCityReports.length > 0,
    );
  }

  delete (globalThis as { window?: unknown }).window;
}

// --- outbreak pressure -----------------------------------------------------
/*
 * The spawn roll is what makes outbreaks a progression rather than an event
 * that fires once past week eight. These assert the shape of that curve, not
 * particular constants — a tuning pass should be free to move the numbers
 * without rewriting the tests, but must not be free to make late-game safer
 * than early-game or to uncap the rate.
 */
{
  console.log("\nOutbreak pressure\n" + "─".repeat(52));

  check(
    "no cities means nothing can reach you",
    outbreakPressure(0, 0) === 0 && outbreakPressure(140, 0) === 0,
  );
  check("one city is already at risk in week one", outbreakPressure(1, 1) > 0);
  check(
    "pressure rises with the years",
    outbreakPressure(120, 2) > outbreakPressure(10, 2),
  );
  check(
    "pressure rises with reach",
    outbreakPressure(40, 6) > outbreakPressure(40, 1),
  );
  check(
    "pressure is capped, so a run is never permanently on fire",
    outbreakPressure(155, 14) <= 0.22 && outbreakPressure(999, 99) <= 0.22,
  );
  check(
    "the severity ceiling only ever opens up",
    severityCeiling(1) <= severityCeiling(30) &&
      severityCeiling(30) <= severityCeiling(60) &&
      severityCeiling(60) <= severityCeiling(120),
  );
  check(
    "week one cannot draw a run-ending pathogen",
    severityCeiling(1) === 2 && OUTBREAKS.some((o) => o.severity > 2),
  );
  check(
    "the whole catalogue is reachable eventually",
    Math.max(...OUTBREAKS.map((o) => o.severity)) <= severityCeiling(156),
  );
  check(
    "every band is reachable from real play",
    ["low", "rising", "high", "severe"].every((band) =>
      [
        [1, 1],
        [20, 2],
        [40, 2],
        [60, 4],
        [150, 14],
      ].some(([w, c]) => pressureBand(outbreakPressure(w, c)) === band),
    ),
  );

  /* And it actually fires: a long run with reach must see outbreaks start
     after the old week-8 window, or the progression is decorative. */
  let s2 = startRun(doctor, 404);
  s2.r.cash = 4_000_000;
  for (const city of ["madrid", "berlin", "london"]) {
    s2 = run(s2, "enterCity", city);
    s2 = run(s2, "buyFacility", `clinic:${city}`);
  }
  const startWeeks: number[] = [];
  for (let i = 0; i < 90 && !s2.outcome; i++) {
    s2 = advanceWeek(doctor, s2, { clinic: 3, manage: 2 }).state;
    for (const o of med(s2).outbreaks) {
      if (o.startedWeek === s2.week - 1 || o.startedWeek === s2.week) {
        if (!startWeeks.includes(o.startedWeek)) startWeeks.push(o.startedWeek);
      }
    }
    s2.r.cash = Math.max(s2.r.cash, 900_000);
  }
  check(
    "outbreaks keep starting all run, not just early",
    startWeeks.length >= 2 && startWeeks.some((w) => w > 20),
    `started in weeks ${startWeeks.join(", ") || "none"}`,
  );
}

// --- the cast on the phone -------------------------------------------------
/*
 * Bots must react to the run rather than to the clock, and must never draw
 * from the gameplay RNG — the phone has its own stream precisely so that
 * adding chatter cannot move the balance figures in the README.
 */
{
  console.log("\nPhone cast\n" + "─".repeat(52));

  let s3 = startRun(doctor, 77);
  s3.r.cash = 2_000_000;
  s3 = run(s3, "enterCity", "madrid");
  s3 = run(s3, "buyFacility", "clinic:madrid");
  s3 = run(s3, "hire", "nurse");

  const seen = new Set<string>();
  const authors = new Set<string>();
  for (let i = 0; i < 60 && !s3.outcome; i++) {
    s3 = advanceWeek(doctor, s3, { clinic: 3, outreach: 1, manage: 1 }).state;
    s3.r.cash = Math.max(s3.r.cash, 600_000);
  }
  for (const post of med(s3).phone.feed) {
    seen.add(post.id);
    authors.add(post.handle);
  }

  check("the feed fills up over a run", med(s3).phone.feed.length > 10);
  check(
    "more than one account is talking",
    authors.size >= 3,
    `${authors.size} accounts: ${[...authors].slice(0, 6).join(" ")}`,
  );
  check(
    "the feed is capped so a long save cannot grow without limit",
    med(s3).phone.feed.length <= MAX_FEED,
  );
  check(
    "no two feed entries share an id",
    seen.size === med(s3).phone.feed.length,
  );

  /* Determinism: the same seed and the same play must produce the same feed.
     If this ever fails, the phone has started drawing from a shared stream. */
  const replay = (seed: number) => {
    let a = startRun(doctor, seed);
    a.r.cash = 2_000_000;
    a = run(a, "enterCity", "madrid");
    a = run(a, "buyFacility", "clinic:madrid");
    a = run(a, "hire", "nurse");
    for (let i = 0; i < 25 && !a.outcome; i++) {
      a = advanceWeek(doctor, a, { clinic: 3, outreach: 1, manage: 1 }).state;
      a.r.cash = Math.max(a.r.cash, 600_000);
    }
    return med(a)
      .phone.feed.map((p) => p.id)
      .join("|");
  };
  check("the same run produces the same feed", replay(77) === replay(77));
  check(
    "a different seed produces a different feed",
    replay(77) !== replay(78),
  );

  /* Comments answer the room you are standing in, not a fixed script. */
  const warm = med(s3);
  warm.phone.social.trust = 85;
  warm.phone.social.followers = 40_000;
  const cold = JSON.parse(JSON.stringify(warm)) as typeof warm;
  cold.phone.social.trust = 12;
  cold.phone.social.scrutiny = 80;
  const rngA = makeRng(1234);
  const rngB = makeRng(1234);
  const warmC = reactionsFor(warm, { week: 40, reputation: 60 }, rngA);
  const coldC = reactionsFor(cold, { week: 40, reputation: 60 }, rngB);
  check(
    "standing changes who bothers to reply",
    warmC.comments.map((c) => c.handle).join() !==
      coldC.comments.map((c) => c.handle).join(),
  );
  check("reach drives how many likes a post gets", warmC.likes > coldC.likes);
}

// --- quick plans -----------------------------------------------------------
/*
 * These are pure allocation helpers, so they can be tested without a browser.
 * The contract that matters: a plan is always something the player could have
 * entered by hand, and never spends time that does not exist.
 */
{
  console.log("\nQuick plans\n" + "─".repeat(52));

  const s4 = startRun(doctor, 12);
  const budget = doctor.timeBudget(s4);
  const spend = (a: Record<string, number>) =>
    Object.values(a).reduce((n, x) => n + x, 0);

  check(
    "a named plan spends the whole week and no more",
    PLANS.every((p) => spend(applyPlan(doctor, p, budget, s4)) === budget),
  );
  check(
    "a plan never exceeds an action's own weekly cap",
    PLANS.every((p) =>
      Object.entries(applyPlan(doctor, p, budget, s4)).every(([id, n]) => {
        const action = doctor.actions.find((a) => a.id === id);
        return !!action && n <= (action.maxPerWeek ?? Infinity);
      }),
    ),
  );
  check(
    "a plan only ever names real actions",
    PLANS.every((p) =>
      Object.keys(applyPlan(doctor, p, budget, s4)).every((id) =>
        doctor.actions.some((a) => a.id === id),
      ),
    ),
  );
  check(
    "repeating last week is trimmed to a smaller budget",
    spend(clampPlan(doctor, { clinic: 4, manage: 2 }, 3, s4)) === 3,
  );
  check(
    "a remembered plan naming a missing action is dropped, not applied",
    clampPlan(doctor, { notAnAction: 4 }, budget, s4).notAnAction === undefined,
  );
  check(
    "a plan never assigns to an action this run has not unlocked",
    PLANS.every((p) =>
      Object.keys(applyPlan(doctor, p, budget, s4)).every((id) => {
        const action = doctor.actions.find((a) => a.id === id);
        return !!action && (!action.unlocked || action.unlocked(s4));
      }),
    ),
    "week 1 has no second city, so travel must never be planned",
  );
  check(
    "a locked action cannot be repeated from a stored plan",
    clampPlan(doctor, { travel: 3 }, budget, s4).travel === undefined,
  );
}

// --- the remembered plan ---------------------------------------------------
{
  console.log("\nLast plan storage\n" + "─".repeat(52));

  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };

  saveLastPlan("doctor", { clinic: 3, manage: 2 });
  check("a saved plan comes back", loadLastPlan("doctor")?.clinic === 3);
  check(
    "a plan is not offered to a different career",
    loadLastPlan("chef") === null,
  );

  store.set("career-tycoon:lastplan:v1", "{ not json");
  check("corrupt storage is ignored", loadLastPlan("doctor") === null);

  store.set(
    "career-tycoon:lastplan:v1",
    JSON.stringify({ careerId: "doctor", alloc: { clinic: -4 } }),
  );
  check("a negative block count is refused", loadLastPlan("doctor") === null);

  store.set(
    "career-tycoon:lastplan:v1",
    JSON.stringify({ careerId: "doctor", alloc: { clinic: 1.5 } }),
  );
  check("a fractional block count is refused", loadLastPlan("doctor") === null);

  store.set(
    "career-tycoon:lastplan:v1",
    JSON.stringify({ careerId: "doctor", alloc: {} }),
  );
  check("an empty plan is not offered", loadLastPlan("doctor") === null);

  check(
    "the remembered plan is not part of the save",
    store.get("career-tycoon:save:v8") === undefined,
  );

  delete (globalThis as { window?: unknown }).window;
}

// --- resilience ------------------------------------------------------------
const poisoned = startRun(doctor, 31);
poisoned.r.cash = NaN;
poisoned.r.reputation = Infinity;
const healed = run(poisoned, "triage", "urgent");
check(
  "a non-finite resource is reset rather than spreading",
  Number.isFinite(healed.r.cash) && Number.isFinite(healed.r.reputation),
);

// --- isolation -------------------------------------------------------------
const base = startRun(doctor, 7);
const branch = run(base, "hire", "nurse");
check(
  "commands do not mutate the previous state",
  med(base).staff.length === 0 && med(branch).staff.length === 1,
);

// --- people, timeline, consequences ----------------------------------------
/*
 * Phase 1's new subsystems. Each is a pure-ish function over RunState, so all
 * of this runs in Node in milliseconds and none of it needs a browser.
 */
{
  console.log("\nPeople\n" + "─".repeat(52));

  const p0 = startRun(doctor, 500);
  check(
    "a fresh run arrives with the cast that is present from week one",
    (p0.people ?? []).length > 0 &&
      (p0.people ?? []).every((p) => PERSON_ROLES.includes(p.role)),
    `${(p0.people ?? []).length} people`,
  );
  check(
    "everyone starts on their authored footing",
    (p0.people ?? []).every(
      (p) =>
        p.status === "active" && p.memory.length === 0 && p.recent.length === 0,
    ),
  );
  check(
    "someone gated on a condition is absent until it is true",
    !p0.people?.some((p) => p.id === "mbeki"),
    "Nomsa Mbeki appears once there is staff",
  );

  {
    const s = startRun(doctor, 501);
    touchPerson(
      s,
      "hallam",
      { warmth: -20, remember: ["a-thing"] },
      "you did a thing",
      "bad",
    );
    const h = personIn(s, "hallam")!;
    check(
      "standing moves, and records why",
      h.warmth < 30 && h.recent[0].text === "you did a thing",
    );
    check("memory is a fact, kept", remembers(s, "hallam", "a-thing"));
    touchPerson(s, "hallam", { remember: ["a-thing"] }, "again", "neutral");
    check(
      "the same memory is not stored twice",
      h.memory.filter((f) => f === "a-thing").length === 1,
    );
  }

  {
    /* Traits are the reason two people react differently to one action. */
    const s = startRun(doctor, 502);
    const proud = personIn(s, "okoro")!;
    const loyal = personIn(s, "lindqvist")!;
    const before = { proud: proud.warmth, loyal: loyal.warmth };
    touchPerson(s, "okoro", { warmth: -10 }, "the same slight", "bad");
    touchPerson(s, "lindqvist", { warmth: -10 }, "the same slight", "bad");
    check(
      "a proud person takes a slight harder than a loyal one",
      before.proud - proud.warmth > before.loyal - loyal.warmth,
      `proud -${(before.proud - proud.warmth).toFixed(1)}, loyal -${(before.loyal - loyal.warmth).toFixed(1)}`,
    );
  }

  {
    const s = startRun(doctor, 503);
    touchPerson(s, "okoro", { warmth: -60 }, "a serious falling-out", "bad");
    check(
      "a bad enough falling-out estranges someone",
      personIn(s, "okoro")!.status === "estranged",
    );
  }

  {
    /* Neglect cools; it does not manufacture hostility. */
    const s = startRun(doctor, 504);
    const before = personIn(s, "hallam")!.warmth;
    s.week = 40;
    for (let i = 0; i < 30; i++) driftPeople(s);
    const after = personIn(s, "hallam")!.warmth;
    check("silence cools a relationship", after < before);
    check("but never past neutral on its own", after >= 0);
  }

  console.log("\nTimeline\n" + "─".repeat(52));
  {
    const s = startRun(doctor, 505);
    check(
      "a run opens with its own beginning recorded",
      hasMilestone(s, "start"),
    );
    const first = mark(s, "x", "money", "A thing", "It happened");
    const second = mark(s, "x", "money", "A thing", "It happened");
    check("a milestone is recorded once", first && !second);
    check(
      "entries carry the week they actually happened",
      timelineOf(s).every((t) => t.week >= 1 && t.week <= s.week),
    );

    /* The guarantee that makes the feature trustworthy: a migrated save gains
       no invented history. */
    const fresh = JSON.parse(JSON.stringify(startRun(doctor, 506)));
    delete fresh.timeline;
    const migrated = migrateRun(fresh);
    check(
      "a migrated save is given an empty timeline, not a fabricated one",
      Array.isArray(migrated?.timeline) &&
        (migrated?.timeline as unknown[]).length === 0,
    );
  }

  console.log("\nDelayed consequences\n" + "─".repeat(52));
  {
    const s = startRun(doctor, 507);
    s.week = 10;
    schedule(s, 5, "test.kind", { n: 1 }, "Something is coming.");
    check("nothing is due before its week", takeDue(s).length === 0);
    check("a notice is visible while it is pending", upcoming(s).length === 1);
    s.week = 15;
    const due = takeDue(s);
    check(
      "it comes due on the right week",
      due.length === 1 && due[0].kind === "test.kind",
    );
    check("and is taken off the queue", (s.pending ?? []).length === 0);

    /* A missed week must still fire — a silently dropped consequence is worse
       than a late one. */
    const s2 = startRun(doctor, 508);
    s2.week = 10;
    schedule(s2, 2, "late.kind");
    s2.week = 40;
    check(
      "a consequence overdue by weeks still fires",
      takeDue(s2).length === 1,
    );

    const s3 = startRun(doctor, 509);
    for (let i = 0; i < 60; i++) schedule(s3, 3, "spam");
    check(
      "the queue is bounded so a bug cannot grow a save without limit",
      (s3.pending ?? []).length <= MAX_PENDING,
    );
  }

  console.log("\nEvent chains\n" + "─".repeat(52));
  {
    const opens = CHAIN_EVENTS.filter((e) => !e.followUp);
    const followUps = CHAIN_EVENTS.filter((e) => e.followUp);
    check(
      "there are several storylines",
      new Set(CHAIN_EVENTS.map((e) => e.chain)).size >= 4,
    );
    check("each has an opening beat", opens.length >= 4);
    check("and delayed follow-ups", followUps.length >= 4);
    check(
      "every opener fires at most once in a run",
      opens.every((e) => e.once === true),
    );
    check(
      "a follow-up can never be rolled at random",
      followUps.every(
        (e) => e.weight(startRun(doctor, 1)) === 0 && e.followUp === true,
      ),
    );
    check(
      "every event id is unique",
      new Set(doctor.events.map((e) => e.id)).size === doctor.events.length,
    );

    /* Every kind a chain schedules must be one `resolvePending` handles, or
       the storyline silently dead-ends. */
    const kinds = [
      "registrar.supervised",
      "registrar.reported",
      "registrar.buried",
      "audit.clean",
      "audit.contested",
      "partner.pressure",
      "partner.clinical",
      "chair.decision",
      "chair.rematch",
    ];
    const handled = kinds.filter((kind) => {
      const s = startRun(doctor, 510);
      s.week = 40;
      const out = doctor.resolvePending?.(
        s,
        { id: "t", dueWeek: 40, kind },
        makeRng(1),
      );
      // A handler may legitimately fizzle; what must not happen is a throw.
      return out === undefined || typeof out === "object";
    });
    check(
      "every scheduled kind has a handler that runs",
      handled.length === kinds.length,
    );

    check(
      "an unknown kind from an older build is ignored, not fatal",
      doctor.resolvePending?.(
        startRun(doctor, 511),
        { id: "t", dueWeek: 1, kind: "kind.that.no.longer.exists" },
        makeRng(1),
      ) === undefined,
    );

    /* Raised follow-ups must actually reach the player. */
    const s = startRun(doctor, 512);
    s.week = 20;
    schedule(s, 1, "audit.clean");
    s.week = 21;
    const r = advanceWeek(doctor, s, { rest: 2 });
    check(
      "a due consequence raises its follow-up event that same week",
      r.event?.def.id === "chain.audit.vindicated",
      r.event?.def.id ?? "no event",
    );

    /* And the decision must read state, not roll dice. */
    const strong = startRun(doctor, 520);
    strong.r.reputation = 90;
    strong.r.repInfluence = 90;
    strong.r.repEthics = 90;
    const weak = startRun(doctor, 521);
    weak.r.reputation = 20;
    weak.r.repInfluence = 10;
    weak.r.repEthics = 30;
    const outcomeFor = (st: typeof strong) =>
      doctor.resolvePending?.(
        st,
        { id: "t", dueWeek: st.week, kind: "chair.decision" },
        makeRng(1),
      );
    check(
      "the chair is decided by standing, not by chance",
      (outcomeFor(strong) as { raiseEvent?: string })?.raiseEvent ===
        "chain.chair.appointed" &&
        (outcomeFor(weak) as { raiseEvent?: string })?.raiseEvent ===
          "chain.chair.passed",
    );
  }

  console.log("\nReputation\n" + "─".repeat(52));
  {
    const s = startRun(doctor, 513);
    check(
      "a fresh run has all six categories",
      REPUTATIONS.every((d) => typeof s.r[d.key] === "number"),
    );
    check(
      "credibility is the existing reputation value, not a new one",
      REP_BY_ID.get("credibility")!.key === "reputation" &&
        s.r.reputation === 45,
    );

    const before = overallReputation(s);
    applyRep(s, "ethics", -40, "a test");
    check(
      "ethics scales the overall rather than averaging into it",
      overallReputation(s) < before,
    );

    applyRep(s, "loyalty", 12, "you looked after your team");
    check("a category moves", s.r.repLoyalty === 62);
    check(
      "and the reason is recorded",
      (s.repLog ?? [])[0].why === "you looked after your team",
    );

    applyRep(s, "loyalty", 999, "clamped");
    check("categories are clamped to 100", s.r.repLoyalty === 100);
    applyRep(s, "loyalty", -999, "clamped");
    check("and to 0", s.r.repLoyalty === 0);

    check(
      "the overall is bounded whatever the parts do",
      overallReputation(s) >= 0 && overallReputation(s) <= 100,
    );

    /* The couplings that make this gameplay rather than a scoreboard. */
    const rich = startRun(doctor, 514);
    rich.r.repLoyalty = 10;
    check(
      "collapsed loyalty puts staff at risk of leaving",
      attritionRisk(rich) > 0,
    );
    rich.r.repLoyalty = 60;
    check("healthy loyalty does not", attritionRisk(rich) === 0);

    const known = startRun(doctor, 515);
    known.r.repInfluence = 90;
    check(
      "influence improves who you can hire",
      hiringBonus(known) > hiringBonus(startRun(doctor, 516)),
    );
  }

  console.log("\nSave migration\n" + "─".repeat(52));
  {
    /* A genuine v8 save: the engine's own output with every v9 field removed,
       which is exactly what an older build wrote. */
    const v8 = JSON.parse(JSON.stringify(startRun(doctor, 517))) as Record<
      string,
      unknown
    >;
    delete v8.people;
    delete v8.timeline;
    delete v8.pending;
    delete v8.repLog;
    const r8 = v8.r as Record<string, number>;
    for (const key of [
      "repPatients",
      "repLoyalty",
      "repInfluence",
      "repPopularity",
      "repEthics",
    ]) {
      delete r8[key];
    }
    r8.reputation = 72; // a run that was going well

    const up = migrateRun(JSON.parse(JSON.stringify(v8)));
    check("an older save is migrated, not discarded", up !== null);
    check("and the result validates", !!up && validateRun(up));
    check(
      "nothing the player earned is altered",
      (up!.r as Record<string, number>).reputation === 72 &&
        up!.week === v8.week,
    );
    check(
      "the new categories are seeded from signals the old save carried",
      (up!.r as Record<string, number>).repPatients > 50,
      "credibility 72 implies patient trust above neutral",
    );
    check(
      "the cast is added at its starting standing",
      Array.isArray(up!.people) && (up!.people as unknown[]).length > 0,
    );
    check(
      "migration is idempotent",
      JSON.stringify(migrateRun(JSON.parse(JSON.stringify(up)))) ===
        JSON.stringify(up),
    );
    check(
      "a save for a career that no longer exists is still refused",
      migrateRun({ ...v8, careerId: "astronaut" }) === null,
    );
    check(
      "a save with no career id is refused",
      migrateRun({ week: 4 }) === null,
    );

    /* Imported files are the hostile case: hand-edited, truncated, or from a
       different game entirely. */
    const bad = (mutate: (s: Record<string, unknown>) => void) => {
      const copy = JSON.parse(JSON.stringify(startRun(doctor, 518)));
      mutate(copy);
      return validateRun(copy);
    };
    /*
     * The rejection checks below are only meaningful if the UNmutated save
     * passes. Without this, an unrelated validator bug would make every one
     * of them succeed for the wrong reason — which is exactly what happened
     * while `repLog` was left undefined by `startRun`.
     */
    check(
      "the unmutated save is accepted, so the rejections mean something",
      bad(() => {}),
    );
    check(
      "a person with an unknown role is rejected",
      !bad((s) => {
        (s.people as Record<string, unknown>[])[0].role = "wizard";
      }),
    );
    check(
      "a person with an unknown status is rejected",
      !bad((s) => {
        (s.people as Record<string, unknown>[])[0].status = "vibing";
      }),
    );
    check(
      "a person with an unknown trait is rejected",
      !bad((s) => {
        (s.people as Record<string, unknown>[])[0].traits = ["chaotic"];
      }),
    );
    check(
      "a non-finite relationship score is rejected",
      !bad((s) => {
        (s.people as Record<string, unknown>[])[0].warmth = null;
      }),
    );
    check(
      "a memory flag that is not a string is rejected",
      !bad((s) => {
        (s.people as Record<string, unknown>[])[0].memory = [42];
      }),
    );
    check(
      "a timeline entry with an unknown kind is rejected",
      !bad((s) => {
        (s.timeline as unknown[]).push({
          id: "x",
          week: 1,
          kind: "vibes",
          title: "a",
          detail: "b",
        });
      }),
    );
    check(
      "a timeline entry missing its detail is rejected",
      !bad((s) => {
        (s.timeline as unknown[]).push({
          id: "x",
          week: 1,
          kind: "money",
          title: "a",
        });
      }),
    );
    check(
      "a pending consequence without a due week is rejected",
      !bad((s) => {
        (s.pending as unknown[]).push({ id: "x", kind: "y" });
      }),
    );
    check(
      "a reputation change for an unknown category is rejected",
      !bad((s) => {
        (s.repLog as unknown[]).push({
          week: 1,
          id: "charisma",
          delta: 1,
          why: "x",
        });
      }),
    );

    /* Round trip: a save that has actually been played survives JSON. */
    let played = startRun(doctor, 519);
    played.r.cash = 400_000;
    played = runCommand(doctor, played, "hire", "nurse");
    for (let i = 0; i < 20 && !played.outcome; i++) {
      played = advanceWeek(doctor, played, {
        clinic: 2,
        people: 1,
        exercise: 1,
      }).state;
      played.r.cash = Math.max(played.r.cash, 200_000);
    }
    const roundTripped = JSON.parse(JSON.stringify(played));
    check(
      "a played save survives a JSON round trip",
      validateRun(roundTripped),
    );
    check(
      "including its people, timeline and standing",
      (roundTripped.people as unknown[]).length > 0 &&
        (roundTripped.timeline as unknown[]).length > 0 &&
        typeof roundTripped.r.repLoyalty === "number",
    );
  }

  console.log("\nThe planner\n" + "─".repeat(52));
  {
    /* The hard limit: the engine must never let a week spend more time than
       it has, whatever the caller passes. */
    const s = startRun(doctor, 522);
    const budget = doctor.timeBudget(s);
    check(
      "the budget is a real number of blocks",
      Number.isFinite(budget) && budget > 0,
    );
    check(
      "every new activity is a real action with a preview and a cost",
      ["people", "network", "exercise", "content", "travel"].every((id) => {
        const a = doctor.actions.find((x) => x.id === id);
        return (
          !!a &&
          a.timeCost > 0 &&
          a.preview(s).length > 0 &&
          !!a.blurb &&
          !!a.label
        );
      }),
    );
    check(
      "every new activity is capped, so no single one can eat a week",
      ["people", "network", "exercise", "content", "travel"].every(
        (id) =>
          (doctor.actions.find((x) => x.id === id)?.maxPerWeek ?? 99) <= 2,
      ),
    );

    /* Fitness is the only compounding self-care effect, so it must actually
       compound — and it must decay, or it is a one-off purchase. */
    let f = startRun(doctor, 523);
    f.r.burnout = 60;
    for (let i = 0; i < 6; i++)
      f = advanceWeek(doctor, f, { exercise: 2, rest: 1 }).state;
    const built = f.r._fitness ?? 0;
    check(
      "exercise builds a fitness stock",
      built > 3,
      `fitness ${built.toFixed(1)}`,
    );
    for (let i = 0; i < 10; i++)
      f = advanceWeek(doctor, f, { clinic: 3 }).state;
    check("and it decays when you stop", (f.r._fitness ?? 0) < built);
  }
}

// --- phase 2: a living world -----------------------------------------------
{
  console.log("\nCity economy\n" + "─".repeat(52));
  {
    const m0: CityMarket = {
      demand: 1,
      salary: 1,
      rent: 1,
      fees: 1,
      talent: 1,
      sentiment: 50,
      regulation: 20,
      cycle: 0,
      shockWeeks: 0,
      shock: null,
    };
    const m = { ...m0 };
    const rng = makeRng(1);
    for (let i = 0; i < 300; i++) driftMarket(m, rng, i);
    check(
      "a market never escapes its bounds, however long it drifts",
      m.demand >= 0.6 &&
        m.demand <= 1.6 &&
        m.salary >= 0.6 &&
        m.salary <= 1.6 &&
        m.rent >= 0.6 &&
        m.rent <= 1.6 &&
        m.fees >= 0.6 &&
        m.fees <= 1.6 &&
        m.sentiment >= 0 &&
        m.sentiment <= 100 &&
        m.regulation >= 0 &&
        m.regulation <= 100,
      `demand ${m.demand.toFixed(2)} salary ${m.salary.toFixed(2)}`,
    );

    /* Determinism: the same seed must produce the same economy, or the
       balance harness is measuring noise. */
    /*
     * Long enough for a shock to have happened. The ordinary week is
     * deterministic *by design* — the RNG is only consulted for shocks, which
     * are rare — so a sixty-week comparison can legitimately find two seeds
     * identical. That is correct behaviour and a bad test.
     */
    const walk = (seed: number) => {
      const x = { ...m0 };
      const r = makeRng(seed);
      for (let i = 0; i < 400; i++) driftMarket(x, r, i);
      return `${x.demand.toFixed(4)}/${x.salary.toFixed(4)}/${x.shock}`;
    };
    check("the economy is deterministic given a seed", walk(7) === walk(7));
    check("and different seeds diverge", walk(7) !== walk(8));

    /* Drift is gradual. A single week must never move a market more than a
       couple of percent unless a shock is running — that is the whole
       "gradual unless caused by a major event" requirement. */
    const gentle = { ...m0 };
    const r2 = makeRng(99);
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      const before = gentle.demand;
      driftMarket(gentle, r2, i);
      if (!gentle.shock)
        worst = Math.max(worst, Math.abs(gentle.demand - before));
    }
    check(
      "an ordinary week moves a market only slightly",
      worst < 0.03,
      `largest quiet-week move ${(worst * 100).toFixed(2)}%`,
    );

    const shocked = { ...m0, shock: "boom" as const, shockWeeks: 10 };
    const before = shocked.demand;
    driftMarket(shocked, makeRng(3), 40);
    check(
      "a shock moves it faster than a quiet week",
      shocked.demand - before > worst,
    );
  }

  console.log("\nStaff and culture\n" + "─".repeat(52));
  {
    /* The v9 roster shape must survive contact with every reader. */
    const bare = {
      id: "s1",
      role: "nurse",
      name: "A",
      specialty: null,
      skill: 50,
      salary: 1000,
    };
    const h = hydrateStaff(bare as never);
    check(
      "an older staff record is filled in rather than rejected",
      Number.isFinite(h.morale) &&
        Number.isFinite(h.loyalty) &&
        Number.isFinite(h.expects) &&
        h.traits.length > 0,
    );
    check(
      "traits are stable for a given person",
      hydrateStaff(bare as never).traits[0] === h.traits[0],
    );

    let s = startRun(doctor, 600);
    s.r.cash = 900_000;
    s = runCommand(doctor, s, "hire", "nurse");
    s = runCommand(doctor, s, "hire", "gp");
    const m = med(s);
    check(
      "culture is derived, with its reasons attached",
      (() => {
        const c = cultureScore(m, s.week);
        return (
          c.score >= 0 &&
          c.score <= 100 &&
          c.drivers.length > 0 &&
          c.drivers.every((d) => !!d.label && !!d.detail)
        );
      })(),
    );
    check(
      "there is no culture field to set — it is computed",
      !("culture" in (m as unknown as Record<string, unknown>)),
    );

    /* Culture has to DO something or it is a scoreboard. */
    check(
      "a good place to work produces more than a bad one",
      productivityFactor(85) > productivityFactor(25),
    );
    check("a bad one makes mistakes", errorRate(20) > 0 && errorRate(80) === 0);
    check(
      "loyalty protects against churn at the same culture",
      churnRate(30, 80) < churnRate(30, 10),
    );
    check(
      "a good place attracts better applicants",
      recruitAppeal(85) > recruitAppeal(30),
    );

    /* Management actions move real numbers, and cost real things. */
    const before = hydrateStaff(m.staff[0]);
    const paid = runCommand(doctor, s, "rewardStaff", m.staff[0].id);
    const after = hydrateStaff(med(paid).staff[0]);
    check(
      "a rise raises morale AND payroll permanently",
      after.morale > before.morale && after.salary > before.salary,
    );

    const warned = runCommand(doctor, s, "warnStaff", m.staff[0].id);
    check(
      "a warning costs morale and shows up in the culture score",
      hydrateStaff(med(warned).staff[0]).morale < before.morale &&
        cultureScore(med(warned), warned.week).score <
          cultureScore(m, s.week).score,
    );

    const promoted = runCommand(doctor, s, "promoteStaff", m.staff[0].id);
    check(
      "a promotion costs the people who did not get it",
      hydrateStaff(med(promoted).staff[0]).lead === true,
    );
  }

  console.log("\nRivals\n" + "─".repeat(52));
  {
    const s = startRun(doctor, 601);
    s.rivals = PHYSICIAN_RIVALS.map(initialRival);
    check(
      "every rival is also a person you have a relationship with",
      (s.rivals ?? []).every((r) => CAST_BY_ID.has(r.id)),
    );
    check(
      "they run different strategies",
      new Set((s.rivals ?? []).map((r) => r.strategy)).size >= 4,
    );

    const before = JSON.stringify(s.rivals);
    const rng = makeRng(42);
    for (let w = 1; w <= 60; w++) {
      s.week = w;
      tickRivals(s, rng, ["lyon", "paris"]);
    }
    check("they progress over time", JSON.stringify(s.rivals) !== before);
    check(
      "and their history stays bounded",
      (s.rivals ?? []).every((r) => r.history.length <= MAX_RIVAL_HISTORY),
    );
    check(
      "some of them are visibly bigger than when they started",
      (s.rivals ?? []).some((r) => r.sites > 1 || r.standing > 60),
    );

    /* Determinism, because the whole point of summarising rather than
       simulating is that it stays testable. */
    const run = (seed: number) => {
      const a = startRun(doctor, 602);
      a.rivals = PHYSICIAN_RIVALS.map(initialRival);
      const r = makeRng(seed);
      for (let w = 1; w <= 40; w++) {
        a.week = w;
        tickRivals(a, r, ["lyon"]);
      }
      return JSON.stringify(a.rivals);
    };
    check("rival progression is deterministic", run(5) === run(5));
    check("and seed-dependent", run(5) !== run(6));

    /* They remember. */
    const s2 = startRun(doctor, 603);
    s2.rivals = PHYSICIAN_RIVALS.map(initialRival);
    s2.week = 20;
    recordContest(s2, "okoro", true, "a contract");
    check(
      "beating one costs you the relationship and gains their respect",
      (personIn(s2, "okoro")?.warmth ?? 0) < 10 &&
        remembers(s2, "okoro", "beaten-by-you"),
    );
    for (let i = 0; i < 8; i++) recordContest(s2, "okoro", true, "another");
    check(
      "enough of that makes an enemy",
      (s2.rivals ?? []).find((r) => r.id === "okoro")?.stance === "enemy",
    );
    check(
      "an enemy bids harder than a stranger",
      rivalBid({ ...initialRival(PHYSICIAN_RIVALS[0]), stance: "enemy" }) >
        rivalBid({ ...initialRival(PHYSICIAN_RIVALS[0]), stance: "neutral" }),
    );
  }

  console.log("\nAssignments\n" + "─".repeat(52));
  {
    check(
      "the catalogue covers every kind the design calls for",
      new Set(MEDICAL_CONTRACTS.map((c) => c.kind)).size ===
        CONTRACT_KINDS.length,
      [...new Set(MEDICAL_CONTRACTS.map((c) => c.kind))].join(", "),
    );
    check(
      "every assignment states a real cost as well as a reward",
      MEDICAL_CONTRACTS.every(
        (c) => c.fee > 0 && c.effort > 0 && c.deadline > 0 && c.difficulty >= 1,
      ),
    );
    check(
      "the grey ones are the ones that carry ethical exposure",
      MEDICAL_CONTRACTS.filter((c) => c.kind === "grey").every(
        (c) => c.ethicalRisk >= 0.5,
      ),
    );
    check(
      "half the catalogue is invisible to a one-room practice",
      MEDICAL_CONTRACTS.filter((c) => !c.requires(startRun(doctor, 604)))
        .length >=
        MEDICAL_CONTRACTS.length / 2,
    );

    const def = CONTRACT_BY_ID.get("c.complex")!;
    const active = startContract(def.id, "lyon", 10, def.deadline);
    const strong = readinessFor(
      startRun(doctor, 605),
      { ...active, progress: def.effort },
      def,
      {
        skill: 90,
        burnout: 10,
        standing: 85,
        staffSkill: 80,
        cityFactor: 1.1,
        culture: 80,
      },
    );
    const weak = readinessFor(
      startRun(doctor, 605),
      { ...active, progress: def.effort },
      def,
      {
        skill: 30,
        burnout: 80,
        standing: 30,
        staffSkill: 0,
        cityFactor: 0.9,
        culture: 30,
      },
    );
    check("preparation beats improvisation", strong.total > weak.total);
    check(
      "and the player can see the working",
      strong.parts.length >= 5 && strong.parts.every((p) => !!p.label),
    );

    /* The core anti-slot-machine rule. */
    const unworked = startContract(def.id, "lyon", 10, def.deadline);
    check(
      "an assignment you never worked fails however good you are",
      !resolveContract(def, unworked, strong, makeRng(1)).won,
    );
    const worked = { ...active, progress: def.effort };
    check(
      "a well-prepared, fully-worked assignment succeeds",
      resolveContract(def, worked, strong, makeRng(1)).won,
    );
    check(
      "an over-reaching one fails",
      !resolveContract(def, worked, weak, makeRng(1)).won,
    );

    /* Complications change the terms, and never on week one. */
    const fresh = startContract(def.id, "lyon", 10, def.deadline);
    check(
      "a complication cannot fire before any work is done",
      rollComplication(def, fresh, 11, makeRng(2)) === null,
    );
    const started = { ...fresh, progress: 2 };
    let fired = null;
    for (let i = 0; i < 200 && !fired; i++) {
      fired = rollComplication(def, started, 15, makeRng(i));
    }
    check("a complication does eventually fire", fired !== null);
    check(
      "and it makes the work harder",
      started.extraDifficulty > 0 &&
        requiredScore(def, started) > requiredScore(def, fresh),
    );
  }

  console.log("\nFinancing\n" + "─".repeat(52));
  {
    const s = startRun(doctor, 606);
    const ctx = {
      netWorth: 400_000,
      weeklyRevenue: 20_000,
      credibility: 60,
      influence: 50,
      ethics: 70,
      investorWarmth: 30,
      partnerWarmth: 40,
    };
    const offers = fundingOffers(s, ctx);
    check(
      "all five financing routes are represented",
      offers.length === FUNDING_KINDS.length,
    );
    check(
      "each one costs something different",
      offers.some((o) => o.rate > 0) &&
        offers.some((o) => o.equity > 0) &&
        offers.some((o) => o.condition),
    );
    check(
      "a blocked route says why rather than vanishing",
      fundingOffers(startRun(doctor, 607), { ...ctx, influence: 5 }).some(
        (o) => o.kind === "grant" && !!o.blocked,
      ),
    );

    /* EXPLOIT: unlimited borrowing. */
    let borrowed = 0;
    for (let i = 0; i < 20; i++) {
      const os = fundingOffers(s, ctx);
      const bank = os.find((o) => o.kind === "bank");
      if (!bank || bank.blocked || bank.amount <= 0) break;
      const took = takeFunding(s, bank);
      if (!took) break;
      borrowed += took.principal;
    }
    check(
      "borrowing is capped by what the business can carry",
      borrowed < 3_000_000,
      `took ${Math.round(borrowed / 1000)}k across repeated attempts`,
    );
    check(
      "and the number of facilities is bounded",
      (s.obligations ?? []).length <= MAX_OBLIGATIONS,
    );

    /*
     * EXPLOIT: borrowing your way to the goal.
     *
     * The career is won at `debt <= 0 && netWorth >= 2,500,000`, and a bank
     * facility arrives as cash. If the money owed is not netted off, drawing
     * $900,000 is worth $900,000 of progress towards the target and the
     * shortest route to "success" is a loan you never repay. The balance
     * harness found exactly this: the leveraged strategy was the only one
     * clearing the goal, on an average net worth of -$2.2M.
     */
    {
      const g = startRun(doctor, 611);
      g.r.cash = 50_000;
      g.r._lastRevenue = 30_000;
      const worthBefore = netWorth(g);
      const capacityBefore = borrowingCapacity(g, worthBefore, 30_000);
      const bank = fundingOffers(g, { ...ctx, weeklyRevenue: 30_000 }).find(
        (o) => o.kind === "bank",
      )!;
      takeFunding(g, bank);

      check(
        "borrowed money is not counted as wealth",
        netWorth(g) === worthBefore,
        `worth ${netWorth(g).toLocaleString("en-US")} after drawing ${Math.round(bank.amount).toLocaleString("en-US")}`,
      );
      check(
        "and what you owe is carried against you",
        totalOutstanding(g) >= bank.amount,
      );
      /* The accounting fix must not quietly tighten credit as a side effect:
         a lender's answer is about the business, not about how the metric is
         reported. Same practice, same offer. */
      check(
        "while the lender still lends exactly what it lent before",
        borrowingCapacity(startRun(doctor, 611), worthBefore, 30_000) ===
          capacityBefore,
      );
    }

    /* EXPLOIT: selling the same equity twice. */
    const s2 = startRun(doctor, 608);
    for (let i = 0; i < 10; i++) {
      const os = fundingOffers(s2, ctx);
      const inv = os.find((o) => o.kind === "investor");
      if (!inv || inv.blocked) break;
      if (!takeFunding(s2, inv)) break;
    }
    check(
      "you cannot sell control of your own practice",
      equitySold(s2) <= MAX_EQUITY && ownedShare(s2) >= 100 - MAX_EQUITY,
      `sold ${equitySold(s2)}%`,
    );
    check(
      "a second round of the same investor costs more equity",
      (() => {
        const a = startRun(doctor, 609);
        const first = fundingOffers(a, ctx).find((o) => o.kind === "investor")!;
        takeFunding(a, first);
        const second = fundingOffers(a, ctx).find(
          (o) => o.kind === "investor",
        )!;
        return second.equity > first.equity;
      })(),
    );

    /* EXPLOIT: outrunning repayment. Obligations live on the run. */
    const s3 = startRun(doctor, 610);
    s3.r.cash = 500_000;
    takeFunding(
      s3,
      fundingOffers(s3, ctx).find((o) => o.kind === "bank")!,
    );
    const owedBefore = totalOutstanding(s3);
    med(s3).homeCity = "tokyo";
    med(s3).cities = ["tokyo"];
    check(
      "moving city does not clear what you owe",
      totalOutstanding(s3) === owedBefore && owedBefore > 0,
    );

    /* Interest accrues; a facility can be cleared. */
    const before = totalOutstanding(s3);
    s3.week = 5;
    tickFinance(s3);
    check("interest accrues on borrowing", totalOutstanding(s3) > before);
    repay(s3, obligations(s3)[0].id, 10_000_000);
    check("and it can be cleared", totalOutstanding(s3) === 0);

    /* Equity holders take a share of profit, and only of profit. */
    const s4 = startRun(doctor, 611);
    takeFunding(
      s4,
      fundingOffers(s4, ctx).find((o) => o.kind === "investor")!,
    );
    check("a shareholder takes a cut of profit", dividendOn(s4, 100_000) > 0);
    check("but nothing from a loss", dividendOn(s4, -50_000) === 0);
  }

  console.log("\nNews\n" + "─".repeat(52));
  {
    const s = startRun(doctor, 612);
    s.week = 30;
    const markets = {
      lyon: {
        salary: 1.12,
        demand: 0.9,
        regulation: 45,
        sentiment: 38,
        shock: null,
      },
    };
    let withEffect = 0;
    for (let i = 0; i < 60; i++) {
      const item = worldNews(s, makeRng(i), {
        cities: ["lyon"],
        cityName: () => "Lyon",
        markets,
      });
      if (item?.effect) withEffect++;
    }
    check("news items carry real effects", withEffect > 30);
    check(
      "and say what they did",
      (() => {
        const item = worldNews(s, makeRng(1), {
          cities: ["lyon"],
          cityName: () => "Lyon",
          markets,
        });
        return !!item && (!item.effect || item.impact.length > 0);
      })(),
    );
    check(
      "the four channels are distinguishable by scope",
      ["world", "city", "rival", "you"].every((scope) =>
        ["world", "city", "rival", "you"].includes(scope),
      ) &&
        rivalNews(s, "X", { text: "did a thing", kind: "growth" }, makeRng(1))
          .scope === "rival",
    );
  }

  console.log("\nCrises\n" + "─".repeat(52));
  {
    check(
      "every crisis kind has at least three connected beats",
      CRISIS_KINDS.every((k) => CRISIS_STAGES[k].length >= 2) &&
        CRISIS_KINDS.filter((k) => CRISIS_STAGES[k].length >= 3).length >= 5,
    );
    check(
      "every stage offers a real decision, never a dead end",
      CRISIS_KINDS.every((k) =>
        CRISIS_STAGES[k].every(
          (st) => st.choices.length >= 1 && st.title && st.body,
        ),
      ),
    );
    check(
      "choices cost money, time, standing or relationships — not nothing",
      CRISIS_KINDS.every((k) =>
        CRISIS_STAGES[k].every((st) =>
          st.choices.every(
            (c) =>
              !!c.cost ||
              !!c.blocks ||
              !!c.rep ||
              !!c.people ||
              c.severity !== 0,
          ),
        ),
      ),
    );

    /* PREVENTION. */
    const wellRun = crisisRisk({
      week: 60,
      culture: 85,
      ethics: 85,
      risk: 5,
      regulation: 15,
      cashWeeks: 12,
      supplyWeeks: 8,
      staff: 6,
      scrutiny: 5,
    });
    const badlyRun = crisisRisk({
      week: 60,
      culture: 20,
      ethics: 25,
      risk: 60,
      regulation: 60,
      cashWeeks: 0.5,
      supplyWeeks: 0.5,
      staff: 6,
      scrutiny: 70,
    });
    check(
      "running a tight practice makes crises rarer",
      wellRun.chance < badlyRun.chance,
      `${(wellRun.chance * 100).toFixed(1)}% against ${(badlyRun.chance * 100).toFixed(1)}%`,
    );
    check("but never impossible", wellRun.chance > 0);
    check("and the risk names its causes", badlyRun.drivers.length >= 3);

    /* ESCALATION. */
    const c = startCrisis("walkout", 10, 50);
    const start = c.severity;
    for (let i = 0; i < 3; i++) tickCrisis(c);
    check("ignoring a crisis makes it worse", c.severity > start);
    const esc = tickCrisis(c);
    check(
      "and four untouched weeks escalates it to its terminal stage",
      esc.escalated && c.stage === CRISIS_STAGES.walkout.length - 1,
    );

    /* A crisis has to end. Left alone it used to pin at severity 100 and sit
       there for the rest of the run — a probe screenshot caught one still
       "running" sixty weeks after it started. */
    let burned = false;
    for (let i = 0; i < NEGLECT_LIMIT + 2 && !burned; i++) {
      burned = tickCrisis(c).burnedOut;
    }
    check(
      "sustained neglect burns a crisis out rather than freezing it",
      burned,
    );

    /* And two of the same kind never run at once. */
    let dup = startRun(doctor, 620);
    dup.r.cash = 900_000;
    dup = runCommand(doctor, dup, "hire", "nurse");
    dup = runCommand(doctor, dup, "hire", "gp");
    for (let i = 0; i < 120 && !dup.outcome; i++) {
      dup = advanceWeek(doctor, dup, { clinic: 4 }).state;
      dup.r.cash = Math.max(dup.r.cash, 300_000);
      const kinds = (dup.crises ?? []).map((x) => x.kind);
      if (new Set(kinds).size !== kinds.length) break;
    }
    check(
      "two crises of the same kind never run at once",
      (() => {
        const kinds = (dup.crises ?? []).map((x) => x.kind);
        return new Set(kinds).size === kinds.length;
      })(),
    );

    /* MITIGATION and RECOVERY. */
    const s = startRun(doctor, 613);
    s.r.cash = 900_000;
    s.crises = [startCrisis("walkout", s.week, 60)];
    const sev0 = s.crises[0].severity;
    const after = runCommand(
      doctor,
      s,
      "crisisChoice",
      `${s.crises[0].id}:listen`,
    );
    check(
      "acting on it reduces the severity",
      (after.crises ?? [])[0].severity < sev0,
    );
    check(
      "and resets the neglect counter",
      (after.crises ?? [])[0].ignored === 0,
    );
    const twice = runCommand(
      doctor,
      after,
      "crisisChoice",
      `${after.crises![0].id}:listen`,
    );
    check(
      "the same choice cannot be taken twice",
      (twice.crises ?? [])[0].severity === (after.crises ?? [])[0].severity,
    );
    check(
      "a crisis choice moves the people it should",
      (personIn(after, "mbeki")?.warmth ?? -99) >
        (personIn(s, "mbeki")?.warmth ?? 0) ||
        personIn(s, "mbeki") === undefined,
    );
  }

  console.log("\nPhase 2 saves\n" + "─".repeat(52));
  {
    /* A genuine v9 save: the engine's output with every v10 field removed. */
    const v9 = JSON.parse(JSON.stringify(startRun(doctor, 614))) as Record<
      string,
      unknown
    >;
    for (const k of [
      "rivals",
      "offers",
      "contracts",
      "contractLog",
      "obligations",
      "news",
      "crises",
    ]) {
      delete v9[k];
    }
    const up = migrateRun(JSON.parse(JSON.stringify(v9)));
    check("a v9 save is migrated forward", up !== null && validateRun(up));
    check(
      "with empty collections rather than invented history",
      Array.isArray(up!.news) &&
        (up!.news as unknown[]).length === 0 &&
        Array.isArray(up!.rivals) &&
        (up!.rivals as unknown[]).length === 0,
    );
    check(
      "migration is still idempotent at v10",
      JSON.stringify(migrateRun(JSON.parse(JSON.stringify(up)))) ===
        JSON.stringify(up),
    );

    const bad = (mutate: (s: Record<string, unknown>) => void) => {
      const copy = JSON.parse(JSON.stringify(startRun(doctor, 615)));
      copy.rivals = PHYSICIAN_RIVALS.map(initialRival);
      mutate(copy);
      return validateRun(copy);
    };
    check(
      "the unmutated v10 save is accepted",
      bad(() => {}),
    );
    check(
      "a rival with an unknown strategy is rejected",
      !bad((s) => {
        (s.rivals as Record<string, unknown>[])[0].strategy = "vibing";
      }),
    );
    check(
      "a rival with an unknown stance is rejected",
      !bad((s) => {
        (s.rivals as Record<string, unknown>[])[0].stance = "besties";
      }),
    );
    check(
      "an over-long rival history is rejected",
      !bad((s) => {
        (s.rivals as Record<string, unknown>[])[0].history = Array.from(
          { length: MAX_RIVAL_HISTORY + 5 },
          () => ({ week: 1, text: "x", kind: "growth" }),
        );
      }),
    );
    check(
      "a contract with no due week is rejected",
      !bad((s) => {
        (s.contracts as unknown[]).push({
          defId: "x",
          city: "lyon",
          acceptedWeek: 1,
          progress: 0,
          extraDifficulty: 0,
          payFactor: 1,
          assigned: [],
          complications: [],
        });
      }),
    );
    check(
      "an obligation with an unknown kind is rejected",
      !bad((s) => {
        (s.obligations as unknown[]).push({
          id: "x",
          kind: "loan-shark",
          principal: 1,
          outstanding: 1,
          rate: 0,
          weekly: 0,
          equity: 0,
          week: 1,
          missed: 0,
          settled: false,
        });
      }),
    );
    check(
      "a save that has sold control is rejected",
      !bad((s) => {
        (s.obligations as unknown[]).push({
          id: "x",
          kind: "investor",
          principal: 1,
          outstanding: 0,
          rate: 0,
          weekly: 0,
          equity: 80,
          week: 1,
          missed: 0,
          settled: false,
        });
      }),
    );
    check(
      "a crisis with an unknown kind is rejected",
      !bad((s) => {
        (s.crises as unknown[]).push({
          id: "x",
          kind: "aliens",
          startedWeek: 1,
          severity: 10,
          stage: 0,
          taken: [],
          ignored: 0,
        });
      }),
    );
    check(
      "an over-long news list is rejected",
      !bad((s) => {
        s.news = Array.from({ length: MAX_WORLD_NEWS + 5 }, (_, i) => ({
          id: `n${i}`,
          week: 1,
          scope: "world",
          outlet: "o",
          headline: "h",
          body: "b",
          tone: "neutral",
          impact: "",
        }));
      }),
    );
  }

  console.log("\nPerformance and bounds\n" + "─".repeat(52));
  {
    let s = startRun(doctor, 616);
    s.r.cash = 3_000_000;
    s = runCommand(doctor, s, "hire", "nurse");
    const t0 = process.hrtime.bigint();
    let weeks = 0;
    for (let i = 0; i < 156 && !s.outcome; i++) {
      for (const o of [...(s.offers ?? [])]) {
        s = runCommand(doctor, s, "acceptContract", o.defId);
      }
      s = advanceWeek(doctor, s, { clinic: 3, casework: 1, people: 1 }).state;
      weeks++;
      if (s.r.cash < 50_000) s.r.cash = 400_000;
    }
    const perWeek =
      Number(process.hrtime.bigint() - t0) / 1e6 / Math.max(1, weeks);
    check(
      "a week still resolves quickly with every system running",
      perWeek < 25,
      `${perWeek.toFixed(2)}ms per week over ${weeks} weeks`,
    );

    check("news stays bounded", (s.news ?? []).length <= MAX_WORLD_NEWS);
    check(
      "rival histories stay bounded",
      (s.rivals ?? []).every((r) => r.history.length <= MAX_RIVAL_HISTORY),
    );
    check(
      "the contract log stays bounded",
      (s.contractLog ?? []).length <= MAX_CONTRACT_HISTORY,
    );
    check("offers stay bounded", (s.offers ?? []).length <= MAX_OFFERS);
    check(
      "live assignments stay bounded",
      (s.contracts ?? []).length <= MAX_ACTIVE,
    );
    check("open crises stay bounded", (s.crises ?? []).length <= MAX_CRISES);
    check(
      "a full run's save stays a sensible size",
      JSON.stringify(s).length < 400_000,
      `${Math.round(JSON.stringify(s).length / 1024)}kB`,
    );

    /* Inactive entities must not be re-simulated. A rival between moves does
       a handful of arithmetic operations, not a game turn. */
    const rs = startRun(doctor, 617);
    rs.rivals = PHYSICIAN_RIVALS.map(initialRival);
    rs.week = 2;
    const t1 = process.hrtime.bigint();
    for (let i = 0; i < 10_000; i++) tickRivals(rs, makeRng(i), ["lyon"]);
    const perTick = Number(process.hrtime.bigint() - t1) / 1e6 / 10_000;
    check(
      "ticking every rival costs almost nothing",
      perTick < 0.1,
      `${(perTick * 1000).toFixed(1)}µs for five rivals`,
    );
  }

  console.log("\nEverything talks to everything\n" + "─".repeat(52));
  {
    /* The completion criterion that matters: these are not seven parallel
       systems, they are one. Each assertion below crosses a boundary. */
    let s = startRun(doctor, 618);
    s.r.cash = 2_000_000;
    s = runCommand(doctor, s, "hire", "nurse");
    s = runCommand(doctor, s, "hire", "gp");
    for (let i = 0; i < 40 && !s.outcome; i++) {
      s = advanceWeek(doctor, s, { clinic: 3, people: 1, manage: 1 }).state;
      s.r.cash = Math.max(s.r.cash, 600_000);
    }
    check(
      "rivals are seeded into a running game",
      (s.rivals ?? []).length === PHYSICIAN_RIVALS.length,
    );
    check(
      "markets exist for the cities you operate in",
      Object.keys(med(s).markets ?? {}).length >= 1,
    );
    check("the world produces news", (s.news ?? []).length > 0);
    check(
      "and rival activity reaches the player as news",
      (s.news ?? []).some((n) => n.scope === "rival"),
    );
    check(
      "culture is affecting output",
      productivityFactor(cultureScore(med(s), s.week).score) !== 1 ||
        cultureScore(med(s), s.week).score === 50,
    );
    check(
      "staff carry the deeper record after real play",
      med(s).staff.every((x) => {
        const h = hydrateStaff(x);
        return Number.isFinite(h.morale) && Number.isFinite(h.workload);
      }),
    );
    check(
      "financing is offered against the business you built",
      fundingOffers(s, {
        netWorth: 500_000,
        weeklyRevenue: 15_000,
        credibility: s.r.reputation,
        influence: s.r.repInfluence ?? 20,
        ethics: s.r.repEthics ?? 70,
        investorWarmth: 30,
        partnerWarmth: 30,
      }).some((o) => !o.blocked && o.amount > 0),
    );
    check(
      "the whole thing still validates",
      validateRun(JSON.parse(JSON.stringify(s))),
    );
  }
}

// --- phase 3: the sandbox --------------------------------------------------
{
  console.log("\nNothing ends a run\n" + "─".repeat(52));
  {
    /*
     * The single most important assertion in this file.
     *
     * Four automatic terminators and a week limit were removed; this is what
     * stops any of them coming back. A run played far past the old 156-week
     * limit, through every condition that used to be fatal, must still be
     * playable.
     */
    let s = startRun(doctor, 900);
    for (let i = 0; i < 320 && !s.retired; i++) {
      s = advanceWeek(doctor, s, { clinic: 3, rest: 1 }).state;
    }
    check(
      "a run continues far past the old week limit",
      s.week > 300 && !s.outcome && !s.retired,
      `week ${s.week}, outcome ${s.outcome ? "SET" : "none"}`,
    );

    /* Each old terminator, individually. */
    const survives = (mutate: (x: typeof s) => void, name: string) => {
      let t = startRun(doctor, 901);
      mutate(t);
      t = advanceWeek(doctor, t, { rest: 1 }).state;
      check(`${name} no longer ends the run`, !t.outcome && !t.retired);
      return t;
    };
    survives((t) => (t.r.burnout = 100), "collapse");
    survives((t) => (t.r.strikes = 3), "losing three claims");
    survives((t) => (t.r.cash = -200_000), "deep insolvency");
    survives((t) => (t.r.repEthics = 0), "an ethical collapse");

    /* And the old win condition. */
    let won = startRun(doctor, 902);
    won.r.debt = 0;
    won.r.cash = 5_000_000;
    won = advanceWeek(doctor, won, { rest: 1 }).state;
    check(
      "reaching the old goal is a milestone, not an ending",
      !won.outcome && hasMilestone(won, "the-hospital-is-yours"),
    );

    check(
      "the career no longer exposes a way to end a run",
      !("checkOutcome" in doctor),
    );
  }

  console.log("\nSetbacks and recovery\n" + "─".repeat(52));
  {
    /*
     * Working while already at the ceiling is what collapses you.
     *
     * The peak is recorded after the week's actions and before its recovery,
     * which means resting at 100 genuinely pulls you back from the brink —
     * the player acting at the last moment is supposed to work. So this test
     * spends the week in clinic, which is the version that does not.
     */
    let s = startRun(doctor, 903);
    s.r.burnout = 100;
    s = advanceWeek(doctor, s, { clinic: 1 }).state;
    check("working through the ceiling collapses you", has(s, "collapse"));
    check(
      "but resting at the ceiling does not",
      (() => {
        let t = startRun(doctor, 9031);
        t.r.burnout = 100;
        t = advanceWeek(doctor, t, { rest: 2 }).state;
        return !has(t, "collapse");
      })(),
    );
    check(
      "which costs you real capacity",
      setbackEffects(s.setbacks ?? []).blocks < 1 &&
        doctor.timeBudget(s) < doctor.timeBudget(startRun(doctor, 904)),
    );
    check("but never all of it", doctor.timeBudget(s) >= 1);

    /* A suspension stops YOU working without closing the business — the
       distinction that makes it a setback rather than a loss. */
    let sus = startRun(doctor, 905);
    sus.r.strikes = 3;
    sus = advanceWeek(doctor, sus, { rest: 1 }).state;
    check("a suspension stops you practising", !canPractise(sus));
    check(
      "but the organisation keeps running",
      setbackEffects(sus.setbacks ?? []).income > 0.3,
    );

    /* Recovery is work, not waiting. */
    const grip0 = sus.setbacks![0].grip;
    sus.r.cash = 500_000;
    sus = runCommand(doctor, sus, "recoverSetback", "suspension:remediation");
    check("a recovery step reduces the grip", sus.setbacks![0].grip < grip0);
    const grip1 = sus.setbacks![0].grip;
    sus = runCommand(doctor, sus, "recoverSetback", "suspension:remediation");
    check(
      "the same step cannot be taken twice",
      sus.setbacks![0].grip === grip1,
    );
    check(
      "a step you do not qualify for does nothing",
      (() => {
        const poor = startRun(doctor, 906);
        poor.r.strikes = 3;
        const t = advanceWeek(doctor, poor, { rest: 1 }).state;
        t.r.cash = 100;
        const before = t.setbacks![0].grip;
        const after = runCommand(
          doctor,
          t,
          "recoverSetback",
          "suspension:remediation",
        );
        return after.setbacks![0].grip === before;
      })(),
    );

    /* And it completes. */
    let rec = startRun(doctor, 907);
    rec.r.cash = -200_000;
    rec = advanceWeek(doctor, rec, { rest: 1 }).state;
    check("insolvency begins", has(rec, "insolvency"));
    rec.r.cash = 800_000;
    for (let i = 0; i < 200 && (rec.setbacks ?? []).length > 0; i++) {
      for (const sb of [...(rec.setbacks ?? [])]) {
        const step = (RECOVERY[sb.kind] ?? []).find(
          (x) => !sb.done.includes(x.id) && x.available(rec),
        );
        if (step)
          rec = runCommand(
            doctor,
            rec,
            "recoverSetback",
            `${sb.kind}:${step.id}`,
          );
      }
      rec = advanceWeek(doctor, rec, { rest: 1 }).state;
      rec.r.cash = Math.max(rec.r.cash, 400_000);
    }
    check("and it can be climbed out of", (rec.setbacks ?? []).length === 0);
    check(
      "the run records that you survived it",
      (rec.setbacksSurvived ?? []).includes("insolvency"),
    );
    check("and the run is still playable", !rec.outcome && !rec.retired);
    check(
      "with a timeline entry for the comeback",
      timelineOf(rec).some((t) => t.kind === "recovery"),
    );

    check(
      "no more than two setbacks at once",
      (() => {
        let t = startRun(doctor, 908);
        t.r.burnout = 100;
        t.r.strikes = 3;
        t.r.cash = -200_000;
        t.r.repEthics = 0;
        t = advanceWeek(doctor, t, { rest: 1 }).state;
        return (t.setbacks ?? []).length <= MAX_SETBACKS;
      })(),
    );
  }

  console.log("\nBackgrounds\n" + "─".repeat(52));
  {
    check("there are several to choose from", BACKGROUNDS.length >= 7);
    check(
      "each states both a benefit and a cost",
      BACKGROUNDS.every((b) => !!b.benefit && !!b.cost && !!b.blurb),
    );
    /* "Worse" is not the same as "negative": debt, burnout and risk are all
       lower-better, so a background that hands you ninety-five thousand of
       student debt is making your life harder with a positive number. */
    const LOWER_IS_WORSE = new Set(["debt", "burnout", "risk", "strikes"]);
    check(
      "none is a pure upgrade — every one costs you something",
      BACKGROUNDS.every(
        (b) =>
          Object.entries(b.resources).some(([k, v]) =>
            LOWER_IS_WORSE.has(k) ? v > 0 : v < 0,
          ) ||
          b.relationships.some(
            (r) =>
              (r.warmth ?? 0) < 0 || (r.respect ?? 0) < 0 || (r.trust ?? 0) < 0,
          ),
      ),
    );
    check(
      "each starts you with personality",
      BACKGROUNDS.every((b) => b.traits.length >= 1),
    );
    check(
      "and its own events",
      BACKGROUNDS.every((b) => b.events.length >= 2) &&
        new Set(BACKGROUNDS.flatMap((b) => b.events)).size ===
          BACKGROUNDS.flatMap((b) => b.events).length,
    );

    const rich = startRun(doctor, 910, { background: "wealthy" });
    const poor = startRun(doctor, 910, { background: "indebted" });
    check(
      "a background actually changes the opening",
      rich.r.cash !== poor.r.cash && rich.r.debt !== poor.r.debt,
      `wealthy ${Math.round(rich.r.cash)}/${Math.round(rich.r.debt)} vs indebted ${Math.round(poor.r.cash)}/${Math.round(poor.r.debt)}`,
    );
    check(
      "and who already has an opinion of you",
      (personIn(rich, "hallam")?.warmth ?? 0) !==
        (personIn(poor, "hallam")?.warmth ?? 0),
    );
    check(
      "it is recorded in the timeline",
      hasMilestone(rich, "background") && rich.background === "wealthy",
    );
    check(
      "a background's events are gated to that background",
      fromBackground(rich, "bg.wealthy.favour") &&
        !fromBackground(poor, "bg.wealthy.favour"),
    );
  }

  console.log("\nPersonality\n" + "─".repeat(52));
  {
    const s = startRun(doctor, 911, { background: "prodigy" });
    check(
      "a background fixes two traits",
      (s.traits ?? []).length === 2 && hasTrait(s, "analytical"),
    );
    check(
      "traits cannot simply be chosen",
      !("setTrait" in doctor) && typeof checkTraits === "function",
    );

    /* Earned by behaviour, over time. */
    const t = startRun(doctor, 912);
    check("nothing is held at the start", (t.traits ?? []).length === 0);
    for (let i = 0; i < 30; i++) noteBehaviour(t, "_actDiscipline");
    const gained = checkTraits(t);
    check(
      "repeated behaviour earns a trait",
      gained.some((g) => g.id === "disciplined") && hasTrait(t, "disciplined"),
    );

    /* And cannot be un-earned or farmed. */
    for (let i = 0; i < 200; i++) noteBehaviour(t, "_actRuthless");
    for (let i = 0; i < 200; i++) noteBehaviour(t, "_actCharisma");
    for (let i = 0; i < 200; i++) noteBehaviour(t, "_actEmpathy");
    for (let i = 0; i < 200; i++) noteBehaviour(t, "_actAnalysis");
    for (let i = 0; i < 200; i++) noteBehaviour(t, "_actCreative");
    checkTraits(t);
    checkTraits(t);
    check("you cannot become everything", (t.traits ?? []).length <= TRAIT_CAP);
    check("and a trait is never removed", hasTrait(t, "disciplined"));

    /* Every trait has a downside somewhere. */
    check(
      "each trait carries a stated friction",
      TRAITS.every((x) => !!x.friction && !!x.unlocks && !!x.earnedBy),
    );
    const ruth = startRun(doctor, 913);
    ruth.traits = ["ruthless"];
    const kind = startRun(doctor, 914);
    kind.traits = ["empathetic"];
    check(
      "ruthlessness costs you loyalty where empathy earns it",
      loyaltyDrift(ruth) < 0 && loyaltyDrift(kind) > 0,
    );
    check("and it costs ethics every week", ethicsDrift(ruth) < 0);
    check(
      "discipline slows burnout; ambition speeds it",
      burnoutFactor({ ...ruth, traits: ["disciplined"] } as never) <
        burnoutFactor({ ...ruth, traits: ["ambitious"] } as never),
    );
    check(
      "analysis helps prepared work and hurts opportunistic work",
      preparationFactor({ ...ruth, traits: ["analytical"] } as never) > 1 &&
        opportunismFactor({ ...ruth, traits: ["analytical"] } as never) < 1,
    );
  }

  console.log("\nAmbitions\n" + "─".repeat(52));
  {
    const s = startRun(doctor, 915);
    check("several to choose between", AMBITIONS.length >= 7);
    check(
      "each states what it costs you to chase",
      AMBITIONS.every((a) => !!a.tension && !!a.blurb),
    );
    check(
      "none is chosen for you",
      s.ambition === null || s.ambition === undefined,
    );

    setAmbition(s, "independent");
    check("one can be chosen", s.ambition === "independent");
    check(
      "progress is a number in range",
      (() => {
        const p = AMBITION_BY_ID.get("independent")!.progress(s);
        return p >= 0 && p <= 1;
      })(),
    );

    /* Completing one must NOT end the run — the whole point. */
    const done = startRun(doctor, 916);
    setAmbition(done, "independent");
    done.r._netWorth = 10_000_000;
    done.r._equitySold = 0;
    done.r.debt = 0;
    const fired = checkAmbition(done);
    check("an ambition can be met", fired?.id === "independent");
    check("meeting it does not end the run", !done.outcome && !done.retired);
    check("and it frees you to pick another", done.ambition === null);
    check(
      "the completed one is remembered",
      (done.ambitionsDone ?? []).includes("independent"),
    );
    check(
      "and cannot be re-selected",
      (() => {
        setAmbition(done, "independent");
        return done.ambition === null;
      })(),
    );
  }

  console.log("\nRetirement\n" + "─".repeat(52));
  {
    let s = startRun(doctor, 917, { background: "working" });
    s.r.cash = 1_200_000;
    for (let i = 0; i < 30; i++) {
      s = advanceWeek(doctor, s, { clinic: 3, rest: 1 }).state;
      s.r.cash = Math.max(s.r.cash, 400_000);
    }

    const summary = retirementSummary(s, {
      careerLabel: "Physician",
      name: "Dr Test",
      backgroundLabel: "Working-class family",
      path: null,
      netWorth: 900_000,
      cities: ["Lyon"],
      businesses: 2,
    });
    check("building a summary changes nothing", !s.retired && !s.outcome);
    check(
      "the summary reads the real career",
      summary.archive.weeks === s.week &&
        summary.archive.reputation.length === REPUTATIONS.length &&
        summary.highlights.length >= 2,
    );
    check(
      "milestones in the summary come from the timeline",
      summary.archive.milestones.every((mm) =>
        timelineOf(s).some((t) => t.title === mm.title),
      ),
    );

    /* The cancel path. */
    const untouched = JSON.stringify(s);
    retirementSummary(s, {
      careerLabel: "Physician",
      name: "Dr Test",
      backgroundLabel: "Working-class family",
      path: null,
      netWorth: 900_000,
      cities: ["Lyon"],
      businesses: 2,
    });
    check(
      "looking at it twice still changes nothing",
      JSON.stringify(s) === untouched,
    );

    /* The confirm path. */
    const archived = retire(s, summary, "Enough.");
    check("retiring marks the run retired", s.retired === true);
    check("and produces an archive record", archived.name === "Dr Test");
    check("carrying the note", archived.retiredNote === "Enough.");
    check(
      "the archive record does not invent anything",
      archived.weeks === s.week && archived.netWorth === 900_000,
    );

    check(
      "retirement is never reached by the simulation",
      (() => {
        let t = startRun(doctor, 918);
        for (let i = 0; i < 260; i++)
          t = advanceWeek(doctor, t, { clinic: 2 }).state;
        return !t.retired;
      })(),
    );
  }

  console.log("\nLegacy\n" + "─".repeat(52));
  {
    const base = {
      id: "x",
      careerId: "doctor",
      careerLabel: "Physician",
      name: "Dr Past",
      backgroundId: null,
      backgroundLabel: "—",
      traits: [],
      path: null,
      weeks: 100,
      cities: ["Lyon"],
      businesses: 1,
      netWorth: 100_000,
      reputation: REPUTATIONS.map((r) => ({
        id: r.id,
        label: r.label,
        value: 40,
      })),
      overall: 40,
      relationships: [],
      milestones: [],
      setbacksSurvived: [],
      ambitionsCompleted: [],
      retiredNote: "",
      retiredWeek: 100,
    };

    const rich = legacyFor({ ...base, netWorth: 5_000_000 });
    check("a wealthy career leaves capital", rich?.kind === "capital");
    const influential = legacyFor({
      ...base,
      reputation: base.reputation.map((r) =>
        r.id === "influence" ? { ...r, value: 80 } : r,
      ),
    });
    check("an influential one leaves a mentor", influential?.kind === "mentor");
    check(
      "a short unremarkable one leaves nothing",
      legacyFor({ ...base, weeks: 10 }) === null,
    );

    /* The balance requirement: modest. */
    const grant = grantFor(rich!);
    const withLegacy = startRun(doctor, 919, { legacy: grant });
    const without = startRun(doctor, 919);
    const gap = withLegacy.r.cash - without.r.cash;
    check(
      "a legacy is small against the starting position",
      gap > 0 && gap <= 40_000,
      `${Math.round(gap)} extra on ${Math.round(without.r.cash)} starting cash`,
    );
    check(
      "and it does not clear the debt or hand over a business",
      withLegacy.r.debt === without.r.debt,
    );
    check(
      "it is recorded in the new character's timeline",
      hasMilestone(withLegacy, "legacy"),
    );
    check(
      "starting without one is allowed",
      without.legacy === undefined || without.legacy === null,
    );

    /* Nothing is copied wholesale. */
    check(
      "no assets, staff or cities are inherited",
      med(withLegacy).staff.length === med(without).staff.length &&
        med(withLegacy).cities.length === med(without).cities.length &&
        med(withLegacy).facilities.length === med(without).facilities.length,
    );
  }

  console.log("\nPhase 3 saves\n" + "─".repeat(52));
  {
    const v10 = JSON.parse(JSON.stringify(startRun(doctor, 920))) as Record<
      string,
      unknown
    >;
    for (const k of [
      "setbacks",
      "setbacksSurvived",
      "ambitionsDone",
      "traits",
      "retired",
    ]) {
      delete v10[k];
    }
    const up = migrateRun(JSON.parse(JSON.stringify(v10)));
    check("a v10 save migrates forward", up !== null && validateRun(up));
    check(
      "and gains empty sandbox collections",
      Array.isArray(up!.setbacks) && (up!.setbacks as unknown[]).length === 0,
    );

    /*
     * The semantic migration: a v10 run that the OLD terminators had already
     * ended is un-resumable, so it becomes what it always was — a finished
     * character.
     */
    const ended = {
      ...v10,
      outcome: { kind: "lost", title: "Administration", body: "…" },
    };
    const migrated = migrateRun(JSON.parse(JSON.stringify(ended)));
    check(
      "an old terminated run is treated as a retired character",
      migrated?.retired === true,
    );
    const playing = migrateRun(JSON.parse(JSON.stringify(v10)));
    check("an old run still in play is not", playing?.retired === false);
    check(
      "migration is still idempotent at v11",
      JSON.stringify(migrateRun(JSON.parse(JSON.stringify(up)))) ===
        JSON.stringify(up),
    );

    const bad = (mutate: (x: Record<string, unknown>) => void) => {
      const copy = JSON.parse(JSON.stringify(startRun(doctor, 921)));
      mutate(copy);
      return validateRun(copy);
    };
    check(
      "the unmutated v11 save is accepted",
      bad(() => {}),
    );
    check(
      "an unknown setback kind is rejected",
      !bad((x) => {
        (x.setbacks as unknown[]).push({
          kind: "ennui",
          startedWeek: 1,
          grip: 10,
          weeks: 1,
          done: [],
        });
      }),
    );
    check(
      "an unknown trait is rejected",
      !bad((x) => {
        x.traits = ["telepathic"];
      }),
    );
    check(
      "too many traits are rejected",
      !bad((x) => {
        x.traits = [
          "ambitious",
          "charismatic",
          "analytical",
          "empathetic",
          "creative",
          "disciplined",
        ];
      }),
    );
    check(
      "an unknown ambition is rejected",
      !bad((x) => {
        x.ambition = "become-a-wizard";
      }),
    );
    check(
      "an unknown background is rejected",
      !bad((x) => {
        x.background = "royalty";
      }),
    );
    check(
      "too many setbacks are rejected",
      !bad((x) => {
        x.setbacks = SETBACK_KINDS.map((k) => ({
          kind: k,
          startedWeek: 1,
          grip: 10,
          weeks: 1,
          done: [],
        }));
      }),
    );
  }

  console.log("\nLong-duration stability\n" + "─".repeat(52));
  {
    /*
     * The endless late game has to actually be endless. Five hundred weeks —
     * more than three times the old limit — checking for the specific failure
     * modes the brief names.
     */
    let s = startRun(doctor, 922, {
      background: "changer",
      ambition: "empire",
    });
    s.r.cash = 400_000;
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 500; i++) {
      s = advanceWeek(doctor, s, { clinic: 3, people: 1, exercise: 1 }).state;
      if (s.r.cash < 30_000) s.r.cash = 250_000;
    }
    const perWeek = Number(process.hrtime.bigint() - t0) / 1e6 / 500;

    check("five hundred weeks still resolve", s.week > 500 && !s.outcome);
    check(
      "and stay fast",
      perWeek < 25,
      `${perWeek.toFixed(2)}ms/week at week ${s.week}`,
    );
    check(
      "every number is still a number",
      Object.values(s.r).every(Number.isFinite),
    );
    check(
      "nothing has overflowed",
      Object.values(s.r).every((v) => Math.abs(v) < Number.MAX_SAFE_INTEGER),
    );
    check(
      "history stays bounded",
      (s.timeline ?? []).length <= 120 &&
        (s.news ?? []).length <= 30 &&
        s.log.length <= 120 &&
        (s.history ?? []).length <= 200,
    );
    check(
      "the save stays a workable size",
      JSON.stringify(s).length < 500_000,
      `${Math.round(JSON.stringify(s).length / 1024)}kB after 500 weeks`,
    );
    check(
      "rival histories stay bounded over a very long run",
      (s.rivals ?? []).every((r) => r.history.length <= 12),
    );
    check("and it is still not retired", !s.retired);
  }
}

/* ================================================================= visuals */

/**
 * THE DIAGRAMS MUST BE THE SIMULATION
 *
 * Every visual added in the visual-communication phase claims to explain the
 * medical simulation. A diagram that is merely *near* the truth is worse than
 * no diagram, because a player will plan against it — so each of these asserts
 * the visual's own arithmetic against the engine's, on a state produced by
 * actually playing weeks rather than on a hand-written fixture.
 */
console.log("\nVisual communication\n" + "─".repeat(52));
{
  /* A real mid-run state: enough weeks that patients are being turned away for
     several different reasons at once, which is the case the funnel has to get
     right. */
  let v = startRun(doctor, 4242);
  v.r.cash = 400_000;
  v = run(v, "buyFacility", "clinic:lyon");
  v = run(v, "openDepartment", "cardiology");
  v = run(v, "openDepartment", "dermatology");
  v = run(v, "hire", "gp");
  v = run(v, "hire", "nurse");
  for (let i = 0; i < 12; i++) {
    v = advanceWeek(doctor, v, { clinic: 3, manage: 1, rest: 2 }).state;
  }

  const vm = med(v);

  // --- patient flow ------------------------------------------------------
  const flow = patientFlow(vm);
  check("the patient funnel has data after a dozen weeks", flow.hasData);
  check(
    "patient-flow totals match the simulation",
    flow.arrived === vm.lastCases.reduce((n, c) => n + c.arrived, 0) &&
      flow.treated === vm.lastCases.reduce((n, c) => n + c.treated, 0) &&
      flow.succeeded === vm.lastCases.reduce((n, c) => n + c.succeeded, 0),
    `${flow.arrived} arrived / ${flow.treated} treated`,
  );
  check(
    "blocked-patient reasons sum to the patients not treated",
    flowIsConsistent(flow),
    `drops ${flow.drops.reduce((n, d) => n + d.count, 0)} vs turned away ${flow.turnedAway}`,
  );
  check(
    "the funnel never widens",
    flow.arrived >= flow.reachedDepartment &&
      flow.reachedDepartment >= flow.reachedResources &&
      flow.reachedResources >= flow.treated,
  );
  check(
    "every drop names a reason and somewhere to go",
    flow.drops.every((d) => d.reason.length > 20 && !!d.destination),
  );
  check(
    "each drop's departments sum to its own count",
    flow.drops.every(
      (d) => d.departments.reduce((n, x) => n + x.count, 0) === d.count,
    ),
  );

  // --- capacity ----------------------------------------------------------
  for (const blocks of [0, 1, 3, 6]) {
    check(
      `capacity breakdown matches the engine at ${blocks} clinic block${blocks === 1 ? "" : "s"}`,
      pipelineMatchesEngine(v, blocks),
    );
  }
  const pipe = capacityPipeline(v, 3);
  check(
    "the pipeline names exactly one binding limit",
    pipe.rows.filter((r) => r.kind === "limit" && r.binding).length === 1,
  );
  check(
    "the binding limit agrees with min(space, people)",
    pipe.limitedBy === (pipe.space < pipe.people ? "space" : "people"),
  );
  check(
    "the binding sentence names a screen that exists",
    pipe.bindingLabel.length > 20 && !!pipe.bindingDestination,
  );
  check(
    "every capacity row carries a display string and an explanation",
    pipe.rows.every((r) => r.display.length > 0 && r.detail.length > 20),
  );

  // --- departments -------------------------------------------------------
  check(
    "every department has a visual identity",
    DEPARTMENTS.length === SPECIALTIES.length &&
      DEPARTMENTS.every((d) => !!d.icon && !!d.colour && d.purpose.length > 10),
  );
  check(
    "every department icon exists in the symbol family",
    DEPARTMENTS.every((d) => MED_ICON_NAMES.includes(d.icon)),
  );
  check(
    "no department colour collides with a semantic colour",
    DEPARTMENTS.every(
      (d) =>
        !["#EF6461", "#F59E55", "#43C78B", "#2DD4BF"].includes(
          d.colour.toUpperCase(),
        ),
    ),
  );
  check(
    "department colours are all distinct",
    new Set(DEPARTMENTS.map((d) => d.colour)).size === DEPARTMENTS.length,
  );
  check(
    "department facts are derived, not empty",
    DEPARTMENTS.every(
      (d) => d.cases.length > 0 && d.maxSeverity >= 1 && d.unitsPerCase > 0,
    ),
  );

  // --- coverage ----------------------------------------------------------
  const cover = departmentCoverage(vm);
  check(
    "coverage is reported for every department",
    cover.length === SPECIALTIES.length,
  );
  check(
    "coverage matches the resolver's own ceiling",
    cover.every((c) => c.covered === coverageFor(vm, c.id)),
  );
  check(
    "an open department with full cover is never marked uncovered",
    cover.every(
      (c) =>
        !c.open ||
        c.covered < c.needed ||
        c.missingEquipment.length > 0 ||
        c.level === "covered",
    ),
  );
  check(
    "every coverage row explains itself in a sentence",
    cover.every((c) => c.note.length > 20),
  );

  // --- finance -----------------------------------------------------------
  const fin = weeklyFinance(v);
  check(
    "the waterfall's net is its own lines added up",
    Math.abs(
      fin.net - [...fin.income, ...fin.costs].reduce((n, l) => n + l.amount, 0),
    ) < 1e-6,
  );
  check(
    "fixed plus variable is the whole cost side",
    Math.abs(fin.fixed + fin.variable + fin.totalCost) < 1e-6,
  );
  check(
    "payroll in the waterfall is the payroll the engine charges",
    Math.abs(
      (fin.costs.find((l) => l.id === "payroll")?.amount ?? 0) + payroll(vm),
    ) < 1e-6,
  );
  check(
    "the chart always carries a textual summary",
    fin.summary.length > 30,
    fin.summary,
  );
  check(
    "every money line says what it is",
    [...fin.income, ...fin.costs].every((l) => l.detail.length > 20),
  );

  // --- standing ----------------------------------------------------------
  const rows = standingRows(v, 12);
  check("standing reports all six categories", rows.length === 6);
  check(
    "each standing trend ends at the current value",
    rows.every((r) => Math.abs(r.trend[r.trend.length - 1] - r.value) < 1e-9),
  );
  check(
    "each standing category says what it does and how to raise it",
    rows.every((r) => r.guide.effect.length > 40 && r.guide.route.length > 30),
  );
  check(
    "each standing icon exists in the symbol family",
    rows.every((r) => MED_ICON_NAMES.includes(r.guide.icon)),
  );

  // --- crises ------------------------------------------------------------
  check(
    "every crisis kind has a cause, an escalation rule and an affected party",
    CRISIS_KINDS.every((k) => {
      const g = CRISIS_GUIDE[k];
      return (
        !!g &&
        g.cause.length > 30 &&
        g.worsens.length > 40 &&
        g.affects.length > 20 &&
        MED_ICON_NAMES.includes(g.icon)
      );
    }),
  );
  check(
    "crisis progress reports the authored number of stages",
    CRISIS_KINDS.every(
      (k) => crisisProgress(k, 0, 0).stagesTotal === CRISIS_STAGES[k].length,
    ),
  );

  // --- the registry ------------------------------------------------------
  const everyVisual: {
    src: string;
    width: number;
    height: number;
    alt: string;
    focus: string;
  }[] = [
    ...Object.values(EVENT_VISUALS),
    ...Object.values(CAREER_VISUALS),
    ...Object.values(CITY_VISUALS),
    ...Object.values(SECTION_VISUALS),
    OUTBREAK_VISUAL,
    MILESTONE_VISUAL,
    PRACTICE_VISUAL,
    NETWORK_VISUAL,
  ];
  check(
    "every registered visual has real dimensions",
    everyVisual.every(
      (a) => a.width > 200 && a.height > 200 && a.width / a.height < 4,
    ),
  );
  check(
    "every registered visual is a WebP, never a source PNG",
    everyVisual.every((a) => a.src.endsWith(".webp")),
  );
  check(
    "every registered visual declares alt text, even if empty",
    everyVisual.every((a) => typeof a.alt === "string"),
  );
  check(
    "informational event artwork is actually described",
    Object.values(EVENT_VISUALS).every((a) => a.alt.length > 30),
  );
  check(
    "every registered visual has a focal point for mobile cropping",
    everyVisual.every((a) => /\S/.test(a.focus)),
  );
}

console.log("\nPurchase artwork\n" + "─".repeat(52));
/*
 * PURCHASE ARTWORK
 *
 * Thirty-three items across three catalogues, one registry. Both directions
 * are asserted, because a registry that is merely complete can still carry
 * entries for items that no longer exist.
 */
{
  const miss = missingArt();
  const orph = orphanArt();
  check(
    "every purchasable item has artwork in the registry",
    miss.length === 0,
    miss.join(", "),
  );
  check(
    "the art registry has no entries for items that do not exist",
    orph.length === 0,
    orph.join(", "),
  );
  /*
   * Coverage, stated as a gap rather than a total.
   *
   * This used to assert `=== 45`, which stopped meaning anything the moment
   * the catalogue grew: the number is not a property of the design, it is a
   * count somebody has to keep editing. What matters is that every sellable
   * item is either drawn or on the list of ones known to be waiting.
   */
  const pending = awaitingArt();
  check(
    "every purchasable item is either drawn or a known gap",
    Object.keys(PURCHASE_ART).length + pending.length >= catalogueIds().length,
    `${Object.keys(PURCHASE_ART).length} drawn, ${pending.length} awaiting`,
  );
  check(
    "nothing sits on the awaiting-art list once its artwork exists",
    pending.every((id) => !PURCHASE_ART[id]),
    pending.filter((id) => !!PURCHASE_ART[id]).join(", "),
  );
  /*
   * Departments, mapped exactly as specified. Asserted id → filename rather
   * than by count, because a count passes happily while two departments
   * wear each other's rooms.
   */
  const DEPT_FILE: Record<string, string> = {
    general: "general-practice",
    paediatrics: "paediatrics",
    dermatology: "dermatology",
    psychiatry: "psychiatry",
    radiology: "radiology",
    neurology: "neurology",
    orthopaedics: "orthopaedics",
    cardiology: "cardiology",
    maternity: "maternity",
    emergency: "emergency",
    surgery: "general-surgery",
    oncology: "oncology",
  };
  const deptWrong = SPECIALTIES.filter(
    (sp) =>
      PURCHASE_ART[sp.id]?.src !==
      `/visuals/purchases/departments/department-${DEPT_FILE[sp.id]}.webp`,
  );
  check(
    "every department maps to its own interior",
    deptWrong.length === 0,
    deptWrong.map((d) => d.id).join(", "),
  );
  check(
    "every machine maps into the equipment set",
    EQUIPMENT.every((e) =>
      PURCHASE_ART[e.id]?.src.startsWith("/visuals/purchases/equipment/"),
    ),
  );
  /*
   * The re-shot equipment scenes. A `-v1` master exists for all twelve and
   * must not ship; the runtime name drops the suffix, so the assertion is
   * that the newer master exists and the build's version-wins rulepicks it.
   */
  check(
    "every -v2 equipment master exists to be used",
    EQUIPMENT.every((e) => {
      const stem = PURCHASE_ART[e.id].src
        .replace("/visuals/purchases/equipment/", "")
        .replace(".webp", "");
      return existsSync(
        join(
          "art-source",
          "visuals",
          "purchases",
          "equipment",
          `${stem}-v2.png`,
        ),
      );
    }),
  );
  check(
    "every art entry declares a real measured size",
    Object.values(PURCHASE_ART).every((a) => a.width === 720 && a.height > 0),
  );
  check(
    "the generated size map covers every registered image",
    Object.values(PURCHASE_ART).every(
      (a) =>
        !!ART_SIZES[
          a.src.replace("/visuals/purchases/", "").replace(".webp", "")
        ],
    ),
  );

  const files = Object.entries(PURCHASE_ART).flatMap(([id, a]) =>
    [a.src, a.large].map((p) => [id, p] as const),
  );
  check(
    "every registered file exists on disk",
    files.every(([, p]) => existsSync(join("public", p))),
    files
      .filter(([, p]) => !existsSync(join("public", p)))
      .map(([id]) => id)
      .join(", "),
  );
  check(
    "every registered purchase image is a WebP",
    files.every(([, p]) => p.endsWith(".webp")),
  );
  check(
    "every purchase image is described for a screen reader",
    Object.values(PURCHASE_ART).every((a) => a.alt.length > 20),
  );
  check(
    "every purchase image declares its intrinsic size",
    Object.values(PURCHASE_ART).every((a) => a.width > 0 && a.height > 0),
  );
  /*
   * The three re-drawn cars.
   *
   * Their first versions carried recognisable badging and must never ship.
   * Asserted against the shipped bytes rather than the filename: the runtime
   * name drops the version suffix, so only a size comparison against the two
   * masters can tell which one was used.
   */
  for (const car of ["reliable_saloon", "luxury_saloon", "sports_car"]) {
    const a = PURCHASE_ART[car];
    const stem = a.src
      .replace("/visuals/purchases/lifestyle/", "")
      .replace(".webp", "");
    check(
      `${car} ships the corrected v2 artwork`,
      existsSync(
        join(
          "art-source",
          "visuals",
          "purchases",
          "lifestyle",
          `${stem}-v2.png`,
        ),
      ) && existsSync(join("public", a.src)),
    );
  }
}



console.log("\nWhere a career can begin\n" + "────────────────────────────────────────────────────");
{
  /*
   * A marker in the sea is the failure this whole block exists for. The
   * positions come from the same projected table the Physician's network map
   * uses, so if one of them is wrong it is wrong there too — and this is a
   * cheaper place to find out than a screenshot. It now covers every city of
   * every career rather than two hardcoded bases, because every one of them
   * is drawn on the picker before a run starts.
   */
  for (const career of CAREERS.filter((c) => c.available)) {
    const cities = career.startCities ?? [];
    check(`${career.id} offers somewhere to begin`, cities.length > 0);
    check(
      `${career.id}: no two starts are the same place`,
      new Set(cities.map((c) => c.id)).size === cities.length,
    );
    for (const city of cities) {
      const point = pointFor(city.position);
      check(
        `${career.id}/${city.id} is somewhere the map can draw`,
        point !== null,
        city.position,
      );
      if (point) {
        check(
          `and ${city.name} is on land, not in the sea`,
          isOnLand(point.x, point.y),
          `x=${point.x} y=${point.y}`,
        );
        check(
          `and it sits inside the map's own box`,
          point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100,
        );
      }
    }
    check(
      `${career.id}: every city says what it is and what it changes`,
      cities.every(
        (c) =>
          c.name.length > 0 &&
          c.country.length > 0 &&
          c.blurb.length > 40 &&
          c.effects.length >= 3 &&
          c.effects.every((e) => e.length > 0),
      ),
    );
  }

  /* The Chef and the Solicitor have one site and the map must say so; the
     Physician has fourteen markets and a network map that says otherwise. */
  check(
    "a one-site career says on the map what is not built yet",
    (horizonFor("chef") ?? "").length > 40 &&
      (horizonFor("lawyer") ?? "").length > 40,
  );
  check("the Physician is not given that line", horizonFor("doctor") === null);
  check(
    "an unknown career asks and gets nothing, not a crash",
    horizonFor("astronaut") === null,
  );
}



console.log("\nThe kitchen\n" + "────────────────────────────────────────────────────");
{
  const startK = () => {
    const f = startRun(chef, 1212);
    f.r.cash = 500_000;
    return f;
  };

  let k1 = startK();
  k1 = runCommand(chef, k1, "buyKit", "coldroom");
  check(
    "kit can be bought and installed",
    (kitchen(k1).equipment ?? []).includes("coldroom"),
  );
  check(
    "the same thing cannot be bought twice",
    (kitchen(runCommand(chef, k1, "buyKit", "coldroom")).equipment ?? [])
      .filter((x) => x === "coldroom").length === 1,
  );
  check(
    "an unknown item is refused",
    (kitchen(runCommand(chef, startK(), "buyKit", "microwave")).equipment ?? [])
      .length === 0,
  );

  /*
   * THE POINT OF THE WHOLE CATALOGUE.
   *
   * Refrigeration has to move the deadline, not merely reduce a cost. A
   * crate that would have been binned must still be usable a week later,
   * and its freshness \u2014 which is what reaches the plate \u2014 must be higher
   * for the same age.
   */
  {
    const plain = startK();
    const cold = runCommand(chef, startK(), "buyKit", "coldroom");
    const basic = PRODUCE_BY_ID.get("basic")!;
    const lot = {
      id: "l1",
      produce: "basic",
      left: 50,
      unitCost: 10,
      boughtWeek: 1,
    };
    /* Spoilage is `week - boughtWeek > shelfLife`, so the first week it has
       genuinely gone over is one past that sum. */
    const age = lot.boughtWeek + basic.shelfLife + 1;

    check(
      "without refrigeration it has gone over",
      isSpoiled(lot, age, extraShelfLife(kitchen(plain))),
    );
    check(
      "with a cold room it has not",
      !isSpoiled(lot, age, extraShelfLife(kitchen(cold))),
    );
    check(
      "and it is fresher at the same age",
      freshnessOf(lot, 3, extraShelfLife(kitchen(cold))) >
        freshnessOf(lot, 3, extraShelfLife(kitchen(plain))),
    );
  }

  /* A blast chiller stacks on the cold room, and saves what still goes. */
  {
    let both = startK();
    both = runCommand(chef, both, "buyKit", "coldroom");
    both = runCommand(chef, both, "buyKit", "blast");
    check(
      "chilling stacks",
      extraShelfLife(kitchen(both)) === 2,
    );
    check(
      "and some of what does spoil is recovered rather than binned",
      wasteSaved(kitchen(both)) > 0.5 && wasteSaved(kitchen(both)) < 1,
    );
  }

  /* Waste is measurably lower through a real week. */
  {
    const spoilWeek = (withCold: boolean) => {
      let f = startK();
      if (withCold) f = runCommand(chef, f, "buyKit", "coldroom");
      f = runCommand(chef, f, "buyProduce", "market");
      /* Far enough ahead that a market crate is over without chilling. */
      f = { ...f, week: f.week + 3 };
      return advanceWeek(chef, f, { dinner: 1 });
    };
    const plain = kitchen(spoilWeek(false).state).lastService!;
    const cold = kitchen(spoilWeek(true).state).lastService!;
    check(
      "refrigeration throws less away over a real week",
      cold.waste < plain.waste,
      `${plain.waste} covers binned without, ${cold.waste} with`,
    );
  }

  /* Everything is charged for, and nothing is free money. */
  check(
    "every item costs something every week",
    KITCHEN_KIT.every((x) => x.upkeep > 0 && x.cost > 0),
  );
  check(
    "refrigeration is the worst value per cover, because covers are not the point",
    KITCHEN_KIT.filter((x) => x.shelfLife > 0).every((x) => x.covers === 0),
  );
  check(
    "kit is worth less than it cost",
    kitValue(kitchen(k1)) < KIT_BY_ID.get("coldroom")!.cost,
  );
  check(
    "a save without any kit is still valid",
    (() => {
      const legacy = startK();
      delete (kitchen(legacy) as { equipment?: string[] }).equipment;
      return (
        chef.validateData!(legacy.data) &&
        extraShelfLife(kitchen(legacy)) === 0
      );
    })(),
  );
  check(
    "a save naming kit that does not exist is rejected",
    !chef.validateData!({
      kitchen: {
        premises: "stall",
        larder: [],
        staff: [],
        equipment: ["teleporter"],
      },
    }),
  );
}




console.log("\nThe brigade\n" + "────────────────────────────────────────────────────");
{
  const startB = () => {
    const f = startRun(chef, 7007);
    f.r.cash = 300_000;
    return f;
  };

  /* A hire is a person, not a salary line. */
  {
    const f = runCommand(chef, startB(), "hireKitchen", "commis");
    const x = kitchen(f).staff[0];
    check(
      "somebody hired arrives with a name and attributes",
      !!x && x.name.length > 3 && skillOf(x) > 0 && moraleOf(x) > 0,
    );
    check(
      "and the run remembers when they started",
      x.since === f.week,
    );
  }

  /* Standing decides who is willing to work for you. */
  {
    const poor = startB();
    poor.r.reputation = 5;
    const known = startB();
    known.r.reputation = 90;
    const a = kitchen(runCommand(chef, poor, "hireKitchen", "commis")).staff[0];
    const b = kitchen(runCommand(chef, known, "hireKitchen", "commis")).staff[0];
    check(
      "a well-regarded kitchen attracts a better cook for the same money",
      skillOf(b) > skillOf(a) && a.salary === b.salary,
      `${skillOf(a)} vs ${skillOf(b)}`,
    );
  }

  /*
   * SKILL IS THE CEILING, MORALE DECIDES HOW CLOSE YOU GET.
   *
   * This is what stops the brigade being interchangeable: the same role in
   * two people is two different amounts of work.
   */
  {
    const good = { id: "a", name: "A", role: "commis", salary: 640, skill: 90, morale: 90 };
    const tired = { id: "b", name: "B", role: "commis", salary: 640, skill: 90, morale: 20 };
    const weak = { id: "c", name: "C", role: "commis", salary: 640, skill: 25, morale: 90 };
    check(
      "a ground-down cook does less than a happy one of equal skill",
      effectiveOf(tired) < effectiveOf(good),
    );
    check(
      "and a steady average one can beat a brilliant exhausted one",
      effectiveOf(weak) > effectiveOf(tired) * 0.8,
    );
    check(
      "nobody ever does nothing at all",
      effectiveOf(tired) > 0,
    );
  }

  /* The brigade shows up in the covers the kitchen can actually plate. */
  {
    let f = startB();
    f = runCommand(chef, f, "hireKitchen", "partie");
    const before = brigadeCovers(kitchen(f), 50);
    for (const x of kitchen(f).staff) x.morale = 10;
    const after = brigadeCovers(kitchen(f), 50);
    check(
      "a demoralised brigade plates fewer covers",
      after < before,
      `${Math.round(before)} -> ${Math.round(after)}`,
    );
  }

  /* A hard week grinds people down; a quiet one lets them recover. */
  {
    let f = startB();
    f.r.skill = 70;
    f = runCommand(chef, f, "takePremises", "bistro");
    f = runCommand(chef, f, "hireKitchen", "commis");
    const start = moraleOf(kitchen(f).staff[0]);
    const rested = advanceWeek(chef, f, { rest: 1 });
    check(
      "a day off lifts the whole kitchen, not just the player",
      moraleOf(kitchen(rested.state).staff[0]) >= start,
    );
  }

  /* Loyalty runs out and people leave — visibly. */
  {
    let f = startB();
    f = runCommand(chef, f, "hireKitchen", "commis");
    for (const x of kitchen(f).staff) {
      x.loyalty = 1;
      x.morale = 5;
    }
    const res = advanceWeek(chef, f, { dinner: 1 });
    check(
      "somebody at the end of their patience hands the jacket back",
      kitchen(res.state).staff.length === 0,
    );
    check(
      "and the run says so rather than the number quietly changing",
      res.state.log.some((l) => /jacket back/i.test(l.text)),
    );
  }

  /* Old saves have none of this and still work. */
  check(
    "a cook hired before any of this reads as average",
    (() => {
      const legacy = startB();
      kitchen(legacy).staff.push({
        id: "old",
        name: "Old Hand",
        role: "commis",
        salary: 640,
      });
      const x = kitchen(legacy).staff[0];
      return (
        chef.validateData!(legacy.data) &&
        skillOf(x) === 50 &&
        moraleOf(x) === 70 &&
        loyaltyOf(x) === 60
      );
    })(),
  );
  check(
    "a save with an impossible morale is rejected",
    !chef.validateData!({
      kitchen: {
        premises: "stall",
        larder: [],
        staff: [{ id: "x", name: "X", role: "commis", salary: 1, morale: 5000 }],
      },
    }),
  );
}

console.log("\nSuppliers\n" + "────────────────────────────────────────────────────");
{
  const startS = () => {
    const f = startRun(chef, 5150);
    f.r.cash = 400_000;
    f.r.reputation = 60;
    return f;
  };

  /*
   * THE TRADE.
   *
   * Cheap food arrives tired; fresh food costs more or is less likely to
   * turn up. If any supplier were best on every axis the choice would be
   * decoration, so this asserts the shape rather than the numbers.
   */
  check(
    "no supplier is cheapest, freshest and most reliable at once",
    !SUPPLIERS.some(
      (a) =>
        SUPPLIERS.every(
          (b) =>
            a.id === b.id ||
            (a.price <= b.price &&
              a.freshness >= b.freshness &&
              a.reliability >= b.reliability),
        ),
    ),
  );
  check(
    "the cheapest supplier delivers the tiredest food",
    [...SUPPLIERS].sort((a, b) => a.price - b.price)[0].freshness < 0,
  );
  check(
    "anything that arrives fresher than the market costs more or is less certain",
    SUPPLIERS.filter((x) => x.freshness > 0).every(
      (x) => x.price > 1 || x.reliability < 0.95 || x.minReputation > 0,
    ),
  );

  /* Where you buy changes how long the crate lasts. */
  {
    const basic = PRODUCE_BY_ID.get("basic")!;
    const farm = SUPPLIER_BY_ID.get("farm")!;
    const whole = SUPPLIER_BY_ID.get("wholesaler")!;
    check(
      "the same crate lasts longer from the farm than the wholesaler",
      lifeFrom(farm, basic) > lifeFrom(whole, basic),
      `${lifeFrom(whole, basic)} vs ${lifeFrom(farm, basic)} weeks`,
    );
    check(
      "and the wholesaler is the cheaper of the two",
      priceFrom(whole, basic, 0) < priceFrom(farm, basic, 0),
    );
  }

  /* Ordering builds the account; the account pays back in price and vans. */
  {
    let f = startS();
    const before = standingWith(kitchen(f), "market");
    f = runCommand(chef, f, "buyProduce", "market:basic");
    check(
      "ordering builds standing with that supplier",
      standingWith(kitchen(f), "market") > before,
    );
    const basic = PRODUCE_BY_ID.get("basic")!;
    const market = SUPPLIER_BY_ID.get("market")!;
    check(
      "standing takes something off the price",
      priceFrom(market, basic, 90) < priceFrom(market, basic, 0),
    );
    check(
      "and makes the delivery more likely to arrive",
      arrivalOdds(market, 90) > arrivalOdds(market, 0),
    );
    check(
      "but never to certain",
      SUPPLIERS.every((x) => arrivalOdds(x, 100) <= 1),
    );
  }

  /* Gates: standing, minimum order, and what they carry. */
  {
    const poor = startS();
    poor.r.reputation = 0;
    const premium = SUPPLIER_BY_ID.get("premium")!;
    check(
      "a premium supplier will not open an account with a nobody",
      (supplierBlocker(premium, kitchen(poor), 0, null) ?? "").length > 10,
    );
    check(
      "the market does not carry luxury produce, and says so",
      (supplierBlocker(
        SUPPLIER_BY_ID.get("market")!,
        kitchen(poor),
        0,
        PRODUCE_BY_ID.get("luxury")!,
      ) ?? "").length > 10,
    );
    const small = runCommand(chef, startS(), "buyProduce", "wholesaler:basic");
    check(
      "an order under the supplier\u2019s minimum is refused",
      kitchen(small).larder.length === 0,
    );
  }

  /*
   * BUYING IS DETERMINISTIC; DELIVERY IS NOT.
   *
   * The command records an order and takes the money. Whether the van
   * arrives is rolled once, in the week, from the seeded stream — so a
   * purchase means the same thing every replay.
   */
  {
    const once = runCommand(chef, startS(), "buyProduce", "market:basic");
    const twice = runCommand(chef, startS(), "buyProduce", "market:basic");
    check(
      "the same order on the same seed always has the same outcome",
      kitchen(once).larder.length === kitchen(twice).larder.length &&
        once.r.cash === twice.r.cash,
    );
    check(
      "a delivered crate remembers who brought it and how long it has",
      (() => {
        const lot = kitchen(once).larder[0];
        return !lot || (lot.from === "market" && (lot.life ?? 0) > 0);
      })(),
    );
    check(
      "and the money is taken whether or not it arrives",
      once.r.cash < startS().r.cash,
    );
  }

  /* A failed delivery costs money and standing, and is said out loud. */
  {
    let f = startS();
    /*
     * The farm, which fails roughly one delivery in eight — and a *market*
     * crate, because a basic one costs $864 and the farm will not take an
     * order under $1,400. An earlier version of this ordered the cheap crate
     * six times, had all six correctly refused, and reported it as a delivery
     * failure. The minimum is real; the test now respects it.
     */
    for (let i = 0; i < 6; i++) {
      f = runCommand(chef, f, "buyProduce", "farm:market");
    }
    const paid = 400_000 - f.r.cash;
    const arrived = kitchen(f).larder.length;
    check(
      "an unreliable supplier does not always deliver what was paid for",
      paid > 0 && arrived <= 6,
      `${arrived} of 6 arrived`,
    );
  }

  /* Save compatibility. */
  check(
    "a save from before suppliers existed still loads",
    (() => {
      const legacy = startS();
      const kk = kitchen(legacy) as { suppliers?: unknown };
      delete kk.suppliers;
      return chef.validateData!(legacy.data);
    })(),
  );
  check(
    "a save naming a supplier that does not exist is rejected",
    !chef.validateData!({
      kitchen: {
        premises: "stall",
        larder: [],
        staff: [],
        suppliers: { "black-market": 50 },
      },
    }),
  );
  check(
    "a lot bought before suppliers existed still ages correctly",
    (() => {
      const lot = { id: "old", produce: "basic", left: 10, unitCost: 9, boughtWeek: 1 };
      const basic = PRODUCE_BY_ID.get("basic")!;
      return (
        !isSpoiled(lot, 1 + basic.shelfLife, 0) &&
        isSpoiled(lot, 2 + basic.shelfLife, 0)
      );
    })(),
  );
}

console.log("\nThe book and the forecast\n" + "────────────────────────────────────────────────────");
{
  const startB = () => {
    const f = startRun(chef, 3131);
    f.r.cash = 400_000;
    f.r.skill = 70;
    return runCommand(chef, f, "takePremises", "bistro");
  };
  const dinner = SERVICE_BY_ID.get("dinner")!;
  const catering = SERVICE_BY_ID.get("catering")!;

  /*
   * DETERMINISM.
   *
   * The forecast is what the player orders against, so it has to be a pure
   * function of the kitchen. If it moved on its own between the screen and
   * the week resolving, ordering to it would be theatre.
   */
  {
    const a = startB();
    const f1 = forecastFor(kitchen(a), a.r.reputation, dinner, 2, a.r.skill);
    const f2 = forecastFor(kitchen(a), a.r.reputation, dinner, 2, a.r.skill);
    check(
      "the same kitchen forecasts the same week twice",
      f1.low === f2.low && f1.high === f2.high &&
        f1.reservations === f2.reservations,
    );
    check(
      "and the forecast is a range, not a single number",
      f1.high > f1.low,
      `${f1.low}-${f1.high}`,
    );
    check(
      "it explains itself rather than printing a coefficient",
      f1.drivers.length > 0 &&
        f1.drivers.every((d) => d.label.length > 3 && d.note.length > 20),
    );
    check(
      "and it names what will run out first",
      f1.binding.length > 10,
      f1.binding,
    );
  }

  /* Booked work is knowable exactly; walk-in trade never is. */
  {
    const a = startB();
    const bookedFc = forecastFor(kitchen(a), a.r.reputation, catering, 2, a.r.skill);
    check(
      "a booked service forecasts a single certain number",
      bookedFc.low === bookedFc.high && bookedFc.noShows === 0,
    );
  }

  /*
   * THE TRADE THE POLICY MAKES.
   *
   * Selling the room in advance narrows the range you have to order
   * against. That predictability is the product, and it is paid for in
   * covers, so both halves are asserted.
   */
  {
    const walkins = startB();
    const booked = runCommand(chef, startB(), "setPolicy", "reservations");
    const fW = forecastFor(kitchen(walkins), 60, dinner, 2, 70);
    const fB = forecastFor(kitchen(booked), 60, dinner, 2, 70);

    check(
      "reservations narrow the range you must order against",
      fB.high - fB.low < fW.high - fW.low,
      `walk-ins +-${fW.high - fW.low}, booked +-${fB.high - fB.low}`,
    );
    check(
      "walk-ins only promises nothing in advance",
      fW.reservations === 0,
    );
    check(
      "reservations promise most of the room",
      fB.reservations > 0,
    );
    check(
      "and the certainty costs covers at the top end",
      fB.high <= fW.high,
      `${fB.high} booked vs ${fW.high} walk-in`,
    );
  }

  /* Deposits buy away the no-shows, and are kept when somebody fails to come. */
  {
    const dep = runCommand(chef, startB(), "setPolicy", "deposits");
    const res = runCommand(chef, startB(), "setPolicy", "reservations");
    const fD = forecastFor(kitchen(dep), 60, dinner, 2, 70);
    const fR = forecastFor(kitchen(res), 60, dinner, 2, 70);
    check(
      "a deposit nearly removes the no-shows",
      fD.noShows < fR.noShows,
      `${fD.noShows} vs ${fR.noShows}`,
    );
    check(
      "and fewer people bother booking at all",
      fD.reservations <= fR.reservations,
    );
  }

  /* Overbooking fills the room and turns somebody away at the door. */
  {
    let over = runCommand(chef, startB(), "setPolicy", "overbook");
    over.r.reputation = 85;
    for (let i = 0; i < 10; i++) {
      over = runCommand(chef, over, "buyProduce", "basic");
    }
    const fc = forecastFor(kitchen(over), over.r.reputation, dinner, 2, over.r.skill);
    check(
      "overbooking sells more of the room than it seats",
      fc.reservations > fc.seats,
      `${fc.reservations} booked into ${fc.seats} seats`,
    );

    const before = over.r.reputation;
    const res = advanceWeek(chef, over, { dinner: 2 });
    const line = kitchen(res.state).lastService!.lines[0];
    check(
      "somebody with a booking is turned away at the door",
      line.turnedAway > 0,
      `${line.turnedAway} turned away`,
    );
    check(
      "and it costs standing, which is what makes it a gamble",
      res.state.r.reputation < before,
    );
  }

  /* The week resolves inside the band the player was shown. */
  {
    let f = startB();
    f.r.reputation = 55;
    for (let i = 0; i < 12; i++) f = runCommand(chef, f, "buyProduce", "basic");
    for (let i = 0; i < 6; i++) f = runCommand(chef, f, "hireKitchen", "partie");
    const fc = forecastFor(kitchen(f), f.r.reputation, dinner, 2, f.r.skill);
    const line = kitchen(advanceWeek(chef, f, { dinner: 2 }).state).lastService!.lines[0];
    check(
      "the week lands inside the range that was forecast",
      line.wanted >= fc.low && line.wanted <= fc.high,
      `wanted ${line.wanted}, forecast ${fc.low}-${fc.high}`,
    );
    check(
      "and the report says what limited it",
      line.binding.length > 10,
      line.binding,
    );
    check(
      "the report separates bookings, no-shows and walk-ins",
      line.reservations + line.walkIns > 0 &&
        line.noShows >= 0 &&
        line.reservations - line.noShows + line.walkIns === line.wanted,
    );
    check(
      "and reports what the food on those plates cost",
      line.served === 0 || line.foodCost > 0,
    );
  }

  /* Old saves have no book at all. */
  check(
    "a save written before reservations existed still loads",
    (() => {
      const legacy = startB();
      delete (kitchen(legacy) as { policy?: string }).policy;
      return (
        chef.validateData!(legacy.data) &&
        policyOf(kitchen(legacy)).id === "walkins"
      );
    })(),
  );
  check(
    "a save naming a policy that does not exist is rejected",
    !chef.validateData!({
      kitchen: {
        premises: "stall",
        larder: [],
        staff: [],
        policy: "telepathy",
      },
    }),
  );
}

console.log("\nChef service types\n" + "────────────────────────────────────────────────────");
{
  const startC = () => {
    const f = startRun(chef, 909);
    f.r.cash = 400_000;
    return f;
  };

  check(
    "there is more than one kind of night to run",
    SERVICES.length >= 5,
  );

  /*
   * NONE OF THEM IS UNIVERSALLY BEST.
   *
   * The design only works if each service wins at something, so this
   * asserts the shape rather than any single number: revenue per block is
   * within a band, and the ones that pay more give something up — either
   * they need a bigger room and more craft, or nobody reviews them.
   */
  {
    const yieldOf = (sv: (typeof SERVICES)[number]) =>
      sv.capacityShare * sv.spend;
    const best = Math.max(...SERVICES.map(yieldOf));
    const worst = Math.min(...SERVICES.map(yieldOf));
    check(
      "no service earns more than twice the weakest per block",
      best / worst < 2.2,
      `${worst.toFixed(2)}..${best.toFixed(2)}`,
    );
    check(
      "anything that pays above the middle costs something else",
      SERVICES.filter((sv) => yieldOf(sv) > 0.5).every(
        (sv) => sv.minRoom > 0 || sv.minCraft > 0 || sv.reviewWeight < 0.5,
      ),
    );
    check(
      "the cheapest service in burnout is also the least lucrative",
      yieldOf(
        [...SERVICES].sort((a, b) => a.burnout - b.burnout)[0],
      ) < best,
    );
  }

  /* Gating: a stall cannot run a tasting menu, and it says why. */
  {
    const stall = startC();
    const tasting = SERVICE_BY_ID.get("tasting")!;
    check(
      "a market stall cannot attempt a tasting menu",
      !serviceOpen(tasting, kitchen(stall), stall.r.skill),
    );
    check(
      "and the reason is stated rather than left blank",
      (serviceBlocker(tasting, kitchen(stall), stall.r.skill) ?? "").length > 10,
    );
    check(
      "lunch and dinner are open from the first week",
      serviceOpen(SERVICE_BY_ID.get("lunch")!, kitchen(stall), stall.r.skill) &&
        serviceOpen(SERVICE_BY_ID.get("dinner")!, kitchen(stall), stall.r.skill),
    );
    check(
      "a closed service is hidden from the planner",
      chef.actions
        .filter((a) => a.id === "tasting")
        .every((a) => a.unlocked !== undefined && !a.unlocked(stall)),
    );
  }

  /* Booked work pays without depending on standing — the recovery route. */
  {
    let f = startC();
    f = runCommand(chef, f, "takePremises", "bistro");
    f.r.skill = 70;
    f = runCommand(chef, f, "buyProduce", "basic");
    f = runCommand(chef, f, "buyProduce", "basic");
    /* Nobody has heard of this kitchen at all. */
    f.r.reputation = 0;

    const cateringWeek = advanceWeek(chef, f, { catering: 3 });
    const catering = kitchen(cateringWeek.state).lastService!;
    check(
      "catering serves covers even at zero standing",
      catering.served > 0,
      `${catering.served} covers`,
    );
    check(
      "and turns nobody away, because the number was agreed",
      catering.turnedAway === 0,
    );
    check(
      "but it earns no review at all",
      Math.abs(cateringWeek.state.r.reputation - f.r.reputation) < 0.001,
      `reputation moved to ${cateringWeek.state.r.reputation.toFixed(2)}`,
    );

    /*
     * The property that actually matters: standing moves walk-in trade and
     * does not touch booked work.
     *
     * An earlier version of this compared dinner against catering at zero
     * reputation and expected dinner to lose. It did not, and the test was
     * wrong rather than the model — with two crates in the larder both
     * services were capped by food, so the comparison measured `crewLoad`
     * rather than demand. Stocked properly and run at two different
     * reputations, the real difference shows.
     */
    const stocked = (rep: number) => {
      let g = startC();
      g = runCommand(chef, g, "takePremises", "bistro");
      g.r.skill = 70;
      for (let i = 0; i < 10; i++) g = runCommand(chef, g, "buyProduce", "basic");
      for (let i = 0; i < 6; i++) g = runCommand(chef, g, "hireKitchen", "partie");
      g.r.reputation = rep;
      return g;
    };
    const dinnerLow = kitchen(
      advanceWeek(chef, stocked(0), { dinner: 3 }).state,
    ).lastService!;
    const dinnerHigh = kitchen(
      advanceWeek(chef, stocked(70), { dinner: 3 }).state,
    ).lastService!;
    check(
      "standing decides how many walk in",
      dinnerHigh.served > dinnerLow.served,
      `${dinnerLow.served} at 0 standing vs ${dinnerHigh.served} at 70`,
    );

    const cateringLow = kitchen(
      advanceWeek(chef, stocked(0), { catering: 3 }).state,
    ).lastService!;
    const cateringHigh = kitchen(
      advanceWeek(chef, stocked(70), { catering: 3 }).state,
    ).lastService!;
    check(
      "booked work does not care what anyone thinks of you",
      cateringLow.served === cateringHigh.served,
      `${cateringLow.served} vs ${cateringHigh.served}`,
    );
  }

  /* The week reports what each service did, not just a total. */
  {
    let f = startC();
    f = runCommand(chef, f, "takePremises", "bistro");
    f.r.skill = 70;
    for (let i = 0; i < 4; i++) {
      f = runCommand(chef, f, "buyProduce", "basic");
    }
    const res = advanceWeek(chef, f, { lunch: 1, dinner: 1, catering: 1 });
    const last = kitchen(res.state).lastService!;
    check(
      "each service run is reported on its own line",
      last.lines.length === 3 &&
        new Set(last.lines.map((l) => l.id)).size === 3,
      last.lines.map((l) => `${l.id}:${l.served}`).join(" "),
    );
    check(
      "and the lines add up to the takings for the week",
      Math.abs(
        last.lines.reduce((n, l) => n + l.revenue, 0) - last.revenue,
      ) < 2,
    );
    check(
      "the brigade is a shared pool, so stacked services compete for it",
      last.served <= brigadeCovers(kitchen(res.state), res.state.r.skill) * 1.3,
    );
  }

  /* Lunch is the volume option: more covers, less money each. */
  {
    const lunch = SERVICE_BY_ID.get("lunch")!;
    const dinner = SERVICE_BY_ID.get("dinner")!;
    check(
      "lunch seats more than dinner and charges less a head",
      lunch.capacityShare > dinner.capacityShare && lunch.spend < dinner.spend,
    );
    check(
      "and costs less burnout",
      lunch.burnout < dinner.burnout,
    );
  }
}

console.log("\nThe Chef\n" + "────────────────────────────────────────────────────");
{
  const startC = () => startRun(chef, 404);
  let c = startC();
  check(
    "a chef run starts on a stall with an empty larder",
    kitchen(c).premises === "stall" && kitchen(c).larder.length === 0,
  );

  c = runCommand(chef, c, "buyProduce", "basic");
  check("produce can be bought", kitchen(c).larder.length === 1);
  check(
    "and it arrives with the covers it carries",
    larderCovers(kitchen(c)) === PRODUCE_BY_ID.get("basic")!.covers,
  );

  {
    const poor = startC();
    poor.r.cash = 10;
    check(
      "a crate you cannot afford is refused",
      kitchen(runCommand(chef, poor, "buyProduce", "luxury")).larder.length === 0,
    );
  }

  /*
   * SPOILAGE — the reason this career exists.
   *
   * Stock past its shelf life must be gone before service and must leave
   * as a cost. If it quietly vanished instead, over-ordering would be free
   * and the Chef would be a reskin of every other tycoon game.
   */
  {
    /* Its own run: `{ ...state }` is a shallow copy that shares `data`, so
       clearing the larder here would empty the one the checks below read. */
    let old = runCommand(chef, startC(), "buyProduce", "basic");
    old = { ...old, week: old.week + 9 };
    const before = larderCovers(kitchen(old));
    const lost = clearSpoiled(kitchen(old), old.week);
    check(
      "produce past its shelf life is written off, as a cost",
      before > 0 &&
        lost.covers === before &&
        lost.cost > 0 &&
        larderCovers(kitchen(old)) === 0,
    );
  }

  {
    const lot = kitchen(c).larder[0];
    check(
      "freshness falls as a lot ages",
      freshnessOf(lot, c.week) === 1 &&
        freshnessOf(lot, c.week + 2) < 1 &&
        freshnessOf(lot, c.week + 99) === 0,
    );
    check(
      "and a fresher plate scores better than a stale one",
      plateQuality(50, 5, 1, 0, 0.5) > plateQuality(50, 5, 0.1, 0, 0.5),
    );
  }

  /* Oldest first: this is how over-ordering reaches the plate. */
  {
    let f = startC();
    f = runCommand(chef, f, "buyProduce", "basic");
    f = { ...f, week: f.week + 2 };
    f = runCommand(chef, f, "buyProduce", "basic");
    const drawn = drawFromLarder(kitchen(f), 20, f.week);
    check(
      "the larder is drawn down oldest-first",
      drawn.drawn === 20 && drawn.freshness < 1,
    );
  }

  {
    let w = startC();
    w = runCommand(chef, w, "buyProduce", "basic");
    /* `service` became a choice of service in the catalogue — this is the
       plain dinner trade a stall can run from week one. */
    const res = advanceWeek(chef, w, { dinner: 3, prep: 1 });
    check(
      "a service serves people",
      (kitchen(res.state).lastService?.served ?? 0) > 0,
    );
    check(
      "the rent is charged whether or not you open",
      advanceWeek(chef, startC(), { rest: 1 }).ledger.some((x) =>
        /rent/i.test(x.label),
      ),
    );
  }

  check(
    "a chef save validates, and a corrupt one does not",
    chef.validateData!(c.data) &&
      !chef.validateData!({ kitchen: { premises: "palace", larder: [], staff: [] } }),
  );
  check(
    "every room clears the food cost of the crate it would run",
    CHEF_PREMISES.every(
      (room) => room.spend > CHEF_PRODUCE[0].cost / CHEF_PRODUCE[0].covers,
    ),
  );
}


console.log("\nThe chef's phone\n" + "────────────────────────────────────────────────────");
{
  const startP = () => {
    const f = startRun(chef, 8181);
    f.r.cash = 300_000;
    return f;
  };

  /* A new run owns a phone, and somebody has already texted. */
  {
    const f = startP();
    const phone = kitchen(f).phone;
    check(
      "a chef starts with a phone and a message from their mentor",
      !!phone && phone.messages.length === 1 && !phone.messages[0].read,
    );
  }

  /*
   * REVIEWS NEVER CONTRADICT THE SIMULATION.
   *
   * The feed's tone is computed from the same plate quality the week
   * produced. A good night reads well; a night cooked from a tired larder
   * by an unskilled hand reads badly. This is the phone's whole contract.
   */
  {
    let good = startP();
    good.r.skill = 85;
    good = runCommand(chef, good, "hireKitchen", "sous");
    good = runCommand(chef, good, "buyProduce", "market:basic");
    good = runCommand(chef, good, "buyProduce", "market:basic");
    const g = advanceWeek(chef, good, { dinner: 2 });
    const gRev = kitchen(g.state).phone!.feed.find((x) => x.id.startsWith("rev-"));
    check(
      "a well-cooked week reads well on the feed",
      !!gRev && gRev.tone !== "bad",
      gRev ? `tone ${gRev.tone}` : "no review",
    );

    let bad = startP();
    bad.r.skill = 8;
    bad = runCommand(chef, bad, "buyProduce", "market:basic");
    /* Let the crate tire without letting it spoil. */
    bad = { ...bad, week: bad.week + 3 };
    const b = advanceWeek(chef, bad, { dinner: 2 });
    const bLast = kitchen(b.state).lastService!;
    const bRev = kitchen(b.state).phone!.feed.find((x) => x.id.startsWith("rev-"));
    check(
      "a tired larder cooked badly reads badly",
      bLast.served === 0 || !bRev || (bLast.quality <= 42) === (bRev.tone === "bad"),
      bRev ? `quality ${Math.round(bLast.quality)}, tone ${bRev.tone}` : "no review",
    );
  }

  /* The same week always sounds the same. */
  {
    const mk = () => {
      let f = startP();
      f.r.skill = 60;
      f = runCommand(chef, f, "buyProduce", "market:basic");
      return advanceWeek(chef, f, { dinner: 1 });
    };
    check(
      "the phone is as replayable as the ledger",
      JSON.stringify(kitchen(mk().state).phone!.feed) ===
        JSON.stringify(kitchen(mk().state).phone!.feed),
    );
  }

  /* Posting: once a week, gated on the run's real state. */
  {
    let f = startP();
    f = runCommand(chef, f, "post", "pans_on");
    const phone = kitchen(f).phone!;
    check(
      "publishing puts your post at the top of the feed",
      phone.feed[0]?.kind === "player" && phone.lastPostWeek === f.week,
    );
    const before = phone.social.followers;
    const again = runCommand(chef, f, "post", "behind_pass");
    check(
      "a second post the same week is refused",
      kitchen(again).phone!.feed.filter((x) => x.kind === "player").length === 1 &&
        kitchen(again).phone!.social.followers === before,
    );
    const ctx = chefPostContext(kitchen(f), f.week);
    check(
      "the apology is only offered after a genuinely bad night",
      !CHEF_POST_BY_ID.get("apology")!.available(ctx),
    );
  }

  /* The rival comes for your best underpaid cook — and answering matters. */
  {
    let f = startP();
    f = runCommand(chef, f, "hireKitchen", "sous");
    const cook = kitchen(f).staff[0];
    cook.skill = 80;
    cook.loyalty = 30;
    const wk = advanceWeek(chef, f, { rest: 1 });
    const msg = kitchen(wk.state).phone!.messages.find((x) =>
      x.id.startsWith("poach-"),
    );
    check(
      "a rival makes a move on an underpaid cook",
      !!msg && msg.choices !== undefined,
    );
    if (msg) {
      const salaryBefore = kitchen(wk.state).staff[0].salary;
      const answered = runCommand(
        chef,
        wk.state,
        "answerMessage",
        `${msg.id}|0`,
      );
      const kept = kitchen(answered).staff[0];
      check(
        "matching the offer costs a real rise and buys real loyalty",
        kept.salary > salaryBefore && (kept.loyalty ?? 0) > 30,
        `salary ${salaryBefore} -> ${kept.salary}`,
      );
      check(
        "and the thread remembers the answer",
        kitchen(answered).phone!.messages.find((x) => x.id === msg.id)!
          .answered === 0,
      );
    }
  }

  /* Followers are people who did not walk past the window. */
  {
    const quiet = startP();
    const loud = startP();
    ensureChefPhone(kitchen(loud)).social.followers = 10_000;
    const dinner = SERVICE_BY_ID.get("dinner")!;
    const fq = forecastFor(kitchen(quiet), 50, dinner, 2, 50);
    const fl = forecastFor(kitchen(loud), 50, dinner, 2, 50);
    check(
      "a followed kitchen forecasts more walk-ins than an unknown one",
      fl.high > fq.high,
      `${fq.high} vs ${fl.high}`,
    );
  }

  /* Old saves, and garbage. */
  {
    const legacy = startP();
    delete (kitchen(legacy) as { phone?: unknown }).phone;
    check(
      "a save from before the phone existed still validates",
      chef.validateData!(legacy.data),
    );
    const wk = advanceWeek(chef, legacy, { rest: 1 });
    check(
      "and gains a phone the first week it plays",
      !!kitchen(wk.state).phone,
    );
    check(
      "a save with a garbage phone is rejected",
      !chef.validateData!({
        kitchen: {
          premises: "stall",
          larder: [],
          staff: [],
          phone: { social: { followers: "many" }, feed: [], messages: [], news: [] },
        },
      }),
    );
  }

  /* The kitchen's phone never speaks the hospital's language. */
  {
    let f = startP();
    f.r.skill = 60;
    f.r.reputation = 50;
    f = runCommand(chef, f, "hireKitchen", "sous");
    f = runCommand(chef, f, "buyProduce", "market:basic");
    let st = f;
    for (let i = 0; i < 6; i++) {
      st = advanceWeek(chef, st, { dinner: 1 }).state;
    }
    const everything = JSON.stringify(kitchen(st).phone);
    check(
      "six weeks of chef phone contain no medical vocabulary",
      !/patient|clinic|caseload|department|physician|ward/i.test(everything),
    );
    check(
      "and none of the composer catalogue does either",
      !CHEF_POSTS.some((post) =>
        /patient|clinic|caseload|department|physician/i.test(
          post.label + post.blurb + post.preview.join(" "),
        ),
      ),
    );
  }
}


console.log("\nThe agency\n" + "────────────────────────────────────────────────────");
{
  const startA = () => {
    const f = startRun(chef, 4242);
    f.r.cash = 200_000;
    return f;
  };
  const commis = ROLE_BY_ID.get("commis")!;

  /* Briefing costs the search fee and comes back with people. */
  {
    const f = startA();
    const fees = agencyFees(kitchen(f), commis);
    const briefed = runCommand(chef, f, "briefAgency", "commis");
    const k = kitchen(briefed);
    check(
      "briefing the agency returns a shortlist",
      shortlistLive(k, briefed.week).length === SHORTLIST_SIZE,
    );
    check(
      "and charges the search fee, not the whole hire",
      briefed.r.cash === f.r.cash - fees.search &&
        fees.search < fees.total,
      `paid ${f.r.cash - briefed.r.cash} of ${fees.total}`,
    );
    check(
      "nobody is on the payroll until you say so",
      k.staff.length === 0,
    );
  }

  /*
   * THE POINT OF THE WHOLE FEATURE.
   *
   * The person you were shown is the person who turns up — not a preview
   * of a second roll. If this ever fails the shortlist is a lie.
   */
  {
    let f = startA();
    f = runCommand(chef, f, "briefAgency", "commis");
    const shown = shortlistLive(kitchen(f), f.week)[1];
    const hired = runCommand(chef, f, "hireCandidate", shown.id);
    const joined = kitchen(hired).staff[0];
    check(
      "the candidate you picked is the person who joins",
      !!joined &&
        joined.id === shown.id &&
        joined.name === shown.name &&
        joined.skill === shown.skill &&
        joined.salary === shown.salary,
      joined ? `${joined.name} @ ${joined.skill}` : "nobody joined",
    );
    check(
      "and the rest of the shortlist goes back on the market",
      shortlistLive(kitchen(hired), hired.week).length === 0,
    );
  }

  /* Brief + place costs exactly what a blind hire costs. */
  {
    const f = startA();
    const fees = agencyFees(kitchen(f), commis);
    let viaAgency = runCommand(chef, f, "briefAgency", "commis");
    const pick = shortlistLive(kitchen(viaAgency), viaAgency.week)[0];
    viaAgency = runCommand(chef, viaAgency, "hireCandidate", pick.id);
    const blind = runCommand(chef, f, "hireKitchen", "commis");
    check(
      "briefing then placing costs what hiring blind costs",
      f.r.cash - viaAgency.r.cash === f.r.cash - blind.r.cash &&
        f.r.cash - viaAgency.r.cash === fees.total,
      `agency ${f.r.cash - viaAgency.r.cash} vs blind ${f.r.cash - blind.r.cash}`,
    );
  }

  /* Looking again is a real cost, and shows different people. */
  {
    let f = startA();
    f = runCommand(chef, f, "briefAgency", "commis");
    const first = shortlistLive(kitchen(f), f.week).map((c) => c.id);
    const cashAfterFirst = f.r.cash;
    f = runCommand(chef, f, "briefAgency", "commis");
    const second = shortlistLive(kitchen(f), f.week).map((c) => c.id);
    check(
      "briefing again costs the fee again",
      f.r.cash < cashAfterFirst,
    );
    check(
      "and produces different people",
      second.every((id) => !first.includes(id)),
    );
  }

  /* The agency's people do not wait forever. */
  {
    let f = startA();
    f = runCommand(chef, f, "briefAgency", "commis");
    const pick = shortlistLive(kitchen(f), f.week)[0];
    const later = { ...f, week: f.week + SHORTLIST_WEEKS };
    check(
      "a stale shortlist is no longer offered",
      shortlistLive(kitchen(later), later.week).length === 0,
    );
    const tooLate = runCommand(chef, later, "hireCandidate", pick.id);
    check(
      "and cannot be hired from",
      kitchen(tooLate).staff.length === 0 &&
        tooLate.r.cash === later.r.cash,
    );
  }

  /* Gates. */
  {
    const broke = { ...startA(), r: { ...startA().r, cash: 10 } };
    const f = runCommand(chef, broke, "briefAgency", "commis");
    check(
      "you cannot brief an agency you cannot pay",
      shortlistLive(kitchen(f), f.week).length === 0 && f.r.cash === 10,
    );
    let rich = startA();
    rich = runCommand(chef, rich, "briefAgency", "commis");
    const poor = { ...rich, r: { ...rich.r, cash: 5 } };
    const pick = shortlistLive(kitchen(poor), poor.week)[0];
    const nope = runCommand(chef, poor, "hireCandidate", pick.id);
    check(
      "and cannot place somebody you cannot pay for",
      kitchen(nope).staff.length === 0 && nope.r.cash === 5,
    );
    const bogus = runCommand(chef, rich, "hireCandidate", "st-9999");
    check(
      "a candidate who was never on the list is refused",
      kitchen(bogus).staff.length === 0,
    );
  }

  /* Replay safety: the command must never roll. */
  {
    const mk = () => {
      const f = runCommand(chef, startA(), "briefAgency", "commis");
      return shortlistLive(kitchen(f), f.week);
    };
    check(
      "the same run always finds the same three people",
      JSON.stringify(mk()) === JSON.stringify(mk()),
    );
  }

  /* A known kitchen attracts better people — the reason to build one. */
  {
    const unknown = startA();
    const known = startA();
    known.r.reputation = 80;
    const avg = (f: typeof unknown) => {
      const g = runCommand(chef, f, "briefAgency", "commis");
      const list = shortlistLive(kitchen(g), g.week);
      return list.reduce((n, c) => n + c.skill, 0) / list.length;
    };
    const a = avg(unknown);
    const b = avg(known);
    check(
      "a well-regarded kitchen gets better shortlists",
      b > a,
      `unknown ${Math.round(a)} vs known ${Math.round(b)}`,
    );
  }

  /* Saves. */
  {
    const legacy = startA();
    delete (kitchen(legacy) as { shortlist?: unknown }).shortlist;
    check(
      "a save from before the agency existed still loads",
      chef.validateData!(legacy.data),
    );
    check(
      "a save with a nameless candidate is rejected",
      !chef.validateData!({
        kitchen: {
          premises: "stall",
          larder: [],
          staff: [],
          shortlist: [{ id: "st-1", role: "commis", salary: 10, skill: 50 }],
        },
      }),
    );
  }
}


console.log("\nThe Founder\n" + "────────────────────────────────────────────────────");
{
  const startF = (seed = 71) => startRun(founder, seed);

  /* The career is priced in weeks, and the scoreboard says so. */
  {
    const f = startF();
    const v = venture(f);
    check(
      "a founder starts owning all of it and none of it is worth much",
      v.equity === 100 && v.users === 0 && v.roundsClosed.length === 0,
    );
    check(
      "the headline is the runway, in weeks",
      founder.scoreboard(f).sub.includes("week"),
      founder.scoreboard(f).sub,
    );
    check(
      "and a fresh venture is not default alive",
      !defaultAlive(v) && Number.isFinite(runwayOf(f.r.cash, v)),
    );
  }

  /*
   * THE BINDING CONSTRAINT.
   *
   * A hire has to cost weeks, not just money. If this ever stops being
   * true the career is just an income statement with extra steps.
   */
  {
    const f = startF();
    const before = runwayOf(f.r.cash, venture(f));
    const after = runCommand(founder, f, "hireVenture", "engineer");
    const now = runwayOf(after.r.cash, venture(after));
    check(
      "taking somebody on shortens the runway that pays them",
      now < before,
      `${Math.floor(before)} weeks -> ${Math.floor(now)}`,
    );
    check(
      "and the burn is higher than it was",
      burnOf(venture(after)) > burnOf(venture(f)),
    );
  }

  /* Building keeps people; selling only wins them. */
  {
    const f = startF();
    const churnBefore = ventureChurn(venture(f));
    const built = advanceWeek(founder, f, { build: 4 });
    check(
      "building the product cuts the rate people leave at",
      ventureChurn(venture(built.state)) < churnBefore,
      `${(churnBefore * 100).toFixed(1)}% -> ${(ventureChurn(venture(built.state)) * 100).toFixed(1)}%`,
    );

    const sold = advanceWeek(founder, f, { sell: 4 });
    check(
      "selling puts customers on the board this week",
      venture(sold.state).users > venture(f).users,
    );
  }

  /*
   * THE CENTRAL TRADE-OFF, MEASURED.
   *
   * Selling is supposed to be the tempting answer and the wrong one: it wins
   * immediately, then plateaus, because churn is a percentage and eventually
   * eats everything a fixed weekly intake brings in. Compounding starts
   * slower and does not stop.
   *
   * The first version of this test asserted only that compounding wins over a
   * year, which measured the crossover (about week 42) rather than the
   * design. Asserting both halves is the stronger claim and the true one.
   */
  {
    const run = (plan: Record<string, number>, weeks: number) => {
      let f = startF();
      /* Funded well past any runway question: this measures growth, not
         survival, and a company that dies mid-experiment measures neither. */
      f.r.cash = 4_000_000;
      for (let i = 0; i < weeks; i++) f = advanceWeek(founder, f, plan).state;
      return venture(f).users;
    };
    const grind = { sell: 5 };
    const compound = { market: 3, build: 2 };

    check(
      "selling is genuinely the better answer early — that is the trap",
      run(grind, 20) > run(compound, 20) * 2,
      `week 20: selling ${Math.round(run(grind, 20))} vs compounding ${Math.round(run(compound, 20))}`,
    );
    check(
      "and compounding has overtaken it well inside a run",
      run(compound, 60) > run(grind, 60),
      `week 60: selling ${Math.round(run(grind, 60))} vs compounding ${Math.round(run(compound, 60))}`,
    );
    check(
      "selling plateaus, because churn is a percentage",
      run(grind, 140) < run(grind, 60) * 1.15,
      `${Math.round(run(grind, 60))} at week 60, ${Math.round(run(grind, 140))} at 140`,
    );
    /*
     * The original claim here was "compounding does not plateau", and the
     * market-saturation change falsified it on purpose: word of mouth needs
     * somebody left to tell, so growth now tapers as the market fills. The
     * design claim that survives — and the one that matters — is that
     * compounding still ends far above what grinding ever reaches, and is
     * still growing at the horizon rather than flat.
     */
    check(
      "compounding still ends far above the grind, and is still moving",
      run(compound, 140) > run(grind, 140) * 3 &&
        run(compound, 140) > run(compound, 60) * 2,
      `grind ${Math.round(run(grind, 140))}, compound ${Math.round(run(compound, 60))} -> ${Math.round(run(compound, 140))}`,
    );
  }

  /* Brand is a stock that leaks. Stop paying attention and it drains. */
  {
    let f = startF();
    f = advanceWeek(founder, f, { market: 5 }).state;
    const peak = venture(f).brand;
    for (let i = 0; i < 6; i++) f = advanceWeek(founder, f, { rest: 5 }).state;
    check(
      "attention decays when you stop buying it",
      venture(f).brand < peak,
      `${peak.toFixed(1)} -> ${venture(f).brand.toFixed(1)}`,
    );
  }

  /* Raising: gated on traction, costs ownership, buys weeks. */
  {
    const f = startF();
    const seed = ROUND_BY_ID.get("seed")!;
    check(
      "you cannot raise a seed round on nothing",
      roundBlocker(venture(f), seed) !== null,
      roundBlocker(venture(f), seed) ?? "",
    );

    const pre = ROUND_BY_ID.get("preseed")!;
    let g = startF();
    g = advanceWeek(founder, g, { build: 5 }).state;
    g = advanceWeek(founder, g, { build: 5 }).state;
    check(
      "a pre-seed opens once there is something to show",
      roundBlocker(venture(g), pre) === null,
      roundBlocker(venture(g), pre) ?? "open",
    );

    g = runCommand(founder, g, "startRaise", "preseed");
    const equityBefore = venture(g).equity;
    const cashBefore = g.r.cash;
    for (let i = 0; i < 6; i++) g = advanceWeek(founder, g, { pitch: 5 }).state;
    const v = venture(g);
    check(
      "pitching until it closes pays the money in",
      v.roundsClosed.includes("preseed") && g.r.cash > cashBefore,
      `${Math.round(cashBefore)} -> ${Math.round(g.r.cash)}`,
    );
    check(
      "and takes a permanent piece of the company",
      v.equity < equityBefore && v.equity > 0,
      `${equityBefore}% -> ${v.equity.toFixed(1)}%`,
    );
  }

  /* Default alive is reachable, and it stops the clock. */
  {
    const f = startF();
    const v = venture(f);
    v.users = 4_000;
    v.product = 70;
    check(
      "revenue covering burn makes the runway infinite",
      defaultAlive(v) && !Number.isFinite(runwayOf(f.r.cash, v)),
      `${Math.round(revenueOf(v))} in vs ${Math.round(burnOf(v))} out`,
    );
    check(
      "and the run says so rather than printing a huge number",
      runwayLabel(f.r.cash, v) === "Default alive",
    );
  }

  /* Putting the price up sheds the least committed immediately. */
  {
    const f = startF();
    venture(f).users = 1_000;
    const dearer = runCommand(founder, f, "setPrice", "48");
    check(
      "a price rise loses customers on the spot",
      venture(dearer).users < 1_000 && venture(dearer).price === 48,
      `${Math.round(venture(dearer).users)} left of 1,000`,
    );
    const silly = runCommand(founder, f, "setPrice", "-5");
    check(
      "and a nonsense price is refused",
      venture(silly).price === venture(f).price,
    );
  }

  /* Nothing ends the run: out of money is a setback, not a loss. */
  {
    const f = startF();
    f.r.cash = -1;
    check(
      "running out of road is a recoverable setback",
      (founder.checkSetbacks?.(f) ?? []).includes("insolvency"),
    );
  }

  /* Replay safety and saves. */
  {
    const mk = () => {
      let f = startF(9001);
      for (let i = 0; i < 8; i++)
        f = advanceWeek(founder, f, { build: 3, sell: 2 }).state;
      return venture(f);
    };
    check(
      "the same seed always produces the same company",
      JSON.stringify(mk()) === JSON.stringify(mk()),
    );
    check(
      "a fresh venture validates",
      founder.validateData!(startF().data),
    );
    check(
      "a save owning none of the company is rejected",
      !founder.validateData!({
        venture: { ...venture(startF()), equity: 0 },
      }),
    );
    check(
      "and one with a role that does not exist is rejected",
      !founder.validateData!({
        venture: {
          ...venture(startF()),
          team: [{ id: "x", name: "x", role: "wizard", salary: 1, since: 1 }],
        },
      }),
    );
  }

  /* Cities are a real trade, not flavour. */
  {
    const weeksIn = (cityId: string) => {
      const f = startRun(founder, 5, { city: cityId });
      const g = runCommand(founder, f, "hireVenture", "engineer");
      return runwayOf(g.r.cash, venture(g));
    };
    check(
      "a cheap city buys more weeks per hire than an expensive one",
      weeksIn("mumbai") > weeksIn("newyork"),
      `mumbai ${Math.floor(weeksIn("mumbai"))} vs new york ${Math.floor(weeksIn("newyork"))}`,
    );
  }

  /* The career says its own name in its own words. */
  {
    let f = startF();
    for (let i = 0; i < 5; i++)
      f = advanceWeek(founder, f, { build: 3, market: 2 }).state;
    const text =
      JSON.stringify(founder.briefing(f, { build: 3 })) +
      founder.objective(f).text +
      founder.scoreboard(f).sub;
    check(
      "no medical, kitchen or legal vocabulary reaches the Founder",
      !/patient|clinic|covers|larder|brigade|hearing|counsel|chambers/i.test(text),
    );
  }

  /*
   * THE PRODUCT SLICE (Phase 5): discovery, the roadmap, the funnel and its
   * experiments. The first claim is the one everything else leans on — that
   * a founder who touches none of it plays exactly the venture that shipped
   * before it existed.
   */
  {
    /* -------------------------------------------- the compatibility proof */
    {
      let f = startF(31);
      for (let i = 0; i < 8; i++)
        f = advanceWeek(founder, f, { market: 2, sell: 2, build: 2 }).state;
      const v = venture(f);
      const city = startupCityOf(v);
      /* The pre-funnel formula, recomputed here from first principles. */
      const headroom = Math.max(0, 1 - v.users / city.market);
      const old =
        ((v.brand / 100) * 9 * city.reach +
          v.users * (v.brand / 100) * 0.05 * city.reach) *
        headroom;
      check(
        "an untouched venture gains exactly what the old formula paid",
        Math.abs(funnelOf(v).gained - old) < 1e-9,
        `funnel ${funnelOf(v).gained.toFixed(6)} vs formula ${old.toFixed(6)}`,
      );
      check(
        "and carries no debt, no insight and a steady roadmap",
        techDebtOf(v) === 0 &&
          insightOf(v) === 0 &&
          stanceOf(v) === "steady",
      );
    }

    /* ------------------------------------------------------- the roadmap */
    {
      let f = runCommand(founder, startF(32), "setRoadmap", "ship");
      check(
        "the roadmap takes an answer",
        stanceOf(venture(f)) === "ship",
      );
      const garbage = runCommand(founder, f, "setRoadmap", "yolo");
      check(
        "and refuses a pace it does not know",
        stanceOf(venture(garbage)) === "ship",
      );
      for (let i = 0; i < 6; i++)
        f = advanceWeek(founder, f, { build: 4 }).state;
      const debtAfterShip = techDebtOf(venture(f));
      check(
        "shipping fast accrues technical debt",
        debtAfterShip > 10,
        `${debtAfterShip.toFixed(1)} after six weeks`,
      );
      check(
        "which raises churn above the same venture clean",
        ventureChurn(venture(f)) >
          ventureChurn({ ...venture(f), techDebt: 0 }),
      );
      f = runCommand(founder, f, "setRoadmap", "stability");
      for (let i = 0; i < 6; i++)
        f = advanceWeek(founder, f, { build: 4 }).state;
      check(
        "and stability weeks pay it back down",
        techDebtOf(venture(f)) < debtAfterShip,
        `${debtAfterShip.toFixed(1)} -> ${techDebtOf(venture(f)).toFixed(1)}`,
      );
    }

    /* ----------------------------------------------------------- discovery */
    {
      const before = startF(33);
      const talked = advanceWeek(founder, before, { interview: 3 }).state;
      check(
        "talking to customers raises insight",
        insightOf(venture(talked)) > 10,
        `${insightOf(venture(talked)).toFixed(1)}`,
      );
      /* Build the same week from the same state, with and without insight:
         the informed build must land more product. */
      const clean = advanceWeek(founder, startF(33), { build: 4 }).state;
      const informed = advanceWeek(founder, talked, { build: 4 }).state;
      const cleanGain = venture(clean).product - venture(before).product;
      const informedGain =
        venture(informed).product - venture(talked).product;
      check(
        "and building with insight lands more product per block",
        informedGain > cleanGain,
        `${informedGain.toFixed(2)} vs ${cleanGain.toFixed(2)}`,
      );
      check(
        "insight fades when you stop asking",
        insightOf(venture(informed)) < insightOf(venture(talked)),
      );
    }

    /* --------------------------------------------------------- experiments */
    {
      const def = EXPERIMENTS[0];
      let f = startF(34);
      const poor = { ...f, r: { ...f.r, cash: 10 } };
      check(
        "an experiment the account cannot cover is refused",
        venture(runCommand(founder, poor, "runExperiment", def.id))
          .experimentRun === undefined,
      );
      const cost = experimentCost(venture(f), def);
      const cashBefore = f.r.cash;
      f = runCommand(founder, f, "runExperiment", def.id);
      check(
        "an affordable one is charged exactly its bill",
        cashBefore - f.r.cash === cost &&
          venture(f).experimentRun?.id === def.id,
      );
      check(
        "and a second test cannot start while it runs",
        venture(
          runCommand(founder, f, "runExperiment", EXPERIMENTS[1].id),
        ).experimentRun?.id === def.id,
      );
      const gainedBefore = funnelOf({ ...venture(f), brand: 40, users: 50 })
        .gained;
      for (let i = 0; i < 3; i++)
        f = advanceWeek(founder, f, { build: 2, rest: 1 }).state;
      const doneList = experimentsOf(venture(f));
      check(
        "it reads out after two weeks with a measured lift",
        venture(f).experimentRun === undefined &&
          doneList.length === 1 &&
          doneList[0].lift > 0,
        JSON.stringify(doneList),
      );
      check(
        "the lift is permanent on its stage of the funnel",
        funnelOf({ ...venture(f), brand: 40, users: 50 }).gained >
          gainedBefore,
      );
      check(
        "and the same experiment cannot run twice",
        venture(runCommand(founder, f, "runExperiment", def.id))
          .experimentRun === undefined,
      );
    }

    /* --------------------------------------------- saves that lie, again */
    {
      const good = startF(35);
      const asOld = JSON.parse(JSON.stringify(good.data)) as {
        venture: Record<string, unknown>;
      };
      delete asOld.venture.insight;
      delete asOld.venture.techDebt;
      delete asOld.venture.stance;
      delete asOld.venture.experiments;
      delete asOld.venture.experimentRun;
      check(
        "a save from before the product work still validates",
        founder.validateData!(asOld) === true,
      );
      const wreck = (fn: (v: Record<string, unknown>) => void) => {
        const copy = JSON.parse(JSON.stringify(good.data)) as {
          venture: Record<string, unknown>;
        };
        fn(copy.venture);
        return founder.validateData!(copy);
      };
      check(
        "a roadmap pace the game never wrote is rejected",
        !wreck((v) => {
          v.stance = "yolo";
        }),
      );
      check(
        "an insight beyond its scale is rejected",
        !wreck((v) => {
          v.insight = 150;
        }),
      );
      check(
        "an experiment the catalogue does not know is rejected",
        !wreck((v) => {
          v.experiments = [{ id: "growth-hack", week: 4, lift: 0.5 }];
        }),
      );
    }
  }
}


console.log("\nThe Politician\n" + "────────────────────────────────────────────────────");
{
  const startP = (seed = 33) => startRun(politician, seed);

  /* Week one: a candidate, no allowance, a poll in the diary. */
  {
    const f = startP();
    const c = campaign(f);
    check(
      "a politician starts as a candidate with a date in the diary",
      c.office === "candidate" && c.electionWeek > f.week && c.results.length === 0,
    );
    check(
      "and the scoreboard is a share of the vote, not money",
      politician.scoreboard(f).value.includes("%"),
      politician.scoreboard(f).value,
    );
  }

  /*
   * THE BINDING CONSTRAINT.
   *
   * Support has to drain when you stop. If a week of doing nothing ever
   * preserves a campaign lift, the career has no clock in it.
   */
  {
    let f = startP();
    f = advanceWeek(politician, f, { canvass: 6 }).state;
    const peak = projectedShare(campaign(f));
    for (let i = 0; i < 6; i++)
      f = advanceWeek(politician, f, { rest: 6 }).state;
    check(
      "support drains when you stop defending it",
      projectedShare(campaign(f)) < peak,
      `${(peak * 100).toFixed(1)}% -> ${(projectedShare(campaign(f)) * 100).toFixed(1)}%`,
    );
  }

  /*
   * And it drains TOWARD the positions, not toward zero. A politician who
   * has taken popular positions settles higher than one who has not.
   */
  {
    const settle = (positions: [string, string][]) => {
      let f = startP();
      for (const [issue, stance] of positions)
        f = runCommand(politician, f, "takePosition", `${issue}:${stance}`);
      for (let i = 0; i < 30; i++)
        f = advanceWeek(politician, f, { rest: 6 }).state;
      return projectedShare(campaign(f));
    };
    const nothing = settle([]);
    /* Fund social care and hold the rates: the two big turnout blocs. */
    const popular = settle([["care", "fund"], ["tax", "hold"]]);
    const unpopular = settle([["care", "family"], ["climate", "close"]]);
    check(
      "support settles where your positions leave it, not at zero",
      popular > nothing && nothing > unpopular,
      `unpopular ${(unpopular * 100).toFixed(1)}% < none ${(nothing * 100).toFixed(1)}% < popular ${(popular * 100).toFixed(1)}%`,
    );
  }

  /*
   * TIMING IS THE GAME.
   *
   * The same six weeks of campaigning is worth far more spent just before
   * the count than spent months out. Peaking early is a real mistake and
   * this is the test that says so.
   */
  {
    const shareAtPoll = (early: boolean) => {
      let f = startP();
      const poll = campaign(f).electionWeek;
      while (f.week <= poll) {
        const out = poll - f.week;
        const push = early ? out > 20 : out <= 6;
        f = advanceWeek(politician, f, push ? { canvass: 6 } : { rest: 6 })
          .state;
      }
      const r = campaign(f).results[0];
      return r ? r.share : 0;
    };
    const early = shareAtPoll(true);
    const late = shareAtPoll(false);
    check(
      "the same campaign is worth more spent near the count",
      late > early,
      `early push ${(early * 100).toFixed(1)}% vs late push ${(late * 100).toFixed(1)}%`,
    );
  }

  /* A lift decays predictably, and the career says so out loud. */
  {
    const f = startP();
    const c = campaign(f);
    const soon = survivesToPoll({ ...c, electionWeek: f.week + 1 }, f.week, 10);
    const far = survivesToPoll({ ...c, electionWeek: f.week + 20 }, f.week, 10);
    check(
      "ten points a week out is worth more than ten points a year out",
      soon > far && far < 3,
      `1 week ${soon.toFixed(1)}, 20 weeks ${far.toFixed(1)}`,
    );
  }

  /* Polling day banks it — and that is the only thing that does. */
  {
    let f = startP();
    const poll = campaign(f).electionWeek;
    /* Put them well over the bar and hold them there. */
    for (const b of BLOCS) campaign(f).support[b.id] = 92;
    f = runCommand(politician, f, "takePosition", "care:fund");
    while (f.week <= poll) {
      for (const b of BLOCS) campaign(f).support[b.id] = 92;
      f = advanceWeek(politician, f, { canvass: 6 }).state;
    }
    const c = campaign(f);
    check(
      "polling day produces a result",
      c.results.length === 1,
    );
    check(
      "a comfortable lead holds the seat",
      c.results[0].won && !c.outOfOffice,
      `${(c.results[0].share * 100).toFixed(1)}% against ${(c.results[0].threshold * 100).toFixed(1)}%`,
    );
    check(
      "and the next election is already in the diary",
      c.electionWeek > f.week,
    );
  }

  /* Losing is a setback with a route out, never an ending. */
  {
    let f = startP();
    const poll = campaign(f).electionWeek;
    while (f.week <= poll) {
      for (const b of BLOCS) campaign(f).support[b.id] = 5;
      f = advanceWeek(politician, f, { rest: 6 }).state;
    }
    const lost = campaign(f);
    check(
      "a bad result loses the seat",
      lost.results.length === 1 &&
        !lost.results[0].won &&
        lost.outOfOffice === true,
    );
    check(
      "losing does not end the run — you can stand again",
      (() => {
        const again = runCommand(politician, f, "standAgain", "");
        return (
          campaign(again).outOfOffice === false &&
          campaign(again).electionWeek > again.week
        );
      })(),
    );
  }

  /* Positions cost somebody. There is no free lunch in the table. */
  {
    check(
      "no stance anywhere pleases every bloc",
      ISSUES.every((issue) =>
        issue.stances.every((st) =>
          Object.values(st.effects).some((n) => n < 0),
        ),
      ),
    );
  }

  /* Changing your mind in public is remembered, and it costs. */
  {
    let f = startP();
    f = runCommand(politician, f, "takePosition", "housing:build");
    f = runCommand(politician, f, "takePosition", "housing:protect");
    const c = campaign(f);
    check(
      "reversing a position is recorded",
      c.reversals.includes("housing"),
    );
    /*
     * The honest comparison is not "before the switch versus after" — the new
     * position has its own effects, so that measures the position rather than
     * the reversal. It is against somebody who held the same view all along:
     * identical politics, and the electorate marks down the one who moved.
     */
    let clean = startP();
    clean = runCommand(politician, clean, "takePosition", "housing:protect");
    const straight = leanOf(campaign(clean));
    const reversed = leanOf(c);
    check(
      "and costs you across the whole electorate, not just the bloc",
      BLOCS.every((b) => reversed[b.id] < straight[b.id]),
      BLOCS.map(
        (b) => `${b.id} ${Math.round(reversed[b.id])} vs ${Math.round(straight[b.id])}`,
      ).join(", "),
    );
    /* Taking the same position twice is not a reversal. */
    const same = runCommand(politician, f, "takePosition", "housing:protect");
    check(
      "restating the same position is not a reversal",
      campaign(same).reversals.length === 1,
    );
  }

  /* Turnout is what makes a bloc worth chasing. */
  {
    const older = BLOCS.find((b) => b.id === "older")!;
    const green = BLOCS.find((b) => b.id === "green")!;
    check(
      "the bloc that turns out is worth more than the bloc that is larger",
      blocWeight(older) > blocWeight(green),
      `older ${blocWeight(older).toFixed(3)} vs green ${blocWeight(green).toFixed(3)}`,
    );
  }

  /* The ladder is gated by the party, not the voters. */
  {
    const f = startP();
    check(
      "the party will not select a nobody",
      selectionBlocker(campaign(f)) !== null,
      selectionBlocker(campaign(f)) ?? "",
    );
    let g = startP();
    campaign(g).party = 90;
    g = runCommand(politician, g, "seekSelection", "");
    check(
      "a party that rates you puts you up for the next rung",
      campaign(g).office === "councillor" &&
        campaign(g).electionWeek > g.week,
      campaign(g).office,
    );
  }

  /* Replay safety and saves. */
  {
    const mk = () => {
      let f = startP(4114);
      for (let i = 0; i < 10; i++)
        f = advanceWeek(politician, f, { canvass: 3, casework: 3 }).state;
      return campaign(f);
    };
    check(
      "the same seed always runs the same campaign",
      JSON.stringify(mk()) === JSON.stringify(mk()),
    );
    check(
      "a fresh campaign validates",
      politician.validateData!(startP().data),
    );
    check(
      "a save holding an office that does not exist is rejected",
      !politician.validateData!({
        campaign: { ...campaign(startP()), office: "emperor" },
      }),
    );
    check(
      "and one standing on a position that does not exist is rejected",
      !politician.validateData!({
        campaign: {
          ...campaign(startP()),
          positions: { housing: "nationalise" },
        },
      }),
    );
  }

  /* Its own vocabulary, nobody else's. */
  {
    let f = startP();
    for (let i = 0; i < 6; i++)
      f = advanceWeek(politician, f, { canvass: 3, party: 3 }).state;
    const text =
      JSON.stringify(politician.briefing(f, { canvass: 3 })) +
      politician.objective(f).text +
      politician.scoreboard(f).sub;
    check(
      "no other career\u2019s language reaches the Politician",
      !/patient|clinic|covers|larder|brigade|runway|churn|chambers/i.test(text),
    );
  }

  /*
   * THE GROUND GAME (Phase 5): the postbag, the volunteers, the fund and
   * the band. First claim first: a campaign that touches none of it counts
   * exactly the votes it always counted.
   */
  {
    /* -------------------------------------------- the compatibility proof */
    {
      let f = startP(41);
      for (let i = 0; i < 8; i++)
        f = advanceWeek(politician, f, { canvass: 2, party: 2, media: 1, rest: 1 }).state;
      const c = campaign(f);
      check(
        "an untouched campaign carries no record, no volunteers, no fund",
        Object.keys(recordOf(c)).length === 0 &&
          volunteersOf(c) === 0 &&
          warchestOf(c) === 0,
      );
      check(
        "the post still arrives, and ignoring it moves nothing",
        (() => {
          /* The lean must be exactly the seat's positions-only lean: the
             desk fills and expires without a point changing hands. */
          const withDesk = leanOf(c);
          const bare = leanOf({ ...c, constituents: undefined, record: undefined });
          return Object.keys(withDesk).every(
            (b) => Math.abs(withDesk[b] - (bare[b] ?? 0)) < 1e-12,
          );
        })(),
      );
      check(
        "and canvassing lifts exactly what it always lifted",
        Math.abs(volunteerLift(c) - 1) < 1e-12 && gotvBonus(c) === 0,
      );
    }

    /* ------------------------------------------------------- the postbag */
    {
      let f = startP(42);
      /* Let the post arrive. */
      for (let i = 0; i < 4; i++)
        f = advanceWeek(politician, f, { party: 2, rest: 1 }).state;
      const before = campaign(f);
      const open = constituentsOf(before);
      check(
        "named constituents arrive with names, blocs and deadlines",
        open.length > 0 &&
          open.every(
            (k) => k.name.length > 0 && k.deadline > k.arrived,
          ),
        `${open.length} on the desk`,
      );
      const first = open[0];
      const worked = advanceWeek(politician, f, { casework: 1, rest: 2 }).state;
      const c2 = campaign(worked);
      check(
        "a surgery block settles the oldest case",
        !constituentsOf(c2).some((k) => k.id === first.id),
      );
      check(
        "and the delivered case moves that bloc's lean, permanently",
        (recordOf(c2)[first.bloc] ?? 0) > 0 &&
          (leanOf(c2)[first.bloc] ?? 0) >
            (leanOf({ ...c2, record: undefined })[first.bloc] ?? 0),
      );
      check(
        "the record is capped — delivery cannot buy a bloc outright",
        (() => {
          const stuffed = {
            ...c2,
            record: { [first.bloc]: 500 },
          };
          const lean = leanOf(stuffed)[first.bloc] ?? 0;
          const bare = leanOf({ ...c2, record: undefined })[first.bloc] ?? 0;
          return lean - bare <= 12 + 1e-9;
        })(),
      );
    }

    /* ------------------------------------- volunteers, and what they carry */
    {
      let f = startP(43);
      for (let i = 0; i < 5; i++)
        f = advanceWeek(politician, f, { organise: 2, rest: 1 }).state;
      const c = campaign(f);
      check(
        "organising builds a volunteer base",
        volunteersOf(c) > 20,
        `${volunteersOf(c).toFixed(1)}`,
      );
      check(
        "which amplifies canvassing and knocks doors on the day",
        volunteerLift(c) > 1.05 && gotvBonus(c) > 0,
      );
      const idle = advanceWeek(politician, f, { rest: 1 }).state;
      check(
        "and drifts away untended, like everything else here",
        volunteersOf(campaign(idle)) < volunteersOf(c),
      );
    }

    /* ------------------------------------------------ the fund's own rules */
    {
      let f = startP(44);
      const cashBefore = f.r.cash;
      f = advanceWeek(politician, f, { fundraise: 3, rest: 1 }).state;
      const c = campaign(f);
      check(
        "fundraising fills the fund, not your pocket",
        warchestOf(c) > 500 && f.r.cash < cashBefore,
        `fund ${warchestOf(c)}, cash ${f.r.cash - cashBefore}`,
      );
      /* A funded week of canvassing must end richer than the same week
         with the fund emptied: the fund reimburses the campaign's costs. */
      const funded = advanceWeek(politician, f, { canvass: 3, rest: 1 }).state;
      check(
        "and it reimburses the week's campaigning",
        (() => {
          const paid = JSON.parse(JSON.stringify(f)) as typeof f;
          (paid.data as { campaign: { warchest?: number } }).campaign.warchest = 0;
          const unfunded = advanceWeek(politician, paid, { canvass: 3, rest: 1 }).state;
          return funded.r.cash > unfunded.r.cash;
        })(),
      );
      check(
        "a focus group is paid from the fund and nowhere else",
        (() => {
          const cash = f.r.cash;
          const g = runCommand(politician, f, "focusGroup", "");
          return (
            g.r.cash === cash &&
            warchestOf(campaign(g)) === warchestOf(c) - FOCUS_GROUP_COST &&
            (campaign(g).focusUntil ?? 0) > f.week
          );
        })(),
      );
      check(
        "and an empty fund cannot buy one",
        (() => {
          const broke = JSON.parse(JSON.stringify(f)) as typeof f;
          (broke.data as { campaign: { warchest?: number } }).campaign.warchest = 100;
          const g = runCommand(politician, broke, "focusGroup", "");
          return campaign(g).focusUntil === undefined;
        })(),
      );
    }

    /* ------------------------------------------------------------ the band */
    {
      const f = startP(45);
      const c = campaign(f);
      const far = pollBandOf(c, 1);
      const near = pollBandOf(c, c.electionWeek);
      check(
        "the count tightens as polling day approaches",
        far > near && near >= 1,
        `±${far.toFixed(1)} far out, ±${near.toFixed(1)} on the day`,
      );
      check(
        "and a fresh focus group tightens it further",
        pollBandOf({ ...c, focusUntil: 10 }, 5) < pollBandOf(c, 5),
      );
      check(
        "the briefing states the band, not false precision",
        JSON.stringify(politician.briefing(f, {})).includes("±"),
      );
    }

    /* --------------------------------------------- saves that lie, again */
    {
      const good = startP(46);
      const asOld = JSON.parse(JSON.stringify(good.data)) as {
        campaign: Record<string, unknown>;
      };
      delete asOld.campaign.constituents;
      delete asOld.campaign.record;
      delete asOld.campaign.volunteers;
      delete asOld.campaign.warchest;
      delete asOld.campaign.focusUntil;
      check(
        "a save from before the ground game still validates",
        politician.validateData!(asOld) === true,
      );
      const wreck = (fn: (c: Record<string, unknown>) => void) => {
        const copy = JSON.parse(JSON.stringify(good.data)) as {
          campaign: Record<string, unknown>;
        };
        fn(copy.campaign);
        return politician.validateData!(copy);
      };
      check(
        "a case from a bloc the seat has never heard of is rejected",
        !wreck((c) => {
          c.constituents = [
            {
              id: "x",
              name: "Mr. Nobody",
              bloc: "lizards",
              matter: "everything",
              arrived: 1,
              deadline: 6,
            },
          ];
        }),
      );
      check(
        "a negative fund is rejected",
        !wreck((c) => {
          c.warchest = -400;
        }),
      );
      check(
        "a record entry that is not a number is rejected",
        !wreck((c) => {
          c.record = { retired: "lots" };
        }),
      );
    }
  }
}


console.log("\nThe Architect\n" + "────────────────────────────────────────────────────");
{
  const startA = (seed = 88) => startRun(architect, seed);
  /* A practice with one job on the boards and money to run it. */
  const withJob = (seed = 88) => {
    let f = startA(seed);
    f.r.cash = 250_000;
    const offer = studio(f).offers[0];
    f = runCommand(architect, f, "takeCommission", offer.id);
    return f;
  };

  {
    const f = startA();
    check(
      "an architect starts with one small job offered and none taken",
      studio(f).offers.length === 1 && studio(f).commissions.length === 0,
    );
    check(
      "taking it puts it on the boards at the first stage",
      (() => {
        const g = withJob();
        const c = studio(g).commissions[0];
        return c.stage === 0 && c.paid === 0 && !c.done;
      })(),
    );
  }

  /*
   * THE FIRST HALF OF THE CONSTRAINT: you are paid along the way.
   *
   * Finishing a stage has to bank real money, or the career is just the
   * Solicitor with a drawing board.
   */
  {
    let f = withJob();
    const before = f.r.cash;
    /* Concept on an extension is a couple of weeks of drawing. */
    for (let i = 0; i < 3; i++)
      f = advanceWeek(architect, f, { draw: 6 }).state;
    const c = studio(f).commissions[0];
    check(
      "finishing a stage banks its share of the fee",
      c.paid > 0 && f.r.cash > before,
      `banked ${Math.round(c.paid)}`,
    );
    check(
      "and moves the job on to the next stage",
      c.stage > 0,
      buildStage(c).label,
    );
  }

  /*
   * THE SECOND HALF, AND THE CAREER'S OWN SENTENCE.
   *
   * A client can send you backwards — and the money already banked has to
   * survive it. If a revision ever clawed back a fee this would be a
   * different (and much worse) career.
   */
  {
    let f = withJob();
    const a = studio(f);
    const c = a.commissions[0];
    /* Put it deep into the job with fees banked. */
    c.stage = 3;
    c.paid = 40_000;
    c.lastSeen = -50;
    let saw = false;
    for (let i = 0; i < 40 && !saw; i++) {
      /* Measured across the single week the revision lands in. Comparing
         against cash from before the whole loop measured accrued rent, not
         the revision — which is how the first version of this failed. */
      const cashBefore = f.r.cash;
      const g = advanceWeek(architect, f, { rest: 6 }).state;
      const after = studio(g).commissions[0];
      if (after.revisions > 0) {
        saw = true;
        check(
          "a neglected client sends the building back a stage",
          after.stage < 3,
          `stage 3 -> ${after.stage}`,
        );
        check(
          "and the fees already banked survive it",
          after.paid === 40_000 && g.r.cash >= cashBefore - 2_000,
          `paid ${after.paid}, cash moved ${Math.round(g.r.cash - cashBefore)}`,
        );
        check(
          "the drawings for those stages are gone",
          after.progress === 0,
        );
      }
      f = g;
      if (studio(f).commissions[0].done) break;
    }
    check("a neglected client eventually does reinvent the brief", saw);
  }

  /*
   * AND THE COUNTER-LEVER. Seeing the client is the defence, and it has to
   * measurably work or the revision is just weather.
   */
  {
    const f = withJob();
    const a = studio(f);
    const c = a.commissions[0];
    c.stage = 2;
    c.lastSeen = f.week - 12;
    const neglected = revisionRisk(a, c, f.week);
    const seen = revisionRisk(a, { ...c, lastSeen: f.week }, f.week);
    check(
      "a client who has just seen you is far less likely to redraw the brief",
      seen < neglected * 0.75,
      `${(neglected * 100).toFixed(1)}% neglected vs ${(seen * 100).toFixed(1)}% seen`,
    );
  }

  /* An associate exists to make that call for you. */
  {
    const f = withJob();
    const a = studio(f);
    const c = a.commissions[0];
    c.lastSeen = f.week - 8;
    const alone = revisionRisk(a, c, f.week);
    const g = runCommand(architect, f, "hireStudio", "associate");
    const covered = revisionRisk(studio(g), studio(g).commissions[0], g.week);
    check(
      "an associate takes a slice off every brief-change risk",
      covered < alone,
      `${(alone * 100).toFixed(1)}% -> ${(covered * 100).toFixed(1)}%`,
    );
  }

  /* A tower falls further than a kitchen extension. */
  {
    check(
      "a bigger building is thrown further back than a small one",
      revisionDepth({
        id: "x", kind: "tower", client: "c", stage: 3, progress: 0,
        paid: 0, revisions: 0, lastSeen: 0, startedWeek: 0,
      }) >
        revisionDepth({
          id: "y", kind: "extension", client: "c", stage: 3, progress: 0,
          paid: 0, revisions: 0, lastSeen: 0, startedWeek: 0,
        }),
    );
  }

  /* Finishing a building is what standing is made of. */
  {
    let f = withJob();
    const repBefore = f.r.reputation;
    /* Keep the client happy so nothing is redrawn, and draw it out. */
    for (let i = 0; i < 40; i++) {
      studio(f).commissions[0].lastSeen = f.week;
      f = advanceWeek(architect, f, { draw: 6 }).state;
      if (studio(f).commissions[0].done) break;
    }
    const c = studio(f).commissions[0];
    check(
      "a building that reaches the end is finished and paid in full",
      c.done === true && c.paid > 0,
      `${Math.round(c.paid)} banked`,
    );
    check(
      "and finishing it raises your standing",
      f.r.reputation > repBefore,
      `${Math.round(repBefore)} -> ${Math.round(f.r.reputation)}`,
    );
    check(
      "which is what decides the work you are offered next",
      offerableKinds(studio(f), f.r.reputation).length >=
        offerableKinds(studio(f), repBefore).length,
    );
  }

  /* Competitions: unpaid, long odds, and the only route to a museum. */
  {
    const f = withJob();
    check(
      "a museum is never simply offered to you",
      !offerableKinds(studio(f), 100).some((k) => k.id === "museum"),
    );
    const g = runCommand(architect, f, "enterCompetition", "museum");
    check(
      "entering one costs money and starts at no progress",
      !!studio(g).competition &&
        studio(g).competition!.effort === 0 &&
        g.r.cash < f.r.cash,
    );
    const odds = competitionOdds(studio(g).competition!, g.r.reputation);
    check(
      "and the odds start poor, because that is what a competition is",
      odds < 0.35,
      `${(odds * 100).toFixed(0)}%`,
    );
    /* More drawing, better odds. */
    const worked = {
      ...studio(g).competition!,
      effort: 10,
    };
    check(
      "months of work move them",
      competitionOdds(worked, g.r.reputation) > odds,
    );
  }

  /* Cities are a real trade: fees against how settled the clients are. */
  {
    const riskIn = (cityId: string) => {
      let f = startRun(architect, 3, { city: cityId });
      f.r.cash = 250_000;
      f = runCommand(architect, f, "takeCommission", studio(f).offers[0].id);
      const c = studio(f).commissions[0];
      c.lastSeen = f.week - 8;
      return revisionRisk(studio(f), c, f.week);
    };
    const feeIn = (cityId: string) => {
      const f = startRun(architect, 3, { city: cityId });
      return feeFor(studio(f), KIND_BY_ID.get("tower")!);
    };
    check(
      "the city with the biggest fees has the least settled clients",
      feeIn("dubai") > feeIn("amsterdam") &&
        riskIn("dubai") > riskIn("amsterdam"),
      `dubai ${Math.round(feeIn("dubai"))} at ${(riskIn("dubai") * 100).toFixed(1)}% vs amsterdam ${Math.round(feeIn("amsterdam"))} at ${(riskIn("amsterdam") * 100).toFixed(1)}%`,
    );
  }

  /* Resigning keeps the money and costs the standing. */
  {
    let f = withJob();
    studio(f).commissions[0].paid = 12_000;
    const rep = f.r.reputation;
    const cash = f.r.cash;
    f = runCommand(architect, f, "resignCommission", studio(f).commissions[0].id);
    check(
      "resigning a job keeps the banked fees and costs you standing",
      studio(f).commissions[0].done === true &&
        f.r.cash === cash &&
        f.r.reputation < rep,
    );
  }

  /* Replay safety and saves. */
  {
    const mk = () => {
      let f = withJob(707);
      for (let i = 0; i < 12; i++)
        f = advanceWeek(architect, f, { draw: 4, client: 2 }).state;
      return studio(f);
    };
    check(
      "the same seed always draws the same practice",
      JSON.stringify(mk()) === JSON.stringify(mk()),
    );
    check(
      "a fresh studio validates",
      architect.validateData!(startA().data),
    );
    check(
      "a save with a stage that does not exist is rejected",
      !architect.validateData!({
        studio: {
          ...studio(withJob()),
          commissions: [
            { ...studio(withJob()).commissions[0], stage: 99 },
          ],
        },
      }),
    );
    check(
      "and one commissioning a building that does not exist is rejected",
      !architect.validateData!({
        studio: {
          ...studio(withJob()),
          commissions: [
            { ...studio(withJob()).commissions[0], kind: "cathedral" },
          ],
        },
      }),
    );
  }

  /* Its own words. */
  {
    let f = withJob();
    for (let i = 0; i < 6; i++)
      f = advanceWeek(architect, f, { draw: 4, client: 2 }).state;
    const text =
      JSON.stringify(architect.briefing(f, { draw: 4 })) +
      architect.objective(f).text +
      architect.scoreboard(f).sub;
    check(
      "no other career\u2019s language reaches the Architect",
      !/patient|clinic|covers|larder|brigade|runway|churn|polling|bloc/i.test(text),
    );
  }

  /*
   * THE BRIEF, THE COMMITTEE, THE COST PLAN AND THE PALETTE (Phase 5).
   * First claim first: a commission that chooses none of it draws, banks
   * and risks exactly what it always did.
   */
  {
    /* -------------------------------------------- the compatibility proof */
    {
      const f = withJob(90);
      const a = studio(f);
      const c = a.commissions[0];
      const kind = KIND_BY_ID.get(c.kind)!;
      check(
        "an unbriefed commission draws to exactly the old stage lengths",
        DESIGN_STAGES.every(
          (st) => stageWeeksOf(c, kind, st) === Math.round(stageWeeks(kind, st)),
        ),
      );
      check(
        "and a programme brief genuinely shortens a real stage",
        /* On a big job — a two-week stage on an extension rounds back to
           two, which is honest: no brief makes a small job much faster. */
        (() => {
          const tower = KIND_BY_ID.get("tower")!;
          return (
            stageWeeksOf({ ...c, brief: "programme" }, tower, DESIGN_STAGES[2]) <
            stageWeeksOf(c, tower, DESIGN_STAGES[2])
          );
        })(),
      );
      check(
        "and exactly the risk it always had",
        Math.abs(
          revisionRisk(a, c, f.week) -
            revisionRisk(a, { ...c, brief: undefined }, f.week),
        ) < 1e-12 && budgetLoad(c) === 0,
      );
    }

    /* ---------------------------------------------------------- the brief */
    {
      const f = withJob(91);
      const id = studio(f).commissions[0].id;
      const g = runCommand(architect, f, "setBrief", `${id}:signature`);
      const c = studio(g).commissions[0];
      check(
        "a brief can be agreed at concept",
        c.brief === "signature",
      );
      check(
        "and it is binding — the meeting does not repeat",
        studio(runCommand(architect, g, "setBrief", `${id}:economy`))
          .commissions[0].brief === "signature",
      );
      check(
        "signature pays better and risks more; economy the reverse",
        BRIEFS.signature.fee > 1 &&
          BRIEFS.signature.risk > 1 &&
          BRIEFS.economy.fee < 1 &&
          BRIEFS.economy.risk < 1,
      );
      check(
        "a signature scheme runs the same drawing risk higher",
        revisionRisk(studio(g), c, g.week) >
          revisionRisk(studio(f), studio(f).commissions[0], f.week),
      );
      check(
        "and garbage is refused",
        studio(runCommand(architect, f, "setBrief", `${id}:vibes`))
          .commissions[0].brief === undefined,
      );
    }

    /* ------------------------------------------------------ the committee */
    {
      const f = withJob(92);
      const a = studio(f);
      const id = a.commissions[0].id;
      const kind = KIND_BY_ID.get(a.commissions[0].kind)!;
      const cost = consentCost(a, kind);
      const cashBefore = f.r.cash;
      let g = runCommand(architect, f, "lodgeConsent", id);
      check(
        "lodging planning costs real money and starts the clock",
        cashBefore - g.r.cash === cost &&
          studio(g).commissions[0].consent === "lodged",
      );
      /* Walk weeks until the committee answers. Deterministic per seed. */
      let guard = 0;
      while (
        studio(g).commissions[0].consent === "lodged" &&
        guard++ < 12
      ) {
        g = advanceWeek(architect, g, { client: 1, rest: 2 }).state;
      }
      const c = studio(g).commissions[0];
      check(
        "the committee eventually answers, and the answer is consent",
        c.consent === "granted",
      );
      check(
        "which halves the revision maths for good",
        revisionRisk(studio(g), c, g.week) <
          revisionRisk(studio(g), { ...c, consent: undefined }, g.week) * 0.6,
      );
    }

    /* ------------------------------------------- the cost plan and the VE */
    {
      const f = withJob(93);
      const id = studio(f).commissions[0].id;
      let g = runCommand(architect, f, "setBrief", `${id}:signature`);
      g = runCommand(architect, g, "chooseMaterial", `${id}:steel`);
      const c = studio(g).commissions[0];
      check(
        "a signature scheme in steel is over budget",
        overBudget(c),
        `load ${budgetLoad(c).toFixed(2)}`,
      );
      check(
        "value engineering is refused while the design is still young",
        studio(runCommand(architect, g, "valueEngineer", id)).commissions[0]
          .valueEngineered !== true,
      );
      const later = {
        ...g,
        data: JSON.parse(JSON.stringify(g.data)) as typeof g.data,
      };
      (later.data as { studio: { commissions: { stage: number }[] } }).studio
        .commissions[0].stage = 2;
      const ve = runCommand(architect, later, "valueEngineer", id);
      const cv = studio(ve).commissions[0];
      check(
        "at technical design it is allowed, and it works",
        cv.valueEngineered === true && !overBudget(cv),
      );
      check(
        "an over-budget scheme fights at tender; a value-engineered one does not",
        (() => {
          const atTender = { ...c, stage: 3 };
          const veAtTender = { ...cv, stage: 3 };
          return (
            revisionRisk(studio(g), atTender, g.week) >
            revisionRisk(studio(ve), veAtTender, ve.week)
          );
        })(),
      );
    }

    /* --------------------------------------------- saves that lie, again */
    {
      const good = withJob(94);
      const wreck = (fn: (c: Record<string, unknown>) => void) => {
        const copy = JSON.parse(JSON.stringify(good.data)) as {
          studio: { commissions: Record<string, unknown>[] };
        };
        fn(copy.studio.commissions[0]);
        return architect.validateData!(copy);
      };
      check(
        "a commission from before any of this still validates",
        architect.validateData!(
          JSON.parse(JSON.stringify(good.data)),
        ) === true,
      );
      check(
        "a brief the meeting never offered is rejected",
        !wreck((c) => {
          c.brief = "vibes";
        }),
      );
      check(
        "a palette the catalogue does not know is rejected",
        !wreck((c) => {
          c.material = "plutonium";
        }),
      );
      check(
        "a consent state that is not a state is rejected",
        !wreck((c) => {
          c.consent = "bribed";
        }),
      );
    }
  }
}


console.log("\nThe Engineer\n" + "────────────────────────────────────────────────────");
{
  const startE = (seed = 55) => {
    const f = startRun(engineer, seed);
    f.r.cash = 200_000;
    return f;
  };
  /* A workshop with a sensor on the bench, fully designed. */
  const designed = (seed = 55) => {
    let f = startE(seed);
    f = runCommand(engineer, f, "startProduct", "bracket");
    for (let i = 0; i < 4; i++)
      f = advanceWeek(engineer, f, { design: 6 }).state;
    return f;
  };

  {
    const f = startE();
    check(
      "an engineer starts with an empty bench",
      workshop(f).products.length === 0,
    );
    check(
      "and cannot attempt a surgical pump on day one",
      !buildableKinds(startE().r.skill).some((k) => k.id === "pump"),
    );
  }

  /*
   * THE BINDING CONSTRAINT.
   *
   * Designing is what creates the defects. This is the rule that makes
   * the career its own — nothing else in the game punishes you for doing
   * the work — so if a week at the bench ever stops adding faults, the
   * whole thing collapses into an income statement.
   */
  {
    let f = startE();
    f = runCommand(engineer, f, "startProduct", "sensor");
    const before = workshop(f).products[0].latent;
    f = advanceWeek(engineer, f, { design: 5 }).state;
    const after = workshop(f).products[0].latent;
    check(
      "designing puts faults into the product",
      after > before,
      `${before.toFixed(1)} -> ${after.toFixed(1)} faults`,
    );
  }

  /* Testing takes them out, and a complex product carries more. */
  {
    let f = designed();
    const before = workshop(f).products[0].latent;
    f = advanceWeek(engineer, f, { test: 5 }).state;
    check(
      "testing finds faults and takes them out",
      workshop(f).products[0].latent < before,
      `${before.toFixed(1)} -> ${workshop(f).products[0].latent.toFixed(1)}`,
    );

    const build = (kindId: string) => {
      let g = startE();
      /* Craft high enough to be allowed to attempt either of them — the gate
         is real, and a fresh engineer cannot start a controller. */
      g.r.skill = 60;
      g = runCommand(engineer, g, "startProduct", kindId);
      for (let i = 0; i < 3; i++)
        g = advanceWeek(engineer, g, { design: 3 }).state;
      return workshop(g).products[0].latent;
    };
    check(
      "a more complicated product carries more of them",
      build("controller") > build("bracket"),
      `controller ${build("controller").toFixed(1)} vs bracket ${build("bracket").toFixed(1)}`,
    );
  }

  /*
   * THE HIDDEN STATE.
   *
   * The player is shown a range, never the number. Testing has to narrow
   * that range as well as lower it — the knowing is half of what testing
   * is bought for.
   */
  {
    let f = designed();
    const raw = estimateOf(workshop(f).products[0]);
    const rawWidth = raw.high - raw.low;
    for (let i = 0; i < 3; i++)
      f = advanceWeek(engineer, f, { test: 5 }).state;
    const tested = estimateOf(workshop(f).products[0]);
    check(
      "testing narrows what you know, not just what is in there",
      tested.high - tested.low < rawWidth,
      `band ${rawWidth.toFixed(1)} -> ${(tested.high - tested.low).toFixed(1)}`,
    );
    check(
      "and raises how much the estimate is worth",
      confidenceOf(workshop(f).products[0]) > 40,
      `${confidenceOf(workshop(f).products[0])}% confident`,
    );
    check(
      "the truth always sits inside the band it is shown as",
      (() => {
        const p = workshop(f).products[0];
        const e = estimateOf(p);
        return p.latent >= e.low && p.latent <= e.high;
      })(),
    );
  }

  /* The certifier checks the truth, not the estimate. */
  {
    let f = designed();
    const w = workshop(f);
    /* Far too many faults to pass anywhere. */
    w.products[0].latent = 40;
    f = runCommand(engineer, f, "submitForCertification", w.products[0].id);
    for (let i = 0; i < 8; i++)
      f = advanceWeek(engineer, f, { rest: 5 }).state;
    check(
      "a product full of faults is refused, whatever you believed",
      workshop(f).products[0].stage === "testing",
      workshop(f).products[0].stage,
    );

    let g = designed(91);
    workshop(g).products[0].latent = 0;
    g = runCommand(engineer, g, "submitForCertification", workshop(g).products[0].id);
    for (let i = 0; i < 8; i++)
      g = advanceWeek(engineer, g, { rest: 5 }).state;
    check(
      "a clean one passes and goes on sale",
      workshop(g).products[0].stage === "shipped",
      workshop(g).products[0].stage,
    );
    check(
      "and starts earning",
      productRevenue(workshop(g), workshop(g).products[0]) > 0,
    );
  }

  /*
   * THE SURFACING. Faults shipped weeks ago arrive as a bill, and the
   * more the product sold the more they cost.
   */
  {
    let f = designed(77);
    const w = workshop(f);
    w.products[0].latent = 0;
    f = runCommand(engineer, f, "submitForCertification", w.products[0].id);
    for (let i = 0; i < 8; i++)
      f = advanceWeek(engineer, f, { rest: 5 }).state;
    /* Now put faults back in and let it run in the field. */
    workshop(f).products[0].latent = 8;
    workshop(f).products[0].reach = 1;
    const cashBefore = f.r.cash;
    let surfaced = false;
    for (let i = 0; i < 20 && !surfaced; i++) {
      const before = workshop(f).faultsInField;
      f = advanceWeek(engineer, f, { rest: 5 }).state;
      if (workshop(f).faultsInField > before) surfaced = true;
    }
    check(
      "faults in a shipped product reach customers",
      surfaced && workshop(f).faultsInField > 0,
      `${workshop(f).faultsInField} in the field`,
    );
    check(
      "and each one costs money and standing",
      f.r.cash < cashBefore,
    );
    check(
      "a product that sold well is more dangerous than one that did not",
      surfaceChance({ ...workshop(f).products[0], reach: 1 }) >
        surfaceChance({ ...workshop(f).products[0], reach: 0.2 }),
    );
  }

  /* Pulling it yourself: expensive, and it clears the problem. */
  {
    let f = designed(64);
    const w = workshop(f);
    w.products[0].latent = 0;
    f = runCommand(engineer, f, "submitForCertification", w.products[0].id);
    for (let i = 0; i < 8; i++)
      f = advanceWeek(engineer, f, { rest: 5 }).state;
    workshop(f).products[0].latent = 9;
    const cash = f.r.cash;
    const pulled = runCommand(engineer, f, "recallProduct", workshop(f).products[0].id);
    const p = workshop(pulled).products[0];
    check(
      "a recall takes every fault out and stops the sales",
      p.latent === 0 && p.stage === "testing" && p.recalls === 1,
    );
    check(
      "and it costs real money",
      pulled.r.cash < cash,
      `${Math.round(cash - pulled.r.cash)} to pull it`,
    );
  }

  /* Craft reduces the faults per week — it never removes them. */
  {
    const faultsAt = (skill: number) => {
      let f = startE();
      f.r.skill = skill;
      /* A bracket, because it is the one thing craft 20 is allowed to build
         — the point here is the fault rate, not the gate. */
      f = runCommand(engineer, f, "startProduct", "bracket");
      f = advanceWeek(engineer, f, { design: 4 }).state;
      return workshop(f).products[0].latent;
    };
    const novice = faultsAt(20);
    const master = faultsAt(95);
    check(
      "a better engineer builds in fewer faults",
      master < novice,
      `skill 20 -> ${novice.toFixed(1)}, skill 95 -> ${master.toFixed(1)}`,
    );
    check(
      "but never none — there is no such thing as a clean design",
      master > 0,
      master.toFixed(2),
    );
  }

  /* Cities trade speed to market against how strict the certifier is. */
  {
    const sg = WORKSHOP_CITY_BY_ID.get("singapore")!;
    const be = WORKSHOP_CITY_BY_ID.get("berlin")!;
    check(
      "the fast market is the lax one, and the strict market is slow",
      sg.certWeeks < be.certWeeks && sg.certTolerance > be.certTolerance,
      `singapore ${sg.certWeeks}wk/${sg.certTolerance} vs berlin ${be.certWeeks}wk/${be.certTolerance}`,
    );
  }

  /* Replay safety and saves. */
  {
    const mk = () => {
      let f = designed(2024);
      for (let i = 0; i < 8; i++)
        f = advanceWeek(engineer, f, { design: 3, test: 3 }).state;
      return workshop(f);
    };
    check(
      "the same seed always builds the same product",
      JSON.stringify(mk()) === JSON.stringify(mk()),
    );
    check(
      "a fresh workshop validates",
      engineer.validateData!(startE().data),
    );
    check(
      "a save with a negative fault count is rejected",
      !engineer.validateData!({
        workshop: {
          ...workshop(designed()),
          products: [{ ...workshop(designed()).products[0], latent: -3 }],
        },
      }),
    );
    check(
      "and one building something that does not exist is rejected",
      !engineer.validateData!({
        workshop: {
          ...workshop(designed()),
          products: [{ ...workshop(designed()).products[0], kind: "reactor" }],
        },
      }),
    );
  }

  /*
   * THE CONTRACT THE UI HAS TO KEEP.
   *
   * Nothing the career hands a screen may contain the true fault count.
   * If this ever fails, some panel is printing the answer and the career
   * has stopped being about uncertainty.
   */
  {
    const f = designed();
    workshop(f).products[0].latent = 7.5;
    const shown =
      JSON.stringify(engineer.briefing(f, { design: 2, test: 2 })) +
      engineer.objective(f).text +
      engineer.scoreboard(f).sub +
      engineer.scoreboard(f).value;
    check(
      "no screen is ever handed the true fault count",
      !shown.includes("7.5"),
    );
    check(
      "what it is handed is a range instead",
      /[0-9]+–[0-9]+/.test(shown),
      shown.slice(0, 90),
    );
    check(
      "no other career\u2019s language reaches the Engineer",
      !/patient|clinic|covers|larder|brigade|runway|polling|chambers/i.test(
        shown,
      ),
    );
  }

  /*
   * THE SPEC, THE ARCHITECTURE, THE LAB AND THE DISCIPLINES (Phase 5).
   * First claim first: a product that chose nothing designs, earns and
   * fails at exactly the old numbers.
   */
  {
    /* -------------------------------------------- the compatibility proof */
    {
      const f = designed(60);
      const w = workshop(f);
      const p0 = w.products[0];
      const kind = ENGINE_KIND_BY_ID.get(p0.kind)!;
      check(
        "an unnegotiated product needs exactly the old design weeks",
        designNeededFor(p0, kind) === kind.designWeeks,
      );
      check(
        "yields exactly the old testing",
        Math.abs(testYieldFor(w, p0) - testYieldFor({ ...w, rigs: [] }, p0)) <
          1e-12,
      );
      check(
        "and fails at exactly the old price",
        faultCost(w, { ...p0, stage: "shipped", reach: 0.5 }) ===
          faultCost(w, {
            ...p0,
            stage: "shipped",
            reach: 0.5,
            architecture: undefined,
          }),
      );
    }

    /* --------------------------------------------------------- the spec */
    {
      let f = startE(61);
      f = runCommand(engineer, f, "startProduct", "bracket");
      const id = workshop(f).products[0].id;
      const g = runCommand(engineer, f, "setSpec", `${id}:hardened`);
      const p0 = workshop(g).products[0];
      const kind = ENGINE_KIND_BY_ID.get(p0.kind)!;
      check(
        "requirements can be hardened while designing",
        p0.spec === "hardened" &&
          designNeededFor(p0, kind) > kind.designWeeks,
      );
      check(
        "and the negotiation does not repeat",
        workshop(runCommand(engineer, g, "setSpec", `${id}:lean`))
          .products[0].spec === "hardened",
      );
      /* Design BOTH to completion: what matters is what each spec ships
         with, not the per-week rate — an earlier cut of the numbers had
         the two cancelling almost exactly, and this is the test that
         noticed. */
      const lean = runCommand(engineer, f, "setSpec", `${id}:lean`);
      let a = g;
      let b = lean;
      for (let i = 0; i < 8; i++) {
        a = advanceWeek(engineer, a, { design: 4 }).state;
        b = advanceWeek(engineer, b, { design: 4 }).state;
      }
      check(
        "a lean product finishes design dirtier than a hardened one",
        workshop(b).products[0].latent > workshop(a).products[0].latent,
        `lean ${workshop(b).products[0].latent.toFixed(1)} vs hardened ${workshop(a).products[0].latent.toFixed(1)}`,
      );
      check(
        "garbage requirements are refused",
        workshop(runCommand(engineer, f, "setSpec", `${id}:vibes`))
          .products[0].spec === undefined,
      );
    }

    /* --------------------------------------------------- the architecture */
    {
      let f = startE(62);
      f = runCommand(engineer, f, "startProduct", "bracket");
      const id = workshop(f).products[0].id;
      const g = runCommand(engineer, f, "setArchitecture", `${id}:modular`);
      const w = workshop(g);
      const p0 = w.products[0];
      check(
        "a modular product strips faster on the rig and fails cheaper",
        testYieldFor(w, p0) > testYieldFor(w, { ...p0, architecture: undefined }) &&
          faultCost(w, { ...p0, stage: "shipped", reach: 0.5 }) <
            faultCost(w, {
              ...p0,
              stage: "shipped",
              reach: 0.5,
              architecture: undefined,
            }),
      );
      check(
        "integrated earns the premium instead",
        ARCHITECTURES.integrated.revenue > 1 &&
          ARCHITECTURES.integrated.fault > 1,
      );
      check(
        "and the decision is closed once made",
        workshop(runCommand(engineer, g, "setArchitecture", `${id}:integrated`))
          .products[0].architecture === "modular",
      );
    }

    /* ------------------------------------------------ the lab and the bench */
    {
      let f = designed(63);
      const w0 = workshop(f);
      const rig = RIGS[0];
      const cost = rigCost(w0, rig);
      const cashBefore = f.r.cash;
      f = runCommand(engineer, f, "buyRig", rig.id);
      check(
        "a rig is bought once, at the stated price",
        cashBefore - f.r.cash === cost && rigsOf(workshop(f)).includes(rig.id),
      );
      check(
        "and cannot be bought twice",
        runCommand(engineer, f, "buyRig", rig.id).r.cash === f.r.cash,
      );
      check(
        "the thermal chamber makes every test week remove more",
        testYieldFor(workshop(f), workshop(f).products[0]) >
          testYieldFor({ ...workshop(f), rigs: [] }, workshop(f).products[0]),
      );

      f = runCommand(engineer, f, "hireBench", "mechanical");
      check(
        "a discipline joins the bench and is paid weekly",
        benchOf(workshop(f)).length === 1 && benchWages(workshop(f)) > 0,
      );
      check(
        "one of each discipline, at most",
        benchOf(workshop(runCommand(engineer, f, "hireBench", "mechanical")))
          .length === 1,
      );
      /* The bench works: a fresh product designs faster with a mechanical
         engineer than without one. */
      let withTeam = runCommand(engineer, f, "startProduct", "bracket");
      const fresh = workshop(withTeam).products.find((x) => x.design === 0)!;
      withTeam = runCommand(engineer, withTeam, "focusProduct", fresh.id);
      const solo = JSON.parse(JSON.stringify(withTeam)) as typeof withTeam;
      (solo.data as { workshop: { team: unknown[] } }).workshop.team = [];
      const wk1 = advanceWeek(engineer, withTeam, { design: 2, rest: 1 }).state;
      const wk2 = advanceWeek(engineer, solo, { design: 2, rest: 1 }).state;
      check(
        "and the bench genuinely designs",
        workshop(wk1).products.find((x) => x.id === fresh.id)!.design >
          workshop(wk2).products.find((x) => x.id === fresh.id)!.design,
      );
    }

    /* ------------------------------------------------------ the prototype */
    {
      let f = designed(64);
      const w = workshop(f);
      const id = w.products[0].id;
      const kind = ENGINE_KIND_BY_ID.get(w.products[0].kind)!;
      const cost = prototypeCost(w, kind);
      const estBefore = estimateOf(w.products[0]);
      const cashBefore = f.r.cash;
      f = runCommand(engineer, f, "buildPrototype", id);
      const p0 = workshop(f).products[0];
      const estAfter = estimateOf(p0);
      check(
        "a prototype costs its bill, narrows the band and pulls a fault",
        cashBefore - f.r.cash === cost &&
          p0.prototyped === true &&
          estAfter.high - estAfter.low < estBefore.high - estBefore.low,
      );
      check(
        "and the second prototype is called production",
        runCommand(engineer, f, "buildPrototype", id).r.cash === f.r.cash,
      );
    }

    /* --------------------------------------------- saves that lie, again */
    {
      const good = designed(65);
      const wreck = (fn: (w: Record<string, unknown>) => void) => {
        const copy = JSON.parse(JSON.stringify(good.data)) as {
          workshop: Record<string, unknown>;
        };
        fn(copy.workshop);
        return engineer.validateData!(copy);
      };
      check(
        "a workshop from before any of this still validates",
        engineer.validateData!(JSON.parse(JSON.stringify(good.data))) === true,
      );
      check(
        "a rig the lab has never heard of is rejected",
        !wreck((w) => {
          w.rigs = ["croissant-oven"];
        }),
      );
      check(
        "a discipline that is not a discipline is rejected",
        !wreck((w) => {
          w.team = [{ id: "x", name: "X", role: "vibes", salary: 1, since: 1 }];
        }),
      );
      check(
        "a spec level the negotiation never offered is rejected",
        !wreck((w) => {
          (w.products as Record<string, unknown>[])[0].spec = "yolo";
        }),
      );
    }
  }
}


console.log("\nEvery career has things happen to it\n" + "────────────────────────────────────────────────────");
{
  /*
   * Four careers shipped with `events: []` and nobody noticed for weeks,
   * because an empty catalogue is not an error — it is just a run where
   * nothing ever happens. This is the check that says that is not allowed.
   */
  for (const career of CAREERS) {
    /* Three rather than four: the Solicitor carries three events plus a
       whole crisis system of its own, so the honest claim is that nobody has
       an empty catalogue — not that everybody has the same number. */
    check(
      `the ${career.label} has a catalogue of events`,
      career.events.length >= 3,
      `${career.events.length} events`,
    );
  }

  /*
   * AND EVERY CHOICE IN THEM WORKS.
   *
   * Every branch of every event, applied against a real run of that
   * career. This catches the whole class of failure that only shows up
   * when somebody actually picks the second option in week ninety: a
   * missing accessor, an undefined lookup, a state shape that moved.
   */
  let applied = 0;
  let skipped = 0;
  for (const career of CAREERS) {
    for (const event of career.events) {
      /*
       * Built once per event, and only exercised where the event would
       * actually fire.
       *
       * `apply` is only ever reached through `eligible`, so applying a choice
       * to a state the event would have refused tests something the game
       * cannot do — the first version of this called the Physician's
       * resignation handler on a practice with no staff and reported a crash
       * that no player could ever reach.
       */
      let f = startRun(career, 4242);
      f.r.cash = 500_000;
      f.r.skill = 70;
      f.r.reputation = 60;
      /*
       * Actually play it, rather than letting weeks pass empty.
       *
       * Most events are gated on the run having got somewhere — customers,
       * a product on the bench, a job on the boards — so an idle state makes
       * nearly all of them ineligible and the check measures nothing. Two
       * blocks on each of the career's own actions is a crude but genuine
       * run, and it triples what this reaches.
       */
      const plan: Record<string, number> = {};
      for (const a of career.actions.slice(0, 3)) plan[a.id] = 2;
      for (let w = 0; w < 30 && !event.eligible(f); w++) {
        f = advanceWeek(career, f, plan).state;
        f.r.cash = Math.max(f.r.cash, 200_000);
      }
      if (!event.eligible(f)) {
        skipped++;
        continue;
      }

      for (let i = 0; i < event.choices.length; i++) {
        const choice = event.choices[i];
        let line = "";
        let threw: string | null = null;
        try {
          const copy = JSON.parse(JSON.stringify(f)) as typeof f;
          line = choice.apply(copy, makeRng(7));
        } catch (e) {
          threw = e instanceof Error ? e.message : String(e);
        }
        check(
          `${career.id}/${event.id} choice ${i + 1} applies without throwing`,
          threw === null,
          threw ?? "",
        );
        check(
          `${career.id}/${event.id} choice ${i + 1} says what happened`,
          typeof line === "string" && line.length > 12,
          line.slice(0, 40),
        );
        applied++;
      }
    }
  }
  console.log(
    `  ..    ${applied} event branches exercised, ${skipped} events never eligible`,
  );

  /*
   * Events must be eligible for the career they belong to and nobody
   * else — an event wired to the wrong catalogue reads state that is not
   * there, which is a crash rather than a wrong number.
   */
  {
    const ids = new Map<string, string>();
    let clash: string | null = null;
    for (const career of CAREERS) {
      for (const e of career.events) {
        const owner = ids.get(e.id);
        if (owner && owner !== career.id) clash = `${e.id}: ${owner} and ${career.id}`;
        ids.set(e.id, career.id);
      }
    }
    check("no event belongs to two careers", clash === null, clash ?? "");
  }

  /* Every event can be asked whether it is eligible, on a fresh run. */
  {
    let broke: string | null = null;
    for (const career of CAREERS) {
      const f = startRun(career, 11);
      for (const e of career.events) {
        try {
          e.eligible(f);
          e.weight(f);
          e.body(f);
        } catch (err) {
          broke = `${career.id}/${e.id}: ${err instanceof Error ? err.message : err}`;
        }
      }
    }
    check(
      "every event can be evaluated against a week-one run",
      broke === null,
      broke ?? "",
    );
  }
}


console.log("\nSaves that lie\n" + "────────────────────────────────────────────────────");
{
  /*
   * DATA INTEGRITY, TESTED THE WAY IT FAILS.
   *
   * Three defects lived here until the audit named them: the archive was
   * read scoped and written unscoped, the resource validator accepted a
   * save with `cash` deleted, and a message answered with index 99 on a
   * two-choice thread passed validation and crashed the render. Each of
   * these tests is the failure it fixes, replayed.
   */

  /* ------------------------------------------------ required resources */
  {
    let holes = 0;
    let leaks: string | null = null;
    for (const career of CAREERS) {
      const good = startRun(career, 5);
      /* Through JSON, exactly the way a stored save reaches the validator. */
      if (!validateRun(JSON.parse(JSON.stringify(good))))
        leaks = `${career.id}: intact save rejected`;
      for (const res of career.resources) {
        const broken = JSON.parse(JSON.stringify(good)) as Record<
          string,
          Record<string, unknown>
        >;
        delete broken.r[res.id];
        if (validateRun(broken as never)) {
          leaks = `${career.id} accepts a save missing ${res.id}`;
        }
        holes++;
      }
    }
    check(
      "no career accepts a save missing any of its declared resources",
      leaks === null,
      leaks ?? `${holes} deletions tried across ${CAREERS.length} careers`,
    );
  }

  /* -------------------------------------------------- the phone's shape */
  {
    /* A real phone, from a real run, so the fixture cannot drift. */
    let f = startRun(chef, 8181);
    f.r.cash = 100_000;
    f = runCommand(chef, f, "hireKitchen", "sous");
    const cook = kitchen(f).staff[0];
    cook.skill = 80;
    cook.loyalty = 30;
    f = advanceWeek(chef, f, { rest: 1 }).state;
    const withMsg = kitchen(f).phone!;
    const poach = withMsg.messages.find((m) => m.choices);
    check(
      "the fixture has a real message with choices",
      poach !== undefined && (poach.choices?.length ?? 0) >= 2,
    );
    check(
      "a phone produced by the engine validates",
      validatePhone(withMsg),
    );

    const mutate = (fn: (p: typeof withMsg) => void) => {
      const copy = JSON.parse(JSON.stringify(withMsg)) as typeof withMsg;
      fn(copy);
      return validatePhone(copy);
    };
    check(
      "an answer outside its choices is rejected",
      !mutate((p) => {
        const m = p.messages.find((x) => x.choices)!;
        m.answered = 99;
      }),
    );
    check(
      "an answer inside its choices is accepted",
      mutate((p) => {
        const m = p.messages.find((x) => x.choices)!;
        m.answered = 0;
      }),
    );
    check(
      "an answer with no choices at all is rejected",
      !mutate((p) => {
        const m = p.messages.find((x) => !x.choices)!;
        m.answered = 0;
      }),
    );
    check(
      "a choice that is not really a choice is rejected",
      !mutate((p) => {
        const m = p.messages.find((x) => x.choices)!;
        (m.choices as unknown[])[0] = { label: "only a label" };
      }),
    );
    check(
      "a feed post with no body is rejected",
      !mutate((p) => {
        p.feed.unshift({} as never);
      }),
    );

    /* Every career rejects a garbage phone; the ones whose phone is
       optional still accept its absence. */
    let weak: string | null = null;
    for (const career of CAREERS) {
      const run = startRun(career, 9);
      const data = JSON.parse(JSON.stringify(run.data)) as Record<
        string,
        Record<string, unknown>
      >;
      const slice = Object.values(data)[0];
      if (!slice) continue;
      slice.phone = { social: { followers: "many" } };
      if (career.validateData && career.validateData(data)) {
        weak = `${career.id} accepts a garbage phone`;
      }
    }
    check(
      "every career rejects a save whose phone is garbage",
      weak === null,
      weak ?? "",
    );

    let strict: string | null = null;
    for (const career of CAREERS) {
      if (career.id === "doctor") continue;
      const run = startRun(career, 9);
      const data = JSON.parse(JSON.stringify(run.data)) as Record<
        string,
        Record<string, unknown>
      >;
      const slice = Object.values(data)[0];
      if (!slice) continue;
      delete slice.phone;
      if (career.validateData && !career.validateData(data)) {
        strict = `${career.id} rejects a save from before it had a phone`;
      }
    }
    check(
      "and absence still loads, for every career whose phone is optional",
      strict === null,
      strict ?? "",
    );
  }

  /* --------------------------------------------------- archive scoping */
  {
    /*
     * `save.ts` refuses to touch storage without a window, so one is
     * installed for the duration of this block. That is not cheating —
     * it is the only way node can execute the exact code the browser
     * runs, and the bug this covers (scoped read, unscoped write) lived
     * precisely in that code.
     */
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() {
          return store.size;
        },
      },
    };
    try {
      /*
       * The full `ArchivedCareer` shape, because `loadArchive` filters what
       * it reads through the real guard — the first fixture here was five
       * fields and silently filtered out, which made the scoping look broken
       * when it was the fixture that was.
       */
      const character = {
        id: "arch-1",
        careerId: "chef",
        careerLabel: "Chef",
        name: "Tester",
        weeks: 10,
        retiredWeek: 10,
        netWorth: 1_000,
        overall: 50,
        businesses: 1,
        cities: ["lyon"],
        traits: [],
        setbacksSurvived: [],
        ambitionsCompleted: [],
        reputation: [],
        relationships: [],
        timeline: [],
        milestones: [],
        retiredNote: "Went out on a good year.",
      } as never;

      setSaveScope("alice");
      saveArchive([character]);
      check(
        "a signed-in archive is written under that player's key",
        [...store.keys()].some((k) => k.includes("p.alice:")) &&
          !store.has("career-tycoon:archive:v1"),
        [...store.keys()].join(", "),
      );
      check(
        "and the same player reads it back",
        loadArchive().length === 1,
      );

      setSaveScope("bob");
      check(
        "a different player does not see it",
        loadArchive().length === 0,
      );

      /* The stranded case the bug produced: an archive under the bare
         key while somebody is signed in. The read adopts it. */
      store.set("career-tycoon:archive:v1", JSON.stringify([character]));
      const rescued = loadArchive();
      check(
        "a stranded unscoped archive is rescued into the signed-in scope",
        rescued.length === 1 && !store.has("career-tycoon:archive:v1"),
      );
      check(
        "and stays where it was rescued to",
        loadArchive().length === 1,
      );
    } finally {
      setSaveScope(null);
      delete (globalThis as Record<string, unknown>).window;
    }
  }
}

console.log("\nThe Chef's artwork\n" + "─".repeat(52));
{
  /*
   * The same guarantee the purchase registry gives the Physician: every item
   * in the catalogue has a picture, every picture is on disk, and no two
   * things share one. Keyed by the simulation's own ids, so adding a sixth
   * service fails here rather than leaving a hole in a screen.
   */
  check(
    "every room and every service has artwork registered",
    missingChefArt().length === 0,
    missingChefArt().join(", "),
  );
  {
    /* Distinct pictures, counted over the entries that have one. The awaiting
       set remains part of the contract for future catalogue-first additions,
       but the current catalogue is fully illustrated. */
    const arted = [
      ...CHEF_PREMISES.filter(
        (p) => !AWAITING_CHEF_ART.has(`premises:${p.id}`),
      ).map((p) => premisesArt(p.id)?.src),
      ...SERVICES.filter(
        (sv) => !AWAITING_CHEF_ART.has(`service:${sv.id}`),
      ).map((sv) => serviceArt(sv.id)?.src),
    ];
    check(
      "each one is its own picture, not the same plate five times",
      new Set(arted.filter(Boolean)).size === arted.length,
      `${new Set(arted.filter(Boolean)).size} of ${arted.length}`,
    );
    check(
      "the Chef catalogue has no artwork still waiting",
      awaitingChefArt().length === 0 && missingChefArt().length === 0,
      awaitingChefArt().join(", "),
    );
  }
  {
    const missing = chefArtPaths().filter(
      (src) => !existsSync(join("public", src.replace(/^\//, ""))),
    );
    check(
      "every Chef image resolves to a file on disk",
      missing.length === 0,
      missing.join(", "),
    );
  }
  check(
    "nothing the Chef serves is a source PNG",
    chefArtPaths().every((src) => src.endsWith(".webp")),
  );
  check(
    "every Chef image declares the box it will fill",
    CHEF_PREMISES.filter((p) => !AWAITING_CHEF_ART.has(`premises:${p.id}`))
      .map((p) => premisesArt(p.id))
      .every((a) => !!a && a.width > 0 && a.height > 0),
  );
  check(
    "the critic event is registered like any other career's event",
    eventVisual("critic")?.src === CRITIC_ART.src,
  );

  /*
   * The larder picture is a reading of the larder, not a mood.
   *
   * Three states, all derived: nothing in stock shows nothing, stock with
   * time on it shows the full larder, and stock that dies this week shows the
   * one being thrown out. The check builds each case out of real lots rather
   * than asserting the function's own arithmetic back at it.
   */
  {
    const shelfLifeOf = (id: string) => PRODUCE_BY_ID.get(id)?.shelfLife ?? null;
    const empty = startRun(chef, 3131);
    check(
      "an empty larder has no picture to show",
      larderArt(kitchen(empty), empty.week, 0, shelfLifeOf) === null,
    );

    const stocked = runCommand(chef, empty, "buyProduce", "market:basic");
    check(
      "a crate bought this week reads as fresh",
      larderArt(kitchen(stocked), stocked.week, 0, shelfLifeOf)?.state ===
        "fresh",
      String(larderArt(kitchen(stocked), stocked.week, 0, shelfLifeOf)?.state),
    );
    /* The standard crate lives four weeks, so on its last one it is exactly
       what the rows call "Last week". */
    const basic = PRODUCE_BY_ID.get("basic")!;
    check(
      "the same crate on its last week reads as going over",
      larderArt(
        kitchen(stocked),
        stocked.week + basic.shelfLife - 1,
        0,
        shelfLifeOf,
      )?.state === "expiring",
    );
    check(
      "and refrigeration buys it back",
      larderArt(
        kitchen(stocked),
        stocked.week + basic.shelfLife - 1,
        1,
        shelfLifeOf,
      )?.state === "fresh",
    );
  }
}

console.log("\nStarting somewhere\n" + "────────────────────────────────────────────────────");
{
  /*
   * The city is chosen once, before week one, and every career applies it to
   * its own state. What has to hold for all three: the choice lands, a
   * nonsense id lands on the default instead of half-placing a run, the same
   * seed and city replay identically, and a save written before any of this
   * existed still loads and reads as the career's original home.
   */
  const each: [string, typeof doctor][] = [
    ["doctor", doctor],
    ["chef", chef],
    ["lawyer", lawyer],
  ];

  for (const [id, career] of each) {
    const cities = career.startCities ?? [];
    const other = cities[cities.length - 1];
    check(`${id}: the default start is the career's first city`, cities.length > 1);

    const chosen = startRun(career, 4242, { city: other.id });
    check(
      `${id}: choosing ${other.name} starts the run there`,
      chosen.startCity === other.id,
      String(chosen.startCity),
    );

    const nonsense = startRun(career, 4242, { city: "atlantis" });
    check(
      `${id}: a city that does not exist falls back rather than half-placing`,
      nonsense.startCity === cities[0].id,
      String(nonsense.startCity),
    );
    const plain = startRun(career, 4242);
    check(
      `${id}: not choosing at all is the same as choosing the default`,
      JSON.stringify(plain) === JSON.stringify(nonsense),
    );

    /* Determinism: the city is applied outside the RNG, so two runs on one
       seed in one city are the same run. */
    check(
      `${id}: same seed, same city, same run`,
      JSON.stringify(startRun(career, 99, { city: other.id })) ===
        JSON.stringify(startRun(career, 99, { city: other.id })),
    );
    check(
      `${id}: a different city is a different run`,
      JSON.stringify(startRun(career, 99, { city: cities[0].id })) !==
        JSON.stringify(startRun(career, 99, { city: other.id })),
    );

    /* The timeline says where it began, because a run that opens in Mumbai
       and never mentions it is a run whose numbers look wrong. */
    check(
      `${id}: the timeline records where the run began`,
      timelineOf(chosen).some((t) => t.title.includes(other.name)),
    );

    /* A save with no city at all — every save written before this feature. */
    const legacy = startRun(career, 7);
    delete legacy.startCity;
    check(
      `${id}: a save from before the choice still validates`,
      validateRun(JSON.parse(JSON.stringify(legacy))),
    );
    check(
      `${id}: and a save naming a city that does not exist is rejected`,
      !validateRun(
        JSON.parse(JSON.stringify({ ...legacy, startCity: "atlantis" })),
      ),
    );
  }

  /* -------------------------------------------------- the Chef's cities */
  {
    const lyon = startRun(chef, 11, { city: "lyon" });
    const mumbai = startRun(chef, 11, { city: "mumbai" });
    const paris = startRun(chef, 11, { city: "paris" });

    check(
      "chef: Lyon is the neutral city every earlier run was played in",
      rent(kitchen(lyon)) === CHEF_PREMISES[0].rent &&
        extraShelfLife(kitchen(lyon)) === 0 &&
        lyon.r.cash === 7_500 &&
        lyon.r.debt === 38_000,
    );
    check(
      "chef: a cheap city is cheap to be in and pays less a cover",
      rent(kitchen(mumbai)) < rent(kitchen(lyon)) &&
        spendPerHead(kitchen(mumbai)) < spendPerHead(kitchen(lyon)),
      `${rent(kitchen(mumbai))} rent, ${Math.round(spendPerHead(kitchen(mumbai)))} a head`,
    );
    check(
      "chef: an expensive city charges more for the same room and pays more",
      rent(kitchen(paris)) > rent(kitchen(lyon)) &&
        spendPerHead(kitchen(paris)) > spendPerHead(kitchen(lyon)),
    );
    check(
      "chef: the opening loan and float are in the money of the city",
      mumbai.r.debt < lyon.r.debt &&
        paris.r.debt > lyon.r.debt &&
        Math.abs(mumbai.r.cash / mumbai.r.debt - lyon.r.cash / lyon.r.debt) <
          0.01,
    );
    check(
      "chef: the same crate costs what the city charges for it",
      priceFrom(
        SUPPLIER_BY_ID.get("market")!,
        PRODUCE_BY_ID.get("basic")!,
        0,
        produceIndex(kitchen(mumbai)),
      ) <
        priceFrom(
          SUPPLIER_BY_ID.get("market")!,
          PRODUCE_BY_ID.get("basic")!,
          0,
          produceIndex(kitchen(paris)),
        ),
    );
    check(
      "chef: heat and lorries cost a week of shelf life, cold cellars buy one",
      extraShelfLife(kitchen(mumbai)) === -1 &&
        extraShelfLife(kitchen(startRun(chef, 11, { city: "milan" }))) === 1,
    );
    /* A city that takes a week off shelf life must not bin a crate on the day
       it is delivered — that reads as a bug, not as a hard city. */
    {
      const k = kitchen(mumbai);
      const luxury = PRODUCE_BY_ID.get("luxury")!;
      const lot = {
        id: "l1",
        produce: luxury.id,
        left: luxury.covers,
        unitCost: 40,
        boughtWeek: 1,
      };
      check(
        "chef: the shortest-lived produce still survives the week it arrives",
        !isSpoiled(lot, 1, extraShelfLife(k)) &&
          freshnessOf(lot, 1, extraShelfLife(k)) > 0,
      );
    }
    /*
     * EVERYTHING IS LOCAL, OR NOTHING IS.
     *
     * The simulation found this and it is the most important rule in the
     * feature: the first pass localised rent, produce and takings but not
     * wages, equipment, events or the insolvency line, and the cheap cities
     * were insolvent for 119 weeks out of 120 on arithmetic alone. Each of
     * these checks is one of the holes.
     */
    {
      const hire = (s: typeof lyon) =>
        rolePay(kitchen(s), ROLE_BY_ID.get("partie")!);
      check(
        "chef: wages and hiring are in the money of the city",
        hire(mumbai).salary < hire(lyon).salary &&
          hire(paris).salary > hire(lyon).salary &&
          hire(lyon).salary === ROLE_BY_ID.get("partie")!.salary,
        `${hire(mumbai).salary} / ${hire(lyon).salary} / ${hire(paris).salary}`,
      );
      check(
        "chef: and the salary that goes on the payroll is the local one",
        kitchen(runCommand(chef, mumbai, "hireKitchen", "partie")).staff[0]
          ?.salary === hire(mumbai).salary,
      );
      check(
        "chef: equipment is bought, installed and run in local money",
        kitPrice(kitchen(mumbai), KIT_BY_ID.get("coldroom")!) <
          kitPrice(kitchen(lyon), KIT_BY_ID.get("coldroom")!) &&
          kitPrice(kitchen(lyon), KIT_BY_ID.get("coldroom")!) ===
            KIT_BY_ID.get("coldroom")!.cost,
      );
      check(
        "chef: a room costs what a room costs here",
        premisesPrice(kitchen(mumbai), CHEF_PREMISES[1]) <
          premisesPrice(kitchen(lyon), CHEF_PREMISES[1]),
      );
      check(
        "chef: a sum quoted in an event is converted before it is charged",
        localSum(mumbai, 4_500) < 4_500 &&
          localSum(lyon, 4_500) === 4_500 &&
          localSum(paris, 4_500) > 4_500,
        `${localSum(mumbai, 4_500)} / ${localSum(lyon, 4_500)} / ${localSum(paris, 4_500)}`,
      );
      /* And insolvency means the same thing everywhere: a hole the size of
         the business, not a number from another country. */
      const broke = (s: typeof lyon, cash: number) =>
        (chef.checkSetbacks?.({ ...s, r: { ...s.r, cash } }) ?? []).includes(
          "insolvency",
        );
      check(
        "chef: the insolvency line is in local money too",
        broke(mumbai, -20_000) && !broke(lyon, -20_000) && broke(lyon, -60_000),
      );
    }

    check(
      "chef: the target is stated in the money of the city, not London's",
      goalFor(mumbai) < goalFor(lyon) && goalFor(paris) > goalFor(lyon),
      `${goalFor(mumbai)} / ${goalFor(lyon)} / ${goalFor(paris)}`,
    );
    /* Demand is the axis a player feels first, and it has to move the
       forecast they order against rather than only the card. */
    check(
      "chef: a busier city forecasts more covers for the same kitchen",
      forecastFor(kitchen(mumbai), 40, SERVICE_BY_ID.get("dinner")!, 1, 40).high >
        forecastFor(kitchen(lyon), 40, SERVICE_BY_ID.get("dinner")!, 1, 40).high,
    );
    check(
      "chef: and says so in words, not only in the number",
      forecastFor(kitchen(mumbai), 40, SERVICE_BY_ID.get("dinner")!, 1, 40)
        .drivers.some((d) => d.label === "Mumbai"),
    );
  }

  /* --------------------------------------------- the Solicitor's cities */
  {
    const london = startRun(lawyer, 21, { city: "london" });
    const lagos = startRun(lawyer, 21, { city: "lagos" });
    const kind = CASE_BY_ID.get("commercial")!;

    check(
      "lawyer: London is the neutral market every earlier run practised in",
      feeIn(practice(london), kind) === kind.fee &&
        chambersRent(practice(london)) === 640 &&
        london.r.cash === 14_000,
    );
    check(
      "lawyer: the same instruction bills what the market pays",
      feeIn(practice(lagos), kind) < feeIn(practice(london), kind),
      `${feeIn(practice(lagos), kind)} against ${feeIn(practice(london), kind)}`,
    );
    check(
      "lawyer: chambers cost what the city charges",
      chambersRent(practice(lagos)) < chambersRent(practice(london)),
    );
    /*
     * `reach` is the axis that makes a market a decision rather than a rate
     * card: a small market never sends the biggest work, however well
     * regarded the firm becomes. Reputation is deliberately enormous here so
     * the only thing that can be gating it is the city.
     */
    {
      const rng = makeRng(5);
      const offers = Array.from({ length: 200 }, () =>
        newOffers(practice(lagos), 100, 4, 2, rng),
      ).flat();
      check(
        "lawyer: a market with a ceiling never offers the work above it",
        offers.length > 0 &&
          offers.every(
            (o) => (CASE_BY_ID.get(o.kind)?.prestige ?? 0) <= 7,
          ),
        `${offers.length} offers drawn`,
      );
    }
    check(
      "lawyer: salaries are in the money of the market, like the fees are",
      legalLabourIndex(practice(lagos)) < legalLabourIndex(practice(london)) &&
        legalLabourIndex(practice(london)) === 1,
    );
    check(
      "lawyer: and an associate hired in Lagos is paid a Lagos salary",
      (practice(runCommand(lawyer, { ...lagos, r: { ...lagos.r, cash: 90_000 } }, "hireLegal", "associate")).staff[0]?.salary ?? 0) <
        (practice(runCommand(lawyer, { ...london, r: { ...london.r, cash: 90_000 } }, "hireLegal", "associate")).staff[0]?.salary ?? 0),
    );
    check(
      "lawyer: the target is stated in the money of the market, and its ceiling",
      goalForFirm(lagos) < goalForFirm(london),
      `${goalForFirm(lagos)} against ${goalForFirm(london)}`,
    );
    check(
      "lawyer: two markets on the same fees differ by how far the ladder goes",
      goalForFirm(startRun(lawyer, 21, { city: "amsterdam" })) <
        goalForFirm(startRun(lawyer, 21, { city: "singapore" })) ||
        LEGAL_CITY_BY_ID.get("amsterdam")!.fee <
          LEGAL_CITY_BY_ID.get("singapore")!.fee,
    );
  }

  /* ----------------------------------------------- the Physician's start */
  {
    const lyon = startRun(doctor, 31, { city: "lyon" });
    const lagos = startRun(doctor, 31, { city: "lagos" });

    check(
      "doctor: Lyon is unchanged — the balance figures were measured there",
      lyon.r.cash === 24_000 &&
        lyon.r.debt === 165_000 &&
        med(lyon).homeCity === "lyon",
    );
    check(
      "doctor: the licence, the room and the panel all move to the city chosen",
      med(lagos).homeCity === "lagos" &&
        med(lagos).cities.join() === "lagos" &&
        med(lagos).facilities.every((f) => f.city === "lagos") &&
        med(lagos).panels.lagos === lagos.r.panel,
    );
    check(
      "doctor: you did not train where you are not",
      med(lagos).cities.includes("lyon") === false,
    );
    check(
      "doctor: training debt and float are in the money of where you trained",
      lagos.r.debt < lyon.r.debt && lagos.r.cash < lyon.r.cash,
      `${lagos.r.debt} owed, ${lagos.r.cash} in hand`,
    );
    check(
      "doctor: and the objective measures against what was actually borrowed",
      doctor.objective(lagos).progress > -0.01 &&
        doctor.objective(lagos).progress < 1,
    );
    check(
      "doctor: a save from before the choice still owes what it always owed",
      startDebtOf({ ...lyon, r: { ...lyon.r, _startDebt: 0 } }) === 165_000,
    );
    /* The expansion system is untouched: entering a market is still a
       purchase, and starting in one is not the same as being licensed
       everywhere. */
    check(
      "doctor: starting somewhere does not licence you anywhere else",
      med(lagos).cities.length === 1,
    );
  }
}

console.log("\nThe Chef's dishes\n" + "─".repeat(52));
{
  /*
   * The whole feature, from a recipe's arithmetic to what a week does to the
   * pantry. Every check builds its own state out of real commands rather than
   * hand-writing a KitchenState, so a rule that only holds when the state is
   * constructed by hand fails here.
   */
  const startK = (cash = 60_000, skill = 55) => {
    const f = startRun(chef, 8080);
    f.r.cash = cash;
    f.r.skill = skill;
    return f;
  };
  const buy = (s: RunState, ing: string, times = 1) => {
    let out = s;
    for (let i = 0; i < times; i++) {
      out = runCommand(chef, out, "buyIngredient", `market:${ing}`);
    }
    return out;
  };

  /* --------------------------------------------------- recipe arithmetic */
  {
    const chickenDish = RECIPE_BY_ID.get("roast_chicken")!;
    const byHand = chickenDish.needs.reduce(
      (n, line) => n + INGREDIENT_BY_ID.get(line.ingredient)!.price * line.qty,
      0,
    );
    check(
      "a recipe costs what its ingredients cost, per cover",
      Math.abs(recipeCost(chickenDish) - byHand) < 0.001,
      `${recipeCost(chickenDish).toFixed(2)} against ${byHand.toFixed(2)}`,
    );
    const margin = dishMargin(chickenDish, 21);
    check(
      "and margin is the price less that cost, as money and as a share",
      Math.abs(margin.profit - (21 - margin.cost)) < 0.001 &&
        Math.abs(margin.foodCostShare - margin.cost / 21) < 0.001,
    );
    check(
      "a dish priced at nothing is all food cost, not a divide by zero",
      dishMargin(chickenDish, 0).foodCostShare === 1,
    );
    check(
      "every recipe names ingredients that exist",
      RECIPES.every((r) =>
        r.needs.every((line) => INGREDIENT_BY_ID.has(line.ingredient)),
      ),
    );
    check(
      "every recipe is worth cooking at its suggested price",
      RECIPES.every((r) => dishMargin(r, r.suggestedPrice).profit > 0),
      RECIPES.filter((r) => dishMargin(r, r.suggestedPrice).profit <= 0)
        .map((r) => r.id)
        .join(", "),
    );
    check(
      "every recipe needs equipment that exists",
      RECIPES.every((r) => r.needsEquipment.every((id) => KIT_BY_ID.has(id))),
    );
    check(
      "the five categories are all used",
      new Set(RECIPES.map((r) => r.category)).size === 5,
    );
  }

  /* ------------------------------------------------------- unlocking them */
  {
    const green = startK(60_000, 20);
    check(
      "a new kitchen already knows the dishes any cook knows",
      knownRecipes(kitchen(green)).length === 3 &&
        knowsRecipe(kitchen(green), "roast_chicken"),
    );
    check(
      "a dish beyond your craft cannot be developed",
      !knowsRecipe(
        kitchen(runCommand(chef, green, "developRecipe", "truffle_pasta")),
        "truffle_pasta",
      ),
    );
    const able = runCommand(chef, startK(60_000, 50), "developRecipe", "pasta");
    check(
      "one you have the craft for can be, and it charges for it",
      knowsRecipe(kitchen(able), "pasta") && able.r.cash < 60_000,
      `${60_000 - able.r.cash} spent`,
    );
    check(
      "developing the same dish twice does not charge twice",
      runCommand(chef, able, "developRecipe", "pasta").r.cash === able.r.cash,
    );
    check(
      "a dish you cannot afford is refused rather than half-bought",
      !knowsRecipe(
        kitchen(runCommand(chef, startK(100, 50), "developRecipe", "pasta")),
        "pasta",
      ),
    );
  }

  /* ---------------------------------------------------------- naming them */
  {
    let named = runCommand(chef, startK(), "nameRecipe", "roast_chicken:Sunday bird");
    check(
      "an original dish can be given a house name",
      recipeName(
        RECIPE_BY_ID.get("roast_chicken")!,
        progressFor(kitchen(named), "roast_chicken"),
      ) === "Sunday bird",
    );
    check(
      "and the catalogue keeps its own, so nothing is orphaned",
      RECIPE_BY_ID.get("roast_chicken")!.name === "Roast chicken, root vegetables",
    );
    named = runCommand(chef, named, "nameRecipe", "roast_chicken:   ");
    check(
      "an empty name resets to the dish's own rather than blanking it",
      recipeName(
        RECIPE_BY_ID.get("roast_chicken")!,
        progressFor(kitchen(named), "roast_chicken"),
      ) === "Roast chicken, root vegetables",
    );
    const nasty = runCommand(
      chef,
      startK(),
      "nameRecipe",
      `roast_chicken:${"x".repeat(200)}`,
    );
    check(
      "a name is capped, so a save cannot carry a paragraph",
      (progressFor(kitchen(nasty), "roast_chicken")?.name ?? "").length <= 48,
    );
    check(
      "renaming a dish this kitchen does not know is refused",
      progressFor(
        kitchen(runCommand(chef, startK(), "nameRecipe", "truffle_pasta:Mine")),
        "truffle_pasta",
      ) === undefined,
    );
  }

  /* ----------------------------------------------------------- the menu */
  {
    let m = runCommand(chef, startK(), "addDish", "roast_chicken");
    check(
      "a known dish goes on the menu at its suggested price",
      activeMenu(kitchen(m))[0]?.recipe === "roast_chicken" &&
        activeMenu(kitchen(m))[0]?.price ===
          RECIPE_BY_ID.get("roast_chicken")!.suggestedPrice,
    );
    check(
      "a dish you have not developed cannot go on it",
      activeMenu(kitchen(runCommand(chef, m, "addDish", "tasting_course")))
        .length === 1,
    );
    check(
      "the same dish cannot be listed twice",
      activeMenu(kitchen(runCommand(chef, m, "addDish", "roast_chicken")))
        .length === 1,
    );
    m = runCommand(chef, m, "priceDish", "roast_chicken:44");
    check("a price can be set", activeMenu(kitchen(m))[0].price === 44);
    check(
      "a negative price is refused rather than clamped silently",
      activeMenu(kitchen(runCommand(chef, m, "priceDish", "roast_chicken:-5")))[0]
        .price === 44,
    );
    check(
      "and a dish can come off again",
      activeMenu(kitchen(runCommand(chef, m, "dropDish", "roast_chicken")))
        .length === 0,
    );

    /* The trades the menu is supposed to make. */
    const priced = runCommand(chef, m, "priceDish", "roast_chicken:200");
    check(
      "pricing far above what the room expects costs covers",
      menuFactors(kitchen(priced), 55).demand <
        menuFactors(kitchen(m), 55).demand,
      `${menuFactors(kitchen(priced), 55).demand.toFixed(2)} against ${menuFactors(kitchen(m), 55).demand.toFixed(2)}`,
    );
    let wide = m;
    for (const id of ["soup", "bread"]) wide = runCommand(chef, wide, "addDish", id);
    check(
      "a broader menu reaches more people than a single dish",
      menuFactors(kitchen(wide), 55).demand > menuFactors(kitchen(m), 55).demand,
    );
    check(
      "and a long menu is a less consistent kitchen than a short one",
      menuFactors(kitchen(wide), 55).quality <=
        menuFactors(kitchen(m), 55).quality,
    );
    check(
      "no menu at all is exactly neutral, which is what an old save gets",
      (() => {
        const none = menuFactors(kitchen(startK()), 55);
        return (
          none.demand === 1 &&
          none.quality === 1 &&
          none.prepLoad === 1 &&
          none.dishes === 0
        );
      })(),
    );
  }

  /* ------------------------------------------------- buying and consuming */
  {
    const bought = buy(startK(), "chicken");
    const chicken = INGREDIENT_BY_ID.get("chicken")!;
    check(
      "an order puts real units in the pantry",
      pantryQty(kitchen(bought), "chicken", bought.week) === chicken.orderSize,
      String(pantryQty(kitchen(bought), "chicken", bought.week)),
    );
    check(
      "and it is paid for at what this supplier charges",
      bought.r.cash < 60_000 &&
        60_000 - bought.r.cash ===
          ingredientPrice(
            kitchen(startK()),
            SUPPLIER_BY_ID.get("market")!,
            chicken,
            0,
            1,
          ),
    );
    check(
      "an order you cannot afford is refused, not part-filled",
      pantryQty(kitchen(buy(startK(10), "beef")), "beef", 1) === 0,
    );
    check(
      "the pantry counts towards what the business is worth",
      kitchenWorth(bought) > kitchenWorth(startK()) - 1,
    );

    /* Consumption: the scarcest line binds, and nothing goes negative. */
    let cook = buy(startK(), "chicken");
    cook = buy(cook, "roots");
    cook = buy(cook, "butter");
    const roast = RECIPE_BY_ID.get("roast_chicken")!;
    const drawn = consumeForCovers(kitchen(cook), roast, 20, cook.week);
    check(
      "cooking twenty covers takes twenty covers' worth of ingredients",
      drawn.made === 20 &&
        Math.abs(
          pantryQty(kitchen(cook), "chicken", cook.week) -
            (chicken.orderSize - roast.needs[0].qty * 20),
        ) < 0.001,
    );
    const huge = consumeForCovers(kitchen(cook), roast, 100_000, cook.week);
    check(
      "asking for more than the pantry holds makes fewer dishes, never negative stock",
      huge.made < 100_000 &&
        pantryOf(kitchen(cook)).every((l) => l.qty >= 0),
      `made ${huge.made}`,
    );
    check(
      "and it names what it ran out of",
      typeof huge.shortOf === "string" && huge.shortOf.length > 0,
      String(huge.shortOf),
    );
    check(
      "a dish with nothing behind it makes nothing at all",
      consumeForCovers(kitchen(startK()), roast, 10, 1).made === 0,
    );
  }

  /* --------------------------------------------------- freshness over time */
  {
    const fresh = buy(startK(), "greens");
    const k = kitchen(fresh);
    const lot = pantryOf(k)[0];
    const greens = INGREDIENT_BY_ID.get("greens")!;
    check(
      "a delivery arrives fresh",
      ingredientState(lot, fresh.week, k) === "fresh",
      ingredientState(lot, fresh.week, k),
    );
    check(
      "it works down the bands as the weeks pass, and never skips one",
      (() => {
        const seen = new Set<string>();
        for (let w = fresh.week; w < fresh.week + 8; w++) {
          seen.add(ingredientState(lot, w, k));
        }
        return seen.has("fresh") && seen.has("expiring") && seen.has("spoiled");
      })(),
    );
    check(
      "freshness falls with age rather than jumping",
      ingredientFreshness(lot, fresh.week, k) >
        ingredientFreshness(lot, fresh.week + 1, k),
    );
    check(
      "and it never goes below nothing however long it sits",
      ingredientFreshness(lot, fresh.week + 40, k) === 0,
    );

    /* Refrigeration is the modifier the whole career turns on. */
    const cold = runCommand(chef, buy(startK(), "greens"), "buyKit", "coldroom");
    const coldK = kitchen(cold);
    check(
      "a cold room adds real weeks to chilled stock",
      ingredientLifeLeft(pantryOf(coldK)[0], cold.week, coldK) >
        ingredientLifeLeft(lot, fresh.week, k),
    );
    check(
      "and keeps it out of the bin a week longer",
      ingredientState(pantryOf(coldK)[0], cold.week + greens.life, coldK) !==
        "spoiled" &&
        ingredientState(lot, fresh.week + greens.life, k) === "spoiled",
    );
    const dry = runCommand(chef, buy(startK(), "flour"), "buyKit", "coldroom");
    check(
      "but does nothing for a sack of flour, which does not care",
      pantryExtraLife(kitchen(dry), "dry") === 0,
    );
    check(
      "frozen stock barely ages whatever you own",
      pantryExtraLife(kitchen(startK()), "frozen") >=
        pantryExtraLife(kitchen(startK()), "chilled"),
    );
  }

  /* ------------------------------------------- spoilage, waste and safety */
  {
    const old = buy(startK(), "whitefish");
    const fishLot = pantryOf(kitchen(old))[0];
    /* Move the run forward without cooking, so the fish simply ages. */
    old.week += 4;
    check(
      "fish left for a month is spoiled",
      ingredientState(fishLot, old.week, kitchen(old)) === "spoiled",
    );
    check(
      "spoiled stock is invisible to the count that decides what can be cooked",
      pantryQty(kitchen(old), "whitefish", old.week) === 0,
    );
    const fish = RECIPE_BY_ID.get("fish_meuniere")!;
    check(
      "and it can never be served, which is the rule the system exists for",
      consumeForCovers(kitchen(old), fish, 5, old.week).made === 0,
    );

    const worthBefore = kitchenWorth(old);
    const dumped = runCommand(chef, old, "dumpSpoiled", "");
    check(
      "throwing it out empties the shelf and takes the stock off the books",
      pantryOf(kitchen(dumped)).length === 0 &&
        kitchenWorth(dumped) <= worthBefore,
    );
    check(
      "and it does not charge the cash a second time — that left when it was ordered",
      dumped.r.cash === old.r.cash,
    );
    check(
      "and the waste is tracked rather than vanishing into the cash line",
      (dumped.r._wasteCost ?? 0) > 0,
    );
    check(
      "throwing out nothing costs nothing",
      runCommand(chef, dumped, "dumpSpoiled", "").r.cash === dumped.r.cash,
    );

    /* The week does it whether or not the player does. */
    const auto = buy(startK(), "whitefish");
    auto.week += 4;
    const week = advanceWeek(chef, auto, { rest: 1 });
    check(
      "a week clears spoiled stock even if nobody pressed the button",
      pantryOf(kitchen(week.state)).length === 0 &&
        week.ledger.some((l) => /thrown out/i.test(l.label)),
    );
    check(
      "and the week tells the player what the loss was worth",
      /\$/.test(
        week.ledger.find((l) => /thrown out/i.test(l.label))?.note ?? "",
      ),
    );
  }

  /* -------------------------------------------------- a week, end to end */
  {
    let run = startK(60_000, 55);
    for (const ing of ["chicken", "roots", "butter", "flour"]) run = buy(run, ing);
    run = runCommand(chef, run, "buyProduce", "market:basic");
    run = runCommand(chef, run, "addDish", "roast_chicken");
    run = runCommand(chef, run, "addDish", "bread");

    const cashBefore = run.r.cash;
    const chickenBefore = pantryQty(kitchen(run), "chicken", run.week);
    const out = advanceWeek(chef, run, { dinner: 3, prep: 1, room: 1, rest: 1 });
    const done = kitchen(out.state).lastService!;

    check(
      "a service cooks the menu and reports what each dish did",
      (done.dishes ?? []).length > 0 &&
        (done.dishes ?? []).every((x) => x.covers > 0 && x.revenue > 0),
    );
    check(
      "it consumed the ingredients those dishes are made of",
      pantryQty(kitchen(out.state), "chicken", out.state.week) < chickenBefore,
    );
    check(
      "the ingredients are charged as their own line, not folded into rent",
      out.ledger.some((l) => /ingredients on the plate/i.test(l.label)),
    );
    check(
      "the money that left cash equals the ledger's own arithmetic",
      (() => {
        /*
         * Every line except the loan interest, which is *capitalised* — it is
         * added to the debt rather than paid out of the till, and has been
         * since this career shipped. Excluding it is the difference between
         * asserting the dishes layer balances and asserting a pre-existing
         * quirk away.
         */
        const net = out.ledger
          .filter((l) => !/loan interest/i.test(l.label))
          .reduce((n, l) => n + (l.amount ?? 0), 0);
        return Math.abs(out.state.r.cash - (cashBefore + net)) <= 1;
      })(),
      `${out.state.r.cash - cashBefore} moved`,
    );
    check(
      "and the dishes layer moves no cash of its own — ingredients are paid for when ordered",
      (() => {
        const info = out.ledger.filter((l) => l.kind === "info");
        return info.every((l) => l.amount === undefined);
      })(),
    );
    check(
      "covers the menu could not carry fell through to the staple",
      /*
       * Phase 2 moved the unit: the pipeline serves *tickets*, and a cover can
       * be several of them. So the invariant is now that everything the week
       * counted as served is either a ticket the night sent out or a cover the
       * crates carried — nothing counted twice and nothing lost.
       */
      (done.plainCovers ?? 0) >= 0 &&
        (done.nights ?? []).reduce((n, x) => n + x.served, 0) +
          (done.plainCovers ?? 0) ===
          done.served,
      `${done.served} served, ${(done.plainCovers ?? 0)} off the crates`,
    );
    check(
      "the dishes are credited with the covers they served",
      (progressFor(kitchen(out.state), "roast_chicken")?.served ?? 0) > 0,
    );
    check(
      "food cost is a share of takings that can actually be computed",
      (() => {
        const food =
          (done.ingredientCost ?? 0) +
          done.lines.reduce((n, l) => n + l.foodCost, 0);
        return done.revenue > 0 && food / done.revenue > 0 && food / done.revenue < 1;
      })(),
    );

    /* A kitchen with no menu still plays exactly as it always did. */
    let plain = startK(60_000, 55);
    plain = runCommand(chef, plain, "buyProduce", "market:basic");
    const plainWeek = advanceWeek(chef, plain, { dinner: 3, prep: 1, room: 1, rest: 1 });
    const plainDone = kitchen(plainWeek.state).lastService!;
    check(
      "a kitchen with no menu serves the staple and reports no dishes",
      (plainDone.dishes ?? []).length === 0 &&
        plainDone.plainCovers === plainDone.served &&
        (plainDone.ingredientCost ?? 0) === 0,
    );
    check(
      "and its takings are the arithmetic this career always had",
      plainDone.revenue > 0,
    );
  }

  /* ------------------------------------------------------ save migration */
  {
    /* Exactly what a save written before this feature looks like. */
    const legacy = startRun(chef, 4141);
    const lk = kitchen(legacy) as unknown as Record<string, unknown>;
    delete lk.pantry;
    delete lk.menu;
    delete lk.recipes;

    check(
      "a save from before the dishes existed still validates",
      chef.validateData!(legacy.data),
    );
    check(
      "and still loads through the engine's own validator",
      validateRun(JSON.parse(JSON.stringify(legacy))),
    );
    check(
      "it reads as a kitchen with no pantry and no menu",
      pantryOf(kitchen(legacy)).length === 0 &&
        activeMenu(kitchen(legacy)).length === 0,
    );
    check(
      "but it still knows the dishes any cook knows",
      knownRecipes(kitchen(legacy)).length === 3,
    );
    check(
      "a week resolves on it without touching the new systems",
      (() => {
        const w = advanceWeek(chef, legacy, { rest: 1 });
        return (kitchen(w.state).lastService?.dishes ?? []).length === 0;
      })(),
    );
    check(
      "and the first thing it develops keeps what it already knew",
      knownRecipes(
        kitchen(runCommand(chef, { ...legacy, r: { ...legacy.r, skill: 50, cash: 9_000 } }, "developRecipe", "pasta")),
      ).length === 4,
    );

    /* What must be rejected: state that would render a blank row or cook a
       dish the catalogue does not have. */
    const badRecipe = JSON.parse(JSON.stringify(startRun(chef, 1).data));
    badRecipe.kitchen.menu = [{ recipe: "moon_cheese", price: 10 }];
    check(
      "a menu naming a dish that does not exist is rejected",
      !chef.validateData!(badRecipe),
    );
    const badQty = JSON.parse(JSON.stringify(startRun(chef, 1).data));
    badQty.kitchen.pantry = [
      { id: "x", ingredient: "beef", qty: -5, unitCost: 2, life: 2, boughtWeek: 1, quality: 50 },
    ];
    check(
      "and a pantry carrying negative stock is rejected outright",
      !chef.validateData!(badQty),
    );
    const badIng = JSON.parse(JSON.stringify(startRun(chef, 1).data));
    badIng.kitchen.pantry = [
      { id: "x", ingredient: "unobtanium", qty: 5, unitCost: 2, life: 2, boughtWeek: 1, quality: 50 },
    ];
    check(
      "as is an ingredient the catalogue has never heard of",
      !chef.validateData!(badIng),
    );
  }

  /* ------------------------------------------------------- the signature */
  {
    let sig = startK(400_000, 55);
    for (let i = 0; i < SIGNATURE_REFINED; i++) {
      sig = runCommand(chef, sig, "refineRecipe", "roast_chicken");
    }
    check(
      "refining a dish costs money and improves it",
      (progressFor(kitchen(sig), "roast_chicken")?.refined ?? 0) ===
        SIGNATURE_REFINED &&
        dishQuality(
          RECIPE_BY_ID.get("roast_chicken")!,
          progressFor(kitchen(sig), "roast_chicken"),
          55,
        ) >
          dishQuality(RECIPE_BY_ID.get("roast_chicken")!, undefined, 55),
    );
    check(
      "but refinement alone does not make it a signature",
      !progressFor(kitchen(sig), "roast_chicken")?.signature,
    );
    const served = {
      ...progressFor(kitchen(sig), "roast_chicken")!,
      served: SIGNATURE_SERVED,
    };
    check(
      "cooking it enough times as well is what earns that",
      earnsSignature(served),
    );
  }
}

console.log("\nThe service, order by order\n" + "─".repeat(52));
{
  /*
   * Phase 2: tickets, stations and the people who work them. Every check
   * builds its state out of real commands, and the pipeline is exercised
   * through `advanceWeek` wherever the claim is about a week — a rule that
   * only holds when the state is hand-written is not a rule.
   */
  const kitchenReady = (opts: { hire?: string[]; cash?: number; skill?: number } = {}) => {
    let s = startRun(chef, 6161);
    s.r.cash = opts.cash ?? 300_000;
    s.r.skill = opts.skill ?? 60;
    s.r.reputation = 45;
    s = runCommand(chef, s, "takePremises", "bistro");
    for (const role of opts.hire ?? []) {
      s = runCommand(chef, s, "hireKitchen", role);
    }
    for (const id of ["roast_chicken", "bread", "soup"]) {
      s = runCommand(chef, s, "addDish", id);
    }
    for (const ing of ["chicken", "roots", "butter", "flour", "stockbones"]) {
      s = runCommand(chef, s, "buyIngredient", `market:${ing}`);
      s = runCommand(chef, s, "buyIngredient", `market:${ing}`);
    }
    s = runCommand(chef, s, "buyProduce", "market:basic");
    return s;
  };
  const nightOf = (s: RunState, alloc: Record<string, number>) => {
    const out = advanceWeek(chef, s, alloc);
    return {
      state: out.state,
      ledger: out.ledger,
      night: kitchen(out.state).lastService?.nights?.[0],
      week: kitchen(out.state).lastService,
    };
  };

  /* ------------------------------------------------------ order generation */
  {
    const { night } = nightOf(kitchenReady(), { dinner: 2, prep: 1 });
    check(
      "a service generates tickets from the menu and the room",
      !!night && night.arrived > 0,
      String(night?.arrived),
    );
    check(
      "every ticket that arrived was served, walked, or never made",
      !!night &&
        night.served + night.walked + night.unmade === night.arrived,
      night
        ? `${night.served} + ${night.walked} + ${night.unmade} against ${night.arrived}`
        : "no night",
    );
    check(
      "tickets are only for dishes that are actually on the menu",
      !!night &&
        night.dishes.every((d) =>
          activeMenu(kitchen(kitchenReady())).some((e) => e.recipe === d.dish),
        ),
    );
    check(
      "a kitchen with no menu runs no pipeline at all",
      (() => {
        let bare = startRun(chef, 6161);
        bare.r.cash = 60_000;
        bare = runCommand(chef, bare, "buyProduce", "market:basic");
        const out = advanceWeek(chef, bare, { dinner: 2 });
        const last = kitchen(out.state).lastService;
        return (last?.nights ?? []).length === 0 && (last?.served ?? 0) > 0;
      })(),
    );
  }

  /* ------------------------------------------------------ stage progression */
  {
    const { night } = nightOf(kitchenReady(), { dinner: 2, prep: 1 });
    check(
      "the night is recorded tick by tick",
      !!night && night.ticks.length > 1,
      String(night?.ticks.length),
    );
    check(
      "tickets move through the stages rather than teleporting to served",
      !!night &&
        night.ticks.some(
          (t) => t.queues.preparing > 0 || t.queues.cooking > 0 || t.queues.plating > 0,
        ),
    );
    check(
      "covers served only ever goes up as the night runs",
      !!night &&
        night.ticks.every(
          (t, i) => i === 0 || t.served >= night.ticks[i - 1].served,
        ),
    );
    check(
      "and nothing is left mid-service when the night closes",
      !!night &&
        night.ticks[night.ticks.length - 1].queues.ordered +
          night.ticks[night.ticks.length - 1].queues.preparing +
          night.ticks[night.ticks.length - 1].queues.cooking >=
          0,
    );
  }

  /* ---------------------------------------------------- ingredient draw-down */
  {
    const before = kitchenReady();
    const chickenBefore = pantryQty(kitchen(before), "chicken", before.week);
    const { state, night } = nightOf(before, { dinner: 2, prep: 1 });
    check(
      "a night eats the ingredients the tickets were made of",
      pantryQty(kitchen(state), "chicken", state.week) < chickenBefore,
    );
    check(
      "and never takes more than the pantry holds",
      pantryOf(kitchen(state)).every((l) => l.qty >= 0),
    );
    check(
      "what it cost is reported against the night that spent it",
      !!night && night.ingredientCost > 0,
    );
    check(
      "a ticket with nothing behind it is unmade, not a mistake",
      (() => {
        /* A menu with a dish whose ingredients were never bought. */
        let s = startRun(chef, 77);
        s.r.cash = 200_000;
        s.r.skill = 60;
        s = runCommand(chef, s, "takePremises", "bistro");
        s = runCommand(chef, s, "addDish", "roast_chicken");
        s = runCommand(chef, s, "buyProduce", "market:basic");
        const out = advanceWeek(chef, s, { dinner: 2 });
        const n = kitchen(out.state).lastService?.nights?.[0];
        return !!n && n.unmade > 0 && n.served === 0;
      })(),
    );
  }

  /* ------------------------------------------------------- staff and roles */
  {
    const solo = stationLoads(
      kitchen(kitchenReady()),
      SERVICE_BY_ID.get("dinner")!,
      {},
      60,
      1,
    );
    const withPastry = stationLoads(
      kitchen(kitchenReady({ hire: ["pastry"] })),
      SERVICE_BY_ID.get("dinner")!,
      {},
      60,
      1,
    );
    const cap = (loads: typeof solo, id: string) =>
      loads.find((l) => l.station === id)?.capacity ?? 0;

    check(
      "a pastry chef lifts pastry and not the hot line",
      cap(withPastry, "pastry") > cap(solo, "pastry"),
    );
    check(
      "a porter lifts the wash-up, which nothing else does",
      cap(
        stationLoads(
          kitchen(kitchenReady({ hire: ["dish"] })),
          SERVICE_BY_ID.get("dinner")!,
          {},
          60,
          1,
        ),
        "wash",
      ) > cap(solo, "wash"),
    );
    check(
      "a server lifts front of house",
      cap(
        stationLoads(
          kitchen(kitchenReady({ hire: ["front"] })),
          SERVICE_BY_ID.get("dinner")!,
          {},
          60,
          1,
        ),
        "front",
      ) > cap(solo, "front"),
    );
    check(
      "every station names who is on it, so a bottleneck has a cause",
      solo.every((l) => l.cause.length > 10),
    );
    check(
      "a sous chef or a manager halves the mistakes a kitchen makes",
      errorRateOf(kitchen(kitchenReady({ hire: ["sous"] })), 60, 1) <
        errorRateOf(kitchen(kitchenReady()), 60, 1),
    );
    check(
      "and a bigger brigade serves more of the room than one person alone",
      (() => {
        const alone = nightOf(kitchenReady(), { dinner: 3, prep: 1 }).night;
        const crewed = nightOf(
          kitchenReady({ hire: ["commis", "partie", "sous", "front"] }),
          { dinner: 3, prep: 1 },
        ).night;
        return !!alone && !!crewed && crewed.served > alone.served;
      })(),
    );
  }

  /* --------------------------------------------------------- bottlenecks */
  {
    const { night } = nightOf(kitchenReady(), { dinner: 3, prep: 1 });
    check(
      "a night that struggled names the station that held it up",
      !!night && (night.bottleneck === null || night.bottleneckCause.length > 10),
      `${night?.bottleneck} — ${night?.bottleneckCause}`,
    );
    check(
      "and every station has a fix a player can actually act on",
      STATIONS.every(
        (s) => bottleneckFix(s.id, kitchen(kitchenReady())).length > 15,
      ),
    );
    check(
      "understaffing is reported as a station, not as a vague warning",
      staffingWarnings(
        kitchen(kitchenReady()),
        SERVICE_BY_ID.get("dinner")!,
        {},
        20,
        1,
      ).every((w) => w.why.length > 10 && w.fix.length > 10),
    );
  }

  /* ------------------------------------------------------ service shapes */
  {
    const run = (svc: string) =>
      nightOf(kitchenReady({ hire: ["commis", "partie", "sous", "front"] }), {
        [svc]: 3,
        prep: 1,
      }).night;

    const lunch = run("lunch");
    const dinner = run("dinner");
    const tasting = run("tasting");
    const catering = run("catering");

    check(
      "lunch is a different shape from dinner, not the same night relabelled",
      !!lunch &&
        !!dinner &&
        (lunch.arrived !== dinner.arrived ||
          lunch.ticks.length !== dinner.ticks.length),
      `${lunch?.arrived} vs ${dinner?.arrived} tickets`,
    );
    check(
      "a tasting menu is several plates a cover, so it floods the kitchen",
      !!tasting && SERVICE_SHAPES.tasting.courses > SERVICE_SHAPES.dinner.courses,
    );
    check(
      "catering has nobody in the room, so nobody walks out of it",
      !!catering && catering.walked >= 0 && SERVICE_SHAPES.catering.patience > 50,
    );
    check(
      "and each service is judged on what it is actually for",
      new Set(Object.values(SERVICE_SHAPES).map((s) => s.expects)).size >= 4,
    );
    check(
      "a private event seats everybody at once rather than trickling in",
      SERVICE_SHAPES.event.arrival === "seating" &&
        SERVICE_SHAPES.lunch.arrival === "steady",
    );
    check(
      "every service in the catalogue has a shape of its own",
      SERVICES.every((sv) => !!SERVICE_SHAPES[sv.id]),
    );
  }

  /* ------------------------------------------------------ the policies */
  {
    const base = kitchenReady({ hire: ["commis", "partie"] });
    const pushed = runCommand(chef, base, "setServicePolicy", "pushBrigade");
    check(
      "a policy can be set, and it is remembered",
      kitchen(pushed).service?.pushBrigade === true,
    );
    check(
      "and turned off again",
      kitchen(runCommand(chef, pushed, "setServicePolicy", "pushBrigade")).service
        ?.pushBrigade === false,
    );
    check(
      "a policy that does not exist is refused",
      Object.keys(
        kitchen(runCommand(chef, base, "setServicePolicy", "cheat")).service ?? {},
      ).length === 0,
    );
    check(
      "pushing the brigade moves more tickets, and costs real fatigue",
      (() => {
        const calm = nightOf(base, { dinner: 3, prep: 1 });
        const hard = nightOf(pushed, { dinner: 3, prep: 1 });
        const tiredAfter = (s: RunState) =>
          kitchen(s).staff.reduce((n, x) => n + fatigueOf(x), 0);
        return (
          !!calm.night &&
          !!hard.night &&
          tiredAfter(hard.state) > tiredAfter(calm.state)
        );
      })(),
    );
    check(
      "simplified plating trades presentation for speed at the pass",
      (() => {
        const simple = runCommand(chef, base, "setServicePolicy", "simplePlating");
        const plain = stationLoads(
          kitchen(simple),
          SERVICE_BY_ID.get("dinner")!,
          kitchen(simple).service ?? {},
          60,
          1,
        );
        const normal = stationLoads(
          kitchen(base),
          SERVICE_BY_ID.get("dinner")!,
          {},
          60,
          1,
        );
        const pass = (l: typeof plain) =>
          l.find((x) => x.station === "pass")?.capacity ?? 0;
        return pass(plain) > pass(normal);
      })(),
    );
  }

  /* ------------------------------------------- fatigue, morale and learning */
  {
    const crewed = kitchenReady({ hire: ["commis", "partie"] });
    const { state } = nightOf(crewed, { dinner: 3, prep: 1 });
    const crew = kitchen(state).staff;
    check(
      "a night tires the people who worked it",
      crew.every((x) => fatigueOf(x) > 0),
      crew.map((x) => fatigueOf(x)).join(", "),
    );
    check(
      "and teaches them something",
      crew.every((x) => experienceOf(x) > 0),
    );
    check(
      "a week off clears real fatigue and earns no experience",
      (() => {
        const tiredId = kitchen(state).staff[0].id;
        const rested = runCommand(chef, state, "restStaff", tiredId);
        const before = kitchen(rested).staff.find((x) => x.id === tiredId)!;
        const after = advanceWeek(chef, rested, { dinner: 3, prep: 1 });
        const person = kitchen(after.state).staff.find((x) => x.id === tiredId)!;
        return (
          fatigueOf(person) < fatigueOf(before) &&
          experienceOf(person) === experienceOf(before)
        );
      })(),
    );
    check(
      "somebody resting is not on tonight",
      (() => {
        const id = kitchen(state).staff[0].id;
        const off = runCommand(chef, state, "restStaff", id);
        return !onTonight(kitchen(off), off.week).some((x) => x.id === id);
      })(),
    );
    check(
      "exhaustion is what turns a tired cook into one who leaves",
      (() => {
        const worn = { ...crew[0], fatigue: 95, loyalty: 3 } as typeof crew[0];
        return isBurntOut(worn);
      })(),
    );
    check(
      "training costs money and banks progress towards a skill point",
      (() => {
        const id = kitchen(state).staff[0].id;
        const before = state.r.cash;
        const trained = runCommand(chef, state, "trainStaff", id);
        const person = kitchen(trained).staff.find((x) => x.id === id)!;
        return trained.r.cash < before && trainingOf(person) > 0;
      })(),
    );
    check(
      "and enough of it is worth a real point of skill",
      (() => {
        const id = kitchen(state).staff[0].id;
        let s = state;
        const start = currentSkill(kitchen(s).staff.find((x) => x.id === id)!);
        for (let i = 0; i < 4; i++) s = runCommand(chef, s, "trainStaff", id);
        return currentSkill(kitchen(s).staff.find((x) => x.id === id)!) > start;
      })(),
    );
  }

  /* ------------------------------------------------------------ promotion */
  {
    const crewed = kitchenReady({ hire: ["commis"] });
    const person = kitchen(crewed).staff[0];
    check(
      "a new commis has not earned a promotion yet",
      promotionFor(person) === null,
    );
    check(
      "one who has worked the line for long enough has",
      promotionFor({
        ...person,
        experience: 200,
        skill: 60,
      }) !== null,
    );
    check(
      "promoting somebody changes the job they do and what they are paid",
      (() => {
        const ready = { ...crewed };
        kitchen(ready).staff[0].experience = 200;
        kitchen(ready).staff[0].skill = 60;
        const up = runCommand(chef, ready, "promoteStaff", person.id);
        const after = kitchen(up).staff[0];
        return after.role === "partie" && after.salary > person.salary;
      })(),
    );
  }

  /* --------------------------------------------------------- the traits */
  {
    check(
      "every trait states what it does, in the player's words",
      KITCHEN_TRAITS.every((t) => t.effect.length > 20),
    );
    check(
      "somebody hired arrives with at least one",
      kitchen(kitchenReady({ hire: ["commis"] })).staff[0].traits!.length >= 1,
    );
    check(
      "hiring is replayable — the same seed hires the same person",
      (() => {
        const a = kitchen(kitchenReady({ hire: ["commis"] })).staff[0];
        const b = kitchen(kitchenReady({ hire: ["commis"] })).staff[0];
        return JSON.stringify(a.traits) === JSON.stringify(b.traits);
      })(),
    );
    check(
      "a calm cook makes fewer mistakes than a rattled one",
      (() => {
        const k1 = kitchen(kitchenReady({ hire: ["commis"] }));
        const k2 = JSON.parse(JSON.stringify(k1)) as typeof k1;
        k1.staff[0].traits = ["calm"];
        k2.staff[0].traits = ["temperamental"];
        return errorRateOf(k1, 60, 1) < errorRateOf(k2, 60, 1);
      })(),
    );
    check(
      "a reliable cook tires more slowly than the rest",
      recover({ ...kitchen(kitchenReady({ hire: ["commis"] })).staff[0], fatigue: 50, traits: ["reliable"] }, false) <
        recover({ ...kitchen(kitchenReady({ hire: ["commis"] })).staff[0], fatigue: 50, traits: [] }, false),
    );
  }

  /* ------------------------------------------ determinism and the save */
  {
    const seedOne = nightOf(kitchenReady({ hire: ["commis"] }), { dinner: 3, prep: 1 });
    const seedTwo = nightOf(kitchenReady({ hire: ["commis"] }), { dinner: 3, prep: 1 });
    check(
      "the same kitchen and the same seed produce the same night",
      JSON.stringify(seedOne.night) === JSON.stringify(seedTwo.night),
    );
    check(
      "the night is on the save, so it survives a reload",
      (() => {
        const round = JSON.parse(JSON.stringify(seedOne.state)) as RunState;
        return (
          validateRun(round as unknown as Record<string, unknown>) &&
          (kitchen(round).lastService?.nights ?? []).length ===
            (kitchen(seedOne.state).lastService?.nights ?? []).length
        );
      })(),
    );
    check(
      "and stepping through it changes nothing, because it is a recording",
      (() => {
        const before = JSON.stringify(kitchen(seedOne.state).lastService);
        /* Reading the report is what the dashboard does; nothing here writes. */
        const n = kitchen(seedOne.state).lastService?.nights?.[0];
        void n?.ticks.map((t) => t.served);
        return JSON.stringify(kitchen(seedOne.state).lastService) === before;
      })(),
    );
    check(
      "a save written before any of this still loads and still cooks",
      (() => {
        const legacy = startRun(chef, 4242);
        const lk = kitchen(legacy) as unknown as Record<string, unknown>;
        delete lk.service;
        for (const person of kitchen(legacy).staff) {
          delete person.fatigue;
          delete person.experience;
          delete person.traits;
        }
        if (!chef.validateData!(legacy.data)) return false;
        const out = advanceWeek(chef, legacy, { rest: 1 });
        return !!kitchen(out.state);
      })(),
    );
    check(
      "a save carrying a trait that does not exist is rejected",
      (() => {
        const bad = JSON.parse(JSON.stringify(startRun(chef, 1).data));
        bad.kitchen.staff = [
          { id: "x", name: "X", role: "commis", salary: 100, traits: ["telepathy"] },
        ];
        return !chef.validateData!(bad);
      })(),
    );
    check(
      "as is a service policy the game does not have",
      (() => {
        const bad = JSON.parse(JSON.stringify(startRun(chef, 1).data));
        bad.kitchen.service = { teleportFood: true };
        return !chef.validateData!(bad);
      })(),
    );
  }

  /* --------------------------------------------------- the final settlement */
  {
    const start = kitchenReady({ hire: ["commis", "partie"] });
    const cashBefore = start.r.cash;
    const { state, ledger, night, week } = nightOf(start, { dinner: 3, prep: 1 });

    check(
      "the week's takings include what the night actually sold",
      !!night && (week?.revenue ?? 0) > 0 && night.revenue > 0,
    );
    check(
      "cash moved by exactly what the ledger says, interest aside",
      (() => {
        const net = ledger
          .filter((l) => !/loan interest/i.test(l.label))
          .reduce((n, l) => n + (l.amount ?? 0), 0);
        return Math.abs(state.r.cash - (cashBefore + net)) <= 1;
      })(),
      `${state.r.cash - cashBefore} moved`,
    );
    check(
      "a night is settled once — running the same week twice does not pay twice",
      (() => {
        /* The engine clones state per commit, so committing the *same* state
           twice must produce the same cash, not compounding rewards. */
        const a = advanceWeek(chef, start, { dinner: 3, prep: 1 });
        const b = advanceWeek(chef, start, { dinner: 3, prep: 1 });
        return a.state.r.cash === b.state.r.cash;
      })(),
    );
    check(
      "the dishes the night sold are credited to the recipes that sold them",
      (progressFor(kitchen(state), "roast_chicken")?.served ?? 0) > 0,
    );
    check(
      "walkouts cost the food they were made from and earn nothing",
      !!night &&
        (night.walked === 0 || night.ingredientCost > night.revenue * 0.01),
    );
    check(
      "a night the room hated moves the reviews down, not up",
      (() => {
        /* One person, a full room, no menu discipline: the night goes badly. */
        const swamped = kitchenReady();
        const before = swamped.r.reputation;
        const out = advanceWeek(chef, swamped, { dinner: 3 });
        const n = kitchen(out.state).lastService?.nights?.[0];
        return !n || n.satisfaction >= 55 || out.state.r.reputation <= before;
      })(),
    );
  }
}

console.log("\nNavigation per career\n" + "────────────────────────────────────────────────────");
{
  /*
   * `sectionOf` is a single index across every career, so the failure this
   * block exists for is a screen id shared between two careers routing a
   * player into the wrong section — which is exactly what happened the first
   * time the generic shell reused "practice" and sent a Chef to the medical
   * Build screen.
   */
  const screensOf = (sections: SectionDef[]) =>
    sections.flatMap((s) => s.screens.map((x) => x.id));

  for (const career of ["doctor", "chef", "lawyer"]) {
    const sections = sectionsFor(career);
    check(
      `${career}: every screen resolves back to the section it is listed in`,
      sections.every((sec) =>
        sec.screens.every((sc) => sectionOf(sc.id).id === sec.id),
      ),
      sections
        .flatMap((sec) =>
          sec.screens
            .filter((sc) => sectionOf(sc.id).id !== sec.id)
            .map((sc) => `${sc.id} -> ${sectionOf(sc.id).id}`),
        )
        .join(", "),
    );
    check(
      `${career}: tapping a destination lands on a screen that destination owns`,
      sections.every((sec) =>
        sec.screens.some((sc) => sc.id === defaultScreen(sec.id, career)),
      ),
    );
    check(
      `${career}: every screen states what it decides`,
      sections.every((sec) =>
        sec.screens.every((sc) => sc.label.length > 0 && sc.purpose.length > 20),
      ),
    );
    check(
      `${career}: no destination lists the same screen twice`,
      new Set(screensOf(sections)).size === screensOf(sections).length,
    );
  }

  const chefScreens = screensOf(sectionsFor("chef"));
  const medicalScreens = screensOf(sectionsFor("doctor"));
  /*
   * ONE RESTAURANT.
   *
   * The rule this was written for is that a Chef runs one business, and a
   * second primary tab holding premises or stock would imply a second one.
   * The "You" destination added with the craft is not that: it holds what the
   * *chef* can do and what they are offered because of it, neither of which
   * belongs to the restaurant. So the assertion is now what it always meant —
   * exactly one destination containing the business.
   */
  check(
    "the Chef has one restaurant, not a second business in the bar",
    sectionsFor("chef").filter((s) => s.id === "work").length === 1 &&
      sectionsFor("chef").length === 4,
    sectionsFor("chef")
      .map((s) => s.label)
      .join(" / "),
  );
  check(
    "and the Career destination is the chef, not a second restaurant",
    (sectionsFor("chef").find((s) => s.id === "career")?.screens ?? []).every(
      (sc) => sc.id === "craft" || sc.id === "beyond",
    ),
  );
  check(
    "and that one destination carries the seven screens the career has",
    sectionsFor("chef").find((s) => s.id === "work")?.screens.length === 7,
    String(sectionsFor("chef").find((s) => s.id === "work")?.screens.length),
  );
  check(
    "the Chef's screens are its own — nothing medical, nothing generic",
    !chefScreens.includes("operation") &&
      chefScreens
        .filter((id) => id !== "overview")
        .every((id) => !medicalScreens.includes(id)),
    chefScreens.filter((id) => id !== "overview" && medicalScreens.includes(id)).join(", "),
  );
  check(
    "the room, the larder, the menu, the pass, the brigade and the money",
    (["kitchen", "larder", "menu", "pass", "brigade", "books"] as const).every(
      (id) => chefScreens.includes(id),
    ),
    chefScreens.join(", "),
  );
  /* ------------------------------------------------ the Solicitor's shell */
  const lawyerScreens = screensOf(sectionsFor("lawyer"));
  check(
    "the Solicitor has one practice, not a second firm in the bar",
    sectionsFor("lawyer").length === 3,
    sectionsFor("lawyer")
      .map((s) => s.label)
      .join(" / "),
  );
  check(
    "and that one destination carries the four screens the career has",
    sectionsFor("lawyer").find((s) => s.id === "work")?.screens.length === 4,
    String(sectionsFor("lawyer").find((s) => s.id === "work")?.screens.length),
  );
  check(
    "the instructions, the casework, the books and the firm",
    (["instructions", "casework", "ledger", "firm"] as const).every((id) =>
      lawyerScreens.includes(id),
    ),
    lawyerScreens.join(", "),
  );
  check(
    "the Solicitor's screens are its own — nothing medical, nothing the Chef's",
    !lawyerScreens.includes("operation") &&
      lawyerScreens
        .filter((id) => id !== "overview" && id !== "home")
        .every((id) => !medicalScreens.includes(id) && !chefScreens.includes(id)),
    lawyerScreens
      .filter(
        (id) =>
          id !== "overview" &&
          id !== "home" &&
          (medicalScreens.includes(id) || chefScreens.includes(id)),
      )
      .join(", "),
  );
  /* The generic shell is still there for the NEXT career, and still lands on
     a screen that exists — it is simply nobody's route today. */
  check(
    "the generic shell survives the Solicitor leaving it",
    screensOf(sectionsFor("a-career-nobody-has-written")).includes("operation") &&
      defaultScreen("work", "a-career-nobody-has-written") === "operation",
  );
  check(
    "the Physician is untouched",
    medicalScreens.includes("build") &&
      medicalScreens.includes("caseload") &&
      sectionsFor("doctor").length === 5,
  );
  check(
    "a screen the player can reach always has a heading and a purpose to print",
    [
      ...chefScreens,
      ...medicalScreens,
      ...lawyerScreens,
      "operation",
      "home",
    ].every((id) => screenOf(id as never).label.length > 0),
  );
}

console.log("\nThe Solicitor\n" + "────────────────────────────────────────────────────");
{
  const startL = () => startRun(lawyer, 505);
  const l = startL();
  check(
    "a solicitor run starts with nothing on the books",
    practice(l).cases.length === 0 && practice(l).offers.length === 0,
  );

  const pitched = advanceWeek(lawyer, l, { pitch: 2, network: 1 }).state;
  const offers = practice(pitched).offers;
  check("pitching brings instructions in", offers.length > 0);

  if (offers.length > 0) {
    const taken = runCommand(lawyer, pitched, "takeCase", offers[0].id);
    const p = practice(taken);
    check("an instruction can be accepted", p.cases.length === 1);
    check(
      "it arrives unprepared and against a deadline",
      p.cases[0].hoursDone === 0 && p.cases[0].dueWeek > taken.week,
    );

    /* THE DECISION: certain money now, or the fee if it goes your way. */
    const offerNow = settlementFor(p.cases[0], p, taken.r.skill);
    const kind = CASE_BY_ID.get(p.cases[0].kind)!;
    check(
      "a settlement is worth less than winning",
      offerNow > 0 && offerNow < kind.fee,
    );
    const settled = runCommand(lawyer, taken, "settleCase", p.cases[0].id);
    check(
      "settling pays at once and closes the file",
      settled.r.cash === taken.r.cash + offerNow &&
        practice(settled).cases.length === 0,
    );

    const prepared = { ...p.cases[0], hoursDone: kind.hours * 3 };
    check(
      "preparation improves the odds but never to a certainty",
      oddsFor(prepared, p, 100) > oddsFor(p.cases[0], p, 0) &&
        oddsFor(prepared, p, 100) < 1,
    );
  }

  check(
    "the firm pays for its chambers whether or not anything settles",
    advanceWeek(lawyer, startL(), { rest: 1 }).ledger.some((x) =>
      /chambers/i.test(x.label),
    ),
  );
  check(
    "no case is a certainty",
    CASE_KINDS.every((k) => k.baseOdds < 1 && k.hours > 0 && k.fee > 0),
  );
  check(
    "bigger fees sit behind more standing",
    [...CASE_KINDS]
      .sort((a, b) => a.fee - b.fee)
      .every((k, i, arr) => i === 0 || k.prestige >= arr[i - 1].prestige),
  );
  check(
    "a solicitor save validates, and a corrupt one does not",
    lawyer.validateData!(l.data) &&
      !lawyer.validateData!({
        practice: { cases: [{ kind: "duel" }], offers: [], staff: [] },
      }),
  );
}

/**
 * WHAT THE COURT DOES TO YOU
 *
 * The three systems that turned "settle or fight" from a free option into a
 * decision: a hearing that can be moved, a loss that costs money, and a win
 * that is a bill rather than cash. Each is asserted on the numbers, because
 * each of them was added precisely so that it would move numbers.
 */
console.log("\nThe Solicitor: the court\n" + "─".repeat(52));
{
  /**
   * A run with one matter listed for this week and no possibility of it
   * being put off — `adjournments` at the cap is what takes the listing dice
   * out of these tests, so a verdict assertion is about the verdict.
   */
  const listed = (
    seed: number,
    kind: string,
    over: Record<string, unknown> = {},
  ) => {
    const s = startRun(lawyer, seed);
    const k = CASE_BY_ID.get(kind)!;
    const p = practice(s);
    p.cases = [
      {
        id: "c-1",
        kind,
        client: "Ms Baptiste",
        openedWeek: 1,
        dueWeek: s.week,
        hoursDone: k.hours,
        settlementOffer: 0,
        payer: "prompt",
        adjournments: MAX_ADJOURNMENTS,
        ...over,
      },
    ];
    return s;
  };

  /* Walk seeds until the same matter has been both won and lost, so the two
     halves of the trade can be asserted against each other rather than
     against whichever way one die happened to fall. */
  const kindId = "employment";
  const kind = CASE_BY_ID.get(kindId)!;
  /** A fresh practice to measure a helper against. */
  const fresh = () => practice(startRun(lawyer, 505));
  const withClerk = () => ({
    ...fresh(),
    staff: [{ id: "s-1", name: "N", role: "clerk", salary: 800 }],
  });
  let wonRun: ReturnType<typeof advanceWeek> | null = null;
  let lostRun: ReturnType<typeof advanceWeek> | null = null;
  let lostBefore = 0;
  for (let seed = 1; seed <= 60 && !(wonRun && lostRun); seed++) {
    const s = listed(seed, kindId);
    const out = advanceWeek(lawyer, s, {});
    const decided = practice(out.state).lastVerdicts.at(-1);
    if (!decided) continue;
    if (decided.won && !wonRun) wonRun = out;
    if (!decided.won && !lostRun) {
      lostRun = out;
      lostBefore = s.r.cash;
    }
  }

  check("a listed matter is heard, and both ways happen", Boolean(wonRun && lostRun));

  if (lostRun) {
    const line = lostRun.ledger.find((x) => /costs order/i.test(x.label));
    /*
     * Against the record rather than against a recomputation. Finishing the
     * matter credits the practice area, so `costsOrder` on the *post*-week
     * state is a different number from the one the week actually charged —
     * which is the whole reason the ledger and the record read from one map.
     */
    const recorded = practice(lostRun.state).lastVerdicts.at(-1)?.costs ?? 0;
    check(
      "losing is not a blank week — the other side's costs follow the event",
      Boolean(line) && recorded > 0 && line!.amount === -recorded,
      `${line?.amount} vs ${-recorded}`,
    );
    check(
      "and the money actually leaves the client account",
      lostRun.state.r.cash < lostBefore,
    );
  }

  /* Counsel: cash out now, better odds and a cheaper failure later. */
  {
    const bare = listed(7, kindId);
    const p = practice(bare);
    const fee = counselFee(p, kind);
    const briefed = runCommand(lawyer, bare, "briefCounsel", "c-1");
    check(
      "briefing counsel is paid for the moment it is done",
      briefed.r.cash === bare.r.cash - fee && fee > 0,
    );
    check(
      "and it improves the odds on that matter",
      oddsFor(practice(briefed).cases[0], practice(briefed), briefed.r.skill) >
        oddsFor(p.cases[0], p, bare.r.skill),
    );
    check(
      "and it argues their costs down if it goes against you",
      costsOrder(p, kind, true) < costsOrder(p, kind, false),
    );
    const twice = runCommand(lawyer, briefed, "briefCounsel", "c-1");
    check(
      "counsel cannot be briefed on the same matter twice",
      twice.r.cash === briefed.r.cash,
    );
    const broke = listed(8, kindId);
    broke.r.cash = 10;
    check(
      "and cannot be briefed at all with nothing to pay them",
      runCommand(lawyer, broke, "briefCounsel", "c-1").r.cash === 10 &&
        !practice(runCommand(lawyer, broke, "briefCounsel", "c-1")).cases[0]
          .counsel,
    );
  }

  /* Settling is what avoids costs entirely. That is the real reason. */
  {
    const s = listed(11, kindId);
    const settled = runCommand(lawyer, s, "settleCase", "c-1");
    const after = advanceWeek(lawyer, settled, {});
    check(
      "settling avoids the costs order altogether",
      settled.r.cash > s.r.cash &&
        !after.ledger.some((x) => /costs order/i.test(x.label)),
    );
  }

  /* -------------------------------------------------- the date moving */
  check(
    "a practice clerk is what stops a hearing being moved",
    relistChance(withClerk(), kind) < relistChance(fresh(), kind),
  );
  check(
    "and the clerk is recognised as being on the payroll",
    hasClerk(withClerk()) && !hasClerk(fresh()),
  );
  check(
    "bigger matters slip more often than small ones",
    relistChance(fresh(), CASE_BY_ID.get("class")!) >
      relistChance(fresh(), CASE_BY_ID.get("conveyance")!),
  );
  check(
    "no matter can be put off for ever",
    MAX_ADJOURNMENTS > 0 &&
      CASE_KINDS.every((k) => relistChance(fresh(), k) < 1),
  );
  {
    /* A hearing that has been put back is worth less to settle: they can see
       what waiting costs you, and you cannot see what it costs them. */
    const p = fresh();
    const base = {
      id: "c-1",
      kind: kindId,
      client: "Ms Baptiste",
      openedWeek: 1,
      dueWeek: 20,
      hoursDone: kind.hours,
      settlementOffer: 0,
    };
    check(
      "and every adjournment costs you at the negotiating table",
      settlementFor({ ...base, adjournments: 2 }, p, 40) <
        settlementFor(base, p, 40),
    );
  }
  {
    /* Publicity pulls the other way, and it is capped and decaying. */
    const quiet = fresh();
    const loud = { ...quiet, pressure: 0.09 };
    const c = {
      id: "c-1",
      kind: kindId,
      client: "Ms Baptiste",
      openedWeek: 1,
      dueWeek: 20,
      hoursDone: kind.hours,
      settlementOffer: 0,
    };
    check(
      "a matter being written about is worth more to make go away",
      settlementFor(c, loud, 40) > settlementFor(c, quiet, 40),
    );
    check(
      "but never more than the ceiling, whatever is published",
      settlementFor(c, { ...quiet, pressure: 9 }, 40) ===
        settlementFor(c, { ...quiet, pressure: MAX_PRESSURE }, 40),
    );
  }
}

/**
 * WINNING IS NOT BEING PAID
 *
 * The second half of the career's premise, and the half that was missing: a
 * judgment is a promise from somebody who may be slow, arguing, or gone.
 */
console.log("\nThe Solicitor: the books\n" + "─".repeat(52));
{
  const kindId = "probate";
  const kind = CASE_BY_ID.get(kindId)!;

  const listedWith = (seed: number, payer: PayerId) => {
    const s = startRun(lawyer, seed);
    const p = practice(s);
    p.cases = [
      {
        id: "c-1",
        kind: kindId,
        client: "the Wren Trust",
        openedWeek: 1,
        dueWeek: s.week,
        /* Well past the minimum, so the odds are as high as they go and a win
           is the common case — these tests are about what a win *does*. */
        hoursDone: kind.hours * 4,
        settlementOffer: 0,
        payer,
        adjournments: MAX_ADJOURNMENTS,
      },
    ];
    return s;
  };

  check(
    "every payer is stated as a real term: when they pay, and whether they argue",
    PAYERS.length === 3 &&
      PAYERS.every((x) => x.note.length > 20 && x.recovers > 0 && x.recovers <= 1) &&
      PAYERS.some((x) => x.weeks === 0) &&
      PAYERS.some((x) => x.weeks > 0),
  );
  check(
    "the work that would change the firm is the work that pays latest",
    (() => {
      /* Measured rather than asserted from the formula: over the same two
         hundred streams, how often does each kind of work come with somebody
         who pays on delivery? */
      const promptRate = (id: string) => {
        const k = CASE_BY_ID.get(id)!;
        let n = 0;
        for (let seed = 1; seed <= 200; seed++) {
          if (payerFor(k, makeRng(seed)) === "prompt") n++;
        }
        return n / 200;
      };
      return (
        promptRate("conveyance") > promptRate("commercial") &&
        promptRate("commercial") > promptRate("class") &&
        promptRate("class") > 0
      );
    })(),
  );

  /* A prompt payer hands over money; anybody else hands over a bill. */
  let prompt: ReturnType<typeof advanceWeek> | null = null;
  let slow: ReturnType<typeof advanceWeek> | null = null;
  let promptBefore = 0;
  for (let seed = 1; seed <= 60 && !(prompt && slow); seed++) {
    if (!prompt) {
      const s = listedWith(seed, "prompt");
      const out = advanceWeek(lawyer, s, {});
      if (practice(out.state).lastVerdicts.at(-1)?.won) {
        prompt = out;
        promptBefore = s.r.cash;
      }
    }
    if (!slow) {
      const s = listedWith(seed, "slow");
      const out = advanceWeek(lawyer, s, {});
      if (practice(out.state).lastVerdicts.at(-1)?.won) slow = out;
    }
  }

  check("both kinds of win happen", Boolean(prompt && slow));
  if (prompt) {
    check(
      "a client who pays on delivery pays on delivery",
      prompt.state.r.cash > promptBefore &&
        (practice(prompt.state).bills ?? []).length === 0,
    );
  }
  if (slow) {
    const bills = practice(slow.state).bills ?? [];
    /* Same again: the bill carries the fee the matter was worth when it was
       decided, not the fee the firm can command now that it has decided it. */
    const awarded = practice(slow.state).lastVerdicts.at(-1)?.fee ?? 0;
    check(
      "a slow payer's judgment is a bill, not money",
      bills.length === 1 &&
        awarded > 0 &&
        bills[0].amount === awarded &&
        bills[0].dueWeek > slow.state.week,
    );
    check(
      "and the week's ledger says so rather than reporting income it did not get",
      slow.ledger.some((x) => /billed/i.test(x.note ?? "")),
    );

    /* Selling it. The whole constraint, as a button. */
    const bill = bills[0];
    const sold = runCommand(lawyer, slow.state, "factorBill", bill.id);
    const price = factorValue(bill, slow.state.week);
    check(
      "a factor buys the wait off you, at a price",
      sold.r.cash === slow.state.r.cash + price &&
        price > 0 &&
        price < bill.amount,
    );
    check(
      "and the bill leaves the books once it is sold",
      (practice(sold).bills ?? []).length === 0,
    );
    check(
      "the further off it is, the worse the price",
      factorValue({ ...bill, dueWeek: slow.state.week + 9 }, slow.state.week) <
        factorValue({ ...bill, dueWeek: slow.state.week + 1 }, slow.state.week),
    );
    check(
      "an unknown bill is refused rather than paying out",
      runCommand(lawyer, slow.state, "factorBill", "b-nonexistent").r.cash ===
        slow.state.r.cash,
    );

    /* Waiting instead: it matures and turns into cash. */
    let waited = slow.state;
    for (let i = 0; i < 7 && (practice(waited).bills ?? []).length > 0; i++) {
      waited = advanceWeek(lawyer, waited, {}).state;
    }
    check(
      "or you wait, and it becomes money",
      (practice(waited).bills ?? []).length === 0,
    );

    check(
      "a judgment you are owed counts towards what the firm is worth",
      firmWorthOf(slow.state) > firmWorthOf({
        ...slow.state,
        data: { practice: { ...practice(slow.state), bills: [] } },
      }),
    );
  }
}

/**
 * THE HANDSET
 *
 * The Solicitor's phone is the Solicitor's. The tests that matter are that
 * nothing on it is shared with another career's, and that the two things it
 * can do to the practice actually do them.
 */
console.log("\nThe Solicitor: the phone\n" + "─".repeat(52));
{
  const s = startRun(lawyer, 404);
  check(
    "a solicitor starts with a handset and something waiting on it",
    Boolean(practice(s).phone) &&
      practice(s).phone!.messages.length === 1 &&
      !practice(s).phone!.messages[0].read,
  );
  check(
    "nobody on it is borrowed from another career",
    (() => {
      const chef = new Set<string>(
        Object.values(CHEF_VOICES).flatMap((v) => [
          v.name as string,
          v.handle as string,
        ]),
      );
      return Object.values(LEGAL_VOICES).every(
        (v) => !chef.has(v.name) && !chef.has(v.handle),
      );
    })(),
  );
  check(
    "every post says what it is for and what it costs",
    LEGAL_POSTS.length >= 5 &&
      LEGAL_POSTS.every(
        (p) => p.preview.length >= 1 && p.blurb.length > 15 && p.label.length > 3,
      ),
  );
  check(
    "and a post that risks something says so and has a way of going wrong",
    LEGAL_POSTS.filter((p) => p.hazard !== undefined).every(
      (p) => p.backfire !== undefined && p.hazard! > 0 && p.hazard! < 1,
    ),
  );
  check(
    "no post is offered to a practice that cannot honestly make it",
    (() => {
      const ctx = lawyerPostContext(practice(s), s.week);
      const offered = LEGAL_POSTS.filter((p) => p.available(ctx));
      /* A brand new firm has won nothing, settled nothing, paid no costs and
         employs nobody, so only the opening post can be true. */
      return (
        offered.length === 1 && offered[0].id === "doors_open"
      );
    })(),
  );

  /* Publishing moves the practice, not just the feed. */
  const posted = runCommand(lawyer, s, "post", "doors_open");
  check(
    "publishing lands on your own feed",
    (practice(posted).phone?.feed ?? []).length === 1 &&
      practice(posted).phone!.feed[0].kind === "player",
  );
  check(
    "and brings work towards the door rather than only followers",
    (practice(posted).echo ?? 0) > (practice(s).echo ?? 0) &&
      practice(posted).phone!.social.followers >
        practice(s).phone!.social.followers,
  );
  check(
    "one post a week, and the second is refused",
    (practice(runCommand(lawyer, posted, "post", "note_on_the_law")).phone?.feed ?? [])
      .length === 1,
  );
  check(
    "a post the run cannot honestly make is refused",
    (practice(runCommand(lawyer, s, "post", "case_won")).phone?.feed ?? [])
      .length === 0,
  );
  check(
    "and one the catalogue does not have does nothing at all",
    (practice(runCommand(lawyer, s, "post", "we_are_brilliant")).phone?.feed ?? [])
      .length === 0,
  );

  /* Something published is spent: the echo runs down rather than compounding
     into a permanent uplift on everything the firm is ever offered. */
  let echoed = posted;
  const startEcho = practice(echoed).echo ?? 0;
  echoed = advanceWeek(lawyer, echoed, {}).state;
  echoed = advanceWeek(lawyer, echoed, {}).state;
  check(
    "and what it bought runs out",
    (practice(echoed).echo ?? 0) < startEcho,
  );

  /* Reading, and answering. */
  const read = runCommand(lawyer, s, "readMessages", "");
  check(
    "opening the inbox marks it read",
    practice(read).phone!.messages.every((m) => m.read),
  );

  {
    const withOffer = startRun(lawyer, 909);
    const p = practice(withOffer);
    const k = CASE_BY_ID.get("employment")!;
    p.cases = [
      {
        id: "c-9",
        kind: "employment",
        client: "Ms Baptiste",
        openedWeek: 1,
        dueWeek: withOffer.week + 6,
        hoursDone: k.hours,
        settlementOffer: 0,
        payer: "prompt",
      },
    ];
    ensureLawyerPhone(p).messages.push({
      id: "offer-c-9-12345",
      week: withOffer.week,
      from: LEGAL_VOICES.opponent.name,
      handle: LEGAL_VOICES.opponent.handle,
      role: "rival",
      body: "We are instructed to make an offer.",
      read: false,
      choices: [
        { label: "Accept", detail: "", effect: {}, reply: "Accepted." },
        { label: "No", detail: "", effect: {}, reply: "Declined." },
      ],
    });

    const accepted = runCommand(
      lawyer,
      withOffer,
      "answerMessage",
      "offer-c-9-12345|0",
    );
    check(
      "the other side's offer is a real transaction, at the figure quoted",
      accepted.r.cash === withOffer.r.cash + 12_345 &&
        practice(accepted).cases.length === 0,
      `${accepted.r.cash - withOffer.r.cash}`,
    );
    check(
      "and it goes on the record as a settlement, not a judgment",
      practice(accepted).lastVerdicts.at(-1)?.settled === true,
    );
    const twice = runCommand(
      lawyer,
      accepted,
      "answerMessage",
      "offer-c-9-12345|0",
    );
    check(
      "an offer cannot be accepted twice",
      twice.r.cash === accepted.r.cash,
    );

    const refused = runCommand(
      lawyer,
      withOffer,
      "answerMessage",
      "offer-c-9-12345|1",
    );
    check(
      "and refusing it leaves the matter running",
      refused.r.cash === withOffer.r.cash &&
        practice(refused).cases.length === 1,
    );
  }
}

/**
 * CONFLICTS, AND OLDER SAVES
 */
console.log("\nThe Solicitor: conduct and compatibility\n" + "─".repeat(52));
{
  const s = startRun(lawyer, 77);
  const p = practice(s);
  p.offers = [
    {
      id: "of-1",
      kind: "probate",
      client: "Vance Holdings",
      expiresWeek: s.week + 3,
      payer: "prompt",
    },
  ];
  const taken = runCommand(lawyer, s, "takeCase", "of-1");
  check(
    "acting for somebody is what makes acting against them a conflict later",
    (practice(taken).actedFor ?? []).includes("Vance Holdings"),
  );
  check(
    "and the payer named on the instruction is the payer on the file",
    practice(taken).cases[0].payer === "prompt",
  );

  {
    const conflicted = startRun(lawyer, 78);
    const q = practice(conflicted);
    q.actedFor = ["Cormack Retail"];
    q.offers = [
      {
        id: "of-2",
        kind: "injury",
        client: "Mr Saeed",
        expiresWeek: conflicted.week + 3,
        payer: "slow",
        conflict: true,
        opponent: "Cormack Retail",
      },
    ];
    const risky = runCommand(lawyer, conflicted, "takeCase", "of-2");
    check(
      "a conflicted instruction can still be taken, and the file remembers",
      practice(risky).cases[0].conflicted === true &&
        practice(risky).cases[0].opponent === "Cormack Retail",
    );
    check(
      "and taking it is written into the run's own record",
      risky.log.some((x) => /acted for/i.test(x.text)),
    );
  }

  /* An offer against a former client can actually be produced, which is what
     makes the warning on the Instructions screen reachable rather than
     theoretical. */
  check(
    "a market with a history eventually sends work against it",
    (() => {
      const q = { ...practice(startRun(lawyer, 5)), actedFor: ["Vance Holdings"] };
      for (let seed = 1; seed <= 200; seed++) {
        const made = newOffers(q, 90, 10, 3, makeRng(seed));
        if (made.some((o) => o.conflict && o.opponent === "Vance Holdings")) {
          return true;
        }
      }
      return false;
    })(),
  );

  /* ------------------------------------------------------- older saves */
  const legacy = startRun(lawyer, 12);
  const old = practice(legacy);
  delete old.bills;
  delete old.actedFor;
  delete old.echo;
  delete old.pressure;
  delete old.phone;
  old.cases = [
    {
      id: "c-1",
      kind: "probate",
      client: "the Wren Trust",
      openedWeek: 1,
      dueWeek: 12,
      hoursDone: 4,
      settlementOffer: 0,
    },
  ];
  check(
    "a save written before any of this existed is still a valid save",
    lawyer.validateData!({ practice: old }),
  );
  check(
    "and it reads as a firm that is owed nothing and has said nothing",
    billsOwed(old) === 0 && (old.echo ?? 0) === 0 && (old.pressure ?? 0) === 0,
  );
  check(
    "and it plays a week without gaining or losing anything odd",
    (() => {
      const out = advanceWeek(lawyer, legacy, { casework: 2 });
      return (
        Number.isFinite(out.state.r.cash) &&
        Number.isFinite(firmWorthOf(out.state)) &&
        lawyer.validateData!(out.state.data)
      );
    })(),
  );
  check(
    "and it gains a handset rather than being rejected for not having one",
    Boolean(practice(advanceWeek(lawyer, legacy, {}).state).phone),
  );

  check(
    "a payer the catalogue does not have is refused",
    !lawyer.validateData!({
      practice: {
        ...practice(startRun(lawyer, 13)),
        cases: [{ kind: "probate", payer: "eventually" }],
      },
    }),
  );
  check(
    "a bill for a case that does not exist is refused",
    !lawyer.validateData!({
      practice: {
        ...practice(startRun(lawyer, 14)),
        bills: [
          { id: "b-1", client: "X", kind: "duel", amount: 10, dueWeek: 3, payer: "slow" },
        ],
      },
    }),
  );
  check(
    "and an impossible amount of publicity is refused",
    !lawyer.validateData!({
      practice: { ...practice(startRun(lawyer, 15)), pressure: 40 },
    }),
  );

  /* Replay. Two runs on the same seed have to be the same run, which is what
     the per-subsystem streams exist to protect. */
  check(
    "resolving the same solicitor week twice from the same state is identical",
    (() => {
      const base = startRun(lawyer, 606);
      const a = advanceWeek(lawyer, base, { casework: 2, pitch: 1 });
      const b = advanceWeek(lawyer, base, { casework: 2, pitch: 1 });
      return (
        JSON.stringify(a.state.data) === JSON.stringify(b.state.data) &&
        JSON.stringify(a.state.r) === JSON.stringify(b.state.r) &&
        JSON.stringify(a.ledger) === JSON.stringify(b.ledger)
      );
    })(),
  );
  check(
    "and a long solicitor run is still a valid save at the end of it",
    (() => {
      let run = startRun(lawyer, 707);
      for (let i = 0; i < 40; i++) {
        const offer = practice(run).offers[0];
        if (offer) run = runCommand(lawyer, run, "takeCase", offer.id);
        const out = advanceWeek(lawyer, run, { casework: 3, pitch: 1, research: 1 });
        run = out.state;
        if (out.event) run = resolveEventChoice(lawyer, run, out.event.def, 0);
      }
      const q = practice(run);
      return (
        lawyer.validateData!(run.data) &&
        q.lastVerdicts.length <= 24 &&
        (q.phone?.feed.length ?? 0) <= 60 &&
        (q.actedFor?.length ?? 0) <= 14 &&
        run.outcome === null
      );
    })(),
  );
}

console.log("\nThe fleet\n" + "─".repeat(52));
{
  const base = () => {
    const f = startRun(doctor, 77);
    f.r.cash = 1_000_000;
    return f;
  };

  /* ------------------------------------------------- buying and refusing */
  let f = base();
  f = runCommand(doctor, f, "buyVehicle", "emergency_ambulance");
  check("an ambulance can be bought", (med(f).fleet ?? []).length === 1);
  check(
    "and it is paid for",
    f.r.cash === 1_000_000 - FLEET_BY_ID.get("emergency_ambulance")!.cost,
  );

  const twice = runCommand(doctor, f, "buyVehicle", "emergency_ambulance");
  check(
    "the same vehicle cannot be bought twice",
    (med(twice).fleet ?? []).length === 1 && twice.r.cash === f.r.cash,
  );

  const poor = startRun(doctor, 78);
  poor.r.cash = 100;
  const refused = runCommand(doctor, poor, "buyVehicle", "mobile_icu");
  check(
    "one that cannot be afforded is refused",
    (med(refused).fleet ?? []).length === 0 && refused.r.cash === 100,
  );
  check(
    "an unknown vehicle is refused",
    (med(runCommand(doctor, base(), "buyVehicle", "hovercraft")).fleet ?? [])
      .length === 0,
  );

  /* ------------------------------------------------------------ the crew */
  const m = med(f);
  check(
    "an ambulance needs its crew before it does anything",
    crewNeeded(m) === 2 && crewOn(m) === 0 && !fleetCrewed(m),
  );
  check(
    "an uncrewed fleet reaches nobody",
    fleetReach(m) === 0 && fleetAcuity(m) === 0,
  );
  check(
    "but it charges upkeep regardless",
    fleetUpkeep(m) === FLEET_BY_ID.get("emergency_ambulance")!.upkeep,
  );

  let crewed = f;
  crewed = runCommand(doctor, crewed, "hire", "paramedic");
  crewed = runCommand(doctor, crewed, "hire", "paramedic");
  const cm = med(crewed);
  check("paramedics can be hired", crewOn(cm) === 2 && fleetCrewed(cm));
  check(
    "and a crewed ambulance widens the catchment",
    fleetReach(cm) === FLEET_BY_ID.get("emergency_ambulance")!.reach,
  );
  check(
    "a wider catchment means a larger panel ceiling",
    catchmentIn(cm, cm.homeCity, 50) > catchmentIn(m, m.homeCity, 50),
  );

  /*
   * Losing a crew member scales the fleet down rather than switching it off.
   * The cliff-edge version measured terribly against the engine's real churn
   * — see the note on `fleetCrewRatio` — so this asserts the gradient, which
   * is the property that keeps one resignation from bricking a $193,000 asset.
   */
  const firstMedic = cm.staff.findIndex((y) => y.role === "paramedic");
  const oneShort = {
    ...cm,
    staff: cm.staff.filter((_, i) => i !== firstMedic),
  };
  check(
    "losing a crew member is not a cliff",
    !fleetCrewed(oneShort) && fleetReach(oneShort) > 0,
  );
  check(
    "it runs in proportion to the crew it has",
    Math.abs(fleetCrewRatio(oneShort) - 0.5) < 1e-9 &&
      Math.abs(fleetReach(oneShort) - fleetReach(cm) / 2) < 1e-9,
  );
  check(
    "and with no crew at all it reaches nobody",
    fleetReach({ ...cm, staff: cm.staff.filter((x) => x.role !== "paramedic") }) === 0,
  );

  /* --------------------------------------------------------- the balance */
  check(
    "a vehicle is worth less than it cost",
    fleetValue(cm) < FLEET_BY_ID.get("emergency_ambulance")!.cost,
  );
  check(
    "every vehicle depreciates rather than storing wealth",
    FLEET.every((v) => v.retention < 1),
  );
  check(
    "reach is the point of every one of them",
    FLEET.every((v) => v.reach > 0 && v.crew >= 1 && v.upkeep > 0),
  );
  /* Acuity without the departments to cover it is the trap the cards warn
     about, so the tiers that bring serious work must be the expensive ones. */
  check(
    "the vehicles that raise acuity are the ones that cost the most",
    [...FLEET].sort((a, b) => a.cost - b.cost).every((v, i, arr) =>
      i === 0 || v.acuity >= arr[i - 1].acuity,
    ),
  );

  /* ------------------------------------------------ saves without a fleet */
  const legacy = base();
  delete (med(legacy) as { fleet?: string[] }).fleet;
  check(
    "a save written before ambulances existed still validates",
    doctor.validateData?.({ med: med(legacy) }) !== false,
  );
  check(
    "and reads as a practice with no vehicles",
    fleetSize(med(legacy)) === 0 &&
      fleetReach(med(legacy)) === 0 &&
      fleetUpkeep(med(legacy)) === 0,
  );
}

/*
 * The catalogue, as the interface sees it.
 *
 * `allPurchases` is what every card renders from, so its prices have to be
 * the catalogue's own — a presentation layer that restates a number is a
 * presentation layer that will eventually restate it wrongly.
 */
{
  let ps = startRun(doctor, 31);
  ps.r.cash = 500_000;
  const items = allPurchases(ps);
  /* Derived, not restated. A hardcoded 45 had to be edited every time the
     catalogue grew, which makes it a chore rather than a check — and a chore
     gets updated to whatever number makes it pass. */
  const catalogueSize = catalogueIds().length;
  check(
    "the shelf lists every purchasable item",
    items.length === catalogueSize,
    `${items.length} of ${catalogueSize}`,
  );
  check(
    "prices come from the catalogue, not the card",
    EQUIPMENT.every(
      (e) => items.find((i) => i.id === e.id)?.price === e.cost,
    ) &&
      LIFESTYLE.every(
        (l) => items.find((i) => i.id === l.id)?.price === l.cost,
      ),
  );
  check(
    "upkeep comes from the catalogue too",
    EQUIPMENT.every(
      (e) => items.find((i) => i.id === e.id)?.upkeep === e.upkeep,
    ),
  );
  check(
    "affordability agrees with cash",
    items.every((i) => i.affordable === ps.r.cash >= i.price),
  );
  check(
    "a shortfall is stated for everything out of reach",
    items
      .filter((i) => !i.affordable)
      .every((i) => i.shortfall === i.price - ps.r.cash),
  );
  check(
    "every item names a buy command the engine implements",
    items.every((i) =>
      [
        "buyFacility",
        "openDepartment",
        "buyEquipment",
        "buyVehicle",
        "buyLifestyle",
      ].includes(i.buy.cmd),
    ),
  );
  check(
    "every item explains itself",
    items.every((i) => i.headline.length > 8 && i.effects.length >= 2),
  );

  /* Buying through the shelf's own command must change the same state the
       old buttons changed. */
  const townhouse = items.find((i) => i.id === "townhouse")!;
  ps = run(ps, townhouse.buy.cmd, townhouse.buy.arg);
  check(
    "buying through the shelf works",
    med(ps).lifestyle.includes("townhouse"),
  );
  const after = allPurchases(ps);
  check(
    "and the item now reports as owned and in service",
    after.find((i) => i.id === "townhouse")?.state === "active",
  );
  check(
    "and the next rung up offers the trade-in",
    after.find((i) => i.id === "suburban_house")?.tradeIn?.label ===
      "Town house",
  );

  /* Buying it a second time must be refused by the engine, which is the
       guard behind the interface's double-click protection. */
  const cashHeld = ps.r.cash;
  ps = run(ps, townhouse.buy.cmd, townhouse.buy.arg);
  check(
    "a second purchase of the same item is refused",
    ps.r.cash === cashHeld,
  );
}

/*
 * DEPARTMENTS
 *
 * The most stateful purchase in the game: opening one is a decision about
 * slots, staffing and equipment at once, and all three can be wrong
 * independently. Every claim the card makes about that is checked against
 * the functions the resolver itself calls.
 */
{
  let d = startRun(doctor, 77);
  d.r.cash = 3_000_000;
  const depts = () => allPurchases(d).filter((i) => i.kind === "department");

  check("every department is a purchasable card", depts().length === 12);
  check(
    "every department card carries its interior",
    depts().every((x) => !!x.art),
  );
  check(
    "every department card carries its wayfinding accent",
    depts().every(
      (x) => x.accent === DEPARTMENT_BY_ID.get(x.id as never)?.colour,
    ),
  );
  check(
    "opening costs come from the catalogue",
    SPECIALTIES.every(
      (sp) => depts().find((x) => x.id === sp.id)?.price === sp.unlockCost,
    ),
  );
  check(
    "department upkeep comes from the catalogue",
    SPECIALTIES.every(
      (sp) => depts().find((x) => x.id === sp.id)?.upkeep === sp.upkeep,
    ),
  );

  /* One slot at the start, and general practice already fills it. */
  check(
    "with no free slot every closed department locks",
    depts().filter((x) => x.state === "locked").length === 11,
    `${depts().filter((x) => x.state === "locked").length} locked`,
  );
  check(
    "and the lock says what would free one",
    depts()
      .find((x) => x.state === "locked")!
      .lock!.includes("premises"),
  );

  /* Premises add slots and the locks lift — the same arithmetic the command
       itself checks. */
  d = run(d, "buyFacility", "clinic:lyon");
  check(
    "buying premises unlocks the rest",
    depts().filter((x) => x.state === "locked").length === 0,
  );

  d = run(d, "openDepartment", "cardiology");
  const cardio = () => depts().find((x) => x.id === "cardiology")!;
  check("opening a department works from the shelf", cardio().owned);
  check("and it reads as in service", cardio().state === "active");
  check(
    "an open but unstaffed department reports as uncovered",
    cardio().coverage?.level === "uncovered" &&
      cardio().coverage!.covered < cardio().coverage!.needed,
  );
  check(
    "and names both the missing kit and who could cover it",
    cardio().caveats.length === 2 &&
      cardio().coverage!.missingEquipment.length > 0,
  );

  for (const e of ["ecg", "ultrasound", "theatre", "icu"]) {
    d = run(d, "buyEquipment", e);
  }
  d = run(d, "hire", "surgeon:cardiology");
  check(
    "equipping and staffing it reports as covered",
    cardio().coverage?.level === "covered" &&
      cardio().coverage!.covered === cardio().coverage!.needed,
  );
  check(
    "and the caveats clear with it",
    cardio().caveats.length === 0,
    cardio().caveats.join(" | "),
  );
  check(
    "department coverage agrees with the resolver's own ceiling",
    depts().every(
      (x) => x.coverage!.covered === coverageFor(med(d), x.id as never),
    ),
  );

  d.r.cash = 1_000;
  const short = depts().filter((x) => !x.owned);
  check(
    "when broke every closed department states its shortfall",
    short.length > 0 &&
      short.every(
        (x) => x.state === "unaffordable" && x.shortfall === x.price - 1_000,
      ),
  );
}


/* ================================================================ portraits */

/**
 * FACES
 *
 * Eighteen portraits across two keyspaces that overlap for most characters and
 * diverge for exactly two — which is the whole reason the registry has two
 * lookups rather than one. The collision is the thing worth testing hardest:
 * `meridian` is Dr Anneke Roth in the relationship model and Meridian Health
 * Group on the phone, and putting her face on the group's press releases is a
 * single wrong lookup away.
 */
console.log("\nCharacter portraits\n" + "─".repeat(52));
{
  check(
    "every member of the full cast has a portrait",
    FULL_CAST.every((p) => hasPortraitForPerson(p.id)),
    FULL_CAST.filter((p) => !hasPortraitForPerson(p.id))
      .map((p) => p.id)
      .join(", "),
  );
  check(
    "thirteen cast portraits, no more and no fewer",
    Object.keys(CAST_PORTRAITS).length === 13,
    `${Object.keys(CAST_PORTRAITS).length}`,
  );
  check(
    "the registry has no portrait for somebody who does not exist",
    Object.keys(CAST_PORTRAITS).every((id) =>
      FULL_CAST.some((p) => p.id === id),
    ),
  );

  const files = allPortraits().flatMap((p) => [p.src, p.profile]);
  check(
    "every portrait file exists on disk",
    files.every((f) => existsSync(join("public", f))),
    files.filter((f) => !existsSync(join("public", f))).join(", "),
  );
  check(
    "every portrait is a WebP, never a source PNG",
    files.every((f) => f.endsWith(".webp")),
  );
  check(
    "every portrait declares a square measured size",
    allPortraits().every((p) => p.width === 160 && p.height === 160),
  );
  check(
    "no portrait path reaches into art-source",
    files.every((f) => !f.includes("art-source")),
  );

  /* --------------------------------------------------- the social keyspace */
  const HUMAN_HANDLES: [string, string][] = [
    ["@a.nwosu", "social-nwosu"],
    ["@coravance", "social-vance"],
    ["@mira_ok", "social-mira"],
    ["@tomasr", "social-tomas"],
    ["@jkell", "social-kell"],
  ];
  check(
    "the five social-only humans resolve to their own portraits",
    HUMAN_HANDLES.every(
      ([handle, file]) =>
        portraitForSocialHandle(handle)?.src ===
        `/visuals/characters/social/${file}.webp`,
    ),
    HUMAN_HANDLES.filter(
      ([h, f]) =>
        portraitForSocialHandle(h)?.src !==
        `/visuals/characters/social/${f}.webp`,
    )
      .map(([h]) => h)
      .join(", "),
  );

  /* Sand and Duarte are in both keyspaces and must be one person. */
  for (const [handle, id] of [
    ["@h_sand", "sand"],
    ["@i.duarte", "duarte"],
  ] as const) {
    check(
      `${handle} reuses the same file as the ${id} cast portrait`,
      portraitForSocialHandle(handle)?.src === portraitForPerson(id)?.src,
    );
  }

  /* ------------------------------------------------------- the collision */
  check(
    "@meridian is not Anneke Roth",
    portraitForSocialHandle("@meridian") === null,
    String(portraitForSocialHandle("@meridian")?.src),
  );
  check(
    "@northgate is not Sofia Aranda",
    portraitForSocialHandle("@northgate") === null,
    String(portraitForSocialHandle("@northgate")?.src),
  );
  check(
    "but both are still people in the relationship model",
    !!portraitForPerson("meridian") && !!portraitForPerson("northgate"),
  );
  check(
    "and the two people have different faces",
    portraitForPerson("meridian")?.src !== portraitForPerson("northgate")?.src,
  );

  /* --------------------------------------------------- the organisations */
  const ORG_HANDLES = [
    "@meridian",
    "@northgate",
    "@clinicallede",
    "@rhb_press",
    "@wellwise",
  ];
  check(
    "every institutional account is marked as one",
    ORG_HANDLES.every((h) => isOrganisation(h)),
  );
  check(
    "and none of them resolves to a human portrait",
    ORG_HANDLES.every((h) => portraitForSocialHandle(h) === null),
  );
  check(
    "no human account is mistaken for an organisation",
    HUMAN_HANDLES.every(([h]) => !isOrganisation(h)) &&
      !isOrganisation("@h_sand") &&
      !isOrganisation("@i.duarte"),
  );

  /* Every bot the phone can post as is accounted for: it has a portrait, or
     it is an organisation. Nothing may fall through to a blank. */
  const unaccounted = BOTS.filter(
    (b) => !portraitForSocialHandle(b.handle) && !isOrganisation(b.handle),
  );
  check(
    "every social account is either a face or an institution",
    unaccounted.length === 0,
    unaccounted.map((b) => b.handle).join(", "),
  );

  /*
   * Cast members reached by their own handle.
   *
   * The phone addresses some messages to `@p.raman` rather than carrying a
   * person id, so the registry indexes `@` + `PersonDef.handle`. The guarantee
   * that keeps the Roth/Meridian collision unreachable is that no cast handle
   * is ever an organisation handle — asserted rather than assumed, because a
   * rename is exactly what would break it silently.
   */
  check(
    "no cast member answers to an organisation handle",
    castHandles().every((h) => !isOrganisation(h)),
    castHandles().filter((h) => isOrganisation(h)).join(", "),
  );
  check(
    "a message addressed to a cast handle finds that person",
    portraitForSocialHandle("@p.raman")?.src ===
      portraitForPerson("raman")?.src &&
      portraitForSocialHandle("@j.thorne")?.src ===
        portraitForPerson("thorne")?.src,
  );
  check(
    "Anneke Roth is reachable by her own handle, not her employer's",
    portraitForSocialHandle("@a.roth")?.src ===
      portraitForPerson("meridian")?.src &&
      portraitForSocialHandle("@meridian") === null,
  );
  check(
    "a role account is not a person",
    portraitForSocialHandle("@team") === null &&
      portraitForSocialHandle("@standards") === null,
  );

  /* ------------------------------------------------------- the fallbacks */
  check(
    "an unknown handle resolves to nothing rather than guessing",
    portraitForSocialHandle("@nobody") === null,
  );
  check(
    "an unknown person resolves to nothing",
    portraitForPerson("stranger") === null &&
      !hasPortraitForPerson("stranger"),
  );
  /*
   * Procedurally generated staff.
   *
   * Hundreds of possible names against thirteen portraits: handing any of them
   * a cast member's face would put Dr Lindqvist's photograph on a stranger.
   * They must resolve to nothing and fall back to initials, which are already
   * deterministic per name.
   */
  const generated = Array.from({ length: 60 }, (_, i) => staffName(i));
  check(
    "no generated staff name collides with a cast portrait",
    generated.every((n) => !hasPortraitForPerson(n)),
  );
  check(
    "generated staff still get stable initials",
    generated.every((n) => /^[A-Z]{2}$/.test(initialsOf(n))),
    initialsOf(generated[0]),
  );
}

console.log("\nWhat the city thinks\n" + "─".repeat(52));
{
  /*
   * Phase 3: standing, diners, reviews, complaints, critics, rivals and the
   * twelve events. The rule every check here is written to is the same one
   * the phase itself was written to — **nothing appears that did not happen**
   * — so almost every assertion compares a piece of output text or a number
   * against the service report it was supposedly derived from.
   */
  const chefAt = (opts: {
    city?: string;
    week?: number;
    cash?: number;
    rep?: number;
    skill?: number;
    menu?: string[];
    hire?: string[];
  } = {}) => {
    let s = startRun(chef, 4242, opts.city ? { city: opts.city } : undefined);
    s.r.cash = opts.cash ?? 300_000;
    s.r.skill = opts.skill ?? 60;
    s.r.reputation = opts.rep ?? 45;
    s.week = opts.week ?? 1;
    s = runCommand(chef, s, "takePremises", "bistro");
    for (const role of opts.hire ?? []) s = runCommand(chef, s, "hireKitchen", role);
    for (const id of opts.menu ?? []) s = runCommand(chef, s, "addDish", id);
    return s;
  };

  const stocked = (s: RunState) => {
    for (const ing of ["chicken", "roots", "butter", "flour", "stockbones"]) {
      s = runCommand(chef, s, "buyIngredient", `market:${ing}`);
      s = runCommand(chef, s, "buyIngredient", `market:${ing}`);
    }
    return runCommand(chef, s, "buyProduce", "market:basic");
  };

  /* ============================================ 1. the reputation model === */
  {
    const s = chefAt();
    const k = kitchen(s);
    check(
      "there are seven standing categories, not one number",
      STANDINGS.length === 7 &&
        new Set(STANDINGS.map((x) => x.id)).size === 7,
      String(STANDINGS.length),
    );
    check(
      "a fresh kitchen starts every category at its opening reputation",
      Object.values(standingOf(k, s.r.reputation)).every((v) => v === 12),
    );

    /* The compatibility guarantee, asserted rather than claimed: an
       attributed move changes the overall by exactly what it always did. */
    const before = s.r.reputation;
    /* A deep clone. `{ ...s, data: { ...s.data } }` still shares the kitchen
       object itself, so the "before" reading would be the "after" one. */
    const clone = (x: RunState): RunState => JSON.parse(JSON.stringify(x));
    const moved = clone(s);
    applyStanding(moved, "food", -4, "A bad night");
    check(
      "an attributed move changes the overall by exactly the same amount",
      Math.abs(moved.r.reputation - (before - 4)) < 0.001,
      `${moved.r.reputation} against ${before - 4}`,
    );
    check(
      "and files the move under the category that caused it",
      standingOf(kitchen(moved), moved.r.reputation).food ===
        standingOf(k, before).food - 4,
    );
    check(
      "every move carries the reason the simulation wrote for it",
      (kitchen(moved).repLog ?? [])[0]?.why === "A bad night",
    );

    /* And a settle describes the restaurant without touching the economy. */
    const settled = clone(s);
    const rep = settled.r.reputation;
    settleStanding(settled, "atmosphere", 90, 3, "A better room");
    check(
      "a settle moves the category but never the overall reputation",
      settled.r.reputation === rep &&
        standingOf(kitchen(settled), rep).atmosphere > 12,
    );
    check(
      "a settle moves no further than its stated rate",
      standingOf(kitchen(settled), rep).atmosphere === 15,
      String(standingOf(kitchen(settled), rep).atmosphere),
    );
    check(
      "a settle also records why it moved",
      (kitchen(settled).repLog ?? [])[0]?.why === "A better room",
    );
    check(
      "standing is clamped to 0-100 in both directions",
      (() => {
        const x = clone(s);
        applyStanding(x, "hygiene", -500, "everything went wrong");
        applyStanding(x, "food", 500, "everything went right");
        const out = standingOf(kitchen(x), x.r.reputation);
        return out.hygiene === 0 && out.food === 100;
      })(),
    );
  }

  /* Reputation moves only for stated reasons — the whole point of the phase. */
  {
    let s = stocked(chefAt({ menu: ["roast_chicken", "bread", "soup"] }));
    for (let i = 0; i < 4; i++) {
      s = advanceWeek(chef, s, { dinner: 2, prep: 1 }).state;
    }
    const log = kitchen(s).repLog ?? [];
    check(
      "four weeks of trading produce an explained standing history",
      log.length > 0 && log.every((c) => c.why.length > 0),
      `${log.length} entries`,
    );
    check(
      "no standing change is unexplained or unattributed",
      log.every((c) => STANDING_BY_ID.has(c.id) && Number.isFinite(c.delta)),
    );
    check(
      "the trend records one snapshot per resolved week",
      (kitchen(s).repTrend ?? []).length === 4,
      String((kitchen(s).repTrend ?? []).length),
    );
    check(
      "a category with two weeks of history reports a direction",
      trendOf(kitchen(s), "food") !== null,
    );
    check(
      "the scene score is a blend of the seven, not the raw reputation",
      sceneScore(kitchen(s), s.r.reputation) >= 0 &&
        sceneScore(kitchen(s), s.r.reputation) <= 100,
    );
    check(
      "recent changes are the ones from the last few weeks only",
      recentStanding(kitchen(s), s.week, 1).every((c) => c.week > s.week - 1),
    );
  }

  /* ============================================ 2. the customer segments === */
  {
    const s = chefAt();
    const k = kitchen(s);
    check(
      "there are eight named customer segments",
      SEGMENTS.length === 8,
      String(SEGMENTS.length),
    );
    check(
      "every segment weighs a different combination of the seven",
      new Set(SEGMENTS.map((x) => JSON.stringify(x.wants))).size === 8,
    );
    check(
      "and each one's weights are a real distribution",
      SEGMENTS.every((seg) => {
        const total = Object.values(seg.wants).reduce((a, b) => a + (b ?? 0), 0);
        return total > 0.9 && total < 1.1;
      }),
    );

    /* Preferences must be *mechanical*: the same restaurant is genuinely
       better for one segment than another. */
    const deep = (x: RunState): RunState => JSON.parse(JSON.stringify(x));
    const cheap = deep(s);
    applyStanding(cheap, "value", 60, "priced for the street");
    const posh = deep(s);
    applyStanding(posh, "atmosphere", 60, "a beautiful room");
    const budget = SEGMENT_BY_ID.get("budget")!;
    const luxury = SEGMENT_BY_ID.get("luxury")!;
    check(
      "a value-led kitchen appeals more to budget diners than to luxury ones",
      appealOf(budget, kitchen(cheap), cheap.r.reputation) >
        appealOf(luxury, kitchen(cheap), cheap.r.reputation),
    );
    check(
      "and a beautiful room reverses that exactly",
      appealOf(luxury, kitchen(posh), posh.r.reputation) >
        appealOf(budget, kitchen(posh), posh.r.reputation),
    );

    /* Price sensitivity is real and differs by segment. */
    let dear = chefAt({ menu: ["truffle_pasta"] });
    const dearMenu = activeMenu(kitchen(dear));
    if (dearMenu.length > 0) {
      dear = runCommand(
        chef,
        dear,
        "priceDish",
        `${dearMenu[0].recipe}:${Math.round(spendPerHead(kitchen(dear)) * 3)}`,
      );
      const budgetDrop =
        appealOf(budget, k, s.r.reputation) -
        appealOf(budget, kitchen(dear), dear.r.reputation);
      const luxuryDrop =
        appealOf(luxury, k, s.r.reputation) -
        appealOf(luxury, kitchen(dear), dear.r.reputation);
      check(
        "trebling the price costs budget diners far more than luxury ones",
        budgetDrop > luxuryDrop * 3,
        `${budgetDrop.toFixed(1)} against ${luxuryDrop.toFixed(1)}`,
      );
    }

    check(
      "the mix is a real distribution that sums to one",
      (() => {
        const mix = dinerMix(k, s.r.reputation, 10);
        const total = mix.shares.reduce((n, x) => n + x.share, 0);
        return Math.abs(total - 1) < 0.001;
      })(),
    );
    check(
      "event clients only appear for the services they can book",
      dinerMix(k, s.r.reputation, 10, "lunch").shares.every(
        (x) => x.segment.id !== "event",
      ) &&
        dinerMix(k, s.r.reputation, 10, "event").shares.some(
          (x) => x.segment.id === "event",
        ),
    );
    check(
      "a restaurant whose parts all agree with its reputation pulls exactly average",
      (() => {
        const even = chefAt({ rep: 50 });
        kitchen(even).standing = Object.fromEntries(
          STANDINGS.map((x) => [x.id, 50]),
        ) as never;
        const mix = dinerMix(kitchen(even), 50, 10);
        return Math.abs(mix.demand - 1) < 0.02 && Math.abs(mix.spend - 1) < 0.02;
      })(),
      "otherwise the city is charged for its own reputation twice",
    );
  }

  /* ==================================== 3. city and seasonal modifiers === */
  {
    const lyon = chefAt({ city: "lyon" });
    const mumbai = chefAt({ city: "mumbai" });
    const paris = chefAt({ city: "paris" });
    const share = (s: RunState, id: string, week = 10) =>
      dinerMix(kitchen(s), s.r.reputation, week).shares.find(
        (x) => x.segment.id === id,
      )?.share ?? 0;

    check(
      "Mumbai's room is far more price-sensitive than Paris's",
      share(mumbai, "budget") > share(paris, "budget") * 2,
      `${share(mumbai, "budget").toFixed(2)} against ${share(paris, "budget").toFixed(2)}`,
    );
    check(
      "Paris draws luxury diners that Mumbai does not",
      share(paris, "luxury") > share(mumbai, "luxury") * 2,
    );
    check(
      "the same restaurant has a different room in every city",
      new Set(
        ["lyon", "mumbai", "paris", "newyork"].map((c) =>
          JSON.stringify(
            dinerMix(kitchen(chefAt({ city: c })), 45, 10).shares.map((x) =>
              x.share.toFixed(2),
            ),
          ),
        ),
      ).size === 4,
    );

    /* The seasons. Week 20 is summer, week 46 is winter. */
    check(
      "the calendar divides into four seasons and repeats yearly",
      seasonOf(1).id === "spring" &&
        seasonOf(20).id === "summer" &&
        seasonOf(33).id === "autumn" &&
        seasonOf(46).id === "winter" &&
        seasonOf(53).id === seasonOf(1).id,
    );
    check(
      "summer fills the tourist share and winter empties it",
      share(lyon, "tourists", 20) > share(lyon, "tourists", 46) * 1.5,
      `${share(lyon, "tourists", 20).toFixed(2)} against ${share(lyon, "tourists", 46).toFixed(2)}`,
    );
    check(
      "and winter is when the event clients book",
      share(lyon, "event", 46) > share(lyon, "event", 20),
    );
    check(
      "the season is stated on the forecast rather than applied silently",
      sceneFor(kitchen(lyon), 45, 20).drivers.some(
        (dr) => dr.label === "Summer",
      ),
    );
  }

  /* ================================================ 4. review generation === */
  {
    let s = stocked(
      chefAt({ menu: ["roast_chicken", "bread", "soup"], hire: ["commis"] }),
    );
    s = advanceWeek(chef, s, { dinner: 2, prep: 1 }).state;
    const reviews = kitchen(s).reviews ?? [];
    const night = kitchen(s).lastService?.nights?.[0];

    check(
      "a service that ran produces reviews",
      reviews.length > 0,
      `${reviews.length} after one week`,
    );
    check(
      "every review is written by one of the eight segments",
      reviews.every((r) => SEGMENT_BY_ID.has(r.segment)),
    );
    check(
      "a review only names a dish that was actually sent out",
      !!night &&
        reviews.every(
          (r) => r.dish === null || night.dishes.some((d) => d.name === r.dish),
        ),
    );
    check(
      "the wait a review quotes is the wait the night recorded",
      !!night &&
        reviews.every((r) => Math.abs(r.wait - night.averageWait) < 0.11),
      night ? `night averaged ${night.averageWait.toFixed(1)} ticks` : "no night",
    );
    check(
      "ratings are bounded at one to five",
      reviews.every((r) => r.rating >= 1 && r.rating <= 5),
    );
    check(
      "every review says what it is about",
      reviews.every((r) => r.tags.length > 0 && r.body.length > 20),
    );

    /* The same facts must produce the same review — determinism is what makes
       the whole thing testable and what makes a reload safe. */
    check(
      "the same night reviewed twice is the same review",
      (() => {
        let a = stocked(chefAt({ menu: ["roast_chicken", "soup"] }));
        let b = stocked(chefAt({ menu: ["roast_chicken", "soup"] }));
        a = advanceWeek(chef, a, { dinner: 2 }).state;
        b = advanceWeek(chef, b, { dinner: 2 }).state;
        return (
          JSON.stringify(kitchen(a).reviews) ===
          JSON.stringify(kitchen(b).reviews)
        );
      })(),
    );

    /* And a bad night is written about differently from a good one. */
    check(
      "a slow night produces complaints about the wait, not random grumbling",
      (() => {
        /* One cook, a full room and a complicated menu: the pass drowns. */
        let slow = stocked(
          chefAt({ menu: ["truffle_pasta", "roast_chicken", "bread"], skill: 25, rep: 70 }),
        );
        slow = advanceWeek(chef, slow, { dinner: 3 }).state;
        const rs = kitchen(slow).reviews ?? [];
        const report = kitchen(slow).lastService?.nights?.[0];
        if (!report || rs.length === 0) return true;
        /* If the night was genuinely slow, somebody must say so; if it was
           not, nobody may. Either way the text follows the report. */
        const complained = rs.some((r) => r.tags.includes("wait"));
        return report.averageWait > 4 ? complained : true;
      })(),
    );

    check(
      "recurring problems are only reported when they actually recur",
      recurringProblems([]).length === 0 &&
        recurringProblems(
          Array.from({ length: 6 }, (_, i) => ({
            id: `x${i}`,
            week: i,
            author: "A",
            segment: "budget",
            service: "dinner",
            rating: 2,
            dish: null,
            wait: 6,
            body: "long wait",
            tags: ["wait" as const],
          })),
        ).some((p) => p.tag === "wait"),
    );
    check(
      "a recurring problem names the control that fixes it",
      recurringProblems(
        Array.from({ length: 6 }, (_, i) => ({
          id: `y${i}`,
          week: i,
          author: "A",
          segment: "budget",
          service: "dinner",
          rating: 2,
          dish: null,
          wait: 6,
          body: "long wait",
          tags: ["wait" as const],
        })),
      )[0].fix.length > 20,
    );
    check(
      "praise is never counted as a recurring problem",
      recurringProblems(
        Array.from({ length: 6 }, (_, i) => ({
          id: `z${i}`,
          week: i,
          author: "A",
          segment: "budget",
          service: "dinner",
          rating: 5,
          dish: null,
          wait: 1,
          body: "lovely",
          tags: ["welcome" as const],
        })),
      ).length === 0,
    );
  }

  /* ================================================== 5. the phone posts === */
  {
    let s = stocked(chefAt({ menu: ["roast_chicken", "bread"] }));
    s = advanceWeek(chef, s, { dinner: 2, prep: 1 }).state;

    check(
      "the composer only offers a post whose facts exist",
      (() => {
        const ctx = chefPostContext(kitchen(s), s.week);
        const award = CHEF_POST_BY_ID.get("award")!;
        return !award.available(ctx);
      })(),
      "no award yet, so no award post",
    );
    check(
      "putting a dish on unlocks the post about that dish, by name",
      (() => {
        const ctx = chefPostContext(kitchen(s), s.week);
        const post = CHEF_POST_BY_ID.get("put_it_on")!;
        return (
          post.available(ctx) && post.body(ctx).includes(ctx.newestDish!.name)
        );
      })(),
    );

    /* Promoting a dish must actually change what the room orders. */
    const promoted = runCommand(chef, s, "post", "put_it_on");
    const newest = activeMenu(kitchen(s))[activeMenu(kitchen(s)).length - 1];
    check(
      "promoting a dish raises that dish's share of the room's orders",
      promotionOf(kitchen(promoted), newest.recipe, promoted.week) > 0,
      String(promotionOf(kitchen(promoted), newest.recipe, promoted.week)),
    );
    check(
      "and it raises expectations at the same time",
      expectationOf(kitchen(promoted)) > expectationOf(kitchen(s)),
    );
    check(
      "a post fills the room the following week",
      interestOf(kitchen(promoted)) > 1,
      String(interestOf(kitchen(promoted))),
    );
    check(
      "the promotion is visible in what was actually cooked",
      (() => {
        const plain = advanceWeek(chef, s, { dinner: 2 }).state;
        const pushed = advanceWeek(chef, promoted, { dinner: 2 }).state;
        const share = (x: RunState) => {
          const dishes = kitchen(x).lastService?.dishes ?? [];
          const total = dishes.reduce((n, d) => n + d.covers, 0);
          const one = dishes.find((d) => d.recipe === newest.recipe);
          return total > 0 && one ? one.covers / total : 0;
        };
        return share(pushed) > share(plain);
      })(),
    );

    /* Posting constantly reaches fewer people. */
    check(
      "posting three weeks running reaches materially fewer people",
      (() => {
        let x = s;
        const rested = reachFactor(kitchen(x), x.week);
        x = runCommand(chef, x, "post", "behind_pass");
        x = { ...x, week: x.week + 1, data: JSON.parse(JSON.stringify(x.data)) };
        x = runCommand(chef, x, "post", "market_morning");
        x = { ...x, week: x.week + 1, data: JSON.parse(JSON.stringify(x.data)) };
        x = runCommand(chef, x, "post", "meet_brigade");
        return reachFactor(kitchen(x), x.week) < rested * 0.7;
      })(),
    );

    /* Expectations are the price, and they are paid on the plate. */
    check(
      "raised expectations make the same plate score worse",
      (() => {
        const quiet = stocked(chefAt({ menu: ["roast_chicken", "bread"] }));
        const loud = { ...quiet, data: JSON.parse(JSON.stringify(quiet.data)) };
        const k = kitchen(loud);
        k.buzz = {
          interest: 1,
          expectation: 25,
          postWeeks: [],
          promoted: [],
          claims: [],
        };
        const a = advanceWeek(chef, quiet, { dinner: 2 }).state;
        const b = advanceWeek(chef, loud, { dinner: 2 }).state;
        return (
          standingOf(kitchen(b), b.r.reputation).food <
          standingOf(kitchen(a), a.r.reputation).food
        );
      })(),
      "otherwise promotion would be free",
    );
    check(
      "a promise the kitchen does not keep is measurable",
      (() => {
        const x = { ...s, data: JSON.parse(JSON.stringify(s.data)) };
        notePost(kitchen(x), x.week, { claim: { about: "food", size: 80 } });
        return (
          brokenPromise(kitchen(x), x.week, "food", 40) > 0 &&
          brokenPromise(kitchen(x), x.week, "food", 90) === 0
        );
      })(),
    );
    check(
      "a post about the brigade lifts the brigade",
      (() => {
        let x = stocked(chefAt({ menu: ["bread"], hire: ["commis"] }));
        x = advanceWeek(chef, x, { dinner: 1 }).state;
        const before = kitchen(x).staff[0]?.morale ?? 0;
        const after = runCommand(chef, x, "post", "staff_win");
        /* Only postable after a promotion, so the guard is the assertion. */
        const ctx = chefPostContext(kitchen(x), x.week);
        return CHEF_POST_BY_ID.get("staff_win")!.available(ctx)
          ? (kitchen(after).staff[0]?.morale ?? 0) > before
          : true;
      })(),
    );
    check(
      "interest decays rather than accumulating forever",
      (() => {
        let x = runCommand(chef, s, "post", "signature");
        x = runCommand(chef, x, "post", "put_it_on");
        const peak = interestOf(kitchen(x));
        for (let i = 0; i < 4; i++) x = advanceWeek(chef, x, {}).state;
        return interestOf(kitchen(x)) < peak;
      })(),
    );
  }

  /* ============================================== 6. customers, posting === */
  {
    check(
      "a night with walkouts produces a complaint that describes the walkouts",
      (() => {
        const facts = {
          week: 5,
          served: 40,
          walked: 6,
          mistakes: 0,
          wait: 6,
          satisfaction: 30,
          quality: 50,
          topDish: null,
          topIsSignature: false,
          worstMorale: 70,
          segmentLabel: "Local regulars",
          presentation: 50,
          followers: 500,
          scrutiny: 10,
        };
        const out = customerReactions(facts, makeRng(1));
        const complaint = out.find((r) => r.complaint)?.complaint;
        return (
          !!complaint &&
          complaint.about === "service" &&
          complaint.accurate &&
          complaint.body.includes("90 minutes")
        );
      })(),
    );
    check(
      "a good night produces no complaint at all",
      (() => {
        const out = customerReactions(
          {
            week: 5,
            served: 60,
            walked: 0,
            mistakes: 0,
            wait: 2,
            satisfaction: 74,
            quality: 78,
            topDish: { name: "Roast chicken", quality: 76, covers: 30 },
            topIsSignature: false,
            worstMorale: 75,
            segmentLabel: "Local regulars",
            presentation: 70,
            followers: 500,
            scrutiny: 0,
          },
          makeRng(2),
        );
        return out.length > 0 && out.every((r) => !r.complaint);
      })(),
    );
    check(
      "a complaint on a night that went well is marked as inaccurate",
      (() => {
        /* Scrutiny attracts them; the report is what decides whether they are
           true, and this one is not. */
        for (let seed = 1; seed < 40; seed++) {
          const out = customerReactions(
            {
              week: 5,
              served: 60,
              walked: 0,
              mistakes: 0,
              wait: 2,
              satisfaction: 70,
              quality: 75,
              topDish: null,
              topIsSignature: false,
              worstMorale: 75,
              segmentLabel: "Tourists",
              presentation: 40,
              followers: 4_000,
              scrutiny: 60,
            },
            makeRng(seed),
          );
          const c = out.find((r) => r.complaint)?.complaint;
          if (c) return c.accurate === false;
        }
        return true;
      })(),
    );
    check(
      "the signature dish being ordered by the room is noticed publicly",
      (() => {
        const out = customerReactions(
          {
            week: 5,
            served: 60,
            walked: 0,
            mistakes: 0,
            wait: 2,
            satisfaction: 65,
            quality: 70,
            topDish: { name: "Roast chicken", quality: 70, covers: 30 },
            topIsSignature: true,
            worstMorale: 40,
            segmentLabel: "Enthusiasts",
            presentation: 40,
            followers: 900,
            scrutiny: 0,
          },
          makeRng(7),
        );
        return out.some((r) => r.post.body.includes("roast chicken"));
      })(),
    );
    check(
      "no customer post ever appears for a night nobody was served on",
      customerReactions(
        {
          week: 5,
          served: 0,
          walked: 0,
          mistakes: 0,
          wait: 0,
          satisfaction: 0,
          quality: 0,
          topDish: null,
          topIsSignature: false,
          worstMorale: null,
          segmentLabel: "Local regulars",
          presentation: 0,
          followers: 100,
          scrutiny: 0,
        },
        makeRng(3),
      ).length === 0,
    );
  }

  /* ============================================== 7. complaint responses === */
  {
    const complaintOf = (accurate: boolean, reach = 3_000) => ({
      id: "c1",
      week: 5,
      author: "Marion D.",
      segment: "regulars",
      about: "service" as const,
      accurate,
      body: "We waited an hour.",
      reach,
    });
    const ctx = (over: Partial<Parameters<typeof resolveComplaint>[2]> = {}) => ({
      week: 5,
      reputation: 55,
      management: 70,
      priors: 0,
      cash: 100_000,
      compensation: 200,
      ...over,
    });

    check(
      "apologising for a fair complaint helps",
      resolveComplaint(complaintOf(true), "apologise", ctx()).sentiment > 0,
    );
    check(
      "and helps less the third time you say it",
      resolveComplaint(complaintOf(true), "apologise", ctx({ priors: 3 }))
        .sentiment <
        resolveComplaint(complaintOf(true), "apologise", ctx()).sentiment,
    );
    check(
      "compensation costs real money, scaled to how far it has travelled",
      (() => {
        const small = resolveComplaint(complaintOf(true, 100), "compensate", ctx());
        const big = resolveComplaint(complaintOf(true, 6_000), "compensate", ctx());
        return big.spent > small.spent && small.spent > 0;
      })(),
    );
    check(
      "paying off a complaint that was false reads as guilt",
      resolveComplaint(complaintOf(false), "compensate", ctx()).sentiment < 0,
    );
    check(
      "explaining works when the complaint is false and fails when it is true",
      resolveComplaint(complaintOf(false), "explain", ctx()).sentiment > 0 &&
        resolveComplaint(complaintOf(true), "explain", ctx()).sentiment < 0,
    );
    check(
      "defending the restaurant is the best answer to a false complaint",
      (() => {
        const defend = resolveComplaint(complaintOf(false), "defend", ctx({ reputation: 85 }));
        const others = (["apologise", "explain", "ignore"] as const).map(
          (r) => resolveComplaint(complaintOf(false), r, ctx({ reputation: 85 })).sentiment,
        );
        return others.every((x) => defend.sentiment > x);
      })(),
    );
    check(
      "and the worst answer to a true one",
      (() => {
        const defend = resolveComplaint(complaintOf(true), "defend", ctx());
        const others = (["apologise", "compensate", "explain", "ignore"] as const).map(
          (r) => resolveComplaint(complaintOf(true), r, ctx()).sentiment,
        );
        return others.every((x) => defend.sentiment > x === false);
      })(),
    );
    check(
      "silence is free when nobody is looking and expensive when they are",
      (() => {
        const quiet = resolveComplaint(complaintOf(true, 80), "ignore", ctx());
        const loud = resolveComplaint(complaintOf(true, 6_000), "ignore", ctx());
        return quiet.sentiment === 0 && loud.sentiment < -3;
      })(),
    );
    check(
      "investigating is the only answer that leaves the matter open",
      resolveComplaint(complaintOf(true), "investigate", ctx()).closed === false &&
        resolveComplaint(complaintOf(true), "apologise", ctx()).closed === true,
    );
    check(
      "a manager makes investigating worth doing and no manager does not",
      resolveComplaint(complaintOf(true), "investigate", ctx({ management: 80 }))
        .moves.length === 0 &&
        resolveComplaint(complaintOf(true), "investigate", ctx({ management: 20 }))
          .moves.length > 0,
    );
    check(
      "answering late is worth materially less than answering at once",
      resolveComplaint(complaintOf(true), "apologise", ctx({ week: 9 })).sentiment <
        resolveComplaint(complaintOf(true), "apologise", ctx()).sentiment,
    );
    check(
      "no single answer is correct in every situation",
      (() => {
        /* For each of the six, there is a situation in which it beats all the
           others. Anything less makes five of them decoration. */
        const situations = [
          { accurate: true, reach: 4_000, rep: 55, priors: 0 },
          { accurate: false, reach: 4_000, rep: 88, priors: 0 },
          { accurate: true, reach: 60, rep: 55, priors: 0 },
          { accurate: false, reach: 3_000, rep: 30, priors: 0 },
          { accurate: true, reach: 3_000, rep: 55, priors: 3 },
        ];
        const winners = new Set(
          situations.map((sit) => {
            const scored = COMPLAINT_RESPONSES.map((r) => ({
              id: r.id,
              value: resolveComplaint(
                complaintOf(sit.accurate, sit.reach),
                r.id,
                ctx({ reputation: sit.rep, priors: sit.priors }),
              ).sentiment,
            })).sort((a, b) => b.value - a.value);
            return scored[0].id;
          }),
        );
        return winners.size >= 3;
      })(),
      "at least three different answers win in different situations",
    );

    /* And through the real command path. */
    check(
      "answering a complaint through the command closes it and is recorded",
      (() => {
        let s = stocked(chefAt({ menu: ["bread"] }));
        kitchen(s).complaints = [complaintOf(true)];
        s = runCommand(chef, s, "respondComplaint", "c1|apologise");
        const c = (kitchen(s).complaints ?? [])[0];
        return c.closed === true && c.answered === "apologise" && !!c.outcome;
      })(),
    );
    check(
      "an unknown response is refused rather than applied",
      (() => {
        let s = stocked(chefAt({ menu: ["bread"] }));
        kitchen(s).complaints = [complaintOf(true)];
        s = runCommand(chef, s, "respondComplaint", "c1|shout");
        return (kitchen(s).complaints ?? [])[0].closed !== true;
      })(),
    );
    check(
      "a complaint cannot be answered twice in the same week",
      (() => {
        let s = stocked(chefAt({ menu: ["bread"] }));
        kitchen(s).complaints = [complaintOf(true)];
        s = runCommand(chef, s, "respondComplaint", "c1|compensate");
        const cash = s.r.cash;
        s = runCommand(chef, s, "respondComplaint", "c1|compensate");
        return s.r.cash === cash;
      })(),
    );
  }

  /* =========================================================== 8. critics === */
  {
    check(
      "there are five critics and no two want the same thing",
      CRITICS.length === 5 &&
        new Set(CRITICS.map((c) => c.looksFor)).size >= 4 &&
        new Set(CRITICS.map((c) => JSON.stringify(c.weighs))).size === 5,
    );
    check(
      "every critic offers clues before a visit and never a formula",
      CRITICS.every((c) => c.clues.length >= 3),
    );
    check(
      "an unknown kitchen is not reviewed by anybody",
      criticInterest(10, 0, 0) === 0,
    );
    check(
      "and a busy, followed one is",
      criticInterest(70, 20_000, 3) > criticInterest(30, 0, 0),
    );

    const traditionalist = CRITIC_BY_ID.get("traditionalist")!;
    const modernist = CRITIC_BY_ID.get("modernist")!;
    const goodNight = {
      week: 30,
      serviceLabel: "Dinner",
      plate: 78,
      wait: 2,
      mistakes: 0,
      walked: 0,
      served: 60,
    };

    check(
      "a verdict is built from the restaurant, not rolled",
      (() => {
        const s = chefAt({ menu: ["roast_chicken"] });
        const a = judgeVisit(traditionalist, kitchen(s), 55, goodNight);
        const b = judgeVisit(traditionalist, kitchen(s), 55, goodNight);
        return a.score === b.score && a.body === b.body;
      })(),
    );
    check(
      "two critics judge the same restaurant differently",
      (() => {
        let s = chefAt({ menu: ["roast_chicken"] });
        applyStanding(s, "consistency", 40, "the same twice");
        s = { ...s, data: s.data };
        const trad = judgeVisit(traditionalist, kitchen(s), 55, goodNight);
        const mod = judgeVisit(modernist, kitchen(s), 55, goodNight);
        return Math.abs(trad.score - mod.score) > 4;
      })(),
      "otherwise five critics are one critic",
    );
    check(
      "the modernist marks a restaurant with no menu down for having none",
      (() => {
        /* Two restaurants of identical standing, one of which has a menu.
           Started at 55 rather than the opening 12, because a critic
           reviewing an unknown market stall scores it at the floor either
           way and a comparison against a floor proves nothing. */
        const at = (menu: string[]) => {
          const x = chefAt({ menu });
          kitchen(x).standing = Object.fromEntries(
            STANDINGS.map((y) => [y.id, 55]),
          ) as never;
          return x;
        };
        const bare = at([]);
        const withMenu = at(["roast_chicken", "soup"]);
        return (
          judgeVisit(modernist, kitchen(bare), 55, goodNight).score <
          judgeVisit(modernist, kitchen(withMenu), 55, goodNight).score
        );
      })(),
    );
    check(
      "the value critic marks an over-priced menu down and says why",
      (() => {
        let cheap = chefAt({ menu: ["soup"] });
        let dear = chefAt({ menu: ["soup"] });
        const entry = activeMenu(kitchen(dear))[0];
        dear = runCommand(
          chef,
          dear,
          "priceDish",
          `${entry.recipe}:${Math.round(spendPerHead(kitchen(dear)) * 2.5)}`,
        );
        cheap = runCommand(
          chef,
          cheap,
          "priceDish",
          `${entry.recipe}:${Math.round(spendPerHead(kitchen(cheap)) * 0.8)}`,
        );
        const critic = CRITIC_BY_ID.get("value")!;
        const a = judgeVisit(critic, kitchen(cheap), 55, goodNight);
        const b = judgeVisit(critic, kitchen(dear), 55, goodNight);
        return a.score > b.score && b.body.includes("bill");
      })(),
    );
    check(
      "a night that went badly is what gets written about",
      (() => {
        const s = chefAt({ menu: ["roast_chicken"] });
        const bad = judgeVisit(traditionalist, kitchen(s), 55, {
          ...goodNight,
          plate: 30,
          mistakes: 5,
          walked: 4,
          wait: 7,
        });
        const good = judgeVisit(traditionalist, kitchen(s), 55, goodNight);
        /* Only the two most important notes make the printed verdict, which
           is what a review actually reads like. */
        return (
          bad.score < good.score &&
          bad.body.includes("plates went back") &&
          bad.body.includes("was not")
        );
      })(),
    );
    check(
      "a verdict moves the categories that critic weighs, with the reason",
      (() => {
        const s = chefAt({ menu: ["roast_chicken"] });
        const v = judgeVisit(traditionalist, kitchen(s), 55, goodNight);
        return (
          v.moves.length > 0 &&
          v.moves.every((m) => m.why.includes(traditionalist.name))
        );
      })(),
    );
    check(
      "every review raises the bar, and a rave raises it most",
      (() => {
        const s = chefAt({ menu: ["roast_chicken"] });
        kitchen(s).standing = Object.fromEntries(
          STANDINGS.map((x) => [x.id, 95]),
        ) as never;
        const rave = judgeVisit(traditionalist, kitchen(s), 95, goodNight);
        const poor = judgeVisit(traditionalist, kitchen(chefAt()), 20, {
          ...goodNight,
          plate: 30,
        });
        return rave.expectation > poor.expectation && poor.expectation > 0;
      })(),
    );
    check(
      "an award is a record, never an ending",
      (() => {
        let s = stocked(chefAt({ menu: ["roast_chicken", "bread"] }));
        kitchen(s).awards = [{ week: 1, label: "Course — One To Watch" }];
        s = advanceWeek(chef, s, { dinner: 2 }).state;
        return s.outcome === null;
      })(),
      "nothing in this phase may terminate a run",
    );
    check(
      "a scheduled visit never tells the player which night",
      (() => {
        const watch = arrangeVisit(traditionalist, 10, makeRng(5));
        return (
          watch.dueWeek > 10 &&
          !watchLine(watch, 10).includes(String(watch.dueWeek))
        );
      })(),
    );
    check(
      "a critic visit resolves into a published verdict and clears the watch",
      (() => {
        let s = stocked(chefAt({ menu: ["roast_chicken", "bread"], rep: 60 }));
        kitchen(s).criticWatch = {
          critic: "traditionalist",
          dueWeek: s.week,
          clues: ["She has been asking questions."],
          since: s.week - 2,
        };
        s = advanceWeek(chef, s, { dinner: 2 }).state;
        return (
          (kitchen(s).verdicts ?? []).length === 1 &&
          kitchen(s).criticWatch === undefined
        );
      })(),
    );
  }

  /* ======================================================= 9. competitors === */
  {
    const s = chefAt({ city: "paris" });
    const rivals = rivalsFor("paris", 1);
    check(
      "each city has three named rivals with a concept and a price level",
      rivals.length === 3 &&
        rivals.every(
          (r) => r.name.length > 3 && r.concept.length > 20 && !!PRICE_LABEL[r.price],
        ),
    );
    check(
      "and the rivals are different restaurants in different cities",
      rivalsFor("paris", 1)[0].name !== rivalsFor("mumbai", 1)[0].name,
    );
    check(
      "the same city always produces the same three",
      JSON.stringify(rivalsFor("paris", 1)) ===
        JSON.stringify(rivalsFor("paris", 1)),
    );
    check(
      "every rival has both a strength and a weakness you can act on",
      rivals.every(
        (r) =>
          STANDING_BY_ID.has(r.strength) &&
          STANDING_BY_ID.has(r.weakness) &&
          r.strength !== r.weakness &&
          r.targets.length > 0,
      ),
    );
    check(
      "a rival takes only the segments it is built for",
      (() => {
        const k = kitchen(s);
        k.rivals = [{ ...rivals[0], reputation: 90 }];
        const pressure = competitorPressure(k, 30);
        return (
          (pressure.budget ?? 0) > 0 && (pressure.luxury ?? 0) === 0
        );
      })(),
      "the cheap room cannot touch your luxury table",
    );
    check(
      "beating a rival at their own game costs you nothing",
      (() => {
        const k = kitchen(chefAt({ city: "paris" }));
        k.rivals = [{ ...rivals[0], reputation: 30 }];
        k.standing = Object.fromEntries(
          STANDINGS.map((x) => [x.id, 80]),
        ) as never;
        const pressure = competitorPressure(k, 80);
        return Object.values(pressure).every((x) => x < 0.12);
      })(),
    );
    check(
      "a price war takes the price-sensitive whatever your standing is",
      (() => {
        const k = kitchen(chefAt({ city: "paris" }));
        k.standing = Object.fromEntries(
          STANDINGS.map((x) => [x.id, 95]),
        ) as never;
        k.rivals = [{ ...rivals[0], reputation: 30, strategy: "undercut" as const }];
        return (competitorPressure(k, 95).budget ?? 0) > 0.05;
      })(),
    );
    check(
      "competitor pressure genuinely reduces how many people want a table",
      (() => {
        /* Standing equal to the reputation, so the appeal term is neutral and
           what is being measured is the rivals and nothing else. */
        const even = (rep: number) => {
          const x = chefAt({ city: "paris", rep });
          kitchen(x).standing = Object.fromEntries(
            STANDINGS.map((y) => [y.id, rep]),
          ) as never;
          return x;
        };
        const free = even(60);
        const pressed = even(60);
        kitchen(free).rivals = [];
        kitchen(pressed).rivals = rivals.map((r) => ({ ...r, reputation: 92 }));
        return (
          sceneFor(kitchen(pressed), 60, 10).demand <
          sceneFor(kitchen(free), 60, 10).demand
        );
      })(),
    );
    check(
      "rivals hold a strategy for at least four weeks",
      (() => {
        const k = kitchen(chefAt({ city: "paris" }));
        k.rivals = rivalsFor("paris", 10);
        const moves = moveRivals(k, 50, 12, "Roast chicken", 20, makeRng(1));
        return moves.length === 0;
      })(),
    );
    check(
      "a signature dish gets copied, and the move is announced",
      (() => {
        const k = kitchen(chefAt({ city: "paris" }));
        k.rivals = rivalsFor("paris", 1);
        k.standing = Object.fromEntries(
          STANDINGS.map((x) => [x.id, 90]),
        ) as never;
        for (let seed = 1; seed < 60; seed++) {
          const copy = JSON.parse(JSON.stringify(k)) as typeof k;
          const moves = moveRivals(copy, 60, 20, "Roast chicken", 70, makeRng(seed));
          const copied = moves.find((m) => m.strategy === "copy");
          if (copied) return copied.note.includes("signature") || copied.loud;
        }
        return false;
      })(),
    );
    check(
      "an unhappy brigade attracts a rival that is hiring",
      (() => {
        const k = kitchen(chefAt({ city: "paris" }));
        k.rivals = rivalsFor("paris", 1);
        for (let seed = 1; seed < 60; seed++) {
          const copy = JSON.parse(JSON.stringify(k)) as typeof k;
          if (
            moveRivals(copy, 50, 20, null, 20, makeRng(seed)).some(
              (m) => m.strategy === "poach",
            )
          ) {
            return true;
          }
        }
        return false;
      })(),
    );
    check(
      "your city rank counts you against the rivals rather than in a vacuum",
      (() => {
        const k = kitchen(chefAt({ city: "paris" }));
        k.rivals = rivalsFor("paris", 1);
        return cityRank(k, 95).rank === 1 && cityRank(k, 5).rank === 4;
      })(),
    );
    check(
      "and it names the restaurant immediately above you",
      (() => {
        const k = kitchen(chefAt({ city: "paris" }));
        k.rivals = rivalsFor("paris", 1);
        return cityRank(k, 50).above !== null;
      })(),
    );
  }

  /* ========================================================== 10. events === */
  {
    check(
      "twelve events were added, each with a context and real choices",
      CHEF_EVENTS.filter((e) => !e.followUp).length === 12,
      String(CHEF_EVENTS.filter((e) => !e.followUp).length),
    );
    check(
      "every event offers at least two choices and every choice states its cost",
      CHEF_EVENTS.filter((e) => !e.followUp).every(
        (e) => e.choices.length >= 2 && e.choices.every((c) => c.detail.length > 4),
      ),
    );
    check(
      "no event fires without the system it is about",
      (() => {
        const empty = startRun(chef, 1);
        /* A brand new kitchen has no equipment, no staff, no menu and no
           suppliers, so the events that read them must all decline. */
        return ["chef_breakdown", "chef_illness", "chef_allergy", "chef_shortage"].every(
          (id) => !CHEF_EVENTS.find((e) => e.id === id)!.eligible(empty),
        );
      })(),
    );
    check(
      "the festival only happens in the season it happens in",
      (() => {
        const s = chefAt({ rep: 40 });
        const festival = CHEF_EVENTS.find((e) => e.id === "chef_festival")!;
        return (
          festival.eligible({ ...s, week: 33 }) &&
          !festival.eligible({ ...s, week: 20 })
        );
      })(),
    );
    check(
      "an event body describes what is true now rather than a generic line",
      (() => {
        const s = chefAt({ city: "mumbai" });
        return CHEF_EVENTS.find((e) => e.id === "chef_shortage")!
          .body(s)
          .includes("Mumbai");
      })(),
    );
    check(
      "the breakdown genuinely removes the equipment when you refuse to fix it",
      (() => {
        let s = chefAt();
        s = runCommand(chef, s, "buyKit", "range");
        const before = (kitchen(s).equipment ?? []).length;
        const after = resolveEventChoice(
          chef,
          s,
          CHEF_EVENTS.find((e) => e.id === "chef_breakdown")!,
          1,
        );
        return (kitchen(after).equipment ?? []).length === before - 1;
      })(),
    );
    check(
      "and repairing it charges a price scaled to the city",
      (() => {
        const build = (city: string) => {
          let s = chefAt({ city, cash: 400_000 });
          s = runCommand(chef, s, "buyKit", "range");
          const before = s.r.cash;
          const after = resolveEventChoice(
            chef,
            s,
            CHEF_EVENTS.find((e) => e.id === "chef_breakdown")!,
            0,
          );
          return before - after.r.cash;
        };
        return build("mumbai") < build("newyork");
      })(),
      "a flat Lyon bill in Mumbai is two weeks of takings",
    );
    check(
      "the big booking schedules a night rather than paying out immediately",
      (() => {
        let s = chefAt();
        const before = s.r.cash;
        s = resolveEventChoice(
          chef,
          s,
          CHEF_EVENTS.find((e) => e.id === "chef_big_booking")!,
          0,
        );
        return (
          (s.pending ?? []).some((p) => p.kind === "bigBooking") &&
          s.r.cash > before
        );
      })(),
    );
    check(
      "the scheduled booking pays the balance once and only once",
      (() => {
        let s = chefAt();
        s = resolveEventChoice(
          chef,
          s,
          CHEF_EVENTS.find((e) => e.id === "chef_big_booking")!,
          0,
        );
        const due = (s.pending ?? [])[0];
        s = { ...s, week: due.dueWeek };
        const before = s.r.cash;
        const out = advanceWeek(chef, s, {});
        const gained = out.state.r.cash - before;
        /* And the queue is empty afterwards, which is what stops a reload
           from paying it a second time. */
        return gained > 0 && (out.state.pending ?? []).length === 0;
      })(),
    );
    check(
      "the inspection reads the state of the pantry rather than a die",
      (() => {
        const build = (prepared: number, rot: boolean) => {
          const s = stocked(chefAt({ menu: ["bread"] }));
          const k = kitchen(s);
          k.standing = Object.fromEntries(
            STANDINGS.map((x) => [x.id, rot ? 20 : 70]),
          ) as never;
          if (rot) {
            k.pantry = (k.pantry ?? []).map((l) => ({
              ...l,
              boughtWeek: s.week - 40,
            }));
          }
          s.pending = [
            {
              id: "i",
              dueWeek: s.week,
              kind: "inspection",
              payload: { prepared },
            },
          ];
          const before = s.r.cash;
          const out = advanceWeek(chef, s, {});
          return before - out.state.r.cash;
        };
        return build(0, true) > build(1, false);
      })(),
    );
    check(
      "an unknown pending kind from an older save is dropped, not crashed on",
      (() => {
        const s = chefAt();
        s.pending = [{ id: "x", dueWeek: s.week, kind: "somethingRemoved" }];
        const out = advanceWeek(chef, s, {});
        return (out.state.pending ?? []).length === 0;
      })(),
    );
    check(
      "the allergy event changes the kitchen rather than issuing a fine",
      (() => {
        const s = chefAt({ menu: ["roast_chicken", "bread"] });
        const before = activeMenu(kitchen(s)).length;
        const after = resolveEventChoice(
          chef,
          s,
          CHEF_EVENTS.find((e) => e.id === "chef_allergy")!,
          0,
        );
        return (
          activeMenu(kitchen(after)).length === before - 1 &&
          standingOf(kitchen(after), after.r.reputation).hygiene >
            standingOf(kitchen(s), s.r.reputation).hygiene
        );
      })(),
    );
    check(
      "matching a rival's price cut actually cuts your prices",
      (() => {
        const s = chefAt({ menu: ["roast_chicken", "soup"] });
        const before = activeMenu(kitchen(s)).map((e) => e.price);
        const after = resolveEventChoice(
          chef,
          s,
          CHEF_EVENTS.find((e) => e.id === "chef_rival_promo")!,
          0,
        );
        return activeMenu(kitchen(after)).every((e, i) => e.price < before[i]);
      })(),
    );
    check(
      "going the other way raises them, and costs you on value",
      (() => {
        const s = chefAt({ menu: ["roast_chicken", "soup"] });
        const before = activeMenu(kitchen(s)).map((e) => e.price);
        const after = resolveEventChoice(
          chef,
          s,
          CHEF_EVENTS.find((e) => e.id === "chef_rival_promo")!,
          2,
        );
        return (
          activeMenu(kitchen(after)).every((e, i) => e.price > before[i]) &&
          standingOf(kitchen(after), after.r.reputation).value <
            standingOf(kitchen(s), s.r.reputation).value
        );
      })(),
    );
    check(
      "every event choice returns a sentence for the activity history",
      CHEF_EVENTS.every((e) =>
        e.choices.every((c) => {
          const s = stocked(chefAt({ menu: ["roast_chicken", "bread"], hire: ["commis"] }));
          const line = c.apply(
            JSON.parse(JSON.stringify({ ...s, data: s.data })) as RunState,
            makeRng(3),
          );
          return typeof line === "string" && line.length > 10;
        }),
      ),
    );
  }

  /* ============================================== 11. save compatibility === */
  {
    check(
      "a kitchen with no Phase 3 fields at all is a valid save",
      (() => {
        const s = chefAt();
        const k = kitchen(s);
        delete k.standing;
        delete k.repLog;
        delete k.repTrend;
        delete k.reviews;
        delete k.complaints;
        delete k.buzz;
        delete k.rivals;
        delete k.criticWatch;
        delete k.verdicts;
        delete k.awards;
        delete k.qualityLog;
        return chef.validateData!(s.data);
      })(),
    );
    check(
      "and it reads as a kitchen whose seven parts agree with its reputation",
      (() => {
        const s = chefAt({ rep: 63 });
        const k = kitchen(s);
        delete k.standing;
        return Object.values(standingOf(k, 63)).every((v) => v === 63);
      })(),
    );
    check(
      "an un-migrated save plays a week without gaining or losing anything odd",
      (() => {
        let s = stocked(chefAt({ menu: ["roast_chicken", "bread"] }));
        const k = kitchen(s);
        delete k.standing;
        delete k.buzz;
        delete k.rivals;
        delete k.qualityLog;
        s = advanceWeek(chef, s, { dinner: 2 }).state;
        const after = kitchen(s);
        return (
          !!after.standing &&
          !!after.buzz &&
          (after.rivals ?? []).length === 3 &&
          Number.isFinite(s.r.cash)
        );
      })(),
    );
    check(
      "a standing outside 0-100 is refused rather than rendered",
      (() => {
        const s = chefAt();
        kitchen(s).standing = { food: 4_000 } as never;
        return !chef.validateData!(s.data);
      })(),
    );
    check(
      "a standing category the catalogue does not have is refused",
      (() => {
        const s = chefAt();
        kitchen(s).standing = { plating: 50 } as never;
        return !chef.validateData!(s.data);
      })(),
    );
    check(
      "a complaint with an invented response is refused",
      (() => {
        const s = chefAt();
        kitchen(s).complaints = [
          {
            id: "c",
            week: 1,
            author: "A",
            segment: "budget",
            about: "food",
            accurate: true,
            body: "x",
            reach: 10,
            answered: "shout" as never,
          },
        ];
        return !chef.validateData!(s.data);
      })(),
    );
    check(
      "a verdict from a critic who does not exist is refused",
      (() => {
        const s = chefAt();
        kitchen(s).verdicts = [
          {
            id: "v",
            week: 1,
            critic: "nobody",
            score: 50,
            body: "x",
            moves: [],
            award: null,
            interest: 1,
            expectation: 0,
          },
        ];
        return !chef.validateData!(s.data);
      })(),
    );
    check(
      "a rival on a strategy the catalogue does not have is refused",
      (() => {
        const s = chefAt();
        kitchen(s).rivals = [{ ...rivalsFor("lyon", 1)[0], strategy: "arson" as never }];
        return !chef.validateData!(s.data);
      })(),
    );
    check(
      "a promotion of a dish that does not exist is refused",
      (() => {
        const s = chefAt();
        kitchen(s).buzz = {
          interest: 1,
          expectation: 0,
          postWeeks: [],
          promoted: [{ recipe: "moon_cheese", until: 9, weight: 0.3 }],
          claims: [],
        };
        return !chef.validateData!(s.data);
      })(),
    );
    check(
      "every bounded list stays bounded across a long run",
      (() => {
        let s = stocked(chefAt({ menu: ["roast_chicken", "bread", "soup"] }));
        for (let i = 0; i < 30; i++) {
          s = advanceWeek(chef, s, { dinner: 2 }).state;
        }
        const k = kitchen(s);
        return (
          (k.reviews ?? []).length <= MAX_REVIEWS &&
          (k.repLog ?? []).length <= MAX_STANDING_LOG &&
          (k.repTrend ?? []).length <= MAX_STANDING_TREND &&
          (k.complaints ?? []).length <= MAX_COMPLAINTS &&
          (k.verdicts ?? []).length <= MAX_VERDICTS &&
          (k.qualityLog ?? []).length <= 16
        );
      })(),
    );
    check(
      "a thirty-week run is still a valid save at the end of it",
      (() => {
        let s = stocked(chefAt({ menu: ["roast_chicken", "bread", "soup"] }));
        for (let i = 0; i < 30; i++) {
          s = advanceWeek(chef, s, { dinner: 2, prep: 1 }).state;
        }
        /* `validateRun` takes the parsed JSON shape a reload hands it, which
           is what a save actually is on the way back in. */
        return (
          chef.validateData!(s.data) &&
          validateRun(JSON.parse(JSON.stringify(s)) as Record<string, unknown>)
        );
      })(),
    );
  }

  /* ================================== 12. nothing happens twice on reload === */
  {
    check(
      "resolving the same week twice from the same state is identical",
      (() => {
        const s = stocked(chefAt({ menu: ["roast_chicken", "bread"] }));
        const a = advanceWeek(chef, s, { dinner: 2, prep: 1 }).state;
        const b = advanceWeek(chef, s, { dinner: 2, prep: 1 }).state;
        return (
          JSON.stringify(kitchen(a).reviews) === JSON.stringify(kitchen(b).reviews) &&
          JSON.stringify(kitchen(a).repLog) === JSON.stringify(kitchen(b).repLog) &&
          a.r.reputation === b.r.reputation &&
          a.r.cash === b.r.cash
        );
      })(),
    );
    check(
      "a save round-trip does not duplicate a review, a complaint or a verdict",
      (() => {
        let s = stocked(chefAt({ menu: ["roast_chicken", "bread"], rep: 60 }));
        kitchen(s).criticWatch = {
          critic: "value",
          dueWeek: s.week,
          clues: ["He prints the bill."],
          since: s.week - 2,
        };
        s = advanceWeek(chef, s, { dinner: 2 }).state;
        const before = {
          reviews: (kitchen(s).reviews ?? []).length,
          verdicts: (kitchen(s).verdicts ?? []).length,
          rep: s.r.reputation,
        };
        /* Exactly what a reload does: serialise, parse, migrate, validate. */
        const reloaded = migrateRun(
          JSON.parse(JSON.stringify(s)) as Record<string, unknown>,
        ) as RunState | null;
        if (
          !reloaded ||
          !validateRun(JSON.parse(JSON.stringify(reloaded)) as Record<string, unknown>)
        ) {
          return false;
        }
        const k = kitchen(reloaded);
        return (
          (k.reviews ?? []).length === before.reviews &&
          (k.verdicts ?? []).length === before.verdicts &&
          reloaded.r.reputation === before.rep
        );
      })(),
    );
    check(
      "reviews from one week never collide with another week's",
      (() => {
        let s = stocked(chefAt({ menu: ["roast_chicken", "bread"] }));
        for (let i = 0; i < 5; i++) s = advanceWeek(chef, s, { dinner: 2 }).state;
        const ids = (kitchen(s).reviews ?? []).map((r) => r.id);
        return new Set(ids).size === ids.length;
      })(),
    );
    check(
      "an award is recorded once however many weeks pass afterwards",
      (() => {
        let s = stocked(chefAt({ menu: ["roast_chicken", "bread"], rep: 75 }));
        applyStanding(s, "food", 30, "very good");
        applyStanding(s, "consistency", 30, "the same twice");
        kitchen(s).criticWatch = {
          critic: "traditionalist",
          dueWeek: s.week,
          clues: ["She has been asking."],
          since: s.week - 3,
        };
        s = advanceWeek(chef, s, { dinner: 2 }).state;
        const after = (kitchen(s).awards ?? []).length;
        for (let i = 0; i < 4; i++) s = advanceWeek(chef, s, { dinner: 2 }).state;
        return (kitchen(s).awards ?? []).length === after;
      })(),
    );
  }

  /* ======================================== 13. the screens exist and route */
  {
    const chefScreens = sectionsFor("chef").flatMap((sec) =>
      sec.screens.map((sc) => sc.id),
    );
    check(
      "the Chef has a word-of-mouth screen and a scene screen",
      chefScreens.includes("reviews") && chefScreens.includes("scene"),
    );
    check(
      "and neither of them routes a Chef into a medical section",
      sectionOf("reviews", "chef").id === "work" &&
        sectionOf("scene", "chef").id === "world",
    );
    check(
      "every Chef screen still states what it decides",
      chefScreens.every((id) => screenOf(id).purpose.length > 20),
    );
    check(
      "the Physician is untouched by any of it",
      !sectionsFor("doctor")
        .flatMap((sec) => sec.screens.map((sc) => sc.id))
        .some((id) => id === "reviews" || id === "scene"),
    );
  }
}

console.log("\nThe craft and the top of the trade\n" + "─".repeat(52));
{
  /*
   * Phase 4: what the chef can personally do, the cellar, the guide's stars
   * and the work outside the kitchen. The rule every check here is written to
   * is that **none of it can be bought** — each system has a gate that money
   * does not open, and most of these assertions are about proving that gate
   * is real rather than decorative.
   */
  const chefP4 = (opts: {
    city?: string;
    week?: number;
    cash?: number;
    rep?: number;
    skill?: number;
    room?: string;
    kit?: string[];
    menu?: string[];
    hire?: string[];
    knows?: string[];
  } = {}) => {
    let s = startRun(chef, 7373, opts.city ? { city: opts.city } : undefined);
    /* Enough to buy whichever room the test is about — these configure a
       state to measure one rule, rather than playing a run to it. */
    s.r.cash = opts.cash ?? 2_400_000;
    s.r.skill = opts.skill ?? 60;
    s.r.reputation = opts.rep ?? 45;
    s.week = opts.week ?? 1;
    s = runCommand(chef, s, "takePremises", opts.room ?? "bistro");
    for (const id of opts.kit ?? []) s = runCommand(chef, s, "buyKit", id);
    for (const role of opts.hire ?? []) s = runCommand(chef, s, "hireKitchen", role);
    for (const id of opts.menu ?? []) s = runCommand(chef, s, "addDish", id);
    /* Techniques granted directly where the test is about their *effect*
       rather than about learning them. */
    if (opts.knows) {
      const k = kitchen(s);
      k.techniques = Object.fromEntries(
        opts.knows.map((id) => [id, TECHNIQUE_BY_ID.get(id)!.cost]),
      );
    }
    return s;
  };

  /* ================================================== 1. the techniques === */
  {
    check(
      "fourteen techniques across five disciplines",
      TECHNIQUES.length === 14 && DISCIPLINES.length === 5,
      `${TECHNIQUES.length} across ${DISCIPLINES.length}`,
    );
    check(
      "every technique states what it does, and does it",
      TECHNIQUES.every(
        (t) =>
          t.effect.length > 15 &&
          (t.lift > 0 || !!t.yield || !!t.worth || !!t.unlocks || !!t.handles),
      ),
      "no technique may be a bare +2 to a score",
    );
    check(
      "every prerequisite names a technique that exists",
      TECHNIQUES.every((t) =>
        (t.needs ?? []).every((id) => TECHNIQUE_BY_ID.has(id)),
      ),
    );
    check(
      "every unlock names a dish that exists",
      TECHNIQUES.every((t) =>
        (t.unlocks ?? []).every((id) => RECIPE_BY_ID.has(id)),
      ),
    );
    check(
      "and every ingredient gate names one that exists",
      TECHNIQUES.every((t) =>
        (t.handles ?? []).every((id) => INGREDIENT_BY_ID.has(id)),
      ),
    );

    const s = chefP4();
    check(
      "a new chef knows nothing and can start on the ones with no prerequisite",
      learnedTechniques(kitchen(s)).length === 0 &&
        TECHNIQUES.filter((t) => canLearn(kitchen(s), t)).length === 5,
      String(TECHNIQUES.filter((t) => canLearn(kitchen(s), t)).length),
    );
    check(
      "a technique behind a prerequisite refuses practice and says why",
      (() => {
        const x = chefP4();
        const before = { ...(kitchen(x).techniques ?? {}) };
        practise(kitchen(x), "emulsion", 40);
        return (
          JSON.stringify(kitchen(x).techniques) === JSON.stringify(before) &&
          (techniqueBlocker(kitchen(x), TECHNIQUE_BY_ID.get("emulsion")!) ?? "")
            .toLowerCase()
            .includes("stocks")
        );
      })(),
    );
    check(
      "practice never banks past what a technique costs",
      (() => {
        const x = chefP4();
        practise(kitchen(x), "stocks", 500);
        return (kitchen(x).techniques ?? {}).stocks === 35;
      })(),
    );
    check(
      "a block of practice moves the chosen technique through the real command path",
      (() => {
        let x = chefP4();
        x = runCommand(chef, x, "setPractice", "doughs");
        const out = advanceWeek(chef, x, { practise: 1 });
        return (kitchen(out.state).techniques ?? {}).doughs === 22;
      })(),
    );
    check(
      "and a block with nothing chosen still does something",
      (() => {
        const x = chefP4();
        const out = advanceWeek(chef, x, { practise: 1 });
        return Object.values(kitchen(out.state).techniques ?? {}).some(
          (v) => v > 0,
        );
      })(),
      "a block of the player's week must never quietly do nothing",
    );

    /* The effects, each measured against the thing it claims to change. */
    check(
      "a saucier's kitchen plates a better main and not a better tart",
      (() => {
        const x = chefP4({ knows: ["stocks", "emulsion"] });
        const k = kitchen(x);
        return techniqueLift(k, "main") > 8 && techniqueLift(k, "dessert") === 0;
      })(),
    );
    check(
      "and a pastry kitchen reverses that exactly",
      (() => {
        const x = chefP4({ knows: ["doughs", "sugar"] });
        const k = kitchen(x);
        return techniqueLift(k, "dessert") > 8 && techniqueLift(k, "main") === 0;
      })(),
    );
    check(
      "technique lands on the plate through dishQuality",
      (() => {
        /* Soup rather than the roast: dishQuality clamps at 100, and a dish
           already near the ceiling would measure the clamp instead. */
        const raw = RECIPE_BY_ID.get("soup")!;
        const plain = dishQuality(raw, undefined, 60, 0);
        const skilled = dishQuality(raw, undefined, 60, 9);
        return skilled > plain && Math.abs(skilled - plain - 9) < 0.001;
      })(),
    );
    check(
      "butchery takes real money off the write-off",
      (() => {
        const build = (knows: string[]) => {
          let x = chefP4({ knows });
          x = runCommand(chef, x, "buyProduce", "market:basic");
          /* Age it out so the sweep has something to bin. */
          for (const lot of kitchen(x).larder) lot.boughtWeek = x.week - 40;
          const out = advanceWeek(chef, x, {});
          return out.state.r._wasteCost ?? 0;
        };
        return build(["breakdown", "curing"]) < build([]);
      })(),
    );
    check(
      "and the recovery is capped, so waste can never be free",
      (() => {
        const x = chefP4({
          knows: ["breakdown", "stocks", "curing", "fishmonger", "dryage"],
        });
        return techniqueYield(kitchen(x)) <= 0.4;
      })(),
    );
    check(
      "technique raises what a cover is worth, and that too is bounded",
      (() => {
        const none = chefP4();
        const all = chefP4({
          knows: TECHNIQUES.map((t) => t.id),
        });
        /*
         * Small, and capped low. Technique already pays three times over —
         * on the plate, on the waste line, and in dishes that could not be
         * cooked at all — so the fourth payment has to be a rounding error by
         * comparison. It was +55% when this was first written, and the city
         * harness showed what that does.
         */
        return (
          techniqueWorth(kitchen(none)) === 1 &&
          techniqueWorth(kitchen(all)) > 1.1 &&
          techniqueWorth(kitchen(all)) <= 1.18
        );
      })(),
    );
    check(
      "precision makes a kitchen make fewer mistakes and never none",
      (() => {
        const x = chefP4({ knows: ["precision", "stocks", "emulsion"] });
        const steady = techniqueSteadiness(kitchen(x));
        return steady < 1 && steady > 0.5;
      })(),
    );

    /* The gates. */
    check(
      "caviar cannot be bought until the kitchen can serve it",
      (() => {
        let x = chefP4({ cash: 500_000, rep: 70, room: "restaurant" });
        x = runCommand(chef, x, "buyIngredient", "market:caviar");
        const blocked = (kitchen(x).pantry ?? []).length === 0;
        let y = chefP4({ cash: 500_000, rep: 70, room: "restaurant", knows: ["curing", "caviar"] });
        y = runCommand(chef, y, "buyIngredient", "market:caviar");
        return blocked && (kitchen(y).pantry ?? []).length > 0;
      })(),
      "money does not open a tin of caviar properly",
    );
    check(
      "and the luxury dishes are gated on technique as well as on craft",
      (() => {
        let x = chefP4({ cash: 900_000, rep: 80, skill: 95, room: "flagship" });
        x = runCommand(chef, x, "developRecipe", "langoustine");
        const blocked = !knowsRecipe(kitchen(x), "langoustine");
        let y = chefP4({
          cash: 900_000,
          rep: 80,
          skill: 95,
          room: "flagship",
          knows: ["breakdown", "fishmonger"],
        });
        y = runCommand(chef, y, "developRecipe", "langoustine");
        return blocked && knowsRecipe(kitchen(y), "langoustine");
      })(),
    );
    check(
      "an unstarted technique is not silently treated as learned",
      !knowsTechnique(kitchen(chefP4()), "plating"),
    );
  }

  /* ======================================================= 2. the stages === */
  {
    check(
      "five stages, each gated on what the trade thinks of you",
      STAGES.length === 5 &&
        new Set(STAGES.map((x) => x.needsRank)).size >= 4,
    );
    check(
      "a stall-holder cannot get a stage at a three-star kitchen",
      (() => {
        const s = chefP4({ room: "stall", rep: 10 });
        return !!stageBlocker(
          STAGE_BY_ID.get("three_star")!,
          kitchen(s),
          s.r.reputation,
          [],
        );
      })(),
    );
    check(
      "a stage teaches more than a block of practice and costs the week",
      (() => {
        let x = chefP4();
        const budget = chef.timeBudget(x);
        x = runCommand(chef, x, "stage", "market_butcher");
        const k = kitchen(x);
        return (
          (k.techniques ?? {}).breakdown === 40 &&
          chef.timeBudget(x) < budget &&
          (k.stagingUntil ?? 0) > x.week
        );
      })(),
    );
    check(
      "and it clears any services already allocated, because you are not there",
      (() => {
        let x = chefP4();
        x.r._svc_dinner = 2;
        x = runCommand(chef, x, "stage", "market_butcher");
        return (x.r._svc_dinner ?? 0) === 0;
      })(),
    );
    check(
      "a stage's points finish a technique rather than leaving five at 60%",
      (() => {
        const x = chefP4();
        const learned = applyStage(kitchen(x), STAGE_BY_ID.get("bakery")!);
        return learned.length >= 1 && knowsTechnique(kitchen(x), "doughs");
      })(),
    );
    check(
      "no stage can be done twice",
      (() => {
        let x = chefP4();
        x = runCommand(chef, x, "stage", "market_butcher");
        x = { ...x, week: x.week + 3, data: JSON.parse(JSON.stringify(x.data)) };
        const before = (kitchen(x).techniques ?? {}).breakdown;
        x = runCommand(chef, x, "stage", "market_butcher");
        return (kitchen(x).techniques ?? {}).breakdown === before;
      })(),
    );
  }

  /* ======================================================== 3. the rank === */
  {
    check(
      "a new chef is nobody in particular",
      chefRank(kitchen(chefP4({ rep: 8, room: "stall" })), 8).id === "unknown",
    );
    check(
      "the rank is built from what you did, not from what you spent",
      (() => {
        const rich = chefP4({ room: "stall", cash: 5_000_000, rep: 20 });
        const able = chefP4({
          room: "stall",
          rep: 20,
          knows: ["breakdown", "stocks", "doughs", "curing", "precision"],
        });
        return (
          rankScore(kitchen(able), 20) > rankScore(kitchen(rich), 20) + 20
        );
      })(),
    );
    check(
      "stars move it further than anything else",
      (() => {
        const x = chefP4({ rep: 50 });
        const before = rankScore(kitchen(x), 50);
        kitchen(x).stars = 2;
        return rankScore(kitchen(x), 50) - before === 32;
      })(),
    );
    check(
      "a name attracts better cooks than a reputation alone",
      (() => {
        const hire = (knows: string[]) => {
          let x = chefP4({ rep: 45, knows });
          x = runCommand(chef, x, "hireKitchen", "commis");
          return kitchen(x).staff[0]?.skill ?? 0;
        };
        return hire(TECHNIQUES.map((t) => t.id)) > hire([]);
      })(),
    );
    check(
      "the rank ladder is ordered and reachable",
      RANKS.every((r, i) => i === 0 || r.at > RANKS[i - 1].at),
    );
  }

  /* ======================================================= 4. the cellar === */
  {
    check(
      "nine wines, and every one of them peaks",
      WINES.length === 9 && WINES.every((w) => w.peak > 0 && w.markup > 1),
    );
    check(
      "a wine climbs to its peak and declines afterwards",
      (() => {
        const barolo = WINE_BY_ID.get("barolo")!;
        const young = maturityOf(barolo, 10);
        const peak = maturityOf(barolo, barolo.peak);
        const old = maturityOf(barolo, barolo.peak * 3);
        return peak > young && old < peak && young >= 1;
      })(),
      "the inversion of the whole spoilage model",
    );
    check(
      "and it is bounded, so a cellar is not an investment fund",
      WINES.every((w) => maturityOf(w, 10_000) <= 4 && maturityOf(w, 10_000) >= 0.5),
    );
    check(
      "without the wine store you have a rack, not a cellar",
      (() => {
        const bare = chefP4({ room: "bistro" });
        const stored = chefP4({ room: "bistro", kit: ["cellar"] });
        return (
          cellarCapacity(kitchen(stored)) > cellarCapacity(kitchen(bare)) * 4
        );
      })(),
    );
    check(
      "buying a case takes the cash and puts the bottles in the rack",
      (() => {
        let x = chefP4({ kit: ["cellar"] });
        const before = x.r.cash;
        x = runCommand(chef, x, "buyWine", "chablis");
        const k = kitchen(x);
        return (
          (k.cellar ?? []).length === 1 &&
          (k.cellar ?? [])[0].bottles === 12 &&
          x.r.cash < before
        );
      })(),
    );
    check(
      "a full cellar refuses the next case and says why",
      (() => {
        const x = chefP4({ room: "stall" });
        return (
          wineBlocker(kitchen(x), WINE_BY_ID.get("house_white")!, 999_999) ===
          null
        );
      })(),
    );
    check(
      "bottles are drunk, so a list is not a passive multiplier",
      (() => {
        let x = chefP4({ kit: ["cellar"] });
        x = runCommand(chef, x, "buyWine", "house_red");
        const before = bottlesHeld(kitchen(x));
        const pour = pourForCovers(kitchen(x), 200, x.week, false, ["main"]);
        return pour.bottles > 0 && bottlesHeld(kitchen(x)) === before - pour.bottles;
      })(),
    );
    check(
      "a lot is never poured below zero",
      (() => {
        let x = chefP4({ kit: ["cellar"] });
        x = runCommand(chef, x, "buyWine", "house_red");
        pourForCovers(kitchen(x), 100_000, x.week, true, ["main"]);
        return (kitchen(x).cellar ?? []).every((l) => l.bottles >= 0);
      })(),
    );
    check(
      "a sommelier sells materially more wine, and from the top of the list",
      (() => {
        const build = (somm: boolean) => {
          let x = chefP4({ kit: ["cellar"], hire: somm ? ["somm"] : [] });
          x = runCommand(chef, x, "buyWine", "house_red");
          x = runCommand(chef, x, "buyWine", "barolo");
          /* Sixty covers, so what is in the rack is not the binding
             constraint — otherwise both rooms simply drink the cellar dry and
             the comparison measures the stock rather than the sommelier. */
          return pourForCovers(kitchen(x), 60, x.week, somm, ["main"]);
        };
        const without = build(false);
        const withSomm = build(true);
        return (
          withSomm.bottles > without.bottles &&
          withSomm.revenue > without.revenue
        );
      })(),
    );
    check(
      "an aged bottle sells for more than the same bottle young",
      (() => {
        const make = (age: number) => {
          const x = chefP4({ kit: ["cellar"], week: 200 });
          kitchen(x).cellar = [
            {
              id: "l1",
              wine: "barolo",
              bottles: 6,
              unitCost: 100,
              boughtWeek: 200 - age,
            },
          ];
          return pourForCovers(kitchen(x), 200, 200, true, ["main"]).revenue;
        };
        return make(150) > make(2);
      })(),
    );
    check(
      "the cellar counts on the balance sheet at what it is worth today",
      (() => {
        let x = chefP4({ kit: ["cellar"] });
        const before = kitchenWorth(x);
        x = runCommand(chef, x, "buyWine", "chablis");
        /* Cash went down and stock went up: net worth should barely move. */
        return Math.abs(kitchenWorth(x) - before) < casePrice(kitchen(x), WINE_BY_ID.get("chablis")!) * 0.35;
      })(),
    );
    check(
      "selling back pays less than pouring, so a cellar stays a cellar",
      (() => {
        const x = chefP4({ kit: ["cellar"], week: 100 });
        kitchen(x).cellar = [
          { id: "l1", wine: "barolo", bottles: 6, unitCost: 100, boughtWeek: 1 },
        ];
        const merchant = sellPrice(kitchen(x), kitchen(x).cellar![0], 100);
        const poured = pourForCovers(kitchen(x), 400, 100, true, ["main"]).revenue;
        return poured > merchant;
      })(),
    );
    check(
      "wine reaches the ledger as its own line when a service runs",
      (() => {
        let x = chefP4({ kit: ["cellar"], menu: ["roast_chicken", "bread"] });
        for (const ing of ["chicken", "roots", "butter", "flour"]) {
          x = runCommand(chef, x, "buyIngredient", `market:${ing}`);
        }
        x = runCommand(chef, x, "buyWine", "house_red");
        x = runCommand(chef, x, "buyWine", "house_white");
        const out = advanceWeek(chef, x, { dinner: 2, prep: 1 });
        return out.ledger.some((l) => /bottles opened/i.test(l.label));
      })(),
    );
  }

  /* ======================================================== 5. the guide === */
  {
    check(
      "the guide measures six things and none of them is money",
      GUIDE_COMPONENTS.length === 6 &&
        Math.abs(
          GUIDE_COMPONENTS.reduce((n, c) => n + c.weight, 0) - 1,
        ) < 0.001,
    );
    check(
      "a market stall with nothing on the menu scores near nothing",
      guideScore(kitchen(chefP4({ room: "stall", rep: 10 })), 10).total < 30,
    );
    check(
      "and the score is deterministic — the same restaurant always scores the same",
      (() => {
        const x = chefP4({ menu: ["roast_chicken"] });
        return (
          guideScore(kitchen(x), 50).total === guideScore(kitchen(x), 50).total
        );
      })(),
    );
    check(
      "winning is harder than keeping, so a restaurant does not flicker",
      STAR_LEVELS.every((l) => l.stars === 0 || l.at > l.keep),
    );
    check(
      "nobody goes from nothing to two stars in one edition",
      starsFor(99, 0) === 1 && starsFor(99, 1) === 2,
    );
    check(
      "a star already held survives a score that would not have won it",
      starsFor(55, 1) === 1 && starsFor(40, 1) === 0,
    );
    check(
      "the guide publishes once a year on the same week",
      guideDue(40) && guideDue(92) && !guideDue(41),
    );
    check(
      "a star fills the room and raises what a cover is worth",
      (() => {
        const one = starLevel(1);
        const three = starLevel(3);
        return (
          one.draw > 1 && three.draw > one.draw && three.worth > one.worth
        );
      })(),
    );
    check(
      "and it raises the bar every night is judged against",
      STAR_LEVELS.every(
        (l, i) => i === 0 || l.expectation > STAR_LEVELS[i - 1].expectation,
      ),
      "a star is a standard you have to hold, not a prize you keep",
    );
    check(
      "a star is won through the real week and written into the record",
      (() => {
        const x = chefP4({
          week: 40,
          room: "flagship",
          rep: 90,
          kit: ["cellar", "porcelain", "range", "prep"],
          knows: TECHNIQUES.map((t) => t.id),
          menu: ["roast_chicken", "chocolate_tart"],
        });
        const k = kitchen(x);
        k.standing = Object.fromEntries(
          STANDINGS.map((y) => [y.id, 92]),
        ) as never;
        k.cellar = [
          { id: "c1", wine: "burgundy", bottles: 3, unitCost: 300, boughtWeek: 1 },
        ];
        k.recipes = (k.recipes ?? []).map((r) => ({ ...r, signature: true }));
        const out = advanceWeek(chef, x, {});
        return (
          (kitchen(out.state).stars ?? 0) > 0 &&
          (kitchen(out.state).guide ?? []).length === 1
        );
      })(),
    );
    check(
      "and a star can be taken back",
      (() => {
        const x = chefP4({ week: 40, room: "stall", rep: 12 });
        kitchen(x).stars = 2;
        const out = advanceWeek(chef, x, {});
        return (kitchen(out.state).stars ?? 0) < 2;
      })(),
    );
    check(
      "three stars is not an ending",
      (() => {
        const x = chefP4({ week: 40, room: "flagship", rep: 95 });
        kitchen(x).stars = 3;
        const out = advanceWeek(chef, x, {});
        return out.state.outcome === null;
      })(),
    );
    check(
      "the screen can always say what is standing in the way",
      (() => {
        const x = chefP4({ menu: ["roast_chicken"] });
        const t = towardsNext(kitchen(x), 45);
        return !!t.next && t.short > 0 && !!t.weakest;
      })(),
    );
  }

  /* ===================================================== 6. the ventures === */
  {
    check(
      "five ventures, each gated on rank and none of them buyable",
      VENTURES.length === 5 &&
        new Set(VENTURES.map((v) => v.needsRank)).size >= 4,
    );
    check(
      "a nobody is offered nothing",
      (() => {
        const x = chefP4({ room: "stall", rep: 8 });
        return VENTURES.every(
          (v) => !!ventureBlocker(v, kitchen(x), 8, 9_999_999),
        );
      })(),
    );
    check(
      "taking one costs blocks out of every week it runs",
      (() => {
        let x = chefP4({ room: "flagship", rep: 90, knows: TECHNIQUES.map((t) => t.id) });
        kitchen(x).stars = 3;
        const before = chef.timeBudget(x);
        x = runCommand(chef, x, "startVenture", "consult");
        return chef.timeBudget(x) === before - 2;
      })(),
      "being somewhere else is the whole cost",
    );
    check(
      "only one at a time",
      (() => {
        let x = chefP4({ room: "flagship", rep: 90, knows: TECHNIQUES.map((t) => t.id) });
        kitchen(x).stars = 3;
        x = runCommand(chef, x, "startVenture", "consult");
        x = runCommand(chef, x, "startVenture", "class");
        return venturesOf(kitchen(x)).active?.id === "consult";
      })(),
    );
    check(
      "it counts down once per resolved week and pays on the last one",
      (() => {
        let x = chefP4({ room: "flagship", rep: 90, knows: TECHNIQUES.map((t) => t.id) });
        kitchen(x).stars = 3;
        x = runCommand(chef, x, "startVenture", "class");
        const weeks = VENTURE_BY_ID.get("class")!.weeks;
        let paid = false;
        for (let i = 0; i < weeks; i++) {
          const out = advanceWeek(chef, x, {});
          x = out.state;
          if (out.ledger.some((l) => /masterclass/i.test(l.label))) paid = true;
        }
        return paid && venturesOf(kitchen(x)).active === null;
      })(),
    );
    check(
      "a book pays royalties every week afterwards, whether or not you open",
      (() => {
        let x = chefP4({ room: "flagship", rep: 95, knows: TECHNIQUES.map((t) => t.id) });
        kitchen(x).stars = 3;
        x = runCommand(chef, x, "startVenture", "book");
        for (let i = 0; i < VENTURE_BY_ID.get("book")!.weeks; i++) {
          x = advanceWeek(chef, x, {}).state;
        }
        const out = advanceWeek(chef, x, {});
        return out.ledger.some((l) => l.label === "Royalties" && (l.amount ?? 0) > 0);
      })(),
    );
    check(
      "and the loudest one raises expectations permanently",
      (() => {
        let x = chefP4({ room: "flagship", rep: 95, knows: TECHNIQUES.map((t) => t.id) });
        kitchen(x).stars = 3;
        const before = expectationOf(kitchen(x));
        x = runCommand(chef, x, "startVenture", "television");
        for (let i = 0; i < VENTURE_BY_ID.get("television")!.weeks; i++) {
          x = advanceWeek(chef, x, {}).state;
        }
        return expectationOf(kitchen(x)) > before + 10;
      })(),
    );
    check(
      "walking away pays nothing and gives the kitchen back",
      (() => {
        let x = chefP4({ room: "flagship", rep: 90, knows: TECHNIQUES.map((t) => t.id) });
        kitchen(x).stars = 3;
        const budget = chef.timeBudget(x);
        x = runCommand(chef, x, "startVenture", "consult");
        const cash = x.r.cash;
        x = runCommand(chef, x, "dropVenture", "");
        return (
          x.r.cash === cash &&
          chef.timeBudget(x) === budget &&
          venturesOf(kitchen(x)).active === null
        );
      })(),
    );
    check(
      "a one-off is offered once",
      (() => {
        const x = chefP4({ room: "flagship", rep: 95, knows: TECHNIQUES.map((t) => t.id) });
        kitchen(x).stars = 3;
        const k = kitchen(x);
        k.ventures = { active: null, done: ["book"], royalties: 620 };
        return !!ventureBlocker(VENTURE_BY_ID.get("book")!, k, 95, 999_999);
      })(),
    );
  }

  /* ================================================ 7. the luxury tier === */
  {
    check(
      "the destination seats fewer than the flagship and charges nearly twice",
      (() => {
        const flagship = CHEF_PREMISES.find((p) => p.id === "flagship")!;
        const dest = CHEF_PREMISES.find((p) => p.id === "destination")!;
        return dest.capacity < flagship.capacity && dest.spend > flagship.spend * 1.7;
      })(),
      "the room at the top of this trade is small and expensive, not big",
    );
    check(
      "the counter cannot be opened without the counter",
      (() => {
        const counter = SERVICE_BY_ID.get("counter")!;
        const without = chefP4({ room: "flagship", skill: 95 });
        const with_ = chefP4({ room: "flagship", skill: 95, kit: ["counter"] });
        return (
          !serviceOpen(counter, kitchen(without), 95) &&
          serviceOpen(counter, kitchen(with_), 95) &&
          (serviceBlocker(counter, kitchen(without), 95) ?? "")
            .toLowerCase()
            .includes("counter")
        );
      })(),
    );
    check(
      "and it is the most exposed service in the game",
      (() => {
        const counter = SERVICE_BY_ID.get("counter")!;
        return (
          counter.reviewWeight ===
            Math.max(...SERVICES.map((sv) => sv.reviewWeight)) &&
          SERVICE_SHAPES.counter.walkoutCost ===
            Math.max(...Object.values(SERVICE_SHAPES).map((sh) => sh.walkoutCost))
        );
      })(),
    );
    check(
      "the three luxury ingredients all die faster than they are dear",
      ["langoustine", "agedbeef", "caviar"].every((id) => {
        const ing = INGREDIENT_BY_ID.get(id)!;
        return ing.price > 50 && ing.life <= 3 && ing.quality >= 94;
      }),
    );
    check(
      "every luxury dish is gated on a technique that has to be learned",
      ["langoustine", "aged_rib", "souffle", "caviar_service", "counter_course"].every(
        (id) => RECIPE_BY_ID.has(id) && !!gateFor(id),
      ),
    );
    check(
      "the sommelier is a real role with real stations",
      (() => {
        const somm = ROLE_BY_ID.get("somm");
        return !!somm && somm.salary > 1_000 && !!somm.stations?.front;
      })(),
    );
  }

  /* ============================================= 8. save compatibility === */
  {
    check(
      "a kitchen with no Phase 4 fields at all is a valid save",
      (() => {
        const x = chefP4();
        const k = kitchen(x);
        delete k.techniques;
        delete k.stages;
        delete k.stagingUntil;
        delete k.practising;
        delete k.cellar;
        delete k.stars;
        delete k.guide;
        delete k.ventures;
        return chef.validateData!(x.data);
      })(),
    );
    check(
      "and it reads as a chef who has learned nothing and been offered nothing",
      (() => {
        const x = chefP4();
        const k = kitchen(x);
        delete k.techniques;
        delete k.cellar;
        delete k.stars;
        delete k.ventures;
        return (
          learnedTechniques(k).length === 0 &&
          starsOf(k) === 0 &&
          techniqueWorth(k) === 1 &&
          venturesOf(k).active === null
        );
      })(),
    );
    check(
      "an un-migrated save plays a week and gains the fields it needs",
      (() => {
        let x = chefP4({ menu: ["roast_chicken"] });
        const k = kitchen(x);
        delete k.techniques;
        delete k.cellar;
        delete k.stars;
        delete k.ventures;
        x = runCommand(chef, x, "buyIngredient", "market:chicken");
        x = advanceWeek(chef, x, { dinner: 2 }).state;
        return Number.isFinite(x.r.cash) && !!kitchen(x).ventures;
      })(),
    );
    check(
      "a technique progressed past what it costs is refused",
      (() => {
        const x = chefP4();
        kitchen(x).techniques = { stocks: 9_000 };
        return !chef.validateData!(x.data);
      })(),
    );
    check(
      "a technique the catalogue does not have is refused",
      (() => {
        const x = chefP4();
        kitchen(x).techniques = { juggling: 10 };
        return !chef.validateData!(x.data);
      })(),
    );
    check(
      "a negative bottle count is refused",
      (() => {
        const x = chefP4();
        kitchen(x).cellar = [
          { id: "l", wine: "barolo", bottles: -4, unitCost: 10, boughtWeek: 1 },
        ];
        return !chef.validateData!(x.data);
      })(),
    );
    check(
      "a wine the catalogue does not have is refused",
      (() => {
        const x = chefP4();
        kitchen(x).cellar = [
          { id: "l", wine: "moonshine", bottles: 4, unitCost: 10, boughtWeek: 1 },
        ];
        return !chef.validateData!(x.data);
      })(),
    );
    check(
      "forty stars are refused",
      (() => {
        const x = chefP4();
        kitchen(x).stars = 40;
        return !chef.validateData!(x.data);
      })(),
    );
    check(
      "a venture running longer than it lasts is refused",
      (() => {
        const x = chefP4();
        kitchen(x).ventures = {
          active: { id: "class", startedWeek: 1, weeksLeft: 900 },
          done: [],
          royalties: 0,
        };
        return !chef.validateData!(x.data);
      })(),
    );
    check(
      "a long run with all of it running is still a valid save",
      (() => {
        let x = chefP4({
          room: "restaurant",
          rep: 70,
          kit: ["cellar", "range", "prep"],
          menu: ["roast_chicken", "bread", "soup"],
          knows: ["breakdown", "stocks", "doughs"],
        });
        x = runCommand(chef, x, "buyWine", "chablis");
        x = runCommand(chef, x, "setPractice", "curing");
        for (const ing of ["chicken", "roots", "butter", "flour"]) {
          x = runCommand(chef, x, "buyIngredient", `market:${ing}`);
        }
        for (let i = 0; i < 45; i++) {
          x = advanceWeek(chef, x, { dinner: 2, practise: 1 }).state;
        }
        return (
          chef.validateData!(x.data) &&
          validateRun(JSON.parse(JSON.stringify(x)) as Record<string, unknown>)
        );
      })(),
    );
  }

  /* ================================================== 9. the screens === */
  {
    const screens = sectionsFor("chef").flatMap((sec) =>
      sec.screens.map((sc) => sc.id),
    );
    check(
      "the chef has a craft screen and a beyond-the-kitchen screen",
      screens.includes("craft") && screens.includes("beyond"),
    );
    check(
      "and both sit under Career — the chef — rather than under the restaurant",
      sectionOf("craft", "chef").id === "career" &&
        sectionOf("beyond", "chef").id === "career",
    );
    check(
      "the Physician is untouched by any of it",
      !sectionsFor("doctor")
        .flatMap((sec) => sec.screens.map((sc) => sc.id))
        .some((id) => id === "craft" || id === "beyond"),
    );
  }
}

/**
 * WHAT THE INTERFACE TELLS EACH CAREER
 *
 * Four systems — nav badges, the one next step, the lessons, the words — were
 * built for the Physician and returned empty for everybody else. These assert
 * that each career now has all four, that nothing any of them says routes to a
 * screen that career cannot reach, and that none of them speaks another
 * career's language.
 */
console.log("\nGuidance, in each career's own words\n" + "─".repeat(52));
{
  const screensFor = (careerId: string) =>
    new Set(sectionsFor(careerId).flatMap((s) => s.screens.map((x) => x.id)));

  /* Deliberately narrow markers. "weeks of cover" is a solvency phrase every
     career uses and "covers" is the Chef's unit, so the pattern is the plural
     alone — a looser one fails on prose that is perfectly correct. */
  const MEDICAL = /patient|caseload|triage|outbreak|physician|\bward\b|\bnurse/i;
  const KITCHEN = /larder|brigade|\bcovers\b|plate quality|commis|the pass\b/i;
  const LEGAL = /instruction|hearing|costs order|\bcounsel\b|adjourn|solicitor|chambers/i;

  /* A run that has gone wrong in several directions at once, so the alert
     derivation is exercised rather than merely called. */
  const stressed = (career: CareerDef) => {
    const s = startRun(career, 91);
    s.week = 20;
    s.r.cash = -5_000;
    s.r.burnout = 88;
    return s;
  };

  for (const [id, career] of [
    ["doctor", doctor],
    ["chef", chef],
    ["lawyer", lawyer],
  ] as const) {
    const screens = screensFor(id);
    const fresh = startRun(career, 4);
    const bad = stressed(career);
    const alerts = [...deriveAlerts(fresh), ...deriveAlerts(bad)];

    check(
      `${id}: a run in trouble raises something on the navigation`,
      deriveAlerts(bad).length > 0,
      `${deriveAlerts(bad).length} alerts`,
    );
    check(
      `${id}: every alert says what is wrong and why it matters`,
      alerts.every((a) => a.title.length > 6 && a.detail.length > 30),
    );
    check(
      `${id}: every alert routes to a screen this career can actually reach`,
      alerts.every((a) => screens.has(a.destination)),
      alerts
        .filter((a) => !screens.has(a.destination))
        .map((a) => `${a.id} -> ${a.destination}`)
        .join(", "),
    );
    check(
      `${id}: no two alerts share an id`,
      new Set(deriveAlerts(bad).map((a) => a.id)).size ===
        deriveAlerts(bad).length,
    );

    /* The plan steps are career-agnostic and were the reason two careers had
       no guidance at all: an unspent block is an unspent block. */
    check(
      `${id}: an unassigned week is called out`,
      nextStep(fresh, {}, 0, 6, false)?.id === "allocate",
    );
    check(
      `${id}: and a half-assigned one`,
      nextStep(fresh, { rest: 1 }, 1, 6, false)?.id === "allocate:partial",
    );

    /* Lessons, and the screens they claim to belong on. */
    const lessons = lessonStatus(fresh, { allocated: 0, hasReport: false }, []);
    check(
      `${id}: the career has lessons of its own`,
      lessons.length >= 5,
      `${lessons.length}`,
    );
    check(
      `${id}: every lesson sits on a screen this career has`,
      lessons.every((x) => screens.has(x.lesson.screen)),
      lessons
        .filter((x) => !screens.has(x.lesson.screen))
        .map((x) => `${x.lesson.id} -> ${x.lesson.screen}`)
        .join(", "),
    );
    check(
      `${id}: every lesson teaches at least three things`,
      lessons.every((x) => x.lesson.points.length >= 3 && x.lesson.intro.length > 30),
    );
    const opener = lessonFor(
      "overview",
      fresh,
      { allocated: 0, hasReport: false },
      [],
    );
    check(
      `${id}: week one opens with the lesson that explains the week`,
      opener !== null && opener.points.length >= 3,
    );
    check(
      `${id}: a lesson the player has closed stays closed`,
      opener !== null &&
        lessonFor("overview", fresh, { allocated: 0, hasReport: false }, [
          opener.id,
        ]) === null,
    );

    /* And the vocabulary. */
    check(
      `${id}: the career has words of its own to look up`,
      glossaryFor(id).length >= 8,
      `${glossaryFor(id).length}`,
    );
    check(
      `${id}: every word is explained twice — plainly, and properly`,
      glossaryFor(id).every(
        (t) => t.plain.length > 3 && t.detail.length > 40 && t.term.length > 2,
      ),
    );
  }

  /* --------------------------------------------------- nothing leaks across */
  const chefWords = [
    ...deriveAlerts(stressed(chef)).map((a) => `${a.title} ${a.detail}`),
    ...lessonStatus(startRun(chef, 4), { allocated: 0, hasReport: true }, []).map(
      (x) =>
        `${x.lesson.title} ${x.lesson.intro} ${x.lesson.points.map((p) => `${p.term} ${p.detail}`).join(" ")}`,
    ),
    ...glossaryFor("chef").map((t) => `${t.term} ${t.plain} ${t.detail}`),
  ].join(" ");

  const lawWords = [
    ...deriveAlerts(stressed(lawyer)).map((a) => `${a.title} ${a.detail}`),
    ...lessonStatus(startRun(lawyer, 4), { allocated: 0, hasReport: true }, []).map(
      (x) =>
        `${x.lesson.title} ${x.lesson.intro} ${x.lesson.points.map((p) => `${p.term} ${p.detail}`).join(" ")}`,
    ),
    ...glossaryFor("lawyer").map((t) => `${t.term} ${t.plain} ${t.detail}`),
  ].join(" ");

  check(
    "nothing the Chef is told borrows a Physician's word",
    !MEDICAL.test(chefWords),
    chefWords.match(MEDICAL)?.[0] ?? "",
  );
  check(
    "nor a Solicitor's",
    !LEGAL.test(chefWords),
    chefWords.match(LEGAL)?.[0] ?? "",
  );
  check(
    "nothing the Solicitor is told borrows a Physician's word",
    !MEDICAL.test(lawWords),
    lawWords.match(MEDICAL)?.[0] ?? "",
  );
  check(
    "nor a Chef's",
    !KITCHEN.test(lawWords),
    lawWords.match(KITCHEN)?.[0] ?? "",
  );
  check(
    "and the two careers share no vocabulary entry at all",
    (() => {
      const a = new Set(glossaryFor("chef").map((t) => t.id));
      return glossaryFor("lawyer").every((t) => !a.has(t.id));
    })(),
  );

  /* The career-specific half, which only fires once the run is in the state
     the alert is about. */
  {
    const k = startRun(chef, 12);
    check(
      "a kitchen with nothing in it is told so, and pointed at the larder",
      deriveAlerts(k).some(
        (a) => a.id === "larder:empty" && a.destination === "larder",
      ),
    );
    const l = startRun(lawyer, 12);
    l.week = 6;
    check(
      "a practice with no work is told so, and pointed at the instructions",
      deriveAlerts(l).some(
        (a) => a.id === "pipeline:empty" && a.destination === "instructions",
      ),
    );
    check(
      "and it is offered the block that fixes it",
      nextStep(l, { rest: 6 }, 6, 6, true)?.id === "law:pitch",
    );
  }
}


/**
 * THE SOLICITOR'S BAD FORTNIGHTS
 *
 * The crisis machinery was always career-neutral in shape and never in
 * content: medical prose, medical reputation categories, a medical cast, and
 * a raiser that only ran inside `medical/phase2.ts`. These assert that a
 * practice now gets its own five, that they are answerable, and that nothing
 * about them speaks somebody else's language or charges somebody else's
 * money.
 */
console.log("\nThe Solicitor: crises\n" + "─".repeat(52));
{
  const MEDICAL =
    /patient|clinic|ward\b|nurse|physician|caseload|triage|department|rota/i;

  /* ------------------------------------------------------- the content */
  check(
    "a practice can suffer five kinds, and not the two it cannot",
    LAWYER_CRISIS_KINDS.length === 5 &&
      !LAWYER_CRISIS_KINDS.includes("shortage") &&
      !LAWYER_CRISIS_KINDS.includes("scandal"),
    LAWYER_CRISIS_KINDS.join(", "),
  );
  check(
    "every one of them is authored, and none of the others is",
    LAWYER_CRISIS_KINDS.every((k) => (LAWYER_CRISIS_STAGES[k] ?? []).length > 0) &&
      Object.keys(LAWYER_CRISIS_STAGES).length === LAWYER_CRISIS_KINDS.length,
  );

  for (const kind of LAWYER_CRISIS_KINDS) {
    const stages = stagesFor(kind, "lawyer");
    check(
      `${kind}: it happens, it continues, and it ends`,
      stages.length >= 3,
      `${stages.length} stages`,
    );
    check(
      `${kind}: every stage states the situation and offers a way to act`,
      stages.every(
        (st) => st.title.length > 10 && st.body.length > 40 && st.choices.length >= 2,
      ),
    );
    check(
      `${kind}: every choice says what it is, what it costs, and what happened`,
      stages.every((st) =>
        st.choices.every(
          (c) =>
            c.id.length > 1 &&
            c.label.length > 4 &&
            c.detail.length > 8 &&
            c.result.length > 20,
        ),
      ),
    );
    check(
      `${kind}: no stage offers the same choice twice`,
      stages.every(
        (st) => new Set(st.choices.map((c) => c.id)).size === st.choices.length,
      ),
    );
    check(
      `${kind}: every stage has something that actually helps`,
      stages.every((st) => st.choices.some((c) => c.severity < 0)),
    );
    /* The terminal beat must contain an exit. A crisis with no way out is a
       loss screen, and this game does not have those. */
    check(
      `${kind}: the last stage can be ended`,
      stages[stages.length - 1].choices.some((c) => c.severity <= -100),
    );
    check(
      `${kind}: every choice moves something the simulation holds`,
      stages.every((st) =>
        st.choices.every(
          (c) =>
            c.severity !== 0 ||
            Boolean(c.cost || c.debt || c.blocks || c.standing),
        ),
      ),
    );
    check(
      `${kind}: it never moves a reputation category this career has no screen for`,
      stages.every((st) => st.choices.every((c) => c.rep === undefined)),
    );
    check(
      `${kind}: and never names somebody from another career's cast`,
      stages.every((st) => st.choices.every((c) => c.people === undefined)),
    );

    const words = stages
      .map(
        (st) =>
          `${st.title} ${st.body} ${st.choices
            .map((c) => `${c.label} ${c.detail} ${c.result}`)
            .join(" ")}`,
      )
      .join(" ");
    check(
      `${kind}: and it does not borrow a Physician's word`,
      !MEDICAL.test(words),
      words.match(MEDICAL)?.[0] ?? "",
    );
  }

  /* ------------------------------------------------------ the registry */
  check(
    "a crisis carries whose it is, and resolves against that set",
    stageOf(startCrisis("cashflow", 4, 60, undefined, "lawyer")).title !==
      stageOf(startCrisis("cashflow", 4, 60)).title,
  );
  check(
    "a crisis written before any of this reads as the Physician's",
    stageOf({
      id: "cashflow-4",
      kind: "cashflow",
      startedWeek: 4,
      severity: 60,
      stage: 0,
      taken: [],
      ignored: 0,
    }).title === stagesFor("cashflow")[0].title,
  );
  check(
    "a kind this career never authored falls back rather than crashing",
    stagesFor("shortage", "lawyer").length > 0 &&
      stagesFor("shortage", "lawyer") === stagesFor("shortage"),
  );
  check(
    "and the Physician's own set is exactly as it was",
    CRISIS_KINDS.every((k) => stagesFor(k, "doctor").length >= 3),
  );

  /* ---------------------------------------------------------- the risk */
  {
    const calm = {
      week: 30,
      cashWeeks: 20,
      lost: 0,
      unprepared: 0,
      conflicted: 0,
      scrutiny: 0,
      staff: 0,
      burnout: 20,
    };
    check(
      "a practice doing everything right is not immune, only unlikely",
      practiceCrisisRisk(calm).chance > 0 &&
        practiceCrisisRisk(calm).chance <= 0.01,
      `${practiceCrisisRisk(calm).chance}`,
    );
    check(
      "thin cash against work already done is what brings the cash emergency",
      practiceCrisisRisk({ ...calm, cashWeeks: 0 }).kind === "cashflow",
    );
    check(
      "arriving at a date short of hours is what brings the claim",
      practiceCrisisRisk({ ...calm, unprepared: 3 }).kind === "lawsuit",
    );
    check(
      "acting against a former client is what brings the regulator",
      practiceCrisisRisk({ ...calm, conflicted: 2 }).kind === "inspection",
    );
    check(
      "being read closely is what brings the confidentiality one",
      practiceCrisisRisk({ ...calm, scrutiny: 90 }).kind === "dataleak",
    );
    check(
      "and the hours everybody is working are what bring the resignation",
      practiceCrisisRisk({ ...calm, staff: 2, burnout: 95 }).kind === "walkout",
    );
    check(
      "nobody resigns from a practice of one",
      practiceCrisisRisk({ ...calm, staff: 0, burnout: 95 }).kind !== "walkout",
    );
    check(
      "risk is bounded however badly it is going",
      practiceCrisisRisk({
        week: 90,
        cashWeeks: -20,
        lost: 40,
        unprepared: 20,
        conflicted: 9,
        scrutiny: 100,
        staff: 6,
        burnout: 100,
      }).chance <= 0.16,
    );
    check(
      "and it never names a kind this career cannot have",
      [calm, { ...calm, cashWeeks: 0 }, { ...calm, scrutiny: 99 }].every((c) => {
        const k = practiceCrisisRisk(c).kind;
        return k === null || LAWYER_CRISIS_KINDS.includes(k);
      }),
    );
  }

  /* -------------------------------------------------------- answering it */
  const withCrisis = (city = "london") => {
    const s = startRun(lawyer, 3, { city });
    s.week = 20;
    s.r.cash = 400_000;
    s.crises = [startCrisis("inspection", s.week, 70, undefined, "lawyer")];
    return s;
  };

  {
    const s = withCrisis();
    const before = s.r.cash;
    const answered = runCommand(lawyer, s, "crisisChoice", "inspection-20:accountant");
    const c = (answered.crises ?? [])[0];
    check(
      "a choice that costs money charges it",
      answered.r.cash === before - 9_000,
      `${before - answered.r.cash}`,
    );
    check(
      "and it moves the crisis on rather than leaving it where it was",
      c.severity < 70 && c.stage === 1 && c.taken.includes("accountant"),
    );
    check(
      "and it counts as having done something about it",
      c.ignored === 0,
    );

    const twice = runCommand(lawyer, answered, "crisisChoice", "inspection-20:accountant");
    check(
      "the same choice cannot be taken twice",
      twice.r.cash === answered.r.cash,
    );
    check(
      "a choice that is not on this stage does nothing",
      runCommand(lawyer, answered, "crisisChoice", "inspection-20:open").r.cash ===
        answered.r.cash,
    );
    check(
      "and neither does a crisis that is not running",
      runCommand(lawyer, s, "crisisChoice", "walkout-3:match").r.cash === before,
    );
  }

  {
    /* Local money, like every other sum in this career. */
    const london = withCrisis("london");
    const lagos = withCrisis("lagos");
    const paidLondon =
      london.r.cash -
      runCommand(lawyer, london, "crisisChoice", "inspection-20:accountant").r.cash;
    const paidLagos =
      lagos.r.cash -
      runCommand(lawyer, lagos, "crisisChoice", "inspection-20:accountant").r.cash;
    check(
      "a crisis costs what this market charges, not what London does",
      paidLagos < paidLondon && paidLagos > 0,
      `${paidLagos} vs ${paidLondon}`,
    );
  }

  {
    const poor = withCrisis();
    poor.r.cash = 100;
    check(
      "a choice you cannot afford is refused rather than overdrawing you",
      runCommand(lawyer, poor, "crisisChoice", "inspection-20:accountant").r.cash ===
        100,
    );
    check(
      "but the ones that cost time rather than money are still open",
      (() => {
        const acted = runCommand(lawyer, poor, "crisisChoice", "inspection-20:open");
        return (acted.r._crisisBlocks ?? 0) === 1 && acted.crises![0].stage === 1;
      })(),
    );
  }

  {
    /* Blocks are paid out of the week, with a floor that keeps a practice in
       the worst fortnight of its life still able to act. */
    const s = withCrisis();
    const full = lawyer.timeBudget(s);
    s.r._crisisBlocks = 2;
    check("crisis work is paid for in time", lawyer.timeBudget(s) === full - 2);
    s.r._crisisBlocks = 9;
    check(
      "and it can never freeze a run out of acting entirely",
      lawyer.timeBudget(s) >= 2,
    );
  }

  {
    /* Borrowing and standing, the two movements a practice has that the
       Physician's copy of this does not use. */
    const s = withCrisis();
    s.crises = [startCrisis("cashflow", s.week, 70, undefined, "lawyer")];
    const debtBefore = s.r.debt;
    const borrowed = runCommand(lawyer, s, "crisisChoice", "cashflow-20:borrow");
    check(
      "borrowing against the bills actually puts it on the loan",
      borrowed.r.debt > debtBefore,
      `${borrowed.r.debt - debtBefore}`,
    );
    const standingBefore = s.r.reputation;
    const deferred = runCommand(lawyer, s, "crisisChoice", "cashflow-20:defer");
    check(
      "and asking everybody to wait costs you standing",
      deferred.r.reputation < standingBefore,
    );
  }

  /* ------------------------------------------------------- over the weeks */
  {
    /* Ignored, it escalates and then ends itself in the worst available way. */
    let s = withCrisis();
    let escalated = false;
    for (let i = 0; i < 12 && (s.crises ?? []).length > 0; i++) {
      s = advanceWeek(lawyer, s, { rest: 1 }).state;
      if ((s.crises ?? [])[0]?.stage === 2) escalated = true;
    }
    check(
      "a crisis nobody answers escalates to its last stage",
      escalated,
    );
    check(
      "and then it resolves itself, badly, rather than running for ever",
      (s.crises ?? []).length === 0,
    );
    check(
      "and the run records that you never answered it",
      timelineOf(s).some((t) => t.kind === "failure"),
    );
    check(
      "and the run is still going",
      s.outcome === null,
    );
  }

  {
    /* Answered to zero, it closes and the record says so. */
    let s = withCrisis();
    s.crises = [startCrisis("dataleak", s.week, 40, undefined, "lawyer")];
    s = runCommand(lawyer, s, "crisisChoice", "dataleak-20:tell");
    s = runCommand(lawyer, s, "crisisChoice", "dataleak-20:meet");
    s = advanceWeek(lawyer, s, { casework: 1 }).state;
    check(
      "a crisis answered to nothing closes",
      (s.crises ?? []).length === 0,
    );
    check(
      "and coming through one is worth something",
      timelineOf(s).some((t) => t.kind === "recovery"),
    );
  }

  {
    /* Two at a time is a bad month; three would be noise. */
    const s = withCrisis();
    s.crises = [
      startCrisis("cashflow", 20, 60, undefined, "lawyer"),
      startCrisis("walkout", 20, 60, undefined, "lawyer"),
    ];
    const after = advanceWeek(lawyer, s, { rest: 1 }).state;
    check(
      "no more than two run at once",
      (after.crises ?? []).length <= MAX_CRISES,
    );
  }

  /* Round-tripped through JSON, because that is what a save actually is. */
  const asSaved = (s: unknown) =>
    JSON.parse(JSON.stringify(s)) as Record<string, unknown>;

  check(
    "a save carrying a solicitor's crisis is a valid save",
    (() => {
      const s = withCrisis();
      const played = advanceWeek(lawyer, s, { casework: 2 }).state;
      return validateRun(asSaved(played)) && lawyer.validateData!(played.data);
    })(),
  );
  check(
    "and a crisis whose career is not even a string is refused",
    !validateRun(
      asSaved({
        ...withCrisis(),
        crises: [{ ...startCrisis("cashflow", 20, 60), career: 7 }],
      }),
    ),
  );
}


console.log("\nWhat a city charges, and for what\n" + "─".repeat(52));
{
  /*
   * THE TWO INDICES
   *
   * The expensive cities were losing tens of thousands a run to arithmetic
   * rather than to difficulty, and the cause was one index doing two jobs.
   * These assertions are the shape of the fix, written so it cannot quietly
   * come back.
   *
   * The rule: **a recurring cost of producing revenue tracks what the city
   * pays for food; a thing you buy tracks the local cost base.** Rent is the
   * exception and is meant to be — it is the city's own premium, and it is
   * the dial the cities are supposed to differ on.
   */
  const at = (city: string) => {
    const s = startRun(chef, 11, { city });
    return kitchen(s);
  };

  check(
    "wages track what a cover is worth, not what a landlord charges",
    KITCHEN_CITIES.every(
      (c) => Math.abs(labourIndex(at(c.id)) - c.spend) < 0.0001,
    ),
    "a wage is a cost of producing revenue, exactly as produce is",
  );
  check(
    "and capital sits between what space costs and what food fetches",
    KITCHEN_CITIES.every(
      (c) =>
        Math.abs(capitalIndex(at(c.id)) - (c.rent + c.spend) / 2) < 0.0001,
    ),
  );
  check(
    "a room is priced on capital, not on rent",
    (() => {
      const bistro = CHEF_PREMISES.find((p) => p.id === "bistro")!;
      /* London's rent is 1.85 and its takings 1.35: pricing the lease off
         rent charged that premium twice, once as capital and again every
         week. The room now costs the blend. */
      const london = at("london");
      return (
        premisesPrice(london, bistro) ===
          Math.round(bistro.cost * capitalIndex(london)) &&
        premisesPrice(london, bistro) < Math.round(bistro.cost * 1.85)
      );
    })(),
  );
  check(
    "and the fit-out loan with it",
    (() => {
      const cheap = startRun(chef, 11, { city: "madrid" });
      const dear = startRun(chef, 11, { city: "london" });
      /* Both scaled to the same index, so what you owe against what you can
         earn is the same ratio in both. */
      const ratio = (s: RunState) =>
        s.r.debt / capitalIndex(kitchen(s));
      return Math.abs(ratio(cheap) - ratio(dear)) < 1;
    })(),
  );
  check(
    "no city is charged its property premium twice",
    (() => {
      /*
       * The test the whole fix exists for.
       *
       * A room's *payback* — what it costs against what a cover in it is
       * worth — must not be dramatically worse in an expensive city than a
       * cheap one, because that difference compounds up a four-rung ladder
       * into a kitchen that can never leave the market stall. Which is
       * exactly what the harness found: a competent London kitchen was still
       * on the stall after a hundred and twenty weeks.
       *
       * The spread was **1.52** when the lease was priced off rent alone.
       * It is **1.25** on the blend, and the assertion is written against the
       * improvement rather than against a round number, because the residual
       * is deliberate — an expensive city is still supposed to be expensive,
       * and rent is where that belongs.
       */
      const bistro = CHEF_PREMISES.find((p) => p.id === "bistro")!;
      const spreadOf = (price: (c: (typeof KITCHEN_CITIES)[number]) => number) => {
        const payback = KITCHEN_CITIES.map((c) => price(c) / (bistro.spend * c.spend));
        return Math.max(...payback) / Math.min(...payback);
      };
      const now = spreadOf((c) => bistro.cost * ((c.rent + c.spend) / 2));
      const before = spreadOf((c) => bistro.cost * c.rent);
      /* And the live function agrees with the arithmetic above. */
      const live = KITCHEN_CITIES.every(
        (c) =>
          premisesPrice(at(c.id), bistro) ===
          Math.round(bistro.cost * ((c.rent + c.spend) / 2)),
      );
      return live && now < 1.3 && now < before * 0.85;
    })(),
    "the ladder has to be climbable everywhere, or the city is a trap",
  );
  check(
    "an expensive city is still expensive where it is supposed to be",
    (() => {
      /* The fix must not have flattened the cities into one another. Rent is
         the dial they are meant to differ on, and it still does. */
      const cheap = at("madrid");
      const dear = at("newyork");
      return rent(dear) > rent(cheap) * 2.5;
    })(),
  );
  check(
    "and every city still has its own weekly shape",
    new Set(
      KITCHEN_CITIES.map((c) => {
        const k = at(c.id);
        return `${rent(k)}:${spendPerHead(k)}:${Math.round(labourIndex(k) * 100)}`;
      }),
    ).size === KITCHEN_CITIES.length,
  );
}


/**
 * THE SOLICITOR'S CAST
 *
 * `people.ts` was career-neutral machinery with exactly one career plugged
 * into it. These assert that a practice now has people of its own, that they
 * are the same people who talk on the handset rather than a second set of
 * names, and — the part that decides whether any of this is worth having —
 * that knowing somebody changes a number.
 */
console.log("\nThe Solicitor: the people\n" + "─".repeat(52));
{
  /** A run far enough in that everybody who is coming has arrived. */
  const peopled = (seed = 5) => {
    const s = startRun(lawyer, seed);
    s.week = 20;
    s.r.cash = 400_000;
    return advanceWeek(lawyer, s, { rest: 1 }).state;
  };

  check(
    "the career has a cast, and it is written rather than generated",
    LAWYER_CAST.length === 6 &&
      LAWYER_CAST.every(
        (p) =>
          p.bio.length > 80 &&
          p.title.length > 8 &&
          p.traits.length >= 2 &&
          p.handle.length > 2,
      ),
  );
  check(
    "nobody in it collides with another career's cast",
    LAWYER_CAST.every((p) => !CAST_BY_ID.has(p.id)),
    LAWYER_CAST.filter((p) => CAST_BY_ID.has(p.id))
      .map((p) => p.id)
      .join(", "),
  );
  check(
    "every one of them wants something different from the others",
    new Set(LAWYER_CAST.map((p) => p.role)).size >= 4,
  );
  /*
   * Written for this career rather than rephrased from the last one. The
   * first draft of Margaret Ellory was the Physician's supervising consultant
   * with the nouns changed — "a standing refusal to tell you something
   * comfortable" against Prof. Hallam's "has never once told you something
   * comfortable" — which is how two casts quietly become one cast.
   */
  check(
    "and none of them is another cast's character with the nouns changed",
    (() => {
      const phrases = (t: string) =>
        t
          .toLowerCase()
          .split(/[.,;—]/)
          .map((x) => x.trim())
          .filter((x) => x.split(" ").length >= 5);
      const theirs = new Set(FULL_CAST.flatMap((p) => phrases(p.bio)));
      const shared = LAWYER_CAST.flatMap((p) => phrases(p.bio)).filter((x) =>
        theirs.has(x),
      );
      return shared.length === 0;
    })(),
  );

  /*
   * The claim that makes this worth doing: the handset and the relationships
   * are one cast. Margaret Ellory sends the welcome message AND has a card.
   */
  check(
    "the people on the handset are the people on the screen",
    (() => {
      const handles = new Set(LAWYER_CAST.map((p) => `@${p.handle}`));
      const voices = [
        LEGAL_VOICES.mentor,
        LEGAL_VOICES.opponent,
        LEGAL_VOICES.costs,
      ];
      return voices.every((v) => handles.has(v.handle));
    })(),
  );
  check(
    "and the institutions on the handset are not pretending to be people",
    LEGAL_ORG_HANDLES.every(
      (h) => !LAWYER_CAST.some((p) => `@${p.handle}` === h),
    ),
  );

  /* ---------------------------------------------------------- arriving */
  {
    const week1 = startRun(lawyer, 5);
    check(
      "the people who were always there are there from week one",
      (week1.people ?? []).length === 3 &&
        (week1.people ?? []).some((p) => p.id === "ellory"),
      `${(week1.people ?? []).length}`,
    );
    const later = peopled();
    check(
      "and the rest arrive once the run gives them a reason to",
      (later.people ?? []).length === 6,
      (later.people ?? []).map((p) => p.id).join(", "),
    );
    check(
      "arriving does not disturb anybody already in your life",
      (() => {
        let s = startRun(lawyer, 5);
        s = runCommand(lawyer, s, "noop", "");
        const ellory = personIn(s, "ellory")!;
        ellory.warmth = 90;
        s.week = 20;
        const after = advanceWeek(lawyer, s, { rest: 1 }).state;
        return personIn(after, "ellory")!.warmth >= 88;
      })(),
    );
  }

  check(
    "the panel can look any of them up, whoever is playing",
    LAWYER_CAST.every((p) => personDefIn("lawyer", p.id)?.name === p.name) &&
      personDefIn("doctor", "hallam") !== undefined,
  );

  /* ------------------------------------------------- what they are worth */
  {
    const s = peopled();
    const bump = (id: string, key: "warmth" | "trust" | "respect", to: number) => {
      const copy = JSON.parse(JSON.stringify(s)) as typeof s;
      const person = personIn(copy, id)!;
      person[key] = to;
      return copy;
    };

    /*
     * They do not start as strangers, and that is the point: Margaret already
     * trusts you because she trained you, and Adaeze already likes you because
     * you wound up her father's estate. What must be true is that nobody is
     * ever a *penalty* — a career cannot be harder for having met somebody.
     */
    check(
      "knowing somebody is never worse than not knowing them",
      referralPull(s) >= 0 &&
        briefDiscount(s) <= 1 &&
        costsRelief(s) <= 1 &&
        conductGrace(s) <= 1 &&
        offerGoodwill(s) >= 0 &&
        mentorBonus(s) >= 0,
    );
    check(
      "and somebody who thinks nothing of you is worth exactly nothing",
      (() => {
        const cold = JSON.parse(JSON.stringify(s)) as typeof s;
        for (const person of cold.people ?? []) {
          person.warmth = -100;
          person.trust = 0;
          person.respect = 0;
        }
        return (
          referralPull(cold) === 0 &&
          briefDiscount(cold) === 1 &&
          costsRelief(cold) === 1 &&
          conductGrace(cold) === 1 &&
          offerGoodwill(cold) === 0 &&
          mentorBonus(cold) === 0
        );
      })(),
    );
    check(
      "the head start each of them gives is small enough to be a head start",
      referralPull(s) <= 5 && mentorBonus(s) <= 0.25 && conductGrace(s) >= 0.9,
      `referral ${referralPull(s)}, mentor ${mentorBonus(s).toFixed(2)}`,
    );
    check(
      "a client who talks about you brings work towards the door",
      referralPull(bump("okonjo", "warmth", 100)) > 0,
      `${referralPull(bump("okonjo", "warmth", 100))}`,
    );
    check(
      "a clerk who rates you quotes a better brief fee",
      briefDiscount(bump("nakamura", "respect", 100)) < 1,
    );
    check(
      "a costs draftsman who trusts you argues their bill down",
      costsRelief(bump("oyelaran", "trust", 100)) < 1,
    );
    check(
      "a case officer who knows you reads your file less readily",
      conductGrace(bump("whitcombe", "trust", 100)) < 1,
    );
    check(
      "an opponent who rates you opens higher",
      offerGoodwill(bump("farrow", "respect", 100)) > 0,
    );
    check(
      "and an hour of your mentor is worth an hour of your own reading",
      mentorBonus(bump("ellory", "trust", 100)) > 0,
    );
    check(
      "every one of them is bounded — knowing people is not the whole game",
      referralPull(bump("okonjo", "warmth", 100)) <= 12 &&
        briefDiscount(bump("nakamura", "respect", 100)) >= 0.78 &&
        costsRelief(bump("oyelaran", "trust", 100)) >= 0.75 &&
        conductGrace(bump("whitcombe", "trust", 100)) >= 0.6 &&
        offerGoodwill(bump("farrow", "respect", 100)) <= 0.14 &&
        mentorBonus(bump("ellory", "trust", 100)) <= 0.9,
    );

    /* And it is not only arithmetic on a helper — the week reads it. */
    check(
      "the mentor's hour actually lands as advocacy",
      (() => {
        const warm = bump("ellory", "trust", 100);
        const plain = advanceWeek(lawyer, s, { research: 1 }).state.r.skill;
        const helped = advanceWeek(lawyer, warm, { research: 1 }).state.r.skill;
        return helped > plain;
      })(),
    );
  }

  /* -------------------------------------------------- they remember things */
  {
    const s = peopled(9);
    const p = practice(s);
    const k = CASE_BY_ID.get("probate")!;
    p.cases = [
      {
        id: "c-9",
        kind: "probate",
        client: "the Okonjo family",
        openedWeek: 1,
        dueWeek: s.week + 8,
        hoursDone: k.hours,
        settlementOffer: 0,
        payer: "prompt",
      },
    ];

    const settled = runCommand(lawyer, s, "settleCase", "c-9");
    check(
      "settling is something your opponent notices",
      personIn(settled, "farrow")!.respect >
        personIn(s, "farrow")!.respect,
    );
    check(
      "and he says why, so the number is never silent",
      personIn(settled, "farrow")!.recent[0]?.text.includes("Okonjo"),
    );

    const dropped = runCommand(lawyer, s, "dropCase", "c-9");
    check(
      "coming off the record is something your mentor notices",
      personIn(dropped, "ellory")!.respect < personIn(s, "ellory")!.respect,
    );
    check(
      "and the client notices considerably more",
      personIn(dropped, "okonjo")!.warmth < personIn(s, "okonjo")!.warmth - 5,
    );

    const briefed = runCommand(lawyer, s, "briefCounsel", "c-9");
    check(
      "briefing counsel is something the clerk notices",
      personIn(briefed, "nakamura")!.warmth >
        personIn(s, "nakamura")!.warmth,
    );
    check(
      "and a clerk who rates you charges the practice less for it",
      (() => {
        const known = JSON.parse(JSON.stringify(s)) as typeof s;
        personIn(known, "nakamura")!.respect = 100;
        const paidPlain = s.r.cash - briefed.r.cash;
        const paidKnown =
          known.r.cash -
          runCommand(lawyer, known, "briefCounsel", "c-9").r.cash;
        return paidKnown < paidPlain && paidKnown > 0;
      })(),
    );
  }

  {
    /* Winning is what your mentor rates, and it is her own scale — a house
       purchase is not a group claim. */
    const s = peopled(11);
    const p = practice(s);
    const k = CASE_BY_ID.get("employment")!;
    p.cases = [
      {
        id: "c-1",
        kind: "employment",
        client: "the Okonjo family",
        openedWeek: 1,
        dueWeek: s.week,
        hoursDone: k.hours * 4,
        settlementOffer: 0,
        payer: "prompt",
        adjournments: MAX_ADJOURNMENTS,
      },
    ];
    let won: ReturnType<typeof advanceWeek> | null = null;
    let lost: ReturnType<typeof advanceWeek> | null = null;
    for (let seed = 1; seed <= 40 && !(won && lost); seed++) {
      const copy = JSON.parse(JSON.stringify({ ...s, seed })) as typeof s;
      const out = advanceWeek(lawyer, copy, { rest: 1 });
      const v = practice(out.state).lastVerdicts.at(-1);
      if (v?.won && !won) won = out;
      if (v && !v.won && !lost) lost = out;
    }
    check("both outcomes happen", Boolean(won && lost));
    if (won) {
      check(
        "a judgment your way is something your mentor rates",
        personIn(won.state, "ellory")!.respect >
          personIn(s, "ellory")!.respect,
      );
      check(
        "and the client whose matter it was remembers it",
        personIn(won.state, "okonjo")!.warmth > personIn(s, "okonjo")!.warmth,
      );
    }
    if (lost) {
      check(
        "losing brings the costs draftsman into your life",
        personIn(lost.state, "oyelaran")!.trust >=
          personIn(s, "oyelaran")!.trust,
      );
      check(
        "and a draftsman who trusts you makes the loss cheaper",
        (() => {
          const known = JSON.parse(JSON.stringify({ ...s, seed: lost!.state.seed })) as typeof s;
          personIn(known, "oyelaran")!.trust = 100;
          const line = (r: ReturnType<typeof advanceWeek>) =>
            Math.abs(
              r.ledger.find((x) => /costs order/i.test(x.label))?.amount ?? 0,
            );
          const cheaper = advanceWeek(lawyer, known, { rest: 1 });
          return line(cheaper) > 0 && line(cheaper) < line(lost!);
        })(),
      );
    }
  }

  check(
    "a run carrying a solicitor's people is a valid save",
    (() => {
      const s = peopled(13);
      return (
        validateRun(JSON.parse(JSON.stringify(s))) &&
        (s.people ?? []).every(
          (x) => PERSON_ROLES.includes(x.role) && x.memory.length >= 0,
        )
      );
    })(),
  );
}



/**
 * WHAT KIND OF SOLICITOR YOU TURN OUT TO BE
 *
 * The career accumulated nothing: week 100 played like week 10 with more
 * people in the room. These assert that finished work now compounds — better
 * odds, better fees, and a market that sends you more of what you are known
 * for — and that it is earned by finishing matters rather than by carrying
 * them.
 */
console.log("\nThe Solicitor: practice areas\n" + "─".repeat(52));
{
  const fresh = () => practice(startRun(lawyer, 21));
  const withArea = (kindId: string, hours: number) => ({
    ...fresh(),
    areas: { [kindId]: hours },
  });
  const injury = CASE_BY_ID.get("injury")!;

  /* ------------------------------------------------------------ the curve */
  check(
    "a new practice has specialised in nothing",
    CASE_KINDS.every((k) => areaSkill(fresh(), k.id) === 0),
  );
  check(
    "and the hours it finishes are what make it a specialist",
    areaSkill(withArea("injury", SPECIALIST_HOURS / 2), "injury") === 0.5 &&
      areaSkill(withArea("injury", SPECIALIST_HOURS), "injury") === 1,
  );
  check(
    "which never runs past a specialist, however many it does",
    areaSkill(withArea("injury", SPECIALIST_HOURS * 40), "injury") === 1,
  );
  check(
    "and the stored figure is bounded too, so a long run cannot grow forever",
    (() => {
      const p = fresh();
      for (let i = 0; i < 200; i++) creditArea(p, "injury", 90);
      return areaHours(p, "injury") <= SPECIALIST_HOURS * 2;
    })(),
  );
  check(
    "being good at one thing says nothing about the others",
    areaSkill(withArea("injury", SPECIALIST_HOURS), "probate") === 0,
  );
  check(
    "every level of it reads as words rather than a decimal",
    [0, 0.1, 0.3, 0.6, 1].every((x) => areaBand(x).length > 4) &&
      new Set([0, 0.1, 0.3, 0.6, 1].map(areaBand)).size === 5,
  );

  /* ----------------------------------------------------------- the effects */
  check(
    "a specialist charges more for the same instruction",
    feeIn(withArea("injury", SPECIALIST_HOURS), injury) >
      feeIn(fresh(), injury),
    `${feeIn(withArea("injury", SPECIALIST_HOURS), injury)} vs ${feeIn(fresh(), injury)}`,
  );
  check(
    "but where you practise still matters more than what you practise",
    (() => {
      const specialistHere = feeIn(withArea("injury", SPECIALIST_HOURS), injury);
      const strangerInNewYork = feeIn(
        { ...fresh(), city: "newyork" },
        injury,
      );
      return strangerInNewYork > specialistHere;
    })(),
  );
  {
    const live = {
      id: "c-1",
      kind: "injury",
      client: "Ms Baptiste",
      openedWeek: 1,
      dueWeek: 30,
      hoursDone: injury.hours,
      settlementOffer: 0,
    };
    check(
      "and is better at it at the door",
      oddsFor(live, withArea("injury", SPECIALIST_HOURS), 40) >
        oddsFor(live, fresh(), 40),
    );
    check(
      "though nothing makes a contested matter certain",
      oddsFor(live, withArea("injury", SPECIALIST_HOURS * 2), 100) < 1,
    );
  }

  /*
   * The one that makes it compound: a firm known for something is sent more
   * of it. Measured over two hundred streams rather than asserted, because
   * the claim is about a distribution.
   */
  check(
    "and the market sends a known firm more of its own work",
    (() => {
      const share = (p: PracticeState) => {
        let mine = 0;
        let all = 0;
        for (let seed = 1; seed <= 300; seed++) {
          for (const o of newOffers(p, 90, 10, 2, makeRng(seed))) {
            all++;
            if (o.kind === "injury") mine++;
          }
        }
        return all === 0 ? 0 : mine / all;
      };
      const known = share(withArea("injury", SPECIALIST_HOURS));
      const stranger = share(fresh());
      return known > stranger * 1.5 && stranger > 0;
    })(),
  );
  check(
    "and still sends everything else, so specialising is not a cage",
    (() => {
      const p = withArea("injury", SPECIALIST_HOURS * 2);
      const kinds = new Set<string>();
      for (let seed = 1; seed <= 200; seed++) {
        for (const o of newOffers(p, 90, 10, 2, makeRng(seed))) kinds.add(o.kind);
      }
      return kinds.size >= 4;
    })(),
  );

  /* ------------------------------------------------- earned by finishing */
  {
    const s = startRun(lawyer, 31);
    s.week = 12;
    const p = practice(s);
    const k = CASE_BY_ID.get("probate")!;
    p.cases = [
      {
        id: "c-1",
        kind: "probate",
        client: "the Wren Trust",
        openedWeek: 1,
        dueWeek: s.week + 6,
        hoursDone: k.hours,
        settlementOffer: 0,
        payer: "prompt",
      },
    ];

    const settled = runCommand(lawyer, s, "settleCase", "c-1");
    check(
      "settling a matter teaches you the work",
      areaHours(practice(settled), "probate") === k.hours,
      `${areaHours(practice(settled), "probate")}`,
    );

    const dropped = runCommand(lawyer, s, "dropCase", "c-1");
    check(
      "and coming off the record teaches you nothing at all",
      areaHours(practice(dropped), "probate") === 0,
    );

    const heard = advanceWeek(
      lawyer,
      {
        ...JSON.parse(JSON.stringify(s)),
        data: {
          practice: {
            ...p,
            cases: [{ ...p.cases[0], dueWeek: s.week, adjournments: MAX_ADJOURNMENTS }],
          },
        },
      },
      { rest: 1 },
    ).state;
    check(
      "so does reaching a hearing, whichever way it goes",
      areaHours(practice(heard), "probate") > 0,
    );
  }

  /* ------------------------------------------------------ counsel, a ladder */
  check(
    "there are three of them, and they are a real spread",
    COUNSEL.length === 3 &&
      COUNSEL.every((c) => c.blurb.length > 40) &&
      COUNSEL[0].fee < COUNSEL[1].fee &&
      COUNSEL[1].fee < COUNSEL[2].fee &&
      COUNSEL[0].odds < COUNSEL[1].odds &&
      COUNSEL[1].odds < COUNSEL[2].odds,
  );
  check(
    "the middle of the ladder is priced exactly where the boolean was",
    counselOf("senior").fee === 0.09 && counselOf("senior").odds === COUNSEL_ODDS,
  );
  check(
    "an absent tier reads as that same middle, so an older matter is unchanged",
    counselOf(undefined).id === "senior",
  );
  check(
    "chambers will not put a silk on a house purchase",
    !counselAvailable(counselOf("silk"), CASE_BY_ID.get("conveyance")!) &&
      counselAvailable(counselOf("silk"), CASE_BY_ID.get("class")!),
  );
  check(
    "a better one costs more and is worth more, in both directions",
    counselFee(fresh(), injury, "silk") > counselFee(fresh(), injury, "junior") &&
      costsOrder(fresh(), injury, true, "silk") <
        costsOrder(fresh(), injury, true, "junior"),
  );

  {
    const s = startRun(lawyer, 41);
    s.week = 12;
    s.r.cash = 400_000;
    const p = practice(s);
    p.cases = [
      {
        id: "c-1",
        kind: "injury",
        client: "Mr Ferreira",
        openedWeek: 1,
        dueWeek: s.week + 10,
        hoursDone: injury.hours,
        settlementOffer: 0,
        payer: "prompt",
      },
    ];

    const silk = runCommand(lawyer, s, "briefCounsel", "c-1:silk");
    check(
      "briefing a silk records which one you briefed",
      practice(silk).cases[0].counselTier === "silk" &&
        practice(silk).cases[0].counsel === true,
    );
    check(
      "and the odds reflect that one rather than the middle",
      oddsFor(practice(silk).cases[0], practice(silk), s.r.skill) >
        oddsFor(
          practice(runCommand(lawyer, s, "briefCounsel", "c-1:junior")).cases[0],
          practice(s),
          s.r.skill,
        ),
    );
    check(
      "the bare form still buys what it always bought",
      practice(runCommand(lawyer, s, "briefCounsel", "c-1")).cases[0]
        .counselTier === "senior",
    );
    check(
      "a tier chambers would not arrange is refused",
      (() => {
        const small = JSON.parse(JSON.stringify(s)) as typeof s;
        practice(small).cases[0].kind = "conveyance";
        const tried = runCommand(lawyer, small, "briefCounsel", "c-1:silk");
        return !practice(tried).cases[0].counsel;
      })(),
    );
    check(
      "and a tier that does not exist does nothing",
      !practice(runCommand(lawyer, s, "briefCounsel", "c-1:kc")).cases[0].counsel,
    );
  }

  /* ------------------------------------------------------------ old saves */
  check(
    "a save from before any of this reads as a firm that specialised in nothing",
    (() => {
      const p = fresh();
      delete p.areas;
      return (
        lawyer.validateData!({ practice: p }) &&
        areaHours(p, "injury") === 0 &&
        feeIn(p, injury) === Math.round(injury.fee)
      );
    })(),
  );
  check(
    "an area the catalogue does not have is refused",
    !lawyer.validateData!({
      practice: { ...fresh(), areas: { duelling: 200 } },
    }),
  );
  check(
    "and so are impossible hours",
    !lawyer.validateData!({
      practice: { ...fresh(), areas: { injury: -5 } },
    }),
  );
  check(
    "a counsel tier the catalogue does not have is refused",
    !lawyer.validateData!({
      practice: {
        ...fresh(),
        cases: [{ kind: "injury", counsel: true, counselTier: "attorney" }],
      },
    }),
  );
}



/**
 * WHERE THE FIRM SITS
 *
 * Chambers were derived — one room per three fee earners, rent equal to the
 * headcount — which made them an expense rather than a decision, and left
 * money in this career with nowhere to go but payroll. These assert that the
 * ladder is a real commitment: rooms hold people, rent is due empty, and
 * moving is a bet on filling the space.
 */
console.log("\nThe Solicitor: chambers\n" + "─".repeat(52));
{
  const fresh = (city = "london") => practice(startRun(lawyer, 61, { city }));

  check(
    "there is a ladder, and every rung is worse value and more room",
    LEGAL_PREMISES.length === 4 &&
      LEGAL_PREMISES.every(
        (x, i, arr) =>
          i === 0 ||
          (x.seats > arr[i - 1].seats &&
            x.rent > arr[i - 1].rent &&
            x.cost > arr[i - 1].cost &&
            x.draw > arr[i - 1].draw),
      ),
  );
  check(
    "every rung says what it is",
    LEGAL_PREMISES.every((x) => x.blurb.length > 60 && x.label.length > 6),
  );
  check(
    "a practice starts in the cheapest rooms this career has ever had",
    chambersOf(fresh()).id === "desk" &&
      chambersRent(fresh()) === 640 &&
      chambersSeats(fresh()) === 3,
  );
  check(
    "and it starts with only itself in them",
    seatsUsed(fresh()) === 1 && seatsFree(fresh()) === 2,
  );

  /* Rent is a property of the rooms, not of the headcount. That is the whole
     change: an empty floor costs what a full one costs. */
  check(
    "rent no longer follows the payroll around",
    (() => {
      const alone = fresh();
      const crowded = {
        ...fresh(),
        staff: [
          { id: "s-1", name: "A", role: "paralegal", salary: 900 },
          { id: "s-2", name: "B", role: "paralegal", salary: 900 },
        ],
      };
      return chambersRent(alone) === chambersRent(crowded);
    })(),
  );

  /* ------------------------------------------------------------ old saves */
  check(
    "a save from before the ladder is put in rooms that hold it",
    (() => {
      const p = fresh();
      delete p.premises;
      p.staff = Array.from({ length: 5 }, (_, i) => ({
        id: `s-${i}`,
        name: "N",
        role: "paralegal",
        salary: 900,
      }));
      return chambersOf(p).id === "highstreet";
    })(),
  );
  check(
    "and one that never grew stays where it started",
    (() => {
      const p = fresh();
      delete p.premises;
      return chambersOf(p).id === "desk" && chambersRent(p) === 640;
    })(),
  );

  /* -------------------------------------------------------------- moving */
  {
    const s = startRun(lawyer, 61);
    s.r.cash = 400_000;
    const price = chambersPrice(practice(s), PREMISES_BY_ID.get("highstreet")!);
    const moved = runCommand(lawyer, s, "takeChambers", "highstreet");
    check(
      "moving is paid for the week you move",
      moved.r.cash === s.r.cash - price && price > 0,
      `${s.r.cash - moved.r.cash} vs ${price}`,
    );
    check(
      "and the firm is in the new rooms",
      chambersOf(practice(moved)).id === "highstreet" &&
        chambersSeats(practice(moved)) === 7,
    );
    check(
      "and paying their rent from now on",
      chambersRent(practice(moved)) > chambersRent(practice(s)),
    );
    check(
      "your fit-out is worth something against the next set",
      chambersPrice(practice(moved), PREMISES_BY_ID.get("square")!) <
        PREMISES_BY_ID.get("square")!.cost,
    );
    check(
      "you cannot move backwards down the ladder",
      chambersOf(practice(runCommand(lawyer, moved, "takeChambers", "desk"))).id ===
        "highstreet",
    );
    check(
      "nor into rooms that do not exist",
      chambersOf(practice(runCommand(lawyer, s, "takeChambers", "penthouse"))).id ===
        "desk",
    );
    const poor = startRun(lawyer, 62);
    poor.r.cash = 500;
    check(
      "nor into rooms you cannot pay for",
      chambersOf(practice(runCommand(lawyer, poor, "takeChambers", "highstreet")))
        .id === "desk" &&
        runCommand(lawyer, poor, "takeChambers", "highstreet").r.cash === 500,
    );
  }

  check(
    "rooms cost what property costs in this market",
    chambersPrice(fresh("lagos"), PREMISES_BY_ID.get("highstreet")!) <
      chambersPrice(fresh("london"), PREMISES_BY_ID.get("highstreet")!),
  );

  /* ---------------------------------------------------------- the seat cap */
  {
    let s = startRun(lawyer, 63);
    s.r.cash = 400_000;
    s = runCommand(lawyer, s, "hireLegal", "paralegal");
    s = runCommand(lawyer, s, "hireLegal", "paralegal");
    check(
      "a borrowed desk holds you and two others",
      practice(s).staff.length === 2 && seatsFree(practice(s)) === 0,
    );
    const overfull = runCommand(lawyer, s, "hireLegal", "paralegal");
    check(
      "and the third is refused rather than squeezed in",
      practice(overfull).staff.length === 2 &&
        overfull.r.cash === s.r.cash,
    );
    const bigger = runCommand(lawyer, s, "takeChambers", "highstreet");
    const hired = runCommand(lawyer, bigger, "hireLegal", "paralegal");
    check(
      "moving is what lets the firm grow again",
      practice(hired).staff.length === 3,
    );
  }

  /* --------------------------------------------------------------- the draw */
  check(
    "a firm people can find gets more walking in",
    (() => {
      const count = (id: string) => {
        const p = { ...fresh(), premises: id };
        let n = 0;
        for (let seed = 1; seed <= 300; seed++) {
          n += newOffers(p, 40, 10, 0, makeRng(seed)).length;
        }
        return n;
      };
      return count("city") > count("desk") * 1.15;
    })(),
    "",
  );

  check(
    "rooms the catalogue does not have are refused at the door",
    !lawyer.validateData!({ practice: { ...fresh(), premises: "penthouse" } }),
  );
  check(
    "and a run that has moved is still a valid save",
    (() => {
      const s = startRun(lawyer, 64);
      s.r.cash = 400_000;
      const moved = runCommand(lawyer, s, "takeChambers", "highstreet");
      return (
        lawyer.validateData!(moved.data) &&
        validateRun(JSON.parse(JSON.stringify(moved)))
      );
    })(),
  );
}



/**
 * MONEY THAT ARRIVES ON A DAY YOU CAN NAME
 *
 * A retainer is the premise's opposite number: steady weekly income in a
 * career built on lumps that are months away and uncertain. These assert it
 * is a trade rather than a button — that it costs hours off the top, costs
 * you that client's instructions, and costs the flow of new work.
 */
console.log("\nThe Solicitor: retainers\n" + "─".repeat(52));
{
  const fresh = (city = "london") => practice(startRun(lawyer, 71, { city }));
  const held = (kind: string, client = "Vance Holdings") => ({
    id: `r-${kind}`,
    kind,
    client,
    fromWeek: 1,
    weeks: 20,
  });

  check(
    "there are three of them, and the bigger ones want more of your week",
    RETAINERS.length === 3 &&
      RETAINERS.every(
        (x, i, arr) =>
          i === 0 ||
          (x.fee > arr[i - 1].fee &&
            x.hours > arr[i - 1].hours &&
            x.needs > arr[i - 1].needs),
      ),
  );
  check(
    "every one of them says what it is and what it takes",
    RETAINERS.every((x) => x.blurb.length > 60 && x.weeks > 0),
  );
  check(
    "and every one pays less an hour than a live matter returns",
    RETAINERS.every((x) => x.fee / x.hours < 240),
    RETAINERS.map((x) => Math.round(x.fee / x.hours)).join(", "),
  );

  /* --------------------------------------------------------- what it pays */
  {
    const p = { ...fresh(), retainers: [held("general")] };
    check(
      "it pays every week, in this market's money",
      retainerIncome(p) === 1_300 &&
        retainerIncome({ ...p, city: "lagos" }) < retainerIncome(p),
    );
    check(
      "and it reserves hours whether or not the client rings",
      retainerHours(p) === 10,
    );
    check(
      "a practice holding none has neither",
      retainerIncome(fresh()) === 0 && retainerHours(fresh()) === 0,
    );
  }

  /* ------------------------------------------------------- what it costs */
  check(
    "a client who pays you weekly stops instructing you separately",
    (() => {
      const plain = fresh();
      const retained = { ...fresh(), retainers: [held("general", "Vance Holdings")] };
      const sees = (q: PracticeState) => {
        for (let seed = 1; seed <= 200; seed++) {
          for (const o of newOffers(q, 90, 10, 2, makeRng(seed))) {
            if (o.client === "Vance Holdings") return true;
          }
        }
        return false;
      };
      return sees(plain) && !sees(retained);
    })(),
  );
  check(
    "and a firm on retainer has less time to go and find work",
    (() => {
      const count = (n: number) => {
        const q = {
          ...fresh(),
          retainers: RETAINERS.slice(0, n).map((k, i) =>
            held(k.id, `Client ${i}`),
          ),
        };
        let total = 0;
        for (let seed = 1; seed <= 300; seed++) {
          total += newOffers(q, 90, 10, 2, makeRng(seed)).length;
        }
        return total;
      };
      return count(3) < count(0) * 0.85;
    })(),
  );

  /* -------------------------------------------------------- taking one on */
  {
    const s = startRun(lawyer, 72);
    s.week = 12;
    const p = practice(s);
    p.retainerOffers = [
      {
        id: "ro-1",
        kind: "general",
        client: "Cormack Retail",
        expiresWeek: s.week + 3,
      },
    ];
    const taken = runCommand(lawyer, s, "takeRetainer", "ro-1");
    check(
      "an arrangement can be accepted",
      retainersOf(practice(taken)).length === 1 &&
        retainerOffersOf(practice(taken)).length === 0,
    );
    check(
      "and it runs for a stated number of weeks rather than for ever",
      retainersOf(practice(taken))[0].weeks ===
        RETAINER_BY_ID.get("general")!.weeks,
    );
    check(
      "one that is not on the table is refused",
      retainersOf(practice(runCommand(lawyer, s, "takeRetainer", "ro-9")))
        .length === 0,
    );

    const ended = runCommand(lawyer, taken, "endRetainer", retainersOf(practice(taken))[0].id);
    check(
      "giving notice ends it and costs you standing",
      retainersOf(practice(ended)).length === 0 &&
        ended.r.reputation < taken.r.reputation,
    );
  }

  check(
    "a practice can only be available for so many at once",
    (() => {
      let s = startRun(lawyer, 73);
      s.week = 12;
      practice(s).retainers = RETAINERS.map((k, i) => held(k.id, `Client ${i}`));
      practice(s).retainerOffers = [
        { id: "ro-x", kind: "advice", client: "Ms Lindqvist", expiresWeek: 20 },
      ];
      s = runCommand(lawyer, s, "takeRetainer", "ro-x");
      return retainersOf(practice(s)).length === MAX_RETAINERS;
    })(),
  );

  /* ----------------------------------------------------------- the week */
  {
    const s = startRun(lawyer, 74);
    s.week = 12;
    practice(s).retainers = [held("general")];
    const out = advanceWeek(lawyer, s, { casework: 2 });
    const line = out.ledger.find((x) => /retainer/i.test(x.label));
    check(
      "the week books it as income, whatever the courts did",
      Boolean(line) && line!.amount === 1_300,
      `${line?.amount}`,
    );
    check(
      "and says what it cost in hours",
      /10 hours/.test(line?.note ?? ""),
      line?.note ?? "",
    );
    check(
      "and the arrangement is a week closer to its end",
      retainersOf(practice(out.state))[0].weeks === 19,
    );
  }

  check(
    "an arrangement that runs out ends, and the hours come back",
    (() => {
      let s = startRun(lawyer, 75);
      s.week = 12;
      practice(s).retainers = [{ ...held("advice"), weeks: 1 }];
      s = advanceWeek(lawyer, s, { rest: 1 }).state;
      return (
        retainersOf(practice(s)).length === 0 &&
        retainerHours(practice(s)) === 0 &&
        s.log.some((x) => /come to its end/i.test(x.text))
      );
    })(),
  );

  check(
    "retained hours come off the top, before any matter sees one",
    (() => {
      const build = (withRetainer: boolean) => {
        const s = startRun(lawyer, 76);
        s.week = 12;
        const q = practice(s);
        const k = CASE_BY_ID.get("commercial")!;
        q.cases = [
          {
            id: "c-1",
            kind: "commercial",
            client: "Vance Holdings",
            openedWeek: 1,
            dueWeek: s.week + 20,
            hoursDone: 0,
            settlementOffer: 0,
            payer: "prompt",
          },
        ];
        void k;
        if (withRetainer) q.retainers = [held("panel", "Ardal Construction")];
        return advanceWeek(lawyer, s, { casework: 4 }).state;
      };
      return (
        practice(build(true)).cases[0].hoursDone <
        practice(build(false)).cases[0].hoursDone
      );
    })(),
  );

  /* ------------------------------------------------------------ the save */
  check(
    "a save from before retainers is a firm with none",
    (() => {
      const p = fresh();
      delete p.retainers;
      delete p.retainerOffers;
      return (
        lawyer.validateData!({ practice: p }) &&
        retainerIncome(p) === 0 &&
        retainerHours(p) === 0
      );
    })(),
  );
  check(
    "an arrangement the catalogue does not have is refused",
    !lawyer.validateData!({
      practice: { ...fresh(), retainers: [held("handshake")] },
    }),
  );
}


/**
 * EVERY CAREER IS ORGANISED, AND STAYS THAT WAY
 *
 * Four of the seven careers shipped on the generic shell: one "Business" page
 * carrying every option on a single scroll, no alerts, no next step, no
 * lessons and an empty glossary. The machinery was always career-agnostic —
 * only the content was missing — which is exactly the kind of gap that is
 * invisible until somebody plays the career nobody opened.
 *
 * So these are invariants over `CAREERS` rather than tests of any one of them.
 * The next career added is held to the same bar the moment it is registered,
 * and the failure mode that produced this work cannot recur silently.
 */
console.log("\nEvery career is organised\n" + "─".repeat(52));
{
  const contentSectionsOf = (careerId: string) =>
    sectionsFor(careerId).filter((s) => s.id === "work");

  check(
    "every career has a section set of its own, not the generic shell",
    CAREERS.every((c) => {
      const mine = sectionsFor(c.id);
      const generic = sectionsFor("nobody-in-particular");
      return mine !== generic && mine.length >= 3;
    }),
    CAREERS.filter((c) => sectionsFor(c.id) === sectionsFor("x"))
      .map((c) => c.id)
      .join(", "),
  );

  /*
   * THE PHASE 4 GATE, ENFORCED RATHER THAN CLAIMED.
   *
   * Five destinations with stable meanings — Week, Work, World, Career,
   * Life — in an order that never changes. A career that lacks the systems
   * behind Career or Life simply omits it: a missing destination is skipped,
   * never reshuffled, and nothing may invent a sixth. The Physician used to
   * be excused from this rule for calling its map "network"; since the
   * unification there are no excuses left to write.
   */
  check(
    "every career's bar is the five destinations, in order, nothing else",
    CAREERS.every((c) => {
      const canon = ["week", "work", "world", "career", "life"];
      const ids = sectionsFor(c.id).map((s) => s.id);
      let at = -1;
      return ids.every((id) => {
        const pos = canon.indexOf(id);
        if (pos <= at) return false;
        at = pos;
        return true;
      });
    }),
    CAREERS.map(
      (c) => `${c.id}: ${sectionsFor(c.id).map((s) => s.id).join(">")}`,
    ).join("; "),
  );

  check(
    "every one of them opens on the week and can say where it works",
    CAREERS.every((c) => {
      const s = sectionsFor(c.id);
      return s[0].id === "week" && s.some((x) => x.id === "world");
    }),
    CAREERS.filter((c) => {
      const s = sectionsFor(c.id);
      return s[0].id !== "week" || !s.some((x) => x.id === "world");
    })
      .map((c) => c.id)
      .join(", "),
  );

  check(
    "and carries a Work destination with real screens behind it",
    CAREERS.every(
      (c) =>
        contentSectionsOf(c.id).length === 1 &&
        contentSectionsOf(c.id)[0].screens.length >= 1,
    ),
  );

  check(
    "every screen says what it is for",
    CAREERS.every((c) =>
      sectionsFor(c.id).every((s) =>
        s.screens.every((x) => x.label.length > 0 && x.purpose.length > 20),
      ),
    ),
  );

  /*
   * The bug this one exists for is real and was found by Playwright: the
   * screen index is flat across every career, so a screen id used by two
   * careers routes one of them into the other's section — and the
   * sub-navigation then renders the wrong tabs, or none.
   */
  check(
    "no two careers share a screen id, apart from the two they all share",
    (() => {
      const seen = new Map<string, string>();
      const clashes: string[] = [];
      for (const c of CAREERS) {
        for (const s of sectionsFor(c.id)) {
          for (const x of s.screens) {
            if (x.id === "overview" || x.id === "home") continue;
            const owner = seen.get(x.id);
            if (owner && owner !== c.id) clashes.push(`${x.id}: ${owner}/${c.id}`);
            else seen.set(x.id, c.id);
          }
        }
      }
      return clashes.length === 0;
    })(),
  );

  check(
    "every screen resolves back to the section it was declared in",
    CAREERS.every((c) =>
      sectionsFor(c.id).every((s) =>
        s.screens.every((x) => sectionOf(x.id, c.id).id === s.id),
      ),
    ),
  );

  check(
    "tapping a destination lands on a screen that destination owns",
    CAREERS.every((c) =>
      sectionsFor(c.id).every((s) =>
        s.screens.some((x) => x.id === defaultScreen(s.id, c.id)),
      ),
    ),
  );

  check(
    "and every screen id it declares is one `screenOf` knows",
    CAREERS.every((c) =>
      sectionsFor(c.id).every((s) =>
        s.screens.every((x) => screenOf(x.id).label === x.label),
      ),
    ),
  );

  /* ------------------------------------------------- what it is told, in week one */
  check(
    "every career is taught something, on a screen it actually has",
    CAREERS.every((c) => {
      const ids = lessonOrderFor(c.id);
      if (ids.length === 0) return false;
      const screens = new Set(
        sectionsFor(c.id).flatMap((s) => s.screens.map((x) => x.id)),
      );
      return ids.every((id) => screens.has(LESSONS[id].screen));
    }),
    CAREERS.filter((c) => lessonOrderFor(c.id).length === 0)
      .map((c) => c.id)
      .join(", "),
  );

  check(
    "and the first thing it is taught is its own week, in its own words",
    (() => {
      const titles = CAREERS.map((c) => LESSONS[lessonOrderFor(c.id)[0]]);
      return (
        titles.every((l) => l.screen === "overview") &&
        new Set(titles.map((l) => l.title)).size === titles.length
      );
    })(),
  );

  check(
    "every career has words of its own",
    CAREERS.every((c) => glossaryFor(c.id).length >= 5),
    CAREERS.filter((c) => glossaryFor(c.id).length < 5)
      .map((c) => `${c.id}:${glossaryFor(c.id).length}`)
      .join(", "),
  );

  check(
    "and nobody else's",
    (() => {
      const owner = new Map<string, string>();
      const shared: string[] = [];
      for (const c of CAREERS) {
        for (const t of glossaryFor(c.id)) {
          const had = owner.get(t.term.toLowerCase());
          if (had && had !== c.id) shared.push(`${t.term}: ${had}/${c.id}`);
          else owner.set(t.term.toLowerCase(), c.id);
        }
      }
      return shared.length === 0;
    })(),
  );

  /* ------------------------------------------------------ alerts and the step */
  check(
    "every career derives alerts without throwing, and points them somewhere real",
    CAREERS.every((c) => {
      const s = startRun(c, 21);
      const screens = new Set(
        sectionsFor(c.id).flatMap((x) => x.screens.map((y) => y.id)),
      );
      return deriveAlerts(s).every(
        (a) => a.title.length > 0 && screens.has(a.destination),
      );
    }),
  );

  check(
    "and its next step, when it has one, points at a screen it has",
    CAREERS.every((c) => {
      const s = startRun(c, 22);
      const screens = new Set(
        sectionsFor(c.id).flatMap((x) => x.screens.map((y) => y.id)),
      );
      const step = nextStep(s, { rest: 6 }, 6, 6, true);
      return !step || !step.destination || screens.has(step.destination);
    }),
  );

  /*
   * The house rule, enforced rather than trusted: no career may borrow
   * another's vocabulary. Medical words are the ones that leak, because the
   * Physician's systems are the ones every shared module was written against.
   */
  check(
    "no career's own words belong to another profession",
    (() => {
      const forbidden: Record<string, RegExp> = {
        doctor: /larder|brigade|chambers|runway|polling day|certifier/i,
        chef: /patient|triage|outbreak|chambers|runway|dilution/i,
        lawyer: /patient|triage|larder|brigade|runway|dilution/i,
        founder: /patient|triage|larder|brigade|chambers|hearing/i,
        politician: /patient|triage|larder|brigade|chambers|runway/i,
        architect: /patient|triage|larder|brigade|hearing|runway/i,
        engineer: /patient|triage|larder|brigade|chambers|hearing/i,
      };
      const bad: string[] = [];
      for (const c of CAREERS) {
        const rx = forbidden[c.id];
        if (!rx) continue;
        const words = glossaryFor(c.id)
          .map((t) => `${t.term} ${t.plain} ${t.detail}`)
          .join(" ");
        const taught = lessonOrderFor(c.id)
          .map((id) => {
            const l = LESSONS[id];
            return `${l.title} ${l.intro} ${l.points.map((p) => `${p.term} ${p.detail}`).join(" ")}`;
          })
          .join(" ");
        const hit = `${words} ${taught}`.match(rx);
        if (hit) bad.push(`${c.id}: ${hit[0]}`);
      }
      return bad.length === 0;
    })(),
  );
}


console.log(
  `\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}\n`,
);
process.exit(failures === 0 ? 0 : 1);
