module.exports = {
    env: {
        commonjs: true,
        es2021: false,
        browser: true,
        jquery: true,
        es6: true,
    },
    extends: ['eslint:recommended', 'prettier'],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
    },
    rules: {},
};
