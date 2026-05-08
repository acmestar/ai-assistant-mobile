import { useState, useRef } from 'react';
import { Key, Info, Check, Eye, EyeOff, Trash2, Wifi, AlertCircle, Sun, Moon, Download, Upload, BarChart2, Globe } from 'lucide-react';
import { useAppStore, CHAT_MODELS, IMAGE_MODELS } from './store';
import { t, Language } from './i18n';

export default function SettingsTab() {
  const { apiKey, setApiKey, chatModelId, imageModelId, conversations, imageRecords, theme, setTheme, totalInputTokens, totalOutputTokens, exportData, importData, language, setLanguage } = useAppStore();
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);
  const [saved, setSaved] = useState(false);
  const [testingNetwork, setTestingNetwork] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [networkError, setNetworkError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const T = (key: string) => t(key, language as Language);

  const handleSave = () => {
    setApiKey(tempKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      importData(data);
      alert(T('importSuccess'));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleTestNetwork = async () => {
    setTestingNetwork(true);
    setNetworkStatus('idle');
    setNetworkError(null);

    const diagnostics: string[] = [];
    diagnostics.push(`User-Agent: ${navigator.userAgent}`);
    diagnostics.push(`平台: ${navigator.platform}`);

    try {
      diagnostics.push('测试 1: 基础连接...');
      await fetch('https://ai.acmestar.top', { method: 'HEAD', mode: 'no-cors' });
      diagnostics.push('基础连接成功');
    } catch (e) {
      diagnostics.push(`基础连接失败: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      diagnostics.push('测试 2: API 端点...');
      const resp = await fetch('https://ai.acmestar.top/api/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 }),
        mode: 'cors',
        cache: 'no-cache',
      });

      if (resp.ok || resp.status === 401) {
        setNetworkStatus('success');
        diagnostics.push('API 连接正常');
      } else {
        const text = await resp.text();
        setNetworkStatus('error');
        diagnostics.push(`服务器响应: ${resp.status}`);
        setNetworkError(`${text.slice(0, 100)}\n\n诊断信息:\n${diagnostics.join('\n')}`);
      }
    } catch (e) {
      setNetworkStatus('error');
      const msg = e instanceof Error ? e.message : String(e);
      diagnostics.push(`API 请求失败: ${msg}`);
      setNetworkError(`${msg}\n\n诊断信息:\n${diagnostics.join('\n')}`);
    } finally {
      setTestingNetwork(false);
    }
  };

  const handleClearAll = () => {
    if (confirm(T('clearConfirm'))) {
      localStorage.removeItem('ai-assistant-storage');
      window.location.reload();
    }
  };

  const currentChatModel = CHAT_MODELS.find((m) => m.id === chatModelId);
  const currentImageModel = IMAGE_MODELS.find((m) => m.id === imageModelId);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 16, paddingTop: 20 }}>
      {/* Theme Toggle */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {theme === 'dark' ? <Moon size={18} color="var(--accent)" /> : <Sun size={18} color="var(--accent)" />}
            <span style={{ fontWeight: 500 }}>{T('theme')}</span>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn-secondary"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? T('light') : T('dark')}
          </button>
        </div>
      </div>

      {/* Language Toggle */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Globe size={18} color="var(--accent)" />
            <span style={{ fontWeight: 500 }}>语言</span>
          </div>
          <button
            onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
            className="btn-secondary"
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {language === 'zh' ? 'English' : '中文'}
          </button>
        </div>
      </div>

      {/* API Key Section */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Key size={18} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: 16 }}>{T('apiKey')}</span>
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={tempKey}
            onChange={(e) => setTempKey(e.target.value)}
            placeholder={T('inputApiKey')}
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
          {saved ? <><Check size={18} /> {T('saved')}</> : T('saveApiKey')}
        </button>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{T('noApiKey')}</span>
          <a
            href="https://api.acmestar.top"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'underline' }}
          >
            {T('getApiKey')}
          </a>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
          {T('apiKeySecure')}
        </p>
      </div>

      {/* Network Test */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Wifi size={18} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: 16 }}>{T('networkTest')}</span>
        </div>

        <button
          onClick={handleTestNetwork}
          disabled={testingNetwork}
          className="btn-secondary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {testingNetwork ? T('testing') : T('testNetwork')}
        </button>

        {networkStatus === 'success' && (
          <div style={{ marginTop: 12, padding: 12, background: 'var(--accent-dim)', borderRadius: 12, color: 'var(--accent)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={16} /> {T('networkSuccess')}
          </div>
        )}

        {networkStatus === 'error' && (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, color: 'var(--danger)', fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <AlertCircle size={16} /> {T('networkFailed')}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{networkError}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              {language === 'zh' ? '建议：请尝试使用 Chrome 浏览器打开，或将链接添加到主屏幕使用' : 'Tip: Try using Chrome browser or add to home screen'}
            </div>
          </div>
        )}
      </div>

      {/* Current Models - 双列布局 */}
      <div className="settings-section">
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 500 }}>{T('currentModels')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{T('chatModel')}</div>
            <div style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 14 }}>{currentChatModel?.name}</div>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{T('imageModel')}</div>
            <div style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 14 }}>{currentImageModel?.name}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="settings-section">
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 500 }}>{T('dataStats')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{conversations.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{T('conversationCount')}</div>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}>{imageRecords.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{T('generatedImages')}</div>
          </div>
        </div>
      </div>

      {/* Token 统计 */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <BarChart2 size={18} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: 16 }}>{T('tokenUsage')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent-blue)' }}>{(totalInputTokens / 1000).toFixed(1)}K</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{T('inputTokens')}</div>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent)' }}>{(totalOutputTokens / 1000).toFixed(1)}K</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{T('outputTokens')}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {T('totalTokens')}: {((totalInputTokens + totalOutputTokens) / 1000).toFixed(1)}K Token
        </div>
      </div>

      {/* 数据导入导出 */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Download size={18} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: 16 }}>{T('dataManagement')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Download size={18} /> {T('exportBackup')}
          </button>
          <input ref={importInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
          <button onClick={() => importInputRef.current?.click()} className="btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Upload size={18} /> {T('importData')}
          </button>
        </div>
      </div>

      {/* Available Models Info */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Info size={18} color="var(--accent)" />
          <span style={{ fontWeight: 600, fontSize: 16 }}>{T('availableModels')}</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>{T('chatModel')}</div>
          {CHAT_MODELS.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: 6 }}>
                {m.maxTokens >= 100000 ? T('longContext') : `${Math.round(m.maxTokens / 1000)}K`}
              </span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>{T('imageModel')}</div>
          {IMAGE_MODELS.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: 6 }}>{m.tag}</span>
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
          fontWeight: 500,
        }}
      >
        <Trash2 size={18} />
        {T('clearAllData')}
      </button>

      {/* Version */}
      <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--text-muted)', fontSize: 12 }}>
        {T('appName')} v1.0.0
      </div>
    </div>
  );
}
