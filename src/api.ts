import { useAppStore, CHAT_MODELS, IMAGE_MODELS } from './store';

const API_BASE = 'https://api.acmestar.top/v1';

export async function sendChatMessage(userMessage: string, imageBase64?: string): Promise<string> {
  const { apiKey, chatModelId, addMessage, setIsLoading } = useAppStore.getState();

  if (!apiKey) throw new Error('请先设置 API Key');

  const model = CHAT_MODELS.find((m) => m.id === chatModelId) || CHAT_MODELS[0];

  // Add user message
  addMessage(userMessage, 'user', imageBase64);
  setIsLoading(true);

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
    setIsLoading(false);
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

export async function generateImage(prompt: string): Promise<string> {
  const { apiKey, imageModelId, addGeneratedImage, setIsLoading } = useAppStore.getState();

  if (!apiKey) throw new Error('请先设置 API Key');

  const model = IMAGE_MODELS.find((m) => m.id === imageModelId) || IMAGE_MODELS[0];
  setIsLoading(true);

  try {
    let imageUrl: string;

    if (model.provider === 'gemini') {
      imageUrl = await generateGeminiImage(apiKey, model.id, prompt);
    } else {
      imageUrl = await generateOpenAIImage(apiKey, model.id, prompt);
    }

    addGeneratedImage(imageUrl);
    return imageUrl;
  } finally {
    setIsLoading(false);
  }
}

async function generateOpenAIImage(apiKey: string, modelId: string, prompt: string): Promise<string> {
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
      size: '1024x1024',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`生成失败: ${resp.status} ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const url = data.data?.[0]?.url || data.data?.[0]?.b64_json;

  if (!url) throw new Error('未返回图片');

  return url.startsWith('data:') ? url : `data:image/png;base64,${url}`;
}

async function generateGeminiImage(apiKey: string, modelId: string, prompt: string): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predict?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1 },
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