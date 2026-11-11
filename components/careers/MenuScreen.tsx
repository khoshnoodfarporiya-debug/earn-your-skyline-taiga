"use client";

import type { RunState } from "@/lib/game/types";
import { money } from "@/lib/game/format";
import { Stat } from "./Shelf";
import {
  PREMISES,
  activeMenu,
  bestSkillIn,
  knownRecipes,
  knowsRecipe,
  menuFactors,
  menuShortfalls,
  premisesOf,
  progressFor,
} from "@/lib/game/careers/kitchen";
import { kitchen, localSum } from "@/lib/game/careers/chef";
import {
  INGREDIENT_BY_ID,
  RECIPES,
  RECIPE_BY_ID,
  dishBlocker,
  dishMargin,
  dishQuality,
  recipeBlocker,
  recipeCost,
  recipeName,
  type Recipe,
} from "@/lib/game/careers/recipes";

/**
 * THE MENU
 *
 * Two halves of one decision. The top is what you are offering tonight and
 * what it earns; the bottom is the book of everything you know how to cook and
 * everything you could learn.
 *
 * The screen's job is to make the trade legible, because every part of it
 * pulls against another part: a wider menu reaches more people and wastes more
 * food, a higher price earns more per cover and empties tables, and a dish
 * beyond the brigade goes out worse than a simple one done properly. Each of
 * those is a real number in `menuFactors`, and each is printed here rather
 * than left for the player to infer from a bad week.
 */
export function MenuScreen({
  state,
  onCommand,
}: {
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
}) {
  const k = kitchen(state);
  const menu = activeMenu(k);
  const factors = menuFactors(k, state.r.skill);
  const best = bestSkillIn(k, state.r.skill);
  const room = premisesOf(k);
  const roomIndex = PREMISES.findIndex((p) => p.id === k.premises);
  const known = knownRecipes(k);

  /* What a full room would order, so a shortage can be named before it bites
     rather than reported after it. */
  const covers = Math.round(room.capacity / 2);
  const shortfalls = menuShortfalls(k, covers, state.week, state.r.skill);

  const totalCost = menu.reduce(
    (n, e) => n + (RECIPE_BY_ID.get(e.recipe) ? recipeCost(RECIPE_BY_ID.get(e.recipe)!) : 0),
    0,
  );
  const totalPrice = menu.reduce((n, e) => n + e.price, 0);
  const foodShare = totalPrice > 0 ? totalCost / totalPrice : 0;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------ the summary */}
      <section
        aria-labelledby="menu-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="menu-h" className="text-sm font-semibold text-ink">
          What is on
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          A cover orders one main and is tempted by the rest. Breadth earns
          more a head and wastes more food; the price you set decides how many
          of them come at all.
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Stat label="Dishes" value={`${factors.dishes}`} />
          <Stat
            label="Courses"
            value={`${factors.variety}`}
            tone={factors.variety >= 3 ? "good" : undefined}
          />
          <Stat
            label="Against the room"
            value={`${Math.round(factors.priceIndex * 100)}%`}
            tone={factors.priceIndex > 1.35 ? "bad" : "good"}
          />
          <Stat
            label="Food cost"
            value={foodShare > 0 ? `${Math.round(foodShare * 100)}%` : "—"}
            tone={foodShare > 0.4 ? "bad" : "good"}
          />
        </dl>
        <ul className="mt-3 space-y-1 border-t border-rule-soft pt-3 text-xs text-ink-faint">
          <li>
            Covers wanting a table:{" "}
            <span className={factors.demand >= 1 ? "text-good" : "text-caution"}>
              {Math.round(factors.demand * 100)}%
            </span>{" "}
            of what an unpriced room would draw.
          </li>
          <li>
            Consistency on the plate:{" "}
            <span className={factors.quality >= 1 ? "text-good" : "text-caution"}>
              {Math.round(factors.quality * 100)}%
            </span>{" "}
            — a short menu is a sharper kitchen.
          </li>
          <li>
            Covers the brigade can plate:{" "}
            <span className={factors.prepLoad >= 1 ? "text-good" : "text-caution"}>
              {Math.round(factors.prepLoad * 100)}%
            </span>{" "}
            — slow dishes eat the pass.
          </li>
        </ul>
      </section>

      {/* --------------------------------------------------------- the menu */}
      <section
        aria-labelledby="on-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="on-h" className="text-sm font-semibold text-ink">
          Tonight&rsquo;s menu
        </h2>
        {menu.length === 0 ? (
          <p className="mt-3 rounded border border-dashed border-rule px-3 py-4 text-center text-xs text-ink-faint">
            Nothing on. Every cover eats the staple crate and pays the room&rsquo;s
            ordinary spend for it — add a dish below and you decide the price.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {menu.map((entry) => {
              const recipe = RECIPE_BY_ID.get(entry.recipe);
              if (!recipe) return null;
              const progress = progressFor(k, entry.recipe);
              const margin = dishMargin(recipe, entry.price);
              const blocked = dishBlocker(recipe, k, best);
              /* Short of an ingredient at a full room: the warning that can
                 still be acted on, named by the one helper the pantry panel
                 and the weekly briefing also read. */
              const shortOf = shortfalls.find((x) => x.dish === recipeName(recipe, progress));
              const unprofitable = margin.profit <= 0;

              return (
                <li
                  key={entry.recipe}
                  className={`rounded border px-3 py-2.5 text-xs ${
                    blocked
                      ? "border-alarm/45"
                      : progress?.signature
                        ? "border-chef/50"
                        : unprofitable || shortOf
                          ? "border-caution/45"
                          : "border-rule-soft"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium text-ink">
                      {recipeName(recipe, progress)}
                      {progress?.signature && (
                        <span className="sign ml-2 rounded-full border border-chef/60 px-1.5 py-0.5 text-[10.5px] text-chef">
                          Signature
                        </span>
                      )}
                    </span>
                    <span className="text-ink-faint">
                      {recipe.category} · {recipe.cuisine}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-ink-faint">
                    <span>
                      Sells at <span className="text-ink">{money(entry.price)}</span>
                    </span>
                    <span>
                      Costs <span className="text-ink">{money(margin.cost)}</span>
                    </span>
                    <span>
                      Margin{" "}
                      <span className={unprofitable ? "text-alarm" : "text-good"}>
                        {money(margin.profit)}
                      </span>
                    </span>
                    <span>
                      Food cost{" "}
                      <span
                        className={
                          margin.foodCostShare > 0.4 ? "text-caution" : "text-ink"
                        }
                      >
                        {Math.round(margin.foodCostShare * 100)}%
                      </span>
                    </span>
                    <span>
                      {recipe.prepTime} min · difficulty {recipe.difficulty} ·
                      ordered by {recipe.popularity}%
                    </span>
                  </div>

                  {(blocked || shortOf) && (
                    <p
                      className={`mt-1.5 ${blocked ? "text-alarm" : "text-caution"}`}
                    >
                      {blocked ??
                        `Not enough ${INGREDIENT_BY_ID.get(shortOf!.ingredient)?.name.toLowerCase()} to serve a full room — ${shortOf!.have} of the ${shortOf!.need} it needs.`}
                    </p>
                  )}

                  {/* Price is a slider-free control on purpose: two steps and
                      a reset, so a number can be changed with a thumb and by
                      a keyboard without a text field to validate. */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <PriceButton
                      label="−10%"
                      title={`Drop the price of ${recipeName(recipe, progress)}`}
                      onClick={() =>
                        onCommand(
                          "priceDish",
                          `${entry.recipe}:${Math.max(1, Math.round(entry.price * 0.9))}`,
                        )
                      }
                    />
                    <PriceButton
                      label="+10%"
                      title={`Raise the price of ${recipeName(recipe, progress)}`}
                      onClick={() =>
                        onCommand(
                          "priceDish",
                          `${entry.recipe}:${Math.round(entry.price * 1.1)}`,
                        )
                      }
                    />
                    <PriceButton
                      label="Suggested"
                      title={`Price ${recipeName(recipe, progress)} as suggested`}
                      onClick={() =>
                        onCommand(
                          "priceDish",
                          `${entry.recipe}:${localSum(state, recipe.suggestedPrice)}`,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() => onCommand("dropDish", entry.recipe)}
                      className="rounded border border-rule-soft px-2 py-1 text-ink-faint transition hover:border-alarm hover:text-alarm"
                    >
                      Take it off
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------------- the recipes */}
      <section
        aria-labelledby="book-h"
        className="rounded-lg border border-rule bg-card p-4"
      >
        <h2 id="book-h" className="text-sm font-semibold text-ink">
          The book
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          What you can cook, and what you could learn to. Developing a dish
          costs money and a week&rsquo;s attention; refining one you already know
          makes it better every time.
        </p>
        <ul className="mt-3 space-y-2">
          {RECIPES.map((recipe) => (
            <RecipeRow
              key={recipe.id}
              recipe={recipe}
              state={state}
              onCommand={onCommand}
              known={knowsRecipe(k, recipe.id)}
              onMenu={menu.some((e) => e.recipe === recipe.id)}
              best={best}
              roomIndex={roomIndex}
              progress={known.find((p) => p.id === recipe.id)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

function PriceButton({
  label,
  title,
  onClick,
}: {
  label: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-rule px-2 py-1 text-ink transition hover:border-chef"
    >
      <span aria-hidden>{label}</span>
      <span className="sr-only">{title}</span>
    </button>
  );
}

function RecipeRow({
  recipe,
  state,
  onCommand,
  known,
  onMenu,
  best,
  roomIndex,
  progress,
}: {
  recipe: Recipe;
  state: RunState;
  onCommand: (cmd: string, arg: string) => void;
  known: boolean;
  onMenu: boolean;
  best: number;
  roomIndex: number;
  progress?: { id: string; name?: string; served: number; refined: number; signature?: boolean };
}) {
  const k = kitchen(state);
  const locked = recipeBlocker(recipe, {
    craft: state.r.skill,
    roomIndex,
    reputation: state.r.reputation,
  });
  const develop = localSum(state, recipe.developCost);
  const refine = localSum(state, 600 + (progress?.refined ?? 0) * 900);
  const quality = dishQuality(recipe, progress, best);
  const blocked = dishBlocker(recipe, k, best);

  return (
    <li
      className={`rounded border px-3 py-2.5 text-xs ${
        progress?.signature
          ? "border-chef/50"
          : known
            ? "border-rule-soft"
            : "border-rule-soft opacity-75"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-medium text-ink">
          {recipeName(recipe, progress)}
        </span>
        <span className="text-ink-faint">
          {recipe.category} · {recipe.cuisine} · quality {Math.round(quality)}
        </span>
      </div>
      <p className="mt-0.5 text-ink-faint">{recipe.blurb}</p>
      <p className="mt-1 text-ink-faint">
        {recipe.needs
          .map(
            (line) =>
              `${INGREDIENT_BY_ID.get(line.ingredient)?.name ?? line.ingredient} ${line.qty}`,
          )
          .join(" · ")}{" "}
        · about {money(recipeCost(recipe))} a cover
      </p>
      {known && progress && (
        <p className="mt-1 text-ink-faint">
          {progress.served} covers sent out · refined {progress.refined}{" "}
          {progress.refined === 1 ? "time" : "times"}
          {progress.signature ? " · your signature" : ""}
        </p>
      )}
      {blocked && known && <p className="mt-1 text-alarm">{blocked}</p>}
      {locked && !known && <p className="mt-1 text-caution">{locked}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {!known && (
          <button
            type="button"
            disabled={!!locked || state.r.cash < develop}
            onClick={() => onCommand("developRecipe", recipe.id)}
            className="rounded border border-rule px-2.5 py-1 text-ink transition enabled:hover:border-chef disabled:cursor-not-allowed disabled:opacity-45"
          >
            {develop > 0 ? `Develop · ${money(develop)}` : "Develop"}
          </button>
        )}
        {known && !onMenu && (
          <button
            type="button"
            onClick={() => onCommand("addDish", recipe.id)}
            className="rounded border border-rule px-2.5 py-1 text-ink transition hover:border-chef"
          >
            Put it on
          </button>
        )}
        {known && onMenu && <span className="text-chef">On the menu</span>}
        {known && (
          <button
            type="button"
            disabled={state.r.cash < refine}
            onClick={() => onCommand("refineRecipe", recipe.id)}
            className="rounded border border-rule-soft px-2.5 py-1 text-ink-soft transition enabled:hover:border-chef enabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            Refine · {money(refine)}
          </button>
        )}
        {known && !locked && (
          /*
           * Renaming an original.
           *
           * The catalogue keeps its own id and its own name; this only ever
           * writes `progress.name`, so a dish can be called anything without
           * the row it belongs to being lost. An empty name resets it.
           */
          <RenameControl
            current={recipeName(recipe, progress)}
            onRename={(next) => onCommand("nameRecipe", `${recipe.id}:${next}`)}
          />
        )}
      </div>
    </li>
  );
}

/**
 * The one piece of player-authored text in this career.
 *
 * A native prompt rather than an inline field: it is a rare action, it needs
 * no layout, and it is reachable by keyboard and announced by a screen reader
 * without any of the focus management an inline editor would need. The command
 * sanitises whatever comes back, so nothing here has to be trusted.
 */
function RenameControl({
  current,
  onRename,
}: {
  current: string;
  onRename: (name: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const next = window.prompt("Call this dish:", current);
        if (next !== null) onRename(next);
      }}
      className="rounded border border-rule-soft px-2.5 py-1 text-ink-faint transition hover:border-chef hover:text-ink"
    >
      Rename
    </button>
  );
}
