import * as Notifications from 'expo-notifications';
import { getUserSettings, getPrayerTimesData } from './storageService';
import { createNotificationChannel } from './notificationService';
import { Platform } from 'react-native';

// Scheduled notifications için identifier - Context7 best practice
export const PRAYER_NOTIFICATION_IDENTIFIER = 'prayer-notification';
export const PRAYER_NOTIFICATION_CHANNEL = 'ezan-vakitleri';

// Context7 best practice: Notification channel ve identifier'ı düzgün kurulduğundan emin ol - geliştirildi
const ensureNotificationChannelAndHandler = async () => {
  try {
    console.log('🔧 Notification channel ve handler kurulumu başlıyor...');
    
    // Step 1: Permission kontrolü
    console.log('📋 1. Bildirim izinleri kontrol ediliyor...');
    const { requestNotificationPermissions } = await import('./notificationService');
    const permissionGranted = await requestNotificationPermissions();
    
    if (!permissionGranted) {
      console.log('❌ Bildirim izni reddedildi');
      return false;
    }
    console.log('✅ Bildirim izinleri OK');
    
    // Step 2: Notification handler kurulumu
    console.log('📋 2. Notification handler kuruluyor...');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    console.log('✅ Notification handler kuruldu');

    // Step 3: Android notification channel oluştur
    console.log('📋 3. Android notification channel oluşturuluyor...');
    await createNotificationChannel();
    console.log('✅ Notification channel oluşturuldu');
    
    // Step 4: Context7 best practice - Channel'ın gerçekten oluştuğunu doğrula
    if (Platform.OS === 'android') {
      console.log('📋 4. Android channel doğrulanıyor...');
      const channels = await Notifications.getNotificationChannelsAsync();
      const ourChannel = channels.find(ch => ch.id === PRAYER_NOTIFICATION_CHANNEL);
      
      if (ourChannel) {
        console.log('✅ Channel doğrulandı:', {
          id: ourChannel.id,
          name: ourChannel.name,
          importance: ourChannel.importance
        });
      } else {
        console.log('⚠️ Channel bulunamadı, tekrar deneniyor...');
        await createNotificationChannel();
        
        // İkinci deneme
        const channelsRetry = await Notifications.getNotificationChannelsAsync();
        const ourChannelRetry = channelsRetry.find(ch => ch.id === PRAYER_NOTIFICATION_CHANNEL);
        
        if (!ourChannelRetry) {
          console.log('❌ KRITIK: Channel oluşturulamadı!');
          return false;
        }
        console.log('✅ Channel ikinci denemede oluşturuldu');
      }
    }
    
    console.log('🎉 Notification channel ve handler başarıyla kuruldu');
    return true;
  } catch (error) {
    console.error('💥 Notification channel kurulumunda kritik hata:', error);
    return false;
  }
};

// Context7 best practice: Gerçek zamanlı namaz vakti bildirimi - Debug geliştirmesi
const scheduleRealTimePrayerNotifications = async () => {
  try {
    console.log('🔥 Gerçek zamanlı namaz bildirimleri zamanlaması başlıyor...');
    
    // Kullanıcı ayarlarını al
    const settings = await getUserSettings();
    if (!settings || !settings.notificationsEnabled) {
      console.log('❌ Bildirimler devre dışı');
      return false;
    }

    console.log('✅ Ayarlar doğrulandı:', {
      notificationsEnabled: settings.notificationsEnabled,
      notifyBeforeMinutes: settings.notifyBeforeMinutes,
      activePrayers: settings.activePrayers,
      city: settings.city
    });

    // Notification channel ve handler'ı kur
    const channelReady = await ensureNotificationChannelAndHandler();
    if (!channelReady) {
      console.error('❌ Notification channel kurulamadı');
      return false;
    }

    // Namaz vakitlerini al
    const prayerTimesData = await getPrayerTimesData();
    if (!prayerTimesData || prayerTimesData.length === 0) {
      console.log('❌ Namaz vakti verisi bulunamadı');
      return false;
    }

    console.log(`✅ ${prayerTimesData.length} günlük namaz vakitleri hazır`);

    // Context7 best practice: Sadece gelecek 7 günlük bildirimleri zamanla
    const today = new Date();
    const sevenDaysLater = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    console.log(`📅 Zaman aralığı: ${today.toLocaleDateString('tr-TR')} - ${sevenDaysLater.toLocaleDateString('tr-TR')}`);
    
    let scheduledCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const dayData of prayerTimesData) {
      const dayDate = new Date(dayData.date);
      
      // Sadece gelecek 7 gün için zamanla
      if (dayDate < today || dayDate > sevenDaysLater) {
        console.log(`⏭️ ${dayDate.toLocaleDateString('tr-TR')} tarih aralığı dışında, atlanıyor`);
        continue;
      }
      
      console.log(`📅 ${dayDate.toLocaleDateString('tr-TR')} için bildirimleri zamanlanıyor...`);
      
      // Her namaz vakti için bildirim zamanla
      for (const prayer of dayData.times) {
        // Kullanıcının aktif ettiği namaz vakitlerini kontrol et
        if (!settings.activePrayers.includes(prayer.name)) {
          console.log(`  ⏩ ${prayer.name} namaz vakti seçili değil, atlanıyor`);
          continue;
        }
        
        try {
          // Namaz vaktini tarih olarak hesapla
          const [hour, minute] = prayer.time.split(':').map(Number);
          const prayerDateTime = new Date(dayDate);
          prayerDateTime.setHours(hour, minute, 0, 0);
          
          // Bildirim zamanını hesapla (namaz vaktinden X dakika önce)
          const notificationTime = new Date(prayerDateTime.getTime() - (settings.notifyBeforeMinutes * 60 * 1000));
          
          // Geçmiş zaman kontrolü
          if (notificationTime <= new Date()) {
            console.log(`  ⌚ ${prayer.name} bildirimi geçmiş zamanda (${notificationTime.toLocaleString('tr-TR')}), atlanıyor`);
            skippedCount++;
            continue;
          }
          
          console.log(`  🕐 ${prayer.name} için bildirim zamanlanıyor: ${notificationTime.toLocaleString('tr-TR')}`);
          
          // Context7 best practice: Doğru channelId ve categoryIdentifier kullan + trigger type eklendi
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `${prayer.name} Namazı Yaklaşıyor`,
              body: `${prayer.name} namazına ${settings.notifyBeforeMinutes} dakika kaldı (${prayer.time})`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              categoryIdentifier: PRAYER_NOTIFICATION_IDENTIFIER,
              data: {
                prayerName: prayer.name,
                prayerTime: prayer.time,
                date: dayData.date,
                notifyBefore: settings.notifyBeforeMinutes,
                notificationType: 'prayer-reminder'
              }
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE, // Context7 fix: eksik type eklendi
              date: notificationTime,
              channelId: PRAYER_NOTIFICATION_CHANNEL // Context7 best practice: Android için channelId
            }
          });
          
          scheduledCount++;
          console.log(`  ✅ ${prayer.name} bildirimi başarıyla zamanlandı (ID: ${notificationId})`);
          
        } catch (prayerError) {
          errorCount++;
          console.error(`  ❌ ${prayer.name} bildirimi zamanlanırken hata:`, prayerError);
          console.error('  📋 Hata detayları:', {
            prayerName: prayer.name,
            prayerTime: prayer.time,
            date: dayData.date,
            errorMessage: prayerError.message
          });
        }
      }
    }
    
    console.log('📊 Final Bildirim İstatistikleri:');
    console.log(`   ✅ Başarıyla zamanlandı: ${scheduledCount} adet`);
    console.log(`   ⏭️ Atlandı (geçmiş zaman): ${skippedCount} adet`);
    console.log(`   ❌ Hata ile başarısız: ${errorCount} adet`);
    console.log(`   📱 Toplam işlenen: ${scheduledCount + skippedCount + errorCount} adet`);
    
    // Context7 best practice: Hemen sonuç kontrol et
    if (scheduledCount > 0) {
      console.log('🔍 Zamanlanmış bildirimleri hemen kontrol ediliyor...');
      setTimeout(async () => {
        const currentNotifications = await Notifications.getAllScheduledNotificationsAsync();
        console.log(`📊 Sistem genelinde toplam zamanlanmış bildirim: ${currentNotifications.length} adet`);
        
        const prayerNotifs = currentNotifications.filter(n => 
          n.content.categoryIdentifier === PRAYER_NOTIFICATION_IDENTIFIER ||
          n.content.data?.notificationType === 'prayer-reminder'
        );
        console.log(`🕌 Bunların ${prayerNotifs.length} adedi namaz bildirimi`);
      }, 1000);
    }
    
    return scheduledCount > 0;
    
  } catch (error) {
    console.error('💥 KRITIK HATA: Namaz bildirimleri zamanlanırken hata:', error);
    return false;
  }
};

// Tüm namaz bildirimlerini iptal et - Context7 best practice ile düzeltildi
export const cancelAllPrayerNotifications = async () => {
  try {
    // Tüm zamanlanmış bildirimleri al
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    console.log(`📊 Tüm zamanlanmış bildirimler: ${scheduledNotifications.length} adet`);
    
    // Debug: Tüm bildirimlerin categoryIdentifier'larını logla
    if (scheduledNotifications.length > 0) {
      console.log('🔍 Bildirim analizi:');
      scheduledNotifications.forEach((notif, index) => {
        console.log(`${index + 1}. Title: "${notif.content.title}" | Category: "${notif.content.categoryIdentifier}" | Data: ${JSON.stringify(notif.content.data)}`);
      });
    }
    
    // Prayer notification'ları filtrele - Context7 best practice
    const prayerNotifications = scheduledNotifications.filter(notification => {
      // Hem categoryIdentifier hem de data.notificationType kontrolü yap
      const hasCorrectCategory = notification.content.categoryIdentifier === PRAYER_NOTIFICATION_IDENTIFIER;
      const hasCorrectType = notification.content.data?.notificationType === 'prayer-reminder';
      const hasPrayerData = notification.content.data?.prayerName;
      
      return hasCorrectCategory || hasCorrectType || hasPrayerData;
    });
    
    console.log(`🕌 Namaz bildirimleri filtresi: ${prayerNotifications.length} adet bulundu`);
    
    for (const notification of prayerNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      console.log(`❌ İptal edildi: ${notification.content.title}`);
    }
    
    console.log('✅ Tüm namaz bildirimleri iptal edildi');
    return true;
  } catch (error) {
    console.error('Namaz bildirimleri iptal edilirken hata:', error);
    return false;
  }
};

// Bildirim sistemini başlat - Context7 best practice ile debug eklendi
export const initializePrayerNotifications = async () => {
  try {
    console.log('🚀 Namaz bildirim sistemi başlatılıyor...');
    
    // Step 1: Kullanıcı ayarlarını kontrol et
    console.log('📋 1. Kullanıcı ayarları kontrol ediliyor...');
    const settings = await getUserSettings();
    
    if (!settings) {
      console.log('❌ HATA: Kullanıcı ayarları bulunamadı');
      return false;
    }
    
    console.log('✅ Kullanıcı ayarları yüklendi:', {
      notificationsEnabled: settings.notificationsEnabled,
      notifyBeforeMinutes: settings.notifyBeforeMinutes,
      activePrayers: settings.activePrayers,
      city: settings.city
    });
    
    if (!settings.notificationsEnabled) {
      console.log('❌ Bildirimler kullanıcı tarafından devre dışı bırakılmış');
      return false;
    }
    
    if (!settings.activePrayers || settings.activePrayers.length === 0) {
      console.log('❌ Hiç aktif namaz vakti seçilmemiş');
      return false;
    }
    
    // Step 2: Namaz vakti verilerini kontrol et
    console.log('📋 2. Namaz vakti verileri kontrol ediliyor...');
    const prayerTimesData = await getPrayerTimesData();
    
    if (!prayerTimesData || prayerTimesData.length === 0) {
      console.log('❌ HATA: Namaz vakti verisi bulunamadı');
      return false;
    }
    
    console.log(`✅ ${prayerTimesData.length} günlük namaz vakitleri bulundu`);
    
    // Step 3: Mevcut bildirimleri temizle
    console.log('📋 3. Mevcut namaz bildirimleri temizleniyor...');
    await cancelAllPrayerNotifications();
    
    // Step 4: Notification channel ve handler kurulumu
    console.log('📋 4. Notification channel ve handler kuruluyor...');
    const channelReady = await ensureNotificationChannelAndHandler();
    if (!channelReady) {
      console.log('❌ HATA: Notification channel kurulamadı');
      return false;
    }
    
    // Step 5: Yeni bildirimleri zamanla
    console.log('📋 5. Yeni namaz bildirimleri zamanlanıyor...');
    const success = await scheduleRealTimePrayerNotifications();
    
    // Step 6: Sonuç kontrolü
    console.log('📋 6. Sonuç kontrol ediliyor...');
    if (success) {
      console.log('✅ Namaz bildirim sistemi başarıyla başlatıldı');
      
      // Context7 best practice: Hemen durum kontrolü yap
      setTimeout(async () => {
        console.log('🔍 Sistem durumu 2 saniye sonra kontrol ediliyor...');
        const status = await checkPrayerNotificationStatus();
        console.log('📊 Anlık durum:', {
          scheduledCount: status.scheduledCount,
          totalScheduled: status.totalScheduled,
          isActive: status.isActive
        });
      }, 2000);
      
    } else {
      console.log('❌ Namaz bildirim sistemi başlatılamadı - bildirim zamanlanamadı');
    }
    
    return success;
  } catch (error) {
    console.error('💥 KRITIK HATA: Namaz bildirim sistemi başlatılırken hata:', error);
    return false;
  }
};

// Namaz bildirimlerini durdur
export const stopPrayerNotifications = async () => {
  try {
    console.log('Namaz bildirimleri durduruluyor...');
    await cancelAllPrayerNotifications();
    console.log('Namaz bildirimleri durduruldu');
    return true;
  } catch (error) {
    console.error('Namaz bildirimleri durdurulurken hata:', error);
    return false;
  }
};

// Bildirim durumunu kontrol et - Context7 best practice ile tamamen yenilendi
export const checkPrayerNotificationStatus = async () => {
  try {
    console.log('🔍 Bildirim durumu detaylı analizi başlıyor...');
    
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    console.log(`📊 Toplam zamanlanmış bildirim sayısı: ${scheduledNotifications.length}`);
    
    // Context7 best practice: Detaylı debug analizi
    if (scheduledNotifications.length > 0) {
      console.log('🔍 Zamanlanmış bildirimlerin detayları:');
      scheduledNotifications.forEach((notif, index) => {
        const category = notif.content.categoryIdentifier || 'YOK';
        const notifType = notif.content.data?.notificationType || 'YOK';
        const prayerName = notif.content.data?.prayerName || 'YOK';
        
        console.log(`${index + 1}. "${notif.content.title}"`);
        console.log(`   Category: "${category}"`);
        console.log(`   Type: "${notifType}"`);
        console.log(`   Prayer: "${prayerName}"`);
        console.log(`   Trigger: ${notif.trigger?.date ? new Date(notif.trigger.date).toLocaleString('tr-TR') : 'YOK'}`);
        console.log('---');
      });
    }
    
    // Context7 best practice: Çoklu filtreleme stratejisi
    const prayerNotifications = scheduledNotifications.filter(notification => {
      const hasCorrectCategory = notification.content.categoryIdentifier === PRAYER_NOTIFICATION_IDENTIFIER;
      const hasCorrectType = notification.content.data?.notificationType === 'prayer-reminder';
      const hasPrayerData = notification.content.data?.prayerName;
      const hasPrayerInTitle = notification.content.title && (
        notification.content.title.includes('Namaz') || 
        notification.content.title.includes('Ezan') ||
        notification.content.title.includes('İmsak') ||
        notification.content.title.includes('Güneş') ||
        notification.content.title.includes('Öğle') ||
        notification.content.title.includes('İkindi') ||
        notification.content.title.includes('Akşam') ||
        notification.content.title.includes('Yatsı')
      );
      
      const isMatching = hasCorrectCategory || hasCorrectType || hasPrayerData || hasPrayerInTitle;
      
      if (isMatching) {
        console.log(`✅ Namaz bildirimi bulundu: "${notification.content.title}"`);
        console.log(`   Kriterler: Category=${hasCorrectCategory}, Type=${hasCorrectType}, Data=${hasPrayerData}, Title=${hasPrayerInTitle}`);
      }
      
      return isMatching;
    });
    
    console.log(`🕌 Toplam namaz bildirimi sayısı: ${prayerNotifications.length}`);
    
    // Context7 best practice: Namaz bildirimlerini analiz et
    if (prayerNotifications.length > 0) {
      console.log('📋 Bulunan namaz bildirimleri:');
      prayerNotifications.slice(0, 5).forEach((notif, index) => {
        const triggerDate = notif.trigger?.date ? new Date(notif.trigger.date) : null;
        const timeStr = triggerDate ? triggerDate.toLocaleString('tr-TR') : 'Belirsiz';
        console.log(`${index + 1}. ${notif.content.title} → ${timeStr}`);
      });
      
      if (prayerNotifications.length > 5) {
        console.log(`... ve ${prayerNotifications.length - 5} adet daha`);
      }
    } else {
      console.log('❌ Hiç namaz bildirimi bulunamadı!');
      
      // Context7 best practice: Sorun teşhisi
      if (scheduledNotifications.length > 0) {
        console.log('⚠️ Bildirimler var ama namaz bildirimi değil. İlk 3 örnek:');
        scheduledNotifications.slice(0, 3).forEach((notif, index) => {
          console.log(`${index + 1}. "${notif.content.title}" (Category: "${notif.content.categoryIdentifier || 'YOK'}")`);
        });
      } else {
        console.log('💡 Hiç bildirim zamanlanmamış. Sistemi yeniden başlatmayı deneyin.');
      }
    }
    
    return {
      isActive: prayerNotifications.length > 0,
      scheduledCount: prayerNotifications.length,
      totalScheduled: scheduledNotifications.length,
      notifications: prayerNotifications.map(n => ({
        identifier: n.identifier,
        title: n.content.title,
        body: n.content.body,
        trigger: n.trigger,
        categoryIdentifier: n.content.categoryIdentifier,
        data: n.content.data
      }))
    };
  } catch (error) {
    console.error('❌ Bildirim durumu kontrol edilirken hata:', error);
    return {
      isActive: false,
      scheduledCount: 0,
      totalScheduled: 0,
      notifications: [],
      error: error.message
    };
  }
};

// Test amaçlı namaz bildirimi gönder - Context7 best practice ile geliştirildi
export const triggerTestPrayerNotification = async () => {
  try {
    console.log('🧪 Test namaz bildirimleri hazırlanıyor...');
    
    const settings = await getUserSettings();
    
    // Notification channel ve handler'ı kur
    await ensureNotificationChannelAndHandler();
    
    // 2 saniye sonra bir test bildirimi
    const testNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🧪 Test: Namaz Vakti Yaklaşıyor",
        body: `Bu bir test bildirimidir. Gerçek bildirimler namaz vaktinden ${settings?.notifyBeforeMinutes || 10} dakika önce gelir.`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: PRAYER_NOTIFICATION_IDENTIFIER,
        data: {
          isTest: true,
          testTime: new Date().toISOString(),
          prayerName: 'Test Namazı',
          notifyBefore: settings?.notifyBeforeMinutes || 10,
          notificationType: 'prayer-reminder'
        }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, // Context7 fix
        seconds: 2,
        channelId: PRAYER_NOTIFICATION_CHANNEL // Context7 best practice
      }
    });
    
    // 30 saniye sonra bir "gerçek zamanlı" test bildirimi
    const realtimeTestId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "⏰ Test: Öğle Namazı Yaklaşıyor", 
        body: `Öğle namazına ${settings?.notifyBeforeMinutes || 10} dakika kaldı (12:30)`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        categoryIdentifier: PRAYER_NOTIFICATION_IDENTIFIER,
        data: {
          isTest: true,
          testTime: new Date().toISOString(),
          prayerName: 'Öğle',
          prayerTime: '12:30',
          notifyBefore: settings?.notifyBeforeMinutes || 10,
          notificationType: 'prayer-reminder'
        }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, // Context7 fix
        seconds: 30,
        channelId: PRAYER_NOTIFICATION_CHANNEL // Context7 best practice
      }
    });
    
    console.log('✅ Test namaz bildirimleri başarıyla zamanlandı:', { testNotificationId, realtimeTestId });
    console.log('📅 Zamanlar: İlk bildirim 2 saniye, ikinci bildirim 30 saniye içinde gelecek');
    
    return true;
  } catch (error) {
    console.error('❌ Test namaz bildirimi gönderilirken hata:', error);
    return false;
  }
};

// Backward compatibility - eski fonksiyonları yeni sisteme yönlendir
export const defineBackgroundTask = () => {
  console.log('Background task yerine scheduled notifications kullanılıyor');
};

export const registerBackgroundTask = async () => {
  return await initializePrayerNotifications();
};

export const unregisterBackgroundTask = async () => {
  return await stopPrayerNotifications();
};

export const checkBackgroundTask = async () => {
  const status = await checkPrayerNotificationStatus();
  return {
    isRegistered: status.isActive,
    status: status.isActive ? 'active' : 'inactive',
    statusText: status.isActive ? `${status.scheduledCount} bildirim zamanlanmış` : 'Hiç bildirim yok'
  };
}; 