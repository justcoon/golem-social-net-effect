import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "golem-temp/**",
      "node_modules/**",
      "dist/**",
      "migrations/**",
      "docs/**",
      "frontend/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
);
