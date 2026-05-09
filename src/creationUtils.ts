// 创作中心工具函数
import { CreationMode, NovelTaskType, NovelRewriteType, NovelProject, NovelChapterDraft, NovelAutoStartResult } from './store';

// ============ Prompt 构建函数 ============

/**
 * 根据创作类型构建解析 Prompt
 */
export function buildCreationPrompt(mode: CreationMode, outlineText: string): string {
  const prompts: Record<CreationMode, string> = {
    novel: `你是一个专业的小说大纲解析助手。请解析以下大纲，提取章节信息和角色信息。

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
}`,

    xiaohongshu: `你是一个专业的小红书文案策划助手。请根据以下需求，生成多篇小红书种草文案。

需求：
${outlineText}

请输出 JSON 格式：
{
  "items": [
    {
      "title": "爆款标题（带emoji，吸引眼球，引发好奇）",
      "content": "正文内容（带emoji，分段清晰，真实感强，包含开头钩子、核心内容、互动引导）",
      "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"],
      "coverSuggestion": "封面图片建议",
      "tone": "语气风格（如：活泼/温柔/专业/幽默）"
    }
  ]
}

要求：
1. 标题要有"钩子"，引发好奇
2. 开头 3 秒抓住注意力
3. 内容真实可信，避免过度营销感
4. 结尾有互动引导
5. 生成 3-5 个不同风格的版本`,

    short_video: `你是一个专业的短视频脚本策划助手。请根据以下需求，生成短视频脚本。

需求：
${outlineText}

请输出 JSON 格式：
{
  "scripts": [
    {
      "title": "视频标题",
      "hook": "前3秒钩子（吸引注意力的开场白或画面）",
      "scenes": [
        {
          "shot": "镜头类型（如：特写/中景/全景）",
          "visual": "画面描述",
          "dialogue": "台词或旁白",
          "duration": "时长（秒）"
        }
      ],
      "endingCTA": "结尾引导（关注/点赞/评论引导）"
    }
  ]
}

要求：
1. 前3秒必须有强钩子
2. 每个场景时长控制在5-15秒
3. 总时长控制在30-60秒
4. 台词口语化，适合口播
5. 生成 2-3 个不同风格的脚本`,

    moments: `你是一个专业的朋友圈文案策划助手。请根据以下需求，生成朋友圈文案。

需求：
${outlineText}

请输出 JSON 格式：
{
  "posts": [
    {
      "day": "发布时间（如：周一/周末/节假日）",
      "content": "文案内容（朋友圈口吻，不要太广告，真实感强）",
      "imageSuggestion": "配图建议",
      "tone": "语气风格（如：轻松/温馨/励志/幽默）",
      "interactionQuestion": "互动问题（引发评论）"
    }
  ]
}

要求：
1. 口吻自然，像朋友聊天
2. 不要太广告，避免硬广
3. 适当使用emoji
4. 结尾可以抛出问题引发互动
5. 生成 5-7 条不同风格的文案`,

    product_copy: `你是一个专业的产品文案策划助手。请根据以下需求，生成产品文案。

需求：
${outlineText}

请输出 JSON 格式：
{
  "products": [
    {
      "name": "产品名称",
      "sellingPoints": ["卖点1", "卖点2", "卖点3"],
      "painPoints": ["痛点1", "痛点2"],
      "shortCopy": "短文案（一句话卖点，适合海报/标题）",
      "longCopy": "长文案（详细产品介绍，适合详情页）",
      "cta": "转化按钮话术（如：立即购买/限时特惠）"
    }
  ]
}

要求：
1. 卖点要具体，有数据支撑更好
2. 痛点要戳中用户需求
3. 短文案简洁有力
4. 长文案有逻辑层次
5. CTA 有紧迫感`,

    marketing_matrix: `你是一个专业的内容营销策划助手。请根据以下需求，生成营销内容矩阵。

需求：
${outlineText}

请输出 JSON 格式：
{
  "calendar": [
    {
      "period": "时间周期（如：第1周/1月）",
      "platform": "发布平台（如：小红书/抖音/公众号/微博）",
      "topic": "内容主题",
      "contentType": "内容形式（如图文/视频/直播/话题）",
      "goal": "营销目标（如：品牌曝光/用户互动/转化销售）",
      "copyIdea": "创意文案方向"
    }
  ]
}

要求：
1. 覆盖多个主流平台
2. 内容形式多样化
3. 主题有连贯性
4. 目标明确可衡量
5. 生成 4-8 周的内容计划`,

    course_outline: `你是一个专业的课程设计助手。请根据以下需求，设计课程大纲。

需求：
${outlineText}

请输出 JSON 格式：
{
  "courseTitle": "课程标题",
  "modules": [
    {
      "title": "模块标题",
      "lessons": [
        {
          "title": "课时标题",
          "objective": "学习目标",
          "content": "课程内容大纲",
          "homework": "课后作业"
        }
      ]
    }
  ]
}

要求：
1. 模块划分清晰，循序渐进
2. 每个模块 3-5 个课时
3. 学习目标具体可衡量
4. 内容实用，有案例
5. 作业有针对性`,

    short_drama: `你是一个专业的短剧剧本策划助手。请根据以下需求，生成短剧剧本大纲。

需求：
${outlineText}

请输出 JSON 格式：
{
  "seriesTitle": "剧名",
  "characters": [
    {"name": "角色名", "role": "角色定位", "description": "角色描述"}
  ],
  "episodes": [
    {
      "episode": 1,
      "title": "剧集标题",
      "summary": "剧情梗概",
      "scenes": [
        {
          "location": "场景地点",
          "characters": ["出场角色"],
          "dialogue": "主要台词/对白",
          "conflict": "冲突点"
        }
      ]
    }
  ]
}

要求：
1. 每集有明确的冲突和高潮
2. 角色性格鲜明
3. 对白口语化，符合人物性格
4. 场景切换自然
5. 结尾有悬念或反转`,

    free: `你是一个专业的内容创作助手。请根据以下需求，生成内容。

需求：
${outlineText}

请输出 JSON 格式：
{
  "items": [
    {
      "title": "内容标题",
      "content": "内容正文"
    }
  ]
}

要求：
1. 内容结构清晰
2. 语言流畅自然
3. 信息准确有用
4. 生成 3-5 个版本`,
  };

  return prompts[mode];
}

// ============ 解析结果转队列函数 ============

export interface QueueItem {
  id: string;
  modelId: string;
  instruction: string;
  result?: string;
  title?: string;
  enabled: boolean;
}

/**
 * 根据创作类型将解析结果转换为队列项
 */
export function convertParsedCreationToQueue(
  mode: CreationMode,
  parsedResult: any,
  _modelId: string, // 保留参数但标记为未使用，未来可能需要
  language: 'zh' | 'en'
): Array<{ title: string; instruction: string }> {
  const items: Array<{ title: string; instruction: string }> = [];

  switch (mode) {
    case 'novel': {
      // 小说：章节
      const chapters = parsedResult.chapters || [];
      chapters.forEach((chapter: any, index: number) => {
        items.push({
          title: chapter.title || `${language === 'zh' ? '第' : 'Chapter '}${index + 1}${language === 'zh' ? '章' : ''}`,
          instruction: chapter.content || `请根据大纲创作：${chapter.title}`,
        });
      });
      break;
    }

    case 'xiaohongshu': {
      // 小红书：文案
      const itemList = parsedResult.items || [];
      itemList.forEach((item: any, index: number) => {
        items.push({
          title: item.title?.slice(0, 20) || `${language === 'zh' ? '文案' : 'Post'} ${index + 1}`,
          instruction: `请根据以下要求生成完整的小红书文案：

标题方向：${item.title}
语气风格：${item.tone || '活泼'}
标签：${(item.tags || []).join('、')}

要求：
1. 标题要有"钩子"，引发好奇
2. 开头 3 秒抓住注意力
3. 内容真实可信，避免过度营销感
4. 结尾有互动引导
5. 适当使用emoji`,
        });
      });
      break;
    }

    case 'short_video': {
      // 短视频：脚本
      const scripts = parsedResult.scripts || [];
      scripts.forEach((script: any, index: number) => {
        const scenesDesc = (script.scenes || [])
          .map((s: any) => `【${s.shot}】${s.visual}\n台词：${s.dialogue}\n时长：${s.duration}`)
          .join('\n\n');

        items.push({
          title: script.title || `${language === 'zh' ? '脚本' : 'Script'} ${index + 1}`,
          instruction: `请根据以下要求生成完整的短视频脚本：

标题：${script.title}
前3秒钩子：${script.hook}

分镜大纲：
${scenesDesc}

结尾引导：${script.endingCTA}

要求：
1. 扩充每个场景的详细描述
2. 台词口语化，适合口播
3. 画面描述具体，便于拍摄
4. 时长控制在30-60秒`,
        });
      });
      break;
    }

    case 'moments': {
      // 朋友圈：文案
      const posts = parsedResult.posts || [];
      posts.forEach((post: any, index: number) => {
        items.push({
          title: post.day || `${language === 'zh' ? '朋友圈' : 'Post'} ${index + 1}`,
          instruction: `请根据以下要求生成朋友圈文案：

发布时间：${post.day}
语气风格：${post.tone || '轻松'}
配图建议：${post.imageSuggestion}
互动问题：${post.interactionQuestion}

要求：
1. 口吻自然，像朋友聊天
2. 不要太广告，避免硬广
3. 适当使用emoji
4. 结尾可以抛出问题引发互动`,
        });
      });
      break;
    }

    case 'product_copy': {
      // 产品文案
      const products = parsedResult.products || [];
      products.forEach((product: any, index: number) => {
        items.push({
          title: product.name || `${language === 'zh' ? '产品' : 'Product'} ${index + 1}`,
          instruction: `请根据以下信息生成完整的产品文案：

产品名称：${product.name}
卖点：${(product.sellingPoints || []).join('、')}
痛点：${(product.painPoints || []).join('、')}
短文案方向：${product.shortCopy}
长文案方向：${product.longCopy}
CTA：${product.cta}

要求：
1. 短文案：一句话卖点，适合海报/标题
2. 长文案：详细产品介绍，适合详情页，有逻辑层次
3. CTA 有紧迫感`,
        });
      });
      break;
    }

    case 'marketing_matrix': {
      // 营销矩阵
      const calendar = parsedResult.calendar || [];
      calendar.forEach((item: any) => {
        items.push({
          title: `${item.period} - ${item.platform}`,
          instruction: `请根据以下要求生成营销内容：

时间：${item.period}
平台：${item.platform}
主题：${item.topic}
内容形式：${item.contentType}
营销目标：${item.goal}
创意方向：${item.copyIdea}

要求：
1. 内容符合平台特点
2. 标题吸引眼球
3. 内容有互动性
4. 引导用户行动`,
        });
      });
      break;
    }

    case 'course_outline': {
      // 课程大纲
      const modules = parsedResult.modules || [];
      modules.forEach((module: any) => {
        const lessons = module.lessons || [];
        lessons.forEach((lesson: any) => {
          items.push({
            title: `${module.title} - ${lesson.title}`,
            instruction: `请根据以下要求生成课程内容：

模块：${module.title}
课时：${lesson.title}
学习目标：${lesson.objective}
内容大纲：${lesson.content}
作业方向：${lesson.homework}

要求：
1. 内容实用，有案例
2. 讲解清晰，循序渐进
3. 作业有针对性`,
          });
        });
      });
      break;
    }

    case 'short_drama': {
      // 短剧
      const episodes = parsedResult.episodes || [];
      episodes.forEach((episode: any) => {
        const scenesDesc = (episode.scenes || [])
          .map((s: any) => `【${s.location}】出场：${(s.characters || []).join('、')}\n冲突：${s.conflict}`)
          .join('\n\n');

        items.push({
          title: `${language === 'zh' ? '第' : 'Episode '}${episode.episode}${language === 'zh' ? '集' : ''} - ${episode.title}`,
          instruction: `请根据以下要求生成短剧剧本：

剧名：${parsedResult.seriesTitle}
集数：${episode.episode}
标题：${episode.title}
剧情梗概：${episode.summary}

场景大纲：
${scenesDesc}

角色：${(parsedResult.characters || []).map((c: any) => `${c.name}（${c.role}）`).join('、')}

要求：
1. 扩充每个场景的详细对白
2. 对白口语化，符合人物性格
3. 场景切换自然
4. 结尾有悬念或反转`,
        });
      });
      break;
    }

    case 'free': {
      // 自由创作
      const itemList = parsedResult.items || [];
      itemList.forEach((item: any, index: number) => {
        items.push({
          title: item.title || `${language === 'zh' ? '内容' : 'Content'} ${index + 1}`,
          instruction: `请根据以下要求生成内容：

标题：${item.title}
内容方向：${item.content}

要求：
1. 内容结构清晰
2. 语言流畅自然
3. 信息准确有用`,
        });
      });
      break;
    }
  }

  return items;
}

// ============ 导出标题适配 ============

/**
 * 根据创作类型获取导出标题
 */
export function getExportTitle(mode: CreationMode, language: 'zh' | 'en'): string {
  const titles: Record<CreationMode, { zh: string; en: string }> = {
    novel: { zh: '小说导出', en: 'Novel Export' },
    xiaohongshu: { zh: '小红书文案导出', en: 'Xiaohongshu Export' },
    short_video: { zh: '短视频脚本导出', en: 'Short Video Export' },
    moments: { zh: '朋友圈文案导出', en: 'Moments Export' },
    product_copy: { zh: '产品文案导出', en: 'Product Copy Export' },
    marketing_matrix: { zh: '营销矩阵导出', en: 'Marketing Matrix Export' },
    course_outline: { zh: '课程大纲导出', en: 'Course Outline Export' },
    short_drama: { zh: '短剧剧本导出', en: 'Short Drama Export' },
    free: { zh: '自由创作导出', en: 'Free Creation Export' },
  };
  return titles[mode][language];
}

/**
 * 根据创作类型获取内容项名称
 */
export function getItemName(mode: CreationMode, language: 'zh' | 'en'): string {
  const names: Record<CreationMode, { zh: string; en: string }> = {
    novel: { zh: '章节', en: 'Chapter' },
    xiaohongshu: { zh: '文案', en: 'Post' },
    short_video: { zh: '脚本', en: 'Script' },
    moments: { zh: '朋友圈', en: 'Post' },
    product_copy: { zh: '产品文案', en: 'Product Copy' },
    marketing_matrix: { zh: '内容计划', en: 'Content Plan' },
    course_outline: { zh: '课程模块', en: 'Module' },
    short_drama: { zh: '剧集', en: 'Episode' },
    free: { zh: '内容项', en: 'Item' },
  };
  return names[mode][language];
}

// ============ 小说专用 Prompt 构建函数 ============

/**
 * 构建小说子模式 Prompt
 */
export function buildNovelPrompt(
  taskType: NovelTaskType,
  outlineText: string,
  options?: {
    genre?: string;      // 小说题材
    style?: string;      // 风格
    chapterInfo?: string; // 当前章节/目标字数
  }
): string {
  const genreInfo = options?.genre ? `\n小说题材/类型：${options.genre}` : '';
  const styleInfo = options?.style ? `\n风格：${options.style}` : '';
  const chapterInfo = options?.chapterInfo ? `\n当前章节/目标字数：${options.chapterInfo}` : '';

  const prompts: Record<NovelTaskType, string> = {
    premise: `你是一个专业的小说策划助手。请根据以下想法，生成完整的故事设定。

用户想法：
${outlineText}
${genreInfo}${styleInfo}

请输出以下内容（用 Markdown 格式，不要 JSON）：

## 一句话简介
（用一句话概括整个故事的核心卖点）

## 题材与卖点
（分析题材类型、目标读者、核心卖点）

## 主角设定
（姓名、年龄、性格、背景、核心驱动力、成长弧光）

## 主要配角/反派
（至少3个重要角色，包括姓名、身份、与主角关系、性格特点）

## 核心矛盾
（主要冲突是什么，矛盾的根源，如何升级）

## 世界观/背景
（故事发生的时代、地点、社会环境、特殊设定）

## 主线走向
（故事的开端、发展、高潮、结局的总体走向）

## 开篇钩子
（第一章如何抓住读者，设计一个强有力的开篇钩子）

## 后续可扩展方向
（故事可以如何发展，有哪些可能的分支）`,

    outline: `你是一个专业的小说大纲策划助手。请根据以下信息，生成完整的小说大纲。

故事设定：
${outlineText}
${genreInfo}${styleInfo}

请输出以下内容（用 Markdown 格式，不要 JSON）：

## 故事总纲
（整个故事的核心主线，300字以内）

## 三幕/五幕结构
（按照经典结构划分故事阶段，每个阶段的目标和关键事件）

## 主线剧情
（详细的主线剧情发展，包含关键转折点）

## 副线剧情
（至少2条副线，与主线如何交织）

## 人物成长线
（主角的成长轨迹，从起点到终点的变化）

## 情感/关系线
（主要人物关系的发展变化）

## 分卷规划
（建议分卷方式，每卷的主题和核心事件）

## 高潮与结局
（故事的高潮设计，结局走向）

## 关键伏笔
（需要埋设的重要伏笔，至少5个）`,

    chapter_outline: `你是一个专业的章节大纲策划助手。请根据以下信息，生成单章详细大纲。

章节要求：
${outlineText}
${genreInfo}${styleInfo}${chapterInfo}

请输出以下内容（用 Markdown 格式，不要 JSON）：

## 章节标题
（吸引人的章节标题）

## 本章目标
（这一章要达成什么叙事目标）

## 出场人物
（本章出场的角色及其状态）

## 场景
（主要场景设定，时间、地点、环境）

## 主要事件
（本章发生的核心事件，按顺序列出）

## 冲突点
（本章的矛盾冲突是什么，如何展开）

## 情绪变化
（读者在本章应该经历的情绪曲线）

## 伏笔/线索
（本章需要埋设或呼应的伏笔）

## 结尾钩子
（章末如何吸引读者继续阅读，设计悬念或转折）

## 下一章衔接
（如何自然过渡到下一章）`,

    chapter_draft: `你是一个专业的小说作家。请根据以下章节大纲，创作章节正文。

章节大纲：
${outlineText}
${genreInfo}${styleInfo}${chapterInfo}

要求：
1. 正文要有小说感，不要像大纲或总结
2. 多写具体场景、动作、对白、心理描写
3. 避免空泛的概括，让读者"看到"而非"被告知"
4. 对白要符合人物性格，口语化自然
5. 适当使用环境描写烘托氛围
6. 节奏张弛有度，有紧张也有舒缓
7. 章末要有钩子，吸引读者继续阅读

请输出以下内容（用 Markdown 格式）：

## 章节标题

## 正文
（直接写正文，不要解释，不要分段说明）

---

## 本章摘要
（100字以内概括本章内容）

## 人物状态变化
（本章结束后，主要人物的状态有什么变化）

## 新增设定
（本章新增的世界观或人物设定，如有）

## 伏笔/线索
（本章埋设的伏笔，如有）

## 下一章建议
（下一章可以写什么）`,

    continue: `你是一个专业的小说续写助手。请根据已有正文，自然地续写下去。

已有正文：
${outlineText}
${genreInfo}${styleInfo}${chapterInfo}

续写要求：
1. 严格延续已有正文的风格、视角、节奏
2. 保持人物性格一致，不要突然改变
3. 不要突然跳剧情，要自然过渡
4. 不要擅自完结故事
5. 续写部分要有画面感，多写具体场景和对白
6. 章末留有悬念或钩子

请直接输出续写的正文内容（不要解释，不要分段说明，不要 JSON）：

---

## 续写方向建议
（简要说明接下来可以怎么发展）`,

    polish: `你是一个专业的小说润色助手。请优化以下正文，提升文学质量。

原文：
${outlineText}
${genreInfo}${styleInfo}

润色要求：
1. 保留原剧情和人物关系，不改变情节
2. 优化语言，使其更加流畅、生动
3. 增强画面感，让读者"看到"而非"被告知"
4. 优化对白，使其更加自然、符合人物性格
5. 调整节奏，张弛有度
6. 减少重复和冗余
7. 增强情绪感染力

请直接输出润色后的正文（不要解释修改了什么，不要 JSON）：`,
  };

  return prompts[taskType];
}

/**
 * 构建小说改写 Prompt
 */
export function buildNovelRewritePrompt(
  rewriteType: NovelRewriteType,
  originalText: string
): string {
  const rewriteInstructions: Record<NovelRewriteType, string> = {
    enhance_imagery: `请增强以下正文的画面感：
1. 增加视觉、听觉、嗅觉、触觉等感官描写
2. 用具体的场景细节替代抽象的描述
3. 让读者"看到"而非"被告知"
4. 保持原文的剧情和人物关系不变`,

    enhance_emotion: `请增强以下正文的情绪张力：
1. 深化人物的心理描写
2. 增加情绪的层次和转折
3. 用细节和动作展现情绪，而非直接说"他很生气"
4. 让读者更能感同身受
5. 保持原文的剧情不变`,

    optimize_dialogue: `请优化以下正文的对白：
1. 使对白更加口语化、自然
2. 每个人物的说话风格要有区分度
3. 删除不必要的客套话
4. 用对白推进剧情或展现人物
5. 保持原文的剧情不变`,

    add_conflict: `请增加以下正文的冲突感：
1. 强化人物之间的矛盾
2. 增加内心的挣扎和纠结
3. 让场景更有张力
4. 不要改变主要剧情走向
5. 冲突要合理，不要生硬`,

    slow_pacing: `请放慢以下正文的节奏：
1. 增加环境描写和氛围渲染
2. 放慢动作描写，增加细节
3. 增加心理活动和内心独白
4. 让场景更加从容展开
5. 保持原文的剧情不变`,

    fast_pacing: `请加快以下正文的节奏：
1. 删除冗余的描写和过渡
2. 使用短句和快节奏的叙述
3. 快速推进剧情
4. 增加紧张感和紧迫感
5. 保持原文的核心剧情不变`,

    strengthen_suspense: `请强化以下正文的悬念感：
1. 埋设伏笔和线索
2. 增加未知和不确定性
3. 让读者产生疑问和期待
4. 不要过早揭示答案
5. 保持原文的剧情逻辑`,

    strengthen_hook: `请强化以下正文的结尾钩子：
1. 重点优化最后300-500字
2. 设计悬念或转折
3. 让读者迫不及待想看下一章
4. 可以用未解之谜、意外转折、情绪高潮等方式
5. 保持原文的整体剧情不变`,

    fix_character: `请修复以下正文的人物崩坏问题：
1. 检查人物行为是否符合其性格设定
2. 检查人物语言是否符合其说话风格
3. 检查人物心理活动是否合理
4. 修正前后不一致的地方
5. 保持原文的剧情不变`,

    reduce_ai_taste: `请减少以下正文的AI味：
1. 避免过于工整的排比句式
2. 减少空洞的形容词堆砌
3. 用具体的细节替代抽象的描述
4. 让语言更加口语化、生活化
5. 增加一些不完美但真实的细节
6. 保持原文的剧情不变`,
  };

  return `你是一个专业的小说编辑。请根据用户的要求改写以下正文。

原文：
${originalText}

改写要求：
${rewriteInstructions[rewriteType]}

重要：
1. 直接输出改写后的正文，不要解释
2. 不要改变主要剧情和人物关系
3. 保持原文的风格和视角
4. 不要输出 JSON`;
}

// ============ 小说企划生成 Prompt ============

/**
 * 构建小说企划生成 Prompt（返回 JSON）
 */
export function buildNovelPlanningPrompt(options: {
  requirement: string;
  genre?: string;
  style?: string;
  chapterInfo?: string;
}): string {
  const { requirement, genre, style, chapterInfo } = options;

  const genreHint = genre ? `\n用户指定题材：${genre}` : '';
  const styleHint = style ? `\n用户指定风格：${style}` : '';
  const lengthHint = chapterInfo ? `\n用户指定篇幅：${chapterInfo}` : '';

  return `你是一个专业的小说策划编辑。请根据用户的一句话想法，自动生成完整的小说企划。

用户想法：
${requirement}
${genreHint}${styleHint}${lengthHint}

请输出 JSON 格式（不要输出 Markdown，不要解释，只输出纯 JSON）：

{
  "title": "小说名（吸引人的标题）",
  "genre": "题材类型",
  "style": "风格关键词",
  "logline": "一句话简介（有吸引力，概括核心卖点）",
  "sellingPoints": "核心卖点（2-3个）",
  "targetReaders": "目标读者",
  "lengthSuggestion": "篇幅建议（短篇/中篇/长篇/网文连载）",

  "characters": [
    {
      "id": "char_1",
      "name": "角色名",
      "role": "主角/配角/反派",
      "identity": "身份/职业",
      "personality": "性格特点",
      "desire": "核心欲望",
      "weakness": "性格弱点",
      "relationship": "与主角关系",
      "arc": "人物成长弧光",
      "locked": false
    }
  ],

  "world": {
    "background": "故事背景（时代、地点、社会环境）",
    "keyScenes": "关键场景（3-5个主要场景）",
    "rules": "世界规则（如有特殊设定）",
    "forbiddenRules": "不可违背的规则（保持逻辑一致）"
  },

  "conflict": {
    "external": "外部冲突（人与环境、人与社会）",
    "internal": "内心冲突（人物内心矛盾）",
    "relationship": "关系冲突（人物之间）",
    "stages": "阶段性阻碍（3-5个关键阻碍）"
  },

  "outline": {
    "beginning": "开端（故事如何开始）",
    "development": "发展（矛盾如何升级）",
    "twist": "转折（关键转折点）",
    "climax": "高潮（冲突爆发）",
    "ending": "结局（如何收尾）"
  },

  "chapters": [
    {
      "id": "chap_1",
      "chapterNo": 1,
      "title": "章节标题",
      "goal": "本章目标",
      "mainEvent": "主要事件",
      "conflict": "冲突点",
      "hook": "结尾钩子",
      "locked": false
    }
  ],

  "firstChapterAdvice": {
    "openingScene": "开场场景（具体画面）",
    "characters": "出场人物",
    "mood": "情绪基调",
    "conflictIntro": "冲突引入方式",
    "endingHook": "结尾钩子设计"
  },

  "notes": "其他创作建议"
}

要求：
1. 至少生成3个角色（主角、重要配角、反派或阻力来源）
2. 章节规划5-12个
3. 角色名字要符合题材风格
4. 世界观要合理，现实题材不要强行加超自然设定
5. 冲突要有层次，不要单一
6. 只输出 JSON，不要其他文字`;
}

/**
 * 解析小说企划 JSON（带容错）
 */
export function parseNovelPlanJSON(text: string): NovelProject | null {
  try {
    // 尝试直接解析
    let jsonStr = text.trim();

    // 如果被 ```json 包裹，提取内容
    if (jsonStr.startsWith('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        jsonStr = match[1].trim();
      }
    }

    // 尝试找到 JSON 对象的起始和结束
    const startIndex = jsonStr.indexOf('{');
    const lastIndex = jsonStr.lastIndexOf('}');
    if (startIndex !== -1 && lastIndex !== -1) {
      jsonStr = jsonStr.slice(startIndex, lastIndex + 1);
    }

    const parsed = JSON.parse(jsonStr);

    // 验证必要字段
    if (!parsed.title || !parsed.characters || !Array.isArray(parsed.characters)) {
      console.warn('小说企划 JSON 缺少必要字段');
      return null;
    }

    // 确保所有字段存在，填充默认值
    const project: NovelProject = {
      title: parsed.title || '',
      genre: parsed.genre || '',
      style: parsed.style || '',
      logline: parsed.logline || '',
      sellingPoints: parsed.sellingPoints || '',
      targetReaders: parsed.targetReaders || '',
      lengthSuggestion: parsed.lengthSuggestion || '',
      characters: (parsed.characters || []).map((c: any, index: number) => ({
        id: c.id || `char_${index + 1}`,
        name: c.name || '',
        role: c.role || '',
        identity: c.identity || '',
        personality: c.personality || '',
        desire: c.desire || '',
        weakness: c.weakness || '',
        relationship: c.relationship || '',
        arc: c.arc || '',
        locked: c.locked || false,
      })),
      world: {
        background: parsed.world?.background || '',
        keyScenes: parsed.world?.keyScenes || '',
        rules: parsed.world?.rules || '',
        forbiddenRules: parsed.world?.forbiddenRules || '',
      },
      conflict: {
        external: parsed.conflict?.external || '',
        internal: parsed.conflict?.internal || '',
        relationship: parsed.conflict?.relationship || '',
        stages: parsed.conflict?.stages || '',
      },
      outline: {
        beginning: parsed.outline?.beginning || '',
        development: parsed.outline?.development || '',
        twist: parsed.outline?.twist || '',
        climax: parsed.outline?.climax || '',
        ending: parsed.outline?.ending || '',
      },
      chapters: (parsed.chapters || []).map((ch: any, index: number) => ({
        id: ch.id || `chap_${index + 1}`,
        chapterNo: ch.chapterNo || index + 1,
        title: ch.title || '',
        goal: ch.goal || '',
        mainEvent: ch.mainEvent || '',
        conflict: ch.conflict || '',
        hook: ch.hook || '',
        locked: ch.locked || false,
      })),
      firstChapterAdvice: {
        openingScene: parsed.firstChapterAdvice?.openingScene || '',
        characters: parsed.firstChapterAdvice?.characters || '',
        mood: parsed.firstChapterAdvice?.mood || '',
        conflictIntro: parsed.firstChapterAdvice?.conflictIntro || '',
        endingHook: parsed.firstChapterAdvice?.endingHook || '',
      },
      notes: parsed.notes || '',
    };

    return project;
  } catch (e) {
    console.error('解析小说企划 JSON 失败:', e);
    return null;
  }
}

/**
 * 构建生成第一章的 Prompt
 */
export function buildNovelFirstChapterPrompt(options: {
  requirement: string;
  novelProject: NovelProject;
  chapterIndex?: number;
}): string {
  const { novelProject, chapterIndex = 0 } = options;

  // 获取第一章的规划
  const chapter = novelProject.chapters[chapterIndex] || novelProject.chapters[0];

  // 构建角色信息
  const charactersInfo = novelProject.characters
    .map(c => `- ${c.name}（${c.role}）：${c.identity}，性格${c.personality}`)
    .join('\n');

  // 构建锁定角色信息
  const lockedCharacters = novelProject.characters.filter(c => c.locked);
  const lockedInfo = lockedCharacters.length > 0
    ? `\n【用户已锁定的角色，必须严格遵守】：\n${lockedCharacters.map(c => `- ${c.name}：${c.identity}，性格${c.personality}，弱点${c.weakness}`).join('\n')}`
    : '';

  return `你是一个专业的小说作家。请根据以下小说企划，创作第一章正文。

=== 小说企划 ===

【基础信息】
小说名：${novelProject.title}
题材：${novelProject.genre}
风格：${novelProject.style}
一句话简介：${novelProject.logline}

【角色设定】
${charactersInfo}
${lockedInfo}

【世界观/背景】
${novelProject.world.background}
关键场景：${novelProject.world.keyScenes}
${novelProject.world.rules ? `世界规则：${novelProject.world.rules}` : ''}

【主线冲突】
外部冲突：${novelProject.conflict.external}
内心冲突：${novelProject.conflict.internal}

【故事大纲】
开端：${novelProject.outline.beginning}

【第一章规划】
章节标题：${chapter?.title || '第一章'}
本章目标：${chapter?.goal || '建立主角处境和故事基调'}
主要事件：${chapter?.mainEvent || ''}
冲突点：${chapter?.conflict || ''}
结尾钩子：${chapter?.hook || ''}

【第一章写作建议】
开场场景：${novelProject.firstChapterAdvice.openingScene}
出场人物：${novelProject.firstChapterAdvice.characters}
情绪基调：${novelProject.firstChapterAdvice.mood}
冲突引入：${novelProject.firstChapterAdvice.conflictIntro}
结尾钩子：${novelProject.firstChapterAdvice.endingHook}

=== 写作要求 ===

1. 正文要有小说感，不要像大纲或总结
2. 多写具体场景、动作、对白、心理描写
3. 避免空泛的概括，让读者"看到"而非"被告知"
4. 对白要符合人物性格，口语化自然
5. 适当使用环境描写烘托氛围
6. 节奏张弛有度，有紧张也有舒缓
7. 章末要有钩子，吸引读者继续阅读
8. 人物名字、性格、世界观必须严格遵守企划设定
9. ${lockedCharacters.length > 0 ? '锁定的角色信息绝对不能更改' : ''}

请输出以下内容（用 Markdown 格式）：

## 章节标题

## 正文
（直接写正文，不要解释，不要分段说明，字数 2000-4000 字）

---

## 本章摘要
（100字以内概括本章内容）

## 人物状态变化
（本章结束后，主要人物的状态有什么变化）

## 新增设定
（本章新增的世界观或人物设定，如有）

## 伏笔/线索
（本章埋设的伏笔，如有）

## 下一章建议
（下一章可以写什么）`;
}

/**
 * 构建续写 Prompt
 */
export function buildNovelContinuePrompt(options: {
  novelProject: NovelProject;
  previousChapter: string;
  chapterIndex: number;
}): string {
  const { novelProject, previousChapter, chapterIndex } = options;

  const chapter = novelProject.chapters[chapterIndex];
  const chapterTitle = chapter?.title || `第${chapterIndex + 1}章`;

  // 构建锁定角色信息
  const lockedCharacters = novelProject.characters.filter(c => c.locked);
  const lockedInfo = lockedCharacters.length > 0
    ? `\n【用户已锁定的角色，必须严格遵守】：\n${lockedCharacters.map(c => `- ${c.name}：${c.identity}，性格${c.personality}`).join('\n')}`
    : '';

  return `你是一个专业的小说作家。请根据小说企划和上一章内容，续写下一章。

=== 小说企划 ===

小说名：${novelProject.title}
题材：${novelProject.genre}
风格：${novelProject.style}

【角色设定】
${novelProject.characters.map(c => `- ${c.name}（${c.role}）：${c.identity}，性格${c.personality}`).join('\n')}
${lockedInfo}

【世界观/背景】
${novelProject.world.background}

=== 上一章内容 ===

${previousChapter.slice(-3000)} ${previousChapter.length > 3000 ? '...(前文已省略)' : ''}

=== 本章规划 ===

章节标题：${chapterTitle}
本章目标：${chapter?.goal || ''}
主要事件：${chapter?.mainEvent || ''}
冲突点：${chapter?.conflict || ''}
结尾钩子：${chapter?.hook || ''}

=== 续写要求 ===

1. 严格延续上一章的风格、视角、节奏
2. 保持人物性格一致，不要突然改变
3. 人物名字必须使用企划中的名字
4. 不要突然跳剧情，要自然过渡
5. 多写具体场景和对白，有画面感
6. 章末留有悬念或钩子
7. 字数 2000-4000 字

请直接输出续写的正文内容（不要解释，用 Markdown 格式）：

## ${chapterTitle}

（正文内容）

---

## 本章摘要
（100字以内概括本章内容）

## 下一章建议
（下一章可以写什么）`;
}

// ============ 一键生成小说（设定+第一章） ============

/**
 * 构建一键生成小说的 Prompt（返回设定+第一章正文）
 */
export function buildNovelAutoStartPrompt(options: {
  requirement: string;
}): string {
  const { requirement } = options;

  return `你是一个专业的小说策划和作家。请根据用户的一句话想法，自动生成完整的小说企划和第一章正文。

用户想法：
${requirement}

请输出 JSON 格式（不要输出 Markdown，不要解释，只输出纯 JSON）：

{
  "project": {
    "title": "小说名（吸引人的标题）",
    "genre": "题材类型（自动判断：都市/玄幻/悬疑/言情/科幻/历史等）",
    "style": "风格关键词（自动判断：治愈/爽文/细腻/暗黑/幽默/热血等）",
    "logline": "一句话简介（有吸引力，概括核心卖点）",
    "sellingPoints": "核心卖点（2-3个）",
    "targetReaders": "目标读者",
    "lengthSuggestion": "篇幅建议（自动判断：短篇10万字以内/中篇10-30万字/长篇30万字以上）",

    "characters": [
      {
        "id": "char_1",
        "name": "角色名",
        "role": "主角/配角/反派",
        "identity": "身份/职业",
        "personality": "性格特点",
        "desire": "核心欲望",
        "weakness": "性格弱点",
        "relationship": "与主角关系",
        "arc": "人物成长弧光",
        "locked": false
      }
    ],

    "world": {
      "background": "故事背景",
      "keyScenes": "关键场景",
      "rules": "世界规则",
      "forbiddenRules": "不可违背的规则"
    },

    "conflict": {
      "external": "外部冲突",
      "internal": "内心冲突",
      "relationship": "关系冲突",
      "stages": "阶段性阻碍"
    },

    "outline": {
      "beginning": "开端",
      "development": "发展",
      "twist": "转折",
      "climax": "高潮",
      "ending": "结局"
    },

    "chapters": [
      {
        "id": "chap_1",
        "chapterNo": 1,
        "title": "章节标题",
        "goal": "本章目标",
        "mainEvent": "主要事件",
        "conflict": "冲突点",
        "hook": "结尾钩子",
        "locked": false
      }
    ],

    "firstChapterAdvice": {
      "openingScene": "开场场景",
      "characters": "出场人物",
      "mood": "情绪基调",
      "conflictIntro": "冲突引入",
      "endingHook": "结尾钩子"
    },

    "notes": "其他建议"
  },

  "firstChapter": {
    "chapterNo": 1,
    "title": "第一章标题",
    "content": "第一章正文内容（真正的小说正文，不是大纲，要有场景、动作、对白、心理、节奏和结尾钩子，字数2000-4000字）",
    "summary": "本章摘要（100字以内）",
    "characterChanges": "人物状态变化",
    "clues": "伏笔/线索",
    "nextChapterHint": "下一章建议"
  }
}

要求：
1. 用户只给一句话时，必须自动补全所有空白，包括题材、风格、篇幅，不要反问
2. 优先生成"好看、上头、有代入感"的小说
3. 至少生成3个角色（主角、重要配角、反派或阻力来源）
4. 章节规划5-12个
5. 第一章必须是真正小说正文，不是大纲
6. 正文要有场景、动作、对白、心理、节奏和结尾钩子
7. 第一章字数2000-4000字，移动端可读
8. 只输出 JSON，不要其他文字
9. 题材、风格、篇幅由你根据用户想法自动判断，不要留空`;
}

/**
 * 解析一键生成结果
 */
export function parseNovelAutoStartResult(text: string): NovelAutoStartResult | null {
  try {
    let jsonStr = text.trim();

    // 如果被 ```json 包裹，提取内容
    if (jsonStr.startsWith('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        jsonStr = match[1].trim();
      }
    }

    // 尝试找到 JSON 对象的起始和结束
    const startIndex = jsonStr.indexOf('{');
    const lastIndex = jsonStr.lastIndexOf('}');
    if (startIndex !== -1 && lastIndex !== -1) {
      jsonStr = jsonStr.slice(startIndex, lastIndex + 1);
    }

    const parsed = JSON.parse(jsonStr);

    // 验证必要字段
    if (!parsed.project || !parsed.firstChapter) {
      console.warn('[parseNovelAutoStartResult] 缺少 project 或 firstChapter');
      return null;
    }

    return {
      project: parsed.project,
      firstChapter: parsed.firstChapter,
    };
  } catch (e) {
    console.error('[parseNovelAutoStartResult] 解析失败:', e);
    return null;
  }
}

/**
 * 构建快速修改 Prompt
 */
export function buildNovelApplyQuickEditPrompt(options: {
  novelProject: NovelProject;
  currentChapter: NovelChapterDraft;
  quickHeroName?: string;
  quickLoveInterestName?: string;
  quickTone?: string;
  quickRelationship?: string;
  quickEnding?: string;
}): string {
  const { novelProject, currentChapter, quickHeroName, quickLoveInterestName, quickTone, quickRelationship, quickEnding } = options;

  const edits: string[] = [];
  if (quickHeroName) edits.push(`主角名字改为：${quickHeroName}`);
  if (quickLoveInterestName) edits.push(`另一位主角名字改为：${quickLoveInterestName}`);
  if (quickTone) edits.push(`风格调整为：${quickTone}`);
  if (quickRelationship) edits.push(`关系类型改为：${quickRelationship}`);
  if (quickEnding) edits.push(`结局倾向改为：${quickEnding}`);

  return `你是一个专业的小说编辑。请根据用户的修改要求，更新小说设定并重写当前章节。

当前小说设定：
${JSON.stringify(novelProject, null, 2)}

当前章节：
标题：${currentChapter.title}
正文：${currentChapter.content.slice(0, 1000)}...

用户修改要求：
${edits.join('\n')}

请输出 JSON 格式：

{
  "project": { ...更新后的完整 NovelProject },
  "chapter": { ...重写后的 NovelChapterDraft }
}

要求：
1. 只修改用户要求的字段，其他保持不变
2. 如果用户只改名字，就只替换名字，不要大改剧情和世界观
3. 重写章节时必须使用新的设定
4. 正文要有场景、动作、对白、心理、节奏和结尾钩子
5. 只输出 JSON`;
}

/**
 * 构建下一章大纲 Prompt
 */
export function buildNovelNextOutlinePrompt(options: {
  novelProject: NovelProject;
  chapters: NovelChapterDraft[];
  nextChapterIdea?: string;
}): string {
  const { novelProject, chapters, nextChapterIdea } = options;

  const nextChapterNo = chapters.length + 1;
  const chapterPlan = novelProject.chapters.find(c => c.chapterNo === nextChapterNo);

  // 构建已有章节摘要
  const chapterSummaries = chapters.map(c => `第 ${c.chapterNo} 章《${c.title}》：${c.summary}`).join('\n');

  // 获取最后一章内容（截取后部分）
  const lastChapter = chapters[chapters.length - 1];
  const lastChapterContent = lastChapter?.content?.slice(-2000) || '';

  return `你是一个专业的小说策划。请根据已有内容，生成下一章的大纲。

小说名：${novelProject.title}
题材：${novelProject.genre}
风格：${novelProject.style}

【角色设定】
${novelProject.characters.map(c => `- ${c.name}（${c.role}）：${c.identity}，性格${c.personality}`).join('\n')}

【故事大纲】
开端：${novelProject.outline.beginning}
发展：${novelProject.outline.development}
转折：${novelProject.outline.twist}
高潮：${novelProject.outline.climax}
结局：${novelProject.outline.ending}

【已有章节摘要】
${chapterSummaries}

【上一章结尾】
${lastChapterContent}

${chapterPlan ? `【原章节规划】
章节标题：${chapterPlan.title}
本章目标：${chapterPlan.goal}
主要事件：${chapterPlan.mainEvent}
冲突点：${chapterPlan.conflict}
结尾钩子：${chapterPlan.hook}` : ''}

${nextChapterIdea ? `【用户希望下一章】\n${nextChapterIdea}` : ''}

请输出下一章的大纲，包括：
1. 章节标题
2. 本章目标
3. 主要事件（3-5个）
4. 冲突点
5. 情绪变化
6. 人物关系推进
7. 需要延续的伏笔
8. 新增伏笔/线索
9. 结尾钩子
10. 正文写作建议

要求：
1. 必须承接上一章
2. 不要推翻前文
3. 不要突然完结
4. 人物姓名、身份、性格必须与设定一致`;
}

/**
 * 构建续写正文 Prompt
 */
export function buildNovelContinueChapterPrompt(options: {
  novelProject: NovelProject;
  chapters: NovelChapterDraft[];
  nextChapterIdea?: string;
  nextChapterOutline?: string;
}): string {
  const { novelProject, chapters, nextChapterIdea, nextChapterOutline } = options;

  const nextChapterNo = chapters.length + 1;
  const chapterPlan = novelProject.chapters.find(c => c.chapterNo === nextChapterNo);

  // 构建已有章节摘要
  const chapterSummaries = chapters.map(c => `第 ${c.chapterNo} 章《${c.title}》：${c.summary}`).join('\n');

  // 获取最后一章内容
  const lastChapter = chapters[chapters.length - 1];
  const lastChapterContent = lastChapter?.content || '';

  // 锁定角色信息
  const lockedCharacters = novelProject.characters.filter(c => c.locked);
  const lockedInfo = lockedCharacters.length > 0
    ? `\n【用户已锁定的角色，必须严格遵守】：\n${lockedCharacters.map(c => `- ${c.name}：${c.identity}，性格${c.personality}`).join('\n')}`
    : '';

  return `你是一个专业的小说作家。请根据小说企划和已有内容，续写下一章正文。

小说名：${novelProject.title}
题材：${novelProject.genre}
风格：${novelProject.style}

【角色设定】
${novelProject.characters.map(c => `- ${c.name}（${c.role}）：${c.identity}，性格${c.personality}`).join('\n')}
${lockedInfo}

【世界观/背景】
${novelProject.world.background}

【已有章节摘要】
${chapterSummaries}

【上一章完整内容】
${lastChapterContent.slice(-3000)}${lastChapterContent.length > 3000 ? '...(前文已省略)' : ''}

${chapterPlan ? `【章节规划】
章节标题：${chapterPlan.title}
本章目标：${chapterPlan.goal}
主要事件：${chapterPlan.mainEvent}
冲突点：${chapterPlan.conflict}
结尾钩子：${chapterPlan.hook}` : ''}

${nextChapterIdea ? `【用户希望下一章】\n${nextChapterIdea}` : ''}

${nextChapterOutline ? `【下一章大纲】\n${nextChapterOutline}` : ''}

请输出 JSON 格式：

{
  "chapterNo": ${nextChapterNo},
  "title": "章节标题",
  "content": "正文内容（真正的小说正文，要有场景、动作、对白、心理、节奏和结尾钩子，字数2000-4000字）",
  "summary": "本章摘要（100字以内）",
  "characterChanges": "人物状态变化",
  "clues": "伏笔/线索",
  "nextChapterHint": "下一章建议"
}

要求：
1. content 必须是真正小说正文，不是大纲
2. 承接上一章最后的情绪和事件
3. 遵守小说设定，人物姓名、身份、性格必须一致
4. 不要跳剧情，不要突然完结
5. 正文要有场景、动作、对白、心理、节奏和结尾钩子
6. 只输出 JSON`;
}

/**
 * 解析章节草稿 JSON
 */
export function parseNovelChapterDraft(text: string): NovelChapterDraft | null {
  try {
    let jsonStr = text.trim();

    if (jsonStr.startsWith('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        jsonStr = match[1].trim();
      }
    }

    const startIndex = jsonStr.indexOf('{');
    const lastIndex = jsonStr.lastIndexOf('}');
    if (startIndex !== -1 && lastIndex !== -1) {
      jsonStr = jsonStr.slice(startIndex, lastIndex + 1);
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.content) {
      console.warn('[parseNovelChapterDraft] 缺少 content');
      return null;
    }

    return {
      chapterNo: parsed.chapterNo || 1,
      title: parsed.title || '',
      content: parsed.content || '',
      summary: parsed.summary || '',
      characterChanges: parsed.characterChanges || '',
      clues: parsed.clues || '',
      nextChapterHint: parsed.nextChapterHint || '',
    };
  } catch (e) {
    console.error('[parseNovelChapterDraft] 解析失败:', e);
    return null;
  }
}
