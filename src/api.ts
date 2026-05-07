import { useAppStore, CHAT_MODELS, OPENAI_SIZE_MAP, GPT2_SIZE_MAP, OPENAI_QUALITY_MAP, getImageModelDef } from './store';

// 通过 Cloudflare Worker 代理，解决 CORS 问题
// Worker 会把 /api 替换成 /v1，所以这里不需要加 /v1
const API_BASE = 'https://ai.acmestar.top/api';

// 超时包装函数
function fetchWithTimeout(url: string, options: RequestInit, timeout: number = 120000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('请求超时，请稍后重试'));
    }, timeout);

    fetch(url, options)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

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

  // Gemini 直接调用 Google API（支持 CORS）
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

    // 调试：打印返回数据结构
    console.log('GPT Image response:', JSON.stringify(data).slice(0, 500));

    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;

    if (b64) {
      return `data:image/png;base64,${b64}`;
    }

    if (url) {
      // 直接返回 URL，让前端显示
      // 如果 URL 是外部链接，可能因为 CORS 无法下载转换
      return url;
    }

    throw new Error('未返回图片，请检查 API 返回格式');
  } catch (e) {
    if (e instanceof TypeError && e.message.includes('fetch')) {
      throw new Error('网络请求失败，请检查网络连接');
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

    const editSize = ratio === '3:2' ? '1792x1024' : ratio === '2:3' ? '1024x1792' : '1024x1024';
    formData.append('size', editSize);

    // GPT2 编辑可能需要更长时间
    const resp = await fetchWithTimeout(
      `${API_BASE}/images/edits`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      },
      180000  // 3分钟超时
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`GPT2 编辑失败: ${resp.status} ${err.slice(0, 200)}`);
    }

    const data = await resp.json();
    console.log('GPT2 Edit response:', JSON.stringify(data).slice(0, 500));

    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;

    if (b64) return `data:image/png;base64,${b64}`;
    if (url) return url;
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

  // GPT2 生成可能需要更长时间
  const resp = await fetchWithTimeout(
    `${API_BASE}/images/generations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    },
    180000  // 3分钟超时
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GPT2 生成失败: ${resp.status} ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  console.log('GPT2 Generate response:', JSON.stringify(data).slice(0, 500));

  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;

  if (b64) return `data:image/png;base64,${b64}`;
  if (url) return url;
  throw new Error('未返回图片');
}
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
  _quality: string,
  referenceImage?: string
): Promise<string> {
  // Gemini 通过 /v1/chat/completions 端点调用
  const messages: Array<{ role: string; content: any }> = [];

  // 构建消息内容
  if (referenceImage) {
    const m = referenceImage.match(/^data:([^;]+);base64,(.+)$/);
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: referenceImage } },
      ],
    });
  } else {
    messages.push({ role: 'user', content: prompt });
  }

  const resp = await fetchWithTimeout(
    `${API_BASE}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: 4096,
      }),
    },
    120000
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini 生成失败: ${resp.status} ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  console.log('Gemini Image response:', JSON.stringify(data).slice(0, 500));

  // 检查返回格式
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('未返回内容');
  }

  // 如果返回的是图片 URL
  if (typeof content === 'string' && content.startsWith('http')) {
    return content;
  }

  // 如果返回的是 base64
  if (typeof content === 'string' && content.startsWith('data:image')) {
    return content;
  }

  // 如果返回的是 JSON 格式的图片数据
  if (typeof content === 'object' && content?.url) {
    return content.url;
  }

  if (typeof content === 'object' && content?.b64_json) {
    return `data:image/png;base64,${content.b64_json}`;
  }

  // 尝试从响应中提取图片
  const b64 = data?.data?.[0]?.b64_json;
  const url = data?.data?.[0]?.url;

  if (b64) return `data:image/png;base64,${b64}`;
  if (url) return url;

  throw new Error('未返回图片，返回内容: ' + (typeof content === 'string' ? content.slice(0, 100) : JSON.stringify(content).slice(0, 100)));
}