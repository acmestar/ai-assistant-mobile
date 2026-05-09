// 创作台 - 独立标签页
import { useState, useEffect } from 'react';
import {
  Pencil,
  Sparkles,
  Play,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Circle,
  Trash2,
  Save,
  FolderOpen,
  Download,
  BookOpen,
  Wand2,
} from 'lucide-react';
import { useAppStore, CHAT_MODELS, NovelTaskType, NovelRewriteType, NOVEL_TASK_TYPE_NAMES, NOVEL_REWRITE_NAMES } from './store';
import { executeModelQueue, regenerateQueueItem, callChatCompletionRaw } from './api';
import {
  buildCreationPrompt,
  buildNovelPrompt,
  buildNovelRewritePrompt,
  convertParsedCreationToQueue,
  getExportTitle,
  getItemName,
} from './creationUtils';
import type { CreationMode } from './store';
import ReactMarkdown from 'react-markdown';
import AutoResizeTextarea from './components/AutoResizeTextarea';

// 示例创作目标 - 涵盖小目标和大目标
const EXAMPLE_TARGETS: Array<{ category: string; text: string; icon: string; mode: CreationMode }> = [
  // 小目标
  { category: '小红书', text: '帮我写10条小红书种草文案，主题是护肤', icon: '📱', mode: 'xiaohongshu' },
  { category: '短视频', text: '帮我写20个短视频脚本，主题是职场干货', icon: '🎬', mode: 'short_video' },
  { category: '朋友圈', text: '帮我写一周的朋友圈文案，主题是健身打卡', icon: '💬', mode: 'moments' },
  { category: '产品文案', text: '帮我写一套产品介绍文案，5个SKU', icon: '🛍️', mode: 'product_copy' },
  // 大目标
  { category: '小说', text: '我想写一本都市言情小说，帮我规划大纲', icon: '📖', mode: 'novel' },
  { category: '课程', text: '我想做一套Python入门课程，帮我设计大纲', icon: '🎓', mode: 'course_outline' },
  { category: '短剧', text: '我想写一个短剧剧本，10集甜宠剧', icon: '🎭', mode: 'short_drama' },
  { category: '营销矩阵', text: '帮我规划一个品牌全年的内容营销矩阵', icon: '📊', mode: 'marketing_matrix' },
];

// 默认顺序执行的模式（长内容、需要上下文连贯）
const SEQUENTIAL_MODES: CreationMode[] = ['novel', 'short_drama', 'course_outline'];

export default function SuperWritingTab() {
  const {
    language,
    chatModelId,
    modelQueue,
    addModelToQueue,
    toggleQueueItem,
    updateQueueInstruction,
    clearModelQueue,
    undoClearModelQueue,
    isQueueRunning,
    currentQueueIndex,
    parallelMode,
    setParallelMode,
    addCharacter,
    setWorldSetting,
    savedTasks,
    saveTask,
    loadTask,
    deleteTask,
    apiKey,
    // 当前创作草稿
    activeWritingDraft,
    setActiveWritingDraft,
    characterMemory,
    worldSetting,
    // 从聊天页传递的需求
    pendingWritingRequirement,
    clearPendingWritingRequirement,
    // 创作台默认模型
    selectedWritingModelId,
    setSelectedWritingModelId,
  } = useAppStore();

  const [showOutlineParser, setShowOutlineParser] = useState(false);
  const [outlineText, setOutlineText] = useState('');
  const [creationMode, setCreationMode] = useState<CreationMode>('novel');
  const [parsedOutline, setParsedOutline] = useState<{
    chapters: Array<{ title: string; content?: string; order: number }>;
    characters: Array<{ name: string; description: string; replaceWith?: string }>;
    worldSetting: string;
  } | null>(null);
  const [parsedCreation, setParsedCreation] = useState<any>(null); // 不同创作类型的解析结果
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showOutlinePreview, setShowOutlinePreview] = useState(false);
  const [showTaskPanel, setShowTaskPanel] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // 生成模式：快速生成（一次API）或分步创作（大纲+队列）
  const [generationMode, setGenerationMode] = useState<'fast' | 'structured'>('fast');

  // 小说子模式状态
  const [novelTaskType, setNovelTaskType] = useState<NovelTaskType>('chapter_draft');
  const [novelGenre, setNovelGenre] = useState<string>('');
  const [novelStyle, setNovelStyle] = useState<string>('');
  const [novelChapterInfo, setNovelChapterInfo] = useState<string>('');

  // 快速生成结果
  const [fastResult, setFastResult] = useState<string>('');
  const [fastLoading, setFastLoading] = useState(false);
  const [fastError, setFastError] = useState<string | null>(null);

  // 小说改写状态
  const [rewriteLoading, setRewriteLoading] = useState(false);

  // 获取实际使用的模型ID（优先使用创作台默认模型，否则使用全局模型）
  const effectiveModelId = selectedWritingModelId || chatModelId;

  // 接收从聊天页传递的需求
  useEffect(() => {
    if (pendingWritingRequirement.trim()) {
      setOutlineText(pendingWritingRequirement);
      // 不再自动打开大纲解析面板，让用户自己决定如何处理
      clearPendingWritingRequirement();
    }
  }, [pendingWritingRequirement]);

  // 从 activeWritingDraft 恢复创作状态（页面刷新后）
  useEffect(() => {
    if (activeWritingDraft) {
      // 恢复大纲文本
      if (activeWritingDraft.outlineText) {
        setOutlineText(activeWritingDraft.outlineText);
      }
      // 恢复创作类型
      if (activeWritingDraft.creationMode) {
        setCreationMode(activeWritingDraft.creationMode);
      }
      // 恢复解析结果
      if (activeWritingDraft.parsedOutline) {
        setParsedOutline(activeWritingDraft.parsedOutline);
        // 只有当队列空时才自动打开预览
        if (modelQueue.length === 0) {
          setShowOutlinePreview(true);
        }
      }
      // 恢复不同创作类型的解析结果
      if (activeWritingDraft.parsedCreation) {
        setParsedCreation(activeWritingDraft.parsedCreation);
        if (modelQueue.length === 0) {
          setShowOutlinePreview(true);
        }
      }
      console.log('已从草稿恢复创作状态');
    }
  }, []); // 只在组件挂载时执行一次

  // 自动保存草稿 - 当创作内容变化时
  useEffect(() => {
    // 检查是否有有效内容
    const hasValidContent =
      outlineText.trim() ||
      parsedOutline ||
      parsedCreation ||
      modelQueue.some(item => item.instruction?.trim() || item.result?.trim()) ||
      worldSetting.trim() ||
      characterMemory.length > 0;

    // 只有在有有效内容时才保存，避免空草稿覆盖
    if (!hasValidContent) return;

    const draft = {
      id: activeWritingDraft?.id || Date.now().toString(),
      title: '创作台',
      outlineText,
      creationMode,
      parsedOutline,
      parsedCreation,
      // modelQueue 不在这里保存，由顶层 modelQueue 单独持久化
      modelQueue: [],
      worldSetting,
      characterMemory: characterMemory.map(c => ({
        id: c.id,
        originalName: c.originalName,
        replaceWith: c.replaceWith,
        description: c.description,
      })),
      source: 'superWriting' as const,
      updatedAt: Date.now(),
    };
    setActiveWritingDraft(draft);
  }, [modelQueue, parsedOutline, parsedCreation, outlineText, creationMode, worldSetting, characterMemory]); // 依赖关键状态

  // 解析大纲/创作目标
  const handleParseOutline = async () => {
    if (!outlineText.trim() || !apiKey) return;

    setIsAnalyzing(true);
    try {
      // 根据创作类型使用不同的 Prompt
      const prompt = buildCreationPrompt(creationMode, outlineText);

      // 使用不写聊天记录的 API
      const result = await callChatCompletionRaw(prompt, {
        modelId: effectiveModelId,
      });

      // 解析 JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // 对于小说类型，保持原有逻辑
        if (creationMode === 'novel') {
          setParsedOutline(parsed);
          setParsedCreation(null);

          // 更新世界观设定
          if (parsed.worldSetting) {
            setWorldSetting(parsed.worldSetting);
          }

          // 添加角色
          if (parsed.characters) {
            parsed.characters.forEach((char: any) => {
              if (char.name) {
                addCharacter(char.name, char.replaceWith || char.name, char.description || '');
              }
            });
          }
        } else {
          // 其他创作类型
          setParsedCreation(parsed);
          setParsedOutline(null);
        }

        setShowOutlinePreview(true);
      }
    } catch (error: any) {
      console.error('解析失败:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 从解析结果生成队列
  const handleGenerateQueue = () => {
    // 小说类型使用原有逻辑
    if (creationMode === 'novel' && parsedOutline?.chapters) {
      clearModelQueue();
      parsedOutline.chapters.forEach((chapter) => {
        addModelToQueue(
          effectiveModelId,
          chapter.content || `请根据大纲创作：${chapter.title}`,
          chapter.title
        );
      });
    } else if (parsedCreation) {
      // 其他创作类型使用新的转换函数
      clearModelQueue();
      const items = convertParsedCreationToQueue(creationMode, parsedCreation, effectiveModelId, language);
      items.forEach((item) => {
        addModelToQueue(effectiveModelId, item.instruction, item.title);
      });
    }

    setShowOutlineParser(false);
    setShowOutlinePreview(false);
    setOutlineText('');
  };

  // 执行队列
  const handleExecuteQueue = async () => {
    if (modelQueue.length === 0 || !apiKey) return;

    const { updateQueueResult } = useAppStore.getState();

    // 创作中心不保存到聊天记录，但需要传入 onProgress 回调更新 UI
    // 传入创作台默认模型
    await executeModelQueue(
      (queueId, content, isComplete) => {
        // 实时更新结果
        updateQueueResult(queueId, content);
        // 完成时自动展开该项
        if (isComplete) {
          setExpandedResults(prev => new Set(prev).add(queueId));
        }
      },
      undefined, // onChapterComplete 不需要，因为不写聊天记录
      { saveToConversation: false, modelId: effectiveModelId }
    );
  };

  // 快速生成 - 一次 API 完成创作
  const handleFastGenerate = async () => {
    if (!outlineText.trim() || !apiKey) return;

    setFastLoading(true);
    setFastError(null);
    setFastResult('');

    try {
      // 根据创作类型构建 prompt
      let prompt: string;
      if (creationMode === 'novel') {
        // 小说模式使用专用 prompt
        prompt = buildNovelPrompt(novelTaskType, outlineText, {
          genre: novelGenre,
          style: novelStyle,
          chapterInfo: novelChapterInfo,
        });
      } else {
        prompt = buildCreationPrompt(creationMode, outlineText);
      }

      // 校验 prompt 不为空
      if (!prompt || !prompt.trim()) {
        throw new Error(language === 'zh' ? '生成失败：Prompt 为空' : 'Generation failed: Prompt is empty');
      }

      // 日志输出，便于调试
      console.log('[FastGenerate]', {
        creationMode,
        novelTaskType,
        selectedWritingModelId,
        chatModelId,
        effectiveModelId,
        promptLength: prompt.length,
        promptPreview: prompt.slice(0, 200),
      });

      // 使用流式输出，传入创作台默认模型
      const result = await callChatCompletionRaw(prompt, {
        modelId: effectiveModelId,
        onChunk: (chunk) => {
          setFastResult(prev => prev + chunk);
        },
      });

      setFastResult(result);
    } catch (error: any) {
      console.error('[FastGenerateError]', error);
      // 提取更详细的错误信息
      let errorMessage = error.message || '生成失败';
      if (error.message?.includes('API 错误:')) {
        // 已经是格式化的 API 错误
        errorMessage = error.message;
      } else if (error.response) {
        errorMessage = `API 错误: ${error.response.status || '未知'} ${error.response.statusText || ''}`;
      }
      setFastError(errorMessage);
    } finally {
      setFastLoading(false);
    }
  };

  // 单项重生成
  const handleRegenerateItem = async (queueId: string) => {
    if (!apiKey) return;
    const { updateQueueResult } = useAppStore.getState();

    try {
      // 对于小说模式，使用专门的 regenerateQueueItem
      if (creationMode === 'novel') {
        const result = await regenerateQueueItem(queueId, (content) => {
          updateQueueResult(queueId, content);
        });
        updateQueueResult(queueId, result);
      } else {
        // 非 novel 模式：直接重新执行该 item 的 instruction（不写聊天记录）
        const item = modelQueue.find(q => q.id === queueId);
        if (!item || !item.instruction.trim()) return;

        const result = await callChatCompletionRaw(item.instruction, {
          modelId: effectiveModelId,
          onChunk: (chunk) => {
            // 实时更新进度
            const currentItem = useAppStore.getState().modelQueue.find(q => q.id === queueId);
            if (currentItem) {
              updateQueueResult(queueId, (currentItem.result || '') + chunk);
            }
          },
        });
        updateQueueResult(queueId, result);
      }
    } catch (error: any) {
      console.error('重生成失败:', error);
      updateQueueResult(queueId, `错误: ${error.message}`);
    }
  };

  // 小说改写处理
  const handleNovelRewrite = async (rewriteType: NovelRewriteType) => {
    if (!fastResult.trim() || !apiKey) return;

    setRewriteLoading(true);
    try {
      const prompt = buildNovelRewritePrompt(rewriteType, fastResult);
      const result = await callChatCompletionRaw(prompt, {
        modelId: effectiveModelId,
      });
      setFastResult(result);
    } catch (error: any) {
      console.error('改写失败:', error);
      setFastError(error.message || '改写失败');
    } finally {
      setRewriteLoading(false);
    }
  };

  // 切换展开结果
  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedResults);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedResults(newSet);
  };

  // 导出功能
  const handleExport = (format: 'txt' | 'md' | 'html') => {
    const exportTitle = getExportTitle(creationMode, language);
    const itemName = getItemName(creationMode, language);

    let content = '';
    const title = exportTitle;
    const date = new Date().toLocaleString('zh-CN');

    if (format === 'txt') {
      content = `${title}\n导出时间：${date}\n\n`;
      content += '='.repeat(50) + '\n\n';
      modelQueue.forEach((item, index) => {
        content += `【${itemName} ${index + 1}】${item.title || ''}\n`;
        content += '-'.repeat(30) + '\n';
        if (item.result) {
          content += item.result + '\n\n';
        }
      });
    } else if (format === 'md') {
      content = `# ${title}\n\n`;
      content += `> 导出时间：${date}\n\n---\n\n`;
      modelQueue.forEach((item, index) => {
        content += `## ${itemName} ${index + 1}：${item.title || ''}\n\n`;
        if (item.result) {
          content += item.result + '\n\n';
        }
      });
    } else if (format === 'html') {
      content = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; border-bottom: 2px solid #10B981; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 20px; }
    .chapter { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .chapter-title { font-weight: bold; color: #10B981; margin-bottom: 10px; }
    .chapter-content { white-space: pre-wrap; line-height: 1.8; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">导出时间：${date}</p>
`;
      modelQueue.forEach((item, index) => {
        const escapedResult = item.result ? item.result.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
        content += `  <div class="chapter">
    <div class="chapter-title">${itemName} ${index + 1}：${item.title || ''}</div>
    <div class="chapter-content">${escapedResult}</div>
  </div>\n`;
      });
      content += `</body>\n</html>`;
    }

    // 下载文件
    const blob = new Blob([content], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportTitle}_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 获取预览内容
  const getPreviewContent = () => {
    if (creationMode === 'novel' && parsedOutline) {
      return {
        count: parsedOutline.chapters?.length || 0,
        itemName: language === 'zh' ? '章节' : 'Chapters',
        items: parsedOutline.chapters || [],
      };
    } else if (parsedCreation) {
      let count = 0;
      let items: any[] = [];
      let itemName = language === 'zh' ? '内容项' : 'Items';

      switch (creationMode) {
        case 'xiaohongshu':
          count = parsedCreation.items?.length || 0;
          items = (parsedCreation.items || []).map((item: any) => ({ title: item.title }));
          itemName = language === 'zh' ? '文案' : 'Posts';
          break;
        case 'short_video':
          count = parsedCreation.scripts?.length || 0;
          items = (parsedCreation.scripts || []).map((item: any) => ({ title: item.title }));
          itemName = language === 'zh' ? '脚本' : 'Scripts';
          break;
        case 'moments':
          count = parsedCreation.posts?.length || 0;
          items = (parsedCreation.posts || []).map((item: any) => ({ title: item.day || item.content?.slice(0, 20) }));
          itemName = language === 'zh' ? '朋友圈' : 'Posts';
          break;
        case 'product_copy':
          count = parsedCreation.products?.length || 0;
          items = (parsedCreation.products || []).map((item: any) => ({ title: item.name }));
          itemName = language === 'zh' ? '产品文案' : 'Products';
          break;
        case 'marketing_matrix':
          count = parsedCreation.calendar?.length || 0;
          items = (parsedCreation.calendar || []).map((item: any) => ({ title: `${item.period} - ${item.platform}` }));
          itemName = language === 'zh' ? '内容计划' : 'Plans';
          break;
        case 'course_outline':
          const modules = parsedCreation.modules || [];
          count = modules.reduce((sum: number, m: any) => sum + (m.lessons?.length || 0), 0);
          items = modules.flatMap((m: any) => (m.lessons || []).map((l: any) => ({ title: `${m.title} - ${l.title}` })));
          itemName = language === 'zh' ? '课时' : 'Lessons';
          break;
        case 'short_drama':
          count = parsedCreation.episodes?.length || 0;
          items = (parsedCreation.episodes || []).map((item: any) => ({ title: `第${item.episode}集 - ${item.title}` }));
          itemName = language === 'zh' ? '剧集' : 'Episodes';
          break;
        case 'free':
          count = parsedCreation.items?.length || 0;
          items = (parsedCreation.items || []).map((item: any) => ({ title: item.title }));
          itemName = language === 'zh' ? '内容项' : 'Items';
          break;
      }

      return { count, itemName, items };
    }
    return { count: 0, itemName: '', items: [] };
  };

  const previewContent = getPreviewContent();
  const currentItemName = getItemName(creationMode, language);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Pencil size={18} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {language === 'zh' ? '创作台' : 'Create'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* 默认创作模型选择器 */}
          <select
            value={effectiveModelId}
            onChange={(e) => setSelectedWritingModelId(e.target.value)}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-secondary)',
              fontSize: 11,
              maxWidth: 120,
            }}
          >
            <option value="">{language === 'zh' ? '默认模型' : 'Default'}</option>
            {CHAT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>          {/* 导出按钮 */}
          {modelQueue.length > 0 && modelQueue.some(item => item.result) && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => handleExport('md')}
                style={{
                  padding: 6,
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-muted)',
                }}
                title={language === 'zh' ? '导出' : 'Export'}
              >
                <Download size={16} />
              </button>
            </div>
          )}
          <button
            onClick={() => setShowTaskPanel(!showTaskPanel)}
            style={{
              padding: 6,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-muted)',
            }}
            title={language === 'zh' ? '任务存档' : 'Saved Tasks'}
          >
            <FolderOpen size={16} />
          </button>
          <button
            onClick={() => {
              if (modelQueue.length > 0) {
                const name = prompt(language === 'zh' ? '输入任务名称：' : 'Task name:');
                if (name) {
                  saveTask(name, {
                    creationMode,
                    parsedCreation,
                    outlineText,
                    worldSetting,
                    characterMemory: characterMemory.map(c => ({
                      id: c.id,
                      originalName: c.originalName,
                      replaceWith: c.replaceWith,
                      description: c.description,
                    })),
                  });
                }
              }
            }}
            disabled={modelQueue.length === 0}
            style={{
              padding: 6,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: modelQueue.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
              opacity: modelQueue.length === 0 ? 0.5 : 1,
            }}
            title={language === 'zh' ? '保存任务' : 'Save Task'}
          >
            <Save size={16} />
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 功能说明 */}
        <div style={{
          padding: 16,
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          fontSize: 12,
          color: 'var(--text-secondary)',
          lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pencil size={16} style={{ color: 'var(--accent)' }} />
            {language === 'zh' ? 'AI 创作工厂' : 'AI Content Factory'}
            {/* 当前创作类型显示 */}
            <span style={{
              marginLeft: 'auto',
              padding: '2px 8px',
              background: 'var(--accent-dim)',
              borderRadius: 6,
              fontSize: 11,
              color: 'var(--accent)',
            }}>
              {EXAMPLE_TARGETS.find(t => t.mode === creationMode)?.icon} {EXAMPLE_TARGETS.find(t => t.mode === creationMode)?.category}
            </span>
          </div>
          <p style={{ marginBottom: 8 }}>
            {language === 'zh'
              ? '给一个创作目标，AI 自动搭建内容生产线，批量生产高质量内容'
              : 'Give a goal, AI builds a content pipeline and produces quality content in batch'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div style={{ padding: 8, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
              <div style={{ fontWeight: 500, color: 'var(--accent)', marginBottom: 4 }}>📝 {language === 'zh' ? '小目标' : 'Small'}</div>
              <div style={{ fontSize: 11 }}>{language === 'zh' ? '文案、脚本、选题...' : 'Copy, scripts, topics...'}</div>
            </div>
            <div style={{ padding: 8, background: 'var(--bg-tertiary)', borderRadius: 6 }}>
              <div style={{ fontWeight: 500, color: 'var(--accent)', marginBottom: 4 }}>📚 {language === 'zh' ? '大目标' : 'Big'}</div>
              <div style={{ fontSize: 11 }}>{language === 'zh' ? '小说、课程、剧本...' : 'Novels, courses, plays...'}</div>
            </div>
          </div>
        </div>

        {/* 快捷目标按钮 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {EXAMPLE_TARGETS.slice(0, 6).map((target, i: number) => (
            <button
              key={i}
              onClick={() => {
                setOutlineText(target.text);
                setCreationMode(target.mode);
                // 设置默认执行模式
                setParallelMode(!SEQUENTIAL_MODES.includes(target.mode));
                setShowOutlineParser(true);
              }}
              style={{
                padding: '6px 10px',
                fontSize: 11,
                background: creationMode === target.mode ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                border: creationMode === target.mode ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 8,
                color: creationMode === target.mode ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>{target.icon}</span>
              {target.category}
            </button>
          ))}
        </div>

        {/* 大纲解析按钮 */}
        <button
          onClick={() => setShowOutlineParser(!showOutlineParser)}
          className="btn-primary"
          style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Sparkles size={18} />
          {language === 'zh' ? '输入创作目标' : 'Set Creation Goal'}
        </button>

        {/* 大纲解析面板 */}
        {showOutlineParser && (
          <div style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--border)',
          }}>
            {/* 当前创作类型显示 */}
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: '4px 10px',
                background: 'var(--accent-dim)',
                borderRadius: 6,
                fontSize: 12,
                color: 'var(--accent)',
                fontWeight: 500,
              }}>
                {EXAMPLE_TARGETS.find(t => t.mode === creationMode)?.icon} {EXAMPLE_TARGETS.find(t => t.mode === creationMode)?.category}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {language === 'zh' ? '（点击上方按钮切换类型）' : '(Click buttons above to change type)'}
              </span>
            </div>

            {/* 小说子模式选择器 - 仅在小说模式下显示 */}
            {creationMode === 'novel' && (
              <div style={{ marginBottom: 12, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BookOpen size={14} style={{ color: 'var(--accent)' }} />
                  {language === 'zh' ? '小说子模式' : 'Novel Task Type'}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                  gap: 6,
                }}>
                  {(Object.keys(NOVEL_TASK_TYPE_NAMES) as NovelTaskType[]).map((taskType) => (
                    <button
                      key={taskType}
                      onClick={() => setNovelTaskType(taskType)}
                      style={{
                        padding: '8px 6px',
                        background: novelTaskType === taskType ? 'var(--accent)' : 'var(--bg-secondary)',
                        border: novelTaskType === taskType ? '1px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 6,
                        color: novelTaskType === taskType ? 'white' : 'var(--text-secondary)',
                        fontSize: 11,
                        textAlign: 'center',
                        cursor: 'pointer',
                        minWidth: 0,
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                      title={language === 'zh' ? NOVEL_TASK_TYPE_NAMES[taskType].descZh : NOVEL_TASK_TYPE_NAMES[taskType].descEn}
                    >
                      {language === 'zh' ? NOVEL_TASK_TYPE_NAMES[taskType].zh : NOVEL_TASK_TYPE_NAMES[taskType].en}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                  {language === 'zh' ? NOVEL_TASK_TYPE_NAMES[novelTaskType].descZh : NOVEL_TASK_TYPE_NAMES[novelTaskType].descEn}
                </div>
              </div>
            )}

            {/* 小说额外字段 - 仅在小说模式下显示 */}
            {creationMode === 'novel' && (
              <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={novelGenre}
                  onChange={(e) => setNovelGenre(e.target.value)}
                  placeholder={language === 'zh' ? '题材：玄幻、都市、悬疑...' : 'Genre: Fantasy, Urban, Mystery...'}
                  style={{
                    flex: 1,
                    minWidth: 100,
                    padding: '8px 10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                />
                <input
                  type="text"
                  value={novelStyle}
                  onChange={(e) => setNovelStyle(e.target.value)}
                  placeholder={language === 'zh' ? '风格：爽文、热血、细腻...' : 'Style: Cool, Passionate, Delicate...'}
                  style={{
                    flex: 1,
                    minWidth: 100,
                    padding: '8px 10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                />
                <input
                  type="text"
                  value={novelChapterInfo}
                  onChange={(e) => setNovelChapterInfo(e.target.value)}
                  placeholder={language === 'zh' ? '章节/字数：第3章，3000字' : 'Chapter: Ch.3, 3000 words'}
                  style={{
                    flex: 1,
                    minWidth: 100,
                    padding: '8px 10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                />
              </div>
            )}

            {/* 生成模式选择 */}
            <div style={{ marginBottom: 12, padding: 10, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
                {language === 'zh' ? '生成模式' : 'Generation Mode'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setGenerationMode('fast')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: generationMode === 'fast' ? 'var(--accent)' : 'var(--bg-secondary)',
                    border: generationMode === 'fast' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 8,
                    color: generationMode === 'fast' ? 'white' : 'var(--text-secondary)',
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>⚡ {language === 'zh' ? '快速生成' : 'Fast'}</div>
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
                    {language === 'zh' ? '1次请求完成' : '1 API call'}
                  </div>
                </button>
                <button
                  onClick={() => setGenerationMode('structured')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: generationMode === 'structured' ? 'var(--accent)' : 'var(--bg-secondary)',
                    border: generationMode === 'structured' ? '1px solid var(--accent)' : '1px solid var(--border)',
                    borderRadius: 8,
                    color: generationMode === 'structured' ? 'white' : 'var(--text-secondary)',
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>📋 {language === 'zh' ? '分步创作' : 'Structured'}</div>
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
                    {language === 'zh' ? '大纲+队列逐步生成' : 'Outline + Queue'}
                  </div>
                </button>
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text-primary)' }}>
              {language === 'zh' ? '描述你的创作目标' : 'Describe your creation goal'}
            </div>
            <AutoResizeTextarea
              value={outlineText}
              onChange={(e) => setOutlineText(e.target.value)}
              placeholder={language === 'zh'
                ? '例如：\n• 帮我写10条小红书护肤文案\n• 我想写一本都市言情小说\n• 帮我规划一套Python课程大纲\n• 写20个职场短视频脚本'
                : 'e.g.,\n• Write 10 skincare posts for Xiaohongshu\n• I want to write a romance novel\n• Design a Python course outline'
              }
              minHeight={150}
              maxHeight={400}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 13,
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {generationMode === 'fast' ? (
                <button
                  onClick={handleFastGenerate}
                  disabled={!outlineText.trim() || fastLoading}
                  className="btn-primary"
                  style={{ flex: 1, padding: 10 }}
                >
                  {fastLoading ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      {language === 'zh' ? '生成中...' : 'Generating...'}
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      {language === 'zh' ? '快速生成' : 'Fast Generate'}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleParseOutline}
                  disabled={!outlineText.trim() || isAnalyzing}
                  className="btn-primary"
                  style={{ flex: 1, padding: 10 }}
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      {language === 'zh' ? '解析中...' : 'Parsing...'}
                    </>
                  ) : (
                    language === 'zh' ? '解析大纲' : 'Parse Outline'
                  )}
                </button>
              )}
              <button
                onClick={() => setShowOutlineParser(false)}
                style={{
                  padding: '10px 16px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-secondary)',
                }}
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* 快速生成结果 */}
        {(fastResult || fastError || fastLoading) && (
          <div style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--accent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                ✨ {language === 'zh' ? '生成结果' : 'Result'}
              </span>
              {fastResult && (
                <button
                  onClick={() => navigator.clipboard.writeText(fastResult)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12 }}
                >
                  {language === 'zh' ? '复制' : 'Copy'}
                </button>
              )}
            </div>
            {fastLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                <RefreshCw size={16} className="spin" />
                {language === 'zh' ? '生成中...' : 'Generating...'}
              </div>
            )}
            {fastError && (
              <div style={{ color: 'var(--danger)', fontSize: 13 }}>{fastError}</div>
            )}
            {fastResult && (
              <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 8,
                padding: 12,
                maxHeight: 400,
                overflow: 'auto',
                fontSize: 13,
                lineHeight: 1.8,
              }}>
                <ReactMarkdown>{fastResult}</ReactMarkdown>
              </div>
            )}

            {/* 小说改写按钮 - 仅在小说模式且有结果时显示 */}
            {creationMode === 'novel' && fastResult && !fastLoading && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wand2 size={14} style={{ color: 'var(--accent)' }} />
                  {language === 'zh' ? '继续优化' : 'Continue Optimization'}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                  gap: 6,
                }}>
                  {(Object.keys(NOVEL_REWRITE_NAMES) as NovelRewriteType[]).map((rewriteType) => (
                    <button
                      key={rewriteType}
                      onClick={() => handleNovelRewrite(rewriteType)}
                      disabled={rewriteLoading}
                      style={{
                        padding: '6px 8px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        color: 'var(--text-secondary)',
                        fontSize: 11,
                        cursor: rewriteLoading ? 'wait' : 'pointer',
                        opacity: rewriteLoading ? 0.6 : 1,
                        minWidth: 0,
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {rewriteLoading ? (
                        <RefreshCw size={10} className="spin" />
                      ) : (
                        language === 'zh' ? NOVEL_REWRITE_NAMES[rewriteType].zh : NOVEL_REWRITE_NAMES[rewriteType].en
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 大纲预览 */}
        {showOutlinePreview && (parsedOutline || parsedCreation) && (
          <div style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--accent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'zh' ? '解析结果' : 'Parsed Result'}
              </span>
              <button
                onClick={() => {
                  setShowOutlinePreview(false);
                  setParsedOutline(null);
                  setParsedCreation(null);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12 }}
              >
                {language === 'zh' ? '重新解析' : 'Re-parse'}
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                {previewContent.itemName} ({previewContent.count})
              </div>
              {previewContent.items.slice(0, 5).map((item: any, i: number) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '4px 0' }}>
                  {i + 1}. {item.title}
                </div>
              ))}
              {previewContent.count > 5 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {language === 'zh' ? `还有 ${previewContent.count - 5} 项...` : `${previewContent.count - 5} more...`}
                </div>
              )}
            </div>

            <button
              onClick={handleGenerateQueue}
              className="btn-primary"
              style={{ width: '100%', padding: 10 }}
            >
              {language === 'zh' ? '生成队列' : 'Generate Queue'}
            </button>
          </div>
        )}

        {/* 执行模式切换 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setParallelMode(false)}
            style={{
              flex: 1,
              padding: 10,
              background: !parallelMode ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: 8,
              color: !parallelMode ? 'white' : 'var(--text-secondary)',
              fontSize: 12,
            }}
          >
            {language === 'zh' ? '顺序执行' : 'Sequential'}
          </button>
          <button
            onClick={() => setParallelMode(true)}
            style={{
              flex: 1,
              padding: 10,
              background: parallelMode ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: 8,
              color: parallelMode ? 'white' : 'var(--text-secondary)',
              fontSize: 12,
            }}
          >
            {language === 'zh' ? '并行执行' : 'Parallel'}
          </button>
        </div>

        {/* 队列列表 */}
        {modelQueue.length > 0 && (
          <div style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'zh' ? '创作队列' : 'Queue'} ({modelQueue.length})
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={undoClearModelQueue}
                  style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 11 }}
                >
                  {language === 'zh' ? '撤销' : 'Undo'}
                </button>
                <button
                  onClick={clearModelQueue}
                  style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--danger)', fontSize: 11 }}
                >
                  {language === 'zh' ? '清空' : 'Clear'}
                </button>
              </div>
            </div>

            {modelQueue.map((item: { id: string; enabled?: boolean; title?: string; instruction: string; result?: string }, index: number) => (
              <div
                key={item.id}
                style={{
                  padding: 12,
                  background: item.enabled !== false ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                  borderRadius: 8,
                  marginBottom: 8,
                  opacity: item.enabled !== false ? 1 : 0.6,
                  border: currentQueueIndex === index && isQueueRunning ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => toggleQueueItem(item.id)}
                    style={{
                      padding: 2,
                      background: 'transparent',
                      border: 'none',
                      color: item.enabled !== false ? 'var(--accent)' : 'var(--text-muted)',
                    }}
                  >
                    {item.enabled !== false ? <CheckCircle size={16} /> : <Circle size={16} />}
                  </button>
                  <span style={{ flex: 1, fontWeight: 500, color: 'var(--text-primary)', fontSize: 13 }}>
                    {item.title || `${currentItemName} ${index + 1}`}
                  </span>
                  {/* 重生成按钮 */}
                  {item.result && !isQueueRunning && (
                    <button
                      onClick={() => handleRegenerateItem(item.id)}
                      style={{ padding: 2, background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                      title={language === 'zh' ? '重新生成' : 'Regenerate'}
                    >
                      <RefreshCw size={14} />
                    </button>
                  )}
                  {item.result && (
                    <button
                      onClick={() => toggleExpanded(item.id)}
                      style={{ padding: 2, background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
                    >
                      {expandedResults.has(item.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>

                <AutoResizeTextarea
                  value={item.instruction}
                  onChange={(e) => updateQueueInstruction(item.id, e.target.value)}
                  placeholder={language === 'zh' ? '输入创作指令...' : 'Enter instruction...'}
                  minHeight={60}
                  maxHeight={200}
                  style={{
                    width: '100%',
                    padding: 8,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                />

                {expandedResults.has(item.id) && item.result && (
                  <div style={{
                    marginTop: 8,
                    padding: 12,
                    background: 'var(--bg-primary)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    maxHeight: 300,
                    overflow: 'auto',
                  }}>
                    <ReactMarkdown>{item.result}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}

            {/* 执行按钮 */}
            <button
              onClick={handleExecuteQueue}
              disabled={isQueueRunning || modelQueue.filter(i => i.enabled !== false).length === 0}
              className="btn-primary"
              style={{ width: '100%', padding: 12, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {isQueueRunning ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  {language === 'zh' ? `正在执行 ${currentQueueIndex + 1}/${modelQueue.length}` : `Running ${currentQueueIndex + 1}/${modelQueue.length}`}
                </>
              ) : (
                <>
                  <Play size={16} />
                  {language === 'zh' ? '开始执行' : 'Execute'}
                </>
              )}
            </button>
          </div>
        )}

        {/* 空状态 */}
        {modelQueue.length === 0 && !showOutlineParser && (
          <div style={{
            textAlign: 'center',
            padding: 40,
            color: 'var(--text-muted)',
          }}>
            <Pencil size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
            <p style={{ fontSize: 14, marginBottom: 8 }}>{language === 'zh' ? '开始你的创作之旅' : 'Start your writing journey'}</p>
            <p style={{ fontSize: 12 }}>{language === 'zh' ? '点击上方「输入创作目标」开始' : 'Click "Set Creation Goal" to start'}</p>
          </div>
        )}
      </div>

      {/* 任务存档面板 */}
      {showTaskPanel && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'var(--bg-primary)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontWeight: 600 }}>{language === 'zh' ? '任务存档' : 'Saved Tasks'}</span>
            <button onClick={() => setShowTaskPanel(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
              <ChevronDown size={20} />
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {savedTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {language === 'zh' ? '暂无存档' : 'No saved tasks'}
              </div>
            ) : (
              savedTasks.map((task: { id: string; name: string; queue: unknown[] }) => (
                <div
                  key={task.id}
                  style={{
                    padding: 12,
                    background: 'var(--bg-secondary)',
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{task.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {task.queue.length} {language === 'zh' ? '个内容项' : 'items'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => {
                          const restored = loadTask(task.id);
                          // 恢复组件状态
                          if (restored.creationMode) {
                            setCreationMode(restored.creationMode);
                          }
                          if (restored.parsedCreation) {
                            setParsedCreation(restored.parsedCreation);
                          }
                          if (restored.outlineText) {
                            setOutlineText(restored.outlineText);
                          }
                          setShowTaskPanel(false);
                        }}
                        style={{ padding: 6, background: 'var(--accent)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11 }}
                      >
                        {language === 'zh' ? '加载' : 'Load'}
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        style={{ padding: 6, background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* CSS 动画 */}
      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
