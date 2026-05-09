// 会议进度组件 - 展示角色协作进度
import { CheckCircle, Circle, Loader2, Users } from 'lucide-react';

export interface ProgressStep {
  id: string;
  roleName: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
}

interface MeetingProgressProps {
  steps: ProgressStep[];
  companyName: string;
  meetingType: string;
  language?: 'zh' | 'en';
}

export default function MeetingProgress({
  steps,
  companyName,
  meetingType,
  language = 'zh',
}: MeetingProgressProps) {
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const totalCount = steps.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const meetingTypeLabels: Record<string, string> = {
    morning: language === 'zh' ? '晨会' : 'Morning Meeting',
    strategy: language === 'zh' ? '战略会' : 'Strategy Meeting',
    review: language === 'zh' ? '项目评审' : 'Project Review',
    risk: language === 'zh' ? '风险会' : 'Risk Meeting',
    retrospective: language === 'zh' ? '复盘会' : 'Retrospective',
  };

  return (
    <div style={{
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      height: '100%',
    }}>
      {/* 标题 */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'var(--accent-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
      }}>
        <Users size={36} style={{ color: 'var(--accent)' }} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)', textAlign: 'center' }}>
        {language === 'zh' ? `正在为「${companyName}」召开${meetingTypeLabels[meetingType] || meetingType}` : `${meetingTypeLabels[meetingType] || meetingType} for "${companyName}"`}
      </h3>

      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, textAlign: 'center' }}>
        {language === 'zh' ? 'AI 团队正在协作分析...' : 'AI team is collaborating...'}
      </p>

      {/* 进度条 */}
      <div style={{
        width: '100%',
        maxWidth: 300,
        height: 6,
        background: 'var(--bg-tertiary)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'var(--accent)',
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
        {progress}% ({completedCount}/{totalCount})
      </p>

      {/* 步骤列表 */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        padding: 16,
        border: '1px solid var(--border)',
      }}>
        {steps.map((step, idx) => (
          <div
            key={step.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '8px 0',
              borderBottom: idx < steps.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            {/* 状态图标 */}
            <div style={{ marginTop: 2 }}>
              {step.status === 'completed' && (
                <CheckCircle size={16} style={{ color: 'var(--accent)' }} />
              )}
              {step.status === 'running' && (
                <Loader2 size={16} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
              )}
              {step.status === 'pending' && (
                <Circle size={16} style={{ color: 'var(--text-muted)' }} />
              )}
              {step.status === 'failed' && (
                <Circle size={16} style={{ color: 'var(--danger)' }} />
              )}
            </div>

            {/* 内容 */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 500,
                color: step.status === 'completed' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
                {step.roleName}
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                marginTop: 2,
              }}>
                {step.status === 'running' ? step.message || step.task : step.task}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// 预定义的晨会步骤
export function getMorningMeetingSteps(language: 'zh' | 'en' = 'zh'): ProgressStep[] {
  return [
    {
      id: 'context',
      roleName: language === 'zh' ? '系统' : 'System',
      task: language === 'zh' ? '读取公司档案' : 'Loading company profile',
      status: 'pending',
    },
    {
      id: 'goals',
      roleName: language === 'zh' ? '系统' : 'System',
      task: language === 'zh' ? '加载公司目标' : 'Loading company goals',
      status: 'pending',
    },
    {
      id: 'memories',
      roleName: language === 'zh' ? '记忆管理员' : 'Memory Manager',
      task: language === 'zh' ? '检索相关公司记忆' : 'Retrieving relevant memories',
      status: 'pending',
    },
    {
      id: 'image',
      roleName: language === 'zh' ? '图片分析员' : 'Image Analyst',
      task: language === 'zh' ? '识别图片内容' : 'Analyzing image content',
      status: 'pending',
    },
    {
      id: 'summary',
      roleName: language === 'zh' ? '会议秘书' : 'Meeting Secretary',
      task: language === 'zh' ? '整理今日信息摘要' : 'Summarizing today\'s information',
      status: 'pending',
    },
    {
      id: 'strategy',
      roleName: language === 'zh' ? '首席战略官' : 'Chief Strategist',
      task: language === 'zh' ? '分析对公司目标的影响' : 'Analyzing impact on company goals',
      status: 'pending',
    },
    {
      id: 'opportunity',
      roleName: language === 'zh' ? '市场负责人' : 'Marketing Lead',
      task: language === 'zh' ? '寻找增长机会' : 'Identifying growth opportunities',
      status: 'pending',
    },
    {
      id: 'technical',
      roleName: language === 'zh' ? '技术负责人' : 'Technical Lead',
      task: language === 'zh' ? '评估执行难度' : 'Evaluating execution difficulty',
      status: 'pending',
    },
    {
      id: 'risk',
      roleName: language === 'zh' ? '风险官' : 'Risk Officer',
      task: language === 'zh' ? '提出潜在风险' : 'Identifying potential risks',
      status: 'pending',
    },
    {
      id: 'opposition',
      roleName: language === 'zh' ? '反方顾问' : 'Opposition Advisor',
      task: language === 'zh' ? '提出反方观点' : 'Providing opposition views',
      status: 'pending',
    },
    {
      id: 'final',
      roleName: language === 'zh' ? '主持人' : 'Moderator',
      task: language === 'zh' ? '整合最终晨会纪要' : 'Synthesizing final meeting minutes',
      status: 'pending',
    },
  ];
}
