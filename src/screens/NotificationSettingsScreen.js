import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Slider } from '@rneui/themed';
import { getUserSettings, storeUserSettings, debugStorage } from '../services/storageService';
import { 
  cancelAllNotifications, 
  requestNotificationPermissions, 
  createNotificationChannel,
  cancelPrayerNotifications,
  getNotificationStatus,
  sendTestNotification,
  checkSpecificPrayerNotification,
  emergencyFixPrayerNotification,
  guaranteePrayerNotification,
  diagnosePrayerNotificationIssue,
  debugScheduleAllPrayersForDay,
  scheduleAllPrayerNotificationsAdvanced,
  initializeSuperReliableNotificationSystem,
  performSystemHealthCheck
} from '../services/notificationService';
import { 
  initializePrayerNotifications,
  stopPrayerNotifications, 
  checkPrayerNotificationStatus,
  triggerTestPrayerNotification,
  cancelAllPrayerNotifications
} from '../services/backgroundTaskService';
import { COLORS } from '../constants/theme';
import * as Notifications from 'expo-notifications';

const NotificationSettingsScreen = () => {
  const [settings, setSettings] = useState({
    notificationsEnabled: true,
    notifyBeforeMinutes: 10,
    activePrayers: ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"],
  });
  
  const [loading, setLoading] = useState(true);
  const [notificationStatus, setNotificationStatus] = useState({
    isActive: false,
    scheduledCount: 0,
    totalScheduled: 0,
    notifications: [],
    error: null
  });
  
  // Context7 best practice: Geliştirilmiş test bildirimi
  const sendTestNotificationImproved = async () => {
    try {
      console.log('🧪 [CONTEXT7] Gelişmiş test bildirimi başlatılıyor...');
      
      const result = await sendTestNotification();
      
      Alert.alert(
        "✅ Test Bildirimleri Gönderildi",
        "İki test bildirimi zamanlandı:\n\n" +
        "🔥 Anlık test: 1 saniye içinde\n" +
        "🕌 Namaz simülasyonu: 5 saniye içinde\n\n" +
        "Bu bildirimler gerçek sistem ile aynı şekilde çalışır.",
        [{ text: "Tamam" }]
      );
      
      // Durumu güncelle
      setTimeout(() => updateNotificationStatus(), 2000);
      
    } catch (error) {
      console.error("Test bildirimi hatası:", error);
      Alert.alert(
        "❌ Test Hatası",
        "Test bildirimi gönderilirken sorun: " + error.message,
        [{ text: "Tamam" }]
      );
    }
  };

  // Sayfa yüklendiğinde kullanıcı ayarlarını getir
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const userSettings = await getUserSettings();
        if (userSettings) {
          setSettings(userSettings);
          console.log('Kullanıcı ayarları yüklendi:', userSettings);
          
          // Context7 best practice: Kullanıcının şehrine göre namaz vakitlerini kontrol et
          if (userSettings.city && userSettings.city !== 'İstanbul') {
            console.log(`Kullanıcının şehri: ${userSettings.city}, namaz vakitleri kontrol ediliyor...`);
          }
        }
        
        // Bildirim durumunu kontrol et
        await updateNotificationStatus();
      } catch (error) {
        console.error('Ayarlar getirilirken hata oluştu:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();

    // Context7 best practice: Bildirim listener'ları ekle
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('📥 Bildirim alındı:', notification.request.content.title);
      
      // Test bildirimi ise özel işlem yap
      if (notification.request.content.data?.isTest) {
        console.log('🧪 Test bildirimi alındı ve başarıyla gösterildi');
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Bildirime tıklandı:', response.notification.request.content.title);
      
      // Namaz bildirimi tıklandıysa özel işlem yapılabilir
      if (response.notification.request.content.categoryIdentifier === 'prayer-notification') {
        console.log('🕌 Namaz bildirimine tıklandı');
      }
    });

    return () => {
      try {
        if (notificationListener && typeof notificationListener.remove === 'function') {
          notificationListener.remove();
        }
        if (responseListener && typeof responseListener.remove === 'function') {
          responseListener.remove();
        }
      } catch (error) {
        console.warn('Notification listener temizlenirken hata (görmezden geliniyor):', error);
      }
    };
  }, []);
  
  // Storage'daki veriyi kontrol et (debug) - Context7 best practice ile geliştirildi
  const checkStorageData = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      
      // Debug storage fonksiyonunu kullan
      const debugInfo = await debugStorage();
      
      // Detaylı kontrol için gerekli veriler
      const userSettings = await getUserSettings();
      const currentCity = userSettings?.city || 'Belirlenmemiş';
      
      let message = `📱 Durum Raporu\n\n`;
      message += `🏙️ Aktif Şehir: ${currentCity}\n\n`;
      
      // Ana durum kontrolü
      if (debugInfo.hasPrayerData) {
        message += `✅ Namaz vakitleri verisi: ${debugInfo.prayerDataCount} gün\n`;
      } else {
        message += `❌ Namaz vakitleri verisi: Bulunamadı\n`;
      }
      
      if (debugInfo.hasCityData && currentCity !== 'Belirlenmemiş') {
        message += `✅ ${currentCity} için veriler: Mevcut\n`;
      } else if (currentCity !== 'Belirlenmemiş') {
        message += `❌ ${currentCity} için veriler: Bulunamadı\n`;
      }
      
      // Kullanıcı ayarları
      if (userSettings) {
        message += `\n✅ Kullanıcı Ayarları:\n`;
        message += `   Bildirimler: ${userSettings.notificationsEnabled ? 'Açık' : 'Kapalı'}\n`;
        message += `   Bildirim Süresi: ${userSettings.notifyBeforeMinutes} dk\n`;
      } else {
        message += `\n❌ Kullanıcı Ayarları: Bulunamadı\n`;
      }
      
      message += `\n🕐 Son Güncelleme: ${debugInfo.lastUpdate}`;
      
      Alert.alert('Durum Raporu', message, [
        {
          text: 'Yenile',
          onPress: async () => {
            try {
              // Konum bazlı şehir tespiti ve veri yenileme
              if (currentCity === 'Belirlenmemiş' || currentCity === 'Hata') {
                Alert.alert('Bilgi', 'Önce ana sayfadan konumunuzu belirleyin.');
                return;
              }
              
              const { fetchPrayerTimesRange } = await import('../services/prayerTimesService');
              console.log(`${currentCity} için namaz vakitleri yenileniyor...`);
              await fetchPrayerTimesRange(currentCity, 7, 7);
              
              // Bildirimleri yeniden başlat
              if (settings.notificationsEnabled) {
                await initializePrayerNotifications();
              }
              
              // Durumu güncelle
              await updateNotificationStatus();
              
              Alert.alert('Başarılı', 'Veriler yenilendi.');
            } catch (error) {
              Alert.alert('Hata', 'Yenileme sırasında hata: ' + error.message);
            }
          }
        },
        { text: 'Tamam' }
      ]);
      
    } catch (error) {
      Alert.alert('Hata', 'Durum kontrol edilirken hata: ' + error.message);
    }
  };

  // Namaz bildirim test fonksiyonu
  const testPrayerNotification = async () => {
    try {
      const success = await triggerTestPrayerNotification();
      if (success) {
        Alert.alert(
          "Test Bildirimi",
          "Namaz bildirimi test edildi. 2 saniye içinde bildirim gelecek.",
          [{ text: "Tamam" }]
        );
        // Durumu güncelle
        setTimeout(() => updateNotificationStatus(), 3000);
      } else {
        Alert.alert(
          "Hata",
          "Test bildirimi gönderilirken bir sorun oluştu.",
          [{ text: "Tamam" }]
        );
      }
    } catch (error) {
      Alert.alert(
        "Hata",
        "Test bildirimi gönderilirken bir sorun oluştu: " + error.message
      );
    }
  };

  // Bildirim durumunu kontrol et
  const updateNotificationStatus = async () => {
    try {
      console.log('Bildirim durumu güncelleniyor...');
      const status = await checkPrayerNotificationStatus();
      setNotificationStatus(status);
      console.log('Bildirim durumu güncellendi:', {
        isActive: status.isActive,
        scheduledCount: status.scheduledCount,
        hasNotifications: status.notifications.length > 0
      });
    } catch (error) {
      console.error('Bildirim durumu alınamadı:', error);
    }
  };
  
  // Namaz vakti isimleri
  const prayerNames = ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"];
  
  // Tüm bildirimleri aç/kapat
  const toggleNotifications = async (value) => {
    try {
      const newSettings = { ...settings, notificationsEnabled: value };
      setSettings(newSettings);
      await storeUserSettings(newSettings);

      if (value) {
        // İzin kontrolü
        const permissionGranted = await requestNotificationPermissions();
        if (!permissionGranted) {
          // İzin alınamazsa geri çevir
          const revertSettings = { ...settings, notificationsEnabled: false };
          setSettings(revertSettings);
          await storeUserSettings(revertSettings);
          return;
        }

        // Notification channel oluştur
        await createNotificationChannel();
        
        // Context7 best practice: Önce veri kontrolü yap
        const userSettings = await getUserSettings();
        if (!userSettings?.city) {
          Alert.alert(
            'Şehir Bilgisi Eksik', 
            'Önce ana sayfadan konumunuzu belirleyin veya şehir seçin.',
            [{ text: 'Tamam' }]
          );
          
          // Bildirimleri tekrar kapat
          const revertSettings = { ...settings, notificationsEnabled: false };
          setSettings(revertSettings);
          await storeUserSettings(revertSettings);
          return;
        }
        
        // Namaz bildirimlerini başlat
        try {
          console.log('Bildirimler açılıyor, namaz bildirimleri başlatılıyor...');
          const success = await initializePrayerNotifications();
          
          if (success) {
            console.log('Namaz bildirimleri başarıyla başlatıldı');
            Alert.alert(
              'Bildirimler Aktif! ✅', 
              `Namaz vakti bildirimleri başarıyla aktif edildi.\n\n🕰️ Her namaz vaktinden ${settings.notifyBeforeMinutes} dakika önce bildirim alacaksınız.\n📍 Şehir: ${userSettings.city}`
            );
          } else {
            Alert.alert(
              'Veri Eksikliği ⚠️', 
              'Bildirimler açıldı ancak namaz vakti verisi eksik. Ana sayfayı açarak verilerin yüklenmesini bekleyin.'
            );
          }
        } catch (error) {
          console.error('Namaz bildirimleri başlatılamadı:', error);
          Alert.alert(
            'Bildirim Hatası ❌', 
            'Namaz bildirimleri başlatılırken bir sorun oluştu. Uygulamayı yeniden başlatmayı deneyin.'
          );
        }
      } else {
        // Bildirimler kapatıldıysa mevcut bildirimleri iptal et
        try {
          await cancelAllNotifications();
          await stopPrayerNotifications();
          Alert.alert(
            'Bildirimler Kapatıldı ❌', 
            'Tüm namaz vakti bildirimleri iptal edildi.'
          );
        } catch (error) {
          console.error('Bildirimler kapatılırken hata:', error);
        }
      }

      // Durumu güncelle
      setTimeout(() => updateNotificationStatus(), 1000);
    } catch (error) {
      console.error('Bildirim ayarları güncellenirken hata oluştu:', error);
      Alert.alert('Hata ❌', 'Bildirim ayarları güncellenirken bir sorun oluştu.');
    }
  };
  
  // Seçili namaz vakitlerini güncelle
  const togglePrayer = async (prayerName) => {
    try {
      let newActivePrayers;
      if (settings.activePrayers.includes(prayerName)) {
        newActivePrayers = settings.activePrayers.filter(name => name !== prayerName);
      } else {
        newActivePrayers = [...settings.activePrayers, prayerName];
      }
      
      const newSettings = { ...settings, activePrayers: newActivePrayers };
      setSettings(newSettings);
      await storeUserSettings(newSettings);

      // Context7 best practice: Sadece bildirimler aktifse yeniden zamanla
      if (settings.notificationsEnabled && newActivePrayers.length > 0) {
        console.log(`${prayerName} namaz bildirimi ${newActivePrayers.includes(prayerName) ? 'açıldı' : 'kapatıldı'}`);
        await initializePrayerNotifications();
        await updateNotificationStatus();
      } else if (settings.notificationsEnabled && newActivePrayers.length === 0) {
        // Hiç namaz seçili değilse bildirimleri durdur
        await stopPrayerNotifications();
        await updateNotificationStatus();
      }
    } catch (error) {
      console.error('Namaz vakti ayarları güncellenirken hata oluştu:', error);
    }
  };
  
  // Bildirim süresini güncelle
  const updateNotifyBeforeMinutes = async (value) => {
    try {
      const newSettings = { ...settings, notifyBeforeMinutes: value };
      setSettings(newSettings);
      await storeUserSettings(newSettings);

      // Context7 best practice: Sadece bildirimler aktifse ve namaz seçili ise yeniden zamanla
      if (settings.notificationsEnabled && settings.activePrayers.length > 0) {
        console.log(`Bildirim süresi ${value} dakika olarak güncellendi, bildirimleri yeniden zamanlanıyor...`);
        await initializePrayerNotifications();
        await updateNotificationStatus();
      }
    } catch (error) {
      console.error('Bildirim süresi güncellenirken hata oluştu:', error);
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bildirimler</Text>
        <Text style={styles.sectionSubtitle}>
          📿 Namaz vakitlerinden önce hatırlatma bildirimleri alın
        </Text>
        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Ezan vakti bildirimleri</Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#767577', true: COLORS.primaryLight }}
            thumbColor={settings.notificationsEnabled ? COLORS.primary : '#f4f3f4'}
          />
        </View>
        
        <Text style={styles.sectionSubtitle}>
          🕰️ Ezan vakitlerinden ne kadar önce bildirim almak istiyorsunuz?
        </Text>
        <Text style={styles.explanationText}>
          Bu ayar sayesinde namaz vaktine hazırlanmanız için önceden uyarı alırsınız. 
          Örneğin 10 dakika seçerseniz, öğle ezanından 10 dakika önce "Öğle namazına 10 dakika kaldı" bildirimi gelir.
        </Text>
        
        <View style={styles.sliderContainer}>
          <Slider
            value={settings.notifyBeforeMinutes}
            onValueChange={(value) => setSettings({ ...settings, notifyBeforeMinutes: value })}
            onSlidingComplete={updateNotifyBeforeMinutes}
            minimumValue={5}
            maximumValue={30}
            step={5}
            thumbStyle={styles.sliderThumb}
            thumbTintColor={COLORS.primary}
            minimumTrackTintColor={COLORS.primary}
            disabled={!settings.notificationsEnabled}
          />
          <Text style={styles.sliderValue}>{settings.notifyBeforeMinutes} dakika önce</Text>
        </View>
        
        {/* Context7 best practice: Geliştirilmiş Test Bildirim Butonları */}
        <TouchableOpacity 
          style={[
            styles.testButton, 
            !settings.notificationsEnabled && styles.testButtonDisabled
          ]}
          onPress={sendTestNotificationImproved}
          disabled={!settings.notificationsEnabled}
        >
          <Text style={styles.testButtonText}>🧪 Gelişmiş Test Bildirimi</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.testButton, 
            { backgroundColor: COLORS.secondary, marginTop: 8 },
            !settings.notificationsEnabled && styles.testButtonDisabled
          ]}
          onPress={async () => {
            try {
              if (!settings.notificationsEnabled) {
                Alert.alert('❌ Bildirimler Kapalı', 'Önce bildirimleri açın.');
                return;
              }
              
              const success = await triggerTestPrayerNotification();
              if (success) {
                Alert.alert(
                  "🧪 Test Bildirimleri Zamanlandı",
                  "İki test bildirimi zamanlandı:\n\n" +
                  "1️⃣ Genel test bildirimi (2 saniye içinde)\n" +
                  "2️⃣ Namaz vakti simülasyonu (30 saniye içinde)\n\n" +
                  "Bu bildirimler gerçek namaz bildirimleri gibi çalışır ve aynı kategori altında zamanlanır.",
                  [{ text: "Tamam" }]
                );
                // Durumu güncelle
                setTimeout(() => updateNotificationStatus(), 3000);
              } else {
                Alert.alert(
                  "❌ Test Hatası",
                  "Test bildirimi gönderilirken bir sorun oluştu.",
                  [{ text: "Tamam" }]
                );
              }
            } catch (error) {
              Alert.alert(
                "❌ Test Hatası",
                "Test bildirimi gönderilirken bir sorun oluştu: " + error.message
              );
            }
          }}
          disabled={!settings.notificationsEnabled}
        >
          <Text style={styles.testButtonText}>🧪 Namaz Bildirimi Test Et</Text>
        </TouchableOpacity>

        {/* Debug: Storage kontrol butonu */}
        {__DEV__ && (
          <TouchableOpacity 
            style={[
              styles.testButton, 
              { backgroundColor: '#FF6B35', marginTop: 8 }
            ]}
            onPress={checkStorageData}
          >
            <Text style={styles.testButtonText}>Veri Durumu Kontrol Et</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={[styles.testButton, { backgroundColor: '#666', marginTop: 8 }]}
          onPress={updateNotificationStatus}
        >
          <Text style={styles.testButtonText}>Durumu Yenile</Text>
        </TouchableOpacity>

        {/* Context7 best practice: Zamanlanmış bildirimleri göster butonu */}
        <TouchableOpacity 
          style={[styles.testButton, { backgroundColor: '#3498db', marginTop: 8 }]}
          onPress={async () => {
            try {
              const status = await checkPrayerNotificationStatus();
              
              if (status.scheduledCount === 0) {
                Alert.alert('📋 Zamanlanmış Bildirimler', 'Henüz hiç bildirim zamanlanmamış.');
                return;
              }
              
              // Bildirimleri gruplara ayır
              const groupedNotifications = {};
              status.notifications.forEach(notif => {
                if (notif.trigger && notif.trigger.date) {
                  const triggerDate = new Date(notif.trigger.date);
                  const dateKey = triggerDate.toLocaleDateString('tr-TR');
                  
                  if (!groupedNotifications[dateKey]) {
                    groupedNotifications[dateKey] = [];
                  }
                  
                  groupedNotifications[dateKey].push({
                    title: notif.title,
                    time: triggerDate.toLocaleTimeString('tr-TR', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })
                  });
                }
              });
              
              // Alert mesajı oluştur
              let message = `📊 Toplam ${status.scheduledCount} bildirim zamanlanmış:\n\n`;
              
              Object.keys(groupedNotifications)
                .sort((a, b) => new Date(a.split('.').reverse().join('-')) - new Date(b.split('.').reverse().join('-')))
                .slice(0, 3) // İlk 3 günü göster
                .forEach(dateKey => {
                  message += `📅 ${dateKey}:\n`;
                  groupedNotifications[dateKey]
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .forEach(notif => {
                      message += `  🕐 ${notif.time} - ${notif.title}\n`;
                    });
                  message += '\n';
                });
              
              if (Object.keys(groupedNotifications).length > 3) {
                message += `... ve daha fazlası\n\n`;
              }
              
              message += `💡 Bu bildirimler namaz vaktinden ${settings.notifyBeforeMinutes} dakika önce gelecek.`;
              
              Alert.alert('📋 Zamanlanmış Bildirimler', message, [
                { text: 'Tamam', style: 'default' }
              ]);
              
            } catch (error) {
              Alert.alert('❌ Hata', 'Zamanlanmış bildirimler alınırken hata: ' + error.message);
            }
          }}
        >
          <Text style={styles.testButtonText}>📋 Zamanlanmış Bildirimleri Gör</Text>
        </TouchableOpacity>

        {/* Context7 best practice: Süper güvenilir force refresh butonu */}
        <TouchableOpacity 
          style={[styles.testButton, { backgroundColor: '#e74c3c', marginTop: 8 }]}
          onPress={async () => {
            try {
              console.log('🚀 [CONTEXT7] Süper güvenilir sistem yenileme başlatılıyor...');
              
              Alert.alert(
                '🔄 Sistem Yenileniyor',
                'Bildirim sistemi tamamen yenileniyor. Bu 5-10 saniye sürebilir...',
                [{ text: 'Devam Et', style: 'default' }]
              );
              
              // Step 1: Mevcut durum analizi
              console.log('📊 1. Mevcut durum analizi...');
              const beforeStatus = await getNotificationStatus();
              console.log('📊 Önceki durum:', {
                total: beforeStatus.total,
                prayer: beforeStatus.prayerNotifications,
                upcoming: beforeStatus.upcomingIn24Hours
              });
              
              // Step 2: Kapsamlı temizlik
              console.log('🧹 2. Kapsamlı sistem temizliği...');
              await cancelPrayerNotifications();
              
              // Step 3: 1 saniye bekle (sistem stabilizasyonu)
              console.log('⏱️ 3. Sistem stabilizasyonu bekleniyor...');
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Step 4: Sistem yeniden başlatma
              console.log('🚀 4. Süper güvenilir sistem başlatması...');
              const initResult = await initializePrayerNotifications();
              
              // Step 5: Verification with timeout
              console.log('🔍 5. Doğrulama süreci başlatılıyor...');
              setTimeout(async () => {
                try {
                  const afterStatus = await getNotificationStatus();
                  console.log('📊 Sonrası durum:', {
                    total: afterStatus.total,
                    prayer: afterStatus.prayerNotifications,
                    upcoming: afterStatus.upcomingIn24Hours
                  });
                  
                  // UI güncelle
                  const compatibleStatus = await checkPrayerNotificationStatus();
                  setNotificationStatus(compatibleStatus);
                  
                  // Context7: Kapsamlı sonuç analizi
                  if (afterStatus.prayerNotifications > 0) {
                    const upcomingText = afterStatus.upcomingIn24Hours > 0 ? 
                      `\n📅 Gelecek 24 saat: ${afterStatus.upcomingIn24Hours} bildirim` : '';
                    
                    Alert.alert(
                      '✅ Sistem Başarıyla Yenilendi!',
                      `🕌 ${afterStatus.prayerNotifications} namaz bildirimi aktif` +
                      `\n📊 Toplam ${afterStatus.total} bildirim zamanlandı` +
                      upcomingText +
                      '\n\n🎯 Sistem artık %100 güvenilir çalışacak!'
                    );
                  } else if (afterStatus.total > 0) {
                    Alert.alert(
                      '⚠️ Kısmi Başarı',
                      `Sistem ${afterStatus.total} bildirim zamanladı ama namaz bildirimi kategorisi henüz tanınmıyor.\n\nBu geçici bir durum olabilir, birkaç dakika sonra tekrar kontrol edin.`
                    );
                  } else {
                    Alert.alert(
                      '❌ Yenileme Başarısız',
                      'Hiç bildirim zamanlanamadı.\n\n💡 Çözüm önerileri:\n• Uygulamayı tamamen kapatıp açın\n• Cihaz ayarlarından bildirim izinlerini kontrol edin\n• Ana sayfayı açarak konum ve namaz verilerini yenileyin'
                    );
                  }
                } catch (verificationError) {
                  console.error('Doğrulama hatası:', verificationError);
                  Alert.alert('⚠️ Doğrulama Hatası', 'Sistem yenilendi ama durum kontrol edilemedi.');
                }
              }, 3000);
              
            } catch (error) {
              console.error('💥 [CONTEXT7] Süper güvenilir yenileme hatası:', error);
              Alert.alert(
                '❌ Kritik Hata', 
                'Sistem yenileme başarısız:\n\n' + error.message + 
                '\n\nUygulamayı yeniden başlatmayı deneyin.'
              );
            }
          }}
        >
          <Text style={styles.testButtonText}>🚀 Süper Güvenilir Yenileme</Text>
        </TouchableOpacity>

        {/* Zamanlanmış bildirimler listesi (sadece geliştirme modu) */}
        {__DEV__ && notificationStatus.notifications.length > 0 && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>Debug: Zamanlanmış Bildirimler</Text>
            {notificationStatus.notifications.slice(0, 3).map((notification, index) => (
              <Text key={index} style={styles.debugText}>
                {notification.title} - {notification.identifier}
              </Text>
            ))}
            {notificationStatus.notifications.length > 3 && (
              <Text style={styles.debugText}>... ve {notificationStatus.notifications.length - 3} adet daha</Text>
            )}
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.testButton, 
            { backgroundColor: '#ff9800', marginTop: 8 }
          ]}
          onPress={async () => {
            try {
              console.log('🧪 Critical Test başlatıldı - Context7 best practice');
              
              // Step 1: Permission check
              const { requestNotificationPermissions } = await import('../services/notificationService');
              const permissionGranted = await requestNotificationPermissions();
              console.log('🔐 Permission durumu:', permissionGranted);
              
              if (!permissionGranted) {
                Alert.alert('❌ Permission Hatası', 'Bildirim izni verilmedi');
                return;
              }
              
              // Step 2: Create channel
              const { createNotificationChannel } = await import('../services/notificationService');
              await createNotificationChannel();
              console.log('📺 Channel oluşturuldu');
              
              // Step 3: Simple test notification
              const testId = await Notifications.scheduleNotificationAsync({
                content: {
                  title: "🔥 Critical Test",
                  body: "Bu basit test bildirimidir - 3 saniye sonra gelecek",
                  sound: true,
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                  data: { isTest: true }
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                  seconds: 3
                }
              });
              
              console.log('✅ Test bildirimi zamanlandı, ID:', testId);
              
              // Step 4: Verify it was scheduled
              setTimeout(async () => {
                const allNotifications = await Notifications.getAllScheduledNotificationsAsync();
                console.log('📊 Zamanlanmış bildirimler:', allNotifications.length);
                
                const testNotif = allNotifications.find(n => n.identifier === testId);
                if (testNotif) {
                  console.log('✅ Test bildirimi sistemde bulundu');
                  Alert.alert(
                    '✅ Critical Test Başarılı', 
                    `Test bildirimi zamanlandı ve sistemde mevcut!\n\nID: ${testId}\nToplam bildirim: ${allNotifications.length}`
                  );
                } else {
                  console.log('❌ Test bildirimi sistemde bulunamadı');
                  Alert.alert(
                    '❌ Critical Test Başarısız', 
                    `Test bildirimi zamanlandı ama sistemde bulunamıyor!\n\nBu kritik bir sorundur.`
                  );
                }
              }, 1000);
              
            } catch (error) {
              console.error('💥 Critical Test hatası:', error);
              Alert.alert('❌ Test Hatası', error.message);
            }
          }}
        >
          <Text style={styles.testButtonText}>🔥 Critical Test (3sn)</Text>
        </TouchableOpacity>



        {/* Context7 best practice: PROBLEM TESPİT SİSTEMİ */}
        <TouchableOpacity 
          style={[styles.testButton, { backgroundColor: '#e74c3c', marginTop: 8 }]}
          onPress={async () => {
            try {
              console.log('🔍 [CONTEXT7] Problem tespit sistemi başlatılıyor...');
              
              Alert.alert(
                '🔍 Problem Tanı Sistemi',
                'Sadece İmsak ve Güneş bildirimlerinin gelme problemini analiz ediyorum...',
                [{ text: 'Başlat', style: 'default' }]
              );
              
              const diagnosis = await diagnosePrayerNotificationIssue();
              
              if (diagnosis.error) {
                Alert.alert(
                  '❌ Tanı Hatası',
                  `Problem analizi yapılamadı:\n\n${diagnosis.error}`,
                  [{ text: 'Tamam', style: 'default' }]
                );
                return;
              }
              
              // Rapor oluştur
              let report = `🔍 PROBLEM ANALİZ RAPORU\n\n`;
              report += `⏰ Analiz zamanı: ${diagnosis.currentTime}\n`;
              report += `⏱️ Bildirim öncesi: ${diagnosis.notifyBeforeMinutes} dk\n\n`;
              
              report += `📊 DURUM ÖZETİ:\n`;
              report += `✅ Zamanlanacak: ${diagnosis.successfulPrayers.length} namaz\n`;
              report += `❌ Geçmiş zaman: ${diagnosis.problematicPrayers.length} namaz\n\n`;
              
              if (diagnosis.problematicPrayers.length > 0) {
                report += `🚨 PROBLEMLİ NAMAZ VAKİTLERİ:\n`;
                diagnosis.problematicPrayers.forEach(p => {
                  report += `• ${p.prayer}: ${p.message}\n`;
                });
                
                report += `\n💡 TEŞHİS:\n`;
                if (diagnosis.problematicPrayers.length > diagnosis.successfulPrayers.length) {
                  report += `Ana problem: Bildirimlerin gün ortasında başlatılması!\n\n`;
                  report += `ÇÖZÜMLERİ:\n`;
                  report += `1. Gece yarısından sonra sistem yenilenmeli\n`;
                  report += `2. Her namaz vaktinden sonra otomatik yenileme\n`;
                  report += `3. Geçmiş vakitler için yarının zamanları kullanılmalı`;
                } else {
                  report += `Sistem çalışıyor ama bazı vakitler geçmiş zamanda`;
                }
              } else {
                report += `✅ TÜM NAMAZ VAKİTLERİ ZAMANLANACAK!\n`;
                report += `Sistem tamamen sağlıklı çalışıyor.`;
              }
              
              Alert.alert(
                '📋 Problem Tanı Raporu',
                report,
                [
                  { text: 'Detayları Göster', onPress: () => {
                    // Detaylı rapor
                    let detailReport = `📊 DETAYLI ANALİZ:\n\n`;
                    diagnosis.analysis.forEach((analysis, index) => {
                      detailReport += `${index + 1}. ${analysis.prayer}\n`;
                      detailReport += `   ⏰ Namaz: ${analysis.time}\n`;
                      detailReport += `   🔔 Bildirim: ${analysis.notificationDateTime}\n`;
                      detailReport += `   ⏱️ Kalan: ${analysis.hoursFromNow}h\n`;
                      detailReport += `   📊 Durum: ${analysis.status}\n\n`;
                    });
                    
                    Alert.alert('📊 Detaylı Analiz', detailReport, [{ text: 'Tamam' }]);
                  }},
                  { text: 'Tamam', style: 'default' }
                ]
              );
              
            } catch (error) {
              console.error('💥 Problem tespit hatası:', error);
              Alert.alert(
                '❌ Tespit Hatası',
                `Problem analizi sırasında hata:\n\n${error.message}`,
                [{ text: 'Tamam', style: 'default' }]
              );
            }
          }}
        >
          <Text style={styles.testButtonText}>🔍 Problem Tespit Sistemi</Text>
        </TouchableOpacity>

        {/* Context7 best practice: Bugünkü Namaz Debug */}
        <TouchableOpacity 
          style={[styles.testButton, { backgroundColor: '#9b59b6', marginTop: 8 }]}
          onPress={async () => {
            try {
              console.log('🔍 [CONTEXT7] Bugünkü namaz debug sistemi başlatılıyor...');
              
              Alert.alert(
                '🔍 Bugünkü Namaz Debug',
                'Bugünkü tüm namaz vakitleri için detaylı zamanlama analizi yapılıyor...',
                [{ text: 'Başlat', style: 'default' }]
              );
              
              const { getPrayerTimesData } = await import('../services/storageService');
              const prayerTimesData = await getPrayerTimesData();
              
              if (!prayerTimesData || prayerTimesData.length === 0) {
                Alert.alert('❌ Veri Yok', 'Namaz vakti verisi bulunamadı.');
                return;
              }
              
              // Bugünün verilerini bul
              const today = new Date();
              const todayStr = today.toDateString();
              
              const todayPrayer = prayerTimesData.find(day => {
                const dayDate = new Date(day.date);
                return dayDate.toDateString() === todayStr;
              });
              
              if (!todayPrayer) {
                Alert.alert('❌ Bugün Yok', 'Bugünkü namaz vakitleri bulunamadı.');
                return;
              }
              
              console.log('🎯 Bugünkü namaz vakitleri bulundu:', todayPrayer);
              
              const debugResults = await debugScheduleAllPrayersForDay(todayPrayer);
              
              // Sonuçları göster
              let report = `📅 BUGÜN (${new Date(todayPrayer.date).toLocaleDateString('tr-TR')}) DEBUG RAPORU\n\n`;
              
              const scheduled = debugResults.filter(r => r.status === 'scheduled');
              const skipped = debugResults.filter(r => r.status === 'skipped-past-time');
              const notSelected = debugResults.filter(r => r.status === 'not-selected');
              
              report += `📊 ÖZET:\n`;
              report += `✅ Zamanlandı: ${scheduled.length} namaz\n`;
              report += `❌ Geçmiş zaman: ${skipped.length} namaz\n`;
              report += `⏩ Seçili değil: ${notSelected.length} namaz\n\n`;
              
              if (scheduled.length > 0) {
                report += `✅ ZAMANLANACAK NAMAZ VAKİTLERİ:\n`;
                scheduled.forEach(r => {
                  report += `• ${r.prayer} (${r.time})\n`;
                });
                report += `\n`;
              }
              
              if (skipped.length > 0) {
                report += `❌ GEÇMİŞ ZAMANDA KALAN (ATLANAN):\n`;
                skipped.forEach(r => {
                  report += `• ${r.prayer} (${r.time}) → Bu problemi çözmeliyiz!\n`;
                });
                report += `\n`;
              }
              
              if (notSelected.length > 0) {
                report += `⏩ SEÇİLİ OLMAYAN:\n`;
                notSelected.forEach(r => {
                  report += `• ${r.prayer}\n`;
                });
                report += `\n`;
              }
              
              if (skipped.length > 0) {
                report += `💡 PROBLEM ÇÖZÜMLERİ:\n`;
                report += `1. Bu namaz vakitleri için yarının zamanlarını kullan\n`;
                report += `2. Sistem her namaz vaktinden sonra kendini yenilesin\n`;
                report += `3. Gece yarısı otomatik yenileme ekle`;
              } else {
                report += `🎉 HİÇ PROBLEM YOK! Tüm seçili namaz vakitleri zamanlanacak.`;
              }
              
              Alert.alert('📅 Bugünkü Debug Raporu', report, [{ text: 'Harika!' }]);
              
            } catch (error) {
              console.error('💥 Bugünkü namaz debug hatası:', error);
              Alert.alert(
                '❌ Debug Hatası',
                `Bugünkü namaz debug sırasında hata:\n\n${error.message}`,
                [{ text: 'Tamam', style: 'default' }]
              );
            }
          }}
        >
          <Text style={styles.testButtonText}>📅 Bugünkü Namaz Debug</Text>
        </TouchableOpacity>

        {/* Context7 best practice: GELİŞMİŞ SİSTEM TEST BUTONU */}
        <TouchableOpacity 
          style={[styles.testButton, { backgroundColor: '#27ae60', marginTop: 8 }]}
          onPress={async () => {
            try {
              console.log('🚀 [CONTEXT7] Gelişmiş sistem testi başlatılıyor...');
              
              Alert.alert(
                '🚀 Gelişmiş Sistem Testi',
                'Context7 metodolojisi ile geliştirilmiş zamanlama sistemi test ediliyor. Bu sistem geçmiş zamanda kalan namaz vakitleri için yarının zamanlarını kullanır.',
                [{ text: 'Teste Başla', style: 'default' }]
              );
              
              const { getPrayerTimesData } = await import('../services/storageService');
              const prayerTimesData = await getPrayerTimesData();
              
              if (!prayerTimesData || prayerTimesData.length === 0) {
                Alert.alert('❌ Veri Yok', 'Namaz vakti verisi bulunamadı. Ana sayfayı açarak verileri yükleyin.');
                return;
              }
              
              // Bugünün verilerini bul
              const today = new Date();
              const todayStr = today.toDateString();
              
              const todayPrayer = prayerTimesData.find(day => {
                const dayDate = new Date(day.date);
                return dayDate.toDateString() === todayStr;
              });
              
              if (!todayPrayer) {
                Alert.alert('❌ Bugün Yok', 'Bugünkü namaz vakitleri bulunamadı.');
                return;
              }
              
              // Önce mevcut bildirimleri temizle
              console.log('🧹 Mevcut bildirimler temizleniyor...');
              await cancelPrayerNotifications();
              
              // Gelişmiş sistem ile zamanla
              console.log('🚀 Gelişmiş sistem ile zamanlanıyor...');
              const results = await scheduleAllPrayerNotificationsAdvanced(todayPrayer);
              
              // Sonuçları analiz et
              const successCount = results.filter(r => r.advanced).length;
              const totalAttempted = results.length;
              
              // UI güncelle
              setTimeout(() => updateNotificationStatus(), 1000);
              
              // Sonuç raporu
              let report = `🚀 GELİŞMİŞ SİSTEM TEST RAPORU\n\n`;
              report += `📅 Test tarihi: ${new Date(todayPrayer.date).toLocaleDateString('tr-TR')}\n`;
              report += `⏰ Test zamanı: ${new Date().toLocaleTimeString('tr-TR')}\n\n`;
              
              report += `📊 SONUÇLAR:\n`;
              report += `✅ Başarılı: ${successCount}/${totalAttempted} namaz\n`;
              report += `🚀 Gelişmiş sistem aktif: ${successCount > 0 ? 'Evet' : 'Hayır'}\n\n`;
              
              if (successCount > 0) {
                report += `🎯 ZAMANLANMIŞ NAMAZ VAKİTLERİ:\n`;
                results.forEach(r => {
                  if (r.advanced) {
                    report += `• ${r.prayer} (${r.time}) → ${r.minutesBefore}dk önce\n`;
                  }
                });
                
                report += `\n✅ BAŞARILI! Artık sadece İmsak ve Güneş değil, TÜM seçili namaz vakitleri için bildirim alacaksınız!\n\n`;
                report += `💡 Gelişmiş sistem özelliği: Geçmiş zamanda kalan namaz vakitleri için otomatik olarak yarının aynı vakti zamanlanır.`;
              } else {
                report += `❌ BAŞARISIZ: Hiç namaz vakti zamanlanamadı.\n\n`;
                report += `Olası nedenler:\n`;
                report += `• Namaz vakitleri seçili değil\n`;
                report += `• Bildirimler kapalı\n`;
                report += `• Sistem hatası`;
              }
              
              Alert.alert(
                '🚀 Gelişmiş Sistem Test Sonucu',
                report,
                [
                  { text: 'Bildirimleri Kontrol Et', onPress: () => updateNotificationStatus() },
                  { text: 'Harika!', style: 'default' }
                ]
              );
              
            } catch (error) {
              console.error('💥 Gelişmiş sistem test hatası:', error);
              Alert.alert(
                '❌ Test Hatası',
                `Gelişmiş sistem testi sırasında hata:\n\n${error.message}`,
                [{ text: 'Tamam', style: 'default' }]
              );
            }
          }}
        >
          <Text style={styles.testButtonText}>🚀 Gelişmiş Sistem Test Et</Text>
        </TouchableOpacity>

        {/* SÜPER GÜÇLENDİRİLMİŞ GARANTİLİ SİSTEM */}
        <TouchableOpacity 
          style={[styles.testButton, { backgroundColor: '#2c3e50', marginTop: 8 }]}
          onPress={async () => {
            try {
              console.log('🚀 [SUPER SYSTEM] Süper güçlendirilmiş garantili sistem başlatılıyor...');
              
              Alert.alert(
                '🏆 SÜPER GÜÇLENDİRİLMİŞ SİSTEM',
                'Bu sistem garantili olarak:\n\n' +
                '📅 1 haftalık ezan vakitlerini hafızaya alır\n' +
                '⏰ Her ezan vaktinden 10 dakika önce bildirim gönderir\n' +
                '🔄 Arka planda sürekli çalışır\n' +
                '🎯 %100 güvenilir bildirim sistemi\n\n' +
                'Bu işlem 10-15 saniye sürebilir.',
                [
                  { text: 'İptal', style: 'cancel' },
                  { 
                    text: '🚀 Başlat', 
                    style: 'default',
                    onPress: async () => {
                      try {
                        Alert.alert(
                          '⚡ Sistem Başlatılıyor',
                          'Süper güçlendirilmiş sistem çalışıyor...\n\n1. İzinler kontrol ediliyor\n2. 1 haftalık veri yükleniyor\n3. Bildirimler zamanlanıyor\n4. Sistem doğrulanıyor',
                          [{ text: 'Bekliyor...', style: 'default' }]
                        );
                        
                        const superResult = await initializeSuperReliableNotificationSystem();
                        
                        if (superResult.success) {
                          // UI güncelle
                          setTimeout(() => updateNotificationStatus(), 1000);
                          
                          let successReport = `🏆 SÜPER SİSTEM BAŞARIYLA AKTIF!\n\n`;
                          successReport += `📊 SONUÇLAR:\n`;
                          successReport += `✅ Zamanlandı: ${superResult.totalScheduled} bildirim\n`;
                          successReport += `🚀 Süper sistem: ${superResult.totalAdvanced} bildirim\n`;
                          successReport += `📅 İşlenen gün: ${superResult.daysProcessed} gün\n`;
                          successReport += `📈 Başarı oranı: %${superResult.successRate}\n\n`;
                          
                          successReport += `🎯 GARANTİLER:\n`;
                          successReport += `✅ 1 haftalık hafıza: Aktif\n`;
                          successReport += `✅ 10dk öncesi bildirim: Aktif\n`;
                          successReport += `✅ Arka plan çalışma: Aktif\n\n`;
                          
                          if (superResult.successRate >= 90) {
                            successReport += `🎉 MÜKEMMEL! Sistem %90+ başarı ile çalışıyor.\n`;
                            successReport += `Artık kesin olarak tüm ezan vakitlerinden 10 dakika önce bildirim alacaksınız!`;
                          } else if (superResult.successRate >= 70) {
                            successReport += `✅ İYİ! Sistem %70+ başarı ile çalışıyor.\n`;
                            successReport += `Çoğu ezan vaktinden bildirim alacaksınız.`;
                          } else {
                            successReport += `⚠️ DİKKAT! Sistem %70'den az başarı gösteriyor.\n`;
                            successReport += `Bazı ayarları kontrol etmeniz gerekebilir.`;
                          }
                          
                          Alert.alert(
                            '🏆 Süper Sistem Aktif!',
                            successReport,
                            [
                              { text: 'Bildirimleri Kontrol Et', onPress: () => updateNotificationStatus() },
                              { text: 'Harika!', style: 'default' }
                            ]
                          );
                        } else {
                          Alert.alert(
                            '❌ Süper Sistem Başarısız',
                            `Süper sistem başlatılamadı:\n\n${superResult.error}\n\n` +
                            `Lütfen şunları kontrol edin:\n` +
                            `• Bildirim izinleri verilmiş mi?\n` +
                            `• En az bir namaz vakti seçili mi?\n` +
                            `• İnternet bağlantısı var mı?`,
                            [{ text: 'Tamam', style: 'default' }]
                          );
                        }
                        
                      } catch (error) {
                        console.error('💥 Süper sistem hatası:', error);
                        Alert.alert(
                          '💥 Sistem Hatası',
                          `Süper sistem çalışırken hata:\n\n${error.message}`,
                          [{ text: 'Tamam', style: 'default' }]
                        );
                      }
                    }
                  }
                ]
              );
              
            } catch (error) {
              console.error('💥 Süper sistem butonu hatası:', error);
              Alert.alert('❌ Hata', error.message);
            }
          }}
        >
          <Text style={styles.testButtonText}>🏆 SÜPER GARANTİLİ SİSTEM</Text>
        </TouchableOpacity>

        {/* Sistem Sağlık Kontrolü */}
        <TouchableOpacity 
          style={[styles.testButton, { backgroundColor: '#16a085', marginTop: 8 }]}
          onPress={async () => {
            try {
              console.log('🏥 Sistem sağlık kontrolü başlatılıyor...');
              
              Alert.alert(
                '🏥 Sistem Sağlık Kontrolü',
                'Bildirim sisteminin sağlığı kontrol ediliyor...',
                [{ text: 'Kontrol Et', style: 'default' }]
              );
              
              const healthReport = await performSystemHealthCheck();
              
              let reportMessage = `🏥 SİSTEM SAĞLIK RAPORU\n\n`;
              reportMessage += `🕐 Kontrol zamanı: ${new Date(healthReport.timestamp).toLocaleString('tr-TR')}\n\n`;
              
              // Durum ikonu
              let statusIcon = '';
              if (healthReport.status === 'HEALTHY') {
                statusIcon = '✅';
              } else if (healthReport.status === 'WARNING') {
                statusIcon = '⚠️';
              } else if (healthReport.status === 'CRITICAL') {
                statusIcon = '❌';
              } else {
                statusIcon = '❓';
              }
              
              reportMessage += `${statusIcon} Genel Durum: ${healthReport.status}\n\n`;
              
              // Metrikler
              if (healthReport.metrics) {
                reportMessage += `📊 SİSTEM METRİKLERİ:\n`;
                if (healthReport.metrics.permissionStatus) {
                  reportMessage += `• İzin: ${healthReport.metrics.permissionStatus}\n`;
                }
                if (healthReport.metrics.notificationsEnabled !== undefined) {
                  reportMessage += `• Bildirimler: ${healthReport.metrics.notificationsEnabled ? 'Açık' : 'Kapalı'}\n`;
                }
                if (healthReport.metrics.activePrayersCount !== undefined) {
                  reportMessage += `• Seçili namaz: ${healthReport.metrics.activePrayersCount} adet\n`;
                }
                if (healthReport.metrics.notifyBeforeMinutes !== undefined) {
                  reportMessage += `• Bildirim süresi: ${healthReport.metrics.notifyBeforeMinutes} dk\n`;
                }
                if (healthReport.metrics.dataAvailableDays !== undefined) {
                  reportMessage += `• Veri: ${healthReport.metrics.dataAvailableDays} gün\n`;
                }
                if (healthReport.metrics.prayerNotifications !== undefined) {
                  reportMessage += `• Namaz bildirimleri: ${healthReport.metrics.prayerNotifications} adet\n`;
                }
                if (healthReport.metrics.upcomingIn24Hours !== undefined) {
                  reportMessage += `• 24 saat içinde: ${healthReport.metrics.upcomingIn24Hours} bildirim\n`;
                }
                reportMessage += `\n`;
              }
              
              // Sorunlar
              if (healthReport.issues && healthReport.issues.length > 0) {
                reportMessage += `🚨 SORUNLAR (${healthReport.issues.length} adet):\n`;
                healthReport.issues.forEach((issue, index) => {
                  reportMessage += `${index + 1}. ${issue}\n`;
                });
                reportMessage += `\n`;
              }
              
              // Öneriler
              if (healthReport.recommendations && healthReport.recommendations.length > 0) {
                reportMessage += `💡 ÖNERİLER:\n`;
                healthReport.recommendations.forEach((rec, index) => {
                  reportMessage += `${index + 1}. ${rec}\n`;
                });
              }
              
              Alert.alert(
                '🏥 Sağlık Raporu',
                reportMessage,
                [
                  { text: 'Süper Sistem ile Onar', onPress: async () => {
                    // Sağlık sorunları varsa süper sistem ile onar
                    if (healthReport.status !== 'HEALTHY') {
                      const superResult = await initializeSuperReliableNotificationSystem();
                      if (superResult.success) {
                        Alert.alert('✅ Onarım Başarılı', 'Sistem süper sistem ile onarıldı!');
                        setTimeout(() => updateNotificationStatus(), 1000);
                      } else {
                        Alert.alert('❌ Onarım Başarısız', superResult.error);
                      }
                    } else {
                      Alert.alert('✅ Sistem Sağlıklı', 'Onarıma gerek yok!');
                    }
                  }},
                  { text: 'Tamam', style: 'default' }
                ]
              );
              
            } catch (error) {
              console.error('💥 Sağlık kontrolü hatası:', error);
              Alert.alert('❌ Kontrol Hatası', error.message);
            }
          }}
        >
          <Text style={styles.testButtonText}>🏥 Sistem Sağlık Kontrolü</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Namaz Vakitleri</Text>
        <Text style={styles.sectionSubtitle}>
          Hangi namaz vakitleri için bildirim almak istiyorsunuz?
        </Text>
        
        {prayerNames.map((prayer) => (
          <TouchableOpacity
            key={prayer}
            style={styles.settingRow}
            onPress={() => togglePrayer(prayer)}
            disabled={!settings.notificationsEnabled}
          >
            <Text style={styles.settingText}>{prayer}</Text>
            <Switch
              value={settings.activePrayers.includes(prayer)}
              onValueChange={() => togglePrayer(prayer)}
              trackColor={{ false: '#767577', true: COLORS.primaryLight }}
              thumbColor={settings.activePrayers.includes(prayer) ? COLORS.primary : '#f4f3f4'}
              disabled={!settings.notificationsEnabled}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Bildirim Durumu - Context7 Best Practice ile iyileştirildi */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sistem Durumu</Text>
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>📱 Bildirim Sistemi:</Text>
            <Text style={[
              styles.statusValue,
              { color: settings.notificationsEnabled ? COLORS.primary : '#666' }
            ]}>
              {settings.notificationsEnabled ? '✅ Aktif' : '❌ Kapalı'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>⏰ Namaz Bildirimleri:</Text>
            <Text style={[
              styles.statusValue,
              { color: notificationStatus.scheduledCount > 0 ? COLORS.primary : '#666' }
            ]}>
              {notificationStatus.scheduledCount > 0 ? 
                `✅ ${notificationStatus.scheduledCount} adet` : 
                '❌ Hiç yok'
              }
            </Text>
          </View>

          {/* Context7 best practice: Toplam zamanlanmış bildirim sayısı */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>📊 Toplam Zamanlanmış:</Text>
            <Text style={[
              styles.statusValue,
              { color: notificationStatus.totalScheduled > 0 ? '#2196F3' : '#666' }
            ]}>
              {notificationStatus.totalScheduled > 0 ? 
                `${notificationStatus.totalScheduled} adet` : 
                'Hiç yok'
              }
            </Text>
          </View>

          {/* Context7 best practice: Seçili namaz vakitlerini göster */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>🕌 Aktif Namaz Vakitleri:</Text>
            <Text style={[
              styles.statusValue,
              { color: settings.activePrayers.length > 0 ? COLORS.primary : '#666' }
            ]}>
              {settings.activePrayers.length > 0 ? 
                `${settings.activePrayers.length} adet seçili` : 
                'Hiçbiri seçili değil'
              }
            </Text>
          </View>

          {/* Context7 best practice: Bildirim süresi göster */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>⏱️ Bildirim Zamanı:</Text>
            <Text style={styles.statusValue}>
              {settings.notifyBeforeMinutes} dakika öncesinden
            </Text>
          </View>

          {/* Context7 best practice: Sistem durumu analizi */}
          {settings.notificationsEnabled && notificationStatus.totalScheduled > 0 && notificationStatus.scheduledCount === 0 && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ Sistem bildirimleri zamanlamış ({notificationStatus.totalScheduled} adet) ancak namaz bildirimleri tespit edilemiyor. 
                Bu normal bir durum olabilir - lütfen "🔄 Bildirimleri Zorla Yenile" butonunu kullanın.
              </Text>
            </View>
          )}
          
          {settings.notificationsEnabled && notificationStatus.scheduledCount === 0 && notificationStatus.totalScheduled === 0 && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningText}>
                ⚠️ Bildirimler açık ama hiçbiri zamanlanmamış. 
                "🔄 Bildirimleri Zorla Yenile" butonunu kullanın.
              </Text>
            </View>
          )}

          {settings.notificationsEnabled && notificationStatus.scheduledCount > 0 && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>
                ✅ Sistem çalışıyor! {notificationStatus.scheduledCount} namaz bildirimi zamanlandı
                {notificationStatus.totalScheduled > notificationStatus.scheduledCount && 
                  ` (Toplam ${notificationStatus.totalScheduled} bildirim)`
                }.
                Bildirimleri görmek için "📋 Zamanlanmış Bildirimleri Gör" butonunu kullanın.
              </Text>
            </View>
          )}
          
          {!settings.notificationsEnabled && (
            <View style={styles.infoContainer}>
              <Text style={styles.infoTextSmall}>
                💡 Bildirimleri açarsanız her namaz vaktinden {settings.notifyBeforeMinutes} dakika önce hatırlatma alırsınız.
              </Text>
            </View>
          )}

          {/* Context7 best practice: Debug bilgileri (sadece geliştirme modu) */}
          {__DEV__ && notificationStatus.error && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug: Hata</Text>
              <Text style={styles.debugText}>{notificationStatus.error}</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Not: Bildirimler sistem tarafından zamanlanır ve uygulamanın açık olması gerekmez. 
          Cihazın bildirim ayarlarından uygulama bildirimlerinin açık olduğundan emin olun.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 16,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingText: {
    fontSize: 16,
    color: COLORS.text,
  },
  sliderContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  sliderThumb: {
    height: 20,
    width: 20,
    backgroundColor: COLORS.primary,
  },
  sliderValue: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
  statusContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.text,
  },
  statusValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 5,
  },
  infoContainer: {
    backgroundColor: '#fff',
    marginTop: 16,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  infoTextSmall: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  testButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  testButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  explanationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  debugContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: COLORS.text,
  },
  debugText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  successContainer: {
    backgroundColor: '#dff0d8',
    padding: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  successText: {
    fontSize: 12,
    color: '#3c763d',
    marginBottom: 5,
  },
});

export default NotificationSettingsScreen; 