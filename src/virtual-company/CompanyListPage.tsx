// AI 公司列表页
import { useState } from 'react';
import {
  Building2,
  Plus,
  ChevronRight,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '../store';
import { AICompany } from './types';

export default function CompanyListPage({ onSelectCompany, onCreateCompany, onSmartCreate }: {
  onSelectCompany: (companyId: string) => void;
  onCreateCompany: () => void;
  onSmartCreate: () => void;
}) {
  const { language, aiCompanies, deleteAICompany } = useAppStore();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteAICompany(id);
    setShowDeleteConfirm(null);
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
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={20} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            {language === 'zh' ? '我的 AI 公司' : 'My AI Companies'}
          </span>
        </div>
        <button
          onClick={onSmartCreate}
          style={{
            padding: '6px 12px',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-blue))',
            border: 'none',
            borderRadius: 8,
            color: 'white',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Sparkles size={14} />
          {language === 'zh' ? '智能建档' : 'Smart Create'}
        </button>
        <button
          onClick={onCreateCompany}
          style={{
            padding: '6px 12px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text-secondary)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Plus size={14} />
          {language === 'zh' ? '手动创建' : 'Manual'}
        </button>
      </div>

      {/* 公司列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {aiCompanies.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 60,
            color: 'var(--text-muted)',
          }}>
            <Building2 size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
            <p style={{ fontSize: 14, marginBottom: 8 }}>
              {language === 'zh' ? '还没有创建 AI 公司' : 'No companies yet'}
            </p>
            <p style={{ fontSize: 12, marginBottom: 16 }}>
              {language === 'zh'
                ? '创建一家 AI 公司，让它帮你解决问题、开晨会、管理任务'
                : 'Create an AI company to solve problems, hold meetings, and manage tasks'}
            </p>
            <button
              onClick={onCreateCompany}
              className="btn-primary"
              style={{ padding: '10px 20px' }}
            >
              {language === 'zh' ? '创建第一家 AI 公司' : 'Create First Company'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {aiCompanies.map((company: AICompany) => (
              <div
                key={company.id}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 12,
                  padding: 16,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {company.name}
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {company.purpose}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(company.id);
                      }}
                      style={{
                        padding: 4,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* 公司信息标签 */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {company.industry && (
                    <span style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      🏭 {company.industry}
                    </span>
                  )}
                  {company.stage && (
                    <span style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      📊 {company.stage}
                    </span>
                  )}
                  <span style={{ padding: '4px 8px', background: 'var(--accent-dim)', borderRadius: 6, fontSize: 11, color: 'var(--accent)' }}>
                    👥 {company.agents?.length || 0} {language === 'zh' ? '位专家' : 'agents'}
                  </span>
                </div>

                {/* 统计信息 */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>📋 {company.tasks?.filter(t => t.status === 'todo').length || 0} {language === 'zh' ? '待办' : 'tasks'}</span>
                  <span>📝 {company.memories?.length || 0} {language === 'zh' ? '记忆' : 'memories'}</span>
                  <span>📅 {company.meetings?.length || 0} {language === 'zh' ? '会议' : 'meetings'}</span>
                </div>

                {/* 进入按钮 */}
                <button
                  onClick={() => onSelectCompany(company.id)}
                  style={{
                    width: '100%',
                    padding: 10,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-secondary)',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  {language === 'zh' ? '进入公司工作台' : 'Enter Workspace'}
                  <ChevronRight size={14} />
                </button>

                {/* 删除确认 */}
                {showDeleteConfirm === company.id && (
                  <div style={{
                    marginTop: 12,
                    padding: 12,
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: 8,
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}>
                    <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>
                      {language === 'zh' ? '确定删除这家公司？所有数据将无法恢复。' : 'Delete this company? All data will be lost.'}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleDelete(company.id)}
                        style={{
                          flex: 1,
                          padding: 8,
                          background: 'var(--danger)',
                          border: 'none',
                          borderRadius: 6,
                          color: 'white',
                          fontSize: 11,
                        }}
                      >
                        {language === 'zh' ? '确认删除' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        style={{
                          flex: 1,
                          padding: 8,
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          color: 'var(--text-secondary)',
                          fontSize: 11,
                        }}
                      >
                        {language === 'zh' ? '取消' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
