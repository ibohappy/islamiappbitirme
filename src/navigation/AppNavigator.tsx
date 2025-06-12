import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import { RootStackParamList, MainTabParamList, AuthStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { QiblaScreen } from '../screens/qibla/QiblaScreen';
import { ImamAIScreen } from '../screens/imam-ai/ImamAIScreen';
import { ChatListScreen } from '../screens/imam-ai/ChatListScreen';
import { DailySurahsScreen } from '../screens/quran/DailySurahsScreen';
import { PrayerGuideScreen } from '../screens/prayer-guide/PrayerGuideScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import { ProfileScreen } from '../screens/profile';
import { COLORS } from '../constants/theme';
import NetInfo from '@react-native-community/netinfo';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { cleanupAppStateListener } from '../lib/supabase';

// Ana navigation referansını export ediyoruz, böylece herhangi bir yerden erişilebilir
export const navigationRef = React.createRef<NavigationContainerRef>();

// Navigasyon helper fonksiyonu - global olarak erişilebilir
export function navigate(name: string, params?: any) {
  if (navigationRef.current) {
    navigationRef.current.navigate(name, params);
  } else {
    console.error('Navigation ref is not ready yet');
  }
}

// Root Stack için geçiş fonksiyonu
export function resetRoot(name: string) {
  if (navigationRef.current) {
    navigationRef.current.resetRoot({
      index: 0,
      routes: [{ name }],
    });
  } else {
    console.error('Navigation ref is not ready yet');
  }
}

// FontsLoaded context bilgisini saklamak için
interface AppNavigatorProps {
  fontsLoaded?: boolean;
}

const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const ImamAIStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

// İmam AI için stack navigator - animasyonu devre dışı bırakıyoruz
function ImamAINavigator() {
  return (
    <ImamAIStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'none', // Animasyonu tamamen kaldır
      }}
    >
      <ImamAIStack.Screen name="ChatListScreen" component={ChatListScreen} />
      <ImamAIStack.Screen name="ImamAIScreen" component={ImamAIScreen} />
    </ImamAIStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: 'gray',
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          height: 60,
          paddingBottom: 5,
          paddingTop: 5,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="home-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Qibla"
        component={QiblaScreen}
        options={{
          title: 'Kıble',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="compass-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="DailySurahs"
        component={DailySurahsScreen}
        options={{
          title: 'Günlük Sureler',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="book-open-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="PrayerGuide"
        component={PrayerGuideScreen}
        options={{
          title: 'Namaz Rehberi',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="hands-pray"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ImamAI"
        component={ImamAINavigator}
        options={{
          title: 'İmam AI',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="chat-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="account-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          title: 'Bildirimler',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="bell-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Ana Navigator bileşeni - Auth Context'i kullanır
function MainNavigator({ fontsLoaded = false }: AppNavigatorProps) {
  const { isAuthenticated, isLoading, initialized } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const netInfoSubscriptionRef = React.useRef<any>(null);

  useEffect(() => {
    const initializeNetworkListener = () => {
      try {
        const subscription = NetInfo.addEventListener(state => {
          setIsConnected(state.isConnected);
        });
        netInfoSubscriptionRef.current = subscription;
        
        NetInfo.fetch().then(state => {
          setIsConnected(state.isConnected);
          if (!state.isConnected) {
            Alert.alert(
              "İnternet Bağlantısı Yok",
              "Uygulamayı kullanmak için internet bağlantısı gereklidir. Lütfen bağlantınızı kontrol edin.",
              [{ text: "Tamam" }]
            );
          }
        });
      } catch (error) {
        console.warn('NetInfo listener başlatılamadı:', error);
      }
    };
    
    initializeNetworkListener();
    
    return () => {
      try {
        if (netInfoSubscriptionRef.current) {
          if (typeof netInfoSubscriptionRef.current.remove === 'function') {
            netInfoSubscriptionRef.current.remove();
          } else if (typeof netInfoSubscriptionRef.current === 'function') {
            netInfoSubscriptionRef.current();
          }
          netInfoSubscriptionRef.current = null;
        }
      } catch (error) {
        console.warn('NetInfo listener temizlenirken hata (görmezden geliniyor):', error);
      }
    };
  }, []);

  // Auth state değişikliklerini handle et - Context7 best practice
  const [navigationKey, setNavigationKey] = React.useState('guest');
  const [prevAuthState, setPrevAuthState] = React.useState<boolean | null>(null);
  
  React.useEffect(() => {
    if (initialized) {
      // Context7 best practice: Authentication state değişikliğini detect et
      if (prevAuthState !== null && prevAuthState !== isAuthenticated) {
        console.log(`🔄 Authentication state değişimi: ${prevAuthState} -> ${isAuthenticated}`);
        
        // Navigation state'i tamamen reset et
        const newKey = isAuthenticated ? `authenticated-${Date.now()}` : `guest-${Date.now()}`;
        console.log(`🗝️ Navigation key güncelleniyor: ${navigationKey} -> ${newKey}`);
        setNavigationKey(newKey);
        
        // Context7 best practice: Async cleanup
        setTimeout(() => {
          if (global.gc) {
            global.gc();
          }
        }, 100);
      }
      
      setPrevAuthState(isAuthenticated);
    }
  }, [isAuthenticated, initialized, prevAuthState, navigationKey]);

  // Auth henüz initialize olmadıysa loading göster
  if (!initialized || isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10, color: COLORS.text }}>Yükleniyor...</Text>
        {!isConnected && (
          <Text style={{ marginTop: 5, color: COLORS.error, textAlign: 'center', padding: 10 }}>
            İnternet bağlantısı bulunamadı. Lütfen bağlantınızı kontrol edin.
          </Text>
        )}
        {!fontsLoaded && (
          <Text style={{ marginTop: 5, color: 'orange', textAlign: 'center', padding: 10 }}>
            Bazı ikonlar yüklenemedi. Görüntü hataları olabilir.
          </Text>
        )}
      </View>
    );
  }

  return (
    <NavigationContainer 
      ref={navigationRef}
      key={navigationKey} // Context7 best practice: navigation state'i reset et
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen 
            name="Auth" 
            component={AuthNavigator} 
            options={{
              animationTypeForReplace: 'pop', // Context7 best practice: logout animasyonu
            }}
          />
        ) : (
          <Stack.Screen 
            name="Main" 
            component={MainTabs}
            options={{
              animationTypeForReplace: 'push', // Context7 best practice: login animasyonu
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Ana wrapper component - Context7 best practice ile error handling ve cleanup
export function AppNavigator({ fontsLoaded = false }: AppNavigatorProps) {
  const isMountedRef = React.useRef(true);
  
  // Component unmount edildiğinde cleanup işlemleri
  React.useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      
      // Context7 best practice: Cleanup all global listeners
      try {
        console.log('AppNavigator cleanup başlıyor...');
        cleanupAppStateListener();
        console.log('AppNavigator cleanup tamamlandı');
      } catch (error) {
        console.warn('AppNavigator cleanup sırasında hata (görmezden geliniyor):', error);
      }
    };
  }, []);
  
  return (
    <AuthProvider>
      <MainNavigator fontsLoaded={fontsLoaded} />
    </AuthProvider>
  );
} 