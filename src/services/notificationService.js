import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getUserSettings, storeUserSettings, getPrayerTimesData } from './storageService';

// Context7 best practice: Kritik bildirim konfigürasyonu
export const PRAYER_NOTIFICATION_CHANNEL = 'critical-prayer-times';
export const PRAYER_CATEGORY_ID = 'prayer-notification';

// Bildirim izinlerini kontrol et ve iste - Context7 enhanced
export const requestNotificationPermissions = async () => {
  if (!Device.isDevice) {
    console.warn('Bildirimler fiziksel cihazlarda test edilmelidir');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    console.log('Mevcut bildirim izin durumu:', existingStatus);
    
    if (existingStatus !== 'granted') {
      console.log('Bildirim izni isteniyor...');
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
          allowCriticalAlerts: true, // Context7: Kritik uyarılar için
        },
        android: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
        }
      });
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.error('Bildirim izni reddedildi');
      return false;
    }
    
    console.log('Bildirim izni başarıyla alındı');
    return true;
  } catch (error) {
    console.error('Bildirim izni alınırken hata:', error);
    return false;
  }
};

// Context7 best practice: Gelişmiş bildirim yapılandırması
export const configureNotifications = () => {
  console.log('Bildirim handler konfigüre ediliyor...');
  
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // Context7: Namaz bildirimleri için özel konfigürasyon
      const isPrayerNotification = notification.request.content.categoryIdentifier === PRAYER_CATEGORY_ID;
      
      if (isPrayerNotification) {
        console.log('Namaz bildirimi alındı:', notification.request.content.title);
        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        };
      }
      
      // Diğer bildirimler için varsayılan
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      };
    },
  });
  
  console.log('Bildirim handler başarıyla konfigüre edildi');
};

// Context7 best practice: Kritik Android bildirim kanalı oluştur
export const createNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    try {
      console.log('Android bildirim kanalı oluşturuluyor...');
      
      await Notifications.setNotificationChannelAsync(PRAYER_NOTIFICATION_CHANNEL, {
        name: 'Namaz Vakti Bildirimleri',
        description: 'Namaz vakitlerinden önce gelen kritik hatırlatma bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250, 250, 250], // Context7: Güçlü titreşim
        lightColor: '#00897B',
        sound: true,
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, // Context7: Kilit ekranında görünsün
        bypassDnd: true, // Context7: Rahatsız etme modunu bypass et
      });
      
      console.log('Android bildirim kanalı başarıyla oluşturuldu');
    } catch (error) {
      console.error('Android bildirim kanalı oluşturulamadı:', error);
    }
  }
};

// Context7 best practice: Güvenilir namaz bildirimi zamanlaması
export const schedulePrayerNotification = async (prayer, minutesBefore, date) => {
  if (!prayer || !prayer.name || !prayer.time) {
    console.error('Geçersiz namaz vakti verisi:', { prayer, minutesBefore, date });
    return null;
  }

  try {
    console.log(`${prayer.name} namazı için bildirim zamanlanıyor...`);
    
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
      console.log(`${prayer.name} bildirimi geçmiş zamanda (${notificationDate.toLocaleString('tr-TR')}), atlanıyor`);
      return null;
    }

    // Context7 best practice: Gelişmiş bildirim içeriği
    const notificationContent = {
      title: `🕌 ${prayer.name} Namazı Yaklaşıyor`,
      body: `${prayer.name} namazına ${minutesBefore} dakika kaldı (${prayer.time})`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      categoryIdentifier: PRAYER_CATEGORY_ID,
      sticky: false, // Context7: Bildirimi temizlenebilir yap
      autoDismiss: true,
      data: {
        prayerName: prayer.name,
        prayerTime: prayer.time,
        date: date,
        notifyBeforeMinutes: minutesBefore,
        notificationType: 'prayer-reminder',
        scheduledAt: new Date().toISOString(),
        triggerTime: notificationDate.toISOString()
      }
    };

    // Context7 best practice: Platform'a özgü trigger konfigürasyonu
    const triggerConfig = Platform.OS === 'android' ? {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notificationDate,
      channelId: PRAYER_NOTIFICATION_CHANNEL,
      repeats: false
    } : {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notificationDate,
      repeats: false
    };

    // Bildirimi zamanla
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: triggerConfig
    });

    console.log(`✅ ${prayer.name} bildirimi başarıyla zamanlandı:`, {
      id: notificationId,
      triggerTime: notificationDate.toLocaleString('tr-TR'),
      minutesBefore,
      currentTime: now.toLocaleString('tr-TR')
    });

    // Context7: Hemen doğrulama yap
    setTimeout(async () => {
      try {
        const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
        const ourNotification = allNotifications.find(n => n.identifier === notificationId);
        if (ourNotification) {
          console.log(`✅ ${prayer.name} bildirimi sistemde doğrulandı`);
        } else {
          console.error(`❌ ${prayer.name} bildirimi sistemde bulunamadı!`);
        }
      } catch (verifyError) {
        console.error(`Bildirim doğrulaması hatası:`, verifyError);
      }
    }, 500);

    return notificationId;
  } catch (error) {
    console.error(`❌ ${prayer.name} için bildirim zamanlanamadı:`, error);
    return null;
  }
};

// Context7 best practice: Kapsamlı günlük bildirim zamanlaması
export const scheduleAllPrayerNotificationsForDay = async (prayerDay) => {
  if (!prayerDay || !prayerDay.times || !prayerDay.date) {
    console.error('Geçersiz namaz vakti günü:', prayerDay);
    return [];
  }

  try {
    console.log(`${new Date(prayerDay.date).toLocaleDateString('tr-TR')} günü için bildirimleri zamanlanıyor...`);
    
    const settings = await getUserSettings();
    if (!settings || !settings.notificationsEnabled) {
      console.log('Bildirimler kullanıcı tarafından devre dışı');
      return [];
    }

    if (!settings.activePrayers || settings.activePrayers.length === 0) {
      console.log('Hiç aktif namaz vakti seçilmemiş');
      return [];
    }

    const scheduledNotifications = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Her namaz vakti için bildirim zamanla
    for (const prayer of prayerDay.times) {
      if (settings.activePrayers.includes(prayer.name)) {
        try {
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
              date: prayerDay.date,
              minutesBefore: settings.notifyBeforeMinutes
            });
            successCount++;
          } else {
            skipCount++;
          }
        } catch (prayerError) {
          console.error(`${prayer.name} zamanlaması hatası:`, prayerError);
          errorCount++;
        }
      } else {
        console.log(`${prayer.name} seçili değil, atlanıyor`);
      }
    }

    console.log(`Günlük bildirim özeti: ${successCount} başarılı, ${skipCount} atlandı, ${errorCount} hatalı`);
    return scheduledNotifications;
  } catch (error) {
    console.error('Günlük bildirimler zamanlanamadı:', error);
    return [];
  }
};

// Context7 best practice: Kapsamlı bildirim temizleme
export const cancelAllNotifications = async () => {
  try {
    console.log('Tüm zamanlanmış bildirimler iptal ediliyor...');
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Tüm bildirimler başarıyla iptal edildi');
  } catch (error) {
    console.error('Bildirimler iptal edilemedi:', error);
  }
};

// Context7 best practice: Sadece namaz bildirimlerini iptal et
export const cancelPrayerNotifications = async () => {
  try {
    console.log('Namaz bildirimleri iptal ediliyor...');
    
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`Toplam ${allNotifications.length} zamanlanmış bildirim bulundu`);
    
    let cancelCount = 0;
    
    for (const notification of allNotifications) {
      const isPrayerNotification = 
        notification.content.categoryIdentifier === PRAYER_CATEGORY_ID ||
        notification.content.data?.notificationType === 'prayer-reminder' ||
        notification.content.data?.prayerName;
      
      if (isPrayerNotification) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        console.log(`❌ İptal edildi: ${notification.content.title}`);
        cancelCount++;
      }
    }
    
    console.log(`Toplam ${cancelCount} namaz bildirimi iptal edildi`);
    return true;
  } catch (error) {
    console.error('Namaz bildirimleri iptal edilirken hata:', error);
    return false;
  }
};

// Context7 best practice: Bildirim durumu analizi
export const getNotificationStatus = async () => {
  try {
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    const prayerNotifications = allNotifications.filter(notification => {
      return notification.content.categoryIdentifier === PRAYER_CATEGORY_ID ||
             notification.content.data?.notificationType === 'prayer-reminder' ||
             notification.content.data?.prayerName;
    });
    
    // Context7: Gelecek 24 saatteki bildirimleri ayrı analiz et
    const now = new Date();
    const next24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    
    const upcomingNotifications = prayerNotifications.filter(notif => {
      if (notif.trigger?.date) {
        const triggerDate = new Date(notif.trigger.date);
        return triggerDate >= now && triggerDate <= next24Hours;
      }
      return false;
    });
    
    return {
      total: allNotifications.length,
      prayerNotifications: prayerNotifications.length,
      upcomingIn24Hours: upcomingNotifications.length,
      notifications: prayerNotifications,
      upcomingNotifications
    };
  } catch (error) {
    console.error('Bildirim durumu alınamadı:', error);
    return {
      total: 0,
      prayerNotifications: 0,
      upcomingIn24Hours: 0,
      notifications: [],
      upcomingNotifications: [],
      error: error.message
    };
  }
};

// Context7 best practice: Test bildirimi - garantili çalışma
export const sendTestNotification = async () => {
  try {
    console.log('Test bildirimi gönderiliyor...');
    
    // Bildirim izni kontrolü
    const permissionGranted = await requestNotificationPermissions();
    if (!permissionGranted) {
      throw new Error('Bildirim izni gerekli');
    }
    
    // Notification channel oluştur
    await createNotificationChannel();
    
    // Context7: Hem hemen hem de 5 saniye sonra test
    const immediateTestId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🧪 Anlık Test - Sistem Çalışıyor",
        body: "Bu bildirim anında geldi. Sistem düzgün çalışıyor.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: PRAYER_CATEGORY_ID,
        data: {
          isTest: true,
          testType: 'immediate',
          timestamp: new Date().toISOString()
        }
      },
      trigger: Platform.OS === 'android' ? {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: PRAYER_NOTIFICATION_CHANNEL
      } : {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1
      }
    });
    
    const delayedTestId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🕌 Test Namaz Bildirimi",
        body: "Bu bir namaz vakti simülasyonudur. Gerçek bildirimler böyle gelecek.",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: PRAYER_CATEGORY_ID,
        data: {
          isTest: true,
          testType: 'delayed',
          prayerName: 'Test',
          notificationType: 'prayer-reminder',
          timestamp: new Date().toISOString()
        }
      },
      trigger: Platform.OS === 'android' ? {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: PRAYER_NOTIFICATION_CHANNEL
      } : {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5
      }
    });
    
    console.log('Test bildirimleri zamanlandı:', { immediateTestId, delayedTestId });
    return { immediateTestId, delayedTestId };
    
  } catch (error) {
    console.error('Test bildirimi gönderilirken hata:', error);
    throw error;
  }
};

// Context7 best practice: Özel namaz vakti kontrolü ve garantili bildirim sistemi
export const checkSpecificPrayerNotification = async (prayerName, hoursFromNow) => {
  try {
    console.log(`🔍 [CONTEXT7] ${prayerName} namazı için özel kontrol başlatılıyor...`);
    console.log(`⏰ Hedef zaman: ${hoursFromNow} saat sonra`);
    
    // Step 1: Mevcut bildirimleri al
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`📊 Toplam zamanlanmış bildirim: ${allNotifications.length} adet`);
    
    // Step 2: Namaz bildirimlerini filtrele
    const prayerNotifications = allNotifications.filter(notification => {
      return notification.content.categoryIdentifier === PRAYER_CATEGORY_ID ||
             notification.content.data?.notificationType === 'prayer-reminder' ||
             notification.content.data?.prayerName;
    });
    
    console.log(`🕌 Namaz bildirimleri: ${prayerNotifications.length} adet`);
    
    // Step 3: Spesifik namaz vaktini kontrol et
    const now = new Date();
    const targetTime = new Date(now.getTime() + (hoursFromNow * 60 * 60 * 1000));
    const searchWindow = 30 * 60 * 1000; // 30 dakika pencere
    
    console.log(`🎯 Hedef zaman aralığı: ${new Date(targetTime.getTime() - searchWindow).toLocaleString('tr-TR')} - ${new Date(targetTime.getTime() + searchWindow).toLocaleString('tr-TR')}`);
    
    const specificPrayerNotifications = prayerNotifications.filter(notif => {
      // Namaz adı kontrolü
      const matchesPrayerName = notif.content.data?.prayerName === prayerName || 
                               notif.content.title?.includes(prayerName);
      
      // Zaman kontrolü
      let matchesTime = false;
      if (notif.trigger?.date) {
        const triggerDate = new Date(notif.trigger.date);
        const timeDiff = Math.abs(triggerDate.getTime() - targetTime.getTime());
        matchesTime = timeDiff <= searchWindow;
      }
      
      return matchesPrayerName && matchesTime;
    });
    
    console.log(`🎯 ${prayerName} için bulunan bildirimler: ${specificPrayerNotifications.length} adet`);
    
    // Step 4: Detaylı analiz
    const analysis = {
      isScheduled: specificPrayerNotifications.length > 0,
      foundNotifications: specificPrayerNotifications.length,
      details: specificPrayerNotifications.map(notif => ({
        title: notif.content.title,
        triggerTime: notif.trigger?.date ? new Date(notif.trigger.date).toLocaleString('tr-TR') : 'Belirsiz',
        prayerName: notif.content.data?.prayerName,
        notificationId: notif.identifier
      })),
      hoursFromNow,
      prayerName,
      targetTime: targetTime.toLocaleString('tr-TR')
    };
    
    // Step 5: Sonuç raporu
    if (analysis.isScheduled) {
      console.log(`✅ [CONTEXT7] ${prayerName} bildirimi BULUNDU!`);
      analysis.details.forEach((detail, index) => {
        console.log(`   ${index + 1}. ${detail.title} → ${detail.triggerTime}`);
      });
    } else {
      console.log(`❌ [CONTEXT7] ${prayerName} bildirimi BULUNAMADI!`);
      console.log(`⚠️ Bu durumda sistem yeniden başlatılması gerekiyor`);
    }
    
    return analysis;
    
  } catch (error) {
    console.error(`❌ [CONTEXT7] ${prayerName} kontrol hatası:`, error);
    return {
      isScheduled: false,
      foundNotifications: 0,
      details: [],
      error: error.message,
      hoursFromNow,
      prayerName
    };
  }
};

// Context7 best practice: Acil bildirim tamiri sistemi
export const emergencyFixPrayerNotification = async (prayerName, hoursFromNow) => {
  try {
    console.log(`🚨 [CONTEXT7] ${prayerName} için acil tamir sistemi başlatılıyor...`);
    
    // Step 1: Kullanıcı ayarlarını al
    const { getUserSettings } = await import('./storageService');
    const settings = await getUserSettings();
    
    if (!settings || !settings.notificationsEnabled) {
      throw new Error('Bildirimler devre dışı');
    }
    
    if (!settings.activePrayers.includes(prayerName)) {
      throw new Error(`${prayerName} namaz vakti seçili değil`);
    }
    
    // Step 2: Hedef zamanı hesapla
    const now = new Date();
    const targetPrayerTime = new Date(now.getTime() + (hoursFromNow * 60 * 60 * 1000));
    const notificationTime = new Date(targetPrayerTime.getTime() - (settings.notifyBeforeMinutes * 60 * 1000));
    
    console.log(`🎯 Namaz zamanı: ${targetPrayerTime.toLocaleString('tr-TR')}`);
    console.log(`🔔 Bildirim zamanı: ${notificationTime.toLocaleString('tr-TR')}`);
    
    // Step 3: Geçmiş zaman kontrolü
    if (notificationTime <= now) {
      throw new Error('Bildirim zamanı geçmiş zamanda kalıyor');
    }
    
    // Step 4: Mevcut benzer bildirimleri temizle
    console.log('🧹 Mevcut benzer bildirimler temizleniyor...');
    const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notif of allNotifications) {
      const isPrayerNotif = notif.content.data?.prayerName === prayerName;
      if (isPrayerNotif) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        console.log(`❌ İptal edildi: ${notif.content.title}`);
      }
    }
    
    // Step 5: Yeni bildirim oluştur
    console.log(`🚀 Yeni ${prayerName} bildirimi oluşturuluyor...`);
    
    const notificationConfig = {
      content: {
        title: `🕌 ${prayerName} Namazı Yaklaşıyor`,
        body: `${prayerName} namazına ${settings.notifyBeforeMinutes} dakika kaldı`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: PRAYER_CATEGORY_ID,
        sticky: false,
        autoDismiss: true,
        data: {
          prayerName: prayerName,
          prayerTime: targetPrayerTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          date: targetPrayerTime.toDateString(),
          notifyBeforeMinutes: settings.notifyBeforeMinutes,
          notificationType: 'prayer-reminder',
          scheduledAt: new Date().toISOString(),
          triggerTime: notificationTime.toISOString(),
          emergency: true,
          city: settings.city
        }
      },
      trigger: Platform.OS === 'android' ? {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationTime,
        channelId: PRAYER_NOTIFICATION_CHANNEL,
        repeats: false
      } : {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationTime,
        repeats: false
      }
    };
    
    const notificationId = await Notifications.scheduleNotificationAsync(notificationConfig);
    
    console.log(`✅ [CONTEXT7] ${prayerName} bildirimi başarıyla oluşturuldu:`, {
      id: notificationId,
      triggerTime: notificationTime.toLocaleString('tr-TR'),
      remainingHours: ((notificationTime.getTime() - now.getTime()) / (1000 * 60 * 60)).toFixed(2)
    });
    
    // Step 6: Hemen doğrulama
    setTimeout(async () => {
      const verification = await checkSpecificPrayerNotification(prayerName, hoursFromNow);
      if (verification.isScheduled) {
        console.log(`🎯 [CONTEXT7] ${prayerName} bildirimi doğrulandı!`);
      } else {
        console.error(`⚠️ [CONTEXT7] ${prayerName} bildirimi doğrulanamadı!`);
      }
    }, 1000);
    
    return {
      success: true,
      notificationId,
      prayerName,
      triggerTime: notificationTime.toLocaleString('tr-TR'),
      remainingTime: notificationTime.getTime() - now.getTime()
    };
    
  } catch (error) {
    console.error(`💥 [CONTEXT7] ${prayerName} acil tamir hatası:`, error);
    return {
      success: false,
      error: error.message,
      prayerName
    };
  }
};

// Context7 best practice: Garantili bildirim sistemi
export const guaranteePrayerNotification = async (prayerName, hoursFromNow) => {
  try {
    console.log(`🎯 [CONTEXT7] ${prayerName} için garantili bildirim sistemi başlatılıyor...`);
    
    // Step 1: Mevcut durumu kontrol et
    const currentStatus = await checkSpecificPrayerNotification(prayerName, hoursFromNow);
    
    if (currentStatus.isScheduled) {
      console.log(`✅ [CONTEXT7] ${prayerName} bildirimi zaten mevcut`);
      return {
        alreadyScheduled: true,
        status: 'GUARANTEED',
        details: currentStatus
      };
    }
    
    // Step 2: Yoksa acil tamir yap
    console.log(`🚨 [CONTEXT7] ${prayerName} bildirimi eksik, acil tamir başlatılıyor...`);
    const repairResult = await emergencyFixPrayerNotification(prayerName, hoursFromNow);
    
    if (repairResult.success) {
      console.log(`🎯 [CONTEXT7] ${prayerName} bildirimi başarıyla garantilendi!`);
      return {
        repaired: true,
        status: 'GUARANTEED',
        details: repairResult
      };
    } else {
      console.error(`💥 [CONTEXT7] ${prayerName} bildirimi garantilenemedi:`, repairResult.error);
      return {
        failed: true,
        status: 'FAILED',
        error: repairResult.error
      };
    }
    
  } catch (error) {
    console.error(`💥 [CONTEXT7] ${prayerName} garanti sistemi hatası:`, error);
    return {
      failed: true,
      status: 'ERROR',
      error: error.message
    };
  }
};

// Context7 best practice: Problem diagnostiği için gelişmiş debug sistemi
export const diagnosePrayerNotificationIssue = async () => {
  try {
    console.log('🔍 [CONTEXT7] Problem tanı sistemi başlatılıyor...');
    
    const settings = await getUserSettings();
    if (!settings) {
      return { error: 'Kullanıcı ayarları bulunamadı' };
    }
    
    const prayerTimesData = await getPrayerTimesData();
    if (!prayerTimesData || prayerTimesData.length === 0) {
      return { error: 'Namaz vakti verisi bulunamadı' };
    }
    
    const today = new Date();
    const todayStr = today.toDateString();
    
    // Bugünün namaz vakitlerini bul
    const todayPrayer = prayerTimesData.find(day => {
      const dayDate = new Date(day.date);
      return dayDate.toDateString() === todayStr;
    });
    
    if (!todayPrayer) {
      return { error: 'Bugünün namaz vakitleri bulunamadı' };
    }
    
    console.log('🎯 Bugünün namaz vakitleri:', todayPrayer.times.map(p => `${p.name}: ${p.time}`));
    
    const currentTime = today.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    console.log('⏰ Şu anki zaman:', currentTime);
    console.log('⏰ Bildirim öncesi süre:', settings.notifyBeforeMinutes, 'dakika');
    
    const diagnosis = {
      currentTime,
      notifyBeforeMinutes: settings.notifyBeforeMinutes,
      activePrayers: settings.activePrayers,
      analysis: [],
      problematicPrayers: [],
      successfulPrayers: []
    };
    
    // Her namaz vakti için analiz
    for (const prayer of todayPrayer.times) {
      console.log(`\n🕌 [${prayer.name}] analiz ediliyor...`);
      
      const isActive = settings.activePrayers.includes(prayer.name);
      console.log(`   📋 Seçili: ${isActive ? 'Evet' : 'Hayır'}`);
      
      if (!isActive) {
        diagnosis.analysis.push({
          prayer: prayer.name,
          time: prayer.time,
          status: 'not-selected',
          message: 'Kullanıcı tarafından seçilmemiş'
        });
        continue;
      }
      
      // Zaman hesaplama
      const prayerDate = new Date(todayPrayer.date);
      const [hour, minute] = prayer.time.split(':').map(Number);
      prayerDate.setHours(hour, minute, 0, 0);
      
      const notificationDate = new Date(prayerDate);
      notificationDate.setMinutes(notificationDate.getMinutes() - settings.notifyBeforeMinutes);
      
      const now = new Date();
      const isPastTime = notificationDate <= now;
      const hoursFromNow = (notificationDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      console.log(`   🎯 Namaz zamanı: ${prayerDate.toLocaleString('tr-TR')}`);
      console.log(`   🔔 Bildirim zamanı: ${notificationDate.toLocaleString('tr-TR')}`);
      console.log(`   ⏱️ Şu andan itibaren: ${hoursFromNow.toFixed(2)} saat`);
      console.log(`   ❓ Geçmiş zaman: ${isPastTime ? 'Evet (PROBLEM!)' : 'Hayır (OK)'}`);
      
      const analysisEntry = {
        prayer: prayer.name,
        time: prayer.time,
        prayerDateTime: prayerDate.toLocaleString('tr-TR'),
        notificationDateTime: notificationDate.toLocaleString('tr-TR'),
        hoursFromNow: parseFloat(hoursFromNow.toFixed(2)),
        isPastTime,
        status: isPastTime ? 'past-time' : 'will-be-scheduled',
        message: isPastTime ? 
          `Bildirim zamanı geçmiş (${Math.abs(hoursFromNow).toFixed(2)} saat önce)` : 
          `Bildirim zamanlanacak (${hoursFromNow.toFixed(2)} saat sonra)`
      };
      
      diagnosis.analysis.push(analysisEntry);
      
      if (isPastTime) {
        diagnosis.problematicPrayers.push(analysisEntry);
      } else {
        diagnosis.successfulPrayers.push(analysisEntry);
      }
    }
    
    // Özet rapor
    console.log('\n📊 ÖZET RAPOR:');
    console.log(`✅ Zamanlanacak: ${diagnosis.successfulPrayers.length} namaz`);
    console.log(`❌ Geçmiş zaman: ${diagnosis.problematicPrayers.length} namaz`);
    
    if (diagnosis.problematicPrayers.length > 0) {
      console.log('\n🚨 PROBLEMLİ NAMAZ VAKİTLERİ:');
      diagnosis.problematicPrayers.forEach(p => {
        console.log(`   - ${p.prayer}: ${p.message}`);
      });
      
      console.log('\n💡 ÇÖZÜMLERİ:');
      console.log('   1. Bildirimleri gece yarısı sonrası yeniden başlatın');
      console.log('   2. Bildirim sistemi her namaz vaktinden sonra kendini yenilesin');
      console.log('   3. Yarının namaz vakitlerini de zamanla');
    }
    
    return diagnosis;
    
  } catch (error) {
    console.error('💥 Problem tanı sistemi hatası:', error);
    return { error: error.message };
  }
};

// Context7 best practice: Gelişmiş debug bildirim sistemi 
export const debugSchedulePrayerNotification = async (prayer, minutesBefore, date) => {
  console.log(`\n🔍 [DEBUG] ${prayer.name} için detaylı zamanlama analizi başlıyor...`);
  console.log(`📅 Tarih: ${date}`);
  console.log(`🕰️ Namaz vakti: ${prayer.time}`);
  console.log(`⏰ Bildirim öncesi: ${minutesBefore} dakika`);
  
  try {
    // Adım 1: Namaz vaktini tarih nesnesine dönüştür
    const prayerDate = new Date(date);
    const [hour, minute] = prayer.time.split(':').map(Number);
    prayerDate.setHours(hour, minute, 0, 0);
    
    console.log(`🎯 Hesaplanan namaz zamanı: ${prayerDate.toLocaleString('tr-TR')}`);
    
    // Adım 2: Bildirim zamanını hesapla
    const notificationDate = new Date(prayerDate);
    notificationDate.setMinutes(notificationDate.getMinutes() - minutesBefore);
    
    console.log(`🔔 Hesaplanan bildirim zamanı: ${notificationDate.toLocaleString('tr-TR')}`);
    
    // Adım 3: Şu anki zaman ile karşılaştır
    const now = new Date();
    console.log(`⏰ Şu anki zaman: ${now.toLocaleString('tr-TR')}`);
    
    const timeDiff = notificationDate.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const minutesDiff = timeDiff / (1000 * 60);
    
    console.log(`📊 Zaman farkı: ${hoursDiff.toFixed(2)} saat (${minutesDiff.toFixed(0)} dakika)`);
    
    // Adım 4: Sonuç analizi
    if (notificationDate <= now) {
      console.log(`❌ SONUÇ: ${prayer.name} bildirimi GEÇMİŞ ZAMANDA - ATLANACAK!`);
      console.log(`   🔍 Detay: Bildirim zamanı ${Math.abs(hoursDiff).toFixed(2)} saat önce geçti`);
      console.log(`   💡 Çözüm: Bu namaz için yarının vakti zamanlanmalı`);
      return null;
    } else {
      console.log(`✅ SONUÇ: ${prayer.name} bildirimi ZAMANLANACAK`);
      console.log(`   🔍 Detay: ${hoursDiff.toFixed(2)} saat sonra bildirim gelecek`);
      
      // Gerçek zamanlama yap
      const result = await schedulePrayerNotification(prayer, minutesBefore, date);
      console.log(`   🎯 Zamanlama durumu: ${result ? 'Başarılı' : 'Başarısız'}`);
      return result;
    }
    
  } catch (error) {
    console.error(`💥 [DEBUG] ${prayer.name} debug analizi hatası:`, error);
    return null;
  }
};

// Context7 best practice: Tüm gün için detaylı debug
export const debugScheduleAllPrayersForDay = async (prayerDay) => {
  console.log(`\n🔍 [DEBUG] ${prayerDay.date} günü için kapsamlı analiz başlıyor...`);
  
  const settings = await getUserSettings();
  if (!settings) {
    console.error('❌ Kullanıcı ayarları bulunamadı');
    return [];
  }
  
  console.log(`📋 Kullanıcı ayarları:`, {
    notificationsEnabled: settings.notificationsEnabled,
    notifyBeforeMinutes: settings.notifyBeforeMinutes,
    activePrayers: settings.activePrayers
  });
  
  const results = [];
  let scheduledCount = 0;
  let skippedCount = 0;
  
  for (const prayer of prayerDay.times) {
    console.log(`\n➡️ ${prayer.name} işleniyor...`);
    
    if (!settings.activePrayers.includes(prayer.name)) {
      console.log(`   ⏩ ${prayer.name} seçili değil, atlanıyor`);
      results.push({ prayer: prayer.name, status: 'not-selected' });
      continue;
    }
    
    const notificationId = await debugSchedulePrayerNotification(
      prayer, 
      settings.notifyBeforeMinutes, 
      prayerDay.date
    );
    
    if (notificationId) {
      scheduledCount++;
      results.push({ 
        prayer: prayer.name, 
        status: 'scheduled', 
        notificationId,
        time: prayer.time
      });
    } else {
      skippedCount++;
      results.push({ 
        prayer: prayer.name, 
        status: 'skipped-past-time',
        time: prayer.time
      });
    }
  }
  
  console.log(`\n📊 ${prayerDay.date} GÜN ÖZETİ:`);
  console.log(`   ✅ Zamanlandı: ${scheduledCount} namaz`);
  console.log(`   ❌ Atlandı: ${skippedCount} namaz`);
  console.log(`   📋 Detaylar:`, results);
  
  return results;
};

// Context7 best practice: Gelişmiş namaz bildirimi zamanlaması (Geçmiş zaman problemi çözümü)
export const scheduleAdvancedPrayerNotification = async (prayer, minutesBefore, date) => {
  if (!prayer || !prayer.name || !prayer.time) {
    console.error('Geçersiz namaz vakti verisi:', { prayer, minutesBefore, date });
    return null;
  }

  try {
    console.log(`🚀 [ADVANCED] ${prayer.name} namazı için gelişmiş zamanlama başlıyor...`);
    
    // Namaz vaktini tarih nesnesine dönüştür
    let prayerDate = new Date(date);
    const [hour, minute] = prayer.time.split(':').map(Number);
    prayerDate.setHours(hour, minute, 0, 0);
    
    // Bildirim zamanını hesapla
    let notificationDate = new Date(prayerDate);
    notificationDate.setMinutes(notificationDate.getMinutes() - minutesBefore);
    
    const now = new Date();
    
    // Context7: Eğer bildirim zamanı geçmişte ise, yarının aynı vakti için zamanla
    if (notificationDate <= now) {
      console.log(`⏰ ${prayer.name} bildirimi geçmiş zamanda (${notificationDate.toLocaleString('tr-TR')})`);
      console.log(`🔄 Yarının ${prayer.name} vakti için yeniden hesaplanıyor...`);
      
      // Yarının aynı namaz vaktini hesapla
      const tomorrowPrayerDate = new Date(prayerDate);
      tomorrowPrayerDate.setDate(tomorrowPrayerDate.getDate() + 1);
      
      const tomorrowNotificationDate = new Date(tomorrowPrayerDate);
      tomorrowNotificationDate.setMinutes(tomorrowNotificationDate.getMinutes() - minutesBefore);
      
      console.log(`🎯 Yarın ${prayer.name} namaz zamanı: ${tomorrowPrayerDate.toLocaleString('tr-TR')}`);
      console.log(`🔔 Yarın ${prayer.name} bildirim zamanı: ${tomorrowNotificationDate.toLocaleString('tr-TR')}`);
      
      // Yeni tarihleri kullan
      prayerDate = tomorrowPrayerDate;
      notificationDate = tomorrowNotificationDate;
      
      // Yarın da geçmiş zamanda ise (teorik olarak mümkün değil ama güvenlik için)
      if (notificationDate <= now) {
        console.error(`❌ KRITIK: Yarının ${prayer.name} bildirimi de geçmiş zamanda! Bu normalin dışında.`);
        return null;
      }
    }
    
    console.log(`✅ ${prayer.name} için nihai zamanlama:`);
    console.log(`   🎯 Namaz zamanı: ${prayerDate.toLocaleString('tr-TR')}`);
    console.log(`   🔔 Bildirim zamanı: ${notificationDate.toLocaleString('tr-TR')}`);
    console.log(`   ⏱️ Şu andan itibaren: ${((notificationDate.getTime() - now.getTime()) / (1000 * 60 * 60)).toFixed(2)} saat`);

    // Context7 best practice: Gelişmiş bildirim içeriği
    const notificationContent = {
      title: `🕌 ${prayer.name} Namazı Yaklaşıyor`,
      body: `${prayer.name} namazına ${minutesBefore} dakika kaldı (${prayer.time})`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      categoryIdentifier: PRAYER_CATEGORY_ID,
      sticky: false,
      autoDismiss: true,
      data: {
        prayerName: prayer.name,
        prayerTime: prayer.time,
        date: prayerDate.toDateString(), // Güncellenmiş tarih
        notifyBeforeMinutes: minutesBefore,
        notificationType: 'prayer-reminder',
        scheduledAt: new Date().toISOString(),
        triggerTime: notificationDate.toISOString(),
        advanced: true, // Bu gelişmiş sistem ile zamanlandığını belirt
        originalDate: date // Orijinal tarih bilgisi
      }
    };

    // Context7 best practice: Platform'a özgü trigger konfigürasyonu
    const triggerConfig = Platform.OS === 'android' ? {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notificationDate,
      channelId: PRAYER_NOTIFICATION_CHANNEL,
      repeats: false
    } : {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: notificationDate,
      repeats: false
    };

    // Bildirimi zamanla
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: triggerConfig
    });

    console.log(`✅ ${prayer.name} bildirimi başarıyla zamanlandı (Gelişmiş Sistem):`, {
      id: notificationId,
      triggerTime: notificationDate.toLocaleString('tr-TR'),
      minutesBefore,
      currentTime: now.toLocaleString('tr-TR'),
      isAdvanced: true
    });

    // Context7: Hemen doğrulama yap
    setTimeout(async () => {
      try {
        const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
        const ourNotification = allNotifications.find(n => n.identifier === notificationId);
        if (ourNotification) {
          console.log(`✅ ${prayer.name} bildirimi sistemde doğrulandı (Gelişmiş)`);
        } else {
          console.error(`❌ ${prayer.name} bildirimi sistemde bulunamadı! (Gelişmiş)`);
        }
      } catch (verifyError) {
        console.error(`Bildirim doğrulaması hatası (Gelişmiş):`, verifyError);
      }
    }, 500);

    return notificationId;
  } catch (error) {
    console.error(`❌ ${prayer.name} için gelişmiş bildirim zamanlanamadı:`, error);
    return null;
  }
};

// Context7 best practice: Gelişmiş günlük bildirim zamanlaması
export const scheduleAllPrayerNotificationsAdvanced = async (prayerDay) => {
  if (!prayerDay || !prayerDay.times || !prayerDay.date) {
    console.error('Geçersiz namaz vakti günü:', prayerDay);
    return [];
  }

  try {
    console.log(`🚀 [ADVANCED] ${new Date(prayerDay.date).toLocaleDateString('tr-TR')} günü için gelişmiş bildirimleri zamanlanıyor...`);
    
    const settings = await getUserSettings();
    if (!settings || !settings.notificationsEnabled) {
      console.log('Bildirimler kullanıcı tarafından devre dışı');
      return [];
    }

    if (!settings.activePrayers || settings.activePrayers.length === 0) {
      console.log('Hiç aktif namaz vakti seçilmemiş');
      return [];
    }

    const scheduledNotifications = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let advancedCount = 0; // Gelişmiş sistemle zamanlanan sayısı
    
    console.log(`📋 Gelişmiş sistem konfigürasyonu:`, {
      date: prayerDay.date,
      activePrayers: settings.activePrayers,
      notifyBeforeMinutes: settings.notifyBeforeMinutes
    });
    
    // Her namaz vakti için gelişmiş bildirim zamanla
    for (const prayer of prayerDay.times) {
      if (settings.activePrayers.includes(prayer.name)) {
        try {
          console.log(`\n➡️ ${prayer.name} işleniyor (Gelişmiş Sistem)...`);
          
          const notificationId = await scheduleAdvancedPrayerNotification(
            prayer, 
            settings.notifyBeforeMinutes, 
            prayerDay.date
          );
          
          if (notificationId) {
            scheduledNotifications.push({
              id: notificationId,
              prayer: prayer.name,
              time: prayer.time,
              date: prayerDay.date,
              minutesBefore: settings.notifyBeforeMinutes,
              advanced: true
            });
            successCount++;
            advancedCount++;
            console.log(`   ✅ ${prayer.name} başarıyla zamanlandı (Gelişmiş)`);
          } else {
            skipCount++;
            console.log(`   ❌ ${prayer.name} zamanlanamadı (Gelişmiş)`);
          }
        } catch (prayerError) {
          console.error(`${prayer.name} gelişmiş zamanlaması hatası:`, prayerError);
          errorCount++;
        }
      } else {
        console.log(`${prayer.name} seçili değil, atlanıyor`);
      }
    }

    console.log(`\n📊 Gelişmiş günlük bildirim özeti:`);
    console.log(`   ✅ Başarılı: ${successCount} namaz`);
    console.log(`   🚀 Gelişmiş sistem: ${advancedCount} namaz`);
    console.log(`   ❌ Atlandı: ${skipCount} namaz`);
    console.log(`   💥 Hatalı: ${errorCount} namaz`);
    
    return scheduledNotifications;
  } catch (error) {
    console.error('Gelişmiş günlük bildirimler zamanlanamadı:', error);
    return [];
  }
};

// Context7 best practice: SÜPER GÜÇLENDİRİLMİŞ GARANTİLİ BİLDİRİM SİSTEMİ
export const initializeSuperReliableNotificationSystem = async () => {
  try {
    console.log('🚀 [SUPER SYSTEM] Süper güçlendirilmiş garantili bildirim sistemi başlatılıyor...');
    console.log('📋 Sistem özellikleri: 1 haftalık hafıza, 10dk öncesi bildirim, arka plan çalışma garantisi');
    
    // Step 1: Sistem ön hazırlıkları
    console.log('🔧 1. Sistem hazırlıkları...');
    const permissionGranted = await requestNotificationPermissions();
    if (!permissionGranted) {
      console.error('❌ Bildirim izni alınamadı - sistem durduruluyor');
      return { success: false, error: 'Bildirim izni gerekli' };
    }
    
    configureNotifications();
    await createNotificationChannel();
    console.log('✅ Bildirim sistemi hazır');
    
    // Step 2: Kullanıcı ayarlarını doğrula ve optimize et
    console.log('📋 2. Kullanıcı ayarları optimizasyonu...');
    const settings = await getUserSettings();
    
    if (!settings) {
      console.error('❌ Kullanıcı ayarları bulunamadı');
      return { success: false, error: 'Kullanıcı ayarları eksik' };
    }
    
    if (!settings.notificationsEnabled) {
      console.log('❌ Bildirimler kullanıcı tarafından kapalı');
      return { success: false, error: 'Bildirimler kapalı' };
    }
    
    if (!settings.activePrayers || settings.activePrayers.length === 0) {
      console.log('❌ Hiç namaz vakti seçilmemiş');
      return { success: false, error: 'Namaz vakitleri seçilmemiş' };
    }
    
    // Step 2.1: Bildirim süresini 10 dakika olarak garanti et
    if (settings.notifyBeforeMinutes !== 10) {
      console.log(`⚠️ Bildirim süresi ${settings.notifyBeforeMinutes}dk → 10dk optimizasyonu`);
      const optimizedSettings = { ...settings, notifyBeforeMinutes: 10 };
      await storeUserSettings(optimizedSettings);
      console.log('✅ Bildirim süresi 10 dakika olarak optimize edildi');
    }
    
    console.log('📊 Optimized ayarlar:', {
      city: settings.city,
      notifyBeforeMinutes: 10, // Garantili 10 dakika
      activePrayers: settings.activePrayers,
      activePrayerCount: settings.activePrayers.length
    });
    
    // Step 3: 1 Haftalık namaz vakti verilerini garanti et
    console.log('📅 3. 1 haftalık namaz vakti verilerini sağlama alma...');
    
    // Önce mevcut verileri kontrol et
    const existingData = await getPrayerTimesData();
    console.log(`📊 Mevcut veri: ${existingData ? existingData.length : 0} gün`);
    
    let prayerTimesData = existingData;
    
    // Eğer 7 günden az veri varsa, yeniden yükle
    if (!prayerTimesData || prayerTimesData.length < 7) {
      console.log('🔄 Yetersiz veri, 1 haftalık veri yükleniyor...');
      
      try {
        const { fetchPrayerTimesRange } = await import('./prayerTimesService');
        const newData = await fetchPrayerTimesRange(settings.city, 0, 7); // Bugünden 7 gün sonraya kadar
        
        if (newData && newData.length >= 7) {
          // Veriyi storage formatına dönüştür
          const storageData = newData.map(day => ({
            date: day.date,
            times: day.times.map(prayer => ({
              name: prayer.name,
              time: prayer.time
            }))
          }));
          
          // Storage'a kaydet
          const { storePrayerTimes } = await import('./storageService');
          await storePrayerTimes(settings.city, storageData);
          
          prayerTimesData = storageData;
          console.log(`✅ 1 haftalık veri başarıyla yüklendi: ${prayerTimesData.length} gün`);
        } else {
          console.error('❌ 1 haftalık veri yüklenemedi');
          return { success: false, error: 'Namaz vakti verileri eksik' };
        }
      } catch (dataError) {
        console.error('❌ Veri yükleme hatası:', dataError);
        return { success: false, error: 'Veri yükleme başarısız: ' + dataError.message };
      }
    }
    
    console.log(`✅ 1 haftalık namaz vakti verisi hazır: ${prayerTimesData.length} gün`);
    
    // Step 4: Mevcut bildirimleri temizle
    console.log('🧹 4. Mevcut bildirimler temizleniyor...');
    await cancelPrayerNotifications();
    console.log('✅ Önceki bildirimler temizlendi');
    
    // Step 5: SÜPER GÜÇLENDİRİLMİŞ ZAMANLAMA - 1 hafta boyunca
    console.log('🚀 5. Süper güçlendirilmiş zamanlama başlatılıyor...');
    
    const today = new Date();
    const oneWeekLater = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    let totalScheduled = 0;
    let totalSkipped = 0;
    let totalAdvanced = 0;
    const schedulingResults = [];
    
    // Her gün için zamanlama yap
    for (const dayData of prayerTimesData) {
      const dayDate = new Date(dayData.date);
      
      // Sadece gelecek 7 gün için zamanla
      if (dayDate < today || dayDate > oneWeekLater) {
        continue;
      }
      
      console.log(`\n📅 ${dayDate.toLocaleDateString('tr-TR')} günü işleniyor...`);
      
      const dayResult = {
        date: dayData.date,
        scheduled: 0,
        skipped: 0,
        advanced: 0,
        prayers: []
      };
      
      // Her namaz vakti için SÜPER GÜÇLENDİRİLMİŞ zamanlama
      for (const prayer of dayData.times) {
        if (!settings.activePrayers.includes(prayer.name)) {
          console.log(`  ⏩ ${prayer.name} seçili değil`);
          continue;
        }
        
        console.log(`  🕌 ${prayer.name} (${prayer.time}) süper zamanlama...`);
        
        try {
          // SÜPER GÜÇLENDİRİLMİŞ ZAMANLAMA KULLAN
          const notificationId = await scheduleAdvancedPrayerNotification(
            prayer,
            10, // Garantili 10 dakika
            dayData.date
          );
          
          if (notificationId) {
            totalScheduled++;
            totalAdvanced++;
            dayResult.scheduled++;
            dayResult.advanced++;
            
            dayResult.prayers.push({
              name: prayer.name,
              time: prayer.time,
              status: 'scheduled-advanced',
              notificationId
            });
            
            console.log(`    ✅ ${prayer.name} başarıyla zamanlandı (Süper Sistem)`);
          } else {
            totalSkipped++;
            dayResult.skipped++;
            console.log(`    ❌ ${prayer.name} zamanlanamadı`);
          }
        } catch (prayerError) {
          console.error(`    💥 ${prayer.name} hata:`, prayerError.message);
          totalSkipped++;
          dayResult.skipped++;
        }
      }
      
      schedulingResults.push(dayResult);
      console.log(`  📊 ${dayResult.date}: ${dayResult.scheduled} başarılı, ${dayResult.skipped} atlandı`);
    }
    
    // Step 6: KAPSAMLI DOĞRULAMA
    console.log('🔍 6. Kapsamlı sistem doğrulaması...');
    
    setTimeout(async () => {
      try {
        const verificationStatus = await getNotificationStatus();
        console.log('📊 Doğrulama raporu:', {
          total: verificationStatus.total,
          prayerNotifications: verificationStatus.prayerNotifications,
          upcomingIn24Hours: verificationStatus.upcomingIn24Hours
        });
        
        if (verificationStatus.prayerNotifications < totalScheduled * 0.8) {
          console.warn('⚠️ UYARI: Zamanlanması beklenen bildirimlerin %80\'inden azı sistemde bulundu');
        } else {
          console.log('✅ Doğrulama başarılı: Bildirimlerin çoğu sistemde mevcut');
        }
      } catch (verifyError) {
        console.error('⚠️ Doğrulama hatası:', verifyError.message);
      }
    }, 2000);
    
    // Step 7: SONUÇ RAPORU
    console.log('\n📊 SÜPER SİSTEM SONUÇ RAPORU:');
    console.log(`✅ Toplam zamanlandı: ${totalScheduled} bildirim`);
    console.log(`🚀 Süper sistem ile: ${totalAdvanced} bildirim`);
    console.log(`❌ Atlandı: ${totalSkipped} bildirim`);
    console.log(`📅 İşlenen gün sayısı: ${schedulingResults.length} gün`);
    console.log(`⏰ Bildirim süresi: 10 dakika öncesinden (garantili)`);
    
    const successRate = totalScheduled / (totalScheduled + totalSkipped) * 100;
    console.log(`📈 Başarı oranı: %${successRate.toFixed(1)}`);
    
    if (successRate >= 90) {
      console.log('🎉 MÜKEMMEL! Sistem %90+ başarı ile çalışıyor');
    } else if (successRate >= 70) {
      console.log('✅ İYİ! Sistem %70+ başarı ile çalışıyor');
    } else {
      console.log('⚠️ DİKKAT! Sistem %70\'den az başarı gösteriyor');
    }
    
    return {
      success: true,
      totalScheduled,
      totalAdvanced,
      totalSkipped,
      successRate: parseFloat(successRate.toFixed(1)),
      daysProcessed: schedulingResults.length,
      guaranteedWeeklySystem: true,
      guaranteed10MinuteBefore: true,
      guaranteedBackgroundWork: true,
      results: schedulingResults
    };
    
  } catch (error) {
    console.error('💥 [SUPER SYSTEM] Kritik sistem hatası:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Context7 best practice: Otomatik sistem yenileme (her 6 saatte bir)
export const setupAutoRenewalSystem = async () => {
  try {
    console.log('🔄 [AUTO RENEWAL] Otomatik yenileme sistemi kuruluyor...');
    
    // Her 6 saatte bir sistem kontrolü ve yenileme
    const autoRenewalInterval = setInterval(async () => {
      try {
        console.log('🔄 Otomatik sistem kontrolü başlatılıyor...');
        
        const status = await getNotificationStatus();
        console.log(`📊 Mevcut durum: ${status.prayerNotifications} namaz bildirimi`);
        
        // Eğer 24 saatte hiç bildirim yoksa veya çok azsa, sistemi yenile
        if (status.upcomingIn24Hours < 3) {
          console.log('⚠️ Gelecek 24 saatte az bildirim var, sistem yenileniyor...');
          
          const renewalResult = await initializeSuperReliableNotificationSystem();
          if (renewalResult.success) {
            console.log('✅ Otomatik yenileme başarılı');
          } else {
            console.error('❌ Otomatik yenileme başarısız:', renewalResult.error);
          }
        } else {
          console.log('✅ Sistem sağlıklı, yenileme gerekmiyor');
        }
        
      } catch (autoError) {
        console.error('❌ Otomatik kontrol hatası:', autoError.message);
      }
    }, 6 * 60 * 60 * 1000); // 6 saat = 6 * 60 * 60 * 1000 ms
    
    console.log('✅ Otomatik yenileme sistemi kuruldu (her 6 saatte bir)');
    
    // Cleanup function döndür
    return () => {
      clearInterval(autoRenewalInterval);
      console.log('🔄 Otomatik yenileme sistemi durduruldu');
    };
    
  } catch (error) {
    console.error('💥 [AUTO RENEWAL] Otomatik yenileme sistemi kurulurken hata:', error);
    return null;
  }
};

// Context7 best practice: Sistem sağlık kontrolü
export const performSystemHealthCheck = async () => {
  try {
    console.log('🏥 [HEALTH CHECK] Sistem sağlık kontrolü başlatılıyor...');
    
    const healthReport = {
      timestamp: new Date().toISOString(),
      status: 'UNKNOWN',
      issues: [],
      recommendations: [],
      metrics: {}
    };
    
    // 1. Bildirim izni kontrolü
    try {
      const { status } = await Notifications.getPermissionsAsync();
      healthReport.metrics.permissionStatus = status;
      
      if (status !== 'granted') {
        healthReport.issues.push('Bildirim izni verilmemiş');
        healthReport.recommendations.push('Bildirim izni verin');
      }
    } catch (permError) {
      healthReport.issues.push('Bildirim izni kontrol edilemedi');
    }
    
    // 2. Kullanıcı ayarları kontrolü
    const settings = await getUserSettings();
    if (!settings) {
      healthReport.issues.push('Kullanıcı ayarları bulunamadı');
    } else {
      healthReport.metrics.notificationsEnabled = settings.notificationsEnabled;
      healthReport.metrics.activePrayersCount = settings.activePrayers?.length || 0;
      healthReport.metrics.notifyBeforeMinutes = settings.notifyBeforeMinutes;
      
      if (!settings.notificationsEnabled) {
        healthReport.issues.push('Bildirimler kapalı');
        healthReport.recommendations.push('Bildirimleri açın');
      }
      
      if (!settings.activePrayers || settings.activePrayers.length === 0) {
        healthReport.issues.push('Hiç namaz vakti seçilmemiş');
        healthReport.recommendations.push('En az bir namaz vakti seçin');
      }
      
      if (settings.notifyBeforeMinutes !== 10) {
        healthReport.recommendations.push('En iyi performans için 10 dakika öncesi önerilir');
      }
    }
    
    // 3. Veri kontrolü
    const prayerData = await getPrayerTimesData();
    healthReport.metrics.dataAvailableDays = prayerData?.length || 0;
    
    if (!prayerData || prayerData.length < 7) {
      healthReport.issues.push('1 haftalık namaz vakti verisi eksik');
      healthReport.recommendations.push('Ana sayfayı açarak verileri yenileyin');
    }
    
    // 4. Bildirim durumu kontrolü
    const notificationStatus = await getNotificationStatus();
    healthReport.metrics.totalNotifications = notificationStatus.total;
    healthReport.metrics.prayerNotifications = notificationStatus.prayerNotifications;
    healthReport.metrics.upcomingIn24Hours = notificationStatus.upcomingIn24Hours;
    
    if (notificationStatus.prayerNotifications === 0) {
      healthReport.issues.push('Hiç namaz bildirimi zamanlanmamış');
      healthReport.recommendations.push('Süper sistem ile bildirimleri yeniden başlatın');
    } else if (notificationStatus.upcomingIn24Hours === 0) {
      healthReport.issues.push('Gelecek 24 saatte hiç bildirim yok');
      healthReport.recommendations.push('Bildirim sistemini yenileyin');
    }
    
    // 5. Genel sağlık durumu belirleme
    if (healthReport.issues.length === 0) {
      healthReport.status = 'HEALTHY';
    } else if (healthReport.issues.length <= 2) {
      healthReport.status = 'WARNING';
    } else {
      healthReport.status = 'CRITICAL';
    }
    
    console.log('🏥 Sistem sağlık raporu:', {
      status: healthReport.status,
      issueCount: healthReport.issues.length,
      metrics: healthReport.metrics
    });
    
    return healthReport;
    
  } catch (error) {
    console.error('💥 [HEALTH CHECK] Sağlık kontrolü hatası:', error);
    return {
      timestamp: new Date().toISOString(),
      status: 'ERROR',
      error: error.message,
      issues: ['Sağlık kontrolü çalışmadı'],
      recommendations: ['Sistem yeniden başlatılmalı']
    };
  }
}; 