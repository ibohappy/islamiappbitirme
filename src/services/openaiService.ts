// Kullanıcı profili tipi tanımlaması
interface UserProfile {
  user_id?: string;
  email?: string;
  name?: string;
  surname?: string;
  gender?: string;  // 'male', 'female', 'other'
  sect?: string;    // 'Hanefi', 'Şafi', 'Maliki', 'Hanbeli' gibi
  city?: string;
  age?: number;
  religious_level?: string; // 'beginner', 'intermediate', 'advanced'
  created_at?: string;
  updated_at?: string;
}

// Mesaj geçmişi için tip tanımlaması
interface MessageHistory {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isProfileRelated?: boolean;
  conversationTurn?: number;
  topicTags?: string[];
  importance?: number; // 1-10 arası önem skoru
  contextualRelevance?: number; // Mevcut konuya olan ilgisi
}

// Chain of Thought için tip tanımlaması
interface ChainOfThoughtStep {
  step: number;
  thought: string;
  reasoning: string;
  conclusion: string;
}

// Kullanıcı öğrenme profili
interface UserLearningProfile {
  userId: string;
  preferredTopics: string[];
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  conversationStyle: 'formal' | 'casual' | 'academic';
  previousQuestions: string[];
  understandingLevel: Record<string, number>; // topic -> understanding score
  lastInteractionDate: Date;
  totalInteractions: number;
  learningProgression: {
    questionsAsked: number;
    complexityTrend: number; // -1 to 1, complexity artışı
    topicMastery: Record<string, number>; // 0-100 arası mastery score
    weeklyProgress: number[];
  };
  conversationPatterns: {
    averageResponseTime: number;
    preferredTimeOfDay: string;
    sessionDuration: number;
    retentionRate: number; // Ne kadar hatırlıyor
  };
}

// Gelişmiş Memory Container
interface ConversationMemoryContainer {
  userId: string;
  messages: MessageHistory[];
  summary: string;
  keyLearnings: string[];
  importantMoments: MessageHistory[];
  topicEvolution: Record<string, number>; // Topic interest over time
  lastSummaryAt: Date;
  totalMessages: number;
}

import { ENV } from '../config/env';

// OpenAI API anahtarını env dosyasından al
const OPENAI_API_KEY = ENV.OPENAI_API_KEY;

// OpenAI API için tür tanımlamaları
type Role = 'system' | 'user' | 'assistant';

interface Message {
  role: Role;
  content: string;
}

// Geliştirilmiş hafıza yönetimi için global değişkenler - UNLIMITED MEMORY
let conversationMemory: Map<string, ConversationMemoryContainer> = new Map();
let userLearningProfiles: Map<string, UserLearningProfile> = new Map();

/**
 * UNLIMITED MEMORY STRATEGY 
 * ChatGPT benzeri sürekli öğrenen hafıza sistemi
 * LRU yok - tüm mesajlar saklanır, akıllı özetleme ile optimize edilir
 */
const saveToUnlimitedMemory = (
  userId: string,
  role: Role,
  content: string,
  isProfileRelated: boolean = false
): void => {
  if (!userId) return;
  
  console.log(`💾 Unlimited Memory: ${userId} için mesaj kaydediliyor...`);
  
  let memoryContainer = conversationMemory.get(userId);
  
  if (!memoryContainer) {
    memoryContainer = {
      userId,
      messages: [],
      summary: '',
      keyLearnings: [],
      importantMoments: [],
      topicEvolution: {},
      lastSummaryAt: new Date(),
      totalMessages: 0
    };
    conversationMemory.set(userId, memoryContainer);
  }
  
  const conversationTurn = Math.floor(memoryContainer.messages.length / 2) + 1;
  const topicTags = extractTopicsFromQuestion(content);
  const importance = calculateMessageImportance(content, role);
  
  const messageEntry: MessageHistory = {
    role,
    content,
    timestamp: new Date(),
    isProfileRelated,
    conversationTurn,
    topicTags,
    importance,
    contextualRelevance: 1.0 // İlk başta maksimum relevans
  };
  
  // Mesajı ekle - LIMIT YOK!
  memoryContainer.messages.push(messageEntry);
  memoryContainer.totalMessages++;
  
  // Önemli anları kaydet
  if (importance >= 8) {
    memoryContainer.importantMoments.push(messageEntry);
  }
  
  // Topic evolution güncelle
  topicTags.forEach(topic => {
    memoryContainer.topicEvolution[topic] = (memoryContainer.topicEvolution[topic] || 0) + 1;
  });
  
  // Her 50 mesajda bir akıllı özetleme yap (ChatGPT benzeri)
  if (memoryContainer.messages.length % 50 === 0) {
    performIntelligentSummarization(memoryContainer);
  }
  
  // Learning profile'ı güncelle
  updateAdvancedLearningProfile(userId, content, role);
  
  console.log(`✅ Toplam mesaj sayısı: ${memoryContainer.totalMessages}, Özetlenmiş: ${memoryContainer.summary ? 'Evet' : 'Hayır'}`);
};

/**
 * Mesajın önem skoru hesaplama (1-10)
 */
const calculateMessageImportance = (content: string, role: Role): number => {
  let importance = 5; // Base importance
  
  if (role === 'user') {
    // Kullanıcı soruları daha önemli
    importance += 1;
    
    // Karmaşık sorular daha önemli
    if (isVeryAdvancedQuestion(content)) importance += 2;
    else if (isAdvancedQuestion(content)) importance += 1;
    
    // Kişisel bilgiler çok önemli
    if (isProfileInfoQuestion(content)) importance += 3;
    
    // Uzun sorular daha düşündürücü
    if (content.length > 200) importance += 1;
    
    // Multiple questions
    if (content.split('?').length > 2) importance += 1;
  } else {
    // AI cevapları
    // Uzun detaylı cevaplar önemli
    if (content.length > 500) importance += 1;
    
    // Ayet/hadis içeren cevaplar önemli
    if (content.includes('ayet') || content.includes('hadis') || content.includes('Peygamber')) {
      importance += 2;
    }
    
    // Kişisel hitap içeren cevaplar önemli
    if (content.includes('kardeşim') || content.includes('kardeş')) importance += 1;
  }
  
  return Math.min(10, Math.max(1, importance));
};

/**
 * Akıllı özetleme sistemi - ChatGPT benzeri
 */
const performIntelligentSummarization = async (container: ConversationMemoryContainer): Promise<void> => {
  try {
    console.log(`🧠 Akıllı özetleme başlatılıyor: ${container.userId}`);
    
    // Son özetlemeden bu yana olan mesajları al
    const newMessages = container.messages.filter(msg => 
      msg.timestamp && msg.timestamp > container.lastSummaryAt
    );
    
    if (newMessages.length < 20) return; // Yeterli mesaj yoksa özetleme
    
    // Mevcut özet + yeni mesajları birleştir
    const conversationText = newMessages.map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n\n');
    
    const summaryPrompt = `Aşağıdaki İslami sohbet geçmişini özetle. Önceki özet: "${container.summary}"

YENİ MESAJLAR:
${conversationText}

ÖZETLEME KURALLARI:
- Kişisel bilgileri muhafaza et (isim, mezhep, yaş vs)
- Önemli dini konuları kaybet etme
- Öğrenme ilerlemesini not et
- Tekrarlanan konuları belirt
- Kullanıcının anlama seviyesindeki değişimleri gözlemle
- Maksimum 300 kelime

ÖZETLENMİŞ SOHBET:`;

    // Basit bir özet oluştur (production'da OpenAI'a gönderilebilir)
    const summary = await generateSimpleSummary(newMessages, container.summary);
    
    container.summary = summary;
    container.lastSummaryAt = new Date();
    
    // Key learnings çıkar
    const keyLearnings = extractKeyLearnings(newMessages);
    container.keyLearnings.push(...keyLearnings);
    
    console.log(`✅ Özet güncellendi: ${summary.length} karakter`);
    
  } catch (error) {
    console.error('Özetleme hatası:', error);
  }
};

/**
 * Basit özet oluşturucu (AI olmadan)
 */
const generateSimpleSummary = async (messages: MessageHistory[], existingSummary: string): Promise<string> => {
  const topics = new Set<string>();
  const userQuestions = [];
  const personalInfo = [];
  
  messages.forEach(msg => {
    if (msg.topicTags) {
      msg.topicTags.forEach(topic => topics.add(topic));
    }
    
    if (msg.role === 'user') {
      userQuestions.push(msg.content.substring(0, 100));
      
      if (msg.isProfileRelated) {
        personalInfo.push(msg.content);
      }
    }
  });
  
  let summary = existingSummary + '\n\n';
  summary += `GÜNCEL SOHBET (${new Date().toLocaleDateString('tr-TR')}):\n`;
  summary += `- Konuşulan konular: ${Array.from(topics).join(', ')}\n`;
  summary += `- ${userQuestions.length} soru soruldu\n`;
  summary += `- Kişisel bilgi güncellemeleri: ${personalInfo.length}\n`;
  summary += `- Son etkileşim: ${messages[messages.length - 1]?.timestamp?.toLocaleString('tr-TR')}\n`;
  
  return summary.substring(0, 800); // Max 800 karakter
};

/**
 * Önemli öğrenmeleri çıkar
 */
const extractKeyLearnings = (messages: MessageHistory[]): string[] => {
  const learnings: string[] = [];
  
  messages.forEach(msg => {
    if (msg.role === 'user' && msg.importance && msg.importance >= 7) {
      learnings.push(`Kullanıcı ${msg.topicTags?.join(', ')} hakkında detaylı soru sordu`);
    }
    
    if (msg.role === 'assistant' && msg.content.length > 400) {
      learnings.push(`${msg.topicTags?.join(', ')} konusunda kapsamlı bilgi verildi`);
    }
  });
  
  return learnings.slice(0, 5); // En fazla 5 öğrenme
};

/**
 * Gelişmiş öğrenme profili güncellemesi
 */
const updateAdvancedLearningProfile = (
  userId: string,
  content: string,
  role: Role
): void => {
  if (!userId || role !== 'user') return;
  
  let profile = userLearningProfiles.get(userId);
  
  if (!profile) {
    profile = {
      userId,
      preferredTopics: [],
      difficultyLevel: 'beginner',
      conversationStyle: 'casual',
      previousQuestions: [],
      understandingLevel: {},
      lastInteractionDate: new Date(),
      totalInteractions: 0,
      learningProgression: {
        questionsAsked: 0,
        complexityTrend: 0,
        topicMastery: {},
        weeklyProgress: []
      },
      conversationPatterns: {
        averageResponseTime: 0,
        preferredTimeOfDay: '',
        sessionDuration: 0,
        retentionRate: 0
      }
    };
  }
  
  // Soru türlerini analiz et ve profili güncelle
  const topics = extractTopicsFromQuestion(content);
  topics.forEach(topic => {
    if (!profile!.preferredTopics.includes(topic)) {
      profile!.preferredTopics.push(topic);
    }
    
    // Understanding level'ı artır
    profile!.understandingLevel[topic] = (profile!.understandingLevel[topic] || 0) + 1;
    
    // Topic mastery güncelle
    profile!.learningProgression.topicMastery[topic] = 
      Math.min(100, (profile!.learningProgression.topicMastery[topic] || 0) + 5);
  });
  
  // Learning progression güncelle
  profile.learningProgression.questionsAsked++;
  
  // Karmaşıklık trendi
  const questionComplexity = isVeryAdvancedQuestion(content) ? 3 : 
                            isAdvancedQuestion(content) ? 2 : 1;
  profile.learningProgression.complexityTrend = 
    (profile.learningProgression.complexityTrend + questionComplexity) / 2;
  
  // Previous questions'a ekle - ÇOK ÖNEMLİ: UNLIMITED!
  profile.previousQuestions.push(content);
  
  // Zorluk seviyesini otomatik ayarla - daha akıllı
  if (profile.totalInteractions > 20 && profile.learningProgression.complexityTrend > 2.5) {
    profile.difficultyLevel = 'advanced';
  } else if (profile.totalInteractions > 10 && profile.learningProgression.complexityTrend > 1.5) {
    profile.difficultyLevel = 'intermediate';
  }
  
  profile.totalInteractions++;
  profile.lastInteractionDate = new Date();
  
  userLearningProfiles.set(userId, profile);
  
  console.log(`📈 Learning Profile Updated: ${profile.totalInteractions} interactions, complexity: ${profile.learningProgression.complexityTrend.toFixed(2)}`);
};

/**
 * Sorudan konuları çıkarır
 */
const extractTopicsFromQuestion = (question: string): string[] => {
  const topics: string[] = [];
  const questionLower = question.toLowerCase();
  
  const topicKeywords = {
    'namaz': ['namaz', 'salah', 'prayer', 'kıl', 'rak'],
    'oruç': ['oruç', 'fasting', 'ramazan', 'sahur', 'iftar'],
    'hac': ['hac', 'umre', 'pilgrimage', 'kabe'],
    'zekat': ['zekat', 'sadaka', 'charity', 'fıtra'],
    'aile': ['aile', 'family', 'evlilik', 'nikah', 'çocuk'],
    'ahlak': ['ahlak', 'ethics', 'davranış', 'karakter'],
    'fıkıh': ['fıkıh', 'hüküm', 'fetva', 'mezhep'],
    'kuran': ['kuran', 'ayet', 'sure', 'tefsir'],
    'hadis': ['hadis', 'sünnet', 'rivayet', 'peygamber']
  };
  
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => questionLower.includes(keyword))) {
      topics.push(topic);
    }
  });
  
  return topics;
};

/**
 * Kullanıcı için unlimited sohbet geçmişini getirir
 * Context window için akıllı seçim yapar
 */
const getUnlimitedConversationMemory = (userId: string, maxMessages: number = 20): MessageHistory[] => {
  const container = conversationMemory.get(userId);
  if (!container) return [];
  
  console.log(`🔍 Memory Retrieval: ${container.totalMessages} total messages for ${userId}`);
  
  // Strategy 1: Son mesajları al (immediate context)
  const recentMessages = container.messages.slice(-maxMessages);
  
  // Strategy 2: Önemli anları ekle
  const importantMessages = container.importantMoments
    .filter(msg => !recentMessages.some(recent => 
      recent.content === msg.content && recent.timestamp === msg.timestamp
    ))
    .slice(-5); // Son 5 önemli an
  
  // Strategy 3: Profil mesajlarını ekle
  const profileMessages = container.messages
    .filter(msg => msg.isProfileRelated)
    .filter(msg => !recentMessages.some(recent => 
      recent.content === msg.content && recent.timestamp === msg.timestamp
    ))
    .slice(-3); // Son 3 profil mesajı
  
  // Birleştir ve sırala
  const allRelevantMessages = [...profileMessages, ...importantMessages, ...recentMessages]
    .sort((a, b) => (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0));
  
  console.log(`📊 Retrieved: ${recentMessages.length} recent + ${importantMessages.length} important + ${profileMessages.length} profile = ${allRelevantMessages.length} total`);
  
  return allRelevantMessages;
};

/**
 * Gelişmiş hafıza özeti alma
 */
const getMemorySummary = (userId: string): string => {
  const container = conversationMemory.get(userId);
  if (!container) return '';
  
  return `HAFIZA ÖZETİ:
${container.summary}

TOPLAM ETKİLEŞİM: ${container.totalMessages} mesaj
ÖNEMLİ ANLAR: ${container.importantMoments.length}
ANAHTAR ÖĞRENMELER: ${container.keyLearnings.join(', ')}
KONULAR: ${Object.keys(container.topicEvolution).join(', ')}`;
};

/**
 * Chain of Thought yaklaşımıyla soruyu analiz eder
 */
const analyzeQuestionWithChainOfThought = (
  question: string,
  profile: UserProfile | null,
  conversationHistory: MessageHistory[]
): ChainOfThoughtStep[] => {
  const steps: ChainOfThoughtStep[] = [];
  
  // Adım 1: Soru türü analizi
  steps.push({
    step: 1,
    thought: "Kullanıcının sorusunu analiz ediyorum",
    reasoning: `Soru: "${question}". Bu sorunun türünü belirleyerek en uygun yaklaşımı seçeceğim.`,
    conclusion: isReligiousQuestion(question) ? "Bu dini bir soru" : "Bu dini olmayan bir soru"
  });
  
  // Adım 2: Unlimited memory bağlam analizi
  const relatedHistory = conversationHistory
    .filter(msg => msg.role === 'user')
    .slice(-5) // Son 5 kullanıcı mesajı
    .map(msg => msg.content);
    
  steps.push({
    step: 2,
    thought: "Unlimited memory sisteminden bağlam çıkarıyorum",
    reasoning: `Toplam hafıza: ${conversationHistory.length} mesaj. Son sorular: ${relatedHistory.join(', ')}. Bu bilgiyle daha derin bağlam kurabiliyorum.`,
    conclusion: relatedHistory.length > 0 ? `${relatedHistory.length} mesajlık zengin bağlam mevcut` : "Yeni bir konu başlıyor"
  });
  
  // Adım 3: Profil uyumluluk analizi
  steps.push({
    step: 3,
    thought: "Kullanıcı profilini soruyla eşleştiriyorum",
    reasoning: `Profil: ${profile?.religious_level || 'bilinmiyor'} seviye, ${profile?.sect || 'belirtilmemiş'} mezhep, ${profile?.age || 'bilinmiyor'} yaş`,
    conclusion: `${profile?.religious_level || 'genel'} seviyede ${profile?.sect || 'mezhepler arası'} cevap vereceğim`
  });
  
  // Adım 4: Yaklaşım stratejisi
  const isAdvanced = isAdvancedQuestion(question);
  const isVeryAdvanced = isVeryAdvancedQuestion(question);
  
  steps.push({
    step: 4,
    thought: "Cevap stratejimi belirliyorum",
    reasoning: `Soru zorluğu: ${isVeryAdvanced ? 'çok ileri' : isAdvanced ? 'ileri' : 'temel'}. Profil seviyesi: ${profile?.religious_level || 'beginner'}`,
    conclusion: determineResponseStrategy(question, profile, isAdvanced, isVeryAdvanced)
  });
  
  return steps;
};

/**
 * Cevap stratejisini belirler
 */
const determineResponseStrategy = (
  question: string,
  profile: UserProfile | null,
  isAdvanced: boolean,
  isVeryAdvanced: boolean
): string => {
  const userLevel = profile?.religious_level || 'beginner';
  
  if (isVeryAdvanced && userLevel === 'beginner') {
    return "Karmaşık soruyu basitleştirerek açıklayacağım";
  } else if (isAdvanced && userLevel === 'beginner') {
    return "İleri seviye soruya temel seviyede cevap vereceğim";
  } else if (!isAdvanced && userLevel === 'advanced') {
    return "Basit soruyu daha derin perspektifle zenginleştireceğim";
  } else {
    return "Soruyu kullanıcının seviyesine uygun şekilde cevaplayacağım";
  }
};

/**
 * Bağlamsal öğrenme için uyarlanmış sistem mesajı oluşturur
 */
const createAdaptiveSystemMessage = (
  profile: UserProfile | null,
  conversationHistory: MessageHistory[],
  chainOfThought: ChainOfThoughtStep[],
  currentQuestion: string,
  userId: string
): string => {
  let systemMessage = createSystemMessage(profile);
  
  // Unlimited memory özeti ekle
  const memorySummary = getMemorySummary(userId);
  if (memorySummary) {
    systemMessage += `\n\n🧠 UNLIMITED HAFIZA SİSTEMİ:
${memorySummary}

Bu zengin hafıza sayesinde kullanıcıyı çok iyi tanıyorum. Önceki tüm etkileşimlerimizi ve öğrenme ilerlemesini hatırlıyorum!`;
  }
  
  // Öğrenme geçmişini ekle - UNLIMITED VERSION
  if (conversationHistory.length > 0) {
    const recentTopics = conversationHistory
      .filter(msg => msg.role === 'user')
      .slice(-5) // Son 5 değil, daha geniş context
      .map(msg => msg.topicTags || [])
      .flat()
      .filter((topic, index, array) => array.indexOf(topic) === index);
    
    const totalInteractions = conversationHistory.length;
    const userMessages = conversationHistory.filter(msg => msg.role === 'user').length;
    
    systemMessage += `\n\n📚 GENİŞ SOHBET BAĞLAMI:
Bu kullanıcıyla toplam ${totalInteractions} mesaj değiştik (${userMessages} kullanıcı sorusu).
Son konuştuğumuz konular: ${recentTopics.join(', ')}
Unlimited hafıza sistemi sayesinde tüm geçmiş etkileşimlerimizi hatırlıyorum!
Bu bağlamı kullanarak çok daha kişisel ve gelişmişi cevap verebilirim.`;
  }
  
  // Chain of Thought analizini ekle
  systemMessage += `\n\n🤔 ANALİZ SÜRECİM:
${chainOfThought.map(step => 
  `${step.step}. ${step.thought}: ${step.reasoning} → ${step.conclusion}`
).join('\n')}`;
  
  // Gelişmiş learning profile
  const learningProfile = userLearningProfiles.get(userId);
  if (learningProfile) {
    const topMasteryTopics = Object.entries(learningProfile.learningProgression.topicMastery)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([topic, mastery]) => `${topic}(${mastery}%)`);
    
    systemMessage += `\n\n📊 GELİŞMİŞ ÖĞRENME PROFİLİ:
Toplam etkileşim: ${learningProfile.totalInteractions}
Soru sayısı: ${learningProfile.learningProgression.questionsAsked}
Karmaşıklık trendi: ${learningProfile.learningProgression.complexityTrend.toFixed(2)}/3
En iyi konular: ${topMasteryTopics.join(', ')}
Unlimited memory ile tüm öğrenme sürecini takip ediyorum!

UNLIMITED MEMORY AVANTAJI: Bu zengin veri ile sürekli gelişen, ChatGPT benzeri bir öğrenme deneyimi sunuyorum!`;
  }
  
  return systemMessage;
};

/**
 * Gelişmiş bağlamsal mesaj geçmişi oluşturur - UNLIMITED VERSION
 */
const createContextualMessageHistory = (
  currentQuestion: string,
  profile: UserProfile | null,
  conversationHistory: MessageHistory[]
): Message[] => {
  const messages: Message[] = [];
  const userId = profile?.user_id || profile?.email || 'anonymous';
  
  // Chain of thought analizi
  const chainOfThought = analyzeQuestionWithChainOfThought(currentQuestion, profile, conversationHistory);
  
  // Adaptif sistem mesajı - UNLIMITED MEMORY İLE
  const adaptiveSystemMessage = createAdaptiveSystemMessage(profile, conversationHistory, chainOfThought, currentQuestion, userId);
  messages.push({ role: 'system', content: adaptiveSystemMessage });
  
  // Few-shot örnekleri ekle
  const fewShotExamples = getFewShotExamples(profile);
  messages.push(...fewShotExamples);
  
  // Unlimited memory'den akıllıca seçim - maksimum bağlam
  const relevantHistory = selectRelevantHistoryFromUnlimitedMemory(currentQuestion, conversationHistory);
  
  // Önceki sohbet geçmişini mesajlara ekle
  relevantHistory.forEach(historyItem => {
    messages.push({
      role: historyItem.role as Role,
      content: historyItem.content
    });
  });
  
  // Mevcut soruyu ekle
  messages.push({ role: 'user', content: currentQuestion });
  
  console.log(`🧠 Context Created: ${messages.length} mesaj, ${relevantHistory.length} hafıza mesajı`);
  
  return messages;
};

/**
 * Unlimited memory'den akıllı mesaj seçimi
 */
const selectRelevantHistoryFromUnlimitedMemory = (
  currentQuestion: string,
  conversationHistory: MessageHistory[]
): MessageHistory[] => {
  if (conversationHistory.length === 0) return [];
  
  const currentTopics = extractTopicsFromQuestion(currentQuestion);
  const relevantMessages: MessageHistory[] = [];
  
  // 1. Profil ile ilgili sorular her zaman dahil edilir
  const profileRelated = conversationHistory.filter(msg => msg.isProfileRelated);
  relevantMessages.push(...profileRelated);
  
  // 2. Yüksek önem skoruna sahip mesajlar
  const importantMessages = conversationHistory
    .filter(msg => msg.importance && msg.importance >= 8)
    .slice(-10); // Son 10 önemli mesaj
  relevantMessages.push(...importantMessages);
  
  // 3. Benzer konulardan DAHA FAZLA çift al (unlimited advantage)
  const topicRelatedPairs: MessageHistory[] = [];
  
  for (let i = conversationHistory.length - 2; i >= 0; i -= 2) {
    if (topicRelatedPairs.length >= 12) break; // Unlimited memory ile daha fazla: 6 çift (12 mesaj)
    
    const userMsg = conversationHistory[i];
    const assistantMsg = conversationHistory[i + 1];
    
    if (userMsg && assistantMsg && userMsg.role === 'user' && assistantMsg.role === 'assistant') {
      const questionTopics = userMsg.topicTags || extractTopicsFromQuestion(userMsg.content);
      const hasCommonTopic = questionTopics.some(topic => currentTopics.includes(topic));
      
      if (hasCommonTopic || topicRelatedPairs.length < 4) { // İlk 4 çifti her zaman al
        topicRelatedPairs.unshift(userMsg, assistantMsg);
      }
    }
  }
  
  relevantMessages.push(...topicRelatedPairs);
  
  // 4. Son zamanlardaki tüm mesajları dahil et (ChatGPT benzeri)
  const recentMessages = conversationHistory.slice(-8); // Son 8 mesaj
  relevantMessages.push(...recentMessages);
  
  // Benzersiz mesajları döndür
  const uniqueMessages = relevantMessages.filter((msg, index, array) => 
    array.findIndex(m => m.content === msg.content && m.role === msg.role && m.timestamp === m.timestamp) === index
  );
  
  // Kronolojik sıralama
  const sortedMessages = uniqueMessages.sort((a, b) => 
    (a.timestamp?.getTime() || 0) - (b.timestamp?.getTime() || 0)
  );
  
  console.log(`🎯 Unlimited Memory Selection: ${sortedMessages.length} relevant messages from ${conversationHistory.length} total`);
  
  return sortedMessages;
};

/**
 * Sorunun dini konu olup olmadığını kontrol eder
 */
const isReligiousQuestion = (question: string): boolean => {
  const religiousKeywords = [
    // Temel dini terimler
    'allah', 'tanrı', 'peygamber', 'muhammed', 'islam', 'müslüman', 'kuran', 'kur\'an', 'ayet', 'sure', 'hadis',
    // İbadetler
    'namaz', 'oruç', 'ramazan', 'hac', 'umre', 'zekat', 'sadaka', 'dua', 'zikir', 'tesbih', 'istiğfar',
    // Namaz terimleri
    'abdest', 'gusül', 'kıble', 'ezan', 'imama', 'cemaat', 'vitir', 'teravih', 'fecir', 'öğle', 'ikindi', 'akşam', 'yatsı',
    // Fıkhi terimler
    'helal', 'haram', 'mekruh', 'müstehab', 'farz', 'vacip', 'sünnet', 'bid\'at',
    // Mezhep ve mezhepler
    'mezhep', 'hanefi', 'şafi', 'şafii', 'maliki', 'hanbeli', 'caferî', 'zeydî',
    // Dini kavramlar
    'iman', 'islam', 'ihsan', 'tevhid', 'şirk', 'küfür', 'nifak', 'tövbe', 'istiğfar', 'hamd', 'şükür',
    // Ahlak ve davranış
    'ahlak', 'edep', 'saygı', 'hoşgörü', 'sabır', 'tevekkül', 'rıza', 'kanaatkarlık',
    // Özel günler ve zamanlar
    'cuma', 'bayram', 'kandil', 'regaib', 'miraç', 'berat', 'kadir gecesi',
    // Aile ve sosyal hayat
    'nikah', 'evlilik', 'talak', 'boşanma', 'miras', 'vasiyet', 'akika', 'adak',
    // Yemek ve içecek
    'yemek', 'içecek', 'alkol', 'domuz', 'kesim', 'kurban', 'et',
    // Para ve ticaret
    'faiz', 'riba', 'ticaret', 'kazanç', 'çalışma', 'emek',
    // Ölüm ve ahiret
    'ölüm', 'kabir', 'ahiret', 'cennet', 'cehennem', 'kıyamet', 'hesap',
    // Sosyal ilişkiler
    'anne', 'baba', 'aile', 'çocuk', 'komşu', 'arkadaş', 'kardeş' + ' (dini)',
    // Genel sorular
    'dini', 'İslami', 'islamda', 'islamın', 'müslümanda', 'dinde', 'peygamberimiz',
    // Kitaplar
    'tefsir', 'meal', 'siyer', 'hadis kitabı', 'fıkıh',
    // Mekânlar
    'mescit', 'cami', 'mihrap', 'minber', 'kabe', 'mekke', 'medine'
  ];

  const questionLower = question.toLowerCase()
    .replace(/[^a-zçğıöşüû\s]/gi, ' ') // Özel karakterleri temizle
    .split(' ')
    .filter(word => word.length > 2); // 2 karakterden kısa kelimeleri filtrele

  // En az bir dini kelime içermeli
  const hasReligiousKeyword = questionLower.some(word => 
    religiousKeywords.some(keyword => 
      word.includes(keyword) || keyword.includes(word)
    )
  );

  // Genel dini sorular
  const religiousPatterns = [
    /\b(nasıl\s+dua|dua\s+nasıl|namaz\s+nasıl|oruç\s+nasıl)\b/i,
    /\b(haram\s+mı|helal\s+mi|caiz\s+mi|günah\s+mı)\b/i,
    /\b(allahın|peygamberin|kuranın|hadiste|islamda)\b/i,
    /\b(mezhebim|mezhebin|dini|İslami|müslüman)\b/i
  ];

  const hasReligiousPattern = religiousPatterns.some(pattern => pattern.test(question));

  return hasReligiousKeyword || hasReligiousPattern;
};

/**
 * Soru seviye analizi fonksiyonları
 */
const isAdvancedQuestion = (question: string): boolean => {
  const advancedKeywords = [
    'mezhep', 'fıkıh', 'içtihat', 'delil', 'hadis', 'rivayet', 'sened', 'sahih', 'zayıf',
    'istinbat', 'kıyas', 'icma', 'istihsan', 'maslahat', 'usul', 'furû', 'şeriat',
    'tarih', 'sebeb-i nüzul', 'nesih', 'muhkem', 'müteşabih', 'tefsir', 'tevil'
  ];
  
  const questionLower = question.toLowerCase();
  return advancedKeywords.some(keyword => questionLower.includes(keyword)) ||
         question.includes('neden') || question.includes('niçin') || question.includes('fark');
};

const isVeryAdvancedQuestion = (question: string): boolean => {
  const veryAdvancedKeywords = [
    'mezhebler arası', 'karşılaştır', 'hangi mezhep', 'fark nedir', 'ihtilaf',
    'görüş ayrılığı', 'muhtelif', 'ihtilaflı', 'kavl', 'müctehid', 'taklit',
    'fetva', 'istifta', 'tercih', 'mukayese', 'analiz', 'eleştir'
  ];
  
  const questionLower = question.toLowerCase();
  return veryAdvancedKeywords.some(keyword => questionLower.includes(keyword)) ||
         (question.includes('?') && question.split('?').length > 2); // Çoklu soru
};

/**
 * Kullanıcının profil bilgilerini soran soru olup olmadığını kontrol eder
 */
const isProfileInfoQuestion = (question: string): boolean => {
  const profileKeywords = [
    'benim', 'mezhebim', 'mezhep', 'yaşım', 'yaş', 'şehrim', 'şehir', 'cinsiyetim', 'cinsiyet',
    'bilgilerim', 'bilgi', 'profil', 'kimim', 'hangi', 'nerede', 'kaç yaşında',
    'hangi mezhep', 'hangi şehir', 'hangi yaş', 'adım ne', 'soyadım ne'
  ];

  const questionLower = question.toLowerCase();
  return profileKeywords.some(keyword => questionLower.includes(keyword));
};

/**
 * Spesifik mezhep sorusu mu kontrol eder
 */
const isSpecificSectQuestion = (question: string): boolean => {
  const sectKeywords = [
    'mezhebim ne', 'mezhebim nedir', 'hangi mezhep', 'mezhebin ne', 'mezhebin nedir',
    'hanefi mi', 'şafi mi', 'maliki mi', 'hanbeli mi', 'hangi mezhebi',
    'mezhebim', 'benim mezhebim'
  ];

  const questionLower = question.toLowerCase().trim();
  return sectKeywords.some(keyword => questionLower.includes(keyword));
};

/**
 * Spesifik yaş sorusu mu kontrol eder  
 */
const isSpecificAgeQuestion = (question: string): boolean => {
  const ageKeywords = [
    'yaşım kaç', 'yaşım ne', 'kaç yaşında', 'yaşın kaç', 'yaşın ne',
    'yaşım', 'benim yaşım', 'hangi yaş'
  ];

  const questionLower = question.toLowerCase().trim();
  return ageKeywords.some(keyword => questionLower.includes(keyword));
};

/**
 * Yaş grubuna göre kategori belirleme
 */
const getAgeCategory = (age: number | undefined): string => {
  if (!age) return 'bilinmiyor';
  
  if (age >= 0 && age <= 12) return 'çocuk';
  if (age >= 13 && age <= 18) return 'genç';
  if (age >= 19 && age <= 30) return 'yetişkin';
  if (age >= 31 && age <= 50) return 'orta_yaş';
  if (age >= 51 && age <= 65) return 'olgun';
  if (age > 65) return 'yaşlı';
  
  return 'bilinmiyor';
};

/**
 * Mezhep bazlı özel bilgi ve fıkhi farklılıklar
 */
const getSectSpecificInfo = (sect: string | undefined): any => {
  if (!sect) return null;
  
  const sectLower = sect.toLowerCase();
  
  const sectInfo = {
    hanefi: {
      name: 'Hanefi',
      founder: 'İmam Azam Ebu Hanife (ra)',
      characteristics: [
        'En yaygın mezhep olma özelliği',
        'Rey ve istihsan metodunu kullanma',
        'Pratik hayata yönelik çözümler üretme',
        'Ticari hayatta esneklik sağlama'
      ],
      specificRulings: {
        wudu: 'Namaz abdestinde eller buruna kadar yıkanır ve ayaklar ovuşturulur',
        prayer: {
          hands: 'Namaz kılarken eller göbek altında bağlanır',
          rafu: 'Sadece başlangıç tekbirinde eller kaldırılır',
          witr: 'Vitir namazı vaciptir ve 3 rekat tek selamla kılınır',
          qunoot: 'Kunut sadece vitir namazında okunur, sabah namazında okunmaz',
          touch: 'Karşı cinse dokunmak abdesti bozmaz (şehvetle olmadıkça)'
        },
        marriage: 'Kadın kendi nikahını kıyabilir (denk eşle)',
        divorce: 'Üç boşama aynı anda söylense bile üç sayılır',
        inheritance: 'Mirasçı olmayan yakınlara vasiyetname ile pay verilebilir'
      },
      regions: 'Türkiye, Balkanlar, Orta Asya, Hindistan Alt Kıtası',
      books: 'Hidaye, Fethu\'l-Kadir, Dürrü\'l-Muhtar'
    },
    
    şafi: {
      name: 'Şafi',
      founder: 'İmam Şafi (ra)',
      characteristics: [
        'Hadisleri çok önemser',
        'Sistematik fıkıh metodolojisi',
        'Orta yol yaklaşımı',
        'Net deliller arar'
      ],
      specificRulings: {
        wudu: 'Ayaklar topuklar dahil iyice yıkanmalıdır',
        prayer: {
          hands: 'Namaz kılarken eller göğüs üzerinde bağlanır',
          rafu: 'Rükuya giderken, rükudan kalkarken ve 3. rekatta eller kaldırılır',
          basmala: 'Fatiha öncesi Besmele yüksek sesle okunur',
          qunoot: 'Sabah namazında kunut okunur (her gün)',
          amin: 'Fatiha sonrası Amin yüksek sesle söylenir',
          touch: 'Karşı cinse dokunmak kesinlikle abdesti bozar'
        },
        marriage: 'Kadının nikahı için mutlaka veli gereklidir',
        divorce: 'Üç boşama aynı anda söylense de üç sayılır',
        inheritance: 'Mirasçı olmayan yakınlara vasiyet ancak 1/3 ile sınırlıdır'
      },
      regions: 'Mısır, Şam, Yemen, Endonezya, Malezya',
      books: 'Ümm, Mecmu, Minhac'
    },

    maliki: {
      name: 'Maliki',
      founder: 'İmam Malik (ra)',
      characteristics: [
        'Medine ehlinin amelini önemser',
        'Maslahat (kamu yararı) esasını benimser',
        'Geleneksel uygulamaları korur',
        'Toplumsal fayda arar'
      ],
      specificRulings: {
        wudu: 'Abdest alırken organlar üç defa değil bir defa yıkanabilir',
        prayer: {
          hands: 'Namaz kılarken eller yan tarafta serbest bırakılabilir',
          rafu: 'Sadece başlangıç tekbirinde eller kaldırılır',
          basmala: 'Farz namazlarda Besmele okunmaz',
          qunoot: 'Sadece felaket zamanlarında kunut okunur',
          amin: 'Fatiha sonrası Amin sessizce söylenir',
          finger: 'Teşehhüdde işaret parmağı hareket ettirilir'
        },
        marriage: 'Veli izni şarttır, şartlı nikah kabul edilir',
        divorce: 'Zaruri durumlarda kadına geniş boşanma hakkı tanınır',
        inheritance: 'Toplumsal maslahat gözetilerek esneklik sağlanır'
      },
      regions: 'Kuzey Afrika, Batı Afrika, Endülüs',
      books: 'Muvatta, Mudavvene, Risale'
    },

    hanbeli: {
      name: 'Hanbeli',
      founder: 'İmam Ahmed ibn Hanbel (ra)',
      characteristics: [
        'Hadislere çok sıkı bağlılık',
        'Zayıf hadisi bile kıyasa tercih eder',
        'Literal/zahiri yaklaşım',
        'Selefi metodoloji'
      ],
      specificRulings: {
        wudu: 'Ayaklar topuklar dahil tamamen yıkanmalıdır',
        prayer: {
          hands: 'Namaz kılarken eller göğüs üzerinde bağlanır',
          rafu: 'Rükuya giderken, rükudan kalkarken ve 3. rekatta eller kaldırılır',
          basmala: 'Fatiha öncesi Besmele sessizce okunur',
          qunoot: 'Sadece vitir namazında (Ramazan\'da) kunut okunur',
          amin: 'Fatiha sonrası Amin yüksek sesle söylenir',
          awra: 'Kadının yüzü de örtülmelidir (niqab)'
        },
        marriage: 'Veli izni kesinlikle şarttır, şartlı nikah geçerlidir',
        divorce: 'Sedd-i zerai (zararlı yollara kapama) ilkesiyle katı yaklaşım',
        inheritance: 'Hadis delillerine sıkı sıkıya bağlılık'
      },
      regions: 'Suudi Arabistan, Körfez Ülkeleri, Filistin',
      books: 'Mugni, Merdavi, Zad-ül Mead'
    }
  };

  // Mezhep adını normalize et
  if (sectLower.includes('hanefi') || sectLower.includes('hanafi')) {
    return sectInfo.hanefi;
  } else if (sectLower.includes('şafi') || sectLower.includes('shafi') || sectLower.includes('safii')) {
    return sectInfo.şafi;
  } else if (sectLower.includes('maliki') || sectLower.includes('mâlikî')) {
    return sectInfo.maliki;
  } else if (sectLower.includes('hanbeli') || sectLower.includes('hanbali')) {
    return sectInfo.hanbeli;
  }
  
  return null;
};

/**
 * Yaş grubuna özel yaklaşım ve tavsiyeler
 */
const getAgeSpecificGuidance = (age: number | undefined, ageCategory: string): any => {
  const ageGuidance = {
    çocuk: {
      approach: 'Çok basit, sevgi dolu, teşvik edici',
      language: 'Çocuk diline uygun, masalsı anlatım',
      focus: 'Allah\'ın sevgisi, namaz sevdirme, aile değerleri',
      examples: 'Hikayeler, basit sorular, oyunlaştırma',
      encouragement: 'Aferin, çok güzel, Allah seni çook seviyor!'
    },
    genç: {
      approach: 'Anlayışlı, destekleyici, modern örneklerle',
      language: 'Gençlerin anlayacağı, güncel örnekler',
      focus: 'İbadet alışkanlığı, arkadaş ilişkileri, okul hayatı',
      examples: 'Günlük hayattan örnekler, sosyal medya, spor',
      encouragement: 'Sen çok değerlisin, yavaş yavaş öğrenirsin'
    },
    yetişkin: {
      approach: 'Pratik, çözüm odaklı, iş hayatı uyumlu',
      language: 'Açık, net, somut tavsiyelер',
      focus: 'İş-ibadet dengesi, evlilik, sorumluluklar',
      examples: 'Çalışma hayatı, aile kurma, ekonomik meseleler',
      encouragement: 'Allah kolaylık verecek, sen gayet iyisin'
    },
    orta_yaş: {
      approach: 'Tecrübe sahibi yaklaşım, derin içerik',
      language: 'Ağırbaşlı, hikmetli, ayet-hadis zengin',
      focus: 'Çocuk terbiyesi, toplumsal sorumluluk, ahiret hazırlığı',
      examples: 'Aile içi problemler, iş stres, sağlık kaygıları',
      encouragement: 'Tecrübeniz çok değerli, doğru yoldasınız'
    },
    olgun: {
      approach: 'Saygılı, hikmet dolu, sabırlı',
      language: 'Klasik, ağırbaşlı, geleneksel ifadeler',
      focus: 'Ahiret hazırlığı, tövbe, şükür, sağlık',
      examples: 'Ömür değerlendirmesi, tövbe, hayır işleri',
      encouragement: 'Allah sizden razı olsun, çok hayırlı'
    },
    yaşlı: {
      approach: 'Çok saygılı, şefkatli, merhametli',
      language: 'Geleneksel, duygusal, manevi',
      focus: 'Dua, zikir, tövbe, ahiret, aile yakınlığı',
      examples: 'Torun sevgisi, hayır duası, geçmiş anılar',
      encouragement: 'Dualarınız çok değerli, Allah mukafat versin'
    }
  };

  return ageGuidance[ageCategory] || ageGuidance.yetişkin;
};

/**
 * Spesifik mezhep sorusuna cevap üretir
 */
const generateSectSpecificResponse = (profile: UserProfile | null): string => {
  if (!profile?.sect) {
    return `Üzgünüm, profil bilgilerinizde mezhep bilginiz bulunmuyor. 

Profilinizi düzenleyerek mezhebinizi belirtebilirsiniz. İslam'da dört büyük mezhep vardır:

🕌 **Hanefi**: En yaygın mezhep (Türkiye, Orta Asya)
🕌 **Şafi**: Hadis odaklı mezhep (Mısır, Endonezya) 
🕌 **Maliki**: Medine geleneği (Kuzey Afrika)
🕌 **Hanbeli**: Literal yaklaşım (Suudi Arabistan)

Hangi mezhebe mensup olduğunuzu belirtirseniz, size o mezhebin özelliklerine göre daha doğru rehberlik sağlayabilirim. 🤲`;
  }

  const sectInfo = getSectSpecificInfo(profile.sect);
  const name = profile.name ? ` ${profile.name} kardeşim` : ' kardeşim';
  
  if (!sectInfo) {
    return `Merhaba${name}! 

Profilinizde "${profile.sect}" mezhebinde olduğunuz belirtilmiş. Bu mezhep hakkında size rehberlik edebilirim.

Daha detaylı bilgi almak için profilinizi güncellemeyi düşünebilirsiniz. 🤲`;
  }

  return `Merhaba${name}! 

**🕌 Mezhebiniz: ${sectInfo.name} Mezhebimi**

**👨‍🏫 Kurucusu:** ${sectInfo.founder}

**🌟 Temel Özellikleri:**
${sectInfo.characteristics.map((char: string) => `• ${char}`).join('\n')}

**📚 Önemli Eserleri:** ${sectInfo.books}
**🌍 Yaygın Olduğu Bölgeler:** ${sectInfo.regions}

**🕌 Size Özel Mezhep Bilgileri:**

**📿 Namaz Konusunda:**
• ${sectInfo.specificRulings.prayer.hands}
• ${sectInfo.specificRulings.prayer.rafu}
${sectInfo.specificRulings.prayer.witr ? `• ${sectInfo.specificRulings.prayer.witr}` : ''}

**💧 Abdest Konusunda:**
• ${sectInfo.specificRulings.wudu}

Bu mezhebe göre İslami konulardaki sorularınızı sorabilirsiniz. Size ${sectInfo.name} fıkhına uygun en doğru cevapları vereceğim. 🤲

Başka merak ettiğiniz konular var mı?`;
};

/**
 * Spesifik yaş sorusuna cevap üretir
 */
const generateAgeSpecificResponse = (profile: UserProfile | null): string => {
  if (!profile?.age) {
    return `Üzgünüm, profil bilgilerinizde yaş bilginiz bulunmuyor.

Profilinizi düzenleyerek yaşınızı belirtirseniz, size yaş grubunuza özel İslami rehberlik sağlayabilirim:

👶 **Çocuklar (0-12)**: Oyunlarla İslam öğretimi
👦 **Gençler (13-18)**: Modern hayatla İslam uyumu  
👨 **Yetişkinler (19-30)**: İş-ibadet dengesi
👨‍💼 **Orta Yaş (31-50)**: Aile ve toplumsal sorumluluklar
👴 **Olgun Yaş (51-65)**: Ahiret hazırlığı ve hikmet
👴 **Yaşlılar (65+)**: Manevi derinlik ve dualar

Yaşınızı belirttiğinizde, size uygun tavsiyelerde bulunabilirim! 🤲`;
  }

  const ageCategory = getAgeCategory(profile.age);
  const ageGuidance = getAgeSpecificGuidance(profile.age, ageCategory);
  const name = profile.name ? ` ${profile.name}` : '';
  
  let ageGroupName = '';
  let ageIcon = '';
  
  switch(ageCategory) {
    case 'çocuk':
      ageGroupName = 'Çocuk';
      ageIcon = '👶';
      break;
    case 'genç':
      ageGroupName = 'Genç';
      ageIcon = '👦';
      break;
    case 'yetişkin':
      ageGroupName = 'Yetişkin';
      ageIcon = '👨';
      break;
    case 'orta_yaş':
      ageGroupName = 'Orta Yaş';
      ageIcon = '👨‍💼';
      break;
    case 'olgun':
      ageGroupName = 'Olgun Yaş';
      ageIcon = '👴';
      break;
    case 'yaşlı':
      ageGroupName = 'İleri Yaş';
      ageIcon = '👴';
      break;
    default:
      ageGroupName = 'Yetişkin';
      ageIcon = '👨';
  }

  return `Merhaba${name}! 

**${ageIcon} Yaşınız: ${profile.age} (${ageGroupName} Kategorisi)**

**🎯 Size Özel Yaklaşımım:**
${ageGuidance.approach}

**📢 İletişim Tarzım:**
${ageGuidance.language}

**🎪 Odaklandığım Konular:**
${ageGuidance.focus}

**📝 Verdiğim Örnekler:**
${ageGuidance.examples}

**💪 Size Özel Tavsiyelerim:**

${ageCategory === 'çocuk' ? `
🌟 **Çocuk Kardeşime Özel:**
• Namaz vakitleri geldiğinde oyun gibi kılmaya çalış
• Allah'ın seni çok sevdiğini unutma
• Anne babanı dinle, onlar senin için en iyisini ister
• Kur'an öğrenmeye devam et, çok güzel ses çıkarıyorsun!
` : ageCategory === 'genç' ? `
🚀 **Genç Kardeşime Özel:**
• Okul hayatını namaz vakitleriyle uyumlu hale getir
• Arkadaş seçiminde dikkatli ol, seni iyiye yönlendirenleri tercih et
• Sosyal medyada İslami değerlere ters düşmemeye özen göster
• Gelecek kaygıların için Allah'a güven, O senin için en iyisini planlıyor
` : ageCategory === 'yetişkin' ? `
💼 **Yetişkin Kardeşime Özel:**
• İş hayatında namaz vakitlerini ayarlamaya çalış
• Evlilik düşünüyorsan helal yoldan ilerlemeye özen göster
• Ekonomik kaygılarında Allah'a tevekkül et
• Sosyal sorumluluk projelerinde yer almaya çalış
` : ageCategory === 'orta_yaş' ? `
🏠 **Orta Yaş Kardeşime Özel:**
• Çocuklarına İslam ahlakını öğretmeyi ihmal etme
• Ailene karşı sorumluluklarını yerine getirirken ibadetten taviz verme
• Toplumsal liderlik rollerinde İslami değerleri yaşat
• Ahiret hazırlığını da ihmal etme, bu dünya geçici
` : ageCategory === 'olgun' ? `
🍃 **Olgun Kardeşime Özel:**
• Tecrübelerinizi gençlerle paylaşmaya devam edin
• Sağlık problemleriniz için sabır ve şükür içinde olun
• Hayır işlerine yönelin, Allah katında büyük sevap var
• Tövbe ve istighfar ile ahiret hazırlığını güçlendirin
` : `
🤲 **Yaşlı Kardeşime Özel:**
• Dualarınız çok kıymetli, Allah sizden razı olsun
• Torunlarınıza manevi değerleri aktarmaya devam edin
• Geçmiş günahlarınız için tövbe edin, Allah Gafurdur
• Her an Allah'ı anmaya çalışın, O sizinle beraber
`}

${ageGuidance.encouragement}

Bu yaş grubunuza uygun başka sorularınız varsa çekinmeden sorun! 🤲`;
};



/**
 * Kullanıcı profil bilgilerini formatlar ve döndürür
 */
const generateProfileResponse = (profile: UserProfile | null): string => {
  if (!profile) {
    return "Üzgünüm, profil bilgilerinize şu anda erişemiyorum. Profil ayarlarınızdan bilgilerinizi kontrol edebilirsiniz.";
  }

  const { name, surname, age, gender, sect, city, religious_level } = profile;
  
  let response = "İşte mevcut profil bilgileriniz:\n\n";
  
  if (name) response += `📝 **Ad:** ${name}\n`;
  if (surname) response += `📝 **Soyad:** ${surname}\n`;
  if (age) response += `🎂 **Yaş:** ${age}\n`;
  if (gender) response += `👤 **Cinsiyet:** ${gender === 'male' ? 'Erkek' : 'Kadın'}\n`;
  if (sect) response += `🕌 **Mezhep:** ${sect.charAt(0).toUpperCase() + sect.slice(1)}\n`;
  if (city) response += `🏙️ **Şehir:** ${city}\n`;
  if (religious_level) {
    const levelText = religious_level === 'beginner' ? 'Başlangıç' : 
                     religious_level === 'intermediate' ? 'Orta' : 'İleri';
    response += `📚 **Dini Seviye:** ${levelText}\n`;
  }
  
  response += `\nBu bilgilere göre size özel tavsiyelerde bulunuyorum. Profil bilgilerinizi güncellemek için profil sayfasını ziyaret edebilirsiniz. 🤲`;
  
  return response;
};

/**
 * Kullanıcı profiline göre ultra kişiselleştirilmiş sistem mesajı oluşturur
 */
const createSystemMessage = (profile: UserProfile | null): string => {
  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  
  // Temel kimlik - Çok sıkı filtre
  let systemMessage = `Sen İmam AI'sın - SADECE İslami ve dini konularda uzman bir rehbersin. DİKKAT: Sadece dini sorulara cevap ver, diğer her türlü soruyu kibarca reddet.`;
  
  // Zaman bazlı selamlama
  if (currentHour >= 5 && currentHour < 12) {
    systemMessage += ` Sabah vakti olduğu için "Hayırlı sabahlar" de.`;
  } else if (currentHour >= 12 && currentHour < 18) {
    systemMessage += ` Gündüz olduğu için "Hayırlı günler" de.`;
  } else if (currentHour >= 18 && currentHour < 21) {
    systemMessage += ` Akşam olduğu için "Hayırlı akşamlar" de.`;
  } else {
    systemMessage += ` Gece olduğu için "Hayırlı geceler" de.`;
  }
  
  if (!profile) {
    systemMessage += ` Genel İslami rehberlik yap. Nazik, sabırlı ve öğretici ol. Dini olmayan sorulara "Bu konuda yardımcı olamam, sadece dini konularda rehberlik edebilirim" şeklinde cevap ver.`;
    return systemMessage;
  }

  const { name, surname, gender, sect, city, age, religious_level } = profile;
  
  // Kişisel hitap
  if (name) {
    systemMessage += ` Kullanıcının adı ${name}, ona uygun hitap et.`;
  }
  
  // Cinsiyet bazlı hitap
  if (gender === 'male') {
    systemMessage += ` Erkek kullanıcı - "kardeşim", "ağabey" diyebilirsin.`;
  } else if (gender === 'female') {
    systemMessage += ` Kadın kullanıcı - "kız kardeşim", "abla" diyebilirsin.`;
  }
  
  // Yaş grubu yaklaşımı
  if (age) {
    if (age < 18) {
      systemMessage += ` Genç kullanıcı (${age}) - Basit dil, anlayışlı yaklaşım.`;
    } else if (age >= 40) {
      systemMessage += ` Olgun kullanıcı (${age}) - Saygılı ve tecrübe dolu yaklaşım.`;
    }
  }
  
  // Dini seviye bazlı yaklaşım - ULTRA DETAY
  if (religious_level) {
    if (religious_level === 'beginner') {
      systemMessage += ` 
🎯 BAŞLANGIÇ SEVİYESİ KURALLAR:
- MUTLAKA basit kelimeler kullan (Arapça terimler yerine Türkçe karşılıkları)
- Maksimum 100-150 kelime ile cevap ver
- Kısa, öz cümleler kur (en fazla 10-12 kelime)
- Karmaşık konuları 2-3 basit adımda açıkla
- Emoji kullan, dostça yaklaş
- "Merak etme", "Yavaş yavaş öğrenirsin" gibi cesaretlendirici ifadeler kullan
- Temel bilgilerle yethin, detaya girme`;
    } else if (religious_level === 'intermediate') {
      systemMessage += ` 
🎯 ORTA SEVİYE KURALLAR:
- Normal dil seviyesi kullan
- 200-300 kelimelik cevaplar ver
- MUTLAKA ayet/hadis referansı ekle
- Mezhebi farklılıkları belirt ama basitçe
- Pratik uygulamalar da öner
- Hem temel hem detay bilgi ver
- Anlayışlı ama bilgili yaklaş`;
    } else if (religious_level === 'advanced') {
      systemMessage += ` 
🎯 İLERİ SEVİYE KURALLAR:
- Akademik terminoloji kullanabilirsin
- 400-500 kelimelik kapsamlı cevaplar ver
- MUTLAKA kaynak belirt (kitap, alim isimleri)
- Mezhebler arası karşılaştırma yap
- Tarihsel bağlam ver
- Fıkhi delillendirme yap
- Farklı görüşleri analiz et
- İhtilaf noktalarını açıkla`;
    }
  }

  // YAŞ VE MEZHEP ENTEGRASYONU - ULTRA KAPSAMLI
  const ageCategory = getAgeCategory(age);
  const ageGuidance = getAgeSpecificGuidance(age, ageCategory);
  const sectInfo = getSectSpecificInfo(sect);
  
  // Yaş grubu için özelleştirme
  if (ageCategory && ageGuidance) {
    systemMessage += ` 
🎯 YAŞ GRUBU (${ageCategory.toUpperCase()}):
- Yaklaşım: ${ageGuidance.approach}
- Dil: ${ageGuidance.language}
- Odak: ${ageGuidance.focus}
- Örnekler: ${ageGuidance.examples}
- Teşvik: ${ageGuidance.encouragement}`;
  }

  // Mezhep bilgisi - ÇOK ÖNEMLİ
  if (sect && sectInfo) {
    systemMessage += ` 
🕌 MEZHEP: ${sectInfo.name.toUpperCase()} - Bu mezhebin görüşlerini MUTLAKA öncelikle ver!

📚 MEZHEP ÖZELLİKLERİ:
${sectInfo.characteristics.map((char: string) => `- ${char}`).join('\n')}

⭐ SPESİFİK HÜKÜMLER:
- Abdest: ${sectInfo.specificRulings.wudu}
- Namaz Duruşu: ${sectInfo.specificRulings.prayer.hands}
- Tekbir: ${sectInfo.specificRulings.prayer.rafu}
${sectInfo.specificRulings.prayer.witr ? `- Vitir: ${sectInfo.specificRulings.prayer.witr}` : ''}
${sectInfo.specificRulings.prayer.qunoot ? `- Kunut: ${sectInfo.specificRulings.prayer.qunoot}` : ''}
${sectInfo.specificRulings.prayer.touch ? `- Temasta Abdest: ${sectInfo.specificRulings.prayer.touch}` : ''}

📖 Ana Kaynaklar: ${sectInfo.books}
🌍 Coğrafi Yaygınlık: ${sectInfo.regions}

🔍 ÖZEL TALİMAT: Her fıkhi soruda bu mezhebin hükmünü ÖNCE söyle, sonra diğer mezheplerle karşılaştır!`;
  } else if (sect) {
    const sectDisplay = sect.charAt(0).toUpperCase() + sect.slice(1);
    systemMessage += ` ${sectDisplay} MEZHEBİ - Bu mezhebin görüşlerini MUTLAKA öncelikle ver. Diğer mezhepler sadece karşılaştırma için.`;
  }
  
  // Şehir bilgisi
  if (city) {
    systemMessage += ` ${city} şehrinde yaşıyor - Bu bölgenin kültürünü dikkate al.`;
  }
  
  // Zamana ve duruma göre bağlamsal empati
  const currentMonth = currentTime.getMonth() + 1;
  const currentDay = currentTime.getDate();
  
  let contextualApproach = '';
  
  // Ramazan, Hac, özel günler kontrolü
  if (currentMonth === 3 || currentMonth === 4) { // Ramazan yakını
    contextualApproach += ' Ramazan dönemindeyiz, oruç ve ibadet konularında özellikle destekleyici ol.';
  } else if (currentMonth === 7) { // Hac zamanı
    contextualApproach += ' Hac mevsimindeyiz, hac ve umre konularında özen göster.';
  } else if (currentMonth === 12) { // Kurban bayramı
    contextualApproach += ' Kurban bayramı yakın, kurban ve bayram adabı konularında hazır ol.';
  }
  
  // Hafta içi/sonu yaklaşımı
  const dayOfWeek = currentTime.getDay();
  if (dayOfWeek === 5) { // Cuma
    contextualApproach += ' Cuma günü olduğu için cuma namazı ve önemine özel vurgu yap.';
  } else if (dayOfWeek === 0 || dayOfWeek === 6) { // Hafta sonu
    contextualApproach += ' Hafta sonu olduğu için dinlenme ve aile zamanı konularında anlayışlı ol.';
  }
  
  // Temel yaklaşım ilkeleri
  systemMessage += `

🎯 YAKLAŞIMIN:
- MUTLAKA empati ve anlayışla karşıla
- Kullanıcının seviyesine göre cevap ver
- Kur'an ve hadisle destekle
- Pratik tavsiyeler sun
- Pozitif ve destekleyici ol${contextualApproach}

💬 İLETİŞİM:
- Sıcak ama saygılı ol
- Kullanıcının dini seviyesine uygun dil kullan
- Duygusal destek de ver
- Mezhebi bilgileri öncelikle ver

🚫 KESİN SINIRLAR:
- SADECE dini sorulara cevap ver
- Politik tartışmalara asla girme
- Teknoloji, spor, yemek tarifi gibi dini olmayan konulara CEVAP VERME
- "Bu konuda yardımcı olamam, sadece dini konularda rehberlik edebilirim" de
- Terör/şiddet ile İslam'ı asla bağdaştırma
- Mezhep kavgası çıkarma`;
  
  return systemMessage;
};

/**
 * Kullanıcı profiline göre ultra kişiselleştirilmiş few-shot örnekleri
 */
const getFewShotExamples = (profile: UserProfile | null): Message[] => {
  const sect = profile?.sect;
  const age = profile?.age;
  const gender = profile?.gender;
  const name = profile?.name;
  const religiousLevel = profile?.religious_level;
  
  // Temel örnekler - tüm kullanıcılar için
  const examples: Message[] = [
    {
      role: 'user',
      content: 'Merhaba, nasılsın?'
    },
    {
      role: 'assistant',
      content: `Esselamun aleyküm ve rahmetullahi ve berekatüh! ${name ? `${name} kardeşim` : 'Değerli kardeşim'}, elhamdülillah iyiyim. Sen nasılsın? İnşallah hayırlısın. Size nasıl yardımcı olabilirim? 🤲`
    },
    {
      role: 'user',
      content: 'Namaz nasıl kılınır?'
    },
    {
      role: 'assistant',
      content: `${name ? `${name} kardeşim` : 'Kardeşim'}, namaz konusunda size yardımcı olmaktan mutluluk duyarım. Namaz İslam'ın beş şartından biri ve günde beş vakit kılınması farz olan en önemli ibadettir. 

📿 **Namazın Temel Adımları:**
1. **Abdest** - Temizlik namazın anahtarıdır
2. **Kıbleye yönelme** - Mekke istikametine dönüş
3. **Niyet** - Hangi namazı kılacağınıza karar verme
4. **İftitah Tekbiri** - "Allahu ekber" diyerek başlama
5. **Kıyam** - Ayakta duruş ve kıraat
6. **Rükû** - Eğilme posizyonu
7. **Secde** - Alnı yere koyma
8. **Oturuş (Ka'de)** - Oturarak tahiyyat okuma
9. **Selam** - Namazı bitirme

${sect === 'Hanefi' ? 'Hanefi mezhebimizde vitir namazı da vaciptir.' : sect === 'Şafi' ? 'Şafi mezhebimizde Fatiha suresini okumak farzdır.' : ''}

Hangi konuda daha detaylı bilgi istersiniz? 🕌`
    }
  ];
  
  // Yaş grubuna göre özelleştirilmiş örnekler
  if (age && age < 18) {
    examples.push(
      {
        role: 'user',
        content: 'Oruç tutmak zor geliyor, ne yapmalıyım?'
      },
      {
        role: 'assistant',
        content: `${name ? `${name}` : 'Gençliğin'}, bu çok normal bir duygu! Oruç tutmak başta herkes için zor olur, sen yalnız değilsin. 🌟

**Kolaylaştırıcı tavsiyelerim:**
- Sahurda bol bol su iç ve tok et
- Gündüz meşgul olmaya çalış (kitap oku, oyun oyna)
- Arkadaşlarınla beraber oruç tutmaya çalış
- Her başarılı oruç için kendini küçük hediyelerle ödüllendir

Peygamberimiz (SAV) şöyle buyurdu: "Orucun iki sevinci vardır: Biri iftar vakti, diğeri Allah ile karşılaştığı zaman."

Sen büyük bir ibadet yapıyorsun, Allah seni korusun! 🤲`
      }
    );
  } else if (age && age >= 25) {
    examples.push(
      {
        role: 'user',
        content: 'İş hayatı ile namaz vakitlerini dengeleyemiyorum'
      },
      {
        role: 'assistant',
        content: `${name ? `${name} kardeşim` : 'Kardeşim'}, modern hayatta bu çok yaşanan bir durum. Allah kolaylık verecektir. 🤲

**Pratik çözümler:**
- İş yerinizde namaz kılabileceğiniz uygun bir köşe bulun
- Öğle arası yeteri kadar uzunsa öğle namazını kılın
- Akşam eve döndüğünüzde ikindi namazını kaza edin
- İşverenle konuşarak cuma namazı için izin alın
- Seccade ve pusula telefon uygulaması kullanın

${sect === 'Hanefi' ? 'Hanefi mezhebinde yolculuk halindeyken (45 km+) namazları kısaltabilirsiniz.' : ''}

Allah kulunu zorla mükellef tutmaz. Elinizden geldiğince gayret edin, Allah niyetinizi görür. 💪`
      }
    );
  }
  
  // Cinsiyet temelli özel örnekler
  if (gender === 'female') {
    examples.push(
      {
        role: 'user',
        content: 'Hamilelik döneminde oruç tutmalı mıyım?'
      },
      {
        role: 'assistant',
        content: `${name ? `${name} hanımefendi` : 'Hanımefendi'}, öncelikle mübarek haberinizi kutlarım! 🤱

**İslami perspektif:**
- Hamileyken sağlığınız veya bebeğiniz için endişe varsa oruç tutmayabilirsiniz
- Bu Allah'ın size verdiği bir ruhsat (kolaylık)
- Kaza etmek yeterlidir, fidye gerekmez
- Doktor tavsiyesini dikkate alın

Allah kadınlara bu özel durumları için kolaylık sağlamıştır. Önce sağlığınız, sonra ibadet gelir.

Hamileyken yapabileceğiniz diğer ibadetlere odaklanın: 
- Tesbih, zikir
- Kur'an dinleme/okuma  
- Dua etme
- Hayır işleri

Allah sizi ve bebeğinizi korusun! 🤲`
      }
    );
  }
  
  // Mezhep temelli detaylı örnekler
  if (sect === 'Hanefi' || sect === 'hanefi') {
    examples.push(
      {
        role: 'user',
        content: 'Vitir namazını bazen unuttum, ne yapmalıyım?'
      },
      {
        role: 'assistant',
        content: `${name ? `${name} kardeşim` : 'Kardeşim'}, Hanefi mezhebimizde vitir namazı vaciptir, bu önemli. 📿

**Vitir namazı için:**
- Yatsı ile fecir arası herhangi bir zamanda kılabilirsiniz
- Unuttuysanız hemen hatırladığınızda kaza edin
- 3 rekat tek selam ile kılınır (bizim mezhebimizde)
- Son rekatta Kunut duası okunur

**Unutmamak için:**
- Yatsı namazından hemen sonra kılın
- Telefonunuza hatırlatıcı kurun
- Ailenizdeki diğer kişiler de vitir kılıyorsa beraber yapın

İmam Azam (ra) buyurdu: "Vitir kılmayan bizden değildir." Bu yüzden önem verin.

Allah kabul etsin! 🤲`
      }
    );
  } else if (sect === 'Şafi' || sect === 'Şafii' || sect === 'safii') {
    examples.push(
      {
        role: 'user',
        content: 'Namazda Fatiha okumayı unuttum'
      },
      {
        role: 'assistant',
        content: `${name ? `${name} kardeşim` : 'Kardeşim'}, Şafi mezhebimizde Fatiha suresi namazın farzıdır. 📖

**Bu durumda:**
- Eğer aynı rekattaysanız ve henüz rükûya gitmediseniz, hemen Fatiha'yı okuyun
- Başka rekata geçtiyseniz, o rekat geçersizdir
- Namaz bittiğinde o rekatsız kabul edilir
- Eksik kalan rekatı tamamlayın

**Şafi mezhebinde önemli:**
- Her rekatta Fatiha farz
- İmam arkasında bile sessizce okuyun
- Bismillah da Fatiha'nın parçasıdır

İmam Şafi (ra): "Fatiha olmadan namaz olmaz" buyurmuştur.

Bundan sonra daha dikkatli olun, Allah kabul etsin! 🤲`
      }
    );
  }
  
  // ULTRA KİŞİSELLEŞTİRİLMİŞ ÖRNEKLER - MEZHEP & YAŞ ENTEGRASYONU
  const ageCategory = getAgeCategory(age);
  const sectInfo = getSectSpecificInfo(sect);
  
  if (religiousLevel === 'beginner') {
    // Yaş ve mezhep bazlı başlangıç örnekleri
    if (ageCategory === 'çocuk') {
      examples.push({
        role: 'user',
        content: 'Allah beni görüyor mu?'
      }, {
        role: 'assistant', 
        content: `Evet ${name ? `${name}` : 'minik kardeşim'}! Allah seni her zaman görüyor ve koruyor! 👁️✨ 

Allah çok güçlü ve her yerdedir. Sen uyurken bile, oyun oynarken bile O seni görüyor ve seviyor. İyi bir şey yaptığında çok sevinir, kötü bir şey yaparsan üzülür ama yine de seni çok sever! ❤️

Sen de Allah'ı göremesen bile O hep seninle! Tıpkı rüzgarı göremediğin ama hissettiğin gibi! 🌬️

Aferin, çok güzel soru soruyorsun! Allah seni çok seviyor! 🤗`
      });
    } else if (ageCategory === 'genç') {
      examples.push({
        role: 'user',
        content: 'Arkadaşlarım namaz kılmıyor, ben de kılmasam olur mu?'
      }, {
        role: 'assistant',
        content: `${name ? `${name}` : 'Kardeşim'}, çok anlayışlı bir soru! 😊

**Önce şunu bil:** Sen çok değerlisin ve doğru yoldasın! 👏

**Arkadaş Konusunda:**
• Arkadaşların kılmazsa bu senin sorumluluğunu değiştirmez
• Sen Allah için kılıyorsun, insanlar için değil
• Belki sen onlara güzel örnek olursun! ✨

**Pratik Tavsiye:**
• Okuldayken: Teneffüste hızlıca kıl
• Arkadaşlarla: "Ben biraz ibadet edeceğim" de, normal karşılarlar
• ${sectInfo ? `${sectInfo.name} mezhebinde namaz çok önemlidir` : 'İslam\'da namaz çok önemlidir'}

**Motivasyon:** Her namaz seni Allah'a yaklaştırır! Sen harikasın! 🌟

Merak etme, yavaş yavaş alışırsın. Allah seni çok seviyor! 🤲`
      });
    } else {
      examples.push({
        role: 'user',
        content: 'Namaz kılmayı unutuyorum'
      }, {
        role: 'assistant', 
        content: `${name ? `${name} kardeşim` : 'Kardeşim'}, hiç merak etme! Bu çok normal 😊

**Basit Çözümler:**
• Telefona namaz saati uygulaması kur 📱
• Her namazdan sonra bir sonrakinin saatini hatırla
• İlk başta 2-3 vakit kıl, sonra artır

${sectInfo ? `**${sectInfo.name} Mezhebinde:** ${sectInfo.specificRulings.prayer.hands}` : ''}

**Unutma:** Allah anlayışlıdır, sen çabalıyorsan O razı olur! 
Yavaş yavaş alışacaksın. Sen çok iyisin! 🌟`
      });
    }
  } else if (religiousLevel === 'intermediate') {
    // Orta seviye mezhep-yaş örnekleri
    examples.push({
      role: 'user',
      content: sectInfo ? `${sectInfo.name} mezhebinde vitir namazı nasıl?` : 'Vitir namazı nasıl kılınır?'
    }, {
      role: 'assistant',
      content: `${name ? `${name} kardeşim` : 'Kardeşim'}, vitir namazı konusunda size ${sectInfo ? sectInfo.name : ''} mezhebi açısından bilgi vereyim:

${sectInfo && sectInfo.specificRulings.prayer.witr ? `
**🕌 ${sectInfo.name} Mezhebinde:**
${sectInfo.specificRulings.prayer.witr}
` : ''}

${sectInfo && sectInfo.specificRulings.prayer.qunoot ? `
**📿 Kunut Durumu:**
${sectInfo.specificRulings.prayer.qunoot}
` : ''}

**📖 Delili:** Peygamber Efendimiz (sav) buyurdu: "Vitir haktır, her Müslüman'a vaciptir." (Ebu Davud)

${ageCategory === 'genç' ? '**Gençler için:** Yatsı sonrası kıl, geç saatte uyursan vitri yatmadan önce eda et.' : ageCategory === 'orta_yaş' ? '**Aile babası için:** Çocuklarınıza da vitir alışkanlığı kazandırın.' : ''}

Bu konu hakkında başka sorunuz var mı? 🤲`
    });
  } else if (religiousLevel === 'advanced') {
    examples.push({
      role: 'user',
      content: 'Mezhepler arasında abdest konusundaki farklılıklar neler?'
    }, {
      role: 'assistant',
      content: `${name ? `${name} kardeşim` : 'Kardeşim'}, abdest konusunda mezhepler arası fıkhi farklılıklar şöyledir:

**💧 ABDEST ORGANLARI:**

${sectInfo ? `**🕌 ${sectInfo.name} Mezhebi (Sizin Mezhebin):**
${sectInfo.specificRulings.wudu}
${sectInfo.specificRulings.prayer.touch ? `**Temasta Abdest:** ${sectInfo.specificRulings.prayer.touch}` : ''}
` : ''}

**📚 Mezhebi Karşılaştırma:**
• **Hanefi:** Ayaklar meshedilir, karşı cinse dokunma abdesti bozmaz
• **Şafi:** Ayaklar yıkanır, karşı cinse dokunma abdesti bozar  
• **Maliki:** Ayaklar yıkanır, şehvetle dokunmadıkça abdest bozulmaz
• **Hanbeli:** Ayaklar yıkanır, karşı cinse dokunma abdesti bozar

**🔍 Metodolojik Fark:**
- Hanefiler: "Arş ayetindeki mesih kelimesi mesh demektir"
- Diğerleri: "Maide 6'daki ayak yıkama emri asıldır"

**📖 Kaynak:** İbn Rüşd, Bidayetül-Müctehid, Kitabüt-Taharet

${ageCategory === 'orta_yaş' ? 'Aile içinde bu farklılıkları anlayışla karşılayın.' : ''}

Bu akademik farklılık İslam'ın zenginliğidir. 🤲`
    });
  }
  
  return examples;
};

/**
 * Sık sorulan sorular için hızlı cevaplar - UNLIMITED MEMORY İLE GELİŞTİRİLMİŞ
 */
const getQuickResponseIfAvailable = (question: string, profile: UserProfile | null): string | null => {
  const questionLower = question.toLowerCase().trim();
  const name = profile?.name ? ` ${profile.name} kardeşim` : ' kardeşim';
  const userId = profile?.user_id || profile?.email || 'anonymous';
  
  // Hafıza geçmişini al
  const memoryContainer = conversationMemory.get(userId);
  const hasMemory = memoryContainer && memoryContainer.totalMessages > 0;
  
  // Namaz vakitleri sorusu
  if (questionLower.includes('namaz vakti') || questionLower.includes('ezan saat')) {
    let response = `Merhaba${name}! 🕌

Namaz vakitleri şehrinize ve mevsime göre değişir. En doğru bilgi için:

📱 **Önerilen uygulamalar:**
• Diyanet İşleri Başkanlığı uygulaması
• Ezan Vakti uygulaması
• Google'da "namaz vakitleri [şehriniz]"

⏰ **Genel saatler (örnek):**
• Sabah: Güneş doğmadan ~1.5 saat önce
• Öğle: Güneş tepeye geldiğinde
• İkindi: Gölge 2 katı olduğunda  
• Akşam: Güneş battığında
• Yatsı: Akşamdan ~1.5 saat sonra

Şehrinizi belirtirseniz daha kesin bilgi verebilirim! 🤲`;

    // Hafıza varsa kişiselleştirilmiş ekleme
    if (hasMemory && memoryContainer!.topicEvolution['namaz']) {
      response += `\n\n💭 *Bu konuyu daha önce ${memoryContainer!.topicEvolution['namaz']} kez konuştuk. Unlimited hafıza sistemim sayesinde namaz konusundaki tüm geçmiş sorularınızı hatırlıyorum!*`;
    }

    return response;
  }
  
  // Basit selamlaşma
  if (questionLower === 'selam' || questionLower === 'merhaba' || questionLower === 'esselamun aleyküm') {
    let response = `Ve aleykümü's-selam ve rahmetullahi ve berekatüh${name}! 🤲

Hoş geldiniz! Size nasıl yardımcı olabilirim? 

İslami konulardaki tüm sorularınızı sorabilirsiniz. 🕌`;

    // Hafıza varsa tekrar karşılama mesajı
    if (hasMemory) {
      const totalInteractions = memoryContainer!.totalMessages;
      const favoriteTopic = Object.entries(memoryContainer!.topicEvolution)
        .sort(([,a], [,b]) => b - a)[0];
      
      response = `Ve aleykümü's-selam ve rahmetullahi ve berekatüh${name}! 🤲

Sizi tekrar görmek çok güzel! Unlimited hafıza sistemim sayesinde ${totalInteractions} mesajlık tüm geçmişimizi hatırlıyorum. 
${favoriteTopic ? `En çok ${favoriteTopic[0]} konusunu konuştuk (${favoriteTopic[1]} kez).` : ''}

Size nasıl yardımcı olabilirim? 🕌`;
    }

    return response;
  }
  
  return null; // Quick response yoksa normal işlem
};



/**
 * Kullanıcı profiline göre pre-prompt stratejisi
 */
const createContextualPrePrompt = (userMessage: string, profile: UserProfile | null): string => {
  const age = profile?.age;
  const sect = profile?.sect;
  const gender = profile?.gender;
  
  let prePrompt = `Kullanıcının sorusu: "${userMessage}"\n\n`;
  
  // Soru analizi ve yaklaşım stratejisi
  if (userMessage.toLowerCase().includes('namaz')) {
    prePrompt += `Bu namaz ile ilgili bir soru. ${sect ? sect + ' mezhebine göre' : 'Genel olarak'} detaylı ama anlaşılır şekilde açıkla.\n`;
  } else if (userMessage.toLowerCase().includes('oruç')) {
    prePrompt += `Bu oruç ile ilgili bir soru. Pratik tavsiyeler ver ve kişinin durumuna uygun yaklaş.\n`;
  } else if (userMessage.toLowerCase().includes('helal') || userMessage.toLowerCase().includes('haram')) {
    prePrompt += `Bu fıkhi bir soru. Net ama anlayışlı bir yaklaşım benimse.\n`;
  }
  
  if (age && age < 18) {
    prePrompt += `Kullanıcı genç, basit ve cesaretlendirici bir dil kullan.\n`;
  } else if (age && age > 50) {
    prePrompt += `Kullanıcı tecrübeli, daha derin ve hikmetli yaklaş.\n`;
  }
  
  return prePrompt;
};

/**
 * OpenAI API'sine geliştirilmiş hafıza sistemi ve Chain of Thought ile istek gönderen fonksiyon
 */
export const getAIResponse = async (
  userMessage: string,
  userProfile: UserProfile | null
): Promise<string> => {
  try {
    const userId = userProfile?.user_id || userProfile?.email || 'anonymous';
    
    // 1. KULLANICI MESAJINI HAFIZAYA KAYDET
    saveToUnlimitedMemory(userId, 'user', userMessage, isProfileInfoQuestion(userMessage));
    
    // 2. ÖNCE DİNİ SEVİYE KONTROLÜ - ÇOK ÖNEMLİ!
    if (!userProfile?.religious_level) {
      const name = userProfile?.name ? ` ${userProfile.name} kardeşim` : ' kardeşim';
      const response = `Merhaba${name}! 🤲

Size en uygun şekilde cevap verebilmem için lütfen **ekranın sağ üst köşesindeki** dini seviye butonuna tıklayarak dini bilgi seviyenizi seçin.

Bu sayede:
• Başlangıç seviyesindeyseniz: Basit ve anlaşılır açıklamalar
• Orta seviyedeyseniz: Ayet-hadis referanslı detaylı bilgiler  
• İleri seviyedeyseniz: Fıkhi incelikler ve karşılaştırmalı analizler

Seviyenizi seçtikten sonra sorularınızı tekrar sorabilirsiniz. 📚`;
      
      // Bu yanıtı da hafızaya kaydet
      saveToUnlimitedMemory(userId, 'assistant', response);
      return response;
    }
    
    // 3. ÖNCEKI SOHBET GEÇMİŞİNİ AL
    const conversationHistory = getUnlimitedConversationMemory(userId);
    
    // 4. HIZLI CEVAP KONTROLÜ (geçmiş bilgilerle zenginleştirilmiş)
    const quickResponse = getQuickResponseIfAvailable(userMessage, userProfile);
    if (quickResponse) {
      // Hafızadan ilgili bilgileri ekle
      const enhancedQuickResponse = enhanceQuickResponseWithHistory(quickResponse, conversationHistory, userMessage);
      saveToUnlimitedMemory(userId, 'assistant', enhancedQuickResponse);
      return enhancedQuickResponse;
    }
    
    // 5. SPESİFİK SORU KONTROLLERI
    if (isSpecificSectQuestion(userMessage)) {
      const response = generateSectSpecificResponse(userProfile);
      saveToUnlimitedMemory(userId, 'assistant', response, true);
      return response;
    }
    
    if (isSpecificAgeQuestion(userMessage)) {
      const response = generateAgeSpecificResponse(userProfile);
      saveToUnlimitedMemory(userId, 'assistant', response, true);
      return response;
    }
    
    if (isProfileInfoQuestion(userMessage)) {
      const response = generateProfileResponse(userProfile);
      saveToUnlimitedMemory(userId, 'assistant', response, true);
      return response;
    }
    
    // 6. DİNİ SORU KONTROLÜ
    if (!isReligiousQuestion(userMessage)) {
      const name = userProfile?.name ? ` ${userProfile.name} kardeşim` : ' kardeşim';
      const response = `Üzgünüm${name}, ben sadece İslami ve dini konularda yardımcı olabilirim. 🕌

Bu tür sorularınızda size yardımcı olabilirim:
• Namaz, oruç, hac gibi ibadetler hakkında
• Helal-haram konuları
• Aile, evlilik, ahlak meseleleri
• Kur'an ve hadis açıklamaları
• Dini günler ve kandiller
• İslami yaşam tarzı tavsiyeleri

Başka bir dini sorunuz var mı? 🤲`;
      
      saveToUnlimitedMemory(userId, 'assistant', response);
      return response;
    }
    
    // 7. API ANAHTARI KONTROLÜ
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your-openai-api-key-here') {
      console.error('OpenAI API anahtarı tanımlanmamış. Lütfen config/env.ts dosyasını güncelleyin.');
      const response = 'Üzgünüm, sistem şu anda yapılandırılmamış. Lütfen yöneticinize başvurun.';
      saveToUnlimitedMemory(userId, 'assistant', response);
      return response;
    }
    
    // 8. GELİŞTİRİLMİŞ MESAJ GEÇMİŞİ OLUŞTUR (Chain of Thought ile)
    const messages = createContextualMessageHistory(userMessage, userProfile, conversationHistory);
    
    // 9. ADAPTIF SOHBET PARAMETRELERI
    const chatParams = adaptChatParameters(userProfile, conversationHistory, userMessage);
    
    console.log(`🧠 Chain of Thought: ${userId} için ${messages.length} mesajlık bağlam oluşturuldu`);
    console.log(`📊 Parametreler: temp=${chatParams.temperature}, tokens=${chatParams.maxTokens}`);
    
    // 10. OPENAI API ÇAĞRISI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        temperature: chatParams.temperature,
        max_tokens: chatParams.maxTokens,
        top_p: 0.9,
        presence_penalty: chatParams.presencePenalty,
        frequency_penalty: chatParams.frequencyPenalty,
        stop: null,
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API hatası:', errorData);
      throw new Error(`OpenAI API hatası: ${response.status}`);
    }
    
    const data = await response.json();
    let aiResponse = data.choices[0].message.content;
    
    // 11. POST-PROCESSING (Bağlamsal iyileştirmeler)
    aiResponse = enhanceResponseWithContext(aiResponse, userProfile, conversationHistory, userMessage);
    
    // 12. AI YANITINI HAFIZAYA KAYDET
    saveToUnlimitedMemory(userId, 'assistant', aiResponse);
    
    // 13. ÖĞRENME PROFİLİ GÜNCELLEMESİ
    updateConversationInsights(userId, userMessage, aiResponse, userProfile);
    
    return aiResponse;
  } catch (error) {
    console.error('AI yanıt hatası:', error);
    
    // Hata durumunda da hafızaya kaydet
    const userId = userProfile?.user_id || userProfile?.email || 'anonymous';
    const name = userProfile?.name ? ` ${userProfile.name} kardeşim` : ' kardeşim';
    const errorResponse = `Üzgünüm${name}, şu anda teknik bir sorun yaşıyorum. Lütfen birkaç dakika sonra tekrar deneyin. Dualarınızda unutmayın! 🤲`;
    
    saveToUnlimitedMemory(userId, 'assistant', errorResponse);
    return errorResponse;
  }
};

/**
 * Hızlı cevapları geçmiş bilgilerle zenginleştirme
 */
const enhanceQuickResponseWithHistory = (
  quickResponse: string,
  conversationHistory: MessageHistory[],
  currentQuestion: string
): string => {
  // Eğer bu konu hakkında daha önce konuşmuşsak, referans ekle
  const relatedPreviousQuestions = conversationHistory
    .filter(msg => msg.role === 'user')
    .filter(msg => {
      const currentTopics = extractTopicsFromQuestion(currentQuestion);
      const msgTopics = extractTopicsFromQuestion(msg.content);
      return currentTopics.some(topic => msgTopics.includes(topic));
    })
    .slice(-2); // Son 2 benzer soru
  
  if (relatedPreviousQuestions.length > 0) {
    quickResponse += `\n\n💭 *Bu konuyu daha önce de konuşmuştuk. Önceki sorularınızla birlikte düşündüğümde, size daha kapsamlı bilgi verebilirim.*`;
  }
  
  return quickResponse;
};

/**
 * Sohbet parametrelerini bağlama göre adapte eder
 */
const adaptChatParameters = (
  profile: UserProfile | null,
  conversationHistory: MessageHistory[],
  currentQuestion: string
): {
  temperature: number;
  maxTokens: number;
  presencePenalty: number;
  frequencyPenalty: number;
} => {
  let temperature = 0.7;
  let maxTokens = 2000;
  let presencePenalty = 0.1;
  let frequencyPenalty = 0.1;
  
  // Dini seviyeye göre temel ayarlar
  if (profile?.religious_level === 'beginner') {
    temperature = 0.3;
    maxTokens = 400;
  } else if (profile?.religious_level === 'intermediate') {
    temperature = 0.6;
    maxTokens = 800;
  } else if (profile?.religious_level === 'advanced') {
    temperature = 0.8;
    maxTokens = 1500;
  }
  
  // Sohbet geçmişine göre ayarlamalar
  const conversationLength = conversationHistory.length;
  if (conversationLength > 10) {
    // Uzun sohbetlerde tekrarı azalt
    frequencyPenalty = 0.3;
    presencePenalty = 0.2;
  }
  
  // Soru türüne göre ayarlamalar
  if (isVeryAdvancedQuestion(currentQuestion)) {
    temperature += 0.1; // Daha yaratıcı
    maxTokens += 200;   // Daha uzun
  } else if (currentQuestion.toLowerCase().includes('basit') || currentQuestion.toLowerCase().includes('kısa')) {
    maxTokens = Math.min(maxTokens, 300); // Kısa tut
  }
  
  return { temperature, maxTokens, presencePenalty, frequencyPenalty };
};

/**
 * Yanıtı bağlamsal bilgilerle zenginleştirme
 */
const enhanceResponseWithContext = (
  aiResponse: string,
  profile: UserProfile | null,
  conversationHistory: MessageHistory[],
  currentQuestion: string
): string => {
  let enhancedResponse = aiResponse;
  
  // İsim ekleme (daha akıllı)
  if (profile?.name && !enhancedResponse.includes(profile.name)) {
    const shouldAddName = conversationHistory.length > 4 && Math.random() > 0.6;
    if (shouldAddName) {
      enhancedResponse = enhancedResponse.replace(
        /(Kardeşim|kardeşim)/g, 
        `${profile.name} kardeşim`
      );
    }
  }
  
  // Seviye progression önerisi (geliştirilmiş)
  if (profile?.religious_level === 'beginner' && isAdvancedQuestion(currentQuestion)) {
    const advancedQuestionCount = conversationHistory
      .filter(msg => msg.role === 'user' && isAdvancedQuestion(msg.content))
      .length;
    
    if (advancedQuestionCount >= 3) {
      enhancedResponse += `\n\n🎯 *${advancedQuestionCount}. ileri seviye sorunuzu soruyorsunuz! Dini seviyenizi "Orta" olarak güncelleyerek daha detaylı ayet-hadis referanslı cevaplar alabilirsiniz.*`;
    } else {
      enhancedResponse += `\n\n💡 *Bu tür sorular ilginizi çekiyorsa, dini seviyenizi "Orta" olarak güncelleyebilirsiniz.*`;
    }
  }
  
  // Devam eden konu takibi
  const currentTopics = extractTopicsFromQuestion(currentQuestion);
  const recentSimilarQuestions = conversationHistory
    .filter(msg => msg.role === 'user')
    .slice(-5)
    .filter(msg => {
      const msgTopics = extractTopicsFromQuestion(msg.content);
      return currentTopics.some(topic => msgTopics.includes(topic));
    });
  
  if (recentSimilarQuestions.length >= 2) {
    const topicName = currentTopics[0];
    enhancedResponse += `\n\n🔄 *${topicName} konusunu derinlemesine konuşuyoruz! Bu alanda başka merak ettikleriniz varsa sorabilirsiniz.*`;
  }
  
  return enhancedResponse;
};

/**
 * Sohbet içgörülerini günceller (learning insights)
 */
const updateConversationInsights = (
  userId: string,
  question: string,
  response: string,
  profile: UserProfile | null
): void => {
  // Bu kullanıcının öğrenme kalıplarını analiz et
  const learningProfile = userLearningProfiles.get(userId);
  if (learningProfile) {
    // Soru karmaşıklığı analizi
    const questionComplexity = isVeryAdvancedQuestion(question) ? 'very_advanced' :
                               isAdvancedQuestion(question) ? 'advanced' : 'basic';
    
    // Yanıt uzunluğu analizi
    const responseLength = response.length;
    
    // İstatistikleri güncelle (gelecekte kullanım için)
    console.log(`📈 Öğrenme İçgörüsü - ${userId}: ${questionComplexity} seviye soru, ${responseLength} karakter yanıt`);
  }
}; 