import { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Sparkles, Loader2, Trash2, Download, Upload, X, Maximize2, Clock, Sliders, AlertCircle, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useAppStore, IMAGE_MODELS, GPT2_RATIO_LABELS, GPT2_QUALITY_LABELS, getImageModelDef } from './store';
import { generateImage } from './api';

export default function ImageTab() {
  const { imageModelId, setImageModelId, imageRatio, setImageRatio, imageQuality, setImageQuality, imageRecords, isImageLoading, deleteImageRecord, clearImageRecords, pendingImageRequest, setPendingImageRequest } = useAppStore();
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showRatioPicker, setShowRatioPicker] = useState(false);
  const [showQualityPicker, setShowQualityPicker] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentModel = getImageModelDef(imageModelId);
  const storageWarning = imageRecords.length >= 15;

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
    return ratio === 'auto' ? '自动' : ratio;
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
      setError('请选择图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过 10MB');
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
        <button onClick={handleDownloadAll} className="btn-secondary" style={{ padding: 8 }} title="批量下载"><Download size={18} /></button>
      </div>

      {/* Quality Picker */}
      {showQualityPicker && (
        <div style={{ position: 'absolute', top: 60, left: 16, right: 16, background: 'var(--bg-tertiary)', borderRadius: 16, padding: 12, zIndex: 100, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>分辨率</div>
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
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>图片比例{imageModelId === 'gpt-image-2' && referenceImage && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>（参考图模式）</span>}</div>
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
            placeholder="搜索图片描述..."
            style={{ marginBottom: 12, borderRadius: 12 }}
          />
        )}

        {storageWarning && (
          <div style={{ padding: 12, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-orange)', fontSize: 13 }}>
            <AlertCircle size={16} /><span>存储空间即将满（{imageRecords.length}/20），请及时下载保存重要图片</span>
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
            <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 8 }}>正在生成图片</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>AI 正在创作中，请稍候...</p>
            <div style={{ marginTop: 16, height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, animation: 'progress 2s ease-in-out infinite' }} />
            </div>
          </div>
        )}

        {filteredRecords.length > 0 ? (
          <div className="image-grid">
            {filteredRecords.map((record) => (
              <div key={record.id} onClick={() => { setSelectedImage(record.imageUrl); handleResetView(); }} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
                <img src={record.thumbnailUrl || record.imageUrl} alt={record.prompt} style={{ width: '100%', aspectRatio: 1, objectFit: 'cover' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                  <p style={{ fontSize: 11, color: 'white', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.prompt}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                    <Clock size={10} />{new Date(record.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteImageRecord(record.id); }} style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : imageRecords.length > 0 && searchQuery ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
            <p>未找到匹配的图片</p>
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
            <p style={{ marginBottom: 12, fontSize: 18, fontWeight: 500, color: 'var(--text-primary)' }}>生成图片</p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              输入描述让 AI 为你创作<br />
              可上传参考图辅助生成
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
            <img src={referenceImage} alt="参考图" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={() => setReferenceImage(null)} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={12} />
            </button>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>参考图已上传</span>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: 12, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary" style={{ padding: 12 }} title="上传参考图"><Upload size={20} /></button>
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerate()} placeholder="描述你想生成的图片..." style={{ flex: 1 }} />
          <button onClick={handleGenerate} disabled={isImageLoading || !prompt.trim()} className="btn-primary" style={{ padding: 12 }}>
            {isImageLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          </button>
        </div>
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

          <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>双指缩放 | 长按保存到手机</p>
        </div>
      )}
    </div>
  );
}
