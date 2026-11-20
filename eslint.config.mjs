// ESLint exists to watch what tsc cannot: the dependency arrays of hooks (COD-03).
// Only react-hooks rules are on; style stays out of scope.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  { ignores: ['node_modules/**', 'ios/**', 'android/**', 'libs/api-client/generated/**', 'libs/validations/generated/**', 'libs/reglas/**', 'coverage/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    // The plugin is registered only so existing `eslint-disable @typescript-eslint/...` comments resolve; none of its rules are on.
    plugins: { 'react-hooks': reactHooks, '@typescript-eslint': tseslint.plugin },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  // Test wrappers and mocks are not components: hook-call placement is not meaningful there.
  { files: ['**/__tests__/**', '**/__mocks__/**', '**/*.test.{ts,tsx}'], rules: { 'react-hooks/rules-of-hooks': 'off' } },
  // BASELINE (COD-03): hook dependency findings that existed when ESLint was added. They are warnings, not
  // fixed here because changing effect dependencies changes behavior. Fix one by one and delete its line.
  {
    files: [
      'hooks/useAuthGuard.ts',
      'src/components/layout/CustomDrawerContent.tsx',
      'src/core/ui/Skeleton.tsx',
      'src/features/venta-nueva/components/VentaNuevaPantalla.tsx',
      'src/features/venta-nueva/hooks/useAutoguardado.ts',
    ],
    rules: { 'react-hooks/exhaustive-deps': 'warn' },
  },
);
