// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// SVG dosyalarının yüklenmesi için yapılandırma
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

// Font dosyalarını dahil et
config.resolver.assetExts.push('ttf');

// Node core modülleri için fallback ekle
config.resolver.nodeModulesPaths = ['node_modules'];
config.resolver.extraNodeModules = {
  stream: require.resolve('readable-stream'),
};

// CJS modülleri için destek ekle
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

// Modül çözümleme sorunları için
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // @rneui/base için özel çözümleme
  if (moduleName.includes('@rneui/base/dist')) {
    return context.resolveRequest(context, '@rneui/base', platform);
  }
  
  // Varsayılan çözümleme
  return context.resolveRequest(context, moduleName, platform);
};

// iOS bundling hatalarını önlemek için
config.resolver.extraNodeModules = {
  'crypto': require.resolve('react-native-crypto'),
  'stream': require.resolve('readable-stream'),
  'buffer': require.resolve('buffer'),
};

// Bağlantı sorunlarını gidermek için ek ayarlar
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // CORS header'ları ekleyerek bağlantı sorunlarını çöz
      res.setHeader('Access-Control-Allow-Origin', '*');
      return middleware(req, res, next);
    };
  },
};

module.exports = config; 