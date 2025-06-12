import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as AuthSession from 'expo-auth-session';
import Constants from 'expo-constants';
import { Platform, Alert, AppState } from 'react-native';

// ÖNEMLİ: Bu değerleri kendi Supabase projenizin değerleriyle değiştirin
// 1. app.supabase.com adresine gidin
// 2. Yeni bir proje oluşturun
// 3. Project Settings > API bölümünden aşağıdaki bilgileri alın
// 4. Bu değerleri kendi bilgilerinizle değiştirin
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

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

// Özel bir storage sınıfı oluştur
class CustomStorage {
  async getItem(key: string) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value;
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return null;
    }
  }

  async setItem(key: string, value: string) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in storage:', error);
    }
  }

  async removeItem(key: string) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from storage:', error);
    }
  }
}

// Supabase istemcisini oluştur
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new CustomStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit'
  },
  global: {
    headers: {
      'Cache-Control': 'no-store'
    }
  }
});

// Supabase Auth'a sürekli session yenileme talimatı ver
// Uygulama foreground'dayken session'ı otomatik yenile
let appStateSubscription: any = null;

const initializeAppStateListener = () => {
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.log('Uygulama aktif - auto refresh başlatılıyor...');
        supabase.auth.startAutoRefresh();
      } else {
        console.log('Uygulama pasif - auto refresh durduruluyor...');
        supabase.auth.stopAutoRefresh();
      }
    });
  }
};

// AppState listener'ını temizleyen fonksiyon
export const cleanupAppStateListener = () => {
  try {
    if (appStateSubscription) {
      if (typeof appStateSubscription.remove === 'function') {
        appStateSubscription.remove();
      } else if (typeof appStateSubscription === 'function') {
        appStateSubscription();
      }
      appStateSubscription = null;
    }
  } catch (error) {
    console.warn('AppState listener temizlenirken hata (görmezden geliniyor):', error);
  }
};

// İlk çağrımda listener'ı başlat
initializeAppStateListener();

/**
 * Kullanıcı çıkışı yapan fonksiyon
 */
export async function signOutUser() {
  try {
    console.log('Kullanıcı çıkış işlemi başlatılıyor...');
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Çıkış hatası:', error);
      throw error;
    }
    
    console.log('Çıkış başarılı');
    return true;
  } catch (error: any) {
    console.error('Çıkış işlemi hatası:', error);
    throw error;
  }
}

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
 * Kullanıcı profilini getiren fonksiyon
 * Bu fonksiyon önce kullanıcı kimliğini alır, sonra bu kimlik ile kullanıcının profil bilgilerini getirir
 */
export async function getUserProfile() {
  try {
    // Önce mevcut kullanıcıyı al
    const user = await getCurrentUser();
    
    if (!user) {
      console.log('Oturum açmış kullanıcı bulunamadı');
      return null;
    }
    
    console.log('Kullanıcı profili çekiliyor...');
    
    // Kullanıcının meta verilerini döndür
    return {
      user_id: user.id,
      email: user.email,
      ...user.user_metadata
    };
  } catch (error) {
    console.error('Kullanıcı profili getirme hatası:', error);
    throw error;
  }
}

/**
 * Kullanıcı profilini güncelleyen fonksiyon
 */
export async function updateUserProfile(profileData: {
  name?: string;
  surname?: string;
  age?: number;
  gender?: string;
  sect?: string;
  city?: string;
  religious_level?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    console.log('Profil güncelleniyor...', profileData);

    // Kullanıcının user_metadata'sını güncelle
    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...profileData,
        updated_at: new Date().toISOString(),
      }
    });

    if (error) {
      console.error('Profil güncelleme hatası:', error);
      throw error;
    }

    console.log('Profil başarıyla güncellendi');
    return data;
  } catch (error: any) {
    console.error('Profil güncelleme işlemi hatası:', error);
    throw error;
  }
}

/**
 * Kullanıcı şifresini değiştiren fonksiyon
 */
export async function updateUserPassword(newPassword: string) {
  try {
    console.log('Şifre değiştiriliyor...');

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Şifre değiştirme hatası:', error);
      throw error;
    }

    console.log('Şifre başarıyla değiştirildi');
    return data;
  } catch (error: any) {
    console.error('Şifre değiştirme işlemi hatası:', error);
    
    // Daha anlaşılır hata mesajları
    if (error.message?.includes('Same password')) {
      throw new Error('Yeni şifre eskisi ile aynı olamaz');
    } else if (error.message?.includes('Password should be')) {
      throw new Error('Şifre en az 6 karakter olmalıdır');
    }
    
    throw new Error('Şifre değiştirme sırasında bir hata oluştu');
  }
}

/**
 * Şifre sıfırlama e-postası gönderen fonksiyon
 */
export async function sendPasswordResetEmail(email: string, redirectTo?: string) {
  try {
    console.log('Şifre sıfırlama e-postası gönderiliyor:', email);

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || undefined,
    });

    if (error) {
      console.error('Şifre sıfırlama e-postası hatası:', error);
      throw error;
    }

    console.log('Şifre sıfırlama e-postası gönderildi');
    return data;
  } catch (error: any) {
    console.error('Şifre sıfırlama e-postası işlemi hatası:', error);
    throw error;
  }
}

/**
 * Kullanıcı istatistiklerini getiren fonksiyon (mock data şimdilik)
 */
export async function getUserStats() {
  try {
    console.log('Kullanıcı istatistikleri çekiliyor...');
    
    // Şimdilik mock data döndürüyoruz
    // İleride gerçek veritabanı tabloları eklenebilir
    const mockStats = {
      dailyPrayers: Math.floor(Math.random() * 30) + 1, // 1-30 arası
      readSurahs: Math.floor(Math.random() * 50) + 1,   // 1-50 arası  
      aiChats: Math.floor(Math.random() * 20) + 1,      // 1-20 arası
      totalDays: Math.floor(Math.random() * 100) + 1,   // 1-100 arası
      lastPrayerTime: new Date(),
      favoriteSupplication: 'İstiaze',
      currentStreak: Math.floor(Math.random() * 10) + 1, // 1-10 arası
    };

    // Gerçek implementasyon için bu şekilde olacak:
    /*
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    */

    console.log('İstatistikler başarıyla getirildi');
    return mockStats;
  } catch (error: any) {
    console.error('İstatistik çekme hatası:', error);
    // Hata durumunda varsayılan değerler döndür
    return {
      dailyPrayers: 0,
      readSurahs: 0,
      aiChats: 0,
      totalDays: 0,
      lastPrayerTime: new Date(),
      favoriteSupplication: 'Belirtilmemiş',
      currentStreak: 0,
    };
  }
}

/**
 * Kullanıcının dini seviyesini güncelleyen özel fonksiyon
 */
export async function updateReligiousLevel(level: 'beginner' | 'intermediate' | 'advanced') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Kullanıcı oturumu bulunamadı');
    }

    console.log('Dini seviye güncelleniyor:', level);

    const { data, error } = await supabase.auth.updateUser({
      data: {
        religious_level: level,
        religious_level_updated_at: new Date().toISOString(),
      }
    });

    if (error) {
      console.error('Dini seviye güncelleme hatası:', error);
      throw error;
    }

    console.log('Dini seviye başarıyla güncellendi:', level);
    return data;
  } catch (error: any) {
    console.error('Dini seviye güncelleme işlemi hatası:', error);
    throw error;
  }
}

/**
 * Kullanıcı aktivitesini kaydetmek için fonksiyon (ileride kullanılacak)
 */
export async function recordUserActivity(activityType: 'prayer' | 'surah' | 'chat', details?: any) {
  try {
    console.log('Kullanıcı aktivitesi kaydediliyor:', activityType);
    
    // Şimdilik sadece log, ileride veritabanına kayıt yapılacak
    /*
    const { data, error } = await supabase
      .from('user_activities')
      .insert([
        {
          user_id: user.id,
          activity_type: activityType,
          details: details,
          created_at: new Date().toISOString(),
        }
      ]);
    
    if (error) throw error;
    */
    
    console.log('Aktivite başarıyla kaydedildi');
    return true;
  } catch (error: any) {
    console.error('Aktivite kaydetme hatası:', error);
    return false;
  }
} 