// AI 虚拟公司 - 主入口（公司管理模式）
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useAppStore } from '../store';
import CompanyListPage from './CompanyListPage';
import CompanyWorkspace from './CompanyWorkspace';
import CreateCompanyPage from './CreateCompanyPage';
import CompanyMeetingPage from './CompanyMeetingPage';
import CompanyRequirementPage from './CompanyRequirementPage';
import { RequirementAnalysis, AICompany, CompanyAgent } from './types';

type ViewMode = 'list' | 'workspace' | 'create' | 'meeting' | 'requirement';

// 根据角色获取部门
function getDepartmentForRole(role: string): string {
  if (role.includes('CEO') || role.includes('创始人') || role.includes('总经理')) return '管理层';
  if (role.includes('产品') || role.includes('PM')) return '产品部';
  if (role.includes('技术') || role.includes('开发') || role.includes('CTO')) return '技术部';
  if (role.includes('市场') || role.includes('营销') || role.includes('CMO')) return '市场部';
  if (role.includes('运营') || role.includes('COO')) return '运营部';
  if (role.includes('财务') || role.includes('CFO')) return '财务部';
  if (role.includes('法务') || role.includes('合规')) return '法务部';
  if (role.includes('人事') || role.includes('HR')) return '人事部';
  return '顾问团';
}

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

  // 智能建档
  const handleSmartCreate = () => {
    setViewMode('requirement');
  };

  // 从需求分析创建长期公司
  const handleCreateCompanyFromAnalysis = (analysis: RequirementAnalysis) => {
    const companyId = `company-${Date.now()}`;
    const now = new Date().toISOString();

    // 生成默认团队成员
    const agents: CompanyAgent[] = analysis.suggestedAgents.map((agent, index) => ({
      id: `agent-${companyId}-${index}`,
      name: agent.role,
      role: agent.role,
      department: getDepartmentForRole(agent.role),
      personality: agent.personality || '专业、严谨',
      background: agent.background || '多年行业经验',
      responsibilities: [agent.responsibility],
      focusAreas: [],
      speakingStyle: '专业客观',
      decisionPower: '建议权',
      reviewOrder: index,
    }));

    const newCompany: AICompany = {
      id: companyId,
      name: analysis.suggestedCompanyProfile?.name || '未命名公司',
      purpose: analysis.suggestedCompanyProfile?.purpose || '',
      industry: analysis.suggestedCompanyProfile?.industry || analysis.industry,
      stage: analysis.suggestedCompanyProfile?.stage || analysis.stage,
      targetUsers: analysis.targetUsers ? [analysis.targetUsers] : undefined,
      businessModel: analysis.suggestedCompanyProfile?.businessModel,
      agents,
      memories: [],
      goals: [],
      tasks: [],
      risks: [],
      meetings: [],
      createdAt: now,
      updatedAt: now,
    };

    useAppStore.getState().addAICompany(newCompany);
    setSelectedCompanyId(companyId);
    setCurrentCompanyId(companyId);
    setViewMode('workspace');
  };

  // 从需求分析开始临时顾问会议
  const handleStartTempMeeting = (analysis: RequirementAnalysis) => {
    const companyId = `temp-company-${Date.now()}`;
    const now = new Date().toISOString();

    // 创建临时公司档案
    const agents: CompanyAgent[] = analysis.suggestedAgents.map((agent, index) => ({
      id: `agent-${companyId}-${index}`,
      name: agent.role,
      role: agent.role,
      department: getDepartmentForRole(agent.role),
      personality: agent.personality || '专业、严谨',
      background: agent.background || '多年行业经验',
      responsibilities: [agent.responsibility],
      focusAreas: [],
      speakingStyle: '专业客观',
      decisionPower: '建议权',
      reviewOrder: index,
    }));

    const tempCompany: AICompany = {
      id: companyId,
      name: analysis.suggestedCompanyProfile?.name || '临时顾问团',
      purpose: analysis.suggestedCompanyProfile?.purpose || analysis.summary,
      industry: analysis.industry,
      stage: analysis.stage,
      targetUsers: analysis.targetUsers ? [analysis.targetUsers] : undefined,
      agents,
      memories: [],
      goals: [],
      tasks: [],
      risks: [],
      meetings: [],
      createdAt: now,
      updatedAt: now,
    };

    useAppStore.getState().addAICompany(tempCompany);
    setSelectedCompanyId(companyId);
    setCurrentCompanyId(companyId);
    setMeetingType(analysis.suggestedMeetingType);
    setViewMode('meeting');
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
            onSmartCreate={handleSmartCreate}
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

        {viewMode === 'requirement' && (
          <CompanyRequirementPage
            onBack={handleBackToList}
            onCreateCompany={handleCreateCompanyFromAnalysis}
            onStartTempMeeting={handleStartTempMeeting}
          />
        )}
      </div>
    </div>
  );
}
