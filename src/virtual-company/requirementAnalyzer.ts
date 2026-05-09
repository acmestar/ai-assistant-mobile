// 需求智能分析 - AI 自动理解用户需求并生成公司/项目资料草稿
import { callModel } from './modelRouter';
import type { RequirementAnalysis, IntentType, MeetingType } from './types';

// 分析用户需求
export async function analyzeRequirement(
  rawRequirement: string,
  apiKey: string
): Promise<RequirementAnalysis | null> {
  if (!rawRequirement.trim() || !apiKey) {
    return null;
  }

  const prompt = `你是一个专业的商业分析师和需求理解专家。请分析以下用户需求，判断用户意图，并生成相应的公司/项目资料草稿。

用户需求：
${rawRequirement}

请输出 JSON 格式：
{
  "intentType": "company_creation | project_review | business_problem | personal_advice | content_strategy | product_planning",
  "summary": "用户需求总结（一句话）",
  "industry": "行业领域",
  "stage": "项目/业务阶段（如：筹备期/启动期/成长期/成熟期）",
  "goal": "核心目标",
  "targetUsers": "目标用户/客户",
  "mainProblems": ["问题1", "问题2", "问题3"],
  "suggestedCompanyProfile": {
    "name": "建议公司/项目名称",
    "purpose": "存在目的/使命",
    "industry": "行业",
    "stage": "阶段",
    "businessModel": "商业模式",
    "targetCustomers": "目标客户",
    "coreOffer": "核心产品/服务"
  },
  "suggestedAgents": [
    {
      "role": "角色名称（如：CEO、产品负责人、市场负责人）",
      "responsibility": "主要职责",
      "background": "背景经验",
      "personality": "性格特点"
    }
  ],
  "suggestedMeetingType": "morning | strategy | review | risk | retrospective",
  "recommendedNextAction": "建议下一步操作"
}

判断意图类型的规则：
- company_creation: 用户明确想开一家真实公司或创业
- project_review: 用户有一个项目想法，想评估可行性
- business_problem: 用户有具体的业务问题需要诊断
- personal_advice: 用户需要个人职业/发展建议
- content_strategy: 用户想做内容账号、短视频、小红书等
- product_planning: 用户想规划一个产品

建议团队角色的规则：
- 根据需求类型和行业，建议 4-6 个核心角色
- 每个角色要有明确的职责和专业背景
- 角色要能覆盖用户的核心问题

建议会议类型的规则：
- morning: 日常信息分析、机会识别
- strategy: 战略规划、商业模式设计
- review: 项目评审、可行性分析
- risk: 风险评估、问题诊断
- retrospective: 复盘总结、改进建议

注意：
1. 不要强制所有需求都变成公司
2. 如果只是问题咨询，suggestedCompanyProfile 可以是项目/顾问团资料
3. 分析要准确，不要过度解读用户需求
4. 建议要具体可执行`;

  try {
    const result = await callModel<RequirementAnalysis>(
      'requirement_analysis',
      { prompt },
      { mode: 'standard', companyId: 'temp', meetingId: `analysis-${Date.now()}`, requireJson: true }
    );

    if (result.success && result.data) {
      const analysis: RequirementAnalysis = {
        id: `requirement-${Date.now()}`,
        rawRequirement,
        intentType: result.data.intentType,
        summary: result.data.summary,
        industry: result.data.industry,
        stage: result.data.stage,
        goal: result.data.goal,
        targetUsers: result.data.targetUsers,
        mainProblems: result.data.mainProblems,
        suggestedCompanyProfile: result.data.suggestedCompanyProfile,
        suggestedAgents: result.data.suggestedAgents,
        suggestedMeetingType: result.data.suggestedMeetingType,
        recommendedNextAction: result.data.recommendedNextAction,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return analysis;
    }

    return null;
  } catch (error) {
    console.error('需求分析失败:', error);
    return null;
  }
}

// 根据意图类型获取推荐文案
export function getIntentTypeLabel(intentType: IntentType, language: 'zh' | 'en'): string {
  const labels: Record<IntentType, { zh: string; en: string }> = {
    company_creation: { zh: '创建公司', en: 'Company Creation' },
    project_review: { zh: '项目评审', en: 'Project Review' },
    business_problem: { zh: '业务诊断', en: 'Business Diagnosis' },
    personal_advice: { zh: '个人咨询', en: 'Personal Advice' },
    content_strategy: { zh: '内容策略', en: 'Content Strategy' },
    product_planning: { zh: '产品规划', en: 'Product Planning' },
  };
  return labels[intentType]?.[language] || intentType;
}

// 根据会议类型获取推荐文案
export function getMeetingTypeLabel(meetingType: MeetingType, language: 'zh' | 'en'): string {
  const labels: Record<MeetingType, { zh: string; en: string }> = {
    morning: { zh: '晨会', en: 'Morning Meeting' },
    strategy: { zh: '战略会', en: 'Strategy Meeting' },
    project_review: { zh: '项目评审', en: 'Project Review' },
    review: { zh: '评审会', en: 'Review Meeting' },
    risk: { zh: '风险会', en: 'Risk Meeting' },
    retrospective: { zh: '复盘会', en: 'Retrospective' },
    brainstorm: { zh: '头脑风暴', en: 'Brainstorm' },
  };
  return labels[meetingType]?.[language] || meetingType;
}

// 示例需求
export const EXAMPLE_REQUIREMENTS = [
  {
    title: '宠物店创业',
    content: '我想开一家宠物洗护店，预算20万，在杭州，想知道怎么定位、选址和获客。',
    intentType: 'company_creation' as IntentType,
  },
  {
    title: '短视频涨粉',
    content: '我的小红书账号涨粉很慢，想让AI团队帮我分析原因并制定30天增长计划。',
    intentType: 'content_strategy' as IntentType,
  },
  {
    title: '产品评估',
    content: '我正在做一个AI无限画布工具，想让AI公司帮我评估商业模式、开发优先级和风险。',
    intentType: 'product_planning' as IntentType,
  },
  {
    title: '业务诊断',
    content: '我的电商店铺转化率很低，流量还可以，想分析问题出在哪里。',
    intentType: 'business_problem' as IntentType,
  },
];
