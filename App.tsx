import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Image, Text, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import * as SplashScreen from 'expo-splash-screen';
import { COLORS } from './src/constants/theme';

// Splash screen'in otomatik kapanmasını engelle
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Uygulama başlatılırken yapılacak işlemler (örn. font yükleme, API çağrıları vb.)
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simüle edilmiş yükleme süresi
      } catch (e) {
        console.warn(e);
      } finally {
        // Hazırlık tamamlandı
        setAppIsReady(true);
      }
    }

    prepare();
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
        <AppNavigator />
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
