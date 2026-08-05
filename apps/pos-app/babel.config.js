module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-configures the react-native-worklets plugin
    // (Reanimated 4) — only NativeWind needs explicit wiring.
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
