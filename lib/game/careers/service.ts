import type { Rng } from "../types";
import type { KitchenState, ServiceType } from "./kitchen";
import type { Recipe, RecipeProgress } from "./recipes";

/**
 * A SERVICE, ORDER BY ORDER
 *
 * Phase 1 asked how much food should be in the building. This asks what
 * happens on the night: tickets arrive, somebody preps them, somebody cooks
 * them, somebody plates them, and a table either gets what it ordered while it
 * still wanted it or does not.
 *
 * ------------------------------------------------------- why it is not live
 *
 * There is no timer anywhere in this file, and that is deliberate rather than
 * a limitation. A restaurant service played against `setInterval` cannot be
 * paused, cannot be saved mid-night, cannot be replayed, and cannot be tested
 * — and this engine resolves a whole week in one deterministic pass that has
 * to produce the same ledger from the same seed every time.
 *
 * So the night runs as **ticks**, all of them, when the week resolves. Every
 * tick is recorded, and the dashboard renders the recording: the player steps
 * through the service that happened rather than watching one that is
 * happening. Leaving the screen, reloading the save and coming back a month
 * later all show the same night, because the night is data.
 *
 * The player's decisions are the **policies** they set before service — push
 * the brigade, simplify the plating, hold back the walk-ins — each of which
 * changes how the ticks resolve. Staff process the orders; the player decides
 * how they are made to work. That is the management game; clicking individual
 * tickets would be a different and much worse one.
 *
 * ------------------------------------------------------------ the stations
 *
 * Six of them, and each is a queue with a throughput. A ticket occupies one
 * station at a time and moves on when that station has the hands to move it.
 * The station whose queue grows fastest against its capacity is the
 * bottleneck, and it is *named*, because "efficiency low" is not something a
 * player can act on and "the pass is drowning, nobody is plating" is.
 */

/* ------------------------------------------------------------- the ticket */

export type OrderStage =
  | "ordered"
  | "preparing"
  | "cooking"
  | "plating"
  | "served"
  /** Waited past what this service's customers will bear, and left. */
  | "walked";

/** Where the work happens. A ticket passes through some of these, not all. */
export type Station = "prep" | "hot" | "pastry" | "pass" | "wash" | "front";

export interface Order {
  id: number;
  /** Recipe id. */
  dish: string;
  /** Name as the player knows it, so a report never has to look it up. */
  name: string;
  stage: OrderStage;
  /** Tick it was placed. */
  placed: number;
  /** Ticks spent waiting in the current stage. */
  held: number;
  /** Ticks from placed to served — the number a diner actually feels. */
  waited: number;
  /** What it sold for. */
  price: number;
  /** What its ingredients cost, off the lots they came from. */
  cost: number;
  /** 0-100 as it left the pass. */
  quality: number;
  /** Set when something went wrong, in the words the report will use. */
  mistake?: string;
  /** Taken off the bill to keep a table that waited too long. */
  comped?: boolean;
}

/** One tick of the night, kept so the dashboard can step through it. */
export interface ServiceTick {
  tick: number;
  /** Tickets sitting in each stage at the end of this tick. */
  queues: Record<OrderStage, number>;
  /** Covers served so far. */
  served: number;
  /** Longest wait anybody is currently sitting on. */
  worstWait: number;
  /** The station holding everything up, or null when nothing is. */
  bottleneck: Station | null;
  /** Mistakes made this tick. */
  mistakes: number;
}

/* --------------------------------------------------------- the stations */

export const STATIONS: { id: Station; label: string; blurb: string }[] = [
  {
    id: "prep",
    label: "Preparation",
    blurb: "Butchery, mise en place, everything that should have happened before service.",
  },
  {
    id: "hot",
    label: "Hot line",
    blurb: "The stoves. Where a ticket becomes food and where a queue becomes a disaster.",
  },
  {
    id: "pastry",
    label: "Pastry",
    blurb: "Its own section, its own oven, and the reason desserts do not block the mains.",
  },
  {
    id: "pass",
    label: "The pass",
    blurb: "Plating and checking. Nothing leaves the kitchen without crossing it.",
  },
  {
    id: "wash",
    label: "Wash-up",
    blurb: "Plates back on the shelf. Invisible until there are no clean plates.",
  },
  {
    id: "front",
    label: "Front of house",
    blurb: "Seating, ordering and carrying. A dish that sits under the lamp is a cold dish.",
  },
];

export const STATION_BY_ID = new Map(STATIONS.map((s) => [s.id, s]));

/**
 * What each station can move per tick.
 *
 * Built from three things and nothing else: who is standing there, what is
 * installed, and how complicated the menu is. Every one of those is something
 * the player bought or chose, so a bottleneck always has a cause they can act
 * on — which is the whole reason this is a per-station number rather than one
 * "kitchen efficiency" figure.
 */
export interface StationLoad {
  station: Station;
  /** Tickets this station can move this tick. */
  capacity: number;
  /** Tickets waiting on it. */
  queue: number;
  /** Who is holding it up, in the player's words. */
  cause: string;
}

/* ------------------------------------------------------------ the policies */

/**
 * How the player wants the night run.
 *
 * Each one is a real trade and each is stated on the card. They are set before
 * service and hold for the week, which is what makes them a management
 * decision rather than a reflex — the player is deciding how their kitchen
 * behaves under pressure, not reacting to individual tickets.
 */
export interface ServicePolicy {
  /** Late tickets jump the queue. Fewer walkouts, more mistakes elsewhere. */
  prioritiseLate?: boolean;
  /** Plate simply. Faster across the pass, and it shows on the plate. */
  simplePlating?: boolean;
  /** Everyone digs in. More throughput now, more fatigue and mistakes after. */
  pushBrigade?: boolean;
  /** Stop taking walk-ins once the kitchen is behind. Fewer covers, calmer. */
  holdWalkIns?: boolean;
  /** Take the bill off a table that waited far too long. Costs the cover. */
  compDelays?: boolean;
}

export const POLICY_NOTES: {
  id: keyof ServicePolicy;
  label: string;
  gain: string;
  cost: string;
}[] = [
  {
    id: "prioritiseLate",
    label: "Prioritise late tickets",
    gain: "The longest waits go first, so far fewer tables give up and leave.",
    cost: "Working out of order costs the line its rhythm — more mistakes.",
  },
  {
    id: "simplePlating",
    label: "Simplify the plating",
    gain: "The pass moves about a third more tickets an hour.",
    cost: "Presentation drops, and the dishes people came for suffer most.",
  },
  {
    id: "pushBrigade",
    label: "Push the brigade",
    gain: "Every station moves faster while the pressure holds.",
    cost: "Real fatigue afterwards, lower morale, and more mistakes tonight.",
  },
  {
    id: "holdWalkIns",
    label: "Hold the walk-ins",
    gain: "Nobody is seated into a kitchen that is already behind.",
    cost: "Covers you turned away are covers you were not paid for.",
  },
  {
    id: "compDelays",
    label: "Comp the worst delays",
    gain: "A table that waited too long leaves without a bill and without a grudge.",
    cost: "You cooked it, you paid for it, and it was free.",
  },
];

/* --------------------------------------------------------- the difference */

/**
 * HOW EACH SERVICE ACTUALLY DIFFERS
 *
 * Not five multipliers on one calculation. Each of these changes the *shape*
 * of the night: how the room arrives, how long it will wait, what it is
 * judging, and what happens to a ticket that is late.
 *
 *   `arrival`    how covers turn up. `steady` is a lunch rush that keeps
 *                coming; `seating` is a private event where everybody sits at
 *                once; `batch` is catering, which is not a room at all.
 *   `patience`   ticks a diner will wait before walking. A lunch crowd has
 *                somewhere to be; a tasting menu booked six weeks ago does
 *                not.
 *   `expects`    what "good" means here. A caterer is judged on delivering
 *                the count; a tasting menu on the plate.
 *   `courses`    tickets per cover. A tasting menu is nine plates for one
 *                diner, which is why twelve covers can drown a kitchen.
 */
export interface ServiceShape {
  arrival: "steady" | "seating" | "batch";
  patience: number;
  expects: "speed" | "balance" | "presentation" | "delivery" | "contract";
  courses: number;
  /** Ticks the night runs for. */
  length: number;
  /** What a walkout does to reviews, per cover. */
  walkoutCost: number;
}

export const SERVICE_SHAPES: Record<string, ServiceShape> = {
  lunch: {
    arrival: "steady",
    patience: 3,
    expects: "speed",
    courses: 1,
    length: 8,
    walkoutCost: 0.05,
  },
  dinner: {
    arrival: "steady",
    patience: 5,
    expects: "balance",
    courses: 1.4,
    length: 10,
    walkoutCost: 0.08,
  },
  event: {
    /* Everybody sits down at once, and the kitchen either has the hands for
       that or spends the whole night behind. */
    arrival: "seating",
    patience: 9,
    /* They booked the room and paid in advance for a stated number of
       covers. What they are judging is whether everybody got fed. */
    expects: "contract",
    courses: 2,
    length: 8,
    walkoutCost: 0.02,
  },
  catering: {
    /* Nobody is sitting in your dining room being annoyed. The deadline is
       the van, and the only failure is not having it ready. */
    arrival: "batch",
    patience: 99,
    expects: "delivery",
    courses: 1,
    length: 6,
    walkoutCost: 0,
  },
  tasting: {
    arrival: "seating",
    patience: 12,
    expects: "presentation",
    courses: 4,
    length: 12,
    walkoutCost: 0.35,
  },
  counter: {
    /*
     * THE COUNTER, AND WHY IT IS ITS OWN SHAPE
     *
     * Eight people sit down at once, eighteen inches from the pass, and watch
     * every plate being finished — including the ones that go back.
     *
     * That produces the most extreme numbers in this table and each of them
     * follows from the seating rather than from a wish to make it hard:
     *
     *   patience  the highest, because they came for the evening and are
     *             being cooked for in front of their faces;
     *   courses   six, more than the tasting menu — the whole point is the
     *             number of things you are shown;
     *   walkout   the highest cost by a distance, because a table that gets
     *             up and leaves *the counter* does it in front of everybody
     *             else who is eating there.
     */
    arrival: "seating",
    patience: 14,
    expects: "presentation",
    courses: 6,
    length: 14,
    walkoutCost: 0.6,
  },
};

export const shapeOf = (sv: ServiceType): ServiceShape =>
  SERVICE_SHAPES[sv.id] ?? SERVICE_SHAPES.dinner;

/* ------------------------------------------------------------- the report */

export interface DishTally {
  dish: string;
  name: string;
  covers: number;
  revenue: number;
  cost: number;
  quality: number;
}

export interface ServiceReport {
  service: string;
  /** Covers that placed an order. */
  arrived: number;
  served: number;
  walked: number;
  /**
   * Covers the pantry could not source a dish for.
   *
   * They are not a failure of the night — they fall through to the staple
   * crates exactly as they did before the pipeline existed, and the caller
   * serves them. Reported so that fallback is visible rather than silent.
   */
  unmade: number;
  comped: number;
  revenue: number;
  ingredientCost: number;
  /** Ticks, averaged over everybody who was served. */
  averageWait: number;
  worstWait: number;
  mistakes: number;
  /** 0-100, what the room thought of the night. */
  satisfaction: number;
  quality: number;
  /** The station that held the night up, and why. */
  bottleneck: Station | null;
  bottleneckCause: string;
  dishes: DishTally[];
  /** Recorded tick by tick, for the dashboard. */
  ticks: ServiceTick[];
  /** Fatigue this night added, per staff id. */
  fatigue: Record<string, number>;
  /** Experience earned, per staff id. */
  experience: Record<string, number>;
}

const emptyQueues = (): Record<OrderStage, number> => ({
  ordered: 0,
  preparing: 0,
  cooking: 0,
  plating: 0,
  served: 0,
  walked: 0,
});

/**
 * What a ticket for this dish has to pass through.
 *
 * A dessert goes through pastry instead of the hot line, which is the entire
 * reason a pastry chef stops puddings blocking the mains. Everything crosses
 * the pass, because nothing leaves a kitchen without being plated and checked.
 */
export function routeFor(recipe: Recipe): Station[] {
  return recipe.category === "dessert"
    ? ["prep", "pastry", "pass"]
    : ["prep", "hot", "pass"];
}

/** The stage a ticket is in while it sits at a given station. */
const STAGE_AT: Record<Station, OrderStage> = {
  prep: "preparing",
  hot: "cooking",
  pastry: "cooking",
  pass: "plating",
  wash: "plating",
  front: "ordered",
};

export interface ServiceInputs {
  k: KitchenState;
  sv: ServiceType;
  /** Covers that want a table over the whole night. */
  demand: number;
  /** Of those, how many are already promised. */
  booked: number;
  /** The dishes on offer, with their share of the room. */
  plans: {
    recipe: Recipe;
    progress?: RecipeProgress;
    price: number;
    share: number;
    /**
     * How good this dish can be here before the night touches it — its base
     * quality, what refinement added, what its ingredients are worth and what
     * the brigade can actually cook. Computed by the caller from `dishQuality`
     * so the pipeline never has a second opinion about it.
     */
    quality: number;
  }[];
  /** Take the ingredients for one cover of a dish; returns what it cost. */
  draw: (recipe: Recipe, covers: number) => { made: number; cost: number; freshness: number };
  /** Per-station capacity for this service, already including policies. */
  loads: StationLoad[];
  policy: ServicePolicy;
  /** The brigade on tonight, for fatigue and experience. */
  crew: { id: string; skill: number; fatigueResist: number; learns: number }[];
  /** Chance of a mistake per ticket, before pressure. */
  errorRate: number;
  /**
   * How patient tonight's room is, against this service's own patience.
   *
   * A room of families gives up sooner than a room of enthusiasts, and the
   * mix is what decides it — see `diners.ts`. Optional and defaulting to 1,
   * so a caller that knows nothing about segments runs exactly the night this
   * pipeline ran before they existed.
   */
  patience?: number;
  rng: Rng;
}

/**
 * Run the night.
 *
 * Deterministic given the same inputs and the same seeded `rng`: the only
 * randomness is in arrivals and mistakes, both drawn from the run's own
 * stream, so a week replays identically. Nothing here reads the clock.
 */
export function runService(input: ServiceInputs): ServiceReport {
  const { sv, demand, plans, draw, loads, policy, crew, rng } = input;
  const base = shapeOf(sv);
  /* The room's own patience, on top of the service's. Never below one tick:
     even the least patient table gives the kitchen a quarter of an hour. */
  const shape = {
    ...base,
    patience: Math.max(1, base.patience * (input.patience ?? 1)),
  };
  const capacity = new Map(loads.map((l) => [l.station, l.capacity]));
  const causes = new Map(loads.map((l) => [l.station, l.cause]));

  const orders: Order[] = [];
  const ticks: ServiceTick[] = [];
  let nextId = 1;
  let mistakes = 0;
  let unmade = 0;
  /* Queue pressure per station, accumulated so the bottleneck is the one that
     was worst across the night rather than in the last tick. */
  const pressure = new Map<Station, number>(STATIONS.map((s) => [s.id, 0]));

  /* How the room arrives. A seating puts everyone in at once; a batch is one
     order for the whole run; steady trade trickles in across the night. */
  const arrivals: number[] = new Array(shape.length).fill(0);
  if (shape.arrival === "seating") {
    arrivals[0] = demand;
  } else if (shape.arrival === "batch") {
    arrivals[0] = demand;
  } else {
    let left = demand;
    for (let t = 0; t < shape.length && left > 0; t++) {
      /* Busiest in the middle of service, which is when a kitchen finds out
         whether it is staffed. */
      const bell = 1 - Math.abs(t - (shape.length - 1) / 2) / shape.length;
      const take = Math.min(left, Math.round((demand / shape.length) * (0.6 + bell)));
      arrivals[t] = take;
      left -= take;
    }
    if (left > 0) arrivals[shape.length - 1] += left;
  }

  const pickDish = () => {
    /* Deterministic weighted pick across the menu's own shares. */
    let roll = rng.next();
    for (const plan of plans) {
      roll -= plan.share;
      if (roll <= 0) return plan;
    }
    return plans[plans.length - 1];
  };

  for (let t = 0; t < shape.length; t++) {
    /* ------------------------------------------------- 1. tickets arrive */
    let arriving = arrivals[t] ?? 0;
    if (policy.holdWalkIns) {
      /* Held back once the kitchen is visibly behind: a manager stops seating
         into a queue. Booked covers still arrive — they have a table. */
      const behind = orders.filter(
        (o) => o.stage !== "served" && o.stage !== "walked",
      ).length;
      const room = (capacity.get("pass") ?? 1) * 3;
      if (behind > room) arriving = Math.round(arriving * 0.35);
    }

    for (let i = 0; i < arriving; i++) {
      if (plans.length === 0) break;
      /* A cover is one ticket per course; a tasting menu is four. */
      const plates = Math.max(1, Math.round(shape.courses));
      for (let c = 0; c < plates; c++) {
        const plan = pickDish();
        const made = draw(plan.recipe, 1);
        if (made.made <= 0) {
          /* Nothing to cook it from. Not a mistake made tonight — a mistake
             made when the order was placed with the supplier — so the cover
             falls through to the staple crate and the caller serves it. */
          unmade++;
          continue;
        }
        orders.push({
          id: nextId++,
          dish: plan.recipe.id,
          name: plan.progress?.name?.trim() || plan.recipe.name,
          stage: "ordered",
          placed: t,
          held: 0,
          waited: 0,
          price: plan.price / plates,
          cost: made.cost,
          /*
           * What this plate could be, before the night happens to it: the
           * dish's own quality against the freshness of what it was made
           * from. Mistakes and a simplified plating take their cut later, so
           * a ticket's quality is the story of that ticket.
           */
          quality: (plan.quality / 100) * (0.72 + made.freshness * 0.28),
        });
      }
    }

    /* --------------------------------------------- 2. the line does work */
    const moved = new Map<Station, number>();
    /*
     * Oldest first, unless the player asked for the latest tickets to jump.
     * Both are a real policy: first in first out keeps the line's rhythm,
     * and rescuing the worst waits costs that rhythm in mistakes.
     */
    const queue = orders
      .filter((o) => o.stage !== "served" && o.stage !== "walked")
      .sort((a, b) =>
        policy.prioritiseLate ? b.waited - a.waited : a.placed - b.placed,
      );

    for (const order of queue) {
      const recipe = plans.find((p) => p.recipe.id === order.dish)?.recipe;
      if (!recipe) continue;
      const route = routeFor(recipe);
      /* Which station this ticket is sitting at. */
      const at =
        order.stage === "ordered"
          ? route[0]
          : order.stage === "preparing"
            ? route[1]
            : order.stage === "cooking"
              ? route[2]
              : null;
      if (!at) continue;

      const cap = capacity.get(at) ?? 0;
      const used = moved.get(at) ?? 0;
      if (used >= cap) {
        /* The station is full this tick. The ticket waits, and the station's
           pressure goes up — this is what makes it the bottleneck. */
        pressure.set(at, (pressure.get(at) ?? 0) + 1);
        continue;
      }
      moved.set(at, used + 1);

      /* Move it on. */
      const next = route.indexOf(at) + 1;
      if (next >= route.length && policy.simplePlating) {
        /* The pass moved faster and it shows on the plate — the cost the
           policy card states, applied where the plating happens. */
        order.quality *= 0.88;
      }

      /*
       * Mistakes are checked once, as a ticket leaves the pass.
       *
       * The first version rolled at every station, so a three-station ticket
       * had three chances to go wrong and a busy night produced eighty
       * mistakes — which is not a restaurant, it is a farce. A plate goes
       * back or it does not, and the check belongs where the plate is
       * finished.
       */
      if (next >= route.length) {
        const rushed = (queue.length + 1) / Math.max(1, cap * 4);
        const chance =
          input.errorRate *
          (1 + Math.max(0, rushed - 1) * 0.6) *
          (policy.prioritiseLate ? 1.25 : 1) *
          (policy.pushBrigade ? 1.3 : 1);
        if (rng.chance(Math.min(0.35, chance))) {
          mistakes++;
          order.mistake = "Sent back";
          /* It goes round again: the pass loses the slot and the table loses
             its patience, which is exactly what a mistake should cost. */
          order.quality *= 0.72;
          continue;
        }
      }
      order.stage =
        next >= route.length ? "served" : STAGE_AT[route[next]] ?? "plating";
      if (order.stage === "served") {
        order.waited = t - order.placed;
      }
      order.held = 0;
    }

    /* ------------------------------------- 3. everyone still waiting ages */
    for (const order of orders) {
      if (order.stage === "served" || order.stage === "walked") continue;
      order.held++;
      order.waited = t - order.placed;
      /* A diner who has waited past what this service bears gets up and
         leaves. Catering has nobody to walk out; a tasting menu will wait
         almost indefinitely and be furious about it. */
      if (order.waited > shape.patience) {
        if (policy.compDelays && !order.comped) {
          /* Taken off the bill instead: they stay, and they cost you. */
          order.comped = true;
        } else {
          order.stage = "walked";
        }
      }
    }

    const queues = emptyQueues();
    for (const o of orders) queues[o.stage]++;
    const worst = orders
      .filter((o) => o.stage !== "served" && o.stage !== "walked")
      .reduce((n, o) => Math.max(n, o.waited), 0);
    const worstStation = [...pressure.entries()].sort((a, b) => b[1] - a[1])[0];

    ticks.push({
      tick: t,
      queues,
      served: orders.filter((o) => o.stage === "served").length,
      worstWait: worst,
      bottleneck: worstStation && worstStation[1] > 0 ? worstStation[0] : null,
      mistakes,
    });
  }

  /* ------------------------------------------------------ 4. the reckoning */
  /*
   * Service is over. Anything still on the board never left the kitchen, and
   * a table that never got its food did not stay — it walked, and the food it
   * was made from is gone. The first version let those tickets simply vanish,
   * which silently forgave every kitchen that was too slow.
   */
  for (const order of orders) {
    if (order.stage !== "served" && order.stage !== "walked") {
      order.stage = "walked";
    }
  }
  /*
   * The recording has to end where the report begins.
   *
   * Without this the last tick still showed six tickets "cooking" while the
   * header said six walked out — both true at different moments, and together
   * a screen that contradicts itself. The final frame is service *closed*.
   */
  if (ticks.length > 0) {
    const last = ticks[ticks.length - 1];
    const closing = emptyQueues();
    for (const o of orders) closing[o.stage]++;
    last.queues = closing;
  }

  const served = orders.filter((o) => o.stage === "served");
  const walked = orders.filter((o) => o.stage === "walked");
  const comped = served.filter((o) => o.comped);

  const tally = new Map<string, DishTally>();
  let revenue = 0;
  let cost = 0;
  let qualityWeighted = 0;

  for (const o of orders) {
    /* Ingredients are consumed the moment a ticket is accepted, so a walkout
       costs the food as well as the cover. That is what a walkout *is*. */
    cost += o.cost;
    const earned = o.stage === "served" && !o.comped ? o.price : 0;
    revenue += earned;
    if (o.stage === "served") qualityWeighted += o.quality * 100;

    const row = tally.get(o.dish) ?? {
      dish: o.dish,
      name: o.name,
      covers: 0,
      revenue: 0,
      cost: 0,
      quality: 0,
    };
    if (o.stage === "served") {
      row.quality =
        (row.quality * row.covers + o.quality * 100) / Math.max(1, row.covers + 1);
      row.covers += 1;
    }
    row.revenue += earned;
    row.cost += o.cost;
    tally.set(o.dish, row);
  }

  const averageWait =
    served.length > 0
      ? served.reduce((n, o) => n + o.waited, 0) / served.length
      : 0;
  const worstWait = orders.reduce((n, o) => Math.max(n, o.waited), 0);

  /*
   * What the room thought.
   *
   * Judged on what this service is *for*: a lunch crowd on how fast it was, a
   * tasting menu on the plate, a caterer on whether the order was complete.
   * Same night, different verdict — which is the point of having five of them.
   */
  const plate = served.length > 0 ? qualityWeighted / served.length : 0;
  const promptness = Math.max(0, 1 - averageWait / Math.max(1, shape.patience));
  const completeness =
    orders.length > 0 ? served.length / orders.length : 1;
  const satisfaction = Math.max(
    0,
    Math.min(
      100,
      /*
       * Five verdicts on the same night, and this is where the service types
       * stop being multipliers. A lunch crowd forgives a plain plate and not
       * a wait; a tasting menu forgives a wait and nothing else; a caterer
       * and a private event are judged on whether everybody actually got fed,
       * because that is what was contracted for.
       */
      shape.expects === "speed"
        ? promptness * 62 + plate * 0.3 + completeness * 12
        : shape.expects === "presentation"
          ? plate * 0.55 + promptness * 12 + completeness * 30
          : shape.expects === "delivery"
            ? completeness * 74 + plate * 0.22 + 6
            : shape.expects === "contract"
              ? completeness * 60 + plate * 0.3 + promptness * 10
              : promptness * 34 + plate * 0.5 + completeness * 18,
    ) -
      /*
       * Mistakes cost a *share* of the night, not a flat count. Thirty plates
       * sent back out of six hundred is a busy Tuesday; thirty out of forty is
       * a catastrophe, and the same subtraction cannot describe both.
       */
      (orders.length > 0 ? (mistakes / orders.length) * 100 * 0.75 : 0),
  );

  const bottleneckEntry = [...pressure.entries()].sort((a, b) => b[1] - a[1])[0];
  const bottleneck =
    bottleneckEntry && bottleneckEntry[1] > served.length * 0.15
      ? bottleneckEntry[0]
      : null;

  /*
   * What the night did to the people who worked it.
   *
   * Fatigue scales with how hard the night actually was — tickets against
   * capacity — rather than with a flat per-service number, so a quiet lunch is
   * genuinely restful and a full tasting menu is not. Experience is earned by
   * everybody who worked, a little faster for the quick learners.
   */
  const fatigue: Record<string, number> = {};
  const experience: Record<string, number> = {};
  const totalCap = loads.reduce((n, l) => n + l.capacity, 0);
  const strain = totalCap > 0 ? orders.length / (totalCap * shape.length) : 0;
  for (const person of crew) {
    const base = 4 + strain * 16 + (policy.pushBrigade ? 7 : 0);
    fatigue[person.id] = Math.round(base * (1 - person.fatigueResist * 0.35));
    experience[person.id] = Math.round(
      (2 + served.length / 25) * (1 + person.learns * 0.5),
    );
  }

  return {
    service: sv.id,
    arrived: orders.length,
    served: served.length,
    walked: walked.length,
    unmade,
    comped: comped.length,
    revenue: Math.round(revenue),
    ingredientCost: Math.round(cost),
    averageWait: Math.round(averageWait * 10) / 10,
    worstWait,
    mistakes,
    satisfaction: Math.round(satisfaction),
    quality: Math.round(plate),
    bottleneck,
    bottleneckCause: bottleneck ? (causes.get(bottleneck) ?? "") : "",
    dishes: [...tally.values()].sort((a, b) => b.covers - a.covers),
    /* Bounded: a night is at most a dozen ticks, and this is written to the
       save every week. */
    ticks: ticks.slice(-14),
    fatigue,
    experience,
  };
}

/** Ticks are not minutes, but a player thinks in time. One tick is a quarter-hour. */
export const tickLabel = (tick: number): string => {
  const minutes = tick * 15;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m in`;
};
