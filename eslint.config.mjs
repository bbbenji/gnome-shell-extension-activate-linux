import gnomeRecommended from "eslint-config-gnome/src/configs/gnome-recommended.js";
import gnomeJsdoc from "eslint-config-gnome/src/configs/gnome-jsdoc.js";

export default [
  ...gnomeRecommended,
  ...gnomeJsdoc,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ARGV: "readonly",
        global: "readonly",
        log: "readonly",
        logError: "readonly",
        print: "readonly",
        printerr: "readonly",
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        TextDecoder: "readonly",
        TextEncoder: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "camelcase": ["error", { "properties": "never" }],
      "consistent-return": "error",
      "eqeqeq": ["error", "smart"],
      "key-spacing": ["error", {
          "mode": "minimum",
          "beforeColon": false,
          "afterColon": true
      }],
      "prefer-arrow-callback": "error",
      "prefer-const": ["error", { "destructuring": "all" }],
      "jsdoc/require-param-description": "off",
      "jsdoc/require-jsdoc": ["error", {
          "exemptEmptyFunctions": true,
          "publicOnly": {
              "esm": true
          }
      }]
    }
  }
];
