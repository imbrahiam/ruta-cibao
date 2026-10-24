/**
 * `@orpc/server` (pulled in through `@orpc/openapi` by the shared contracts)
 * ships `async (...[input, options]) =>`. The Hermes compiler used for release
 * bundles rejects a destructured rest parameter, so parameters and
 * destructuring are lowered for every module, node_modules included.
 */
module.exports = (api) => {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "@babel/plugin-transform-destructuring",
      "@babel/plugin-transform-parameters",
    ],
  };
};
