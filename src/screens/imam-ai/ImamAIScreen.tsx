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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../../constants/theme';
import { getUserProfile } from '../../lib/supabase';

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
}

export function ImamAIScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Kullanıcı profili bilgilerini al
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        setIsProfileLoading(true);
        const userProfile = await getUserProfile();
        console.log('Kullanıcı profili yüklendi:', userProfile);
        setProfile(userProfile);
        
        // Karşılama mesajını oluştur
        const welcomeMessage = createWelcomeMessage(userProfile);
        setMessages([
          {
            id: '1',
            text: welcomeMessage,
            isUser: false,
            timestamp: new Date(),
          }
        ]);
      } catch (error) {
        console.error('Profil yükleme hatası:', error);
        // Hata durumunda genel karşılama mesajı göster
        setMessages([
          {
            id: '1',
            text: 'Merhaba! Ben İmam AI. Size dini konularda yardımcı olmaktan mutluluk duyarım.',
            isUser: false,
            timestamp: new Date(),
          }
        ]);
      } finally {
        setIsProfileLoading(false);
      }
    };
    
    loadUserProfile();
  }, []);
  
  // Kullanıcıya özel karşılama mesajı oluştur
  const createWelcomeMessage = (userProfile: UserProfile | null): string => {
    // Standart karşılama mesajı
    const standardMessage = 'Size dini konularda yardımcı olmaktan mutluluk duyarım. Sorularınızı sorabilirsiniz.';
    
    if (!userProfile || !userProfile.name) {
      return `Esselamun Aleyküm! Ben İmam AI. ${standardMessage}`;
    }
    
    // Kullanıcı adı ve soyadı ile kişiselleştirilmiş karşılama
    const userName = userProfile.name;
    const userSurname = userProfile.surname || '';
    
    // Günün saatine göre selamlama
    const hour = new Date().getHours();
    let timeGreeting = '';
    
    if (hour < 12) {
      timeGreeting = 'Hayırlı sabahlar';
    } else if (hour < 18) {
      timeGreeting = 'Hayırlı günler';
    } else {
      timeGreeting = 'Hayırlı akşamlar';
    }
    
    // Kişiselleştirilmiş mesaj
    return `Esselamun Aleyküm ${userName} ${userSurname}! ${timeGreeting}. Ben İmam AI. ${standardMessage}`;
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

    // TODO: Implement ChatGPT API call
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: `${profile?.name ? profile.name + ", bu" : "Bu"} özellik yakında aktif olacak. Şu an geliştirme aşamasındadır.`,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1000);
  };

  const onChangeInputText = (text: string) => {
    // Metin değişikliklerini doğrudan kabul et
    setInputText(text);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.isUser ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <Text style={styles.messageText}>{item.text}</Text>
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );

  if (isProfileLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Kullanıcı bilgileri yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Kullanıcı karşılama başlığı ve profil kartı kaldırıldı */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 30}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
          </View>
        </TouchableWithoutFeedback>

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Dini sorularınızı buraya yazabilirsiniz..."
            placeholderTextColor={COLORS.text}
            value={inputText}
            onChangeText={onChangeInputText}
            multiline
            maxLength={500}
            autoCorrect={false}
            autoCapitalize="none"
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
              <MaterialCommunityIcons
                name="loading"
                size={24}
                color={COLORS.background}
              />
            ) : (
              <MaterialCommunityIcons
                name="send"
                size={24}
                color={COLORS.background}
              />
            )}
          </TouchableOpacity>
        </View>
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
    backgroundColor: COLORS.background,
  },
  innerContainer: {
    flex: 1,
  },
  keyboardView: {
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
  },
  messageText: {
    fontSize: 16,
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    alignSelf: 'flex-end',
    marginTop: SPACING.xs,
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
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  welcomeHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  userProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  userProfileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userProfileInfo: {
    flex: 1,
    paddingLeft: SPACING.md,
  },
  userProfileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  userProfileDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  userProfileDetailText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
  },
}); 