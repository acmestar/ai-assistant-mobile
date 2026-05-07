import { useState } from 'react';
import { Key, Info, Check, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useAppStore, CHAT_MODELS, IMAGE_MODELS } from './store';

export default function SettingsTab() {
  const { apiKey, setApiKey, chatModelId, imageModelId, conversations, imageRecords } = useAppStore();
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey(tempKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearAll = () => {
    if (confirm('确定要清除所有数据吗？这将删除所有对话和生成的图片。')) {
      localStorage.removeItem('ai-assistant-storage');
      window.location.reload();
    }
  };

  const currentChatModel = CHAT_MODELS.find((m) => m.id === chatModelId);
  const currentImageModel = IMAGE_MODELS.find((m) => m.id === imageModelId);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16, paddingTop: 20 }}>
      {/* API Key Section */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Key size={18} color="var(--accent)" />
          <span style={{ fontWeight: 500 }}>API 密钥</span>
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={tempKey}
            onChange={(e) => setTempKey(e.target.value)}
            placeholder="输入你的 API Key"
            style={{ paddingRight: 44 }}
          />
          <button
            onClick={() => setShowKey(!showKey)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              color: 'var(--text-muted)',
              padding: 4,
            }}
          >
            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {saved ? <><Check size={18} /> 已保存</> : '保存密钥'}
        </button>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          密钥将安全存储在本地，不会上传到服务器
        </p>
      </div>

      {/* Current Models */}
      <div className="settings-section">
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>当前模型</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>聊天模型</span>
            <span style={{ color: 'var(--accent)' }}>{currentChatModel?.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>生图模型</span>
            <span style={{ color: 'var(--accent)' }}>{currentImageModel?.name}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="settings-section">
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>数据统计</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>对话数量</span>
            <span>{conversations.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}>生成图片</span>
            <span>{imageRecords.length}</span>
          </div>
        </div>
      </div>

      {/* Available Models Info */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Info size={18} color="var(--accent)" />
          <span style={{ fontWeight: 500 }}>可用模型</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>聊天模型</div>
          {CHAT_MODELS.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                fontSize: 14,
                color: 'var(--text-secondary)',
              }}
            >
              <span>{m.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {m.maxTokens >= 100000 ? '超长上下文' : `${Math.round(m.maxTokens / 1000)}K`}
              </span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>生图模型</div>
          {IMAGE_MODELS.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                fontSize: 14,
                color: 'var(--text-secondary)',
              }}
            >
              <span>{m.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.provider}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Clear Data */}
      <button
        onClick={handleClearAll}
        style={{
          width: '100%',
          padding: 14,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 12,
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Trash2 size={18} />
        清除所有数据
      </button>

      {/* Version */}
      <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-muted)', fontSize: 12 }}>
        AI 助手 v1.0.0
      </div>
    </div>
  );
}