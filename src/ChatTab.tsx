import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Trash2, Plus, ChevronLeft, Image as ImageIcon, X, Copy, Edit2, Check, Pencil, Search, StopCircle, Pin, PinOff, Download, Mic, Share2, Zap, CheckCircle, Circle, GitCompare } from 'lucide-react';
import { useAppStore, CHAT_MODELS } from './store';
import { sendChatMessageStream, cancelChatRequest, compareChatModels } from './api';
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
    compareMode,
    setCompareMode,
    compareModelIds,
    setCompareModelIds,
    compareResults,
    setCompareResults,
    isCompareLoading,
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
  const [showComparePicker, setShowComparePicker] = useState(false); // 模型对比选择器
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

  // 恢复草稿
  useEffect(() => {
    if (conversation?.draft) {
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
    if (isChatLoading || isCompareLoading) return;

    setError(null);
    const messageText = input.trim();
    setInput('');
    const imageToSend = attachedImage;
    setAttachedImage(null);

    // 标记需要滚动到底部
    shouldScrollToBottomRef.current = true;

    // 对比模式
    if (compareMode && compareModelIds.length >= 2) {
      const { apiKey, addMessage } = useAppStore.getState();
      if (!apiKey) {
        setError(language === 'zh' ? '请先设置 API 密钥' : 'Please set API key first');
        return;
      }

      const finalMessage = messageText || (language === 'zh' ? '请描述这张图片' : 'Describe this image');

      // 添加用户消息
      addMessage(finalMessage, 'user', imageToSend || undefined);

      // 如果有图片，需要将图片包含在消息中
      let messageContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = finalMessage;
      if (imageToSend) {
        messageContent = [{ type: 'text', text: finalMessage }, { type: 'image_url', image_url: { url: imageToSend } }];
      }

      try {
        const results = await compareChatModels(
          messageContent,
          compareModelIds,
          (modelId, content) => {
            // 实时更新进度
            const { compareResults: currentResults } = useAppStore.getState();
            useAppStore.getState().setCompareResults({ ...currentResults, [modelId]: content });
          }
        );
        setCompareResults(results);
      } catch (e) {
        setError(String(e));
      }
      return;
    }

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
            onClick={() => setShowComparePicker(true)}
            style={{
              padding: 6,
              background: compareMode ? 'var(--accent-dim)' : 'transparent',
              border: compareMode ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 8,
              color: compareMode ? 'var(--accent)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
            title={T('modelCompare')}
          >
            <GitCompare size={16} />
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

      {/* Model Compare Picker */}
      {showComparePicker && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 16,
          right: 16,
          background: 'var(--bg-tertiary)',
          borderRadius: 16,
          padding: 16,
          zIndex: 100,
          border: '1px solid var(--border)',
          maxHeight: '70vh',
          overflow: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
              {T('selectModelsToCompare')}
            </span>
            <button onClick={() => setShowComparePicker(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: 4 }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            {language === 'zh' ? '选择 2-3 个模型进行对比' : 'Select 2-3 models to compare'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CHAT_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  const newIds = [...compareModelIds];
                  const idx = newIds.indexOf(m.id);
                  if (idx >= 0) {
                    newIds.splice(idx, 1);
                  } else if (newIds.length < 3) {
                    newIds.push(m.id);
                  }
                  setCompareModelIds(newIds);
                }}
                style={{
                  padding: '10px 12px',
                  background: compareModelIds.includes(m.id) ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  border: '1px solid ' + (compareModelIds.includes(m.id) ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 10,
                  color: compareModelIds.includes(m.id) ? 'var(--accent)' : 'var(--text-secondary)',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{m.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {m.maxTokens >= 100000 ? T('longContext') : `${Math.round(m.maxTokens / 1000)}K`}
                  </span>
                  {compareModelIds.includes(m.id) && <Check size={14} color="var(--accent)" />}
                </div>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => setCompareModelIds([])}
              className="btn-secondary"
              style={{ flex: 1, padding: '10px' }}
            >
              {T('cancel')}
            </button>
            <button
              onClick={() => {
                if (compareModelIds.length >= 2) {
                  setCompareMode(true);
                  setShowComparePicker(false);
                }
              }}
              disabled={compareModelIds.length < 2}
              className="btn-primary"
              style={{ flex: 1, padding: '10px', opacity: compareModelIds.length < 2 ? 0.5 : 1 }}
            >
              {language === 'zh' ? '开始对比' : 'Start Compare'}
            </button>
          </div>
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

        {/* 模型对比结果 */}
        {compareMode && Object.keys(compareResults).length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                {T('compareResults')}
              </span>
              <button
                onClick={() => {
                  setCompareMode(false);
                  setCompareResults({});
                  setCompareModelIds([]);
                }}
                style={{ padding: '4px 12px', background: 'var(--bg-tertiary)', border: 'none', borderRadius: 8, color: 'var(--text-muted)', fontSize: 12 }}
              >
                {T('cancel')}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {compareModelIds.map((modelId) => {
                const model = CHAT_MODELS.find(m => m.id === modelId);
                const result = compareResults[modelId];
                return (
                  <div key={modelId} style={{ background: 'var(--bg-secondary)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--accent)' }}>{model?.name}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(result || '');
                        }}
                        style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <div style={{ padding: 12, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                      {result ? (
                        <ReactMarkdown>{result}</ReactMarkdown>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div className="skeleton" style={{ height: 14, width: '100%', borderRadius: 4 }} />
                          <div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 4 }} />
                          <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 对比模式加载中 */}
        {isCompareLoading && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="loading-spinner" style={{ width: 16, height: 16, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              {T('comparing')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {compareModelIds.map((modelId) => {
                const model = CHAT_MODELS.find(m => m.id === modelId);
                return (
                  <div key={modelId} style={{ background: 'var(--bg-secondary)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 500, fontSize: 13, color: 'var(--accent)' }}>{model?.name}</span>
                    </div>
                    <div style={{ padding: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div className="skeleton" style={{ height: 14, width: '100%', borderRadius: 4 }} />
                        <div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 4 }} />
                        <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 4 }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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