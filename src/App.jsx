import { useEffect, useMemo, useRef, useState } from 'react'
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

const ENTRY_DEFAULTS_KEY = 'mouse_entry_defaults_v1'
const REMOVED_STATUSES = ['已取材', '淘汰/死亡']

function todayStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`
}

function ageDays(birthDate) {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null
  return Math.floor((new Date() - birth) / (1000 * 60 * 60 * 24))
}

function isActiveMouse(mouse) {
  return !REMOVED_STATUSES.includes(mouse?.mouseStatus)
}

function nextNumber(mice, prefix = '') {
  const normalizedPrefix = prefix.trim().toLowerCase()
  let max = 0
  mice.forEach((mouse) => {
    const raw = String(mouse.mouseId || '').trim()
    let value = raw
    if (normalizedPrefix) {
      if (!raw.toLowerCase().startsWith(normalizedPrefix)) return
      value = raw.slice(prefix.trim().length)
    }
    if (/^\d+$/.test(value)) max = Math.max(max, Number(value))
  })
  return max + 1
}

function buildIds(start, count, prefix = '', pad = 0) {
  const first = Number(start)
  if (!Number.isFinite(first) || first <= 0 || count <= 0) return []
  return Array.from({ length: count }, (_, index) => {
    const value = String(first + index)
    return `${prefix}${pad ? value.padStart(pad, '0') : value}`
  })
}

function loadEntryDefaults() {
  try {
    const raw = localStorage.getItem(ENTRY_DEFAULTS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // ignore broken defaults
  }
  return { cageId: '', source: '本室繁殖', genotype: '待PCR' }
}

function rememberEntryDefaults(patch) {
  try {
    localStorage.setItem(
      ENTRY_DEFAULTS_KEY,
      JSON.stringify({ ...loadEntryDefaults(), ...patch })
    )
  } catch {
    // storage may be unavailable
  }
}

function emptyMouseForm(defaults = {}) {
  return {
    mouseId: '',
    sex: '',
    genotypeSelect: '',
    genotypeCustom: '',
    birthDate: '',
    cageId: defaults.cageId || '',
    sourceSelect: defaults.source || '',
    sourceCustom: '',
    fatherId: '',
    motherId: '',
    mouseStatus: '在养',
    note: '',
  }
}

function makeLitterForm(defaults = {}) {
  return {
    cageId: defaults.cageId || '',
    birthDate: todayStr(),
    genotypeSelect: defaults.genotype || '待PCR',
    genotypeCustom: '',
    source: defaults.source || '本室繁殖',
    mouseStatus: '在养',
    male: 0,
    female: 0,
    unknown: 0,
    prefix: '',
    start: '',
    pad: '0',
    note: '',
  }
}

function getStatusClass(status) {
  if (['正常', '在养', '保留'].includes(status)) return 'green'
  if (['配对中', '哺乳中', '待鉴定', '待剪尾', '待结果'].includes(status)) {
    return 'orange'
  }
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
  const [state, setState] = useState(() => loadState())
  const [genotypePresets, setGenotypePresets] = useState(
    DEFAULT_GENOTYPE_PRESETS
  )
  const [toast, setToast] = useState('')
  const [editingCageId, setEditingCageId] = useState(null)
  const [editingMouseId, setEditingMouseId] = useState(null)
  const [selectedCageId, setSelectedCageId] = useState(null)
  const [shareMode, setShareMode] = useState(false)
  const [shareDataPath, setShareDataPath] = useState('')

  const [cageKeyword, setCageKeyword] = useState('')
  const [cageStatusFilter, setCageStatusFilter] = useState('')
  const [mouseIdKeyword, setMouseIdKeyword] = useState('')
  const [mouseGenotypeFilter, setMouseGenotypeFilter] = useState('')
  const [mouseSourceFilter, setMouseSourceFilter] = useState('')
  const [mouseStatusFilter, setMouseStatusFilter] = useState('')
  const [mouseCageFilter, setMouseCageFilter] = useState('')

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

  const [entryOpen, setEntryOpen] = useState(false)
  const [entryMode, setEntryMode] = useState('litter')
  const [cageModalOpen, setCageModalOpen] = useState(false)
  const [selectedMouseIds, setSelectedMouseIds] = useState([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    mouseStatus: '',
    cageId: '',
    genotype: '',
  })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [litterForm, setLitterForm] = useState(() =>
    makeLitterForm(loadEntryDefaults())
  )
  const [printOpen, setPrintOpen] = useState(false)
  const [printScope, setPrintScope] = useState('all')
  const [printCageId, setPrintCageId] = useState('')
  const [printIncludeRemoved, setPrintIncludeRemoved] = useState(false)
  const [printPages, setPrintPages] = useState([])
  const [printDate, setPrintDate] = useState('')
  const [printBusy, setPrintBusy] = useState(false)

  useEffect(() => {
    const presets = loadGenotypePresets()
    setGenotypePresets(presets)
    setPresetEditor(presets.join('\n'))

    const params = new URLSearchParams(window.location.search)
    const dataPath = params.get('data')

    if (dataPath) {
      fetch(dataPath)
        .then((res) => {
          if (!res.ok) throw new Error('fetch failed')
          return res.json()
        })
        .then((json) => {
          if (!json || !Array.isArray(json.cages) || !Array.isArray(json.mice)) {
            throw new Error('bad json')
          }
          setState(json)
          setShareMode(true)
          setShareDataPath(dataPath)
          setPage('dashboard')
        })
        .catch(() => {
          setState(loadState())
          setShareMode(false)
          setToast('分享数据加载失败，已加载本地数据')
        })
    } else {
      setShareMode(false)
    }
  }, [])

  useEffect(() => {
    if (!shareMode) {
      localStorage.setItem(NEW_STORAGE_KEY, JSON.stringify(state))
    }
  }, [state, shareMode])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      setToast('')
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
      .filter((m) => {
        const cageNo =
          state.cages.find((cage) => cage.id === m.cageId)?.cageNo || ''
        const haystack = [
          m.mouseId,
          m.genotype,
          m.note,
          m.source,
          m.fatherId,
          m.motherId,
          cageNo,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return (
          (!keyword || haystack.includes(keyword)) &&
          (!mouseGenotypeFilter || m.genotype === mouseGenotypeFilter) &&
          (!mouseSourceFilter || m.source === mouseSourceFilter) &&
          (!mouseStatusFilter || m.mouseStatus === mouseStatusFilter) &&
          (!mouseCageFilter || m.cageId === mouseCageFilter)
        )
      })
      .sort((a, b) =>
        String(a.mouseId).localeCompare(String(b.mouseId), 'zh-CN', {
          numeric: true,
        })
      )
  }, [
    state.mice,
    state.cages,
    mouseIdKeyword,
    mouseGenotypeFilter,
    mouseSourceFilter,
    mouseStatusFilter,
    mouseCageFilter,
  ])

  const dashboardStats = useMemo(() => {
    return {
      total: state.mice.length,
      active: state.mice.filter(isActiveMouse).length,
      alive: state.mice.filter((x) => x.mouseStatus === '在养').length,
      mating: state.mice.filter((x) => x.mouseStatus === '配对中').length,
      pending: state.mice.filter((x) => x.mouseStatus === '待鉴定').length,
      keep: state.mice.filter((x) => x.mouseStatus === '保留').length,
      sampled: state.mice.filter((x) => x.mouseStatus === '已取材').length,
      removed: state.mice.filter((x) => x.mouseStatus === '淘汰/死亡').length,
    }
  }, [state.mice])

  const genotypeRows = useMemo(() => countBy(state.mice, 'genotype'), [state.mice])

  function getCageSummary(cageId) {
    const allMice = state.mice.filter((x) => x.cageId === cageId)
    const mice = allMice.filter(isActiveMouse)
    const total = mice.length
    const juvenile = mice.filter((x) => {
      const d = ageDays(x.birthDate)
      return d !== null && d >= 0 && d < 60
    })
    const birthDate =
      juvenile
        .map((x) => x.birthDate)
        .filter(Boolean)
        .sort()[0] || ''
    return {
      total,
      male: mice.filter((x) => x.sex === '♂').length,
      female: mice.filter((x) => x.sex === '♀').length,
      unknownSex: mice.filter((x) => x.sex !== '♂' && x.sex !== '♀').length,
      adultCount: total - juvenile.length,
      juvenileCount: juvenile.length,
      juvenileBirthDate: birthDate,
      juvenileAge: birthDate ? formatAge(birthDate) : '-',
      genotypes: countBy(mice, 'genotype').slice(0, 2),
      crowded: total > 5,
      inactiveCount: allMice.length - total,
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
      .sort(
        (a, b) =>
          Number(isActiveMouse(b)) - Number(isActiveMouse(a)) ||
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
    if (shareMode) return
    const normalizedNo = cageForm.cageNo.trim()
    if (!normalizedNo) {
      showToast('请填写笼号')
      return
    }

    const duplicated = state.cages.some(
      (cage) =>
        cage.id !== editingCageId &&
        String(cage.cageNo).trim().toLowerCase() === normalizedNo.toLowerCase()
    )
    if (duplicated) {
      showToast('笼号重复了')
      return
    }

    const data = {
      ...cageForm,
      cageNo: normalizedNo,
      cageName: cageForm.cageName.trim(),
      note: cageForm.note.trim(),
    }

    if (editingCageId) {
      setState((prev) => ({
        ...prev,
        cages: prev.cages.map((c) =>
          c.id === editingCageId ? { ...c, ...data } : c
        ),
      }))
      showToast('笼位已更新')
    } else {
      setState((prev) => ({
        ...prev,
        cages: [
          ...prev.cages,
          {
            id: uid('cage'),
            ...data,
            createdAt: new Date().toISOString(),
          },
        ],
      }))
      showToast('笼位已保存')
    }

    resetCageForm()
    setCageModalOpen(false)
  }

  function editCage(id) {
    if (shareMode) return
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
    setCageModalOpen(true)
  }

  function deleteCage(id) {
    if (shareMode) return
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
    if (mouseCageFilter === id) setMouseCageFilter('')
    showToast('已删除笼位')
  }

  function resetMouseForm() {
    setEditingMouseId(null)
    setMouseForm(emptyMouseForm(loadEntryDefaults()))
  }

  function resolvedGenotype() {
    return mouseForm.genotypeCustom.trim() || mouseForm.genotypeSelect
  }

  function resolvedSource() {
    return mouseForm.sourceCustom.trim() || mouseForm.sourceSelect
  }

  function saveMouse() {
    if (shareMode) return

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

    const duplicated = state.mice.some(
      (mouse) =>
        mouse.id !== editingMouseId &&
        String(mouse.mouseId).trim().toLowerCase() ===
          data.mouseId.toLowerCase()
    )
    if (duplicated) {
      showToast('小鼠编号重复了')
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

    rememberEntryDefaults({
      cageId: data.cageId,
      source: data.source,
      genotype: data.genotype,
    })
    setEntryOpen(false)
    resetMouseForm()
  }

  function mouseToForm(mouse, keepId = true) {
    const sourceOptions = ['本室繁殖', '外购', '合作课题', '赠送']
    const presetMatched = genotypePresets.includes(mouse.genotype || '')
    return {
      mouseId: keepId ? mouse.mouseId || '' : '',
      sex: mouse.sex || '',
      genotypeSelect: presetMatched ? mouse.genotype : 'custom',
      genotypeCustom: mouse.genotype || '',
      birthDate: mouse.birthDate || '',
      cageId: mouse.cageId || '',
      sourceSelect: sourceOptions.includes(mouse.source || '')
        ? mouse.source
        : 'custom',
      sourceCustom: mouse.source || '',
      fatherId: mouse.fatherId || '',
      motherId: mouse.motherId || '',
      mouseStatus: mouse.mouseStatus || '在养',
      note: mouse.note || '',
    }
  }

  function editMouse(id) {
    if (shareMode) return
    const mouse = state.mice.find((x) => x.id === id)
    if (!mouse) return
    setEditingMouseId(id)
    setEntryMode('single')
    setMouseForm(mouseToForm(mouse))
    setEntryOpen(true)
  }

  function deleteMouse(id) {
    if (shareMode) return
    if (!window.confirm('确定删除这条小鼠记录吗？')) return
    setState((prev) => ({
      ...prev,
      mice: prev.mice.filter((m) => m.id !== id),
    }))
    setSelectedMouseIds((prev) => prev.filter((x) => x !== id))
    showToast('已删除小鼠')
  }

  function duplicateMouse(id) {
    if (shareMode) return
    const mouse = state.mice.find((x) => x.id === id)
    if (!mouse) return
    setEditingMouseId(null)
    setEntryMode('single')
    setMouseForm(mouseToForm(mouse, false))
    setEntryOpen(true)
    showToast('已复制这条记录，填新编号后保存')
  }

  function openEntry(mode = 'litter', cageId = '') {
    if (shareMode) return
    const defaults = loadEntryDefaults()
    const fallbackCageId =
      cageId || defaults.cageId || cagesSorted[0]?.id || ''
    setEntryMode(mode)
    setEditingMouseId(null)
    const defaultGenotype = defaults.genotype || '待PCR'
    const genotypeIsPreset = genotypePresets.includes(defaultGenotype)
    const sourceOptions = ['本室繁殖', '外购', '合作课题', '赠送']
    const sourceIsPreset = sourceOptions.includes(defaults.source)

    if (mode === 'litter') {
      setLitterForm({
        ...makeLitterForm(defaults),
        cageId: fallbackCageId,
        start: String(nextNumber(state.mice)),
        genotypeSelect: genotypeIsPreset ? defaultGenotype : 'custom',
        genotypeCustom: genotypeIsPreset ? '' : defaultGenotype,
      })
    } else {
      setMouseForm({
        ...emptyMouseForm(defaults),
        cageId: fallbackCageId,
        mouseId: String(nextNumber(state.mice)),
        sourceSelect: sourceIsPreset ? defaults.source : 'custom',
        sourceCustom: sourceIsPreset ? '' : defaults.source || '',
      })
    }
    setEntryOpen(true)
  }

  function saveLitter() {
    if (shareMode) return
    const total =
      Number(litterForm.male) +
      Number(litterForm.female) +
      Number(litterForm.unknown)
    if (!litterForm.cageId) {
      showToast('请先选择笼位')
      return
    }
    if (!litterForm.birthDate) {
      showToast('请填写出生日期')
      return
    }
    if (!total) {
      showToast('请填写公母数量')
      return
    }

    const genotype =
      litterForm.genotypeCustom.trim() ||
      litterForm.genotypeSelect ||
      '待PCR'
    const start = Number(litterForm.start) || nextNumber(state.mice)
    const ids = buildIds(start, total, litterForm.prefix, Number(litterForm.pad))
    const duplicated = ids.filter((id) =>
      state.mice.some(
        (mouse) =>
          String(mouse.mouseId).trim().toLowerCase() === id.toLowerCase()
      )
    )
    if (duplicated.length) {
      showToast(`编号重复：${duplicated.slice(0, 3).join('、')}`)
      return
    }

    const sexes = [
      ...Array(Number(litterForm.male)).fill('♂'),
      ...Array(Number(litterForm.female)).fill('♀'),
      ...Array(Number(litterForm.unknown)).fill(''),
    ]
    const now = new Date().toISOString()
    const newMice = ids.map((id, index) => ({
      id: uid('mouse'),
      mouseId: id,
      sex: sexes[index],
      genotype,
      birthDate: litterForm.birthDate,
      cageId: litterForm.cageId,
      source: litterForm.source.trim(),
      fatherId: '',
      motherId: '',
      mouseStatus: litterForm.mouseStatus,
      note: litterForm.note.trim(),
      createdAt: now,
    }))

    setState((prev) => ({ ...prev, mice: [...prev.mice, ...newMice] }))
    rememberEntryDefaults({
      cageId: litterForm.cageId,
      source: litterForm.source,
      genotype,
    })
    showToast(`已添加 ${total} 只小鼠`)
    setEntryOpen(false)
  }

  function toggleMouseSelect(id) {
    setSelectedMouseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function applyBulk() {
    if (shareMode || !selectedMouseIds.length) return
    const patch = {}
    if (bulkForm.mouseStatus) patch.mouseStatus = bulkForm.mouseStatus
    if (bulkForm.cageId) patch.cageId = bulkForm.cageId
    if (bulkForm.genotype) patch.genotype = bulkForm.genotype
    if (!Object.keys(patch).length) {
      showToast('至少选择一项要修改的内容')
      return
    }
    const ids = new Set(selectedMouseIds)
    setState((prev) => ({
      ...prev,
      mice: prev.mice.map((mouse) =>
        ids.has(mouse.id) ? { ...mouse, ...patch } : mouse
      ),
    }))
    showToast(`已修改 ${ids.size} 只小鼠`)
    setBulkOpen(false)
    setSelectedMouseIds([])
    setBulkForm({ mouseStatus: '', cageId: '', genotype: '' })
  }

  function bulkDelete() {
    if (shareMode || !selectedMouseIds.length) return
    if (!window.confirm(`确定删除选中的 ${selectedMouseIds.length} 只小鼠吗？`)) {
      return
    }
    const ids = new Set(selectedMouseIds)
    setState((prev) => ({
      ...prev,
      mice: prev.mice.filter((mouse) => !ids.has(mouse.id)),
    }))
    showToast(`已删除 ${ids.size} 只小鼠`)
    setSelectedMouseIds([])
    setBulkOpen(false)
  }

  function setCageMiceStatus(cageId, mouseStatus) {
    if (shareMode) return
    const target = state.mice.filter(
      (mouse) => mouse.cageId === cageId && isActiveMouse(mouse)
    )
    if (!target.length) {
      showToast('这个笼里没有在养小鼠')
      return
    }
    const label =
      mouseStatus === '已取材' ? '标记为已取材' : `标记为${mouseStatus}`
    if (!window.confirm(`把这个笼里的 ${target.length} 只小鼠全部${label}？`)) {
      return
    }
    const ids = new Set(target.map((mouse) => mouse.id))
    setState((prev) => ({
      ...prev,
      mice: prev.mice.map((mouse) =>
        ids.has(mouse.id) ? { ...mouse, mouseStatus } : mouse
      ),
    }))
    showToast(`已更新 ${target.length} 只小鼠`)
  }

  function saveGenotypePresets() {
    if (shareMode) return
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
    if (shareMode) return
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
    a.download = `小鼠笼位备份-${todayStr()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    showToast('已导出 JSON 备份')
  }

  function exportShareJSON() {
    const now = new Date()
    const filename = `share-${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`

    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 500)
    showToast('已导出分享 JSON')
  }

  const cageById = useMemo(
    () => new Map(state.cages.map((cage) => [cage.id, cage])),
    [state.cages]
  )

  const emptyCageCount = useMemo(
    () =>
      state.cages.filter(
        (cage) =>
          !state.mice.some(
            (mouse) => mouse.cageId === cage.id && isActiveMouse(mouse)
          )
      ).length,
    [state.cages, state.mice]
  )

  const crowdedCages = useMemo(
    () =>
      state.cages
        .map((cage) => ({
          cage,
          total: state.mice.filter(
            (mouse) => mouse.cageId === cage.id && isActiveMouse(mouse)
          ).length,
        }))
        .filter((item) => item.total > 5),
    [state.cages, state.mice]
  )

  const todoItems = useMemo(() => {
    const items = []
    const active = state.mice.filter(isActiveMouse)

    const wean = active.filter((mouse) => {
      const days = ageDays(mouse.birthDate)
      return days !== null && days >= 18 && days <= 35
    })
    if (wean.length) {
      items.push({
        key: 'wean',
        tone: 'orange',
        icon: 'calendar',
        title: `${wean.length} 只幼鼠到剪尾/分笼日龄`,
        desc: '出生 18–35 天，建议本周处理',
        onClick: () => {
          setPage('mice')
          setMouseStatusFilter('')
        },
      })
    }

    const pcr = active.filter((mouse) => mouse.genotype === '待PCR')
    if (pcr.length) {
      items.push({
        key: 'pcr',
        tone: 'blue',
        icon: 'alert',
        title: `${pcr.length} 只待 PCR`,
        desc: '结果出来后可在档案里勾选批量改基因型',
        onClick: () => {
          setPage('mice')
          setMouseGenotypeFilter('待PCR')
          setMouseStatusFilter('')
        },
      })
    }

    const pending = active.filter((mouse) => mouse.mouseStatus === '待鉴定')
    if (pending.length) {
      items.push({
        key: 'pending',
        tone: 'orange',
        icon: 'calendar',
        title: `${pending.length} 只待鉴定`,
        desc: '剪尾后还没出结果的小鼠',
        onClick: () => {
          setPage('mice')
          setMouseStatusFilter('待鉴定')
          setMouseGenotypeFilter('')
        },
      })
    }

    if (crowdedCages.length) {
      items.push({
        key: 'crowded',
        tone: 'red',
        icon: 'alert',
        title: `${crowdedCages.length} 个笼位超过 5 只`,
        desc: crowdedCages
          .slice(0, 5)
          .map((item) => `${item.cage.cageNo}号笼 ${item.total}只`)
          .join('、'),
        onClick: () => setPage('cages'),
      })
    }

    if (emptyCageCount) {
      items.push({
        key: 'empty',
        tone: 'gray',
        icon: 'grid',
        title: `${emptyCageCount} 个空笼位`,
        desc: '可用于分笼或合笼',
        onClick: () => setPage('cages'),
      })
    }

    return items
  }, [state.mice, crowdedCages, emptyCageCount])

  const allFilteredSelected =
    filteredMice.length > 0 &&
    filteredMice.every((mouse) => selectedMouseIds.includes(mouse.id))

  const filterCount = [
    mouseGenotypeFilter,
    mouseSourceFilter,
    mouseStatusFilter,
    mouseCageFilter,
  ].filter(Boolean).length

  const litterTotal =
    Number(litterForm.male) +
    Number(litterForm.female) +
    Number(litterForm.unknown)

  const litterStart = Number(litterForm.start) || nextNumber(state.mice)
  const litterIds = buildIds(
    litterStart,
    litterTotal,
    litterForm.prefix,
    Number(litterForm.pad)
  )
  const litterPreview = litterIds.slice(0, 6)
  const litterCage = litterForm.cageId
    ? getCageSummary(litterForm.cageId)
    : null
  const litterTargetTotal = litterCage ? litterCage.total + litterTotal : 0
  const litterConflicts = litterIds.filter((id) =>
    state.mice.some(
      (mouse) =>
        String(mouse.mouseId).trim().toLowerCase() === id.toLowerCase()
    )
  )

  function toggleSelectAllFiltered() {
    const ids = filteredMice.map((mouse) => mouse.id)
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedMouseIds.includes(id))
    setSelectedMouseIds((prev) =>
      allSelected
        ? prev.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev, ...ids]))
    )
  }

  function resetMouseFilters() {
    setMouseIdKeyword('')
    setMouseGenotypeFilter('')
    setMouseSourceFilter('')
    setMouseStatusFilter('')
    setMouseCageFilter('')
  }

  function closeEntry() {
    setEntryOpen(false)
    setEditingMouseId(null)
  }

  function openCageModal() {
    resetCageForm()
    setCageModalOpen(true)
  }

  const printScopeLabel = useMemo(() => {
    if (printScope === 'filtered') return '当前筛选'
    if (printScope === 'cage') {
      const cage = state.cages.find((c) => c.id === printCageId)
      return cage ? `笼位 ${cage.cageNo}` : '单个笼位'
    }
    return '全部小鼠'
  }, [printScope, printCageId, state.cages])

  useEffect(() => {
    if (!printOpen) return
    setPrintBusy(true)
    const timer = setTimeout(() => {
      let list = state.mice
      if (printScope === 'filtered') list = filteredMice
      if (printScope === 'cage') {
        list = state.mice.filter((mouse) => mouse.cageId === printCageId)
      }
      if (!printIncludeRemoved) list = list.filter(isActiveMouse)

      if (!list.length) {
        setPrintPages([])
        setPrintDate(todayStr())
        setPrintBusy(false)
        return
      }

      const built = buildPrintPages({
        mice: list,
        cages: state.cages,
        scopeLabel: `${printScopeLabel}${
          printIncludeRemoved ? '' : ' · 不含已处理'
        }`,
      })
      setPrintPages(built.images)
      setPrintDate(built.dateText)
      setPrintBusy(false)
    }, 30)

    return () => clearTimeout(timer)
  }, [
    printOpen,
    printScope,
    printCageId,
    printIncludeRemoved,
    printScopeLabel,
    state.mice,
    state.cages,
    filteredMice,
  ])

  function openPrintPreview(scope = 'all', cageId = '') {
    setPrintScope(scope)
    setPrintCageId(cageId || selectedCageId || state.cages[0]?.id || '')
    setPrintOpen(true)
  }

  function closePrint() {
    setPrintOpen(false)
    setPrintPages([])
    setPrintBusy(false)
  }

  function handlePrint() {
    if (!printPages.length) {
      showToast('没有可打印的小鼠')
      return
    }
    const opened = openPrintWindow(printPages, printDate, printScopeLabel)
    if (!opened) {
      showToast('浏览器拦截了新窗口，请允许弹窗后重试')
    }
  }

  function importJSON(event) {
    if (shareMode) return
    const file = event.target.files?.[0]
    if (!file) return
    if (
      !window.confirm(
        '导入会用文件里的数据覆盖当前浏览器中的数据。建议先导出一份备份，确定继续吗？'
      )
    ) {
      event.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        if (!data.cages || !data.mice) throw new Error('bad data')
        localStorage.setItem(
          'mouse_breeding_before_import_v1',
          JSON.stringify(state)
        )
        setState(data)
        setSelectedMouseIds([])
        setSelectedCageId(null)
        showToast('已导入 JSON，旧数据已留一份应急备份')
      } catch {
        showToast('导入失败：文件格式不对')
      }
      event.target.value = ''
    }
    reader.readAsText(file, 'utf-8')
  }

  async function copyShortLinkTemplate() {
    const example = `${window.location.origin}${window.location.pathname}?data=share-${todayStr()}.json`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(example)
        showToast('短链接模板已复制')
      } else {
        showToast('请手动复制短链接模板')
      }
    } catch {
      showToast('请手动复制短链接模板')
    }
  }

  function saveSharedDataToLocal() {
    if (!shareMode) return
    localStorage.setItem(NEW_STORAGE_KEY, JSON.stringify(state))
    showToast('已保存到当前浏览器')
  }

  function exitShareMode() {
    const url = new URL(window.location.href)
    url.searchParams.delete('data')
    window.location.href = url.toString()
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🐭</div>
          <div>
            <h1>笼位管理</h1>
            <small>{shareMode ? '分享只读模式' : '基因小鼠 · 本地版'}</small>
          </div>
        </div>

        {!shareMode && (
          <button className="sidebar-add" onClick={() => openEntry('litter')}>
            <Icon name="plus" size={18} />
            快速录入
          </button>
        )}

        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-btn ${page === item.key ? 'active' : ''}`}
              onClick={() => setPage(item.key)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button className="side-print" onClick={() => openPrintPreview('all')}>
            <Icon name="print" size={18} />
            打印 / 导出 PDF
          </button>
          <div className="side-note">
            <strong>{state.cages.length}</strong> 笼 ·{' '}
            <strong>{dashboardStats.total}</strong> 只
            <span>数据保存在本机浏览器</span>
          </div>
        </div>
      </aside>

      <main className="main">
        {shareMode && (
          <div className="share-banner">
            <div>
              <strong>分享只读模式</strong>
              <span>正在查看：{shareDataPath}</span>
            </div>
            <div className="share-actions">
              <button className="btn-light" onClick={saveSharedDataToLocal}>
                保存到我的浏览器
              </button>
              <button className="btn-light" onClick={exitShareMode}>
                退出
              </button>
            </div>
          </div>
        )}

        {page === 'dashboard' && (
          <section className="page">
            <PageHead
              eyebrow="🐭 笼位管理"
              title="总览"
              subtitle={`${todayStr()} · 今天要照顾的都在这里`}
            >
              <button
                className="btn-light icon-text"
                onClick={() => openPrintPreview('all')}
              >
                <Icon name="print" size={18} />
                <span>打印</span>
              </button>
              {!shareMode && (
                <button
                  className="btn-primary icon-text"
                  onClick={() => openEntry('litter')}
                >
                  <Icon name="plus" size={18} />
                  <span>一窝录入</span>
                </button>
              )}
            </PageHead>

            {!state.cages.length && (
              <div className="card welcome-card">
                <div className="welcome-icon">🐭</div>
                <div className="welcome-text">
                  <h3>开始建立你的鼠群档案</h3>
                  <p>
                    如果电脑上已经有数据，先导出 JSON，再在这里导入；从零开始就先建笼位。
                    建好后用“一窝录入”一次生成整窝编号。
                  </p>
                </div>
                {!shareMode && (
                  <div className="welcome-actions">
                    <label className="btn-light fake-file-btn">
                      <Icon name="upload" size={16} /> 导入 JSON
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={importJSON}
                        hidden
                      />
                    </label>
                    <button className="btn-primary" onClick={openCageModal}>
                      新增笼位
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="stat-grid">
              <div className="stat-card stat-hero">
                <span className="stat-label">在养小鼠</span>
                <strong>{dashboardStats.active}</strong>
                <span className="stat-sub">共 {dashboardStats.total} 条记录</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">笼位</span>
                <strong>{state.cages.length}</strong>
                <span className="stat-sub">
                  {emptyCageCount} 个空笼 · {crowdedCages.length} 个偏挤
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">配对中</span>
                <strong>{dashboardStats.mating}</strong>
                <span className="stat-sub">待鉴定 {dashboardStats.pending}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">已取材 / 淘汰</span>
                <strong>{dashboardStats.sampled + dashboardStats.removed}</strong>
                <span className="stat-sub">默认不进入打印表</span>
              </div>
            </div>

            <div className="dash-grid">
              <div className="card">
                <div className="section-title">
                  <h3>今日待办</h3>
                  <small>{todoItems.length ? `${todoItems.length} 项` : '暂无'}</small>
                </div>
                {todoItems.length ? (
                  <div className="todo-list">
                    {todoItems.map((item) => (
                      <button
                        key={item.key}
                        className={`todo-item tone-${item.tone}`}
                        onClick={item.onClick}
                      >
                        <span className="todo-icon">
                          <Icon name={item.icon || 'alert'} size={16} />
                        </span>
                        <span className="todo-text">
                          <strong>{item.title}</strong>
                          <small>{item.desc}</small>
                        </span>
                        <Icon name="chevron" size={18} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon="check"
                    title="今天没有到期事项"
                    desc="剪尾、分笼、PCR、超载会自动出现在这里"
                  />
                )}
                <p className="hint">
                  日龄按出生日期自动计算；18–35 天提示剪尾/分笼，超过 5 只/笼提示偏挤。
                </p>
              </div>

              <div className="card">
                <div className="section-title">
                  <h3>基因型分布</h3>
                  <small>全部记录</small>
                </div>
                {genotypeRows.length ? (
                  <div className="bars">
                    {genotypeRows.map(([key, value]) => (
                      <div className="bar-row" key={key}>
                        <span className="bar-label" title={key}>
                          {key}
                        </span>
                        <div className="bar-track">
                          <i
                            style={{
                              width: `${Math.max(
                                4,
                                (value / genotypeRows[0][1]) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <b>{value}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty icon="mouse" title="还没有小鼠记录" desc="用一窝录入开始" />
                )}
              </div>
            </div>

            <div className="card">
              <div className="section-title">
                <h3>笼位概览</h3>
                <button className="link-btn" onClick={() => setPage('cages')}>
                  全部 {state.cages.length} 个 →
                </button>
              </div>
              {cagesSorted.length ? (
                <div className="mini-cage-grid">
                  {cagesSorted.slice(0, 10).map((cage) => {
                    const summary = getCageSummary(cage.id)
                    return (
                      <button
                        key={cage.id}
                        className={`mini-cage ${summary.crowded ? 'crowded' : ''}`}
                        onClick={() => setSelectedCageId(cage.id)}
                      >
                        <span className="mini-no">{cage.cageNo}</span>
                        <span className="mini-count">{summary.total} 只</span>
                        <span className={`mini-status ${getStatusClass(cage.cageStatus)}`}>
                          {cage.cageStatus || '正常'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <Empty icon="grid" title="还没有笼位" desc="先建一个笼位" />
              )}
            </div>
          </section>
        )}

        {page === 'cages' && (
          <section className="page">
            <PageHead
              eyebrow="笼位"
              title="笼位管理"
              subtitle={`${state.cages.length} 个笼位 · 点卡片查看笼内小鼠`}
            >
              <button
                className="btn-light icon-text"
                onClick={() => openPrintPreview('all')}
              >
                <Icon name="print" size={18} />
                <span>打印</span>
              </button>
              {!shareMode && (
                <button className="btn-primary icon-text" onClick={openCageModal}>
                  <Icon name="plus" size={18} />
                  <span>新增笼位</span>
                </button>
              )}
            </PageHead>

            <div className="toolbar">
              <div className="search-box">
                <Icon name="search" size={18} />
                <input
                  value={cageKeyword}
                  onChange={(event) => setCageKeyword(event.target.value)}
                  placeholder="搜索笼号或笼名"
                />
                {cageKeyword && (
                  <button
                    className="clear-btn"
                    onClick={() => setCageKeyword('')}
                    aria-label="清空搜索"
                  >
                    <Icon name="close" size={15} />
                  </button>
                )}
              </div>
              <select
                className="compact-select"
                value={cageStatusFilter}
                onChange={(event) => setCageStatusFilter(event.target.value)}
              >
                <option value="">全部状态</option>
                <option value="正常">正常</option>
                <option value="配对中">配对中</option>
                <option value="哺乳中">哺乳中</option>
                <option value="待剪尾">待剪尾</option>
                <option value="待结果">待结果</option>
                <option value="已分笼">已分笼</option>
              </select>
              <span className="result-count">{filteredCages.length} 个</span>
            </div>

            {filteredCages.length ? (
              <div className="cage-grid">
                {filteredCages.map((cage) => {
                  const summary = getCageSummary(cage.id)
                  return (
                    <article
                      key={cage.id}
                      className={`cage-card ${summary.crowded ? 'is-crowded' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedCageId(cage.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') setSelectedCageId(cage.id)
                      }}
                    >
                      <div className="cage-card-top">
                        <span className="cage-no">{cage.cageNo}</span>
                        <span className={`tag ${getStatusClass(cage.cageStatus)}`}>
                          {cage.cageStatus || '正常'}
                        </span>
                      </div>
                      <div className="cage-name">{cage.cageName || '未命名笼位'}</div>
                      <div className="cage-figures">
                        <span className="cage-total">
                          {summary.total}
                          <small>只</small>
                        </span>
                        <span className="cage-sex">
                          ♂{summary.male} · ♀{summary.female}
                          {summary.unknownSex ? ` · 未知${summary.unknownSex}` : ''}
                        </span>
                        {summary.crowded && <span className="warn-chip">偏挤</span>}
                        {summary.inactiveCount > 0 && (
                          <span className="cage-extra">已处理 {summary.inactiveCount}</span>
                        )}
                      </div>
                      <div className="cage-genos">
                        {summary.genotypes.length ? (
                          summary.genotypes.map(([genotype, count]) => (
                            <span className="geno-chip" key={genotype} title={genotype}>
                              {shortGenotype(genotype)} <b>{count}</b>
                            </span>
                          ))
                        ) : (
                          <span className="muted">
                            {summary.inactiveCount ? '无在养小鼠' : '空笼'}
                          </span>
                        )}
                      </div>
                      <p className="cage-note">
                        {cage.note || `${cage.cageType || '笼位'} · 暂无备注`}
                      </p>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="card">
                <Empty
                  icon="grid"
                  title="没有匹配的笼位"
                  desc="换个搜索词，或新增一个笼位"
                />
              </div>
            )}
          </section>
        )}

        {page === 'mice' && (
          <section className="page">
            <PageHead
              eyebrow="档案"
              title="小鼠档案"
              subtitle={`${filteredMice.length} / ${dashboardStats.total} 只 · ${
                shareMode ? '只读模式' : '勾选可批量改'
              }`}
            >
              <button
                className="btn-light icon-text"
                onClick={() => openPrintPreview('filtered')}
              >
                <Icon name="print" size={18} />
                <span>打印当前</span>
              </button>
              {!shareMode && (
                <button
                  className="btn-primary icon-text"
                  onClick={() => openEntry('single')}
                >
                  <Icon name="plus" size={18} />
                  <span>新增小鼠</span>
                </button>
              )}
            </PageHead>

            <div className="filter-bar">
              <div className="search-box">
                <Icon name="search" size={18} />
                <input
                  value={mouseIdKeyword}
                  onChange={(event) => setMouseIdKeyword(event.target.value)}
                  placeholder="搜索编号 / 基因型 / 备注 / 笼号"
                />
                {mouseIdKeyword && (
                  <button
                    className="clear-btn"
                    onClick={() => setMouseIdKeyword('')}
                    aria-label="清空搜索"
                  >
                    <Icon name="close" size={15} />
                  </button>
                )}
              </div>
              <button
                className={`btn-light filter-toggle ${filtersOpen ? 'active' : ''}`}
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <Icon name="filter" size={17} />
                筛选
                {filterCount > 0 && <b className="badge">{filterCount}</b>}
              </button>
              {(mouseIdKeyword ||
                mouseGenotypeFilter ||
                mouseSourceFilter ||
                mouseStatusFilter ||
                mouseCageFilter) && (
                <button className="link-btn" onClick={resetMouseFilters}>
                  清空
                </button>
              )}
            </div>

            <div className={`filter-panel ${filtersOpen ? 'open' : ''}`}>
              <label>
                基因型
                <select
                  value={mouseGenotypeFilter}
                  onChange={(event) => setMouseGenotypeFilter(event.target.value)}
                >
                  <option value="">全部</option>
                  {genotypePresets.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                笼位
                <select
                  value={mouseCageFilter}
                  onChange={(event) => setMouseCageFilter(event.target.value)}
                >
                  <option value="">全部</option>
                  {cagesSorted.map((cage) => (
                    <option key={cage.id} value={cage.id}>
                      {cage.cageNo}｜{cage.cageName || '未命名'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                来源
                <select
                  value={mouseSourceFilter}
                  onChange={(event) => setMouseSourceFilter(event.target.value)}
                >
                  <option value="">全部</option>
                  <option value="本室繁殖">本室繁殖</option>
                  <option value="外购">外购</option>
                  <option value="合作课题">合作课题</option>
                  <option value="赠送">赠送</option>
                </select>
              </label>
              <label>
                状态
                <select
                  value={mouseStatusFilter}
                  onChange={(event) => setMouseStatusFilter(event.target.value)}
                >
                  <option value="">全部</option>
                  <option value="在养">在养</option>
                  <option value="配对中">配对中</option>
                  <option value="待鉴定">待鉴定</option>
                  <option value="保留">保留</option>
                  <option value="已取材">已取材</option>
                  <option value="淘汰/死亡">淘汰/死亡</option>
                </select>
              </label>
            </div>

            {!shareMode && selectedMouseIds.length > 0 && (
              <div className="selection-strip">
                <span>已选 {selectedMouseIds.length} 只</span>
                <button onClick={() => setBulkOpen(true)}>批量修改</button>
                <button className="danger-text" onClick={bulkDelete}>
                  删除
                </button>
                <button onClick={() => setSelectedMouseIds([])}>取消</button>
              </div>
            )}

            {filteredMice.length ? (
              <>
                <div className="card table-card desktop-only">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th className="check-col">
                            {!shareMode && (
                              <input
                                type="checkbox"
                                checked={allFilteredSelected}
                                onChange={toggleSelectAllFiltered}
                                aria-label="全选"
                              />
                            )}
                          </th>
                          <th>小鼠编号</th>
                          <th>性别</th>
                          <th>基因型</th>
                          <th>出生日期</th>
                          <th>年龄</th>
                          <th>笼位</th>
                          <th>状态</th>
                          <th>备注</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMice.map((mouse) => {
                          const cage = cageById.get(mouse.cageId)
                          return (
                            <tr
                              key={mouse.id}
                              className={
                                selectedMouseIds.includes(mouse.id)
                                  ? 'row-selected'
                                  : ''
                              }
                            >
                              <td className="check-col">
                                {!shareMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedMouseIds.includes(mouse.id)}
                                    onChange={() => toggleMouseSelect(mouse.id)}
                                    aria-label={`选择 ${mouse.mouseId}`}
                                  />
                                )}
                              </td>
                              <td>
                                <button
                                  className="id-link"
                                  onClick={() => editMouse(mouse.id)}
                                >
                                  {mouse.mouseId}
                                </button>
                              </td>
                              <td>
                                <SexTag sex={mouse.sex} />
                              </td>
                              <td>
                                <span className="geno-text">
                                  {mouse.genotype || '-'}
                                </span>
                              </td>
                              <td>{mouse.birthDate || '-'}</td>
                              <td>{formatAge(mouse.birthDate)}</td>
                              <td>{cage?.cageNo || '-'}</td>
                              <td>
                                <StatusTag status={mouse.mouseStatus} />
                              </td>
                              <td className="note-cell" title={mouse.note || ''}>{mouse.note || '-'}</td>
                              <td>
                                {shareMode ? (
                                  <span className="muted">-</span>
                                ) : (
                                  <div className="row-actions">
                                    <button
                                      className="icon-btn"
                                      onClick={() => editMouse(mouse.id)}
                                      title="编辑"
                                    >
                                      <Icon name="edit" size={16} />
                                    </button>
                                    <button
                                      className="icon-btn"
                                      onClick={() => duplicateMouse(mouse.id)}
                                      title="复制"
                                    >
                                      <Icon name="copy" size={16} />
                                    </button>
                                    <button
                                      className="icon-btn danger"
                                      onClick={() => deleteMouse(mouse.id)}
                                      title="删除"
                                    >
                                      <Icon name="trash" size={16} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mouse-list mobile-only">
                  {filteredMice.map((mouse) => {
                    const cage = cageById.get(mouse.cageId)
                    const selected = selectedMouseIds.includes(mouse.id)
                    return (
                      <div
                        key={mouse.id}
                        className={`mouse-card ${selected ? 'selected' : ''}`}
                      >
                        {!shareMode && (
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleMouseSelect(mouse.id)}
                            aria-label={`选择 ${mouse.mouseId}`}
                          />
                        )}
                        <button
                          className="mouse-card-main"
                          onClick={() => editMouse(mouse.id)}
                        >
                          <span className="mouse-card-top">
                            <strong>{mouse.mouseId}</strong>
                            <SexTag sex={mouse.sex} />
                            <StatusTag status={mouse.mouseStatus} />
                          </span>
                          <span className="mouse-card-geno">
                            {mouse.genotype || '未填写基因型'}
                          </span>
                          <span className="mouse-card-meta">
                            <span>{formatAge(mouse.birthDate)}</span>
                            <span>笼位 {cage?.cageNo || '-'}</span>
                            <span>{mouse.source || '来源未填'}</span>
                          </span>
                          {mouse.note && <span className="mouse-card-note">{mouse.note}</span>}
                        </button>
                        <Icon name="chevron" size={18} />
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="card">
                <Empty
                  icon="mouse"
                  title="没有匹配的小鼠"
                  desc="清空筛选，或新增一只"
                />
              </div>
            )}
          </section>
        )}

        {page === 'settings' && (
          <section className="page">
            <PageHead
              eyebrow="数据"
              title="导入导出"
              subtitle={shareMode ? '分享只读模式' : '备份、打印和基因型预设'}
            />

            <div className="settings-grid">
              <div className="card">
                <h3>基因型预设</h3>
                <p className="hint">每行一个，录入下拉和筛选都会用到。</p>
                <textarea
                  rows={10}
                  value={presetEditor}
                  disabled={shareMode}
                  onChange={(event) => setPresetEditor(event.target.value)}
                />
                <div className="actions">
                  <button
                    className="btn-primary"
                    onClick={saveGenotypePresets}
                    disabled={shareMode}
                  >
                    保存预设
                  </button>
                  <button
                    className="btn-light"
                    onClick={resetGenotypePresets}
                    disabled={shareMode}
                  >
                    恢复默认
                  </button>
                </div>
              </div>

              <div className="card">
                <h3>数据备份</h3>
                <div className="data-stats">
                  <div>
                    <strong>{state.cages.length}</strong>
                    <span>笼位</span>
                  </div>
                  <div>
                    <strong>{dashboardStats.total}</strong>
                    <span>小鼠记录</span>
                  </div>
                  <div>
                    <strong>{dashboardStats.active}</strong>
                    <span>在养</span>
                  </div>
                </div>
                <div className="actions">
                  <button className="btn-primary" onClick={exportJSON}>
                    <Icon name="download" size={16} /> 导出 JSON
                  </button>
                  {!shareMode && (
                    <label className="btn-light fake-file-btn">
                      <Icon name="upload" size={16} /> 导入 JSON
                      <input type="file" accept=".json,application/json" onChange={importJSON} hidden />
                    </label>
                  )}
                  <button className="btn-light" onClick={() => openPrintPreview('all')}>
                    <Icon name="print" size={16} /> 打印表
                  </button>
                </div>
                <p className="hint warning">
                  数据只存在当前浏览器。换电脑、换手机、清缓存或重装前，先导出
                  JSON，再到新设备上导入。
                </p>
              </div>

              <div className="card">
                <h3>分享（只读）</h3>
                <p className="hint">
                  导出一份分享 JSON，传到 GitHub 仓库的 public 目录，再用
                  <code>?data=文件名</code> 打开。
                </p>
                <div className="actions">
                  <button className="btn-primary" onClick={exportShareJSON}>
                    导出分享 JSON
                  </button>
                  <button className="btn-light" onClick={copyShortLinkTemplate}>
                    复制短链接模板
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={2}
                  value={`${window.location.origin}${window.location.pathname}?data=share-${todayStr()}.json`}
                />
              </div>

              <div className="card">
                <h3>打印说明</h3>
                <ul className="help-list">
                  <li>打印表是 A4 纵向，按笼位分组，笼位备注自动合并。</li>
                  <li>默认不打印“已取材 / 淘汰”的小鼠，可在打印面板里勾选包含。</li>
                  <li>浏览器打印设置里把“页眉和页脚”关掉，页码已经在表格底部。</li>
                  <li>手机上点打印会打开预览页，再点“打印 / 保存 PDF”即可。</li>
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>

      <nav className="tabbar" aria-label="主导航">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <button
            key={item.key}
            className={`tab-btn ${page === item.key ? 'active' : ''}`}
            onClick={() => setPage(item.key)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.mobileLabel}</span>
          </button>
        ))}
        <button
          className="tab-add"
          onClick={() => openEntry('litter')}
          disabled={shareMode}
          aria-label="快速录入"
        >
          <span>
            <Icon name="plus" size={24} />
          </span>
          <small>录入</small>
        </button>
        {NAV_ITEMS.slice(2).map((item) => (
          <button
            key={item.key}
            className={`tab-btn ${page === item.key ? 'active' : ''}`}
            onClick={() => setPage(item.key)}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.mobileLabel}</span>
          </button>
        ))}
      </nav>

      <Sheet
        layer={120}
        open={entryOpen}
        onClose={closeEntry}
        title={editingMouseId ? '编辑小鼠' : '快速录入'}
        subtitle={
          editingMouseId
            ? '改完直接保存'
            : '一窝一只只填太慢，这里一次生成整窝'
        }
        wide
        footer={
          <div className="sheet-actions">
            <button className="btn-light" onClick={closeEntry}>
              取消
            </button>
            {editingMouseId ? (
              <button className="btn-primary" onClick={saveMouse}>
                保存修改
              </button>
            ) : entryMode === 'litter' ? (
              <button
                className="btn-primary"
                onClick={saveLitter}
                disabled={!litterTotal}
              >
                保存 {litterTotal || 0} 只
              </button>
            ) : (
              <button className="btn-primary" onClick={saveMouse}>
                保存小鼠
              </button>
            )}
          </div>
        }
      >
        {!editingMouseId && (
          <div className="segmented entry-tabs">
            <button
              className={entryMode === 'litter' ? 'active' : ''}
              onClick={() => {
                setEntryMode('litter')
                setLitterForm((prev) => {
                  const defaults = loadEntryDefaults()
                  const fallback = defaults.genotype || '待PCR'
                  const fallbackIsPreset = genotypePresets.includes(fallback)
                  const currentIsPreset = genotypePresets.includes(
                    prev.genotypeSelect
                  )
                  const currentIsCustom =
                    prev.genotypeSelect === 'custom' && prev.genotypeCustom
                  const useCurrent = currentIsPreset || currentIsCustom
                  return {
                    ...prev,
                    cageId: prev.cageId || cagesSorted[0]?.id || '',
                    start: prev.start || String(nextNumber(state.mice)),
                    genotypeSelect: useCurrent
                      ? prev.genotypeSelect
                      : fallbackIsPreset
                        ? fallback
                        : 'custom',
                    genotypeCustom: useCurrent
                      ? prev.genotypeCustom
                      : fallbackIsPreset
                        ? ''
                        : fallback,
                  }
                })
              }}
            >
              一窝录入
            </button>
            <button
              className={entryMode === 'single' ? 'active' : ''}
              onClick={() => setEntryMode('single')}
            >
              单只录入
            </button>
          </div>
        )}

        {entryMode === 'litter' && !editingMouseId ? (
          <>
            <div className="form-grid">
              <div className="field">
                <label>笼位</label>
                <select
                  value={litterForm.cageId}
                  onChange={(event) =>
                    setLitterForm((prev) => ({ ...prev, cageId: event.target.value }))
                  }
                >
                  <option value="">选择笼位</option>
                  {cagesSorted.map((cage) => (
                    <option key={cage.id} value={cage.id}>
                      {cage.cageNo}｜{cage.cageName || '未命名'}（
                      {getCageSummary(cage.id).total}只）
                    </option>
                  ))}
                </select>
                {!cagesSorted.length && (
                  <small className="field-hint danger">
                    还没有笼位，先到“笼位”页新增。
                  </small>
                )}
              </div>
              <div className="field">
                <label>出生日期</label>
                <input
                  type="date"
                  value={litterForm.birthDate}
                  onChange={(event) =>
                    setLitterForm((prev) => ({
                      ...prev,
                      birthDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>基因型</label>
                <select
                  value={litterForm.genotypeSelect}
                  onChange={(event) => {
                    const value = event.target.value
                    setLitterForm((prev) => ({
                      ...prev,
                      genotypeSelect: value,
                      genotypeCustom:
                        value && value !== 'custom'
                          ? value
                          : value === ''
                            ? ''
                            : prev.genotypeCustom,
                    }))
                  }}
                >
                  <option value="">请选择</option>
                  {genotypePresets.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value="custom">自定义…</option>
                </select>
                {litterForm.genotypeSelect === 'custom' && (
                  <input
                    value={litterForm.genotypeCustom}
                    onChange={(event) =>
                      setLitterForm((prev) => ({
                        ...prev,
                        genotypeCustom: event.target.value,
                      }))
                    }
                    placeholder="输入基因型"
                  />
                )}
              </div>
              <div className="field">
                <label>来源</label>
                <input
                  list="source-options"
                  value={litterForm.source}
                  onChange={(event) =>
                    setLitterForm((prev) => ({ ...prev, source: event.target.value }))
                  }
                  placeholder="本室繁殖 / 外购"
                />
              </div>
              <div className="field">
                <label>状态</label>
                <select
                  value={litterForm.mouseStatus}
                  onChange={(event) =>
                    setLitterForm((prev) => ({
                      ...prev,
                      mouseStatus: event.target.value,
                    }))
                  }
                >
                  <option value="在养">在养</option>
                  <option value="待鉴定">待鉴定</option>
                  <option value="配对中">配对中</option>
                  <option value="保留">保留</option>
                </select>
              </div>
              <div className="field">
                <label>同窝备注（可选）</label>
                <input
                  value={litterForm.note}
                  onChange={(event) =>
                    setLitterForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                  placeholder="如 9/5 产仔"
                />
              </div>
            </div>

            <datalist id="source-options">
              <option value="本室繁殖" />
              <option value="外购" />
              <option value="合作课题" />
              <option value="赠送" />
            </datalist>

            <div className="litter-counts">
              {[
                { key: 'male', label: '♂ 雄性', cls: 'male' },
                { key: 'female', label: '♀ 雌性', cls: 'female' },
                { key: 'unknown', label: '未知', cls: 'unknown' },
              ].map((item) => (
                <div className={`count-box ${item.cls}`} key={item.key}>
                  <span>{item.label}</span>
                  <div className="stepper">
                    <button
                      type="button"
                      onClick={() =>
                        setLitterForm((prev) => ({
                          ...prev,
                          [item.key]: Math.max(0, Number(prev[item.key]) - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={litterForm[item.key]}
                      onChange={(event) =>
                        setLitterForm((prev) => ({
                          ...prev,
                          [item.key]: Math.max(0, Number(event.target.value) || 0),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLitterForm((prev) => ({
                          ...prev,
                          [item.key]: Number(prev[item.key]) + 1,
                        }))
                      }
                    >
                      ＋
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {litterCage && litterTotal > 0 && litterTargetTotal > 5 && (
              <p className="field-hint danger litter-warning">
                这个笼会变成 {litterTargetTotal} 只（建议 ≤5 只/笼），可以考虑分笼。
              </p>
            )}

            <div className="id-builder">
              <div className="id-builder-head">
                <strong>编号</strong>
                <small>
                  默认接当前最大编号{' '}
                  {nextNumber(state.mice, litterForm.prefix)}
                </small>
              </div>
              <div className="id-fields">
                <div className="field">
                  <label>前缀</label>
                  <input
                    value={litterForm.prefix}
                    onChange={(event) => {
                      const prefix = event.target.value
                      setLitterForm((prev) => {
                        const automatic =
                          !prev.start ||
                          Number(prev.start) === nextNumber(state.mice, prev.prefix)
                        return {
                          ...prev,
                          prefix,
                          start: automatic
                            ? String(nextNumber(state.mice, prefix))
                            : prev.start,
                        }
                      })
                    }}
                    placeholder="可空，如 WT"
                  />
                </div>
                <div className="field">
                  <label>起始号</label>
                  <input
                    type="number"
                    min="1"
                    value={litterForm.start}
                    onChange={(event) =>
                      setLitterForm((prev) => ({
                        ...prev,
                        start: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>位数</label>
                  <select
                    value={litterForm.pad}
                    onChange={(event) =>
                      setLitterForm((prev) => ({ ...prev, pad: event.target.value }))
                    }
                  >
                    <option value="0">不补零</option>
                    <option value="2">2 位</option>
                    <option value="3">3 位</option>
                  </select>
                </div>
              </div>
              <div className="id-preview">
                {litterPreview.map((id) => (
                  <span
                    key={id}
                    className={litterConflicts.includes(id) ? 'conflict' : ''}
                  >
                    {id}
                  </span>
                ))}
                {litterTotal > litterPreview.length && (
                  <span className="muted">… 共 {litterTotal} 个</span>
                )}
                {!litterTotal && <span className="muted">先填公母数量</span>}
              </div>
              {litterConflicts.length > 0 && (
                <p className="field-hint danger">
                  有 {litterConflicts.length} 个编号已存在，请改起始号。
                </p>
              )}
            </div>
            <p className="hint">按“先公后母”的顺序分配编号；保存后仍可逐只修改。</p>
          </>
        ) : (
          <>
            <div className="form-grid">
              <div className="field">
                <label>小鼠编号</label>
                <div className="input-with-action">
                  <input
                    value={mouseForm.mouseId}
                    onChange={(event) =>
                      setMouseForm((prev) => ({
                        ...prev,
                        mouseId: event.target.value,
                      }))
                    }
                    placeholder="如 133"
                  />
                  {!editingMouseId && (
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={() =>
                        setMouseForm((prev) => ({
                          ...prev,
                          mouseId: String(nextNumber(state.mice)),
                        }))
                      }
                    >
                      下一个 {nextNumber(state.mice)}
                    </button>
                  )}
                </div>
              </div>
              <div className="field">
                <label>性别</label>
                <div className="segmented sex-seg">
                  {[
                    { value: '♂', label: '♂ 雄' },
                    { value: '♀', label: '♀ 雌' },
                    { value: '', label: '未知' },
                  ].map((option) => (
                    <button
                      type="button"
                      key={option.label}
                      className={mouseForm.sex === option.value ? 'active' : ''}
                      onClick={() =>
                        setMouseForm((prev) => ({ ...prev, sex: option.value }))
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>基因型</label>
                <select
                  value={mouseForm.genotypeSelect}
                  onChange={(event) => {
                    const value = event.target.value
                    setMouseForm((prev) => ({
                      ...prev,
                      genotypeSelect: value,
                      genotypeCustom:
                        value && value !== 'custom'
                          ? value
                          : value === ''
                            ? ''
                            : prev.genotypeCustom,
                    }))
                  }}
                >
                  <option value="">请选择</option>
                  {genotypePresets.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                  <option value="custom">自定义…</option>
                </select>
                {mouseForm.genotypeSelect === 'custom' && (
                  <input
                    value={mouseForm.genotypeCustom}
                    onChange={(event) =>
                      setMouseForm((prev) => ({
                        ...prev,
                        genotypeCustom: event.target.value,
                      }))
                    }
                    placeholder="输入基因型"
                  />
                )}
              </div>
              <div className="field">
                <label>出生日期</label>
                <input
                  type="date"
                  value={mouseForm.birthDate}
                  onChange={(event) =>
                    setMouseForm((prev) => ({
                      ...prev,
                      birthDate: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label>当前笼位</label>
                <select
                  value={mouseForm.cageId}
                  onChange={(event) =>
                    setMouseForm((prev) => ({ ...prev, cageId: event.target.value }))
                  }
                >
                  <option value="">请选择笼位</option>
                  {cagesSorted.map((cage) => (
                    <option key={cage.id} value={cage.id}>
                      {cage.cageNo}｜{cage.cageName || '未命名'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>来源</label>
                <select
                  value={mouseForm.sourceSelect}
                  onChange={(event) => {
                    const value = event.target.value
                    setMouseForm((prev) => ({
                      ...prev,
                      sourceSelect: value,
                      sourceCustom:
                        value && value !== 'custom'
                          ? value
                          : value === ''
                            ? ''
                            : prev.sourceCustom,
                    }))
                  }}
                >
                  <option value="">请选择</option>
                  <option value="本室繁殖">本室繁殖</option>
                  <option value="外购">外购</option>
                  <option value="合作课题">合作课题</option>
                  <option value="赠送">赠送</option>
                  <option value="custom">自定义…</option>
                </select>
                {mouseForm.sourceSelect === 'custom' && (
                  <input
                    value={mouseForm.sourceCustom}
                    onChange={(event) =>
                      setMouseForm((prev) => ({
                        ...prev,
                        sourceCustom: event.target.value,
                      }))
                    }
                    placeholder="输入来源"
                  />
                )}
              </div>
              <div className="field">
                <label>小鼠状态</label>
                <select
                  value={mouseForm.mouseStatus}
                  onChange={(event) =>
                    setMouseForm((prev) => ({
                      ...prev,
                      mouseStatus: event.target.value,
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
                <input
                  value={mouseForm.note}
                  onChange={(event) =>
                    setMouseForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                  placeholder="耳号、PCR、表型等"
                />
              </div>
            </div>

            <details className="more-fields">
              <summary>父母本（可不填）</summary>
              <div className="form-grid">
                <div className="field">
                  <label>父本编号</label>
                  <input
                    value={mouseForm.fatherId}
                    onChange={(event) =>
                      setMouseForm((prev) => ({
                        ...prev,
                        fatherId: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>母本编号</label>
                  <input
                    value={mouseForm.motherId}
                    onChange={(event) =>
                      setMouseForm((prev) => ({
                        ...prev,
                        motherId: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </details>
          </>
        )}
      </Sheet>

      <Sheet
        layer={120}
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={`批量修改 ${selectedMouseIds.length} 只`}
        subtitle="只填要改的项，留空的不动"
        footer={
          <div className="sheet-actions">
            <button className="btn-light" onClick={() => setBulkOpen(false)}>
              取消
            </button>
            <button className="btn-primary" onClick={applyBulk}>
              应用修改
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <div className="field">
            <label>状态</label>
            <select
              value={bulkForm.mouseStatus}
              onChange={(event) =>
                setBulkForm((prev) => ({
                  ...prev,
                  mouseStatus: event.target.value,
                }))
              }
            >
              <option value="">不修改</option>
              <option value="在养">在养</option>
              <option value="配对中">配对中</option>
              <option value="待鉴定">待鉴定</option>
              <option value="保留">保留</option>
              <option value="已取材">已取材</option>
              <option value="淘汰/死亡">淘汰/死亡</option>
            </select>
          </div>
          <div className="field">
            <label>转移到笼位</label>
            <select
              value={bulkForm.cageId}
              onChange={(event) =>
                setBulkForm((prev) => ({ ...prev, cageId: event.target.value }))
              }
            >
              <option value="">不修改</option>
              {cagesSorted.map((cage) => (
                <option key={cage.id} value={cage.id}>
                  {cage.cageNo}｜{cage.cageName || '未命名'}
                </option>
              ))}
            </select>
          </div>
          <div className="field full">
            <label>基因型</label>
            <select
              value={bulkForm.genotype}
              onChange={(event) =>
                setBulkForm((prev) => ({ ...prev, genotype: event.target.value }))
              }
            >
              <option value="">不修改</option>
              {genotypePresets.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn-danger-ghost bulk-delete" onClick={bulkDelete}>
          删除这 {selectedMouseIds.length} 只
        </button>
      </Sheet>

      <Sheet
        layer={120}
        open={printOpen}
        onClose={closePrint}
        title="打印 / 导出 PDF"
        subtitle={`A4 纵向 · ${printPages.length} 页`}
        wide
        footer={
          <div className="sheet-actions">
            <button className="btn-light" onClick={closePrint}>
              取消
            </button>
            <button
              className="btn-primary"
              onClick={handlePrint}
              disabled={printBusy || !printPages.length}
            >
              <Icon name="print" size={18} />
              打印 {printPages.length ? `${printPages.length} 页` : ''}
            </button>
          </div>
        }
      >
        <div className="print-toolbar">
          <div className="segmented">
            {[
              { key: 'all', label: '全部' },
              { key: 'filtered', label: '当前筛选' },
              { key: 'cage', label: '单个笼' },
            ].map((option) => (
              <button
                key={option.key}
                className={printScope === option.key ? 'active' : ''}
                onClick={() => setPrintScope(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {printScope === 'cage' && (
            <select
              className="compact-select"
              value={printCageId}
              onChange={(event) => setPrintCageId(event.target.value)}
            >
              {cagesSorted.map((cage) => (
                <option key={cage.id} value={cage.id}>
                  {cage.cageNo}｜{cage.cageName || '未命名'}
                </option>
              ))}
            </select>
          )}
          <label className="check-line">
            <input
              type="checkbox"
              checked={printIncludeRemoved}
              onChange={(event) => setPrintIncludeRemoved(event.target.checked)}
            />
            包含已取材 / 淘汰
          </label>
        </div>

        {printBusy ? (
          <div className="print-loading">正在生成 A4 页面…</div>
        ) : printPages.length ? (
          <div className="print-preview">
            {printPages.map((src, index) => (
              <figure key={index}>
                <img src={src} alt={`第 ${index + 1} 页`} loading="lazy" decoding="async" />
                <figcaption>
                  第 {index + 1} / {printPages.length} 页
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <Empty
            icon="print"
            title="没有可打印的数据"
            desc="换个范围，或先添加小鼠"
          />
        )}

        <p className="hint">
          点“打印”会打开新页面；在打印设置里选 A4、关闭“页眉和页脚”，再打印或存为
          PDF。手机同样可用。
        </p>
      </Sheet>

      <Sheet
        open={Boolean(selectedCage)}
        onClose={() => setSelectedCageId(null)}
        title={selectedCage ? `笼位 ${selectedCage.cageNo}` : '笼位详情'}
        subtitle={selectedCage?.cageName || ''}
        wide
      >
        {selectedCage &&
          (() => {
            const summary = getCageSummary(selectedCage.id)
            return (
              <>
                <div className="detail-top">
                  <span className={`tag ${getStatusClass(selectedCage.cageStatus)}`}>
                    {selectedCage.cageStatus || '正常'}
                  </span>
                  <span className="detail-chip">{selectedCage.cageType || '笼位'}</span>
                  <span className="detail-chip">
                    ♂{summary.male} · ♀{summary.female}
                    {summary.unknownSex ? ` · 未知${summary.unknownSex}` : ''}
                  </span>
                  {summary.crowded && (
                    <span className="warn-chip">超过 5 只，建议分笼</span>
                  )}
                  {summary.inactiveCount > 0 && (
                    <span className="detail-chip">
                      已处理 {summary.inactiveCount}
                    </span>
                  )}
                </div>

                <div className="detail-actions">
                  {!shareMode && (
                    <button className="btn-light" onClick={() => editCage(selectedCage.id)}>
                      <Icon name="edit" size={16} /> 编辑笼位
                    </button>
                  )}
                  <button
                    className="btn-light"
                    onClick={() => openPrintPreview('cage', selectedCage.id)}
                  >
                    <Icon name="print" size={16} /> 打印此笼
                  </button>
                  {!shareMode && (
                    <button
                      className="btn-light"
                      onClick={() => openEntry('single', selectedCage.id)}
                    >
                      <Icon name="plus" size={16} /> 加小鼠
                    </button>
                  )}
                  {!shareMode && (
                    <button
                      className="btn-light"
                      onClick={() => setCageMiceStatus(selectedCage.id, '待鉴定')}
                    >
                      整笼待鉴定
                    </button>
                  )}
                  {!shareMode && (
                    <button
                      className="btn-danger-ghost"
                      onClick={() => setCageMiceStatus(selectedCage.id, '已取材')}
                    >
                      整笼已取材
                    </button>
                  )}
                </div>

                <div className="detail-note">
                  <strong>笼位备注</strong>
                  <p>{selectedCage.note || '—'}</p>
                </div>

                <div className="cage-genos">
                  {summary.genotypes.length ? (
                    summary.genotypes.map(([genotype, count]) => (
                      <span className="geno-chip" key={genotype} title={genotype}>
                        {shortGenotype(genotype)} <b>{count}</b>
                      </span>
                    ))
                  ) : (
                    <span className="muted">
                      {summary.inactiveCount ? '无在养小鼠' : '空笼'}
                    </span>
                  )}
                  <span className="detail-chip">
                    幼鼠 {summary.juvenileCount}
                    {summary.juvenileCount ? ` · ${summary.juvenileAge}` : ''}
                  </span>
                </div>

                <div className="section-title mt14">
                  <h3>笼内小鼠</h3>
                  <small>
                    {summary.total} 只在养
                    {summary.inactiveCount ? ` · ${summary.inactiveCount} 只已处理` : ''}
                  </small>
                </div>

                {selectedCageMice.length ? (
                  <div className="detail-mouse-list">
                    {selectedCageMice.map((mouse) => (
                      <div className="detail-mouse" key={mouse.id}>
                        {!shareMode && (
                          <input
                            type="checkbox"
                            checked={selectedMouseIds.includes(mouse.id)}
                            onChange={() => toggleMouseSelect(mouse.id)}
                            aria-label={`选择 ${mouse.mouseId}`}
                          />
                        )}
                        <button
                          className="detail-mouse-main"
                          onClick={() => editMouse(mouse.id)}
                        >
                          <strong>{mouse.mouseId}</strong>
                          <SexTag sex={mouse.sex} />
                          <span className="detail-mouse-geno">
                            {mouse.genotype || '-'}
                          </span>
                          <small>
                            {formatAge(mouse.birthDate)} · {mouse.source || '来源未填'}
                          </small>
                        </button>
                        <StatusTag status={mouse.mouseStatus} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon="mouse"
                    title="这个笼里还没有小鼠"
                    desc="点“加小鼠”建档，或用一窝录入"
                  />
                )}

                {!shareMode && selectedMouseIds.length > 0 && (
                  <div className="selection-strip inline">
                    <span>已选 {selectedMouseIds.length} 只</span>
                    <button onClick={() => setBulkOpen(true)}>批量修改</button>
                    <button onClick={() => setSelectedMouseIds([])}>取消</button>
                  </div>
                )}

                {!shareMode && (
                  <button
                    className="link-btn danger-text mt14"
                    onClick={() => deleteCage(selectedCage.id)}
                  >
                    删除这个笼位
                  </button>
                )}
              </>
            )
          })()}
      </Sheet>

      <Sheet
        layer={120}
        open={cageModalOpen}
        onClose={() => {
          setCageModalOpen(false)
          resetCageForm()
        }}
        title={editingCageId ? '编辑笼位' : '新增笼位'}
        footer={
          <div className="sheet-actions">
            <button
              className="btn-light"
              onClick={() => {
                setCageModalOpen(false)
                resetCageForm()
              }}
            >
              取消
            </button>
            <button className="btn-primary" onClick={saveCage}>
              保存笼位
            </button>
          </div>
        }
      >
        <div className="form-grid">
          <div className="field">
            <label>笼号</label>
            <input
              value={cageForm.cageNo}
              onChange={(event) =>
                setCageForm((prev) => ({ ...prev, cageNo: event.target.value }))
              }
              placeholder="如 1 / A01"
            />
          </div>
          <div className="field">
            <label>笼名</label>
            <input
              value={cageForm.cageName}
              onChange={(event) =>
                setCageForm((prev) => ({ ...prev, cageName: event.target.value }))
              }
              placeholder="如 Snapin 繁殖 1 笼"
            />
          </div>
          <div className="field">
            <label>笼类型</label>
            <select
              value={cageForm.cageType}
              onChange={(event) =>
                setCageForm((prev) => ({ ...prev, cageType: event.target.value }))
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
              onChange={(event) =>
                setCageForm((prev) => ({ ...prev, cageStatus: event.target.value }))
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
              rows={3}
              value={cageForm.note}
              onChange={(event) =>
                setCageForm((prev) => ({ ...prev, note: event.target.value }))
              }
              placeholder="如 3月10日合笼；4月2日产仔；待 PCR"
            />
          </div>
        </div>
      </Sheet>

      <div className={`toast ${toast ? 'show' : ''}`} role="status">
        {toast}
      </div>
    </div>
  )
}


const NAV_ITEMS = [
  { key: 'dashboard', label: '首页总览', mobileLabel: '总览', icon: 'home' },
  { key: 'cages', label: '笼位管理', mobileLabel: '笼位', icon: 'grid' },
  { key: 'mice', label: '小鼠档案', mobileLabel: '小鼠', icon: 'mouse' },
  { key: 'settings', label: '导入导出', mobileLabel: '更多', icon: 'settings' },
]

function shortGenotype(genotype) {
  if (!genotype) return '未填写'
  return String(genotype)
    .replace(/Snapin flox/g, 'Sfl')
    .replace(/\s+/g, '')
}

const ICONS = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  mouse: (
    <>
      <circle cx="6.5" cy="9" r="2.2" />
      <circle cx="12" cy="6.5" r="2.2" />
      <circle cx="17.5" cy="9" r="2.2" />
      <path d="M12 11.5c-3.2 0-5.5 2.4-5.5 5S9 21 12 21s5.5-1.8 5.5-4.5-2.3-5-5.5-5Z" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h6M14 6h6M4 12h10M18 12h2M4 18h3M11 18h9" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="9" cy="18" r="2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  print: (
    <>
      <path d="M7 8V3h10v5" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  filter: <path d="M4 5h16l-6.5 7.5V19l-3 1.5v-8L4 5Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 21h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 21V9" />
      <path d="m8 13 4-4 4 4" />
      <path d="M4 3h16" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </>
  ),
}

function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] || ICONS.mouse}
    </svg>
  )
}

function StatusTag({ status }) {
  if (!status) return null
  return <span className={`tag ${getStatusClass(status)}`}>{status}</span>
}

function SexTag({ sex }) {
  if (!sex) return <span className="sex-tag unknown">?</span>
  return (
    <span className={`sex-tag ${sex === '♂' ? 'male' : sex === '♀' ? 'female' : 'unknown'}`}>
      {sex}
    </span>
  )
}

function PageHead({ eyebrow, title, subtitle, children }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="page-head-actions">{children}</div>}
    </header>
  )
}

function Empty({ icon = 'mouse', title, desc }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <strong>{title}</strong>
      {desc && <small>{desc}</small>}
    </div>
  )
}

function Sheet({ open, onClose, title, subtitle, children, footer, wide = false, layer = 100 }) {
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event) => {
      if (event.key === 'Escape') closeRef.current?.()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="sheet-backdrop"
      style={{ zIndex: layer }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current?.()
      }}
    >
      <div className={`sheet ${wide ? 'sheet-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={() => closeRef.current?.()} aria-label="关闭">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

function buildPrintPages({ mice, cages, scopeLabel }) {
  const cageMap = new Map(cages.map((cage) => [cage.id, cage]))

  const grouped = [...mice].sort((a, b) => {
    const cageA = cageMap.get(a.cageId)?.cageNo || ''
    const cageB = cageMap.get(b.cageId)?.cageNo || ''
    if (cageA !== cageB) {
      return cageA.localeCompare(cageB, 'zh-CN', { numeric: true })
    }
    return String(a.mouseId).localeCompare(String(b.mouseId), 'zh-CN', {
      numeric: true,
    })
  })

  const now = new Date()
  const dateText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`

  const pageWidth = 2480
  const pageHeight = 3508
  const marginX = 64
  const titleY = 88
  const dateY = 152
  const tableTop = 216
  const headerHeight = 84
  const rowHeight = 76
  const bottomMargin = 68
  const rowsPerPage = Math.max(
    1,
    Math.floor((pageHeight - tableTop - headerHeight - bottomMargin) / rowHeight)
  )
  const colWidths = [164, 256, 112, 410, 208, 564, 638]
  const headers = ['笼位', '小鼠编号', '性别', '基因型', '年龄', '小鼠备注', '笼位备注']
  const fontFamily =
    'PingFang SC, Hiragino Sans GB, Microsoft YaHei, SimSun, Arial, sans-serif'

  function wrapText(ctx, text, maxWidth, maxLines = 2) {
    const value = text === undefined || text === null ? '-' : String(text)
    if (!value) return []
    const lines = []
    let line = ''

    for (const char of value) {
      const next = line + char
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line)
        line = char
      } else {
        line = next
      }
    }

    if (line) lines.push(line)
    return lines.slice(0, maxLines)
  }

  function drawWrappedText(ctx, text, x, y, width, height, font, color = '#111111', maxLines = 2) {
    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = wrapText(ctx, text, width - 20, maxLines)
    if (!lines.length) return
    const lineHeight = Number(font.match(/(\d+)px/)?.[1] || 36) + 6
    const totalHeight = lines.length * lineHeight
    const firstY = y + height / 2 - totalHeight / 2 + lineHeight / 2

    lines.forEach((line, index) => {
      ctx.fillText(line, x + width / 2, firstY + index * lineHeight)
    })
  }

  function drawCell(ctx, x, y, width, height, text, options = {}) {
    ctx.fillStyle = options.fill || '#ffffff'
    ctx.fillRect(x, y, width, height)
    ctx.strokeStyle = '#222222'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, width, height)
    drawWrappedText(
      ctx,
      text,
      x,
      y,
      width,
      height,
      options.font || `36px ${fontFamily}`,
      options.color || '#111111',
      options.maxLines || 2
    )
  }

  function makePage(rowsForPage, pageNumber, pageCount) {
    const canvas = document.createElement('canvas')
    canvas.width = pageWidth
    canvas.height = pageHeight
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, pageWidth, pageHeight)
    ctx.fillStyle = '#111111'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 60px ${fontFamily}`
    ctx.fillText('基因小鼠笼位打印表', pageWidth / 2, titleY)
    ctx.font = `34px ${fontFamily}`
    ctx.fillStyle = '#444444'
    ctx.fillText(`导出日期：${dateText} ｜ ${scopeLabel}`, pageWidth / 2, dateY)

    let x = marginX
    headers.forEach((header, index) => {
      drawCell(ctx, x, tableTop, colWidths[index], headerHeight, header, {
        fill: '#f3f4f6',
        font: `700 36px ${fontFamily}`,
        maxLines: 1,
      })
      x += colWidths[index]
    })

    rowsForPage.forEach((row, rowIndex) => {
      const y = tableTop + headerHeight + rowIndex * rowHeight
      let cellX = marginX
      row.cells.slice(0, 6).forEach((cell, cellIndex) => {
        drawCell(ctx, cellX, y, colWidths[cellIndex], rowHeight, cell)
        cellX += colWidths[cellIndex]
      })
    })

    const cageNoteX = marginX + colWidths.slice(0, 6).reduce((sum, width) => sum + width, 0)
    let spanStart = 0
    while (spanStart < rowsForPage.length) {
      const first = rowsForPage[spanStart]
      let spanEnd = spanStart + 1

      while (
        spanEnd < rowsForPage.length &&
        rowsForPage[spanEnd].cageKey === first.cageKey
      ) {
        spanEnd += 1
      }

      drawCell(
        ctx,
        cageNoteX,
        tableTop + headerHeight + spanStart * rowHeight,
        colWidths[6],
        (spanEnd - spanStart) * rowHeight,
        first.cells[6],
        { maxLines: Math.max(2, (spanEnd - spanStart) * 2) }
      )

      spanStart = spanEnd
    }

    ctx.fillStyle = '#555555'
    ctx.font = `32px ${fontFamily}`
    ctx.textAlign = 'right'
    ctx.fillText(`${pageNumber}/${pageCount}`, pageWidth - marginX, pageHeight - 24)

    return canvas.toDataURL('image/png')
  }

  const rows = grouped.map((mouse) => {
    const cage = cageMap.get(mouse.cageId)
    return {
      cageKey: mouse.cageId || `no-cage-${mouse.id || mouse.mouseId || Math.random()}`,
      cells: [
        cage?.cageNo || '-',
        mouse.mouseId || '-',
        mouse.sex || '-',
        mouse.genotype || '-',
        formatAge(mouse.birthDate),
        mouse.note || '',
        cage?.note || '',
      ],
    }
  })

  const printableRows = rows.length
    ? rows
    : [{ cageKey: 'empty', cells: ['-', '-', '-', '-', '-', '暂无数据', ''] }]
  const pageRows = []
  for (let i = 0; i < printableRows.length; i += rowsPerPage) {
    pageRows.push(printableRows.slice(i, i + rowsPerPage))
  }

  return {
    images: pageRows.map((items, index) => makePage(items, index + 1, pageRows.length)),
    dateText,
  }
}

function openPrintWindow(pageImages, dateText, scopeLabel) {
  const html = `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>基因小鼠笼位打印表-${dateText}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #eef2f7; }
          .screen-actions {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            padding: 20px 14px;
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
            text-align: center;
          }
          button {
            border: 0;
            border-radius: 12px;
            background: #2563eb;
            color: #ffffff;
            cursor: pointer;
            font-size: 17px;
            font-weight: 700;
            padding: 14px 24px;
            width: min(100%, 420px);
          }
          .hint { color: #4b5563; font-size: 13px; margin: 0; line-height: 1.6; }
          .pages { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 0 10px 28px; }
          .page {
            display: block;
            width: min(100%, 210mm);
            background: #ffffff;
            box-shadow: 0 6px 24px rgba(15, 23, 42, 0.15);
            page-break-after: always;
          }
          .page:last-child { page-break-after: auto; }
          .page img { display: block; width: 100%; height: auto; }
          @media print {
            html, body { background: #ffffff; }
            .screen-actions { display: none; }
            .pages { display: block; padding: 0; }
            .page {
              width: 210mm;
              height: 297mm;
              box-shadow: none;
              page-break-after: always;
            }
            .page img { width: 210mm; height: 297mm; }
          }
        </style>
      </head>
      <body>
        <div class="screen-actions">
          <button onclick="window.print()">打印 / 保存 PDF</button>
          <p class="hint">范围：${scopeLabel} · 打印设置选 A4 纵向，关闭“页眉和页脚”。<br />手机可在分享菜单里选择“打印”。</p>
        </div>
        <div class="pages">
          ${pageImages
            .map(
              (src, index) =>
                `<div class="page"><img src="${src}" alt="打印表第 ${index + 1} 页" /></div>`
            )
            .join('')}
        </div>
      </body>
    </html>
  `

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const printWindow = window.open(url, '_blank')
  if (!printWindow) {
    URL.revokeObjectURL(url)
    return false
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  printWindow.focus?.()
  return true
}


export default App
