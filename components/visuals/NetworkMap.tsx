"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CityId, MedicalState } from "@/lib/game/medical/types";
import { OUTBREAK_BY_ID } from "@/lib/game/medical/outbreaks";
import { cityOf } from "@/lib/game/medical/cities";
import { facilitySlots } from "@/lib/game/medical/sim";
import { compactCount, money } from "@/lib/game/format";
import {
  clusterNodes,
  networkNodes,
  networkRoutes,
  type MapCluster,
  type MapNode,
} from "@/lib/ui/visuals";
import { MAP_VIEWBOX, centreScroll, routePath, sy } from "@/lib/ui/worldmap";
import { LockGlyph, PatientGlyph } from "./MapGlyphs";
import { MapSurface } from "./map/MapSurface";

/**
 * THE NETWORK MAP
 *
 * A world board built from semantic HTML and SVG, driven entirely by run
 * state. The geography is real — Natural Earth's public-domain country data,
 * projected equirectangular at build time into plain SVG paths (see
 * `scripts/build-map.ts`). No tile server, no API key, and no mapping library
 * in the browser: the app ships three strings.
 *
 * The ocean is CSS gradients and the terrain is an SVG filter, because a
 * photograph of a place cannot tell you where your clinics are.
 *
 * Layering, back to front: ocean, land, routes, markers. Markers are real
 * buttons — 40px targets, keyboard-reachable, each carrying its full state in
 * its accessible name — and every city is labelled on the map at every size,
 * so nothing depends on hovering.
 *
 * Below the map sits a city navigator: the same fourteen cities as a row of
 * chips, synchronised with the map both ways. On a phone it is the fast path;
 * for a screen reader it is the reliable one; and it means the map itself can
 * be scrolled sideways without anything becoming unreachable.
 */

/**
 * Below this the map scrolls sideways rather than crushing Europe.
 *
 * Raised from 960: at the old size seven European cities shared about 130
 * pixels, and everything about the board — labels, leader lines, the gap
 * between a marker and its neighbour — was fighting for room that did not
 * exist. The map wants to be big.
 */
const MIN_MAP_PX = 1180;

/*
 * Zoom is clamped so the board can never be smaller than its own column, nor
 * so large that panning becomes a chore.
 *
 * The ceiling is 6x rather than something more modest because the geography is
 * real, and real geography puts London and Paris twelve pixels apart at 1x.
 * At 6x that pair clears 71px. Zoom is how this map separates its densest
 * region — the alternative, nudging cities apart, moves them into the
 * Atlantic, which looks far worse than markers that briefly overlap.
 */
const ZOOM_MIN = 1;
const ZOOM_MAX = 6;

export function NetworkMap({
  m,
  cash,
  selected,
  onSelect,
}: {
  m: MedicalState;
  /** Drives the gold "you could buy this today" marker state. */
  cash: number;
  /**
   * Selection is owned by the screen, not the map, so the intelligence panel
   * can sit beside the board on desktop and below it on a phone while both
   * read from the same source. The map still *drives* selection — unlocking a
   * market or relocating moves it — it just does not keep it.
   */
  selected: CityId;
  onSelect: (id: CityId) => void;
}) {
  const nodes = useMemo(() => networkNodes(m), [m]);
  const routes = useMemo(() => networkRoutes(m), [m]);
  const setSelected = onSelect;

  const scroller = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef(new Map<CityId, HTMLButtonElement>());

  /*
   * A centring request. `nonce` is what the layout effect watches, so asking
   * to centre the city that is already centred still moves the map, while an
   * ordinary state change — a week passing, cash ticking over — moves
   * nothing. That distinction is the whole reason this is not just `selected`.
   */
  const [focus, setFocus] = useState({ id: m.homeCity, nonce: 0 });
  const centreOn = (id: CityId) =>
    setFocus((f) => ({ id, nonce: f.nonce + 1 }));

  const select = (id: CityId) => {
    setSelected(id);
    centreOn(id);
  };

  /**
   * Put the focused city in the middle of the pannable viewport.
   *
   * A layout effect, not a timeout: refs are attached and layout is settled
   * by the time this runs, and it lands before the browser paints, so the map
   * is never seen at the wrong offset. On mount that means the home city is
   * already centred in the first painted frame.
   *
   * The jump is instant. Smooth scrolling is not honoured everywhere, a map
   * that sometimes animates and sometimes does not is worse than one that
   * never does, and instant is the correct behaviour under reduced motion.
   */
  const centreNow = (id: CityId) => {
    const el = markerRefs.current.get(id);
    const box = scroller.current;
    if (!el || !box) return;
    /*
     * Measured from rendered rectangles rather than `offsetLeft`, which
     * reports the pre-transform position — markers are translated back by
     * half their width, so offsetLeft lands 20px to the right of where the
     * marker actually is.
     */
    const marker = el.getBoundingClientRect();
    const viewport = box.getBoundingClientRect();
    const centreInContent =
      marker.left + marker.width / 2 - viewport.left + box.scrollLeft;
    box.scrollLeft = centreScroll(
      centreInContent,
      box.clientWidth,
      box.scrollWidth,
    );
  };

  useLayoutEffect(() => {
    centreNow(focus.id);
  }, [focus]);

  /*
   * Whether the board actually overflows, and re-centring when the window
   * changes width. The pan hint and edge fades appear only when there is
   * somewhere to pan to, so a desktop board that fits shows neither —
   * measured rather than assumed from a breakpoint, because the board has a
   * fixed minimum width and the column does not.
   *
   * Width changes also move the correct scroll offset, so rotating a phone
   * would otherwise leave the selected city sitting off to one side. Height
   * is ignored: mobile browser chrome collapsing on scroll is a height change
   * and must not yank the map sideways.
   */
  const [pannable, setPannable] = useState(false);
  const focused = useRef(focus.id);
  focused.current = focus.id;

  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    let lastWidth = box.clientWidth;
    setPannable(box.scrollWidth > box.clientWidth + 1);

    const observer = new ResizeObserver(() => {
      setPannable(box.scrollWidth > box.clientWidth + 1);
      if (box.clientWidth === lastWidth) return;
      lastWidth = box.clientWidth;
      centreNow(focused.current);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  /*
   * Zoom, as a multiplier on the board's rendered width. Doing it this way
   * rather than with a CSS transform means the scroll container keeps doing
   * the clamping for free — the map can never be panned off into nothing,
   * because there is nothing there to scroll to.
   */
  const [zoom, setZoom] = useState(1);
  const zoomTo = (next: number) => {
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(next.toFixed(2)))));
    centreOn(focused.current);
  };
  const resetView = () => {
    setZoom(1);
    setSelected(m.homeCity);
    setFocus((f) => ({ id: m.homeCity, nonce: f.nonce + 1 }));
  };

  /*
   * Wheel zoom only with a modifier held. A bare wheel over a large element
   * that swallowed the event would trap the page scroll, which is a far worse
   * failure than not having wheel zoom at all.
   */
  const onWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomTo(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  };

  /*
   * Arrow keys walk between markers geographically rather than in DOM order,
   * so "right" from Lyon reaches Milan and not whichever button happens to be
   * next in the array. Only nodes actually in that direction are considered,
   * and the nearest wins.
   */
  const stepTo = (dx: number, dy: number) => {
    const from = nodes.find((n) => n.id === selected);
    if (!from) return;
    const best = nodes
      .filter((n) => n.id !== from.id)
      .map((n) => ({ n, ox: n.x - from.x, oy: n.y - from.y }))
      .filter(({ ox, oy }) => ox * dx + oy * dy > Math.abs(ox * dy - oy * dx))
      .sort((a, b) => Math.hypot(a.ox, a.oy) - Math.hypot(b.ox, b.oy))[0];
    if (!best) return;
    select(best.n.id);
    markerRefs.current.get(best.n.id)?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      stepTo(move[0], move[1]);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      resetView();
    }
  };

  /*
   * Watch the run for the three things that should move the map on their own:
   * a licence bought, premises opened, or the player relocating. Everything is
   * compared against the previous render's value, so an ordinary weekly update
   * fires none of them and the map holds still.
   *
   * `fresh` and `opened` drive one-shot marker and route animations. Both are
   * presentation state — never saved, and a reload simply shows the result.
   */
  const prev = useRef<{
    cities: string;
    operating: string;
    home: CityId;
  } | null>(null);
  const [fresh, setFresh] = useState<Set<CityId>>(new Set());
  const [opened, setOpened] = useState<Set<CityId>>(new Set());

  useEffect(() => {
    const cities = [...m.cities].sort();
    const operating = nodes
      .filter((n) => n.state === "operating")
      .map((n) => n.id)
      .sort();
    const snapshot = {
      cities: cities.join(","),
      operating: operating.join(","),
      home: m.homeCity,
    };
    const before = prev.current;
    prev.current = snapshot;
    // First pass: the mount-time layout effect has already centred home.
    if (!before) return;

    if (snapshot.home !== before.home) {
      setSelected(snapshot.home);
      centreOn(snapshot.home);
      return;
    }

    const licensed = cities.filter((id) => !before.cities.split(",").includes(id));
    if (licensed.length > 0) {
      const latest = licensed[licensed.length - 1];
      setSelected(latest);
      centreOn(latest);
      setFresh(new Set(licensed));
      return;
    }

    const built = operating.filter(
      (id) => !before.operating.split(",").includes(id),
    );
    if (built.length > 0) {
      centreOn(built[built.length - 1]);
      setOpened(new Set(built));
    }
  }, [m, nodes, setSelected]);

  /* Clear the one-shot animations. Separate effects so each has one job. */
  useEffect(() => {
    if (fresh.size === 0) return;
    const timer = setTimeout(() => setFresh(new Set()), 1600);
    return () => clearTimeout(timer);
  }, [fresh]);

  useEffect(() => {
    if (opened.size === 0) return;
    const timer = setTimeout(() => setOpened(new Set()), 1400);
    return () => clearTimeout(timer);
  }, [opened]);

  const operating = nodes.filter((n) => n.state === "operating");
  const totalPanel = nodes.reduce((t, n) => t + n.panel, 0);

  /*
   * WHICH CITIES GET A LABEL
   *
   * Real geography puts seven European markets inside about five percent of
   * the board's width. Every one of them labelled at low zoom is a smear, and
   * hiding a fixed list would hide the wrong ones — the interesting city in
   * Europe is whichever one you are actually running.
   *
   * So: rank by how much the player has invested — selected, home, operating,
   * licensed, locked — and walk down that order keeping a label only if it
   * clears everything already kept. Zooming in shrinks the required clearance
   * in map units, so more names appear the closer you look, and the set is
   * always the most important ones that fit.
   *
   * Nothing becomes unreachable: the marker is still there, still a button,
   * still has its full accessible name, and the navigator below lists all
   * fourteen regardless.
   */
  /*
   * Overlapping markets are drawn as one badge. The threshold is a touch
   * target, so a cluster exists exactly when the alternative would be two
   * buttons you cannot tell apart — and dissolves the moment zoom gives them
   * room. Nothing is hidden: the navigator and market list below reach every
   * city whether it is grouped or not.
   */
  const clusters = useMemo(
    () =>
      clusterNodes(nodes, {
        zoom,
        boardPx: MIN_MAP_PX,
        minSeparationPx: 42,
        selected,
      }),
    [nodes, zoom, selected],
  );

  /** Zoom in far enough to break a cluster apart, and centre on it. */
  const openCluster = (c: MapCluster) => {
    const widest = c.members.reduce(
      (m, a) =>
        Math.max(
          m,
          ...c.members.map((b) =>
            Math.hypot((a.x - b.x) * 11.8, (a.y - b.y) * 6.6),
          ),
        ),
      0,
    );
    // Enough zoom that the two closest members clear a touch target, with a
    // floor so a pair sitting almost on top of each other still opens.
    const needed = widest > 0 ? Math.min(ZOOM_MAX, (48 / widest) * zoom) : ZOOM_MAX;
    setZoom(Math.max(zoom * 1.8, Number(needed.toFixed(2))));
    setSelected(c.lead.id);
    setFocus((f) => ({ id: c.lead.id, nonce: f.nonce + 1 }));
  };

  const labelled = useMemo(() => {
    const rank = (n: MapNode) =>
      n.id === selected ? 0 : n.isHome ? 1 : n.state === "operating" ? 2 : n.state === "licensed" ? 3 : 4;

    /*
     * Half the width of a name, in map units, from the name itself — a flat
     * clearance was suppressing labels that had room to spare. At font-size
     * 1.4 in a 100-unit box a character averages about 0.7 units, so half a
     * name is roughly `0.34 * length`, plus a little breathing space.
     */
    const halfWidth = (n: MapNode) => (n.name.length * 0.34 + 0.5) / zoom;
    const clearY = 2.2 / zoom;

    /*
     * Only cities that are actually drawn as their own marker. A clustered
     * city has no marker of its own, so labelling it leaves a name floating
     * over open water with nothing beneath it — which is what happened to
     * Berlin.
     */
    const visible = clusters
      .filter((c) => c.members.length === 1)
      .map((c) => c.members[0]);

    const kept: MapNode[] = [];
    for (const n of [...visible].sort((a, b) => rank(a) - rank(b))) {
      const clashes = kept.some(
        (k) =>
          Math.abs(k.x - n.x) < halfWidth(k) + halfWidth(n) &&
          Math.abs(sy(k.y) - sy(n.y)) < clearY,
      );
      if (!clashes) kept.push(n);
    }
    return kept;
  }, [clusters, selected, zoom]);

  const totals = [
    { label: "Operating", value: `${operating.length}`, sub: `${m.cities.length} licensed` },
    { label: "Sites", value: `${m.facilities.length}`, sub: `${Math.round(facilitySlots(m))} slots` },
    { label: "Patients", value: totalPanel.toLocaleString("en-US"), sub: "across the network" },
    {
      label: "Outbreaks",
      value: `${m.outbreaks.length}`,
      sub: m.outbreaks.length === 0 ? "none running" : "needs a response",
      alarm: m.outbreaks.length > 0,
    },
  ];

  return (
    <section className="form overflow-hidden">
      <div className="form-head flex items-baseline justify-between gap-3 px-4 py-2.5 sm:px-5">
        <h3 className="sign text-[11.5px] text-ink-faint">Network map</h3>
        <p className="num text-[12px] text-ink-faint">
          {nodes.length} markets worldwide
        </p>
      </div>

      {/* ---------------------------------------------------- network totals */}
      <dl className="grid grid-cols-2 gap-px border-b border-rule bg-rule-soft sm:grid-cols-4">
        {totals.map((t) => (
          <div key={t.label} className="bg-card px-4 py-2">
            <dt className="sign text-[11.5px] text-ink-faint">{t.label}</dt>
            <dd
              className={`num text-[18px] font-semibold leading-tight ${t.alarm ? "text-alarm" : "text-ink"}`}
            >
              {t.value}
            </dd>
            <dd className="text-[11.5px] leading-none text-ink-faint">
              {t.sub}
            </dd>
          </div>
        ))}
      </dl>

      {/* ------------------------------------------------------------- board */}
      <div className="relative">
        <div
          ref={scroller}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          /*
           * Tall enough on a desktop to show the whole board at once — at
           * 1180px wide the map is 661px tall, and a window shorter than that
           * meant Australia was permanently below a fold nobody knew to
           * scroll. On a phone it stays capped: the map is the screen's
           * subject, not the whole screen.
           */
          className="max-h-[56vh] overflow-auto overscroll-contain bg-paper lg:max-h-[700px]"
          role="group"
          aria-label="World map. Arrow keys move between cities, Home returns to your base. Every city is also listed below the map."
          tabIndex={-1}
        >
        <div
          className="relative aspect-[100/56]"
          style={{ minWidth: MIN_MAP_PX * zoom }}
        >
          {/*
           * Everything below the markers: water, land, borders, grid. Lives
           * in its own component because cartography changes for visual
           * reasons and interaction changes for gameplay reasons, and this
           * file was carrying both.
           */}
          <MapSurface viewBox={MAP_VIEWBOX} />

          <svg
            viewBox={`0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >

            {/*
             * Routes sit above land, below markers. Decorative by design: the
             * detail card states every connection in words.
             *
             * Each is drawn twice — a soft wide glow and a crisp line — and
             * the crisp line carries a slow dash flow so the network reads as
             * live rather than painted on. A route to a city that has just
             * opened draws itself in once first. Both stop under
             * prefers-reduced-motion.
             */}
            <g fill="none" className="text-clinical">
              {routes.map((r) => {
                const d = routePath(r.a, r.b);
                const fresh = opened.has(r.to);
                const lit = r.to === selected || r.from === selected;
                return (
                  <g key={`${r.from}-${r.to}`}>
                    <path
                      d={d}
                      stroke="currentColor"
                      strokeWidth={lit ? 5 : 3.5}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      opacity={lit ? 0.22 : 0.1}
                    />
                    <path
                      d={d}
                      stroke="currentColor"
                      strokeWidth={fresh ? 1.8 : lit ? 1.5 : 1.15}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      opacity={fresh ? 0.95 : lit ? 0.85 : 0.5}
                      className={fresh ? "route-draw" : "route-flow"}
                    />
                  </g>
                );
              })}
            </g>

            {/* Leader lines, drawn only where a label was moved sideways.
                Offsets divided by zoom for the same reason the labels are —
                see the note on the names below. */}
            <g stroke="#8AA0C4" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={0.5}>
              {nodes
                .filter((n) => Math.abs(n.label.dx) >= 2)
                .map((n) => (
                  <line
                    key={`lead-${n.id}`}
                    x1={n.x + (n.label.dx > 0 ? 1.1 : -1.1) / zoom}
                    y1={sy(n.y)}
                    x2={n.x + (n.label.dx * 0.82) / zoom}
                    y2={sy(n.y) + sy(n.label.dy) / zoom}
                  />
                ))}
            </g>

            {/*
             * Names. In the SVG so they clip with the board — but sized in
             * screen pixels rather than board units.
             *
             * Everything here is divided by `zoom` on purpose. The SVG grows
             * with the zoom level (`minWidth: MIN_MAP_PX * zoom`), so a
             * `fontSize` in viewBox units grows with it: at 6x, "London" was
             * rendered six times larger and the names covered the continent
             * they were labelling. Dividing by the same factor holds them at a
             * constant size on screen, which is how a map label is supposed to
             * behave — you zoom to see more places, not larger words.
             *
             * The offsets go the same way, so a name stays the same distance
             * from its marker rather than drifting further off as you zoom.
             *
             * This also makes the rendering agree with the collision code
             * above, which has always measured labels as `/ zoom` — it was
             * already deciding which names fit on the assumption that they
             * were a fixed screen size, while they were drawn scaling.
             */}
            <g className="select-none">
              {labelled.map((n) => (
                <text
                  key={`label-${n.id}`}
                  x={n.x + n.label.dx / zoom}
                  y={sy(n.y) + sy(n.label.dy) / zoom}
                  textAnchor={n.label.anchor}
                  dominantBaseline="middle"
                  fontSize={1.4 / zoom}
                  className={
                    n.id === selected
                      ? "fill-ink font-semibold"
                      : n.state === "locked"
                        ? "fill-ink-faint"
                        : "fill-ink-soft"
                  }
                  style={{
                    paintOrder: "stroke",
                    stroke: "#0A1220",
                    /* The halo has to shrink with the text or it swallows it. */
                    strokeWidth: 0.55 / zoom,
                    strokeLinejoin: "round",
                  }}
                >
                  {n.name}
                </text>
              ))}
            </g>
          </svg>

          {clusters.map((c) =>
            c.members.length === 1 ? (
              <Marker
                key={c.members[0].id}
                node={c.members[0]}
                selected={c.members[0].id === selected}
                fresh={fresh.has(c.members[0].id)}
                affordable={
                  c.members[0].state === "locked" &&
                  cash >= cityOf(c.members[0].id).entryCost
                }
                onSelect={() => select(c.members[0].id)}
                register={(el) => {
                  const id = c.members[0].id;
                  if (el) markerRefs.current.set(id, el);
                  else markerRefs.current.delete(id);
                }}
              />
            ) : (
              <ClusterMarker
                key={c.id}
                cluster={c}
                onOpen={() => openCluster(c)}
                register={(el) => {
                  // Registered under the lead's id so centring on any member
                  // still finds something to scroll to while grouped.
                  if (el) markerRefs.current.set(c.lead.id, el);
                  else markerRefs.current.delete(c.lead.id);
                }}
              />
            ),
          )}
        </div>
        </div>

        {/*
         * Edge fades, so the board visibly continues past the viewport, plus
         * a written hint. Both only appear when there is actually something
         * to pan to — on a desktop board that fits, neither shows.
         */}
        {/* ------------------------------------------------- view controls */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          {[
            { label: "Zoom in", glyph: "+", on: () => zoomTo(zoom * 1.35), off: zoom >= ZOOM_MAX },
            { label: "Zoom out", glyph: "−", on: () => zoomTo(zoom / 1.35), off: zoom <= ZOOM_MIN },
            { label: "Reset the map to your home city", glyph: "⌂", on: resetView, off: false },
          ].map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.on}
              disabled={c.off}
              aria-label={c.label}
              /* 40px, like the markers: these are the map's controls on a
                 phone and must be as tappable as the cities are. */
              className="flex h-11 w-11 items-center justify-center rounded-form border border-rule bg-card/95 text-[16px] text-ink-soft backdrop-blur-[2px] transition hover:border-clinical hover:text-clinical focus-visible:ring-2 focus-visible:ring-clinical disabled:opacity-35"
            >
              <span aria-hidden>{c.glyph}</span>
            </button>
          ))}
        </div>

        {pannable && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-paper to-transparent"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-paper to-transparent"
            />
            {/* Top-left, clear of the zoom controls on the right. */}
            <p
              aria-hidden
              className="pointer-events-none absolute left-2 top-2 rounded-full border border-rule bg-card/90 px-2.5 py-1 text-[11.5px] text-ink-soft"
            >
              Drag to explore ·{" "}
              <span className="text-clinical">or pick a city below</span>
            </p>
          </>
        )}
      </div>

      <Legend />

      {/* -------------------------------------------------- city navigator */}
      <nav
        aria-label="Cities"
        className="border-t border-rule bg-paper px-3 py-2.5 sm:px-4"
      >
        <p className="sign mb-1.5 text-[11.5px] text-ink-faint">
          All markets — pick one to centre it on the map
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {nodes.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => select(n.id)}
                aria-current={n.id === selected ? "true" : undefined}
                className={`flex items-center gap-1.5 rounded-form border px-2 py-1 text-[12.5px] transition ${
                  n.id === selected
                    ? "border-clinical bg-clinical-tint text-ink"
                    : "border-rule bg-card text-ink-soft hover:border-clinical hover:text-clinical"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    n.state === "operating"
                      ? "bg-clinical"
                      : n.state === "licensed"
                        ? "border border-clinical"
                        : "border border-ink-faint/70"
                  }`}
                />
                {n.name}
                {n.isHome && (
                  <span className="sign text-[11px] text-clinical">home</span>
                )}
                {n.outbreak && (
                  <span className="sign text-[11px] text-alarm">outbreak</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

/* ----------------------------------------------------------------- cluster */

/**
 * Several markets drawn as one, because at this zoom they overlap.
 *
 * Pressing it zooms far enough in to break the group apart and centres on it,
 * so the affordance is honest — the badge is a way *in*, not a dead end. Its
 * accessible name lists what is inside, so a screen reader is never told
 * merely that there are seven of something.
 */
function ClusterMarker({
  cluster,
  onOpen,
  register,
}: {
  cluster: MapCluster;
  onOpen: () => void;
  register: (el: HTMLButtonElement | null) => void;
}) {
  const operating = cluster.members.filter((m) => m.state === "operating").length;
  const outbreaks = cluster.members.filter((m) => m.outbreak).length;
  const hasHome = cluster.members.some((m) => m.isHome);

  const summary = [
    `${cluster.members.length} markets`,
    operating > 0 ? `${operating} operating` : null,
    hasHome ? "including where you work" : null,
    outbreaks > 0 ? `${outbreaks} with an outbreak` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      ref={register}
      type="button"
      onClick={onOpen}
      aria-label={`${summary}: ${cluster.members.map((m) => m.name).join(", ")}. Zoom in to separate them.`}
      title={cluster.members.map((m) => m.name).join(" · ")}
      className="group absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-clinical focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1220]"
      /* Percentages of the board box, exactly like a single marker — NOT
         `sy()`, which converts into the SVG's 100x56 viewBox and would place
         the badge somewhere over Iceland. */
      style={{ left: `${cluster.x}%`, top: `${cluster.y}%` }}
    >
      {outbreaks > 0 && (
        <span
          aria-hidden
          className="absolute h-9 w-9 animate-pulse rounded-full border-2 border-alarm bg-alarm/15 motion-reduce:animate-none"
        />
      )}
      <span
        aria-hidden
        className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-[12px] font-semibold shadow-[0_0_12px_rgba(53,224,192,0.35)] transition-transform group-hover:scale-110 group-focus-visible:scale-110 motion-reduce:transition-none ${
          operating > 0 || hasHome
            ? "border-clinical bg-[#0C2A2A] text-clinical"
            : "border-rule bg-[#0A1220] text-ink-soft"
        }`}
      >
        {cluster.members.length}
      </span>
      {/* The word, so the badge is not a bare number. */}
      <span className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap text-[11px] text-ink-soft drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
        markets
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ marker */

function Marker({
  node,
  selected,
  fresh,
  affordable,
  onSelect,
  register,
}: {
  node: MapNode;
  selected: boolean;
  fresh: boolean;
  /** Locked, but the licence is within reach today. */
  affordable: boolean;
  onSelect: () => void;
  register: (el: HTMLButtonElement | null) => void;
}) {
  const outbreak = node.outbreak;

  /*
   * Five states, and each one means a different thing to the player:
   *
   *   operating   solid teal   — you run this
   *   licensed    teal outline — you may build here
   *   opportunity gold         — locked, but you can afford it today
   *   locked      muted slate  — out of reach for now
   *   outbreak    red halo, layered over whichever of the above applies
   *
   * Gold is the addition. A locked market you can actually buy is the most
   * actionable thing on the board and used to look identical to one costing
   * four times your cash.
   */
  const dot =
    node.state === "operating"
      ? "h-[18px] w-[18px] border-2 border-clinical bg-clinical"
      : node.state === "licensed"
        ? "h-3.5 w-3.5 border-2 border-clinical bg-paper"
        : affordable
          ? "h-3.5 w-3.5 border-2 border-gold bg-gold-tint"
          : "h-2.5 w-2.5 border border-ink-faint/60 bg-paper";

  const label = [
    node.name,
    node.country,
    node.state === "locked"
      ? "not licensed"
      : node.state === "licensed"
        ? "licensed, no premises built"
        : `operating, ${node.sites} site${node.sites === 1 ? "" : "s"}, ${node.panel} patients`,
    node.isHome ? "you are here" : null,
    outbreak
      ? `outbreak: ${OUTBREAK_BY_ID.get(outbreak.id)?.label ?? outbreak.id}, ${outbreak.weeksLeft} weeks to run, ${outbreak.contained ? "contained" : "not contained"}`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <button
      ref={register}
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-pressed={selected}
      className="group absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-clinical focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      {/* Status ring: a quiet halo that separates a working site from a bare
          licence at a glance, without another colour. */}
      {node.state === "operating" && !outbreak && (
        <span
          aria-hidden
          className="absolute h-6 w-6 rounded-full border border-clinical/35"
        />
      )}
      {outbreak && (
        <span
          aria-hidden
          className="absolute h-8 w-8 animate-pulse rounded-full border-2 border-alarm bg-alarm/20 motion-reduce:animate-none"
        />
      )}
      {fresh && (
        <span
          aria-hidden
          className="node-pulse absolute h-8 w-8 rounded-full border-2 border-clinical"
        />
      )}
      {/* Selection: a soft spotlight on the map plus a bright ring, so the
          current city is obvious without comparing marker sizes. */}
      {selected && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute h-24 w-24 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(53,224,192,0.18) 0%, transparent 65%)",
            }}
          />
          <span
            aria-hidden
            className="absolute h-8 w-8 rounded-full border-2 border-ink shadow-[0_0_16px_rgba(53,224,192,0.65)]"
          />
        </>
      )}

      <span
        aria-hidden
        className={`relative flex items-center justify-center rounded-full transition-transform group-hover:scale-125 group-focus-visible:scale-125 motion-reduce:transition-none ${dot} ${selected ? "scale-125" : ""}`}
      >
        {/* Home reads as a ring around a pip, so it never looks like an
            ordinary operating city at a glance. */}
        {node.isHome && node.state !== "locked" && (
          <span className="h-2 w-2 rounded-full bg-paper" />
        )}
      </span>

      {/* A padlock on an unlicensed market, so the state is carried by a
          symbol as well as by size and colour. */}
      {node.state === "locked" && (
        <span
          aria-hidden
          /*
           * Only on hover, focus or selection. Fourteen padlocks pinned to the
           * board permanently was the single noisiest thing on the map, and it
           * told the player something they could already see from the marker's
           * own colour. It appears when you are actually asking about a city.
           */
          className={`pointer-events-none absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full border bg-void text-ink-faint shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-opacity motion-reduce:transition-none ${
            affordable ? "border-gold/60 text-gold" : "border-rule"
          } ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}
        >
          <LockGlyph className="h-2.5 w-2.5" />
        </span>
      )}

      {/*
       * Scale badge. The panel itself below a thousand, thousands above it —
       * never a bare unit letter. An earlier build showed a hundred patients
       * as "1h" and it read as one hour.
       */}
      {node.state === "operating" && (
        <span
          aria-hidden
          /*
           * A bare number on a marker is a riddle — 190 of what? The badge now
           * carries a person glyph, and the marker's accessible name and its
           * tooltip both say "patients" in full.
           */
          title={`${node.panel.toLocaleString("en-US")} patients`}
          className="num pointer-events-none absolute -right-1.5 -top-2 flex items-center gap-0.5 rounded-pill border border-clinical/70 bg-void px-1.5 py-px text-[11px] font-semibold leading-[14px] text-clinical"
        >
          <PatientGlyph className="h-2.5 w-2.5" />
          {compactCount(node.panel)}
        </span>
      )}
      {outbreak && (
        <span
          aria-hidden
          className="absolute -left-1 -top-1 rounded-full border border-alarm bg-paper px-1 text-[11px] font-bold leading-[13px] text-alarm"
        >
          !
        </span>
      )}

      {/* Desktop hover card. Purely additive — the same words are in the
          accessible name and in the detail panel. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-form border border-rule bg-card px-2 py-1 text-[12px] text-ink opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
      >
        {node.state === "operating"
          ? `${node.sites} site${node.sites === 1 ? "" : "s"} · ${node.panel.toLocaleString("en-US")} patients`
          : node.state === "licensed"
            ? "Licensed · nothing built"
            : `Licence ${money(cityOf(node.id).entryCost)}`}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ legend */

function Legend() {
  const items = [
    { cls: "h-2.5 w-2.5 border border-ink-faint/70", text: "Not licensed" },
    { cls: "h-3 w-3 border-2 border-clinical/80", text: "Licensed" },
    { cls: "h-3.5 w-3.5 border-2 border-clinical bg-clinical", text: "Operating" },
    {
      cls: "h-3.5 w-3.5 border-2 border-clinical bg-clinical ring-1 ring-ink ring-offset-1 ring-offset-card",
      text: "You are here",
    },
    { cls: "h-3.5 w-3.5 border-2 border-alarm bg-alarm/20", text: "Outbreak" },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule bg-card px-4 py-2 sm:px-5">
      {items.map((i) => (
        <li key={i.text} className="flex items-center gap-1.5">
          <span aria-hidden className={`shrink-0 rounded-full ${i.cls}`} />
          <span className="text-[12px] text-ink-soft">{i.text}</span>
        </li>
      ))}
    </ul>
  );
}
