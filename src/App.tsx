import { useEffect } from 'react';
import { MessageSquare, Image, Settings } from 'lucide-react';
import { useAppStore } from './store';
import { t, Language } from './i18n';
import ChatTab from './ChatTab';
import ImageTab from './ImageTab';
import SettingsTab from './SettingsTab';
import PWAInstallPrompt from './PWAInstallPrompt';

export default function App() {
  const { activeTab, setActiveTab, apiKey, createConversation, currentConversationId, theme, language } = useAppStore();

  const T = (key: string) => t(key, language as Language);

  // Auto-create conversation if none exists
  useEffect(() => {
    if (!currentConversationId && apiKey) {
      createConversation();
    }
  }, [currentConversationId, apiKey, createConversation]);

  // 初始化主题
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top, 0)',
    }}>
      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'chat' && <ChatTab />}
        {activeTab === 'image' && <ImageTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </div>

      {/* Tab Bar */}
      <div className="tab-bar safe-area-bottom">
        <button className={`tab-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <MessageSquare size={22} />
          <span>{T('chat')}</span>
        </button>
        <button className={`tab-item ${activeTab === 'image' ? 'active' : ''}`} onClick={() => setActiveTab('image')}>
          <Image size={22} />
          <span>{T('image')}</span>
        </button>
        <button className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={22} />
          <span>{T('settings')}</span>
        </button>
      </div>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}
