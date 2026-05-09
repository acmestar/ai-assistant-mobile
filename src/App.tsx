import { useEffect } from 'react';
import { MessageSquare, Image, Settings, Building2, Pencil } from 'lucide-react';
import { useAppStore } from './store';
import { t, Language } from './i18n';
import ChatTab from './ChatTab';
import ImageTab from './ImageTab';
import SettingsTab from './SettingsTab';
import PWAInstallPrompt from './PWAInstallPrompt';
import VirtualCompanyTab from './virtual-company/VirtualCompanyTab';
import SuperWritingTab from './SuperWritingTab';

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
      {/* Main Content - KeepAlive 模式，所有 Tab 始终挂载 */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: activeTab === 'chat' ? 'flex' : 'none', height: '100%', minHeight: 0, flexDirection: 'column' }}>
          <ChatTab />
        </div>
        <div style={{ display: activeTab === 'image' ? 'flex' : 'none', height: '100%', minHeight: 0, flexDirection: 'column' }}>
          <ImageTab />
        </div>
        <div style={{ display: activeTab === 'super-writing' ? 'flex' : 'none', height: '100%', minHeight: 0, flexDirection: 'column' }}>
          <SuperWritingTab />
        </div>
        <div style={{ display: activeTab === 'virtual-company' ? 'flex' : 'none', height: '100%', minHeight: 0, flexDirection: 'column' }}>
          <VirtualCompanyTab />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'flex' : 'none', height: '100%', minHeight: 0, flexDirection: 'column' }}>
          <SettingsTab />
        </div>
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
        <button className={`tab-item ${activeTab === 'super-writing' ? 'active' : ''}`} onClick={() => setActiveTab('super-writing')}>
          <Pencil size={22} />
          <span>{language === 'zh' ? '写作' : 'Write'}</span>
        </button>
        <button className={`tab-item ${activeTab === 'virtual-company' ? 'active' : ''}`} onClick={() => setActiveTab('virtual-company')}>
          <Building2 size={22} />
          <span>{language === 'zh' ? '公司' : 'Company'}</span>
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
