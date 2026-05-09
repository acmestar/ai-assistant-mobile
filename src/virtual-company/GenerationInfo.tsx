// 生成信息组件 - 展示模型来源和角色协作
import { useState } from 'react';
import { ChevronDown, ChevronUp, Info, Users } from 'lucide-react';
import { GenerationSourceSummary, MODEL_NAMES } from './modelRouter';

interface GenerationInfoProps {
  sourceSummary: GenerationSourceSummary;
  language?: 'zh' | 'en';
}

export default function GenerationInfo({ sourceSummary, language = 'zh' }: GenerationInfoProps) {
  const [expanded, setExpanded] = useState(false);

  const modeLabels = {
    fast: language === 'zh' ? '快速模式' : 'Fast Mode',
    standard: language === 'zh' ? '标准模式' : 'Standard Mode',
    deep: language === 'zh' ? '深度模式' : 'Deep Mode',
  };

  const { usedModels, finalModel, generatedAt } = sourceSummary;

  // 获取唯一的角色列表
  const uniqueRoles = [...new Set(usedModels.map(m => m.roleName))];

  return (
    <div style={{
      marginTop: 16,
      padding: 12,
      background: 'var(--bg-secondary)',
      borderRadius: 10,
      border: '1px solid var(--border)',
    }}>
      {/* 简要信息 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Info size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {language === 'zh' ? '生成信息' : 'Generation Info'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {modeLabels[sourceSummary.mode]}
          </span>
          {expanded ? (
            <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
          ) : (
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
      </div>

      {/* 展开详情 */}
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {/* 模式和角色 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}>
            <Users size={12} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {language === 'zh' ? '参与角色：' : 'Roles: '}
            </span>
            {uniqueRoles.map((role, idx) => (
              <span
                key={idx}
                style={{
                  padding: '2px 8px',
                  background: 'var(--accent-dim)',
                  borderRadius: 6,
                  fontSize: 10,
                  color: 'var(--accent)',
                }}
              >
                {role}
              </span>
            ))}
          </div>

          {/* 模型来源 */}
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginBottom: 8,
              borderBottom: '1px solid var(--border)',
              paddingBottom: 4,
            }}>
              {language === 'zh' ? '模型来源' : 'Model Sources'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {usedModels.map((model, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: 8,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {model.roleName}
                      </span>
                      {model.isFallback && (
                        <span style={{
                          padding: '1px 4px',
                          background: 'rgba(245, 158, 11, 0.1)',
                          borderRadius: 4,
                          fontSize: 9,
                          color: 'var(--accent-orange)',
                        }}>
                          {language === 'zh' ? '备用' : 'Fallback'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {model.modelName} · {model.responsibility}
                    </div>
                  </div>
                  {model.latencyMs && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {model.latencyMs}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 最终整合模型 */}
          <div style={{
            padding: 8,
            background: 'var(--accent-dim)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, color: 'var(--accent)' }}>
              {language === 'zh' ? '最终整合' : 'Final Synthesis'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--accent)' }}>
              {MODEL_NAMES[finalModel]}
            </span>
          </div>

          {/* 生成时间 */}
          <div style={{
            marginTop: 8,
            fontSize: 10,
            color: 'var(--text-muted)',
            textAlign: 'right',
          }}>
            {new Date(generatedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
