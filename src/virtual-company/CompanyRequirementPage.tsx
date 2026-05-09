// 需求智能建档页面 - 用户输入需求，AI 自动分析生成公司/项目资料草稿
import { useState } from 'react';
import {
  Sparkles,
  ArrowLeft,
  Building2,
  Users,
  CheckCircle,
  Play,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../store';
import {
  analyzeRequirement,
  getIntentTypeLabel,
  getMeetingTypeLabel,
  EXAMPLE_REQUIREMENTS,
} from './requirementAnalyzer';
import type { RequirementAnalysis } from './types';

interface CompanyRequirementPageProps {
  onBack: () => void;
  onCreateCompany: (analysis: RequirementAnalysis) => void;
  onStartTempMeeting: (analysis: RequirementAnalysis) => void;
}

export default function CompanyRequirementPage({
  onBack,
  onCreateCompany,
  onStartTempMeeting,
}: CompanyRequirementPageProps) {
  const { language, apiKey } = useAppStore();

  const [requirement, setRequirement] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<RequirementAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 可编辑的分析结果
  const [editedProfile, setEditedProfile] = useState<{
    name: string;
    purpose: string;
    industry: string;
    stage: string;
    targetCustomers: string;
    mainProblems: string[];
  } | null>(null);

  // 执行分析
  const handleAnalyze = async () => {
    if (!requirement.trim()) {
      setError(language === 'zh' ? '请输入需求描述' : 'Please enter your requirement');
      return;
    }

    if (!apiKey) {
      setError(language === 'zh' ? '请先设置 API Key' : 'Please set API Key first');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setEditedProfile(null);

    try {
      const result = await analyzeRequirement(requirement, apiKey);
      if (result) {
        setAnalysis(result);
        // 初始化可编辑表单
        setEditedProfile({
          name: result.suggestedCompanyProfile?.name || '',
          purpose: result.suggestedCompanyProfile?.purpose || '',
          industry: result.suggestedCompanyProfile?.industry || result.industry || '',
          stage: result.suggestedCompanyProfile?.stage || result.stage || '',
          targetCustomers: result.suggestedCompanyProfile?.targetCustomers || result.targetUsers || '',
          mainProblems: result.mainProblems || [],
        });
      } else {
        setError(language === 'zh' ? '分析失败，请重试' : 'Analysis failed, please retry');
      }
    } catch (err: any) {
      setError(err.message || (language === 'zh' ? '分析失败' : 'Analysis failed'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 使用示例
  const handleUseExample = (example: typeof EXAMPLE_REQUIREMENTS[0]) => {
    setRequirement(example.content);
    setAnalysis(null);
    setEditedProfile(null);
    setError(null);
  };

  // 更新编辑的字段
  const updateEditedField = (field: string, value: string) => {
    if (!editedProfile) return;
    setEditedProfile({ ...editedProfile, [field]: value });
  };

  // 更新问题列表
  const updateProblem = (index: number, value: string) => {
    if (!editedProfile) return;
    const newProblems = [...editedProfile.mainProblems];
    newProblems[index] = value;
    setEditedProfile({ ...editedProfile, mainProblems: newProblems });
  };

  // 添加问题
  const addProblem = () => {
    if (!editedProfile) return;
    setEditedProfile({
      ...editedProfile,
      mainProblems: [...editedProfile.mainProblems, ''],
    });
  };

  // 删除问题
  const removeProblem = (index: number) => {
    if (!editedProfile) return;
    const newProblems = editedProfile.mainProblems.filter((_, i) => i !== index);
    setEditedProfile({ ...editedProfile, mainProblems: newProblems });
  };

  // 获取更新后的分析结果
  const getUpdatedAnalysis = (): RequirementAnalysis | null => {
    if (!analysis || !editedProfile) return null;
    return {
      ...analysis,
      suggestedCompanyProfile: {
        ...analysis.suggestedCompanyProfile,
        name: editedProfile.name,
        purpose: editedProfile.purpose,
        industry: editedProfile.industry,
        stage: editedProfile.stage,
        targetCustomers: editedProfile.targetCustomers,
      },
      mainProblems: editedProfile.mainProblems.filter(p => p.trim()),
      updatedAt: Date.now(),
    };
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: 6,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={20} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {language === 'zh' ? '智能建档' : 'Smart Setup'}
          </span>
        </div>
      </div>

      {/* 主内容 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* 说明 */}
        <div
          style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {language === 'zh'
              ? '请描述你的需求。可以是一个创业想法、真实公司计划、项目问题、运营难题、产品想法，或任何你希望 AI 顾问团帮你分析的问题。'
              : 'Describe your requirement. It can be a startup idea, real company plan, project problem, operation challenge, product idea, or any question you want the AI advisory team to analyze.'}
          </div>
        </div>

        {/* 输入区 */}
        <div
          style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {language === 'zh' ? '你的需求' : 'Your Requirement'}
          </div>
          <textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder={
              language === 'zh'
                ? '例如：我想开一家宠物洗护店，预算20万，在杭州，想知道怎么定位、选址和获客...'
                : 'e.g., I want to open a pet grooming shop with 200k budget in Hangzhou...'
            }
            style={{
              width: '100%',
              minHeight: 120,
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: 13,
              resize: 'vertical',
            }}
          />

          {/* 示例按钮 */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              {language === 'zh' ? '快速示例：' : 'Quick Examples:'}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {EXAMPLE_REQUIREMENTS.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleUseExample(example)}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {example.title}
                </button>
              ))}
            </div>
          </div>

          {/* 分析按钮 */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !requirement.trim()}
            className="btn-primary"
            style={{
              marginTop: 12,
              width: '100%',
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw size={18} className="spin" />
                {language === 'zh' ? 'AI 正在分析...' : 'AI Analyzing...'}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {language === 'zh' ? 'AI 分析需求' : 'AI Analyze Requirement'}
              </>
            )}
          </button>

          {/* 错误提示 */}
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 8,
                color: 'var(--danger)',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* 分析结果 */}
        {analysis && editedProfile && (
          <div
            style={{
              padding: 16,
              background: 'var(--bg-secondary)',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={18} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {language === 'zh' ? '分析结果' : 'Analysis Result'}
                </span>
              </div>
              <span
                style={{
                  padding: '4px 10px',
                  background: 'var(--accent-dim)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: 'var(--accent)',
                }}
              >
                {getIntentTypeLabel(analysis.intentType, language)}
              </span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {language === 'zh'
                ? '以下是 AI 自动生成的项目/公司资料草稿，你可以修改后再继续。'
                : 'Below is the AI-generated draft. You can edit before proceeding.'}
            </div>

            {/* 可编辑表单 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 名称 */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'zh' ? '公司/项目名称' : 'Company/Project Name'}
                </label>
                <input
                  type="text"
                  value={editedProfile.name}
                  onChange={(e) => updateEditedField('name', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
              </div>

              {/* 使命/目的 */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'zh' ? '使命/目的' : 'Purpose'}
                </label>
                <textarea
                  value={editedProfile.purpose}
                  onChange={(e) => updateEditedField('purpose', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    minHeight: 60,
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* 行业和阶段 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'zh' ? '行业' : 'Industry'}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.industry}
                    onChange={(e) => updateEditedField('industry', e.target.value)}
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    {language === 'zh' ? '阶段' : 'Stage'}
                  </label>
                  <input
                    type="text"
                    value={editedProfile.stage}
                    onChange={(e) => updateEditedField('stage', e.target.value)}
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* 目标客户 */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'zh' ? '目标客户' : 'Target Customers'}
                </label>
                <input
                  type="text"
                  value={editedProfile.targetCustomers}
                  onChange={(e) => updateEditedField('targetCustomers', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
              </div>

              {/* 核心问题 */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {language === 'zh' ? '核心问题' : 'Main Problems'}
                  </label>
                  <button
                    onClick={addProblem}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    + {language === 'zh' ? '添加' : 'Add'}
                  </button>
                </div>
                {editedProfile.mainProblems.map((problem, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={problem}
                      onChange={(e) => updateProblem(i, e.target.value)}
                      placeholder={`${language === 'zh' ? '问题' : 'Problem'} ${i + 1}`}
                      style={{
                        flex: 1,
                        padding: 10,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                      }}
                    />
                    <button
                      onClick={() => removeProblem(i)}
                      style={{
                        padding: 10,
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        color: 'var(--text-muted)',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* 建议团队 */}
              {analysis.suggestedAgents.length > 0 && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>
                    <Users size={14} style={{ marginRight: 4 }} />
                    {language === 'zh' ? '建议 AI 团队' : 'Suggested AI Team'}
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {analysis.suggestedAgents.map((agent, i) => (
                      <span
                        key={i}
                        style={{
                          padding: '6px 10px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: 6,
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {agent.role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 推荐会议类型 */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  {language === 'zh' ? '推荐会议类型' : 'Recommended Meeting Type'}
                </label>
                <span
                  style={{
                    padding: '6px 12px',
                    background: 'var(--accent-dim)',
                    borderRadius: 6,
                    fontSize: 13,
                    color: 'var(--accent)',
                  }}
                >
                  {getMeetingTypeLabel(analysis.suggestedMeetingType, language)}
                </span>
              </div>
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => {
                  const updated = getUpdatedAnalysis();
                  if (updated) onCreateCompany(updated);
                }}
                style={{
                  flex: 1,
                  padding: 14,
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 10,
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Building2 size={18} />
                {language === 'zh' ? '创建长期 AI 公司' : 'Create AI Company'}
              </button>
              <button
                onClick={() => {
                  const updated = getUpdatedAnalysis();
                  if (updated) onStartTempMeeting(updated);
                }}
                style={{
                  flex: 1,
                  padding: 14,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Play size={18} />
                {language === 'zh' ? '开始临时顾问会议' : 'Start Advisory Meeting'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CSS 动画 */}
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
