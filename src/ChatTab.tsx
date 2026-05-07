import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Trash2, Plus, ChevronLeft, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { useAppStore, CHAT_MODELS } from './store';
import { sendChatMessage } from './api';
import ReactMarkdown from 'react-markdown';

export default function ChatTab() {
  const {
    conversations,
    currentConversationId,
    chatModelId,
    setChatModelId,
    isLoading,
    createConversation,
    getCurrentConversation,
    clearConversation,
    deleteConversation,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversation = getCurrentConversation();
  const currentModel = CHAT_MODELS.find((m) => m.id === chatModelId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSend = async () => {
    if (!input.trim() && !attachedImage) return;
    if (isLoading) return;

    setError(null);
    const messageText = input.trim();
    setInput('');
    const imageToSend = attachedImage;
    setAttachedImage(null);

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
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {conversation.messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            <p style={{ marginBottom: 8 }}>发送消息开始对话</p>
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

        {isLoading && (
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
            <img src={attachedImage} alt="" style={{ height: 60, borderRadius: 8 }} />
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
            className="btn-secondary"
            style={{ padding: 12 }}
          >
            <ImageIcon size={20} />
          </button>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="输入消息..."
            style={{ flex: 1 }}
          />

          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !attachedImage)}
            className="btn-primary"
            style={{ padding: 12 }}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
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