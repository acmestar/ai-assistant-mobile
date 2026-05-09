import { useState, useRef, useEffect, useCallback, TextareaHTMLAttributes } from 'react';

interface AutoResizeTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  minHeight?: number;
  maxHeight?: number;
  style?: React.CSSProperties;
}

export default function AutoResizeTextarea({
  value,
  onChange,
  minHeight = 80,
  maxHeight = 300,
  style,
  ...props
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // 自动调整高度
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto';

    // 计算新高度
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;

    // 检查是否溢出
    setIsOverflowing(textarea.scrollHeight > maxHeight);
  }, [minHeight, maxHeight]);

  // 值变化时调整高度
  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      style={{
        ...style,
        minHeight,
        maxHeight,
        height: minHeight,
        overflowY: isOverflowing ? 'auto' : 'hidden',
        resize: 'none',
      }}
      {...props}
    />
  );
}
