import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

/**
 * Lint configuration.
 *
 * Deliberately small. The rules that earn their place here are the ones that
 * catch real defects this project has actually hit — render-phase side
 * effects, missing hook dependencies, dead imports — plus the accessibility
 * checks that matter for a keyboard-driven interface.
 *
 * Formatting is not linted. There is no style rule here that a human would
 * have to think about, because a lint run that produces hundreds of cosmetic
 * findings is a lint run nobody reads.
 */
export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "art-source/**",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx,mjs}"],
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      /*
       * The two that matter most here. `rules-of-hooks` is what would have
       * caught the conditional-hook shape of the old page component, and
       * `exhaustive-deps` is what keeps the map's centring effects honest —
       * both are errors, not warnings, because a warning in this project
       * would simply accumulate.
       */
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",

      // Dead code. `_`-prefixed names are the documented escape hatch.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],

      // Accessibility checks that apply to a keyboard-driven game interface.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/no-redundant-roles": "error",

      /*
       * `any` is a warning rather than an error: the save validator walks
       * genuinely unknown parsed JSON, and the test harness mutates it, which
       * is the one place `any` is the honest type.
       */
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Node scripts are not browser code.
  {
    files: ["scripts/**/*.ts", "e2e/**/*.ts", "*.config.{ts,mjs}"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
);
