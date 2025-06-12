import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, Text, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import * as SplashScreen from 'expo-splash-screen';
import { COLORS } from './src/constants/theme';
import { loadFontsWithRetry } from './src/utils/FontLoader';
import * as Font from 'expo-font';
// Bildirim ve arka plan servisleri için importlar
import { configureNotifications, requestNotificationPermissions, createNotificationChannel } from './src/services/notificationService';
import { getUserSettings } from './src/services/storageService';

// Splash screen'in otomatik kapanmasını engelle
SplashScreen.preventAutoHideAsync();

// Font yükleme fonksiyonu
const loadFonts = async () => {
  await Font.loadAsync({
    'FontAwesome': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.ttf'),
    'FontAwesome5_Brands': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Brands.ttf'),
    'FontAwesome5_Regular': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Regular.ttf'),
    'FontAwesome5_Solid': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome5_Solid.ttf'),
    'MaterialCommunityIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
    'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
    'AntDesign': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/AntDesign.ttf')
  });
};

// Bildirim servislerini başlat
const initializeNotifications = async () => {
  try {
    console.log('Bildirim servisleri başlatılıyor...');
    
    // Bildirim konfigürasyonunu yap
    configureNotifications();
    
    // Android için bildirim kanalı oluştur
    await createNotificationChannel();
    
    // Kullanıcı ayarlarını kontrol et
    const settings = await getUserSettings();
    
    if (settings && settings.notificationsEnabled) {
      console.log('Kullanıcı bildirimleri etkinleştirmiş, namaz bildirimleri başlatılıyor...');
      
      // İzinleri kontrol et ve iste (sadece bildirimler açıksa)
      const hasPermission = await requestNotificationPermissions();
      if (!hasPermission) {
        console.log('Bildirim izni alınamadı');
        return;
      }
      
      // Namaz bildirimlerini başlat (yeni sistem)
      try {
        const { initializePrayerNotifications } = await import('./src/services/backgroundTaskService');
        console.log('Namaz bildirimleri başlatılıyor...');
        const success = await initializePrayerNotifications();
        
        if (success) {
          console.log('Namaz bildirimleri başarıyla başlatıldı');
        } else {
          console.log('Namaz bildirimleri başlatılamadı (veri bulunamadı)');
        }
      } catch (error) {
        console.error('Namaz bildirimleri başlatılamadı:', error);
        // Hata durumunda kullanıcıyı bilgilendirebiliriz ama uygulamayı çökertmeyelim
      }
    } else {
      console.log('Kullanıcı bildirimleri devre dışı bırakmış');
    }
  } catch (error) {
    console.error('Bildirim servisleri başlatılırken hata:', error);
    // Bildirim hatası uygulamayı çökertmemeli
  }
};

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // İkonlar için fontları yükle (manuel yöntemi kullanıyoruz)
        const fontsLoadedResult = await loadFontsWithRetry(3, 15000);
        setFontsLoaded(fontsLoadedResult);
        
        // Bildirim servislerini başlat
        await initializeNotifications();
        
        // Diğer hazırlık işlemleri
        await new Promise(resolve => setTimeout(resolve, 1000)); // Kısa bir bekleme
      } catch (e) {
        console.warn('Yükleme hatası:', e);
      } finally {
        // Fontlar yüklenemese bile devam ediyoruz
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    loadFonts();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Splash screen'i kapat
      await SplashScreen.hideAsync();
      
      // Kendi splash screen'imizi göster ve sonra kapat
      setTimeout(() => {
        setShowSplash(false);
      }, 1500);
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      {showSplash ? (
        <CustomSplashScreen />
      ) : (
        <AppNavigator fontsLoaded={fontsLoaded} />
      )}
    </SafeAreaProvider>
  );
}

// Özel splash screen bileşeni
function CustomSplashScreen() {
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;
  
  // Responsive tasarım için boyutları ayarla
  const logoSize = isLandscape ? height * 0.3 : width * 0.4;
  const titleSize = isLandscape ? height * 0.05 : width * 0.07;
  
  return (
    <View style={styles.splashContainer}>
      <View style={styles.contentContainer}>
        <Image 
          source={require('./assets/splash-icon.png')} 
          style={[styles.logo, { width: logoSize, height: logoSize }]} 
          resizeMode="contain"
        />
        <Text style={[styles.title, { fontSize: titleSize }]}>İslami</Text>
        <Text style={styles.subtitle}>Namaz Vakitleri ve Daha Fazlası</Text>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </View>
      
      <Text style={styles.versionText}>Sürüm 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    marginBottom: 20,
  },
  title: {
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 40,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
});
