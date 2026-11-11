import type { RunState } from "../types";
import type { VoicePack } from "./voicePack";
import { venture } from "../careers/founder";
import { defaultAlive, runwayOf, startupCityOf } from "../careers/startup";
import { campaign } from "../careers/politician";
import {
  projectedShare,
  seatOf,
  thresholdFor,
  weeksToPoll,
} from "../careers/constituency";
import { studio } from "../careers/architect";
import { KIND_BY_ID, studioCityOf } from "../careers/studio";
import { workshop } from "../careers/engineer";
import { shippedProducts, workshopCityOf } from "../careers/workshop";

/**
 * FOUR WORLDS, AS TABLES
 *
 * One pack per career that did not have a phone. Each is a cast, a handful of
 * things worth saying, the conditions under which somebody would get in
 * touch, and one function that reads the week just resolved.
 *
 * The rule every pack keeps: a post is only offered when the run has actually
 * earned it, and a reaction only exists because something happened. A feed
 * that talks when nothing occurred is decoration, and this game does not have
 * decoration in it.
 */

/* ------------------------------------------------------------- the founder */

export const FOUNDER_PACK: VoicePack = {
  world: "the industry",
  voices: {
    press: { name: "Ledger", handle: "@ledger", org: true },
    angel: { name: "Dana Whitlock", handle: "@dwhitlock" },
    founderFriend: { name: "Sami Reyes", handle: "@samibuilds" },
    customer: { name: "Priya at Northbeam", handle: "@priya_nb" },
    rival: { name: "Corva", handle: "@corva", org: true },
  },
  opening: {
    from: "founderFriend",
    role: "peer",
    body: "You actually quit. Right — one thing nobody tells you: the number that matters is not in the bank, it is how many weeks the bank buys. Work that out before you hire anybody.",
  },
  identity: (social) => {
    if (social.followers < 400) {
      return {
        label: "Nobody has heard of it",
        blurb: "Which is fine. Nobody had heard of anything once.",
      };
    }
    if (social.followers >= 5_000) {
      return {
        label: "The one people mention",
        blurb: "Being known is not the same as being default alive.",
      };
    }
    return {
      label: "Known in the category",
      blurb: "The people who would buy it are starting to know the name.",
    };
  },
  posts: [
    {
      id: "launch",
      label: "We are live",
      blurb: "Tell people the thing exists.",
      body: (s) =>
        `It is live. Built in ${startupCityOf(venture(s)).name}, and it does one thing properly instead of nine things badly. Come and break it.`,
      available: () => true,
      once: true,
      effect: { followers: 140, trust: 2, sentiment: 3 },
      preview: ["People learn it exists", "A modest, honest start"],
    },
    {
      id: "numbers",
      label: "Post the numbers",
      blurb: "Growth in public. It works, right up until it does not.",
      body: (s) =>
        `${Math.round(venture(s).users).toLocaleString("en-US")} people pay for this now. Posting it because the version of this month where it did not work would have been just as public.`,
      available: (s) => venture(s).users >= 250,
      effect: { followers: 220, trust: 4, scrutiny: 6 },
      preview: [
        "Only postable once there are numbers worth posting",
        "Everybody now watches the next one too",
      ],
    },
    {
      id: "alive",
      label: "Default alive",
      blurb: "The only milestone in this career that is really one.",
      body: () =>
        "Revenue covered burn this month. Nothing here needs anybody's permission to exist any more. That is the whole thing.",
      available: (s) => defaultAlive(venture(s)),
      once: true,
      effect: { followers: 320, trust: 9, sentiment: 8 },
      preview: [
        "Only available once revenue actually covers burn",
        "The strongest thing you will ever post",
      ],
    },
    {
      id: "hiring",
      label: "We are hiring",
      blurb: "Ask the internet for people.",
      body: () =>
        "Hiring. Small team, short meetings, and you will ship in your first week because there is nobody else to do it.",
      available: () => true,
      effect: { followers: 60, trust: 2 },
      preview: ["Puts the name in front of people who build things"],
    },
    {
      id: "hottake",
      label: "The hot take",
      blurb: "Loud opinion about the industry. Cheap reach, real risk.",
      body: () =>
        "Most companies this size do not have a growth problem. They have a nobody-wants-it problem, and a growth team is a very expensive way to avoid finding that out.",
      available: (s) => (venture(s).users ?? 0) >= 100,
      hazard: 0.3,
      effect: { followers: 300, scrutiny: 8 },
      preview: [
        "The biggest reach here",
        "Three times in ten it is quoted back at you as arrogance",
      ],
      backfire: {
        note: "Bold from somebody whose product I have still never seen anybody use.",
      },
    },
  ],
  messages: [
    {
      id: "angel-interest",
      from: "angel",
      role: "recruiter",
      body: () =>
        "I write small cheques early and I am nosy. If you are raising in the next few months, talk to me before you talk to a fund — the terms are friendlier and so am I.",
      when: (s) => venture(s).users >= 150,
    },
    {
      id: "press-sniff",
      from: "press",
      role: "journalist",
      body: () =>
        "We are writing about companies in your category. Happy to include you. Fair warning: if the growth is not real we will say so, and we check.",
      when: (s) => venture(s).users >= 900,
    },
    {
      id: "runway-warning",
      from: "founderFriend",
      role: "peer",
      body: (s) =>
        `Saw you are still hiring. Say the number out loud: you have about ${Math.floor(runwayOf(s.r.cash, venture(s)))} weeks. I am not telling you to stop, I am telling you to know.`,
      when: (s) =>
        !defaultAlive(venture(s)) && runwayOf(s.r.cash, venture(s)) < 9,
    },
    {
      id: "rival-move",
      from: "rival",
      role: "rival",
      body: () =>
        "We have just shipped the thing you built your whole pitch around. No hard feelings — it was a good idea, which is exactly the problem with good ideas.",
      when: (s) => venture(s).users >= 1_800,
    },
  ],
  news: [
    {
      outlet: "Ledger",
      headline: "Funding slows in the category",
      body: () =>
        "Rounds are taking longer to close and terms are worse than a year ago. Companies with revenue are unbothered; the rest are cutting.",
      tone: "neutral",
    },
    {
      outlet: "Ledger",
      headline: "The quiet layoffs nobody announced",
      body: () =>
        "Several well-funded companies have cut teams without a statement. Runway, it turns out, is the only number that was ever load-bearing.",
      tone: "bad",
    },
    {
      outlet: "The Category",
      headline: "Buyers say they want fewer tools",
      body: () =>
        "A survey of buyers finds the appetite is for consolidation, which is good news for whoever is already installed and bad news for everybody arriving.",
      tone: "neutral",
    },
  ],
  reaction: (s) => {
    const v = venture(s);
    const last = v.lastWeek;
    if (!last) return null;
    if (last.alive) {
      return {
        body: "Watched this one go from burning money to covering itself. Rarer than it should be.",
        tone: "good",
      };
    }
    if (last.gained > last.churned * 2 && last.gained > 20) {
      return {
        body: "Whatever they are doing is working — the number went up again this week and it was not a fluke last week either.",
        tone: "good",
      };
    }
    if (last.churned > last.gained && v.users > 60) {
      return {
        body: "More people left than arrived. That is not a marketing problem, that is the product telling you something.",
        tone: "bad",
      };
    }
    return null;
  },
};

/* ----------------------------------------------------------- the politician */

export const POLITICIAN_PACK: VoicePack = {
  world: "the seat",
  voices: {
    local: { name: "The Gazette", handle: "@gazette", org: true },
    agent: { name: "Bill Hargreave", handle: "@hargreave" },
    activist: { name: "Nour Fadel", handle: "@nourfadel" },
    opponent: { name: "The other lot", handle: "@theotherlot", org: true },
    constituent: { name: "Mrs Whitcombe", handle: "@ewhitcombe" },
  },
  opening: {
    from: "agent",
    role: "peer",
    body: "Right. I have agented four of these and I will tell you the only thing that matters: they forget you in a fortnight. Whatever you do this week, do it again in three weeks or it never happened.",
  },
  identity: (social) => {
    if (social.followers < 400) {
      return {
        label: "A name on a leaflet",
        blurb: "Nobody outside your own street could pick you out.",
      };
    }
    if (social.scrutiny >= 55) {
      return {
        label: "A known quantity",
        blurb: "Everybody has a view, and they had it before they met you.",
      };
    }
    return {
      label: "Locally known",
      blurb: "Recognised at the shops, which is more useful than it sounds.",
    };
  },
  posts: [
    {
      id: "standing",
      label: "I am standing",
      blurb: "Say it out loud.",
      body: (s) =>
        `I am standing in ${seatOf(campaign(s)).name}. I have knocked on enough doors here to know what is wrong with it. Come and tell me what I have missed.`,
      available: () => true,
      once: true,
      effect: { followers: 130, trust: 3, sentiment: 3 },
      preview: ["People learn who you are", "A plain, honest opening"],
    },
    {
      id: "surgery",
      label: "The surgery",
      blurb: "The unglamorous work, in public.",
      body: () =>
        "Four hours of surgery this morning: a housing letter, two benefit appeals, and a man who wanted to talk about a hedge. All of it counts.",
      available: () => true,
      effect: { followers: 45, trust: 6, sentiment: 3 },
      preview: ["Trust rises more than reach does", "The safest thing here"],
    },
    {
      id: "position",
      label: "Where I stand",
      blurb: "State a position publicly. Half of them will not like it.",
      body: () =>
        "You asked me what I actually think, so here it is in writing rather than in a leaflet. You will disagree with some of it. I would rather you disagreed with the real thing.",
      available: (s) => Object.keys(campaign(s).positions).length >= 2,
      effect: { followers: 180, trust: 5, sentiment: -3, scrutiny: 6 },
      preview: [
        "Only postable once you have actually taken positions",
        "Trust up, warmth down — that is what a position costs",
      ],
    },
    {
      id: "attack",
      label: "Go after the other lot",
      blurb: "The cheap one. It always works and it always costs.",
      body: () =>
        "Interesting to see the other lot discover this ward exists eleven weeks before polling day. Where were they for the other two hundred?",
      available: (s) => weeksToPoll(campaign(s), s.week) <= 16,
      hazard: 0.28,
      effect: { followers: 240, sentiment: -4, scrutiny: 8 },
      preview: [
        "Reaches furthest of anything here",
        "Nearly a third of the time it reads as desperate",
      ],
      backfire: {
        note: "Everybody attacks when they are behind. It is the tell, not the argument.",
      },
    },
  ],
  messages: [
    {
      id: "agent-poll",
      from: "agent",
      role: "peer",
      body: (s) => {
        const c = campaign(s);
        const share = projectedShare(c) * 100;
        const need = thresholdFor(c) * 100;
        return share >= need
          ? `Canvass returns are decent — we are around ${share.toFixed(0)} against a bar of ${need.toFixed(0)}. Do not celebrate. It leaks every week you are not out.`
          : `We are short. About ${share.toFixed(0)} against ${need.toFixed(0)}. There is time, but not if you spend it in meetings.`;
      },
      when: (s) => weeksToPoll(campaign(s), s.week) <= 20,
    },
    {
      id: "activist-angry",
      from: "activist",
      role: "rival",
      body: () =>
        "You have changed your position and expected nobody to notice. We noticed. Some of us knocked on doors for you on the strength of the old one.",
      when: (s) => campaign(s).reversals.length >= 1,
    },
    {
      id: "constituent-case",
      from: "constituent",
      role: "staff",
      body: () =>
        "I do not want anything, I wanted to say thank you. You sorted my daughter's housing when nobody else would answer the phone. I have told everyone at the club.",
      when: (s) => s.week >= 6,
    },
    {
      id: "press-profile",
      from: "local",
      role: "journalist",
      body: () =>
        "We are profiling the candidates. Everybody gets the same questions and the same space. Decline if you like — we run it either way, with a gap where you were.",
      when: (s) => weeksToPoll(campaign(s), s.week) <= 10,
    },
  ],
  news: [
    {
      outlet: "The Gazette",
      headline: "Turnout expected to fall again",
      body: () =>
        "Officials expect another drop, concentrated among younger voters. Which bloc actually turns out has decided more seats here than any argument ever has.",
      tone: "neutral",
    },
    {
      outlet: "The Gazette",
      headline: "Bus route consultation reopened",
      body: () =>
        "The council has reopened consultation on the evening services, which everybody involved understands to mean it will be decided after polling day.",
      tone: "neutral",
    },
    {
      outlet: "Doorstep",
      headline: "The ward nobody is contesting properly",
      body: () =>
        "An analysis of leaflet volume suggests two parties have effectively given up here, which is either an opportunity or a warning about the electorate.",
      tone: "good",
    },
  ],
  reaction: (s) => {
    const c = campaign(s);
    const last = c.results[c.results.length - 1];
    if (last && last.week === s.week) {
      return last.won
        ? {
            body: `Held it on ${(last.share * 100).toFixed(1)}%. Whatever you think of them, they did the work in the ward.`,
            tone: "good",
          }
        : {
            body: `Lost it on ${(last.share * 100).toFixed(1)}%. The doors were not knocked and it showed on the day.`,
            tone: "bad",
          };
    }
    return null;
  },
};

/* ------------------------------------------------------------ the architect */

export const ARCHITECT_PACK: VoicePack = {
  world: "the profession",
  voices: {
    journal: { name: "Section", handle: "@sectionmag", org: true },
    critic: { name: "Ingrid Sollberg", handle: "@i_sollberg" },
    engineer: { name: "Tomas Wren", handle: "@wren_structures" },
    contractor: { name: "Halvorsen Bau", handle: "@halvorsenbau", org: true },
    peer: { name: "Yusuf Demir", handle: "@ydemir" },
  },
  opening: {
    from: "peer",
    role: "peer",
    body: "Congratulations on the practice. One warning from somebody two years ahead of you: the client who stops answering is not the dangerous one. The dangerous one is the client who has been thinking.",
  },
  identity: (social) => {
    if (social.followers < 400) {
      return {
        label: "An unbuilt practice",
        blurb: "Nobody has stood in anything you drew yet.",
      };
    }
    if (social.followers >= 4_000) {
      return {
        label: "A practice people cite",
        blurb: "Students put your sections in their own portfolios.",
      };
    }
    return {
      label: "Known for one building",
      blurb: "Which is one more than most practices manage.",
    };
  },
  posts: [
    {
      id: "opened",
      label: "The practice is open",
      blurb: "Announce yourself to a profession that is not waiting.",
      body: (s) =>
        `A practice of one, in ${studioCityOf(studio(s)).name}. Small work, done properly, until somebody trusts me with large work done properly.`,
      available: () => true,
      once: true,
      effect: { followers: 110, trust: 3, sentiment: 3 },
      preview: ["People learn the practice exists"],
    },
    {
      id: "drawing",
      label: "Post the drawing",
      blurb: "A section, not a render. The profession can tell.",
      body: () =>
        "A section rather than a render, because the render is a photograph of a lie and the section is where the building is actually decided.",
      available: (s) => studio(s).commissions.length > 0,
      effect: { followers: 130, trust: 5 },
      preview: [
        "Only once there is something on the boards",
        "Trust rises — this is a profession that reads drawings",
      ],
    },
    {
      id: "finished",
      label: "It is finished",
      blurb: "A building somebody can walk into.",
      body: () =>
        "Finished, occupied, and already slightly different from the drawings in the ways buildings always are. Two years. Worth it.",
      available: (s) => studio(s).built.length > 0,
      effect: { followers: 300, trust: 8, sentiment: 6 },
      preview: [
        "Only postable once something is actually built",
        "The strongest thing a practice can say",
      ],
    },
    {
      id: "competition",
      label: "The competition entry",
      blurb: "Show the one nobody paid for.",
      body: () =>
        "Our entry. It did not win. Posting it anyway, because the alternative is that six weeks of work exists only in a folder nobody opens.",
      available: (s) => studio(s).competition !== undefined,
      effect: { followers: 90, trust: 3, sentiment: 2 },
      preview: ["Modest reach, and the profession respects it"],
    },
    {
      id: "manifesto",
      label: "The manifesto",
      blurb: "Say what architecture is for. Loudly.",
      body: () =>
        "Most of what is built in this city is a spreadsheet with a facade attached, signed off by people who will never walk past it twice. We can simply refuse to do that.",
      available: (s) => studio(s).built.length >= 1,
      hazard: 0.27,
      effect: { followers: 280, trust: 4, scrutiny: 7 },
      preview: [
        "The furthest-travelling thing here",
        "A quarter of the time it reads as a practice with time on its hands",
      ],
      backfire: {
        note: "Strong words from a practice with two extensions and a car park.",
      },
    },
  ],
  messages: [
    {
      id: "engineer-warning",
      from: "engineer",
      role: "peer",
      body: () =>
        "Had a look at what you sent. The idea is good. The junction at the eaves is not buildable as drawn and you will find that out at tender if you do not find it out now.",
      when: (s) => studio(s).commissions.some((c) => c.stage >= 2),
    },
    {
      id: "critic-notice",
      from: "critic",
      role: "journalist",
      body: () =>
        "I have seen the photographs. I would like to visit it properly before I write anything, because photographs of buildings are a form of fiction. Are you around?",
      when: (s) => studio(s).built.length >= 1,
    },
    {
      id: "contractor-value",
      from: "contractor",
      role: "rival",
      body: () =>
        "The client has asked us to price alternatives to your cladding. We are obliged to tell you, and we both know how these conversations end.",
      when: (s) => studio(s).commissions.some((c) => c.stage >= 3),
    },
    {
      id: "journal-feature",
      from: "journal",
      role: "journalist",
      body: () =>
        "We run a feature on young practices each spring. It is not a favour — you would be doing us the favour, and it is read by exactly the people who commission buildings.",
      when: (s) => s.r.reputation >= 30,
    },
  ],
  news: [
    {
      outlet: "Section",
      headline: "Fee scales fall again",
      body: () =>
        "The published scales have dropped for the fourth year running, which practices are absorbing by doing the same work in fewer hours and calling it efficiency.",
      tone: "bad",
    },
    {
      outlet: "Section",
      headline: "A competition with 340 entries",
      body: () =>
        "A single civic building attracted 340 entries, representing something in the region of eight hundred unpaid weeks of work across the profession.",
      tone: "neutral",
    },
    {
      outlet: "The Building Press",
      headline: "Client-side changes blamed for delays",
      body: () =>
        "A survey of delayed projects finds the most common cause is not the design team but the brief being revised after design was signed off.",
      tone: "neutral",
    },
  ],
  reaction: (s) => {
    const a = studio(s);
    const redrawn = a.commissions.find((c) => c.revisions > 0 && !c.done);
    if (a.built.length > 0 && a.commissions.some((c) => c.done)) {
      const justDone = a.commissions.find(
        (c) => c.done && KIND_BY_ID.get(c.kind),
      );
      if (justDone && s.week - justDone.startedWeek > 0 && s.r._lastRevenue) {
        return {
          body: "Went past the new one this morning. It is quiet, and it is doing the thing it was drawn to do. That is the whole job.",
          tone: "good",
        };
      }
    }
    if (redrawn && redrawn.revisions >= 2) {
      return {
        body: "Hearing that job has been redesigned twice now. Nobody outside the profession understands that this is what most of the work actually is.",
        tone: "bad",
      };
    }
    return null;
  },
};

/* ------------------------------------------------------------- the engineer */

export const ENGINEER_PACK: VoicePack = {
  world: "the trade",
  voices: {
    trade: { name: "Tolerance", handle: "@tolerancemag", org: true },
    certifier: { name: "Dr Halina Voss", handle: "@h_voss" },
    buyer: { name: "Meridian Plant", handle: "@meridianplant", org: true },
    machinist: { name: "Callum Reid", handle: "@creid_makes" },
    customer: { name: "Anke Brandt", handle: "@ankebrandt" },
  },
  opening: {
    from: "machinist",
    role: "peer",
    body: "Workshop looks good. Only advice worth giving: the thing that gets you is never the part you worried about. Test the boring bits, they are the ones that go out the door unexamined.",
  },
  identity: (social) => {
    if (social.followers < 400) {
      return {
        label: "An unknown workshop",
        blurb: "Nothing of yours is in anybody's plant yet.",
      };
    }
    if (social.trust >= 70) {
      return {
        label: "Trusted to spec",
        blurb: "People buy this without asking for a sample first.",
      };
    }
    return {
      label: "A known supplier",
      blurb: "On enough shortlists to be worth being on more.",
    };
  },
  posts: [
    {
      id: "workshop",
      label: "The workshop is open",
      blurb: "Say what you make.",
      body: (s) =>
        `A workshop in ${workshopCityOf(workshop(s)).name}, making things that have to work in places nobody will visit to fix them.`,
      available: () => true,
      once: true,
      effect: { followers: 100, trust: 3 },
      preview: ["People learn the workshop exists"],
    },
    {
      id: "teardown",
      label: "Post the teardown",
      blurb: "Show the inside. Engineers respect it and buyers read it.",
      body: () =>
        "Exploded view of the current build. Every part in here is either doing a job or was left in by somebody who did not want the argument. There are none of the second kind.",
      available: (s) => workshop(s).products.length > 0,
      effect: { followers: 140, trust: 6 },
      preview: [
        "Only once something is on the bench",
        "Trust rises hard — this is a trade that reads drawings",
      ],
    },
    {
      id: "certified",
      label: "It is certified",
      blurb: "The stamp, in public.",
      body: () =>
        "Certified. Which means somebody with no interest in my timeline read it all and could not find a reason to say no.",
      available: (s) => shippedProducts(workshop(s)).length > 0,
      effect: { followers: 260, trust: 10, sentiment: 5 },
      preview: [
        "Only postable once something has actually passed",
        "The single most persuasive thing you can say here",
      ],
    },
    {
      id: "own-fault",
      label: "Own the fault",
      blurb: "Say it before a customer does.",
      body: () =>
        "We found a fault in a shipped unit, we know which batch, and we are replacing them. It was in there when we shipped it. That is on us and not on the people who bought it.",
      available: (s) => workshop(s).faultsInField > 0,
      effect: { followers: -30, trust: 12, sentiment: 8 },
      preview: [
        "Only postable once something has actually failed",
        "Costs reach and buys the only thing this trade sells",
      ],
    },
    {
      id: "spec-fight",
      label: "Pick a fight about the standard",
      blurb: "The standard is wrong and you can prove it. Loud.",
      body: () =>
        "The tolerance in the standard was set in 1994 for a material nobody uses. Everybody in this trade knows it and designs around it, and the pretending is costing all of us.",
      available: (s) => s.r.skill >= 55,
      hazard: 0.3,
      effect: { followers: 260, trust: 4, scrutiny: 9 },
      preview: [
        "The furthest reach here",
        "Three times in ten the certifier reads it too",
      ],
      backfire: {
        note: "Every workshop that cannot pass a standard has a theory about the standard.",
      },
    },
  ],
  messages: [
    {
      id: "certifier-note",
      from: "certifier",
      role: "regulator",
      body: () =>
        "A note before you submit anything else. We are not looking for reasons to fail you — we are looking for the thing that hurts somebody in four years. Send the test data, not the brochure.",
      when: (s) => workshop(s).products.some((p) => p.stage === "certifying"),
    },
    {
      id: "buyer-interest",
      from: "buyer",
      role: "recruiter",
      body: () =>
        "We are re-specifying a line and would look at yours. Volume is meaningful. Our procurement will ask for three years of failure data, so have an answer ready.",
      when: (s) => shippedProducts(workshop(s)).length > 0,
    },
    {
      id: "customer-failure",
      from: "customer",
      role: "staff",
      body: () =>
        "One of yours failed on our line on Tuesday. Nobody hurt, four hours lost. I am not angry — I am telling you because you would want to know, and because I want to know what you do next.",
      when: (s) => workshop(s).faultsInField >= 2,
    },
    {
      id: "trade-feature",
      from: "trade",
      role: "journalist",
      body: () =>
        "We would like to run your certification story. Our readers specify parts for a living, and they are considerably more interested in what failed than in what worked.",
      when: (s) => s.r.reputation >= 35,
    },
  ],
  news: [
    {
      outlet: "Tolerance",
      headline: "Recall costs rise across the sector",
      body: () =>
        "The average cost of a field recall has risen again, driven less by parts than by the weeks of engineering time spent proving what went wrong.",
      tone: "bad",
    },
    {
      outlet: "Tolerance",
      headline: "Certification queues lengthen",
      body: () =>
        "Assessment bodies report longer queues, with small workshops waiting behind manufacturers who submit continuously and can afford to.",
      tone: "neutral",
    },
    {
      outlet: "The Plant Floor",
      headline: "Buyers want failure data, not brochures",
      body: () =>
        "Procurement teams increasingly ask for field failure rates before specification. Suppliers who cannot produce them are quietly dropped from shortlists.",
      tone: "neutral",
    },
  ],
  reaction: (s) => {
    const w = workshop(s);
    const out = shippedProducts(w);
    if (out.length === 0) return null;
    const recentFaults = out.reduce((n, p) => n + p.surfaced, 0);
    if (recentFaults >= 2) {
      return {
        body: "Second failure I have heard about from that workshop this month. Once is a batch. Twice is a design.",
        tone: "bad",
      };
    }
    if (recentFaults === 0 && out.some((p) => p.reach > 0.5)) {
      return {
        body: "Been running one of theirs for months without touching it, which in this trade is the highest compliment available.",
        tone: "good",
      };
    }
    return null;
  },
};

export const PACKS: Record<string, VoicePack> = {
  founder: FOUNDER_PACK,
  politician: POLITICIAN_PACK,
  architect: ARCHITECT_PACK,
  engineer: ENGINEER_PACK,
};

export const packFor = (careerId: string): VoicePack | undefined =>
  PACKS[careerId];

/** Convenience for the careers, which all store the phone the same way. */
export type PackedCareer = keyof typeof PACKS;

export const isPacked = (careerId: string): boolean => careerId in PACKS;

/** Read the phone off whichever career state holds it. */
export function packedPhoneOf(s: RunState) {
  switch (s.careerId) {
    case "founder":
      return venture(s).phone;
    case "politician":
      return campaign(s).phone;
    case "architect":
      return studio(s).phone;
    case "engineer":
      return workshop(s).phone;
    default:
      return undefined;
  }
}
