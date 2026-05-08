import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Trash2, Plus, ChevronLeft, Image as ImageIcon, X, Copy, Edit2, Check, Pencil, Search, StopCircle, Pin, PinOff, Download, Mic } from 'lucide-react';
import { useAppStore, CHAT_MODELS } from './store';
import { sendChatMessageStream, cancelChatRequest } from './api';
import { t, Language } from './i18n';
import ReactMarkdown from 'react-markdown';

const SCROLL_POSITION_KEY = 'chat-scroll-position';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(0);
  const shouldScrollToBottomRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false); // 用于防止重复触发
  const isPressingRef = useRef(false); // 追踪鼠标/触摸按压状态

  const conversation = getCurrentConversation();
  const currentModel = CHAT_MODELS.find((m) => m.id === chatModelId);

  // 创建新的 SpeechRecognition 实例
  const createRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return null;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
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
      console.error('语音识别错误:', event.error);
      // not-allowed 错误表示权限被拒绝
      if (event.error === 'not-allowed') {
        const msg = language === 'zh'
          ? '请允许麦克风权限以使用语音功能。\n\n提示：将应用添加到主屏幕可持久化权限，避免每次重新授权。'
          : 'Please allow microphone access to use voice input.\n\nTip: Add to home screen to persist permissions.';
        alert(msg);
      }
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    return recognition;
  };

  // 进入语音模式
  const enterVoiceMode = () => {
    setIsVoiceMode(true);
    setVoiceText('');
    isRecordingRef.current = false;
    // 每次进入语音模式时创建新实例
    recognitionRef.current = createRecognition();
  };

  // 退出语音模式
  const exitVoiceMode = () => {
    setIsVoiceMode(false);
    setVoiceText('');
    if (isRecordingRef.current && recognitionRef.current) {
      isRecordingRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  // 开始录音（长按）
  const startRecording = () => {
    if (isRecordingRef.current) return;
    if (!recognitionRef.current) {
      alert(T('voiceNotSupported'));
      return;
    }

    setVoiceText('');
    isRecordingRef.current = true;
    setIsRecording(true);

    try {
      recognitionRef.current.start();
    } catch (e: any) {
      // 如果已经在运行，需要先停止
      if (e.name === 'InvalidStateError' || e.message?.includes('already started')) {
        try {
          recognitionRef.current.stop();
        } catch {}
        // 等待停止后再启动
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
        }, 150);
      } else {
        console.error('无法启动语音识别:', e);
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    }
  };

  // 停止录音（松开）
  const stopRecording = () => {
    if (!isRecordingRef.current) return;
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
      if (document.visibilityState === 'visible' && pendingChatRequest) {
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
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pendingChatRequest, currentConversationId]);

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
    if (isChatLoading) return;

    setError(null);
    const messageText = input.trim();
    setInput('');
    const imageToSend = attachedImage;
    setAttachedImage(null);

    // 标记需要滚动到底部
    shouldScrollToBottomRef.current = true;

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

        <button
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="model-chip"
          style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
        >
          {currentModel?.name || T('selectModel')}
        </button>

        <button className="btn-secondary" onClick={clearConversation} style={{ padding: 8 }}>
          <Trash2 size={18} />
        </button>
      </div>

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
            <div className={`message ${msg.role}`}>
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
            {!editingMessageId && (
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

            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={T('inputMessage')}
              style={{ flex: 1, borderRadius: 20 }}
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
            <button onClick={() => setShowSidebar(false)} className="btn-secondary" style={{ padding: 8 }}>
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontWeight: 500 }}>对话历史</span>
            <button onClick={handleNewChat} className="btn-secondary" style={{ padding: 8 }}>
              <Plus size={20} />
            </button>
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
                  if (renamingConversationId !== conv.id) {
                    useAppStore.setState({ currentConversationId: conv.id });
                    setShowSidebar(false);
                  }
                }}
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  marginBottom: 4,
                  background: conv.id === currentConversationId ? 'var(--bg-tertiary)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
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
                {renamingConversationId !== conv.id && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); pinConversation(conv.id, !conv.pinned); }}
                      style={{ padding: 8, color: conv.pinned ? 'var(--accent)' : 'var(--text-muted)', background: 'transparent' }}
                    >
                      {conv.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStartRename(conv.id, conv.title); }}
                      style={{ padding: 8, color: 'var(--text-muted)', background: 'transparent' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
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