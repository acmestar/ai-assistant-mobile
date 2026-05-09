// AI 虚拟公司 - 主入口（公司管理模式）
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useAppStore } from '../store';
import CompanyListPage from './CompanyListPage';
import CompanyWorkspace from './CompanyWorkspace';
import CreateCompanyPage from './CreateCompanyPage';
import CompanyMeetingPage from './CompanyMeetingPage';

type ViewMode = 'list' | 'workspace' | 'create' | 'meeting';

export default function VirtualCompanyTab() {
  const { language, currentCompanyId, setCurrentCompanyId } = useAppStore();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(currentCompanyId);
  const [meetingType, setMeetingType] = useState<'morning' | 'strategy' | 'review' | 'risk' | 'retrospective'>('morning');

  // 选择公司
  const handleSelectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setCurrentCompanyId(companyId);
    setViewMode('workspace');
  };

  // 创建公司
  const handleCreateCompany = () => {
    setViewMode('create');
  };

  // 公司创建完成
  const handleCompanyCreated = (companyId: string) => {
    setSelectedCompanyId(companyId);
    setCurrentCompanyId(companyId);
    setViewMode('workspace');
  };

  // 返回列表
  const handleBackToList = () => {
    setViewMode('list');
    setSelectedCompanyId(null);
    setCurrentCompanyId(null);
  };

  // 开始会议
  const handleStartMeeting = (type: string) => {
    setMeetingType(type as typeof meetingType);
    setViewMode('meeting');
  };

  // 会议结束返回工作台
  const handleMeetingBack = () => {
    setViewMode('workspace');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header - 只在列表页显示 */}
      {viewMode === 'list' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={20} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {language === 'zh' ? '我的 AI 公司' : 'My AI Companies'}
            </span>
          </div>
        </div>
      )}

      {/* 内容区 */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {viewMode === 'list' && (
          <CompanyListPage
            onSelectCompany={handleSelectCompany}
            onCreateCompany={handleCreateCompany}
          />
        )}

        {viewMode === 'workspace' && selectedCompanyId && (
          <CompanyWorkspace
            companyId={selectedCompanyId}
            onBack={handleBackToList}
            onStartMeeting={handleStartMeeting}
          />
        )}

        {viewMode === 'create' && (
          <CreateCompanyPage
            onBack={handleBackToList}
            onComplete={handleCompanyCreated}
          />
        )}

        {viewMode === 'meeting' && selectedCompanyId && (
          <CompanyMeetingPage
            companyId={selectedCompanyId}
            meetingType={meetingType}
            onBack={handleMeetingBack}
          />
        )}
      </div>
    </div>
  );
}
