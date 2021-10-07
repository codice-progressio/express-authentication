module.exports = {
  esversion:11,
  env: {
    commonjs: true,
    node: true,
  },
  extends: "eslint:recommended",
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
  rules: {
    semi: ["error", "never"]
  },
}
