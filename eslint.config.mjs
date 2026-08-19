import gnomeRecommended from 'eslint-config-gnome/src/configs/gnome-recommended.js';
import gnomeJsdoc from 'eslint-config-gnome/src/configs/gnome-jsdoc.js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
    {
        ignores: ['node_modules/', 'extract-eslint/'],
    },
    ...gnomeRecommended,
    ...gnomeJsdoc,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
        },
        rules: {
            'no-unused-vars': ['warn', {argsIgnorePattern: '^_'}],
            'no-empty': ['error', {allowEmptyCatch: true}],
            camelcase: ['error', {properties: 'never'}],
            'consistent-return': 'error',
            eqeqeq: ['error', 'smart'],
            'key-spacing': [
                'error',
                {
                    mode: 'minimum',
                    beforeColon: false,
                    afterColon: true,
                },
            ],
            'prefer-arrow-callback': 'error',
            'prefer-const': ['error', {destructuring: 'all'}],
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-jsdoc': [
                'error',
                {
                    exemptEmptyFunctions: true,
                    publicOnly: {
                        esm: true,
                    },
                },
            ],
        },
    },
    // Enforces .prettierrc.json as lint errors; must stay last so it can turn
    // off the stylistic rules the configs above would otherwise fight over.
    prettierRecommended,
];
