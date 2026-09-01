import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Pre-existing backlog, tracked as warnings so CI enforces everything
      // else at error level instead of being red from day one. New code should
      // still type its values and escape its entities — these are not licence,
      // they are a debt marker. Counts when this was set: 196 `any`, 26
      // unescaped entities, 8 setState-in-effect.
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Generated from the database schema; not hand-maintained.
    files: ["src/lib/supabase/database.types.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
