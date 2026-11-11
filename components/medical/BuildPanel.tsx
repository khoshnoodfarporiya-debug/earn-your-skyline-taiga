"use client";

import { PurchaseShelf } from "../purchase/PurchaseShelf";
import type { RunState } from "@/lib/game/types";
import { med } from "@/lib/game/careers/doctor";
import {
  departmentSlots,
  facilitySlots,
  techniciansNeeded,
} from "@/lib/game/medical/sim";
import { PracticeEvolution } from "../visuals/PracticeEvolution";

export function BuildPanel({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const m = med(state);
  const cash = state.r.cash;
  const deptUsed = m.departments.length;
  const deptMax = departmentSlots(m);
  const techs = m.staff.filter((s) => s.role === "technician").length;
  const techNeed = techniciansNeeded(m);

  return (
    <div className="space-y-4">
      {/* Environmental progression, directly above the premises it refers to. */}
      <PracticeEvolution m={m} cash={cash} />

      {/*
       * Premises, as a shelf of illustrated cards.
       *
       * The old list carried the same four buildings as text rows. A
       * regional hospital is the largest purchase in the game and it read
       * exactly like a checkbox — which is the whole reason this pass
       * exists.
       */}
      <PurchaseShelf
        state={state}
        dispatch={dispatch}
        groups={["facilities"]}
        title={`Premises · ${Math.round(facilitySlots(m))} slots · ${deptUsed}/${deptMax} departments`}
      />
      {/*
       * Departments, as a shelf of illustrated cards.
       *
       * The last purchase in the game still rendered as a text row, and the
       * one carrying the most state: opening one is a decision about slots,
       * staffing and equipment at once, and all three can be wrong
       * independently. The card carries the coverage; the drawer carries the
       * detail; the model behind both reads `coverageFor`, which is the same
       * function the resolver calls.
       */}
      <PurchaseShelf
        state={state}
        dispatch={dispatch}
        groups={["departments"]}
        title={`Departments · ${deptUsed}/${deptMax} slots used`}
      />

      {techs < techNeed && (
        <p className="form border border-alarm/30 bg-alarm-tint px-5 py-3 text-[12.5px] leading-relaxed text-alarm">
          Short of technicians — every machine-dependent case is being turned
          away. Any machine bought now sits idle and still charges upkeep.
        </p>
      )}

      <PurchaseShelf
        state={state}
        dispatch={dispatch}
        groups={["equipment"]}
        title={`Equipment · ${techs}/${techNeed} technicians`}
      />
    </div>
  );
}
