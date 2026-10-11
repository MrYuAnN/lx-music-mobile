const baseRule = {
  'no-new': 'off',
  camelcase: 'off',
  'no-return-assign': 'off',
  'space-before-function-paren': ['error', 'never'],
  'no-var': 'error',
  'no-fallthrough': 'off',
  eqeqeq: 'off',
  'require-atomic-updates': ['error', { allowProperties: true }],
  'no-multiple-empty-lines': [1, { max: 2 }],
  'comma-dangle': [2, 'always-multiline'],
  'standard/no-callback-literal': 'off',
  'prefer-const': 'off',
  'no-labels': 'off',
  'node/no-callback-literal': 'off',
  'multiline-ternary': 'off',
  'react/display-name': 'off',
  'react/prop-types': 'off',
}

module.exports = {
  root: true,
  extends: [
    'standard',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime',
  ],
  plugins: [
    'react',
  ],
  rules: baseRule,
  parser: '@babel/eslint-parser',
  overrides: [
    {
      // N2 后挂账落地：eslint-config-standard-with-typescript 已停更（锁死 ts-eslint 6，其类型程序
      // 在 TS 5.9/@types/node 26 下破损——Buffer.from 被误判 any、真实类型问题漏报）。弃用改直装
      // typescript-eslint 8；规则口径复刻 43.0.1（standard 等价替换 + 手挑 type-checked 子集，
      // 不开 recommended 全家），并以新类型程序修复暴露的真实问题（await-thenable ×2、断言 ×8）
      files: ['*.ts', '*.tsx'],
      parser: '@typescript-eslint/parser',
      plugins: [
        '@typescript-eslint',
      ],
      rules: {
        ...baseRule,
        // —— 手挑 type-checked 规则（原 43.0.1 口径）——
        '@typescript-eslint/await-thenable': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': [
          'error',
          {
            checksVoidReturn: {
              arguments: false,
              attributes: false,
            },
          },
        ],
        '@typescript-eslint/no-unnecessary-type-assertion': 'error',
        '@typescript-eslint/unbound-method': ['error', { ignoreStatic: false }],
        '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
        '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
        '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true, vars: 'all' }],
        '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
        'no-void': ['error', { allowAsStatement: true }],
        // —— 原有关闭项沿用 ——
        '@typescript-eslint/strict-boolean-expressions': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/space-before-function-paren': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/restrict-template-expressions': [
          1,
          {
            allowBoolean: true,
          },
        ],
        '@typescript-eslint/naming-convention': 'off',
        '@typescript-eslint/return-await': 'off',
        '@typescript-eslint/comma-dangle': 'off',
        '@typescript-eslint/no-dynamic-delete': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-empty-object-type': 'off',
        // —— 8.x recommended 新增但旧口径没有的：off 对齐基线 ——
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/prefer-promise-reject-errors': 'off',
        '@typescript-eslint/no-unused-expressions': 'off',
        '@typescript-eslint/no-duplicate-type-constituents': 'off',
        '@typescript-eslint/prefer-namespace-keyword': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/ban-types': 'off',
        // —— 格式类（原 standard 等价规则口径，低价值维持关闭）——
        'func-call-spacing': 'off',
        'comma-spacing': 'off',
        indent: 'off',
        'no-use-before-define': 'off',
        // TS 自带未定义检查（原 43.0.1 显式 off，全局类型 LX/requestAnimationFrame 来自 .d.ts）
        'no-undef': 'off',
      },
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  ],
  settings: {
    react: {
      version: 'detect', // React version. "detect" automatically picks the version you have installed.
      // You can also use `16.0`, `16.3`, etc, if you want to override the detected value.
      // It will default to "latest" and warn if missing, and to "detect" in the future
    },
  },
  ignorePatterns: [
    'node_modules',
    '*.min.js',
    'test.js',
    '*Test.ts',
  ],
}
