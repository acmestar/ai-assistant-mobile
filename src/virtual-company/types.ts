// AI 虚拟公司 - 完整类型定义

// 场景类型
export type Scenario = 'problem_solving' | 'morning_meeting' | 'project_review' | 'investment_analysis' | 'health_consult' | 'legal_compliance' | 'business_strategy';

// 输入类型
export type InputType = 'text' | 'image' | 'link' | 'file';

// 会议类型 - 扩展支持更多类型
export type MeetingType = 'morning' | 'strategy' | 'project_review' | 'risk' | 'review' | 'brainstorm' | 'retrospective';

// 评审深度
export type ReviewDepth = 'quick' | 'standard' | 'deep';

// 模型供应商
export type ModelProvider = 'auto' | 'claude' | 'openai' | 'deepseek' | 'gemini' | 'grok';

// 会话状态
export type SessionStatus = 'pending' | 'running' | 'completed' | 'failed';

// 最终决策
export type DecisionType = 'recommend' | 'conditional_recommend' | 'hold' | 'reject';

// 项目复杂度
export type Complexity = 'low' | 'medium' | 'high';

// 项目阶段
export type ProjectStage = 'idea' | 'mvp' | 'growth' | 'enterprise';

// 步骤状态
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

// 评审类型
export type ReviewType = 'initial_review' | 'question' | 'revision' | 'final_comment';

// 记忆类型
export type MemoryType = 'strategy' | 'market' | 'product' | 'risk' | 'user' | 'decision' | 'meeting_summary';

// 任务优先级和状态
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'doing' | 'done';

// 记忆重要性
export type MemoryImportance = 'low' | 'medium' | 'high';

// 关联度
export type RelevanceLevel = 'high' | 'medium' | 'low';

// ========== 公司核心结构 ==========

// 公司团队角色
export interface CompanyAgent {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar?: string;
  personality: string;
  background: string;
  responsibilities: string[];
  focusAreas: string[];
  speakingStyle: string;
  decisionPower: string;
  reviewOrder: number;
}

// 公司记忆
export interface CompanyMemory {
  id: string;
  companyId: string;
  type: MemoryType;
  content: string;
  sourceMeetingId?: string;
  importance: MemoryImportance;
  createdAt: string;
}

// 公司目标
export interface CompanyGoal {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'paused';
  createdAt: string;
}

// 公司任务
export interface CompanyTask {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  sourceMeetingId?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
}

// 公司风险
export interface CompanyRisk {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'monitoring';
  sourceMeetingId?: string;
  createdAt: string;
}

// 公司上下文快照
export interface CompanyContextSnapshot {
  companyName: string;
  purpose: string;
  industry?: string;
  stage?: string;
  targetUsers?: string[];
  products?: string[];
  businessModel?: string;
  currentGoals?: string[];
  currentTasks?: string[];
  risks?: string[];
  // 轻量版 agents，不保存完整 CompanyAgent
  agents?: Array<{
    id: string;
    name: string;
    role: string;
    department: string;
    responsibilities: string[];
  }>;
}

// 会议发言
export interface AgentSpeech {
  agentId: string;
  agentName: string;
  role: string;
  content: string;
  suggestions: string[];
  risks: string[];
  createdAt: string;
}

// 会议纪要基础结构
export interface BaseMeetingMinutes {
  informationSummary: string;
  relevanceLevel: RelevanceLevel;
  relevanceReason: string;

  goalImpact: Array<{
    goal: string;
    impact: string;
    direction: 'positive' | 'negative' | 'neutral' | 'uncertain';
  }>;

  businessImpact: {
    product?: string;
    user?: string;
    market?: string;
    competition?: string;
    businessModel?: string;
    technical?: string;
    execution?: string;
    cost?: string;
    resource?: string;
    risk?: string;
  };

  opportunities: string[];
  risks: string[];
  actions: string[];
}

// 晨会纪要
export interface MorningMeetingMinutes extends BaseMeetingMinutes {
  meetingType: 'morning';
  todayFocus: string[];
}

// 战略会纪要
export interface StrategyMeetingMinutes extends BaseMeetingMinutes {
  meetingType: 'strategy';
  strategicDirection: 'maintain' | 'pivot' | 'expand' | 'consolidate';
  strategicReason: string;
  keyDecisions: Array<{
    decision: string;
    rationale: string;
    impactScope: string[];
  }>;
  resourceAllocation: Array<{
    area: string;
    currentLevel: 'low' | 'medium' | 'high';
    recommendedLevel: 'low' | 'medium' | 'high';
    reason: string;
  }>;
  timeline: Array<{
    phase: string;
    duration: string;
    milestones: string[];
  }>;
}

// 项目评审会纪要
export interface ProjectReviewMinutes extends BaseMeetingMinutes {
  meetingType: 'review';
  projectDecision: 'approve' | 'approve_with_conditions' | 'revision_needed' | 'reject';
  decisionReason: string;
  feasibilityScore: number;
  riskScore: number;
  resourceRequirement: {
    team: string[];
    budget: string;
    timeline: string;
  };
  conditions?: string[];
  revisionPoints?: string[];
  rejectionReason?: string;
}

// 风险会纪要
export interface RiskMeetingMinutes extends BaseMeetingMinutes {
  meetingType: 'risk';
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskAssessment: Array<{
    riskTitle: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high' | 'critical';
    mitigationPlan: string;
    owner?: string;
    deadline?: string;
  }>;
  emergencyProtocols: Array<{
    trigger: string;
    action: string;
    responsible?: string;
  }>;
  monitoringPlan: Array<{
    metric: string;
    threshold: string;
    frequency: string;
  }>;
}

// 复盘会纪要
export interface RetrospectiveMinutes extends BaseMeetingMinutes {
  meetingType: 'retrospective';
  period: string;
  achievements: Array<{
    goal: string;
    result: string;
    successRate?: number;
    lessons: string;
  }>;
  failures: Array<{
    goal: string;
    expectedResult: string;
    actualResult: string;
    rootCause: string;
    correctiveAction: string;
  }>;
  improvements: Array<{
    area: string;
    currentStatus: string;
    targetStatus: string;
    actionPlan: string;
  }>;
}

// 会议结果联合类型
export type MeetingResult =
  | MorningMeetingMinutes
  | StrategyMeetingMinutes
  | ProjectReviewMinutes
  | RiskMeetingMinutes
  | RetrospectiveMinutes;

// 建议任务（轻量结构）
export interface SuggestedTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
}

// 建议记忆（轻量结构）
export interface SuggestedMemory {
  id: string;
  type: MemoryType;
  content: string;
  importance: MemoryImportance;
}

// 公司会议
export interface CompanyMeeting {
  id: string;
  companyId: string;
  userId?: string;

  type: MeetingType;
  title?: string;

  // 输入
  inputType: InputType;
  rawInput: string;
  extractedContent?: string;

  // 上下文
  companyContextSnapshot: CompanyContextSnapshot;
  relatedMemories: CompanyMemory[];

  // 输出
  agentSpeeches: AgentSpeech[];
  result: MeetingResult;

  // 任务与记忆（区分建议与确认）
  suggestedTasks: SuggestedTask[];
  suggestedMemories: SuggestedMemory[];
  confirmedTaskIds: string[];
  confirmedMemoryIds: string[];

  // 生成来源
  generationSourceSummary?: import('./modelRouter').GenerationSourceSummary;
  modelCallLogIds?: string[];

  createdAt: string;
  updatedAt?: string;
}

// AI 公司（长期档案）
export interface AICompany {
  id: string;
  name: string;
  purpose: string;
  industry?: string;
  stage?: string;
  targetUsers?: string[];
  products?: string[];
  businessModel?: string;
  agents: CompanyAgent[];
  memories: CompanyMemory[];
  goals: CompanyGoal[];
  tasks: CompanyTask[];
  risks: CompanyRisk[];
  meetings: CompanyMeeting[];
  createdAt: string;
  updatedAt: string;
}

// ========== 临时问答结构（保留原有功能） ==========

// 配置结构
export interface CompanySessionConfig {
  reviewDepth: ReviewDepth;
  roleCount: number;
  modelProvider: ModelProvider;
  enableDebate: boolean;
  enableMvpPlan: boolean;
  outputLanguage: 'zh-CN' | 'en-US';
  scenario?: Scenario;
  inputType?: InputType;
  meetingType?: string;
}

// 项目分析结构
export interface ProjectAnalysis {
  projectType: string;
  industry: string;
  targetUsers: string[];
  coreProblem: string;
  coreValue: string;
  keyFeatures: string[];
  businessGoal: string;
  complexity: Complexity;
  stage: ProjectStage;
  keyRisks: string[];
  missingInfo: string[];
}

// 虚拟公司结构（临时）
export interface VirtualCompany {
  name: string;
  englishName?: string;
  slogan?: string;
  positioning: string;
  mission: string;
  vision?: string;
  stage: string;
  reason: string;
}

// 组织架构结构
export interface OrganizationDepartment {
  id: string;
  name: string;
  description: string;
  roles: string[];
}

// 评审流程步骤
export interface ReviewWorkflowStep {
  step: number;
  agentId: string;
  agentName: string;
  role: string;
  task: string;
  expectedOutput: string[];
  status: StepStatus;
}

// Agent 评审内容
export interface AgentReview {
  id: string;
  sessionId: string;
  agentId: string;
  agentName: string;
  role: string;
  round: number;
  type: ReviewType;
  summary: string;
  details: string;
  suggestions: string[];
  risks: string[];
  questionsToOthers?: Array<{
    toRole: string;
    question: string;
    reason: string;
  }>;
  score?: number;
  createdAt: string;
}

// 讨论结构
export interface AgentDebate {
  id: string;
  sessionId: string;
  fromAgentId: string;
  fromAgentName: string;
  fromRole: string;
  toAgentId?: string;
  toAgentName?: string;
  toRole?: string;
  question: string;
  challengePoint: string;
  response?: string;
  conclusion?: string;
  createdAt: string;
}

// 执行计划阶段
export interface ExecutionPlanPhase {
  phase: string;
  duration: string;
  goals: string[];
  deliverables: string[];
}

// 项目评分
export interface ProjectScore {
  market: number;
  product: number;
  technology: number;
  business: number;
  operation: number;
  risk: number;
  overall: number;
}

// 最终报告结构
export interface FinalReport {
  decision: DecisionType;
  decisionText: string;
  projectScore: ProjectScore;
  mvpScope: string[];
  notRecommendedForV1: string[];
  executionPlan: ExecutionPlanPhase[];
  teamSuggestion: string[];
  estimatedTime: string;
  estimatedCost?: string;
  mainRisks: string[];
  successMetrics: string[];
  nextActions: string[];
  executiveSummary: string;
}

// 追问消息
export interface VirtualCompanyMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  targetAgentId?: string;
  targetAgentName?: string;
  timestamp: number;
}

// 临时会话结构（保留原有功能）
export interface CompanySession {
  id: string;
  title: string;
  requirement: string;
  status: SessionStatus;
  config: CompanySessionConfig;
  scenario?: Scenario;
  inputType?: InputType;
  projectAnalysis?: ProjectAnalysis;
  company?: VirtualCompany;
  organization?: OrganizationDepartment[];
  agents?: CompanyAgent[];
  workflow?: ReviewWorkflowStep[];
  reviews?: AgentReview[];
  debates?: AgentDebate[];
  finalReport?: FinalReport;
  messages?: VirtualCompanyMessage[];
  currentStep?: string;
  progress?: number;
  createdAt: number;
  updatedAt: number;
}

// 生成进度步骤
export interface ProgressStep {
  name: string;
  status: StepStatus;
  message?: string;
}

// API 响应类型
export interface CreateSessionResponse {
  sessionId: string;
  status: SessionStatus;
}

export interface ProgressResponse {
  status: SessionStatus;
  currentStep: string;
  progress: number;
  steps: ProgressStep[];
}

// ========== 旧版晨会类型（保留兼容性） ==========

// 晨会分析结果
export interface MorningMeetingAnalysis {
  summary: string;
  eventType: string;
  importance: 'high' | 'medium' | 'low';
  affectedGroups: string[];
  keywords: string[];
  sourceCredibility: string;
}

// 晨会纪要
export interface MorningMeetingMinutes {
  informationSummary: string;
  eventType: string;
  expertTeam: Array<{ name: string; role: string }>;
  roleViews: Array<{
    agentName: string;
    role: string;
    summary: string;
    suggestions: string[];
  }>;
  controversies: string[];
  risks: string[];
  finalJudgment: string;
  impactOnGroups: Array<{
    group: string;
    impact: string;
    advice: string;
  }>;
  todayActions: string[];
  followUpSuggestions: string[];
}

// ========== 需求智能分析结构 ==========

// 需求意图类型
export type IntentType =
  | 'company_creation'      // 真的想开公司
  | 'project_review'        // 项目评审
  | 'business_problem'      // 业务问题诊断
  | 'personal_advice'        // 个人咨询
  | 'content_strategy'       // 内容策略
  | 'product_planning';      // 产品规划

// 建议的公司/项目资料
export interface SuggestedCompanyProfile {
  name: string;
  purpose: string;
  industry?: string;
  stage?: string;
  businessModel?: string;
  targetCustomers?: string;
  coreOffer?: string;
}

// 建议的团队成员
export interface SuggestedAgent {
  role: string;
  responsibility: string;
  background?: string;
  personality?: string;
}

// 需求分析结果
export interface RequirementAnalysis {
  id: string;
  rawRequirement: string;
  intentType: IntentType;
  summary: string;
  industry?: string;
  stage?: string;
  goal?: string;
  targetUsers?: string;
  mainProblems: string[];
  suggestedCompanyProfile?: SuggestedCompanyProfile;
  suggestedAgents: SuggestedAgent[];
  suggestedMeetingType: MeetingType;
  recommendedNextAction: string;
  createdAt: number;
  updatedAt: number;
}