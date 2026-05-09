# AI 创作中心 - 完整运行逻辑文档

## 一、产品定位

**核心理念**：创作中心是 AI 公司系统中的内容生产模块，支持多种创作场景，包括小说创作、社媒文案、短视频脚本、营销内容等。

创作中心不是简单的文本生成器，而是：
- 理解用户创作意图
- 规划创作结构
- 分阶段生成内容
- 保持风格一致性
- 支持迭代修改

---

## 二、产品结构

```
AI 创作中心
├── 创作类型选择
│   ├── 小说创作
│   ├── 社媒文案
│   ├── 短视频脚本
│   ├── 营销内容
│   ├── 产品文案
│   └── 自由创作
├── 创作流程
│   ├── 创意规划
│   ├── 大纲生成
│   ├── 内容生成
│   ├── 风格统一
│   └── 质量检查
├── 多模型调度系统 (ModelRouter)
└── 生成信息/模型来源系统
```

---

## 三、核心数据结构

### 3.1 创作项目 (CreationProject)

```typescript
interface CreationProject {
  id: string;
  userId?: string;
  companyId?: string;              // 可选：关联到 AI 公司

  // 基本信息
  type: CreationType;
  title: string;
  description?: string;

  // 创作配置
  config: CreationConfig;

  // 创作内容
  outline?: CreationOutline;
  chapters: CreationChapter[];
  currentChapterIndex: number;

  // 生成信息
  generationSourceSummary?: GenerationSourceSummary;

  createdAt: string;
  updatedAt: string;
}

type CreationType =
  | 'novel'           // 小说
  | 'social_media'    // 社媒文案
  | 'short_video'     // 短视频脚本
  | 'marketing'       // 营销内容
  | 'product_copy'    // 产品文案
  | 'free_creation';  // 自由创作
```

### 3.2 创作配置 (CreationConfig)

```typescript
interface CreationConfig {
  // 目标设定
  targetLength?: number;           // 目标字数
  targetPlatform?: string;         // 目标平台（小红书、抖音、微信等）
  targetAudience?: string;         // 目标受众

  // 风格设定
  style: CreationStyle;
  tone?: string;                   // 语气（正式、轻松、幽默等）
  voice?: string;                  // 声音（第一人称、第三人称等）

  // 内容设定
  genre?: string;                  // 类型/题材
  themes?: string[];               // 主题
  keywords?: string[];             // 关键词

  // 生成模式
  mode: UserMode;                  // fast / standard / deep
  language: 'zh-CN' | 'en-US';
}

interface CreationStyle {
  name: string;                    // 风格名称
  description?: string;            // 风格描述
  examples?: string[];             // 风格示例
  referenceTexts?: string[];       // 参考文本
}
```

### 3.3 创作大纲 (CreationOutline)

```typescript
interface CreationOutline {
  id: string;
  projectId: string;

  // 核心设定
  premise: string;                 // 核心设定/前提
  synopsis: string;                // 故事梗概/内容摘要

  // 结构
  structure: OutlineStructure;

  // 人物/角色（小说类）
  characters?: Character[];

  // 世界观（小说类）
  worldBuilding?: WorldBuilding;

  createdAt: string;
}

interface OutlineStructure {
  type: 'three_act' | 'hero_journey' | 'five_act' | 'custom';
  acts: OutlineAct[];
}

interface OutlineAct {
  id: string;
  name: string;                    // 第一幕、第二幕、第三幕
  description: string;
  chapters: OutlineChapter[];
}

interface OutlineChapter {
  id: string;
  title: string;
  summary: string;
  keyEvents: string[];
  estimatedLength: number;         // 预估字数
}

interface Character {
  id: string;
  name: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  description: string;
  personality: string;
  background: string;
  goals: string[];
  arc?: string;                    // 人物弧光
}

interface WorldBuilding {
  setting: string;                 // 时代背景
  location: string;                // 地点
  rules?: string[];                // 世界规则（奇幻/科幻类）
  atmosphere?: string;             // 氛围
}
```

### 3.4 创作章节 (CreationChapter)

```typescript
interface CreationChapter {
  id: string;
  projectId: string;

  // 基本信息
  chapterNumber: number;
  title: string;
  summary?: string;

  // 内容
  content: string;
  wordCount: number;

  // 状态
  status: ChapterStatus;
  version: number;
  previousVersions?: ChapterVersion[];

  // 生成信息
  generationSourceSummary?: GenerationSourceSummary;

  createdAt: string;
  updatedAt: string;
}

type ChapterStatus = 'outline' | 'draft' | 'revised' | 'final';

interface ChapterVersion {
  version: number;
  content: string;
  createdAt: string;
  changeNote?: string;
}
```

### 3.5 创作任务类型 (CreationTaskType)

创作中心使用专门的 TaskType：

```typescript
type CreationTaskType =
  // 创意与规划
  | 'creative_planning'            // 创意规划
  | 'outline_generation'           // 大纲生成
  | 'character_creation'           // 角色创建
  | 'world_building'               // 世界观构建

  // 内容生成
  | 'creative_writing'             // 创意写作
  | 'chapter_generation'           // 章节生成
  | 'scene_writing'                // 场景描写
  | 'dialogue_writing'             // 对话写作

  // 文案创作
  | 'copywriting'                  // 文案写作
  | 'xiaohongshu_style'            // 小红书风格
  | 'short_video_script'           // 短视频脚本
  | 'title_generation'             // 标题生成
  | 'content_variants'             // 内容变体

  // 优化与检查
  | 'style_unification'            // 风格统一
  | 'quality_check'                // 质量检查
  | 'content_revision'             // 内容修订
  | 'content_expansion'            // 内容扩写
  | 'content_condensation';        // 内容精简
```

---

## 四、多模型调度

### 4.1 创作中心模型路由

```typescript
const CREATION_MODEL_ROUTER: Record<CreationTaskType, ModelId> = {
  // 创意与规划（使用 GPT-5.5 进行高质量规划）
  creative_planning: 'gpt-5.5',
  outline_generation: 'gpt-5.5',
  character_creation: 'gpt-5.5',
  world_building: 'gpt-5.5',

  // 内容生成（中文内容使用豆包 2.0）
  creative_writing: 'doubao-2.0',
  chapter_generation: 'doubao-2.0',
  scene_writing: 'doubao-2.0',
  dialogue_writing: 'doubao-2.0',

  // 文案创作
  copywriting: 'doubao-2.0',
  xiaohongshu_style: 'doubao-2.0',
  short_video_script: 'doubao-2.0',
  title_generation: 'doubao-2.0',
  content_variants: 'doubao-2.0',

  // 优化与检查
  style_unification: 'gpt-5.5',
  quality_check: 'kimi-2.5',
  content_revision: 'doubao-2.0',
  content_expansion: 'doubao-2.0',
  content_condensation: 'doubao-2.0',
};
```

### 4.2 模型角色映射

| 模型 | 创作角色 | 适用场景 |
|------|---------|---------|
| GPT-5.5 | 创意总监、结构规划师 | 创意规划、大纲生成、风格统一 |
| Doubao 2.0 | 内容创作者、文案专家 | 中文内容生成、文案写作 |
| Kimi 2.5 | 质量审核员 | 质量检查、内容审核 |
| Grok 4.2 | 创意顾问 | 创意头脑风暴、反方观点 |

### 4.3 用户模式

| 模式 | 特点 | 模型策略 |
|------|------|---------|
| 快速 | 快速生成，适合初稿 | Gemini 3.1 Flash / 豆包 2.0 |
| 标准 | 默认模式，质量平衡 | 按任务类型选择最优模型 |
| 深度 | 高质量创作，适合重要内容 | GPT-5.5 规划 + 豆包 2.0 生成 |

---

## 五、创作流程

### 5.1 小说创作流程

```
用户选择「小说创作」
    ↓
Step 1: 基本设定
├── 小说类型（都市、玄幻、科幻、言情等）
├── 目标字数
├── 风格设定
└── 核心创意/灵感
    ↓
Step 2: 创意规划
├── 调用 callModel('creative_planning', ...)
├── 模型: GPT-5.5
└── 输出: 创意方案、核心冲突、故事走向
    ↓
Step 3: 大纲生成
├── 调用 callModel('outline_generation', ...)
├── 模型: GPT-5.5
└── 输出: 完整大纲、章节规划
    ↓
Step 4: 角色创建（可选）
├── 调用 callModel('character_creation', ...)
├── 模型: GPT-5.5
└── 输出: 主要角色设定
    ↓
Step 5: 章节生成
├── 遍历大纲章节
├── 调用 callModel('chapter_generation', ...)
├── 模型: 豆包 2.0
└── 输出: 章节内容
    ↓
Step 6: 风格统一
├── 调用 callModel('style_unification', ...)
├── 模型: GPT-5.5
└── 检查并统一全文风格
    ↓
Step 7: 质量检查
├── 调用 callModel('quality_check', ...)
├── 模型: Kimi 2.5
└── 输出: 质量报告、修改建议
    ↓
用户确认保存
```

### 5.2 社媒文案流程

```
用户选择「社媒文案」
    ↓
Step 1: 选择平台
├── 小红书
├── 抖音
├── 微信公众号
├── 微博
└── 其他
    ↓
Step 2: 输入信息
├── 产品/服务描述
├── 目标受众
├── 核心卖点
└── 关键词
    ↓
Step 3: 文案生成
├── 调用 callModel('xiaohongshu_style', ...) // 小红书
├── 或 callModel('copywriting', ...)          // 其他平台
├── 模型: 豆包 2.0
└── 输出: 多个文案版本
    ↓
Step 4: 标题生成
├── 调用 callModel('title_generation', ...)
├── 模型: 豆包 2.0
└── 输出: 多个标题选项
    ↓
Step 5: 内容变体（可选）
├── 调用 callModel('content_variants', ...)
├── 模型: 豆包 2.0
└── 输出: 不同风格的变体
    ↓
用户选择保存
```

### 5.3 短视频脚本流程

```
用户选择「短视频脚本」
    ↓
Step 1: 基本设定
├── 视频时长
├── 视频类型（剧情、口播、教程等）
├── 目标平台
└── 核心主题
    ↓
Step 2: 脚本生成
├── 调用 callModel('short_video_script', ...)
├── 模型: 豆包 2.0
└── 输出: 完整脚本
    ├── 开头钩子
├── 正文内容
├── 情绪高潮
└── 结尾引导
    ↓
Step 3: 分镜建议（可选）
├── 生成分镜描述
└── 场景、镜头、台词对应
    ↓
用户确认保存
```

---

## 六、创作中心 Prompt 模板

### 6.1 创意规划 Prompt

```typescript
const CREATIVE_PLANNING_PROMPT = `
你是一位资深创意总监，请根据以下信息进行创意规划：

【创作类型】
{type}

【核心创意】
{coreIdea}

【风格要求】
{style}

【目标受众】
{targetAudience}

请输出：
1. 核心冲突/张力点
2. 故事走向建议
3. 创意亮点（3-5个）
4. 潜在风险点
5. 差异化建议

输出 JSON 格式。
`;
```

### 6.2 大纲生成 Prompt

```typescript
const OUTLINE_GENERATION_PROMPT = `
你是一位专业的结构规划师，请根据以下创意规划生成详细大纲：

【创意规划】
{creativePlan}

【目标字数】
{targetLength}

【章节要求】
- 每章 2000-5000 字
- 总章节数：{chapterCount}

请输出：
1. 故事梗概（200字以内）
2. 章节大纲（每章包含：标题、摘要、关键事件、预估字数）
3. 节奏设计（起承转合）

输出 JSON 格式。
`;
```

### 6.3 章节生成 Prompt

```typescript
const CHAPTER_GENERATION_PROMPT = `
你是一位才华横溢的内容创作者，请根据以下大纲生成章节内容：

【故事背景】
{synopsis}

【本章信息】
章节：{chapterNumber} - {chapterTitle}
摘要：{chapterSummary}
关键事件：{keyEvents}

【风格要求】
{style}

【角色信息】
{characters}

【前文内容】
{previousContent}

请生成完整的章节内容，要求：
1. 字数：{targetLength} 字左右
2. 保持风格一致
3. 情节紧凑，有张力
4. 对话自然，符合人物性格

直接输出章节内容，不要额外解释。
`;
```

### 6.4 小红书文案 Prompt

```typescript
const XIAOHONGSHU_STYLE_PROMPT = `
你是一位小红书爆款文案专家，请根据以下信息创作文案：

【产品/服务】
{product}

【目标受众】
{targetAudience}

【核心卖点】
{sellingPoints}

【关键词】
{keywords}

请输出 3 个不同风格的文案版本，每个版本包含：
1. 标题（带表情符号，吸引眼球）
2. 正文（带表情符号，分段清晰）
3. 标签（5-8个）

要求：
- 标题要有"钩子"，引发好奇
- 开头 3 秒抓住注意力
- 内容真实可信，避免过度营销感
- 结尾有互动引导

输出 JSON 格式：
{
  "versions": [
    {
      "title": "...",
      "content": "...",
      "tags": ["...", "..."]
    }
  ]
}
`;
```

### 6.5 质量检查 Prompt

```typescript
const QUALITY_CHECK_PROMPT = `
你是一位专业的内容审核员，请对以下内容进行质量检查：

【内容】
{content}

【检查维度】
1. 逻辑连贯性
2. 情节合理性
3. 人物一致性
4. 语言流畅度
5. 风格统一性
6. 错别字/语病

请输出：
{
  "overallScore": 1-10,
  "dimensions": {
    "logic": { "score": 1-10, "comment": "..." },
    "plot": { "score": 1-10, "comment": "..." },
    "character": { "score": 1-10, "comment": "..." },
    "language": { "score": 1-10, "comment": "..." },
    "style": { "score": 1-10, "comment": "..." }
  },
  "issues": [
    { "type": "...", "location": "...", "description": "...", "suggestion": "..." }
  ],
  "highlights": ["...", "..."]
}
`;
```

---

## 七、风格系统

### 7.1 预设风格

```typescript
const PRESET_STYLES: Record<string, CreationStyle> = {
  'literary': {
    name: '文艺风',
    description: '细腻、诗意、注重内心描写',
    examples: ['阳光透过树叶的缝隙，斑驳地洒在她的脸上...'],
  },
  'commercial': {
    name: '商业风',
    description: '简洁、有力、注重转化',
    examples: ['限时特惠，错过再等一年！'],
  },
  'humorous': {
    name: '幽默风',
    description: '轻松、有趣、引人发笑',
    examples: ['本想咸鱼翻身，结果粘锅了。'],
  },
  'suspense': {
    name: '悬疑风',
    description: '紧张、神秘、扣人心弦',
    examples: ['门外的脚步声越来越近，她屏住了呼吸...'],
  },
  'sweet': {
    name: '甜宠风',
    description: '温馨、浪漫、治愈',
    examples: ['他轻轻揉了揉她的头发，眼里满是宠溺。'],
  },
  'xiaohongshu': {
    name: '小红书风',
    description: '种草、分享、真实感',
    examples: ['姐妹们！这个真的绝了！'],
  },
};
```

### 7.2 风格统一机制

```typescript
async function unifyStyle(project: CreationProject): Promise<void> {
  // 1. 收集所有章节内容
  const allContent = project.chapters.map(c => c.content).join('\n\n');

  // 2. 分析风格特征
  const styleAnalysis = await callModel('style_unification', {
    prompt: `分析以下内容的风格特征，并给出统一建议：

${allContent.slice(0, 10000)}

请输出：
1. 当前风格特征
2. 风格不一致的地方
3. 统一建议`,
  }, { mode: 'standard' });

  // 3. 生成风格指南
  const styleGuide = styleAnalysis.data;

  // 4. 逐章检查并标记需要修改的地方
  for (const chapter of project.chapters) {
    const checkResult = await callModel('quality_check', {
      prompt: `根据以下风格指南检查章节内容：

【风格指南】
${JSON.stringify(styleGuide)}

【章节内容】
${chapter.content}

请标记不符合风格指南的地方，并给出修改建议。`,
    }, { mode: 'standard' });

    // 保存检查结果供用户参考
    chapter.styleIssues = checkResult.data?.issues || [];
  }
}
```

---

## 八、版本管理

### 8.1 章节版本控制

```typescript
interface ChapterVersionManager {
  // 保存新版本
  saveVersion(chapter: CreationChapter, content: string, note?: string): void;

  // 获取历史版本
  getVersions(chapterId: string): ChapterVersion[];

  // 恢复到指定版本
  restoreVersion(chapterId: string, version: number): CreationChapter;

  // 对比两个版本
  compareVersions(chapterId: string, v1: number, v2: number): VersionDiff;
}

interface VersionDiff {
  additions: string[];
  deletions: string[];
  modifications: Array<{
    original: string;
    modified: string;
  }>;
}
```

### 8.2 自动保存机制

```typescript
// 每 30 秒自动保存草稿
const AUTO_SAVE_INTERVAL = 30000;

function setupAutoSave(projectId: string) {
  setInterval(async () => {
    const project = getProject(projectId);
    if (project && hasUnsavedChanges(project)) {
      await saveDraft(project);
    }
  }, AUTO_SAVE_INTERVAL);
}
```

---

## 九、与 AI 公司集成

### 9.1 创作中心作为公司能力

创作中心可以与 AI 公司系统集成：

```typescript
interface CompanyCreationCapability {
  // 公司可以为创作提供上下文
  companyContext?: {
    purpose: string;           // 公司使命
    products: string[];        // 产品信息
    targetUsers: string[];     // 目标用户
    brandVoice?: string;       // 品牌声音
  };

  // 公司团队成员可以参与创作评审
  reviewers?: CompanyAgent[];
}
```

### 9.2 创作评审流程

```typescript
async function reviewCreation(
  project: CreationProject,
  reviewers: CompanyAgent[]
): Promise<ReviewResult[]> {
  const results: ReviewResult[] = [];

  for (const reviewer of reviewers) {
    const taskType = getTaskTypeForAgent(reviewer, 'review');
    
    const review = await callModel(taskType, {
      prompt: `作为${reviewer.role}，请从专业角度评审以下创作内容：

【创作类型】
${project.type}

【创作内容】
${project.chapters[project.currentChapterIndex]?.content}

请给出：
1. 专业评价
2. 改进建议
3. 风险提示`,
      systemPrompt: `你是${reviewer.name}，${reviewer.role}。
性格：${reviewer.personality}
说话风格：${reviewer.speakingStyle}`,
    }, { mode: 'standard' });

    results.push({
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      role: reviewer.role,
      review: review.data,
    });
  }

  return results;
}
```

---

## 十、生成信息展示

### 10.1 创作生成信息

```typescript
interface CreationGenerationInfo {
  projectId: string;
  chapterId?: string;

  // 使用的模型
  models: Array<{
    taskType: CreationTaskType;
    modelName: ModelId;
    roleName: string;
    tokens: {
      input: number;
      output: number;
    };
  }>;

  // 生成时间
  duration: number;

  // 生成模式
  mode: UserMode;
}
```

### 10.2 展示格式

```
生成信息
本次创作由 AI 创作团队协作完成。

参与角色：
- 创意总监：GPT-5.5，负责创意规划和大纲设计
- 内容创作者：豆包 2.0，负责内容生成
- 质量审核员：Kimi 2.5，负责质量检查

生成统计：
- 总耗时：3分28秒
- 总 Token：15,234
- 生成模式：标准
```

---

## 十一、错误处理

### 11.1 常见错误

| 错误 | 处理 |
|------|------|
| 内容生成中断 | 保存已生成部分，支持续写 |
| 风格不统一 | 提示用户，提供统一建议 |
| 字数不达标 | 提示扩写建议 |
| 内容质量低 | 提供修改建议，支持重新生成 |

### 11.2 续写机制

```typescript
async function continueGeneration(
  chapter: CreationChapter,
  lastContent: string
): Promise<string> {
  const continuation = await callModel('chapter_generation', {
    prompt: `请继续以下内容，保持风格一致：

【前文】
${lastContent.slice(-2000)}

【本章大纲】
${chapter.summary}

请继续写作，自然衔接上文。`,
  }, { mode: 'standard' });

  return continuation.data;
}
```

---

## 十二、性能优化

### 12.1 长内容分块生成

```typescript
async function generateLongChapter(
  outline: OutlineChapter,
  context: CreationContext
): Promise<string> {
  const chunks: string[] = [];
  const events = outline.keyEvents;

  for (let i = 0; i < events.length; i++) {
    const chunk = await callModel('scene_writing', {
      prompt: `根据以下信息生成场景内容：

【场景事件】
${events[i]}

【前文内容】
${chunks.join('\n\n').slice(-2000)}

【风格要求】
${context.style}`,
    }, { mode: context.mode });

    chunks.push(chunk.data);
  }

  return chunks.join('\n\n');
}
```

### 12.2 并行生成

```typescript
async function generateMultipleVariants(
  prompt: string,
  count: number = 3
): Promise<string[]> {
  const results = await Promise.all(
    Array(count).fill(null).map((_, i) =>
      callModel('content_variants', {
        prompt,
        systemPrompt: `你是文案专家，请生成第 ${i + 1} 个不同风格的版本。`,
      }, { mode: 'fast' })
    )
  );

  return results.filter(r => r.success).map(r => r.data);
}
```

---

## 十三、总结

### 核心要点

1. **创作中心是专业的内容生产模块**，不是简单的文本生成器
2. **不同创作任务使用不同模型**：规划用 GPT-5.5，中文内容用豆包 2.0
3. **支持完整的创作流程**：从创意规划到质量检查
4. **风格系统保证一致性**：预设风格 + 风格统一机制
5. **版本管理支持迭代**：自动保存 + 历史版本
6. **可与 AI 公司集成**：公司上下文 + 团队评审

### 一句话总结

> 创作中心通过多模型协作，为用户提供专业、高效、风格一致的内容创作能力，支持从创意规划到质量检查的完整创作流程。
