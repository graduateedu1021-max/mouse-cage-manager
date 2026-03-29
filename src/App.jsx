import { useEffect, useMemo, useState } from 'react'
import './App.css'

const NEW_STORAGE_KEY = 'mouse_breeding_cagecentric_v1'
const GENOTYPE_PRESET_KEY = 'mouse_breeding_genotype_presets_v1'

const DEFAULT_GENOTYPE_PRESETS = [
  'WT',
  'Snapin flox/+',
  'Snapin flox/flox',
  'Cre+',
  'Cre-',
  'Snapin flox/+; Cre+',
  'Snapin flox/+; Cre-',
  'Snapin flox/flox; Cre+',
  'Snapin flox/flox; Cre-',
  '待PCR',
]

const defaultState = {
  cages: [],
  mice: [],
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function formatAge(birthDate) {
  if (!birthDate) return '-'
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return '-'
  const now = new Date()
  const days = Math.floor((now - birth) / (1000 * 60 * 60 * 24))
  if (days < 0) return '未出生'
  if (days < 7) return `${days}天`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    const remain = days % 7
    return remain ? `${weeks}周${remain}天` : `${weeks}周`
  }
  const months = Math.floor(days / 30)
  const remainDays = days % 30
  const weeks = Math.floor(remainDays / 7)
  return weeks ? `${months}月${weeks}周` : `${months}月`
}

function getStatusClass(status) {
  if (['正常', '在养', '保留'].includes(status)) return 'green'
  if (['配对中', '哺乳中', '待鉴定', '待剪尾', '待结果'].includes(status))
    return 'orange'
  if (['已取材', '淘汰/死亡', '已分笼'].includes(status)) return 'red'
  return ''
}

function countBy(items, key) {
  const map = new Map()
  items.forEach((item) => {
    const raw = item[key] || '未填写'
    const value = typeof raw === 'string' ? raw.trim() || '未填写' : raw
    map.set(value, (map.get(value) || 0) + 1)
  })
  return Array.from(map.entries()).sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'zh-CN')
  )
}

function loadState() {
  try {
    const raw = localStorage.getItem(NEW_STORAGE_KEY)
    if (!raw) return defaultState
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.cages) && Array.isArray(parsed.mice)) {
      return parsed
    }
    return defaultState
  } catch {
    return defaultState
  }
}

function loadGenotypePresets() {
  try {
    const raw = localStorage.getItem(GENOTYPE_PRESET_KEY)
    const parsed = raw ? JSON.parse(raw) : DEFAULT_GENOTYPE_PRESETS
    return Array.isArray(parsed) && parsed.length
      ? parsed
      : DEFAULT_GENOTYPE_PRESETS
  } catch {
    return DEFAULT_GENOTYPE_PRESETS
  }
}

function App() {
  const [page, setPage] = useState('dashboard')
  const [state, setState] = useState(defaultState)
  const [genotypePresets, setGenotypePresets] = useState(
    DEFAULT_GENOTYPE_PRESETS
  )
  const [toast, setToast] = useState('')
  const [editingCageId, setEditingCageId] = useState(null)
  const [editingMouseId, setEditingMouseId] = useState(null)
  const [selectedCageId, setSelectedCageId] = useState(null)

  const [cageKeyword, setCageKeyword] = useState('')
  const [cageStatusFilter, setCageStatusFilter] = useState('')
  const [mouseIdKeyword, setMouseIdKeyword] = useState('')
  const [mouseGenotypeFilter, setMouseGenotypeFilter] = useState('')
  const [mouseSourceFilter, setMouseSourceFilter] = useState('')
  const [mouseStatusFilter, setMouseStatusFilter] = useState('')

  const [cageForm, setCageForm] = useState({
    cageNo: '',
    cageName: '',
    cageType: '繁殖笼',
    cageStatus: '正常',
    note: '',
  })

  const [mouseForm, setMouseForm] = useState({
    mouseId: '',
    sex: '',
    genotypeSelect: '',
    genotypeCustom: '',
    birthDate: '',
    cageId: '',
    sourceSelect: '',
    sourceCustom: '',
    fatherId: '',
    motherId: '',
    mouseStatus: '在养',
    note: '',
  })

  const [presetEditor, setPresetEditor] = useState('')

  useEffect(() => {
    setState(loadState())
    const presets = loadGenotypePresets()
    setGenotypePresets(presets)
    setPresetEditor(presets.join('\n'))
  }, [])

  useEffect(() => {
    localStorage.setItem(NEW_STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (toast) setToast('')
    }, 2200)
    return () => clearTimeout(timer)
  }, [toast])

  const showToast = (msg) => setToast(msg)

  const cagesSorted = useMemo(() => {
    return [...state.cages].sort((a, b) =>
      String(a.cageNo).localeCompare(String(b.cageNo), 'zh-CN', {
        numeric: true,
      })
    )
  }, [state.cages])

  const filteredCages = useMemo(() => {
    const keyword = cageKeyword.trim().toLowerCase()
    return cagesSorted.filter(
      (c) =>
        (!keyword ||
          (c.cageNo || '').toLowerCase().includes(keyword) ||
          (c.cageName || '').toLowerCase().includes(keyword)) &&
        (!cageStatusFilter || c.cageStatus === cageStatusFilter)
    )
  }, [cagesSorted, cageKeyword, cageStatusFilter])

  const filteredMice = useMemo(() => {
    const keyword = mouseIdKeyword.trim().toLowerCase()
    return [...state.mice]
      .filter(
        (m) =>
          (!keyword || (m.mouseId || '').toLowerCase().includes(keyword)) &&
          (!mouseGenotypeFilter || m.genotype === mouseGenotypeFilter) &&
          (!mouseSourceFilter || m.source === mouseSourceFilter) &&
          (!mouseStatusFilter || m.mouseStatus === mouseStatusFilter)
      )
      .sort((a, b) =>
        String(a.mouseId).localeCompare(String(b.mouseId), 'zh-CN', {
          numeric: true,
        })
      )
  }, [
    state.mice,
    mouseIdKeyword,
    mouseGenotypeFilter,
    mouseSourceFilter,
    mouseStatusFilter,
  ])

  const dashboardStats = useMemo(() => {
    return {
      total: state.mice.length,
      alive: state.mice.filter((x) => x.mouseStatus === '在养').length,
      mating: state.mice.filter((x) => x.mouseStatus === '配对中').length,
      pending: state.mice.filter((x) => x.mouseStatus === '待鉴定').length,
      keep: state.mice.filter((x) => x.mouseStatus === '保留').length,
      sampled: state.mice.filter((x) => x.mouseStatus === '已取材').length,
      removed: state.mice.filter((x) => x.mouseStatus === '淘汰/死亡').length,
    }
  }, [state.mice])

  const genotypeRows = useMemo(
    () => countBy(state.mice, 'genotype'),
    [state.mice]
  )

  const genotypeSexRows = useMemo(() => {
    const map = new Map()
    state.mice.forEach((m) => {
      const key = `${m.genotype || '未填写'}__${m.sex || '未填写'}`
      map.set(key, (map.get(key) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([k, v]) => {
        const [genotype, sex] = k.split('__')
        return [genotype, sex, v]
      })
      .sort(
        (a, b) =>
          b[2] - a[2] || String(a[0]).localeCompare(String(b[0]), 'zh-CN')
      )
  }, [state.mice])

  const sourceRows = useMemo(() => countBy(state.mice, 'source'), [state.mice])

  const mouseStatusRows = useMemo(
    () => countBy(state.mice.map((x) => ({ status: x.mouseStatus })), 'status'),
    [state.mice]
  )

  function getCageSummary(cageId) {
    const mice = state.mice.filter((x) => x.cageId === cageId)
    const total = mice.length
    const juvenile = mice.filter((x) => {
      if (!x.birthDate) return false
      const d = Math.floor(
        (new Date() - new Date(x.birthDate)) / (1000 * 60 * 60 * 24)
      )
      return d < 60
    })
    const birthDate =
      juvenile
        .map((x) => x.birthDate)
        .filter(Boolean)
        .sort()[0] || ''
    return {
      total,
      adultCount: total - juvenile.length,
      juvenileCount: juvenile.length,
      juvenileBirthDate: birthDate,
      juvenileAge: birthDate ? formatAge(birthDate) : '-',
    }
  }

  const selectedCage = useMemo(
    () => state.cages.find((c) => c.id === selectedCageId) || null,
    [state.cages, selectedCageId]
  )

  const selectedCageMice = useMemo(() => {
    if (!selectedCageId) return []
    return state.mice
      .filter((m) => m.cageId === selectedCageId)
      .sort((a, b) =>
        String(a.mouseId).localeCompare(String(b.mouseId), 'zh-CN', {
          numeric: true,
        })
      )
  }, [state.mice, selectedCageId])

  function resetCageForm() {
    setEditingCageId(null)
    setCageForm({
      cageNo: '',
      cageName: '',
      cageType: '繁殖笼',
      cageStatus: '正常',
      note: '',
    })
  }

  function saveCage() {
    if (!cageForm.cageNo.trim()) {
      showToast('请填写笼号')
      return
    }

    if (editingCageId) {
      setState((prev) => ({
        ...prev,
        cages: prev.cages.map((c) =>
          c.id === editingCageId ? { ...c, ...cageForm } : c
        ),
      }))
      showToast('笼位已更新')
    } else {
      if (state.cages.some((c) => c.cageNo === cageForm.cageNo.trim())) {
        showToast('笼号重复了')
        return
      }
      setState((prev) => ({
        ...prev,
        cages: [
          ...prev.cages,
          {
            id: uid('cage'),
            ...cageForm,
            cageNo: cageForm.cageNo.trim(),
            cageName: cageForm.cageName.trim(),
            note: cageForm.note.trim(),
            createdAt: new Date().toISOString(),
          },
        ],
      }))
      showToast('笼位已保存')
    }

    resetCageForm()
  }

  function editCage(id) {
    const cage = state.cages.find((c) => c.id === id)
    if (!cage) return
    setEditingCageId(id)
    setCageForm({
      cageNo: cage.cageNo || '',
      cageName: cage.cageName || '',
      cageType: cage.cageType || '繁殖笼',
      cageStatus: cage.cageStatus || '正常',
      note: cage.note || '',
    })
    setPage('cages')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function deleteCage(id) {
    if (state.mice.some((m) => m.cageId === id)) {
      showToast('这个笼里还有小鼠，不能直接删除')
      return
    }
    if (!window.confirm('确定删除这个笼位吗？')) return

    setState((prev) => ({
      ...prev,
      cages: prev.cages.filter((c) => c.id !== id),
    }))

    if (selectedCageId === id) setSelectedCageId(null)
    showToast('已删除笼位')
  }

  function resetMouseForm() {
    setEditingMouseId(null)
    setMouseForm({
      mouseId: '',
      sex: '',
      genotypeSelect: '',
      genotypeCustom: '',
      birthDate: '',
      cageId: '',
      sourceSelect: '',
      sourceCustom: '',
      fatherId: '',
      motherId: '',
      mouseStatus: '在养',
      note: '',
    })
  }

  function resolvedGenotype() {
    return mouseForm.genotypeCustom.trim() || mouseForm.genotypeSelect
  }

  function resolvedSource() {
    return mouseForm.sourceCustom.trim() || mouseForm.sourceSelect
  }

  function saveMouse() {
    const data = {
      mouseId: mouseForm.mouseId.trim(),
      sex: mouseForm.sex,
      genotype: resolvedGenotype(),
      birthDate: mouseForm.birthDate,
      cageId: mouseForm.cageId,
      source: resolvedSource(),
      fatherId: mouseForm.fatherId.trim(),
      motherId: mouseForm.motherId.trim(),
      mouseStatus: mouseForm.mouseStatus,
      note: mouseForm.note.trim(),
    }

    if (!data.mouseId) {
      showToast('请填写小鼠编号')
      return
    }

    if (editingMouseId) {
      setState((prev) => ({
        ...prev,
        mice: prev.mice.map((m) =>
          m.id === editingMouseId ? { ...m, ...data } : m
        ),
      }))
      showToast('小鼠已更新')
    } else {
      if (state.mice.some((m) => m.mouseId === data.mouseId)) {
        showToast('小鼠编号重复了')
        return
      }
      setState((prev) => ({
        ...prev,
        mice: [
          ...prev.mice,
          {
            id: uid('mouse'),
            ...data,
            createdAt: new Date().toISOString(),
          },
        ],
      }))
      showToast('已保存小鼠')
    }

    resetMouseForm()
  }

  function editMouse(id) {
    const m = state.mice.find((x) => x.id === id)
    if (!m) return

    const sourceOptions = ['本室繁殖', '外购', '合作课题', '赠送']
    const presetMatched = genotypePresets.includes(m.genotype || '')

    setEditingMouseId(id)
    setMouseForm({
      mouseId: m.mouseId || '',
      sex: m.sex || '',
      genotypeSelect: presetMatched ? m.genotype : 'custom',
      genotypeCustom: m.genotype || '',
      birthDate: m.birthDate || '',
      cageId: m.cageId || '',
      sourceSelect: sourceOptions.includes(m.source || '') ? m.source : 'custom',
      sourceCustom: m.source || '',
      fatherId: m.fatherId || '',
      motherId: m.motherId || '',
      mouseStatus: m.mouseStatus || '在养',
      note: m.note || '',
    })
    setPage('mice')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function deleteMouse(id) {
    if (!window.confirm('确定删除这条小鼠记录吗？')) return
    setState((prev) => ({
      ...prev,
      mice: prev.mice.filter((m) => m.id !== id),
    }))
    showToast('已删除小鼠')
  }

  function duplicateCurrentMouseForm() {
    if (
      !mouseForm.mouseId &&
      !resolvedGenotype() &&
      !mouseForm.cageId &&
      !resolvedSource()
    ) {
      showToast('当前没有可复制的内容')
      return
    }
    setEditingMouseId(null)
    setMouseForm((prev) => ({
      ...prev,
      mouseId: '',
    }))
    showToast('已复制当前内容，请改小鼠编号后保存')
  }

  function duplicateMouse(id) {
    const m = state.mice.find((x) => x.id === id)
    if (!m) return
    editMouse(id)
    setEditingMouseId(null)
    setTimeout(() => {
      setMouseForm((prev) => ({
        ...prev,
        mouseId: '',
      }))
    }, 0)
    showToast('已复制这条记录，请修改编号后保存')
  }

  function saveGenotypePresets() {
    const presets = presetEditor
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean)
    if (!presets.length) {
      showToast('请至少保留一个预设')
      return
    }
    localStorage.setItem(GENOTYPE_PRESET_KEY, JSON.stringify(presets))
    setGenotypePresets(presets)
    setPresetEditor(presets.join('\n'))
    showToast('基因型预设已保存')
  }

  function resetGenotypePresets() {
    localStorage.setItem(
      GENOTYPE_PRESET_KEY,
      JSON.stringify(DEFAULT_GENOTYPE_PRESETS)
    )
    setGenotypePresets(DEFAULT_GENOTYPE_PRESETS)
    setPresetEditor(DEFAULT_GENOTYPE_PRESETS.join('\n'))
    showToast('已恢复默认预设')
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mouse_cagecentric_backup.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    showToast('已导出 JSON')
  }

  function importJSON(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data.cages || !data.mice) throw new Error('bad data')
        setState(data)
        showToast('已导入 JSON')
      } catch {
        showToast('导入失败')
      }
      event.target.value = ''
    }
    reader.readAsText(file, 'utf-8')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🐭</div>
          <div>
            <h1>笼位管理系统</h1>
            <small>网页版</small>
          </div>
        </div>

        <div className="nav">
          <button
            className={`nav-btn ${page === 'dashboard' ? 'active' : ''}`}
            onClick={() => setPage('dashboard')}
          >
            首页总览
          </button>
          <button
            className={`nav-btn ${page === 'cages' ? 'active' : ''}`}
            onClick={() => setPage('cages')}
          >
            笼位管理
          </button>
          <button
            className={`nav-btn ${page === 'mice' ? 'active' : ''}`}
            onClick={() => setPage('mice')}
          >
            小鼠档案
          </button>
          <button
            className={`nav-btn ${page === 'settings' ? 'active' : ''}`}
            onClick={() => setPage('settings')}
          >
            导入导出
          </button>
        </div>
      </aside>

      <main className="main">
        {page === 'dashboard' && (
          <section className="page active">
            <div className="topbar">
              <h2>首页总览</h2>
              <p>以小鼠总体情况为主，下面是分类统计。</p>
            </div>

            <div className="stack">
              <div className="card">
                <div className="section-title">
                  <h3>小鼠总体数量</h3>
                  <small>所有小鼠总盘</small>
                </div>
                <div className="stats">
                  <div className="stat">
                    <div className="label">小鼠总数</div>
                    <div className="value">{dashboardStats.total}</div>
                  </div>
                  <div className="stat">
                    <div className="label">在养</div>
                    <div className="value">{dashboardStats.alive}</div>
                  </div>
                  <div className="stat">
                    <div className="label">配对中</div>
                    <div className="value">{dashboardStats.mating}</div>
                  </div>
                  <div className="stat">
                    <div className="label">待鉴定</div>
                    <div className="value">{dashboardStats.pending}</div>
                  </div>
                  <div className="stat">
                    <div className="label">保留</div>
                    <div className="value">{dashboardStats.keep}</div>
                  </div>
                  <div className="stat">
                    <div className="label">已取材</div>
                    <div className="value">{dashboardStats.sampled}</div>
                  </div>
                  <div className="stat">
                    <div className="label">淘汰/死亡</div>
                    <div className="value">{dashboardStats.removed}</div>
                  </div>
                </div>
              </div>

              <div className="vertical-panels">
                <div className="card">
                  <div className="section-title">
                    <h3>基因型统计</h3>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>基因型</th>
                          <th>数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {genotypeRows.length ? (
                          genotypeRows.map(([k, v]) => (
                            <tr key={k}>
                              <td>{k}</td>
                              <td>{v}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="2" className="empty">
                              暂无统计数据
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="section-title">
                    <h3>基因型 + 性别统计</h3>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>基因型</th>
                          <th>性别</th>
                          <th>数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {genotypeSexRows.length ? (
                          genotypeSexRows.map(([g, s, v], idx) => (
                            <tr key={`${g}-${s}-${idx}`}>
                              <td>{g}</td>
                              <td>
                                <span
                                  className={`sex-tag ${
                                    s === '♂'
                                      ? 'sex-male'
                                      : s === '♀'
                                      ? 'sex-female'
                                      : ''
                                  }`}
                                >
                                  {s}
                                </span>
                              </td>
                              <td>{v}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="3" className="empty">
                              暂无统计数据
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="section-title">
                    <h3>来源统计</h3>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>来源</th>
                          <th>数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sourceRows.length ? (
                          sourceRows.map(([k, v]) => (
                            <tr key={k}>
                              <td>{k}</td>
                              <td>{v}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="2" className="empty">
                              暂无统计数据
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="section-title">
                    <h3>小鼠状态统计</h3>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>状态</th>
                          <th>数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mouseStatusRows.length ? (
                          mouseStatusRows.map(([k, v]) => (
                            <tr key={k}>
                              <td>{k}</td>
                              <td>{v}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="2" className="empty">
                              暂无统计数据
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {page === 'cages' && (
          <section className="page active">
            <div className="topbar">
              <h2>笼位管理</h2>
              <p>以笼位为主视图。先看笼，再看笼里的鼠。</p>
            </div>

            <div className="stack">
              <div className="card">
                <div className="section-title">
                  <h3>{editingCageId ? '编辑笼位' : '新增笼位'}</h3>
                  <small>笼名和备注可自由编辑</small>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>笼号</label>
                    <input
                      value={cageForm.cageNo}
                      onChange={(e) =>
                        setCageForm((prev) => ({
                          ...prev,
                          cageNo: e.target.value,
                        }))
                      }
                      placeholder="如 1 / A01"
                    />
                  </div>

                  <div className="field">
                    <label>笼名</label>
                    <input
                      value={cageForm.cageName}
                      onChange={(e) =>
                        setCageForm((prev) => ({
                          ...prev,
                          cageName: e.target.value,
                        }))
                      }
                      placeholder="如 Snapin繁殖1笼"
                    />
                  </div>

                  <div className="field">
                    <label>笼类型</label>
                    <select
                      value={cageForm.cageType}
                      onChange={(e) =>
                        setCageForm((prev) => ({
                          ...prev,
                          cageType: e.target.value,
                        }))
                      }
                    >
                      <option value="繁殖笼">繁殖笼</option>
                      <option value="成鼠笼">成鼠笼</option>
                      <option value="幼鼠笼">幼鼠笼</option>
                      <option value="暂养笼">暂养笼</option>
                      <option value="观察笼">观察笼</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>笼位状态</label>
                    <select
                      value={cageForm.cageStatus}
                      onChange={(e) =>
                        setCageForm((prev) => ({
                          ...prev,
                          cageStatus: e.target.value,
                        }))
                      }
                    >
                      <option value="正常">正常</option>
                      <option value="配对中">配对中</option>
                      <option value="哺乳中">哺乳中</option>
                      <option value="待剪尾">待剪尾</option>
                      <option value="待结果">待结果</option>
                      <option value="已分笼">已分笼</option>
                    </select>
                  </div>

                  <div className="field full">
                    <label>备注</label>
                    <textarea
                      value={cageForm.note}
                      onChange={(e) =>
                        setCageForm((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                      placeholder="例如：3月10日合笼；4月2日产仔；待PCR"
                    />
                  </div>
                </div>

                <div className="actions">
                  <button className="btn-primary" onClick={saveCage}>
                    保存笼位
                  </button>
                  <button className="btn-light" onClick={resetCageForm}>
                    清空
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="section-title">
                  <h3>笼位列表</h3>
                  <small>点击“查看详情”可看笼内小鼠</small>
                </div>

                <div className="filters">
                  <div className="field">
                    <label>按笼号/笼名搜索</label>
                    <input
                      value={cageKeyword}
                      onChange={(e) => setCageKeyword(e.target.value)}
                      placeholder="输入笼号或笼名"
                    />
                  </div>
                  <div className="field">
                    <label>按状态筛选</label>
                    <select
                      value={cageStatusFilter}
                      onChange={(e) => setCageStatusFilter(e.target.value)}
                    >
                      <option value="">全部</option>
                      <option value="正常">正常</option>
                      <option value="配对中">配对中</option>
                      <option value="哺乳中">哺乳中</option>
                      <option value="待剪尾">待剪尾</option>
                      <option value="待结果">待结果</option>
                      <option value="已分笼">已分笼</option>
                    </select>
                  </div>
                </div>

                <div className="cage-grid mt14">
                  {filteredCages.length ? (
                    filteredCages.map((c) => {
                      const summary = getCageSummary(c.id)
                      return (
                        <div className="cage-card" key={c.id}>
                          <div className="title">
                            <h4>{c.cageNo}</h4>
                            <span
                              className={`tag ${getStatusClass(c.cageStatus)}`}
                            >
                              {c.cageStatus}
                            </span>
                          </div>

                          <div className="meta">
                            <div>
                              <strong>笼名：</strong>
                              {c.cageName || '-'}
                            </div>
                            <div>
                              <strong>笼类型：</strong>
                              {c.cageType || '-'}
                            </div>
                            <div>
                              <strong>当前鼠总数：</strong>
                              {summary.total}
                            </div>
                            <div>
                              <strong>成鼠数量：</strong>
                              {summary.adultCount}
                            </div>
                            <div>
                              <strong>幼鼠数量：</strong>
                              {summary.juvenileCount}
                            </div>
                            <div>
                              <strong>幼鼠出生日期：</strong>
                              {summary.juvenileBirthDate || '-'}
                            </div>
                            <div>
                              <strong>幼鼠天数/年龄：</strong>
                              {summary.juvenileAge}
                            </div>
                            <div>
                              <strong>备注：</strong>
                              <span className="muted">{c.note || '-'}</span>
                            </div>
                          </div>

                          <div className="actions">
                            <button
                              className="btn-light"
                              onClick={() => {
                                setSelectedCageId(c.id)
                                setPage('cages')
                                setTimeout(() => {
                                  const el = document.getElementById(
                                    'cage-detail-card'
                                  )
                                  if (el) {
                                    window.scrollTo({
                                      top: el.offsetTop - 20,
                                      behavior: 'smooth',
                                    })
                                  }
                                }, 50)
                              }}
                            >
                              查看详情
                            </button>
                            <button
                              className="btn-light"
                              onClick={() => editCage(c.id)}
                            >
                              编辑
                            </button>
                            <button
                              className="btn-danger"
                              onClick={() => deleteCage(c.id)}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="empty full-span">暂无笼位记录</div>
                  )}
                </div>
              </div>

              {selectedCage && (
                <div className="card" id="cage-detail-card">
                  <div className="section-title">
                    <h3>笼位详情｜{selectedCage.cageNo}</h3>
                    <small>笼信息 + 笼内小鼠</small>
                  </div>

                  <div className="stack">
                    <div className="chips">
                      <span
                        className={`tag ${getStatusClass(
                          selectedCage.cageStatus
                        )}`}
                      >
                        {selectedCage.cageStatus}
                      </span>
                      <span className="tag">
                        笼类型：{selectedCage.cageType || '-'}
                      </span>
                      <span className="tag">
                        当前鼠总数：{getCageSummary(selectedCage.id).total}
                      </span>
                      <span className="tag">
                        成鼠数量：{getCageSummary(selectedCage.id).adultCount}
                      </span>
                      <span className="tag">
                        幼鼠数量：{getCageSummary(selectedCage.id).juvenileCount}
                      </span>
                      <span className="tag">
                        幼鼠出生日期：
                        {getCageSummary(selectedCage.id).juvenileBirthDate || '-'}
                      </span>
                      <span className="tag">
                        幼鼠天数/年龄：
                        {getCageSummary(selectedCage.id).juvenileAge}
                      </span>
                    </div>

                    <div>
                      <strong>笼名：</strong>
                      {selectedCage.cageName || '-'}
                    </div>
                    <div>
                      <strong>备注：</strong>
                      {selectedCage.note || '-'}
                    </div>
                  </div>

                  <div className="table-wrap mt14">
                    <table>
                      <thead>
                        <tr>
                          <th>小鼠编号</th>
                          <th>性别</th>
                          <th>基因型</th>
                          <th>出生日期</th>
                          <th>年龄</th>
                          <th>小鼠状态</th>
                          <th>来源</th>
                          <th>备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCageMice.length ? (
                          selectedCageMice.map((m) => (
                            <tr key={m.id}>
                              <td>{m.mouseId}</td>
                              <td>
                                <span
                                  className={`sex-tag ${
                                    m.sex === '♂'
                                      ? 'sex-male'
                                      : m.sex === '♀'
                                      ? 'sex-female'
                                      : ''
                                  }`}
                                >
                                  {m.sex || '-'}
                                </span>
                              </td>
                              <td>{m.genotype || '-'}</td>
                              <td>{m.birthDate || '-'}</td>
                              <td>{formatAge(m.birthDate)}</td>
                              <td>
                                <span
                                  className={`tag ${getStatusClass(
                                    m.mouseStatus
                                  )}`}
                                >
                                  {m.mouseStatus || '-'}
                                </span>
                              </td>
                              <td>{m.source || '-'}</td>
                              <td>{m.note || '-'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="8" className="empty">
                              这个笼里还没有小鼠
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {page === 'mice' && (
          <section className="page active">
            <div className="topbar">
              <h2>小鼠档案</h2>
              <p>小鼠挂在笼位下面。这里用于建档、查找和微调。</p>
            </div>

            <div className="stack">
              <div className="card">
                <div className="section-title">
                  <h3>{editingMouseId ? '编辑小鼠' : '新增小鼠'}</h3>
                  <small>基因型和来源支持选择或自定义</small>
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label>小鼠编号</label>
                    <input
                      value={mouseForm.mouseId}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          mouseId: e.target.value,
                        }))
                      }
                      placeholder="如 M001"
                    />
                  </div>

                  <div className="field">
                    <label>性别</label>
                    <select
                      value={mouseForm.sex}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          sex: e.target.value,
                        }))
                      }
                    >
                      <option value="">请选择</option>
                      <option value="♂">♂</option>
                      <option value="♀">♀</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>基因型</label>
                    <select
                      value={mouseForm.genotypeSelect}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          genotypeSelect: e.target.value,
                          genotypeCustom:
                            e.target.value && e.target.value !== 'custom'
                              ? e.target.value
                              : prev.genotypeCustom,
                        }))
                      }
                    >
                      <option value="">请选择</option>
                      {genotypePresets.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                      <option value="custom">自定义</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>自定义基因型</label>
                    <input
                      value={mouseForm.genotypeCustom}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          genotypeCustom: e.target.value,
                        }))
                      }
                      placeholder="选自定义后填写"
                    />
                  </div>

                  <div className="field">
                    <label>出生日期</label>
                    <input
                      type="date"
                      value={mouseForm.birthDate}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          birthDate: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>当前笼位</label>
                    <select
                      value={mouseForm.cageId}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          cageId: e.target.value,
                        }))
                      }
                    >
                      <option value="">请选择笼位</option>
                      {cagesSorted.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.cageNo}｜{c.cageName || ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>来源</label>
                    <select
                      value={mouseForm.sourceSelect}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          sourceSelect: e.target.value,
                          sourceCustom:
                            e.target.value && e.target.value !== 'custom'
                              ? e.target.value
                              : prev.sourceCustom,
                        }))
                      }
                    >
                      <option value="">请选择</option>
                      <option value="本室繁殖">本室繁殖</option>
                      <option value="外购">外购</option>
                      <option value="合作课题">合作课题</option>
                      <option value="赠送">赠送</option>
                      <option value="custom">自定义</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>自定义来源</label>
                    <input
                      value={mouseForm.sourceCustom}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          sourceCustom: e.target.value,
                        }))
                      }
                      placeholder="选自定义后填写"
                    />
                  </div>

                  <div className="field">
                    <label>父本编号</label>
                    <input
                      value={mouseForm.fatherId}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          fatherId: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>母本编号</label>
                    <input
                      value={mouseForm.motherId}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          motherId: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="field">
                    <label>小鼠状态</label>
                    <select
                      value={mouseForm.mouseStatus}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          mouseStatus: e.target.value,
                        }))
                      }
                    >
                      <option value="在养">在养</option>
                      <option value="配对中">配对中</option>
                      <option value="待鉴定">待鉴定</option>
                      <option value="保留">保留</option>
                      <option value="已取材">已取材</option>
                      <option value="淘汰/死亡">淘汰/死亡</option>
                    </select>
                  </div>

                  <div className="field full">
                    <label>备注</label>
                    <textarea
                      value={mouseForm.note}
                      onChange={(e) =>
                        setMouseForm((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                      placeholder="可记录耳号、PCR、表型等"
                    />
                  </div>
                </div>

                <div className="actions">
                  <button className="btn-primary" onClick={saveMouse}>
                    保存小鼠
                  </button>
                  <button className="btn-light" onClick={resetMouseForm}>
                    清空
                  </button>
                  <button
                    className="btn-light"
                    onClick={duplicateCurrentMouseForm}
                  >
                    复制当前内容
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="section-title">
                  <h3>小鼠列表</h3>
                  <small>按笼位查看更顺手</small>
                </div>

                <div className="filters filters-4">
                  <div className="field">
                    <label>搜索编号</label>
                    <input
                      value={mouseIdKeyword}
                      onChange={(e) => setMouseIdKeyword(e.target.value)}
                      placeholder="输入小鼠编号"
                    />
                  </div>

                  <div className="field">
                    <label>按基因型筛选</label>
                    <select
                      value={mouseGenotypeFilter}
                      onChange={(e) => setMouseGenotypeFilter(e.target.value)}
                    >
                      <option value="">全部</option>
                      {genotypePresets.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label>按来源筛选</label>
                    <select
                      value={mouseSourceFilter}
                      onChange={(e) => setMouseSourceFilter(e.target.value)}
                    >
                      <option value="">全部</option>
                      <option value="本室繁殖">本室繁殖</option>
                      <option value="外购">外购</option>
                      <option value="合作课题">合作课题</option>
                      <option value="赠送">赠送</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>按状态筛选</label>
                    <select
                      value={mouseStatusFilter}
                      onChange={(e) => setMouseStatusFilter(e.target.value)}
                    >
                      <option value="">全部</option>
                      <option value="在养">在养</option>
                      <option value="配对中">配对中</option>
                      <option value="待鉴定">待鉴定</option>
                      <option value="保留">保留</option>
                      <option value="已取材">已取材</option>
                      <option value="淘汰/死亡">淘汰/死亡</option>
                    </select>
                  </div>
                </div>

                <div className="table-wrap mt14">
                  <table>
                    <thead>
                      <tr>
                        <th>小鼠编号</th>
                        <th>性别</th>
                        <th>基因型</th>
                        <th>出生日期</th>
                        <th>年龄</th>
                        <th>笼位</th>
                        <th>来源</th>
                        <th>小鼠状态</th>
                        <th>备注</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMice.length ? (
                        filteredMice.map((m) => {
                          const cage = state.cages.find((c) => c.id === m.cageId)
                          return (
                            <tr key={m.id}>
                              <td>{m.mouseId}</td>
                              <td>
                                <span
                                  className={`sex-tag ${
                                    m.sex === '♂'
                                      ? 'sex-male'
                                      : m.sex === '♀'
                                      ? 'sex-female'
                                      : ''
                                  }`}
                                >
                                  {m.sex || '-'}
                                </span>
                              </td>
                              <td>{m.genotype || '-'}</td>
                              <td>{m.birthDate || '-'}</td>
                              <td>{formatAge(m.birthDate)}</td>
                              <td>{cage ? cage.cageNo : '-'}</td>
                              <td>{m.source || '-'}</td>
                              <td>
                                <span
                                  className={`tag ${getStatusClass(
                                    m.mouseStatus
                                  )}`}
                                >
                                  {m.mouseStatus || '-'}
                                </span>
                              </td>
                              <td>{m.note || '-'}</td>
                              <td>
                                <div className="toolbar">
                                  <button
                                    className="btn-light"
                                    onClick={() => editMouse(m.id)}
                                  >
                                    编辑
                                  </button>
                                  <button
                                    className="btn-light"
                                    onClick={() => duplicateMouse(m.id)}
                                  >
                                    复制
                                  </button>
                                  <button
                                    className="btn-danger"
                                    onClick={() => deleteMouse(m.id)}
                                  >
                                    删除
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      ) : (
                        <tr>
                          <td colSpan="10" className="empty">
                            暂无符合条件的小鼠记录
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {page === 'settings' && (
          <section className="page active">
            <div className="topbar">
              <h2>导入导出</h2>
              <p>建议你定期备份 JSON。</p>
            </div>

            <div className="stack">
              <div className="card">
                <h3>基因型预设</h3>
                <div className="field">
                  <label>每行一个预设</label>
                  <textarea
                    value={presetEditor}
                    onChange={(e) => setPresetEditor(e.target.value)}
                  />
                </div>
                <div className="actions">
                  <button className="btn-primary" onClick={saveGenotypePresets}>
                    保存预设
                  </button>
                  <button className="btn-light" onClick={resetGenotypePresets}>
                    恢复默认
                  </button>
                </div>
              </div>

              <div className="card">
                <h3>数据备份</h3>
                <div className="toolbar">
                  <button className="btn-primary" onClick={exportJSON}>
                    导出 JSON
                  </button>
                  <label className="btn-light fake-file-btn">
                    导入 JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={importJSON}
                      hidden
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}

export default App
