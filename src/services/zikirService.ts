import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

// Zikir veri yapısı
export interface ZikirData {
  id: string;
  user_id: string;
  date: string;
  count: number;
  goal: number;
  zikr_type: string;
  completed: boolean;
  last_updated: string;
  counts?: { [key: string]: number }; // Her zikir türü için ayrı sayaç (Subhanallah, Elhamdülillah, AllahuEkber vb.)
}

// Zikir geçmişi veri yapısı
export interface ZikirHistoryItem {
  date: string;
  type: string;
  count: number;
  goal: number;
  completed: boolean;
  counts?: { [key: string]: number }; // Her zikir türü için ayrı sayaç
}

// Zikir türü veri yapısı
export interface ZikirType {
  id: string;
  name: string;
  arabic?: string;
  description?: string;
  recommended_count: number;
}

// Sabit key değerleri
const ZIKIR_STORAGE_KEY = 'zikir_data';
const ZIKIR_HISTORY_KEY = 'zikir_history';
const ZIKIR_TYPES_KEY = 'zikir_types';

// Önceden tanımlanmış zikir türleri
export const DEFAULT_ZIKIR_TYPES: ZikirType[] = [
  {
    id: 'subhanallah',
    name: 'Sübhanallah',
    arabic: 'سبحان الله',
    description: 'Allah her türlü eksiklikten uzaktır',
    recommended_count: 33
  },
  {
    id: 'elhamdulillah',
    name: 'Elhamdülillah',
    arabic: 'الحمد لله',
    description: 'Hamd Allah\'adır',
    recommended_count: 33
  },
  {
    id: 'allahuekber',
    name: 'Allahu Ekber',
    arabic: 'الله أكبر',
    description: 'Allah en büyüktür',
    recommended_count: 34
  },
  {
    id: 'estağfirullah',
    name: 'Estağfirullah',
    arabic: 'أستغفر الله',
    description: 'Allah\'tan bağışlanma dilerim',
    recommended_count: 100
  },
  {
    id: 'salavat',
    name: 'Salavat',
    arabic: 'اللهم صل على محمد وعلى آل محمد',
    description: 'Allah\'ım! Muhammed\'e ve Muhammed\'in ailesine salat et',
    recommended_count: 100
  },
  {
    id: 'kelime_i_tevhid',
    name: 'Kelime-i Tevhid',
    arabic: 'لا إله إلا الله محمد رسول الله',
    description: 'Allah\'tan başka ilah yoktur, Muhammed Allah\'ın Resulüdür',
    recommended_count: 100
  },
  {
    id: 'la_havle',
    name: 'La havle',
    arabic: 'لا حول ولا قوة إلا بالله',
    description: 'Güç ve kuvvet ancak Allah\'tandır',
    recommended_count: 100
  }
];

// Zikir türlerini yükle
export const getZikirTypes = async (): Promise<ZikirType[]> => {
  try {
    const data = await AsyncStorage.getItem(ZIKIR_TYPES_KEY);
    
    if (data) {
      return JSON.parse(data);
    } else {
      // İlk kullanımda varsayılan zikir türlerini kaydet
      await AsyncStorage.setItem(ZIKIR_TYPES_KEY, JSON.stringify(DEFAULT_ZIKIR_TYPES));
      return DEFAULT_ZIKIR_TYPES;
    }
  } catch (error) {
    console.error('Zikir türleri yüklenirken hata:', error);
    return DEFAULT_ZIKIR_TYPES;
  }
};

// Yeni zikir türü ekle
export const addZikirType = async (zikirType: ZikirType): Promise<void> => {
  try {
    const types = await getZikirTypes();
    types.push(zikirType);
    await AsyncStorage.setItem(ZIKIR_TYPES_KEY, JSON.stringify(types));
  } catch (error) {
    console.error('Zikir türü eklenirken hata:', error);
  }
};

// Bugünkü zikir verilerini yükle
export const getTodayZikir = async (zikirTypeId: string): Promise<ZikirData | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dataString = await AsyncStorage.getItem(ZIKIR_STORAGE_KEY);
    const data = dataString ? JSON.parse(dataString) : [];
    
    const todayData = data.find((item: ZikirData) => item.date === today && item.zikr_type === zikirTypeId);
    
    return todayData || null;
  } catch (error) {
    console.error('Bugünkü zikir verisi yüklenirken hata:', error);
    return null;
  }
};

// Zikir verilerini kaydet
export const saveZikirData = async (zikirData: ZikirData): Promise<void> => {
  try {
    const dataString = await AsyncStorage.getItem(ZIKIR_STORAGE_KEY);
    let data = dataString ? JSON.parse(dataString) : [];
    
    // Var olan veriyi kontrol et
    const index = data.findIndex((item: ZikirData) => item.id === zikirData.id);
    
    if (index >= 0) {
      // Var olan veriyi güncelle
      data[index] = zikirData;
    } else {
      // Yeni veri ekle
      data.push(zikirData);
    }
    
    await AsyncStorage.setItem(ZIKIR_STORAGE_KEY, JSON.stringify(data));
    
    // Tamamlanan bir zikirse, geçmişe de ekle
    if (zikirData.completed) {
      await addToZikirHistory(zikirData);
    }
  } catch (error) {
    console.error('Zikir verisi kaydedilirken hata:', error);
  }
};

// Zikir geçmişini yükle
export const getZikirHistory = async (): Promise<ZikirHistoryItem[]> => {
  try {
    const data = await AsyncStorage.getItem(ZIKIR_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Zikir geçmişi yüklenirken hata:', error);
    return [];
  }
};

// Zikir geçmişine ekle
export const addToZikirHistory = async (zikirData: ZikirData): Promise<void> => {
  try {
    const history = await getZikirHistory();
    
    // Bu zikir türü ve tarih için kayıt var mı kontrol et
    const existingIndex = history.findIndex(
      (item: ZikirHistoryItem) => item.date === zikirData.date && item.type === zikirData.zikr_type
    );
    
    if (existingIndex >= 0) {
      // Var olan kaydı güncelle
      history[existingIndex] = {
        date: zikirData.date,
        type: zikirData.zikr_type,
        count: zikirData.count,
        goal: zikirData.goal,
        completed: zikirData.completed,
        counts: zikirData.counts
      };
    } else {
      // Yeni kayıt ekle
      history.push({
        date: zikirData.date,
        type: zikirData.zikr_type,
        count: zikirData.count,
        goal: zikirData.goal,
        completed: zikirData.completed,
        counts: zikirData.counts
      });
    }
    
    // Son 30 günlük geçmişi tut
    const trimmedHistory = history.slice(-100);
    
    await AsyncStorage.setItem(ZIKIR_HISTORY_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error('Zikir geçmişine eklenirken hata:', error);
  }
};

// Zikir ekle ve geri bildirim ver
export const incrementZikir = async (
  zikirData: ZikirData,
  enableVibration: boolean = true,
  enableSound: boolean = false,
  zikirSubType: string = 'general' // Sübhanallah, Elhamdülillah vb.
): Promise<ZikirData> => {
  try {
    // Zikir sayacını artır
    const updatedData = { ...zikirData };
    updatedData.count = updatedData.count + 1;
    updatedData.last_updated = new Date().toISOString();
    
    // Alt türlerini izle
    if (!updatedData.counts) {
      updatedData.counts = {};
    }
    
    if (!updatedData.counts[zikirSubType]) {
      updatedData.counts[zikirSubType] = 0;
    }
    
    updatedData.counts[zikirSubType] += 1;
    
    // Titreşim
    if (enableVibration) {
      try {
        if (updatedData.count % 33 === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } else if (updatedData.count % 10 === 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch (error) {
        console.error('Titreşim çalışırken hata:', error);
      }
    }
    
    // Ses
    if (enableSound) {
      try {
        const soundObject = new Audio.Sound();
        await soundObject.loadAsync(require('../assets/sounds/click.mp3'));
        await soundObject.playAsync();
      } catch (error) {
        console.error('Ses çalınırken hata:', error);
      }
    }
    
    // Hedef tamamlandı mı kontrol et
    if (updatedData.count >= updatedData.goal && !updatedData.completed) {
      updatedData.completed = true;
    }
    
    // Zikir verilerini kaydet
    await saveZikirData(updatedData);
    
    return updatedData;
  } catch (error) {
    console.error('Zikir artırılırken hata:', error);
    return zikirData;
  }
};

// Zikir istatistiklerini hesapla
export const calculateZikirStats = async (): Promise<{
  todayTotal: number;
  weeklyTotal: number;
  monthlyTotal: number;
  mostCommonZikir: string;
  streakDays: number;
  typeCounts?: { [key: string]: number }; // Her zikir türünün toplam sayısı
}> => {
  try {
    const history = await getZikirHistory();
    const today = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
    
    // Bugünkü toplam
    const todayItems = history.filter(item => item.date === today);
    const todayTotal = todayItems.reduce((sum, item) => sum + item.count, 0);
    
    // Haftalık toplam
    const weeklyItems = history.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= oneWeekAgo;
    });
    const weeklyTotal = weeklyItems.reduce((sum, item) => sum + item.count, 0);
    
    // Aylık toplam
    const monthlyItems = history.filter(item => {
      const itemDate = new Date(item.date);
      return itemDate >= oneMonthAgo;
    });
    const monthlyTotal = monthlyItems.reduce((sum, item) => sum + item.count, 0);
    
    // En sık yapılan zikir
    const zikirCounts: Record<string, number> = {};
    history.forEach(item => {
      if (!zikirCounts[item.type]) {
        zikirCounts[item.type] = 0;
      }
      zikirCounts[item.type] += item.count;
    });
    
    let mostCommonZikir = '';
    let maxCount = 0;
    
    Object.entries(zikirCounts).forEach(([zikirType, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonZikir = zikirType;
      }
    });
    
    // Streak hesapla (ardışık günler)
    let streakDays = 0;
    const uniqueDates = [...new Set(history.map(item => item.date))].sort().reverse();
    
    if (uniqueDates.length > 0 && uniqueDates[0] === today) {
      streakDays = 1;
      const dateFormat = /^\d{4}-\d{2}-\d{2}$/;
      
      for (let i = 1; i < uniqueDates.length; i++) {
        if (!dateFormat.test(uniqueDates[i])) continue;
        
        const currentDate = new Date(uniqueDates[i-1]);
        const prevDate = new Date(uniqueDates[i]);
        
        // Bir gün fark var mı kontrol et
        const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          streakDays++;
        } else {
          break;
        }
      }
    }
    
    // Her zikir alt türünün toplam sayısı
    const allCounts: { [type: string]: number } = {};
    history.forEach((item: ZikirHistoryItem) => {
      if (item.counts) {
        Object.keys(item.counts).forEach((subType) => {
          if (!allCounts[subType]) {
            allCounts[subType] = 0;
          }
          allCounts[subType] += item.counts![subType];
        });
      }
    });
    
    return {
      todayTotal,
      weeklyTotal,
      monthlyTotal,
      mostCommonZikir,
      streakDays,
      typeCounts: allCounts
    };
  } catch (error) {
    console.error('Zikir istatistikleri hesaplanırken hata:', error);
    return {
      todayTotal: 0,
      weeklyTotal: 0,
      monthlyTotal: 0,
      mostCommonZikir: '',
      streakDays: 0,
      typeCounts: {}
    };
  }
};

// Zikir tipini ID'ye göre bul
export const getZikirTypeById = async (id: string): Promise<ZikirType | undefined> => {
  try {
    const types = await getZikirTypes();
    return types.find(type => type.id === id);
  } catch (error) {
    console.error('Zikir tipi bulunurken hata:', error);
    return undefined;
  }
};

// Zikir hatırlatıcı ayarla
export const setZikirReminder = async (time: Date): Promise<void> => {
  try {
    await AsyncStorage.setItem('zikir_reminder_time', time.toISOString());
    
    // Burada bildirimleri ayarlama kodu olabilir
    // Bu örnekte sadece AsyncStorage'a kaydediyoruz
    
  } catch (error) {
    console.error('Zikir hatırlatıcısı ayarlanırken hata:', error);
    throw error;
  }
};

// Hatırlatıcı bilgisini getir
export const getZikirReminder = async (): Promise<Date | null> => {
  try {
    const timeStr = await AsyncStorage.getItem('zikir_reminder_time');
    return timeStr ? new Date(timeStr) : null;
  } catch (error) {
    console.error('Zikir hatırlatıcısı getirilirken hata:', error);
    return null;
  }
}; 