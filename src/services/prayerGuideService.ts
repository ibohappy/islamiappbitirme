import AsyncStorage from '@react-native-async-storage/async-storage';

// Namaz takibi için storage anahtarları
const PRAYER_TRACKING_KEY = 'prayer_tracking';
const PRAYER_TRACKING_DATE_KEY = 'prayer_tracking_date';

// Namaz türleri
export enum PrayerType {
  FAJR = 'fajr',      // Sabah
  DHUHR = 'dhuhr',    // Öğle
  ASR = 'asr',        // İkindi
  MAGHRIB = 'maghrib', // Akşam
  ISHA = 'isha',      // Yatsı
}

// Namaz durumu arayüzü
export interface PrayerStatus {
  type: PrayerType;
  completed: boolean;
}

// Günlük namaz takibi arayüzü
export interface DailyPrayerTracking {
  date: string;
  prayers: PrayerStatus[];
}

// Varsayılan namaz durumunu oluştur
const createDefaultPrayerStatus = (): PrayerStatus[] => [
  {
    type: PrayerType.FAJR,
    completed: false,
  },
  {
    type: PrayerType.DHUHR,
    completed: false,
  },
  {
    type: PrayerType.ASR,
    completed: false,
  },
  {
    type: PrayerType.MAGHRIB,
    completed: false,
  },
  {
    type: PrayerType.ISHA,
    completed: false,
  },
];

/**
 * Günlük namaz takibini getir
 */
export const getDailyPrayerTracking = async (): Promise<PrayerStatus[]> => {
  try {
    // Bugünün tarihini kontrol et
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatı
    const storedDate = await AsyncStorage.getItem(PRAYER_TRACKING_DATE_KEY);
    
    // Eğer bugün için namaz takibi zaten oluşturulmuşsa, onu getir
    if (storedDate === today) {
      const storedTracking = await AsyncStorage.getItem(PRAYER_TRACKING_KEY);
      
      if (storedTracking) {
        return JSON.parse(storedTracking);
      }
    } else {
      // Yeni bir gün başladı, varsayılan namaz durumunu oluştur
      const defaultStatus = createDefaultPrayerStatus();
      await AsyncStorage.setItem(PRAYER_TRACKING_KEY, JSON.stringify(defaultStatus));
      await AsyncStorage.setItem(PRAYER_TRACKING_DATE_KEY, today);
      return defaultStatus;
    }
    
    // Varsayılan namaz durumunu döndür
    return createDefaultPrayerStatus();
  } catch (error) {
    console.error('Namaz takibi alınamadı:', error);
    return createDefaultPrayerStatus();
  }
};

/**
 * Namaz durumunu güncelle
 */
export const updatePrayerStatus = async (
  prayerType: PrayerType,
  completed: boolean
): Promise<boolean> => {
  try {
    // Mevcut namaz takibini getir
    const prayerTracking = await getDailyPrayerTracking();
    
    // İlgili namazı bul ve güncelle
    const updatedTracking = prayerTracking.map((prayer) => {
      if (prayer.type === prayerType) {
        return {
          ...prayer,
          completed,
        };
      }
      return prayer;
    });
    
    // Güncellenmiş namaz takibini kaydet
    await AsyncStorage.setItem(PRAYER_TRACKING_KEY, JSON.stringify(updatedTracking));
    
    return true;
  } catch (error) {
    console.error('Namaz durumu güncellenemedi:', error);
    return false;
  }
};

/**
 * Namaz bilgileri
 */
export interface PrayerInfo {
  type: PrayerType;
  name: string;
  arabicName: string;
  time: string;
  rakats: number;
  description: string;
}

/**
 * Namaz bilgilerini getir
 */
export const getPrayerInfo = (): PrayerInfo[] => [
  {
    type: PrayerType.FAJR,
    name: 'Sabah Namazı',
    arabicName: 'صلاة الفجر',
    time: 'Tan yerinin ağarmasından güneşin doğuşuna kadar',
    rakats: 4,
    description: 'Sabah namazı, günün ilk namazıdır. Toplam 4 rekattır.',
  },
  {
    type: PrayerType.DHUHR,
    name: 'Öğle Namazı',
    arabicName: 'صلاة الظهر',
    time: 'Güneşin tepe noktasından batıya doğru kaymasından sonra',
    rakats: 10,
    description: 'Öğle namazı, günün ikinci namazıdır. Toplam 10 rekattır.',
  },
  {
    type: PrayerType.ASR,
    name: 'İkindi Namazı',
    arabicName: 'صلاة العصر',
    time: 'Güneşin batıya eğiliminden güneş batmadan önceki zamana kadar',
    rakats: 8,
    description: 'İkindi namazı, günün üçüncü namazıdır. Toplam 8 rekattır.',
  },
  {
    type: PrayerType.MAGHRIB,
    name: 'Akşam Namazı',
    arabicName: 'صلاة المغرب',
    time: 'Güneşin batışından hemen sonra',
    rakats: 5,
    description: 'Akşam namazı, günün dördüncü namazıdır. Toplam 5 rekattır.',
  },
  {
    type: PrayerType.ISHA,
    name: 'Yatsı Namazı',
    arabicName: 'صلاة العشاء',
    time: 'Akşam kızıllığının kaybolmasından gece yarısına kadar',
    rakats: 13,
    description: 'Yatsı namazı, günün beşinci ve son namazıdır. Toplam 13 rekattır.',
  },
];

/**
 * Namaz adını getir
 */
export const getPrayerName = (prayerType: PrayerType): string => {
  const prayer = getPrayerInfo().find(p => p.type === prayerType);
  return prayer ? prayer.name : '';
}; 