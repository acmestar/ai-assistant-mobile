import { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Sparkles, Trash2, Download, Upload, X, Maximize2, Clock, Sliders, AlertCircle, ZoomIn, ZoomOut, RotateCw, StopCircle, Wand2, Mic, Share2 } from 'lucide-react';
import { useAppStore, IMAGE_MODELS, GPT2_RATIO_LABELS, GPT2_QUALITY_LABELS, getImageModelDef, PROMPT_TEMPLATES } from './store';
import { generateImage, cancelImageRequest } from './api';
import { t, Language } from './i18n';
import { hapticFeedback, shareImage } from './utils';

export default function ImageTab() {
  const { imageModelId, setImageModelId, imageRatio, setImageRatio, imageQuality, setImageQuality, imageRecords, isImageLoading, deleteImageRecord, clearImageRecords, pendingImageRequest, setPendingImageRequest, language } = useAppStore();

  const T = (key: string) => t(key, language as Language);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showRatioPicker, setShowRatioPicker] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [swipeId, setSwipeId] = useState<string | null>(null); // 正在滑动的图片ID
  const [swipeX, setSwipeX] = useState(0); // 滑动偏移量
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartXRef = useRef(0); // 触摸起始位置
  const touchCurrentIdRef = useRef<string | null>(null); // 当前触摸的图片ID

  // 语音输入状态
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const isPressingRef = useRef(false);

  const currentModel = getImageModelDef(imageModelId);
  const storageWarning = imageRecords.length >= 10;

  // 创建新的 SpeechRecognition 实例
  const createRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return null;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setVoiceText(prev => {
        const newText = finalTranscript || interimTranscript || prev;
        return newText;
      });
    };

    recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error, event);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      let msg: string;

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        if (isIOS && language === 'zh') {
          msg = '请允许麦克风权限以使用语音功能。\n\niOS 用户提示：\n1. 在 Safari 中使用一次语音功能并授权\n2. 保持 Safari 在后台运行\n3. 或在系统设置 → 隐私 → 麦克风中为 Safari 永久授权';
        } else if (isIOS) {
          msg = 'Please allow microphone access.\n\niOS Tips:\n1. Use voice in Safari first and grant permission\n2. Keep Safari running in background\n3. Or grant permanent access in Settings → Privacy → Microphone';
        } else if (isAndroid && language === 'zh') {
          msg = '请允许麦克风权限以使用语音功能。\n\nAndroid 提示：\n1. 在浏览器设置中允许麦克风权限\n2. 或在系统设置 → 应用 → 浏览器 → 权限中开启麦克风';
        } else if (isAndroid) {
          msg = 'Please allow microphone access.\n\nAndroid Tips:\n1. Allow microphone in browser settings\n2. Or enable in System Settings → Apps → Browser → Permissions';
        } else if (language === 'zh') {
          msg = '请允许麦克风权限以使用语音功能。\n\n提示：将应用添加到主屏幕可持久化权限。';
        } else {
          msg = 'Please allow microphone access.\n\nTip: Add to home screen to persist permissions.';
        }
        alert(msg);
      } else if (event.error === 'no-speech') {
        console.log('未检测到语音输入');
      } else if (event.error === 'audio-capture') {
        alert(language === 'zh' ? '无法捕获音频，请检查麦克风是否正常工作' : 'Cannot capture audio, please check if microphone is working');
      } else if (event.error === 'network') {
        alert(language === 'zh' ? '网络错误，请检查网络连接' : 'Network error, please check your connection');
      } else if (event.error === 'aborted') {
        console.log('语音识别被中断');
      } else {
        alert(language === 'zh' ? `语音识别错误: ${event.error}` : `Voice recognition error: ${event.error}`);
      }

      isRecordingRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    return recognition;
  };

  // 进入语音模式
  const enterVoiceMode = () => {
    setIsVoiceMode(true);
    setVoiceText('');
    isRecordingRef.current = false;
    recognitionRef.current = createRecognition();
  };

  // 退出语音模式
  const exitVoiceMode = () => {
    setIsVoiceMode(false);
    setVoiceText('');
    if (isRecordingRef.current && recognitionRef.current) {
      isRecordingRef.current = false;
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);
  };

  // 开始录音
  const startRecording = () => {
    if (isRecordingRef.current) return;
    if (!recognitionRef.current) {
      alert(language === 'zh' ? '您的浏览器不支持语音输入' : 'Voice input not supported');
      return;
    }

    setVoiceText('');
    isRecordingRef.current = true;
    setIsRecording(true);

    try {
      recognitionRef.current.start();
    } catch (e: any) {
      if (e.name === 'InvalidStateError' || e.message?.includes('already started')) {
        try {
          recognitionRef.current.stop();
        } catch {}
        setTimeout(() => {
          try {
            if (isRecordingRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (err) {
            console.error('无法启动语音识别:', err);
            isRecordingRef.current = false;
            setIsRecording(false);
          }
        }, 150);
      } else {
        console.error('无法启动语音识别:', e);
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  // 确认语音文字
  const confirmVoiceText = () => {
    if (voiceText.trim()) {
      setPrompt(prev => prev ? prev + ' ' + voiceText.trim() : voiceText.trim());
    }
    setIsVoiceMode(false);
    setVoiceText('');
  };

  // 页面恢复时检查是否有未完成的请求
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && pendingImageRequest && !isImageLoading) {
        const { prompt, referenceImage } = pendingImageRequest;
        setPendingImageRequest(null);
        setError(null);
        try {
          await generateImage(prompt, referenceImage);
        } catch (e) {
          setError(String(e));
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pendingImageRequest, isImageLoading]);

  // 组件挂载时也检查
  useEffect(() => {
    if (pendingImageRequest && !isImageLoading) {
      const { prompt, referenceImage } = pendingImageRequest;
      setPendingImageRequest(null);
      generateImage(prompt, referenceImage).catch((e) => setError(String(e)));
    }
  }, []);

  const getRatioLabel = (ratio: string): string => {
    if (imageModelId === 'gpt-image-2') {
      return GPT2_RATIO_LABELS[ratio] || ratio;
    }
    return ratio === 'auto' ? (language === 'zh' ? '自动' : 'Auto') : ratio;
  };

  const getQualityLabel = (quality: string): string => {
    if (imageModelId === 'gpt-image-2') {
      return GPT2_QUALITY_LABELS[quality] || quality;
    }
    return quality;
  };

  const availableRatios = imageModelId === 'gpt-image-2' && referenceImage
    ? currentModel.ratios.filter(r => ['1:1', '3:2', '2:3'].includes(r))
    : currentModel.ratios;

  const handleGenerate = async () => {
    if (!prompt.trim() || isImageLoading) return;
    setError(null);
    const promptText = prompt.trim();
    setPrompt('');

    try {
      await generateImage(promptText, referenceImage || undefined);
      setReferenceImage(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(language === 'zh' ? '请选择图片文件' : 'Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(language === 'zh' ? '图片大小不能超过 10MB' : 'Image size cannot exceed 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setReferenceImage(result);
      setError(null);
      if (imageModelId === 'gpt-image-2' && !['1:1', '3:2', '2:3'].includes(imageRatio)) {
        setImageRatio('1:1');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const filteredRecords = searchQuery.trim()
    ? imageRecords.filter(record =>
        record.prompt.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : imageRecords;

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => {
    setImageScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setImageScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setImageRotation(prev => (prev + 90) % 360);
  };

  const handleResetView = () => {
    setImageScale(1);
    setImageRotation(0);
  };

  const handleClosePreview = () => {
    setSelectedImage(null);
    handleResetView();
  };

  const handleDownloadAll = () => {
    if (imageRecords.length === 0) return;
    imageRecords.forEach((record, index) => {
      setTimeout(() => {
        handleDownload(record.imageUrl);
      }, index * 500);
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={clearImageRecords} className="btn-secondary" style={{ padding: 8 }}><Trash2 size={18} /></button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowQualityPicker(!showQualityPicker)} className="model-chip" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <Sliders size={14} style={{ marginRight: 4 }} />{getQualityLabel(imageQuality)}
          </button>
          <button onClick={() => setShowRatioPicker(!showRatioPicker)} className="model-chip" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            <Maximize2 size={14} style={{ marginRight: 4 }} />{getRatioLabel(imageRatio)}
          </button>
          <button onClick={() => setShowModelPicker(!showModelPicker)} className="model-chip" style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            {currentModel.name}
          </button>
        </div>
        <button onClick={handleDownloadAll} className="btn-secondary" style={{ padding: 8 }} title={T('downloadAll')}><Download size={18} /></button>
      </div>

      {/* Quality Picker */}
      {showQualityPicker && (
        <div style={{ position: 'absolute', top: 60, left: 16, right: 16, background: 'var(--bg-tertiary)', borderRadius: 16, padding: 12, zIndex: 100, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{T('quality')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {currentModel.qualities.map((q) => (
              <button key={q} onClick={() => { setImageQuality(q); setShowQualityPicker(false); }} style={{ padding: '10px 16px', background: imageQuality === q ? 'var(--accent-dim)' : 'var(--bg-secondary)', border: '1px solid ' + (imageQuality === q ? 'var(--accent)' : 'var(--border)'), borderRadius: 10, color: imageQuality === q ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {getQualityLabel(q)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ratio Picker */}
      {showRatioPicker && (
        <div style={{ position: 'absolute', top: 60, left: 16, right: 16, background: 'var(--bg-tertiary)', borderRadius: 16, padding: 12, zIndex: 100, border: '1px solid var(--border)', maxHeight: 300, overflow: 'auto' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{T('ratio')}{imageModelId === 'gpt-image-2' && referenceImage && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>（{T('referenceMode')}）</span>}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {availableRatios.map((r) => (
              <button key={r} onClick={() => { setImageRatio(r); setShowRatioPicker(false); }} style={{ padding: '10px 16px', background: imageRatio === r ? 'var(--accent-dim)' : 'var(--bg-secondary)', border: '1px solid ' + (imageRatio === r ? 'var(--accent)' : 'var(--border)'), borderRadius: 10, color: imageRatio === r ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {getRatioLabel(r)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model Picker */}
      {showModelPicker && (
        <div style={{ position: 'absolute', top: 60, left: 16, right: 16, background: 'var(--bg-tertiary)', borderRadius: 16, padding: 12, zIndex: 100, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>选择模型</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {IMAGE_MODELS.map((m) => (
              <button key={m.id} onClick={() => { setImageModelId(m.id); setShowModelPicker(false); }} style={{ padding: '10px 12px', background: imageModelId === m.id ? 'var(--accent-dim)' : 'var(--bg-secondary)', border: '1px solid ' + (imageModelId === m.id ? 'var(--accent)' : 'var(--border)'), borderRadius: 10, color: imageModelId === m.id ? 'var(--accent)' : 'var(--text-secondary)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: 6, fontSize: 12 }}>{m.tag}</span>{m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Images Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16, background: 'var(--bg-primary)' }}>
        {/* 搜索框 */}
        {imageRecords.length > 0 && (
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'zh' ? '搜索图片描述...' : 'Search image descriptions...'}
            style={{ marginBottom: 12, borderRadius: 12 }}
          />
        )}

        {storageWarning && (
          <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-orange)', fontSize: 13 }}>
            <AlertCircle size={16} /><span>{T('storageWarning')} ({imageRecords.length}/20)</span>
          </div>
        )}

        {isImageLoading && (
          <div style={{ textAlign: 'center', padding: 30, background: 'var(--bg-tertiary)', borderRadius: 16, marginBottom: 16 }}>
            <div style={{ width: 80, height: 80, margin: '0 auto 16px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 80, height: 80, border: '3px solid transparent', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ position: 'absolute', top: 10, left: 10, width: 60, height: 60, background: 'var(--accent-dim)', borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={28} style={{ color: 'var(--accent)' }} />
              </div>
            </div>
            <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 8 }}>{T('generateImage')}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{language === 'zh' ? 'AI 正在创作中，请稍候...' : 'AI is creating, please wait...'}</p>
            <div style={{ marginTop: 16, height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, animation: 'progress 2s ease-in-out infinite' }} />
            </div>
          </div>
        )}

        {filteredRecords.length > 0 ? (
          <div className="image-grid">
            {filteredRecords.map((record) => {
              const isSwiping = swipeId === record.id;

              return (
                <div
                  key={record.id}
                  style={{
                    position: 'relative',
                    borderRadius: 12,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transform: isSwiping ? `translateX(${swipeX}px)` : 'translateX(0)',
                    transition: isSwiping ? 'none' : 'transform 0.2s ease',
                  }}
                  onClick={() => {
                    if (Math.abs(swipeX) < 10) {
                      setSelectedImage(record.imageUrl);
                      handleResetView();
                    }
                  }}
                  onTouchStart={(e) => {
                    touchStartXRef.current = e.touches[0].clientX;
                    touchCurrentIdRef.current = record.id;
                  }}
                  onTouchMove={(e) => {
                    if (touchCurrentIdRef.current === record.id) {
                      const deltaX = e.touches[0].clientX - touchStartXRef.current;
                      setSwipeId(record.id);
                      setSwipeX(Math.max(-150, Math.min(150, deltaX)));
                    }
                  }}
                  onTouchEnd={() => {
                    if (swipeId === record.id) {
                      if (Math.abs(swipeX) > 80) {
                        hapticFeedback('medium');
                        deleteImageRecord(record.id);
                      }
                      setSwipeId(null);
                      setSwipeX(0);
                    }
                    touchCurrentIdRef.current = null;
                  }}
                >
                  {/* 删除指示背景 */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: swipeX < -50 ? 'var(--danger)' : swipeX > 50 ? 'var(--accent-blue)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: swipeX < 0 ? 'flex-end' : 'flex-start',
                    padding: swipeX < 0 ? '0 20px 0 0' : '0 0 0 20px',
                    borderRadius: 12,
                  }}>
                    {swipeX < -50 && <Trash2 size={24} color="white" />}
                    {swipeX > 50 && <Share2 size={24} color="white" />}
                  </div>

                  <img src={record.thumbnailUrl || record.imageUrl} alt={record.prompt} style={{ width: '100%', aspectRatio: 1, objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                    <p style={{ fontSize: 11, color: 'white', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.prompt}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                      <Clock size={10} />{new Date(record.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {/* 分享按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticFeedback('light');
                      shareImage(record.imageUrl, record.prompt);
                    }}
                    style={{ position: 'absolute', top: 4, left: 4, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <Share2 size={12} />
                  </button>
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); hapticFeedback('medium'); deleteImageRecord(record.id); }}
                    style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : imageRecords.length > 0 && searchQuery ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            <p>{T('noMatchingImages')}</p>
          </div>
        ) : !isImageLoading && (
          <div style={{ textAlign: 'center', marginTop: 80, padding: 40 }}>
            <div style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <ImageIcon size={36} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
            </div>
            <p style={{ marginBottom: 12, fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>{T('generateImage')}</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {T('inputDescription')}<br />
              {T('uploadReference')}
            </p>
          </div>
        )}

        {error && (
          <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, color: 'var(--danger)', fontSize: 14, marginTop: 16 }}>{error}</div>
        )}
      </div>

      {/* Reference Image Preview */}
      {referenceImage && (
        <div style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden' }}>
            <img src={referenceImage} alt={T('referenceImage')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={() => setReferenceImage(null)} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={12} />
            </button>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{T('referenceImage')}</span>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: 12, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        {/* 模板选择器 */}
        <div style={{ marginBottom: 8 }}>
          <button
            onClick={() => setShowTemplatePicker(!showTemplatePicker)}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Wand2 size={14} /> 提示词模板
          </button>
          {showTemplatePicker && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PROMPT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setPrompt(t.prompt); setShowTemplatePicker(false); }}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {isVoiceMode ? (
          /* 语音输入模式 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 语音识别结果显示区 */}
            <div
              style={{
                minHeight: 80,
                padding: 16,
                background: 'var(--bg-tertiary)',
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                fontSize: voiceText ? 16 : 14,
                color: voiceText ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {isRecording ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="voice-wave-container">
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                    <div className="voice-wave-bar" />
                  </div>
                  <span>{voiceText || (language === 'zh' ? '正在聆听...' : 'Listening...')}</span>
                </div>
              ) : (
                voiceText || (language === 'zh' ? '长按下方按钮开始录音' : 'Long press the button below to start recording')
              )}
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={exitVoiceMode}
                style={{
                  padding: '12px 24px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                }}
              >
                {T('cancel')}
              </button>

              {/* 长按录音按钮 */}
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  isPressingRef.current = true;
                  startRecording();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  if (isPressingRef.current) {
                    isPressingRef.current = false;
                    stopRecording();
                  }
                }}
                onTouchCancel={() => {
                  if (isPressingRef.current) {
                    isPressingRef.current = false;
                    stopRecording();
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  isPressingRef.current = true;
                  startRecording();
                }}
                onMouseUp={(e) => {
                  e.preventDefault();
                  if (isPressingRef.current) {
                    isPressingRef.current = false;
                    stopRecording();
                  }
                }}
                onMouseLeave={() => {
                  if (isPressingRef.current) {
                    isPressingRef.current = false;
                    stopRecording();
                  }
                }}
                style={{
                  flex: 1,
                  padding: 14,
                  background: isRecording ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: isRecording ? 'none' : '1px solid var(--border)',
                  borderRadius: 12,
                  color: isRecording ? 'white' : 'var(--text-primary)',
                  fontSize: 15,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'manipulation',
                }}
              >
                <Mic size={20} />
                {isRecording ? (language === 'zh' ? '松开结束' : 'Release to stop') : (language === 'zh' ? '按住说话' : 'Hold to speak')}
              </button>

              <button
                onClick={confirmVoiceText}
                disabled={!voiceText.trim()}
                style={{
                  padding: '12px 24px',
                  background: voiceText.trim() ? 'var(--accent)' : 'var(--bg-tertiary)',
                  border: 'none',
                  borderRadius: 12,
                  color: voiceText.trim() ? 'white' : 'var(--text-muted)',
                  fontSize: 14,
                }}
              >
                {language === 'zh' ? '确认' : 'Confirm'}
              </button>
            </div>
          </div>
        ) : (
          /* 普通输入模式 */
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary" style={{ padding: 12 }} title={T('uploadReference')}><Upload size={20} /></button>
            <button onClick={enterVoiceMode} className="btn-secondary" style={{ padding: 12 }} title={language === 'zh' ? '语音输入' : 'Voice input'}><Mic size={20} /></button>
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerate()} placeholder={T('describeImage')} style={{ flex: 1 }} />
            {isImageLoading ? (
              <button
                onClick={cancelImageRequest}
                style={{
                  padding: 12,
                  background: 'var(--danger)',
                  border: 'none',
                  borderRadius: 12,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <StopCircle size={20} />
              </button>
            ) : (
              <button onClick={handleGenerate} disabled={!prompt.trim()} className="btn-primary" style={{ padding: 12 }}>
                <Sparkles size={20} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div onClick={handleClosePreview} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: 20 }}>
          <div style={{ position: 'relative', overflow: 'hidden', maxWidth: '100%', maxHeight: '70vh' }}>
            <img
              src={selectedImage}
              alt=""
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                borderRadius: 12,
                transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                transition: 'transform 0.2s ease',
              }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                hapticFeedback('light');
                setImageScale(prev => prev >= 2 ? 1 : 2);
              }}
            />
          </div>

          {/* 缩放控制 */}
          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={handleZoomOut} className="btn-secondary" style={{ padding: 10 }}>
              <ZoomOut size={18} />
            </button>
            <span style={{ color: 'var(--text-muted)', fontSize: 14, minWidth: 60, textAlign: 'center' }}>
              {Math.round(imageScale * 100)}%
            </span>
            <button onClick={handleZoomIn} className="btn-secondary" style={{ padding: 10 }}>
              <ZoomIn size={18} />
            </button>
            <button onClick={handleRotate} className="btn-secondary" style={{ padding: 10 }}>
              <RotateCw size={18} />
            </button>
          </div>

          {/* 操作按钮 */}
          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, display: 'flex', gap: 12 }}>
            <button onClick={() => handleDownload(selectedImage)} className="btn-secondary">
              <Download size={18} style={{ marginRight: 6 }} />保存图片
            </button>
            <button onClick={handleResetView} className="btn-secondary">重置</button>
            <button onClick={handleClosePreview} className="btn-secondary">关闭</button>
          </div>

          <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>{T('doubleTapToZoom')} | {T('longPressSave')}</p>
        </div>
      )}
    </div>
  );
}
