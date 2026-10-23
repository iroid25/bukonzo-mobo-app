module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      "react-native-reanimated/plugin",
      // Strip console.log/debug/info from production bundles (keep warn/error so
      // real problems still surface in crash reporting). Dev builds are
      // untouched.
      ...(process.env.NODE_ENV === "production" || process.env.BABEL_ENV === "production"
        ? [["transform-remove-console", { exclude: ["error", "warn"] }]]
        : []),
    ],
  };
};
