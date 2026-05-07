import { useState, useRef } from 'react';
import { Image as ImageIcon, Sparkles, Loader2, Trash2, Download, ZoomIn, Upload, X, Maximize2 } from 'lucide-react';
import { useAppStore, IMAGE_MODELS, IMAGE_RATIOS } from './store';
import { generateImage } from './api';

export default function ImageTab() {
  const { imageModelId, setImageModelId, imageRatio, setImageRatio, generatedImages, isImageLoading, clearImages } = useAppStore();
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showRatioPicker, setShowRatioPicker] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentModel = IMAGE_MODELS.find((m) => m.id === imageModelId);
  const currentRatio = IMAGE_RATIOS.find((r) => r.id === imageRatio) || IMAGE_RATIOS[0];

  const handleGenerate = async () => {
    if (!prompt.trim() || isImageLoading) return;

    setError(null);
    const promptText = prompt.trim();
    setPrompt('');

    try {
      await generateImage(promptText, referenceImage || undefined);
      // 生成成功后清除参考图
      setReferenceImage(null);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }

    // 检查文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setReferenceImage(result);
      setError(null);
    };
    reader.readAsDataURL(file);

    // 清除 input，允许重复选择同一文件
    e.target.value = '';
  };

  const handleDownload = async (url: string) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-image-${Date.now()}.png`;
      link.click();
    } catch {}
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
      }}>
        <button onClick={clearImages} className="btn-secondary" style={{ padding: 8 }}>
          <Trash2 size={18} />
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* 比例选择 */}
          <button
            onClick={() => setShowRatioPicker(!showRatioPicker)}
            className="model-chip"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <Maximize2 size={14} style={{ marginRight: 4 }} />
            {currentRatio.label}
          </button>

          {/* 模型选择 */}
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="model-chip"
            style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
          >
            {currentModel?.name || '选择模型'}
          </button>
        </div>

        <div style={{ width: 36 }} />
      </div>

      {/* Ratio Picker */}
      {showRatioPicker && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 16,
          right: 16,
          background: 'var(--bg-tertiary)',
          borderRadius: 16,
          padding: 12,
          zIndex: 100,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>图片比例</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {IMAGE_RATIOS.map((r) => (
              <button
                key={r.id}
                onClick={() => { setImageRatio(r.id); setShowRatioPicker(false); }}
                style={{
                  padding: '10px 16px',
                  background: imageRatio === r.id ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  border: '1px solid ' + (imageRatio === r.id ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 10,
                  color: imageRatio === r.id ? 'var(--accent)' : 'var(--text-secondary)',
                  flex: 1,
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Model Picker */}
      {showModelPicker && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 16,
          right: 16,
          background: 'var(--bg-tertiary)',
          borderRadius: 16,
          padding: 12,
          zIndex: 100,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>选择模型</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {IMAGE_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { setImageModelId(m.id); setShowModelPicker(false); }}
                style={{
                  padding: '10px 12px',
                  background: imageModelId === m.id ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  border: '1px solid ' + (imageModelId === m.id ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 10,
                  color: imageModelId === m.id ? 'var(--accent)' : 'var(--text-secondary)',
                  textAlign: 'left',
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Images Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Loading indicator */}
        {isImageLoading && (
          <div style={{
            textAlign: 'center',
            padding: 20,
            background: 'var(--bg-tertiary)',
            borderRadius: 12,
            marginBottom: 16,
          }}>
            <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)', marginBottom: 8 }} />
            <p style={{ color: 'var(--text-secondary)' }}>正在生成图片...</p>
          </div>
        )}

        {generatedImages.length > 0 ? (
          <div className="image-grid">
            {generatedImages.map((url, i) => (
              <div
                key={i}
                onClick={() => setSelectedImage(url)}
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
              >
                <img src={url} alt="" style={{ width: '100%', aspectRatio: 1, objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 8,
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                  display: 'flex',
                  justifyContent: 'center',
                }}>
                  <ZoomIn size={20} color="white" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          !isImageLoading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60 }}>
              <ImageIcon size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p>输入描述生成图片</p>
              <p style={{ fontSize: 12, marginTop: 8 }}>可上传参考图辅助生成</p>
            </div>
          )
        )}

        {error && (
          <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, color: 'var(--danger)', fontSize: 14, marginTop: 16 }}>
            {error}
          </div>
        )}
      </div>

      {/* Reference Image Preview */}
      {referenceImage && (
        <div style={{
          padding: '8px 16px',
          background: 'var(--bg-tertiary)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            position: 'relative',
            width: 60,
            height: 60,
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <img src={referenceImage} alt="参考图" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button
              onClick={() => setReferenceImage(null)}
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)',
                border: 'none',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={12} />
            </button>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>参考图已上传</span>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: 12, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* 上传按钮 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary"
            style={{ padding: 12 }}
            title="上传参考图"
          >
            <Upload size={20} />
          </button>

          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="描述你想生成的图片..."
            style={{ flex: 1 }}
          />

          <button
            onClick={handleGenerate}
            disabled={isImageLoading || !prompt.trim()}
            className="btn-primary"
            style={{ padding: 12 }}
          >
            {isImageLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          </button>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            padding: 20,
          }}
        >
          <img
            src={selectedImage}
            alt=""
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 12 }}
          />
          <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
            <button onClick={() => handleDownload(selectedImage)} className="btn-secondary">
              <Download size={18} style={{ marginRight: 6 }} />
              保存图片
            </button>
            <button onClick={() => setSelectedImage(null)} className="btn-secondary">
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}