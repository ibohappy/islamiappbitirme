import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Yeni API URL'leri
const API_BASE_URL = 'https://vakit.vercel.app/api';
const API_TIMES_FROM_PLACE = `${API_BASE_URL}/timesFromPlace`;
const API_TIMES_FOR_GPS = `${API_BASE_URL}/timesForGPS`;
const API_SEARCH_PLACES = `${API_BASE_URL}/searchPlaces`;
const API_NEARBY_PLACES = `${API_BASE_URL}/nearByPlaces`;
const API_COUNTRIES = `${API_BASE_URL}/countries`;
const API_REGIONS = `${API_BASE_URL}/regions`;
const API_CITIES = `${API_BASE_URL}/cities`;

// Türkiye için hesaplama metodu
const CALCULATION_METHOD = 'Turkey';

// API anahtarı için SecureStore anahtarı
const API_KEY_STORAGE_KEY = 'prayer_api_key';

// API anahtarını kaydetme
export const saveApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
    console.log('API anahtarı başarıyla kaydedildi');
    return true;
  } catch (error) {
    console.error('API anahtarı kaydedilemedi:', error);
    return false;
  }
};

// API anahtarını getirme
export const getApiKey = async (): Promise<string | null> => {
  try {
    const apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
    return apiKey;
  } catch (error) {
    console.error('API anahtarı alınamadı:', error);
    return null;
  }
};

// Şehirler için varsayılan namaz vakitleri (API çalışmadığında kullanılacak)
const DEFAULT_PRAYER_TIMES: Record<string, any> = {
  'İstanbul': [
    { saat: "04:57", vakit: "İmsak" },
    { saat: "06:26", vakit: "Güneş" },
    { saat: "13:09", vakit: "Öğle" },
    { saat: "16:47", vakit: "İkindi" },
    { saat: "19:40", vakit: "Akşam" },
    { saat: "21:04", vakit: "Yatsı" }
  ],
  'Ankara': [
    { saat: "04:42", vakit: "İmsak" },
    { saat: "06:12", vakit: "Güneş" },
    { saat: "12:59", vakit: "Öğle" },
    { saat: "16:40", vakit: "İkindi" },
    { saat: "19:35", vakit: "Akşam" },
    { saat: "21:00", vakit: "Yatsı" }
  ],
  'İzmir': [
    { saat: "05:05", vakit: "İmsak" },
    { saat: "06:32", vakit: "Güneş" },
    { saat: "13:15", vakit: "Öğle" },
    { saat: "16:53", vakit: "İkindi" },
    { saat: "19:47", vakit: "Akşam" },
    { saat: "21:09", vakit: "Yatsı" }
  ],
  'Bursa': [
    { saat: "04:55", vakit: "İmsak" },
    { saat: "06:24", vakit: "Güneş" },
    { saat: "13:08", vakit: "Öğle" },
    { saat: "16:47", vakit: "İkindi" },
    { saat: "19:41", vakit: "Akşam" },
    { saat: "21:05", vakit: "Yatsı" }
  ],
  'Antalya': [
    { saat: "04:58", vakit: "İmsak" },
    { saat: "06:22", vakit: "Güneş" },
    { saat: "13:00", vakit: "Öğle" },
    { saat: "16:34", vakit: "İkindi" },
    { saat: "19:27", vakit: "Akşam" },
    { saat: "20:46", vakit: "Yatsı" }
  ],
  'Adana': [
    { saat: "04:33", vakit: "İmsak" },
    { saat: "05:58", vakit: "Güneş" },
    { saat: "12:38", vakit: "Öğle" },
    { saat: "16:14", vakit: "İkindi" },
    { saat: "19:08", vakit: "Akşam" },
    { saat: "20:28", vakit: "Yatsı" }
  ],
  'Konya': [
    { saat: "04:47", vakit: "İmsak" },
    { saat: "06:13", vakit: "Güneş" },
    { saat: "12:55", vakit: "Öğle" },
    { saat: "16:33", vakit: "İkindi" },
    { saat: "19:26", vakit: "Akşam" },
    { saat: "20:47", vakit: "Yatsı" }
  ]
};

export interface PrayerTimeData {
  name: string;
  time: string;
  isNext: boolean;
}

export interface CityData {
  id: number;
  name: string;
}

// Türkiye'deki 81 il
export const TURKISH_CITIES: CityData[] = [
  { id: 1, name: 'Adana' },
  { id: 2, name: 'Adıyaman' },
  { id: 3, name: 'Afyonkarahisar' },
  { id: 4, name: 'Ağrı' },
  { id: 5, name: 'Amasya' },
  { id: 6, name: 'Ankara' },
  { id: 7, name: 'Antalya' },
  { id: 8, name: 'Artvin' },
  { id: 9, name: 'Aydın' },
  { id: 10, name: 'Balıkesir' },
  { id: 11, name: 'Bilecik' },
  { id: 12, name: 'Bingöl' },
  { id: 13, name: 'Bitlis' },
  { id: 14, name: 'Bolu' },
  { id: 15, name: 'Burdur' },
  { id: 16, name: 'Bursa' },
  { id: 17, name: 'Çanakkale' },
  { id: 18, name: 'Çankırı' },
  { id: 19, name: 'Çorum' },
  { id: 20, name: 'Denizli' },
  { id: 21, name: 'Diyarbakır' },
  { id: 22, name: 'Edirne' },
  { id: 23, name: 'Elazığ' },
  { id: 24, name: 'Erzincan' },
  { id: 25, name: 'Erzurum' },
  { id: 26, name: 'Eskişehir' },
  { id: 27, name: 'Gaziantep' },
  { id: 28, name: 'Giresun' },
  { id: 29, name: 'Gümüşhane' },
  { id: 30, name: 'Hakkari' },
  { id: 31, name: 'Hatay' },
  { id: 32, name: 'Isparta' },
  { id: 33, name: 'Mersin' },
  { id: 34, name: 'İstanbul' },
  { id: 35, name: 'İzmir' },
  { id: 36, name: 'Kars' },
  { id: 37, name: 'Kastamonu' },
  { id: 38, name: 'Kayseri' },
  { id: 39, name: 'Kırklareli' },
  { id: 40, name: 'Kırşehir' },
  { id: 41, name: 'Kocaeli' },
  { id: 42, name: 'Konya' },
  { id: 43, name: 'Kütahya' },
  { id: 44, name: 'Malatya' },
  { id: 45, name: 'Manisa' },
  { id: 46, name: 'Kahramanmaraş' },
  { id: 47, name: 'Mardin' },
  { id: 48, name: 'Muğla' },
  { id: 49, name: 'Muş' },
  { id: 50, name: 'Nevşehir' },
  { id: 51, name: 'Niğde' },
  { id: 52, name: 'Ordu' },
  { id: 53, name: 'Rize' },
  { id: 54, name: 'Sakarya' },
  { id: 55, name: 'Samsun' },
  { id: 56, name: 'Siirt' },
  { id: 57, name: 'Sinop' },
  { id: 58, name: 'Sivas' },
  { id: 59, name: 'Tekirdağ' },
  { id: 60, name: 'Tokat' },
  { id: 61, name: 'Trabzon' },
  { id: 62, name: 'Tunceli' },
  { id: 63, name: 'Şanlıurfa' },
  { id: 64, name: 'Uşak' },
  { id: 65, name: 'Van' },
  { id: 66, name: 'Yozgat' },
  { id: 67, name: 'Zonguldak' },
  { id: 68, name: 'Aksaray' },
  { id: 69, name: 'Bayburt' },
  { id: 70, name: 'Karaman' },
  { id: 71, name: 'Kırıkkale' },
  { id: 72, name: 'Batman' },
  { id: 73, name: 'Şırnak' },
  { id: 74, name: 'Bartın' },
  { id: 75, name: 'Ardahan' },
  { id: 76, name: 'Iğdır' },
  { id: 77, name: 'Yalova' },
  { id: 78, name: 'Karabük' },
  { id: 79, name: 'Kilis' },
  { id: 80, name: 'Osmaniye' },
  { id: 81, name: 'Düzce' },
];

// Konum bilgisinden şehir adını bulma
export const getCityFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  try {
    console.log('Konum bilgisi alındı:', latitude, longitude);
    
    // Emülatör için test amaçlı - gerçek cihazda bu kodu kaldırın
    if (latitude === 37.422 && longitude === -122.084) {
      console.log('Emülatör konumu tespit edildi, varsayılan olarak Bursa kullanılıyor');
      return 'Bursa';
    }
    
    // API'den yakın konumları al
    try {
      console.log('Yakın konumlar API isteği yapılıyor...');
      const response = await fetch(`${API_NEARBY_PLACES}?lat=${latitude}&lng=${longitude}&lang=tr`);
      
      if (!response.ok) {
        throw new Error(`API isteği başarısız: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Yakın konumlar alındı:', data);
      
      if (data && data.length > 0) {
        // İlk sonucu al (en yakın konum)
        const nearestPlace = data[0];
        
        // Şehir adını çıkar
        let cityName = nearestPlace.stateName || nearestPlace.city;
        
        // Eğer şehir adı yoksa, bölge adını kullan
        if (!cityName && nearestPlace.region) {
          cityName = nearestPlace.region;
        }
        
        // Eğer hala şehir adı yoksa, ülke adını kullan
        if (!cityName && nearestPlace.country) {
          cityName = nearestPlace.country;
        }
        
        // Türkiye'deki 81 ilden birini bul
        const turkishCity = TURKISH_CITIES.find(
          city => city.name.toLowerCase() === cityName?.toLowerCase()
        );
        
        if (turkishCity) {
          console.log('En yakın şehir:', turkishCity.name);
          return turkishCity.name;
        }
        
        // Eğer Türkiye'deki 81 ilden biri değilse, en yakın ili bul
        console.log('Şehir Türkiye\'deki 81 ilden biri değil, en yakın il bulunuyor...');
        
        // Haversine formülü ile en yakın ili bul
        const nearestCity = findNearestCity(latitude, longitude);
        console.log('En yakın il:', nearestCity);
        return nearestCity;
      }
    } catch (error) {
      console.error('Yakın konumlar API hatası:', error);
    }
    
    // API başarısız olursa, Haversine formülü ile hesapla
    console.log('API başarısız oldu, Haversine formülü ile hesaplanıyor...');
    return findNearestCity(latitude, longitude);
  } catch (error) {
    console.error('Şehir adı alınamadı:', error);
    return null;
  }
};

// Haversine formülü ile en yakın şehri bul
function findNearestCity(latitude: number, longitude: number): string {
  // Türkiye'deki büyük şehirlerin koordinatları
  const cityCoordinates = [
    { name: 'İstanbul', latitude: 41.0082, longitude: 28.9784 },
    { name: 'Ankara', latitude: 39.9334, longitude: 32.8597 },
    { name: 'İzmir', latitude: 38.4237, longitude: 27.1428 },
    { name: 'Bursa', latitude: 40.1885, longitude: 29.0610 },
    { name: 'Antalya', latitude: 36.8969, longitude: 30.7133 },
    { name: 'Adana', latitude: 37.0000, longitude: 35.3213 },
    { name: 'Konya', latitude: 37.8667, longitude: 32.4833 },
    { name: 'Gaziantep', latitude: 37.0662, longitude: 37.3833 },
    { name: 'Şanlıurfa', latitude: 37.1591, longitude: 38.7969 },
    { name: 'Kayseri', latitude: 38.7312, longitude: 35.4787 },
    { name: 'Diyarbakır', latitude: 37.9144, longitude: 40.2306 },
    { name: 'Mersin', latitude: 36.8000, longitude: 34.6333 },
    { name: 'Samsun', latitude: 41.2867, longitude: 36.3300 },
    { name: 'Eskişehir', latitude: 39.7767, longitude: 30.5206 },
    { name: 'Denizli', latitude: 37.7765, longitude: 29.0864 },
    { name: 'Trabzon', latitude: 41.0015, longitude: 39.7178 },
  ];
  
  // Haversine formülü ile daha doğru mesafe hesabı
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Kilometre cinsinden mesafe
  };
  
  const distances = cityCoordinates.map(city => ({
    city: city.name,
    distance: calculateDistance(latitude, longitude, city.latitude, city.longitude)
  }));
  
  // En yakın şehri bul
  distances.sort((a, b) => a.distance - b.distance);
  
  console.log('En yakın şehir:', distances[0].city, 'Mesafe:', distances[0].distance, 'km');
  
  return distances[0].city;
}

// Namaz vakitlerini getirme
export const fetchPrayerTimes = async (city: string): Promise<PrayerTimeData[] | null> => {
  try {
    console.log(`${city} için namaz vakitleri getiriliyor...`);
    
    if (!city || typeof city !== 'string') {
      console.error('Geçersiz şehir adı:', city);
      return getDefaultPrayerTimes('İstanbul');
    }
    
    // Bugünün tarihini al
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD formatı
    
    // Zaman dilimi farkını hesapla (dakika cinsinden)
    const timezoneOffset = today.getTimezoneOffset() * -1;
    
    // API isteği için parametreleri hazırla
    const params = new URLSearchParams({
      country: 'Turkey',
      region: city,
      city: city,
      date: dateString,
      days: '1',
      timezoneOffset: timezoneOffset.toString(),
      calculationMethod: CALCULATION_METHOD
    });
    
    console.log('API isteği yapılıyor:', `${API_TIMES_FROM_PLACE}?${params.toString()}`);
    
    try {
      // API isteği yap
      const response = await fetch(`${API_TIMES_FROM_PLACE}?${params.toString()}`);
      
      if (!response.ok) {
        console.error('API yanıt kodu:', response.status);
        throw new Error(`API isteği başarısız: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API yanıtı alındı:', data);
      
      // Hata kontrolü
      if (data.error) {
        console.error('API hatası:', data.error);
        throw new Error(data.error);
      }
      
      // Veri formatı kontrolü
      if (!data.times || !data.place) {
        console.error('API yanıtı geçersiz format');
        throw new Error('API yanıtı geçersiz format');
      }
      
      // Bugünün tarihini al
      const todayKey = Object.keys(data.times)[0];
      
      if (!todayKey || !data.times[todayKey] || !Array.isArray(data.times[todayKey])) {
        console.error('API yanıtında bugünün verileri bulunamadı');
        throw new Error('API yanıtında bugünün verileri bulunamadı');
      }
      
      // Namaz vakitlerini oluştur
      const prayerTimes = createPrayerTimesFromArray(data.times[todayKey]);
      return prayerTimes;
      
    } catch (error) {
      console.error('API isteği başarısız, varsayılan veri kullanılıyor:', error);
      return getDefaultPrayerTimes(city);
    }
  } catch (error) {
    console.error('Namaz vakitleri alınamadı:', error);
    return getDefaultPrayerTimes(city);
  }
};

// Dizi formatındaki namaz vakitlerini PrayerTimeData dizisine dönüştür
function createPrayerTimesFromArray(timesArray: string[]): PrayerTimeData[] {
  // API'den gelen verileri dönüştürme
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  console.log('API\'den gelen namaz vakitleri:', timesArray);
  
  if (!timesArray || timesArray.length === 0) {
    console.error('API\'den gelen namaz vakitleri dizisi boş veya geçersiz');
    return getDefaultPrayerTimes('İstanbul');
  }
  
  const prayerTimes: PrayerTimeData[] = [];
  let nextPrayerFound = false;
  
  // Namaz vakitlerini oluştur (API'den gelen sıra: imsak, güneş, öğle, ikindi, akşam, yatsı)
  const prayerNames = ['İmsak', 'Güneş', 'Öğle', 'İkindi', 'Akşam', 'Yatsı'];
  
  // Sıradaki namazı belirleme
  for (let i = 0; i < Math.min(timesArray.length, prayerNames.length); i++) {
    const time = timesArray[i];
    const name = prayerNames[i];
    
    if (!time || typeof time !== 'string') {
      console.error(`Geçersiz namaz vakti formatı: ${time}`);
      continue;
    }
    
    const [hour, minute] = time.split(':').map(Number);
    
    if (isNaN(hour) || isNaN(minute)) {
      console.error(`Geçersiz saat formatı: ${time}`);
      continue;
    }
    
    const isPrayerNext = !nextPrayerFound && 
      (hour > currentHour || (hour === currentHour && minute > currentMinute));
    
    if (isPrayerNext) {
      nextPrayerFound = true;
    }
    
    prayerTimes.push({
      name: name,
      time: time,
      isNext: isPrayerNext,
    });
  }
  
  // Eğer hiçbir namaz "sıradaki" olarak işaretlenmediyse, ilk namazı işaretle (ertesi gün)
  if (!nextPrayerFound && prayerTimes.length > 0) {
    prayerTimes[0].isNext = true;
  }
  
  console.log('İşlenmiş namaz vakitleri:', prayerTimes);
  return prayerTimes;
}

// Varsayılan namaz vakitlerini getir
function getDefaultPrayerTimes(city: string): PrayerTimeData[] {
  console.log('Varsayılan namaz vakitleri kullanılıyor...');
  
  // Bugünün tarihi
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  // Şehir için varsayılan vakitleri kontrol et
  let cityTimes = DEFAULT_PRAYER_TIMES[city];
  
  // Eğer şehir için varsayılan veri yoksa, İstanbul verilerini kullan
  if (!cityTimes) {
    console.log(`${city} için varsayılan veri bulunamadı, İstanbul verileri kullanılıyor`);
    cityTimes = DEFAULT_PRAYER_TIMES['İstanbul'];
  }
  
  // Varsayılan namaz vakitleri
  const defaultTimes = cityTimes.map((item: any) => ({
    name: item.vakit,
    time: item.saat
  }));
  
  // Sıradaki namazı belirle
  let nextPrayerFound = false;
  const prayerTimes: PrayerTimeData[] = [];
  
  for (const prayer of defaultTimes) {
    const [hour, minute] = prayer.time.split(':').map(Number);
    
    const isPrayerNext = !nextPrayerFound && 
      (hour > currentHour || (hour === currentHour && minute > currentMinute));
    
    if (isPrayerNext) {
      nextPrayerFound = true;
    }
    
    prayerTimes.push({
      name: prayer.name,
      time: prayer.time,
      isNext: isPrayerNext,
    });
  }
  
  // Eğer hiçbir namaz "sıradaki" olarak işaretlenmediyse, ilk namazı işaretle (ertesi gün)
  if (!nextPrayerFound && prayerTimes.length > 0) {
    prayerTimes[0].isNext = true;
  }
  
  console.log('Varsayılan namaz vakitleri:', prayerTimes);
  return prayerTimes;
} 