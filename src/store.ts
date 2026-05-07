import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 自定义存储，优先使用 localStorage，失败则用内存
const customStorage = createJSONStorage(() => {
  try {
    // 测试 localStorage 是否可用
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return localStorage;
  } catch {
    // 如果 localStorage 不可用，使用内存存储
    const memoryStorage: Record<string, string> = {};
    return {
      getItem: (name: string) => memoryStorage[name] || null,
      setItem: (name: string, value: string) => { memoryStorage[name] = value; },
      removeItem: (name: string) => { delete memoryStorage[name]; },
    };
  }
});

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface ChatModel {
  id: string;
  name: string;
  provider: 'openai' | 'gemini';
  maxTokens: number;
}

export const CHAT_MODELS: ChatModel[] = [
  { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'openai', maxTokens: 131072 },
  { id: 'grok-4.2', name: 'Grok 4.2', provider: 'openai', maxTokens: 131072 },
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai', maxTokens: 131072 },
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'openai', maxTokens: 131072 },
];

export interface ImageModel {
  id: string;
  name: string;
  provider: 'openai' | 'gemini';
  supportsReference?: boolean;  // 是否支持参考图
}

export const IMAGE_MODELS: ImageModel[] = [
  { id: 'gemini-3.1-flash-image-preview', name: 'Gemini Flash 3.1', provider: 'gemini', supportsReference: true },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini Pro 3', provider: 'gemini', supportsReference: true },
  { id: 'gpt-image-1.5', name: 'GPT Image 1.5', provider: 'openai', supportsReference: true },
  { id: 'gpt-image-2', name: 'GPT Image 2', provider: 'openai', supportsReference: true },
];

export const IMAGE_RATIOS = [
  { id: '1:1', label: '1:1', width: 1024, height: 1024 },
  { id: '3:4', label: '3:4', width: 768, height: 1024 },
  { id: '4:3', label: '4:3', width: 1024, height: 768 },
  { id: '9:16', label: '9:16', width: 576, height: 1024 },
  { id: '16:9', label: '16:9', width: 1024, height: 576 },
] as const;

interface AppState {
  // API
  apiKey: string;
  setApiKey: (key: string) => void;

  // Chat
  conversations: Conversation[];
  currentConversationId: string | null;
  chatModelId: string;
  setChatModelId: (id: string) => void;

  // Image
  imageModelId: string;
  setImageModelId: (id: string) => void;
  imageRatio: string;
  setImageRatio: (ratio: string) => void;
  generatedImages: string[];

  // UI
  activeTab: 'chat' | 'image' | 'settings';
  setActiveTab: (tab: 'chat' | 'image' | 'settings') => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Actions
  createConversation: () => string;
  getCurrentConversation: () => Conversation | null;
  addMessage: (content: string, role: 'user' | 'assistant', imageUrl?: string) => void;
  clearConversation: () => void;
  deleteConversation: (id: string) => void;
  addGeneratedImage: (url: string) => void;
  clearImages: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // API
      apiKey: '',
      setApiKey: (key) => set({ apiKey: key }),

      // Chat
      conversations: [],
      currentConversationId: null,
      chatModelId: CHAT_MODELS[0].id,
      setChatModelId: (id) => set({ chatModelId: id }),

      // Image
      imageModelId: IMAGE_MODELS[0].id,
      setImageModelId: (id) => set({ imageModelId: id }),
      imageRatio: '1:1',
      setImageRatio: (ratio) => set({ imageRatio: ratio }),
      generatedImages: [],

      // UI
      activeTab: 'chat',
      setActiveTab: (tab) => set({ activeTab: tab }),
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      // Actions
      createConversation: () => {
        const id = Date.now().toString();
        const conv: Conversation = {
          id,
          title: '新对话',
          messages: [],
          createdAt: Date.now(),
        };
        set((state) => ({
          conversations: [conv, ...state.conversations],
          currentConversationId: id,
        }));
        return id;
      },

      getCurrentConversation: () => {
        const { conversations, currentConversationId } = get();
        return conversations.find((c) => c.id === currentConversationId) || null;
      },

      addMessage: (content, role, imageUrl) => {
        const { currentConversationId, conversations } = get();
        if (!currentConversationId) return;

        const message: Message = {
          id: Date.now().toString(),
          role,
          content,
          imageUrl,
          timestamp: Date.now(),
        };

        set({
          conversations: conversations.map((c) => {
            if (c.id !== currentConversationId) return c;
            const updatedMessages = [...c.messages, message];
            const title = c.messages.length === 0 && role === 'user'
              ? content.slice(0, 30) + (content.length > 30 ? '...' : '')
              : c.title;
            return { ...c, messages: updatedMessages, title };
          }),
        });
      },

      clearConversation: () => {
        const { currentConversationId } = get();
        if (!currentConversationId) return;
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === currentConversationId ? { ...c, messages: [], title: '新对话' } : c
          ),
        }));
      },

      deleteConversation: (id) => {
        set((state) => {
          const newConvs = state.conversations.filter((c) => c.id !== id);
          const newCurrentId = state.currentConversationId === id
            ? newConvs[0]?.id || null
            : state.currentConversationId;
          return { conversations: newConvs, currentConversationId: newCurrentId };
        });
      },

      addGeneratedImage: (url) => {
        set((state) => ({ generatedImages: [url, ...state.generatedImages].slice(0, 20) }));
      },

      clearImages: () => set({ generatedImages: [] }),
    }),
    {
      name: 'ai-assistant-storage',
      storage: customStorage,
      partialize: (state) => ({
        apiKey: state.apiKey,
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
        chatModelId: state.chatModelId,
        imageModelId: state.imageModelId,
        imageRatio: state.imageRatio,
        generatedImages: state.generatedImages,
      }),
    }
  )
);