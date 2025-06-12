import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chat, Message } from '../types/chatTypes';

const CHATS_STORAGE_KEY = 'IMAM_AI_CHATS';
const ACTIVE_CHAT_ID_KEY = 'IMAM_AI_ACTIVE_CHAT_ID';

// JSON serialize/deserialize işlevleri
const serializeDate = (date: Date): string => date.toISOString();
const deserializeDate = (dateString: string): Date => new Date(dateString);

// Date nesnelerini işlemek için JSON serileştiricileri
const serializeChat = (chat: Chat): any => ({
  ...chat,
  createdAt: serializeDate(chat.createdAt),
  updatedAt: serializeDate(chat.updatedAt),
  messages: chat.messages.map(msg => ({
    ...msg,
    timestamp: serializeDate(msg.timestamp)
  }))
});

const deserializeChat = (chatData: any): Chat => ({
  ...chatData,
  createdAt: deserializeDate(chatData.createdAt),
  updatedAt: deserializeDate(chatData.updatedAt),
  messages: chatData.messages.map((msg: any) => ({
    ...msg,
    timestamp: deserializeDate(msg.timestamp)
  }))
});

/**
 * Tüm sohbetleri yükler
 */
export const loadChats = async (): Promise<Chat[]> => {
  try {
    const chatsJson = await AsyncStorage.getItem(CHATS_STORAGE_KEY);
    if (!chatsJson) return [];
    
    const serializedChats = JSON.parse(chatsJson);
    return serializedChats.map(deserializeChat);
  } catch (error) {
    console.error('Sohbetleri yükleme hatası:', error);
    return [];
  }
};

/**
 * Tüm sohbetleri kaydeder
 */
export const saveChats = async (chats: Chat[]): Promise<void> => {
  try {
    const serializedChats = chats.map(serializeChat);
    await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(serializedChats));
  } catch (error) {
    console.error('Sohbetleri kaydetme hatası:', error);
  }
};

/**
 * Tek bir sohbeti günceller
 */
export const updateChat = async (updatedChat: Chat): Promise<void> => {
  try {
    const chats = await loadChats();
    const chatIndex = chats.findIndex(chat => chat.id === updatedChat.id);
    
    if (chatIndex >= 0) {
      chats[chatIndex] = updatedChat;
      await saveChats(chats);
    }
  } catch (error) {
    console.error('Sohbeti güncelleme hatası:', error);
  }
};

/**
 * Yeni bir sohbet oluşturur
 */
export const createChat = async (firstMessage: string, isUserMessage: boolean): Promise<Chat> => {
  try {
    const chats = await loadChats();
    
    // Mesaj oluştur
    const message: Message = {
      id: Date.now().toString(),
      text: firstMessage,
      isUser: isUserMessage,
      timestamp: new Date()
    };
    
    // Başlık oluştur - yapay zeka yanıtları için sabit bir başlık kullan,
    // kullanıcı mesajı ise daha akıllı başlık oluştur
    const title = isUserMessage 
      ? generateChatTitle(firstMessage) 
      : "Yeni Sohbet";
    
    // Yeni sohbet oluştur
    const newChat: Chat = {
      id: Date.now().toString(),
      title,
      messages: [message],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Sohbetleri güncelle ve kaydet
    const updatedChats = [...chats, newChat];
    await saveChats(updatedChats);
    
    // Aktif sohbeti güncelle
    await setActiveChatId(newChat.id);
    
    return newChat;
  } catch (error) {
    console.error('Sohbet oluşturma hatası:', error);
    throw error;
  }
};

/**
 * Mevcut bir sohbete mesaj ekler
 */
export const addMessageToChat = async (
  chatId: string,
  messageText: string,
  isUserMessage: boolean
): Promise<Message> => {
  try {
    const chats = await loadChats();
    const chatIndex = chats.findIndex(chat => chat.id === chatId);
    
    if (chatIndex === -1) {
      throw new Error(`Sohbet bulunamadı: ${chatId}`);
    }
    
    // Yeni mesaj oluştur
    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: isUserMessage,
      timestamp: new Date()
    };
    
    // Sohbeti güncelle
    const updatedChat = {
      ...chats[chatIndex],
      messages: [...chats[chatIndex].messages, newMessage],
      updatedAt: new Date()
    };
    
    // Eğer sohbetin başlığı "Yeni Sohbet" ise ve bu kullanıcının ilk mesajıysa
    // sohbet başlığını güncelle
    if (updatedChat.title === "Yeni Sohbet" && isUserMessage) {
      const userMessages = updatedChat.messages.filter(m => m.isUser);
      if (userMessages.length === 1) {
        updatedChat.title = generateChatTitle(messageText);
      }
    }
    
    chats[chatIndex] = updatedChat;
    await saveChats(chats);
    
    return newMessage;
  } catch (error) {
    console.error('Mesaj ekleme hatası:', error);
    throw error;
  }
};

/**
 * İlk mesajdan sohbet başlığı oluşturur
 */
const generateChatTitle = (message: string): string => {
  // Kullanıcının mesajını analiz ederek anlamlı bir başlık oluştur
  // Eğer mesaj çok kısaysa doğrudan kullanabilir
  if (message.length <= 25) {
    return message;
  }
  
  // Soruyu tespit etmeye çalış
  const questionRegex = /([^.!?]+\?)/;
  const questionMatch = message.match(questionRegex);
  if (questionMatch && questionMatch[1]) {
    const question = questionMatch[1].trim();
    if (question.length < 50) {
      return question;
    }
    return question.substring(0, 47) + '...';
  }
  
  // Konuya dair anahtar kelimeleri tespit et
  const keyTopics = [
    'namaz', 'oruç', 'zekat', 'hac', 'umre', 'abdest', 'gusül', 'teyemmüm',
    'dua', 'ibadet', 'kader', 'iman', 'ahiret', 'cennet', 'cehennem', 'melek',
    'kitap', 'peygamber', 'sahabe', 'kurban', 'sadaka', 'helal', 'haram',
    'mehir', 'nikah', 'talak', 'miras', 'vasiyet', 'tefsir', 'hadis'
  ];
  
  const words = message.toLowerCase().split(/\s+/);
  for (const topic of keyTopics) {
    if (words.includes(topic)) {
      return topic.charAt(0).toUpperCase() + topic.slice(1) + ' hakkında soru';
    }
  }
  
  // Belirli bir konu bulunamadıysa, ilk 30 karakter
  const title = message.substring(0, 30).trim();
  if (message.length > 30) {
    return title + '...';
  }
  
  return title;
};

/**
 * Aktif sohbet ID'sini kaydeder
 */
export const setActiveChatId = async (chatId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACTIVE_CHAT_ID_KEY, chatId);
  } catch (error) {
    console.error('Aktif sohbet ID kaydetme hatası:', error);
  }
};

/**
 * Aktif sohbet ID'sini yükler
 * @param forceNew Eğer true ise, her zaman null döndürür (yeni sohbet başlatmak için)
 */
export const getActiveChatId = async (forceNew: boolean = false): Promise<string | null> => {
  try {
    // Eğer forceNew true ise, her zaman null döndür (yeni sohbet)
    if (forceNew) {
      return null;
    }
    return await AsyncStorage.getItem(ACTIVE_CHAT_ID_KEY);
  } catch (error) {
    console.error('Aktif sohbet ID yükleme hatası:', error);
    return null;
  }
};

/**
 * Aktif sohbeti temizle ve yeni bir sohbet başlat
 */
export const clearActiveChatAndCreateNew = async (welcomeMessage: string): Promise<Chat> => {
  // Aktif sohbeti temizle
  await AsyncStorage.removeItem(ACTIVE_CHAT_ID_KEY);
  
  // Yeni sohbet oluştur
  return await createChat(welcomeMessage, false);
};

/**
 * Sohbeti siler
 */
export const deleteChat = async (chatId: string): Promise<void> => {
  try {
    const chats = await loadChats();
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    await saveChats(updatedChats);
    
    // Eğer silinen sohbet aktif ise, aktif sohbeti güncelle
    const activeChatId = await getActiveChatId();
    if (activeChatId === chatId) {
      // Kullanıcının mesaj gönderdiği sohbetleri bul
      const userActiveChats = updatedChats.filter(chat => 
        chat.messages.some(msg => msg.isUser)
      );
      
      if (userActiveChats.length > 0) {
        // Kullanıcının mesaj gönderdiği bir sohbet varsa, en son güncelleneni aktif yap
        const sortedChats = userActiveChats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        await setActiveChatId(sortedChats[0].id);
      } else if (updatedChats.length > 0) {
        // Sadece AI mesajı olan sohbetler varsa, en son güncelleneni aktif yap
        const sortedChats = updatedChats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        await setActiveChatId(sortedChats[0].id);
      } else {
        // Hiç sohbet kalmadıysa, aktif sohbeti temizle
        await AsyncStorage.removeItem(ACTIVE_CHAT_ID_KEY);
      }
    }
  } catch (error) {
    console.error('Sohbet silme hatası:', error);
  }
}; 