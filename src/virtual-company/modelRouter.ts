// AI 公司系统 - 多模型调度核心模块
// 所有 AI 能力都通过此模块统一调度

// ============ 类型定义 ============

// 任务类型 - 覆盖整个 AI 公司系统
export type TaskType =
  // 公司创建与档案
  | 'company_intent_understanding'
  | 'company_profile_generation'
  | 'company_positioning_analysis'
  | 'company_goal_decomposition'
  | 'agent_team_generation'

  // 公司会议
  | 'morning_meeting_analysis'
  | 'strategy_meeting_analysis'
  | 'project_review_analysis'
  | 'risk_meeting_analysis'
  | 'retrospective_meeting_analysis'
  | 'meeting_summary_draft'
  | 'final_report_synthesis'

  // 公司记忆与任务
  | 'memory_extraction'
  | 'memory_tagging'
  | 'memory_retrieval_query'
  | 'task_extraction'
  | 'task_prioritization'
  | 'risk_extraction'

  // 输入处理
  | 'input_type_detection'
  | 'content_summary'
  | 'long_text_digest'
  | 'link_content_summary'
  | 'image_understanding'
  | 'screenshot_ocr'
  | 'chart_understanding'
  | 'file_analysis'

  // 专业分析（各角色专用）
  | 'strategy_analysis'
  | 'risk_analysis'
  | 'technical_analysis'
  | 'product_analysis'          // 产品负责人专用
  | 'legal_review'
  | 'investment_analysis'
  | 'business_model_analysis'
  | 'competitor_analysis'

  // 创作工厂
  | 'creative_planning'
  | 'outline_generation'
  | 'creative_writing'
  | 'chapter_generation'
  | 'copywriting'
  | 'xiaohongshu_style'
  | 'short_video_script'
  | 'title_generation'
  | 'content_variants'
  | 'style_unification'
  | 'quality_check'

  // 创意与反方
  | 'creative_opinion'
  | 'opposition_view'
  | 'marketing_angle'
  | 'public_opinion_analysis'
  | 'personality_expression'

  // 工程和结构化
  | 'code_generation'
  | 'workflow_decomposition'
  | 'json_formatting'
  | 'structured_output'
  | 'system_design'

  // 快速任务
  | 'quick_summary'
  | 'simple_qa'
  | 'fast_classification';

// 用户模式
export type UserMode = 'fast' | 'standard' | 'deep';

// 模型 ID
export type ModelId =
  | 'gpt-5.5'
  | 'kimi-2.5'
  | 'deepseek-v4'
  | 'grok-4.1'
  | 'grok-4.2'
  | 'doubao-2.0'
  | 'gemini-3.1-flash';

// 模型调用日志
export interface ModelCallLog {
  id: string;
  userId?: string;
  companyId?: string;
  meetingId?: string;
  projectId?: string;
  creationId?: string;
  taskType: TaskType;
  roleName?: string;
  modelName: ModelId;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  success: boolean;
  isFallback?: boolean;
  fallbackFrom?: ModelId;
  errorMessage?: string;
  createdAt: string;
}

// 使用的模型信息
export interface UsedModelInfo {
  roleName: string;
  modelName: string;
  taskType: TaskType;
  responsibility: string;
  isFallback?: boolean;
  latencyMs?: number;
}

// 生成来源摘要
export interface GenerationSourceSummary {
  mode: UserMode;
  usedModels: UsedModelInfo[];
  finalModel: ModelId;
  generatedAt: string;
}

// 模型调用选项
export interface CallModelOptions {
  userId?: string;
  companyId?: string;
  meetingId?: string;
  projectId?: string;
  creationId?: string;
  mode?: UserMode;
  imageUrl?: string;
  temperature?: number;
  maxTokens?: number;
  requireJson?: boolean;
  timeout?: number;
}

// 模型调用结果
export interface CallModelResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  log: ModelCallLog;
  sourceSummary?: GenerationSourceSummary;
}

// ============ 模型配置 ============

// 模型显示名称
export const MODEL_NAMES: Record<ModelId, string> = {
  'gpt-5.5': 'GPT-5.5',
  'kimi-2.5': 'Kimi 2.5',
  'deepseek-v4': 'DeepSeek V4',
  'grok-4.1': 'Grok 4.1',
  'grok-4.2': 'Grok 4.2',
  'doubao-2.0': '豆包 2.0',
  'gemini-3.1-flash': 'Gemini 3.1 Flash',
};

// 模型角色映射
export const MODEL_ROLE_MAP: Record<ModelId, string[]> = {
  'gpt-5.5': ['首席战略官', '最终报告官', '风险总负责人'],
  'kimi-2.5': ['会议秘书', '资料整理员', '记忆管理员'],
  'deepseek-v4': ['技术负责人', '结构化分析员', '工程师'],
  'grok-4.1': ['图片分析员', '视觉观察员'],
  'grok-4.2': ['反方顾问', '舆论观察员', '创意总监'],
  'doubao-2.0': ['中文内容策划', '社媒文案员'],
  'gemini-3.1-flash': ['快速助理', '备用视觉分析员'],
};

// 任务职责描述
export const TASK_RESPONSIBILITIES: Partial<Record<TaskType, string>> = {
  // 公司创建
  company_intent_understanding: '理解用户创建公司的意图',
  company_profile_generation: '生成公司档案和定位',
  company_positioning_analysis: '分析公司定位和差异化',
  company_goal_decomposition: '拆解公司目标',
  agent_team_generation: '生成公司团队角色',

  // 会议
  morning_meeting_analysis: '分析晨会信息对公司的影响',
  strategy_meeting_analysis: '进行战略分析',
  project_review_analysis: '评审项目可行性',
  risk_meeting_analysis: '分析潜在风险',
  retrospective_meeting_analysis: '进行复盘分析',
  meeting_summary_draft: '起草会议纪要',
  final_report_synthesis: '整合最终报告',

  // 记忆与任务
  memory_extraction: '提取关键记忆',
  memory_tagging: '标记记忆类型',
  memory_retrieval_query: '检索相关记忆',
  task_extraction: '提取待办任务',
  task_prioritization: '确定任务优先级',
  risk_extraction: '识别潜在风险',

  // 输入处理
  input_type_detection: '识别输入类型',
  content_summary: '总结内容要点',
  image_understanding: '识别图片内容',
  screenshot_ocr: '提取截图文字',
  long_text_digest: '提炼长文本要点',
  link_content_summary: '总结链接内容',
  chart_understanding: '分析图表数据',
  file_analysis: '分析文件内容',

  // 专业分析（各角色专用）
  strategy_analysis: '进行战略分析',
  risk_analysis: '进行风险分析',
  technical_analysis: '进行技术分析',
  product_analysis: '进行产品分析',
  legal_review: '进行法律审查',
  investment_analysis: '进行投资分析',
  business_model_analysis: '进行商业模式分析',
  competitor_analysis: '进行竞品分析',

  // 创作
  creative_writing: '生成创意内容',
  copywriting: '撰写营销文案',
  title_generation: '生成标题',
  creative_planning: '规划创意方案',
  outline_generation: '生成大纲',
  chapter_generation: '生成章节内容',
  xiaohongshu_style: '生成小红书风格内容',
  short_video_script: '撰写短视频脚本',
  content_variants: '生成内容变体',
  style_unification: '统一内容风格',
  quality_check: '检查内容质量',

  // 创意与反方
  creative_opinion: '提供创意观点',
  opposition_view: '提出反方观点',
  marketing_angle: '提供营销角度',
  public_opinion_analysis: '分析舆论',
  personality_expression: '表达个性观点',

  // 技术与结构化
  code_generation: '生成代码',
  workflow_decomposition: '拆解工作流',
  json_formatting: '格式化结构化输出',
  structured_output: '生成结构化输出',
  system_design: '设计系统架构',

  // 快速任务
  quick_summary: '快速摘要',
  simple_qa: '简单问答',
  fast_classification: '快速分类',
};

// ============ 模型路由表 ============

// 标准模式下的任务-模型映射
const STANDARD_MODEL_ROUTER: Record<TaskType, ModelId> = {
  // 公司创建与档案
  company_intent_understanding: 'gpt-5.5',
  company_profile_generation: 'gpt-5.5',
  company_positioning_analysis: 'gpt-5.5',
  company_goal_decomposition: 'gpt-5.5',
  agent_team_generation: 'gpt-5.5',

  // 公司会议核心分析
  morning_meeting_analysis: 'gpt-5.5',
  strategy_meeting_analysis: 'gpt-5.5',
  project_review_analysis: 'gpt-5.5',
  risk_meeting_analysis: 'gpt-5.5',
  retrospective_meeting_analysis: 'gpt-5.5',
  final_report_synthesis: 'gpt-5.5',

  // 资料整理
  meeting_summary_draft: 'kimi-2.5',
  content_summary: 'kimi-2.5',
  long_text_digest: 'kimi-2.5',
  link_content_summary: 'kimi-2.5',

  // 记忆和任务
  memory_extraction: 'kimi-2.5',
  memory_tagging: 'kimi-2.5',
  memory_retrieval_query: 'kimi-2.5',
  task_extraction: 'deepseek-v4',
  task_prioritization: 'gpt-5.5',
  risk_extraction: 'gpt-5.5',

  // 输入识别与多模态
  input_type_detection: 'gemini-3.1-flash',
  image_understanding: 'grok-4.1',
  screenshot_ocr: 'grok-4.1',
  chart_understanding: 'grok-4.1',
  file_analysis: 'kimi-2.5',

  // 专业分析（各角色专用）
  strategy_analysis: 'gpt-5.5',           // CEO/战略官
  risk_analysis: 'gpt-5.5',               // 风险官
  technical_analysis: 'deepseek-v4',      // 技术负责人
  product_analysis: 'gpt-5.5',            // 产品负责人
  legal_review: 'gpt-5.5',
  investment_analysis: 'gpt-5.5',
  business_model_analysis: 'gpt-5.5',     // 运营总监
  competitor_analysis: 'gpt-5.5',

  // 创意、反方、舆论
  creative_opinion: 'grok-4.2',
  opposition_view: 'grok-4.2',            // 反方顾问
  marketing_angle: 'grok-4.2',            // 市场负责人
  public_opinion_analysis: 'grok-4.2',
  personality_expression: 'grok-4.2',

  // 中文内容与创作工厂
  creative_planning: 'gpt-5.5',
  outline_generation: 'gpt-5.5',
  creative_writing: 'doubao-2.0',
  chapter_generation: 'doubao-2.0',
  copywriting: 'doubao-2.0',
  xiaohongshu_style: 'doubao-2.0',
  short_video_script: 'doubao-2.0',
  title_generation: 'doubao-2.0',
  content_variants: 'doubao-2.0',
  style_unification: 'gpt-5.5',
  quality_check: 'kimi-2.5',

  // 技术与结构化
  code_generation: 'deepseek-v4',
  workflow_decomposition: 'deepseek-v4',
  json_formatting: 'deepseek-v4',
  structured_output: 'deepseek-v4',
  system_design: 'deepseek-v4',

  // 快速任务
  quick_summary: 'gemini-3.1-flash',
  simple_qa: 'gemini-3.1-flash',
  fast_classification: 'gemini-3.1-flash',
};

// 快速模式 - 使用更快的模型
const FAST_MODEL_ROUTER: Partial<Record<TaskType, ModelId>> = {
  company_intent_understanding: 'gemini-3.1-flash',
  company_profile_generation: 'kimi-2.5',
  agent_team_generation: 'kimi-2.5',
  morning_meeting_analysis: 'kimi-2.5',
  content_summary: 'gemini-3.1-flash',
  image_understanding: 'gemini-3.1-flash',
  quick_summary: 'gemini-3.1-flash',
  simple_qa: 'gemini-3.1-flash',
};

// 深度模式 - 核心分析和最终整合用 GPT-5.5，专用任务仍使用专用模型
const DEEP_MODEL_ROUTER: Partial<Record<TaskType, ModelId>> = {
  // 核心分析用 GPT-5.5
  company_intent_understanding: 'gpt-5.5',
  company_profile_generation: 'gpt-5.5',
  company_positioning_analysis: 'gpt-5.5',
  company_goal_decomposition: 'gpt-5.5',
  agent_team_generation: 'gpt-5.5',

  morning_meeting_analysis: 'gpt-5.5',
  strategy_meeting_analysis: 'gpt-5.5',
  project_review_analysis: 'gpt-5.5',
  risk_meeting_analysis: 'gpt-5.5',
  retrospective_meeting_analysis: 'gpt-5.5',
  final_report_synthesis: 'gpt-5.5',

  strategy_analysis: 'gpt-5.5',
  risk_analysis: 'gpt-5.5',
  product_analysis: 'gpt-5.5',
  business_model_analysis: 'gpt-5.5',
  legal_review: 'gpt-5.5',
  investment_analysis: 'gpt-5.5',
  competitor_analysis: 'gpt-5.5',

  // 专用任务仍使用专用模型
  image_understanding: 'grok-4.1',
  screenshot_ocr: 'grok-4.1',
  chart_understanding: 'grok-4.1',
  technical_analysis: 'deepseek-v4',
  code_generation: 'deepseek-v4',
  opposition_view: 'grok-4.2',
  marketing_angle: 'grok-4.2',
  creative_writing: 'doubao-2.0',
  copywriting: 'doubao-2.0',
};

// Fallback 配置
const FALLBACK_CONFIG: Record<ModelId, ModelId[]> = {
  'gpt-5.5': ['kimi-2.5', 'gemini-3.1-flash'],
  'kimi-2.5': ['gemini-3.1-flash', 'doubao-2.0'],
  'deepseek-v4': ['kimi-2.5', 'gpt-5.5'],
  'grok-4.1': ['gemini-3.1-flash'], // 图片只能 fallback 到支持图片的模型
  'grok-4.2': ['gpt-5.5', 'doubao-2.0'],
  'doubao-2.0': ['kimi-2.5', 'gemini-3.1-flash'],
  'gemini-3.1-flash': ['kimi-2.5'],
};

// 不支持图片的模型
const MODELS_WITHOUT_VISION: ModelId[] = ['deepseek-v4', 'grok-4.2'];

// ============ 全局调用日志存储 ============

// 内存中的调用日志（可替换为持久化存储）
const modelCallLogs: ModelCallLog[] = [];

// 当前会话的模型使用记录（用于生成来源摘要）
const currentSessionModels: Map<string, UsedModelInfo[]> = new Map();

// ============ 核心函数 ============

/**
 * 获取任务对应的模型
 */
export function getModelForTask(taskType: TaskType, mode: UserMode = 'standard'): ModelId {
  // 深度模式：核心分析用 GPT-5.5，专用任务用专用模型
  if (mode === 'deep') {
    return DEEP_MODEL_ROUTER[taskType] || STANDARD_MODEL_ROUTER[taskType];
  }

  // 快速模式使用轻量模型
  if (mode === 'fast') {
    return FAST_MODEL_ROUTER[taskType] || STANDARD_MODEL_ROUTER[taskType];
  }

  // 标准模式
  return STANDARD_MODEL_ROUTER[taskType];
}

/**
 * 根据角色获取 TaskType（关键词匹配 + 会议类型）
 */
export function getTaskTypeForAgent(
  agent: { role: string; department: string; name: string; responsibilities: string[] },
  meetingType: 'morning' | 'strategy' | 'review' | 'risk' | 'retrospective'
): TaskType {
  const text = `${agent.role} ${agent.department} ${agent.name} ${agent.responsibilities.join(' ')}`;

  // 关键词匹配
  if (text.includes('技术') || text.includes('工程') || text.includes('研发')) {
    return 'technical_analysis';
  }
  if (text.includes('产品') || text.includes('体验') || text.includes('需求')) {
    return 'product_analysis';
  }
  if (text.includes('市场') || text.includes('增长') || text.includes('营销') || text.includes('品牌')) {
    return 'marketing_angle';
  }
  if (text.includes('风险') || text.includes('合规') || text.includes('法务')) {
    return 'risk_analysis';
  }
  if (text.includes('反方') || text.includes('质疑')) {
    return 'opposition_view';
  }
  if (text.includes('内容') || text.includes('文案') || text.includes('社媒')) {
    return 'copywriting';
  }
  if (text.includes('运营') || text.includes('商业化')) {
    return 'business_model_analysis';
  }

  // 根据会议类型默认
  switch (meetingType) {
    case 'morning':
      return 'morning_meeting_analysis';
    case 'strategy':
      return 'strategy_meeting_analysis';
    case 'review':
      return 'project_review_analysis';
    case 'risk':
      return 'risk_meeting_analysis';
    case 'retrospective':
      return 'retrospective_meeting_analysis';
    default:
      return 'strategy_analysis';
  }
}

/**
 * 获取模型对应的角色名称
 */
export function getRoleForModel(modelId: ModelId, taskType: TaskType): string {
  const roles = MODEL_ROLE_MAP[modelId] || ['AI 助手'];

  // 根据任务类型选择合适的角色
  if (taskType.includes('meeting') || taskType.includes('summary')) {
    return roles.find(r => r.includes('秘书') || r.includes('整理')) || roles[0];
  }
  if (taskType.includes('strategy') || taskType.includes('analysis')) {
    return roles.find(r => r.includes('战略') || r.includes('分析')) || roles[0];
  }
  if (taskType.includes('risk')) {
    return roles.find(r => r.includes('风险')) || roles[0];
  }
  if (taskType.includes('image') || taskType.includes('ocr')) {
    return roles.find(r => r.includes('图片') || r.includes('视觉')) || roles[0];
  }
  if (taskType.includes('creative') || taskType.includes('copywriting')) {
    return roles.find(r => r.includes('内容') || r.includes('创意')) || roles[0];
  }
  if (taskType.includes('technical') || taskType.includes('code')) {
    return roles.find(r => r.includes('技术') || r.includes('工程师')) || roles[0];
  }

  return roles[0];
}

/**
 * 检查模型是否支持图片
 */
export function modelSupportsVision(modelId: ModelId): boolean {
  return !MODELS_WITHOUT_VISION.includes(modelId);
}

/**
 * 获取 Fallback 模型
 */
export function getFallbackModel(modelId: ModelId, hasImage: boolean = false): ModelId | null {
  const fallbacks = FALLBACK_CONFIG[modelId] || [];

  for (const fallback of fallbacks) {
    // 如果有图片，确保 fallback 模型支持图片
    if (hasImage && !modelSupportsVision(fallback)) {
      continue;
    }
    return fallback;
  }

  return null;
}

/**
 * 记录模型调用日志
 */
export function logModelCall(log: Omit<ModelCallLog, 'id' | 'createdAt'>): ModelCallLog {
  const fullLog: ModelCallLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  modelCallLogs.push(fullLog);

  // 限制内存中的日志数量
  if (modelCallLogs.length > 1000) {
    modelCallLogs.shift();
  }

  return fullLog;
}

/**
 * 添加到当前会话的模型使用记录
 */
export function addToSessionModels(
  sessionId: string,
  modelId: ModelId,
  taskType: TaskType,
  isFallback: boolean = false,
  latencyMs: number = 0
): void {
  if (!currentSessionModels.has(sessionId)) {
    currentSessionModels.set(sessionId, []);
  }

  const models = currentSessionModels.get(sessionId)!;

  // 检查是否已存在相同的模型和任务
  const exists = models.some(m => m.modelName === modelId && m.taskType === taskType);
  if (!exists) {
    models.push({
      roleName: getRoleForModel(modelId, taskType),
      modelName: MODEL_NAMES[modelId],
      taskType,
      responsibility: TASK_RESPONSIBILITIES[taskType] || '执行任务',
      isFallback,
      latencyMs,
    });
  }
}

/**
 * 生成来源摘要
 */
export function generateSourceSummary(
  sessionId: string,
  mode: UserMode,
  finalModel: ModelId
): GenerationSourceSummary {
  const usedModels = currentSessionModels.get(sessionId) || [];

  return {
    mode,
    usedModels,
    finalModel,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 清除会话模型记录
 */
export function clearSessionModels(sessionId: string): void {
  currentSessionModels.delete(sessionId);
}

/**
 * 获取调用日志
 */
export function getModelCallLogs(filters?: {
  userId?: string;
  companyId?: string;
  meetingId?: string;
  taskType?: TaskType;
  limit?: number;
}): ModelCallLog[] {
  let logs = [...modelCallLogs];

  if (filters) {
    if (filters.userId) logs = logs.filter(l => l.userId === filters.userId);
    if (filters.companyId) logs = logs.filter(l => l.companyId === filters.companyId);
    if (filters.meetingId) logs = logs.filter(l => l.meetingId === filters.meetingId);
    if (filters.taskType) logs = logs.filter(l => l.taskType === filters.taskType);
    if (filters.limit) logs = logs.slice(-filters.limit);
  }

  return logs;
}

// ============ API 调用函数 ============

const API_BASE_URL = 'https://api.acmestar.top/v1/chat/completions';

/**
 * 获取 API Key（从 store）
 */
function getApiKey(): string {
  // 在浏览器环境中从 localStorage 获取
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('ai-assistant-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.state?.apiKey || '';
      }
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * 获取模型对应的 API 模型 ID
 */
function getApiModelId(modelId: ModelId): string {
  const mapping: Record<ModelId, string> = {
    'gpt-5.5': 'gpt-5.5',
    'kimi-2.5': 'kimi-k2.5',
    'deepseek-v4': 'deepseek-v4-flash',
    'grok-4.1': 'grok-4.1',
    'grok-4.2': 'grok-4.2',
    'doubao-2.0': 'doubao-seed-2-0-lite-260215',
    'gemini-3.1-flash': 'gemini-3.1-flash-lite-preview',
  };
  return mapping[modelId] || modelId;
}

/**
 * 统一模型调用入口
 * 所有业务模块都应该使用此函数调用 AI 能力
 */
export async function callModel<T = any>(
  taskType: TaskType,
  payload: {
    prompt: string;
    systemPrompt?: string;
    imageUrl?: string;
  },
  options: CallModelOptions = {}
): Promise<CallModelResult<T>> {
  const {
    mode = 'standard',
    imageUrl,
    temperature = 0.7,
    maxTokens = 4096,
    requireJson = false,
    timeout = 60000,
  } = options;

  const sessionId = options.meetingId || options.companyId || `session-${Date.now()}`;
  const startTime = Date.now();

  // 确定主模型
  let primaryModel = getModelForTask(taskType, mode);
  const hasImage = !!imageUrl || !!payload.imageUrl;

  // 检查模型是否支持图片
  if (hasImage && !modelSupportsVision(primaryModel)) {
    // 需要使用支持图片的模型
    primaryModel = 'grok-4.1';
  }

  let currentModel = primaryModel;
  let isFallback = false;
  let lastError: string | undefined;

  // 尝试调用模型（包括 fallback）
  while (currentModel) {
    try {
      const apiKey = getApiKey();
      if (!apiKey) {
        throw new Error('请先设置 API Key');
      }

      // 构建消息
      const messages: Array<{ role: string; content: any }> = [];

      if (payload.systemPrompt) {
        messages.push({ role: 'system', content: payload.systemPrompt });
      }

      // 处理图片
      if (hasImage && modelSupportsVision(currentModel)) {
        const imageToUse = imageUrl || payload.imageUrl;
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: payload.prompt },
            {
              type: 'image_url',
              image_url: { url: imageToUse },
            },
          ],
        });
      } else {
        messages.push({ role: 'user', content: payload.prompt });
      }

      // 调用 API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getApiModelId(currentModel),
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 错误: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      // 解析结果
      let result: T;
      if (requireJson) {
        try {
          // 尝试解析 JSON
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                           content.match(/\{[\s\S]*\}/) ||
                           content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0].replace(/```json\s*|\s*```/g, '')) as T;
          } else {
            result = JSON.parse(content) as T;
          }
        } catch {
          result = content as T;
        }
      } else {
        result = content as T;
      }

      const latencyMs = Date.now() - startTime;

      // 记录日志
      const log = logModelCall({
        taskType,
        modelName: currentModel,
        roleName: getRoleForModel(currentModel, taskType),
        latencyMs,
        success: true,
        isFallback,
        fallbackFrom: isFallback ? primaryModel : undefined,
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
        ...options,
      });

      // 添加到会话记录
      addToSessionModels(sessionId, currentModel, taskType, isFallback, latencyMs);

      return {
        success: true,
        data: result,
        log,
      };
    } catch (error: any) {
      lastError = error.message;
      console.warn(`模型 ${currentModel} 调用失败:`, error.message);

      // 尝试 fallback
      const fallbackModel = getFallbackModel(currentModel, hasImage);
      if (fallbackModel) {
        console.log(`尝试使用备用模型: ${fallbackModel}`);
        currentModel = fallbackModel;
        isFallback = true;
      } else {
        break;
      }
    }
  }

  // 所有模型都失败
  const latencyMs = Date.now() - startTime;
  const log = logModelCall({
    taskType,
    modelName: primaryModel,
    roleName: getRoleForModel(primaryModel, taskType),
    latencyMs,
    success: false,
    isFallback: false,
    errorMessage: lastError,
    ...options,
  });

  return {
    success: false,
    error: lastError || '模型调用失败',
    log,
  };
}

/**
 * 流式调用模型
 */
export async function callModelStream(
  taskType: TaskType,
  payload: {
    prompt: string;
    systemPrompt?: string;
    imageUrl?: string;
  },
  onChunk: (chunk: string) => void,
  options: CallModelOptions = {}
): Promise<CallModelResult<string>> {
  const {
    mode = 'standard',
    imageUrl,
    temperature = 0.7,
    maxTokens = 4096,
  } = options;

  const sessionId = options.meetingId || options.companyId || `session-${Date.now()}`;
  const startTime = Date.now();

  let primaryModel = getModelForTask(taskType, mode);
  const hasImage = !!imageUrl || !!payload.imageUrl;

  if (hasImage && !modelSupportsVision(primaryModel)) {
    primaryModel = 'grok-4.1';
  }

  let currentModel = primaryModel;
  let isFallback = false;

  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: '请先设置 API Key',
      log: logModelCall({
        taskType,
        modelName: primaryModel,
        latencyMs: 0,
        success: false,
        errorMessage: '未设置 API Key',
      }),
    };
  }

  try {
    const messages: Array<{ role: string; content: any }> = [];

    if (payload.systemPrompt) {
      messages.push({ role: 'system', content: payload.systemPrompt });
    }

    if (hasImage && modelSupportsVision(currentModel)) {
      const imageToUse = imageUrl || payload.imageUrl;
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: payload.prompt },
          { type: 'image_url', image_url: { url: imageToUse } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: payload.prompt });
    }

    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getApiModelId(currentModel),
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              onChunk(content);
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    const log = logModelCall({
      taskType,
      modelName: currentModel,
      roleName: getRoleForModel(currentModel, taskType),
      latencyMs,
      success: true,
      isFallback,
      fallbackFrom: isFallback ? primaryModel : undefined,
      ...options,
    });

    addToSessionModels(sessionId, currentModel, taskType, isFallback, latencyMs);

    return {
      success: true,
      data: fullContent,
      log,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;

    return {
      success: false,
      error: error.message,
      log: logModelCall({
        taskType,
        modelName: primaryModel,
        latencyMs,
        success: false,
        errorMessage: error.message,
        ...options,
      }),
    };
  }
}

// 导出便捷函数
// MODEL_NAMES, MODEL_ROLE_MAP, TASK_RESPONSIBILITIES 已在上面导出
