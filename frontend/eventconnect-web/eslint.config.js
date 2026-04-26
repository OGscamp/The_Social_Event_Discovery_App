import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // shadcn/ui ships templates we don't modify; tailwind.config.ts uses
  // CommonJS require() by design. Both predate this lint setup and
  // shouldn't gate the workflow.
  { ignores: ["dist", "coverage", "src/components/ui/**", "tailwind.config.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Test files lean on `(fetch as any).mockResolvedValueOnce(...)` for
  // mocking and on a few other intentional escape hatches. Enforcing
  // `no-explicit-any` there would mean wrapping every mock in a typed
  // helper for no real correctness benefit, so we relax it for the
  // test directory only — production code under src/pages, src/lib,
  // etc. is still held to the strict rule.
  {
    files: ["src/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
