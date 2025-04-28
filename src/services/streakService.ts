import AsyncStorage from '@react-native-async-storage/async-storage';

// Streak için storage anahtarları
const STREAK_COUNT_KEY = 'streak_count';
const LAST_COMPLETED_DATE_KEY = 'last_completed_date';
const DAILY_PRAYER_COMPLETION_KEY = 'daily_prayer_completion';
const STREAK_FREEZE_KEY = 'streak_freeze_count'; // Streak dondurma sayısı için yeni anahtar

// Günlük sure tamamlama durumu için storage anahtarı
const DAILY_SURAH_COMPLETION_KEY = 'daily_surah_completion';

/**
 * Streak sayısını getir
 */
export const getStreakCount = async (): Promise<number> => {
  try {
    const streakCount = await AsyncStorage.getItem(STREAK_COUNT_KEY);
    return streakCount ? parseInt(streakCount, 10) : 0;
  } catch (error) {
    console.error('Streak sayısı alınamadı:', error);
    return 0;
  }
};

/**
 * Son tamamlanan tarihi getir
 */
export const getLastCompletedDate = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(LAST_COMPLETED_DATE_KEY);
  } catch (error) {
    console.error('Son tamamlanan tarih alınamadı:', error);
    return null;
  }
};

/**
 * Günlük namazların tamamlanma durumunu kontrol eder
 * @returns {Promise<boolean>} Tüm günlük namazlar tamamlandıysa true, aksi halde false
 */
export async function getDailyPrayerCompletion(): Promise<boolean> {
  try {
    const dailyPrayerCompletionStr = await AsyncStorage.getItem(DAILY_PRAYER_COMPLETION_KEY);
    return dailyPrayerCompletionStr === 'true';
  } catch (error) {
    console.error('Günlük namaz tamamlama durumu alınırken hata:', error);
    return false;
  }
}

/**
 * Streak dondurma sayısını getir
 */
export const getStreakFreezeCount = async (): Promise<number> => {
  try {
    const freezeCount = await AsyncStorage.getItem(STREAK_FREEZE_KEY);
    return freezeCount ? parseInt(freezeCount, 10) : 0;
  } catch (error) {
    console.error('Streak dondurma sayısı alınamadı:', error);
    return 0;
  }
};

/**
 * Streak dondurma sayısını güncelle
 */
export const updateStreakFreezeCount = async (count: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(STREAK_FREEZE_KEY, count.toString());
    console.log(`Streak dondurma sayısı güncellendi: ${count}`);
  } catch (error) {
    console.error('Streak dondurma sayısı güncellenemedi:', error);
  }
};

/**
 * Günlük namaz tamamlama durumunu güncelle
 */
export const updateDailyPrayerCompletion = async (completed: boolean): Promise<void> => {
  try {
    console.log(`Namaz tamamlama durumu güncelleniyor: ${completed}`);
    await AsyncStorage.setItem(DAILY_PRAYER_COMPLETION_KEY, completed.toString());
    
    // Namaz tamamlandıysa, günlük sureleri de kontrol et
    if (completed) {
      const surahCompleted = await getDailySurahCompletion();
      
      // Eğer hem namazlar hem de sureler tamamlandıysa, streak'i güncelle
      if (surahCompleted) {
        console.log('Hem namazlar hem de sureler tamamlandı, streak güncellenecek');
        const result = await checkAndUpdateStreak();
        console.log(`Streak güncelleme sonucu: ${result.updated}, yeni streak: ${result.streakCount}`);
      } else {
        console.log('Namazlar tamamlandı fakat sureler henüz tamamlanmadı. Streak güncellenmedi.');
      }
    } else {
      console.log('Namazlar tamamlanmadı, streak güncellenmedi');
    }
  } catch (error) {
    console.error('Günlük namaz tamamlama durumu güncellenemedi:', error);
  }
};

/**
 * Streak durumunu kontrol et ve güncelle
 * @returns Streak güncellenip güncellenmediği ve güncel streak sayısı
 */
export const checkAndUpdateStreak = async (): Promise<{updated: boolean, streakCount: number}> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatı
    const lastCompletedDate = await getLastCompletedDate();
    const prayerCompleted = await getDailyPrayerCompletion();
    const surahCompleted = await getDailySurahCompletion();
    
    // Her iki görev de tamamlanmalı
    const allTasksCompleted = prayerCompleted && surahCompleted;
    
    console.log(`Streak kontrolü - Bugün: ${today}, Son tamamlanan: ${lastCompletedDate || 'Yok'}`);
    console.log(`Namaz tamamlandı: ${prayerCompleted}, Sure tamamlandı: ${surahCompleted}, Tüm görevler tamamlandı: ${allTasksCompleted}`);
    
    let streakCount = await getStreakCount();
    let updated = false;
    
    // Eğer tüm görevler tamamlandıysa
    if (allTasksCompleted) {
      console.log('Tüm görevler tamamlandı, streak kontrolü yapılıyor');
      
      // Eğer son tamamlanan tarih bugün değilse
      if (lastCompletedDate !== today) {
        console.log('Bugün için henüz streak güncellenmemiş');
        
        // Eğer son tamamlanan tarih yoksa ve ilk kez tamamlanıyorsa
        if (!lastCompletedDate) {
          // İlk kez tamamlanıyorsa, streak'i 1 yap
          streakCount = 1;
          console.log('İlk kez tamamlandı, streak 1 yapıldı');
          updated = true;
        } else {
          // Son tamamlanan tarihi kontrol et
          const lastDate = new Date(lastCompletedDate);
          const currentDate = new Date(today);
          
          // Tarihler arasındaki farkı hesapla (gün olarak)
          const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          console.log(`Son tamamlanmadan bu yana geçen gün: ${diffDays}`);
          
          if (diffDays === 1) {
            // Dün tamamlanmışsa, streak'i artır
            streakCount += 1;
            console.log(`Streak artırıldı: ${streakCount}`);
            updated = true;
          } else if (diffDays > 1) {
            // Bir günden fazla geçmişse, streak dondurma hakkı var mı kontrol et
            const freezeCount = await getStreakFreezeCount();
            
            if (freezeCount > 0) {
              // Streak dondurma hakkı varsa, streak'i koruyup dondurma hakkını azalt
              await updateStreakFreezeCount(freezeCount - 1);
              console.log(`Streak dondurma hakkı kullanıldı. Kalan: ${freezeCount - 1}`);
            } else {
              // Streak dondurma hakkı yoksa, streak'i sıfırla
              streakCount = 1; // Duolingo tarzı, bugün tamamlandığı için 1'den başlat
              console.log('Streak sıfırlandı ve 1 yapıldı (bir günden fazla geçmiş)');
            }
            updated = true;
          }
        }
        
        // Son tamamlanan tarihi güncelle
        await AsyncStorage.setItem(LAST_COMPLETED_DATE_KEY, today);
        console.log(`Son tamamlanan tarih güncellendi: ${today}`);
        
        // Streak sayısını güncelle
        await AsyncStorage.setItem(STREAK_COUNT_KEY, streakCount.toString());
        console.log(`Streak sayısı kaydedildi: ${streakCount}`);
      } else {
        console.log('Bugün zaten tamamlanmış, streak güncellenmedi');
      }
    } else {
      console.log('Tüm görevler henüz tamamlanmadı, streak güncellenmedi');
      
      // Eğer son tamamlanan tarih varsa ve bugün değilse, streak'i kontrol et
      if (lastCompletedDate && lastCompletedDate !== today) {
        const lastDate = new Date(lastCompletedDate);
        const currentDate = new Date(today);
        
        // Tarihler arasındaki farkı hesapla (gün olarak)
        const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Eğer bir günden fazla geçmişse ve görevler tamamlanmamışsa, streak dondurma hakkı var mı kontrol et
        if (diffDays > 1) {
          const freezeCount = await getStreakFreezeCount();
          
          if (freezeCount > 0) {
            // Streak dondurma hakkı varsa, streak'i koruyup dondurma hakkını azalt
            await updateStreakFreezeCount(freezeCount - 1);
            console.log(`Streak dondurma hakkı kullanıldı. Kalan: ${freezeCount - 1}`);
          } else {
            // Streak dondurma hakkı yoksa, streak'i sıfırla
            streakCount = 0;
            console.log('Görevler tamamlanmadı ve bir günden fazla geçti, streak sıfırlandı');
            await AsyncStorage.setItem(STREAK_COUNT_KEY, streakCount.toString());
          }
          updated = true;
        }
      }
    }
    
    return { updated, streakCount };
  } catch (error) {
    console.error('Streak durumu güncellenirken hata oluştu:', error);
    return { updated: false, streakCount: await getStreakCount() };
  }
};

/**
 * Günlük tamamlama durumlarını sıfırla (yeni gün başladığında)
 */
export const resetDailyCompletions = async (): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastCompletedDate = await getLastCompletedDate();
    const lastResetDate = await AsyncStorage.getItem('last_reset_date');
    
    console.log(`Günlük tamamlama kontrolü - Bugün: ${today}, Son tamamlanan: ${lastCompletedDate || 'Yok'}, Son sıfırlama: ${lastResetDate || 'Yok'}`);
    
    // Eğer bugün zaten sıfırlama yapıldıysa tekrar yapma
    if (lastResetDate === today) {
      console.log('Bugün zaten sıfırlama yapılmış, tekrar yapılmayacak');
      return;
    }
    
    // Eğer son tamamlanan tarih bugün değilse, günlük tamamlama durumlarını sıfırla
    if (lastCompletedDate !== today) {
      console.log('Yeni gün başladı, günlük tamamlama durumları sıfırlanıyor');
      await AsyncStorage.setItem(DAILY_PRAYER_COMPLETION_KEY, 'false');
      
      // Namaz durumlarını sıfırla
      const defaultPrayerStatus = [
        { type: 'fajr', completed: false },
        { type: 'dhuhr', completed: false },
        { type: 'asr', completed: false },
        { type: 'maghrib', completed: false },
        { type: 'isha', completed: false }
      ];
      await AsyncStorage.setItem('prayer_tracking', JSON.stringify(defaultPrayerStatus));
      await AsyncStorage.setItem('prayer_tracking_date', today);
      
      // Eğer son tamamlanan tarih varsa ve bir günden fazla geçmişse, streak'i kontrol et
      if (lastCompletedDate) {
        const lastDate = new Date(lastCompletedDate);
        const currentDate = new Date(today);
        
        // Tarihler arasındaki farkı hesapla (gün olarak)
        const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 1) {
          // Streak dondurma hakkı var mı kontrol et
          const freezeCount = await getStreakFreezeCount();
          
          if (freezeCount > 0) {
            // Streak dondurma hakkı varsa, streak'i koruyup dondurma hakkını azalt
            await updateStreakFreezeCount(freezeCount - 1);
            console.log(`Streak dondurma hakkı kullanıldı. Kalan: ${freezeCount - 1}`);
          } else {
            console.log('Bir günden fazla geçmiş, streak sıfırlanıyor');
            await AsyncStorage.setItem(STREAK_COUNT_KEY, '0');
          }
        }
      }
      
      // Son sıfırlama tarihini güncelle
      await AsyncStorage.setItem('last_reset_date', today);
      console.log('Tüm tamamlama durumları sıfırlandı ve son sıfırlama tarihi güncellendi');
    } else {
      console.log('Aynı gün içinde, günlük tamamlama durumları korunuyor');
    }
  } catch (error) {
    console.error('Günlük tamamlama durumları sıfırlanırken hata oluştu:', error);
  }
};

/**
 * Namaz tamamlama durumunu kontrol et
 * @param prayerStatuses Namaz durumları
 * @returns Tüm namazlar tamamlandı mı?
 */
export const checkPrayerCompletion = (prayerStatuses: any[]): boolean => {
  // Her namazın tamamlanıp tamamlanmadığını kontrol et
  const allCompleted = prayerStatuses.every(prayer => prayer.completed === true);
  
  console.log(`Namaz tamamlama kontrolü: ${allCompleted ? 'Tamamlandı' : 'Tamamlanmadı'}`);
  
  return allCompleted;
};

/**
 * Streak'i manuel olarak sıfırla (test için)
 */
export const resetStreak = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(STREAK_COUNT_KEY, '0');
    console.log('Streak sıfırlandı');
  } catch (error) {
    console.error('Streak sıfırlanırken hata oluştu:', error);
  }
};

/**
 * Streak'i manuel olarak güncelle (test için)
 * @param count Yeni streak sayısı
 * @returns Güncellenen streak sayısı
 */
export const forceUpdateStreak = async (count: number): Promise<number> => {
  try {
    await AsyncStorage.setItem(STREAK_COUNT_KEY, count.toString());
    console.log(`Streak ${count} olarak güncellendi`);
    return count;
  } catch (error) {
    console.error('Streak güncellenirken hata oluştu:', error);
    return await getStreakCount(); // Hata durumunda mevcut streak sayısını döndür
  }
};

/**
 * Streak dondurma hakkı ekle
 */
export const addStreakFreeze = async (count: number = 1): Promise<number> => {
  try {
    const currentCount = await getStreakFreezeCount();
    const newCount = currentCount + count;
    await updateStreakFreezeCount(newCount);
    console.log(`Streak dondurma hakkı eklendi. Yeni toplam: ${newCount}`);
    return newCount;
  } catch (error) {
    console.error('Streak dondurma hakkı eklenirken hata oluştu:', error);
    return await getStreakFreezeCount();
  }
};

/**
 * Streak bilgilerini getir
 * @returns Streak sayısı, streak dondurma hakkı ve son tamamlanan tarih
 */
export const getStreakInfo = async (): Promise<{
  streakCount: number;
  freezeCount: number;
  lastCompletedDate: string | null;
}> => {
  try {
    const streakCount = await getStreakCount();
    const freezeCount = await getStreakFreezeCount();
    const lastCompletedDate = await getLastCompletedDate();
    
    return {
      streakCount,
      freezeCount,
      lastCompletedDate
    };
  } catch (error) {
    console.error('Streak bilgileri alınırken hata oluştu:', error);
    return {
      streakCount: 0,
      freezeCount: 0,
      lastCompletedDate: null
    };
  }
};

/**
 * Sure tamamlama durumunu kontrol eder
 * @param completedCount Tamamlanan sure sayısı
 * @returns Yeterli sayıda sure tamamlandı mı?
 */
export const checkSurahCompletion = (completedCount: number): boolean => {
  // Tamamlanan sure sayısı 5 veya daha fazla ise tamamlandı kabul et
  const completed = completedCount >= 5;
  
  console.log(`Sure tamamlama kontrolü: ${completed ? 'Tamamlandı' : 'Tamamlanmadı'} (${completedCount}/5)`);
  
  return completed;
};

/**
 * Günlük sure tamamlama durumunu güncelle
 */
export const updateDailySurahCompletion = async (completed: boolean): Promise<void> => {
  try {
    console.log(`Sure tamamlama durumu güncelleniyor: ${completed}`);
    await AsyncStorage.setItem(DAILY_SURAH_COMPLETION_KEY, completed.toString());
    
    // Sure tamamlandıysa, günlük namazları da kontrol et
    if (completed) {
      const prayerCompleted = await getDailyPrayerCompletion();
      
      // Eğer hem sureler hem de namazlar tamamlandıysa, streak'i güncelle
      if (prayerCompleted) {
        console.log('Hem sureler hem de namazlar tamamlandı, streak güncellenecek');
        const result = await checkAndUpdateStreak();
        console.log(`Streak güncelleme sonucu: ${result.updated}, yeni streak: ${result.streakCount}`);
      } else {
        console.log('Sureler tamamlandı fakat namazlar henüz tamamlanmadı. Streak güncellenmedi.');
      }
    } else {
      console.log('Sureler tamamlanmadı, streak güncellenmedi');
    }
  } catch (error) {
    console.error('Günlük sure tamamlama durumu güncellenemedi:', error);
  }
};

/**
 * Günlük sure tamamlama durumunu kontrol eder
 * @returns {Promise<boolean>} Tüm günlük sureler tamamlandıysa true, aksi halde false
 */
export async function getDailySurahCompletion(): Promise<boolean> {
  try {
    const dailySurahCompletionStr = await AsyncStorage.getItem(DAILY_SURAH_COMPLETION_KEY);
    return dailySurahCompletionStr === 'true';
  } catch (error) {
    console.error('Günlük sure tamamlama durumu alınırken hata:', error);
    return false;
  }
} 