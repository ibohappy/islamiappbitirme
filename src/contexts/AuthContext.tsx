import React, { createContext, useState, useContext, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  refreshSession: async () => {},
  signOut: async () => {},
});

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = async () => {
    try {
      // Önce AsyncStorage'dan session'ı kontrol et
      const storedSession = await AsyncStorage.getItem('supabase.auth.token');
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession);
        if (parsedSession?.currentSession?.access_token) {
          const { data: { session: newSession }, error } = await supabase.auth.setSession({
            access_token: parsedSession.currentSession.access_token,
            refresh_token: parsedSession.currentSession.refresh_token,
          });
          
          if (error) throw error;
          
          if (newSession) {
            setSession(newSession);
            setUser(newSession.user);
            return;
          }
        }
      }

      // Eğer stored session yoksa veya geçersizse, yeni session al
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
      }
    } catch (error) {
      console.error('Oturum yenileme hatası:', error);
      // Hata durumunda oturumu temizle
      await signOut();
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      await AsyncStorage.removeItem('supabase.auth.token');
    } catch (error) {
      console.error('Çıkış yapma hatası:', error);
    }
  };

  useEffect(() => {
    refreshSession();

    // Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setSession(newSession);
          setUser(newSession?.user ?? null);
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    loading,
    refreshSession,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 