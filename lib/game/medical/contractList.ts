import type { ContractDef } from "../contracts";
import { med } from "../careers/doctor";
import { personIn } from "../people";
import { readRep } from "../reputation";

/**
 * THE PHYSICIAN'S ASSIGNMENTS
 *
 * Twelve pieces of work across the eight kinds. Each one gates on something
 * different, so what you are offered is a readout of what you have built:
 *
 *   a one-room practice sees routine work and an emergency call-out
 *   a department and a machine make specialist work appear
 *   standing brings the private clients
 *   CPD and a publication bring research
 *   ethics — or the lack of it — decides whether the grey offers arrive
 *
 * The grey ones are the point of the ethical-risk field. They pay well, they
 * are always available to somebody with slipping standards, and each one has a
 * complication that is the bill arriving.
 */

export const MEDICAL_CONTRACTS: ContractDef[] = [
  /* ---------------------------------------------------------- routine */
  {
    id: "c.locum",
    careerId: "doctor",
    kind: "routine",
    title: "Locum cover for the weekend clinic",
    blurb:
      "A neighbouring practice is short. Two weekends, unglamorous, and it pays on time.",
    difficulty: 1,
    effort: 2,
    deadline: 5,
    fee: 14_000,
    strain: 2.5,
    ethicalRisk: 0,
    onSuccess: { credibility: 1, patients: 1 },
    onFailure: { credibility: -2 },
    requires: () => true,
    weight: () => 1,
  },
  {
    id: "c.occupational",
    careerId: "doctor",
    kind: "routine",
    title: "Occupational health for a local employer",
    blurb:
      "Two hundred staff, annual checks, and a finance department that queries every invoice.",
    difficulty: 2,
    effort: 3,
    deadline: 8,
    fee: 42_000,
    strain: 2,
    ethicalRisk: 0.1,
    onSuccess: { credibility: 2, patients: 2 },
    onFailure: { credibility: -3, patients: -2 },
    requires: (s) => med(s).staff.length >= 1,
    weight: () => 0.9,
    complications: [
      {
        id: "scope",
        text: "They have quietly doubled the headcount without changing the fee.",
        harder: 1,
        pay: 1,
      },
    ],
  },

  /* -------------------------------------------------------- specialist */
  {
    id: "c.complex",
    careerId: "doctor",
    kind: "specialist",
    title: "A case nobody else will take",
    blurb:
      "Referred on from two hospitals. The notes are four inches thick and the family have stopped being polite.",
    difficulty: 4,
    effort: 4,
    deadline: 7,
    fee: 96_000,
    strain: 5,
    ethicalRisk: 0.15,
    onSuccess: { credibility: 6, patients: 4, influence: 3 },
    onFailure: { credibility: -7, patients: -4 },
    requires: (s) => med(s).departments.length >= 3 && s.r.skill >= 55,
    weight: (s) => (readRep(s, "credibility") >= 55 ? 1.1 : 0.4),
    npc: "sand",
    rival: "sand",
    complications: [
      {
        id: "deterioration",
        text: "The patient has deteriorated. Whatever you were planning, it is now urgent.",
        harder: 1,
      },
      {
        id: "second-opinion",
        text: "The family have brought in their own consultant, who disagrees with you in writing.",
        harder: 1,
        ethics: 0.1,
      },
    ],
  },
  {
    id: "c.surgical",
    careerId: "doctor",
    kind: "specialist",
    title: "A surgical list nobody has capacity for",
    blurb:
      "Eleven patients who have each waited over a year. The regional board is embarrassed and will pay to stop being embarrassed.",
    difficulty: 4,
    effort: 5,
    deadline: 9,
    fee: 148_000,
    strain: 6,
    ethicalRisk: 0.1,
    onSuccess: { credibility: 7, patients: 6, influence: 4 },
    onFailure: { credibility: -8, patients: -5 },
    requires: (s) =>
      med(s).departments.includes("surgery") &&
      med(s).staff.some((x) => x.role === "surgeon"),
    weight: () => 0.9,
    complications: [
      {
        id: "anaesthetics",
        text: "Your anaesthetist has gone off sick and the agency rate has doubled.",
        harder: 1,
        pay: 0.85,
      },
    ],
  },

  /* --------------------------------------------------------------- VIP */
  {
    id: "c.principal",
    careerId: "doctor",
    kind: "vip",
    title: "A private client with a name",
    blurb:
      "Discreet, demanding, and paying for the discretion more than the medicine. Their people have already called twice.",
    difficulty: 3,
    effort: 3,
    deadline: 6,
    fee: 130_000,
    strain: 4,
    ethicalRisk: 0.35,
    onSuccess: { popularity: 4, credibility: 2 },
    onFailure: { credibility: -4, popularity: -6, ethics: -3 },
    requires: (s) => readRep(s, "credibility") >= 58 || readRep(s, "popularity") >= 45,
    weight: () => 0.8,
    rival: "voss",
    complications: [
      {
        id: "demands",
        text: "They want a prescription you do not think is indicated, and have mentioned how much they pay you.",
        harder: 1,
        ethics: 0.3,
      },
      {
        id: "press",
        text: "A photographer has been outside the clinic since Tuesday.",
        harder: 1,
        pay: 1,
      },
    ],
  },

  /* ---------------------------------------------------------- research */
  {
    id: "c.trial",
    careerId: "doctor",
    kind: "research",
    title: "A site on a multi-centre trial",
    blurb:
      "Recruit forty patients, follow the protocol exactly, and your name goes on the paper.",
    difficulty: 3,
    effort: 5,
    deadline: 12,
    fee: 68_000,
    strain: 3.5,
    ethicalRisk: 0.2,
    onSuccess: { influence: 9, credibility: 4, ethics: 2 },
    onFailure: { influence: -4, credibility: -3 },
    requires: (s) => s.r.cpd >= 30 && med(s).departments.length >= 2,
    weight: () => 0.9,
    npc: "hallam",
    rival: "okoro",
    complications: [
      {
        id: "recruitment",
        text: "Recruitment has stalled at nineteen. The sponsor has noticed.",
        harder: 1,
      },
      {
        id: "sponsor-pressure",
        text: "The sponsor would prefer the interim numbers were presented differently.",
        harder: 0,
        ethics: 0.4,
        pay: 1.15,
      },
    ],
  },
  {
    id: "c.grant",
    careerId: "doctor",
    kind: "research",
    title: "Your own study, if you can get it funded",
    blurb:
      "Nobody has asked you to do this. That is precisely why it would matter.",
    difficulty: 4,
    effort: 6,
    deadline: 14,
    fee: 40_000,
    strain: 4,
    ethicalRisk: 0,
    onSuccess: { influence: 14, credibility: 6, ethics: 3 },
    onFailure: { influence: -3 },
    requires: (s) => s.r.cpd >= 60 && med(s).qualifications.length >= 2,
    weight: () => 0.6,
    npc: "hallam",
  },

  /* ----------------------------------------------------- public health */
  {
    id: "c.screening",
    careerId: "doctor",
    kind: "public",
    title: "A regional screening programme",
    blurb:
      "Unfashionable, badly funded, and it will find things early in people who would otherwise have found out late.",
    difficulty: 3,
    effort: 4,
    deadline: 10,
    fee: 52_000,
    strain: 3,
    ethicalRisk: 0,
    onSuccess: { patients: 9, ethics: 5, popularity: 4 },
    onFailure: { patients: -4, ethics: -2 },
    requires: (s) => med(s).cities.length >= 1 && med(s).staff.length >= 2,
    weight: (s) => (readRep(s, "ethics") >= 60 ? 1 : 0.5),
    npc: "vasquez",
  },
  {
    id: "c.vaccination",
    careerId: "doctor",
    kind: "public",
    title: "Run the city's vaccination push",
    blurb:
      "The health board is short of clinicians and long on people who do not trust them. You are being asked because you are trusted.",
    difficulty: 3,
    effort: 4,
    deadline: 8,
    fee: 74_000,
    strain: 4,
    ethicalRisk: 0,
    onSuccess: { patients: 11, popularity: 8, ethics: 4 },
    onFailure: { patients: -6, popularity: -5 },
    requires: (s) => readRep(s, "patients") >= 55 && med(s).equipment.includes("pharmacy"),
    weight: () => 0.8,
    npc: "vasquez",
  },

  /* --------------------------------------------------------- emergency */
  {
    id: "c.majorincident",
    careerId: "doctor",
    kind: "emergency",
    title: "Major incident standby",
    blurb:
      "Be on the rota, be reachable, and be prepared for it to be nothing forty-nine times out of fifty.",
    difficulty: 2,
    effort: 2,
    deadline: 4,
    fee: 30_000,
    strain: 5.5,
    ethicalRisk: 0,
    onSuccess: { credibility: 3, patients: 5, ethics: 2 },
    onFailure: { credibility: -5, patients: -6 },
    requires: (s) => med(s).departments.includes("emergency"),
    weight: () => 1,
    complications: [
      {
        id: "callout",
        text: "It was not nothing. Three days, no notice, and you are still expected to run a clinic.",
        harder: 2,
        pay: 1.4,
      },
    ],
  },

  /* --------------------------------------------------------------- grey */
  {
    id: "c.expedite",
    careerId: "doctor",
    kind: "grey",
    title: "An expedited assessment, for a fee",
    blurb:
      "An insurer wants a fitness-to-work opinion by Friday. They have been clear about which opinion is convenient.",
    difficulty: 2,
    effort: 2,
    deadline: 4,
    fee: 88_000,
    strain: 2,
    ethicalRisk: 0.75,
    onSuccess: { credibility: 1, ethics: -8, patients: -3 },
    onFailure: { ethics: -14, credibility: -6, patients: -6 },
    requires: (s) => readRep(s, "ethics") <= 78,
    weight: (s) => (s.r.cash < 40_000 ? 1.3 : 0.5),
    rival: "meridian",
    complications: [
      {
        id: "claimant",
        text: "The claimant has a solicitor, and the solicitor has your report.",
        harder: 2,
        ethics: 0.4,
      },
    ],
  },
  {
    id: "c.endorsement",
    careerId: "doctor",
    kind: "grey",
    title: "A supplement company wants your name",
    blurb:
      "The product is harmless. The claims on the box are not, quite. They are offering a great deal of money for a photograph.",
    difficulty: 1,
    effort: 1,
    deadline: 3,
    fee: 120_000,
    strain: 1,
    ethicalRisk: 0.85,
    onSuccess: { popularity: 6, ethics: -12, credibility: -5 },
    onFailure: { ethics: -18, credibility: -9, popularity: -8 },
    requires: (s) => readRep(s, "popularity") >= 30,
    weight: () => 0.5,
    rival: "voss",
    complications: [
      {
        id: "regulator",
        text: "The advertising regulator has opened a file, and your face is on the box.",
        harder: 2,
        ethics: 0.5,
        pay: 0.6,
      },
    ],
  },

  /* ----------------------------------------------------- institutional */
  {
    id: "c.trustpartner",
    careerId: "doctor",
    kind: "institutional",
    title: "Preferred provider to a regional trust",
    blurb:
      "Three years of guaranteed referrals, audited quarterly, and a procurement process designed by people who do not like you.",
    difficulty: 5,
    effort: 7,
    deadline: 16,
    fee: 420_000,
    strain: 3.5,
    ethicalRisk: 0.15,
    onSuccess: { credibility: 8, influence: 12, patients: 6 },
    onFailure: { credibility: -6, influence: -8 },
    requires: (s) =>
      med(s).facilities.length >= 3 &&
      med(s).staff.length >= 5 &&
      readRep(s, "influence") >= 45,
    weight: () => 0.7,
    rival: "meridian",
    complications: [
      {
        id: "audit",
        text: "The quarterly audit has found variance in your coding. They want it explained.",
        harder: 2,
        ethics: 0.2,
      },
      {
        id: "underbid",
        text: "A competitor has come in 18% below you and the trust has asked you to match it.",
        harder: 1,
        pay: 0.82,
      },
    ],
  },
  {
    id: "c.teaching",
    careerId: "doctor",
    kind: "institutional",
    title: "Become a teaching site",
    blurb:
      "Registrars rotating through your practice. Slower lists, endless paperwork, and the best recruitment pipeline that exists.",
    difficulty: 3,
    effort: 5,
    deadline: 12,
    fee: 46_000,
    strain: 3,
    ethicalRisk: 0,
    onSuccess: { influence: 10, credibility: 5, loyalty: 8 },
    onFailure: { influence: -4 },
    requires: (s) =>
      med(s).qualifications.length >= 2 && med(s).staff.length >= 4,
    weight: (s) => ((personIn(s, "hallam")?.respect ?? 0) >= 40 ? 1 : 0.5),
    npc: "hallam",
  },
];

export const CONTRACT_BY_ID = new Map(MEDICAL_CONTRACTS.map((c) => [c.id, c]));
