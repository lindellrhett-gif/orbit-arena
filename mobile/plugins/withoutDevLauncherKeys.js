// Store builds don't need the local-network permission and Bonjour entry that expo-dev-client adds so a development
// build can find the dev server; App Review asks about permissions an app declares but doesn't use. Development
// builds keep them.
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withoutDevLauncherKeys(config) {
  return withInfoPlist(config, (cfg) => {
    if ((process.env.EAS_BUILD_PROFILE ?? 'development') !== 'development') {
      delete cfg.modResults.NSLocalNetworkUsageDescription;
      delete cfg.modResults.NSBonjourServices;
    }
    return cfg;
  });
};
