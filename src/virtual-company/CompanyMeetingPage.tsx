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
} from 'lucide-react';
import { useAppStore } from '../store';
import {
  AICompany,
  CompanyAgent,
  AgentSpeech,
  CompanyMeeting,
  MorningMeetingMinutes,
  SuggestedTask,
  SuggestedMemory,
  CompanyContextSnapshot,
  CompanyMemory,
} from './types';
import {
  callModel,
  UserMode,
  clearSessionModels,
  generateSourceSummary,
  GenerationSourceSummary,
  getTaskTypeForAgent,
} from './modelRouter';
import MeetingProgress, { getMorningMeetingSteps, ProgressStep } from './MeetingProgress';
import GenerationInfo from './GenerationInfo';

interface CompanyMeetingPageProps {
  companyId: string;
  meetingType: 'morning' | 'strategy' | 'review' | 'risk' | 'retrospective';
  onBack: () => void;
}

export default function CompanyMeetingPage({ companyId, meetingType, onBack }: CompanyMeetingPageProps) {
  const { language, apiKey, aiCompanies, addCompanyMeeting, addCompanyTask, addCompanyMemory } = useAppStore();
  const company = aiCompanies.find((c: AICompany) => c.id === companyId);

  const [inputType, setInputType] = useState<'text' | 'image' | 'link'>('text');
  const [textContent, setTextContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [userMode, setUserMode] = useState<UserMode>('standard');
  const [isRunning, setIsRunning] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [agentSpeeches, setAgentSpeeches] = useState<AgentSpeech[]>([]);
  const [minutes, setMinutes] = useState<MorningMeetingMinutes | null>(null);
  const [expandedView, setExpandedView] = useState<string | null>(null);

  // 确认操作
  const [showTaskConfirm, setShowTaskConfirm] = useState(false);
  const [showMemoryConfirm, setShowMemoryConfirm] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<SuggestedTask[]>([]);
  const [pendingMemories, setPendingMemories] = useState<SuggestedMemory[]>([]);

  // 已保存的会议ID（会议生成完成后立即保存，用户确认后更新）
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

  const meetingTypeLabels = {
    morning: language === 'zh' ? '晨会' : 'Morning Meeting',
    strategy: language === 'zh' ? '战略会' : 'Strategy Meeting',
    review: language === 'zh' ? '项目评审' : 'Project Review',
    risk: language === 'zh' ? '风险会' : 'Risk Meeting',
    retrospective: language === 'zh' ? '复盘会' : 'Retrospective',
  };

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

  // 更新进度步骤
  const updateStep = (stepId: string, status: ProgressStep['status'], message?: string) => {
    setProgressSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, status, message } : step
    ));
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

    // 初始化进度步骤
    const steps = getMorningMeetingSteps(language);
    setProgressSteps(steps);

    // 创建会话 ID
    const sessionId = `meeting-${Date.now()}`;
    sessionIdRef.current = sessionId;
    clearSessionModels(sessionId);

    try {
      // Step 1: 读取公司上下文
      updateStep('context', 'running', language === 'zh' ? '正在读取公司档案...' : 'Loading company profile...');
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
      updateStep('context', 'completed');
      updateStep('goals', 'running', language === 'zh' ? '正在加载公司目标...' : 'Loading company goals...');
      updateStep('goals', 'completed');

      // Step 2: 检索相关记忆
      updateStep('memories', 'running', language === 'zh' ? '正在检索相关公司记忆...' : 'Retrieving relevant memories...');
      const relatedMemories = (company.memories || []).slice(-5);
      updateStep('memories', 'completed');

      // Step 3: 提取内容（图片需要识别）
      let extractedContent = content;
      if (inputType === 'image' && imageUrl) {
        updateStep('image', 'running', language === 'zh' ? '正在识别图片内容...' : 'Analyzing image...');
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
        updateStep('image', 'completed');
      } else {
        updateStep('image', 'completed');
      }

      // Step 4: 内容摘要
      updateStep('summary', 'running', language === 'zh' ? '正在整理今日信息摘要...' : 'Summarizing...');
      await callModel<string>(
        'content_summary',
        {
          prompt: `请总结以下内容的核心要点（100字以内）：

${extractedContent}`,
        },
        { mode: userMode, companyId, meetingId: sessionId }
      );
      updateStep('summary', 'completed');

      // Step 5-10: 各角色发言（使用 getTaskTypeForAgent 动态分配）
      const agents = company.agents || [];
      const currentSpeeches: AgentSpeech[] = [];

      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const stepId = ['strategy', 'opportunity', 'technical', 'risk', 'opposition', 'final'][i] || 'final';

        updateStep(stepId, 'running', `${agent.name}（${agent.role}）正在发言...`);

        // 使用 getTaskTypeForAgent 动态获取 TaskType
        const taskType = getTaskTypeForAgent(agent, meetingType);

        const speechPrompt = buildSpeechPrompt(
          extractedContent,
          contextSnapshot,
          relatedMemories,
          agent,
          currentSpeeches,
          meetingType
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

        updateStep(stepId, 'completed');
      }

      // Step 11: 生成会议纪要
      updateStep('final', 'running', language === 'zh' ? '正在整合最终晨会纪要...' : 'Synthesizing final minutes...');
      const minutesPrompt = buildMinutesPrompt(
        extractedContent,
        contextSnapshot,
        relatedMemories,
        currentSpeeches,
        meetingType
      );

      const minutesResult = await callModel<MorningMeetingMinutes>(
        'final_report_synthesis',
        {
          prompt: minutesPrompt,
          systemPrompt: `你是会议主持人，请根据讨论结果生成会议纪要。
输出 JSON 格式，包含：
- meetingType: "morning"
- informationSummary: 信息摘要（100字以内）
- relevanceLevel: "high" | "medium" | "low"
- relevanceReason: 关联度判断理由
- goalImpact: [{ goal: "目标名称", impact: "影响描述", direction: "positive" | "negative" | "neutral" | "uncertain" }]
- businessImpact: { product?: "产品影响", user?: "用户影响", market?: "市场影响", competition?: "竞争影响", businessModel?: "商业模式影响", technical?: "技术影响", execution?: "执行影响", cost?: "成本影响", resource?: "资源影响", risk?: "风险影响" }
- opportunities: ["机会1", "机会2"]
- risks: ["风险1", "风险2"]
- actions: ["行动1", "行动2"]
- todayFocus: ["今日重点1", "今日重点2"]`,
        },
        { mode: userMode, companyId, meetingId: sessionId, requireJson: true }
      );

      if (minutesResult.success && minutesResult.data) {
        setMinutes(minutesResult.data);

        // 从会议纪要中提取建议任务和记忆
        // 注意：这里使用单独的 AI 调用来提取任务和记忆
        const taskExtractionResult = await callModel<{ tasks: SuggestedTask[] }>(
          'task_extraction',
          {
            prompt: `根据以下会议讨论内容，提取建议的任务：

${JSON.stringify(minutesResult.data)}

${currentSpeeches.map(s => `【${s.agentName}】${s.content}`).join('\n')}

输出 JSON 格式：
{
  "tasks": [
    { "id": "task-1", "title": "任务标题", "description": "任务描述", "priority": "high" | "medium" | "low" }
  ]
}`,
          },
          { mode: userMode, companyId, meetingId: sessionId, requireJson: true }
        );

        const memoryExtractionResult = await callModel<{ memories: SuggestedMemory[] }>(
          'memory_extraction',
          {
            prompt: `根据以下会议讨论内容，提取应该写入公司长期记忆的内容：

${JSON.stringify(minutesResult.data)}

输出 JSON 格式：
{
  "memories": [
    { "id": "memory-1", "type": "strategy" | "market" | "product" | "risk" | "user" | "decision" | "meeting_summary", "content": "记忆内容", "importance": "high" | "medium" | "low" }
  ]
}`,
          },
          { mode: userMode, companyId, meetingId: sessionId, requireJson: true }
        );

        // 提取任务和记忆
        const extractedTasks = taskExtractionResult.success && taskExtractionResult.data?.tasks
          ? taskExtractionResult.data.tasks : [];
        const extractedMemories = memoryExtractionResult.success && memoryExtractionResult.data?.memories
          ? memoryExtractionResult.data.memories : [];

        setPendingTasks(extractedTasks);
        setPendingMemories(extractedMemories);

        updateStep('final', 'completed');

        // 生成来源摘要
        const summary2 = generateSourceSummary(sessionId, userMode, 'gpt-5.5');
        setSourceSummary(summary2);

        // 会议生成完成后立即保存（此时 confirmedTaskIds 和 confirmedMemoryIds 为空）
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
          type: meetingType,
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
      }

    } catch (error: any) {
      console.error('会议失败:', error);
      alert(error.message || (language === 'zh' ? '会议失败，请重试' : 'Meeting failed, please retry'));
    } finally {
      setIsRunning(false);
    }
  };

  // 用户确认任务和记忆后更新会议
  const handleConfirmTasksAndMemories = () => {
    if (!savedMeetingId) return;

    // 更新会议的 confirmedTaskIds 和 confirmedMemoryIds
    const meeting = company.meetings?.find(m => m.id === savedMeetingId);
    if (!meeting) return;

    // 更新会议的确认字段
    const updatedMeeting: CompanyMeeting = {
      ...meeting,
      suggestedTasks: pendingTasks,
      suggestedMemories: pendingMemories,
      confirmedTaskIds: showTaskConfirm ? pendingTasks.map(t => t.id) : [],
      confirmedMemoryIds: showMemoryConfirm ? pendingMemories.map(m => m.id) : [],
      updatedAt: new Date().toISOString(),
    };

    // 更新会议记录
    addCompanyMeeting(companyId, updatedMeeting);

    // 如果有确认的任务和记忆，转换成正式的 CompanyTask 和 CompanyMemory 并保存
    if (showTaskConfirm && pendingTasks.length > 0) {
      pendingTasks.forEach(task => {
        const companyTask = {
          ...task,
          companyId,
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

    const exportContent = `
# ${company.name} - ${meetingTypeLabels[meetingType]}

## 公司背景
- 使命：${company.purpose}
- 行业：${company.industry || '未指定'}
- 阶段：${company.stage || '未指定'}

## 信息摘要
${minutes.informationSummary}

## 与公司的关联度
${minutes.relevanceLevel} - ${minutes.relevanceReason}

## 对公司目标的影响
${minutes.goalImpact?.map(g => `- ${g.goal}：${g.impact}（${g.direction}）`).join('\n') || '无'}

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
    a.download = `${company.name}_${meetingTypeLabels[meetingType]}_${new Date().toLocaleDateString()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 渲染输入页面
  const renderInputPage = () => (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 公司信息 */}
      <div style={{
        padding: 16,
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          {company.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {company.purpose}
        </div>
      </div>

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
    </div>
  );

  // 渲染进度页面
  const renderProgressPage = () => (
    <MeetingProgress
      steps={progressSteps}
      companyName={company.name}
      meetingType={meetingType}
      language={language}
    />
  );

  // 渲染结果页面
  const renderResultPage = () => (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              {language === 'zh' ? '今日信息摘要' : 'Today\'s Summary'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {minutes.informationSummary}
          </p>
          <div style={{ marginTop: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {language === 'zh' ? '与公司关联度：' : 'Relevance: '}
            </span>
            <span style={{
              padding: '2px 8px',
              background: minutes.relevanceLevel === 'high' ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
              borderRadius: 6,
              fontSize: 11,
              color: minutes.relevanceLevel === 'high' ? 'var(--accent)' : 'var(--text-muted)',
            }}>
              {minutes.relevanceLevel}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {minutes.relevanceReason}
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
            📋 {language === 'zh' ? '今日行动' : 'Today\'s Actions'}
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
            {meetingTypeLabels[meetingType]}
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

// Prompt 构建函数
function buildSpeechPrompt(
  content: string,
  contextSnapshot: CompanyContextSnapshot,
  relatedMemories: CompanyMemory[],
  _agent: CompanyAgent,
  previousSpeeches: AgentSpeech[],
  _meetingType: string
): string {
  return `你是公司晨会专家团队成员，正在参加晨会。

公司背景：
${JSON.stringify(contextSnapshot, null, 2)}

相关记忆：
${relatedMemories.map(m => `- [${m.type}] ${m.content}`).join('\n') || '无'}

原始信息：
${content}

前面专家的观点：
${previousSpeeches.map(s => `【${s.agentName}】${s.content}`).join('\n') || '无'}

请从你的专业角度发表观点。要求：
1. 站在你的角色立场，结合公司背景分析这条信息对公司的意义
2. 判断信息与公司的关联度（high/medium/low）
3. 分析对公司目标、业务、产品、用户的影响
4. 给出具体建议和风险提示
5. 如果有不同意见，明确指出

输出 JSON 格式：
{
  "content": "核心观点（150字以内）",
  "suggestions": ["建议1", "建议2"],
  "risks": ["风险1", "风险2"]
}`;
}

function buildMinutesPrompt(
  content: string,
  contextSnapshot: CompanyContextSnapshot,
  relatedMemories: CompanyMemory[],
  speeches: AgentSpeech[],
  _meetingType: string
): string {
  return `你是会议主持人，请根据讨论结果生成会议纪要。

公司背景：
${JSON.stringify(contextSnapshot, null, 2)}

相关记忆：
${relatedMemories.map(m => `- [${m.type}] ${m.content}`).join('\n') || '无'}

原始信息：
${content}

专家发言：
${speeches.map(s => `【${s.agentName}（${s.role}）】\n${s.content}\n建议：${s.suggestions.join('、')}\n风险：${s.risks.join('、')}`).join('\n\n')}

请生成完整的会议纪要。`;
}
