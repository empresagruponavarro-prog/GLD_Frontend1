// @ts-check
import eslint from '@eslint/js';
import angular from 'angular-eslint';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/*
 * Política de severidad (STAB-01):
 *  - `error`: reglas con cero infracciones hoy. Rompen `npm run lint`.
 *  - `warn`: reglas con deuda existente (línea base). Se suben a `error` a medida que
 *    cada fase salda su deuda; no añadir infracciones nuevas.
 */
export default defineConfig(
  { ignores: ['dist/', '.angular/', 'node_modules/', 'out-tsc/'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],

      // Deuda existente -> warn
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/consistent-indexed-object-style': 'warn',
      '@angular-eslint/prefer-inject': 'warn',
      '@angular-eslint/use-lifecycle-interface': 'warn',
      'no-var': 'warn',
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      // Deuda existente -> warn (incluye toda la accesibilidad con infracciones)
      '@angular-eslint/template/prefer-control-flow': 'warn',
      '@angular-eslint/template/eqeqeq': 'warn',
      '@angular-eslint/template/label-has-associated-control': 'warn',
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
      '@angular-eslint/template/alt-text': 'warn',
    },
  },
);
