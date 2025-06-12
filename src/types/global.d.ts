// Mevcut global tipler
declare global {
  var profileUpdateListeners: (() => void)[];
  
  // Hafıza sistemi için global tipler
  interface ConversationMemoryData {
    userId: string;
    messages: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      timestamp: Date;
      isProfileRelated: boolean;
      conversationTurn: number;
    }[];
  }
  
  interface LearningProfileData {
    userId: string;
    preferredTopics: string[];
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
    conversationStyle: 'formal' | 'casual' | 'academic';
    previousQuestions: string[];
    understandingLevel: Record<string, number>;
    lastInteractionDate: Date;
    totalInteractions: number;
  }
}

export {}; 