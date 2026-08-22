window.__ModuleLoader__.load({
  id: 'dsh-subagent-orchestrator',
  factory: require => {
    const React = require('react')
    const NS = 'dsh-subagent-orchestrator'
    const ROUTES = [
      ['normal', '普通任务', 'SenseNova Flash，失败时按 Flash 链容灾。'],
      ['reviewer', '代码与安全审查', 'Qilin Review Terra 首选，失败时降级到 Flash。'],
      ['visual', '视觉任务', 'Command Code DeepSeek V4 Visual Flash Exp，专门用于图片理解。'],
    ]
    const FIELDS = ['Provider', 'Model', 'MaxTokens']

    function apply(ctx) {
      ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
        name: 'settings.plugin.item',
        key: NS,
        inject: () => ({ orchestrator: ctx.settingsScope.bind({ namespace: NS }) }),
      }, OrchestratorCard))
    }

    function OrchestratorCard({ orchestrator: scope }) {
      const [, refresh] = React.useState(0)
      const [draft, setDraft] = React.useState({})
      const [advanced, setAdvanced] = React.useState(false)
      const [saving, setSaving] = React.useState(false)
      const [failed, setFailed] = React.useState(false)
      React.useEffect(() => scope.subscribe(() => refresh(value => value + 1)), [scope])
      const snapshot = scope.getSnapshot()
      if (snapshot.status !== 'ready') return null
      const value = snapshot.value ?? {}
      const dirty = Object.keys(draft).length > 0
      const edit = (key, raw) => setDraft(current => ({ ...current, [key]: raw }))
      const save = async () => {
        setSaving(true); setFailed(false)
        try {
          for (const [key, raw] of Object.entries(draft)) {
            const numeric = key.endsWith('MaxTokens') || key === 'retentionDays' || key === 'retentionCount'
            await scope.set(key, numeric ? Number(raw) : String(raw).trim())
          }
          setDraft({})
        } catch { setFailed(true) } finally { setSaving(false) }
      }
      const read = key => String(draft[key] ?? value[key] ?? '')
      return React.createElement('section', { style: card }, [
        React.createElement('header', { key: 'head' }, [
          React.createElement('strong', { key: 'title' }, 'Subagent Orchestrator'),
          React.createElement('p', { key: 'summary', style: hint }, '普通任务固定 Flash，视觉固定 Command Code Visual Flash，代码与安全审查固定 Terra。模型选择不再继承父会话。'),
        ]),
        React.createElement('div', { key: 'mode', style: row }, [
          React.createElement('label', { key: 'label', style: field }, [
            React.createElement('span', { key: 'text' }, '策略模式'),
            React.createElement('select', { key: 'select', value: read('mode'), disabled: !snapshot.writable || saving, onChange: event => edit('mode', event.target.value), style: input }, [
              React.createElement('option', { key: 'economy', value: 'economy' }, 'Economy（当前）'),
              React.createElement('option', { key: 'balanced', value: 'balanced' }, 'Balanced（预留）'),
              React.createElement('option', { key: 'quality', value: 'quality' }, 'Quality（预留）'),
            ]),
          ]),
        ]),
        React.createElement('div', { key: 'routes', style: routes }, ROUTES.map(([key, label, description]) => React.createElement('article', { key, style: routeCard }, [
          React.createElement('strong', { key: 'title' }, label),
          React.createElement('p', { key: 'description', style: hint }, description),
          React.createElement('code', { key: 'route' }, `${read(`${key}Provider`)}/${read(`${key}Model`)} · ${read(`${key}MaxTokens`)} tokens`),
          advanced ? React.createElement('div', { key: 'fields', style: fields }, FIELDS.map(suffix => {
            const fieldName = `${key}${suffix}`
            return React.createElement('label', { key: fieldName, style: field }, [
              React.createElement('span', { key: 'label' }, suffix === 'MaxTokens' ? 'Token 上限' : suffix),
              React.createElement('input', { key: 'input', value: read(fieldName), disabled: !snapshot.writable || saving, onChange: event => edit(fieldName, event.target.value), style: input }),
            ])
          })) : null,
        ]))),
        React.createElement('button', { key: 'advanced', type: 'button', onClick: () => setAdvanced(value => !value) }, advanced ? '收起高级配置' : '展开高级配置'),
        React.createElement('aside', { key: 'migration', style: migration }, [
          React.createElement('strong', { key: 'title' }, '迁移'),
          React.createElement('p', { key: 'text', style: hint }, value.migrationAccepted ? '已确认新策略配置。root fallback 不受影响。' : '首次使用前请确认旧 fallbacks.roles 的迁移预览；确认前不会修改旧配置。'),
          React.createElement('label', { key: 'confirm', style: checkbox }, [
            React.createElement('input', { key: 'input', type: 'checkbox', checked: draft.migrationAccepted ?? value.migrationAccepted === true, disabled: !snapshot.writable || saving, onChange: event => edit('migrationAccepted', event.target.checked) }),
            React.createElement('span', { key: 'label' }, '我已确认迁移预览'),
          ]),
        ]),
        React.createElement('footer', { key: 'footer', style: footer }, [
          failed ? React.createElement('span', { key: 'error', role: 'status' }, '保存被拒绝，请检查模型路由与数字范围。') : null,
          React.createElement('button', { key: 'discard', type: 'button', disabled: !dirty || saving, onClick: () => setDraft({}) }, '放弃'),
          React.createElement('button', { key: 'save', type: 'button', disabled: !dirty || !snapshot.writable || saving, onClick: () => { void save() } }, saving ? '保存中...' : '保存'),
        ]),
      ])
    }

    const card = { display: 'grid', gap: 12, padding: 16, border: '1px solid rgba(127,127,127,.25)', borderRadius: 8 }
    const routes = { display: 'grid', gap: 8 }
    const routeCard = { display: 'grid', gap: 6, padding: 12, border: '1px solid rgba(127,127,127,.2)', borderRadius: 6 }
    const fields = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }
    const row = { display: 'flex', gap: 8 }
    const field = { display: 'grid', gap: 4, flex: 1 }
    const input = { minHeight: 32, padding: '4px 8px' }
    const hint = { opacity: .72, margin: 0 }
    const migration = { display: 'grid', gap: 6, padding: 12, background: 'rgba(127,127,127,.08)', borderRadius: 6 }
    const checkbox = { display: 'flex', gap: 8, alignItems: 'center' }
    const footer = { display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }

    return { name: 'dsh-subagent-orchestrator', inject: ['slots', 'locale', 'settingsScope'], apply }
  },
})
