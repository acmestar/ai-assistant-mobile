import { useAppStore, CHAT_MODELS, IMAGE_MODELS, OPENAI_SIZE_MAP, GPT2_SIZE_MAP, OPENAI_QUALITY_MAP, getImageModelDef } from './store';

const API_BASE = 'https://api.acmestar.top/v1';

export async function sendChatMessage(userMessage: string, imageBase64?: string): Promise<string> {
  const { apiKey, chatModelId, addMessage, setIsChatLoading } = useAppStore.getState();

  if (!apiKey) throw new Error('请先设置 API Key');

  const model = CHAT_MODELS.find((m) => m.id === chatModelId) || CHAT_MODELS[0];

  // Add user message
  addMessage(userMessage, 'user', imageBase64);
  setIsChatLoading(true);

  try {
    const conversation = useAppStore.getState().getCurrentConversation();
    if (!conversation) throw new Error('没有当前对话');

    // Build messages array with context
    const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

    // Include all previous messages for long context
    for (const msg of conversation.messages) {
      if (msg.role === 'user' && msg.imageUrl) {
        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: msg.content },
            { type: 'image_url', image_url: { url: msg.imageUrl } },
          ],
        });
      } else {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current message
    if (imageBase64) {
      messages[messages.length - 1] = {
        role: 'user',
        content: [
          { type: 'text', text: userMessage },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      };
    }

    let responseText: string;

    if (model.provider === 'gemini') {
      responseText = await callGeminiChat(apiKey, model.id, messages);
    } else {
      responseText = await callOpenAIChat(apiKey, model.id, messages);
    }

    addMessage(responseText, 'assistant');
    return responseText;
  } finally {
    setIsChatLoading(false);
  }
}

async function callOpenAIChat(
  apiKey: string,
  modelId: string,
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>
): Promise<string> {
  const resp = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages,
      max_tokens: 8192,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API 错误: ${resp.status} ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGeminiChat(
  apiKey: string,
  modelId: string,
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>
): Promise<string> {
  // Convert to Gemini format
  const contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> = [];

  for (const msg of messages) {
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    if (typeof msg.content === 'string') {
      parts.push({ text: msg.content });
    } else {
      for (const part of msg.content) {
        if (part.type === 'text' && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === 'image_url' && part.image_url) {
          const url = part.image_url.url;
          const m = url.match(/^data:([^;]+);base64,(.+)$/);
          if (m) {
            parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
          }
        }
      }
    }

    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    });
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini 错误: ${resp.status} ${err.slice(0, 200)}`);
  }

  // Parse SSE stream
  const reader = resp.body?.getReader();
  if (!reader) throw new Error('无法读取响应');

  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const json = line.slice(6);
        if (json === '[DONE]') continue;
        try {
          const data = JSON.parse(json);
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          result += text;
        } catch {}
      }
    }
  }

  return result;
}

export async function generateImage(prompt: string, referenceImage?: string): Promise<string> {
  const { apiKey, imageModelId, imageRatio, imageQuality, addImageRecord, setIsImageLoading } = useAppStore.getState();

  if (!apiKey) throw new Error('请先设置 API Key');

  const model = getImageModelDef(imageModelId);
  setIsImageLoading(true);

  try {
    let imageUrl: string;

    if (model.provider === 'gemini') {
      imageUrl = await generateGeminiImage(apiKey, model.id, prompt, imageRatio, imageQuality, referenceImage);
    } else if (model.id === 'gpt-image-2') {
      imageUrl = await generateGPT2Image(apiKey, prompt, imageRatio, imageQuality, referenceImage);
    } else {
      imageUrl = await generateOpenAIImage(apiKey, model.id, prompt, imageRatio, imageQuality);
    }

    addImageRecord({
      prompt,
      imageUrl,
      modelId: model.id,
      ratio: imageRatio,
      referenceImage,
    });

    return imageUrl;
  } finally {
    setIsImageLoading(false);
  }
}

async function generateOpenAIImage(
  apiKey: string,
  modelId: string,
  prompt: string,
  ratio: string,
  quality: string
): Promise<string> {
  const size = OPENAI_SIZE_MAP[ratio] || '1024x1024';
  const qualityLevel = OPENAI_QUALITY_MAP[quality] || 'medium';

  try {
    const resp = await fetch(`${API_BASE}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        prompt,
        n: 1,
        size,
        quality: qualityLevel,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`生成失败: ${resp.status} ${err.slice(0, 200)}`);
    }

    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;

    if (b64) {
      return `data:image/png;base64,${b64}`;
    }

    if (url) {
      try {
        const imgResp = await fetch(url);
        const imgBlob = await imgResp.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imgBlob);
        });
        return dataUrl;
      } catch {
        return url;
      }
    }

    throw new Error('未返回图片');
  } catch (e) {
    if (e instanceof TypeError && e.message.includes('fetch')) {
      throw new Error('网络请求失败，请检查网络连接或尝试使用 Gemini 模型');
    }
    throw e;
  }
}

async function generateGPT2Image(
  apiKey: string,
  prompt: string,
  ratio: string,
  quality: string,
  referenceImage?: string
): Promise<string> {
  const size = GPT2_SIZE_MAP[ratio] || 'auto';

  // 有参考图时使用 edits 端点
  if (referenceImage) {
    const formData = new FormData();

    // 将 base64 转换为 blob
    const m = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('无效的参考图格式');

    const byteString = atob(m[2]);
    const mimeString = m[1];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });

    formData.append('image', blob, 'reference.png');
    formData.append('prompt', prompt);
    formData.append('model', 'gpt-image-2');

    // GPT2 edit 只支持特定尺寸
    const editSize = ratio === '3:2' ? '1792x1024' : ratio === '2:3' ? '1024x1792' : '1024x1024';
    formData.append('size', editSize);

    const resp = await fetch(`${API_BASE}/images/edits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`GPT2 编辑失败: ${resp.status} ${err.slice(0, 200)}`);
    }

    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;

    if (b64) return `data:image/png;base64,${b64}`;
    if (url) {
      try {
        const imgResp = await fetch(url);
        const imgBlob = await imgResp.blob();
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(imgBlob);
        });
        return dataUrl;
      } catch {
        return url;
      }
    }
    throw new Error('未返回图片');
  }

  // 无参考图时使用 generations 端点
  const body: any = {
    model: 'gpt-image-2',
    prompt,
    n: 1,
  };

  if (size !== 'auto') {
    body.size = size;
  }

  if (quality !== 'auto') {
    body.quality = quality;
  }

  const resp = await fetch(`${API_BASE}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GPT2 生成失败: ${resp.status} ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;

  if (b64) return `data:image/png;base64,${b64}`;
  if (url) {
    try {
      const imgResp = await fetch(url);
      const imgBlob = await imgResp.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imgBlob);
      });
      return dataUrl;
    } catch {
      return url;
    }
  }

  throw new Error('未返回图片');
}

async function generateGeminiImage(
  apiKey: string,
  modelId: string,
  prompt: string,
  ratio: string,
  quality: string,
  referenceImage?: string
): Promise<string> {
  const instances: any[] = [{ prompt }];

  // 添加参考图
  if (referenceImage) {
    const m = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (m) {
      instances[0].image = { mimeType: m[1], data: m[2] };
    }
  }

  // 解析分辨率
  const qualityNum = parseInt(quality.replace('K', ''));
  const baseSize = qualityNum === 4 ? 2048 : qualityNum === 2 ? 1024 : qualityNum === 0 ? 512 : 1024;

  // 解析比例
  let aspectRatio = 'square';
  if (ratio !== 'auto') {
    const [w, h] = ratio.split(':').map(Number);
    if (w > h) aspectRatio = 'wide';
    else if (w < h) aspectRatio = 'tall';
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances,
        parameters: {
          sampleCount: 1,
          aspectRatio,
        },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini 生成失败: ${resp.status} ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const base64 = data.predictions?.[0]?.bytesBase64Encoded;

  if (!base64) throw new Error('未返回图片');

  return `data:image/png;base64,${base64}`;
}