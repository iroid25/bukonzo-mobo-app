const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Some packages (TanStack Query, etc.) ship a "modern" ESM build behind the
// `exports`/`import` condition whose relative `.js` imports Metro can't always
// resolve cleanly. Falling back to the file fields (main/module -> legacy
// build) keeps the bundler on the CJS build that just works in React Native.
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: "./global.css" });

