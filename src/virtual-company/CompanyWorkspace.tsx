// AI 公司工作台 - 公司详情页
import { useState } from 'react';
import {
  Brain,
  CheckSquare,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  Sunrise,
  Target,
  ClipboardList,
  X,
  CheckCircle,
} from 'lucide-react';
import { useAppStore } from '../store';
import { AICompany, CompanyAgent, CompanyMemory, CompanyTask, CompanyRisk, CompanyMeeting, TaskStatus } from './types';

interface CompanyWorkspaceProps {
  companyId: string;
  onBack: () => void;
  onStartMeeting: (meetingType: string) => void;
}

export default function CompanyWorkspace({ companyId, onBack, onStartMeeting }: CompanyWorkspaceProps) {
  const { language, aiCompanies, updateAICompany, completeCompanyTask } = useAppStore();
  const company = aiCompanies.find((c: AICompany) => c.id === companyId);

  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'memories' | 'tasks' | 'risks' | 'meetings'>('overview');
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  if (!company) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        {language === 'zh' ? '公司不存在' : 'Company not found'}
      </div>
    );
  }

  const renderOverview = () => (
    <div style={{ padding: 16 }}>
      {/* 公司档案 */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        border: '1px solid var(--border)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
          {language === 'zh' ? '📋 公司档案' : '📋 Company Profile'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{language === 'zh' ? '使命' : 'Purpose'}</span>
            <p style={{ color: 'var(--text-primary)', fontSize: 14, marginTop: 4 }}>{company.purpose}</p>
          </div>
          {company.industry && (
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{language === 'zh' ? '行业' : 'Industry'}</span>
              <p style={{ color: 'var(--text-primary)', fontSize: 14, marginTop: 4 }}>{company.industry}</p>
            </div>
          )}
          {company.stage && (
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{language === 'zh' ? '阶段' : 'Stage'}</span>
              <p style={{ color: 'var(--text-primary)', fontSize: 14, marginTop: 4 }}>{company.stage}</p>
            </div>
          )}
          {company.targetUsers && company.targetUsers.length > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{language === 'zh' ? '目标用户' : 'Target Users'}</span>
              <p style={{ color: 'var(--text-primary)', fontSize: 14, marginTop: 4 }}>{company.targetUsers.join('、')}</p>
            </div>
          )}
          {company.products && company.products.length > 0 && (
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{language === 'zh' ? '产品/服务' : 'Products/Services'}</span>
              <p style={{ color: 'var(--text-primary)', fontSize: 14, marginTop: 4 }}>{company.products.join('、')}</p>
            </div>
          )}
          {company.businessModel && (
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{language === 'zh' ? '商业模式' : 'Business Model'}</span>
              <p style={{ color: 'var(--text-primary)', fontSize: 14, marginTop: 4 }}>{company.businessModel}</p>
            </div>
          )}
        </div>
      </div>

      {/* 快速统计 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}>
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 12,
          textAlign: 'center',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent)' }}>
            {company.agents?.length || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {language === 'zh' ? '专家' : 'Agents'}
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 12,
          textAlign: 'center',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent-blue)' }}>
            {company.tasks?.filter(t => t.status !== 'done').length || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {language === 'zh' ? '任务' : 'Tasks'}
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 12,
          textAlign: 'center',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--accent-orange)' }}>
            {company.memories?.length || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {language === 'zh' ? '记忆' : 'Memories'}
          </div>
        </div>
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 12,
          textAlign: 'center',
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--danger)' }}>
            {company.risks?.filter(r => r.status === 'active').length || 0}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {language === 'zh' ? '风险' : 'Risks'}
          </div>
        </div>
      </div>

      {/* 快速操作 */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        border: '1px solid var(--border)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
          {language === 'zh' ? '🚀 快速操作' : '🚀 Quick Actions'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <button
            onClick={() => onStartMeeting('morning')}
            style={{
              padding: 14,
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--accent)',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <Sunrise size={18} />
            {language === 'zh' ? '开晨会' : 'Morning Meeting'}
          </button>
          <button
            onClick={() => onStartMeeting('strategy')}
            style={{
              padding: 14,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-secondary)',
              fontSize: 13,
            }}
          >
            <Target size={18} />
            {language === 'zh' ? '战略会' : 'Strategy Meeting'}
          </button>
          <button
            onClick={() => onStartMeeting('review')}
            style={{
              padding: 14,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-secondary)',
              fontSize: 13,
            }}
          >
            <ClipboardList size={18} />
            {language === 'zh' ? '项目评审' : 'Project Review'}
          </button>
          <button
            onClick={() => onStartMeeting('risk')}
            style={{
              padding: 14,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--text-secondary)',
              fontSize: 13,
            }}
          >
            <AlertTriangle size={18} />
            {language === 'zh' ? '风险会' : 'Risk Meeting'}
          </button>
        </div>
      </div>

      {/* 最近会议 */}
      {company.meetings && company.meetings.length > 0 && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: 16,
          padding: 16,
          border: '1px solid var(--border)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
            {language === 'zh' ? '📅 最近会议' : '📅 Recent Meetings'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {company.meetings.slice(-3).reverse().map((meeting: CompanyMeeting) => (
              <div
                key={meeting.id}
                style={{
                  padding: 12,
                  background: 'var(--bg-tertiary)',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {meeting.type === 'morning' && (language === 'zh' ? '晨会' : 'Morning Meeting')}
                    {meeting.type === 'strategy' && (language === 'zh' ? '战略会' : 'Strategy Meeting')}
                    {meeting.type === 'review' && (language === 'zh' ? '项目评审' : 'Project Review')}
                    {meeting.type === 'risk' && (language === 'zh' ? '风险会' : 'Risk Meeting')}
                    {meeting.type === 'retrospective' && (language === 'zh' ? '复盘会' : 'Retrospective')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(meeting.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {meeting.result?.informationSummary?.slice(0, 100)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderAgents = () => (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {company.agents?.map((agent: CompanyAgent) => (
          <div
            key={agent.id}
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 12,
              padding: 16,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--accent-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                fontSize: 16,
                fontWeight: 600,
              }}>
                {agent.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{agent.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{agent.role}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
              {agent.background}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {agent.focusAreas?.slice(0, 3).map((area, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 6,
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMemories = () => (
    <div style={{ padding: 16 }}>
      {company.memories?.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <Brain size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 13 }}>{language === 'zh' ? '暂无公司记忆' : 'No memories yet'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {company.memories?.map((memory: CompanyMemory) => (
            <div
              key={memory.id}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 12,
                padding: 14,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  padding: '2px 8px',
                  background: memory.importance === 'high' ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                  borderRadius: 6,
                  fontSize: 11,
                  color: memory.importance === 'high' ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {memory.type}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(memory.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {memory.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTasks = () => (
    <div style={{ padding: 16 }}>
      {/* 完成任务弹窗 */}
      {completingTaskId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: 20,
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: 16,
            padding: 20,
            maxWidth: 320,
            width: '100%',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {language === 'zh' ? '完成任务' : 'Complete Task'}
              </span>
              <button onClick={() => { setCompletingTaskId(null); setCompletionNote(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <textarea
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder={language === 'zh' ? '添加完成备注（可选）...' : 'Add completion note (optional)...'}
              style={{
                width: '100%',
                minHeight: 80,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                resize: 'vertical',
              }}
            />
            <button
              onClick={() => {
                completeCompanyTask(companyId, completingTaskId, completionNote);
                setCompletingTaskId(null);
                setCompletionNote('');
              }}
              style={{
                width: '100%',
                marginTop: 12,
                padding: 12,
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                fontSize: 14,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <CheckCircle size={16} />
              {language === 'zh' ? '确认完成' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {company.tasks?.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <CheckSquare size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 13 }}>{language === 'zh' ? '暂无任务' : 'No tasks yet'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {company.tasks?.map((task: CompanyTask) => {
            // 查找关联的目标和风险
            const relatedGoal = task.relatedGoalId ? company.goals?.find(g => g.id === task.relatedGoalId) : undefined;
            const relatedRisks = task.relatedRiskIds?.map(id => company.risks?.find(r => r.id === id)).filter(Boolean);
            const assignee = task.assigneeId ? company.agents?.find(a => a.id === task.assigneeId) : undefined;

            return (
              <div
                key={task.id}
                style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 12,
                  padding: 14,
                  border: '1px solid var(--border)',
                  opacity: task.status === 'done' ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={task.status === 'done'}
                    onChange={() => {
                      if (task.status === 'todo' || task.status === 'doing') {
                        // 完成任务时弹出备注框
                        setCompletingTaskId(task.id);
                      } else {
                        // 取消完成，直接更新状态
                        const newStatus: TaskStatus = 'todo';
                        const updatedTasks = company.tasks?.map(t =>
                          t.id === task.id ? { ...t, status: newStatus } : t
                        );
                        updateAICompany(companyId, { tasks: updatedTasks });
                      }
                    }}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', textDecoration: task.status === 'done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </div>
                    {task.description && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{task.description}</p>
                    )}

                    {/* 关联信息 */}
                    {(relatedGoal || relatedRisks?.length || assignee) && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {relatedGoal && (
                          <span style={{
                            padding: '2px 6px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: 4,
                            fontSize: 10,
                            color: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}>
                            <Target size={10} />
                            {relatedGoal.title}
                          </span>
                        )}
                        {relatedRisks?.map(risk => risk && (
                          <span key={risk.id} style={{
                            padding: '2px 6px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: 4,
                            fontSize: 10,
                            color: 'var(--danger)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}>
                            <AlertTriangle size={10} />
                            {risk.title}
                          </span>
                        ))}
                        {assignee && (
                          <span style={{
                            padding: '2px 6px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: 4,
                            fontSize: 10,
                            color: 'var(--accent-blue)',
                          }}>
                            @{assignee.name}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 截止日期和完成时间 */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                      <span style={{
                        padding: '2px 6px',
                        background: task.priority === 'high' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-tertiary)',
                        borderRadius: 4,
                        fontSize: 10,
                        color: task.priority === 'high' ? 'var(--danger)' : 'var(--text-muted)',
                      }}>
                        {task.priority}
                      </span>
                      {task.dueDate && task.status !== 'done' && (
                        <span style={{
                          fontSize: 10,
                          color: new Date(task.dueDate) < new Date() ? 'var(--danger)' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}>
                          <Calendar size={10} />
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {task.completedAt && (
                        <span style={{ fontSize: 10, color: 'var(--accent)' }}>
                          ✓ {new Date(task.completedAt).toLocaleDateString()}
                        </span>
                      )}
                      {!task.completedAt && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(task.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* 完成备注 */}
                    {task.completionNote && (
                      <div style={{
                        marginTop: 8,
                        padding: 8,
                        background: 'var(--bg-tertiary)',
                        borderRadius: 6,
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                      }}>
                        💬 {task.completionNote}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderRisks = () => (
    <div style={{ padding: 16 }}>
      {company.risks?.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <AlertTriangle size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 13 }}>{language === 'zh' ? '暂无风险记录' : 'No risks recorded'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {company.risks?.map((risk: CompanyRisk) => (
            <div
              key={risk.id}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 12,
                padding: 14,
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${
                  risk.severity === 'critical' ? 'var(--danger)' :
                  risk.severity === 'high' ? 'var(--accent-orange)' :
                  risk.severity === 'medium' ? 'var(--accent-blue)' : 'var(--text-muted)'
                }`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {risk.title}
                </span>
                <span style={{
                  padding: '2px 6px',
                  background: risk.status === 'active' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-tertiary)',
                  borderRadius: 4,
                  fontSize: 10,
                  color: risk.status === 'active' ? 'var(--danger)' : 'var(--text-muted)',
                }}>
                  {risk.status}
                </span>
              </div>
              {risk.description && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{risk.description}</p>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {new Date(risk.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMeetings = () => (
    <div style={{ padding: 16 }}>
      {company.meetings?.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <Calendar size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <p style={{ fontSize: 13 }}>{language === 'zh' ? '暂无会议记录' : 'No meetings yet'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {company.meetings?.slice().reverse().map((meeting: CompanyMeeting) => (
            <div
              key={meeting.id}
              style={{
                background: 'var(--bg-secondary)',
                borderRadius: 12,
                padding: 16,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{
                  padding: '4px 10px',
                  background: 'var(--accent-dim)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}>
                  {meeting.type === 'morning' && (language === 'zh' ? '晨会' : 'Morning')}
                  {meeting.type === 'strategy' && (language === 'zh' ? '战略会' : 'Strategy')}
                  {meeting.type === 'review' && (language === 'zh' ? '项目评审' : 'Review')}
                  {meeting.type === 'risk' && (language === 'zh' ? '风险会' : 'Risk')}
                  {meeting.type === 'retrospective' && (language === 'zh' ? '复盘会' : 'Retrospective')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {new Date(meeting.createdAt).toLocaleString()}
                </span>
              </div>

              {meeting.result && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 10 }}>
                    {meeting.result.informationSummary}
                  </p>

                  {meeting.result.actions?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {language === 'zh' ? '今日行动:' : 'Today\'s Actions:'}
                      </span>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {meeting.result.actions.slice(0, 3).map((action: string, idx: number) => (
                          <li key={idx} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            padding: 6,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{company.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {company.industry || (language === 'zh' ? 'AI 虚拟公司' : 'AI Virtual Company')}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 12px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {[
          { key: 'overview', label: language === 'zh' ? '概览' : 'Overview' },
          { key: 'agents', label: language === 'zh' ? '团队' : 'Team' },
          { key: 'memories', label: language === 'zh' ? '记忆' : 'Memory' },
          { key: 'tasks', label: language === 'zh' ? '任务' : 'Tasks' },
          { key: 'risks', label: language === 'zh' ? '风险' : 'Risks' },
          { key: 'meetings', label: language === 'zh' ? '会议' : 'Meetings' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '8px 14px',
              background: activeTab === tab.key ? 'var(--accent-dim)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'agents' && renderAgents()}
        {activeTab === 'memories' && renderMemories()}
        {activeTab === 'tasks' && renderTasks()}
        {activeTab === 'risks' && renderRisks()}
        {activeTab === 'meetings' && renderMeetings()}
      </div>
    </div>
  );
}
