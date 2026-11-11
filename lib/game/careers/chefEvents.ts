import type { GameEventDef, RunState } from "../types";
import { money } from "../format";
import { schedule } from "../consequences";
import {
  INGREDIENT_BY_ID,
  RECIPE_BY_ID,
  inSeason,
  recipeName,
} from "./recipes";
import {
  KIT_BY_ID,
  PRODUCE_BY_ID,
  cityOf,
  clearSpoiledPantry,
  knownRecipes,
  localOf,
  moraleOf,
  pantryOf,
  premisesOf,
  produceIndex,
  type KitchenState,
} from "./kitchen";
import { applyStanding } from "./standing";
import { seasonOf } from "./diners";
import { ensureBuzz, notePost } from "./buzz";
import { ensureRivals } from "./competitors";

/**
 * TWELVE THINGS THAT HAPPEN TO RESTAURANTS
 *
 * Every one of these is attached to a system the player is already running.
 * A supplier shortage moves the supplier account; a breakdown removes a piece
 * of equipment from the list they bought it from; an inspection reads the
 * actual state of the pantry; a festival is only offered in the season it
 * happens in and only in a city that holds one.
 *
 * ------------------------------------------------------------- the rules
 *
 * Four, and they are what separate an event from a random fine:
 *
 *   1. **Context.** The body says what is true right now, not a generic line.
 *   2. **Two or more real choices**, each with a cost stated on the card.
 *   3. **A consequence you can see** — money, stock, standing, staff, a piece
 *      of kit — never an invisible modifier.
 *   4. **Sometimes a consequence you cannot see yet.** Several of these
 *      schedule a delayed consequence that arrives weeks later, resolved in
 *      `chef.ts`. That is the difference between a decision and a toll.
 *
 * The engine writes every fired event and every chosen line into the run's
 * log and event history, so the record is automatic rather than something
 * each event has to remember to do.
 */

const kit = (s: RunState): KitchenState => s.data.kitchen as KitchenState;
const local = (s: RunState, amount: number): number => localOf(kit(s), amount);

/**
 * What an engineer charges here.
 *
 * Local, like every other cash figure in this career. The first version of
 * this event charged the catalogue price of the equipment, which is a Lyon
 * price — in Mumbai that is about two weeks of takings for a repair, and the
 * city harness found it by going overdrawn for 70 weeks in 120.
 */
const repairBill = (k: KitchenState, broken?: { cost: number }): number =>
  Math.round(localOf(k, (broken?.cost ?? 2_000) * 0.5));

/**
 * A price that scales with the business as well as the city.
 *
 * A festival stall, a generator on the pavement and a night's deep clean are
 * all quoted against the size of the room they serve: a market stall does not
 * pay a flagship's price for any of them. Without this, every one of these
 * events was a flat Lyon-sized bill landing on a Mumbai market stall, and the
 * city harness showed exactly what that does — 94 weeks overdrawn in 120.
 *
 * A stall pays about 0.7 of the quoted figure, a bistro about 1, a flagship
 * about 1.9. The quoted figure in each event is therefore a bistro's price.
 */
const scaled = (s: RunState, amount: number): number => {
  const k = kit(s);
  return Math.round(localOf(k, amount) * (0.45 + premisesOf(k).capacity / 480));
};

/* ------------------------------------------------------------- 1. supplier */

const supplierShortage: GameEventDef = {
  id: "chef_shortage",
  title: "The order cannot be filled",
  body: (s) => {
    const k = kit(s);
    const season = seasonOf(s.week);
    return `Your supplier rang at six. ${season.label} has been bad for growers and half of what you ordered is not coming. The rest of ${cityOf(k).name} is ringing the same people.`;
  },
  weight: () => 1.2,
  cooldown: 26,
  eligible: (s) => Object.keys(kit(s).suppliers ?? {}).length > 0,
  tone: "bad",
  choices: [
    {
      label: "Pay whatever the wholesaler is asking",
      detail: "Costs about 60% over the usual price for a week",
      affordable: (s) => s.r.cash >= scaled(s, 1_100),
      apply: (s) => {
        s.r.cash -= scaled(s, 1_100);
        applyStanding(
          s,
          "consistency",
          1.2,
          "Paid over the odds rather than change the menu",
        );
        return "You paid the emergency price and the menu did not change. Nobody in the dining room will ever know.";
      },
    },
    {
      label: "Change the menu for the week",
      detail: "Cook what there is. The regulars will notice",
      apply: (s) => {
        applyStanding(
          s,
          "innovation",
          1.4,
          "Rewrote the menu around what the market actually had",
        );
        applyStanding(
          s,
          "consistency",
          -1.6,
          "The dishes people came back for were not on",
        );
        return "You wrote a new menu on the board at four o'clock. Two tables asked where their usual dish had gone.";
      },
    },
    {
      label: "Serve short and turn people away",
      detail: "No cost tonight. Fewer covers, and they remember",
      apply: (s) => {
        applyStanding(
          s,
          "service",
          -1.8,
          "Turned covers away because the order did not arrive",
        );
        s.r._lastRevenue = Math.round((s.r._lastRevenue ?? 0) * 0.9);
        return "You served what you had and closed the book early. It cost nothing and it cost you the night.";
      },
    },
  ],
};

/* ------------------------------------------------------------ 2. breakdown */

const breakdown: GameEventDef = {
  id: "chef_breakdown",
  title: "Something has stopped working",
  body: (s) => {
    const k = kit(s);
    const broken = (k.equipment ?? [])[0];
    const label = broken ? KIT_BY_ID.get(broken)?.label : "The range";
    return `${label ?? "A piece of kit"} died in the middle of service. The engineer can come Thursday, or you can decide you never needed it.`;
  },
  weight: () => 1.2,
  cooldown: 34,
  eligible: (s) => (kit(s).equipment ?? []).length > 0,
  tone: "bad",
  choices: [
    {
      label: "Get it repaired",
      detail: "Half what the thing cost new",
      affordable: (s) => {
        const k = kit(s);
        const broken = KIT_BY_ID.get((k.equipment ?? [])[0] ?? "");
        return s.r.cash >= repairBill(k, broken);
      },
      apply: (s) => {
        const k = kit(s);
        const broken = KIT_BY_ID.get((k.equipment ?? [])[0] ?? "");
        const bill = repairBill(k, broken);
        s.r.cash -= bill;
        return `The engineer came out at eleven and it was running by service. ${money(bill)}, and worth every note of it.`;
      },
    },
    {
      label: "Work around it",
      detail: "You lose the equipment. It can be bought again later",
      apply: (s) => {
        const k = kit(s);
        const broken = (k.equipment ?? [])[0];
        const label = KIT_BY_ID.get(broken ?? "")?.label ?? "it";
        k.equipment = (k.equipment ?? []).slice(1);
        applyStanding(
          s,
          "service",
          -1.2,
          `Working without ${label.toLowerCase()}`,
        );
        return `${label} went out on the pavement. The section it served is now somebody's arms and a lot of swearing.`;
      },
    },
  ],
};

/* -------------------------------------------------------- 3. large booking */

const bigBooking: GameEventDef = {
  id: "chef_big_booking",
  title: "Somebody wants the whole room",
  body: (s) => {
    const k = kit(s);
    const covers = Math.round(premisesOf(k).capacity * 0.8);
    return `A booker has ${covers} covers looking for a room in three weeks. One sitting, one menu, paid up front. Your room is the right size and they know it.`;
  },
  weight: () => 1.2,
  cooldown: 30,
  eligible: (s) => premisesOf(kit(s)).capacity >= 60,
  tone: "good",
  choices: [
    {
      label: "Take it",
      detail: "Paid in advance. You have three weeks to be ready",
      apply: (s) => {
        const k = kit(s);
        const covers = Math.round(premisesOf(k).capacity * 0.8);
        const fee = local(s, covers * 46);
        s.r.cash += Math.round(fee * 0.4);
        schedule(
          s,
          3,
          "bigBooking",
          { covers, fee },
          `A private dinner for ${covers} in three weeks. Be ready for it.`,
        );
        return `Deposit in, date in the book. ${covers} people, one menu, and three weeks to work out how.`;
      },
    },
    {
      label: "Turn it down",
      detail: "No risk, and the booker files you under 'small'",
      apply: (s) => {
        applyStanding(
          s,
          "atmosphere",
          -0.8,
          "Turned down a private booking the room could have held",
        );
        return "You said the room was not right for it. Both of you knew what that meant.";
      },
    },
  ],
};

/* ---------------------------------------------------------- 4. staff illness */

const illness: GameEventDef = {
  id: "chef_illness",
  title: "Somebody cannot come in",
  body: (s) => {
    const k = kit(s);
    const who = k.staff[0]?.name ?? "Your sous chef";
    return `${who} rang before prep. They are genuinely unwell and they are genuinely apologetic, and there is a full book either way.`;
  },
  weight: () => 1.2,
  cooldown: 24,
  eligible: (s) => kit(s).staff.length > 0,
  tone: "bad",
  choices: [
    {
      label: "Send them home for the week",
      detail: "Paid, and you cover the section yourself",
      apply: (s) => {
        const k = kit(s);
        const who = k.staff[0];
        if (who) who.restingUntil = s.week + 1;
        s.r.burnout += 7;
        applyStanding(
          s,
          "hygiene",
          1.4,
          "Sent somebody unwell home rather than have them on the line",
        );
        if (who) who.loyalty = Math.min(100, (who.loyalty ?? 60) + 8);
        return "You told them not to come back until they were right. They will remember that, and so will your back.";
      },
    },
    {
      label: "Ask them to work it",
      detail: "The section is covered. It is not a clean kitchen decision",
      apply: (s, rng) => {
        const k = kit(s);
        const who = k.staff[0];
        if (who) {
          who.fatigue = Math.min(100, (who.fatigue ?? 0) + 22);
          who.loyalty = Math.max(0, (who.loyalty ?? 60) - 12);
        }
        applyStanding(
          s,
          "hygiene",
          -2.2,
          "Somebody worked a service they should not have",
        );
        if (rng.chance(0.35)) {
          schedule(
            s,
            2,
            "illnessSpread",
            {},
            undefined,
          );
        }
        return "They worked it. They were slower than usual and nobody said anything about why.";
      },
    },
    {
      label: "Close for the night",
      detail: "No covers, no takings, no risk",
      apply: (s) => {
        const k = kit(s);
        s.r.cash -= 0;
        for (const id of Object.keys(s.r)) {
          if (id.startsWith("_svc_")) s.r[id] = 0;
        }
        applyStanding(
          s,
          "consistency",
          -1.4,
          "Closed on a night people had booked",
        );
        k.streak = 0;
        return "A sign on the door and a lot of phone calls. Everybody understood, and everybody went somewhere else.";
      },
    },
  ],
};

/* ------------------------------------------------------- 5. hygiene inspection */

const inspection: GameEventDef = {
  id: "chef_inspection",
  title: "An inspection has been booked",
  body: (s) => {
    const k = kit(s);
    const risky = pantryOf(k).length;
    return `The council will visit within the fortnight. They will look at the cold store, the dates on everything in it, and the ${risky} lots currently sitting in your pantry.`;
  },
  weight: () => 1.2,
  cooldown: 38,
  eligible: (s) => s.week > 6,
  tone: "neutral",
  choices: [
    {
      label: "Close the kitchen for a deep clean",
      detail: "A day's takings and a day's wages, and nothing to find",
      apply: (s) => {
        const bill = scaled(s, 700);
        s.r.cash -= bill;
        const binned = clearSpoiledPantry(kit(s), s.week);
        applyStanding(
          s,
          "hygiene",
          4.5,
          "Stripped and cleaned the kitchen before the inspection",
        );
        schedule(s, 1, "inspection", { prepared: 1 }, "The inspector is due.");
        return binned.units > 0
          ? `Everything out, everything scrubbed, and ${binned.names.slice(0, 2).join(" and ")} in the bin where they belonged.`
          : "Everything out, everything scrubbed. It cost you a day and it will be worth it.";
      },
    },
    {
      label: "Carry on as you are",
      detail: "Costs nothing. They will find what there is to find",
      apply: (s) => {
        schedule(s, 1, "inspection", { prepared: 0 }, "The inspector is due.");
        return "You carried on. Either the kitchen is clean or it is not, and you will find out on Tuesday.";
      },
    },
  ],
};

/* ----------------------------------------------------------- 6. the festival */

const festival: GameEventDef = {
  id: "chef_festival",
  title: "The city food festival",
  body: (s) => {
    const k = kit(s);
    return `Three days in the square, forty kitchens, and everybody in ${cityOf(k).name} walking past with a paper tray. A stall costs money and a lot of prep.`;
  },
  weight: () => 1.2,
  cooldown: 46,
  eligible: (s) => seasonOf(s.week).id === "autumn" && s.r.reputation > 20,
  tone: "good",
  choices: [
    {
      label: "Take a stall",
      detail: "Costs the fee and a week of prep",
      affordable: (s) => s.r.cash >= scaled(s, 1_500),
      apply: (s) => {
        s.r.cash -= scaled(s, 1_500);
        const buzz = ensureBuzz(kit(s));
        buzz.interest = Math.min(1.45, buzz.interest + 0.18);
        s.r.burnout += 6;
        applyStanding(
          s,
          "innovation",
          2.2,
          "Cooked at the city festival",
        );
        schedule(
          s,
          2,
          "festivalTail",
          {},
          "People who tried you at the festival will start booking.",
        );
        return "Six hundred people ate something of yours in three days. Your feet have not forgiven you.";
      },
    },
    {
      label: "Collaborate with a rival",
      detail: "Split the fee and the queue. And the credit",
      apply: (s) => {
        const k = kit(s);
        const rivals = ensureRivals(k, s.week);
        const partner = rivals[1] ?? rivals[0];
        s.r.cash -= scaled(s, 750);
        const buzz = ensureBuzz(k);
        buzz.interest = Math.min(1.45, buzz.interest + 0.1);
        if (partner) partner.reputation = Math.min(92, partner.reputation + 2);
        applyStanding(
          s,
          "atmosphere",
          1.6,
          `Shared a festival stall with ${partner?.name ?? "another kitchen"}`,
        );
        return `You split a stall with ${partner?.name ?? "another kitchen"}. Half the cost, half the queue, and they were better company than expected.`;
      },
    },
    {
      label: "Stay open instead",
      detail: "The city is at the festival. Your room will not be full",
      apply: (s) => {
        applyStanding(
          s,
          "consistency",
          0.8,
          "Open as usual through the festival week",
        );
        return "You opened as normal. It was the quietest Saturday of the year and the prep was already done.";
      },
    },
  ],
};

/* ------------------------------------------------------ 7. seasonal windfall */

const seasonal: GameEventDef = {
  id: "chef_seasonal",
  title: "A short window on something good",
  body: (s) => {
    const ing = seasonalPick(s.week);
    return `A grower has more ${ing?.name.toLowerCase() ?? "produce"} than the market can take and about ten days before it is over for the year. It is the best you will see.`;
  },
  weight: () => 1.2,
  cooldown: 28,
  eligible: (s) => seasonalPick(s.week) !== null,
  tone: "good",
  choices: [
    {
      label: "Buy the lot",
      detail: "As much as this room can turn, at about half price. It still spoils",
      affordable: (s) => {
        const ing = seasonalPick(s.week);
        return (
          ing !== null &&
          s.r.cash >=
            Math.round(
              ing.price *
                Math.max(8, Math.round(premisesOf(kit(s)).capacity / 14)) *
                0.5 *
                produceIndex(kit(s)),
            )
        );
      },
      apply: (s) => {
        const k = kit(s);
        const ing = seasonalPick(s.week);
        if (!ing) return "The grower had sold it by the time you rang back.";
        /* Sized to what a room this size can actually turn before it dies. */
        const qty = Math.max(8, Math.round(premisesOf(k).capacity / 14));
        const unit = (ing.price * 0.5 * produceIndex(k)) / 1;
        s.r.cash -= Math.round(unit * qty);
        k.pantry = [
          ...(k.pantry ?? []),
          {
            id: `lot-${k.nextId++}`,
            ingredient: ing.id,
            qty,
            unitCost: unit,
            life: ing.life,
            boughtWeek: s.week,
            quality: 88,
          },
        ];
        applyStanding(
          s,
          "food",
          1.2,
          `Bought ${ing.name.toLowerCase()} at the top of its season`,
        );
        return `${qty} units of the best ${ing.name.toLowerCase()} you will see this year, at half what it is worth. Now cook it before it turns.`;
      },
    },
    {
      label: "Buy what you can turn",
      detail: "Nothing changes. There is no prize for a full pantry",
      apply: () =>
        "You took a sensible amount and left the rest. It is the correct decision and it never feels like one.",
    },
  ],
};

/* ------------------------------------------------------- 8. the influencer */

const influencer: GameEventDef = {
  id: "chef_influencer",
  title: "Somebody with a following would like a table",
  body: () =>
    "Forty thousand followers, a very polite message, and a clear expectation that dinner will be free. They have done this to every kitchen on the street.",
  weight: () => 1.2,
  cooldown: 36,
  eligible: (s) => s.r.reputation > 24,
  tone: "neutral",
  choices: [
    {
      label: "Comp the whole table",
      detail: "Costs a table's worth of food. Reach, if the night goes well",
      apply: (s) => {
        const k = kit(s);
        s.r.cash -= scaled(s, 260);
        const phone = k.phone;
        if (phone) phone.social.followers += 900;
        schedule(
          s,
          1,
          "influencerPost",
          {},
          "They will post about it next week, whatever happens tonight.",
        );
        return "Dinner on the house, and a lot of photographs of things before anybody ate them.";
      },
    },
    {
      label: "Give them the table, and the bill",
      detail: "No cost. They may write about that instead",
      apply: (s, rng) => {
        const k = kit(s);
        if (rng.chance(0.45)) {
          const phone = k.phone;
          if (phone) {
            phone.social.sentiment = Math.max(0, phone.social.sentiment - 4);
            phone.social.scrutiny = Math.min(100, phone.social.scrutiny + 5);
          }
          applyStanding(
            s,
            "value",
            -1.1,
            "An influencer complained publicly about being charged",
          );
          return "They paid, and then posted about restaurants that do not understand how this works.";
        }
        applyStanding(
          s,
          "value",
          1.2,
          "Charged everybody the same price, publicly",
        );
        return "They paid like everybody else, and said so. It went down rather better than the free meal would have.";
      },
    },
  ],
};

/* ------------------------------------------------------- 9. the reservation */

const celebrity: GameEventDef = {
  id: "chef_celebrity",
  title: "A name has booked for Friday",
  body: () =>
    "The booking is under somebody else's name, but the person who rang was an assistant and the assistant was very specific about the table. Half the room will recognise them.",
  weight: () => 1.2,
  cooldown: 42,
  eligible: (s) => s.r.reputation > 36,
  tone: "good",
  choices: [
    {
      label: "Say nothing to anyone",
      detail: "They get a quiet dinner. You get a regular",
      apply: (s) => {
        applyStanding(
          s,
          "atmosphere",
          2,
          "A guarded table, and the word got round anyway",
        );
        return "Nobody was told, nobody was photographed, and they booked again on the way out.";
      },
    },
    {
      label: "Let it be known",
      detail: "A great deal of attention, and a much higher bar",
      apply: (s) => {
        const k = kit(s);
        const phone = k.phone;
        if (phone) {
          phone.social.followers += 1_400;
          phone.social.scrutiny = Math.min(100, phone.social.scrutiny + 12);
        }
        notePost(k, s.week, {
          interest: 0.2,
          expectation: 8,
          claim: { about: "atmosphere", size: 68 },
        });
        return "By Saturday everybody knew. The phone has not stopped, and every one of those people is coming to look rather than to eat.";
      },
    },
  ],
};

/* ---------------------------------------------------------- 10. the power */

const power: GameEventDef = {
  id: "chef_power",
  title: "The power is out on the street",
  body: (s) => {
    const k = kit(s);
    return `Nothing on the block has electricity and nobody will say for how long. There is ${money(Math.round(pantryOf(k).reduce((n, l) => n + l.qty * l.unitCost, 0)))} of stock in a cold store that is now a cupboard.`;
  },
  weight: () => 1.2,
  cooldown: 40,
  eligible: (s) => pantryOf(kit(s)).length > 0 || kit(s).larder.length > 0,
  tone: "bad",
  choices: [
    {
      label: "Hire a generator",
      detail: "Expensive, immediate, and it saves the stock",
      affordable: (s) => s.r.cash >= scaled(s, 1_150),
      apply: (s) => {
        s.r.cash -= scaled(s, 1_150);
        applyStanding(
          s,
          "hygiene",
          1.6,
          "Kept the cold chain through a power cut",
        );
        return "A generator on the pavement, an extension lead through the window, and a cold store that stayed cold.";
      },
    },
    {
      label: "Move what you can to the kitchen up the road",
      detail: "Free, and you will owe them. Some of it will not survive",
      apply: (s, rng) => {
        const k = kit(s);
        const rivals = ensureRivals(k, s.week);
        const helper = rivals[0];
        const lost = (k.pantry ?? []).filter(() => rng.chance(0.4));
        for (const lot of lost) lot.qty = Math.max(0, Math.round(lot.qty * 0.5));
        if (helper) helper.reputation = Math.min(92, helper.reputation + 1);
        applyStanding(
          s,
          "hygiene",
          -0.8,
          "Half the stock spent a warm evening in a van",
        );
        return `${helper?.name ?? "The kitchen up the road"} took what would fit in their walk-in. You owe them, and they will collect.`;
      },
    },
    {
      label: "Write it off",
      detail: "Lose the cold stock. Nothing else to pay",
      apply: (s) => {
        const k = kit(s);
        const value = (k.pantry ?? []).reduce((n, l) => n + l.qty * l.unitCost, 0);
        k.pantry = [];
        k.larder = [];
        s.r._wasteCost = Math.round((s.r._wasteCost ?? 0) + value);
        applyStanding(
          s,
          "hygiene",
          2,
          "Threw away everything that had been out of temperature",
        );
        return `Everything in the cold store went in the bin. It was the only defensible thing to do and it hurt to watch.`;
      },
    },
  ],
};

/* --------------------------------------------------------- 11. the reaction */

const allergy: GameEventDef = {
  id: "chef_allergy",
  title: "A guest reacted badly to a dish",
  body: (s) => {
    const k = kit(s);
    const dish = (k.menu ?? [])[0];
    const recipe = dish ? RECIPE_BY_ID.get(dish.recipe) : undefined;
    return `A table rang this morning. Somebody who told the floor what they could not eat was served ${recipe ? recipe.name.toLowerCase() : "a dish"} anyway. They are all right. They are also, understandably, upset.`;
  },
  weight: () => 1.2,
  cooldown: 44,
  eligible: (s) => (kit(s).menu ?? []).length > 0,
  tone: "bad",
  choices: [
    {
      label: "Take the dish off and rewrite the whole menu card",
      detail: "Every ingredient listed, every night. Costs you a dish",
      apply: (s) => {
        const k = kit(s);
        k.menu = (k.menu ?? []).slice(1);
        applyStanding(
          s,
          "hygiene",
          3.4,
          "Rewrote the menu so every dish lists what is in it",
        );
        applyStanding(
          s,
          "innovation",
          -0.8,
          "Took a dish off after a guest was served something they had said they could not eat",
        );
        return "The dish came off and every card in the building was rewritten. Slower service, and nobody has to guess.";
      },
    },
    {
      label: "Retrain the floor, keep the menu",
      detail: "A week of somebody's time. The dish stays on",
      apply: (s) => {
        const k = kit(s);
        for (const x of k.staff) x.fatigue = Math.min(100, (x.fatigue ?? 0) + 6);
        applyStanding(
          s,
          "hygiene",
          1.6,
          "Retrained the floor on what is in every dish",
        );
        schedule(s, 4, "allergyReview", {}, undefined);
        return "You spent Monday going through every dish with the floor. If it happens again it will not be because nobody was told.";
      },
    },
    {
      label: "Treat it as a one-off",
      detail: "Costs nothing. It is a decision, and it will be read as one",
      apply: (s) => {
        applyStanding(
          s,
          "hygiene",
          -3,
          "Treated a guest being served something they cannot eat as a one-off",
        );
        const phone = kit(s).phone;
        if (phone) phone.social.scrutiny = Math.min(100, phone.social.scrutiny + 8);
        return "You apologised on the phone and changed nothing. It is not the sort of thing people keep to themselves.";
      },
    },
  ],
};

/* ------------------------------------------------------ 12. the competitor */

const rivalPromotion: GameEventDef = {
  id: "chef_rival_promo",
  title: "The place up the road has cut its prices",
  body: (s) => {
    const k = kit(s);
    const rivals = ensureRivals(k, s.week);
    const who = rivals.find((r) => r.strategy === "undercut") ?? rivals[0];
    return `${who?.name ?? "A rival"} has put a set menu on at a price nobody can make money at. Half your Tuesday regulars have a photograph of it on their phones.`;
  },
  weight: () => 1.2,
  cooldown: 30,
  eligible: (s) => (kit(s).rivals ?? []).length > 0 || s.week > 8,
  tone: "bad",
  choices: [
    {
      label: "Match them",
      detail: "Cut every price on the menu by a fifth for a month",
      apply: (s) => {
        const k = kit(s);
        k.menu = (k.menu ?? []).map((entry) => ({
          ...entry,
          price: Math.round(entry.price * 0.8),
        }));
        applyStanding(s, "value", 3.2, "Cut every price to match a rival");
        applyStanding(
          s,
          "food",
          -1,
          "A price war is paid for out of what goes on the plate",
        );
        return "Every price came down by a fifth. The room filled and the margin did not survive it.";
      },
    },
    {
      label: "Hold your prices and say why",
      detail: "No cut. You have to be visibly worth it",
      apply: (s) => {
        const k = kit(s);
        notePost(k, s.week, {
          expectation: 6,
          claim: { about: "food", size: 66 },
        });
        applyStanding(
          s,
          "value",
          -1.4,
          "Held prices while a rival undercut you",
        );
        applyStanding(
          s,
          "food",
          1.6,
          "Made the case publicly for what the food costs",
        );
        return "You wrote a paragraph about what a chicken costs and posted it. Now the food has to be worth the paragraph.";
      },
    },
    {
      label: "Go the other way",
      detail: "Put prices up. Be the other thing entirely",
      apply: (s) => {
        const k = kit(s);
        k.menu = (k.menu ?? []).map((entry) => ({
          ...entry,
          price: Math.round(entry.price * 1.15),
        }));
        applyStanding(
          s,
          "value",
          -2.6,
          "Raised prices in the middle of a price war",
        );
        applyStanding(
          s,
          "atmosphere",
          2.2,
          "Repositioned above the fight rather than in it",
        );
        return "You put every price up by fifteen per cent on the same Monday they cut theirs. It is either very clever or the end of you.";
      },
    },
  ],
};

/** The seasonal ingredient a given week has a window on, if any. */
function seasonalPick(week: number) {
  const seasonal = [...INGREDIENT_BY_ID.values()].filter((ing) => ing.season);
  const open = seasonal.filter((ing) => inSeason(ing, week));
  return open.length > 0 ? open[week % open.length] : null;
}

/* ------------------------------------------------------------- the follow-ups */

/**
 * The events that only exist as the *second half* of something.
 *
 * `followUp: true` keeps them out of the ordinary weighted roll, so the
 * player can never receive the aftermath of a booking they were never
 * offered.
 */
const bookingNight: GameEventDef = {
  id: "chef_booking_night",
  title: "The private dinner is tonight",
  body: () =>
    "The room is laid for one sitting. Everything is prepped, everybody is in, and there is no second service to fix it in.",
  weight: () => 0,
  cooldown: 0,
  eligible: () => false,
  followUp: true,
  tone: "neutral",
  choices: [
    {
      label: "Cook it",
      detail: "Everybody on, nobody rested",
      apply: (s) => {
        const k = kit(s);
        for (const x of k.staff) x.fatigue = Math.min(100, (x.fatigue ?? 0) + 14);
        s.r.burnout += 5;
        applyStanding(s, "service", 2.4, "Delivered a full-room private dinner");
        return "One sitting, one menu, everybody fed at the same time. That is the whole job and you did it.";
      },
    },
  ],
};

export const CHEF_EVENTS: GameEventDef[] = [
  supplierShortage,
  breakdown,
  bigBooking,
  illness,
  inspection,
  festival,
  seasonal,
  influencer,
  celebrity,
  power,
  allergy,
  rivalPromotion,
  bookingNight,
];

/** Ids of everything above, for the check that the catalogue is wired up. */
export const CHEF_EVENT_IDS = CHEF_EVENTS.map((e) => e.id);

/* Re-exported so `chef.ts` can name what it is resolving without importing
   the whole catalogue twice. */
export const PENDING_KINDS = [
  "bigBooking",
  "inspection",
  "festivalTail",
  "influencerPost",
  "allergyReview",
  "illnessSpread",
] as const;

export type ChefPendingKind = (typeof PENDING_KINDS)[number];

/** Everything a pending consequence needs from the world, in one place. */
export function moraleFloor(k: KitchenState): number | null {
  if (k.staff.length === 0) return null;
  return Math.min(...k.staff.map((x) => moraleOf(x)));
}

/** The staple crate used when an event has to put food in the building. */
export const staple = () => PRODUCE_BY_ID.get("market");

/** The kitchen's signature dish name, if it has earned one. */
export function signatureName(k: KitchenState): string | null {
  const progress = knownRecipes(k).find((p) => p.signature);
  if (!progress) return null;
  const recipe = RECIPE_BY_ID.get(progress.id);
  return recipe ? recipeName(recipe, progress) : null;
}
