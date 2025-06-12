import { getUserSettings, storePrayerTimes, shouldUpdatePrayerTimes } from './storageService';
import { scheduleAllPrayerNotificationsForDay } from './notificationService';
import { getPrayerTimes } from './storageService';

// API URL'si ve API anahtarı
const API_URL = 'https://api.aladhan.com/v1/calendarByCity';

// Bugünkü tarih -7, bugün ve +7 şeklinde toplam 15 günlük veriyi alır
export const fetchPrayerTimesForFifteenDays = async () => {
  try {
    // Kullanıcı ayarlarını al
    const settings = await getUserSettings();
    const city = settings?.city || 'İstanbul';
    
    // Güncellenip güncellenmeyeceğini kontrol et
    const shouldUpdate = await shouldUpdatePrayerTimes();
    if (!shouldUpdate) {
      // Yerel depolamadan al
      return await getPrayerTimesFromStorage(city);
    }
    
    // Bugünün tarihini al
    const today = new Date();
    
    // 7 gün öncesinin tarihini hesapla
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    
    // 7 gün sonrasının tarihini hesapla
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);
    
    // Tarihleri formatla
    const startDate = formatDateForAPI(sevenDaysAgo);
    const endDate = formatDateForAPI(sevenDaysLater);
    
    // API parametreleri
    const params = new URLSearchParams({
      city,
      country: 'Turkey',
      method: 13, // Muslim World League metodu
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    });
    
    // API isteği
    const response = await fetch(`${API_URL}?${params.toString()}`);
    const data = await response.json();
    
    if (data.code === 200 && data.data) {
      // API yanıtını işle
      const prayerTimesData = processPrayerTimesData(data.data, sevenDaysAgo, sevenDaysLater);
      
      // Yerel depolamaya kaydet
      await storePrayerTimes(city, prayerTimesData);
      
      // Bildirim planla
      schedulePrayerNotifications(prayerTimesData);
      
      return prayerTimesData;
    } else {
      console.error('API verisi alınamadı:', data);
      throw new Error('Namaz vakitleri alınamadı');
    }
  } catch (error) {
    console.error('Namaz vakitleri çekilirken hata oluştu:', error);
    throw error;
  }
};

// API yanıtını işle
const processPrayerTimesData = (data, startDate, endDate) => {
  // 15 günlük tarih aralığı içinde olan vakitleri filtrele
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();
  
  return data.filter(day => {
    const dayDate = new Date(day.date.gregorian.date);
    const timestamp = dayDate.getTime();
    return timestamp >= startTimestamp && timestamp <= endTimestamp;
  }).map(day => {
    return {
      date: day.date.gregorian.date,
      day: day.date.gregorian.day,
      month: day.date.gregorian.month.en,
      year: day.date.gregorian.year,
      hijriDate: `${day.date.hijri.day} ${day.date.hijri.month.en} ${day.date.hijri.year}`,
      times: [
        { name: "İmsak", time: day.timings.Imsak.split(' ')[0] },
        { name: "Güneş", time: day.timings.Sunrise.split(' ')[0] },
        { name: "Öğle", time: day.timings.Dhuhr.split(' ')[0] },
        { name: "İkindi", time: day.timings.Asr.split(' ')[0] },
        { name: "Akşam", time: day.timings.Maghrib.split(' ')[0] },
        { name: "Yatsı", time: day.timings.Isha.split(' ')[0] },
      ]
    };
  });
};

// Tarih formatını API için düzenle (YYYY-MM-DD)
const formatDateForAPI = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Yerel depolamadan namaz vakitlerini getir
const getPrayerTimesFromStorage = async (city) => {
  try {
    const prayerTimes = await getPrayerTimes(city);
    if (!prayerTimes) {
      throw new Error('Yerel depolama boş, yeniden API isteği yapılmalı');
    }
    return prayerTimes;
  } catch (error) {
    console.error('Yerel depolamadan namaz vakitleri alınamadı:', error);
    throw error;
  }
};

// Namaz vakitleri için bildirimleri planla
const schedulePrayerNotifications = async (prayerTimesData) => {
  try {
    if (!prayerTimesData || !prayerTimesData.length) return;
    
    // Bugünkü ve gelecekteki tarihler için
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Bugün ve sonraki 2 gün için bildirimleri zamanla
    for (const prayerDay of prayerTimesData) {
      const dayDate = new Date(prayerDay.date);
      dayDate.setHours(0, 0, 0, 0);
      
      if (dayDate.getTime() >= today.getTime() && 
          dayDate.getTime() <= today.getTime() + (2 * 24 * 60 * 60 * 1000)) {
        await scheduleAllPrayerNotificationsForDay(prayerDay);
      }
    }
  } catch (error) {
    console.error('Bildirimler zamanlanırken hata oluştu:', error);
  }
}; 