const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-router treats every file under app/ as a route, including colocated
// *.test.ts files. Metro can't bundle Jest's `describe`/`it` globals, so
// those files must be excluded from the app bundle (Jest itself is
// unaffected — it uses its own config, not this one).
config.resolver.blockList = [/\.test\.(ts|tsx|js|jsx)$/];

module.exports = config;
