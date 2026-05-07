import { useAppStore, CHAT_MODELS, OPENAI_SIZE_MAP, GPT2_SIZE_MAP, OPENAI_QUALITY_MAP, getImageModelDef } from './store';

const API_BASE = 'https://ai.acmestar.top/api';

function fetchWithTimeout(url: string, options: RequestInit, timeout: number = 120000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('请求超时')), timeout);
    fetch(url, options)
      .then((response) => { clearTimeout(timer); resolve(response); })
      .catch((error) => { clearTimeout(timer); reject(error); });
  });
}

export async function sendChatMessage(userMessage: string, imageBase64?: string): Promise<string> {
  const { apiKey, chatModelId, addMessage, setIsChatLoading, setPendingChatRequest, currentConversationId } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  const model = CHAT_MODELS.find((m) => m.id === chatModelId) || CHAT_MODELS[0];
  addMessage(userMessage, 'user', imageBase64);
  setIsChatLoading(true);

  // 保存请求状态，以便页面恢复时继续
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
      body: JSON.stringify({ model: model.id, messages, max_tokens: 8192 }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API 错误: ${resp.status} ${err.slice(0, 200)}`);
    }

    const data = await resp.json();
    const responseText = data.choices?.[0]?.message?.content || '';
    addMessage(responseText, 'assistant');
    setPendingChatRequest(null); // 清除请求状态
    return responseText;
  } catch (error) {
    // 用户主动离开页面导致的请求中断，不清除请求状态，等页面恢复时继续
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('abort') || error.message.includes('network'))) {
      console.log('请求被中断，等待页面恢复');
      return '';
    }
    setPendingChatRequest(null);
    throw error;
  } finally {
    setIsChatLoading(false);
  }
}

export async function generateImage(prompt: string, referenceImage?: string): Promise<string> {
  const { apiKey, imageModelId, imageRatio, imageQuality, addImageRecord, setIsImageLoading, setPendingImageRequest } = useAppStore.getState();
  if (!apiKey) throw new Error('请先设置 API Key');

  const model = getImageModelDef(imageModelId);
  setIsImageLoading(true);

  // 保存请求状态
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
    return imageUrl;
  } catch (error) {
    // 请求中断时不清除状态
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('abort') || error.message.includes('network'))) {
      console.log('图片生成请求被中断，等待页面恢复');
      return '';
    }
    setPendingImageRequest(null);
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
    }, 180000);

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
  }, 180000);

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

  const resp = await fetchWithTimeout(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelId, messages, max_tokens: 4096 }),
  }, 180000);

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
