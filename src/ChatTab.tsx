import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Trash2, Plus, ChevronLeft, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { useAppStore, CHAT_MODELS } from './store';
import { sendChatMessage } from './api';
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
  } = useAppStore();

  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesLengthRef = useRef(0);
  const shouldScrollToBottomRef = useRef(false);

  const conversation = getCurrentConversation();
  const currentModel = CHAT_MODELS.find((m) => m.id === chatModelId);

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
            await sendChatMessage(userMessage, imageBase64);
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
      sendChatMessage(userMessage, imageBase64).catch((e) => setError(String(e)));
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
      await sendChatMessage(messageText || '请描述这张图片', imageToSend || undefined);
    } catch (e) {
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
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button className="btn-secondary" onClick={() => setShowSidebar(true)} style={{ padding: 8 }}>
          <MessageSquare size={20} />
        </button>

        <button
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="model-chip"
          style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
        >
          {currentModel?.name || '选择模型'}
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
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>选择模型</div>
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
                  {m.maxTokens >= 100000 ? '超长上下文' : `${Math.round(m.maxTokens / 1000)}K`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg-primary)' }}>
        {conversation.messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, padding: 20 }}>
            <MessageSquare size={48} strokeWidth={1.5} style={{ marginBottom: 16, opacity: 0.5 }} />
            <p style={{ marginBottom: 8, fontSize: 16 }}>发送消息开始对话</p>
            <p style={{ fontSize: 13 }}>支持超长上下文，可发送图片</p>
          </div>
        )}

        {conversation.messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className={`message ${msg.role}`}>
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginBottom: 8 }} />
              )}
              {msg.role === 'assistant' ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isChatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div className="message assistant">
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
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

      {/* Input */}
      <div style={{ padding: 12, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        {attachedImage && (
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

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="输入消息..."
            style={{ flex: 1, borderRadius: 20 }}
          />

          <button
            onClick={handleSend}
            disabled={isChatLoading || (!input.trim() && !attachedImage)}
            className="btn-primary"
            style={{ padding: 12, borderRadius: 12 }}
          >
            {isChatLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
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

          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => {
                  useAppStore.setState({ currentConversationId: conv.id });
                  setShowSidebar(false);
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
                <div>
                  <div style={{ fontSize: 15, marginBottom: 2 }}>{conv.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {conv.messages.length} 条消息
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  style={{ padding: 8, color: 'var(--text-muted)', background: 'transparent' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {conversations.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                暂无对话
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}