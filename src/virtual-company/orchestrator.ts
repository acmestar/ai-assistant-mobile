// AI 虚拟公司 - 编排器

import { useAppStore, CHAT_MODELS } from '../store';
import {
  CompanySession,
  CompanySessionConfig,
  ProjectAnalysis,
  VirtualCompany,
  OrganizationDepartment,
  CompanyAgent,
  ReviewWorkflowStep,
  AgentReview,
  AgentDebate,
  FinalReport,
  ProgressStep,
} from './types';
import {
  buildProjectAnalysisPrompt,
  buildCompanyGenerationPrompt,
  buildAgentsGenerationPrompt,
  buildWorkflowPrompt,
  buildAgentReviewPrompt,
  buildDebatePrompt,
  buildFinalReportPrompt,
  parseJsonResponse,
} from './prompts';

const API_BASE = 'https://ai.acmestar.top/api';

// 进度回调类型
export type ProgressCallback = (
  step: string,
  progress: number,
  message: string
) => void;

// 调用 AI 模型
async function callAI(
  prompt: string,
  modelId?: string
): Promise<string> {
  const { apiKey, chatModelId } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  const model = modelId || chatModelId;
  const modelConfig = CHAT_MODELS.find(m => m.id === model) || CHAT_MODELS[0];

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: modelConfig.maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// 生成唯一 ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// 运行虚拟公司评审会话
export async function runVirtualCompanySession(
  requirement: string,
  config: CompanySessionConfig,
  session: CompanySession,
  onProgress?: ProgressCallback,
  onUpdate?: (session: CompanySession) => void
): Promise<CompanySession> {
  const steps: ProgressStep[] = [
    { name: '需求分析', status: 'pending' },
    { name: '公司创建', status: 'pending' },
    { name: '组织架构', status: 'pending' },
    { name: '角色生成', status: 'pending' },
    { name: '评审流程', status: 'pending' },
    { name: '多角色评审', status: 'pending' },
    { name: '交叉质疑', status: 'pending' },
    { name: '最终报告', status: 'pending' },
  ];

  let currentStepIndex = 0;

  const updateProgress = (stepName: string, message: string) => {
    steps[currentStepIndex].status = 'running';
    steps[currentStepIndex].message = message;
    onProgress?.(stepName, Math.round((currentStepIndex / steps.length) * 100), message);
  };

  const completeStep = () => {
    steps[currentStepIndex].status = 'completed';
    currentStepIndex++;
  };

  try {
    // 1. 需求分析
    updateProgress('需求分析', '正在分析项目需求...');
    const analysisPrompt = buildProjectAnalysisPrompt(requirement);
    const analysisResult = await callAI(analysisPrompt);
    const projectAnalysis = parseJsonResponse<ProjectAnalysis>(analysisResult);

    if (!projectAnalysis) {
      throw new Error('需求分析解析失败，请重试');
    }

    session.projectAnalysis = projectAnalysis;
    session.currentStep = '需求分析完成';
    onUpdate?.(session);
    completeStep();

    // 2. 公司生成
    updateProgress('公司创建', '正在创建虚拟公司...');
    const companyPrompt = buildCompanyGenerationPrompt(requirement, projectAnalysis);
    const companyResult = await callAI(companyPrompt);
    const company = parseJsonResponse<VirtualCompany>(companyResult);

    if (!company) {
      throw new Error('公司信息生成失败，请重试');
    }

    session.company = company;
    session.currentStep = '公司创建完成';
    onUpdate?.(session);
    completeStep();

    // 3. 组织架构和角色生成
    updateProgress('组织架构', '正在设计组织架构...');
    updateProgress('角色生成', '正在任命 AI 角色...');
    const agentsPrompt = buildAgentsGenerationPrompt(requirement, projectAnalysis, company, config);
    const agentsResult = await callAI(agentsPrompt);
    const agentsData = parseJsonResponse<{
      organization: OrganizationDepartment[];
      agents: CompanyAgent[];
    }>(agentsResult);

    if (!agentsData || !agentsData.agents) {
      throw new Error('角色生成失败，请重试');
    }

    session.organization = agentsData.organization || [];
    session.agents = agentsData.agents;
    session.currentStep = '角色生成完成';
    onUpdate?.(session);
    completeStep();
    completeStep(); // 组织架构和角色生成算两步

    // 4. 评审流程
    updateProgress('评审流程', '正在安排评审流程...');
    const workflowPrompt = buildWorkflowPrompt(requirement, projectAnalysis, session.agents);
    const workflowResult = await callAI(workflowPrompt);
    const workflowData = parseJsonResponse<{ workflow: ReviewWorkflowStep[] }>(workflowResult);

    if (!workflowData || !workflowData.workflow) {
      // 如果流程生成失败，使用默认流程
      session.workflow = session.agents.map((agent, index) => ({
        step: index + 1,
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        task: `从${agent.role}角度评审项目`,
        expectedOutput: ['评审意见', '建议', '风险'],
        status: 'pending' as const,
      }));
    } else {
      session.workflow = workflowData.workflow;
    }

    session.currentStep = '评审流程完成';
    onUpdate?.(session);
    completeStep();

    // 5. 多角色评审
    updateProgress('多角色评审', '正在进行多角色评审...');
    const reviews: AgentReview[] = [];
    const sortedAgents = [...session.agents].sort((a, b) => a.reviewOrder - b.reviewOrder);

    for (let i = 0; i < sortedAgents.length; i++) {
      const agent = sortedAgents[i];
      updateProgress('多角色评审', `${agent.name}（${agent.role}）正在评审...`);

      const reviewPrompt = buildAgentReviewPrompt(
        requirement,
        projectAnalysis,
        company,
        agent,
        reviews
      );

      const reviewResult = await callAI(reviewPrompt);
      const review = parseJsonResponse<Omit<AgentReview, 'id' | 'sessionId' | 'createdAt'>>(reviewResult);

      if (review) {
        reviews.push({
          id: generateId(),
          sessionId: session.id,
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          round: 1,
          type: 'initial_review',
          summary: review.summary || '',
          details: review.details || '',
          suggestions: review.suggestions || [],
          risks: review.risks || [],
          questionsToOthers: review.questionsToOthers || [],
          score: review.score,
          createdAt: new Date().toISOString(),
        });
      }

      // 更新工作流状态
      const workflowStep = session.workflow?.find(w => w.agentId === agent.id);
      if (workflowStep) {
        workflowStep.status = 'completed';
      }

      session.reviews = reviews;
      session.progress = Math.round(((i + 1) / sortedAgents.length) * 100);
      onUpdate?.(session);
    }

    completeStep();

    // 6. 交叉质疑（如果启用）
    const debates: AgentDebate[] = [];
    if (config.enableDebate && reviews.length > 1) {
      updateProgress('交叉质疑', '正在进行角色讨论...');
      const debatePrompt = buildDebatePrompt(requirement, session.agents, reviews);
      const debateResult = await callAI(debatePrompt);
      const debateData = parseJsonResponse<{ debates: AgentDebate[] }>(debateResult);

      if (debateData && debateData.debates) {
        debateData.debates.forEach(d => {
          debates.push({
            ...d,
            id: generateId(),
            sessionId: session.id,
            createdAt: new Date().toISOString(),
          });
        });
      }

      session.debates = debates;
      onUpdate?.(session);
    }

    completeStep();

    // 7. 最终报告
    updateProgress('最终报告', '正在生成最终报告...');
    const finalPrompt = buildFinalReportPrompt(
      requirement,
      projectAnalysis,
      company,
      session.agents,
      reviews,
      debates,
      config
    );
    const finalResult = await callAI(finalPrompt);
    const finalReport = parseJsonResponse<FinalReport>(finalResult);

    if (!finalReport) {
      throw new Error('最终报告生成失败，请重试');
    }

    session.finalReport = finalReport;
    session.status = 'completed';
    session.currentStep = '评审完成';
    session.progress = 100;
    session.updatedAt = Date.now();
    onUpdate?.(session);
    completeStep();

    return session;
  } catch (error: any) {
    session.status = 'failed';
    session.currentStep = `错误: ${error.message}`;
    onUpdate?.(session);
    throw error;
  }
}

// 继续追问
export async function askFollowUp(
  session: CompanySession,
  question: string,
  targetAgentId?: string
): Promise<string> {
  const { apiKey } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  // 构建上下文
  const contextParts: string[] = [];

  if (session.projectAnalysis) {
    contextParts.push(`项目分析：${JSON.stringify(session.projectAnalysis, null, 2)}`);
  }

  if (session.reviews && session.reviews.length > 0) {
    contextParts.push('评审意见：');
    session.reviews.forEach(r => {
      contextParts.push(`【${r.agentName}】${r.summary}`);
    });
  }

  if (session.finalReport) {
    contextParts.push(`最终结论：${session.finalReport.decisionText}`);
  }

  const context = contextParts.join('\n');

  // 找到目标角色
  const targetAgent = targetAgentId
    ? session.agents?.find(a => a.id === targetAgentId)
    : undefined;

  const prompt = `项目背景：
${session.requirement}

之前的评审内容：
${context}

${targetAgent ? `你是 ${targetAgent.name}（${targetAgent.role}）。\n你的角色信息：${JSON.stringify(targetAgent, null, 2)}\n\n` : '你是虚拟公司的 CEO。\n\n'}用户问题：
${question}

请回答这个问题。要求：
1. 保持角色特点和专业视角；
2. 回答要具体、有建设性；
3. 直接输出回答内容。`;

  return callAI(prompt);
}
