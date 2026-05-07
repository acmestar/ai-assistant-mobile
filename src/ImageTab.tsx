import { useState } from 'react';
import { Image as ImageIcon, Sparkles, Loader2, Trash2, Download, ZoomIn } from 'lucide-react';
import { useAppStore, IMAGE_MODELS } from './store';
import { generateImage } from './api';

export default function ImageTab() {
  const { imageModelId, setImageModelId, generatedImages, isLoading, clearImages } = useAppStore();
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const currentModel = IMAGE_MODELS.find((m) => m.id === imageModelId);

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;

    setError(null);
    const promptText = prompt.trim();
    setPrompt('');

    try {
      await generateImage(promptText);
    } catch (e) {
      setError(String(e));
    }
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

        <button
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="model-chip"
          style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}
        >
          {currentModel?.name || '选择模型'}
        </button>

        <div style={{ width: 36 }} />
      </div>

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
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60 }}>
            <ImageIcon size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>输入描述生成图片</p>
          </div>
        )}

        {error && (
          <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, color: 'var(--danger)', fontSize: 14, marginTop: 16 }}>
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: 12, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="描述你想生成的图片..."
            style={{ flex: 1 }}
          />

          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="btn-primary"
            style={{ padding: 12 }}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
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