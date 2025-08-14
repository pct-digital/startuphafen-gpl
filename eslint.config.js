const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const nxEslintPlugin = require('@nx/eslint-plugin');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  { plugins: { '@nx': nxEslintPlugin } },
  {
    ignores: ['node_modules', '**/*.html'],
  },
  {
    files: ['**/*.html'],
    rules: {
      '@angular-eslint/template/eqeqeq': [
        'off',
        { allowNullOrUndefined: true },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.*?.json'],
      },
    },
  },
  ...compat.config({ extends: ['plugin:@nx/typescript'] }).map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      ...config.rules,
      '@typescript-eslint/no-explicit-any': ['off', {}],
      '@typescript-eslint/no-empty-function': ['off', {}],
      '@typescript-eslint/no-unused-vars': ['off', {}],
      '@typescript-eslint/no-non-null-assertion': ['off', {}],
      'prefer-rest-params': ['off'],
      '@typescript-eslint/no-this-alias': ['off', {}],
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          ignoreIIFE: true,
          ignoreVoid: false,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='forEach']",
          message:
            'Use of forEach is not allowed. Use for...of or Array.prototype.map, filter, or reduce instead.',
        },
      ],
    },
  })),
  ...compat.config({ extends: ['plugin:@nx/javascript'] }).map((config) => ({
    ...config,
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      ...config.rules,
    },
  })),
  ...compat.config({ env: { jest: true } }).map((config) => ({
    ...config,
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
    rules: {
      ...config.rules,
    },
  })),
  {
    files: ['**/*.json'],
    // Override or add rules here
    rules: {},
    languageOptions: { parser: require('jsonc-eslint-parser') },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        { ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'] },
      ],
    },
    languageOptions: { parser: require('jsonc-eslint-parser') },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        { ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'] },
      ],
    },
    languageOptions: { parser: require('jsonc-eslint-parser') },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        { ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'] },
      ],
    },
    languageOptions: { parser: require('jsonc-eslint-parser') },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        { ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'] },
      ],
    },
    languageOptions: { parser: require('jsonc-eslint-parser') },
  },
{
    files: ["**/*.json"],
    rules: { "@nx/dependency-checks": [
            "error",
            { ignoredFiles: ["{projectRoot}/eslint.config.{js,cjs,mjs}"] }
        ] },
    languageOptions: { parser: require("jsonc-eslint-parser") }
},
{
    files: ["**/*.json"],
    rules: { "@nx/dependency-checks": [
            "error",
            { ignoredFiles: ["{projectRoot}/eslint.config.{js,cjs,mjs}"] }
        ] },
    languageOptions: { parser: require("jsonc-eslint-parser") }
},
{
    files: ["**/*.json"],
    rules: { "@nx/dependency-checks": [
            "error",
            { ignoredFiles: ["{projectRoot}/eslint.config.{js,cjs,mjs}"] }
        ] },
    languageOptions: { parser: require("jsonc-eslint-parser") }
},
];
