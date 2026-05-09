// 创作中心工具函数
import { CreationMode } from './store';

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
