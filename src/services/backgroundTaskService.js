import * as Notifications from 'expo-notifications';
import { getUserSettings, getPrayerTimesData } from './storageService';
import { 
  createNotificationChannel, 
  requestNotificationPermissions,
  configureNotifications,
  PRAYER_NOTIFICATION_CHANNEL,
  PRAYER_CATEGORY_ID,
  cancelPrayerNotifications,
  getNotificationStatus 
} from './notificationService';
import { Platform } from 'react-native';

// Context7 best practice: Güvenilir bildirim sistemi sabitleri
export const PRAYER_NOTIFICATION_IDENTIFIER = PRAYER_CATEGORY_ID;
export { PRAYER_NOTIFICATION_CHANNEL };

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

// Context7 best practice: Süper güvenilir namaz vakti bildirimi sistemi
const scheduleRealTimePrayerNotifications = async () => {
  try {
    console.log('🚀 [CONTEXT7] Süper güvenilir namaz bildirimi sistemi başlatılıyor...');
    
    // Step 1: Kullanıcı ayarlarını doğrula
    const settings = await getUserSettings();
    if (!settings || !settings.notificationsEnabled) {
      console.log('❌ Bildirimler kullanıcı tarafından devre dışı');
      return false;
    }

    if (!settings.activePrayers || settings.activePrayers.length === 0) {
      console.log('❌ Hiç aktif namaz vakti seçilmemiş');
      return false;
    }

    console.log('✅ Kullanıcı ayarları doğrulandı:', {
      notificationsEnabled: settings.notificationsEnabled,
      notifyBeforeMinutes: settings.notifyBeforeMinutes,
      activePrayers: settings.activePrayers,
      city: settings.city
    });

    // Step 2: Sistem hazırlıkları
    console.log('🔧 Bildirim sistemi hazırlanıyor...');
    const channelReady = await ensureNotificationChannelAndHandler();
    if (!channelReady) {
      console.error('❌ Bildirim sistemi hazırlanamadı');
      return false;
    }

    // Step 3: Namaz vakti verilerini al
    const prayerTimesData = await getPrayerTimesData();
    if (!prayerTimesData || prayerTimesData.length === 0) {
      console.log('❌ Namaz vakti verisi bulunamadı');
      return false;
    }

    console.log(`✅ ${prayerTimesData.length} günlük namaz vakitleri yüklendi`);

    // Step 4: Context7 best practice - Gelecek 10 günlük bildirimleri zamanla (7 yerine 10)
    const now = new Date();
    const tenDaysLater = new Date(now.getTime() + (10 * 24 * 60 * 60 * 1000));
    
    console.log(`📅 Hedef zaman aralığı: ${now.toLocaleDateString('tr-TR')} - ${tenDaysLater.toLocaleDateString('tr-TR')}`);
    
    let totalScheduled = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const schedulingResults = [];
    
    // Step 5: Günler ve namaz vakitleri için zamanla
    for (const dayData of prayerTimesData) {
      const dayDate = new Date(dayData.date);
      
      // Sadece gelecek 10 gün için işle
      if (dayDate < now || dayDate > tenDaysLater) {
        continue;
      }
      
      const dayResult = {
        date: dayDate.toLocaleDateString('tr-TR'),
        scheduled: 0,
        skipped: 0,
        errors: 0,
        prayers: []
      };
      
      console.log(`📅 ${dayResult.date} günü işleniyor...`);
      
      // Her namaz vakti için
      for (const prayer of dayData.times) {
        const prayerResult = {
          name: prayer.name,
          time: prayer.time,
          status: 'unknown'
        };
        
        // Kullanıcının seçtiği namaz vakitleri kontrolü
        if (!settings.activePrayers.includes(prayer.name)) {
          prayerResult.status = 'not-selected';
          console.log(`  ⏩ ${prayer.name} seçili değil`);
          continue;
        }
        
        try {
          // Namaz vakti tarih/saat hesaplama
          const [hour, minute] = prayer.time.split(':').map(Number);
          const prayerDateTime = new Date(dayDate);
          prayerDateTime.setHours(hour, minute, 0, 0);
          
          // Bildirim zamanını hesapla
          const notificationTime = new Date(prayerDateTime.getTime() - (settings.notifyBeforeMinutes * 60 * 1000));
          
          // Geçmiş zaman kontrolü
          if (notificationTime <= now) {
            prayerResult.status = 'past-time';
            totalSkipped++;
            dayResult.skipped++;
            console.log(`  ⌚ ${prayer.name} geçmiş zamanda, atlanıyor`);
            continue;
          }
          
          console.log(`  🕐 ${prayer.name} zamanlanıyor: ${notificationTime.toLocaleString('tr-TR')}`);
          
          // Context7 best practice: Platform'a özel optimizasyon
          const notificationConfig = {
            content: {
              title: `🕌 ${prayer.name} Namazı Yaklaşıyor`,
              body: `${prayer.name} namazına ${settings.notifyBeforeMinutes} dakika kaldı (${prayer.time})`,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              categoryIdentifier: PRAYER_NOTIFICATION_IDENTIFIER,
              sticky: false,
              autoDismiss: true,
              data: {
                prayerName: prayer.name,
                prayerTime: prayer.time,
                date: dayData.date,
                notifyBeforeMinutes: settings.notifyBeforeMinutes,
                notificationType: 'prayer-reminder',
                scheduledAt: new Date().toISOString(),
                triggerTime: notificationTime.toISOString(),
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
          
          // Bildirimi zamanla
          const notificationId = await Notifications.scheduleNotificationAsync(notificationConfig);
          
          prayerResult.status = 'scheduled';
          prayerResult.notificationId = notificationId;
          prayerResult.triggerTime = notificationTime.toLocaleString('tr-TR');
          
          totalScheduled++;
          dayResult.scheduled++;
          
          console.log(`  ✅ ${prayer.name} başarıyla zamanlandı (ID: ${notificationId})`);
          
          // Context7: Immediate verification
          setTimeout(async () => {
            try {
              const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
              const found = allNotifications.find(n => n.identifier === notificationId);
              if (!found) {
                console.error(`  ⚠️ ${prayer.name} bildirimi sistemde doğrulanamadı!`);
              }
            } catch (verifyError) {
              console.error(`  ⚠️ ${prayer.name} doğrulama hatası:`, verifyError.message);
            }
          }, 200);
          
        } catch (prayerError) {
          prayerResult.status = 'error';
          prayerResult.error = prayerError.message;
          totalErrors++;
          dayResult.errors++;
          
          console.error(`  ❌ ${prayer.name} zamanlanamadı:`, prayerError.message);
        }
        
        dayResult.prayers.push(prayerResult);
      }
      
      schedulingResults.push(dayResult);
      console.log(`  📊 ${dayResult.date} özeti: ${dayResult.scheduled} zamanlandı, ${dayResult.skipped} atlandı, ${dayResult.errors} hata`);
    }
    
    // Final rapor
    console.log('📊 [CONTEXT7] Final Bildirim Raporu:');
    console.log(`   ✅ Toplam zamanlandı: ${totalScheduled} adet`);
    console.log(`   ⏭️ Toplam atlandı: ${totalSkipped} adet`);
    console.log(`   ❌ Toplam hata: ${totalErrors} adet`);
    console.log(`   📱 Toplam işlem: ${totalScheduled + totalSkipped + totalErrors} adet`);
    
    // Context7 best practice: Sistem durumu kontrolü
    if (totalScheduled > 0) {
      setTimeout(async () => {
        console.log('🔍 Sistem doğrulaması yapılıyor...');
        const status = await getNotificationStatus();
        console.log(`📊 Sistem durumu: ${status.prayerNotifications}/${totalScheduled} bildirim doğrulandı`);
        
        if (status.prayerNotifications < totalScheduled) {
          console.warn(`⚠️ Zamanlamanın ${totalScheduled - status.prayerNotifications} adedi eksik!`);
        }
      }, 1000);
    }
    
    return totalScheduled > 0;
    
  } catch (error) {
    console.error('💥 [CONTEXT7] KRITIK HATA: Namaz bildirimi sistemi başarısız:', error);
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

// Context7 best practice: Süper güvenilir namaz bildirim sistemi başlatması
export const initializePrayerNotifications = async () => {
  try {
    console.log('🚀 [CONTEXT7] Süper güvenilir namaz bildirim sistemi başlatılıyor...');
    
    // Step 1: Sistem izinleri ve hazırlık
    console.log('🔧 1. Sistem izinleri kontrol ediliyor...');
    const permissionGranted = await requestNotificationPermissions();
    if (!permissionGranted) {
      console.error('❌ Bildirim izni alınamadı');
      return false;
    }
    
    // Step 2: Notification system setup
    console.log('🔧 2. Bildirim sistemi hazırlanıyor...');
    configureNotifications();
    await createNotificationChannel();
    
    // Step 3: Kullanıcı ayarlarını doğrula
    console.log('📋 3. Kullanıcı ayarları kontrol ediliyor...');
    const settings = await getUserSettings();
    
    if (!settings) {
      console.error('❌ Kullanıcı ayarları bulunamadı');
      return false;
    }
    
    console.log('✅ Kullanıcı ayarları yüklendi:', {
      notificationsEnabled: settings.notificationsEnabled,
      notifyBeforeMinutes: settings.notifyBeforeMinutes,
      activePrayers: settings.activePrayers?.length || 0,
      city: settings.city
    });
    
    if (!settings.notificationsEnabled) {
      console.log('❌ Bildirimler kullanıcı tarafından devre dışı');
      return false;
    }
    
    if (!settings.activePrayers || settings.activePrayers.length === 0) {
      console.error('❌ Hiç aktif namaz vakti seçilmemiş');
      return false;
    }
    
    // Step 4: Namaz vakti verilerini kontrol et
    console.log('📋 4. Namaz vakti verileri kontrol ediliyor...');
    const prayerTimesData = await getPrayerTimesData();
    
    if (!prayerTimesData || prayerTimesData.length === 0) {
      console.error('❌ Namaz vakti verisi bulunamadı');
      return false;
    }
    
    console.log(`✅ ${prayerTimesData.length} günlük namaz vakitleri bulundu`);
    
    // Step 5: Context7 best practice - Mevcut bildirimleri temizle (sadece namaz bildirimleri)
    console.log('🧹 5. Mevcut namaz bildirimleri temizleniyor...');
    const cleanupSuccess = await cancelPrayerNotifications();
    if (!cleanupSuccess) {
      console.warn('⚠️ Önceki bildirimler tamamen temizlenemedi, devam ediliyor...');
    }
    
    // Step 6: Context7 - Sistem durumu pre-check
    console.log('🔍 6. Sistem ön kontrolü yapılıyor...');
    const preStatus = await getNotificationStatus();
    console.log(`📊 Ön durum: ${preStatus.total} toplam, ${preStatus.prayerNotifications} namaz bildirimi`);
    
    // Step 7: Yeni bildirimleri zamanla
    console.log('🚀 7. Yeni namaz bildirimleri zamanlanıyor...');
    const success = await scheduleRealTimePrayerNotifications();
    
    // Step 8: Context7 best practice - Comprehensive final verification
    console.log('🔍 8. Kapsamlı doğrulama yapılıyor...');
    if (success) {
      console.log('✅ Namaz bildirim sistemi başarıyla başlatıldı');
      
      // Context7: Immediate verification (500ms sonra)
      setTimeout(async () => {
        try {
          console.log('🔍 Hızlı doğrulama (500ms sonra)...');
          const quickStatus = await getNotificationStatus();
          console.log(`📊 Hızlı durum: ${quickStatus.prayerNotifications} namaz bildirimi aktif`);
          
          if (quickStatus.prayerNotifications === 0) {
            console.error('⚠️ UYARI: Bildirimi zamanlandı ama sistem bulamıyor!');
          }
        } catch (quickError) {
          console.error('⚠️ Hızlı doğrulama hatası:', quickError.message);
        }
      }, 500);
      
      // Context7: Extended verification (3 seconds later)
      setTimeout(async () => {
        try {
          console.log('🔍 Detaylı doğrulama (3 saniye sonra)...');
          const detailedStatus = await getNotificationStatus();
          
          console.log('📊 Detaylı sistem durumu:', {
            totalNotifications: detailedStatus.total,
            prayerNotifications: detailedStatus.prayerNotifications,
            upcomingIn24Hours: detailedStatus.upcomingIn24Hours,
            systemStatus: detailedStatus.prayerNotifications > 0 ? 'ACTIVE' : 'INACTIVE'
          });
          
          // Context7: Performance analytics
          const expectedMinimum = Math.min(settings.activePrayers.length, 5); // En az bugün + yarın için
          if (detailedStatus.prayerNotifications < expectedMinimum) {
            console.warn(`⚠️ PERFORMANS UYARISI: ${detailedStatus.prayerNotifications}/${expectedMinimum} beklenen minimum altında`);
          } else {
            console.log(`✅ PERFORMANS OK: ${detailedStatus.prayerNotifications} bildirim başarıyla zamanlandı`);
          }
          
          // Context7: Next 24 hours analysis
          if (detailedStatus.upcomingIn24Hours > 0) {
            console.log(`📅 Gelecek 24 saat: ${detailedStatus.upcomingIn24Hours} bildirim gelecek`);
          } else {
            console.warn('⚠️ Gelecek 24 saatte hiç bildirim yok!');
          }
          
        } catch (detailedError) {
          console.error('⚠️ Detaylı doğrulama hatası:', detailedError.message);
        }
      }, 3000);
      
    } else {
      console.error('❌ Namaz bildirim sistemi başlatılamadı');
    }
    
    return success;
  } catch (error) {
    console.error('💥 [CONTEXT7] KRITIK HATA: Namaz bildirim sistemi başlatma hatası:', error);
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

// Context7 best practice: Yeni notification service ile uyumlu durum kontrolü
export const checkPrayerNotificationStatus = async () => {
  try {
    console.log('🔍 [CONTEXT7] Bildirim durumu analizi başlıyor...');
    
    // Yeni notification service'den durum al
    const status = await getNotificationStatus();
    
    console.log('📊 Sistem durumu raporu:', {
      totalNotifications: status.total,
      prayerNotifications: status.prayerNotifications,
      upcomingIn24Hours: status.upcomingIn24Hours,
      hasError: !!status.error
    });
    
    // Context7: Detaylı bildirim analizi
    if (status.prayerNotifications > 0) {
      console.log(`✅ ${status.prayerNotifications} namaz bildirimi aktif`);
      
      // Gelecek 24 saatteki bildirimleri göster
      if (status.upcomingNotifications && status.upcomingNotifications.length > 0) {
        console.log('📅 Gelecek 24 saatteki bildirimler:');
        status.upcomingNotifications.slice(0, 5).forEach((notif, index) => {
          const triggerDate = notif.trigger?.date ? new Date(notif.trigger.date) : null;
          const timeStr = triggerDate ? triggerDate.toLocaleString('tr-TR') : 'Belirsiz';
          const prayerName = notif.data?.prayerName || 'Belirsiz';
          console.log(`${index + 1}. ${prayerName} → ${timeStr}`);
        });
        
        if (status.upcomingNotifications.length > 5) {
          console.log(`... ve ${status.upcomingNotifications.length - 5} adet daha`);
        }
      }
    } else {
      console.log('❌ Hiç namaz bildirimi bulunamadı');
      
      if (status.total > 0) {
        console.log(`⚠️ Sistemde ${status.total} bildirim var ama hiçbiri namaz bildirimi değil`);
      } else {
        console.log('💡 Hiç bildirim zamanlanmamış');
      }
    }
    
    // Context7: Error handling
    if (status.error) {
      console.error('⚠️ Bildirim sistemi hatası:', status.error);
    }
    
    // Eski format ile uyumluluk için dönüştür
    return {
      isActive: status.prayerNotifications > 0,
      scheduledCount: status.prayerNotifications,
      totalScheduled: status.total,
      upcomingIn24Hours: status.upcomingIn24Hours,
      notifications: status.notifications ? status.notifications.map(n => ({
        identifier: n.identifier,
        title: n.content?.title || 'Bilinmiyor',
        body: n.content?.body || '',
        trigger: n.trigger,
        categoryIdentifier: n.content?.categoryIdentifier,
        data: n.content?.data || {}
      })) : [],
      error: status.error
    };
  } catch (error) {
    console.error('❌ [CONTEXT7] Bildirim durumu kontrol hatası:', error);
    return {
      isActive: false,
      scheduledCount: 0,
      totalScheduled: 0,
      upcomingIn24Hours: 0,
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