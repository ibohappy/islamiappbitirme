import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, updateReligiousLevel } from '../lib/supabase';
import { getAIResponse } from '../services/openaiService';
import { COLORS, SPACING } from '../constants/theme';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface UserProfile {
  user_id?: string;
  email?: string;
  name?: string;
  surname?: string;
  gender?: string;
  sect?: string;
  city?: string;
  age?: number;
  religious_level?: string;
}

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
    icon: 'psychology'
  },
];

export function ImamAIScreen() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    // Kullanıcı profili ve dini seviyeyi yükle
  const loadUserProfile = async () => {
    try {
      setIsLoadingProfile(true);
      const profile = await getUserProfile();
      setUserProfile(profile);
      
      // Eğer dini seviye seçilmemişse modal göster
      if (profile && !(profile as any).religious_level) {
        setTimeout(() => {
          setShowLevelModal(true);
          Alert.alert(
            'Dini Seviye Seçimi',
            'Size daha iyi hizmet verebilmem için lütfen dini bilgi seviyenizi belirleyin. Bu sayede cevaplarım size özel olacak.',
            [
              { text: 'Şimdi Seç', onPress: () => setShowLevelModal(true) },
              { text: 'Sonra Seç', style: 'cancel' }
            ]
          );
        }, 1500);
      }
    } catch (error) {
      console.error('Profil yükleme hatası:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // Dini seviye güncelle
  const handleLevelUpdate = async (level: 'beginner' | 'intermediate' | 'advanced') => {
    try {
      await updateReligiousLevel(level);
             setUserProfile(prev => prev ? { ...prev, religious_level: level } as any : null);
      setShowLevelModal(false);
      
      // Hoş geldin mesajı ekle
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        text: getWelcomeMessage(level, userProfile),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
      
      Alert.alert(
        'Başarılı',
        'Dini seviyeniz başarıyla güncellendi! Artık size özel cevaplar alacaksınız.',
        [{ text: 'Tamam' }]
      );
    } catch (error) {
      console.error('Seviye güncelleme hatası:', error);
      Alert.alert('Hata', 'Seviye güncellenirken bir hata oluştu.');
    }
  };

  // Hoş geldin mesajı oluştur
  const getWelcomeMessage = (level: string, profile: UserProfile | null): string => {
    const name = profile?.name ? ` ${profile.name} kardeşim` : ' kardeşim';
    const sect = profile?.sect ? ` ${profile.sect.charAt(0).toUpperCase() + profile.sect.slice(1)} mezhebinden` : '';
    
    const levelText = level === 'beginner' ? 'başlangıç' : 
                     level === 'intermediate' ? 'orta' : 'ileri';
    
    return `Esselamun aleyküm ve rahmetullahi ve berekatüh!${name} 🤲

Ben İmam AI, sizin kişisel dini rehberinizim. ${levelText} seviyesinde${sect} sorularınıza en uygun şekilde cevap vereceğim.

Bu konularda size yardımcı olabilirim:
🕌 İbadetler (Namaz, Oruç, Hac, Umre)
📖 Kur'an ve Hadis açıklamaları
⚖️ Helal-Haram meseleleri
💍 Aile ve evlilik konuları
🌙 Dini günler ve kandiller
🤲 Dua ve zikir önerileri

Size nasıl yardımcı olabilirim?`;
  };

  // Mesaj gönder
  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const aiResponse = await getAIResponse(inputText.trim(), userProfile);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI yanıt hatası:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Üzgünüm, şu anda bir teknik sorun yaşıyorum. Lütfen biraz sonra tekrar deneyin. 🤲',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    if (!session) {
      return;
    }
    loadUserProfile();
  }, [session]);

  // İlk hoş geldin mesajını ekle
     useEffect(() => {
     if (userProfile && (userProfile as any).religious_level && messages.length === 0) {
       const welcomeMessage: Message = {
         id: 'welcome',
         text: getWelcomeMessage((userProfile as any).religious_level, userProfile),
         isUser: false,
         timestamp: new Date(),
       };
       setMessages([welcomeMessage]);
     }
   }, [userProfile]);

  if (isLoadingProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Profil yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="robot" size={32} color={COLORS.primary} />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>İmam AI</Text>
              <Text style={styles.headerSubtitle}>Kişisel Dini Rehberiniz</Text>
            </View>
          </View>
          
          {/* Dini Seviye Butonu */}
          <TouchableOpacity 
            style={styles.levelButton}
            onPress={() => setShowLevelModal(true)}
          >
            <View style={styles.levelButtonContent}>
              <MaterialIcons 
                name="psychology" 
                size={18} 
                color={COLORS.primary} 
                style={styles.levelButtonIcon}
              />
              <View style={styles.levelButtonText}>
                <Text style={styles.levelButtonTitle}>
                  {(userProfile as any)?.religious_level ? 
                    ((userProfile as any).religious_level === 'beginner' ? 'Başlangıç' : 
                     (userProfile as any).religious_level === 'intermediate' ? 'Orta' : 'İleri')
                    : 'Seviye'
                  }
                </Text>
                <Text style={styles.levelButtonSubtitle}>Seç</Text>
              </View>
              <MaterialIcons name="keyboard-arrow-down" size={16} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Chat Messages */}
        <ScrollView 
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageContainer,
                message.isUser ? styles.userMessage : styles.aiMessage,
              ]}
            >
              <Text style={[
                styles.messageText,
                message.isUser ? styles.userMessageText : styles.aiMessageText,
              ]}>
                {message.text}
              </Text>
              <Text style={[
                styles.timestamp,
                message.isUser ? styles.userTimestamp : styles.aiTimestamp,
              ]}>
                {message.timestamp.toLocaleTimeString('tr-TR', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </View>
          ))}
          {isLoading && (
            <View style={[styles.messageContainer, styles.aiMessage]}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingMessage}>Yanıt hazırlanıyor...</Text>
            </View>
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Dini sorunuzu yazın..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            <MaterialIcons name="send" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Dini Seviye Seçim Modalı */}
        <Modal
          visible={showLevelModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowLevelModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Dini Seviyenizi Seçin</Text>
                <Text style={styles.modalSubtitle}>
                  Size en uygun cevapları verebilmem için dini bilgi seviyenizi belirtin
                </Text>
              </View>

              <ScrollView style={styles.levelOptions}>
                {religiousLevels.map((level) => (
                  <TouchableOpacity
                    key={level.value}
                    style={[
                      styles.levelOption,
                      (userProfile as any)?.religious_level === level.value && styles.selectedLevelOption
                    ]}
                    onPress={() => handleLevelUpdate(level.value as any)}
                  >
                    <View style={styles.levelOptionContent}>
                      <MaterialIcons 
                        name={level.icon as any} 
                        size={32} 
                                                 color={(userProfile as any)?.religious_level === level.value ? COLORS.primary : COLORS.textSecondary} 
                      />
                      <View style={styles.levelOptionText}>
                        <Text style={[
                          styles.levelOptionTitle,
                          (userProfile as any)?.religious_level === level.value && styles.selectedLevelOptionTitle
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

                             {(userProfile as any)?.religious_level && (
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowLevelModal(false)}
                >
                  <Text style={styles.modalCloseButtonText}>Kapat</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.text,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  levelButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  levelButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
  },
  levelButtonIcon: {
    marginRight: SPACING.xs,
  },
  levelButtonText: {
    flex: 1,
    marginRight: SPACING.xs,
  },
  levelButtonTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  levelButtonSubtitle: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  messageContainer: {
    marginBottom: SPACING.md,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 11,
    marginTop: SPACING.xs,
    opacity: 0.7,
  },
  userTimestamp: {
    color: '#fff',
    textAlign: 'right',
  },
  aiTimestamp: {
    color: COLORS.textSecondary,
  },
  loadingMessage: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: SPACING.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    margin: SPACING.lg,
    maxHeight: '80%',
    width: '90%',
  },
  modalHeader: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
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
  modalCloseButton: {
    margin: SPACING.lg,
    backgroundColor: COLORS.textSecondary,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 