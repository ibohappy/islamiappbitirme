import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getUserSettings } from './storageService';

// Bildirim izinlerini kontrol et ve iste
export const requestNotificationPermissions = async () => {
  if (!Device.isDevice) {
    alert('Bildirimler fiziksel cihazlarda test edilmelidir');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    alert('Ezan vakitlerinden haberdar olmak için bildirim izni vermelisiniz!');
    return false;
  }
  
  return true;
};

// Bildirim yapılandırması
export const configureNotifications = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
};

// Namaz vakti bildirimini zamanla
export const schedulePrayerNotification = async (prayer, minutesBefore, date) => {
  if (!prayer || !prayer.name || !prayer.time) {
    console.error('Geçersiz namaz vakti verisi');
    return null;
  }

  try {
    // Namaz vaktini tarih nesnesine dönüştür
    const prayerDate = new Date(date);
    const [hour, minute] = prayer.time.split(':').map(Number);
    prayerDate.setHours(hour, minute, 0, 0);
    
    // Bildirim zamanını hesapla
    const notificationDate = new Date(prayerDate);
    notificationDate.setMinutes(notificationDate.getMinutes() - minutesBefore);
    
    // Şu anki zamandan önceyse bildirim gönderme
    const now = new Date();
    if (notificationDate <= now) {
      return null;
    }

    // Bildirim içeriğini oluştur
    const notificationContent = {
      title: `${prayer.name} Vakti Yaklaşıyor`,
      body: `${prayer.name} namazına ${minutesBefore} dakika kaldı (${prayer.time})`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: {
        prayerName: prayer.name,
        prayerTime: prayer.time,
        date: date
      }
    };

    // Bildirimi zamanla
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: {
        date: notificationDate,
      },
    });

    return notificationId;
  } catch (error) {
    console.error(`${prayer.name} için bildirim zamanlanamadı:`, error);
    return null;
  }
};

// Günün namaz vakitleri için bildirimleri zamanla
export const scheduleAllPrayerNotificationsForDay = async (prayerDay) => {
  if (!prayerDay || !prayerDay.times || !prayerDay.date) {
    console.error('Geçersiz namaz vakti günü');
    return [];
  }

  try {
    const settings = await getUserSettings();
    if (!settings || !settings.notificationsEnabled) {
      return [];
    }

    const scheduledNotifications = [];
    
    // Her namaz vakti için bildirim zamanla
    for (const prayer of prayerDay.times) {
      if (settings.activePrayers.includes(prayer.name)) {
        const notificationId = await schedulePrayerNotification(
          prayer, 
          settings.notifyBeforeMinutes, 
          prayerDay.date
        );
        
        if (notificationId) {
          scheduledNotifications.push({
            id: notificationId,
            prayer: prayer.name,
            time: prayer.time,
            date: prayerDay.date
          });
        }
      }
    }

    return scheduledNotifications;
  } catch (error) {
    console.error('Günlük bildirimler zamanlanamadı:', error);
    return [];
  }
};

// Mevcut bildirimleri temizle
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Bildirimler iptal edilemedi:', error);
  }
};

// Android için bildirim kanalı oluştur
export const createNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ezan-vakitleri', {
      name: 'Ezan Vakitleri',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00897B',
      sound: true,
    });
  }
}; 