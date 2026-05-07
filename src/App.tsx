import { useEffect, useRef } from 'react';
import { MessageSquare, Image, Settings } from 'lucide-react';
import { useAppStore } from './store';
import ChatTab from './ChatTab';
import ImageTab from './ImageTab';
import SettingsTab from './SettingsTab';

export default function App() {
  const { activeTab, setActiveTab, apiKey, createConversation, currentConversationId } = useAppStore();
  const appRef = useRef<HTMLDivElement>(null);

  // Auto-create conversation if none exists
  useEffect(() => {
    if (!currentConversationId && apiKey) {
      createConversation();
    }
  }, [currentConversationId, apiKey, createConversation]);

  // 处理键盘弹出时的视口变化
  useEffect(() => {
    const handleResize = () => {
      if (appRef.current && window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        appRef.current.style.height = `${viewportHeight}px`;
      }
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', handleResize);
      vv.addEventListener('scroll', handleResize);
      handleResize();
      return () => {
        vv.removeEventListener('resize', handleResize);
        vv.removeEventListener('scroll', handleResize);
      };
    }
  }, []);

  return (
    <div ref={appRef} style={{
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
          <span>聊天</span>
        </button>
        <button className={`tab-item ${activeTab === 'image' ? 'active' : ''}`} onClick={() => setActiveTab('image')}>
          <Image size={22} />
          <span>生图</span>
        </button>
        <button className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          <Settings size={22} />
          <span>设置</span>
        </button>
      </div>
    </div>
  );
}