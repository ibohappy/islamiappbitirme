import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  I18nManager,
  Dimensions,
  Modal,
  Animated,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING } from '../../constants/theme';
import { getUserProfile, updateReligiousLevel } from '../../lib/supabase';
import { getAIResponse } from '../../services/openaiService';
import { UserProfile } from '../../types/userTypes';
import { Chat, Message } from '../../types/chatTypes';
import {
  loadChats,
  getActiveChatId,
  createChat,
  addMessageToChat,
  setActiveChatId,
  deleteChat,
  clearActiveChatAndCreateNew
} from '../../services/chatStorageService';

const { width } = Dimensions.get('window');
const isMobile = width < 768; // Mobil cihazlar için bir eşik değer

export function ImamAIScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // const [showQuickQuestions, setShowQuickQuestions] = useState(false); // Artık kullanılmıyor
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Dini seviye seçenekleri
  const religiousLevels = [
    { 
      label: 'Başlangıç', 
      value: 'beginner',
      description: 'Temel bilgiler, basit açıklamalar',
      icon: 'school'
    },
    { 
      label: 'Orta', 
      value: 'intermediate',
      description: 'Ayet-hadis referansları, detaylı bilgi',
      icon: 'book'
    },
    { 
      label: 'İleri', 
      value: 'advanced',
      description: 'Fıkhi incelikler, karşılaştırmalı analiz',
      icon: 'brain'
    },
  ];
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const sidebarAnimation = useRef(new Animated.Value(isMobile ? -width * 0.8 : 0)).current;
  const navigation = useNavigation();
  
  // Kullanıcı profiline göre kişiselleştirilmiş hızlı sorular (ARTIK KULLANILMIYOR)
  const getPersonalizedQuickQuestions = (): string[] => {
    return []; // Artık kullanılmıyor
  };
  
  // Profil güncellemelerini dinle
  useEffect(() => {
    const handleProfileUpdate = async () => {
      try {
        console.log('Profil güncellendi, yeni profil bilgileri çekiliyor...');
        const updatedProfile = await getUserProfile();
        setProfile(updatedProfile);
        console.log('Profil başarıyla güncellendi:', updatedProfile);
      } catch (error) {
        console.error('Profil güncelleme dinleme hatası:', error);
      }
    };

    // Global event listener'ı kaydet
    if (!global.profileUpdateListeners) {
      global.profileUpdateListeners = [];
    }
    global.profileUpdateListeners.push(handleProfileUpdate);

    // Cleanup fonksiyonu
    return () => {
      if (global.profileUpdateListeners) {
        const index = global.profileUpdateListeners.indexOf(handleProfileUpdate);
        if (index > -1) {
          global.profileUpdateListeners.splice(index, 1);
        }
      }
    };
  }, []);
  
  // Kullanıcı profili ve aktif sohbeti yükle
  useEffect(() => {
    const initialize = async () => {
      try {
        setIsProfileLoading(true);
        setIsInitialLoad(true);
        
        // Kullanıcı profilini yükle
        const userProfile = await getUserProfile();
        setProfile(userProfile);
        
        // Eğer dini seviye yoksa modal göster
        if (userProfile && !(userProfile as any).religious_level) {
          setTimeout(() => {
            setShowLevelModal(true);
          }, 2000);
        }
        
        // Tüm sohbetleri yükle
        const allChats = await loadChats();
        
        // Kullanıcının mesaj gönderdiği sohbetleri filtrele
        const userActiveChats = allChats.filter(chat => 
          chat.messages.some(msg => msg.isUser)
        );
        
        // Sohbetleri güncelleme tarihine göre sırala
        setChats(userActiveChats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
        
        // Her zaman yeni bir sohbet oluştur - ChatGPT gibi
        await createNewChat(userProfile);
      } catch (error) {
        console.error('Sohbet yükleme hatası:', error);
        // Hata durumunda yeni bir sohbet oluştur
        await createNewChat(profile);
      } finally {
        setIsProfileLoading(false);
        setIsInitialLoad(false);
      }
    };
    
    initialize();
  }, []);
  
  // Sidebar animasyonu
  useEffect(() => {
    Animated.timing(sidebarAnimation, {
      toValue: isSidebarOpen || (!isMobile && showSidebar) ? 0 : -width * 0.8,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isSidebarOpen, showSidebar, isMobile, sidebarAnimation]);
  
  // Yeni bir sohbet oluştur
  const createNewChat = async (userProfile: UserProfile | null) => {
    try {
      // Karşılama mesajını oluştur
      const welcomeMessage = createWelcomeMessage(userProfile);
      
      // clearActiveChatAndCreateNew fonksiyonunu kullanarak yeni sohbet oluştur
      const newChat = await clearActiveChatAndCreateNew(welcomeMessage);
      
      // Mevcut sohbetleri güncelle
      const updatedChats = await loadChats();
      
      // Kullanıcının mesaj gönderdiği sohbetleri filtrele
      const userActiveChats = updatedChats.filter(chat => 
        chat.messages.some(msg => msg.isUser)
      );
      
      // Sohbetleri güncelleme tarihine göre sırala
      setChats(userActiveChats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
      
      // Yeni sohbeti aktif olarak ayarla
      setActiveChatId(newChat.id);
      setMessages(newChat.messages);
      
      return newChat;
    } catch (error) {
      console.error('Yeni sohbet oluşturma hatası:', error);
      // Hata durumunda geçici bir karşılama mesajı oluştur (kaydedilmez)
      setMessages([
        {
          id: '1',
          text: 'Merhaba! Ben İmam AI. Size dini konularda yardımcı olmaktan mutluluk duyarım.',
          isUser: false,
          timestamp: new Date(),
        }
      ]);
      
      return null;
    }
  };
  
  // Sohbet listesini güncelle
  const refreshChatList = async () => {
    try {
      const allChats = await loadChats();
      
      // Kullanıcının mesaj gönderdiği sohbetleri filtrele
      const userActiveChats = allChats.filter(chat => 
        chat.messages.some(msg => msg.isUser)
      );
      
      // Sohbetleri güncelleme tarihine göre sırala
      setChats(userActiveChats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    } catch (error) {
      console.error('Sohbet listesi güncelleme hatası:', error);
    }
  };
  
  // Sohbeti seç
  const selectChat = async (chat: Chat) => {
    try {
      await setActiveChatId(chat.id);
      setActiveChatId(chat.id);
      setMessages(chat.messages);
      
      // Sohbet değiştirildiğinde en son mesaja scroll et
      setTimeout(() => {
        if (chat.messages.length > 0) {
          flatListRef.current?.scrollToEnd({ animated: false });
        }
      }, 100);
      
      // Mobil görünümde sidebar'ı kapat
      if (isMobile) {
        setIsSidebarOpen(false);
      }
    } catch (error) {
      console.error('Sohbet seçme hatası:', error);
    }
  };
  
  // Sohbeti sil
  const handleDeleteChat = async (chatId: string) => {
    try {
      await deleteChat(chatId);
      
      // Sohbet listesini güncelle
      await refreshChatList();
      
      // Eğer silinen sohbet aktif sohbetse
      if (chatId === activeChatId) {
        const allChats = await loadChats();
        const userActiveChats = allChats.filter(chat => 
          chat.messages.some(msg => msg.isUser)
        );
        
        if (userActiveChats.length > 0) {
          // Kullanıcı mesajı olan başka sohbet varsa, o sohbeti yükle
          const latestChat = userActiveChats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
          setActiveChatId(latestChat.id);
          setMessages(latestChat.messages);
        } else {
          // Kullanıcı mesajı olan başka sohbet yoksa, yeni bir sohbet oluştur
          await createNewChat(profile);
        }
      }
    } catch (error) {
      console.error('Sohbet silme hatası:', error);
    }
  };
  
  // Özlü ve anlamlı karşılama mesajı oluştur
  const createWelcomeMessage = (userProfile: UserProfile | null): string => {
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    
    // Zamana göre selamlama
    let timeGreeting = '';
    if (currentHour >= 5 && currentHour < 12) {
      timeGreeting = 'Hayırlı sabahlar';
    } else if (currentHour >= 12 && currentHour < 18) {
      timeGreeting = 'Hayırlı günler';
    } else if (currentHour >= 18 && currentHour < 21) {
      timeGreeting = 'Hayırlı akşamlar';
    } else {
      timeGreeting = 'Hayırlı geceler';
    }
    
    if (!userProfile || !userProfile.name) {
      return `Esselamun Aleyküm! ${timeGreeting}!

Ben İmam AI. Size dini konularda yardımcı olmak için buradayım. 

Herhangi bir sorunuz olduğunda çekinmeden sorabilirsiniz. 🤲

💡 Hızlı sorular için aşağıdaki butona tıklayabilirsiniz.`;
    }
    
    const userName = userProfile.name;
    const gender = userProfile.gender;
    
    let personalizedMessage = `Esselamun Aleyküm ${userName}! ${timeGreeting}!

Tekrar görüştüğümüze çok sevindim. `;
    
    // Cinsiyet bazlı hitap
    if (gender === 'female') {
      personalizedMessage += `Kız kardeşim, `;
    } else if (gender === 'male') {
      personalizedMessage += `Kardeşim, `;
    }
    
    personalizedMessage += `size nasıl yardımcı olabilirim?

İslami konulardaki tüm sorularınızda yanınızdayım. 🤲`;
    
    return personalizedMessage;
  };

  // Türkçe karakter desteği için I18nManager ayarı
  useEffect(() => {
    // RTL (Sağdan sola) desteğini kapatıyoruz
    if (I18nManager.isRTL) {
      I18nManager.allowRTL(false);
      I18nManager.forceRTL(false);
    }
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !activeChatId) return;

    try {
      // Typing göstergesini kapat
      setIsTyping(false);
      
      // GÜNCEL PROFİL BİLGİLERİNİ ÇEK - ÇOK ÖNEMLİ!
      const currentProfile = await getUserProfile();
      
      console.log('🧠 Hafıza Sistemi: Mesaj gönderiliyor...', {
        userId: (currentProfile as any)?.user_id || currentProfile?.email || 'anonymous',
        messageLength: inputText.trim().length,
        profileLevel: (currentProfile as any)?.religious_level,
        sect: (currentProfile as any)?.sect
      });
      
      // Kullanıcı mesajını yerel depolamaya ekle
      const userMessage = await addMessageToChat(
        activeChatId,
        inputText.trim(),
        true
      );
      
      // UI'ı güncelle ve inputu temizle
      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setIsLoading(true);

      // Kullanıcı mesajı eklendikten sonra scroll et
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Sohbet listesini güncelle
      await refreshChatList();

      // OpenAI API'ye GÜNCEL profil ile istek at (Geliştirilmiş hafıza sistemi ile)
      console.log('🤖 AI Yanıtı için Chain of Thought başlatılıyor...');
      const aiResponseText = await getAIResponse(userMessage.text, currentProfile);
      
      console.log('✅ AI Yanıtı alındı, hafızaya kaydediliyor...', {
        responseLength: aiResponseText.length,
        containsName: (currentProfile as any)?.name ? aiResponseText.includes((currentProfile as any).name) : false
      });
      
      // AI yanıtını yerel depolamaya ekle
      const aiMessage = await addMessageToChat(
        activeChatId,
        aiResponseText,
        false
      );
      
      // UI'ı güncelle
      setMessages(prev => [...prev, aiMessage]);
      
      // AI mesajı eklendikten sonra scroll et
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Sohbet listesini tekrar güncelle
      await refreshChatList();
      
      console.log('🎯 Sohbet tamamlandı, hafıza sistemi güncellendi!');
    } catch (error) {
      console.error('AI yanıt hatası:', error);
      
      // Hata durumunda kullanıcıya kişiselleştirilmiş bilgi ver
      if (activeChatId) {
        // Hata durumunda da güncel profil bilgilerini kullan
        const currentProfile = await getUserProfile().catch(() => profile);
        const personName = (currentProfile as any)?.name ? ` ${(currentProfile as any).name} kardeşim` : '';
        const errorMessage = await addMessageToChat(
          activeChatId,
          `Üzgünüm${personName}, şu anda bir teknik sorun yaşıyorum. Lütfen birkaç dakika sonra tekrar deneyin. Bu arada dualarınızda beni unutmayın! 🤲`,
          false
        );
        
        setMessages(prev => [...prev, errorMessage]);
        
        // Hata mesajı için de scroll et
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onChangeInputText = (text: string) => {
    setInputText(text);
    
    // Typing indicator
    if (text.length > 0 && !isTyping) {
      setIsTyping(true);
      // 2 saniye sonra typing'i kapat
      setTimeout(() => setIsTyping(false), 2000);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Dini seviye güncelle
  const handleLevelUpdate = async (level: 'beginner' | 'intermediate' | 'advanced') => {
    try {
      await updateReligiousLevel(level);
      
      // Profili güncelle
      setProfile(prev => prev ? { ...prev, religious_level: level } as any : null);
      setShowLevelModal(false);
      
      // Başarı mesajı
      const levelText = level === 'beginner' ? 'Başlangıç' : 
                       level === 'intermediate' ? 'Orta' : 'İleri';
      
      // Yeni bir karşılama mesajı oluştur
      const welcomeMessage = createWelcomeMessage({ ...profile, religious_level: level } as any);
      
      // Yeni sohbet oluştur
      await createNewChat({ ...profile, religious_level: level } as any);
      
    } catch (error) {
      console.error('Seviye güncelleme hatası:', error);
    }
  };

  const handleNewChat = async () => {
    await createNewChat(profile);
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  // Hızlı soru gönder (kullanılmıyor artık)
  // const handleQuickQuestion = async (question: string) => {
  //   setInputText(question);
  //   setShowQuickQuestions(false);
  //   // Kısa bir gecikme ile otomatik gönder
  //   setTimeout(() => {
  //     if (activeChatId) {
  //       setInputText('');
  //       handleSendQuickQuestion(question);
  //     }
  //   }, 100);
  // };

  const handleSendQuickQuestion = async (question: string) => {
    if (!activeChatId) return;

    try {
      // GÜNCEL PROFİL BİLGİLERİNİ ÇEK
      const currentProfile = await getUserProfile();
      
      console.log('⚡ Hızlı Soru Gönderiliyor:', {
        question: question.substring(0, 50) + '...',
        userId: (currentProfile as any)?.user_id || 'anonymous',
        hasMemory: true
      });
      
      const userMessage = await addMessageToChat(
        activeChatId,
        question,
        true
      );
      
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      // Kullanıcı mesajı eklendikten sonra scroll et
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      await refreshChatList();

      // Geliştirilmiş hafıza sistemi ile hızlı soru yanıtı
      const aiResponseText = await getAIResponse(question, currentProfile);
      
      const aiMessage = await addMessageToChat(
        activeChatId,
        aiResponseText,
        false
      );
      
      setMessages(prev => [...prev, aiMessage]);
      
      // AI mesajı eklendikten sonra scroll et
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      await refreshChatList();
      
      console.log('✅ Hızlı soru yanıtlandı, hafıza güncellendi!');
    } catch (error) {
      console.error('Hızlı soru hatası:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Tarih formatla
  const formatDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateObj = new Date(date);
    
    if (dateObj.getDate() === today.getDate() && 
        dateObj.getMonth() === today.getMonth() && 
        dateObj.getFullYear() === today.getFullYear()) {
      return 'Bugün';
    } else if (dateObj.getDate() === yesterday.getDate() && 
              dateObj.getMonth() === yesterday.getMonth() && 
              dateObj.getFullYear() === yesterday.getFullYear()) {
      return 'Dün';
    } else {
      return dateObj.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long'
      });
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.isUser ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <Text style={[
        styles.messageText,
        item.isUser ? styles.userMessageText : styles.aiMessageText
      ]}>
        {item.text}
      </Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );
  
  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={[
        styles.chatItem,
        activeChatId === item.id ? styles.activeChatItem : {},
        item.title === "Yeni Sohbet" ? styles.newChatListItem : {}
      ]}
      onPress={() => selectChat(item)}
    >
      <View style={styles.chatInfo}>
        <Text 
          style={[
            styles.chatTitle,
            activeChatId === item.id ? styles.activeChatTitle : {},
            item.title === "Yeni Sohbet" ? styles.newChatListTitle : {}
          ]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text 
          style={[
            styles.chatDate,
            item.title === "Yeni Sohbet" ? styles.newChatListDate : {}
          ]} 
          numberOfLines={1}
        >
          {formatDate(item.updatedAt)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteChatButton}
        onPress={() => handleDeleteChat(item.id)}
      >
        <MaterialCommunityIcons 
          name="delete-outline" 
          size={20} 
          color={item.title === "Yeni Sohbet" ? "#297739" : COLORS.textSecondary} 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // const renderQuickQuestion = ({ item }: { item: string }) => (
  //   <TouchableOpacity
  //     style={styles.quickQuestionItem}
  //     onPress={() => handleQuickQuestion(item)}
  //   >
  //     <Text style={styles.quickQuestionText}>{item}</Text>
  //     <MaterialCommunityIcons name="send" size={16} color={COLORS.primary} />
  //   </TouchableOpacity>
  // );

  if (isProfileLoading || isInitialLoad) {
    const personName = profile?.name ? ` ${profile.name}` : '';
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          {profile ? `Hoş geldin${personName}! Sohbetiniz hazırlanıyor...` : 'Sohbet yükleniyor...'}
        </Text>
        <Text style={styles.loadingSubText}>
          Size en iyi İslami rehberliği sunmak için hazırlık yapıyoruz 🤲
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}
      >
        {/* Sidebar */}
        <Animated.View 
          style={[
            styles.sidebar,
            { transform: [{ translateX: sidebarAnimation }] },
            isMobile && styles.absoluteSidebar
          ]}
        >
          <View style={styles.sidebarHeader}>
            <View>
              <Text style={styles.sidebarTitle}>İmam AI Sohbetler</Text>
              {profile?.name && (
                <Text style={styles.sidebarSubtitle}>
                  {profile.name} {profile.surname}
                </Text>
              )}
            </View>
            {isMobile && (
              <TouchableOpacity onPress={toggleSidebar}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.newChatButton}
            onPress={handleNewChat}
          >
            <MaterialCommunityIcons name="plus" size={20} color={COLORS.background} />
            <Text style={styles.newChatText}>Yeni Sohbet</Text>
          </TouchableOpacity>
          
          <FlatList
            data={chats}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
        
        {/* Ana içerik */}
        <View style={styles.mainContent}>
          <View style={styles.header}>
            {isMobile && (
              <TouchableOpacity 
                style={styles.menuButton}
                onPress={toggleSidebar}
              >
                <MaterialCommunityIcons name="menu" size={24} color={COLORS.text} />
              </TouchableOpacity>
            )}
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>İmam AI</Text>
              {(profile as any)?.sect && (
                <Text style={styles.headerSubtitle}>{(profile as any).sect} Mezhepine Göre</Text>
              )}
              {(profile as any)?.religious_level && (
                <Text style={styles.levelIndicatorText}>
                  {(profile as any).religious_level === 'beginner' ? '🟢 Başlangıç' :
                   (profile as any).religious_level === 'intermediate' ? '🟠 Orta' : '🔴 İleri'} Seviye
                </Text>
              )}
              <Text style={styles.memoryIndicatorText}>
                🧠 Unlimited Memory System - ChatGPT Benzeri Öğrenme
              </Text>
            </View>
            {/* Dini Seviye Butonu */}
            <TouchableOpacity 
              style={styles.levelButton}
              onPress={() => setShowLevelModal(true)}
            >
              <MaterialCommunityIcons 
                  name="school" 
                  size={22} 
                color={COLORS.primary} 
              />
              {(profile as any)?.religious_level && (
                <View style={styles.levelIndicator}>
                  <View style={[
                    styles.levelDot,
                    { backgroundColor: 
                      (profile as any).religious_level === 'beginner' ? '#4CAF50' :
                      (profile as any).religious_level === 'intermediate' ? '#FF9800' : '#F44336'
                    }
                  ]} />
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.chatContainer}>
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={true}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                  autoscrollToTopThreshold: 100,
                }}
                onContentSizeChange={() => {
                  // Yeni mesaj eklendiğinde en sona scroll et
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
                onLayout={() => {
                  // İlk yüklemede en sona scroll et
                  if (messages.length > 0) {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  }
                }}
                initialNumToRender={10}
                maxToRenderPerBatch={5}
                windowSize={10}
                removeClippedSubviews={false}
                scrollEventThrottle={16}
                getItemLayout={(data, index) => ({
                  length: 80, // Ortalama mesaj yüksekliği
                  offset: 80 * index,
                  index,
                })}
              />
              
              {/* Typing indicator */}
              {isLoading && (
                <View style={styles.typingContainer}>
                  <View style={styles.typingIndicator}>
                    <Text style={styles.typingText}>İmam AI yazıyor</Text>
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />
                  </View>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>

          {/* Dini Seviye Seçim Modalı */}
          <Modal
            visible={showLevelModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowLevelModal(false)}
          >
            <TouchableWithoutFeedback onPress={() => setShowLevelModal(false)}>
              <View style={styles.modalOverlay}>
                <View style={styles.levelModal}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Dini Seviyenizi Seçin</Text>
                    <TouchableOpacity onPress={() => setShowLevelModal(false)}>
                      <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalSubtitle}>
                    Size en uygun cevapları verebilmem için dini bilgi seviyenizi belirtin
                  </Text>
                  
                  <ScrollView style={styles.levelOptions}>
                    {religiousLevels.map((level) => (
                      <TouchableOpacity
                        key={level.value}
                        style={[
                          styles.levelOption,
                          (profile as any)?.religious_level === level.value && styles.selectedLevelOption
                        ]}
                        onPress={() => handleLevelUpdate(level.value as any)}
                      >
                        <View style={styles.levelOptionContent}>
                          <MaterialCommunityIcons 
                            name={level.icon as any} 
                            size={32} 
                            color={(profile as any)?.religious_level === level.value ? COLORS.primary : COLORS.textSecondary} 
                          />
                          <View style={styles.levelOptionText}>
                            <Text style={[
                              styles.levelOptionTitle,
                              (profile as any)?.religious_level === level.value && styles.selectedLevelOptionTitle
                            ]}>
                              {level.label}
                            </Text>
                            <Text style={styles.levelOptionDescription}>
                              {level.description}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </Modal>

          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={
                profile?.name 
                  ? `${profile.name}, dini sorularınızı buraya yazabilirsiniz...`
                  : "Dini sorularınızı buraya yazabilirsiniz..."
              }
              placeholderTextColor={COLORS.textSecondary}
              value={inputText}
              onChangeText={onChangeInputText}
              multiline
              maxLength={500}
              autoCorrect={false}
              autoCapitalize="sentences"
              keyboardType="default"
              textContentType="none"
              spellCheck={false}
              allowFontScaling={false}
              textAlign="left"
              onFocus={() => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }}
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={COLORS.background} />
              ) : (
                <MaterialCommunityIcons
                  name="send"
                  size={24}
                  color={COLORS.background}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Mobilde sidebar arka planı için overlay */}
        {isMobile && isSidebarOpen && (
          <TouchableWithoutFeedback onPress={toggleSidebar}>
            <View style={styles.overlay} />
          </TouchableWithoutFeedback>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: isMobile ? width * 0.8 : width * 0.3,
    maxWidth: 300,
    backgroundColor: COLORS.card,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    zIndex: 10,
  },
  absoluteSidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 90,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sidebarSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    padding: SPACING.sm,
    borderRadius: SPACING.md,
    justifyContent: 'center',
  },
  newChatText: {
    color: COLORS.background,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  chatList: {
    padding: SPACING.sm,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: SPACING.md,
    marginBottom: SPACING.xs,
  },
  activeChatItem: {
    backgroundColor: COLORS.primary + '20', // %20 opacity
  },
  newChatListItem: {
    backgroundColor: '#e7f7e8', // Açık yeşil arkaplan
  },
  chatInfo: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  activeChatTitle: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  newChatListTitle: {
    color: '#297739', // Koyu yeşil yazı
    fontWeight: 'bold',
  },
  chatDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  newChatListDate: {
    color: '#5a9966', // Orta yeşil yazı
  },
  deleteChatButton: {
    padding: SPACING.xs,
  },
  mainContent: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuButton: {
    marginRight: SPACING.md,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  levelIndicatorText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
    fontWeight: '500',
  },
  memoryIndicatorText: {
    fontSize: 9,
    color: '#4CAF50',
    marginTop: 2,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  quickQuestionButton: {
    padding: SPACING.xs,
  },
  // Dini Seviye Butonu Stilleri
  levelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
    position: 'relative',
  },
  levelIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: SPACING.md,
    borderRadius: SPACING.md,
    marginBottom: SPACING.md,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: COLORS.background,
  },
  aiMessageText: {
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    alignSelf: 'flex-end',
    marginTop: SPACING.xs,
  },
  typingContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    marginRight: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.card,
    borderRadius: SPACING.md,
    fontSize: 16,
    maxHeight: 100,
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  loadingSubText: {
    marginTop: SPACING.sm,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  quickQuestionsModal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: SPACING.lg,
    borderTopRightRadius: SPACING.lg,
    maxHeight: '70%',
    paddingBottom: SPACING.lg,
  },
  // Dini Seviye Modal Stilleri
  levelModal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: SPACING.lg,
    borderTopRightRadius: SPACING.lg,
    maxHeight: '80%',
    paddingBottom: SPACING.lg,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  levelOptions: {
    maxHeight: 400,
  },
  levelOption: {
    margin: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  selectedLevelOption: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  levelOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  levelOptionText: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  levelOptionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  selectedLevelOptionTitle: {
    color: COLORS.primary,
  },
  levelOptionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  quickQuestionsList: {
    padding: SPACING.md,
  },
  quickQuestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickQuestionText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
}); 