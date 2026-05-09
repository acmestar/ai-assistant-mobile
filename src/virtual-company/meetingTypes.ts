// 会议类型配置

export type MeetingTypeId =
  | 'morning'
  | 'strategy'
  | 'project_review'
  | 'risk'
  | 'review'
  | 'brainstorm';

export interface MeetingTypeConfig {
  id: MeetingTypeId;
  nameZh: string;
  nameEn: string;
  icon: string;
  descriptionZh: string;
  descriptionEn: string;
  outputZh: string;
  outputEn: string;
}

export const MEETING_TYPES: MeetingTypeConfig[] = [
  {
    id: 'morning',
    nameZh: '晨会',
    nameEn: 'Morning',
    icon: '☀️',
    descriptionZh: '明确今天重点、任务优先级和当前卡点',
    descriptionEn: "Clarify today's priorities, blockers and actions",
    outputZh: '今日重点、任务清单、阻碍、下一步行动',
    outputEn: 'Priorities, tasks, blockers, next actions',
  },
  {
    id: 'strategy',
    nameZh: '战略会',
    nameEn: 'Strategy',
    icon: '🎯',
    descriptionZh: '讨论业务方向、市场定位、增长路线和长期目标',
    descriptionEn: 'Discuss business direction, market positioning and long-term goals',
    outputZh: '战略判断、机会分析、路线选择、30/90 天计划',
    outputEn: 'Strategy analysis, opportunity, roadmap, 30/90 day plan',
  },
  {
    id: 'project_review',
    nameZh: '项目评审',
    nameEn: 'Review',
    icon: '📊',
    descriptionZh: '评估项目、方案、内容或任务成果是否值得继续推进',
    descriptionEn: 'Evaluate if projects or deliverables are worth continuing',
    outputZh: '评分、优点、问题、修改建议、是否通过、下一步',
    outputEn: 'Score, pros, issues, suggestions, pass/fail, next steps',
  },
  {
    id: 'risk',
    nameZh: '风险会',
    nameEn: 'Risk',
    icon: '⚠️',
    descriptionZh: '提前识别项目、市场、执行、成本、客户等风险',
    descriptionEn: 'Identify project, market, execution, cost and customer risks',
    outputZh: '风险清单、风险等级、触发条件、影响范围、应对方案',
    outputEn: 'Risk list, severity, triggers, impact, mitigation',
  },
  {
    id: 'review',
    nameZh: '复盘会',
    nameEn: 'Retrospective',
    icon: '🔄',
    descriptionZh: '对已完成项目、活动、内容或阶段结果进行复盘',
    descriptionEn: 'Review completed projects, events or phase results',
    outputZh: '目标、结果、做对/做错、原因、经验、改进动作',
    outputEn: 'Goals, results, learnings, root causes, improvements',
  },
  {
    id: 'brainstorm',
    nameZh: '头脑风暴',
    nameEn: 'Brainstorm',
    icon: '💡',
    descriptionZh: '在方向不明确时发散创意，并筛选可执行方案',
    descriptionEn: 'Generate and filter creative ideas when direction is unclear',
    outputZh: '创意方向、适用场景、难度收益评估、推荐优先级',
    outputEn: 'Ideas, scenarios, difficulty/benefit, priority ranking',
  },
];

// 推荐会议类型
export interface MeetingRecommendation {
  meetingType: MeetingTypeId;
  title: string;
  reason: string;
  expectedOutput: string;
  priority?: 'high' | 'medium' | 'low';
}

// 获取会议类型配置
export function getMeetingTypeConfig(id: MeetingTypeId): MeetingTypeConfig | undefined {
  return MEETING_TYPES.find(m => m.id === id);
}

// 获取会议类型名称
export function getMeetingTypeName(id: MeetingTypeId, language: 'zh' | 'en'): string {
  const config = getMeetingTypeConfig(id);
  return config ? (language === 'zh' ? config.nameZh : config.nameEn) : id;
}
