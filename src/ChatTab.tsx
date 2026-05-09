import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Trash2, Plus, ChevronLeft, Image as ImageIcon, X, Copy, Edit2, Check, Pencil, Search, StopCircle, Pin, PinOff, Download, Mic, Share2, Zap, CheckCircle, Circle, GitCompare, Play, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore, CHAT_MODELS } from './store';
import { sendChatMessageStream, cancelChatRequest, executeModelQueue, regenerateQueueItem } from './api';
import { t, Language } from './i18n';
import { hapticFeedback, shareConversation } from './utils';
import ReactMarkdown from 'react-markdown';

const SCROLL_POSITION_KEY = 'chat-scroll-position';

// 快捷短语
const QUICK_PHRASES: Record<Language, Array<{ key: string; text: string }>> = {
  zh: [
    { key: 'translateToEnglish', text: '请将以下内容翻译成英文：' },
    { key: 'translateToChinese', text: '请将以下内容翻译成中文：' },
    { key: 'summarize', text: '请总结以下内容：' },
    { key: 'explainCode', text: '请解释这段代码：' },
    { key: 'improveWriting', text: '请润色以下文字，使其更加流畅优美：' },
    { key: 'expandContent', text: '请扩展以下内容，添加更多细节：' },
    { key: 'makeConcise', text: '请精简以下内容，保留核心要点：' },
  ],
  en: [
    { key: 'translateToEnglish', text: 'Translate the following to English: ' },
    { key: 'translateToChinese', text: 'Translate the following to Chinese: ' },
    { key: 'summarize', text: 'Summarize the following: ' },
    { key: 'explainCode', text: 'Explain this code: ' },
    { key: 'improveWriting', text: 'Improve the writing of the following: ' },
    { key: 'expandContent', text: 'Expand the following with more details: ' },
    { key: 'makeConcise', text: 'Make the following more concise: ' },
  ],
};

// 朗读功能
let currentUtterance: SpeechSynthesisUtterance | null = null;

function speakText(text: string, lang: string) {
  // 停止当前朗读
  if (currentUtterance) {
    speechSynthesis.cancel();
  }

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
  currentUtterance.rate = 0.9; // 稍慢一点，更清晰
  currentUtterance.onend = () => {
    currentUtterance = null;
  };

  speechSynthesis.speak(currentUtterance);
}

export default function ChatTab() {
  const {
    conversations,
    currentConversationId,
    chatModelId,
    setChatModelId,
    isChatLoading,
    createConversation,
    getCurrentConversation,
    clearConversation,
    deleteConversation,
    pendingChatRequest,
    setPendingChatRequest,
    deleteMessage,
    renameConversation,
    pinConversation,
    saveDraft,
    exportData,
    language,
    elderMode,
    // 模型队列
    modelQueue,
    addModelToQueue,
    removeModelFromQueue,
    updateQueueInstruction,
    updateQueueResult,
    clearModelQueue,
    isQueueRunning,
    currentQueueIndex,
    // 角色/设定记忆库
    characterMemory,
    addCharacter,
    updateCharacter,
    deleteCharacter,
    worldSetting,
    setWorldSetting,
    // 进度保存
    savedTasks,
    saveTask,
    loadTask,
    deleteTask,
    // 并行模式
    parallelMode,
    setParallelMode,
  } = useAppStore();

  const T = (key: string) => t(key, language as Language);

  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false); // 语音输入模式
  const [voiceText, setVoiceText] = useState(''); // 语音识别的文字
  const [showQuickPhrases, setShowQuickPhrases] = useState(false); // 快捷短语弹窗
  const [isBatchMode, setIsBatchMode] = useState(false); // 批量选择模式
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set()); // 选中的对话ID
  const [isMessageSelectMode, setIsMessageSelectMode] = useState(false); // 消息多选模式
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set()); // 选中的消息ID
  const [showQueuePanel, setShowQueuePanel] = useState(false); // 模型队列面板
  const [showModelSelector, setShowModelSelector] = useState(false); // 模型选择器
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set()); // 展开的结果
  const [showOutlineParser, setShowOutlineParser] = useState(false); // 大纲解析器
  const [outlineText, setOutlineText] = useState(''); // 大纲文本
  const [showOutlinePreview, setShowOutlinePreview] = useState(false); // 大纲预览
  const [parsedOutline, setParsedOutline] = useState<{
    chapters: Array<{ title: string; order: number }>;
    characters: Array<{ name: string; description: string; replaceWith?: string }>;
    worldSetting: string;
  } | null>(null); // 解析结果
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set()); // 选中的章节
  const [showCharacterPanel, setShowCharacterPanel] = useState(false); // 角色面板
  const [showExportPanel, setShowExportPanel] = useState(false); // 导出面板
  const [showTaskPanel, setShowTaskPanel] = useState(false); // 任务面板
  const [styleCheckResult, setStyleCheckResult] = useState<string | null>(null); // 风格检查结果
  const [continuationSuggestion, setContinuationSuggestion] = useState<string | null>(null); // 续写建议
  const [isAnalyzing, setIsAnalyzing] = useState(false); // 分析中
  const [compareItemId, setCompareItemId] = useState<string | null>(null); // 正在对比的项
  const [compareResults, setCompareResults] = useState<Record<string, string>>({}); // 对比结果
  const [showSharePanel, setShowSharePanel] = useState(false); // 分享面板
  const [shareLink, setShareLink] = useState<string>(''); // 分享链接
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null); // 滑动起始位置
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null); // 输入框引用
  const prevMessagesLengthRef = useRef(0);
  const shouldScrollToBottomRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false); // 用于防止重复触发
  const isPressingRef = useRef(false); // 追踪鼠标/触摸按压状态
  const audioContextRef = useRef<AudioContext | null>(null); // 音频上下文

  const conversation = getCurrentConversation();
  const currentModel = CHAT_MODELS.find((m) => m.id === chatModelId);

  // 自适应输入框高度
  const adjustTextareaHeight = () => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120); // 最大高度120px
      textarea.style.height = newHeight + 'px';
    }
  };

  // 输入变化时调整高度
  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  // 释放音频设备
  const releaseAudioDevice = async () => {
    try {
      // 关闭音频上下文
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      // 延迟一段时间让系统释放音频设备
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.log('释放音频设备时出错:', e);
    }
  };

  // 初始化音频上下文（用于激活音频设备）
  const initAudioContext = async () => {
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (e) {
      console.log('初始化音频上下文时出错:', e);
    }
  };

  // 创建新的 SpeechRecognition 实例
  const createRecognition = () => {
    // 支持多种浏览器：Chrome/Safari 使用 webkitSpeechRecognition，Edge/Firefox 使用 SpeechRecognition
    const SpeechRecognition = (window as any).SpeechRecognition
      || (window as any).webkitSpeechRecognition
      || (window as any).mozSpeechRecognition
      || (window as any).msSpeechRecognition;

    if (!SpeechRecognition) {
      console.log('浏览器不支持语音识别');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setVoiceText(prev => {
        const newText = finalTranscript || interimTranscript || prev;
        return newText;
      });
    };

    recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error, event);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      let msg: string;

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        if (isIOS && language === 'zh') {
          msg = '请允许麦克风权限以使用语音功能。\n\niOS 用户提示：\n1. 在 Safari 中使用一次语音功能并授权\n2. 保持 Safari 在后台运行\n3. 或在系统设置 → 隐私 → 麦克风中为 Safari 永久授权';
        } else if (isIOS) {
          msg = 'Please allow microphone access.\n\niOS Tips:\n1. Use voice in Safari first and grant permission\n2. Keep Safari running in background\n3. Or grant permanent access in Settings → Privacy → Microphone';
        } else if (isAndroid && language === 'zh') {
          msg = '请允许麦克风权限以使用语音功能。\n\nAndroid 提示：\n1. 在浏览器设置中允许麦克风权限\n2. 或在系统设置 → 应用 → 浏览器 → 权限中开启麦克风';
        } else if (isAndroid) {
          msg = 'Please allow microphone access.\n\nAndroid Tips:\n1. Allow microphone in browser settings\n2. Or enable in System Settings → Apps → Browser → Permissions';
        } else if (language === 'zh') {
          msg = '请允许麦克风权限以使用语音功能。\n\n提示：将应用添加到主屏幕可持久化权限。';
        } else {
          msg = 'Please allow microphone access.\n\nTip: Add to home screen to persist permissions.';
        }
        alert(msg);
      } else if (event.error === 'no-speech') {
        // 没有检测到语音，静默处理
        console.log('未检测到语音输入');
      } else if (event.error === 'audio-capture') {
        // 音频捕获失败，可能是设备被占用
        console.log('音频捕获失败，尝试重新初始化...');
        releaseAudioDevice().then(() => {
          alert(language === 'zh'
            ? '无法捕获音频，可能是麦克风被其他应用占用。\n\n请尝试：\n1. 关闭其他使用麦克风的应用（如微信语音）\n2. 等待几秒后再试\n3. 或刷新页面'
            : 'Cannot capture audio. Microphone may be occupied by another app.\n\nTry:\n1. Close other apps using microphone (e.g. WeChat voice)\n2. Wait a few seconds\n3. Or refresh the page');
        });
      } else if (event.error === 'network') {
        const isEdge = /Edg/.test(navigator.userAgent);
        if (isEdge) {
          alert(language === 'zh'
            ? '网络连接失败：Edge 浏览器的语音识别需要连接微软服务器。\n\n请尝试：\n1. 检查网络连接\n2. 关闭 VPN 或代理后重试\n3. 或使用 Chrome/Safari 浏览器'
            : 'Network error: Edge voice recognition requires connection to Microsoft servers.\n\nTry:\n1. Check network connection\n2. Disable VPN or proxy\n3. Or use Chrome/Safari browser');
        } else {
          alert(language === 'zh' ? '网络错误，请检查网络连接' : 'Network error, please check your connection');
        }
      } else if (event.error === 'aborted') {
        console.log('语音识别被中断');
      } else if (event.error === 'service-not-allowed') {
        // 服务不允许，可能是浏览器限制
        alert(language === 'zh'
          ? '语音服务不可用，请确保在支持的浏览器中使用（推荐 Safari 或 Chrome）'
          : 'Voice service not available. Please use a supported browser (Safari or Chrome recommended)');
      } else {
        // 其他错误
        console.log('其他语音错误:', event.error);
      }

      isRecordingRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        setIsRecording(false);
      }
      // 识别结束后释放音频设备
      releaseAudioDevice();
    };

    return recognition;
  };

  // 进入语音模式
  const enterVoiceMode = async () => {
    // 先释放可能被占用的音频设备
    await releaseAudioDevice();
    // 初始化音频上下文
    await initAudioContext();

    setIsVoiceMode(true);
    setVoiceText('');
    isRecordingRef.current = false;
    // 每次进入语音模式时创建新实例
    recognitionRef.current = createRecognition();
  };

  // 退出语音模式
  const exitVoiceMode = async () => {
    setIsVoiceMode(false);
    setVoiceText('');
    if (isRecordingRef.current && recognitionRef.current) {
      isRecordingRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
    // 释放音频设备
    await releaseAudioDevice();
  };

  // 开始录音（长按）
  const startRecording = async () => {
    if (isRecordingRef.current) return;
    if (!recognitionRef.current) {
      const isEdge = /Edg/.test(navigator.userAgent);
      if (isEdge) {
        alert(language === 'zh'
          ? 'Edge 浏览器语音识别需要：\n1. 使用 HTTPS 连接\n2. 允许麦克风权限\n\n建议使用 Chrome 或 Safari 获得最佳体验'
          : 'Edge voice recognition requires:\n1. HTTPS connection\n2. Microphone permission\n\nRecommend using Chrome or Safari for best experience');
      } else {
        alert(T('voiceNotSupported'));
      }
      return;
    }

    hapticFeedback('medium'); // 开始录音震动反馈
    setVoiceText('');
    isRecordingRef.current = true;
    setIsRecording(true);

    // 先初始化音频上下文
    await initAudioContext();

    try {
      recognitionRef.current.start();
      console.log('语音识别已启动');
    } catch (e: any) {
      console.error('启动语音识别失败:', e.name, e.message);
      // 如果已经在运行，需要先停止
      if (e.name === 'InvalidStateError' || e.message?.includes('already started')) {
        try {
          recognitionRef.current.stop();
        } catch {}
        // 等待停止后再启动，给系统时间释放音频设备
        await releaseAudioDevice();
        await initAudioContext();
        setTimeout(() => {
          try {
            if (isRecordingRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (err) {
            console.error('无法启动语音识别:', err);
            isRecordingRef.current = false;
            setIsRecording(false);
          }
        }, 300);
      } else {
        console.error('无法启动语音识别:', e);
        isRecordingRef.current = false;
        setIsRecording(false);
        // 显示错误信息
        const isEdge = /Edg/.test(navigator.userAgent);
        if (isEdge && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
          alert(language === 'zh'
            ? 'Edge 浏览器限制：请确保网站使用 HTTPS，并刷新页面后重试'
            : 'Edge restriction: Please ensure HTTPS is used, refresh and try again');
        }
      }
    }
  };

  // 停止录音（松开）
  const stopRecording = () => {
    if (!isRecordingRef.current) return;
    hapticFeedback('light'); // 停止录音震动反馈
    isRecordingRef.current = false;
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  // 确认语音文字，填入输入框
  const confirmVoiceText = () => {
    hapticFeedback('medium');
    if (voiceText.trim()) {
      setInput(prev => prev ? prev + ' ' + voiceText.trim() : voiceText.trim());
    }
    setIsVoiceMode(false);
    setVoiceText('');
  };

  // 草稿自动保存
  useEffect(() => {
    if (currentConversationId && input) {
      const timer = setTimeout(() => {
        saveDraft(currentConversationId, input, attachedImage || undefined);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [input, attachedImage, currentConversationId, saveDraft]);

  // 恢复草稿 - 只在切换对话且输入为空时恢复
  useEffect(() => {
    if (conversation?.draft && !input) {
      setInput(conversation.draft);
      setAttachedImage(conversation.draftImage || null);
    }
  }, [currentConversationId]);

  // 页面恢复时检查是否有未完成的请求
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // 页面变为可见时，释放可能被占用的音频设备
        await releaseAudioDevice();

        // 如果在语音模式，重新创建识别实例
        if (isVoiceMode && !recognitionRef.current) {
          recognitionRef.current = createRecognition();
        }

        if (pendingChatRequest) {
          const { conversationId, userMessage, imageBase64 } = pendingChatRequest;
          // 只有当前对话匹配时才继续
          if (conversationId === currentConversationId) {
            setError(null);
            shouldScrollToBottomRef.current = true;
            try {
              await sendChatMessageStream(userMessage, imageBase64);
            } catch (e) {
              setError(String(e));
            }
          }
        }
      } else if (document.visibilityState === 'hidden') {
        // 页面隐藏时，停止录音并释放音频设备
        if (isRecordingRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
          isRecordingRef.current = false;
          setIsRecording(false);
        }
        await releaseAudioDevice();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pendingChatRequest, currentConversationId, isVoiceMode]);

  // 组件挂载时也检查
  useEffect(() => {
    if (pendingChatRequest && pendingChatRequest.conversationId === currentConversationId && !isChatLoading) {
      const { userMessage, imageBase64 } = pendingChatRequest;
      setError(null);
      shouldScrollToBottomRef.current = true;
      setPendingChatRequest(null);
      sendChatMessageStream(userMessage, imageBase64).catch((e: Error) => setError(String(e)));
    }
  }, []);

  // 保存滚动位置
  const saveScrollPosition = useCallback(() => {
    if (messagesContainerRef.current && currentConversationId) {
      const scrollTop = messagesContainerRef.current.scrollTop;
      localStorage.setItem(`${SCROLL_POSITION_KEY}-${currentConversationId}`, String(scrollTop));
    }
  }, [currentConversationId]);

  // 恢复滚动位置
  const restoreScrollPosition = useCallback(() => {
    if (messagesContainerRef.current && currentConversationId) {
      const saved = localStorage.getItem(`${SCROLL_POSITION_KEY}-${currentConversationId}`);
      if (saved !== null) {
        messagesContainerRef.current.scrollTop = parseInt(saved, 10);
      }
    }
  }, [currentConversationId]);

  // 监听滚动，保存位置（带防抖）
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    let rafId: number;
    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => saveScrollPosition());
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', handleScroll);
    };
  }, [saveScrollPosition]);

  // 组件挂载时恢复滚动位置
  useEffect(() => {
    restoreScrollPosition();
  }, [restoreScrollPosition]);

  // 切换对话时恢复滚动位置
  useEffect(() => {
    prevMessagesLengthRef.current = conversation?.messages.length || 0;
    restoreScrollPosition();
  }, [currentConversationId, restoreScrollPosition]);

  // 只在发送新消息时滚动到底部
  useEffect(() => {
    if (!conversation) return;
    const currentLength = conversation.messages.length;
    const prevLength = prevMessagesLengthRef.current;

    // 只有消息数量增加且是用户发送时才滚动
    if (currentLength > prevLength && shouldScrollToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldScrollToBottomRef.current = false;
    }
    prevMessagesLengthRef.current = currentLength;
  }, [conversation?.messages]);

  const handleSend = async () => {
    if (!input.trim() && !attachedImage) return;
    if (isChatLoading || isQueueRunning) return;

    setError(null);
    const messageText = input.trim();
    setInput('');
    const imageToSend = attachedImage;
    setAttachedImage(null);

    // 标记需要滚动到底部
    shouldScrollToBottomRef.current = true;

    // 普通模式
    try {
      await sendChatMessageStream(messageText || (language === 'zh' ? '请描述这张图片' : 'Describe this image'), imageToSend || undefined, (chunk) => {
        setStreamingContent(prev => prev + chunk);
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
      setStreamingContent('');
    } catch (e) {
      setStreamingContent('');
      setError(String(e));
    }
  };

  // AI 智能大纲解析（使用 Grok）
  const parseOutlineByAI = async () => {
    if (!outlineText.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const { apiKey } = useAppStore.getState();
      if (!apiKey) throw new Error('请先设置 API Key');

      const prompt = `请分析以下小说大纲，提取章节列表、角色信息和世界观设定。

要求：
1. 只返回JSON格式，不要其他内容
2. 格式如下：
{
  "chapters": [
    {"title": "第一章：少年觉醒", "order": 1},
    {"title": "第二章：拜师学艺", "order": 2}
  ],
  "characters": [
    {"name": "李明", "description": "少年主角，性格勇敢"},
    {"name": "王老", "description": "隐世高人，李明的师父"}
  ],
  "worldSetting": "修仙世界，剑道为尊..."
}
3. 只提取明确的章节标题，不要提取正文内容
4. 角色只提取有名字的主要角色
5. 世界观提取核心设定即可

大纲内容：
${outlineText}`;

      const resp = await fetch('https://ai.acmestar.top/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'grok-4.2', // 使用 Grok 解析
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
        }),
      });

      if (!resp.ok) throw new Error(`API 错误: ${resp.status}`);
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '';

      // 提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI 返回格式错误');

      const result = JSON.parse(jsonMatch[0]);

      // 限制章节数量
      const MAX_CHAPTERS = 30;
      if (result.chapters && result.chapters.length > MAX_CHAPTERS) {
        result.chapters = result.chapters.slice(0, MAX_CHAPTERS);
        setError(language === 'zh' ? `章节过多，已截取前${MAX_CHAPTERS}章` : `Too many chapters, limited to ${MAX_CHAPTERS}`);
      }

      // 保存解析结果到状态
      setParsedOutline(result);
      setShowOutlineParser(false);
      setShowOutlinePreview(true);
      hapticFeedback('medium');

    } catch (e) {
      setError(language === 'zh' ? `解析失败: ${e instanceof Error ? e.message : '未知错误'}` : `Parse failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 从解析结果生成队列
  const generateQueueFromParsedOutline = () => {
    if (!parsedOutline || !parsedOutline.chapters?.length) return;

    // 清空现有队列和角色
    clearModelQueue();
    useAppStore.setState({ characterMemory: [] });

    // 添加章节到队列
    parsedOutline.chapters.forEach((chapter: { title: string; order: number }) => {
      const instruction = language === 'zh'
        ? `请写${chapter.title}`
        : `Please write ${chapter.title}`;
      addModelToQueue(chatModelId, instruction, chapter.title);
    });

    // 添加角色到记忆库
    if (parsedOutline.characters) {
      parsedOutline.characters.forEach((char: { name: string; description: string }) => {
        addCharacter(char.name, '', char.description);
      });
    }

    // 设置世界观
    if (parsedOutline.worldSetting) {
      setWorldSetting(parsedOutline.worldSetting);
    }

    setShowOutlinePreview(false);
    setParsedOutline(null);
    setOutlineText('');
    hapticFeedback('medium');
  };

  // 合并章节并导出
  const exportNovel = (format: 'txt' | 'md' | 'html') => {
    const completedChapters = modelQueue.filter(item => item.result);

    if (completedChapters.length === 0) {
      setError(language === 'zh' ? '没有已完成的章节可以导出' : 'No completed chapters to export');
      return;
    }

    let content = '';
    const title = conversation?.title || (language === 'zh' ? '未命名小说' : 'Untitled Novel');

    if (format === 'md') {
      content = `# ${title}\n\n`;
      completedChapters.forEach((item, index) => {
        content += `## ${item.title || (language === 'zh' ? `第${index + 1}章` : `Chapter ${index + 1}`)}\n\n`;
        content += `${item.result}\n\n---\n\n`;
      });
    } else if (format === 'html') {
      content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>`;
      content += `<style>body{font-family:serif;max-width:800px;margin:0 auto;padding:20px;line-height:1.8;}`;
      content += `h1{text-align:center;}h2{border-bottom:1px solid #ccc;padding-bottom:10px;}</style></head><body>`;
      content += `<h1>${title}</h1>`;
      completedChapters.forEach((item, index) => {
        content += `<h2>${item.title || (language === 'zh' ? `第${index + 1}章` : `Chapter ${index + 1}`)}</h2>`;
        content += `<div>${item.result?.replace(/\n/g, '<br/>')}</div>`;
      });
      content += `</body></html>`;
    } else {
      content = `${title}\n${'='.repeat(title.length)}\n\n`;
      completedChapters.forEach((item, index) => {
        content += `${item.title || (language === 'zh' ? `第${index + 1}章` : `Chapter ${index + 1}`)}\n`;
        content += `${'-'.repeat(20)}\n\n`;
        content += `${item.result}\n\n`;
      });
    }

    // 下载文件
    const blob = new Blob([content], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 执行模型队列
  const handleExecuteQueue = async () => {
    if (isQueueRunning || modelQueue.length === 0) return;

    try {
      await executeModelQueue((queueId, content, isComplete) => {
        // 实时更新结果
        updateQueueResult(queueId, content);
        // 完成时自动展开该项
        if (isComplete) {
          setExpandedResults(prev => new Set(prev).add(queueId));
        }
      });
    } catch (e) {
      setError(String(e));
    }
  };

  // 重新生成单个项
  const handleRegenerateItem = async (queueId: string) => {
    try {
      const result = await regenerateQueueItem(queueId, (content) => {
        updateQueueResult(queueId, content);
      });
      updateQueueResult(queueId, result);
    } catch (e) {
      updateQueueResult(queueId, `错误: ${e instanceof Error ? e.message : '请求失败'}`);
    }
  };

  // 风格一致性检查
  const checkStyleConsistency = async () => {
    const completedChapters = modelQueue.filter(item => item.result);
    if (completedChapters.length < 2) {
      setError(language === 'zh' ? '至少需要2个已完成的章节才能检查风格一致性' : 'Need at least 2 completed chapters to check style consistency');
      return;
    }

    setIsAnalyzing(true);
    setStyleCheckResult(null);

    try {
      const { apiKey } = useAppStore.getState();
      if (!apiKey) throw new Error('请先设置 API Key');

      const chaptersText = completedChapters.map((item, index) =>
        `【${item.title || `第${index + 1}章`}】\n${item.result}`
      ).join('\n\n---\n\n');

      const prompt = language === 'zh'
        ? `请分析以下章节的写作风格一致性，检查：
1. 叙事风格是否统一（第一人称/第三人称等）
2. 语言风格是否一致（正式/口语化等）
3. 角色性格是否前后一致
4. 用词习惯是否有明显变化
5. 节奏把控是否协调

请给出简洁的分析报告，指出问题和建议：

${chaptersText}`
        : `Please analyze the writing style consistency of the following chapters:
1. Narrative style consistency (first-person/third-person, etc.)
2. Language style consistency (formal/casual, etc.)
3. Character personality consistency
4. Vocabulary usage patterns
5. Pacing coordination

Please provide a concise analysis report with issues and suggestions:

${chaptersText}`;

      const resp = await fetch('https://ai.acmestar.top/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: chatModelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
        }),
      });

      if (!resp.ok) throw new Error(`API 错误: ${resp.status}`);
      const data = await resp.json();
      setStyleCheckResult(data.choices?.[0]?.message?.content || '分析失败');
    } catch (e) {
      setError(String(e));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 智能续写建议
  const getContinuationSuggestion = async () => {
    const completedChapters = modelQueue.filter(item => item.result);
    if (completedChapters.length === 0) {
      setError(language === 'zh' ? '没有已完成的章节，无法生成续写建议' : 'No completed chapters to generate suggestions');
      return;
    }

    setIsAnalyzing(true);
    setContinuationSuggestion(null);

    try {
      const { apiKey } = useAppStore.getState();
      if (!apiKey) throw new Error('请先设置 API Key');

      const previousChapters = completedChapters.slice(-3); // 最近3章作为上下文

      const contextText = previousChapters.map((item, index) =>
        `【${item.title || `第${completedChapters.length - previousChapters.length + index + 1}章`}】\n${item.result?.slice(0, 1000)}...`
      ).join('\n\n');

      const prompt = language === 'zh'
        ? `基于以下已完成的章节内容，请分析剧情走向并提供续写建议：

${contextText}

请提供：
1. 当前剧情发展分析
2. 可能的剧情走向（2-3个方向）
3. 建议的下一章内容大纲
4. 需要注意的伏笔或悬念

请给出简洁有创意的建议：`
        : `Based on the following completed chapters, please analyze the plot direction and provide continuation suggestions:

${contextText}

Please provide:
1. Current plot development analysis
2. Possible plot directions (2-3 options)
3. Suggested outline for the next chapter
4. Foreshadowing or suspense to note

Please give concise and creative suggestions:`;

      const resp = await fetch('https://ai.acmestar.top/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: chatModelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 2000,
        }),
      });

      if (!resp.ok) throw new Error(`API 错误: ${resp.status}`);
      const data = await resp.json();
      setContinuationSuggestion(data.choices?.[0]?.message?.content || '分析失败');
    } catch (e) {
      setError(String(e));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 多版本对比 - 用不同模型生成同一章节的多个版本
  const generateCompareVersions = async (itemId: string) => {
    const item = modelQueue.find(q => q.id === itemId);
    if (!item || !item.instruction.trim()) return;

    setCompareItemId(itemId);
    setCompareResults({});

    try {
      const { apiKey } = useAppStore.getState();
      if (!apiKey) throw new Error('请先设置 API Key');

      // 获取其他模型（排除当前模型）
      const otherModels = CHAT_MODELS.filter(m => m.id !== item.modelId).slice(0, 2); // 取2个其他模型
      if (otherModels.length === 0) {
        setError(language === 'zh' ? '没有其他模型可用于对比' : 'No other models available for comparison');
        setCompareItemId(null);
        return;
      }

      const results: Record<string, string> = {};

      // 并行生成其他模型版本
      const promises = otherModels.map(async (model) => {
        try {
          const resp = await fetch('https://ai.acmestar.top/api/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: model.id,
              messages: [{ role: 'user', content: item.instruction }],
              max_tokens: 4000,
            }),
          });

          if (!resp.ok) throw new Error(`API 错误: ${resp.status}`);
          const data = await resp.json();
          results[model.id] = data.choices?.[0]?.message?.content || '生成失败';
        } catch (e) {
          results[model.id] = `错误: ${e instanceof Error ? e.message : '请求失败'}`;
        }
      });

      await Promise.all(promises);
      setCompareResults(results);
    } catch (e) {
      setError(String(e));
    } finally {
      setCompareItemId(null);
    }
  };

  // 生成分享链接
  const generateShareLink = () => {
    if (modelQueue.length === 0) return;

    const shareData = {
      title: conversation?.title || (language === 'zh' ? '未命名任务' : 'Untitled Task'),
      queue: modelQueue.map(item => ({
        modelId: item.modelId,
        instruction: item.instruction,
        title: item.title,
        result: item.result,
      })),
      worldSetting,
      characters: characterMemory,
      createdAt: Date.now(),
    };

    // 压缩并编码数据
    const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
    const link = `${window.location.origin}${window.location.pathname}?task=${encoded}`;

    setShareLink(link);
    setShowSharePanel(true);
    hapticFeedback('light');
  };

  // 从URL导入任务
  const importTaskFromUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const taskData = params.get('task');

    if (taskData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(taskData)));
        if (decoded.queue && Array.isArray(decoded.queue)) {
          // 清空现有队列
          clearModelQueue();

          // 导入队列
          decoded.queue.forEach((item: any) => {
            addModelToQueue(item.modelId, item.instruction, item.title);
            if (item.result) {
              // 需要等待添加后才能更新结果
              setTimeout(() => {
                const queue = useAppStore.getState().modelQueue;
                const lastItem = queue[queue.length - 1];
                if (lastItem) {
                  useAppStore.getState().updateQueueResult(lastItem.id, item.result);
                }
              }, 100);
            }
          });

          // 导入世界观和角色
          if (decoded.worldSetting) {
            setWorldSetting(decoded.worldSetting);
          }
          if (decoded.characters && Array.isArray(decoded.characters)) {
            decoded.characters.forEach((c: any) => {
              addCharacter(c.name || c.originalName || '', c.replaceWith || '', c.description || '');
            });
          }

          // 清除URL参数
          window.history.replaceState({}, '', window.location.pathname);

          setShowQueuePanel(true);
          hapticFeedback('medium');
        }
      } catch (e) {
        console.error('导入任务失败:', e);
      }
    }
  }, [clearModelQueue, addModelToQueue, setWorldSetting, addCharacter, language]);

  // 页面加载时检查URL
  useEffect(() => {
    importTaskFromUrl();
  }, [importTaskFromUrl]);

  // 滑动浏览队列项
  const handleSwipeStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setSwipeStartX(clientX);
  };

  const handleSwipeEnd = (e: React.TouchEvent | React.MouseEvent, currentIndex: number) => {
    if (swipeStartX === null) return;

    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
    const diff = swipeStartX - clientX;

    // 滑动距离大于50px才触发
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentIndex < modelQueue.length - 1) {
        // 向左滑，展开下一个
        const nextItem = modelQueue[currentIndex + 1];
        setExpandedResults(new Set([nextItem.id]));
      } else if (diff < 0 && currentIndex > 0) {
        // 向右滑，展开上一个
        const prevItem = modelQueue[currentIndex - 1];
        setExpandedResults(new Set([prevItem.id]));
      }
    }

    setSwipeStartX(null);
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleNewChat = () => {
    createConversation();
    setShowSidebar(false);
  };

  const handleCopyMessage = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingContent(content);
  };

  const handleSaveEdit = async () => {
    if (editingMessageId && editingContent.trim()) {
      // 删除原消息
      deleteMessage(editingMessageId);
      setEditingMessageId(null);
      setEditingContent('');
      // 重新发送
      shouldScrollToBottomRef.current = true;
      try {
        await sendChatMessageStream(editingContent.trim());
      } catch (e) {
        setError(String(e));
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleDeleteMessage = (messageId: string) => {
    if (confirm(T('deleteConfirm'))) {
      deleteMessage(messageId);
    }
  };

  const handleStartRename = (conversationId: string, currentTitle: string) => {
    setRenamingConversationId(conversationId);
    setRenamingTitle(currentTitle);
  };

  const handleSaveRename = () => {
    if (renamingConversationId && renamingTitle.trim()) {
      renameConversation(renamingConversationId, renamingTitle.trim());
      setRenamingConversationId(null);
      setRenamingTitle('');
    }
  };

  const handleCancelRename = () => {
    setRenamingConversationId(null);
    setRenamingTitle('');
  };

  if (!conversation) {
    return (
      <div className="chat-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <button className="btn-primary" onClick={handleNewChat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={20} />
            开始新对话
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header - 固定不动 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button className="btn-secondary" onClick={() => setShowSidebar(true)} style={{ padding: 8 }}>
          <MessageSquare size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="model-chip"
            style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            {currentModel?.name || T('selectModel')}
          </button>
          <button
            onClick={() => setShowQueuePanel(!showQueuePanel)}
            style={{
              padding: 6,
              background: modelQueue.length > 0 ? 'var(--accent-dim)' : 'transparent',
              border: modelQueue.length > 0 ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 8,
              color: modelQueue.length > 0 ? 'var(--accent)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            }}
            title={T('modelCompare')}
          >
            <GitCompare size={16} />
            {modelQueue.length > 0 && (
              <span style={{
                position: 'absolute',
                top: -6,
                right: -6,
                background: 'var(--accent)',
                color: 'white',
                fontSize: 10,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {modelQueue.length}
              </span>
            )}
          </button>
        </div>

        {isMessageSelectMode ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => {
                hapticFeedback('light');
                if (selectedMessageIds.size > 0) {
                  const messages = conversation?.messages.filter(m => selectedMessageIds.has(m.id)) || [];
                  const text = messages.map(m => `${m.role === 'user' ? '👤' : '🤖'}: ${m.content}`).join('\n\n');
                  navigator.clipboard.writeText(text);
                  setSelectedMessageIds(new Set());
                  setIsMessageSelectMode(false);
                }
              }}
              disabled={selectedMessageIds.size === 0}
              style={{
                padding: 6,
                background: selectedMessageIds.size > 0 ? 'var(--accent)' : 'var(--bg-tertiary)',
                border: 'none',
                borderRadius: 8,
                color: selectedMessageIds.size > 0 ? 'white' : 'var(--text-muted)',
              }}
            >
              <Copy size={16} />
            </button>
            <button
              onClick={() => {
                hapticFeedback('medium');
                if (selectedMessageIds.size > 0) {
                  selectedMessageIds.forEach(id => deleteMessage(id));
                  setSelectedMessageIds(new Set());
                  setIsMessageSelectMode(false);
                }
              }}
              disabled={selectedMessageIds.size === 0}
              style={{
                padding: 6,
                background: selectedMessageIds.size > 0 ? 'var(--danger)' : 'var(--bg-tertiary)',
                border: 'none',
                borderRadius: 8,
                color: selectedMessageIds.size > 0 ? 'white' : 'var(--text-muted)',
              }}
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => {
                setIsMessageSelectMode(false);
                setSelectedMessageIds(new Set());
              }}
              style={{ padding: 6, color: 'var(--text-muted)', background: 'transparent' }}
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => { setIsMessageSelectMode(true); hapticFeedback('light'); }}
              style={{ padding: 8, color: 'var(--text-muted)', background: 'transparent' }}
            >
              <CheckCircle size={18} />
            </button>
            <button className="btn-secondary" onClick={clearConversation} style={{ padding: 8 }}>
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Model Queue Panel */}
      {showQueuePanel && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 8,
          right: 8,
          background: 'var(--bg-secondary)',
          borderRadius: 16,
          padding: 12,
          zIndex: 100,
          border: '1px solid var(--border)',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
              {language === 'zh' ? '批量创作队列' : 'Batch Creation Queue'}
            </span>
            <button onClick={() => setShowQueuePanel(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: 4 }}>
              <X size={16} />
            </button>
          </div>

          {/* 功能按钮行 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              style={{ padding: '4px 8px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Plus size={12} />
              {language === 'zh' ? '添加模型' : 'Add Model'}
            </button>
            <button
              onClick={() => setShowOutlineParser(!showOutlineParser)}
              style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              📋 {language === 'zh' ? '大纲解析' : 'Outline'}
            </button>
            <button
              onClick={() => setShowCharacterPanel(!showCharacterPanel)}
              style={{ padding: '4px 8px', background: characterMemory.length > 0 ? 'var(--accent-dim)' : 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: characterMemory.length > 0 ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              👤 {language === 'zh' ? '角色' : 'Characters'}
            </button>
            <button
              onClick={() => setShowExportPanel(!showExportPanel)}
              disabled={modelQueue.filter(i => i.result).length === 0}
              style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: modelQueue.filter(i => i.result).length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, opacity: modelQueue.filter(i => i.result).length > 0 ? 1 : 0.5 }}
            >
              📥 {language === 'zh' ? '导出' : 'Export'}
            </button>
            <button
              onClick={() => setShowTaskPanel(!showTaskPanel)}
              style={{ padding: '4px 8px', background: savedTasks.length > 0 ? 'var(--accent-dim)' : 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: savedTasks.length > 0 ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              💾 {language === 'zh' ? '任务' : 'Tasks'}
            </button>
            <button
              onClick={() => setParallelMode(!parallelMode)}
              style={{ padding: '4px 8px', background: parallelMode ? 'var(--accent)' : 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: parallelMode ? 'white' : 'var(--text-secondary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
              title={language === 'zh' ? '并行模式：所有任务同时执行（无上下文关联）' : 'Parallel mode: All tasks run simultaneously (no context sharing)'}
            >
              ⚡ {language === 'zh' ? '并行' : 'Parallel'}
            </button>
            <button
              onClick={generateShareLink}
              disabled={modelQueue.length === 0}
              style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 6, color: modelQueue.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, opacity: modelQueue.length > 0 ? 1 : 0.5 }}
            >
              🔗 {language === 'zh' ? '分享' : 'Share'}
            </button>
          </div>

          {/* 大纲解析器 */}
          {showOutlineParser && (
            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                {language === 'zh' ? '粘贴大纲，AI将智能解析章节、角色和世界观' : 'Paste outline, AI will parse chapters, characters and world setting'}
              </div>
              <textarea
                value={outlineText}
                onChange={(e) => setOutlineText(e.target.value)}
                placeholder={language === 'zh' ? '粘贴小说大纲内容...\n\nAI会自动识别：\n- 章节结构\n- 角色信息\n- 世界观设定' : 'Paste novel outline...\n\nAI will detect:\n- Chapter structure\n- Characters\n- World setting'}
                style={{
                  width: '100%',
                  minHeight: 100,
                  maxHeight: 200,
                  padding: 8,
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => { setOutlineText(''); setShowOutlineParser(false); }}
                  style={{ flex: 1, padding: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11 }}
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={parseOutlineByAI}
                  disabled={!outlineText.trim() || isAnalyzing}
                  className="btn-primary"
                  style={{ flex: 1, padding: 6, fontSize: 11, opacity: outlineText.trim() && !isAnalyzing ? 1 : 0.5 }}
                >
                  {isAnalyzing ? (language === 'zh' ? '解析中...' : 'Parsing...') : (language === 'zh' ? 'AI解析' : 'AI Parse')}
                </button>
              </div>
            </div>
          )}

          {/* 大纲预览 */}
          {showOutlinePreview && parsedOutline && (
            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                  📋 {language === 'zh' ? '解析结果' : 'Parse Result'}
                </span>
                <button onClick={() => { setShowOutlinePreview(false); setParsedOutline(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: 2 }}>
                  <X size={14} />
                </button>
              </div>

              {/* 章节列表 */}
              {parsedOutline.chapters && parsedOutline.chapters.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>
                    📖 {language === 'zh' ? `检测到 ${parsedOutline.chapters.length} 个章节` : `Detected ${parsedOutline.chapters.length} chapters`}
                  </div>
                  <div style={{ maxHeight: 100, overflow: 'auto', background: 'var(--bg-secondary)', borderRadius: 4, padding: 4 }}>
                    {parsedOutline.chapters.map((chapter, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}>
                        <input
                          type="checkbox"
                          checked={selectedChapters.has(index)}
                          onChange={() => {
                            const newSet = new Set(selectedChapters);
                            if (newSet.has(index)) newSet.delete(index);
                            else newSet.add(index);
                            setSelectedChapters(newSet);
                          }}
                          style={{ width: 12, height: 12 }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{chapter.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 角色列表 */}
              {parsedOutline.characters && parsedOutline.characters.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>
                    👤 {language === 'zh' ? `检测到 ${parsedOutline.characters.length} 个角色` : `Detected ${parsedOutline.characters.length} characters`}
                  </div>
                  <div style={{ maxHeight: 80, overflow: 'auto' }}>
                    {parsedOutline.characters.map((char, index) => (
                      <div key={index} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 50 }}>{char.name}</span>
                        <span style={{ fontSize: 9 }}>→</span>
                        <input
                          placeholder={language === 'zh' ? '替换名(可选)' : 'Replace with'}
                          value={parsedOutline.characters[index].replaceWith || ''}
                          onChange={(e) => {
                            const newOutline = { ...parsedOutline };
                            newOutline.characters[index].replaceWith = e.target.value;
                            setParsedOutline(newOutline);
                          }}
                          style={{ flex: 1, padding: 2, fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 世界观 */}
              {parsedOutline.worldSetting && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>
                    🌍 {language === 'zh' ? '世界观设定' : 'World Setting'}
                  </div>
                  <textarea
                    value={parsedOutline.worldSetting}
                    onChange={(e) => setParsedOutline({ ...parsedOutline, worldSetting: e.target.value })}
                    style={{
                      width: '100%',
                      minHeight: 40,
                      maxHeight: 80,
                      padding: 4,
                      fontSize: 10,
                      borderRadius: 4,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      resize: 'vertical',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setShowOutlinePreview(false); setParsedOutline(null); setSelectedChapters(new Set()); }}
                  style={{ flex: 1, padding: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11 }}
                >
                  {language === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button
                  onClick={generateQueueFromParsedOutline}
                  className="btn-primary"
                  style={{ flex: 1, padding: 6, fontSize: 11 }}
                >
                  {language === 'zh' ? `生成队列 (${selectedChapters.size || parsedOutline.chapters?.length || 0}章)` : `Generate (${selectedChapters.size || parsedOutline.chapters?.length || 0} chapters)`}
                </button>
              </div>
            </div>
          )}

          {/* 角色设定面板 */}
          {showCharacterPanel && (
            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                {language === 'zh' ? '角色/设定记忆库' : 'Character/Setting Memory'}
              </div>
              {/* 世界观设定 */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {language === 'zh' ? '世界观设定' : 'World Setting'}
                </div>
                <textarea
                  value={worldSetting}
                  onChange={(e) => setWorldSetting(e.target.value)}
                  placeholder={language === 'zh' ? '描述故事的世界观、时代背景等' : 'Describe the world, era, etc.'}
                  style={{
                    width: '100%',
                    minHeight: 40,
                    maxHeight: 80,
                    padding: 6,
                    fontSize: 11,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    resize: 'vertical',
                  }}
                />
              </div>
              {/* 角色列表 */}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                {language === 'zh' ? '角色映射 (原人名 → 替换为)' : 'Character Mapping (Original → Replace with)'}
              </div>
              {characterMemory.map((char) => (
                <div key={char.id} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                  <input
                    value={char.originalName}
                    onChange={(e) => updateCharacter(char.id, e.target.value, char.replaceWith, char.description)}
                    placeholder={language === 'zh' ? '原人名' : 'Original'}
                    style={{ flex: 1, padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <input
                    value={char.replaceWith}
                    onChange={(e) => updateCharacter(char.id, char.originalName, e.target.value, char.description)}
                    placeholder={language === 'zh' ? '替换名' : 'Replace'}
                    style={{ flex: 1, padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                  <input
                    value={char.description}
                    onChange={(e) => updateCharacter(char.id, char.originalName, char.replaceWith, e.target.value)}
                    placeholder={language === 'zh' ? '描述' : 'Desc'}
                    style={{ flex: 1.5, padding: 4, fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  />
                  <button onClick={() => deleteCharacter(char.id)} style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--danger)' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addCharacter('', '', '')}
                style={{ width: '100%', padding: 6, background: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11 }}
              >
                + {language === 'zh' ? '添加角色映射' : 'Add Character Mapping'}
              </button>
            </div>
          )}

          {/* 导出面板 */}
          {showExportPanel && (
            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                {language === 'zh' ? '导出小说' : 'Export Novel'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => exportNovel('txt')} style={{ flex: 1, padding: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11 }}>
                  📄 TXT
                </button>
                <button onClick={() => exportNovel('md')} style={{ flex: 1, padding: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11 }}>
                  📝 Markdown
                </button>
                <button onClick={() => exportNovel('html')} style={{ flex: 1, padding: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11 }}>
                  🌐 HTML
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'center' }}>
                {language === 'zh' ? `已完成 ${modelQueue.filter(i => i.result).length}/${modelQueue.length} 章` : `${modelQueue.filter(i => i.result).length}/${modelQueue.length} chapters completed`}
              </div>
            </div>
          )}

          {/* 任务面板 */}
          {showTaskPanel && (
            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {language === 'zh' ? '保存的任务' : 'Saved Tasks'}
                </span>
                <button
                  onClick={() => { saveTask(conversation?.title || (language === 'zh' ? '未命名任务' : 'Untitled Task')); hapticFeedback('light'); }}
                  disabled={modelQueue.length === 0}
                  style={{ padding: '4px 8px', background: modelQueue.length > 0 ? 'var(--accent)' : 'var(--bg-secondary)', border: 'none', borderRadius: 4, color: modelQueue.length > 0 ? 'white' : 'var(--text-muted)', fontSize: 10 }}
                >
                  {language === 'zh' ? '保存当前' : 'Save Current'}
                </button>
              </div>
              {savedTasks.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 10 }}>
                  {language === 'zh' ? '暂无保存的任务' : 'No saved tasks'}
                </div>
              ) : (
                savedTasks.map((task) => (
                  <div key={task.id} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center', padding: 6, background: 'var(--bg-secondary)', borderRadius: 6 }}>
                    <span style={{ flex: 1, fontSize: 11, color: 'var(--text-primary)' }}>{task.name} ({task.queue.length}项)</span>
                    <button onClick={() => { loadTask(task.id); setShowTaskPanel(false); hapticFeedback('light'); }} style={{ padding: 4, background: 'var(--accent)', border: 'none', borderRadius: 4, color: 'white', fontSize: 10 }}>
                      {language === 'zh' ? '加载' : 'Load'}
                    </button>
                    <button onClick={() => deleteTask(task.id)} style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--danger)' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 分享面板 */}
          {showSharePanel && (
            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                  🔗 {language === 'zh' ? '分享任务' : 'Share Task'}
                </span>
                <button onClick={() => setShowSharePanel(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: 2 }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                {language === 'zh' ? '复制链接分享给他人，对方打开即可导入任务' : 'Copy the link to share. Others can import by opening the link.'}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={shareLink}
                  readOnly
                  style={{ flex: 1, padding: 6, fontSize: 10, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareLink);
                    hapticFeedback('light');
                  }}
                  style={{ padding: '6px 10px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: 'white', fontSize: 10 }}
                >
                  {language === 'zh' ? '复制' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* AI 分析工具 */}
          {modelQueue.filter(i => i.result).length >= 1 && (
            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>
                🤖 {language === 'zh' ? 'AI 分析工具' : 'AI Analysis Tools'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={checkStyleConsistency}
                  disabled={isAnalyzing || modelQueue.filter(i => i.result).length < 2}
                  style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11, opacity: modelQueue.filter(i => i.result).length >= 2 ? 1 : 0.5 }}
                >
                  📊 {language === 'zh' ? '风格检查' : 'Style Check'}
                </button>
                <button
                  onClick={getContinuationSuggestion}
                  disabled={isAnalyzing}
                  style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11 }}
                >
                  💡 {language === 'zh' ? '续写建议' : 'Suggestion'}
                </button>
              </div>
              {/* 分析结果 */}
              {isAnalyzing && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                  <div style={{ width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  {language === 'zh' ? 'AI 分析中...' : 'AI analyzing...'}
                </div>
              )}
              {styleCheckResult && (
                <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>📊 {language === 'zh' ? '风格一致性分析' : 'Style Consistency Analysis'}</span>
                    <button onClick={() => setStyleCheckResult(null)} style={{ padding: 2, background: 'transparent', border: 'none', color: 'var(--text-muted)' }}><X size={12} /></button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{styleCheckResult}</div>
                </div>
              )}
              {continuationSuggestion && (
                <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-secondary)', borderRadius: 6, maxHeight: 200, overflow: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>💡 {language === 'zh' ? '续写建议' : 'Continuation Suggestion'}</span>
                    <button onClick={() => setContinuationSuggestion(null)} style={{ padding: 2, background: 'transparent', border: 'none', color: 'var(--text-muted)' }}><X size={12} /></button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{continuationSuggestion}</div>
                </div>
              )}
            </div>
          )}

          {/* 模型选择器 */}
          {showModelSelector && (
            <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                {language === 'zh' ? '点击添加模型到队列（可重复添加）' : 'Click to add models (can add duplicates)'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CHAT_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      hapticFeedback('light');
                      addModelToQueue(m.id);
                    }}
                    style={{
                      padding: '6px 10px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Plus size={12} />
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 队列列表 */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {modelQueue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                {language === 'zh' ? '点击 + 添加模型到队列' : 'Click + to add models to queue'}
              </div>
            ) : (
              <>
                {/* 滑动提示 */}
                {modelQueue.length > 1 && (
                  <div style={{ textAlign: 'center', padding: '4px', color: 'var(--text-muted)', fontSize: 10 }}>
                    ← {language === 'zh' ? '左右滑动切换' : 'Swipe to navigate'} →
                  </div>
                )}
                {modelQueue.map((item, index) => {
                  const model = CHAT_MODELS.find(m => m.id === item.modelId);
                  const isExpanded = expandedResults.has(item.id);
                  const isRunning = isQueueRunning && currentQueueIndex === index;
                  const isCompleted = item.result !== undefined;

                  return (
                    <div
                      key={item.id}
                      onTouchStart={(e) => handleSwipeStart(e)}
                      onTouchEnd={(e) => handleSwipeEnd(e, index)}
                      onMouseDown={(e) => handleSwipeStart(e)}
                      onMouseUp={(e) => handleSwipeEnd(e, index)}
                      style={{
                        background: isRunning ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                        borderRadius: 8,
                        border: isRunning ? '1px solid var(--accent)' : '1px solid var(--border)',
                        overflow: 'hidden',
                        touchAction: 'pan-y',
                      }}
                    >
                    {/* 标题栏 - 点击展开/收起 */}
                    <div
                      onClick={() => {
                        const newSet = new Set(expandedResults);
                        if (newSet.has(item.id)) newSet.delete(item.id);
                        else newSet.add(item.id);
                        setExpandedResults(newSet);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 8px',
                        background: 'var(--bg-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        background: isCompleted ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: isCompleted ? 'white' : 'var(--text-muted)',
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 5px',
                        borderRadius: 4,
                        minWidth: 18,
                        textAlign: 'center',
                      }}>
                        {index + 1}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title || model?.name}
                      </span>
                      {isRunning && (
                        <div style={{ width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      )}
                      {isCompleted && !isRunning && (
                        <span style={{ color: 'var(--accent)', fontSize: 10 }}>✓</span>
                      )}
                      <span style={{ color: 'var(--text-muted)' }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </div>

                    {/* 展开内容：输入框 + 结果 */}
                    {isExpanded && (
                      <div style={{ padding: 6 }}>
                        {/* 模型名称和操作按钮 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{model?.name}</span>
                          <div style={{ flex: 1 }} />
                          {isCompleted && !isRunning && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRegenerateItem(item.id); }}
                              style={{ padding: 2, background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                              title={language === 'zh' ? '重新生成' : 'Regenerate'}
                            >
                              <RefreshCw size={12} />
                            </button>
                          )}
                          {isCompleted && CHAT_MODELS.length > 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); generateCompareVersions(item.id); }}
                              disabled={compareItemId === item.id}
                              style={{ padding: 2, background: 'transparent', border: 'none', color: compareItemId === item.id ? 'var(--accent)' : 'var(--text-muted)' }}
                              title={language === 'zh' ? '多模型对比' : 'Compare'}
                            >
                              <GitCompare size={12} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeModelFromQueue(item.id); }}
                            style={{ padding: 2, background: 'transparent', border: 'none', color: 'var(--danger)' }}
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* 指令输入 */}
                        <textarea
                          value={item.instruction}
                          onChange={(e) => updateQueueInstruction(item.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={language === 'zh' ? '输入指令...' : 'Enter instruction...'}
                          style={{
                            width: '100%',
                            minHeight: 32,
                            maxHeight: 60,
                            padding: '4px 6px',
                            fontSize: 11,
                            borderRadius: 4,
                            border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            resize: 'vertical',
                          }}
                        />

                        {/* 结果显示 */}
                        {item.result && (
                          <div style={{ marginTop: 4, padding: 4, background: 'var(--bg-secondary)', borderRadius: 4, maxHeight: 150, overflow: 'auto' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                              <ReactMarkdown>{item.result}</ReactMarkdown>
                            </div>
                          </div>
                        )}

                        {/* 多版本对比结果 */}
                        {compareItemId === item.id && (
                          <div style={{ marginTop: 4 }}>
                            {Object.keys(compareResults).length === 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 11 }}>
                                <div style={{ width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                {language === 'zh' ? '生成对比中...' : 'Comparing...'}
                              </div>
                            ) : (
                              <div style={{ padding: 4, background: 'var(--bg-secondary)', borderRadius: 4 }}>
                                <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--accent)', marginBottom: 4 }}>
                                  🔄 {language === 'zh' ? '对比结果' : 'Comparison'}
                                </div>
                                {Object.entries(compareResults).map(([modelId, result]) => {
                                  const m = CHAT_MODELS.find(mdl => mdl.id === modelId);
                                  return (
                                    <div key={modelId} style={{ marginBottom: 4, padding: 4, background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                                      <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)' }}>{m?.name}</div>
                                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', maxHeight: 60, overflow: 'auto' }}>
                                        {result.slice(0, 300)}...
                                      </div>
                                    </div>
                                  );
                                })}
                                <button
                                  onClick={(e) => { e.stopPropagation(); setCompareItemId(null); setCompareResults({}); }}
                                  style={{ width: '100%', padding: 2, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}
                                >
                                  {language === 'zh' ? '关闭' : 'Close'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
          </div>

          {/* 底部操作栏 */}
          {modelQueue.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <button
                onClick={clearModelQueue}
                className="btn-secondary"
                style={{ flex: 1, padding: '8px', fontSize: 12 }}
              >
                <Trash2 size={14} style={{ marginRight: 4 }} />
                {language === 'zh' ? '清空' : 'Clear'}
              </button>
              <button
                onClick={handleExecuteQueue}
                disabled={isQueueRunning || modelQueue.every(item => !item.instruction.trim())}
                className="btn-primary"
                style={{ flex: 2, padding: '8px', fontSize: 12 }}
              >
                {isQueueRunning ? (
                  <>
                    <div style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 6 }} />
                    {language === 'zh' ? `执行中 (${currentQueueIndex + 1}/${modelQueue.length})` : `Running (${currentQueueIndex + 1}/${modelQueue.length})`}
                  </>
                ) : (
                  <>
                    <Play size={14} style={{ marginRight: 4 }} />
                    {language === 'zh' ? '开始执行' : 'Start Execution'}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Model Picker */}
      {showModelPicker && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 16,
          right: 16,
          background: 'var(--bg-tertiary)',
          borderRadius: 16,
          padding: 12,
          zIndex: 100,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{T('selectModel')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CHAT_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { setChatModelId(m.id); setShowModelPicker(false); }}
                style={{
                  padding: '10px 12px',
                  background: chatModelId === m.id ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  border: '1px solid ' + (chatModelId === m.id ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 10,
                  color: chatModelId === m.id ? 'var(--accent)' : 'var(--text-secondary)',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{m.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {m.maxTokens >= 100000 ? T('longContext') : `${Math.round(m.maxTokens / 1000)}K`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-primary)' }}>
        {conversation.messages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 80, padding: 40 }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <MessageSquare size={36} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            </div>
            <p style={{ marginBottom: 12, fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>开始新对话</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              输入消息开始与 AI 交流<br />
              支持超长上下文，可发送图片
            </p>
          </div>
        )}

        {conversation.messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
            <div
              className={`message ${msg.role}`}
              onClick={() => {
                if (isMessageSelectMode) {
                  hapticFeedback('light');
                  const newSet = new Set(selectedMessageIds);
                  if (newSet.has(msg.id)) {
                    newSet.delete(msg.id);
                  } else {
                    newSet.add(msg.id);
                  }
                  setSelectedMessageIds(newSet);
                } else if (elderMode) {
                  speakText(msg.content, language);
                }
              }}
              style={{
                ...(elderMode || isMessageSelectMode ? { cursor: 'pointer' } : {}),
                ...(isMessageSelectMode && selectedMessageIds.has(msg.id) ? { border: '2px solid var(--accent)', boxShadow: '0 0 0 2px var(--accent-dim)' } : {}),
              }}
            >
              {isMessageSelectMode && (
                <div style={{ position: 'absolute', top: -10, left: -10 }}>
                  {selectedMessageIds.has(msg.id) ? (
                    <CheckCircle size={20} color="var(--accent)" />
                  ) : (
                    <Circle size={20} color="var(--text-muted)" />
                  )}
                </div>
              )}
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 8 }} />
              )}
              {editingMessageId === msg.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={handleCancelEdit} className="btn-secondary" style={{ padding: '6px 16px', fontSize: 13 }}>取消</button>
                    <button onClick={handleSaveEdit} className="btn-primary" style={{ padding: '6px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Send size={14} /> 发送
                    </button>
                  </div>
                </div>
              ) : msg.role === 'assistant' ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
            {/* 消息操作按钮 */}
            {!isMessageSelectMode && !editingMessageId && (
              <div style={{ display: 'flex', gap: 4, opacity: 0.6 }}>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleCopyMessage(msg.id, msg.content)}
                    style={{ padding: 4, background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    {copiedMessageId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedMessageId === msg.id ? T('copied') : T('copy')}
                  </button>
                )}
                {msg.role === 'user' && (
                  <button
                    onClick={() => handleStartEdit(msg.id, msg.content)}
                    style={{ padding: 4, background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                  >
                    <Edit2 size={12} /> {T('edit')}
                  </button>
                )}
                <button
                  onClick={() => handleDeleteMessage(msg.id)}
                  style={{ padding: 4, background: 'transparent', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}
                >
                  <Trash2 size={12} /> {T('delete')}
                </button>
              </div>
            )}
          </div>
        ))}

        {isChatLoading && streamingContent && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="message assistant">
              <ReactMarkdown>{streamingContent}</ReactMarkdown>
            </div>
          </div>
        )}

        {isChatLoading && !streamingContent && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="message assistant" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                <div className="skeleton" style={{ height: 14, width: '100%', borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 4 }} />
                <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, color: 'var(--danger)', fontSize: 14 }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input - 固定在底部 */}
      <div style={{ padding: 12, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        {attachedImage && !isVoiceMode && (
          <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
            <img src={attachedImage} alt="" style={{ height: 60, borderRadius: 12 }} />
            <button
              onClick={() => setAttachedImage(null)}
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--danger)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {isVoiceMode ? (
          /* 语音输入模式 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 语音识别结果显示区 */}
            <div
              style={{
                minHeight: 80,
                padding: 16,
                background: 'var(--bg-tertiary)',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: voiceText ? 16 : 14,
                color: voiceText ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {isRecording ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="voice-wave-container">
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                  </div>
                  <span>{voiceText || (language === 'zh' ? '正在聆听...' : 'Listening...')}</span>
                </div>
              ) : (
                voiceText || (language === 'zh' ? '长按下方按钮开始录音' : 'Long press the button below to start recording')
              )}
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={exitVoiceMode}
                style={{
                  padding: '12px 24px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                }}
              >
                {T('cancel')}
              </button>

              {/* 长按录音按钮 */}
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  isPressingRef.current = true;
                  startRecording();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  if (isPressingRef.current) {
                    isPressingRef.current = false;
                    stopRecording();
                  }
                }}
                onTouchCancel={() => {
                  if (isPressingRef.current) {
                    isPressingRef.current = false;
                    stopRecording();
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  isPressingRef.current = true;
                  startRecording();
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  if (isPressingRef.current) {
                    isPressingRef.current = false;
                    stopRecording();
                  }
                }}
                onMouseLeave={() => {
                  if (isPressingRef.current) {
                    isPressingRef.current = false;
                    stopRecording();
                  }
                }}
                style={{
                  flex: 1,
                  padding: 14,
                  background: isRecording ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: isRecording ? 'none' : '1px solid var(--border)',
                  borderRadius: 12,
                  color: isRecording ? 'white' : 'var(--text-primary)',
                  fontSize: 15,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'manipulation',
                }}
              >
                <Mic size={20} />
                {isRecording ? (language === 'zh' ? '松开结束' : 'Release to stop') : (language === 'zh' ? '按住说话' : 'Hold to speak')}
              </button>

              <button
                onClick={confirmVoiceText}
                disabled={!voiceText.trim()}
                style={{
                  padding: '12px 24px',
                  background: voiceText.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: 'none',
                  borderRadius: 12,
                  color: voiceText.trim() ? 'white' : 'var(--text-muted)',
                  fontSize: 14,
                }}
              >
                {language === 'zh' ? '确认' : 'Confirm'}
              </button>
            </div>
          </div>
        ) : (
          /* 普通输入模式 */
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImagePick}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: 12,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ImageIcon size={20} />
            </button>

            {/* 语音输入按钮 - 点击进入语音模式 */}
            <button
              onClick={enterVoiceMode}
              style={{
                padding: 12,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mic size={20} />
            </button>

            {/* 快捷短语按钮 */}
            <button
              onClick={() => {
                hapticFeedback('light');
                setShowQuickPhrases(!showQuickPhrases);
              }}
              style={{
                padding: 12,
                background: showQuickPhrases ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                border: showQuickPhrases ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 12,
                color: showQuickPhrases ? 'var(--accent)' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={20} />
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={T('inputMessage')}
              rows={1}
              style={{
                flex: 1,
                borderRadius: 20,
                resize: 'none',
                minHeight: 44,
                maxHeight: 120,
                padding: '12px 16px',
                lineHeight: 1.4,
                overflowY: 'auto',
              }}
            />

            {isChatLoading ? (
              <button
                onClick={cancelChatRequest}
                style={{
                  padding: 12,
                  background: 'var(--danger)',
                  border: 'none',
                  borderRadius: 12,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StopCircle size={20} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim() && !attachedImage}
                className="btn-primary"
                style={{ padding: 12, borderRadius: 12 }}
              >
                <Send size={20} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 快捷短语弹窗 */}
      {showQuickPhrases && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: 16,
            right: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 16,
            padding: 16,
            boxShadow: 'var(--card-shadow)',
            zIndex: 100,
            border: '1px solid var(--border)',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
              {T('quickPhrases')}
            </span>
            <button
              onClick={() => setShowQuickPhrases(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {QUICK_PHRASES[language as Language].map((phrase) => (
              <button
                key={phrase.key}
                onClick={() => {
                  hapticFeedback('light');
                  setInput(phrase.text);
                  setShowQuickPhrases(false);
                  // 聚焦输入框并将光标移到最后
                  setTimeout(() => {
                    const textarea = inputRef.current;
                    if (textarea) {
                      textarea.focus();
                      textarea.setSelectionRange(phrase.text.length, phrase.text.length);
                    }
                  }, 0);
                }}
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                }}
              >
                {T(phrase.key)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sidebar */}
      {showSidebar && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--bg-primary)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <button onClick={() => {
              if (isBatchMode) {
                setIsBatchMode(false);
                setSelectedConvIds(new Set());
              } else {
                setShowSidebar(false);
              }
            }} className="btn-secondary" style={{ padding: 8 }}>
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontWeight: 500 }}>{isBatchMode ? T('batchDelete') : '对话历史'}</span>
            {isBatchMode ? (
              <button
                onClick={() => {
                  hapticFeedback('medium');
                  if (selectedConvIds.size > 0) {
                    selectedConvIds.forEach(id => deleteConversation(id));
                    setSelectedConvIds(new Set());
                    setIsBatchMode(false);
                  }
                }}
                disabled={selectedConvIds.size === 0}
                style={{
                  padding: '6px 12px',
                  background: selectedConvIds.size > 0 ? 'var(--danger)' : 'var(--bg-tertiary)',
                  border: 'none',
                  borderRadius: 8,
                  color: selectedConvIds.size > 0 ? 'white' : 'var(--text-muted)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {language === 'zh' ? `删除 ${selectedConvIds.size} 项` : `Delete ${selectedConvIds.size}`}
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => { setIsBatchMode(true); hapticFeedback('light'); }} style={{ padding: 8, color: 'var(--text-muted)', background: 'transparent' }}>
                  <CheckCircle size={18} />
                </button>
                <button onClick={handleNewChat} className="btn-secondary" style={{ padding: 8 }}>
                  <Plus size={20} />
                </button>
              </div>
            )}
          </div>

          {/* 搜索框 */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={T('searchConversation')}
                style={{ paddingLeft: 36, borderRadius: 10 }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {conversations
              .filter((conv) => !searchQuery || conv.title.toLowerCase().includes(searchQuery.toLowerCase()) || conv.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())))
              .map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  if (isBatchMode) {
                    hapticFeedback('light');
                    const newSet = new Set(selectedConvIds);
                    if (newSet.has(conv.id)) {
                      newSet.delete(conv.id);
                    } else {
                      newSet.add(conv.id);
                    }
                    setSelectedConvIds(newSet);
                  } else if (renamingConversationId !== conv.id) {
                    useAppStore.setState({ currentConversationId: conv.id });
                    setShowSidebar(false);
                  }
                }}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  marginBottom: 4,
                  background: isBatchMode
                    ? (selectedConvIds.has(conv.id) ? 'var(--accent-dim)' : 'transparent')
                    : (conv.id === currentConversationId ? 'var(--bg-tertiary)' : 'transparent'),
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: isBatchMode && selectedConvIds.has(conv.id) ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                {isBatchMode && (
                  <div style={{ marginRight: 12 }}>
                    {selectedConvIds.has(conv.id) ? (
                      <CheckCircle size={22} color="var(--accent)" />
                    ) : (
                      <Circle size={22} color="var(--text-muted)" />
                    )}
                  </div>
                )}
                <div style={{ flex: 1, marginRight: 8 }}>
                  {renamingConversationId === conv.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        value={renamingTitle}
                        onChange={(e) => setRenamingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename();
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                        style={{ flex: 1, padding: '8px 12px', fontSize: 14 }}
                        autoFocus
                      />
                      <button onClick={handleSaveRename} className="btn-primary" style={{ padding: '4px 8px' }}>
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 15, marginBottom: 2 }}>{conv.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {conv.messages.length} 条消息
                      </div>
                    </>
                  )}
                </div>
                {!isBatchMode && renamingConversationId !== conv.id && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticFeedback('light');
                        shareConversation(conv.title, conv.messages);
                      }}
                      style={{ padding: 8, color: 'var(--text-muted)', background: 'transparent' }}
                    >
                      <Share2 size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); hapticFeedback('light'); pinConversation(conv.id, !conv.pinned); }}
                      style={{ padding: 8, color: conv.pinned ? 'var(--accent)' : 'var(--text-muted)', background: 'transparent' }}
                    >
                      {conv.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); hapticFeedback('light'); handleStartRename(conv.id, conv.title); }}
                      style={{ padding: 8, color: 'var(--text-muted)', background: 'transparent' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); hapticFeedback('medium'); deleteConversation(conv.id); }}
                      style={{ padding: 8, color: 'var(--text-muted)', background: 'transparent' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {conversations.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                暂无对话
              </div>
            )}
          </div>

          {/* 导出按钮 */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => {
                const data = exportData();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ai-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-secondary"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Download size={18} /> 导出数据
            </button>
          </div>
        </div>
      )}
    </div>
  );
}