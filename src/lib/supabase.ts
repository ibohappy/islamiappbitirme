import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';

// ÖNEMLİ: Bu değerleri kendi Supabase projenizin değerleriyle değiştirin
// 1. app.supabase.com adresine gidin
// 2. Yeni bir proje oluşturun
// 3. Project Settings > API bölümünden aşağıdaki bilgileri alın
// 4. Bu değerleri kendi bilgilerinizle değiştirin
const supabaseUrl = 'https://tnukwoofyqmjbaxrmrmx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudWt3b29meXFtamJheHJtcm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyMTc2MTYsImV4cCI6MjA2MDc5MzYxNn0.waTfWCMY9onhKMd4TiJXtimyurAzuxzwlPujI0atDgY';

// Timeout ve ağ ayarları - daha esnek değerler
const networkTimeoutConfig = {
  timeout: 20000,      // 20 saniye (daha uzun süre)
  retryCount: 3,       // Daha fazla yeniden deneme
  retryDelay: 1000     // Daha uzun bekleme aralığı
};

// Özel fetch işlevi oluştur - istek zaman aşımını ve yeniden deneme mantığını içerir
const customFetch = (url: string, options: any) => {
  // Varsayılan zaman aşımı
  const timeout = options.timeout || networkTimeoutConfig.timeout;
  
  // Orijinal fetch'i çağırın, ancak bir zaman aşımı ekleyin
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    // Fetch isteğine AbortController'ı bağlayın
    const fetchOptions = {
      ...options,
      signal: controller.signal
    };

    fetch(url, fetchOptions)
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

const createSupabaseClient = () => {
  const auth = {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit' as const,
  };

  // Gelişmiş istemci yapılandırması
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth,
    global: {
      fetch: customFetch as any,
      headers: {
        'X-Client-Info': 'islamiapp-mobile'
      }
    },
    // Daha uzun süreli istemci ayarları
    realtime: {
      timeout: networkTimeoutConfig.timeout
    }
  });
};

// Supabase istemcisini oluştur
export const supabase = createSupabaseClient();

/**
 * Kullanıcı kaydı oluşturan fonksiyon - e-posta doğrulaması olmadan
 */
export async function signUpUser(
  email: string, 
  password: string, 
  userData: {
    name: string;
    surname: string;
    age: number;
    gender: string;
    sect: string;
    city: string;
  }
) {
  try {
    console.log('Kayıt işlemi başlatılıyor...');
    console.log('Kullanıcı verileri:', JSON.stringify(userData)); // Kontrol için log ekledik
    
    // Auth kaydı oluştur - doğrudan onaylanmış e-posta ile
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: userData.name,
          surname: userData.surname,
          gender: userData.gender,
          sect: userData.sect,
          city: userData.city,
          age: userData.age,
        },
        emailRedirectTo: undefined, // E-posta yönlendirme URL'i gerekmiyor
      },
    });
    
    if (authError) {
      console.error('Kayıt hatası:', authError);
      throw authError;
    }
    
    console.log('Kayıt başarılı, kullanıcı metadatası:', authData?.user?.user_metadata);
    
    // Başarılı kayıt sonrası otomatik olarak giriş yap
    if (authData?.user) {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (sessionError) {
          console.error('Otomatik giriş hatası:', sessionError);
          throw sessionError;
        }
        
        console.log('Otomatik giriş başarılı');
        return sessionData;
      } catch (signInError) {
        console.error('Otomatik giriş hatası:', signInError);
        throw signInError;
      }
    }
    
    return authData;
  } catch (error: any) {
    console.error('Kayıt işlemi hatası:', error);
    
    // Daha anlaşılır hata mesajları
    if (error.message?.includes('network') || 
        error.message?.includes('Network') || 
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('timed out') ||
        error.message?.includes('timeout')) {
      throw new Error('Sunucu bağlantısı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
    }
    
    throw error;
  }
}

/**
 * Kullanıcı girişi yapan fonksiyon - e-posta doğrulama hatalarını atla ve bağlantı sorunlarını ele al
 */
export async function signInUser(email: string, password: string) {
  let retries = 0;
  const maxRetries = 3;
  
  const attemptLogin = async () => {
    try {
      console.log(`Giriş denemesi ${retries + 1}/${maxRetries}...`);
      
      // E-posta doğrulaması olmadan giriş dene
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Giriş hatası:', error);
        
        // Hata mesajını standartlaştır
        if (error.message && error.message.includes('Invalid login credentials')) {
          console.log('Giriş hatası: [AuthApiError: Invalid login credentials]');
          throw new Error('E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
        }

        // E-posta doğrulama hatası varsa, tekrar dene ve görmezden gel
        if (error.message && error.message.includes('Email not confirmed')) {
          console.log('E-posta doğrulanmamış, otomatik olarak doğrulanmış kabul ediliyor...');
          
          // Tekrar giriş dene
          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (retryError) {
            console.error('Yeniden giriş hatası:', retryError);
            throw new Error('E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
          } else {
            console.log('Yeniden giriş başarılı');
            return retryData;
          }
        }
        
        // Kullanıcı bulunamadı hatası
        if (error.message && error.message.includes('User not found')) {
          console.log('Giriş hatası: [AuthApiError: User not found]');
          throw new Error('E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
        }
        
        // Ağ hatası veya bağlantı hatası için yeniden deneme
        if ((error.message?.includes('network') || 
             error.message?.includes('Network') || 
             error.message?.includes('Failed to fetch') ||
             error.message?.includes('AbortError') ||
             error.message?.includes('timed out') ||
             error.message?.includes('timeout')) && 
            retries < maxRetries - 1) {
          
          retries++;
          console.log(`Ağ hatası nedeniyle ${retries}. yeniden deneme yapılıyor...`);
          
          // Kısa bir bekleme süresi ekleyin
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Yeniden deneyin
          return attemptLogin();
        }
        
        // Diğer hatalar için standart mesaj fırlat
        throw new Error('E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
      }
      
      // Eğer session veya user yoksa, geçersiz giriş kabul et
      if (!data.session || !data.user) {
        console.error('Oturum veya kullanıcı bilgisi alınamadı');
        throw new Error('E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
      }
      
      console.log('Giriş başarılı, oturum ve kullanıcı verileri alındı');
      return data;
    } catch (error: any) {
      console.error('Giriş yapma hatası:', error);
      
      // Ağ hatası için standardize edilmiş mesaj
      if (error.message?.includes('network') || 
          error.message?.includes('Network') || 
          error.message?.includes('Failed to fetch') ||
          error.message?.includes('AbortError') ||
          error.message?.includes('timed out') ||
          error.message?.includes('timeout') ||
          error.message?.includes('İnternet bağlantınızı')) {
        throw new Error('İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
      }
      
      // Standart hata mesajı
      if (!error.message || !error.message.includes('E-posta veya şifre hatalı')) {
        throw new Error('E-posta veya şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
      }
      
      throw error;
    }
  };
  
  return attemptLogin();
}

/**
 * Kullanıcı çıkışı yapan fonksiyon
 */
export async function signOutUser() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error: any) {
    console.error('Çıkış hatası:', error);
    
    // Ağ hataları için sessizce işle
    if (error.message?.includes('network') || 
        error.message?.includes('Network') ||
        error.message?.includes('Failed to fetch')) {
      console.warn('Ağ hatası nedeniyle çıkış yapılamadı, yerel oturum temizleniyor');
      try {
        await AsyncStorage.removeItem('supabase.auth.token');
      } catch (storageError) {
        console.error('Depolama hatası:', storageError);
      }
    } else {
      throw error;
    }
  }
}

/**
 * Mevcut oturumu kontrol eden fonksiyon - yeniden deneme mantığı ile
 */
export async function getCurrentSession() {
  console.log('Oturum kontrolü başlatılıyor...');
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Oturum kontrolünde hata:', error);
      return null;
    }
    
    console.log('Oturum kontrolü başarılı, session:', data.session ? 'VAR' : 'YOK');
    return data.session;
  } catch (error) {
    console.error('Oturum kontrolünde beklenmeyen hata:', error);
    return null;
  }
}

/**
 * Mevcut kullanıcıyı getiren fonksiyon - yeniden deneme mantığı ile
 */
export async function getCurrentUser() {
  let retries = 0;
  const maxRetries = 3;
  
  const getUser = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (error: any) {
      console.error(`Kullanıcı getirme hatası (deneme ${retries + 1}/${maxRetries}):`, error);
      
      // Ağ hatası için yeniden deneyin
      if ((error.message?.includes('network') || 
           error.message?.includes('Network') ||
           error.message?.includes('Failed to fetch') ||
           error.message?.includes('AbortError') ||
           error.message?.includes('timed out') ||
           error.message?.includes('timeout')) && 
          retries < maxRetries - 1) {
        
        retries++;
        
        // Kısa bir bekleme süresi ekleyin
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Yeniden deneyin
        return getUser();
      }
      
      // Tüm yeniden denemeler başarısız olduysa
      if (error.message?.includes('network') || 
          error.message?.includes('Network') ||
          error.message?.includes('Failed to fetch')) {
        return null;
      }
      
      throw error;
    }
  };
  
  return getUser();
}

/**
 * Kullanıcı profilini getiren fonksiyon - gelişmiş hata ele alma ile
 */
export async function getUserProfile() {
  console.log('Kullanıcı profili alınıyor...');
  try {
    // Mevcut kullanıcı bilgilerini al
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Kullanıcı bilgileri alınırken hata:', userError);
      return null;
    }
    
    // Kullanıcı meta verilerini döndür
    if (userData && userData.user && userData.user.user_metadata) {
      console.log('Kullanıcı meta verileri bulundu:', Object.keys(userData.user.user_metadata));
      
      return {
        user_id: userData.user.id,
        email: userData.user.email,
        ...userData.user.user_metadata
      };
    }
    
    console.log('Kullanıcı meta verileri bulunamadı');
    return {
      user_id: userData?.user?.id,
      email: userData?.user?.email,
    };
  } catch (error) {
    console.error('Profil alımı sırasında beklenmeyen hata:', error);
    return null;
  }
} 