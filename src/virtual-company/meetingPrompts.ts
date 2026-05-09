// 会议 Prompt 构建函数

import {
  MeetingTypeId,
  MeetingRecommendation,
  getMeetingTypeConfig,
} from './meetingTypes';
import type {
  CompanyContextSnapshot,
  CompanyMemory,
  AgentSpeech,
} from './types';

// 根据会议类型构建发言 Prompt
export function buildSpeechPrompt(
  content: string,
  contextSnapshot: CompanyContextSnapshot,
  relatedMemories: CompanyMemory[],
  meetingType: MeetingTypeId,
  agentName: string,
  agentRole: string,
  previousSpeeches: AgentSpeech[]
): string {
  const meetingName = getMeetingTypeConfig(meetingType)?.nameZh || meetingType;

  // 根据会议类型定制发言重点
  const focusInstructions = getMeetingFocusInstructions(meetingType);

  return `你是${agentName}，${agentRole}，正在参加${meetingName}。

公司背景：
${JSON.stringify(contextSnapshot, null, 2)}

相关记忆：
${relatedMemories.map(m => `- [${m.type}] ${m.content}`).join('\n') || '无'}

会议输入内容：
${content}

前面发言者的观点：
${previousSpeeches.map(s => `【${s.agentName}】${s.content}`).join('\n') || '暂无'}

${focusInstructions}

请从你的专业角度发表观点。要求：
1. 站在你的角色立场分析
2. 给出具体建议和风险提示
3. 如果有不同意见，明确指出

输出 JSON 格式：
{
  "content": "核心观点（150字以内）",
  "suggestions": ["建议1", "建议2"],
  "risks": ["风险1", "风险2"]
}`;
}

// 根据会议类型构建纪要 Prompt
export function buildMinutesPrompt(
  content: string,
  contextSnapshot: CompanyContextSnapshot,
  relatedMemories: CompanyMemory[],
  speeches: AgentSpeech[],
  meetingType: MeetingTypeId
): string {
  const outputFormat = getMeetingOutputFormat(meetingType);

  return `你是会议主持人，请根据讨论结果生成会议纪要。

公司背景：
${JSON.stringify(contextSnapshot, null, 2)}

相关记忆：
${relatedMemories.map(m => `- [${m.type}] ${m.content}`).join('\n') || '无'}

会议输入内容：
${content}

各角色发言：
${speeches.map(s => `【${s.agentName}（${s.role}）】\n${s.content}\n建议：${s.suggestions.join('、')}\n风险：${s.risks.join('、')}`).join('\n\n')}

请生成完整的会议纪要。

${outputFormat}`;
}

// 获取会议类型的发言重点指令
function getMeetingFocusInstructions(meetingType: MeetingTypeId): string {
  switch (meetingType) {
    case 'morning':
      return `晨会重点：
1. 分析这条信息对今日工作的影响
2. 判断是否需要调整今日优先级
3. 识别可能的阻碍和风险
4. 给出今日可执行的行动建议`;

    case 'strategy':
      return `战略会重点：
1. 分析对公司长期方向的影响
2. 识别新的市场机会或威胁
3. 评估当前战略的适配性
4. 提出战略调整建议`;

    case 'project_review':
      return `项目评审重点：
1. 评估项目/方案的完成质量
2. 分析优点和问题
3. 判断是否值得继续推进
4. 给出修改建议和下一步行动`;

    case 'risk':
      return `风险会重点：
1. 识别潜在风险点
2. 评估风险严重程度
3. 分析触发条件和影响范围
4. 提出应对方案和预案`;

    case 'review':
      return `复盘会重点：
1. 对比目标与实际结果
2. 分析做对和做错的地方
3. 找出根本原因
4. 总结可复用经验和改进动作`;

    case 'brainstorm':
      return `头脑风暴重点：
1. 发散创意方向
2. 分析每个方向的适用场景
3. 评估成本、难度和收益
4. 推荐最值得尝试的方案`;

    default:
      return '请从专业角度分析并给出建议。';
  }
}

// 获取会议类型的输出格式
function getMeetingOutputFormat(meetingType: MeetingTypeId): string {
  switch (meetingType) {
    case 'morning':
      return `输出 JSON 格式：
{
  "meetingType": "morning",
  "informationSummary": "信息摘要（100字以内）",
  "relevanceLevel": "high" | "medium" | "low",
  "relevanceReason": "关联度判断理由",
  "todayFocus": ["今日最重要的3件事"],
  "tasks": ["任务1", "任务2"],
  "blockers": ["阻碍1", "阻碍2"],
  "nextActions": ["下一步行动1", "下一步行动2"],
  "opportunities": ["机会1"],
  "risks": ["风险1"],
  "todayActions": ["今日行动1", "今日行动2"]
}`;

    case 'strategy':
      return `输出 JSON 格式：
{
  "meetingType": "strategy",
  "informationSummary": "信息摘要（100字以内）",
  "currentSituation": "当前形势判断",
  "coreOpportunities": ["核心机会1", "核心机会2"],
  "coreRisks": ["核心风险1", "核心风险2"],
  "strategicPaths": [
    { "path": "路径名称", "pros": "优势", "cons": "劣势" }
  ],
  "recommendedPath": "推荐路径",
  "plan30Days": ["30天计划项1", "30天计划项2"],
  "plan90Days": ["90天计划项1", "90天计划项2"],
  "opportunities": ["机会1"],
  "risks": ["风险1"],
  "todayActions": ["今日行动1"]
}`;

    case 'project_review':
      return `输出 JSON 格式：
{
  "meetingType": "project_review",
  "projectGoal": "项目目标",
  "completionRate": "完成度百分比",
  "qualityScore": "1-10分",
  "pros": ["优点1", "优点2"],
  "issues": ["问题1", "问题2"],
  "suggestions": ["修改建议1", "修改建议2"],
  "recommendation": "通过" | "修改后通过" | "不通过",
  "nextActions": ["下一步行动1", "下一步行动2"],
  "opportunities": ["机会1"],
  "risks": ["风险1"],
  "todayActions": ["今日行动1"]
}`;

    case 'risk':
      return `输出 JSON 格式：
{
  "meetingType": "risk",
  "informationSummary": "信息摘要（100字以内）",
  "riskList": [
    {
      "risk": "风险名称",
      "severity": "high" | "medium" | "low",
      "trigger": "触发条件",
      "impact": "影响范围",
      "mitigation": "应对方案"
    }
  ],
  "topPriorityRisk": "当前最需要处理的风险",
  "contingencyPlans": ["预案1", "预案2"],
  "opportunities": ["机会1"],
  "risks": ["风险1"],
  "todayActions": ["今日行动1"]
}`;

    case 'review':
      return `输出 JSON 格式：
{
  "meetingType": "review",
  "originalGoal": "原目标",
  "actualResult": "实际结果",
  "whatWentRight": ["做对的地方1", "做对的地方2"],
  "whatWentWrong": ["做错的地方1", "做错的地方2"],
  "rootCauses": ["根本原因1", "根本原因2"],
  "lessons": ["可复用经验1", "可复用经验2"],
  "improvements": ["改进动作1", "改进动作2"],
  "opportunities": ["机会1"],
  "risks": ["风险1"],
  "todayActions": ["今日行动1"]
}`;

    case 'brainstorm':
      return `输出 JSON 格式：
{
  "meetingType": "brainstorm",
  "ideas": [
    {
      "idea": "创意方向",
      "scenario": "适用场景",
      "difficulty": "低" | "中" | "高",
      "benefit": "收益评估",
      "priority": 1-10
    }
  ],
  "top3Ideas": ["最值得尝试的3个方案"],
  "opportunities": ["机会1"],
  "risks": ["风险1"],
  "todayActions": ["今日行动1"]
}`;

    default:
      return `输出 JSON 格式：
{
  "meetingType": "${meetingType}",
  "informationSummary": "信息摘要",
  "opportunities": ["机会1"],
  "risks": ["风险1"],
  "todayActions": ["今日行动1"]
}`;
  }
}

// 构建推荐会议 Prompt
export function buildMeetingRecommendationPrompt(
  contextSnapshot: CompanyContextSnapshot,
  recentMeetings: Array<{ type: string; createdAt: string }>,
  recentTasks: Array<{ title: string; status: string }>
): string {
  return `你是 AI 公司的会议主持人。
请根据公司档案、当前任务、最近会议记录，推荐最值得召开的 3-5 个会议主题。

公司背景：
${JSON.stringify(contextSnapshot, null, 2)}

最近会议记录（最近5场）：
${recentMeetings.slice(-5).map(m => `- ${m.type} 于 ${m.createdAt}`).join('\n') || '暂无'}

当前任务列表：
${recentTasks.slice(0, 10).map(t => `- ${t.title}（${t.status}）`).join('\n') || '暂无'}

请推荐最值得召开的会议。要求：
1. 结合公司当前阶段和目标
2. 考虑最近会议情况，避免重复
3. 关注当前任务进展和潜在问题

输出 JSON 数组格式：
[
  {
    "meetingType": "morning" | "strategy" | "project_review" | "risk" | "review" | "brainstorm",
    "title": "会议主题",
    "reason": "为什么现在应该开这个会",
    "expectedOutput": "这场会会产出什么",
    "priority": "high" | "medium" | "low"
  }
]

只输出 JSON 数组，不要其他内容。`;
}

// 解析推荐结果
export function parseRecommendationResult(result: string): MeetingRecommendation[] {
  try {
    // 尝试提取 JSON 数组
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          meetingType: item.meetingType as MeetingTypeId,
          title: item.title || '',
          reason: item.reason || '',
          expectedOutput: item.expectedOutput || '',
          priority: item.priority as 'high' | 'medium' | 'low' | undefined,
        }));
      }
    }
  } catch (error) {
    console.error('解析推荐结果失败:', error);
  }

  // 返回空数组而不是报错
  return [];
}
