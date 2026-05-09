// AI 晨会 - 独立标签页
import { useState, useRef } from 'react';
import {
  Sunrise,
  Upload,
  Link as LinkIcon,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
  AlertTriangle,
  Target,
  CheckCircle,
  Download,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { useAppStore } from '../store';
import { sendChatMessageStream } from '../api';
import {
  CompanyAgent,
  AgentReview,
  MorningMeetingAnalysis,
  MorningMeetingMinutes,
} from './types';

// 会议类型
const MEETING_TYPES = [
  { id: 'auto', name: '自动识别', icon: '🤖', description: 'AI 自动判断内容类型' },
  { id: 'finance', name: '财经投研晨会', icon: '📈', description: '股市、基金、宏观经济' },
  { id: 'business', name: '商业战略晨会', icon: '🎯', description: '行业动态、竞争分析' },
  { id: 'health', name: '健康风险晨会', icon: '🏥', description: '健康资讯、疾病预防' },
  { id: 'legal', name: '法律合规晨会', icon: '⚖️', description: '政策法规、合规风险' },
  { id: 'startup', name: '创业机会晨会', icon: '🚀', description: '市场机会、创业风向' },
  { id: 'life', name: '生活决策晨会', icon: '🏠', description: '生活资讯、消费决策' },
];

// 示例场景
const EXAMPLE_SCENARIOS = [
  { type: 'finance', text: '央行宣布降准0.5个百分点，释放长期资金约1万亿元' },
  { type: 'business', text: 'OpenAI发布GPT-5，性能提升300%，多模态能力大幅增强' },
  { type: 'health', text: '研究发现：每天步行8000步可降低心血管疾病风险50%' },
  { type: 'legal', text: '新《个人信息保护法》正式实施，企业合规成本大幅上升' },
  { type: 'startup', text: 'AI教育赛道融资超百亿，多家独角兽涌现' },
  { type: 'life', text: '多地出台购房新政，首付比例降至15%' },
];

export default function MorningMeetingTab() {
  const { language, apiKey } = useAppStore();

  const [inputType, setInputType] = useState<'text' | 'image' | 'link'>('text');
  const [textContent, setTextContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [meetingType, setMeetingType] = useState('auto');
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<MorningMeetingAnalysis | null>(null);
  const [agents, setAgents] = useState<CompanyAgent[]>([]);
  const [reviews, setReviews] = useState<AgentReview[]>([]);
  const [minutes, setMinutes] = useState<MorningMeetingMinutes | null>(null);
  const [expandedView, setExpandedView] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageUrl(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 开始晨会
  const handleStartMeeting = async () => {
    if (!apiKey) {
      alert(language === 'zh' ? '请先设置 API Key' : 'Please set API Key first');
      return;
    }

    const content = inputType === 'text' ? textContent
      : inputType === 'image' ? '图片内容'
      : linkUrl;

    if (!content.trim() && !imageUrl) {
      alert(language === 'zh' ? '请输入内容' : 'Please enter content');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setAnalysis(null);
    setAgents([]);
    setReviews([]);
    setMinutes(null);

    try {
      // Step 1: 分析信息
      setCurrentStep(language === 'zh' ? '正在分析信息...' : 'Analyzing information...');
      setProgress(10);

      const analysisPrompt = buildAnalysisPrompt(content, imageUrl, meetingType, language);
      let analysisResult = '';
      await sendChatMessageStream(analysisPrompt, imageUrl || undefined, (chunk: string) => {
        analysisResult += chunk;
      });

      const analysisData = parseJsonResponse<MorningMeetingAnalysis>(analysisResult);
      if (analysisData) {
        setAnalysis(analysisData);
      }
      setProgress(25);

      // Step 2: 组建专家团队
      setCurrentStep(language === 'zh' ? '正在组建专家团队...' : 'Building expert team...');
      const agentsPrompt = buildAgentsPrompt(analysisData, meetingType, language);
      let agentsResult = '';
      await sendChatMessageStream(agentsPrompt, undefined, (chunk: string) => {
        agentsResult += chunk;
      });

      const agentsData = parseJsonResponse<{ agents: CompanyAgent[] }>(agentsResult);
      if (agentsData?.agents) {
        setAgents(agentsData.agents);
      }
      setProgress(40);

      // Step 3: 各角色发言
      setCurrentStep(language === 'zh' ? '正在进行晨会讨论...' : 'Conducting meeting...');
      const currentReviews: AgentReview[] = [];

      for (let i = 0; i < (agentsData?.agents?.length || 0); i++) {
        const agent = agentsData!.agents[i];
        setCurrentStep(`${agent.name}（${agent.role}）正在发言...`);

        const reviewPrompt = buildReviewPrompt(content, analysisData, agent, currentReviews, language);
        let reviewResult = '';
        await sendChatMessageStream(reviewPrompt, undefined, (chunk: string) => {
          reviewResult += chunk;
        });

        const reviewData = parseJsonResponse<Omit<AgentReview, 'id' | 'sessionId' | 'createdAt'>>(reviewResult);
        if (reviewData) {
          currentReviews.push({
            id: Date.now().toString() + i,
            sessionId: 'morning-meeting',
            agentId: agent.id,
            agentName: agent.name,
            role: agent.role,
            round: 1,
            type: 'initial_review',
            summary: reviewData.summary || '',
            details: reviewData.details || '',
            suggestions: reviewData.suggestions || [],
            risks: reviewData.risks || [],
            score: reviewData.score,
            createdAt: new Date().toISOString(),
          });
          setReviews([...currentReviews]);
        }
        setProgress(40 + Math.round((i + 1) / (agentsData?.agents?.length || 1) * 40));
      }

      // Step 4: 生成会议纪要
      setCurrentStep(language === 'zh' ? '正在生成会议纪要...' : 'Generating minutes...');
      const minutesPrompt = buildMinutesPrompt(content, analysisData, agentsData?.agents || [], currentReviews, language);
      let minutesResult = '';
      await sendChatMessageStream(minutesPrompt, undefined, (chunk: string) => {
        minutesResult += chunk;
      });

      const minutesData = parseJsonResponse<MorningMeetingMinutes>(minutesResult);
      if (minutesData) {
        setMinutes(minutesData);
      }
      setProgress(100);
      setCurrentStep(language === 'zh' ? '会议结束' : 'Meeting completed');

    } catch (error: any) {
      console.error('晨会失败:', error);
      alert(error.message || (language === 'zh' ? '会议失败，请重试' : 'Meeting failed, please retry'));
    } finally {
      setIsRunning(false);
    }
  };

  // 导出纪要
  const handleExport = () => {
    if (!minutes) return;

    const exportContent = `
# AI 晨会纪要

## 信息摘要
${minutes.informationSummary}

## 事件类型
${minutes.eventType}

## 专家团队
${minutes.expertTeam.map(a => `- ${a.name}（${a.role}）`).join('\n')}

## 各角色观点
${minutes.roleViews.map(r => `### ${r.agentName}（${r.role}）\n${r.summary}\n建议：${r.suggestions.join('、')}`).join('\n\n')}

## 争议与风险
${minutes.controversies.join('\n')}

## 最终判断
${minutes.finalJudgment}

## 对不同人群的影响
${minutes.impactOnGroups.map(i => `- ${i.group}：${i.impact}\n  建议：${i.advice}`).join('\n')}

## 今日行动建议
${minutes.todayActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}
    `.trim();

    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI晨会纪要_${new Date().toLocaleDateString()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 渲染输入页面
  const renderInputPage = () => (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 功能介绍 */}
      <div style={{
        padding: 16,
        background: 'var(--bg-secondary)',
        borderRadius: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Sunrise size={24} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
            {language === 'zh' ? 'AI 晨会' : 'AI Morning Meeting'}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
          {language === 'zh'
            ? '上传新闻、截图或链接，让 AI 公司为你开一场专家会议'
            : 'Upload news, screenshots or links, let AI company hold an expert meeting for you'}
        </p>
        <div style={{
          padding: 10,
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
        }}>
          {language === 'zh' ? (
            <>每天看到的信息太多，不知道哪些重要？<br/>丢给 AI 晨会，让专家团队帮你判断：<br/>这件事意味着什么，影响谁，有什么机会和风险，你该怎么做。</>
          ) : (
            <>Too much information every day? Let AI experts judge: what it means, who it affects, opportunities and risks, and what you should do.</>
          )}
        </div>
      </div>

      {/* 输入方式切换 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setInputType('text')}
          style={{
            flex: 1,
            padding: 10,
            background: inputType === 'text' ? 'var(--accent)' : 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: 8,
            color: inputType === 'text' ? 'white' : 'var(--text-secondary)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <FileText size={16} />
          {language === 'zh' ? '文字' : 'Text'}
        </button>
        <button
          onClick={() => setInputType('image')}
          style={{
            flex: 1,
            padding: 10,
            background: inputType === 'image' ? 'var(--accent)' : 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: 8,
            color: inputType === 'image' ? 'white' : 'var(--text-secondary)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <ImageIcon size={16} />
          {language === 'zh' ? '图片' : 'Image'}
        </button>
        <button
          onClick={() => setInputType('link')}
          style={{
            flex: 1,
            padding: 10,
            background: inputType === 'link' ? 'var(--accent)' : 'var(--bg-tertiary)',
            border: 'none',
            borderRadius: 8,
            color: inputType === 'link' ? 'white' : 'var(--text-secondary)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <LinkIcon size={16} />
          {language === 'zh' ? '链接' : 'Link'}
        </button>
      </div>

      {/* 输入区域 */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 16 }}>
        {inputType === 'text' && (
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder={language === 'zh' ? '粘贴新闻、资讯、政策原文...' : 'Paste news, information, policy text...'}
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
        )}

        {inputType === 'image' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
            {imageUrl ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={imageUrl}
                  style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'contain' }}
                  alt="uploaded"
                />
                <button
                  onClick={() => setImageUrl(null)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    padding: 4,
                    background: 'rgba(0,0,0,0.5)',
                    border: 'none',
                    borderRadius: 4,
                    color: 'white',
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: 40,
                  background: 'var(--bg-tertiary)',
                  border: '2px dashed var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Upload size={32} />
                <span>{language === 'zh' ? '点击上传截图' : 'Click to upload screenshot'}</span>
              </button>
            )}
          </div>
        )}

        {inputType === 'link' && (
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder={language === 'zh' ? '粘贴新闻链接...' : 'Paste news link...'}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: 13,
            }}
          />
        )}
      </div>

      {/* 会议类型选择 */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {language === 'zh' ? '会议类型' : 'Meeting Type'}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MEETING_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setMeetingType(type.id)}
              style={{
                padding: '6px 10px',
                background: meetingType === type.id ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                border: meetingType === type.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 8,
                color: meetingType === type.id ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{type.icon}</span>
              {type.name}
            </button>
          ))}
        </div>
      </div>

      {/* 示例卡片 */}
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {language === 'zh' ? '示例场景' : 'Example Scenarios'}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {EXAMPLE_SCENARIOS.map((scenario, i) => (
            <button
              key={i}
              onClick={() => {
                setTextContent(scenario.text);
                setInputType('text');
                setMeetingType(scenario.type);
              }}
              style={{
                padding: 10,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                minWidth: 160,
                textAlign: 'left',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 4 }}>
                {MEETING_TYPES.find(t => t.id === scenario.type)?.icon} {MEETING_TYPES.find(t => t.id === scenario.type)?.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {scenario.text}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 开始按钮 */}
      <button
        onClick={handleStartMeeting}
        disabled={isRunning}
        className="btn-primary"
        style={{
          padding: 14,
          fontSize: 15,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {isRunning ? (
          <>
            <RefreshCw size={18} className="spin" />
            {currentStep}
          </>
        ) : (
          <>
            <Play size={18} />
            {language === 'zh' ? '开始开会' : 'Start Meeting'}
          </>
        )}
      </button>
    </div>
  );

  // 渲染进度页面
  const renderProgressPage = () => (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    }}>
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
        <RefreshCw size={36} style={{ color: 'var(--accent)' }} className="spin" />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
        {language === 'zh' ? 'AI 晨会进行中' : 'AI Morning Meeting'}
      </h3>

      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, textAlign: 'center' }}>
        {currentStep}
      </p>

      <div style={{
        width: '100%',
        maxWidth: 300,
        height: 6,
        background: 'var(--bg-tertiary)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'var(--accent)',
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
        {progress}%
      </p>
    </div>
  );

  // 渲染结果页面
  const renderResultPage = () => (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 导出按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleExport}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-secondary)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Download size={14} />
          {language === 'zh' ? '导出纪要' : 'Export'}
        </button>
      </div>

      {/* 信息摘要 */}
      {analysis && (
        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Target size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {language === 'zh' ? '信息摘要' : 'Summary'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {analysis.summary}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 8px', background: 'var(--accent-dim)', borderRadius: 6, fontSize: 11, color: 'var(--accent)' }}>
              {analysis.eventType}
            </span>
            {analysis.keywords?.slice(0, 3).map((kw, i) => (
              <span key={i} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 专家团队 */}
      {agents.length > 0 && (
        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Users size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {language === 'zh' ? '本次专家团队' : 'Expert Team'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {agents.map((agent) => (
              <div key={agent.id} style={{
                padding: '6px 10px',
                background: 'var(--bg-tertiary)',
                borderRadius: 8,
                fontSize: 12,
              }}>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{agent.name}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{agent.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 各角色观点 */}
      {reviews.length > 0 && (
        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            {language === 'zh' ? '各角色观点' : 'Expert Views'}
          </div>
          {reviews.map((review) => (
            <div key={review.id} style={{ marginBottom: 12 }}>
              <div
                onClick={() => setExpandedView(expandedView === review.id ? null : review.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 10,
                  background: 'var(--bg-tertiary)',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <div>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>{review.agentName}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>{review.role}</span>
                </div>
                {expandedView === review.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {expandedView === review.id && (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <p style={{ marginBottom: 8 }}>{review.summary}</p>
                  {review.suggestions.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: 'var(--accent)' }}>{language === 'zh' ? '建议：' : 'Suggestions: '}</span>
                      {review.suggestions.join('、')}
                    </div>
                  )}
                  {review.risks.length > 0 && (
                    <div>
                      <span style={{ color: 'var(--danger)' }}>{language === 'zh' ? '风险：' : 'Risks: '}</span>
                      {review.risks.join('、')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 会议纪要 */}
      {minutes && (
        <>
          {/* 争议与风险 */}
          <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
              <span style={{ fontWeight: 600, color: 'var(--danger)' }}>
                {language === 'zh' ? '争议与风险' : 'Controversies & Risks'}
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              {minutes.controversies.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>

          {/* 最终判断 */}
          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <CheckCircle size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'zh' ? '最终判断' : 'Final Judgment'}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {minutes.finalJudgment}
            </p>
          </div>

          {/* 对不同人群的影响 */}
          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
              {language === 'zh' ? '对不同人群的影响' : 'Impact on Different Groups'}
            </div>
            {minutes.impactOnGroups.map((impact, i) => (
              <div key={i} style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13, marginBottom: 4 }}>{impact.group}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{impact.impact}</div>
                <div style={{ fontSize: 11, color: 'var(--accent)' }}>💡 {impact.advice}</div>
              </div>
            ))}
          </div>

          {/* 今日行动建议 */}
          <div style={{ padding: 16, background: 'var(--accent-dim)', borderRadius: 12, border: '1px solid var(--accent)' }}>
            <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>
              📋 {language === 'zh' ? '今日行动建议' : 'Today\'s Action Items'}
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
              {minutes.todayActions.map((action, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{action}</li>
              ))}
            </ol>
          </div>
        </>
      )}

      {/* 重新开始 */}
      <button
        onClick={() => {
          setMinutes(null);
          setReviews([]);
          setAgents([]);
          setAnalysis(null);
          setProgress(0);
        }}
        style={{
          padding: 12,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}
      >
        {language === 'zh' ? '开始新会议' : 'Start New Meeting'}
      </button>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sunrise size={20} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {language === 'zh' ? 'AI 晨会' : 'AI Morning Meeting'}
          </span>
        </div>
      </div>

      {/* 主内容 */}
      {isRunning ? renderProgressPage() : minutes ? renderResultPage() : renderInputPage()}

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

// JSON 解析辅助函数
function parseJsonResponse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as T;
      } catch {}
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
      } catch {}
    }
    return null;
  }
}

// Prompt 构建函数
function buildAnalysisPrompt(content: string, imageUrl: string | null, meetingType: string, _language: string): string {
  return `你是一个信息分析专家。请分析以下${imageUrl ? '图片' : '内容'}，提取关键信息。

${imageUrl ? '[用户上传了一张图片]' : ''}

内容：
${content}

会议类型：${meetingType === 'auto' ? '自动识别' : meetingType}

请输出 JSON 格式：
{
  "summary": "信息摘要（50字以内）",
  "eventType": "事件类型（如：财经政策、科技动态、健康资讯、法律法规等）",
  "importance": "high | medium | low",
  "affectedGroups": ["受影响人群1", "受影响人群2"],
  "keywords": ["关键词1", "关键词2", "关键词3"],
  "sourceCredibility": "来源可信度评估"
}`;
}

function buildAgentsPrompt(analysis: MorningMeetingAnalysis | null, meetingType: string, _language: string): string {
  return `你是一个组织架构设计专家。请根据以下信息分析结果，组建一个专家团队来进行晨会讨论。

信息分析：
${JSON.stringify(analysis, null, 2)}

会议类型：${meetingType}

要求：
1. 根据事件类型选择合适的专家角色
2. 团队规模 4-6 人
3. 每个角色要有明确的职责和视角
4. 角色要有中文姓名

输出 JSON 格式：
{
  "agents": [
    {
      "id": "agent_1",
      "name": "张明",
      "role": "首席分析师",
      "department": "研究部",
      "personality": "理性客观",
      "background": "10年行业研究经验",
      "responsibilities": ["分析数据", "判断趋势"],
      "focusAreas": ["市场动态", "竞争格局"],
      "speakingStyle": "数据驱动，逻辑清晰",
      "reviewOrder": 1
    }
  ]
}`;
}

function buildReviewPrompt(
  content: string,
  analysis: MorningMeetingAnalysis | null,
  agent: CompanyAgent,
  previousReviews: AgentReview[],
  _language: string
): string {
  return `你现在是晨会专家团队成员。

原始信息：
${content}

信息分析：
${JSON.stringify(analysis, null, 2)}

你的角色：
${JSON.stringify(agent, null, 2)}

前面专家的观点：
${previousReviews.map(r => `【${r.agentName}】${r.summary}`).join('\n') || '无'}

请从你的专业角度发表观点。要求：
1. 站在你的角色立场
2. 结合你的专业背景
3. 给出具体建议和风险提示
4. 如果有不同意见，明确指出

输出 JSON 格式：
{
  "summary": "核心观点（100字以内）",
  "details": "详细分析",
  "suggestions": ["建议1", "建议2"],
  "risks": ["风险1", "风险2"],
  "score": 1-10的重要性评分
}`;
}

function buildMinutesPrompt(
  content: string,
  analysis: MorningMeetingAnalysis | null,
  _agents: CompanyAgent[],
  reviews: AgentReview[],
  _language: string
): string {
  return `你是晨会主持人，请根据讨论结果生成会议纪要。

原始信息：
${content}

信息分析：
${JSON.stringify(analysis, null, 2)}

专家观点：
${reviews.map(r => `【${r.agentName}（${r.role}）】\n${r.summary}\n建议：${r.suggestions.join('、')}\n风险：${r.risks.join('、')}`).join('\n\n')}

请生成完整的会议纪要。输出 JSON 格式：
{
  "informationSummary": "信息摘要",
  "eventType": "事件类型",
  "expertTeam": [...agents],
  "roleViews": [...reviews],
  "controversies": ["争议点1", "争议点2"],
  "risks": ["风险1", "风险2"],
  "finalJudgment": "综合判断（200字以内）",
  "impactOnGroups": [
    {"group": "投资者", "impact": "影响描述", "advice": "建议"},
    {"group": "创业者", "impact": "影响描述", "advice": "建议"}
  ],
  "todayActions": ["行动建议1", "行动建议2", "行动建议3"],
  "followUpSuggestions": ["后续关注点1", "后续关注点2"]
}`;
}
