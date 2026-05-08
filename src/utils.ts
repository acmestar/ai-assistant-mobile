// 触感反馈工具
export function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light') {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30,
    };
    navigator.vibrate(patterns[style]);
  }
}

// 分享文本
export async function shareText(text: string, title?: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({
        title: title || '分享内容',
        text: text,
      });
      return true;
    } catch (e) {
      // 用户取消或分享失败
      return false;
    }
  } else {
    // 不支持分享API，复制到剪贴板
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

// 分享图片（Base64）
export async function shareImage(imageBase64: string, title?: string): Promise<boolean> {
  if (navigator.share) {
    try {
      // 将 base64 转换为 Blob
      const response = await fetch(imageBase64);
      const blob = await response.blob();
      const file = new File([blob], 'image.png', { type: 'image/png' });

      await navigator.share({
        title: title || '分享图片',
        files: [file],
      });
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

// 分享对话内容
export async function shareConversation(
  title: string,
  messages: Array<{ role: string; content: string }>
): Promise<boolean> {
  const text = `【${title}】\n\n${messages
    .map((m) => `${m.role === 'user' ? '👤 我' : '🤖 AI'}：${m.content}`)
    .join('\n\n')}`;

  return shareText(text, title);
}
