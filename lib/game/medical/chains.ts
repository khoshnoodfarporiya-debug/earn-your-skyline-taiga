import type { GameEventDef, RunState } from "../types";
import { med } from "../careers/doctor";
import { schedule } from "../consequences";
import { personIn, touchPerson } from "../people";
import { applyRep, opportunityScore, readRep } from "../reputation";
import { mark } from "../timeline";
import { cityOf } from "./cities";
import { money } from "../format";

/**
 * EVENT CHAINS
 *
 * Four storylines rather than forty alerts.
 *
 * The existing events were self-contained: something happened, you chose, it
 * resolved, and nothing about it existed the following week. These four are
 * built the other way round — the opening beat is cheap, and the *decision*
 * is what you have to live with, sometimes twenty weeks later.
 *
 * Each one reads real state to become eligible (rank, standing, relationships,
 * staff, cash, city, phone activity) and each one arms a delayed consequence
 * that a later beat collects. The follow-ups are marked `followUp: true` so
 * they can never be rolled at random — they arrive only when the thing that
 * caused them comes due.
 *
 * The four are deliberately about different systems, so a run cannot see all
 * of them and none of them is the "correct" storyline to pursue:
 *
 *   registrar   — a person, and whether you carry someone
 *   audit       — ethics, and whether the cheap answer costs later
 *   partnership — money and relationships colliding
 *   chair       — influence, and what you gave up to get it
 */

const M = (s: RunState) => med(s);

export const CHAIN_EVENTS: GameEventDef[] = [
  /* ================================================================
   * 1. THE REGISTRAR
   *
   * Someone junior is struggling. Supervising them costs you time you do
   * not have; reporting them is correct and ends their career; covering
   * for them is easy and is the sort of thing that comes back.
   * ============================================================== */
  {
    id: "chain.registrar.open",
    chain: "registrar",
    once: true,
    title: "A registrar is out of their depth",
    tone: "neutral",
    cooldown: 999,
    eligible: (s) =>
      s.week >= 14 &&
      M(s).staff.length >= 1 &&
      readRep(s, "credibility") >= 40,
    weight: () => 0.07,
    body: (s) =>
      `Dr Yusuf Kaya has been on your list for three weeks. He is bright, he is exhausted, and this morning he missed something on a chest film that ${
        M(s).staff[0]?.name ?? "your nurse"
      } caught on the way past. Nobody was harmed. He does not know you know.`,
    choices: [
      {
        label: "Supervise him yourself",
        detail: "Two blocks of your time, every week, for a while.",
        apply: (s) => {
          s.r.burnout += 6;
          applyRep(s, "loyalty", 6, "you carried someone who needed it");
          applyRep(s, "ethics", 4, "you did the harder correct thing");
          touchPerson(
            s,
            "hallam",
            { warmth: 8, respect: 10, remember: ["carried-the-registrar"] },
            "you supervised a struggling junior instead of moving him on",
            "good",
          );
          schedule(
            s,
            14,
            "registrar.supervised",
            {},
            "Dr Kaya's assessment is due in about three months.",
          );
          return "You took him through every list yourself. It cost you the evenings you did not have.";
        },
      },
      {
        label: "Report it properly",
        detail: "Correct, documented, and it will end his post.",
        apply: (s) => {
          applyRep(s, "ethics", 7, "you reported a safety concern");
          applyRep(s, "loyalty", -8, "the team saw what happens to people who slip");
          touchPerson(
            s,
            "lindqvist",
            { trust: 6, warmth: -3, remember: ["reported-the-registrar"] },
            "you followed the process exactly",
            "neutral",
          );
          schedule(
            s,
            9,
            "registrar.reported",
            {},
            "The trust will write back about the Kaya report.",
          );
          return "You wrote it up. The paperwork was correct and the corridor was quiet for a week.";
        },
      },
      {
        label: "Say nothing",
        detail: "It was caught. No harm done. You have a practice to run.",
        apply: (s) => {
          applyRep(s, "ethics", -9, "you let a safety concern go");
          touchPerson(
            s,
            "mbeki",
            { trust: -8, warmth: -5, remember: ["covered-a-miss"] },
            "she was the one who caught it, and watched you do nothing",
            "bad",
          );
          /* The long fuse. Twenty-two weeks is far enough that the player
             will have stopped connecting it — which is the point. */
          schedule(
            s,
            22,
            "registrar.buried",
            {},
            undefined, // no notice: this one is supposed to be a surprise
          );
          return "You let it go. He improved on his own, mostly.";
        },
      },
    ],
  },
  {
    id: "chain.registrar.assessment",
    chain: "registrar",
    followUp: true,
    once: true,
    title: "Dr Kaya passed",
    tone: "good",
    cooldown: 999,
    eligible: () => true,
    weight: () => 0,
    body: () =>
      "His assessment came back clear, with a note from the examiner about how well prepared he was. He has asked whether he can stay.",
    choices: [
      {
        label: "Keep him",
        detail: "A consultant you trained, on your payroll.",
        affordable: (s) => s.r.cash >= 40_000,
        apply: (s) => {
          const m = M(s);
          s.r.cash -= 40_000;
          m.staff.push({
            id: `s${m.nextId++}`,
            role: "specialist",
            name: "Dr Yusuf Kaya",
            specialty: m.departments[m.departments.length - 1] ?? "general",
            /* Better than a cold hire because you taught him. This is the
               payoff for the two blocks a week, made visible. */
            skill: Math.min(94, 62 + Math.round(readRep(s, "credibility") * 0.2)),
            salary: 2_400,
          });
          applyRep(s, "loyalty", 10, "you kept the person you trained");
          mark(
            s,
            "chain-registrar-kept",
            "people",
            "You trained a consultant",
            "Dr Yusuf Kaya passed, and stayed.",
          );
          return "He stayed. He is better than the people you have paid twice as much for.";
        },
      },
      {
        label: "Write him a reference",
        detail: "He goes somewhere bigger, and remembers who got him there.",
        apply: (s) => {
          applyRep(s, "influence", 8, "someone you trained went somewhere visible");
          touchPerson(
            s,
            "duarte",
            { warmth: 8, respect: 10 },
            "she placed him, and told everyone where he trained",
            "good",
          );
          return "He took a post at a teaching hospital. Your name is on the reference.";
        },
      },
    ],
  },
  {
    id: "chain.registrar.fallout",
    chain: "registrar",
    followUp: true,
    once: true,
    title: "The thing you let go",
    tone: "bad",
    cooldown: 999,
    eligible: () => true,
    weight: () => 0,
    body: () =>
      "A patient's family has brought a complaint about a delayed diagnosis, five months ago, on a list you were supervising. The notes show the film. The notes also show who else saw it.",
    choices: [
      {
        label: "Take it on yourself",
        detail: "You were responsible. Say so.",
        apply: (s) => {
          s.r.risk += 14;
          applyRep(s, "credibility", -6, "you accepted responsibility publicly");
          applyRep(s, "ethics", 10, "you did not hand it down");
          applyRep(s, "loyalty", 12, "you took it instead of passing it on");
          touchPerson(
            s,
            "mbeki",
            { warmth: 12, trust: 14 },
            "you took the complaint rather than naming the registrar",
            "good",
          );
          return "You put your name on it. The claim will run, and nobody junior is in it.";
        },
      },
      {
        label: "Name the registrar",
        detail: "It was his miss. It is also the truth.",
        apply: (s) => {
          s.r.risk += 4;
          applyRep(s, "loyalty", -18, "you handed a junior to a complaint");
          applyRep(s, "ethics", -12, "you knew, and said nothing until it suited you");
          touchPerson(
            s,
            "mbeki",
            { warmth: -25, trust: -20, remember: ["threw-him-under"] },
            "you named the registrar for something you had known about for months",
            "bad",
          );
          touchPerson(
            s,
            "hallam",
            { warmth: -18, respect: -12, remember: ["threw-him-under"] },
            "she heard how the complaint was handled",
            "bad",
          );
          return "The complaint names him. The corridor knows you knew in the spring.";
        },
      },
    ],
  },

  /* ================================================================
   * 2. THE AUDIT
   *
   * A coding audit. The cheap answer is available and the expensive one is
   * correct, and the difference does not show up for months.
   * ============================================================== */
  {
    id: "chain.audit.open",
    chain: "audit",
    once: true,
    title: "Your coding is being audited",
    tone: "neutral",
    cooldown: 999,
    eligible: (s) => s.week >= 22 && M(s).facilities.length >= 2,
    weight: (s) => (s.r.cash > 120_000 ? 0.08 : 0.05),
    body: (s) =>
      `An insurer is auditing eighteen months of your billing codes. Your practice manager thinks about ${money(
        Math.round(Math.min(90_000, s.r.cash * 0.2 + 20_000)),
      )} of it is arguable. Not wrong. Arguable.`,
    choices: [
      {
        label: "Have it all reviewed properly",
        detail: "Expensive, slow, and it will be clean afterwards.",
        affordable: (s) => s.r.cash >= 45_000,
        apply: (s) => {
          s.r.cash -= 45_000;
          applyRep(s, "ethics", 8, "you paid for a clean audit");
          touchPerson(
            s,
            "lindqvist",
            { warmth: 10, trust: 12, respect: 8, remember: ["clean-audit"] },
            "you backed her judgement and paid for the review",
            "good",
          );
          schedule(
            s,
            11,
            "audit.clean",
            {},
            "The insurer's audit report is due in about three months.",
          );
          return "You paid for the full review. It found two errors in eighteen months, both in the insurer's favour.";
        },
      },
      {
        label: "Argue the arguable ones",
        detail: "Keep the money. It is defensible, if anyone asks.",
        apply: (s) => {
          const kept = Math.round(Math.min(90_000, s.r.cash * 0.2 + 20_000));
          s.r.cash += kept;
          applyRep(s, "ethics", -6, "you kept billing you could not fully defend");
          touchPerson(
            s,
            "lindqvist",
            { warmth: -8, trust: -10, remember: ["argued-the-codes"] },
            "she put her name to codes she had doubts about",
            "bad",
          );
          schedule(s, 16, "audit.contested", { kept }, undefined);
          return `You held the line and kept ${money(kept)}. Elena signed the response without comment.`;
        },
      },
    ],
  },
  {
    id: "chain.audit.vindicated",
    chain: "audit",
    followUp: true,
    once: true,
    title: "The audit came back clean",
    tone: "good",
    cooldown: 999,
    eligible: () => true,
    weight: () => 0,
    body: () =>
      "Not merely passed — the insurer has written to say your documentation is the best in their regional book, and asked whether you would talk to their other providers about it.",
    choices: [
      {
        label: "Do the talk",
        detail: "A day of your time. A lot of people in the room.",
        apply: (s) => {
          s.r.burnout += 4;
          applyRep(s, "influence", 12, "you spoke to the regional provider group");
          applyRep(s, "ethics", 5, "your books stood up in public");
          mark(
            s,
            "chain-audit-clean",
            "award",
            "Your books were held up as the standard",
            "A regional insurer asked you to teach other providers how you document.",
          );
          return "You did the talk. Three practices asked afterwards how you staff your coding.";
        },
      },
      {
        label: "Decline politely",
        detail: "You have a practice to run.",
        apply: (s) => {
          applyRep(s, "ethics", 2, "quietly clean is still clean");
          return "You said no. The letter went in the drawer with the others.";
        },
      },
    ],
  },
  {
    id: "chain.audit.recovery",
    chain: "audit",
    followUp: true,
    once: true,
    title: "The insurer wants it back",
    tone: "bad",
    cooldown: 999,
    eligible: () => true,
    weight: () => 0,
    body: () =>
      "The audit went to a second reviewer. They have disallowed the contested codes, want the money back with interest, and have flagged your practice for enhanced review for two years.",
    choices: [
      {
        label: "Pay it",
        detail: "Settle, and get out of the enhanced-review list.",
        apply: (s, rng) => {
          const bill = 60_000 + rng.int(0, 40_000);
          s.r.cash -= bill;
          applyRep(s, "ethics", -4, "you settled a billing dispute");
          applyRep(s, "credibility", -3, "the profession heard about the recovery");
          return `You paid ${money(bill)} and the flag came off.`;
        },
      },
      {
        label: "Fight it",
        detail: "Lawyers. Months. It might go either way.",
        apply: (s, rng) => {
          s.r.cash -= 25_000;
          s.r.burnout += 8;
          if (rng.chance(0.4)) {
            applyRep(s, "ethics", 3, "you were found to have been right");
            return "Eight months of correspondence, and they withdrew. You are out $25,000 and you were right.";
          }
          s.r.cash -= 70_000;
          applyRep(s, "ethics", -8, "you fought a recovery and lost");
          applyRep(s, "credibility", -6, "it was reported in the trade press");
          touchPerson(
            s,
            "raman",
            { respect: -4, remember: ["billing-story"] },
            "she covered the recovery",
            "bad",
          );
          return "You lost. The bill, the costs, and a paragraph in the trade press.";
        },
      },
    ],
  },

  /* ================================================================
   * 3. THE PARTNERSHIP
   *
   * Money that would solve everything, from someone who wants something.
   * Gated on a real relationship rather than on cash alone.
   * ============================================================== */
  {
    id: "chain.partner.open",
    chain: "partner",
    once: true,
    title: "Thorne wants a conversation",
    tone: "neutral",
    cooldown: 999,
    eligible: (s) =>
      M(s).cities.length >= 2 &&
      (personIn(s, "thorne")?.respect ?? 0) >= 25 &&
      s.week >= 30,
    weight: () => 0.09,
    body: (s) =>
      `Julian Thorne has been watching you open in ${cityOf(
        M(s).cities[M(s).cities.length - 1],
      ).name}. He would like to put money in. He is very clear that he would also like a say, and that the two are the same offer.`,
    choices: [
      {
        label: "Take the investment",
        detail: "$400,000 now. He gets a say in what you build.",
        apply: (s) => {
          s.r.cash += 400_000;
          touchPerson(
            s,
            "thorne",
            { warmth: 15, trust: 12, respect: 8, remember: ["invested"] },
            "he put money into the practice",
            "good",
          );
          touchPerson(
            s,
            "hallam",
            { warmth: -10, respect: -6, remember: ["took-the-money"] },
            "she has opinions about private equity in medicine",
            "bad",
          );
          applyRep(s, "influence", 6, "you have a serious backer");
          applyRep(s, "ethics", -3, "the money came with strings");
          mark(
            s,
            "chain-partner-invested",
            "business",
            "You took outside money",
            "Julian Thorne invested $400,000 for a say in the practice.",
          );
          schedule(
            s,
            18,
            "partner.pressure",
            {},
            "Thorne will want to see margin improvement by around week " +
              (s.week + 18) +
              ".",
          );
          return "The money landed on a Tuesday. So did his first list of suggestions.";
        },
      },
      {
        label: "Ask Adeyemi instead",
        detail: "A clinical partner, not a financial one. Less money.",
        affordable: (s) => (personIn(s, "adeyemi")?.warmth ?? -100) >= 20,
        apply: (s) => {
          s.r.cash += 140_000;
          touchPerson(
            s,
            "adeyemi",
            { warmth: 18, trust: 15, respect: 10, remember: ["became-partner"] },
            "you asked her to be a partner rather than taking outside money",
            "good",
          );
          touchPerson(
            s,
            "thorne",
            { warmth: -12, respect: 4 },
            "you turned him down for a clinician",
            "neutral",
          );
          applyRep(s, "ethics", 6, "you kept the practice clinician-owned");
          applyRep(s, "loyalty", 8, "the team heard who you chose");
          mark(
            s,
            "chain-partner-clinical",
            "business",
            "You took a clinical partner",
            "Dr Tolu Adeyemi bought in. The practice stayed clinician-owned.",
          );
          schedule(s, 20, "partner.clinical", {}, undefined);
          return "Tolu bought in. Less money, and someone who argues with you about medicine rather than margin.";
        },
      },
      {
        label: "Stay independent",
        detail: "No money, no say, no argument.",
        apply: (s) => {
          touchPerson(
            s,
            "thorne",
            { warmth: -6, respect: 8 },
            "you turned the money down flat",
            "neutral",
          );
          touchPerson(
            s,
            "hallam",
            { warmth: 8, respect: 6 },
            "she was pleased, in her way",
            "good",
          );
          return "You said no. It will be a harder year, and it will be yours.";
        },
      },
    ],
  },
  {
    id: "chain.partner.squeeze",
    chain: "partner",
    followUp: true,
    once: true,
    title: "Thorne has read the numbers",
    tone: "bad",
    cooldown: 999,
    eligible: () => true,
    weight: () => 0,
    body: () =>
      "Eighteen weeks of margin, benchmarked against three practices he also owns. His proposal: cut the lowest-yield department, raise prices in your two best cities, and reduce nursing cover on quiet days.",
    choices: [
      {
        label: "Do it his way",
        detail: "The numbers improve. So does his opinion of you.",
        apply: (s) => {
          s.r.cash += 120_000;
          applyRep(s, "loyalty", -14, "cover was cut to make a margin");
          applyRep(s, "patients", -9, "prices went up and waits got longer");
          applyRep(s, "ethics", -7, "you ran the practice to a spreadsheet");
          touchPerson(
            s,
            "thorne",
            { warmth: 10, respect: 12 },
            "you did what the numbers said",
            "good",
          );
          touchPerson(
            s,
            "mbeki",
            { warmth: -18, trust: -14, remember: ["cut-the-cover"] },
            "nursing cover was cut on her wards",
            "bad",
          );
          return "The margin improved by four points. Two nurses have started looking.";
        },
      },
      {
        label: "Refuse, and buy him out",
        detail: "Expensive, and it ends the argument permanently.",
        affordable: (s) => s.r.cash >= 520_000,
        apply: (s) => {
          s.r.cash -= 520_000;
          touchPerson(
            s,
            "thorne",
            { warmth: -20, respect: 15, status: "distant" },
            "you bought him out rather than cut cover",
            "neutral",
          );
          applyRep(s, "loyalty", 14, "the team found out what you paid to keep them");
          applyRep(s, "ethics", 10, "you bought back your own judgement");
          mark(
            s,
            "chain-partner-bought-out",
            "recovery",
            "You bought your practice back",
            "$520,000 to end an investor's say in how you staff a ward.",
          );
          return "You paid him out at a premium. Elena put the letter on the noticeboard.";
        },
      },
      {
        label: "Stall him",
        detail: "Agree to look at it. Do nothing.",
        apply: (s) => {
          touchPerson(
            s,
            "thorne",
            { warmth: -8, trust: -12 },
            "you agreed to things you had no intention of doing",
            "bad",
          );
          schedule(s, 12, "partner.pressure", {}, undefined);
          return "You said you would model it. You did not model it.";
        },
      },
    ],
  },

  /* ================================================================
   * 4. THE CHAIR
   *
   * The opportunity that only exists if the categories say it does —
   * the clearest demonstration that reputation is not a scoreboard.
   * ============================================================== */
  {
    id: "chain.chair.open",
    chain: "chair",
    once: true,
    title: "They are asking about the chair",
    tone: "good",
    cooldown: 999,
    eligible: (s) =>
      s.week >= 45 &&
      opportunityScore(s) >= 58 &&
      M(s).qualifications.length >= 2 &&
      (personIn(s, "hallam")?.respect ?? 0) >= 45,
    weight: () => 0.11,
    body: () =>
      "Iris Hallam called. The regional clinical chair is vacant, she is on the appointments panel, and she has been asked whether she would put your name forward. She wants to know whether you would actually do the work, because she is not going to spend her credibility twice.",
    choices: [
      {
        label: "Let her nominate you",
        detail: "Her reputation, on you. One day a week, unpaid.",
        apply: (s) => {
          touchPerson(
            s,
            "hallam",
            { trust: 10, respect: 5, remember: ["nominated-you"] },
            "she put her name behind yours",
            "good",
          );
          schedule(
            s,
            8,
            "chair.decision",
            {},
            "The appointments panel meets in about two months.",
          );
          return "She put your name in. She also said, plainly, that she would look foolish if you were careless with it.";
        },
      },
      {
        label: "Ask for it on your own record",
        detail: "No favours. It stands or falls on what you have done.",
        apply: (s) => {
          touchPerson(
            s,
            "hallam",
            { respect: 12, warmth: -4 },
            "you refused to be nominated and applied cold",
            "neutral",
          );
          schedule(s, 8, "chair.decision", { unaided: true }, undefined);
          return "You applied cold. Iris said it was either principled or vain and she would tell you which afterwards.";
        },
      },
      {
        label: "Not now",
        detail: "You have a practice to run and no spare day a week.",
        apply: (s) => {
          touchPerson(
            s,
            "hallam",
            { warmth: -6, respect: -4 },
            "you turned down the nomination",
            "neutral",
          );
          return "You said the timing was wrong. She said timing usually is.";
        },
      },
    ],
  },
  {
    id: "chain.chair.appointed",
    chain: "chair",
    followUp: true,
    once: true,
    title: "You got the chair",
    tone: "good",
    cooldown: 999,
    eligible: () => true,
    weight: () => 0,
    body: () =>
      "The panel appointed you. One day a week of committees, a title, and the ability to make things happen with a phone call that used to take you six months.",
    choices: [
      {
        label: "Take it",
        detail: "A day a week, permanently. It changes what you can reach.",
        apply: (s) => {
          applyRep(s, "influence", 22, "you hold a regional clinical chair");
          applyRep(s, "credibility", 8, "the appointment was public");
          s.r._chair = 1;
          mark(
            s,
            "chain-chair",
            "promotion",
            "Regional clinical chair",
            "Appointed to the regional clinical chair. One day a week, and the profession takes your call.",
          );
          touchPerson(
            s,
            "okoro",
            { warmth: -12, respect: 16, remember: ["lost-the-chair"] },
            "he applied for the same chair",
            "neutral",
          );
          return "You took it. Femi Okoro sent a short and entirely correct note of congratulation.";
        },
      },
      {
        label: "Turn it down",
        detail: "You cannot spare the day. Keep the practice.",
        apply: (s) => {
          applyRep(s, "credibility", 4, "you were offered the chair");
          touchPerson(
            s,
            "hallam",
            { warmth: -10, trust: -8 },
            "she spent her credibility on a nomination you declined",
            "bad",
          );
          return "You declined. Iris did not say anything at all, which was worse.";
        },
      },
    ],
  },
  {
    id: "chain.chair.passed",
    chain: "chair",
    followUp: true,
    once: true,
    title: "The chair went to Okoro",
    tone: "bad",
    cooldown: 999,
    eligible: () => true,
    weight: () => 0,
    body: () =>
      "The panel appointed Femi Okoro. The feedback is two sentences long and mentions 'breadth of institutional contribution', which means committees, which means he went to the meetings you did not.",
    choices: [
      {
        label: "Congratulate him properly",
        detail: "He earned it. Say so, and mean it.",
        apply: (s) => {
          touchPerson(
            s,
            "okoro",
            { warmth: 14, respect: 10, remember: ["was-gracious"] },
            "you congratulated him without being asked",
            "good",
          );
          applyRep(s, "ethics", 4, "you lost well");
          schedule(s, 24, "chair.rematch", {}, undefined);
          return "You wrote to him. He kept the note.";
        },
      },
      {
        label: "Say nothing",
        detail: "There is nothing to say.",
        apply: (s) => {
          touchPerson(
            s,
            "okoro",
            { warmth: -8 },
            "you did not acknowledge his appointment",
            "bad",
          );
          return "You did not write. He noticed, and so did the people who expected you to.";
        },
      },
    ],
  },
  {
    id: "chain.chair.rematch",
    chain: "chair",
    followUp: true,
    once: true,
    title: "Okoro is standing down",
    tone: "good",
    cooldown: 999,
    eligible: () => true,
    weight: () => 0,
    body: () =>
      "He is moving to a national post and the chair is vacant again. He has told the panel, unprompted, that you should have had it the first time.",
    choices: [
      {
        label: "Take it",
        detail: "The same day a week, two years later.",
        apply: (s) => {
          applyRep(s, "influence", 20, "you hold the regional chair");
          s.r._chair = 1;
          mark(
            s,
            "chain-chair",
            "promotion",
            "Regional clinical chair",
            "The chair, at the second attempt, on the recommendation of the man who beat you to it.",
          );
          return "You took it. The rival you lost to is the reason you have it.";
        },
      },
      {
        label: "Decline",
        detail: "You have built something else since.",
        apply: (s) => {
          applyRep(s, "credibility", 3, "you were asked twice");
          return "You said no. It was a genuine decision this time, not a consolation.";
        },
      },
    ],
  },
];
