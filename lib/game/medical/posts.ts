import type { PostDef } from "./types";

/**
 * PULSE — the player's post catalogue.
 *
 * Every line here is authored. Nothing is generated: the body functions
 * interpolate run state into fixed sentences so the same run always produces
 * the same feed.
 *
 * The design rule is that no post is strictly best. Education buys trust
 * slowly; promotion buys reach fast and costs you standing; a sensational
 * case study pays more than an anonymised one and can breach confidentiality.
 * Confidentiality is a real mechanic — the safe version of a case study is
 * always available and always slightly worse.
 */

export const POSTS: PostDef[] = [
  // ------------------------------------------------------------- education
  {
    id: "edu.prevention",
    category: "education",
    label: "Write health advice",
    blurb: "Plain-language prevention advice for your own patients.",
    body: () =>
      "Three things that prevent more disease than anything I do in clinic: sleep, moving daily, and coming in early rather than late. None of them are billable. All of them work.",
    available: () => true,
    effect: { followers: 90, trust: 2.5, sentiment: 1, cpd: 1 },
    preview: [
      "+2.5 professional trust",
      "Modest follower growth",
      "+1 CPD — writing it up counts",
    ],
  },
  {
    id: "edu.myth",
    category: "education",
    label: "Correct a myth",
    blurb: "Take on something wrong that is circulating widely.",
    body: () =>
      "No, antibiotics do not touch a virus. Taking them anyway will not shorten your cold and will make the next infection you get harder to treat. I will keep saying this.",
    available: (c) => c.trust >= 45,
    effect: { followers: 260, trust: 3, sentiment: -1, scrutiny: 2 },
    preview: [
      "+3 professional trust",
      "Good reach — corrections travel",
      "Slightly more scrutiny; someone always objects",
    ],
  },

  // ------------------------------------------------------- case studies
  {
    id: "case.anonymised",
    category: "caseStudy",
    label: "Anonymised case study",
    blurb: "A teaching case with every identifying detail removed.",
    body: () =>
      "A patient presented with symptoms that looked like three ordinary things and were not. Details changed, permission given. The learning point: when the story does not fit, the story is the finding.",
    available: (c) => c.week >= 4,
    effect: { followers: 340, trust: 4, sentiment: 1, cpd: 2 },
    preview: [
      "+4 professional trust — the strongest educational post",
      "+2 CPD",
      "No confidentiality risk: nothing identifying is published",
    ],
  },
  {
    id: "case.sensational",
    category: "caseStudy",
    label: "Case study, told vividly",
    blurb:
      "The same case with the details that make it travel. Riskier, and you know it.",
    body: () =>
      "She was 34, a teacher, and three doctors had told her it was stress. It was not stress. I will not say which hospital sent her home twice.",
    available: (c) => c.week >= 4,
    hazard: 0.4,
    effect: { followers: 1_400, trust: 2, sentiment: 4, scrutiny: 8 },
    preview: [
      "Large reach and public sympathy",
      "+8 scrutiny",
      "40% chance a patient recognises themselves",
    ],
    backfire: {
      effect: { followers: 700, trust: -9, sentiment: -7, scrutiny: 18 },
      note: "A patient recognised herself. The complaint is formal.",
    },
  },

  // ---------------------------------------------------------------- hiring
  {
    id: "hiring.open",
    category: "hiring",
    label: "Announce you are hiring",
    blurb: "Put the vacancy where clinicians will actually see it.",
    body: (c) =>
      `We are hiring in ${c.cityName}. Small team, proper handovers, and nobody is expected to answer messages at midnight. If that is unusual enough to be worth advertising, that is rather the point.`,
    available: () => true,
    effect: { followers: 120, trust: 1.5, recruitBoost: 6 },
    preview: [
      "+6 skill on your next recruit",
      "+1.5 professional trust",
      "Applies once, to the very next hire",
    ],
  },

  // ------------------------------------------------------------ department
  {
    id: "dept.launch",
    category: "department",
    label: "Announce a new department",
    blurb: "Tell the city you can now treat something you could not before.",
    body: (c) =>
      `${c.departmentLabel} opens at our ${c.cityName} site this week. Referrals welcome from today.`,
    available: (c) => c.departmentLabel !== null,
    effect: { followers: 420, sentiment: 3, panel: 55, trust: 1 },
    preview: [
      "+55 patients register immediately",
      "+3 public sentiment",
      "Warning: demand arrives before you have staffed it",
    ],
  },

  // ------------------------------------------------------------- expansion
  {
    id: "expansion.site",
    category: "expansion",
    label: "Announce a new site",
    blurb: "A launch post for premises you have just opened.",
    body: (c) =>
      `${c.newestFacility} is open. It took longer and cost more than planned, which I understand is traditional.`,
    available: (c) => c.newestFacility !== null,
    effect: { followers: 500, sentiment: 3.5, panel: 40 },
    preview: [
      "+40 patients",
      "+3.5 public sentiment",
      "Good reach — openings are news",
    ],
  },

  // ------------------------------------------------------------ credential
  {
    id: "credential.award",
    category: "credential",
    label: "Share your new qualification",
    blurb: "Post the credential you have just been awarded.",
    body: (c) =>
      `${c.newestQualification}, finally. Thank you to the colleagues who covered my lists while I sat exams, and to the patients who noticed I was distracted and said nothing.`,
    available: (c) => c.newestQualification !== null,
    effect: { followers: 380, trust: 5, sentiment: 2, reputation: 1 },
    preview: [
      "+5 professional trust — the profession notices credentials",
      "+1 reputation",
      "Solid reach",
    ],
  },

  // -------------------------------------------------------------- research
  {
    id: "research.publish",
    category: "research",
    label: "Publish your findings",
    blurb: "Write up the pathogen you solved.",
    body: (c) =>
      `Our work on ${c.solvedPathogen} is out. Method, data and the two things we got wrong first, all included. Use it.`,
    available: (c) => c.solvedPathogen !== null,
    effect: { followers: 900, trust: 8, sentiment: 3, reputation: 2, cpd: 4 },
    preview: [
      "+8 professional trust — the highest available",
      "+2 reputation, +4 CPD",
      "Strong reach across the profession",
    ],
  },

  // -------------------------------------------------------------- outbreak
  {
    id: "outbreak.warn",
    category: "outbreak",
    label: "Public health warning",
    blurb: "Tell people what is spreading and what to do about it.",
    body: (c) =>
      `${c.outbreakLabel} is circulating in ${c.outbreakCity}. Here is who should be seen urgently, who should stay home, and who does not need to worry. Please read before sharing.`,
    available: (c) => c.outbreakLabel !== null,
    effect: { followers: 1_100, trust: 5, sentiment: 5, panel: 30 },
    preview: [
      "+5 trust and +5 sentiment — accurate warnings build both",
      "Very strong reach",
      "Some of the worried will register with you",
    ],
  },
  {
    id: "outbreak.alarm",
    category: "outbreak",
    label: "Sound the alarm loudly",
    blurb:
      "Overstate it to make sure people listen. It will travel much further.",
    body: (c) =>
      `${c.outbreakLabel} is out of control in ${c.outbreakCity} and nobody is telling you the truth about it. Cancel what you can. I will keep posting.`,
    available: (c) => c.outbreakLabel !== null,
    hazard: 0.5,
    effect: { followers: 3_200, sentiment: 6, scrutiny: 12, trust: -3 },
    preview: [
      "Enormous reach",
      "−3 professional trust; colleagues dislike panic",
      "50% chance you are publicly corrected",
    ],
    backfire: {
      effect: { followers: 1_600, trust: -10, sentiment: -12, scrutiny: 22 },
      note: "The health authority issued a correction naming you.",
    },
  },
  {
    id: "outbreak.resolved",
    category: "outbreak",
    label: "Report the outbreak is over",
    blurb: "Close the loop publicly on something you helped end.",
    body: (c) =>
      `The ${c.outbreakLabel} cluster is over. What worked: early isolation, honest communication, and a lot of people doing unglamorous work. Thank you.`,
    available: (c) => c.solvedPathogen !== null,
    effect: { followers: 800, trust: 6, sentiment: 7, reputation: 1 },
    preview: [
      "+7 public sentiment — resolution is what people remember",
      "+6 professional trust",
      "+1 reputation",
    ],
  },

  // ------------------------------------------------------------- milestone
  {
    id: "milestone.panel",
    category: "milestone",
    label: "Share a practice milestone",
    blurb: "Mark how many people now call this their practice.",
    body: (c) =>
      `${Math.round(c.panel).toLocaleString("en-US")} people now have us as their practice. That is not a business metric to me. It is a list of names I am responsible for.`,
    available: (c) => c.panel >= 300,
    effect: { followers: 460, sentiment: 3, trust: 1 },
    preview: ["+3 public sentiment", "Decent reach", "Harmless and warm"],
  },

  // ----------------------------------------------------------------- staff
  {
    id: "staff.credit",
    category: "staff",
    label: "Credit your team",
    blurb: "Name the people who actually did the work.",
    body: (c) =>
      `${c.staffName} has been carrying this place through a difficult month and has not once mentioned it. The rest of us noticed.`,
    available: (c) => c.staffName !== null,
    effect: { followers: 220, trust: 3, sentiment: 3, recruitBoost: 3 },
    preview: [
      "+3 trust and +3 sentiment",
      "+3 on your next recruit — people want to work somewhere like this",
    ],
  },

  // ------------------------------------------------------------- lifestyle
  {
    id: "lifestyle.flex",
    category: "lifestyle",
    label: "Post the good life",
    blurb: "Show what the work has bought you.",
    body: (c) =>
      `${c.luxuryItem}. Sixteen years of training and a great many missed weekends. I am allowed one photograph.`,
    available: (c) => c.luxuryItem !== null,
    effect: { followers: 2_400, sentiment: 2, trust: -4, scrutiny: 5 },
    preview: [
      "Very strong follower growth",
      "−4 professional trust — colleagues notice",
      "+5 scrutiny",
    ],
  },

  // ------------------------------------------------------------- promotion
  {
    id: "promo.hard",
    category: "promotion",
    label: "Push hard for patients",
    blurb: "Aggressive promotion. It works, and it costs you something.",
    body: (c) =>
      `Same-week appointments in ${c.cityName} while everywhere else quotes you six. Register today. Tell the person who has been waiting.`,
    available: () => true,
    effect: { followers: 1_800, sentiment: 2, trust: -5, scrutiny: 10, panel: 90 },
    preview: [
      "+90 patients immediately — the fastest growth available",
      "−5 professional trust, +10 scrutiny",
      "Demand you may not be able to serve",
    ],
  },

  // -------------------------------------------------------------- response
  {
    id: "response.measured",
    category: "response",
    label: "Answer your critics",
    blurb: "Respond to criticism plainly, without picking a fight.",
    body: () =>
      "I have read the criticism. Some of it is fair and I have changed what we do. The rest I disagree with, and I will say why rather than delete it.",
    available: (c) => c.trust < 50 || c.sentiment < 45,
    effect: { followers: 300, trust: 4, sentiment: 4, scrutiny: -6 },
    preview: [
      "Recovers trust and sentiment together",
      "−6 scrutiny — a straight answer closes the story",
      "Only available when something needs answering",
    ],
  },
];

export const POST_BY_ID = new Map(POSTS.map((p) => [p.id, p]));
