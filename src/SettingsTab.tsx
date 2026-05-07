import { useState } from 'react';
import { Key, Info, Check, Eye, EyeOff, Trash2, Wifi, AlertCircle } from 'lucide-react';
import { useAppStore, CHAT_MODELS, IMAGE_MODELS } from './store';

export default function SettingsTab() {
  const { apiKey, setApiKey, chatModelId, imageModelId, conversations, imageRecords } = useAppStore();
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);
  const [testingNetwork, setTestingNetwork] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [networkError, setNetworkError] = useState<string | null>(null);

  const handleSave = () => {
    setApiKey(tempKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestNetwork = async () => {
    setTestingNetwork(true);
    setNetworkStatus('idle');
    setNetworkError(null);

    try {
      const resp = await fetch('https://ai.acmestar.top/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 }),
        mode: 'cors',
        cache: 'no-cache',
      });

      if (resp.ok || resp.status === 401) {
        // 401 表示服务器正常，只是没有认证
        setNetworkStatus('success');
      } else {
        const text = await resp.text();
        setNetworkStatus('error');
        setNetworkError(`服务器响应: ${resp.status} ${text.slice(0, 100)}`);
      }
    } catch (e) {
      setNetworkStatus('error');
      const msg = e instanceof Error ? e.message : String(e);
      setNetworkError(msg);
    } finally {
      setTestingNetwork(false);
    }
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

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>没有密钥？</span>
          <a
            href="https://api.acmestar.top"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}
          >
            点击获取
          </a>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          密钥将安全存储在本地，不会上传到服务器
        </p>
      </div>

      {/* Network Test */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Wifi size={18} color="var(--accent)" />
          <span style={{ fontWeight: 500 }}>网络测试</span>
        </div>

        <button
          onClick={handleTestNetwork}
          disabled={testingNetwork}
          className="btn-secondary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {testingNetwork ? '测试中...' : '测试网络连接'}
        </button>

        {networkStatus === 'success' && (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 12, color: 'var(--accent)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} /> 网络连接正常
          </div>
        )}

        {networkStatus === 'error' && (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, color: 'var(--danger)', fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <AlertCircle size={16} /> 网络连接失败
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, wordBreak: 'break-all' }}>{networkError}</div>
          </div>
        )}
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