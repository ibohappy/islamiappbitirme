import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API URL'leri - Düzeltildi
const API_BASE_URL = 'https://api.acikkuran.com';
const AUDIO_BASE_URL = 'https://audio.acikkuran.com';

// Günlük sureler için storage anahtarı
const DAILY_SURAHS_STORAGE_KEY = 'daily_surahs';
const DAILY_SURAHS_DATE_KEY = 'daily_surahs_date';

// Sure arayüzü
export interface SurahData {
  id: number;
  name: string;
  name_tr: string;
  verse_count: number;
  page_number: number;
  arabic: string;
  translation: string;
  audio_url: string;
  transcription_tr: string; // Türkçe okunuş
  transcription_en: string; // İngilizce okunuş
  verse_number: number;     // Ayet numarası
  juz_number: number;       // Cüz numarası
  has_audio: boolean;       // Ses dosyası var mı?
}

/**
 * Belirli bir sure ID'si için sure bilgilerini getirir
 */
export const fetchSurah = async (surahId: number): Promise<SurahData | null> => {
  try {
    console.log(`Sure bilgileri getiriliyor: ${surahId}`);
    
    // Doğru endpoint: /surah/[id]
    const response = await fetch(`${API_BASE_URL}/surah/${surahId}`);
    
    if (!response.ok) {
      throw new Error(`API isteği başarısız: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.data) {
      throw new Error('API yanıtı geçersiz format');
    }
    
    const surahInfo = data.data;
    console.log(`Sure bilgileri alındı: ${surahInfo.name}`);
    
    // Ses dosyası URL'ini oluştur
    // API'den gelen audio bilgisi varsa onu kullan, yoksa standart formatı kullan
    const audioUrl = surahInfo.audio?.mp3 || `${AUDIO_BASE_URL}/tr/${surahId}.mp3`;
    
    // API'den gelen veriyi SurahData formatına dönüştür
    const surahData: SurahData = {
      id: surahInfo.id,
      name: surahInfo.name_original || surahInfo.name,
      name_tr: surahInfo.name,
      verse_count: surahInfo.verse_count,
      page_number: surahInfo.page_number || 0,
      arabic: '', // Arapça metin için ayrı bir istek gerekebilir
      translation: '', // Çeviri için ayrı bir istek gerekebilir
      audio_url: audioUrl,
      transcription_tr: '',
      transcription_en: '',
      verse_number: 1,
      juz_number: surahInfo.juz_number || 1,
      has_audio: true // Başlangıçta true olarak ayarla, sonra kontrol et
    };
    
    // İlk ayeti getir - Doğru endpoint: /surah/[id]/verse/1
    try {
      console.log(`İlk ayet bilgileri getiriliyor: ${surahId}/1`);
      const verseResponse = await fetch(`${API_BASE_URL}/surah/${surahId}/verse/1`);
      
      if (verseResponse.ok) {
        const verseData = await verseResponse.json();
        
        if (verseData && verseData.data) {
          const verse = verseData.data;
          console.log(`Ayet bilgileri alındı: ${verse.verse_number}`);
          
          surahData.arabic = verse.verse || '';
          surahData.translation = verse.translation?.text || '';
          surahData.transcription_tr = verse.transcription || '';
          surahData.transcription_en = verse.transcription_en || '';
          surahData.verse_number = verse.verse_number || 1;
          surahData.juz_number = verse.juz_number || 1;
        }
      } else {
        console.error(`Ayet bilgileri alınamadı: ${verseResponse.status}`);
      }
    } catch (error) {
      console.error('Ayet bilgileri alınamadı:', error);
    }
    
    // Eğer Arapça metin veya çeviri alınamadıysa, alternatif kaynaklardan dene
    if (!surahData.arabic || !surahData.translation) {
      try {
        // Alternatif API endpoint'i
        const alternativeResponse = await fetch(`https://api.alquran.cloud/v1/surah/${surahId}/editions/quran-uthmani,tr.diyanet`);
        
        if (alternativeResponse.ok) {
          const alternativeData = await alternativeResponse.json();
          
          if (alternativeData && alternativeData.data && alternativeData.data.length >= 2) {
            // Arapça metin
            const arabicEdition = alternativeData.data.find((edition: any) => edition.edition.language === 'ar');
            if (arabicEdition && arabicEdition.ayahs && arabicEdition.ayahs.length > 0) {
              surahData.arabic = arabicEdition.ayahs[0].text || '';
            }
            
            // Türkçe çeviri
            const turkishEdition = alternativeData.data.find((edition: any) => edition.edition.language === 'tr');
            if (turkishEdition && turkishEdition.ayahs && turkishEdition.ayahs.length > 0) {
              surahData.translation = turkishEdition.ayahs[0].text || '';
            }
            
            console.log('Alternatif kaynaktan sure bilgileri alındı');
          }
        }
      } catch (error) {
        console.error('Alternatif kaynaktan sure bilgileri alınamadı:', error);
      }
    }
    
    // Eğer hala Arapça metin veya çeviri yoksa, bazı yaygın sureler için sabit değerler kullan
    if (!surahData.arabic || !surahData.translation) {
      const commonSurahs: Record<number, { arabic: string, translation: string, transcription: string }> = {
        1: {
          arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ﴿١﴾ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ﴿٢﴾ الرَّحْمَٰنِ الرَّحِيمِ ﴿٣﴾ مَالِكِ يَوْمِ الدِّينِ ﴿٤﴾ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ﴿٥﴾ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ﴿٦﴾ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ ﴿٧﴾',
          translation: 'Rahman ve Rahim olan Allah\'ın adıyla. Hamd, âlemlerin Rabbi Allah\'a mahsustur. O, Rahman\'dır ve Rahim\'dir. Din gününün sahibidir. (Rabbimiz!) Ancak sana kulluk ederiz ve yalnız senden yardım dileriz. Bizi doğru yola ilet. Kendilerine nimet verdiklerinin yoluna; gazaba uğrayanların ve sapkınlarınkine değil.',
          transcription: 'Bismillahirrahmanirrahim. Elhamdulillahi rabbil alemin. Errahmanir rahim. Maliki yevmiddin. İyyake na\'budu ve iyyake nestain. İhdinessıratel mustekim. Sıratelleziyne en\'amte aleyhim ğayril mağdubi aleyhim ve leddaaaallin.'
        },
        112: {
          arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ﴿١﴾ قُلْ هُوَ اللَّهُ أَحَدٌ ﴿١﴾ اللَّهُ الصَّمَدُ ﴿٢﴾ لَمْ يَلِدْ وَلَمْ يُولَدْ ﴿٣﴾ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ ﴿٤﴾',
          translation: 'Rahman ve Rahim olan Allah\'ın adıyla. De ki: O, Allah\'tır, bir tektir. Allah Samed\'dir (Her şey O\'na muhtaçtır, O hiçbir şeye muhtaç değildir). O doğurmamış ve doğmamıştır. Hiçbir şey O\'na denk değildir.',
          transcription: 'Bismillahirrahmanirrahim. Kul hüvellahü ehad. Allahüssamed. Lem yelid ve lem yuled. Ve lem yekün lehü küfüven ehad.'
        },
        113: {
          arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ﴿١﴾ قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ﴿١﴾ مِنْ شَرِّ مَا خَلَقَ ﴿٢﴾ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ﴿٣﴾ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ﴿٤﴾ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ ﴿٥﴾',
          translation: 'Rahman ve Rahim olan Allah\'ın adıyla. De ki: Yarattığı şeylerin şerrinden, karanlığı çöktüğü zaman gecenin şerrinden, düğümlere üfleyenlerin şerrinden ve haset ettiği zaman hasetçinin şerrinden sabahın Rabbine sığınırım.',
          transcription: 'Bismillahirrahmanirrahim. Kul euzü birabbil felak. Min şerri ma halak. Ve min şerri ğasikin iza vekab. Ve min şerrin neffasati fil ukad. Ve min şerri hasidin iza hased.'
        },
        114: {
          arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ﴿١﴾ قُلْ أَعُوذُ بِرَبِّ النَّاسِ ﴿١﴾ مَلِكِ النَّاسِ ﴿٢﴾ إِلَٰهِ النَّاسِ ﴿٣﴾ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ﴿٤﴾ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ﴿٥﴾ مِنَ الْجِنَّةِ وَالنَّاسِ ﴿٦﴾',
          translation: 'Rahman ve Rahim olan Allah\'ın adıyla. De ki: İnsanların Rabbine, insanların Melikine (mutlak sahip ve hakimine), insanların İlahına sığınırım. O sinsi vesvesecinin şerrinden. O ki, insanların göğüslerine vesvese verir. (O), cinlerden ve insanlardandır.',
          transcription: 'Bismillahirrahmanirrahim. Kul euzü birabbin nas. Melikin nas. İlahin nas. Min şerril vesvasil hannas. Ellezi yüvesvisü fi sudurin nas. Minel cinneti ven nas.'
        }
      };
      
      if (commonSurahs[surahId]) {
        surahData.arabic = commonSurahs[surahId].arabic;
        surahData.translation = commonSurahs[surahId].translation;
        surahData.transcription_tr = commonSurahs[surahId].transcription;
        console.log('Sabit sure bilgileri kullanıldı');
      }
    }
    
    // Ses dosyasının varlığını kontrol et
    try {
      // HEAD isteği yerine, ses dosyasının varlığını varsayalım
      // Çünkü CORS politikaları HEAD isteklerini engelleyebilir
      surahData.has_audio = true;
      
      // Eğer API'den gelen audio bilgisi varsa, ses dosyası var demektir
      if (surahInfo.audio && surahInfo.audio.mp3) {
        console.log(`Ses dosyası mevcut: ${surahInfo.audio.mp3}`);
        surahData.has_audio = true;
      }
    } catch (error) {
      console.error('Ses dosyası kontrolü başarısız:', error);
      // Hata olsa bile ses dosyasının var olduğunu varsayalım
      surahData.has_audio = true;
    }
    
    return surahData;
  } catch (error) {
    console.error('Sure bilgileri alınamadı:', error);
    return null;
  }
};

/**
 * Rastgele 5 sure ID'si oluşturur
 */
const generateRandomSurahIds = (): number[] => {
  const surahIds: number[] = [];
  const totalSurahs = 114; // Kuran'da toplam 114 sure var
  
  while (surahIds.length < 5) {
    const randomId = Math.floor(Math.random() * totalSurahs) + 1;
    
    // Tekrar eden sure ID'lerini önle
    if (!surahIds.includes(randomId)) {
      surahIds.push(randomId);
    }
  }
  
  return surahIds;
};

/**
 * Günlük sureleri getirir veya oluşturur
 */
export const getDailySurahs = async (): Promise<SurahData[]> => {
  try {
    // Bugünün tarihini kontrol et
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD formatı
    console.log(`Bugünün tarihi: ${today}`);
    
    const storedDate = await AsyncStorage.getItem(DAILY_SURAHS_DATE_KEY);
    console.log(`Kayıtlı tarih: ${storedDate || 'Yok'}`);
    
    // Eğer bugün için sureler zaten oluşturulmuşsa, onları getir
    if (storedDate === today) {
      console.log('Bugün için kayıtlı sureler bulundu, onları getiriyorum');
      const storedSurahs = await AsyncStorage.getItem(DAILY_SURAHS_STORAGE_KEY);
      
      if (storedSurahs) {
        const parsedSurahs = JSON.parse(storedSurahs);
        console.log(`${parsedSurahs.length} sure yüklendi`);
        return parsedSurahs;
      }
    } else {
      console.log('Bugün için kayıtlı sure yok veya tarih değişmiş, yeni sureler oluşturuyorum');
    }
    
    // Yeni günlük sureler oluştur
    console.log('Rastgele 5 sure ID\'si oluşturuluyor');
    const randomSurahIds = generateRandomSurahIds();
    console.log(`Oluşturulan sure ID'leri: ${randomSurahIds.join(', ')}`);
    
    const surahs: SurahData[] = [];
    
    // Her sure ID'si için sure bilgilerini getir
    for (const surahId of randomSurahIds) {
      console.log(`${surahId} ID'li sure getiriliyor`);
      const surah = await fetchSurah(surahId);
      
      if (surah) {
        surahs.push(surah);
        console.log(`${surahId} ID'li sure başarıyla eklendi`);
      } else {
        console.error(`${surahId} ID'li sure getirilemedi`);
      }
    }
    
    // Sureleri kaydet
    if (surahs.length > 0) {
      console.log(`${surahs.length} sure AsyncStorage'a kaydediliyor`);
      await AsyncStorage.setItem(DAILY_SURAHS_STORAGE_KEY, JSON.stringify(surahs));
      await AsyncStorage.setItem(DAILY_SURAHS_DATE_KEY, today);
      console.log('Sureler ve tarih başarıyla kaydedildi');
    } else {
      console.error('Kaydedilecek sure bulunamadı');
    }
    
    return surahs;
  } catch (error) {
    console.error('Günlük sureler alınamadı:', error);
    return [];
  }
};

/**
 * Günlük sureleri sıfırlar, böylece uygulama yeniden açıldığında yeni sureler gösterilir
 */
export const resetDailySurahs = async (): Promise<boolean> => {
  try {
    await AsyncStorage.removeItem(DAILY_SURAHS_STORAGE_KEY);
    await AsyncStorage.removeItem(DAILY_SURAHS_DATE_KEY);
    console.log('Günlük sureler sıfırlandı');
    return true;
  } catch (error) {
    console.error('Günlük sureler sıfırlanırken hata oluştu:', error);
    return false;
  }
};

/**
 * Belirli bir sure için ses dosyası URL'ini oluşturur
 */
export const getSurahAudioUrl = (surahId: number): string => {
  // Açık Kuran API'sinin ses dosyası formatı
  return `${AUDIO_BASE_URL}/tr/${surahId}.mp3`;
}; 