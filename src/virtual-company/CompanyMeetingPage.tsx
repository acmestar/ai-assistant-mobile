// 公司会议页面 - 使用多模型调度系统
import { useState, useRef } from 'react';
import {
  Sunrise,
  Upload,
  Link as LinkIcon,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  CheckCircle,
  Download,
  Image as ImageIcon,
  FileText,
  CheckSquare,
  Brain,
  Zap,
  Target,
  Briefcase,
  AlertTriangle,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../store';
import {
  AICompany,
  AgentSpeech,
  CompanyMeeting,
  MorningMeetingMinutes,
  SuggestedTask,
  SuggestedMemory,
  CompanyContextSnapshot,
} from './types';
import {
  callModel,
  UserMode,
  clearSessionModels,
  generateSourceSummary,
  GenerationSourceSummary,
  getTaskTypeForAgent,
} from './modelRouter';
import GenerationInfo from './GenerationInfo';
import {
  MeetingTypeId,
  MeetingRecommendation,
  MEETING_TYPES,
  getMeetingTypeConfig,
  getMeetingTypeName,
} from './meetingTypes';
import {
  buildSpeechPrompt,
  buildMinutesPrompt,
  buildMeetingRecommendationPrompt,
  parseRecommendationResult,
} from './meetingPrompts';

interface CompanyMeetingPageProps {
  companyId: string;
  meetingType?: MeetingTypeId;
  onBack: () => void;
}

export default function CompanyMeetingPage({ companyId, meetingType: initialMeetingType, onBack }: CompanyMeetingPageProps) {
  const { language, apiKey, aiCompanies, addCompanyMeeting, addCompanyTask, addCompanyMemory } = useAppStore();
  const company = aiCompanies.find((c: AICompany) => c.id === companyId);

  // 会议类型选择（支持从外部传入初始值）
  const [selectedMeetingType, setSelectedMeetingType] = useState<MeetingTypeId>(initialMeetingType || 'morning');

  // 推荐会议状态
  const [recommendations, setRecommendations] = useState<MeetingRecommendation[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);

  const [inputType, setInputType] = useState<'text' | 'image' | 'link'>('text');
  const [textContent, setTextContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [userMode, setUserMode] = useState<UserMode>('standard');
  const [isRunning, setIsRunning] = useState(false);
  const [agentSpeeches, setAgentSpeeches] = useState<AgentSpeech[]>([]);
  const [minutes, setMinutes] = useState<MorningMeetingMinutes | null>(null);
  const [expandedView, setExpandedView] = useState<string | null>(null);

  // 进度和当前步骤显示
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 确认操作
  const [showTaskConfirm, setShowTaskConfirm] = useState(false);
  const [showMemoryConfirm, setShowMemoryConfirm] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<SuggestedTask[]>([]);
  const [pendingMemories, setPendingMemories] = useState<SuggestedMemory[]>([]);

  // 已保存的会议ID
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);

  // 生成信息
  const [sourceSummary, setSourceSummary] = useState<GenerationSourceSummary | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionIdRef = useRef<string>('');

  if (!company) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        {language === 'zh' ? '公司不存在' : 'Company not found'}
      </div>
    );
  }

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
    e.target.value = '';
  };

  // 推荐会议主题
  const handleRecommendMeetings = async () => {
    if (!apiKey) {
      alert(language === 'zh' ? '请先设置 API Key' : 'Please set API Key first');
      return;
    }

    setIsRecommending(true);
    setRecommendationError(null);
    setRecommendations([]);

    try {
      const contextSnapshot: CompanyContextSnapshot = {
        companyName: company.name,
        purpose: company.purpose,
        industry: company.industry,
        stage: company.stage,
        targetUsers: company.targetUsers,
        products: company.products,
        businessModel: company.businessModel,
        currentGoals: company.goals?.filter(g => g.status === 'active').map(g => g.title),
        currentTasks: company.tasks?.filter(t => t.status !== 'done').map(t => t.title),
        risks: company.risks?.filter(r => r.status === 'active').map(r => r.title),
        agents: company.agents,
      };

      const recentMeetings = (company.meetings || []).slice(-5).map(m => ({
        type: m.type,
        createdAt: m.createdAt,
      }));

      const recentTasks = (company.tasks || []).map(t => ({
        title: t.title,
        status: t.status,
      }));

      const prompt = buildMeetingRecommendationPrompt(contextSnapshot, recentMeetings, recentTasks);

      const result = await callModel<string>(
        'meeting_recommendation',
        { prompt },
        { mode: 'standard', companyId, meetingId: `recommend-${Date.now()}` }
      );

      if (result.success && result.data) {
        const parsed = parseRecommendationResult(result.data);
        if (parsed.length > 0) {
          setRecommendations(parsed);
        } else {
          // 如果解析失败，提供默认推荐
          setRecommendations([
            {
              meetingType: 'morning',
              title: language === 'zh' ? '今日工作安排' : 'Today\'s work planning',
              reason: language === 'zh' ? '明确今日重点任务' : 'Clarify today\'s priorities',
              expectedOutput: language === 'zh' ? '今日任务清单、阻碍、行动' : 'Tasks, blockers, actions',
              priority: 'high',
            },
          ]);
        }
      }
    } catch (error: any) {
      console.error('推荐会议失败:', error);
      setRecommendationError(error.message || (language === 'zh' ? '推荐失败' : 'Recommendation failed'));
    } finally {
      setIsRecommending(false);
    }
  };

  // 点击推荐会议，开始此会议
  const handleStartRecommendedMeeting = (rec: MeetingRecommendation) => {
    setSelectedMeetingType(rec.meetingType);
    setTextContent(rec.title);
    setRecommendations([]);
  };

  // 开始会议
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
    setAgentSpeeches([]);
    setMinutes(null);
    setSourceSummary(null);
    setProgress(0);
    setCurrentStep(language === 'zh' ? '正在初始化...' : 'Initializing...');
    setError(null);

    const sessionId = `meeting-${Date.now()}`;
    sessionIdRef.current = sessionId;
    clearSessionModels(sessionId);

    try {
      // Step 1: 读取公司上下文
      setProgress(5);
      setCurrentStep(language === 'zh' ? '正在读取公司档案...' : 'Loading company profile...');
      const contextSnapshot: CompanyContextSnapshot = {
        companyName: company.name,
        purpose: company.purpose,
        industry: company.industry,
        stage: company.stage,
        targetUsers: company.targetUsers,
        products: company.products,
        businessModel: company.businessModel,
        currentGoals: company.goals?.filter(g => g.status === 'active').map(g => g.title),
        currentTasks: company.tasks?.filter(t => t.status !== 'done').map(t => t.title),
        risks: company.risks?.filter(r => r.status === 'active').map(r => r.title),
        agents: company.agents,
      };
      setProgress(10);
      setCurrentStep(language === 'zh' ? '正在加载公司目标...' : 'Loading company goals...');

      // Step 2: 检索相关记忆
      setProgress(15);
      setCurrentStep(language === 'zh' ? '正在检索相关公司记忆...' : 'Retrieving relevant memories...');
      const relatedMemories = (company.memories || []).slice(-5);

      // Step 3: 提取内容（图片需要识别）
      let extractedContent = content;
      if (inputType === 'image' && imageUrl) {
        setProgress(20);
        setCurrentStep(language === 'zh' ? '正在识别图片内容...' : 'Analyzing image...');
        const imageResult = await callModel<string>(
          'image_understanding',
          {
            prompt: '请识别并提取这张图片中的文字内容、标题、来源、关键数据和图表含义。直接输出提取的内容，不要添加解释。',
            imageUrl,
          },
          { mode: userMode, companyId, meetingId: sessionId }
        );
        if (imageResult.success && imageResult.data) {
          extractedContent = imageResult.data;
        }
      }

      // Step 4: 内容摘要
      setProgress(25);
      setCurrentStep(language === 'zh' ? '正在整理信息摘要...' : 'Summarizing...');
      await callModel<string>(
        'content_summary',
        {
          prompt: `请总结以下内容的核心要点（100字以内）：\n\n${extractedContent}`,
        },
        { mode: userMode, companyId, meetingId: sessionId }
      );

      // Step 5-10: 各角色发言
      const agents = company.agents || [];
      const currentSpeeches: AgentSpeech[] = [];

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];

        const progressPercent = 30 + Math.round((i / agents.length) * 50);
        setProgress(progressPercent);
        setCurrentStep(`${agent.name}（${agent.role}）正在发言...`);

        const taskType = getTaskTypeForAgent(agent, selectedMeetingType);

        // 使用新的 buildSpeechPrompt 函数
        const speechPrompt = buildSpeechPrompt(
          extractedContent,
          contextSnapshot,
          relatedMemories,
          selectedMeetingType,
          agent.name,
          agent.role,
          currentSpeeches
        );

        const speechResult = await callModel<Omit<AgentSpeech, 'agentId' | 'agentName' | 'role' | 'createdAt'>>(
          taskType,
          {
            prompt: speechPrompt,
            systemPrompt: `你是${agent.name}，${agent.role}，${agent.background}。
性格特点：${agent.personality}
说话风格：${agent.speakingStyle}
关注领域：${agent.focusAreas?.join('、')}
职责：${agent.responsibilities?.join('、')}

请从你的专业角度发表观点，输出 JSON 格式：
{
  "content": "核心观点（150字以内）",
  "suggestions": ["建议1", "建议2"],
  "risks": ["风险1", "风险2"]
}`,
          },
          { mode: userMode, companyId, meetingId: sessionId, requireJson: true }
        );

        if (speechResult.success && speechResult.data) {
          currentSpeeches.push({
            agentId: agent.id,
            agentName: agent.name,
            role: agent.role,
            content: speechResult.data.content || '',
            suggestions: speechResult.data.suggestions || [],
            risks: speechResult.data.risks || [],
            createdAt: new Date().toISOString(),
          });
          setAgentSpeeches([...currentSpeeches]);
        }
      }

      // Step 11: 生成会议纪要
      setProgress(85);
      const meetingName = getMeetingTypeName(selectedMeetingType, language as 'zh' | 'en');
      setCurrentStep(language === 'zh' ? `正在生成${meetingName}纪要...` : `Generating ${meetingName} minutes...`);

      // 使用新的 buildMinutesPrompt 函数
      const minutesPrompt = buildMinutesPrompt(
        extractedContent,
        contextSnapshot,
        relatedMemories,
        currentSpeeches,
        selectedMeetingType
      );

      const minutesResult = await callModel<MorningMeetingMinutes>(
        'final_report_synthesis',
        {
          prompt: minutesPrompt,
          systemPrompt: `你是会议主持人，请根据讨论结果生成会议纪要。严格按照指定的 JSON 格式输出。`,
        },
        { mode: userMode, companyId, meetingId: sessionId, requireJson: true }
      );

      if (minutesResult.success && minutesResult.data) {
        setMinutes(minutesResult.data);

        // 构建公司当前状态上下文
        const currentGoals = company.goals?.filter(g => g.status === 'active') || [];
        const currentRisks = company.risks?.filter(r => r.status === 'active') || [];
        const currentTasks = company.tasks?.filter(t => t.status !== 'done') || [];

        // 提取任务和记忆（增强版：包含关联分析）
        const taskExtractionResult = await callModel<{ tasks: SuggestedTask[] }>(
          'task_extraction',
          {
            prompt: `根据以下会议讨论内容，提取建议的任务，并分析任务与公司目标、风险的关联。

## 会议讨论内容
${JSON.stringify(minutesResult.data, null, 2)}

${currentSpeeches.map(s => `【${s.agentName}】${s.content}`).join('\n')}

## 公司当前目标
${currentGoals.length > 0 ? currentGoals.map(g => `- ${g.title}: ${g.description || ''}`).join('\n') : '暂无活跃目标'}

## 公司当前风险
${currentRisks.length > 0 ? currentRisks.map(r => `- ${r.title}: ${r.description || ''}`).join('\n') : '暂无活跃风险'}

## 公司待办任务
${currentTasks.length > 0 ? currentTasks.map(t => `- ${t.title}`).join('\n') : '暂无待办任务'}

## 输出要求
输出 JSON 格式，每个任务需分析：
1. 是否与某个目标相关（relatedGoalTitle 填目标标题）
2. 是否与某个风险相关（relatedRiskTitle 填风险标题）
3. 建议分配给哪个角色负责（assigneeRole）
4. 建议多少天内完成（dueInDays）

{
  "tasks": [
    {
      "id": "task-1",
      "title": "任务标题",
      "description": "任务描述",
      "priority": "high" | "medium" | "low",
      "relatedGoalTitle": "关联的目标标题（无则不填）",
      "relatedRiskTitle": "关联的风险标题（无则不填）",
      "assigneeRole": "建议负责的角色",
      "dueInDays": 7
    }
  ]
}`,
          },
          { mode: userMode, companyId, meetingId: sessionId, requireJson: true }
        );

        const memoryExtractionResult = await callModel<{ memories: SuggestedMemory[] }>(
          'memory_extraction',
          {
            prompt: `根据以下会议讨论内容，提取应该写入公司长期记忆的内容：\n\n${JSON.stringify(minutesResult.data)}\n\n输出 JSON 格式：\n{\n  "memories": [\n    { "id": "memory-1", "type": "strategy" | "market" | "product" | "risk" | "user" | "decision" | "meeting_summary", "content": "记忆内容", "importance": "high" | "medium" | "low" }\n  ]\n}`,
          },
          { mode: userMode, companyId, meetingId: sessionId, requireJson: true }
        );

        const extractedTasks = taskExtractionResult.success && taskExtractionResult.data?.tasks
          ? taskExtractionResult.data.tasks : [];
        const extractedMemories = memoryExtractionResult.success && memoryExtractionResult.data?.memories
          ? memoryExtractionResult.data.memories : [];

        setPendingTasks(extractedTasks);
        setPendingMemories(extractedMemories);

        const summary2 = generateSourceSummary(sessionId, userMode, 'gpt-5.5');
        setSourceSummary(summary2);

        const lightAgents = company.agents?.map(a => ({
          id: a.id,
          name: a.name,
          role: a.role,
          department: a.department,
          responsibilities: a.responsibilities,
        }));

        const meetingId = `meeting-${Date.now()}`;
        const meeting: CompanyMeeting = {
          id: meetingId,
          companyId,
          type: selectedMeetingType,
          inputType,
          rawInput: inputType === 'text' ? textContent : inputType === 'image' ? imageUrl || '' : linkUrl,
          extractedContent: textContent,
          companyContextSnapshot: {
            companyName: company.name,
            purpose: company.purpose,
            industry: company.industry,
            stage: company.stage,
            targetUsers: company.targetUsers,
            products: company.products,
            businessModel: company.businessModel,
            agents: lightAgents,
          },
          relatedMemories: (company.memories || []).slice(-5),
          agentSpeeches: currentSpeeches,
          result: minutesResult.data,
          suggestedTasks: extractedTasks,
          suggestedMemories: extractedMemories,
          confirmedTaskIds: [],
          confirmedMemoryIds: [],
          generationSourceSummary: summary2,
          createdAt: new Date().toISOString(),
        };

        addCompanyMeeting(companyId, meeting);
        setSavedMeetingId(meetingId);
        setProgress(100);
        setCurrentStep(language === 'zh' ? '会议完成' : 'Meeting completed');
      }

    } catch (error: any) {
      console.error('会议失败:', error);
      setError(error.message || (language === 'zh' ? '会议失败，请重试' : 'Meeting failed, please retry'));
      setProgress(0);
      setCurrentStep('');
    } finally {
      setIsRunning(false);
    }
  };

  // 用户确认任务和记忆后更新会议
  const handleConfirmTasksAndMemories = () => {
    if (!savedMeetingId) return;

    const meeting = company.meetings?.find(m => m.id === savedMeetingId);
    if (!meeting) return;

    const updatedMeeting: CompanyMeeting = {
      ...meeting,
      suggestedTasks: pendingTasks,
      suggestedMemories: pendingMemories,
      confirmedTaskIds: showTaskConfirm ? pendingTasks.map(t => t.id) : [],
      confirmedMemoryIds: showMemoryConfirm ? pendingMemories.map(m => m.id) : [],
      updatedAt: new Date().toISOString(),
    };

    addCompanyMeeting(companyId, updatedMeeting);

    if (showTaskConfirm && pendingTasks.length > 0) {
      pendingTasks.forEach(task => {
        // 查找关联的目标和风险
        const relatedGoal = task.relatedGoalTitle
          ? company.goals?.find(g => g.title.includes(task.relatedGoalTitle!) || task.relatedGoalTitle!.includes(g.title))
          : undefined;
        const relatedRisk = task.relatedRiskTitle
          ? company.risks?.find(r => r.title.includes(task.relatedRiskTitle!) || task.relatedRiskTitle!.includes(r.title))
          : undefined;

        // 查找建议分配的角色
        const assignee = task.assigneeRole
          ? company.agents?.find(a => a.role.includes(task.assigneeRole!) || task.assigneeRole!.includes(a.role))
          : undefined;

        // 计算截止日期
        const dueDate = task.dueInDays
          ? new Date(Date.now() + task.dueInDays * 24 * 60 * 60 * 1000).toISOString()
          : undefined;

        const companyTask = {
          ...task,
          companyId,
          relatedGoalId: relatedGoal?.id,
          relatedRiskIds: relatedRisk ? [relatedRisk.id] : [],
          assigneeId: assignee?.id,
          dueDate,
          status: 'todo' as const,
          sourceMeetingId: savedMeetingId,
          createdAt: new Date().toISOString(),
        };
        addCompanyTask(companyId, companyTask);
      });
    }
    if (showMemoryConfirm && pendingMemories.length > 0) {
      pendingMemories.forEach(memory => {
        const companyMemory = {
          ...memory,
          companyId,
          sourceMeetingId: savedMeetingId,
          createdAt: new Date().toISOString(),
        };
        addCompanyMemory(companyId, companyMemory);
      });
    }

    onBack();
  };

  // 导出纪要
  const handleExport = () => {
    if (!minutes) return;

    const meetingName = getMeetingTypeName(selectedMeetingType, language as 'zh' | 'en');

    const exportContent = `
# ${company.name} - ${meetingName}

## 公司背景
- 使命：${company.purpose}
- 行业：${company.industry || '未指定'}
- 阶段：${company.stage || '未指定'}

## 信息摘要
${minutes.informationSummary}

## 机会
${minutes.opportunities?.map((o, i) => `${i + 1}. ${o}`).join('\n') || '无'}

## 风险
${minutes.risks?.map((r, i) => `${i + 1}. ${r}`).join('\n') || '无'}

## 各角色发言
${agentSpeeches.map(s => `### ${s.agentName}（${s.role}）\n${s.content}\n建议：${s.suggestions.join('、')}\n风险：${s.risks.join('、')}`).join('\n\n')}

## 今日行动
${minutes.todayActions?.map((a, i) => `${i + 1}. ${a}`).join('\n') || '无'}
    `.trim();

    const blob = new Blob([exportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${company.name}_${meetingName}_${new Date().toLocaleDateString()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 渲染会议类型选择
  const renderMeetingTypeSelector = () => (
    <div style={{
      background: 'var(--bg-secondary)',
      borderRadius: 12,
      padding: 12,
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {language === 'zh' ? '会议类型' : 'Meeting Type'}
        </span>
        <button
          onClick={handleRecommendMeetings}
          disabled={isRecommending}
          style={{
            padding: '4px 10px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent)',
            borderRadius: 6,
            color: 'var(--accent)',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: isRecommending ? 'wait' : 'pointer',
            opacity: isRecommending ? 0.7 : 1,
          }}
        >
          {isRecommending ? (
            <RefreshCw size={12} className="spin" />
          ) : (
            <Lightbulb size={12} />
          )}
          {language === 'zh' ? '推荐会议' : 'Recommend'}
        </button>
      </div>

      {/* 会议类型卡片 - 响应式布局 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
        gap: 8,
      }}>
        {MEETING_TYPES.map((mt) => (
          <button
            key={mt.id}
            onClick={() => setSelectedMeetingType(mt.id)}
            style={{
              padding: 10,
              background: selectedMeetingType === mt.id ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
              border: selectedMeetingType === mt.id ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              minWidth: 0,
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
          >
            <span style={{ fontSize: 18 }}>{mt.icon}</span>
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              color: selectedMeetingType === mt.id ? 'var(--accent)' : 'var(--text-primary)',
              textAlign: 'center',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              maxWidth: '100%',
            }}>
              {language === 'zh' ? mt.nameZh : mt.nameEn}
            </span>
          </button>
        ))}
      </div>

      {/* 当前选中会议类型说明 */}
      {(() => {
        const config = getMeetingTypeConfig(selectedMeetingType);
        if (!config) return null;
        return (
          <div style={{
            marginTop: 10,
            padding: 10,
            background: 'var(--bg-tertiary)',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              {language === 'zh' ? config.descriptionZh : config.descriptionEn}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              📋 {language === 'zh' ? '产出：' : 'Output: '}{language === 'zh' ? config.outputZh : config.outputEn}
            </div>
          </div>
        );
      })()}
    </div>
  );

  // 渲染推荐会议结果
  const renderRecommendations = () => {
    if (recommendations.length === 0 && !recommendationError) return null;

    return (
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        padding: 12,
        border: '1px solid var(--accent)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}>
          <Sparkles size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
            {language === 'zh' ? '推荐会议主题' : 'Recommended Meetings'}
          </span>
          <button
            onClick={() => setRecommendations([])}
            style={{
              marginLeft: 'auto',
              padding: 2,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {recommendationError && (
          <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>
            {recommendationError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {recommendations.map((rec, index) => {
            const config = getMeetingTypeConfig(rec.meetingType);
            return (
              <div
                key={index}
                style={{
                  padding: 12,
                  background: 'var(--bg-tertiary)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 16 }}>{config?.icon || '📅'}</span>
                  <span style={{
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    flex: 1,
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}>
                    {rec.title}
                  </span>
                  {rec.priority && (
                    <span style={{
                      padding: '2px 6px',
                      background: rec.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
                      borderRadius: 4,
                      fontSize: 10,
                      color: rec.priority === 'high' ? 'var(--danger)' : 'var(--text-muted)',
                    }}>
                      {rec.priority}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {rec.reason}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  📋 {rec.expectedOutput}
                </div>
                <button
                  onClick={() => handleStartRecommendedMeeting(rec)}
                  style={{
                    width: '100%',
                    padding: 8,
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 6,
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {language === 'zh' ? '开始此会议' : 'Start This Meeting'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 渲染输入页面
  const renderInputPage = () => (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 公司信息 */}
      <div style={{
        padding: 12,
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {company.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {company.purpose}
        </div>
      </div>

      {/* 会议类型选择 */}
      {renderMeetingTypeSelector()}

      {/* 推荐会议结果 */}
      {renderRecommendations()}

      {/* 生成模式选择 */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        padding: 12,
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
          {language === 'zh' ? '生成模式' : 'Generation Mode'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { mode: 'fast' as UserMode, icon: Zap, label: language === 'zh' ? '快速' : 'Fast' },
            { mode: 'standard' as UserMode, icon: Target, label: language === 'zh' ? '标准' : 'Standard' },
            { mode: 'deep' as UserMode, icon: Briefcase, label: language === 'zh' ? '深度' : 'Deep' },
          ].map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setUserMode(mode)}
              style={{
                flex: 1,
                padding: 8,
                background: userMode === mode ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                border: userMode === mode ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                color: userMode === mode ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 12,
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
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
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 12 }}>
        {inputType === 'text' && (
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder={language === 'zh' ? '输入会议议题、问题或讨论内容...' : 'Enter meeting topic, question or content...'}
            style={{
              width: '100%',
              minHeight: 100,
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
            placeholder={language === 'zh' ? '粘贴链接...' : 'Paste link...'}
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
            {language === 'zh' ? '会议进行中...' : 'Meeting in progress...'}
          </>
        ) : (
          <>
            <Play size={18} />
            {language === 'zh' ? '开始开会' : 'Start Meeting'}
          </>
        )}
      </button>

      {/* 历史会议记录 */}
      {company.meetings && company.meetings.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 12,
          border: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {language === 'zh' ? '历史会议记录' : 'Meeting History'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {company.meetings.length} {language === 'zh' ? '场' : 'meetings'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {company.meetings.slice(-5).reverse().map((meeting) => {
              const meetingConfig = getMeetingTypeConfig(meeting.type as MeetingTypeId);
              return (
                <div
                  key={meeting.id}
                  style={{
                    padding: 10,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                  }}>
                    <span style={{ fontSize: 14 }}>{meetingConfig?.icon || '📅'}</span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {meeting.extractedContent || (language === 'zh' ? '无主题' : 'No topic')}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(meeting.createdAt).toLocaleDateString()} {new Date(meeting.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {meetingConfig ? (language === 'zh' ? meetingConfig.nameZh : meetingConfig.nameEn) : meeting.type}
                  </div>
                  {meeting.result?.informationSummary && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      marginTop: 6,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical' as const,
                    }}>
                      {meeting.result.informationSummary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // 渲染进度页面
  const renderProgressPage = () => (
    <div style={{
      flex: 1,
      minHeight: 0,
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    }}>
      {error ? (
        <>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}>
            <AlertTriangle size={36} style={{ color: 'var(--danger)' }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--danger)' }}>
            {language === 'zh' ? '会议出错' : 'Meeting Error'}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, textAlign: 'center', maxWidth: 300 }}>
            {error}
          </p>
          <button
            onClick={() => {
              setError(null);
              setProgress(0);
              setCurrentStep('');
            }}
            style={{
              padding: '12px 24px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: 'white',
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {language === 'zh' ? '重新开始' : 'Retry'}
          </button>
        </>
      ) : (
        <>
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
            {getMeetingTypeName(selectedMeetingType, language as 'zh' | 'en')} {language === 'zh' ? '进行中' : 'in Progress'}
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
        </>
      )}
    </div>
  );

  // 渲染结果页面
  const renderResultPage = () => (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
          {language === 'zh' ? '导出' : 'Export'}
        </button>
      </div>

      {/* 信息摘要 */}
      {minutes && (
        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sunrise size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {language === 'zh' ? '会议摘要' : 'Meeting Summary'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {minutes.informationSummary}
          </p>
        </div>
      )}

      {/* 各角色发言 */}
      {agentSpeeches.length > 0 && (
        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            {language === 'zh' ? '各部门观点' : 'Department Views'}
          </div>
          {agentSpeeches.map((speech) => (
            <div key={speech.agentId} style={{ marginBottom: 12 }}>
              <div
                onClick={() => setExpandedView(expandedView === speech.agentId ? null : speech.agentId)}
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
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>{speech.agentName}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 6 }}>{speech.role}</span>
                </div>
                {expandedView === speech.agentId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {expandedView === speech.agentId && (
                <div style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <p style={{ marginBottom: 8 }}>{speech.content}</p>
                  {speech.suggestions.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: 'var(--accent)' }}>{language === 'zh' ? '建议：' : 'Suggestions: '}</span>
                      {speech.suggestions.join('、')}
                    </div>
                  )}
                  {speech.risks.length > 0 && (
                    <div>
                      <span style={{ color: 'var(--danger)' }}>{language === 'zh' ? '风险：' : 'Risks: '}</span>
                      {speech.risks.join('、')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 机会与风险 */}
      {minutes && (
        <>
          <div style={{ padding: 16, background: 'rgba(16, 185, 129, 0.05)', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>
              💡 {language === 'zh' ? '机会清单' : 'Opportunities'}
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              {minutes.opportunities?.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>

          <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
              ⚠️ {language === 'zh' ? '风险清单' : 'Risks'}
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
              {minutes.risks?.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </>
      )}

      {/* 今日行动 */}
      {minutes && minutes.todayActions?.length > 0 && (
        <div style={{ padding: 16, background: 'var(--accent-dim)', borderRadius: 12, border: '1px solid var(--accent)' }}>
          <div style={{ fontWeight: 600, color: 'var(--accent)', marginBottom: 12 }}>
            📋 {language === 'zh' ? '行动项' : 'Action Items'}
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)' }}>
            {minutes.todayActions.map((action, i) => (
              <li key={i} style={{ marginBottom: 6 }}>{action}</li>
            ))}
          </ol>
        </div>
      )}

      {/* 建议新增任务 */}
      {pendingTasks.length > 0 && (
        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={16} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'zh' ? '建议新增任务' : 'Suggested Tasks'}
              </span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={showTaskConfirm}
                onChange={(e) => setShowTaskConfirm(e.target.checked)}
              />
              {language === 'zh' ? '保存到公司' : 'Save to company'}
            </label>
          </div>
          {pendingTasks.map((task) => (
            <div key={task.id} style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{task.title}</div>
              {task.description && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{task.description}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 建议新增记忆 */}
      {pendingMemories.length > 0 && (
        <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Brain size={16} style={{ color: 'var(--accent-orange)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'zh' ? '建议新增记忆' : 'Suggested Memories'}
              </span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={showMemoryConfirm}
                onChange={(e) => setShowMemoryConfirm(e.target.checked)}
              />
              {language === 'zh' ? '保存到公司' : 'Save to company'}
            </label>
          </div>
          {pendingMemories.map((memory) => (
            <div key={memory.id} style={{ padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{memory.content}</div>
            </div>
          ))}
        </div>
      )}

      {/* 生成信息 */}
      {sourceSummary && (
        <GenerationInfo sourceSummary={sourceSummary} language={language} />
      )}

      {/* 保存按钮 */}
      <button
        onClick={handleConfirmTasksAndMemories}
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
        <CheckCircle size={18} />
        {language === 'zh' ? '保存会议结果' : 'Save Meeting Result'}
      </button>
    </div>
  );

  const meetingName = getMeetingTypeName(selectedMeetingType, language as 'zh' | 'en');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            padding: 6,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sunrise size={20} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {meetingName}
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
