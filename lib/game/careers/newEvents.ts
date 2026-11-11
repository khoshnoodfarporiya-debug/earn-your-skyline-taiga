import type { GameEventDef, RunState } from "../types";
import { money } from "../format";
import {
  defaultAlive,
  runwayOf,
  startupCityOf,
  venture,
} from "./startup";
import {
  BLOCS,
  campaign,
  seatOf,
  weeksToPoll,
} from "./constituency";
import { STAGES, studio } from "./studio";
import {
  shippedProducts,
  workshop,
  workshopCityOf,
} from "./workshop";

/**
 * THINGS THAT HAPPEN TO YOU
 *
 * The Physician, the Chef and the Solicitor have had event catalogues for a
 * long time. The four careers built after them shipped with `events: []`, and
 * it showed: a run was a spreadsheet that ticked over rather than a year that
 * happened to somebody. Nothing arrived, nothing forced a choice, and the only
 * drama was arithmetic.
 *
 * ---------------------------------------------------------------- the rule
 *
 * Every event in here presses on its career's *binding constraint*, because
 * that is what makes one interesting rather than merely random. A founder is
 * offered weeks for ownership; a politician is asked to trade a bloc for the
 * party; an architect is asked to redraw; an engineer is told something might
 * be wrong and has to decide how much he wants to know.
 *
 * And every choice moves real state. There is no option in this file whose
 * only effect is a sentence — that is the difference between an event and a
 * cutscene, and this game does not have cutscenes in it.
 *
 * They share a file because they were written together and read better side
 * by side; the older three have one apiece and that is fine too.
 */

/* ================================================================ FOUNDER */

const acquihire: GameEventDef = {
  id: "founder_acquihire",
  title: "Somebody wants to buy the team",
  body: (s) =>
    `A larger company in ${startupCityOf(venture(s)).name} does not want the product. They want the four people who built it, and they are offering enough to make the question serious.`,
  weight: () => 1.1,
  cooldown: 60,
  once: true,
  eligible: (s) => venture(s).team.length >= 2 && !defaultAlive(venture(s)),
  tone: "neutral",
  choices: [
    {
      label: "Take the money",
      detail: "A large cheque, and the team walks out with it",
      apply: (s) => {
        const v = venture(s);
        const paid = Math.round(v.team.length * 55_000);
        s.r.cash += paid;
        v.team = [];
        s.r.reputation = Math.max(0, s.r.reputation - 4);
        return `${money(paid)}, and an empty office. The runway is enormous and there is nobody left to spend it.`;
      },
    },
    {
      label: "Say no",
      detail: "Keeps the team. They now know what they are worth",
      apply: (s) => {
        const v = venture(s);
        /* Turning it down is a real cost: everybody has just been told their
           market price, and the payroll catches up with that. */
        for (const h of v.team) h.salary = Math.round(h.salary * 1.12);
        s.r.reputation = Math.min(100, s.r.reputation + 3);
        return "You turned it down in the room. By Friday every one of them had a number in their head, and payroll went up to match it.";
      },
    },
  ],
};

const cloudBill: GameEventDef = {
  id: "founder_cloudbill",
  title: "The infrastructure bill",
  body: () =>
    "The bill for last month arrived and it is not the number you budgeted. Growth is not free, and somebody wrote a query that runs on every page load.",
  weight: () => 1.3,
  cooldown: 30,
  eligible: (s) => venture(s).users >= 300,
  tone: "bad",
  choices: [
    {
      label: "Pay it and move on",
      detail: "Costs cash. Nothing changes",
      apply: (s) => {
        const v = venture(s);
        const bill = Math.round(v.users * 2.4);
        s.r.cash -= bill;
        return `${money(bill)} out of the account, and the query is still there.`;
      },
    },
    {
      label: "Spend a week fixing it",
      detail: "A week of the team's output, and the bill halves for good",
      apply: (s) => {
        const v = venture(s);
        /* Real and permanent: the servers line scales off users, so cutting
           it means the whole future is cheaper. Paid for in product weeks. */
        v.product = Math.max(0, v.product - 3);
        s.r.cash -= Math.round(v.users * 0.8);
        s.r.burnout = Math.min(100, s.r.burnout + 6);
        return "Three days of profiling and one very embarrassing commit. The bill is a third of what it was and the roadmap slipped a week.";
      },
    },
  ],
};

const enterpriseAsk: GameEventDef = {
  id: "founder_enterprise",
  title: "One customer wants something built",
  body: () =>
    "A large customer will sign for considerably more than anybody else pays — if you build the one thing their procurement team has asked for. Nobody else has ever asked for it.",
  weight: () => 1.2,
  cooldown: 40,
  eligible: (s) => venture(s).users >= 200,
  tone: "neutral",
  choices: [
    {
      label: "Build it for them",
      detail: "Product work spent on one customer, and a much higher price",
      apply: (s) => {
        const v = venture(s);
        v.product = Math.max(0, v.product - 6);
        /*
         * The same arithmetic the `setPrice` command uses, including the
         * shed: the first version raised the price with no one leaving,
         * which made this event a free ratchet the balance bots compounded
         * — price 46 by week 100 on a product priced at 33.
         */
        const old = v.price;
        v.price = Math.round(v.price * 1.18);
        const shed = v.users * Math.min(0.35, (v.price / old - 1) * 0.55);
        v.users = Math.max(0, v.users - shed);
        return `You built it. The price went up for everybody, which is the part nobody warned you about, and six weeks of roadmap went to one logo.`;
      },
    },
    {
      label: "Tell them no",
      detail: "Keeps the roadmap. They will buy from somebody else",
      apply: (s) => {
        const v = venture(s);
        v.users = Math.max(0, v.users - Math.round(v.users * 0.04));
        return "You said no politely and they went elsewhere, taking a few people who were watching to see whether you would say yes.";
      },
    },
  ],
};

const bridgeOffer: GameEventDef = {
  id: "founder_bridge",
  title: "A bridge, on their terms",
  body: (s) =>
    `You have about ${Math.floor(runwayOf(s.r.cash, venture(s)))} weeks. An existing investor knows that, and has offered to extend it. The terms reflect exactly how much they think you need this.`,
  weight: () => 2.4,
  cooldown: 26,
  eligible: (s) =>
    !defaultAlive(venture(s)) && runwayOf(s.r.cash, venture(s)) < 8,
  tone: "bad",
  choices: [
    {
      label: "Take the bridge",
      detail: "Weeks now, and a painful slice of the company",
      apply: (s) => {
        const v = venture(s);
        const amount = Math.round(burnWeeks(s, 10));
        s.r.cash += amount;
        v.raised += amount;
        v.equity = Math.max(1, v.equity * 0.78);
        return `${money(amount)} in, and 22% of what is left of your share gone. You have ten weeks and a smaller company.`;
      },
    },
    {
      label: "Refuse and cut instead",
      detail: "Let the team go. Keeps every point of ownership",
      affordable: (s) => venture(s).team.length > 0,
      apply: (s) => {
        const v = venture(s);
        const gone = v.team.length;
        const notice = v.team.reduce((n, h) => n + h.salary * 2, 0);
        v.team = [];
        s.r.cash -= Math.round(notice);
        s.r.burnout = Math.min(100, s.r.burnout + 10);
        return `You let all ${gone} of them go and paid the notice. It is your company and it is very quiet.`;
      },
    },
  ],
};

const burnWeeks = (s: RunState, weeks: number): number => {
  const v = venture(s);
  const net = Math.max(1_000, (v.team.length + 1) * 2_400);
  return net * weeks;
};

export const FOUNDER_EVENTS: GameEventDef[] = [
  acquihire,
  cloudBill,
  enterpriseAsk,
  bridgeOffer,
];

/* ============================================================= POLITICIAN */

const whipped: GameEventDef = {
  id: "pol_whip",
  title: "The party wants your vote",
  body: () =>
    "The whips have been in touch about a vote on Thursday. Your position on it is a matter of public record, and it is not the party's position.",
  weight: () => 1.6,
  cooldown: 30,
  eligible: (s) => Object.keys(campaign(s).positions).length >= 1,
  tone: "neutral",
  choices: [
    {
      label: "Vote with the party",
      detail: "Party standing up. The bloc you promised notices",
      apply: (s) => {
        const c = campaign(s);
        c.party = Math.min(100, c.party + 12);
        /* The people who believed the stated position take it personally. */
        for (const b of BLOCS) {
          c.support[b.id] = Math.max(0, (c.support[b.id] ?? 0) - 5);
        }
        return "You went through the right lobby. The whips noticed, and so did everybody who quoted you on it last month.";
      },
    },
    {
      label: "Vote your position",
      detail: "The seat sees you keep your word. The party remembers",
      apply: (s) => {
        const c = campaign(s);
        c.party = Math.max(0, c.party - 14);
        for (const b of BLOCS) {
          c.support[b.id] = Math.min(100, (c.support[b.id] ?? 0) + 4);
        }
        s.r.reputation = Math.min(100, s.r.reputation + 4);
        return "You voted the way you said you would. It cost you the room and bought you the ward.";
      },
    },
  ],
};

const localCrisis: GameEventDef = {
  id: "pol_crisis",
  title: "The water came in on Grange Road",
  body: (s) =>
    `Forty houses flooded overnight in ${seatOf(campaign(s)).name}. There is a committee meeting at the same hour that everybody who matters will be at.`,
  weight: () => 1.5,
  cooldown: 36,
  eligible: () => true,
  tone: "bad",
  choices: [
    {
      label: "Go to Grange Road",
      detail: "Boots and a clipboard. The party is elsewhere",
      apply: (s) => {
        const c = campaign(s);
        c.support.workers = Math.min(100, (c.support.workers ?? 0) + 11);
        c.support.older = Math.min(100, (c.support.older ?? 0) + 8);
        c.party = Math.max(0, c.party - 4);
        s.r.burnout = Math.min(100, s.r.burnout + 5);
        return "You were photographed carrying somebody's carpet out of a hallway. It was not a photo opportunity until somebody took a photograph.";
      },
    },
    {
      label: "Go to the committee",
      detail: "Where the money for the drains is actually decided",
      apply: (s) => {
        const c = campaign(s);
        c.party = Math.min(100, c.party + 9);
        c.support.workers = Math.max(0, (c.support.workers ?? 0) - 7);
        return "You got the drainage money into next year's budget, which will help enormously and which nobody on Grange Road will ever hear about.";
      },
    },
  ],
};

const donor: GameEventDef = {
  id: "pol_donor",
  title: "An offer of help",
  body: () =>
    "A local developer would like to fund the campaign. They have not asked for anything. They have, however, mentioned the site on Cross Street twice.",
  weight: () => 1.2,
  cooldown: 40,
  once: true,
  eligible: (s) => weeksToPoll(campaign(s), s.week) <= 24,
  tone: "neutral",
  choices: [
    {
      label: "Take the money",
      detail: "Funds the campaign. It will come up again",
      apply: (s) => {
        const c = campaign(s);
        s.r.cash += 12_000;
        c.support.business = Math.min(100, (c.support.business ?? 0) + 6);
        c.support.green = Math.max(0, (c.support.green ?? 0) - 8);
        /* Scrutiny in this career lives on the phone, and this is exactly the
           kind of thing it exists for. */
        if (c.phone) {
          c.phone.social.scrutiny = Math.min(100, c.phone.social.scrutiny + 12);
        }
        return `${money(12_000)} into the campaign account, declared properly, and a journalist has already asked about Cross Street.`;
      },
    },
    {
      label: "Decline it",
      detail: "No money, and nothing to answer for",
      apply: (s) => {
        const c = campaign(s);
        c.support.green = Math.min(100, (c.support.green ?? 0) + 5);
        s.r.reputation = Math.min(100, s.r.reputation + 3);
        return "You said no in writing, which is the only way of saying no that is any use later.";
      },
    },
  ],
};

const defection: GameEventDef = {
  id: "pol_defection",
  title: "Somebody wants to come over",
  body: () =>
    "A councillor from the other lot has had enough of them and would like to join you. They bring a ward, a mailing list, and everything they have ever said in public.",
  weight: () => 1.0,
  cooldown: 50,
  once: true,
  eligible: (s) => campaign(s).party >= 30,
  tone: "good",
  choices: [
    {
      label: "Welcome them",
      detail: "Reach and machinery, and their record is now yours",
      apply: (s) => {
        const c = campaign(s);
        c.party = Math.min(100, c.party + 8);
        for (const b of BLOCS) {
          c.support[b.id] = Math.min(100, (c.support[b.id] ?? 0) + 3);
        }
        c.support.green = Math.max(0, (c.support.green ?? 0) - 9);
        return "Photographed shaking hands. Half the ward is delighted and the students have found everything he said in 2019.";
      },
    },
    {
      label: "Keep them at arm's length",
      detail: "Nothing gained, nothing to explain",
      apply: () =>
        "You were warm and vague and did not put anything in writing. He joined somebody else within the month.",
    },
  ],
};

export const SEAT_EVENTS: GameEventDef[] = [
  whipped,
  localCrisis,
  donor,
  defection,
];

/* ============================================================== ARCHITECT */

const valueEngineering: GameEventDef = {
  id: "arch_value",
  title: "The contractor has priced an alternative",
  body: () =>
    "The cladding you specified has come back over budget, and the contractor has helpfully priced something else. It is cheaper. It is also not what you drew.",
  weight: () => 1.6,
  cooldown: 28,
  eligible: (s) => studio(s).commissions.some((c) => !c.done && c.stage >= 3),
  tone: "bad",
  choices: [
    {
      label: "Accept the substitution",
      detail: "The job goes on. The building is worse",
      apply: (s) => {
        s.r.reputation = Math.max(0, s.r.reputation - 4);
        return "It is built and it is fine and you will never post a photograph of it.";
      },
    },
    {
      label: "Fight for the specification",
      detail: "Weeks of arguing, and the client may reopen the brief",
      apply: (s) => {
        const a = studio(s);
        const c = a.commissions.find((x) => !x.done && x.stage >= 3);
        if (c) {
          /* Arguing means meetings you did not schedule, and a client who is
             now thinking about the design again — which is the dangerous
             state for an architect to put a client into. */
          c.lastSeen = Math.min(c.lastSeen, 0);
          c.progress = Math.max(0, c.progress - 1.5);
        }
        s.r.reputation = Math.min(100, s.r.reputation + 5);
        return "You won it, over three meetings you were not paid for, and the client is now looking at the whole thing again.";
      },
    },
  ],
};

const planningRefusal: GameEventDef = {
  id: "arch_planning",
  title: "Refused",
  body: () =>
    "Planning have refused it. The officer's report objects to the massing, which is the part the client liked and the part that made it worth doing.",
  weight: () => 1.4,
  cooldown: 40,
  eligible: (s) => studio(s).commissions.some((c) => !c.done && c.stage >= 1),
  tone: "bad",
  choices: [
    {
      label: "Appeal it",
      detail: "Costs money and months. You keep the building",
      affordable: (s) => s.r.cash >= 6_000,
      apply: (s) => {
        const a = studio(s);
        s.r.cash -= 6_000;
        const c = a.commissions.find((x) => !x.done && x.stage >= 1);
        if (c) c.progress = Math.max(0, c.progress - 2);
        return `${money(6_000)} on a planning consultant and two months of waiting. The massing survived.`;
      },
    },
    {
      label: "Redesign to suit",
      detail: "Back a stage. It gets through, as something else",
      apply: (s) => {
        const a = studio(s);
        const c = a.commissions.find((x) => !x.done && x.stage >= 1);
        if (c) {
          c.stage = Math.max(0, c.stage - 1);
          c.progress = 0;
          c.revisions += 1;
        }
        return `Redrawn to the officer's satisfaction. It will be built, and it will be ${STAGES[0].label.toLowerCase()} again first.`;
      },
    },
  ],
};

const publication: GameEventDef = {
  id: "arch_publication",
  title: "A magazine wants to publish it",
  body: () =>
    "A journal would like to run the house. They want new photography, a drawing set nobody has time to prepare, and five hundred words by Friday.",
  weight: () => 1.1,
  cooldown: 44,
  eligible: (s) => studio(s).built.length >= 1,
  tone: "good",
  choices: [
    {
      label: "Do it properly",
      detail: "A week of work nobody pays for, and a name that travels",
      apply: (s) => {
        s.r.reputation = Math.min(100, s.r.reputation + 9);
        s.r.burnout = Math.min(100, s.r.burnout + 6);
        const a = studio(s);
        if (a.phone) a.phone.social.followers += 400;
        return "Eight pages, the drawings printed properly, and three enquiries in the fortnight after it came out.";
      },
    },
    {
      label: "Send them what you have",
      detail: "No week lost. It runs small",
      apply: (s) => {
        s.r.reputation = Math.min(100, s.r.reputation + 2);
        return "They ran a half page with a photograph from the handover. Better than nothing, which is roughly what it did.";
      },
    },
  ],
};

const spouse: GameEventDef = {
  id: "arch_spouse",
  title: "The client's partner has seen the drawings",
  body: () =>
    "They were not at any of the meetings and they have now seen the plans on the kitchen table. They have views about the stair.",
  weight: () => 1.5,
  cooldown: 26,
  eligible: (s) => studio(s).commissions.some((c) => !c.done),
  tone: "bad",
  choices: [
    {
      label: "Meet them properly",
      detail: "A week of hand-holding. Resets the brief-change risk",
      apply: (s) => {
        const a = studio(s);
        const c = a.commissions.find((x) => !x.done);
        if (c) c.lastSeen = s.week;
        s.r.burnout = Math.min(100, s.r.burnout + 3);
        return "Two hours at their table with a roll of trace. They are now the drawing's biggest defender, which is the only outcome worth having.";
      },
    },
    {
      label: "Let the client handle it",
      detail: "Costs nothing now. It is a conversation happening without you",
      apply: (s) => {
        const a = studio(s);
        const c = a.commissions.find((x) => !x.done);
        /* Being talked about in a room you are not in is exactly how a brief
           gets reinvented. Modelled as neglect, because that is what it is. */
        if (c) c.lastSeen = Math.max(0, c.lastSeen - 6);
        return "You left them to it. Whatever was decided at that table was decided without a drawing in front of anybody.";
      },
    },
  ],
};

export const STUDIO_EVENTS: GameEventDef[] = [
  valueEngineering,
  planningRefusal,
  publication,
  spouse,
];

/* =============================================================== ENGINEER */

const oddReport: GameEventDef = {
  id: "eng_odd",
  title: "Something odd from a customer",
  body: () =>
    "A customer has sent a photograph of a part that does not look like it should after eight months. It might be them. It might be the batch. It might be the design.",
  weight: () => 1.8,
  cooldown: 24,
  eligible: (s) => shippedProducts(workshop(s)).length > 0,
  tone: "bad",
  choices: [
    {
      label: "Strip one down and find out",
      detail: "A week gone, and you learn what is actually in there",
      apply: (s) => {
        const w = workshop(s);
        const p = shippedProducts(w)[0];
        if (p) {
          /* The whole point of the career: investigating converts a hidden
             number into a known one, and takes some of it out on the way. */
          p.tested += 3;
          p.latent = Math.max(0, p.latent - 1.5);
        }
        s.r.burnout = Math.min(100, s.r.burnout + 5);
        return "Stripped, sectioned and photographed. It was the design, it was always going to be the design, and now you know how much of it is out there.";
      },
    },
    {
      label: "Send a replacement and move on",
      detail: "Cheap today. You are no wiser",
      apply: (s) => {
        const w = workshop(s);
        const cost = 900;
        s.r.cash -= cost;
        const p = shippedProducts(w)[0];
        if (p) p.surfaced += 1;
        return `A replacement in the post and ${money(cost)} gone. Whatever it was is still in every other one you shipped.`;
      },
    },
  ],
};

const cheaperPart: GameEventDef = {
  id: "eng_cheaper",
  title: "A cheaper component",
  body: () =>
    "A supplier can do the bearing for a third of what you pay. The datasheet is fine. The datasheet is always fine.",
  weight: () => 1.4,
  cooldown: 32,
  eligible: (s) => workshop(s).products.some((p) => p.stage !== "withdrawn"),
  tone: "neutral",
  choices: [
    {
      label: "Design it in",
      detail: "Saves real money and puts faults in you cannot see",
      apply: (s) => {
        const w = workshop(s);
        const p = w.products.find((x) => x.stage !== "withdrawn");
        if (p) {
          p.latent += 2.5;
          /* And your estimate is now stale — you know less than you did. */
          p.tested = Math.max(0, p.tested - 2);
        }
        s.r.cash += 3_400;
        return `${money(3_400)} saved across the build, and a part you have never tested doing a job you have not thought about since.`;
      },
    },
    {
      label: "Stay with the one you know",
      detail: "Costs the saving. Changes nothing else",
      apply: () =>
        "You stayed with the bearing that has never once been the reason for a return. It costs what it costs.",
    },
  ],
};

const standardChange: GameEventDef = {
  id: "eng_standard",
  title: "The standard has been revised",
  body: (s) =>
    `The certifier in ${workshopCityOf(workshop(s)).name} has published a revision. The tolerance everybody designs to has moved, and it has not moved in your favour.`,
  weight: () => 1.2,
  cooldown: 50,
  once: true,
  eligible: (s) => workshop(s).products.length > 0,
  tone: "bad",
  choices: [
    {
      label: "Re-test everything against it",
      detail: "Weeks of rig time. You find what the revision would have",
      apply: (s) => {
        const w = workshop(s);
        for (const p of w.products) {
          if (p.stage === "withdrawn") continue;
          p.tested += 2;
          p.latent = Math.max(0, p.latent - 1);
        }
        s.r.burnout = Math.min(100, s.r.burnout + 7);
        s.r.cash -= 1_800;
        return "Every rig ran for a fortnight. Two things came out of it that would have come out of a customer instead.";
      },
    },
    {
      label: "Submit what you have",
      detail: "No weeks lost. The certifier is now stricter than you are",
      apply: (s) => {
        s.r.reputation = Math.max(0, s.r.reputation - 2);
        return "You carried on. The next submission will be read against the new revision whether or not the drawing was.";
      },
    },
  ],
};

const rushOrder: GameEventDef = {
  id: "eng_rush",
  title: "A large order, if it ships in a fortnight",
  body: () =>
    "A distributor will take a serious volume — provided it is on their dock in two weeks. Everything you would normally do between now and then takes six.",
  weight: () => 1.3,
  cooldown: 38,
  eligible: (s) =>
    workshop(s).products.some(
      (p) => p.stage === "testing" || p.stage === "certifying",
    ),
  tone: "neutral",
  choices: [
    {
      label: "Ship it",
      detail: "Real money now, and everything still in it goes with it",
      apply: (s) => {
        const w = workshop(s);
        const p = w.products.find(
          (x) => x.stage === "testing" || x.stage === "certifying",
        );
        if (p) {
          p.stage = "shipped";
          p.shippedWeek = s.week;
          p.reach = Math.max(p.reach, 0.55);
        }
        s.r.cash += 18_000;
        return `${money(18_000)} and a pallet on a lorry. Whatever is in it is now in a lot of places at once.`;
      },
    },
    {
      label: "Turn it down",
      detail: "No money. The product goes out when it is ready",
      apply: (s) => {
        s.r.reputation = Math.min(100, s.r.reputation + 3);
        return "You told them it would not be ready and they respected it, in the way people respect things that cost them nothing.";
      },
    },
  ],
};

export const WORKSHOP_EVENTS: GameEventDef[] = [
  oddReport,
  cheaperPart,
  standardChange,
  rushOrder,
];

/** Everything above, for the check that every career has a catalogue. */
export const NEW_EVENT_SETS = {
  founder: FOUNDER_EVENTS,
  politician: SEAT_EVENTS,
  architect: STUDIO_EVENTS,
  engineer: WORKSHOP_EVENTS,
};
