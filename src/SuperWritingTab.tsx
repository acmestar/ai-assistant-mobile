// 创作台 - 独立标签页
import React, { useState, useEffect } from 'react';
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
  Lock,
  Unlock,
  Plus,
  X,
} from 'lucide-react';
import { useAppStore, CHAT_MODELS, NovelProject, NovelCharacter, NovelChapterPlan, NovelChapterDraft } from './store';
import { executeModelQueue, regenerateQueueItem, callChatCompletionRaw } from './api';
import {
  buildCreationPrompt,
  buildNovelContinueChapterPrompt,
  parseNovelChapterDraft,
  convertParsedCreationToQueue,
  getExportTitle,
  getItemName,
  buildNovelProjectPrompt,
  buildNovelFirstChapterPlainPrompt,
  parseJsonFromModelText,
  normalizeNovelProject,
  buildNovelIntegrateFuturePlanPrompt,
  buildNovelRegenerateChapterPrompt,
  parseIntegratePlanResult,
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

  // 小说企划状态
  const [novelProject, setNovelProject] = useState<NovelProject | null>(null);
  const [novelChapterResult, setNovelChapterResult] = useState<NovelChapterDraft | null>(null);
  const [novelChapters, setNovelChapters] = useState<NovelChapterDraft[]>([]);
  const [showAdvancedNovelSettings, setShowAdvancedNovelSettings] = useState(false);

  // 小说生成步骤状态
  const [novelGenerationStep, setNovelGenerationStep] = useState<'idle' | 'planning' | 'project-ready' | 'chapter' | 'done' | 'error'>('idle');
  const [novelError, setNovelError] = useState('');

  // 完整小说稿阅读区
  const [showFullNovelReader, setShowFullNovelReader] = useState(false);
  const [showNovelToc, setShowNovelToc] = useState(false); // 目录显示
  const [fullNovelCopied, setFullNovelCopied] = useState(false);
  const [fullNovelCopyError, setFullNovelCopyError] = useState('');

  // 当前章节复制状态
  const [currentChapterCopied, setCurrentChapterCopied] = useState(false);
  const [currentChapterCopyError, setCurrentChapterCopyError] = useState('');

  // 续写状态
  const [nextChapterIdea, setNextChapterIdea] = useState('');

  // 后续剧情控制状态
  const [novelNewCharacterNote, setNovelNewCharacterNote] = useState('');
  const [novelNewPlotNote, setNovelNewPlotNote] = useState('');

  // 小说结构参数 - number state（用于提交）
  const [novelCreationMode, setNovelCreationMode] = useState<'inspiration' | 'opening' | 'full_story'>('inspiration');
  const [_targetChapterCount, setTargetChapterCount] = useState<number>(10);
  const [_targetWordsPerChapter, setTargetWordsPerChapter] = useState<number>(1500);
  const [_protagonistCount, setProtagonistCount] = useState<number>(2);
  const [_supportingCharacterCount, setSupportingCharacterCount] = useState<number>(3);

  // 小说结构参数 - 字符串草稿 state（用于输入框自由编辑）
  const [targetChapterCountInput, setTargetChapterCountInput] = useState<string>('10');
  const [targetWordsPerChapterInput, setTargetWordsPerChapterInput] = useState<string>('1500');
  const [protagonistCountInput, setProtagonistCountInput] = useState<string>('2');
  const [supportingCharacterCountInput, setSupportingCharacterCountInput] = useState<string>('3');

  // 章节队列状态
  const [batchChapterCount, setBatchChapterCount] = useState<number>(3);

  // 快速生成结果
  const [fastResult, setFastResult] = useState<string>('');
  const [fastLoading, setFastLoading] = useState(false);
  const [fastError, setFastError] = useState<string | null>(null);

  // 可编辑区块展开状态
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'characters']));

  // 章节工作台状态
  const [selectedChapterNo, setSelectedChapterNo] = useState<number | null>(null);
  const [workbenchInput, setWorkbenchInput] = useState(''); // 统一输入框

  // 获取实际使用的模型ID（优先使用创作台默认模型，否则使用全局模型）
  const effectiveModelId = selectedWritingModelId || chatModelId;

  // 小说动作状态（独立 loading）
  const [activeNovelAction, setActiveNovelAction] = useState<string | null>(null);
  const [novelActionProgress, setNovelActionProgress] = useState<string | null>(null);

  // 新增角色输入（章节工作台内）
  const [newCharacterInput, setNewCharacterInput] = useState('');

  // 计算最新已生成章节号
  const latestGeneratedChapterNo = novelChapters.length > 0
    ? Math.max(...novelChapters.map(c => c.chapterNo))
    : 0;

  // 自动设置默认选中章节
  React.useEffect(() => {
    if (novelProject && novelProject.chapters && novelProject.chapters.length > 0) {
      if (selectedChapterNo === null) {
        // 默认选中最新已生成章节，如果没有则选中第1章
        const defaultNo = latestGeneratedChapterNo > 0 ? latestGeneratedChapterNo : 1;
        setSelectedChapterNo(defaultNo);
      }
    }
  }, [novelProject, latestGeneratedChapterNo, selectedChapterNo]);

  // 校验小说参数（返回校验结果或错误信息）
  const validateNovelSettings = (): { valid: boolean; settings?: { protagonistCount: number; supportingCharacterCount: number; targetChapterCount: number; targetWordsPerChapter: number }; error?: string } => {
    const protagonistRaw = protagonistCountInput.trim();
    const supportingRaw = supportingCharacterCountInput.trim();
    const chapterRaw = targetChapterCountInput.trim();
    const wordsRaw = targetWordsPerChapterInput.trim();

    // 主角数量校验
    const protagonistParsed = parseInt(protagonistRaw, 10);
    if (!protagonistRaw || !Number.isFinite(protagonistParsed) || protagonistParsed < 1) {
      return { valid: false, error: language === 'zh' ? '主角数量至少为 1' : 'Protagonist count must be at least 1' };
    }

    // 配角数量校验
    const supportingParsed = parseInt(supportingRaw, 10);
    if (!supportingRaw || !Number.isFinite(supportingParsed) || supportingParsed < 0) {
      return { valid: false, error: language === 'zh' ? '配角数量不能为负数' : 'Supporting count cannot be negative' };
    }

    // 章节数量校验
    const chapterParsed = parseInt(chapterRaw, 10);
    if (!chapterRaw || !Number.isFinite(chapterParsed) || chapterParsed < 1) {
      return { valid: false, error: language === 'zh' ? '章节数量至少为 1' : 'Chapter count must be at least 1' };
    }
    if (chapterParsed > 30) {
      // 软提示，不阻止提交
      console.warn('[NovelSettings] Chapter count exceeds 30, user input:', chapterParsed);
    }

    // 每章字数校验
    const wordsParsed = parseInt(wordsRaw, 10);
    if (!wordsRaw || !Number.isFinite(wordsParsed) || wordsParsed < 1000) {
      return { valid: false, error: language === 'zh' ? '每章目标字数建议填写 1000-10000' : 'Target words per chapter should be 1000-10000' };
    }
    if (wordsParsed > 10000) {
      // 软提示，不阻止提交
      console.warn('[NovelSettings] Words per chapter exceeds 10000, user input:', wordsParsed);
    }

    // 更新 number state（但不改写输入框）
    setProtagonistCount(protagonistParsed);
    setSupportingCharacterCount(supportingParsed);
    setTargetChapterCount(chapterParsed);
    setTargetWordsPerChapter(wordsParsed);

    return {
      valid: true,
      settings: {
        protagonistCount: protagonistParsed,
        supportingCharacterCount: supportingParsed,
        targetChapterCount: chapterParsed,
        targetWordsPerChapter: wordsParsed,
      },
    };
  };

  // 构建完整小说稿文本（动态拼接最新章节正文）
  const buildFullNovelManuscript = (): string | null => {
    if (!novelProject) return null;
    if (novelChapters.length === 0) return null;

    const sortedChapters = [...novelChapters].sort((a, b) => a.chapterNo - b.chapterNo);

    const title = novelProject.title || (language === 'zh' ? '未命名小说' : 'Untitled Novel');
    const logline = novelProject.logline || '';

    const lines: string[] = [];

    // 标题
    lines.push(`《${title}》`);
    lines.push('');

    // 简介
    if (logline) {
      lines.push(language === 'zh' ? '简介：' : 'Summary:');
      lines.push(logline);
      lines.push('');
    }

    // 目录
    lines.push(language === 'zh' ? '目录：' : 'Contents:');
    sortedChapters.forEach(ch => {
      lines.push(`第 ${ch.chapterNo} 章 ${ch.title || ''}`);
    });
    lines.push('');

    // 正文
    lines.push(language === 'zh' ? '正文：' : 'Content:');
    lines.push('');

    sortedChapters.forEach(ch => {
      lines.push('');
      lines.push(`第 ${ch.chapterNo} 章 ${ch.title || ''}`);
      lines.push('');
      if (ch.content) {
        lines.push(ch.content);
      }
    });

    return lines.join('\n');
  };

  // 判断第一章是否生成失败
  const isFirstChapterFailed =
    creationMode === 'novel' &&
    !!novelProject &&
    !novelChapterResult?.content?.trim() &&
    novelGenerationStep === 'error';

  // 构建统一的用户后续剧情要求文本
  const buildNovelUserDirectionText = () => {
    const parts: string[] = [];

    if (nextChapterIdea.trim()) {
      parts.push(
        language === 'zh'
          ? `【你后面想看什么】\n${nextChapterIdea.trim()}`
          : `[What you want to see next]\n${nextChapterIdea.trim()}`
      );
    }

    if (novelNewCharacterNote.trim()) {
      parts.push(
        language === 'zh'
          ? `【角色添加】\n${novelNewCharacterNote.trim()}`
          : `[Add Character]\n${novelNewCharacterNote.trim()}`
      );
    }

    if (novelNewPlotNote.trim()) {
      parts.push(
        language === 'zh'
          ? `【新剧情加入】\n${novelNewPlotNote.trim()}`
          : `[Add New Plot]\n${novelNewPlotNote.trim()}`
      );
    }

    return parts.join('\n\n');
  };

  // 清理小说后续章节相关状态（队列、续写等）
  const clearNovelContinuationState = () => {
    setNextChapterIdea('');
    setNovelNewCharacterNote('');
    setNovelNewPlotNote('');
  };

  // 清理所有小说相关状态（设定、章节、队列等）
  const clearAllNovelState = () => {
    setNovelProject(null);
    setNovelChapterResult(null);
    setNovelChapters([]);
    setNovelError('');
    setNovelGenerationStep('idle');
    setFastError('');
    setShowFullNovelReader(false);
    setFullNovelCopied(false);
    setFullNovelCopyError('');
    setCurrentChapterCopied(false);
    setCurrentChapterCopyError('');
    clearNovelContinuationState();
  };

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

  // 快速生成 - 一次 API 完成创作（非小说模式）
  // 小说模式使用两步生成：handleGenerateNovelProject
  const handleFastGenerate = async () => {
    // 小说模式优先交给专门函数处理（内部有错误提示）
    if (creationMode === 'novel') {
      await handleGenerateNovelProject();
      return;
    }

    if (!outlineText.trim() || !apiKey) return;

    setFastLoading(true);
    setFastError(null);
    setFastResult('');

    try {
      const prompt = buildCreationPrompt(creationMode, outlineText);

      // 校验 prompt 不为空
      if (!prompt || !prompt.trim()) {
        throw new Error(language === 'zh' ? '生成失败：Prompt 为空' : 'Generation failed: Prompt is empty');
      }

      // 日志输出，便于调试
      console.log('[FastGenerate]', {
        source: 'handleFastGenerate',
        creationMode,
        effectiveModelId,
        promptLength: prompt.length,
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
        errorMessage = error.message;
      } else if (error.response) {
        errorMessage = `API 错误: ${error.response.status || '未知'} ${error.response.statusText || ''}`;
      }
      setFastError(errorMessage);
    } finally {
      setFastLoading(false);
    }
  };

  // 小说生成：只生成设定，不自动生成第一章
  const handleGenerateNovelProject = async () => {
    // 校验前置条件，不要 silent return
    if (!outlineText.trim()) {
      setNovelError(language === 'zh' ? '请输入小说需求' : 'Please enter novel requirement');
      return;
    }
    if (!apiKey) {
      setNovelError(language === 'zh' ? '请先配置 API Key' : 'Please configure API Key first');
      return;
    }

    // 校验 effectiveModelId 存在
    if (!effectiveModelId) {
      setNovelGenerationStep('error');
      setNovelError(language === 'zh' ? '请先选择生成模型' : 'Please select a model first');
      return;
    }

    // 校验小说参数
    const validation = validateNovelSettings();
    if (!validation.valid || !validation.settings) {
      setNovelError(validation.error || '参数校验失败');
      return;
    }

    // 设置动作状态
    setActiveNovelAction('generatingProject');
    setNovelActionProgress(language === 'zh' ? '正在生成小说企划...' : 'Generating novel project...');

    // 清空旧错误和旧结果（重新生成整本小说时清空所有）
    setNovelError('');
    setFastError('');
    setFastLoading(true);

    // 清空旧小说残留（使用统一清理函数）
    clearAllNovelState();

    // 生成小说设定
    setNovelGenerationStep('planning');

    try {
      const projectPrompt = buildNovelProjectPrompt({
        requirement: outlineText,
        creationMode: novelCreationMode,
        targetChapterCount: validation.settings.targetChapterCount,
        targetWordsPerChapter: validation.settings.targetWordsPerChapter,
        protagonistCount: validation.settings.protagonistCount,
        supportingCharacterCount: validation.settings.supportingCharacterCount,
      });

      console.log('[NovelGenerateStep]', {
        step: 'planning',
        effectiveModelId,
        selectedWritingModelId,
        promptLength: projectPrompt.length,
        creationMode: novelCreationMode,
        targetChapterCount: validation.settings.targetChapterCount,
        protagonistCount: validation.settings.protagonistCount,
        supportingCharacterCount: validation.settings.supportingCharacterCount,
      });

      const rawProjectText = await callChatCompletionRaw(projectPrompt, {
        modelId: effectiveModelId,
      });

      // 解析 NovelProject
      const parsedProject = parseJsonFromModelText<NovelProject>(rawProjectText);

      if (!parsedProject) {
        // 解析失败，显示用户友好错误
        setNovelGenerationStep('error');
        setNovelError(language === 'zh'
          ? '小说设定解析失败，请稍后重试，或简化故事描述后再试。'
          : 'Failed to parse novel plan. Please try again or simplify your story description.');
        setNovelProject(null);
        setFastLoading(false);
        setActiveNovelAction(null);
        setNovelActionProgress(null);
        return;
      }

      // 规范化小说企划，确保章节数量和角色数量符合预期
      const project = normalizeNovelProject(parsedProject, validation.settings.targetChapterCount, validation.settings.protagonistCount, validation.settings.supportingCharacterCount);

      // 解析成功，只保存设定，不自动生成第一章
      setNovelProject(project);
      setNovelGenerationStep('project-ready');

      console.log('[NovelGenerateStep]', {
        step: 'project-ready',
        title: project.title,
        genre: project.genre,
        chaptersCount: project.chapters?.length || 0,
        charactersCount: project.characters?.length || 0,
      });

    } catch (error: any) {
      console.error('[NovelProjectError]', error);
      setNovelGenerationStep('error');
      const errorMessage = error.message || (language === 'zh' ? '小说设定生成失败' : 'Novel project generation failed');
      if (error.message?.includes('API 错误:')) {
        setNovelError(error.message);
      } else if (error.response) {
        setNovelError(`API 错误: ${error.response.status || '未知'} ${error.response.statusText || ''}`);
      } else {
        setNovelError(errorMessage);
      }
    } finally {
      setFastLoading(false);
    }
  };

  // 确认设定并生成第一章
  const handleGenerateFirstChapterFromProject = async () => {
    // 校验前置条件，不要 silent return
    if (!novelProject) {
      setNovelError(language === 'zh' ? '请先生成小说设定' : 'Please generate novel setup first');
      return;
    }
    if (!apiKey) {
      setNovelError(language === 'zh' ? '请先配置 API Key' : 'Please configure API Key first');
      return;
    }

    if (!effectiveModelId) {
      setNovelError(language === 'zh' ? '请先选择生成模型' : 'Please select a model first');
      return;
    }

    // 校验并同步小说参数
    const validation = validateNovelSettings();
    if (!validation.valid || !validation.settings) {
      setNovelError(validation.error || (language === 'zh' ? '参数校验失败' : 'Validation failed'));
      return;
    }
    const validatedSettings = validation.settings;

    setNovelError('');
    setActiveNovelAction('generatingFirst');
    setNovelActionProgress(language === 'zh' ? '正在生成第一章...' : 'Generating first chapter...');
    setNovelGenerationStep('chapter');
    setCurrentChapterCopied(false);
    setCurrentChapterCopyError('');

    try {
      const chapterPrompt = buildNovelFirstChapterPlainPrompt({
        requirement: outlineText,
        novelProject: novelProject,
        chapterPlan: novelProject.chapters?.[0],
        targetWordsPerChapter: validatedSettings.targetWordsPerChapter,
      });

      console.log('[NovelGenerateStep]', {
        step: 'confirm-and-generate-first-chapter',
        effectiveModelId,
        selectedWritingModelId,
        promptLength: chapterPrompt.length,
        projectTitle: novelProject.title,
        chapterTitle: novelProject.chapters?.[0]?.title,
        targetWordsPerChapter: validatedSettings.targetWordsPerChapter,
      });

      const chapterText = await callChatCompletionRaw(chapterPrompt, {
        modelId: effectiveModelId,
      });

      console.log('[NovelGenerateStep]', {
        step: 'chapter-received',
        contentLength: chapterText?.length || 0,
      });

      if (!chapterText || !chapterText.trim()) {
        throw new Error(language === 'zh' ? '模型返回为空' : 'Model returned empty content');
      }

      const firstChapter: NovelChapterDraft = {
        chapterNo: 1,
        title: novelProject.chapters?.[0]?.title || (language === 'zh' ? '第一章' : 'Chapter 1'),
        content: chapterText.trim(),
        summary: '',
        characterChanges: '',
        clues: '',
        nextChapterHint: '',
      };

      setNovelChapterResult(firstChapter);
      setNovelChapters([firstChapter]);
      setNovelGenerationStep('done');
      setCurrentChapterCopied(false);
      setCurrentChapterCopyError('');

      console.log('[NovelGenerateStep]', {
        step: 'chapter-done',
        chapterNo: firstChapter.chapterNo,
        title: firstChapter.title,
        contentLength: firstChapter.content.length,
      });

    } catch (error: any) {
      console.error('[NovelFirstChapterError]', error);
      setNovelGenerationStep('error');
      const errorMessage = error.message || (language === 'zh' ? '第一章生成失败' : 'First chapter generation failed');
      if (error.message?.includes('API 错误:')) {
        setNovelError(error.message);
      } else if (error.response) {
        setNovelError(`API 错误: ${error.response.status || '未知'} ${error.response.statusText || ''}`);
      } else {
        setNovelError(errorMessage);
      }
      // 第一章失败时，保留 novelProject，用户可以修改设定后重试
    } finally {
      setActiveNovelAction(null);
      setNovelActionProgress(null);
      setFastLoading(false);
    }
  };

  // 整合进后续规划
  const handleIntegrateFuturePlan = async () => {
    if (!novelProject) {
      setNovelError(language === 'zh' ? '请先生成小说设定' : 'Please generate novel setup first');
      return;
    }
    if (!workbenchInput.trim()) {
      setNovelError(language === 'zh' ? '请输入要整合的内容' : 'Please enter content to integrate');
      return;
    }
    if (!apiKey) {
      setNovelError(language === 'zh' ? '请先配置 API Key' : 'Please configure API Key first');
      return;
    }
    if (!effectiveModelId) {
      setNovelError(language === 'zh' ? '请先选择生成模型' : 'Please select a model first');
      return;
    }

    // 校验并同步小说参数
    const validation = validateNovelSettings();
    if (!validation.valid || !validation.settings) {
      setNovelError(validation.error || (language === 'zh' ? '参数校验失败' : 'Validation failed'));
      return;
    }

    setActiveNovelAction('integrating');
    setNovelActionProgress(language === 'zh' ? '正在整合进后续规划...' : 'Integrating into future plan...');
    setFastError(null);

    // 计算已生成到第几章
    const lastGeneratedNo = novelChapters.length > 0
      ? Math.max(...novelChapters.map(c => c.chapterNo))
      : 0;

    try {
      const prompt = buildNovelIntegrateFuturePlanPrompt({
        novelProject,
        generatedChapters: novelChapters,
        newUserInput: workbenchInput,
        fromChapterNo: lastGeneratedNo,
      });

      console.log('[NovelModelCall]', {
        source: 'handleIntegrateFuturePlan',
        effectiveModelId,
        lastGeneratedNo,
        promptLength: prompt.length,
      });

      const result = await callChatCompletionRaw(prompt, {
        modelId: effectiveModelId,
      });

      const parsed = parseIntegratePlanResult(result);
      if (parsed && parsed.chapters.length > 0) {
        // 更新未生成章节的规划
        const updatedChapters = novelProject.chapters.map(ch => {
          const updated = parsed.chapters.find(c => c.chapterNo === ch.chapterNo);
          return updated || ch;
        });

        // 如果有新核心人物，添加到 characters
        let updatedCharacters = [...novelProject.characters];
        if (parsed.newCharacters.length > 0) {
          const newChars = parsed.newCharacters.map((c, i) => ({
            id: `char_${novelProject.characters.length + i + 1}`,
            name: c.name,
            role: c.role,
            identity: c.identity,
            personality: c.personality,
            desire: '',
            weakness: '',
            relationship: '',
            arc: '',
            locked: false,
          }));
          updatedCharacters = [...updatedCharacters, ...newChars];
        }

        setNovelProject({
          ...novelProject,
          chapters: updatedChapters,
          characters: updatedCharacters,
        });

        setWorkbenchInput('');
        setFastError(null);
      } else {
        setFastError(language === 'zh' ? '解析规划失败' : 'Failed to parse plan');
      }
    } catch (error: any) {
      console.error('[NovelModelError]', error);
      setFastError(error.message || '整合失败');
    } finally {
      setActiveNovelAction(null);
      setNovelActionProgress(null);
      setFastLoading(false);
    }
  };

  // 重新生成本章
  const handleRegenerateChapter = async () => {
    if (!novelProject) {
      setNovelError(language === 'zh' ? '请先生成小说设定' : 'Please generate novel setup first');
      return;
    }
    if (!apiKey) {
      setNovelError(language === 'zh' ? '请先配置 API Key' : 'Please configure API Key first');
      return;
    }
    if (!effectiveModelId) {
      setNovelError(language === 'zh' ? '请先选择生成模型' : 'Please select a model first');
      return;
    }

    // 确定要重新生成的章节
    const targetNo = selectedChapterNo || novelChapters.length;
    if (!targetNo || targetNo < 1) {
      setNovelError(language === 'zh' ? '请选择要重新生成的章节' : 'Please select a chapter to regenerate');
      return;
    }

    // 校验并同步小说参数
    const validation = validateNovelSettings();
    if (!validation.valid || !validation.settings) {
      setNovelError(validation.error || (language === 'zh' ? '参数校验失败' : 'Validation failed'));
      return;
    }
    const validatedSettings = validation.settings;

    setActiveNovelAction('regenerating');
    setNovelActionProgress(language === 'zh' ? `正在重新生成第 ${targetNo} 章...` : `Regenerating chapter ${targetNo}...`);
    setFastError(null);

    try {
      const prompt = buildNovelRegenerateChapterPrompt({
        novelProject,
        chapterNo: targetNo,
        previousChapters: novelChapters.filter(c => c.chapterNo < targetNo),
        originalContent: novelChapters.find(c => c.chapterNo === targetNo)?.content,
        userRequest: workbenchInput || (language === 'zh' ? '重新生成' : 'Regenerate'),
        targetWordsPerChapter: validatedSettings.targetWordsPerChapter,
      });

      console.log('[NovelModelCall]', {
        source: 'handleRegenerateChapter',
        effectiveModelId,
        targetNo,
        promptLength: prompt.length,
        targetWordsPerChapter: validatedSettings.targetWordsPerChapter,
      });

      const result = await callChatCompletionRaw(prompt, {
        modelId: effectiveModelId,
      });

      if (result && result.trim()) {
        const existingChapter = novelChapters.find(c => c.chapterNo === targetNo);
        const regenerated: NovelChapterDraft = {
          chapterNo: targetNo,
          title: existingChapter?.title || novelProject.chapters.find(c => c.chapterNo === targetNo)?.title || `第${targetNo}章`,
          content: result.trim(),
          summary: existingChapter?.summary || '',
          characterChanges: '',
          clues: '',
          nextChapterHint: '',
        };

        // 替换对应章节
        setNovelChapters(prev => {
          const updated = prev.filter(c => c.chapterNo !== targetNo);
          return [...updated, regenerated].sort((a, b) => a.chapterNo - b.chapterNo);
        });

        setNovelChapterResult(regenerated);
        setWorkbenchInput('');
        setCurrentChapterCopied(false);
        setCurrentChapterCopyError('');
      } else {
        setFastError(language === 'zh' ? '生成内容为空' : 'Generated content is empty');
      }
    } catch (error: any) {
      console.error('[NovelModelError]', error);
      setFastError(error.message || '重新生成失败');
    } finally {
      setActiveNovelAction(null);
      setNovelActionProgress(null);
      setFastLoading(false);
    }
  };

  // 智能续写下一章
  const handleContinueNextChapter = async () => {
    if (!novelProject) {
      setNovelError(language === 'zh' ? '请先生成小说设定' : 'Please generate novel setup first');
      return;
    }
    if (!novelChapterResult?.content?.trim()) {
      setNovelError(language === 'zh' ? '请先生成第一章，再继续生成后续章节' : 'Please generate first chapter first');
      return;
    }
    if (!apiKey) {
      setNovelError(language === 'zh' ? '请先配置 API Key' : 'Please configure API Key first');
      return;
    }
    if (!effectiveModelId) {
      setNovelError(language === 'zh' ? '请先选择生成模型' : 'Please select a model first');
      return;
    }

    // 校验并同步小说参数
    const validation = validateNovelSettings();
    if (!validation.valid || !validation.settings) {
      setNovelError(validation.error || (language === 'zh' ? '参数校验失败' : 'Validation failed'));
      return;
    }
    const validatedSettings = validation.settings;

    setActiveNovelAction('generatingNext');
    setNovelActionProgress(language === 'zh' ? '正在生成下一章...' : 'Generating next chapter...');
    setFastError(null);

    const userDirection = buildNovelUserDirectionText();

    try {
      const prompt = buildNovelContinueChapterPrompt({
        novelProject,
        chapters: novelChapters,
        nextChapterIdea,
        nextChapterOutline: undefined,
        userDirection,
        targetWordsPerChapter: validatedSettings.targetWordsPerChapter,
      });

      console.log('[NovelModelCall]', {
        source: 'handleContinueNextChapter',
        effectiveModelId,
        chapterCount: novelChapters.length,
        promptLength: prompt.length,
        hasUserDirection: !!userDirection.trim(),
        userDirectionLength: userDirection.length,
        targetWordsPerChapter: validatedSettings.targetWordsPerChapter,
      });

      const result = await callChatCompletionRaw(prompt, {
        modelId: effectiveModelId,
      });

      const parsed = parseNovelChapterDraft(result);
      if (parsed) {
        setNovelChapterResult(parsed);
        setNovelChapters(prev => [...prev, parsed]);
        setNextChapterIdea('');
        setCurrentChapterCopied(false);
        setCurrentChapterCopyError('');
      } else {
        setFastError(language === 'zh' ? '解析章节失败' : 'Failed to parse chapter');
      }
    } catch (error: any) {
      console.error('[NovelModelError]', error);
      setFastError(error.message || '续写失败');
    } finally {
      setActiveNovelAction(null);
      setNovelActionProgress(null);
      setFastLoading(false);
    }
  };

  // 简化版批量生成：直接按当前规划生成多章，不使用队列 UI
  const handleRunBatchGenerate = async () => {
    if (!novelProject) {
      setNovelError(language === 'zh' ? '请先生成小说设定' : 'Please generate novel setup first');
      return;
    }
    if (novelChapters.length === 0) {
      setNovelError(language === 'zh' ? '请先生成第一章' : 'Please generate first chapter first');
      return;
    }
    if (!apiKey) {
      setNovelError(language === 'zh' ? '请先配置 API Key' : 'Please configure API Key first');
      return;
    }
    if (!effectiveModelId) {
      setNovelError(language === 'zh' ? '请先选择生成模型' : 'Please select a model first');
      return;
    }

    // 校验并同步小说参数
    const validation = validateNovelSettings();
    if (!validation.valid || !validation.settings) {
      setNovelError(validation.error || (language === 'zh' ? '参数校验失败' : 'Validation failed'));
      return;
    }
    const validatedSettings = validation.settings;

    setActiveNovelAction('batchGenerating');
    setFastError(null);

    const lastChapterNo = Math.max(...novelChapters.map(c => c.chapterNo));
    const count = Math.min(batchChapterCount, novelProject.chapters.length - lastChapterNo);

    if (count <= 0) {
      setFastError(language === 'zh' ? '所有章节已生成完毕' : 'All chapters have been generated');
      setActiveNovelAction(null);
      setNovelActionProgress(null);
      return;
    }

    // 使用工作副本避免 React state 闭包问题
    let workingChapters = [...novelChapters];
    const userDirection = buildNovelUserDirectionText();

    try {
      for (let i = 0; i < count; i++) {
        const chapterNo = lastChapterNo + i + 1;
        const plan = novelProject.chapters.find(c => c.chapterNo === chapterNo);

        // 更新进度显示
        setNovelActionProgress(language === 'zh' ? `正在生成第 ${chapterNo} 章... (${i + 1}/${count})` : `Generating chapter ${chapterNo}... (${i + 1}/${count})`);

        const prompt = buildNovelContinueChapterPrompt({
          novelProject,
          chapters: workingChapters,
          nextChapterIdea: workbenchInput || '',
          nextChapterOutline: plan ? `章节标题：${plan.title}\n本章目标：${plan.goal}\n主要事件：${plan.mainEvent}\n冲突点：${plan.conflict}\n结尾钩子：${plan.hook}` : '',
          userDirection,
          targetWordsPerChapter: validatedSettings.targetWordsPerChapter,
        });

        console.log('[BatchGenerate]', { chapterNo, step: i + 1, total: count, targetWordsPerChapter: validatedSettings.targetWordsPerChapter });

        const result = await callChatCompletionRaw(prompt, { modelId: effectiveModelId });
        const parsed = parseNovelChapterDraft(result);

        if (parsed) {
          workingChapters = [...workingChapters, parsed];
          setNovelChapters(prev => [...prev, parsed]);
          setNovelChapterResult(parsed);
        } else {
          console.warn('[BatchGenerate] Failed to parse chapter', chapterNo);
        }
      }

      setWorkbenchInput('');
    } catch (error: any) {
      console.error('[BatchGenerate] Error', error);
      setFastError(error.message || '批量生成失败');
    } finally {
      setActiveNovelAction(null);
      setNovelActionProgress(null);
      setFastLoading(false);
    }
  };

  // 更新小说企划字段
  const updateNovelProjectField = (path: string, value: string) => {
    if (!novelProject) return;
    const keys = path.split('.');
    setNovelProject(prev => {
      if (!prev) return prev;
      const newObj = { ...prev };
      let current: any = newObj;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newObj;
    });
  };

  // 更新角色
  const updateNovelCharacter = (id: string, field: keyof NovelCharacter, value: string | boolean) => {
    if (!novelProject) return;
    setNovelProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        characters: prev.characters.map(c =>
          c.id === id ? { ...c, [field]: value } : c
        ),
      };
    });
  };

  // 添加角色
  const addNovelCharacter = () => {
    if (!novelProject) return;
    const newChar: NovelCharacter = {
      id: `char_${Date.now()}`,
      name: '',
      role: '配角',
      identity: '',
      personality: '',
      desire: '',
      weakness: '',
      relationship: '',
      arc: '',
      locked: false,
    };
    setNovelProject(prev => {
      if (!prev) return prev;
      return { ...prev, characters: [...prev.characters, newChar] };
    });
  };

  // 删除角色
  const removeNovelCharacter = (id: string) => {
    if (!novelProject) return;
    setNovelProject(prev => {
      if (!prev) return prev;
      return { ...prev, characters: prev.characters.filter(c => c.id !== id) };
    });
  };

  // 更新章节
  const updateNovelChapter = (id: string, field: keyof NovelChapterPlan, value: string | boolean | number) => {
    if (!novelProject) return;
    setNovelProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        chapters: prev.chapters.map(c =>
          c.id === id ? { ...c, [field]: value } : c
        ),
      };
    });
  };

  // 添加章节
  const addNovelChapter = () => {
    if (!novelProject) return;
    const newChapter: NovelChapterPlan = {
      id: `chap_${Date.now()}`,
      chapterNo: novelProject.chapters.length + 1,
      title: '',
      goal: '',
      mainEvent: '',
      conflict: '',
      hook: '',
      locked: false,
    };
    setNovelProject(prev => {
      if (!prev) return prev;
      return { ...prev, chapters: [...prev.chapters, newChapter] };
    });
  };

  // 删除章节
  const removeNovelChapter = (id: string) => {
    if (!novelProject) return;
    setNovelProject(prev => {
      if (!prev) return prev;
      const newChapters = prev.chapters.filter(c => c.id !== id);
      // 重新编号
      return {
        ...prev,
        chapters: newChapters.map((c, i) => ({ ...c, chapterNo: i + 1 })),
      };
    });
  };

  // 切换区块展开
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
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

            {/* 小说模式特殊说明 - 仅在小说模式下显示 */}
            {creationMode === 'novel' && (
              <div style={{ marginBottom: 12, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <BookOpen size={14} style={{ color: 'var(--accent)' }} />
                  {language === 'zh' ? '小说创作' : 'Novel Writing'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {language === 'zh'
                    ? '输入小说灵感、开头或完整故事梗概，AI 会自动生成人物设定、世界观、大纲和开篇。'
                    : 'Enter a novel idea, opening, or full story outline. AI will generate characters, world, outline and opening.'}
                </div>

                {/* 小说结构参数 */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  {/* 创作方式 */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {language === 'zh' ? '创作方式' : 'Creation Mode'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[
                        { value: 'inspiration', label: language === 'zh' ? '从灵感创作' : 'From idea' },
                        { value: 'opening', label: language === 'zh' ? '根据开头续写' : 'Continue opening' },
                        { value: 'full_story', label: language === 'zh' ? '完整故事扩写' : 'Expand story' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setNovelCreationMode(opt.value as any)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            background: novelCreationMode === opt.value ? 'var(--accent)' : 'var(--bg-secondary)',
                            border: novelCreationMode === opt.value ? '1px solid var(--accent)' : '1px solid var(--border)',
                            borderRadius: 6,
                            color: novelCreationMode === opt.value ? 'white' : 'var(--text-muted)',
                            fontSize: 10,
                            textAlign: 'center',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 数量参数 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {/* 章节数量 */}
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {language === 'zh' ? '章节数量' : 'Chapters'}
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={targetChapterCountInput}
                        onChange={(e) => {
                          setTargetChapterCountInput(e.target.value.replace(/[^\d]/g, ''));
                        }}
                        placeholder="建议 1-30"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                          fontSize: 12,
                        }}
                      />
                    </div>
                    {/* 每章目标字数 */}
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {language === 'zh' ? '每章目标字数' : 'Target words/chapter'}
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={targetWordsPerChapterInput}
                        onChange={(e) => {
                          setTargetWordsPerChapterInput(e.target.value.replace(/[^\d]/g, ''));
                        }}
                        placeholder="1000-10000"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                          fontSize: 12,
                        }}
                      />
                    </div>
                    {/* 主角数量 */}
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {language === 'zh' ? '主角数量' : 'Protagonists'}
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={protagonistCountInput}
                        onChange={(e) => {
                          setProtagonistCountInput(e.target.value.replace(/[^\d]/g, ''));
                        }}
                        placeholder="至少 1"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                          fontSize: 12,
                        }}
                      />
                    </div>
                    {/* 重要配角数量 */}
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {language === 'zh' ? '重要配角' : 'Supporting'}
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={supportingCharacterCountInput}
                        onChange={(e) => {
                          setSupportingCharacterCountInput(e.target.value.replace(/[^\d]/g, ''));
                        }}
                        placeholder="可为 0"
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                          fontSize: 12,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 非小说模式的生成模式选择 */}
            {creationMode !== 'novel' && (
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
            )}

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
              {generationMode === 'fast' || creationMode === 'novel' ? (
                <button
                  onClick={handleFastGenerate}
                  disabled={!outlineText.trim() || fastLoading}
                  className="btn-primary"
                  style={{ flex: 1, padding: 10 }}
                >
                  {fastLoading ? (
                    <>
                      <RefreshCw size={14} className="spin" />
                      {creationMode === 'novel'
                        ? (language === 'zh' ? '正在生成小说设定...' : 'Generating novel setup...')
                        : (language === 'zh' ? '生成中...' : 'Generating...')}
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      {creationMode === 'novel'
                        ? (language === 'zh' ? '生成小说设定' : 'Generate Novel Setup')
                        : (language === 'zh' ? '快速生成' : 'Fast Generate')}
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

        {/* 小说模式分步加载状态 */}
        {creationMode === 'novel' && fastLoading && novelGenerationStep !== 'done' && (
          <div style={{
            padding: 24,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--accent)',
            textAlign: 'center',
          }}>
            <RefreshCw size={32} className="spin" style={{ color: 'var(--accent)', marginBottom: 12 }} />
            <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 8 }}>
              {novelGenerationStep === 'planning' && (language === 'zh' ? '正在生成小说设定...' : 'Generating novel setup...')}
              {novelGenerationStep === 'chapter' && (language === 'zh' ? '正在生成第一章...' : 'Generating first chapter...')}
              {novelGenerationStep === 'error' && (language === 'zh' ? '生成失败' : 'Generation failed')}
              {novelGenerationStep === 'idle' && (language === 'zh' ? '准备生成...' : 'Preparing...')}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {novelGenerationStep === 'planning' && (language === 'zh' ? '预计 15-30 秒' : 'About 15-30 seconds')}
              {novelGenerationStep === 'chapter' && (language === 'zh' ? '预计 20-40 秒' : 'About 20-40 seconds')}
            </div>
          </div>
        )}

        {/* 小说生成错误状态 */}
        {creationMode === 'novel' && novelGenerationStep === 'error' && !fastLoading && (
          <div style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--danger)',
          }}>
            <div style={{ color: 'var(--danger)', fontWeight: 500, marginBottom: 12 }}>
              {language === 'zh' ? '小说生成失败' : 'Novel Generation Failed'}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
              {novelError}
            </div>
            <button
              onClick={() => {
                setNovelGenerationStep('idle');
                setNovelError('');
              }}
              style={{
                padding: '8px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                fontSize: 13,
              }}
            >
              {language === 'zh' ? '重新生成' : 'Regenerate'}
            </button>
          </div>
        )}

        {/* 小说企划结果 - 可编辑模块 */}
        {creationMode === 'novel' && novelProject && (
          <div style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--accent)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BookOpen size={16} style={{ color: 'var(--accent)' }} />
                {language === 'zh' ? '小说企划' : 'Novel Plan'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={clearAllNovelState}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12 }}
                >
                  {language === 'zh' ? '重新生成' : 'Regenerate'}
                </button>
              </div>
            </div>

            {/* 基础设定区块 */}
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => toggleSection('basic')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span>📝 {language === 'zh' ? '基础设定' : 'Basic Settings'}</span>
                {expandedSections.has('basic') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.has('basic') && (
                <div style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginTop: 4 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{language === 'zh' ? '小说名' : 'Title'}</label>
                      <input
                        type="text"
                        value={novelProject.title}
                        onChange={(e) => updateNovelProjectField('title', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          marginTop: 4,
                        }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{language === 'zh' ? '题材' : 'Genre'}</label>
                        <input
                          type="text"
                          value={novelProject.genre}
                          onChange={(e) => updateNovelProjectField('genre', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            color: 'var(--text-primary)',
                            fontSize: 13,
                            marginTop: 4,
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{language === 'zh' ? '风格' : 'Style'}</label>
                        <input
                          type="text"
                          value={novelProject.style}
                          onChange={(e) => updateNovelProjectField('style', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            color: 'var(--text-primary)',
                            fontSize: 13,
                            marginTop: 4,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{language === 'zh' ? '一句话简介' : 'Logline'}</label>
                      <textarea
                        value={novelProject.logline}
                        onChange={(e) => updateNovelProjectField('logline', e.target.value)}
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          marginTop: 4,
                          resize: 'vertical',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{language === 'zh' ? '核心卖点' : 'Selling Points'}</label>
                      <textarea
                        value={novelProject.sellingPoints}
                        onChange={(e) => updateNovelProjectField('sellingPoints', e.target.value)}
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-primary)',
                          fontSize: 13,
                          marginTop: 4,
                          resize: 'vertical',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 角色设定区块 */}
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => toggleSection('characters')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span>👥 {language === 'zh' ? '角色设定' : 'Characters'} ({novelProject.characters.length})</span>
                {expandedSections.has('characters') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.has('characters') && (
                <div style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginTop: 4 }}>
                  {novelProject.characters.map((char, index) => (
                    <div key={char.id} style={{ marginBottom: 12, padding: 12, background: 'var(--bg-primary)', borderRadius: 8, border: char.locked ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 500, fontSize: 12 }}>{language === 'zh' ? `角色 ${index + 1}` : `Character ${index + 1}`}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => updateNovelCharacter(char.id, 'locked', !char.locked)}
                            style={{ padding: 4, background: 'transparent', border: 'none', color: char.locked ? 'var(--accent)' : 'var(--text-muted)' }}
                            title={char.locked ? (language === 'zh' ? '已锁定' : 'Locked') : (language === 'zh' ? '锁定' : 'Lock')}
                          >
                            {char.locked ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>
                          <button
                            onClick={() => removeNovelCharacter(char.id)}
                            style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--danger)' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <input
                            type="text"
                            value={char.name}
                            onChange={(e) => updateNovelCharacter(char.id, 'name', e.target.value)}
                            placeholder={language === 'zh' ? '姓名' : 'Name'}
                            style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}
                          />
                          <select
                            value={char.role}
                            onChange={(e) => updateNovelCharacter(char.id, 'role', e.target.value)}
                            style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}
                          >
                            <option value="主角">{language === 'zh' ? '主角' : 'Protagonist'}</option>
                            <option value="配角">{language === 'zh' ? '配角' : 'Supporting'}</option>
                            <option value="反派">{language === 'zh' ? '反派' : 'Antagonist'}</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={char.identity}
                          onChange={(e) => updateNovelCharacter(char.id, 'identity', e.target.value)}
                          placeholder={language === 'zh' ? '身份/职业' : 'Identity'}
                          style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}
                        />
                        <input
                          type="text"
                          value={char.personality}
                          onChange={(e) => updateNovelCharacter(char.id, 'personality', e.target.value)}
                          placeholder={language === 'zh' ? '性格' : 'Personality'}
                          style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}
                        />
                        <input
                          type="text"
                          value={char.desire}
                          onChange={(e) => updateNovelCharacter(char.id, 'desire', e.target.value)}
                          placeholder={language === 'zh' ? '核心欲望' : 'Desire'}
                          style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}
                        />
                        <input
                          type="text"
                          value={char.weakness}
                          onChange={(e) => updateNovelCharacter(char.id, 'weakness', e.target.value)}
                          placeholder={language === 'zh' ? '性格弱点' : 'Weakness'}
                          style={{ padding: '6px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addNovelCharacter}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'var(--bg-primary)',
                      border: '1px dashed var(--border)',
                      borderRadius: 6,
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Plus size={14} /> {language === 'zh' ? '添加角色' : 'Add Character'}
                  </button>
                </div>
              )}
            </div>

            {/* 世界观区块 */}
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => toggleSection('world')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span>🌍 {language === 'zh' ? '世界观/背景' : 'World'}</span>
                {expandedSections.has('world') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.has('world') && (
                <div style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginTop: 4 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{language === 'zh' ? '故事背景' : 'Background'}</label>
                      <textarea
                        value={novelProject.world.background}
                        onChange={(e) => updateNovelProjectField('world.background', e.target.value)}
                        rows={2}
                        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, marginTop: 4, resize: 'vertical' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{language === 'zh' ? '关键场景' : 'Key Scenes'}</label>
                      <textarea
                        value={novelProject.world.keyScenes}
                        onChange={(e) => updateNovelProjectField('world.keyScenes', e.target.value)}
                        rows={2}
                        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, marginTop: 4, resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 故事大纲区块 */}
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => toggleSection('outline')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span>📖 {language === 'zh' ? '故事大纲' : 'Outline'}</span>
                {expandedSections.has('outline') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.has('outline') && (
                <div style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginTop: 4 }}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {['beginning', 'development', 'twist', 'climax', 'ending'].map((stage) => (
                      <div key={stage}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {stage === 'beginning' ? (language === 'zh' ? '开端' : 'Beginning') :
                           stage === 'development' ? (language === 'zh' ? '发展' : 'Development') :
                           stage === 'twist' ? (language === 'zh' ? '转折' : 'Twist') :
                           stage === 'climax' ? (language === 'zh' ? '高潮' : 'Climax') :
                           (language === 'zh' ? '结局' : 'Ending')}
                        </label>
                        <textarea
                          value={novelProject.outline[stage as keyof typeof novelProject.outline]}
                          onChange={(e) => updateNovelProjectField(`outline.${stage}`, e.target.value)}
                          rows={2}
                          style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, marginTop: 4, resize: 'vertical' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 章节规划区块 */}
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => toggleSection('chapters')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span>📚 {language === 'zh' ? '章节规划' : 'Chapters'} ({novelProject.chapters.length})</span>
                {expandedSections.has('chapters') ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedSections.has('chapters') && (
                <div style={{ padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8, marginTop: 4, maxHeight: 300, overflow: 'auto' }}>
                  {novelProject.chapters.map((chapter) => (
                    <div key={chapter.id} style={{ marginBottom: 8, padding: 8, background: 'var(--bg-primary)', borderRadius: 6, border: chapter.locked ? '1px solid var(--accent)' : '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontWeight: 500, fontSize: 11 }}>{language === 'zh' ? `第 ${chapter.chapterNo} 章` : `Chapter ${chapter.chapterNo}`}</span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => updateNovelChapter(chapter.id, 'locked', !chapter.locked)}
                            style={{ padding: 2, background: 'transparent', border: 'none', color: chapter.locked ? 'var(--accent)' : 'var(--text-muted)' }}
                          >
                            {chapter.locked ? <Lock size={12} /> : <Unlock size={12} />}
                          </button>
                          <button
                            onClick={() => removeNovelChapter(chapter.id)}
                            style={{ padding: 2, background: 'transparent', border: 'none', color: 'var(--danger)' }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={chapter.title}
                        onChange={(e) => updateNovelChapter(chapter.id, 'title', e.target.value)}
                        placeholder={language === 'zh' ? '章节标题' : 'Title'}
                        style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11, marginBottom: 4 }}
                      />
                      <input
                        type="text"
                        value={chapter.goal}
                        onChange={(e) => updateNovelChapter(chapter.id, 'goal', e.target.value)}
                        placeholder={language === 'zh' ? '本章目标' : 'Goal'}
                        style={{ width: '100%', padding: '4px 6px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 11 }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={addNovelChapter}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'var(--bg-primary)',
                      border: '1px dashed var(--border)',
                      borderRadius: 6,
                      color: 'var(--text-muted)',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Plus size={12} /> {language === 'zh' ? '添加章节' : 'Add Chapter'}
                  </button>
                </div>
              )}
            </div>

            {/* 下一步操作按钮 - 编辑完整设定 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowAdvancedNovelSettings(!showAdvancedNovelSettings)}
                style={{
                  flex: 1,
                  padding: 10,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--text-secondary)',
                  fontSize: 12,
                }}
              >
                {showAdvancedNovelSettings
                  ? (language === 'zh' ? '收起完整设定' : 'Hide Settings')
                  : (language === 'zh' ? '编辑完整设定' : 'Edit Full Settings')}
              </button>
            </div>

            {/* 确认设定并生成第一章按钮 - 仅在第一章未生成或失败时显示 */}
            {(!novelChapterResult || !novelChapterResult.content?.trim()) && !activeNovelAction && (
              <div style={{ marginTop: 12 }}>
                {isFirstChapterFailed && (
                  <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>
                    {language === 'zh'
                      ? '第一章生成失败，请修改设定后重试，或直接重新生成第一章。'
                      : 'Failed to generate Chapter 1. Please edit the setup and try again, or regenerate Chapter 1.'}
                  </div>
                )}
                <button
                  onClick={handleGenerateFirstChapterFromProject}
                  disabled={!!activeNovelAction}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 8,
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 500,
                    opacity: activeNovelAction ? 0.6 : 1,
                    cursor: activeNovelAction ? 'not-allowed' : 'pointer',
                  }}
                >
                  {activeNovelAction === 'generatingFirst'
                    ? (language === 'zh' ? '正在生成...' : 'Generating...')
                    : (isFirstChapterFailed
                      ? (language === 'zh' ? '重新生成第一章' : 'Regenerate First Chapter')
                      : (language === 'zh' ? '确认设定并生成第一章' : 'Confirm Setup and Generate Chapter 1'))}
                </button>
              </div>
            )}

          </div>
        )}

        {/* 小说章节正文结果 - 仅在有实际内容时显示 */}
        {creationMode === 'novel' && novelChapterResult && novelChapterResult.content?.trim() && (
          <div style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--accent)',
          }}>
            {/* 小说标题和章节标题 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {novelProject?.title || '小说'}
              </div>
              <div style={{ fontSize: 14, color: 'var(--accent)' }}>
                {language === 'zh' ? `第 ${novelChapterResult.chapterNo} 章` : `Chapter ${novelChapterResult.chapterNo}`}：{novelChapterResult.title}
              </div>
            </div>

            {/* 正文内容 */}
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 12,
              fontSize: 14,
              lineHeight: 1.9,
              maxHeight: 600,
              overflow: 'auto',
            }}>
              <ReactMarkdown>{novelChapterResult.content}</ReactMarkdown>
            </div>

            {/* 复制按钮 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={async () => {
                  try {
                    setCurrentChapterCopyError('');

                    if (!novelChapterResult) {
                      throw new Error(language === 'zh' ? '没有可复制的章节内容' : 'No chapter content to copy');
                    }

                    const currentChapterText = [
                      novelProject?.title ? `《${novelProject.title}》` : '',
                      '',
                      `第${novelChapterResult.chapterNo}章 ${novelChapterResult.title}`,
                      '',
                      novelChapterResult.content,
                    ].join('\n').trim();

                    if (!currentChapterText) {
                      throw new Error(language === 'zh' ? '没有可复制的章节内容' : 'No chapter content to copy');
                    }

                    await navigator.clipboard.writeText(currentChapterText);

                    setCurrentChapterCopied(true);
                    window.setTimeout(() => {
                      setCurrentChapterCopied(false);
                    }, 1500);
                  } catch (error) {
                    console.error('[CopyCurrentChapterError]', error);
                    setCurrentChapterCopyError(
                      language === 'zh'
                        ? '复制失败，请手动选择文本复制'
                        : 'Copy failed, please copy manually'
                    );
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: currentChapterCopied ? 'var(--accent)' : 'var(--accent)',
                  fontSize: 12,
                  fontWeight: currentChapterCopied ? 600 : 400,
                }}
              >
                {currentChapterCopied
                  ? (language === 'zh' ? '已复制' : 'Copied')
                  : (language === 'zh' ? '复制正文' : 'Copy Chapter')}
              </button>
            </div>

            {/* 复制失败提示 */}
            {currentChapterCopyError && (
              <div style={{
                fontSize: 12,
                color: 'var(--danger)',
                marginBottom: 8,
                textAlign: 'right',
              }}>
                {currentChapterCopyError}
              </div>
            )}

            {/* 章节工作台 - 始终显示在最新章节正文下面 */}
            {novelProject && novelProject.chapters && novelProject.chapters.length > 0 && (
              <div style={{
                marginTop: 16,
                padding: 16,
                background: 'var(--bg-tertiary)',
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}>
                {/* 工作台标题和进度 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    📋 {language === 'zh' ? '章节工作台' : 'Chapter Workbench'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--accent)' }}>
                    {language === 'zh'
                      ? `已生成 ${novelChapters.length} / ${novelProject.chapters.length} 章`
                      : `${novelChapters.length} / ${novelProject.chapters.length} chapters`}
                  </div>
                </div>

                {/* 说明文案 */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                  {language === 'zh'
                    ? '章节规划是故事路线图。新增人物或剧情请先整合进后续规划，再生成正文。已生成章节默认不会被修改。'
                    : 'Chapter outline is the story roadmap. Add new plots to the future outline before generating. Generated chapters will not be changed by default.'}
                </div>

                {/* 章节选择 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {language === 'zh' ? '当前操作章节' : 'Current Chapter'}
                  </div>
                  <select
                    value={selectedChapterNo || 1}
                    onChange={(e) => setSelectedChapterNo(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  >
                    {novelProject.chapters.map((ch) => {
                      const isGenerated = novelChapters.some(c => c.chapterNo === ch.chapterNo);
                      return (
                        <option key={ch.id || ch.chapterNo} value={ch.chapterNo}>
                          {language === 'zh' ? `第 ${ch.chapterNo} 章` : `Chapter ${ch.chapterNo}`}: {ch.title || ''}
                          {' '}{isGenerated ? (language === 'zh' ? '(已生成)' : '(Generated)') : (language === 'zh' ? '(待生成)' : '(Pending)')}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 选中章节规划预览 */}
                {(() => {
                  const selectedPlan = novelProject.chapters.find(c => c.chapterNo === selectedChapterNo);
                  const isSelectedGenerated = novelChapters.some(c => c.chapterNo === selectedChapterNo);
                  if (!selectedPlan) return null;
                  return (
                    <div style={{
                      padding: 10,
                      background: 'var(--bg-primary)',
                      borderRadius: 6,
                      marginBottom: 12,
                      borderLeft: '3px solid var(--accent)',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {language === 'zh' ? `选中章节规划：第 ${selectedChapterNo} 章《${selectedPlan.title}》` : `Selected: Ch.${selectedChapterNo} "${selectedPlan.title}"`}
                        <span style={{ marginLeft: 8, fontSize: 10, color: isSelectedGenerated ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {isSelectedGenerated ? (language === 'zh' ? '已生成' : 'Generated') : (language === 'zh' ? '待生成' : 'Pending')}
                        </span>
                      </div>
                      {selectedPlan.goal && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {language === 'zh' ? '目标' : 'Goal'}：{selectedPlan.goal}
                        </div>
                      )}
                      {selectedPlan.conflict && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {language === 'zh' ? '冲突' : 'Conflict'}：{selectedPlan.conflict}
                        </div>
                      )}
                      {selectedPlan.hook && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {language === 'zh' ? '钩子' : 'Hook'}：{selectedPlan.hook}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 修改较早章节时的连续性提示 */}
                {selectedChapterNo && latestGeneratedChapterNo > 0 && selectedChapterNo < latestGeneratedChapterNo && (
                  <div style={{
                    padding: 8,
                    background: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: 6,
                    marginBottom: 12,
                    fontSize: 10,
                    color: 'var(--accent-orange)',
                    lineHeight: 1.5,
                  }}>
                    {language === 'zh'
                      ? `⚠️ 你正在调整较早章节，可能影响后续连续性。重新生成只会替换选中章节，不会自动改写后续章节。如需同步后续剧情，请再点击「整合进后续规划」。`
                      : `⚠️ You are editing an earlier chapter. Regeneration only replaces the selected chapter, not subsequent ones. To sync future plots, click "Integrate" afterwards.`}
                  </div>
                )}

                {/* 统一输入框 */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {language === 'zh' ? '你的要求' : 'Your Request'}
                  </div>
                  <textarea
                    value={workbenchInput}
                    onChange={(e) => setWorkbenchInput(e.target.value)}
                    placeholder={language === 'zh'
                      ? '可以填写本章写作要求，也可以填写要加入后续的新人物/新剧情。例如：让反派出场、增加误会、加入一个神秘医生。'
                      : 'Chapter writing request, new character, or future plot. E.g., introduce the villain, add misunderstandings, add a mysterious doctor.'}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: 10,
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    {language === 'zh'
                      ? '如果只是想影响下一章，直接点击生成下一章；如果是新人物、新支线或长期剧情，请先点击整合进后续规划。'
                      : 'For one-time changes, click "Next Chapter"; for new characters or long-term plots, click "Integrate" first.'}
                  </div>
                </div>

                {/* 添加新角色（选填） */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    {language === 'zh' ? '添加新角色（选填）' : 'Add New Character (Optional)'}
                  </div>
                  <input
                    type="text"
                    value={newCharacterInput}
                    onChange={(e) => setNewCharacterInput(e.target.value)}
                    placeholder={language === 'zh'
                      ? '例如：神秘医生张三，性格阴郁，是主角失散多年的兄弟'
                      : 'E.g., Dr. Zhang, gloomy personality, protagonist\'s long-lost brother'}
                    style={{
                      width: '100%',
                      padding: 8,
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  />
                </div>

                {/* 进度显示区域 */}
                {novelActionProgress && (
                  <div style={{
                    padding: 10,
                    background: 'var(--bg-primary)',
                    borderRadius: 6,
                    marginBottom: 12,
                    borderLeft: '3px solid var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <RefreshCw size={14} className="spin" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{novelActionProgress}</span>
                  </div>
                )}

                {/* 四个主要操作按钮 */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <button
                    onClick={handleIntegrateFuturePlan}
                    disabled={!!activeNovelAction || !workbenchInput.trim()}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: workbenchInput.trim() ? 'var(--text-secondary)' : 'var(--text-muted)',
                      fontSize: 12,
                    }}
                  >
                    {activeNovelAction === 'integrating' && <RefreshCw size={12} className="spin" style={{ marginRight: 4 }} />}
                    {language === 'zh' ? '整合进后续规划' : 'Integrate'}
                  </button>
                  <button
                    onClick={handleContinueNextChapter}
                    disabled={!!activeNovelAction || !(novelChapters.length > 0 || novelProject)}
                    className="btn-primary"
                    style={{ padding: '8px 12px', fontSize: 12 }}
                  >
                    {activeNovelAction === 'generatingNext' ? <RefreshCw size={12} className="spin" /> : <Sparkles size={12} />}
                    {language === 'zh' ? '生成下一章' : 'Next Chapter'}
                  </button>
                  <button
                    onClick={handleRegenerateChapter}
                    disabled={!!activeNovelAction || !selectedChapterNo}
                    style={{
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      color: selectedChapterNo ? 'var(--text-secondary)' : 'var(--text-muted)',
                      fontSize: 12,
                    }}
                  >
                    {activeNovelAction === 'regenerating' && <RefreshCw size={12} className="spin" style={{ marginRight: 4 }} />}
                    {language === 'zh' ? '重新生成选中章节' : 'Regenerate Selected'}
                  </button>
                </div>

                {/* 批量生成 */}
                {novelChapters.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={batchChapterCount}
                      onChange={(e) => setBatchChapterCount(Number(e.target.value))}
                      style={{
                        padding: '6px 8px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        color: 'var(--text-primary)',
                        fontSize: 12,
                      }}
                    >
                      <option value={1}>1 {language === 'zh' ? '章' : 'chapter'}</option>
                      <option value={3}>3 {language === 'zh' ? '章' : 'chapters'}</option>
                      <option value={5}>5 {language === 'zh' ? '章' : 'chapters'}</option>
                    </select>
                    <button
                      onClick={handleRunBatchGenerate}
                      disabled={!!activeNovelAction}
                      style={{
                        padding: '6px 12px',
                        background: 'var(--accent)',
                        border: 'none',
                        borderRadius: 6,
                        color: 'white',
                        fontSize: 12,
                      }}
                    >
                      {activeNovelAction === 'batchGenerating' && <RefreshCw size={12} className="spin" style={{ marginRight: 4 }} />}
                      {language === 'zh' ? '按当前规划批量生成' : 'Batch Generate'}
                    </button>
                  </div>
                )}

                {/* 提示 */}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12 }}>
                  {language === 'zh'
                    ? '不满意当前章节？选择章节后填写修改要求，点击「重新生成选中章节」。'
                    : 'Not satisfied? Select a chapter, enter your requirements, and click "Regenerate Selected".'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 当前后续规划区域 */}
        {creationMode === 'novel' && novelProject && novelProject.chapters && novelProject.chapters.length > 0 && (
          <div style={{
            marginTop: 16,
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 8,
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
              📖 {language === 'zh' ? '当前后续规划' : 'Future Chapter Plan'}
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {novelProject.chapters.map((chapter, index) => {
                const isGenerated = novelChapters.some(c => c.chapterNo === chapter.chapterNo);
                return (
                  <div
                    key={chapter.id || index}
                    style={{
                      padding: 8,
                      marginBottom: 4,
                      background: isGenerated ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                      borderRadius: 4,
                      borderLeft: `3px solid ${isGenerated ? 'var(--accent)' : 'var(--border)'}`,
                      opacity: isGenerated ? 0.7 : 1,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {language === 'zh' ? `第 ${chapter.chapterNo} 章` : `Chapter ${chapter.chapterNo}`}: {chapter.title}
                      {isGenerated && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--accent)' }}>({language === 'zh' ? '已生成' : 'Generated'})</span>}
                    </div>
                    {chapter.goal && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {language === 'zh' ? '目标' : 'Goal'}: {chapter.goal}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 完整小说稿阅读区 - 仅在有正文内容时显示 */}
        {creationMode === 'novel' && novelChapters.some(c => c.content?.trim()) && (
          <div style={{
            padding: 16,
            background: 'var(--bg-secondary)',
            borderRadius: 12,
            border: '1px solid var(--accent)',
            marginTop: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <BookOpen size={16} style={{ color: 'var(--accent)' }} />
                {language === 'zh' ? '完整小说稿' : 'Full Novel'}
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={async () => {
                    try {
                      setFullNovelCopyError('');

                      const sortedChapters = [...novelChapters].sort((a, b) => a.chapterNo - b.chapterNo);
                      const fullText = [
                        novelProject?.title ? `《${novelProject.title}》` : '',
                        '',
                        ...sortedChapters.flatMap(chapter => [
                          `第${chapter.chapterNo}章 ${chapter.title}`,
                          '',
                          chapter.content,
                          '',
                        ]),
                      ].join('\n');

                      if (!fullText.trim()) {
                        throw new Error(language === 'zh' ? '没有可复制的小说内容' : 'No novel content to copy');
                      }

                      await navigator.clipboard.writeText(fullText);

                      setFullNovelCopied(true);
                      window.setTimeout(() => {
                        setFullNovelCopied(false);
                      }, 1500);
                    } catch (error) {
                      console.error('[CopyFullNovelError]', error);
                      setFullNovelCopyError(
                        language === 'zh'
                          ? '复制失败，请手动选择文本复制'
                          : 'Copy failed, please copy manually'
                      );
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: fullNovelCopied ? 'var(--accent)' : 'var(--accent)',
                    fontSize: 12,
                    fontWeight: fullNovelCopied ? 600 : 400,
                  }}
                >
                  {fullNovelCopied
                    ? (language === 'zh' ? '已复制' : 'Copied')
                    : (language === 'zh' ? '复制全文' : 'Copy All')}
                </button>
                <button
                  onClick={() => {
                    const manuscript = buildFullNovelManuscript();
                    if (!manuscript) {
                      setFullNovelCopyError(language === 'zh' ? '暂无可导出的正文' : 'No content to export');
                      return;
                    }
                    const title = novelProject?.title || (language === 'zh' ? '未命名小说' : 'Untitled');
                    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
                    const filename = `${safeTitle}_完整稿.txt`;
                    const blob = new Blob([manuscript], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: 12,
                  }}
                >
                  {language === 'zh' ? '导出TXT' : 'Export TXT'}
                </button>
                <button
                  onClick={() => setShowFullNovelReader(!showFullNovelReader)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: 12 }}
                >
                  {showFullNovelReader ? (language === 'zh' ? '收起' : 'Collapse') : (language === 'zh' ? '阅读完整小说' : 'Read Full')}
                </button>
              </div>
            </div>

            {/* 复制失败提示 */}
            {fullNovelCopyError && (
              <div style={{
                fontSize: 12,
                color: 'var(--danger)',
                marginBottom: 8,
              }}>
                {fullNovelCopyError}
              </div>
            )}

            {showFullNovelReader && (
              <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: 8,
                padding: 20,
                maxHeight: 600,
                overflow: 'auto',
                fontSize: 15,
                lineHeight: 1.9,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {novelProject?.title && (
                  <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, textAlign: 'center' }}>
                    《{novelProject.title}》
                  </div>
                )}

                {/* 章节目录 */}
                <div
                  onClick={() => setShowNovelToc(!showNovelToc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 6,
                    marginBottom: showNovelToc ? 12 : 24,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                    📖 {language === 'zh' ? '章节目录' : 'Table of Contents'} ({novelChapters.length} {language === 'zh' ? '章' : 'chapters'})
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {showNovelToc ? '▲' : '▼'}
                  </span>
                </div>

                {showNovelToc && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                    gap: 6,
                    marginBottom: 24,
                    padding: 12,
                    background: 'var(--bg-secondary)',
                    borderRadius: 6,
                  }}>
                    {[...novelChapters]
                      .sort((a, b) => a.chapterNo - b.chapterNo)
                      .map(chapter => (
                        <button
                          key={chapter.chapterNo}
                          onClick={() => {
                            const el = document.getElementById(`novel-chapter-${chapter.chapterNo}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }
                          }}
                          style={{
                            padding: '6px 8px',
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: 4,
                            fontSize: 12,
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            textAlign: 'left' as const,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={`第${chapter.chapterNo}章 ${chapter.title}`}
                        >
                          {chapter.chapterNo}. {chapter.title}
                        </button>
                      ))}
                  </div>
                )}

                {[...novelChapters]
                  .sort((a, b) => a.chapterNo - b.chapterNo)
                  .map((chapter, index) => (
                    <div
                      key={chapter.chapterNo}
                      id={`novel-chapter-${chapter.chapterNo}`}
                      style={{ marginBottom: index < novelChapters.length - 1 ? 32 : 0 }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--accent)', marginBottom: 12 }}>
                        第{chapter.chapterNo}章 {chapter.title}
                      </div>
                      <div style={{ color: 'var(--text-primary)' }}>
                        {chapter.content}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {!showFullNovelReader && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {language === 'zh'
                  ? `已生成 ${novelChapters.length} 章，点击"阅读完整小说"查看全部内容`
                  : `${novelChapters.length} chapters generated, click "Read Full" to view all`}
              </div>
            )}
          </div>
        )}

        {/* 非小说模式的快速生成结果 */}
        {creationMode !== 'novel' && (fastResult || fastError || fastLoading) && (
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
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--text-muted)',
                padding: 12,
                background: 'var(--bg-tertiary)',
                borderRadius: 8,
              }}>
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
