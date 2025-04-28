import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View, ActivityIndicator, Text, Alert } from 'react-native';
import { RootStackParamList, MainTabParamList, AuthStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { QiblaScreen } from '../screens/qibla/QiblaScreen';
import { ImamAIScreen } from '../screens/imam-ai/ImamAIScreen';
import { DailySurahsScreen } from '../screens/quran/DailySurahsScreen';
import { PrayerGuideScreen } from '../screens/prayer-guide/PrayerGuideScreen';
import { COLORS } from '../constants/theme';
import { getCurrentSession } from '../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import { AuthContext } from '../contexts/AuthContext';

// Ana navigation referansını export ediyoruz, böylece herhangi bir yerden erişilebilir
export const navigationRef = React.createRef<NavigationContainerRef<any>>();

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

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

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

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.background,
        },
        headerStyle: {
          backgroundColor: COLORS.background,
        },
        headerTintColor: COLORS.text,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Namaz Vakitleri',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="clock-outline"
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
              name="compass"
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
              name="book-open-page-variant"
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
              name="mosque"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ImamAI"
        component={ImamAIScreen}
        options={{
          title: 'İmam AI',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="chat-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean | null>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });
    
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
    
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log('Oturum kontrolü yapılıyor...');
        setIsAuthenticated(false);
      } catch (error) {
        console.error('Oturum kontrolü sırasında hata:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSession();
  }, [isConnected]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 10, color: COLORS.text }}>Yükleniyor...</Text>
        {!isConnected && (
          <Text style={{ marginTop: 5, color: COLORS.error, textAlign: 'center', padding: 10 }}>
            İnternet bağlantısı bulunamadı. Lütfen bağlantınızı kontrol edin.
          </Text>
        )}
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated, isLoading }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          {!isAuthenticated ? (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          ) : (
            <Stack.Screen name="Main" component={MainTabs} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
} 