import type { Config } from "tailwindcss";

/**
 * THE DESIGN SYSTEM
 *
 * One palette for the whole game. Token names are deliberately unchanged from
 * the previous treatment — `paper`, `card`, `ink*`, `clinical` — so the entire
 * interface re-skins from this file rather than from four hundred call sites.
 *
 * Two rules govern colour here:
 *
 *   1. Surfaces are a ladder, not a set. `void` sits behind everything, then
 *      `paper`, then `card`, then `card-high`. Depth comes from stepping up
 *      that ladder, which is what lets most panels drop their border entirely.
 *
 *   2. Every accent has exactly one job. Teal is the primary action and the
 *      active state. Gold is progression, wealth and achievement. Red is
 *      danger, debt and destruction. Amber is a warning that has not happened
 *      yet. Blue is neutral information. Nothing is used decoratively, which
 *      is why a teal element anywhere means "this is the thing to press".
 */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        /* ---------------------------------------------------- the ladder */
        /** Behind everything. The page itself. */
        void: "#08111F",
        /** Recessed: wells, insets, the ground a card sits on. */
        paper: "#0D192A",
        /** A card. The default surface for content. */
        card: "#122137",
        /** A card on a card, or a row that needs to come forward. */
        "card-high": "#182A43",
        /** The only border most things need. */
        rule: "#263A55",
        /** A divider inside a surface, where a full border would be too much. */
        "rule-soft": "#1B2A40",

        /* ------------------------------------------------------ the text */
        ink: "#F4F7FB",
        "ink-soft": "#A7B4C8",
        "ink-faint": "#71829B",

        /* ---------------------------------------------------- the accents */
        /**
         * Primary action, active state, things you own.
         *
         * Since Phase 4 this is the CAREER ACCENT: the raw values live in
         * globals.css keyed by `data-career` on the game's root, teal when
         * nobody is signed in. The token kept its name so the whole
         * interface re-skins from the variables rather than from four
         * hundred call sites.
         */
        clinical: "rgb(var(--accent) / <alpha-value>)",
        "clinical-hover": "rgb(var(--accent-hover) / <alpha-value>)",
        "clinical-tint": "rgb(var(--accent-tint) / <alpha-value>)",
        /** Dark ink for use ON teal or gold. */
        "on-accent": "#042420",

        /** Progression, wealth, achievement, opportunity. */
        gold: "#F4B860",
        "gold-tint": "#2E2415",

        /**
         * The Chef's own accent: muted copper, taken from the warm end of that
         * career's artwork.
         *
         * It exists because teal is the app's "yours / active / do this" and a
         * kitchen photographed under heat lamps fights it. Copper is used only
         * where a Chef screen needs to mark its own state — a live service, the
         * room you are in — and never as a second action colour, so `clinical`
         * still means the same thing in every career.
         */
        chef: "#D08A4A",
        "chef-tint": "#2A1B10",

        /** It went well. */
        good: "#43C78B",
        "good-tint": "#102C22",
        /** It has not gone wrong yet, but it will. */
        caution: "#F59E55",
        "caution-tint": "#2E2216",
        /** It has gone wrong. Debt, danger, outbreak, destruction. */
        alarm: "#EF6461",
        "alarm-tint": "#2E1719",
        /** Neutral information, with no judgement attached. */
        info: "#62A8F5",
        "info-tint": "#12263D",
      },
      borderRadius: {
        /* One family of radii. Panels, buttons and fields all agree. */
        form: "10px",
        panel: "14px",
        pill: "999px",
      },
      boxShadow: {
        /* Depth by elevation, not by outline. */
        form: "0 1px 0 rgba(255,255,255,0.03) inset, 0 2px 10px rgba(0,0,0,0.30)",
        raised: "0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 28px rgba(0,0,0,0.42)",
        lift: "0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px rgba(0,0,0,0.62)",
        /* A focus/selected ring, not a permanent glow. */
        ring: "0 0 0 2px rgba(45,212,191,0.55)",
      },
      spacing: {
        /* The rhythm between major sections. */
        section: "1.5rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
