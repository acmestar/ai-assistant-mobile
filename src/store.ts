import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Language } from './i18n';
import { AICompany } from './virtual-company/types';

// ============ 创作类型定义 ============
export type CreationMode =
  | 'novel'
  | 'xiaohongshu'
  | 'short_video'
  | 'moments'
  | 'product_copy'
  | 'marketing_matrix'
  | 'course_outline'
  | 'short_drama'
  | 'free';

// 小说子模式类型
export type NovelTaskType =
  | 'premise'      // 故事设定
  | 'outline'      // 小说大纲
  | 'chapter_outline'  // 章节大纲
  | 'chapter_draft'    // 章节正文
  | 'continue'     // 续写
  | 'polish';      // 润色

// 小说子模式显示名称
export const NOVEL_TASK_TYPE_NAMES: Record<NovelTaskType, { zh: string; en: string; descZh: string; descEn: string }> = {
  premise: { zh: '故事设定', en: 'Premise', descZh: '用于生成小说核心设定、主线矛盾、人物雏形', descEn: 'Generate core premise, main conflict, character prototypes' },
  outline: { zh: '小说大纲', en: 'Outline', descZh: '用于生成总纲、分卷大纲、主线/副线', descEn: 'Generate overall outline, volume breakdown, main/sub plots' },
  chapter_outline: { zh: '章节大纲', en: 'Chapter Outline', descZh: '用于生成单章目标、场景、冲突、结尾钩子', descEn: 'Generate chapter goals, scenes, conflicts, ending hooks' },
  chapter_draft: { zh: '章节正文', en: 'Chapter Draft', descZh: '用于根据章节大纲生成正文', descEn: 'Generate chapter content from outline' },
  continue: { zh: '续写', en: 'Continue', descZh: '用于根据已有正文继续往下写', descEn: 'Continue writing from existing content' },
  polish: { zh: '润色', en: 'Polish', descZh: '用于优化已有正文的语言、节奏、画面感', descEn: 'Polish language, pacing, imagery' },
};

// 小说改写类型
export type NovelRewriteType =
  | 'enhance_imagery'      // 增强画面感
  | 'enhance_emotion'      // 增强情绪张力
  | 'optimize_dialogue'    // 优化对白
  | 'add_conflict'         // 增加冲突
  | 'slow_pacing'          // 放慢节奏
  | 'fast_pacing'          // 加快节奏
  | 'strengthen_suspense'  // 强化悬念
  | 'strengthen_hook'      // 强化结尾钩子
  | 'fix_character'        // 修复人物崩坏
  | 'reduce_ai_taste';     // 减少AI味

// 小说改写显示名称
export const NOVEL_REWRITE_NAMES: Record<NovelRewriteType, { zh: string; en: string }> = {
  enhance_imagery: { zh: '增强画面感', en: 'Enhance Imagery' },
  enhance_emotion: { zh: '增强情绪张力', en: 'Enhance Emotion' },
  optimize_dialogue: { zh: '优化对白', en: 'Optimize Dialogue' },
  add_conflict: { zh: '增加冲突', en: 'Add Conflict' },
  slow_pacing: { zh: '放慢节奏', en: 'Slow Pacing' },
  fast_pacing: { zh: '加快节奏', en: 'Fast Pacing' },
  strengthen_suspense: { zh: '强化悬念', en: 'Strengthen Suspense' },
  strengthen_hook: { zh: '强化结尾钩子', en: 'Strengthen Hook' },
  fix_character: { zh: '修复人物崩坏', en: 'Fix Character' },
  reduce_ai_taste: { zh: '减少AI味', en: 'Reduce AI Taste' },
};

// ============ 小说企划数据结构 ============

export interface NovelCharacter {
  id: string;
  name: string;
  role: string;        // 主角/配角/反派
  identity: string;    // 身份/职业
  personality: string; // 性格
  desire: string;     // 欲望
  weakness: string;   // 弱点
  relationship: string; // 与主角关系
  arc: string;        // 人物成长弧光
  locked?: boolean;    // 是否锁定
}

export interface NovelChapterPlan {
  id: string;
  chapterNo: number;
  title: string;
  goal: string;       // 本章目标
  mainEvent: string;  // 主要事件
  conflict: string;   // 冲突点
  hook: string;       // 结尾钩子
  locked?: boolean;
}

export interface NovelProject {
  title: string;
  genre: string;
  style: string;
  logline: string;          // 一句话简介
  sellingPoints: string;    // 核心卖点
  targetReaders?: string;   // 目标读者
  lengthSuggestion?: string; // 篇幅建议

  characters: NovelCharacter[];

  world: {
    background: string;     // 故事背景
    keyScenes: string;      // 关键场景
    rules: string;          // 世界规则
    forbiddenRules: string; // 不可违背规则
  };

  conflict: {
    external: string;       // 外部冲突
    internal: string;       // 内心冲突
    relationship: string;   // 关系冲突
    stages: string;         // 阶段性阻碍
  };

  outline: {
    beginning: string;      // 开端
    development: string;    // 发展
    twist: string;          // 转折
    climax: string;         // 高潮
    ending: string;         // 结局
  };

  chapters: NovelChapterPlan[];

  firstChapterAdvice: {
    openingScene: string;   // 开场场景
    characters: string;     // 出场人物
    mood: string;           // 情绪基调
    conflictIntro: string;  // 冲突引入
    endingHook: string;     // 结尾钩子
  };

  notes?: string;
}

// 章节正文草稿
export interface NovelChapterDraft {
  chapterNo: number;
  title: string;
  content: string;           // 正文内容
  summary: string;           // 本章摘要
  characterChanges: string;  // 人物状态变化
  clues: string;             // 伏笔/线索
  nextChapterHint: string;   // 下一章建议
}

// 一键生成结果
export interface NovelAutoStartResult {
  project: NovelProject;
  firstChapter: NovelChapterDraft;
}

// 章节队列项
export interface NovelChapterQueueItem {
  id: string;
  chapterNo: number;
  title: string;
  outline: string;           // 章节大纲
  userIdea?: string;         // 用户想法
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: NovelChapterDraft;
  error?: string;
}

// 创建空的小说企划
export function createEmptyNovelProject(): NovelProject {
  return {
    title: '',
    genre: '',
    style: '',
    logline: '',
    sellingPoints: '',
    targetReaders: '',
    lengthSuggestion: '',
    characters: [],
    world: {
      background: '',
      keyScenes: '',
      rules: '',
      forbiddenRules: '',
    },
    conflict: {
      external: '',
      internal: '',
      relationship: '',
      stages: '',
    },
    outline: {
      beginning: '',
      development: '',
      twist: '',
      climax: '',
      ending: '',
    },
    chapters: [],
    firstChapterAdvice: {
      openingScene: '',
      characters: '',
      mood: '',
      conflictIntro: '',
      endingHook: '',
    },
    notes: '',
  };
}

// 创作类型显示名称
export const CREATION_MODE_NAMES: Record<CreationMode, { zh: string; en: string }> = {
  novel: { zh: '小说', en: 'Novel' },
  xiaohongshu: { zh: '小红书', en: 'Xiaohongshu' },
  short_video: { zh: '短视频', en: 'Short Video' },
  moments: { zh: '朋友圈', en: 'Moments' },
  product_copy: { zh: '产品文案', en: 'Product Copy' },
  marketing_matrix: { zh: '营销矩阵', en: 'Marketing Matrix' },
  course_outline: { zh: '课程大纲', en: 'Course Outline' },
  short_drama: { zh: '短剧', en: 'Short Drama' },
  free: { zh: '自由创作', en: 'Free Creation' },
};

// 创作类型对应的内容项名称
export const CREATION_ITEM_NAMES: Record<CreationMode, { zh: string; en: string }> = {
  novel: { zh: '章节', en: 'Chapter' },
  xiaohongshu: { zh: '文案', en: 'Post' },
  short_video: { zh: '脚本', en: 'Script' },
  moments: { zh: '朋友圈', en: 'Post' },
  product_copy: { zh: '产品文案', en: 'Product Copy' },
  marketing_matrix: { zh: '内容计划', en: 'Content Plan' },
  course_outline: { zh: '课程模块', en: 'Module' },
  short_drama: { zh: '剧集', en: 'Episode' },
  free: { zh: '内容项', en: 'Item' },
};

// 检查存储大小并提醒用户（导出供其他模块使用）
export function checkStorageSize(): boolean {
  try {
    const key = 'ai-assistant-storage';
    const data = localStorage.getItem(key);
    if (!data) return false;

    const sizeInMB = (new Blob([data]).size) / (1024 * 1024);
    console.log('存储大小:', sizeInMB.toFixed(2), 'MB');

    // 如果超过 4MB，提醒用户
    if (sizeInMB > 4) {
      return true; // 返回 true 表示需要提醒
    }
    return false;
  } catch (e) {
    console.error('检查存储失败:', e);
    return false;
  }
}

// 清理存储空间（导出供其他模块使用）
export function cleanStorage(): void {
  try {
    const key = 'ai-assistant-storage';
    const data = localStorage.getItem(key);
    if (!data) return;

    const parsed = JSON.parse(data);
    const state = parsed.state;

    // 清理图片记录，只保留最新的 10 张
    if (state?.imageRecords && state.imageRecords.length > 10) {
      state.imageRecords = state.imageRecords.slice(0, 10);
      console.log('清理图片记录，保留最新 10 张');
    }

    localStorage.setItem(key, JSON.stringify(parsed));
  } catch (e) {
    console.error('清理存储失败:', e);
  }
}

// 内存缓存，用于存储聊天消息中的图片（不持久化）
const messageImageCache = new Map<string, string>();

// 设置消息图片到缓存
export function setMessageImage(messageId: string, imageUrl: string): void {
  messageImageCache.set(messageId, imageUrl);
}

// 从缓存获取消息图片
export function getMessageImage(messageId: string): string | undefined {
  return messageImageCache.get(messageId);
}

// 清理消息图片缓存
export function clearMessageImageCache(): void {
  messageImageCache.clear();
}

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
  pinned?: boolean;  // 置顶
  draft?: string;    // 草稿
  draftImage?: string; // 草稿图片
}

export interface ImageRecord {
  id: string;
  prompt: string;
  imageUrl: string;        // 原图（base64）
  thumbnailUrl?: string;   // 缩略图（base64，压缩后）
  modelId: string;
  ratio: string;
  referenceImage?: string;
  createdAt: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  category: string;
}

// 生成缩略图
async function generateThumbnail(dataUrl: string, maxSize: number = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
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
  { id: 'grok-4.1', name: 'Grok 4.1', provider: 'openai', maxTokens: 131072 },
  { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai', maxTokens: 131072 },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', provider: 'openai', maxTokens: 131072 },
  { id: 'doubao-seed-2-0-lite-260215', name: 'Doubao Seed 2.0 Lite', provider: 'openai', maxTokens: 131072 },
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

// 提示词模板
export const PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: '1', name: '写实人像', prompt: '一张写实风格的人像照片，细节丰富，光影自然', category: '人像' },
  { id: '2', name: '动漫角色', prompt: '一个可爱的动漫角色，色彩鲜艳，线条清晰', category: '动漫' },
  { id: '3', name: '风景摄影', prompt: '壮丽的自然风景，专业摄影，高清画质', category: '风景' },
  { id: '4', name: '建筑设计', prompt: '现代建筑设计效果图，干净简洁，专业渲染', category: '建筑' },
  { id: '5', name: '产品渲染', prompt: '高品质产品渲染图，白色背景，商业摄影风格', category: '产品' },
  { id: '6', name: '概念艺术', prompt: '科幻概念艺术，未来感，电影级视觉效果', category: '艺术' },
  { id: '7', name: '水彩画', prompt: '水彩画风格，柔和色彩，艺术感', category: '艺术' },
  { id: '8', name: '油画风格', prompt: '油画风格，古典艺术，厚重质感', category: '艺术' },
  { id: '9', name: '简约图标', prompt: '简约风格的图标设计，扁平化，现代感', category: '设计' },
  { id: '10', name: 'Logo设计', prompt: '简洁现代的Logo设计，品牌标识', category: '设计' },
];

interface AppState {
  // API
  apiKey: string;
  setApiKey: (key: string) => void;

  // Chat
  conversations: Conversation[];
  currentConversationId: string | null;
  chatModelId: string;
  setChatModelId: (id: string) => void;
  pendingChatRequest: { conversationId: string; userMessage: string; imageBase64?: string } | null;
  setPendingChatRequest: (req: { conversationId: string; userMessage: string; imageBase64?: string } | null) => void;

  // Token 统计
  tokenUsage: TokenUsage[];
  addTokenUsage: (inputTokens: number, outputTokens: number) => void;
  totalInputTokens: number;
  totalOutputTokens: number;

  // Image
  imageModelId: string;
  setImageModelId: (id: string) => void;
  imageRatio: string;
  setImageRatio: (ratio: string) => void;
  imageQuality: string;
  setImageQuality: (quality: string) => void;
  imageRecords: ImageRecord[];
  pendingImageRequest: { prompt: string; referenceImage?: string } | null;
  setPendingImageRequest: (req: { prompt: string; referenceImage?: string } | null) => void;  // 生图历史记录

  // UI
  activeTab: 'chat' | 'image' | 'settings' | 'virtual-company' | 'super-writing' | 'morning-meeting';
  setActiveTab: (tab: 'chat' | 'image' | 'settings' | 'virtual-company' | 'super-writing' | 'morning-meeting') => void;
  isChatLoading: boolean;
  setIsChatLoading: (loading: boolean) => void;
  isImageLoading: boolean;
  setIsImageLoading: (loading: boolean) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  elderMode: boolean; // 长辈模式
  setElderMode: (enabled: boolean) => void;

  // 模型队列（支持重复模型、顺序执行、启用/禁用）
  modelQueue: Array<{ id: string; modelId: string; instruction: string; result?: string; title?: string; enabled: boolean }>;
  _lastClearedQueue: Array<{ id: string; modelId: string; instruction: string; result?: string; title?: string; enabled: boolean }> | null;
  setModelQueue: (queue: Array<{ id: string; modelId: string; instruction: string; result?: string; title?: string; enabled: boolean }>) => void;
  addModelToQueue: (modelId: string, instruction?: string, title?: string) => void;
  removeModelFromQueue: (id: string) => void;
  toggleQueueItem: (id: string) => void;  // 切换启用/禁用
  updateQueueInstruction: (id: string, instruction: string) => void;
  updateQueueResult: (id: string, result: string) => void;
  updateQueueTitle: (id: string, title: string) => void;
  clearModelQueue: () => void;
  undoClearModelQueue: () => void;
  isQueueRunning: boolean;
  setIsQueueRunning: (running: boolean) => void;
  currentQueueIndex: number;
  setCurrentQueueIndex: (index: number) => void;
  parallelMode: boolean;
  setParallelMode: (mode: boolean) => void;

  // 超级功能（可扩展）
  superFeature: 'writing' | 'meeting' | 'virtual_company' | 'none';
  setSuperFeature: (feature: 'writing' | 'meeting' | 'virtual_company' | 'none') => void;

  // 虚拟公司会话（临时问答）
  virtualCompanySessions: Array<{
    id: string;
    title: string;
    requirement: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    config: {
      reviewDepth: 'quick' | 'standard' | 'deep';
      roleCount: number;
      modelProvider: string;
      enableDebate: boolean;
      enableMvpPlan: boolean;
      outputLanguage: string;
    };
    projectAnalysis?: any;
    company?: any;
    organization?: any[];
    agents?: any[];
    workflow?: any[];
    reviews?: any[];
    debates?: any[];
    finalReport?: any;
    messages?: any[];
    currentStep?: string;
    progress?: number;
    createdAt: number;
    updatedAt: number;
  }>;
  currentVirtualCompanyId: string | null;
  createVirtualCompanySession: (requirement: string, config: any) => string;
  updateVirtualCompanySession: (id: string, updates: any) => void;
  deleteVirtualCompanySession: (id: string) => void;
  setCurrentVirtualCompanyId: (id: string | null) => void;

  // AI 公司（长期档案）
  aiCompanies: AICompany[];
  currentCompanyId: string | null;
  createAICompany: (companyData: Partial<AICompany> & { name: string; purpose: string }) => string;
  addAICompany: (company: AICompany) => void;
  updateAICompany: (id: string, updates: Partial<AICompany>) => void;
  deleteAICompany: (id: string) => void;
  setCurrentCompanyId: (id: string | null) => void;
  addCompanyMemory: (companyId: string, memory: Omit<AICompany['memories'][0], 'id' | 'companyId' | 'createdAt'>) => void;
  addCompanyTask: (companyId: string, task: Omit<AICompany['tasks'][0], 'id' | 'companyId' | 'createdAt' | 'status'>) => void;
  addCompanyRisk: (companyId: string, risk: Omit<AICompany['risks'][0], 'id' | 'companyId' | 'createdAt' | 'status'>) => void;
  addCompanyMeeting: (companyId: string, meeting: Omit<AICompany['meetings'][0], 'id' | 'companyId' | 'createdAt'>) => void;
  updateCompanyTaskStatus: (companyId: string, taskId: string, status: AICompany['tasks'][0]['status']) => void;

  // 角色/设定记忆库（支持原人名→替换人名映射）
  characterMemory: Array<{ id: string; originalName: string; replaceWith: string; description: string; createdAt: number }>;
  addCharacter: (originalName: string, replaceWith: string, description: string) => void;
  updateCharacter: (id: string, originalName: string, replaceWith: string, description: string) => void;
  deleteCharacter: (id: string) => void;
  worldSetting: string;
  setWorldSetting: (setting: string) => void;

  // 当前创作草稿（持久化，防止丢稿）
  activeWritingDraft: {
    id: string;
    title: string;
    outlineText: string;
    creationMode: CreationMode;
    parsedOutline: {
      chapters: Array<{ title: string; content?: string; order: number }>;
      characters: Array<{ name: string; description: string; replaceWith?: string }>;
      worldSetting: string;
    } | null;
    parsedCreation: any; // 不同创作类型的解析结果
    modelQueue: Array<{ id: string; modelId: string; instruction: string; result?: string; title?: string; enabled: boolean }>;
    worldSetting: string;
    characterMemory: Array<{ id: string; originalName: string; replaceWith: string; description: string }>;
    source: 'chat' | 'superWriting';
    updatedAt: number;
  } | null;
  setActiveWritingDraft: (draft: {
    id: string;
    title: string;
    outlineText: string;
    creationMode: CreationMode;
    parsedOutline: {
      chapters: Array<{ title: string; content?: string; order: number }>;
      characters: Array<{ name: string; description: string; replaceWith?: string }>;
      worldSetting: string;
    } | null;
    parsedCreation: any;
    modelQueue: Array<{ id: string; modelId: string; instruction: string; result?: string; title?: string; enabled: boolean }>;
    worldSetting: string;
    characterMemory: Array<{ id: string; originalName: string; replaceWith: string; description: string }>;
    source: 'chat' | 'superWriting';
    updatedAt: number;
  } | null) => void;
  clearActiveWritingDraft: () => void;

  // 进度保存
  savedTasks: Array<{
    id: string;
    name: string;
    queue: Array<{ id: string; modelId: string; instruction: string; result?: string; title?: string; enabled?: boolean }>;
    creationMode: CreationMode;
    parsedCreation: any;
    outlineText: string;
    worldSetting: string;
    characterMemory: Array<{ id: string; originalName: string; replaceWith: string; description: string }>;
    createdAt: number;
  }>;
  saveTask: (name: string, taskData?: {
    creationMode?: CreationMode;
    parsedCreation?: any;
    outlineText?: string;
    worldSetting?: string;
    characterMemory?: Array<{ id: string; originalName: string; replaceWith: string; description: string }>;
  }) => void;
  loadTask: (id: string) => {
    creationMode?: CreationMode;
    parsedCreation?: any;
    outlineText?: string;
    worldSetting?: string;
    characterMemory?: Array<{ id: string; originalName: string; replaceWith: string; description: string }>;
  };
  deleteTask: (id: string) => void;

  // 从聊天页发送到创作台的初始需求
  pendingWritingRequirement: string;
  setPendingWritingRequirement: (requirement: string) => void;
  clearPendingWritingRequirement: () => void;

  // 创作台默认模型
  selectedWritingModelId: string;
  setSelectedWritingModelId: (modelId: string) => void;

  // Actions
  createConversation: () => string;
  getCurrentConversation: () => Conversation | null;
  addMessage: (content: string, role: 'user' | 'assistant', imageUrl?: string) => void;
  editMessage: (messageId: string, content: string) => void;
  deleteMessage: (messageId: string) => void;
  renameConversation: (id: string, title: string) => void;
  clearConversation: () => void;
  deleteConversation: (id: string) => void;
  pinConversation: (id: string, pinned: boolean) => void;
  saveDraft: (conversationId: string, draft: string, draftImage?: string) => void;
  addImageRecord: (record: Omit<ImageRecord, 'id' | 'createdAt'>) => void;
  deleteImageRecord: (id: string) => void;
  clearImageRecords: () => void;
  exportData: () => string;
  importData: (data: string) => void;
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
      pendingChatRequest: null,
      setPendingChatRequest: (req) => set({ pendingChatRequest: req }),

      // Token 统计
      tokenUsage: [],
      addTokenUsage: (inputTokens, outputTokens) => set((state) => {
        console.log('addTokenUsage 被调用:', { inputTokens, outputTokens });
        const newUsage: TokenUsage = { inputTokens, outputTokens, timestamp: Date.now() };
        const usages = [newUsage, ...state.tokenUsage].slice(0, 100); // 保留最近100条
        const totalInput = usages.reduce((sum, u) => sum + u.inputTokens, 0);
        const totalOutput = usages.reduce((sum, u) => sum + u.outputTokens, 0);
        console.log('Token 总计:', { totalInput, totalOutput, count: usages.length });
        return { tokenUsage: usages, totalInputTokens: totalInput, totalOutputTokens: totalOutput };
      }),
      totalInputTokens: 0,
      totalOutputTokens: 0,

      // Image
      imageModelId: IMAGE_MODELS[0].id,
      setImageModelId: (id) => {
        const { quality, ratio } = constrainImageSettings(id, get().imageQuality, get().imageRatio);
        set({ imageModelId: id, imageQuality: quality, imageRatio: ratio });
      },
      imageRatio: IMAGE_MODELS[0].defaultRatio,
      setImageRatio: (ratio) => set({ imageRatio: ratio }),
      imageQuality: IMAGE_MODELS[0].defaultQuality,
      setImageQuality: (quality) => set({ imageQuality: quality }),
      imageRecords: [],
      pendingImageRequest: null,
      setPendingImageRequest: (req) => set({ pendingImageRequest: req }),

      // UI
      activeTab: 'chat',
      setActiveTab: (tab) => set({ activeTab: tab }),
      isChatLoading: false,
      setIsChatLoading: (loading) => set({ isChatLoading: loading }),
      isImageLoading: false,
      setIsImageLoading: (loading) => set({ isImageLoading: loading }),
      theme: 'light',
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },
      language: 'zh',
      setLanguage: (language) => set({ language }),
      elderMode: false,
      setElderMode: (elderMode) => set({ elderMode }),

      // 模型队列
      modelQueue: [],
      _lastClearedQueue: null,
      setModelQueue: (modelQueue) => set({ modelQueue }),
      addModelToQueue: (modelId, instruction = '', title = '') => set((state) => ({
        modelQueue: [...state.modelQueue, {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
          modelId,
          instruction,
          result: undefined,
          title,
          enabled: true,  // 默认启用
        }],
      })),
      removeModelFromQueue: (id) => set((state) => ({
        modelQueue: state.modelQueue.filter((item) => item.id !== id),
      })),
      toggleQueueItem: (id) => set((state) => ({
        modelQueue: state.modelQueue.map((item) =>
          item.id === id ? { ...item, enabled: !item.enabled } : item
        ),
      })),
      updateQueueInstruction: (id, instruction) => set((state) => ({
        modelQueue: state.modelQueue.map((item) =>
          item.id === id ? { ...item, instruction } : item
        ),
      })),
      updateQueueResult: (id, result) => set((state) => ({
        modelQueue: state.modelQueue.map((item) =>
          item.id === id ? { ...item, result } : item
        ),
      })),
      updateQueueTitle: (id, title) => set((state) => ({
        modelQueue: state.modelQueue.map((item) =>
          item.id === id ? { ...item, title } : item
        ),
      })),
      clearModelQueue: () => {
        const { modelQueue } = get();
        // 保存到撤销缓存
        set({
          _lastClearedQueue: modelQueue,
          modelQueue: [],
          currentQueueIndex: 0
        });
      },
      undoClearModelQueue: () => {
        const { _lastClearedQueue } = get();
        if (_lastClearedQueue && _lastClearedQueue.length > 0) {
          set({
            modelQueue: _lastClearedQueue,
            _lastClearedQueue: null,
          });
        }
      },
      isQueueRunning: false,
      setIsQueueRunning: (isQueueRunning) => set({ isQueueRunning }),
      currentQueueIndex: 0,
      setCurrentQueueIndex: (currentQueueIndex) => set({ currentQueueIndex }),
      parallelMode: false,
      setParallelMode: (parallelMode) => set({ parallelMode }),

      // 超级功能
      superFeature: 'none',
      setSuperFeature: (superFeature) => set({ superFeature }),

      // 虚拟公司会话
      virtualCompanySessions: [],
      currentVirtualCompanyId: null,
      createVirtualCompanySession: (requirement, config) => {
        const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
        const session = {
          id,
          title: requirement.slice(0, 30) + (requirement.length > 30 ? '...' : ''),
          requirement,
          status: 'pending' as const,
          config,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          virtualCompanySessions: [session, ...state.virtualCompanySessions],
          currentVirtualCompanyId: id,
        }));
        return id;
      },
      updateVirtualCompanySession: (id, updates) => set((state) => ({
        virtualCompanySessions: state.virtualCompanySessions.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
        ),
      })),
      deleteVirtualCompanySession: (id) => set((state) => ({
        virtualCompanySessions: state.virtualCompanySessions.filter((s) => s.id !== id),
        currentVirtualCompanyId: state.currentVirtualCompanyId === id ? null : state.currentVirtualCompanyId,
      })),
      setCurrentVirtualCompanyId: (id) => set({ currentVirtualCompanyId: id }),

      // AI 公司（长期档案）
      aiCompanies: [],
      currentCompanyId: null,
      createAICompany: (companyData) => {
        const id = Date.now().toString() + Math.random().toString(36).slice(2, 7);
        const now = new Date().toISOString();
        const company = {
          id,
          name: companyData.name,
          purpose: companyData.purpose,
          industry: companyData.industry,
          stage: companyData.stage,
          targetUsers: companyData.targetUsers || [],
          products: companyData.products || [],
          businessModel: companyData.businessModel,
          agents: companyData.agents || [],
          memories: companyData.memories || [],
          goals: companyData.goals || [],
          tasks: companyData.tasks || [],
          risks: companyData.risks || [],
          meetings: companyData.meetings || [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          aiCompanies: [company, ...state.aiCompanies],
          currentCompanyId: id,
        }));
        return id;
      },
      addAICompany: (company) => set((state) => ({
        aiCompanies: [company, ...state.aiCompanies],
        currentCompanyId: company.id,
      })),
      updateAICompany: (id, updates) => set((state) => ({
        aiCompanies: state.aiCompanies.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ),
      })),
      deleteAICompany: (id) => set((state) => ({
        aiCompanies: state.aiCompanies.filter((c) => c.id !== id),
        currentCompanyId: state.currentCompanyId === id ? null : state.currentCompanyId,
      })),
      setCurrentCompanyId: (id) => set({ currentCompanyId: id }),
      addCompanyMemory: (companyId, memory) => set((state) => ({
        aiCompanies: state.aiCompanies.map((c) =>
          c.id === companyId ? {
            ...c,
            memories: [...c.memories, {
              id: Date.now().toString(),
              companyId,
              ...memory,
              createdAt: new Date().toISOString(),
            }],
            updatedAt: new Date().toISOString(),
          } : c
        ),
      })),
      addCompanyTask: (companyId, task) => set((state) => ({
        aiCompanies: state.aiCompanies.map((c) =>
          c.id === companyId ? {
            ...c,
            tasks: [...c.tasks, {
              id: Date.now().toString(),
              companyId,
              ...task,
              status: 'todo',
              createdAt: new Date().toISOString(),
            }],
            updatedAt: new Date().toISOString(),
          } : c
        ),
      })),
      addCompanyRisk: (companyId, risk) => set((state) => ({
        aiCompanies: state.aiCompanies.map((c) =>
          c.id === companyId ? {
            ...c,
            risks: [...c.risks, {
              id: Date.now().toString(),
              companyId,
              ...risk,
              status: 'active',
              createdAt: new Date().toISOString(),
            }],
            updatedAt: new Date().toISOString(),
          } : c
        ),
      })),
      addCompanyMeeting: (companyId, meeting) => set((state) => ({
        aiCompanies: state.aiCompanies.map((c) =>
          c.id === companyId ? {
            ...c,
            meetings: [...c.meetings, {
              id: Date.now().toString(),
              companyId,
              ...meeting,
              createdAt: new Date().toISOString(),
            }],
            updatedAt: new Date().toISOString(),
          } : c
        ),
      })),
      updateCompanyTaskStatus: (companyId, taskId, status) => set((state) => ({
        aiCompanies: state.aiCompanies.map((c) =>
          c.id === companyId ? {
            ...c,
            tasks: c.tasks.map((t: AICompany['tasks'][0]) => t.id === taskId ? { ...t, status } : t),
            updatedAt: new Date().toISOString(),
          } : c
        ),
      })),

      // 角色/设定记忆库（支持原人名→替换人名映射）
      characterMemory: [],
      addCharacter: (originalName, replaceWith, description) => set((state) => ({
        characterMemory: [...state.characterMemory, {
          id: Date.now().toString(),
          originalName,
          replaceWith,
          description,
          createdAt: Date.now(),
        }],
      })),
      updateCharacter: (id, originalName, replaceWith, description) => set((state) => ({
        characterMemory: state.characterMemory.map((c) =>
          c.id === id ? { ...c, originalName, replaceWith, description } : c
        ),
      })),
      deleteCharacter: (id) => set((state) => ({
        characterMemory: state.characterMemory.filter((c) => c.id !== id),
      })),
      worldSetting: '',
      setWorldSetting: (worldSetting) => set({ worldSetting }),

      // 当前创作草稿（持久化，防止丢稿）
      activeWritingDraft: null,
      setActiveWritingDraft: (draft) => set({ activeWritingDraft: draft }),
      clearActiveWritingDraft: () => set({ activeWritingDraft: null }),

      // 进度保存
      savedTasks: [],
      saveTask: (name, taskData) => set((state) => ({
        savedTasks: [...state.savedTasks, {
          id: Date.now().toString(),
          name,
          queue: [...state.modelQueue],
          creationMode: taskData?.creationMode || state.activeWritingDraft?.creationMode || 'novel',
          parsedCreation: taskData?.parsedCreation || state.activeWritingDraft?.parsedCreation || null,
          outlineText: taskData?.outlineText || state.activeWritingDraft?.outlineText || '',
          worldSetting: taskData?.worldSetting || state.worldSetting || '',
          characterMemory: taskData?.characterMemory || state.characterMemory.map(c => ({
            id: c.id,
            originalName: c.originalName,
            replaceWith: c.replaceWith,
            description: c.description,
          })) || [],
          createdAt: Date.now(),
        }],
      })),
      loadTask: (id) => {
        const state = get();
        const task = state.savedTasks.find((t) => t.id === id);
        if (task) {
          // 确保加载的队列项有 enabled 字段
          const queue = task.queue.map(item => ({
            ...item,
            enabled: item.enabled !== false  // 默认启用
          }));
          // 恢复角色记忆时添加 createdAt
          const restoredCharacterMemory = (task.characterMemory || []).map(c => ({
            ...c,
            createdAt: Date.now(),
          }));
          // 恢复所有状态
          set({
            modelQueue: queue,
            currentQueueIndex: 0,
            worldSetting: task.worldSetting || '',
            characterMemory: restoredCharacterMemory,
            activeWritingDraft: {
              id: task.id,
              title: task.name,
              outlineText: task.outlineText || '',
              creationMode: task.creationMode || 'novel',
              parsedOutline: null,
              parsedCreation: task.parsedCreation || null,
              modelQueue: [],
              worldSetting: task.worldSetting || '',
              characterMemory: restoredCharacterMemory,
              source: 'superWriting',
              updatedAt: Date.now(),
            },
          });
          return {
            creationMode: task.creationMode,
            parsedCreation: task.parsedCreation,
            outlineText: task.outlineText,
            worldSetting: task.worldSetting,
            characterMemory: task.characterMemory,
          };
        }
        return {};
      },
      deleteTask: (id) => set((state) => ({
        savedTasks: state.savedTasks.filter((t) => t.id !== id),
      })),

      // 从聊天页发送到创作台的初始需求
      pendingWritingRequirement: '',
      setPendingWritingRequirement: (requirement) => set({ pendingWritingRequirement: requirement }),
      clearPendingWritingRequirement: () => set({ pendingWritingRequirement: '' }),

      // 创作台默认模型
      selectedWritingModelId: '',
      setSelectedWritingModelId: (modelId) => set({ selectedWritingModelId: modelId }),

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

        const messageId = Date.now().toString();

        // 如果有图片，存入内存缓存而不是直接存入 state
        // 这样可以避免 base64 图片撑爆 localStorage
        if (imageUrl) {
          setMessageImage(messageId, imageUrl);
        }

        const message: Message = {
          id: messageId,
          role,
          content,
          // 只存储一个标记，实际的图片数据在内存缓存中
          imageUrl: imageUrl ? `cached:${messageId}` : undefined,
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

      editMessage: (messageId, content) => {
        const { currentConversationId, conversations } = get();
        if (!currentConversationId) return;

        set({
          conversations: conversations.map((c) => {
            if (c.id !== currentConversationId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content } : m
              ),
            };
          }),
        });
      },

      deleteMessage: (messageId) => {
        const { currentConversationId, conversations } = get();
        if (!currentConversationId) return;

        set({
          conversations: conversations.map((c) => {
            if (c.id !== currentConversationId) return c;
            return {
              ...c,
              messages: c.messages.filter((m) => m.id !== messageId),
            };
          }),
        });
      },

      renameConversation: (id, title) => {
        set({
          conversations: get().conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
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

      pinConversation: (id, pinned) => {
        set({
          conversations: get().conversations.map((c) =>
            c.id === id ? { ...c, pinned } : c
          ),
        });
      },

      saveDraft: (conversationId, draft, draftImage) => {
        set({
          conversations: get().conversations.map((c) =>
            c.id === conversationId ? { ...c, draft, draftImage } : c
          ),
        });
      },

      addImageRecord: async (record) => {
        // 生成缩略图用于列表显示
        const thumbnailUrl = await generateThumbnail(record.imageUrl, 150);

        const newRecord: ImageRecord = {
          ...record,
          id: Date.now().toString(),
          createdAt: Date.now(),
          thumbnailUrl,
        };

        try {
          set((state) => {
            // 限制最多保存 20 张图片，超出时删除最旧的
            const records = [newRecord, ...state.imageRecords];
            while (records.length > 20) {
              records.pop();
            }
            return { imageRecords: records };
          });
        } catch (e: any) {
          // 如果存储失败，提示用户
          if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
            alert('存储空间已满！请及时下载保存重要图片，然后手动删除旧图片释放空间。');
          }
          throw e;
        }
      },

      deleteImageRecord: (id) => {
        set((state) => ({ imageRecords: state.imageRecords.filter((r) => r.id !== id) }));
      },

      clearImageRecords: () => set({ imageRecords: [] }),

      exportData: () => {
        const state = get();
        const data = {
          conversations: state.conversations,
          imageRecords: state.imageRecords,
          apiKey: state.apiKey,
          chatModelId: state.chatModelId,
          imageModelId: state.imageModelId,
          theme: state.theme,
          exportedAt: Date.now(),
        };
        return JSON.stringify(data, null, 2);
      },

      importData: (dataStr) => {
        try {
          const data = JSON.parse(dataStr);
          set({
            conversations: data.conversations || [],
            imageRecords: data.imageRecords || [],
            apiKey: data.apiKey || '',
            chatModelId: data.chatModelId || CHAT_MODELS[0].id,
            imageModelId: data.imageModelId || IMAGE_MODELS[0].id,
            theme: data.theme || 'light',
          });
          document.documentElement.classList.toggle('dark', data.theme === 'dark');
        } catch (e) {
          console.error('导入数据失败:', e);
        }
      },
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
        theme: state.theme,
        tokenUsage: state.tokenUsage.slice(0, 50), // 只保留最近50条
        language: state.language,
        elderMode: state.elderMode,
        characterMemory: state.characterMemory,
        worldSetting: state.worldSetting,
        savedTasks: state.savedTasks.slice(-5), // 最多保留最近5个任务
        virtualCompanySessions: state.virtualCompanySessions?.slice(0, 10), // 只保留最近10个虚拟公司会话
        aiCompanies: state.aiCompanies, // 保存所有 AI 公司
        currentCompanyId: state.currentCompanyId,
        // 创作中心持久化 - 防止丢稿
        modelQueue: state.modelQueue,
        // activeWritingDraft 去重：不保存 modelQueue，由顶层 modelQueue 单独持久化
        activeWritingDraft: state.activeWritingDraft
          ? { ...state.activeWritingDraft, modelQueue: [] }
          : null,
      }),
    }
  )
);