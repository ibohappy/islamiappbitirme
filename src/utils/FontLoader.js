import * as Font from 'expo-font';
import { Platform } from 'react-native';

// React Native Vector Icons'tan fontları doğrudan alıyoruz
export const fontFiles = {
  'AntDesign': require('react-native-vector-icons/Fonts/AntDesign.ttf'),
  'Entypo': require('react-native-vector-icons/Fonts/Entypo.ttf'),
  'EvilIcons': require('react-native-vector-icons/Fonts/EvilIcons.ttf'),
  'Feather': require('react-native-vector-icons/Fonts/Feather.ttf'),
  'FontAwesome': require('react-native-vector-icons/Fonts/FontAwesome.ttf'),
  'FontAwesome5_Brands': require('react-native-vector-icons/Fonts/FontAwesome5_Brands.ttf'),
  'FontAwesome5_Regular': require('react-native-vector-icons/Fonts/FontAwesome5_Regular.ttf'),
  'FontAwesome5_Solid': require('react-native-vector-icons/Fonts/FontAwesome5_Solid.ttf'),
  'Fontisto': require('react-native-vector-icons/Fonts/Fontisto.ttf'),
  'Foundation': require('react-native-vector-icons/Fonts/Foundation.ttf'),
  'Ionicons': require('react-native-vector-icons/Fonts/Ionicons.ttf'),
  'MaterialCommunityIcons': require('react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
  'MaterialIcons': require('react-native-vector-icons/Fonts/MaterialIcons.ttf'),
  'Octicons': require('react-native-vector-icons/Fonts/Octicons.ttf'),
  'SimpleLineIcons': require('react-native-vector-icons/Fonts/SimpleLineIcons.ttf'),
  'Zocial': require('react-native-vector-icons/Fonts/Zocial.ttf'),
};

export async function loadFonts() {
  try {
    await Promise.all(
      Object.entries(fontFiles).map(([fontFamily, fontFile]) =>
        Font.loadAsync({ [fontFamily]: fontFile })
      )
    );
    console.log('All fonts loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading fonts:', error);
    // Fontlar yüklenemese bile uygulama çalışmaya devam edebilir
    return false;
  }
}

// Fontları tekrar tekrar deneme ve daha uzun timeout için
export async function loadFontsWithRetry(maxRetries = 3, timeout = 10000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const loadPromises = Object.entries(fontFiles).map(([fontFamily, fontFile]) => {
        // FontFace web API kullanımı (web platformunda)
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.FontFace) {
          return new Promise((resolve, reject) => {
            try {
              const font = new FontFace(fontFamily, `url(${fontFile})`, { 
                display: 'block',
                timeout: timeout
              });
              
              font.load()
                .then(() => {
                  // Font yüklendikten sonra document fonts'a ekle
                  document.fonts.add(font);
                  resolve();
                })
                .catch(err => {
                  console.warn(`Failed to load font ${fontFamily}, attempt ${attempt}:`, err);
                  // Başarısız olsa bile devam et
                  resolve();
                });
            } catch (e) {
              console.warn(`Error creating FontFace for ${fontFamily}:`, e);
              // Hata olsa bile devam et
              resolve();
            }
          });
        } else {
          // Native platformlar için normal Font.loadAsync kullan
          return Font.loadAsync({ [fontFamily]: fontFile })
            .catch(err => {
              console.warn(`Failed to load font ${fontFamily}, attempt ${attempt}:`, err);
              // Başarısız olsa bile devam et
              return Promise.resolve();
            });
        }
      });

      await Promise.all(loadPromises);
      console.log(`All fonts loaded successfully on attempt ${attempt}`);
      return true;
    } catch (error) {
      console.error(`Error loading fonts on attempt ${attempt}:`, error);
      if (attempt === maxRetries) {
        console.warn('Maximum retries reached for font loading');
        return false;
      }
      // Biraz bekle ve tekrar dene
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
} 