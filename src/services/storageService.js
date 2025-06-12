import AsyncStorage from '@react-native-async-storage/async-storage';

// Namaz vakitlerini yerel depolamaya kaydet
export const storePrayerTimes = async (city, prayerTimesData) => {
  try {
    // Şehir bazında kaydet
    await AsyncStorage.setItem(`prayer_times_${city}`, JSON.stringify(prayerTimesData));
    
    // Genel bildirim sistemi için de kaydet (background task'lar için)
    await AsyncStorage.setItem('prayer_times_data', JSON.stringify(prayerTimesData));
    
    // Son güncelleme zamanını kaydet
    await AsyncStorage.setItem('last_prayer_times_update', new Date().toISOString());
    
    console.log(`Namaz vakitleri storage'a kaydedildi: ${city} (${prayerTimesData.length} gün)`);
    return true;
  } catch (error) {
    console.error('Namaz vakitleri kaydedilemedi:', error);
    return false;
  }
};

// Yerel depolamadan namaz vakitlerini getir
export const getPrayerTimes = async (city) => {
  try {
    const prayerTimesData = await AsyncStorage.getItem(`prayer_times_${city}`);
    return prayerTimesData ? JSON.parse(prayerTimesData) : null;
  } catch (error) {
    console.error('Namaz vakitleri alınamadı:', error);
    return null;
  }
};

// Genel namaz vakitlerini getir (bildirimler için)
export const getPrayerTimesData = async () => {
  try {
    const prayerTimesData = await AsyncStorage.getItem('prayer_times_data');
    return prayerTimesData ? JSON.parse(prayerTimesData) : null;
  } catch (error) {
    console.error('Genel namaz vakitleri alınamadı:', error);
    return null;
  }
};

// Kullanıcı ayarlarını yerel depolamaya kaydet
export const storeUserSettings = async (settings) => {
  try {
    // Varsayılan değerlerle birleştir
    const defaultSettings = {
      city: 'İstanbul',
      notifyBeforeMinutes: 10,
      activePrayers: ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"],
      notificationsEnabled: true
    };
    
    const mergedSettings = { ...defaultSettings, ...settings };
    await AsyncStorage.setItem('user_settings', JSON.stringify(mergedSettings));
    console.log('Kullanıcı ayarları kaydedildi:', mergedSettings);
    return true;
  } catch (error) {
    console.error('Kullanıcı ayarları kaydedilemedi:', error);
    return false;
  }
};

// Yerel depolamadan kullanıcı ayarlarını getir
export const getUserSettings = async () => {
  try {
    const settings = await AsyncStorage.getItem('user_settings');
    if (!settings) {
      // Context7 best practice: Varsayılan ayarlar
      const defaultSettings = {
        notificationsEnabled: false,
        notifyBeforeMinutes: 10,
        activePrayers: ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"],
        city: null // Konum belirlendikten sonra ayarlanacak
      };
      
      return defaultSettings;
    }
    
    return JSON.parse(settings);
  } catch (error) {
    console.error('Kullanıcı ayarları alınamadı:', error);
    
    // Hata durumunda varsayılan ayarları döndür
    return {
      notificationsEnabled: false,
      notifyBeforeMinutes: 10,
      activePrayers: ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"],
      city: null
    };
  }
};

// Son güncelleme zamanını kontrol et
export const shouldUpdatePrayerTimes = async () => {
  try {
    const lastUpdateStr = await AsyncStorage.getItem('last_prayer_times_update');
    if (!lastUpdateStr) return true;
    
    const lastUpdate = new Date(lastUpdateStr);
    const now = new Date();
    
    // Son güncellemeden bu yana 24 saatten fazla geçtiyse güncelle
    return now.getTime() - lastUpdate.getTime() > 24 * 60 * 60 * 1000;
  } catch (error) {
    console.error('Güncelleme kontrolü yapılamadı:', error);
    return true;
  }
};

// Debug için storage verilerini kontrol et
export const debugStorage = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    
    // Kullanıcı ayarları
    const userSettings = await getUserSettings();
    const currentCity = userSettings?.city || 'Belirlenmemiş';
    
    // Namaz vakitleri verileri
    const prayerTimesData = await AsyncStorage.getItem('prayer_times_data');
    const cityPrayerData = userSettings?.city ? 
      await AsyncStorage.getItem(`prayer_times_${userSettings.city}`) : null;
    
    // Son güncelleme
    const lastUpdate = await AsyncStorage.getItem('last_prayer_times_update');
    
    return {
      userCity: currentCity,
      hasPrayerData: !!prayerTimesData,
      hasCityData: !!cityPrayerData,
      prayerDataCount: prayerTimesData ? JSON.parse(prayerTimesData).length : 0,
      lastUpdate: lastUpdate ? new Date(lastUpdate).toLocaleString('tr-TR') : 'Bilinmiyor',
      prayerKeys: allKeys.filter(key => key.startsWith('prayer_times_')),
      settingsKeys: allKeys.filter(key => key.includes('settings')),
      allKeys: allKeys
    };
  } catch (error) {
    console.error('Debug storage hatası:', error);
    return {
      error: error.message,
      userCity: 'Hata',
      hasPrayerData: false,
      hasCityData: false,
      prayerDataCount: 0,
      lastUpdate: 'Hata',
      prayerKeys: [],
      settingsKeys: [],
      allKeys: []
    };
  }
}; 