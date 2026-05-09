# AI 助手 Mobile App - 实际生成逻辑总文档

> **重要声明**：本文档仅描述代码中实际实现的功能。不包含理想设计、未来规划或仅存在于文档中的功能。

---

## 一、模块结构概览

```
mobile-app/src/
├── App.tsx              # 主应用入口、底部导航、主题初始化
├── store.ts             # 全局状态管理（zustand + persist）
├── api.ts               # API 调用封装（聊天、生图、队列执行）
├── ChatTab.tsx          # 聊天页面 + 创作队列面板
├── ImageTab.tsx         # 图片生成页面
├── SuperWritingTab.tsx  # 超级写作独立标签页
├── SettingsTab.tsx      # 设置页面
├── i18n.ts              # 国际化
├── utils.ts             # 工具函数
└── virtual-company/     # AI 公司系统
    ├── types.ts         # 类型定义
    ├── modelRouter.ts   # 多模型调度核心
    ├── orchestrator.ts  # 编排器
    ├── prompts.ts       # Prompt 模板
    ├── VirtualCompanyTab.tsx    # 虚拟公司临时问答
    ├── CompanyListPage.tsx      # 公司列表
    ├── CompanyWorkspace.tsx     # 公司工作台
    ├── CompanyMeetingPage.tsx   # 公司会议
    ├── MorningMeetingTab.tsx    # 晨会（旧版）
    └── ...
```

---

## 二、全局状态管理（store.ts）

### 2.1 持久化策略

使用 `zustand/persist` + `partialize` 选择性持久化：

```typescript
partialize: (state) => ({
  apiKey: state.apiKey,
  conversations: state.conversations,
  currentConversationId: state.currentConversationId,
  chatModelId: state.chatModelId,
  imageModelId: state.imageModelId,
  imageRatio: state.imageRatio,
  imageQuality: state.imageQuality,
  imageRecords: state.imageRecords,
  theme: state.theme,
  tokenUsage: state.tokenUsage.slice(0, 50),
  language: state.language,
  elderMode: state.elderMode,
  characterMemory: state.characterMemory,
  worldSetting: state.worldSetting,
  savedTasks: state.savedTasks.slice(-5),
  virtualCompanySessions: state.virtualCompanySessions?.slice(0, 10),
  aiCompanies: state.aiCompanies,
  currentCompanyId: state.currentCompanyId,
  modelQueue: state.modelQueue,  // 章节内容持久化
  activeWritingDraft: state.activeWritingDraft
    ? { ...state.activeWritingDraft, modelQueue: [] }  // 去重
    : null,
})
```

### 2.2 核心状态结构

| 状态 | 类型 | 说明 |
|------|------|------|
| `conversations` | `Conversation[]` | 对话列表，每个对话包含消息数组 |
| `modelQueue` | `QueueItem[]` | 创作队列，包含 instruction、result、enabled |
| `characterMemory` | `Character[]` | 角色记忆库（原人名→替换人名映射） |
| `worldSetting` | `string` | 世界观设定 |
| `activeWritingDraft` | `Draft \| null` | 当前创作草稿（防丢稿） |
| `aiCompanies` | `AICompany[]` | AI 公司长期档案 |
| `virtualCompanySessions` | `Session[]` | 虚拟公司临时问答会话 |
| `imageRecords` | `ImageRecord[]` | 图片生成历史（最多20张） |

### 2.3 存储容量管理

- `checkStorageSize()`: 检查 localStorage 是否超过 4MB
- `cleanStorage()`: 清理图片记录，只保留最新 10 张
- 图片记录限制：最多 20 张
- Token 记录限制：最近 50 条
- 任务存档限制：最近 5 个

---

## 三、聊天生成逻辑（api.ts + ChatTab.tsx）

### 3.1 普通聊天流程

```
用户输入 → sendChatMessageStream()
    ↓
构建消息数组（最近20条历史）
    ↓
POST /chat/completions (stream: true)
    ↓
流式读取响应 → onChunk 回调
    ↓
统计 Token → addTokenUsage()
    ↓
保存消息到当前对话
```

**关键代码位置**：[api.ts:91-238](mobile-app/src/api.ts#L91-L238)

**说明**：普通聊天当前通过 `api.ts` 直接调用 API，不经过 `modelRouter.ts` 的 `callModel()` 统一入口。

### 3.2 消息历史限制

```typescript
const MAX_HISTORY = 20;  // 保留最近20条消息
const recentMessages = conversation.messages.slice(-MAX_HISTORY);
```

### 3.3 多模态支持

- 支持图片输入（base64）
- 消息格式：`{ type: 'image_url', image_url: { url: base64 } }`

### 3.4 请求取消机制

```typescript
let chatAbortController: AbortController | null = null;
// 取消时调用 abort()
```

---

## 四、图片生成逻辑（api.ts + ImageTab.tsx）

### 4.1 支持的模型

| 模型 ID | 名称 | 提供商 | 特点 |
|---------|------|--------|------|
| `gemini-3.1-flash-image-preview` | Flash 3.1 | Gemini | 支持 0.5K-4K，多种比例 |
| `gemini-3-pro-image-preview` | Pro 3 | Gemini | 支持 1K-4K |
| `gpt-image-1.5` | GPT Image 1.5 | OpenAI | 支持 0.5K-2K |
| `gpt-image-2` | GPT Image 2 | OpenAI | 支持 auto/low/medium/high，支持 4K |

### 4.2 生成流程

```
用户输入 prompt → generateImage()
    ↓
根据模型选择生成函数：
  - GPT-2 → generateGPT2Image()
  - GPT-1.5 → generateOpenAIImage()
  - Gemini → generateGeminiImage()
    ↓
API 调用 → 返回 base64 或 URL
    ↓
生成缩略图 → addImageRecord()
```

**关键代码位置**：[api.ts:312-514](mobile-app/src/api.ts#L312-L514)

**说明**：图片生成当前通过 `api.ts` 直接调用 API，不经过 `modelRouter.ts` 的 `callModel()` 统一入口。

### 4.3 图生图支持

- **GPT-2**: 使用 `/images/edits` 端点，支持参考图
- **Gemini**: 通过 chat completions，将图片作为消息内容传入

### 4.4 图片存储

- 原图 + 缩略图（150px）存储
- 最多 20 张，超出删除最旧
- 存储满时提示用户
- **风险提示**：原图 base64 存 localStorage 风险较高，后续建议迁移 IndexedDB 或只保存缩略图

---

## 五、创作中心逻辑（ChatTab.tsx + SuperWritingTab.tsx + api.ts）

### 5.1 核心数据流

```
用户输入创作目标（大纲文本）
    ↓
AI 解析大纲 → parsedOutline
    ├── chapters: 章节列表
    ├── characters: 角色列表
    └── worldSetting: 世界观设定
    ↓
从大纲生成队列 → modelQueue
    ↓
执行队列 → executeModelQueue()
    ├── 顺序模式：逐章生成，前面章节摘要作为上下文
    └── 并行模式：所有章节同时生成
    ↓
结果保存到 modelQueue[i].result
```

### 5.2 大纲解析实现差异

**ChatTab 和 SuperWritingTab 的大纲解析实现不同**：

- **ChatTab**：在队列面板内解析，解析结果直接用于生成队列
- **SuperWritingTab**：独立页面，有更详细的预览和编辑界面

两者使用相同的解析 Prompt 模板，但 UI 交互和状态管理方式不同。

### 5.3 大纲解析 Prompt

```typescript
const prompt = `你是一个专业的小说大纲解析助手。请解析以下大纲，提取章节信息和角色信息。

大纲内容：
${outlineText}

请输出 JSON 格式：
{
  "chapters": [
    {"title": "章节标题", "content": "章节内容摘要", "order": 1}
  ],
  "characters": [
    {"name": "角色名", "description": "角色描述", "replaceWith": "替换后的名字（可选）"}
  ],
  "worldSetting": "世界观设定"
}`;
```

**关键代码位置**：[SuperWritingTab.tsx:127-180](mobile-app/src/SuperWritingTab.tsx#L127-L180)

### 5.4 队列执行逻辑

```typescript
// 顺序模式
for (let i = 0; i < enabledQueue.length; i++) {
  // 构建前面章节摘要作为上下文
  let previousContext = '';
  if (chapterSummaries.length > 0) {
    previousContext = '【前面章节摘要】\n' + ...
  }

  // 流式生成
  const resp = await fetch('/chat/completions', { stream: true });

  // 节流保存：每 1.5 秒更新一次
  if (Date.now() - lastSaveTime > SAVE_INTERVAL) {
    updateQueueResult(item.id, content);
    lastSaveTime = Date.now();
  }

  // 生成摘要供后续章节参考
  chapterSummaries.push({ title, summary: content.slice(0, 500) });
}
```

**关键代码位置**：[api.ts:517-799](mobile-app/src/api.ts#L517-L799)

**说明**：
- 当前章节摘要是**截断摘要**（`content.slice(0, 500)`），不是 AI 生成的摘要
- **并行模式不适合长篇小说**：所有章节同时生成，无法利用前面章节的上下文
- **长篇小说推荐顺序模式**：逐章生成，前面章节摘要作为上下文，保持连贯性

### 5.5 角色替换机制

```typescript
// 角色替换规则
const replacements = characterMemory
  .filter(c => c.replaceWith.trim())
  .map(c => `- 文中的"${c.originalName}"请替换为"${c.replaceWith}"`)
  .join('\n');
```

### 5.6 防丢稿机制

```typescript
// 自动保存草稿
useEffect(() => {
  const hasValidContent =
    outlineText.trim() ||
    parsedOutline ||
    modelQueue.some(item => item.instruction?.trim() || item.result?.trim()) ||
    worldSetting.trim() ||
    characterMemory.length > 0;

  if (!hasValidContent) return;  // 避免空草稿覆盖

  setActiveWritingDraft({
    id: activeWritingDraft?.id || Date.now().toString(),
    title: conversation?.title || '未命名创作',
    outlineText,
    parsedOutline,
    modelQueue: [],  // 不在这里保存，由顶层持久化
    worldSetting,
    characterMemory,
    source: 'chat',  // 或 'superWriting'
    updatedAt: Date.now(),
  });
}, [modelQueue, parsedOutline, outlineText, worldSetting, characterMemory]);
```

**关键代码位置**：[ChatTab.tsx:173-204](mobile-app/src/ChatTab.tsx#L173-L204)

### 5.7 页面刷新恢复

```typescript
useEffect(() => {
  if (activeWritingDraft) {
    if (activeWritingDraft.outlineText) {
      setOutlineText(activeWritingDraft.outlineText);
    }
    if (activeWritingDraft.parsedOutline) {
      setParsedOutline(activeWritingDraft.parsedOutline);
      if (modelQueue.length === 0) {
        setShowOutlinePreview(true);
      }
    }
  }
}, []);  // 只在组件挂载时执行
```

### 5.8 与 AI 公司的关系

**创作中心与 AI 公司系统业务独立**：
- 创作中心不会自动写入 AI 公司的记忆或任务
- 两者各自维护独立的数据结构
- 用户可手动将创作内容复制到 AI 公司相关功能中使用

---

## 六、AI 公司系统逻辑（virtual-company/）

### 6.1 两种模式

| 模式 | 数据结构 | 用途 |
|------|----------|------|
| 临时问答 | `CompanySession` | 一次性项目评审 |
| 长期档案 | `AICompany` | 持续运营的公司 |

### 6.2 临时问答流程

```
用户输入需求 → runVirtualCompanySession()
    ↓
Step 1: 需求分析 → projectAnalysis
Step 2: 公司生成 → company
Step 3: 组织架构 + 角色生成 → agents
Step 4: 评审流程 → workflow
Step 5: 多角色评审 → reviews[]
Step 6: 交叉质疑（可选）→ debates[]
Step 7: 最终报告 → finalReport
```

**关键代码位置**：[orchestrator.ts:82-300](mobile-app/src/virtual-company/orchestrator.ts#L82-L300)

### 6.3 长期档案结构

```typescript
interface AICompany {
  id: string;
  name: string;
  purpose: string;
  industry?: string;
  stage?: string;
  agents: CompanyAgent[];      // 团队成员
  memories: CompanyMemory[];   // 公司记忆
  goals: CompanyGoal[];        // 目标
  tasks: CompanyTask[];        // 任务
  risks: CompanyRisk[];        // 风险
  meetings: CompanyMeeting[];  // 会议记录
}
```

### 6.4 会议类型

| 类型 | 说明 | 纪要结构 |
|------|------|----------|
| `morning` | 晨会 | MorningMeetingMinutes |
| `strategy` | 战略会 | StrategyMeetingMinutes |
| `review` | 项目评审 | ProjectReviewMinutes |
| `risk` | 风险会 | RiskMeetingMinutes |
| `retrospective` | 复盘会 | RetrospectiveMinutes |

---

## 七、多模型调度系统（modelRouter.ts）

### 7.1 当前使用范围

**重要说明**：`callModel()` 目前主要服务于 `virtual-company/` AI 公司模块。

- ✅ AI 公司系统：通过 `callModel()` 统一调度
- ❌ 普通聊天：通过 `api.ts` 直接调用
- ❌ 图片生成：通过 `api.ts` 直接调用
- ❌ 创作中心：通过 `api.ts` 直接调用

`modelRouter.ts` 不是全 App 统一入口，而是 AI 公司模块的专用调度层。

### 7.2 任务类型映射

```typescript
// 标准模式
const STANDARD_MODEL_ROUTER: Record<TaskType, ModelId> = {
  // 公司创建
  company_intent_understanding: 'gpt-5.5',
  company_profile_generation: 'gpt-5.5',
  agent_team_generation: 'gpt-5.5',

  // 会议分析
  morning_meeting_analysis: 'gpt-5.5',
  strategy_meeting_analysis: 'gpt-5.5',
  final_report_synthesis: 'gpt-5.5',

  // 资料整理
  meeting_summary_draft: 'kimi-2.5',
  content_summary: 'kimi-2.5',

  // 图片理解
  image_understanding: 'grok-4.1',
  screenshot_ocr: 'grok-4.1',

  // 创作工厂
  creative_writing: 'doubao-2.0',
  chapter_generation: 'doubao-2.0',
  xiaohongshu_style: 'doubao-2.0',

  // 技术任务
  code_generation: 'deepseek-v4',
  structured_output: 'deepseek-v4',

  // 快速任务
  quick_summary: 'gemini-3.1-flash',
};
```

### 7.3 模型角色映射

| 模型 | 角色 |
|------|------|
| GPT-5.5 | 首席战略官、最终报告官、风险总负责人 |
| Kimi 2.5 | 会议秘书、资料整理员、记忆管理员 |
| DeepSeek V4 | 技术负责人、结构化分析员、工程师 |
| Grok 4.1 | 图片分析员、视觉观察员 |
| Grok 4.2 | 反方顾问、舆论观察员、创意总监 |
| 豆包 2.0 | 中文内容策划、社媒文案员 |
| Gemini 3.1 Flash | 快速助理、备用视觉分析员 |

### 7.4 Fallback 机制

```typescript
const FALLBACK_CONFIG: Record<ModelId, ModelId[]> = {
  'gpt-5.5': ['kimi-2.5', 'gemini-3.1-flash'],
  'kimi-2.5': ['gemini-3.1-flash', 'doubao-2.0'],
  'deepseek-v4': ['kimi-2.5', 'gpt-5.5'],
  'grok-4.1': ['gemini-3.1-flash'],  // 图片只能 fallback 到支持图片的模型
  'doubao-2.0': ['kimi-2.5', 'gemini-3.1-flash'],
};
```

### 7.5 统一调用入口

```typescript
const result = await callModel(taskType, {
  prompt: '...',
  systemPrompt: '...',
  imageUrl: '...',  // 可选
}, {
  mode: 'standard',  // fast | standard | deep
  companyId: '...',
  meetingId: '...',
  requireJson: true,
});
```

**关键代码位置**：[modelRouter.ts:679-853](mobile-app/src/virtual-company/modelRouter.ts#L679-L853)

---

## 八、数据持久化逻辑

### 8.1 localStorage Key

- `ai-assistant-storage`: 主存储（zustand persist）

### 8.2 存储限制

| 数据 | 限制 |
|------|------|
| 对话消息 | 无限制（但历史只取最近 20 条） |
| 图片记录 | 最多 20 张 |
| Token 记录 | 最近 50 条 |
| 任务存档 | 最近 5 个 |
| 虚拟公司会话 | 最近 10 个 |
| 总容量警告 | 4MB |

### 8.3 恢复机制

- 页面刷新时从 `activeWritingDraft` 恢复创作状态
- `pendingChatRequest` / `pendingImageRequest`：存在相关状态，实际恢复能力待核实

---

## 九、PWA 相关逻辑

### 9.1 Service Worker

- 构建阶段已生成 Service Worker（`sw.js` 和 workbox 文件）
- 运行时注册逻辑、更新提示、离线策略需要继续核实

### 9.2 安装提示

- 未在代码中找到 PWA 安装提示逻辑

---

## 十、错误处理

### 10.1 API 错误

```typescript
if (!resp.ok) {
  const err = await resp.text();
  throw new Error(`API 错误: ${resp.status} ${err.slice(0, 200)}`);
}
```

### 10.2 网络错误

```typescript
if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
  reject(new Error('网络连接失败，请检查网络设置或尝试切换网络'));
}
```

### 10.3 存储错误

```typescript
try {
  set({ imageRecords: [newRecord, ...records] });
} catch (e: any) {
  if (e.name === 'QuotaExceededError') {
    alert('存储空间已满！请及时下载保存重要图片');
  }
  throw e;
}
```

---

## 十一、实际功能清单

### 11.1 已实现的功能

| 功能 | 入口位置 | 实现状态 |
|------|----------|----------|
| 普通聊天 | ChatTab | ✅ 已实现并可使用 |
| 多模型切换 | ChatTab 顶部 | ✅ 已实现并可使用 |
| 流式输出 | ChatTab | ✅ 已实现并可使用 |
| 图片输入 | ChatTab 输入框 | ✅ 已实现并可使用 |
| 语音输入 | ChatTab/ImageTab | ✅ 已实现并可使用 |
| 对话管理 | ChatTab 侧边栏 | ✅ 已实现并可使用 |
| 对话导出 | ChatTab 侧边栏 | ✅ 已实现并可使用 |
| 图片生成 | ImageTab | ✅ 已实现并可使用 |
| 多图片模型 | ImageTab 顶部 | ✅ 已实现并可使用 |
| 图生图 | ImageTab | ✅ 已实现并可使用（GPT-2, Gemini） |
| 图片下载 | ImageTab | ✅ 已实现并可使用 |
| 图片分享 | ImageTab | ✅ 已实现并可使用 |
| 小说大纲解析 | ChatTab/SuperWritingTab | ✅ 已实现并可使用 |
| 章节队列生成 | ChatTab/SuperWritingTab | ✅ 已实现并可使用 |
| 顺序/并行执行 | ChatTab/SuperWritingTab | ✅ 已实现并可使用 |
| 角色替换 | ChatTab 队列面板 | ✅ 已实现并可使用 |
| 世界观设定 | ChatTab 队列面板 | ✅ 已实现并可使用 |
| 任务存档 | ChatTab/SuperWritingTab | ✅ 已实现并可使用 |
| 虚拟公司临时问答 | VirtualCompanyTab | ✅ 已实现并可使用 |
| AI 公司长期档案 | CompanyListPage | ✅ 已实现并可使用 |
| 公司会议 | CompanyMeetingPage | ✅ 已实现并可使用 |
| 多模型调度 | modelRouter.ts | ✅ 已实现并可使用（AI 公司模块专用） |
| 主题切换 | SettingsTab | ✅ 已实现并可使用 |
| 语言切换 | SettingsTab | ✅ 已实现并可使用 |

### 11.2 只有入口、未完整实现的功能

| 功能 | 入口位置 | 实际状态 |
|------|----------|----------|
| 小红书文案 | SuperWritingTab 示例按钮 | ⚠️ 只有入口按钮，点击后只是填充文本到大纲解析器，无专门实现 |
| 短视频脚本 | SuperWritingTab 示例按钮 | ⚠️ 只有入口按钮，同上 |
| 朋友圈文案 | SuperWritingTab 示例按钮 | ⚠️ 只有入口按钮，同上 |
| 产品文案 | SuperWritingTab 示例按钮 | ⚠️ 只有入口按钮，同上 |
| 课程大纲 | SuperWritingTab 示例按钮 | ⚠️ 只有入口按钮，同上 |
| 短剧剧本 | SuperWritingTab 示例按钮 | ⚠️ 只有入口按钮，同上 |
| 营销矩阵 | SuperWritingTab 示例按钮 | ⚠️ 只有入口按钮，同上 |

**说明**：这些功能点击后只是将预设文本填入大纲解析器，然后走通用的"解析→生成队列→执行"流程，并没有针对不同创作类型做专门优化。

### 11.3 文档中有、代码中无的功能

| 功能 | 文档位置 | 代码状态 |
|------|----------|----------|
| 风格预设系统 | AI_CREATION_CENTER_LOGIC.md | ❌ 代码中无 `PRESET_STYLES` 实现 |
| 风格统一机制 | AI_CREATION_CENTER_LOGIC.md | ❌ 代码中无 `unifyStyle()` 函数 |
| 质量检查流程 | AI_CREATION_CENTER_LOGIC.md | ❌ 代码中无 `quality_check` 调用 |
| 版本管理 | AI_CREATION_CENTER_LOGIC.md | ❌ 代码中无 `ChapterVersionManager` |
| 自动保存（30秒） | AI_CREATION_CENTER_LOGIC.md | ❌ 实际是状态变化时即时保存 |
| 创作评审流程 | AI_CREATION_CENTER_LOGIC.md | ❌ 代码中无此流程 |

---

## 十二、高风险问题

### 12.1 数据丢失风险

| 问题 | 风险等级 | 状态 |
|------|----------|------|
| modelQueue 之前未持久化 | 🔴 高 | ✅ 已修复 |
| parsedOutline 之前未持久化 | 🔴 高 | ✅ 已修复 |
| 页面刷新后恢复失败 | 🟡 中 | ✅ 已修复 |

### 12.2 性能问题

| 问题 | 风险等级 | 说明 |
|------|----------|------|
| localStorage 容量限制 | 🟠 中高 | 多个数据源持续增长，详见下方分析 |
| 长章节生成时无节流保存 | 🟡 中 | ✅ 已添加 1.5 秒节流 |
| 图片存储占用大 | 🟡 中 | 缩略图压缩到 150px，但原图仍存储 |

**localStorage 容量风险来源**：
- `conversations`：无数量限制，长期使用会持续增长
- `imageRecords`：保存原图 base64，单张可能数百 KB
- `modelQueue`：保存长篇小说正文，可能数十万字
- `savedTasks`：保存队列快照，包含完整内容
- `aiCompanies`/`meetings`/`memories`：长期档案持续增长
- `apiKey`：存 localStorage 有安全风险（应考虑更安全的存储方式）

### 12.3 用户体验问题

| 问题 | 风险等级 | 说明 |
|------|----------|------|
| 非小说功能入口误导 | 🟡 中 | 用户可能以为有专门实现 |
| 生成中断无续写 | 🟡 中 | 需要用户手动重新生成 |

---

## 十三、修复优先级建议

### P0 - 紧急

当前暂无明确 P0，但前提是防丢稿和刷新恢复测试已通过。

### P1 - 高优先级

1. 为非小说创作类型添加专门实现或明确提示
2. 添加生成中断后的续写功能
3. 迁移图片存储到 IndexedDB 或只保存缩略图

### P2 - 中优先级

1. 实现风格预设系统
2. 实现质量检查流程
3. 自动清理旧数据释放存储空间
4. 为 conversations 添加数量限制

### P3 - 低优先级

1. 版本管理功能
2. 创作评审流程
3. PWA 安装提示
4. 将 apiKey 迁移到更安全的存储方式

---

## 十四、API 端点汇总

| 端点 | 用途 | 调用位置 |
|------|------|----------|
| `POST /chat/completions` | 聊天、大纲解析、队列执行 | api.ts |
| `POST /images/generations` | 文生图（GPT-1.5, GPT-2） | api.ts |
| `POST /images/edits` | 图生图（GPT-2） | api.ts |

**API Base URL**: `https://ai.acmestar.top/api`

---

## 十五、总结

### 核心实现

1. **聊天系统**：完整的流式聊天，支持多模型、图片输入、语音输入
2. **图片生成**：支持 4 种模型，文生图和图生图
3. **创作中心**：小说大纲解析 + 章节队列生成，支持角色替换和世界观设定
4. **AI 公司**：临时问答和长期档案两种模式，支持多种会议类型
5. **多模型调度**：统一的 `callModel()` 入口（AI 公司模块专用），支持 Fallback

### 未实现

1. **非小说创作类型**：只有入口按钮，无专门实现
2. **风格系统**：文档描述完整，代码中无
3. **质量检查**：文档描述完整，代码中无
4. **版本管理**：文档描述完整，代码中无

### 一句话总结

> 这是一个功能完整的 AI 助手应用，核心实现了聊天、生图、小说创作和 AI 公司四大模块，但非小说创作类型只有入口无专门实现，风格系统和质量检查等功能仅存在于文档中。localStorage 容量风险需关注，建议迁移大容量数据到 IndexedDB。
