import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getCurrentSession, getCurrentUser } from '../lib/supabase';
import { AppState } from 'react-native';

// Auth context için tip tanımı
export type AuthContextType = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialized: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

// Varsayılan değerlerle AuthContext oluştur
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  initialized: false,
  signOut: async () => {},
  refreshSession: async () => {},
});

// Custom hook AuthContext'i kullanmak için
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider bileşeni
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Subscription references for safe cleanup
  const authSubscriptionRef = React.useRef<any>(null);
  const appStateSubscriptionRef = React.useRef<any>(null);

  // Session'ı yenileyen fonksiyon
  const refreshSession = useCallback(async () => {
    try {
      console.log('Session yenileniyor...');
      const currentSession = await getCurrentSession();
      const currentUser = await getCurrentUser();
      
      setSession(currentSession);
      setUser(currentUser);
      
      console.log('Session yenilendi:', currentSession ? 'VAR' : 'YOK');
    } catch (error) {
      console.error('Session yenileme hatası:', error);
      setSession(null);
      setUser(null);
    }
  }, []);

  // Logout fonksiyonu
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      console.log('Çıkış yapılıyor...');
      
      // Önce local state'i temizle (UI hızlı güncellesin)
      setUser(null);
      setSession(null);
      
      // Context7 best practice: AsyncStorage temizliği
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.multiRemove([
          'supabase.auth.token',
          'supabase.auth.refreshToken',
          '@navigation_state', // Navigation state'i de temizle
          '@user_preferences',
        ]);
        console.log('AsyncStorage temizlendi');
      } catch (storageError) {
        console.warn('AsyncStorage temizleme hatası (görmezden geliniyor):', storageError);
      }
      
      // Sonra Supabase'den çıkış yap
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Çıkış hatası:', error);
        // Hata olsa bile local state zaten temizlenmiş durumda
      }
      
      // Context7 best practice: Force garbage collection hint
      if (global.gc) {
        global.gc();
      }
      
      console.log('Çıkış başarılı');
    } catch (error) {
      console.error('Çıkış yapma hatası:', error);
      // Hata durumunda bile local state'i temizle
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auth state değişikliklerini dinle
  useEffect(() => {
    console.log('AuthProvider başlatılıyor...');
    
    // İlk session kontrolü
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        await refreshSession();
      } catch (error) {
        console.error('Auth başlatma hatası:', error);
        // Hata durumunda state'leri temizle
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
        setInitialized(true);
      }
    };

    initializeAuth();

    // Auth state değişikliklerini dinle
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state değişti:', event, session ? 'Session var' : 'Session yok');
          
          setSession(session);
          setUser(session?.user || null);
          
          if (event === 'SIGNED_OUT') {
            setUser(null);
            setSession(null);
          }
          
          setInitialized(true);
        }
      );
      
      authSubscriptionRef.current = subscription;
    } catch (error) {
      console.error('Auth listener başlatılamadı:', error);
      setInitialized(true);
    }

    return () => {
      console.log('AuthProvider temizleniyor...');
      try {
        if (authSubscriptionRef.current) {
          if (typeof authSubscriptionRef.current.unsubscribe === 'function') {
            authSubscriptionRef.current.unsubscribe();
          } else if (typeof authSubscriptionRef.current === 'function') {
            authSubscriptionRef.current();
          }
          authSubscriptionRef.current = null;
        }
      } catch (error) {
        console.warn('Auth listener temizlenirken hata (görmezden geliniyor):', error);
      }
    };
  }, [refreshSession]);

  // App state değişikliklerini dinle - otomatik session yenileme
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('Uygulama aktif oldu, auto refresh başlatılıyor...');
        try {
          supabase.auth.startAutoRefresh();
        } catch (error) {
          console.warn('Auto refresh başlatılamadı:', error);
        }
      } else {
        console.log('Uygulama pasif oldu, auto refresh durduruluyor...');
        try {
          supabase.auth.stopAutoRefresh();
        } catch (error) {
          console.warn('Auto refresh durdurulamadı:', error);
        }
      }
    };

    try {
      const subscription = AppState.addEventListener('change', handleAppStateChange);
      appStateSubscriptionRef.current = subscription;
      
      // İlk yüklemede aktif state için auto refresh başlat
      if (AppState.currentState === 'active') {
        supabase.auth.startAutoRefresh();
      }
    } catch (error) {
      console.warn('AppState listener başlatılamadı:', error);
    }

    return () => {
      try {
        if (appStateSubscriptionRef.current) {
          if (typeof appStateSubscriptionRef.current.remove === 'function') {
            appStateSubscriptionRef.current.remove();
          } else if (typeof appStateSubscriptionRef.current === 'function') {
            appStateSubscriptionRef.current();
          }
          appStateSubscriptionRef.current = null;
        }
        
        // Auto refresh'i durdur
        supabase.auth.stopAutoRefresh();
      } catch (error) {
        console.warn('AppState listener temizlenirken hata (görmezden geliniyor):', error);
      }
    };
  }, []);

  const isAuthenticated = !!session && !!user;

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated,
    isLoading,
    initialized,
    signOut,
    refreshSession,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
};

// Backward compatibility için eski export'u koruyalım
export { AuthContext }; 