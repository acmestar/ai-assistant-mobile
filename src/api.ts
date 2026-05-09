import { useAppStore, CHAT_MODELS, OPENAI_SIZE_MAP, GPT2_SIZE_MAP, OPENAI_QUALITY_MAP, getImageModelDef } from './store';

const API_BASE = 'https://ai.acmestar.top/api';

// 全局 AbortController 用于取消请求
let chatAbortController: AbortController | null = null;
let imageAbortController: AbortController | null = null;

// 取消聊天请求
export function cancelChatRequest(): void {
  if (chatAbortController) {
    chatAbortController.abort();
    chatAbortController = null;
    useAppStore.getState().setIsChatLoading(false);
    useAppStore.getState().setPendingChatRequest(null);
  }
}

// 取消图片生成请求
export function cancelImageRequest(): void {
  if (imageAbortController) {
    imageAbortController.abort();
    imageAbortController = null;
    useAppStore.getState().setIsImageLoading(false);
    useAppStore.getState().setPendingImageRequest(null);
  }
}

// 重试机制
async function fetchWithRetry(url: string, options: RequestInit, timeout: number = 120000, retries: number = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeout);
      return response;
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      console.log(`请求失败，第 ${attempt + 1} 次重试...`);
    }
  }
  throw new Error('请求失败');
}

function fetchWithTimeout(url: string, options: RequestInit, timeout: number = 120000, signal?: AbortSignal): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();

    // 如果外部提供了 signal，监听它的 abort 事件
    const abortHandler = () => {
      controller.abort();
      reject(new Error('请求已取消'));
    };
    signal?.addEventListener('abort', abortHandler);

    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('请求超时，请检查网络连接'));
    }, timeout);

    const fetchOptions: RequestInit = {
      ...options,
      mode: 'cors',
      cache: 'no-cache',
      signal: controller.signal,
    };

    fetch(url, fetchOptions)
      .then((response) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abortHandler);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abortHandler);
        const errorMsg = error.message || String(error);
        if (error.name === 'AbortError' || signal?.aborted) {
          reject(new Error('请求已取消'));
        } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError') || errorMsg.includes('Network request failed')) {
          reject(new Error('网络连接失败，请检查网络设置或尝试切换网络'));
        } else if (errorMsg.includes('CORS') || errorMsg.includes('cross-origin')) {
          reject(new Error('跨域请求被拦截，请尝试使用其他浏览器'));
        } else {
          reject(new Error(`网络错误: ${errorMsg}`));
        }
      });
  });
}

// 流式输出聊天消息
export async function sendChatMessageStream(
  userMessage: string,
  imageBase64?: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const { apiKey, chatModelId, addMessage, setIsChatLoading, setPendingChatRequest, currentConversationId, addTokenUsage } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  // 取消之前的请求
  if (chatAbortController) {
    chatAbortController.abort();
  }
  chatAbortController = new AbortController();

  const model = CHAT_MODELS.find((m) => m.id === chatModelId) || CHAT_MODELS[0];
  addMessage(userMessage, 'user', imageBase64);
  setIsChatLoading(true);

  if (currentConversationId) {
    setPendingChatRequest({ conversationId: currentConversationId, userMessage, imageBase64 });
  }

  try {
    const conversation = useAppStore.getState().getCurrentConversation();
    if (!conversation) throw new Error('没有当前对话');

    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    // 限制历史消息数量，避免 token 爆炸
    const MAX_HISTORY = 20;  // 保留最近20条消息
    const recentMessages = conversation.messages.slice(-MAX_HISTORY);

    for (const msg of recentMessages) {
      if (msg.role === 'user' && msg.imageUrl) {
        messages.push({ role: 'user', content: [{ type: 'text', text: msg.content }, { type: 'image_url', image_url: { url: msg.imageUrl } }] });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    if (imageBase64) {
      messages[messages.length - 1] = { role: 'user', content: [{ type: 'text', text: userMessage }, { type: 'image_url', image_url: { url: imageBase64 } }] };
    }

    const resp = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model.id, messages, max_tokens: 8192, stream: true }),
      signal: chatAbortController.signal,
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API 错误: ${resp.status} ${err.slice(0, 200)}`);
    }

    const reader = resp.body?.getReader();
    if (!reader) throw new Error('无法读取响应流');

    const decoder = new TextDecoder();
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let buffer = ''; // 用于存储不完整的数据

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 将新数据追加到缓冲区
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // 保留最后一个可能不完整的行
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              onChunk?.(content);
            }
            // 统计 token
            if (parsed.usage) {
              inputTokens = parsed.usage.prompt_tokens || 0;
              outputTokens = parsed.usage.completion_tokens || 0;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    // 处理缓冲区中剩余的数据
    if (buffer.startsWith('data: ')) {
      const data = buffer.slice(6);
      if (data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            fullContent += content;
            onChunk?.(content);
          }
        } catch {
          // 忽略解析错误
        }
      }
    }

    // 估算 token 数量（如果 API 没有返回）
    if (inputTokens === 0) {
      inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
    }
    if (outputTokens === 0) {
      outputTokens = Math.ceil(fullContent.length / 4);
    }

    console.log('Token 统计:', { inputTokens, outputTokens, fullContentLength: fullContent.length });
    addTokenUsage(inputTokens, outputTokens);

    addMessage(fullContent, 'assistant');
    setPendingChatRequest(null);
    chatAbortController = null;
    return fullContent;
  } catch (error) {
    if (error instanceof Error && error.message === '请求已取消') {
      console.log('用户取消了请求');
      return '';
    }
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('abort') || error.message.includes('network'))) {
      console.log('请求被中断，等待页面恢复');
      return '';
    }
    setPendingChatRequest(null);
    chatAbortController = null;
    throw error;
  } finally {
    setIsChatLoading(false);
  }
}

export async function sendChatMessage(userMessage: string, imageBase64?: string): Promise<string> {
  const { apiKey, chatModelId, addMessage, setIsChatLoading, setPendingChatRequest, currentConversationId, addTokenUsage } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  // 取消之前的请求
  if (chatAbortController) {
    chatAbortController.abort();
  }
  chatAbortController = new AbortController();

  const model = CHAT_MODELS.find((m) => m.id === chatModelId) || CHAT_MODELS[0];
  addMessage(userMessage, 'user', imageBase64);
  setIsChatLoading(true);

  if (currentConversationId) {
    setPendingChatRequest({ conversationId: currentConversationId, userMessage, imageBase64 });
  }

  try {
    const conversation = useAppStore.getState().getCurrentConversation();
    if (!conversation) throw new Error('没有当前对话');

    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    for (const msg of conversation.messages) {
      if (msg.role === 'user' && msg.imageUrl) {
        messages.push({ role: 'user', content: [{ type: 'text', text: msg.content }, { type: 'image_url', image_url: { url: msg.imageUrl } }] });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    if (imageBase64) {
      messages[messages.length - 1] = { role: 'user', content: [{ type: 'text', text: userMessage }, { type: 'image_url', image_url: { url: imageBase64 } }] };
    }

    const resp = await fetchWithRetry(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: model.id, messages, max_tokens: 8192 }),
    }, 60000, 2);

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API 错误: ${resp.status} ${err.slice(0, 200)}`);
    }

    const data = await resp.json();
    const responseText = data.choices?.[0]?.message?.content || '';

    // 统计 token
    const inputTokens = data.usage?.prompt_tokens || Math.ceil(JSON.stringify(messages).length / 4);
    const outputTokens = data.usage?.completion_tokens || Math.ceil(responseText.length / 4);
    addTokenUsage(inputTokens, outputTokens);

    addMessage(responseText, 'assistant');
    setPendingChatRequest(null);
    chatAbortController = null;
    return responseText;
  } catch (error) {
    if (error instanceof Error && error.message === '请求已取消') {
      console.log('用户取消了请求');
      return '';
    }
    setPendingChatRequest(null);
    chatAbortController = null;
    throw error;
  } finally {
    setIsChatLoading(false);
  }
}

export async function generateImage(prompt: string, referenceImage?: string): Promise<string> {
  const { apiKey, imageModelId, imageRatio, imageQuality, addImageRecord, setIsImageLoading, setPendingImageRequest } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  // 取消之前的请求
  if (imageAbortController) {
    imageAbortController.abort();
  }
  imageAbortController = new AbortController();

  const model = getImageModelDef(imageModelId);
  setIsImageLoading(true);

  setPendingImageRequest({ prompt, referenceImage });

  try {
    let imageUrl: string;

    if (model.id === 'gpt-image-2') {
      imageUrl = await generateGPT2Image(apiKey, prompt, imageRatio, imageQuality, referenceImage);
    } else if (model.id === 'gpt-image-1.5') {
      imageUrl = await generateOpenAIImage(apiKey, model.id, prompt, imageRatio, imageQuality);
    } else {
      imageUrl = await generateGeminiImage(apiKey, model.id, prompt, referenceImage);
    }

    addImageRecord({ prompt, imageUrl, modelId: model.id, ratio: imageRatio, referenceImage });
    setPendingImageRequest(null);
    imageAbortController = null;
    return imageUrl;
  } catch (error) {
    if (error instanceof Error && error.message === '请求已取消') {
      console.log('用户取消了图片生成');
      return '';
    }
    setPendingImageRequest(null);
    imageAbortController = null;
    throw error;
  } finally {
    setIsImageLoading(false);
  }
}

async function generateOpenAIImage(apiKey: string, modelId: string, prompt: string, ratio: string, quality: string): Promise<string> {
  const size = OPENAI_SIZE_MAP[ratio] || '1024x1024';
  const qualityLevel = OPENAI_QUALITY_MAP[quality] || 'medium';

  try {
    const resp = await fetchWithTimeout(`${API_BASE}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelId, prompt, n: 1, size, quality: qualityLevel }),
    }, 180000, imageAbortController?.signal);

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`生成失败: ${resp.status} ${err.slice(0, 200)}`);
    }

    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;

    if (b64) return `data:image/png;base64,${b64}`;
    if (url) return url;
    throw new Error('未返回图片');
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('网络请求失败');
  }
}

async function generateGPT2Image(apiKey: string, prompt: string, ratio: string, quality: string, referenceImage?: string): Promise<string> {
  const size = GPT2_SIZE_MAP[ratio] || 'auto';

  if (referenceImage) {
    console.log('GPT2 图生图 - 参考图存在，长度:', referenceImage.length);
    const formData = new FormData();
    const m = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('无效的参考图格式');

    const byteString = atob(m[2]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: m[1] });

    console.log('GPT2 图生图 - Blob大小:', blob.size, '类型:', blob.type);

    formData.append('image', blob, 'reference.png');
    formData.append('prompt', prompt);
    formData.append('model', 'gpt-image-2');
    formData.append('size', ratio === '3:2' ? '1792x1024' : ratio === '2:3' ? '1024x1792' : '1024x1024');

    const resp = await fetchWithTimeout(`${API_BASE}/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    }, 180000, imageAbortController?.signal);

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`GPT2 编辑失败: ${resp.status} ${err.slice(0, 200)}`);
    }

    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;
    if (b64) return `data:image/png;base64,${b64}`;
    if (url) return url;
    throw new Error('未返回图片');
  }

  const body: any = { model: 'gpt-image-2', prompt, n: 1 };
  if (size !== 'auto') body.size = size;
  if (quality !== 'auto') body.quality = quality;

  const resp = await fetchWithTimeout(`${API_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  }, 180000, imageAbortController?.signal);

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GPT2 生成失败: ${resp.status} ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;
  if (b64) return `data:image/png;base64,${b64}`;
  if (url) return url;
  throw new Error('未返回图片');
}

async function generateGeminiImage(apiKey: string, modelId: string, prompt: string, referenceImage?: string): Promise<string> {
  const messages: Array<{ role: string; content: any }> = [];

  if (referenceImage) {
    console.log('Gemini 图生图 - 参考图存在，长度:', referenceImage.length);
    console.log('Gemini 图生图 - 参考图前缀:', referenceImage.substring(0, 50));
    messages.push({ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: referenceImage } }] });
  } else {
    console.log('Gemini 文生图 - 无参考图');
    messages.push({ role: 'user', content: prompt });
  }

  console.log('Gemini 请求 - model:', modelId, 'messages数量:', messages.length);

  try {
    const resp = await fetchWithTimeout(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelId, messages, max_tokens: 4096 }),
    }, 180000, imageAbortController?.signal);

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini 生成失败: ${resp.status} ${err.slice(0, 200)}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) throw new Error('未返回内容');

    // 情况1: content 直接是图片 URL 或 base64
    if (typeof content === 'string') {
      // 直接是 URL 或 base64
      if (content.startsWith('http')) return content;
      if (content.startsWith('data:image')) return content;

      // Markdown 格式: ![image](data:image/xxx;base64,...) 或 ![image](https://...)
      // 使用 [\s\S] 匹配包括换行符在内的所有字符
      const mdMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/s);
      if (mdMatch && mdMatch[1]) {
        return mdMatch[1];
      }
      const mdUrlMatch = content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/s);
      if (mdUrlMatch && mdUrlMatch[1]) {
        return mdUrlMatch[1];
      }
    }

    // 情况2: content 是对象，包含 url 或 b64_json
    if (typeof content === 'object' && content !== null) {
      if (content.url) return content.url;
      if (content.b64_json) return `data:image/png;base64,${content.b64_json}`;
    }

    // 情况3: data.data 数组
    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;
    if (b64) return `data:image/png;base64,${b64}`;
    if (url) return url;

    throw new Error('未返回图片');
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('网络请求失败');
  }
}

// 执行模型队列 - 支持顺序和并行模式
export async function executeModelQueue(
  onProgress?: (queueId: string, content: string, isComplete: boolean) => void,
  onChapterComplete?: (title: string, content: string) => void  // 新增：章节完成时写入对话
): Promise<void> {
  const { apiKey, modelQueue, setIsQueueRunning, updateQueueResult, setCurrentQueueIndex, getCurrentConversation, characterMemory, worldSetting, parallelMode, activeWritingDraft } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');
  if (modelQueue.length === 0) return;

  setIsQueueRunning(true);

  // 获取当前对话的历史消息作为上下文
  const conversation = getCurrentConversation();
  const contextMessages: Array<{ role: string; content: string }> = [];
  if (conversation) {
    for (const msg of conversation.messages) {
      contextMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // 根据创作类型选择系统提示词
  const creationMode = activeWritingDraft?.creationMode || 'novel';
  let systemPrompt = '';

  if (creationMode === 'novel') {
    systemPrompt = `你是一位专业的小说作家。请根据提供的章节大纲和要求进行创作。

创作要求：
1. 严格按照大纲的剧情走向写作，不要偏离主线
2. 保持人物性格一致，符合角色设定
3. 文笔流畅，场景描写生动，对话自然
4. 注意伏笔和呼应，保持故事的连贯性
5. 每章字数控制在2000-5000字`;
  } else {
    systemPrompt = `你是一位专业的内容创作者。请根据用户的要求进行创作。

创作要求：
1. 严格按照用户的要求进行创作
2. 内容质量高，语言流畅自然
3. 符合指定的风格和格式要求`;
  }

  contextMessages.unshift({ role: 'system', content: systemPrompt });

  // 仅在小说模式下添加角色/世界观设定
  if (creationMode === 'novel' && (characterMemory.length > 0 || worldSetting)) {
    let settingContext = '';
    if (worldSetting) {
      settingContext += `【世界观设定】\n${worldSetting}\n\n`;
    }
    if (characterMemory.length > 0) {
      // 角色替换规则
      const replacements = characterMemory
        .filter(c => c.replaceWith.trim())
        .map(c => `- 文中的"${c.originalName}"请替换为"${c.replaceWith}"`)
        .join('\n');

      // 角色设定（包括新增角色）
      settingContext += '【角色设定】\n';
      characterMemory.forEach(c => {
        const displayName = c.replaceWith.trim() || c.originalName;
        if (c.description.trim()) {
          settingContext += `- ${displayName}：${c.description}\n`;
        } else {
          settingContext += `- ${displayName}\n`;
        }
      });

      // 如果有替换规则，单独列出
      if (replacements) {
        settingContext += '\n【角色替换规则】\n' + replacements + '\n';
      }

      // 提示新增角色如何融入
      const newCharacters = characterMemory.filter(c => !c.originalName.trim() || c.originalName === c.replaceWith);
      if (newCharacters.length > 0) {
        settingContext += '\n【新增角色提示】\n';
        settingContext += '以下角色是新加入的，请在文章中自然地引入他们，让他们合理地出现在剧情中：\n';
        newCharacters.forEach(c => {
          const name = c.replaceWith.trim() || c.originalName;
          settingContext += `- ${name}\n`;
        });
      }
    }

    contextMessages.push({ role: 'user', content: settingContext });
    contextMessages.push({ role: 'assistant', content: '好的，我已经了解了世界观和角色设定，会严格按照这些设定进行创作。' });
  }

  // 用于顺序模式下存储前面章节的摘要
  const chapterSummaries: Array<{ title: string; summary: string }> = [];

  // 过滤出启用的队列项
  const enabledQueue = modelQueue.filter(item => item.enabled !== false);

  try {
    if (parallelMode) {
      // 并行模式：所有启用的项同时执行
      const promises = enabledQueue.map(async (item, index) => {
        if (!item.instruction.trim()) return;

        setCurrentQueueIndex(modelQueue.findIndex(q => q.id === item.id));

        try {
          // 根据创作类型构建指令
          let instruction = '';
          if (creationMode === 'novel') {
            instruction = `请根据以下大纲创作章节内容：

${item.instruction}

注意：
- 这是独立的章节创作，请完整写出本章内容
- 严格遵循大纲中的剧情走向和细节要求
- 如果大纲中有具体场景、对话要点，请落实到文字中`;
          } else {
            instruction = `请根据以下要求创作内容：

${item.instruction}

注意：
- 这是独立的内容创作，请完整写出
- 严格遵循要求中的细节和格式`;
          }

          const messages = [
            ...contextMessages,
            { role: 'user' as const, content: instruction },
          ];

          const resp = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: item.modelId,
              messages,
              max_tokens: 8192,
              stream: true,
            }),
          });

          if (!resp.ok) throw new Error(`API 错误: ${resp.status}`);

          const reader = resp.body?.getReader();
          if (!reader) throw new Error('无法读取响应');

          const decoder = new TextDecoder();
          let content = '';
          let buffer = '';
          let lastSaveTime = Date.now();
          const SAVE_INTERVAL = 1500; // 1.5秒节流保存

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  const chunk = parsed.choices?.[0]?.delta?.content || '';
                  if (chunk) {
                    content += chunk;
                    onProgress?.(item.id, content, false);
                    // 节流保存：每 1.5 秒更新一次
                    if (Date.now() - lastSaveTime > SAVE_INTERVAL) {
                      updateQueueResult(item.id, content);
                      lastSaveTime = Date.now();
                    }
                  }
                } catch {}
              }
            }
          }

          updateQueueResult(item.id, content);
          onProgress?.(item.id, content, true);
          // 写入对话
          onChapterComplete?.(item.title || `内容 ${index + 1}`, content);

        } catch (e) {
          const errorMsg = `错误: ${e instanceof Error ? e.message : '请求失败'}`;
          updateQueueResult(item.id, errorMsg);
          onProgress?.(item.id, errorMsg, true);
        }
      });

      await Promise.all(promises);
    } else {
      // 顺序模式：逐个执行启用的项，后续内容可看到前面内容的摘要
      for (let i = 0; i < enabledQueue.length; i++) {
        const item = enabledQueue[i];
        if (!item.instruction.trim()) continue;

        setCurrentQueueIndex(modelQueue.findIndex(q => q.id === item.id));

        try {
          // 构建前面内容的摘要上下文（避免 token 爆炸）
          let previousContext = '';
          if (chapterSummaries.length > 0) {
            previousContext = '【前面内容摘要】\n';
            chapterSummaries.forEach((s) => {
              previousContext += `${s.title}：${s.summary}\n`;
            });
            previousContext += '\n请承接前面的内容，保持连贯性。\n\n';
          }

          // 根据创作类型构建指令
          let instruction = '';
          if (creationMode === 'novel') {
            instruction = previousContext + `请根据以下大纲创作章节内容：

${item.instruction}

注意：
- 严格遵循大纲中的剧情走向和细节要求
- 与前面章节保持连贯，人物性格一致
- 如果大纲中有具体场景、对话要点，请落实到文字中`;
          } else {
            instruction = previousContext + `请根据以下要求创作内容：

${item.instruction}

注意：
- 严格遵循要求中的细节和格式
- 与前面内容保持连贯和一致`;
          }

          const messages = [
            ...contextMessages,
            { role: 'user' as const, content: instruction },
          ];

          const resp = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              model: item.modelId,
              messages,
              max_tokens: 8192,
              stream: true,
            }),
          });

          if (!resp.ok) throw new Error(`API 错误: ${resp.status}`);

          const reader = resp.body?.getReader();
          if (!reader) throw new Error('无法读取响应');

          const decoder = new TextDecoder();
          let content = '';
          let buffer = '';
          let lastSaveTime = Date.now();
          const SAVE_INTERVAL = 1500; // 1.5秒节流保存

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  const chunk = parsed.choices?.[0]?.delta?.content || '';
                  if (chunk) {
                    content += chunk;
                    onProgress?.(item.id, content, false);
                    // 节流保存：每 1.5 秒更新一次
                    if (Date.now() - lastSaveTime > SAVE_INTERVAL) {
                      updateQueueResult(item.id, content);
                      lastSaveTime = Date.now();
                    }
                  }
                } catch {}
              }
            }
          }

          // 完成后更新结果
          updateQueueResult(item.id, content);
          onProgress?.(item.id, content, true);

          // 写入对话
          onChapterComplete?.(item.title || `内容 ${i + 1}`, content);

          // 生成摘要（而非完整内容）供后续内容参考
          const summary = content.length > 500
            ? content.slice(0, 200) + '...' + content.slice(-200)  // 取开头和结尾各200字作为摘要
            : content;
          chapterSummaries.push({
            title: item.title || `内容 ${i + 1}`,
            summary: summary.slice(0, 500)  // 限制摘要长度
          });

        } catch (e) {
          const errorMsg = `错误: ${e instanceof Error ? e.message : '请求失败'}`;
          updateQueueResult(item.id, errorMsg);
          onProgress?.(item.id, errorMsg, true);
        }
      }
    }
  } finally {
    setIsQueueRunning(false);
    setCurrentQueueIndex(0);
  }
}

// 重新生成单个队列项
export async function regenerateQueueItem(
  queueId: string,
  onProgress?: (content: string) => void
): Promise<string> {
  const { apiKey, modelQueue, getCurrentConversation, characterMemory, worldSetting } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  const item = modelQueue.find(q => q.id === queueId);
  if (!item || !item.instruction.trim()) return '';

  // 获取当前对话的历史消息
  const conversation = getCurrentConversation();
  const contextMessages: Array<{ role: string; content: string }> = [];
  if (conversation) {
    for (const msg of conversation.messages) {
      contextMessages.push({ role: msg.role, content: msg.content });
    }
  }

  // 添加角色/世界观设定作为系统上下文
  if (characterMemory.length > 0 || worldSetting) {
    let systemContext = '';
    if (worldSetting) {
      systemContext += `【世界观设定】\n${worldSetting}\n\n`;
    }
    if (characterMemory.length > 0) {
      // 生成角色替换规则
      const replacements = characterMemory
        .filter(c => c.replaceWith.trim())
        .map(c => `- 文中的"${c.originalName}"请替换为"${c.replaceWith}"`)
        .join('\n');

      const keepOriginal = characterMemory
        .filter(c => !c.replaceWith.trim())
        .map(c => `"${c.originalName}"`)
        .join('、');

      if (replacements || keepOriginal) {
        systemContext += '【角色替换规则】\n';
        if (replacements) systemContext += replacements + '\n';
        if (keepOriginal) systemContext += `- ${keepOriginal}保持不变\n`;
        systemContext += '\n';
      }

      // 角色描述
      systemContext += '【角色设定】\n';
      characterMemory.forEach(c => {
        const displayName = c.replaceWith.trim() || c.originalName;
        systemContext += `- ${displayName}：${c.description}\n`;
      });
    }
    contextMessages.unshift({ role: 'user', content: systemContext });
    contextMessages.unshift({ role: 'assistant', content: '好的，我已经了解了世界观和角色设定，会按照这些设定进行创作。' });
  }

  // 找到当前项之前的所有队列结果作为上下文
  const currentIndex = modelQueue.findIndex(q => q.id === queueId);
  for (let i = 0; i < currentIndex; i++) {
    const prevItem = modelQueue[i];
    if (prevItem.instruction && prevItem.result) {
      contextMessages.push({ role: 'user', content: prevItem.instruction });
      contextMessages.push({ role: 'assistant', content: prevItem.result });
    }
  }

  const messages = [
    ...contextMessages,
    { role: 'user' as const, content: item.instruction },
  ];

  const resp = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: item.modelId,
      messages,
      max_tokens: 8192,
      stream: true,
    }),
  });

  if (!resp.ok) throw new Error(`API 错误: ${resp.status}`);

  const reader = resp.body?.getReader();
  if (!reader) throw new Error('无法读取响应');

  const decoder = new TextDecoder();
  let content = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const chunk = parsed.choices?.[0]?.delta?.content || '';
          if (chunk) {
            content += chunk;
            onProgress?.(content);
          }
        } catch {}
      }
    }
  }

  return content;
}

// 模型对比 - 同时向多个模型发送相同消息
export async function compareChatModels(
  userMessage: string | Array<{ type: string; text?: string; image_url?: { url: string } }>,
  modelIds: string[],
  onProgress?: (modelId: string, content: string) => void
): Promise<Record<string, string>> {
  const { apiKey } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  const results: Record<string, string> = {};

  const promises = modelIds.map(async (modelId) => {
    try {
      const resp = await fetch(`${API_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: userMessage }],
          max_tokens: 4096,
          stream: true,
        }),
      });

      if (!resp.ok) throw new Error(`API 错误: ${resp.status}`);

      const reader = resp.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const decoder = new TextDecoder();
      let content = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const chunk = parsed.choices?.[0]?.delta?.content || '';
              if (chunk) {
                content += chunk;
                onProgress?.(modelId, content);
              }
            } catch {}
          }
        }
      }

      results[modelId] = content;
      return { modelId, content };
    } catch (e) {
      results[modelId] = `错误: ${e instanceof Error ? e.message : '请求失败'}`;
      return { modelId, content: results[modelId] };
    }
  });

  await Promise.all(promises);
  return results;
}

// 图片模型对比
export async function compareImageModels(
  prompt: string,
  modelIds: string[],
  onProgress?: (modelId: string, status: string) => void
): Promise<Record<string, string>> {
  const { apiKey, imageRatio, imageQuality } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  const results: Record<string, string> = {};

  const promises = modelIds.map(async (modelId) => {
    try {
      onProgress?.(modelId, '生成中...');

      if (modelId === 'gpt-image-2' || modelId === 'gpt-image-1.5') {
        const size = modelId === 'gpt-image-2'
          ? (GPT2_SIZE_MAP[imageRatio] || 'auto')
          : (OPENAI_SIZE_MAP[imageRatio] || '1024x1024');
        const qualityLevel = OPENAI_QUALITY_MAP[imageQuality] || 'medium';

        const body: any = { model: modelId, prompt, n: 1 };
        if (modelId === 'gpt-image-2') {
          if (size !== 'auto') body.size = size;
          if (imageQuality !== 'auto') body.quality = imageQuality;
        } else {
          body.size = size;
          body.quality = qualityLevel;
        }

        const resp = await fetchWithTimeout(`${API_BASE}/images/generations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
        }, 180000);

        if (!resp.ok) throw new Error(`生成失败: ${resp.status}`);
        const data = await resp.json();
        const b64 = data?.data?.[0]?.b64_json;
        const url = data?.data?.[0]?.url;
        results[modelId] = b64 ? `data:image/png;base64,${b64}` : url || '未返回图片';
      } else {
        // Gemini 模型
        const resp = await fetchWithTimeout(`${API_BASE}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: prompt }], max_tokens: 4096 }),
        }, 180000);

        if (!resp.ok) throw new Error(`生成失败: ${resp.status}`);
        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content;

        if (typeof content === 'string') {
          if (content.startsWith('http') || content.startsWith('data:image')) {
            results[modelId] = content;
          } else {
            const mdMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/s) || content.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/s);
            results[modelId] = mdMatch?.[1] || '未返回图片';
          }
        } else {
          results[modelId] = '未返回图片';
        }
      }

      onProgress?.(modelId, '完成');
    } catch (e) {
      results[modelId] = `错误: ${e instanceof Error ? e.message : '生成失败'}`;
      onProgress?.(modelId, '失败');
    }
  });

  await Promise.all(promises);
  return results;
}
