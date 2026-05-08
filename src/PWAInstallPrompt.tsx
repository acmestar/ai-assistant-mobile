import { useState, useEffect } from 'react';
import { X, Share, Plus, Download } from 'lucide-react';
import { useAppStore } from './store';

export default function PWAInstallPrompt() {
  const { language, theme } = useAppStore();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 检查是否已经安装或关闭过提示
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    // 检查是否是 iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // 检查是否已经在 standalone 模式（已安装）
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Android/Chrome: 监听 beforeinstallprompt 事件
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // 延迟显示提示
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // iOS: 直接显示提示
    if (iOS) {
      setTimeout(() => setShowPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 16,
        right: 16,
        background: theme === 'dark' ? '#272A33' : '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        zIndex: 1000,
        border: '1px solid var(--border)',
      }}
    >
      <button
        onClick={handleDismiss}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          padding: 4,
        }}
      >
        <X size={18} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--accent-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Download size={24} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {language === 'zh' ? '添加到主屏幕' : 'Add to Home Screen'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {language === 'zh' ? '获得更好的使用体验' : 'Get the best experience'}
          </div>
        </div>
      </div>

      {isIOS ? (
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span>1. 点击</span>
            <Share size={18} color="var(--accent)" />
            <span>分享按钮</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>2. 选择"</span>
            <Plus size={18} color="var(--accent)" />
            <span>添加到主屏幕"</span>
          </div>
        </div>
      ) : (
        <button
          onClick={handleInstall}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 12,
            color: 'white',
            fontWeight: 500,
            fontSize: 15,
          }}
        >
          {language === 'zh' ? '立即安装' : 'Install Now'}
        </button>
      )}
    </div>
  );
}
