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
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('请求超时，请检查网络连接'));
    }, timeout);

    // 合并外部 signal 和内部 controller
    const abortHandler = () => {
      clearTimeout(timer);
      reject(new Error('请求已取消'));
    };
    signal?.addEventListener('abort', abortHandler);

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
        if (error.name === 'AbortError') {
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

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

  const resp = await fetch(`${API_BASE}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelId, prompt, n: 1, size, quality: qualityLevel }),
    mode: 'cors',
    cache: 'no-cache',
    signal: imageAbortController?.signal,
  });

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
}

async function generateGPT2Image(apiKey: string, prompt: string, ratio: string, quality: string, referenceImage?: string): Promise<string> {
  const size = GPT2_SIZE_MAP[ratio] || 'auto';

  if (referenceImage) {
    const formData = new FormData();
    const m = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('无效的参考图格式');

    const byteString = atob(m[2]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: m[1] });

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
    messages.push({ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: referenceImage } }] });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const resp = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 4096 }),
    mode: 'cors',
    cache: 'no-cache',
    signal: imageAbortController?.signal,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini 生成失败: ${resp.status} ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) throw new Error('未返回内容');

  if (typeof content === 'string' && (content.startsWith('http') || content.startsWith('data:image'))) {
    return content;
  }

  if (typeof content === 'object' && content?.url) return content.url;
  if (typeof content === 'object' && content?.b64_json) return `data:image/png;base64,${content.b64_json}`;

  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;
  if (b64) return `data:image/png;base64,${b64}`;
  if (url) return url;

  throw new Error('未返回图片');
}
