import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// 自定义存储，优先使用 localStorage，失败则用内存
const customStorage = createJSONStorage(() => {
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return localStorage;
  } catch {
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

export interface ImageRecord {
  id: string;
  prompt: string;
  imageUrl: string;
  modelId: string;
  ratio: string;
  referenceImage?: string;
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
  tag: string;
  provider: 'openai' | 'gemini';
  qualities: string[];
  defaultQuality: string;
  ratios: string[];
  defaultRatio: string;
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Flash 3.1',
    tag: 'Flash',
    provider: 'gemini',
    qualities: ['0.5K', '1K', '2K', '4K'],
    defaultQuality: '1K',
    ratios: ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '1:4', '1:8', '4:1', '8:1'],
    defaultRatio: '1:1',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Pro 3',
    tag: 'Pro',
    provider: 'gemini',
    qualities: ['1K', '2K', '4K'],
    defaultQuality: '1K',
    ratios: ['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9'],
    defaultRatio: '1:1',
  },
  {
    id: 'gpt-image-1.5',
    name: 'GPT Image 1.5',
    tag: 'OpenAI',
    provider: 'openai',
    qualities: ['0.5K', '1K', '2K'],
    defaultQuality: '1K',
    ratios: ['auto', '1:1', '3:2', '2:3'],
    defaultRatio: '1:1',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    tag: 'GPT2',
    provider: 'openai',
    qualities: ['auto', 'low', 'medium', 'high'],
    defaultQuality: 'auto',
    ratios: ['auto', '1:1', '3:2', '2:3', '2K-1:1', '2K-16:9', '4K-16:9', '4K-9:16'],
    defaultRatio: 'auto',
  },
];

// GPT2 比例中文标签
export const GPT2_RATIO_LABELS: Record<string, string> = {
  'auto': '自动',
  '1:1': '1K正方',
  '3:2': '1K横版',
  '2:3': '1K竖版',
  '2K-1:1': '2K正方',
  '2K-16:9': '2K横版',
  '4K-16:9': '4K横版',
  '4K-9:16': '4K竖版',
};

export const GPT2_QUALITY_LABELS: Record<string, string> = {
  'auto': '自动',
  'low': '快速',
  'medium': '标准',
  'high': '精细',
};

// OpenAI size map
export const OPENAI_SIZE_MAP: Record<string, string> = {
  '1:1': '1024x1024',
  '3:2': '1536x1024',
  '2:3': '1024x1536',
  'auto': '1024x1024',
};

// GPT2 size map
export const GPT2_SIZE_MAP: Record<string, string> = {
  'auto': 'auto',
  '1:1': '1024x1024',
  '3:2': '1536x1024',
  '2:3': '1024x1536',
  '2K-1:1': '2048x2048',
  '2K-16:9': '2048x1152',
  '4K-16:9': '3840x2160',
  '4K-9:16': '2160x3840',
};

// GPT2 edit (有参考图时) 只支持 3 种尺寸
export const GPT2_EDIT_RATIOS: string[] = ['1:1', '3:2', '2:3'];

export const OPENAI_QUALITY_MAP: Record<string, string> = {
  '0.5K': 'low',
  '1K': 'medium',
  '2K': 'high',
};

export function getImageModelDef(modelId: string): ImageModel {
  return IMAGE_MODELS.find((m) => m.id === modelId) || IMAGE_MODELS[0];
}

export function constrainImageSettings(
  newModelId: string,
  currentQuality: string,
  currentRatio: string,
): { quality: string; ratio: string } {
  const def = getImageModelDef(newModelId);
  const quality = def.qualities.includes(currentQuality) ? currentQuality : def.defaultQuality;
  const ratio = def.ratios.includes(currentRatio) ? currentRatio : def.defaultRatio;
  return { quality, ratio };
}

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
  imageQuality: string;
  setImageQuality: (quality: string) => void;
  imageRecords: ImageRecord[];  // 生图历史记录

  // UI
  activeTab: 'chat' | 'image' | 'settings';
  setActiveTab: (tab: 'chat' | 'image' | 'settings') => void;
  isChatLoading: boolean;
  setIsChatLoading: (loading: boolean) => void;
  isImageLoading: boolean;
  setIsImageLoading: (loading: boolean) => void;

  // Actions
  createConversation: () => string;
  getCurrentConversation: () => Conversation | null;
  addMessage: (content: string, role: 'user' | 'assistant', imageUrl?: string) => void;
  clearConversation: () => void;
  deleteConversation: (id: string) => void;
  addImageRecord: (record: Omit<ImageRecord, 'id' | 'createdAt'>) => void;
  deleteImageRecord: (id: string) => void;
  clearImageRecords: () => void;
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
      setImageModelId: (id) => {
        const def = getImageModelDef(id);
        const { quality, ratio } = constrainImageSettings(id, get().imageQuality, get().imageRatio);
        set({ imageModelId: id, imageQuality: quality, imageRatio: ratio });
      },
      imageRatio: IMAGE_MODELS[0].defaultRatio,
      setImageRatio: (ratio) => set({ imageRatio: ratio }),
      imageQuality: IMAGE_MODELS[0].defaultQuality,
      setImageQuality: (quality) => set({ imageQuality: quality }),
      imageRecords: [],

      // UI
      activeTab: 'chat',
      setActiveTab: (tab) => set({ activeTab: tab }),
      isChatLoading: false,
      setIsChatLoading: (loading) => set({ isChatLoading: loading }),
      isImageLoading: false,
      setIsImageLoading: (loading) => set({ isImageLoading: loading }),

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

      addImageRecord: (record) => {
        const newRecord: ImageRecord = {
          ...record,
          id: Date.now().toString(),
          createdAt: Date.now(),
        };
        set((state) => ({ imageRecords: [newRecord, ...state.imageRecords].slice(0, 50) }));
      },

      deleteImageRecord: (id) => {
        set((state) => ({ imageRecords: state.imageRecords.filter((r) => r.id !== id) }));
      },

      clearImageRecords: () => set({ imageRecords: [] }),
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
        imageQuality: state.imageQuality,
        imageRecords: state.imageRecords,
      }),
    }
  )
);