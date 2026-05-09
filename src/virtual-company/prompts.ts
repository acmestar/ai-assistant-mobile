// AI 虚拟公司 - Prompt 模板

import {
  CompanySessionConfig,
  ProjectAnalysis,
  VirtualCompany,
  CompanyAgent,
  AgentReview,
  AgentDebate,
} from './types';

// JSON 解析辅助函数
export function parseJsonResponse<T>(text: string): T | null {
  try {
    // 尝试直接解析
    return JSON.parse(text) as T;
  } catch {
    // 尝试提取 JSON 块
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as T;
      } catch {
        // 继续尝试其他方法
      }
    }
    // 尝试找到第一个 { 和最后一个 }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        // 解析失败
      }
    }
    return null;
  }
}

// 1. 需求分析 Prompt
export function buildProjectAnalysisPrompt(requirement: string): string {
  return `你是一个资深商业分析师和产品需求分析师。

请分析用户输入的项目需求，并输出严格 JSON。

用户需求：
${requirement}

你需要提取：
1. 项目类型；
2. 所属行业；
3. 目标用户；
4. 需要解决的核心问题；
5. 核心价值；
6. 关键功能；
7. 商业目标；
8. 技术复杂度；
9. 当前项目阶段；
10. 主要风险；
11. 需求中缺失的重要信息。

要求：
- 必须结合用户具体需求；
- 不要输出空话；
- 不要 Markdown；
- 只输出 JSON；
- JSON 必须可以被 JSON.parse 解析。

输出格式：
{
  "projectType": "",
  "industry": "",
  "targetUsers": [],
  "coreProblem": "",
  "coreValue": "",
  "keyFeatures": [],
  "businessGoal": "",
  "complexity": "low | medium | high",
  "stage": "idea | mvp | growth | enterprise",
  "keyRisks": [],
  "missingInfo": []
}`;
}

// 2. 公司生成 Prompt
export function buildCompanyGenerationPrompt(
  requirement: string,
  projectAnalysis: ProjectAnalysis
): string {
  return `你是一个品牌战略顾问和创业公司命名专家。

请根据用户需求和项目分析，创建一家适合该项目的虚拟公司。

用户需求：
${requirement}

项目分析：
${JSON.stringify(projectAnalysis, null, 2)}

要求：
1. 公司名称要符合项目行业；
2. 名字要自然，不能像随机词；
3. 公司定位要清晰；
4. 使命要和用户需求相关；
5. 说明为什么这家公司适合承接这个项目；
6. 只输出 JSON，不要 Markdown。

输出格式：
{
  "name": "",
  "englishName": "",
  "slogan": "",
  "positioning": "",
  "mission": "",
  "vision": "",
  "stage": "",
  "reason": ""
}`;
}

// 3. Agent 生成 Prompt
export function buildAgentsGenerationPrompt(
  requirement: string,
  projectAnalysis: ProjectAnalysis,
  company: VirtualCompany,
  config: CompanySessionConfig
): string {
  return `你是一个组织架构设计专家。

请根据用户需求、项目分析和虚拟公司信息，为这个项目生成适合的 AI 公司成员。

用户需求：
${requirement}

项目分析：
${JSON.stringify(projectAnalysis, null, 2)}

公司信息：
${JSON.stringify(company, null, 2)}

配置：
- 角色数量：${config.roleCount}
- 评审深度：${config.reviewDepth}

要求：
1. 根据项目类型动态生成角色；
2. 角色数量接近 ${config.roleCount}；
3. 必须包含 CEO 或项目总负责人；
4. 如果是技术产品，应包含产品和技术角色；
5. 如果涉及商业化，应包含市场或财务角色；
6. 如果存在合规风险，应包含法务或合规角色；
7. 每个角色必须有中文姓名；
8. 每个角色的人设要有差异；
9. 每个角色必须有明确职责和关注点；
10. 只输出 JSON，不要 Markdown。

输出格式：
{
  "organization": [
    {
      "id": "",
      "name": "",
      "description": "",
      "roles": []
    }
  ],
  "agents": [
    {
      "id": "",
      "name": "",
      "role": "",
      "department": "",
      "personality": "",
      "background": "",
      "responsibilities": [],
      "focusAreas": [],
      "speakingStyle": "",
      "decisionPower": "",
      "reviewOrder": 1
    }
  ]
}`;
}

// 4. 评审流程 Prompt
export function buildWorkflowPrompt(
  requirement: string,
  projectAnalysis: ProjectAnalysis,
  agents: CompanyAgent[]
): string {
  return `你是一个项目评审流程设计专家。

请根据用户需求、项目分析和 AI 角色列表，设计合理的项目评审顺序。

用户需求：
${requirement}

项目分析：
${JSON.stringify(projectAnalysis, null, 2)}

AI 角色：
${JSON.stringify(agents.map(a => ({ id: a.id, name: a.name, role: a.role, reviewOrder: a.reviewOrder })), null, 2)}

要求：
1. 评审顺序要符合业务逻辑；
2. 先理解需求，再评估产品、技术、市场、商业、风险，最后总结；
3. 每个步骤要指定 agentId；
4. 每个步骤要说明任务；
5. 每个步骤要说明期望输出；
6. 只输出 JSON，不要 Markdown。

输出格式：
{
  "workflow": [
    {
      "step": 1,
      "agentId": "",
      "agentName": "",
      "role": "",
      "task": "",
      "expectedOutput": [],
      "status": "pending"
    }
  ]
}`;
}

// 5. 单角色评审 Prompt
export function buildAgentReviewPrompt(
  requirement: string,
  projectAnalysis: ProjectAnalysis,
  company: VirtualCompany,
  agent: CompanyAgent,
  previousReviews: AgentReview[]
): string {
  const previousReviewsText = previousReviews.length > 0
    ? previousReviews.map(r => `【${r.agentName} - ${r.role}】\n摘要：${r.summary}\n建议：${r.suggestions.join('、')}`).join('\n\n')
    : '无';

  return `你现在要扮演一个虚拟公司的 AI 成员。

用户需求：
${requirement}

项目分析：
${JSON.stringify(projectAnalysis, null, 2)}

公司信息：
${JSON.stringify(company, null, 2)}

你的角色信息：
${JSON.stringify(agent, null, 2)}

前面角色的评审意见：
${previousReviewsText}

请严格站在你的角色立场评审这个项目。

要求：
1. 只能从你的职位职责出发；
2. 必须结合用户需求，不要泛泛而谈；
3. 如果你不同意前面角色观点，请明确指出；
4. 输出要具体、可执行；
5. 必须给出建议和风险；
6. 如果适合，请给出评分（1-10）；
7. 只输出 JSON，不要 Markdown。

输出格式：
{
  "summary": "",
  "details": "",
  "suggestions": [],
  "risks": [],
  "questionsToOthers": [
    {
      "toRole": "",
      "question": "",
      "reason": ""
    }
  ],
  "score": 0
}`;
}

// 6. 角色讨论 Prompt
export function buildDebatePrompt(
  requirement: string,
  agents: CompanyAgent[],
  reviews: AgentReview[]
): string {
  return `你是一个多角色项目评审会议主持人。

请根据所有角色的评审意见，生成一轮有价值的交叉质疑和回应。

用户需求：
${requirement}

AI 角色：
${JSON.stringify(agents.map(a => ({ id: a.id, name: a.name, role: a.role })), null, 2)}

角色评审意见：
${JSON.stringify(reviews.map(r => ({
  agentName: r.agentName,
  role: r.role,
  summary: r.summary,
  suggestions: r.suggestions,
  questionsToOthers: r.questionsToOthers
})), null, 2)}

要求：
1. 不要制造无意义争论；
2. 只选择最关键的 3 到 6 个矛盾点；
3. 每个质疑必须有明确对象；
4. 回应要能推动方案修正；
5. 讨论要围绕产品、技术、市场、商业、合规、执行风险；
6. 只输出 JSON，不要 Markdown。

输出格式：
{
  "debates": [
    {
      "fromAgentId": "",
      "fromAgentName": "",
      "fromRole": "",
      "toAgentId": "",
      "toAgentName": "",
      "toRole": "",
      "question": "",
      "challengePoint": "",
      "response": "",
      "conclusion": ""
    }
  ]
}`;
}

// 7. 最终报告 Prompt
export function buildFinalReportPrompt(
  requirement: string,
  projectAnalysis: ProjectAnalysis,
  company: VirtualCompany,
  _agents: CompanyAgent[],
  reviews: AgentReview[],
  debates: AgentDebate[],
  _config: CompanySessionConfig
): string {
  const debatesText = debates.length > 0
    ? debates.map(d => `【${d.fromAgentName} → ${d.toAgentName}】\n质疑：${d.challengePoint}\n回应：${d.response}\n结论：${d.conclusion}`).join('\n\n')
    : '无';

  return `你是虚拟公司的 CEO 和最终决策官。

请根据用户需求、项目分析、公司信息、角色评审意见和讨论记录，输出最终项目决策报告。

用户需求：
${requirement}

项目分析：
${JSON.stringify(projectAnalysis, null, 2)}

公司信息：
${JSON.stringify(company, null, 2)}

角色评审意见：
${JSON.stringify(reviews.map(r => ({
  agentName: r.agentName,
  role: r.role,
  summary: r.summary,
  score: r.score
})), null, 2)}

讨论记录：
${debatesText}

要求：
1. 决策要基于所有角色的评审意见；
2. 评分要客观，综合各角色意见；
3. MVP 范围要具体可行；
4. 执行计划要分阶段，每阶段有明确目标和交付物；
5. 风险要具体，不能泛泛而谈；
6. 下一步行动要可执行；
7. 只输出 JSON，不要 Markdown。

输出格式：
{
  "decision": "recommend | conditional_recommend | hold | reject",
  "decisionText": "",
  "projectScore": {
    "market": 0,
    "product": 0,
    "technology": 0,
    "business": 0,
    "operation": 0,
    "risk": 0,
    "overall": 0
  },
  "mvpScope": [],
  "notRecommendedForV1": [],
  "executionPlan": [
    {
      "phase": "",
      "duration": "",
      "goals": [],
      "deliverables": []
    }
  ],
  "teamSuggestion": [],
  "estimatedTime": "",
  "estimatedCost": "",
  "mainRisks": [],
  "successMetrics": [],
  "nextActions": [],
  "executiveSummary": ""
}`;
}

// 8. 继续追问 Prompt
export function buildFollowUpPrompt(
  requirement: string,
  sessionContext: string,
  userQuestion: string,
  targetAgent?: CompanyAgent
): string {
  if (targetAgent) {
    return `你是虚拟公司的 ${targetAgent.role} - ${targetAgent.name}。

项目背景：
${requirement}

之前的评审内容：
${sessionContext}

你的角色信息：
${JSON.stringify(targetAgent, null, 2)}

用户问题：
${userQuestion}

请以你的角色身份回答这个问题。要求：
1. 保持角色特点和专业视角；
2. 回答要具体、有建设性；
3. 如果涉及其他部门，可以建议咨询对应负责人；
4. 直接输出回答内容，不需要 JSON。`;
  }

  return `你是虚拟公司的 CEO。

项目背景：
${requirement}

之前的评审内容：
${sessionContext}

用户问题：
${userQuestion}

请以 CEO 的身份综合各方意见回答这个问题。要求：
1. 综合考虑产品、技术、市场、商业等各方面；
2. 回答要具体、有建设性；
3. 直接输出回答内容，不需要 JSON。`;
}
