// 创建 AI 公司向导
import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Loader2,
  Zap,
  Target,
  Briefcase,
} from 'lucide-react';
import { useAppStore } from '../store';
import { CompanyAgent } from './types';
import { callModel, UserMode, clearSessionModels } from './modelRouter';

interface CreateCompanyPageProps {
  onBack: () => void;
  onComplete: (companyId: string) => void;
}

export default function CreateCompanyPage({ onBack, onComplete }: CreateCompanyPageProps) {
  const { language, createAICompany, apiKey } = useAppStore();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: 基本信息
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [industry, setIndustry] = useState('');
  const [stage, setStage] = useState('');

  // Step 2: 产品与用户
  const [targetUsers, setTargetUsers] = useState('');
  const [products, setProducts] = useState('');
  const [businessModel, setBusinessModel] = useState('');

  // Step 3: 团队规模
  const [agentCount, setAgentCount] = useState(5);

  // 用户模式
  const [userMode, setUserMode] = useState<UserMode>('standard');

  const totalSteps = 3;

  const handleCreate = async () => {
    if (!name || !purpose) return;

    setLoading(true);

    // 创建会话 ID 用于追踪模型调用
    const sessionId = `create-company-${Date.now()}`;
    clearSessionModels(sessionId);

    try {
      // 调用 AI 生成团队
      const agents = await generateAgents(sessionId);

      const companyId = createAICompany({
        name,
        purpose,
        industry,
        stage,
        targetUsers: targetUsers ? targetUsers.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        products: products ? products.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [],
        businessModel,
        agents,
        memories: [],
        goals: [],
        tasks: [],
        risks: [],
        meetings: [],
      });

      onComplete(companyId);
    } catch (error) {
      console.error('Failed to create company:', error);
      setLoading(false);
    }
  };

  const generateAgents = async (sessionId: string): Promise<CompanyAgent[]> => {
    if (!apiKey) {
      // 返回默认团队
      return getDefaultAgents();
    }

    try {
      // 使用 ModelRouter 调用模型
      const result = await callModel<CompanyAgent[]>(
        'agent_team_generation',
        {
          prompt: `公司名称: ${name}
公司使命: ${purpose}
行业: ${industry || '未指定'}
发展阶段: ${stage || '未指定'}
目标用户: ${targetUsers || '未指定'}
产品/服务: ${products || '未指定'}
商业模式: ${businessModel || '未指定'}
团队人数: ${agentCount} 人

请生成 ${agentCount} 位核心团队成员，覆盖产品、技术、运营、市场、财务等关键职能。`,
          systemPrompt: `你是一个企业组织架构专家。根据用户提供的公司信息，生成一个合理的团队配置。
返回 JSON 数组，每个成员包含：
- id: 唯一ID (uuid格式)
- name: 中文名
- role: 职位
- department: 部门
- personality: 性格特点 (一句话)
- background: 背景经历 (一句话)
- responsibilities: 负责事项 (数组，3-5项)
- focusAreas: 关注领域 (数组，2-3项)
- speakingStyle: 说话风格 (一句话)
- decisionPower: 决策权限 (一句话)
- reviewOrder: 发言顺序 (数字，1-${agentCount})

只返回 JSON 数组，不要其他内容。`,
        },
        {
          mode: userMode,
          companyId: sessionId,
          requireJson: true,
        }
      );

      if (result.success && Array.isArray(result.data)) {
        return result.data;
      }

      return getDefaultAgents();
    } catch (error) {
      console.error('Failed to generate agents:', error);
      return getDefaultAgents();
    }
  };

  const getDefaultAgents = (): CompanyAgent[] => {
    const defaultRoles = [
      { name: '张明', role: 'CEO', department: '管理层', personality: '果断务实，善于决策', background: '10年企业管理经验', responsibilities: ['战略决策', '资源协调', '对外代表'], focusAreas: ['战略规划', '业务增长'], speakingStyle: '简洁有力，直击要点', decisionPower: '最终决策权', reviewOrder: 1 },
      { name: '李华', role: '产品总监', department: '产品部', personality: '用户导向，注重细节', background: '5年产品管理经验', responsibilities: ['产品规划', '需求分析', '用户体验'], focusAreas: ['产品设计', '用户需求'], speakingStyle: '数据驱动，逻辑清晰', decisionPower: '产品决策权', reviewOrder: 2 },
      { name: '王强', role: '技术总监', department: '技术部', personality: '技术严谨，追求稳定', background: '8年技术开发经验', responsibilities: ['技术架构', '研发管理', '技术选型'], focusAreas: ['技术实现', '系统稳定'], speakingStyle: '技术视角，风险意识强', decisionPower: '技术决策权', reviewOrder: 3 },
      { name: '陈静', role: '运营总监', department: '运营部', personality: '执行力强，关注效率', background: '6年运营管理经验', responsibilities: ['日常运营', '流程优化', '数据分析'], focusAreas: ['运营效率', '成本控制'], speakingStyle: '务实落地，关注执行', decisionPower: '运营决策权', reviewOrder: 4 },
      { name: '刘芳', role: '市场总监', department: '市场部', personality: '洞察敏锐，善于传播', background: '7年市场营销经验', responsibilities: ['市场推广', '品牌建设', '用户增长'], focusAreas: ['市场趋势', '品牌定位'], speakingStyle: '市场视角，关注竞争', decisionPower: '市场决策权', reviewOrder: 5 },
    ];

    return defaultRoles.slice(0, agentCount).map((role, idx) => ({
      id: `agent-${Date.now()}-${idx}`,
      ...role,
    }));
  };

  const renderStep1 = () => (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          {language === 'zh' ? '公司基本信息' : 'Company Basics'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {language === 'zh' ? '定义你的 AI 公司身份和使命' : 'Define your AI company identity and mission'}
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {language === 'zh' ? '公司名称 *' : 'Company Name *'}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={language === 'zh' ? '例如：星辰科技' : 'e.g., StarTech'}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {language === 'zh' ? '公司使命/目的 *' : 'Company Mission/Purpose *'}
        </label>
        <textarea
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder={language === 'zh' ? '这家公司存在的目的是什么？要解决什么问题？' : 'What is the purpose of this company? What problem does it solve?'}
          rows={3}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontSize: 14,
            resize: 'none',
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {language === 'zh' ? '所属行业' : 'Industry'}
        </label>
        <input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder={language === 'zh' ? '例如：人工智能、电商、教育' : 'e.g., AI, E-commerce, Education'}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {language === 'zh' ? '发展阶段' : 'Development Stage'}
        </label>
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        >
          <option value="">{language === 'zh' ? '选择阶段' : 'Select stage'}</option>
          <option value="idea">{language === 'zh' ? '创意阶段' : 'Idea Stage'}</option>
          <option value="mvp">{language === 'zh' ? 'MVP 验证' : 'MVP Validation'}</option>
          <option value="growth">{language === 'zh' ? '增长阶段' : 'Growth Stage'}</option>
          <option value="enterprise">{language === 'zh' ? '企业阶段' : 'Enterprise Stage'}</option>
        </select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          {language === 'zh' ? '产品与用户' : 'Products & Users'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {language === 'zh' ? '描述公司的产品服务和目标用户' : 'Describe products and target users'}
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {language === 'zh' ? '目标用户' : 'Target Users'}
        </label>
        <input
          value={targetUsers}
          onChange={(e) => setTargetUsers(e.target.value)}
          placeholder={language === 'zh' ? '多个用户群体用逗号分隔' : 'Separate multiple groups with commas'}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {language === 'zh' ? '产品/服务' : 'Products/Services'}
        </label>
        <input
          value={products}
          onChange={(e) => setProducts(e.target.value)}
          placeholder={language === 'zh' ? '多个产品用逗号分隔' : 'Separate multiple products with commas'}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
          {language === 'zh' ? '商业模式' : 'Business Model'}
        </label>
        <textarea
          value={businessModel}
          onChange={(e) => setBusinessModel(e.target.value)}
          placeholder={language === 'zh' ? '如何盈利？收入来源是什么？' : 'How does the company make money?'}
          rows={2}
          style={{
            width: '100%',
            padding: 12,
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            color: 'var(--text-primary)',
            fontSize: 14,
            resize: 'none',
          }}
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          {language === 'zh' ? '团队配置' : 'Team Setup'}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {language === 'zh' ? 'AI 将根据公司信息自动生成合适的团队成员' : 'AI will generate suitable team members based on company info'}
        </p>
      </div>

      {/* 生成模式选择 */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        border: '1px solid var(--border)',
      }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {language === 'zh' ? '生成模式' : 'Generation Mode'}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setUserMode('fast')}
            style={{
              flex: 1,
              padding: 12,
              background: userMode === 'fast' ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
              border: userMode === 'fast' ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Zap size={18} style={{ color: userMode === 'fast' ? 'var(--accent)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: userMode === 'fast' ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {language === 'zh' ? '快速' : 'Fast'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {language === 'zh' ? '更快生成' : 'Faster'}
            </span>
          </button>
          <button
            onClick={() => setUserMode('standard')}
            style={{
              flex: 1,
              padding: 12,
              background: userMode === 'standard' ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
              border: userMode === 'standard' ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Target size={18} style={{ color: userMode === 'standard' ? 'var(--accent)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: userMode === 'standard' ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {language === 'zh' ? '标准' : 'Standard'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {language === 'zh' ? '推荐' : 'Recommended'}
            </span>
          </button>
          <button
            onClick={() => setUserMode('deep')}
            style={{
              flex: 1,
              padding: 12,
              background: userMode === 'deep' ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
              border: userMode === 'deep' ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Briefcase size={18} style={{ color: userMode === 'deep' ? 'var(--accent)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: userMode === 'deep' ? 'var(--accent)' : 'var(--text-secondary)' }}>
              {language === 'zh' ? '深度' : 'Deep'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {language === 'zh' ? '更全面' : 'Thorough'}
            </span>
          </button>
        </div>
      </div>

      {/* 团队人数选择 */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        border: '1px solid var(--border)',
      }}>
        <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {language === 'zh' ? '核心团队人数' : 'Core Team Size'}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setAgentCount(Math.max(3, agentCount - 1))}
            style={{
              width: 40,
              height: 40,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text-secondary)',
              fontSize: 18,
            }}
          >
            -
          </button>
          <span style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)', minWidth: 40, textAlign: 'center' }}>
            {agentCount}
          </span>
          <button
            onClick={() => setAgentCount(Math.min(10, agentCount + 1))}
            style={{
              width: 40,
              height: 40,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text-secondary)',
              fontSize: 18,
            }}
          >
            +
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          {language === 'zh'
            ? `将生成 ${agentCount} 位核心成员，覆盖产品、技术、运营、市场等职能`
            : `${agentCount} core members covering product, tech, ops, marketing, etc.`
          }
        </p>
      </div>

      {/* 预览信息 */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: 16,
        padding: 16,
        border: '1px solid var(--border)',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
          {language === 'zh' ? '📋 公司信息预览' : '📋 Company Preview'}
        </h3>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p><strong>{language === 'zh' ? '名称:' : 'Name:'}</strong> {name}</p>
          <p><strong>{language === 'zh' ? '使命:' : 'Mission:'}</strong> {purpose}</p>
          {industry && <p><strong>{language === 'zh' ? '行业:' : 'Industry:'}</strong> {industry}</p>}
          {stage && <p><strong>{language === 'zh' ? '阶段:' : 'Stage:'}</strong> {stage}</p>}
          {targetUsers && <p><strong>{language === 'zh' ? '用户:' : 'Users:'}</strong> {targetUsers}</p>}
          {products && <p><strong>{language === 'zh' ? '产品:' : 'Products:'}</strong> {products}</p>}
        </div>
      </div>
    </div>
  );

  const canProceed = () => {
    if (step === 1) return name.trim() && purpose.trim();
    return true;
  };

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
          onClick={step === 1 ? onBack : () => setStep(step - 1)}
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
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {language === 'zh' ? '创建 AI 公司' : 'Create AI Company'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {language === 'zh' ? `步骤 ${step}/${totalSteps}` : `Step ${step}/${totalSteps}`}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        padding: '8px 16px',
        background: 'var(--bg-primary)',
      }}>
        {[1, 2, 3].map(s => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              background: s <= step ? 'var(--accent)' : 'var(--bg-tertiary)',
              borderRadius: 2,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>

      {/* Footer */}
      <div style={{
        padding: 16,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {step < totalSteps ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            style={{
              width: '100%',
              padding: 14,
              background: canProceed() ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: 'none',
              borderRadius: 12,
              color: canProceed() ? 'white' : 'var(--text-muted)',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {language === 'zh' ? '下一步' : 'Next'}
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={loading || !name || !purpose}
            style={{
              width: '100%',
              padding: 14,
              background: loading ? 'var(--bg-tertiary)' : 'var(--accent)',
              border: 'none',
              borderRadius: 12,
              color: loading ? 'var(--text-muted)' : 'white',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                {language === 'zh' ? '正在生成团队...' : 'Generating team...'}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                {language === 'zh' ? '创建公司' : 'Create Company'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}