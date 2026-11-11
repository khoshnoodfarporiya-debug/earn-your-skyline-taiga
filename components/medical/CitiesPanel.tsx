"use client";

import { useEffect, useState } from "react";
import type { RunState } from "@/lib/game/types";
import type { CityId } from "@/lib/game/medical/types";
import { med } from "@/lib/game/careers/doctor";
import { networkNodes } from "@/lib/ui/visuals";
import { NetworkMap } from "../visuals/NetworkMap";
import { CityDetail } from "../visuals/CityDetail";
import { CompareDrawer } from "./CompareDrawer";
import { MarketList } from "./MarketList";

/**
 * THE NETWORK SCREEN
 *
 * Map and intelligence, side by side on a wide screen and stacked on a phone.
 * Selection lives here rather than inside the map, so the board and the panel
 * are two views of one thing.
 *
 * What this screen deliberately no longer contains: a second copy of every
 * city. It used to carry the map, then a network table, then fourteen large
 * market cards — three renderings of the same fourteen rows, one after
 * another, and the player scrolled past all of it. The map answers "where",
 * the panel answers "what about this one", and a single compact sortable list
 * answers "compare them all". Nothing is repeated.
 */
export function CitiesPanel({
  state,
  dispatch,
}: {
  state: RunState;
  dispatch: (cmd: string, arg: string) => void;
}) {
  const m = med(state);
  const [selected, setSelected] = useState<CityId>(m.homeCity);
  /* Up to three markets held side by side. Session-local on purpose: a
     comparison is a moment of deciding, not a setting. */
  const [compare, setCompare] = useState<CityId[]>([]);
  const toggleCompare = (id: CityId) =>
    setCompare((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 3
          ? prev
          : [...prev, id],
    );

  /*
   * If the selected market disappears from the catalogue — only possible via
   * a save from another build — fall back to home rather than rendering an
   * empty panel.
   */
  const nodes = networkNodes(m);
  const node = nodes.find((n) => n.id === selected) ?? nodes[0];
  useEffect(() => {
    if (!nodes.some((n) => n.id === selected)) setSelected(m.homeCity);
  }, [nodes, selected, m.homeCity]);

  return (
    <div className="space-y-5">
      {/*
       * The intelligence column is fixed-width and the map takes the rest, so
       * the panel does not stretch to fill a 1440px screen. Below `xl` the two
       * stack and the map comes first, which is the right order on a phone:
       * find the city, then read about it.
       */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <NetworkMap
            m={m}
            cash={state.r.cash}
            selected={selected}
            onSelect={setSelected}
          />
        </div>

        <div className="min-w-0">
          {node && (
            <div className="form overflow-hidden xl:sticky xl:top-2">
              <CityDetail
                node={node}
                m={m}
                reputation={state.r.reputation}
                cash={state.r.cash}
                dispatch={dispatch}
              />
            </div>
          )}
        </div>
      </div>

      <CompareDrawer
        m={m}
        reputation={state.r.reputation}
        ids={compare}
        onRemove={(id) => setCompare((prev) => prev.filter((x) => x !== id))}
        onClear={() => setCompare([])}
      />

      <MarketList
        m={m}
        reputation={state.r.reputation}
        selected={selected}
        onSelect={setSelected}
        compare={compare}
        onToggleCompare={toggleCompare}
      />
    </div>
  );
}
