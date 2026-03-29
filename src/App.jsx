import { useMemo, useState } from 'react'

const initialCages = [
  {
    id: 1,
    cageName: 'A101',
    status: '配对中',
    source: '繁殖',
    maleCount: 1,
    femaleCount: 2,
    pupCount: 0,
    genotype: 'Snapin flox/flox × Cre+',
    birthDate: '',
    note: '本周观察插栓',
  },
  {
    id: 2,
    cageName: 'A102',
    status: '已配对',
    source: '繁殖',
    maleCount: 1,
    femaleCount: 1,
    pupCount: 6,
    genotype: 'Snapin flox/flox',
    birthDate: '2026-03-20',
    note: '待剪尾',
  },
  {
    id: 3,
    cageName: 'B201',
    status: '待结果',
    source: '繁殖',
    maleCount: 0,
    femaleCount: 0,
    pupCount: 5,
    genotype: 'Cre+/-',
    birthDate: '2026-03-10',
    note: 'PCR未回',
  },
  {
    id: 4,
    cageName: 'C301',
    status: '外购',
    source: '外购',
    maleCount: 2,
    femaleCount: 3,
    pupCount: 0,
    genotype: 'Snapin flox/+',
    birthDate: '',
    note: '新入笼观察中',
  },
]

function daysSince(dateString) {
  if (!dateString) return '-'
  const today = new Date()
  const birth = new Date(dateString)
  const diff = Math.floor((today - birth) / (1000 * 60 * 60 * 24))
  if (diff < 0) return '-'
  if (diff < 7) return `${diff}天`
  if (diff < 30) {
    const weeks = Math.floor(diff / 7)
    const days = diff % 7
    return `${weeks}周${days}天`
  }
  const months = Math.floor(diff / 30)
  const weeks = Math.floor((diff % 30) / 7)
  return `${months}月${weeks}周`
}

function StatCard({ title, value, sub }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTitle}>{title}</div>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statSub}>{sub}</div>
    </div>
  )
}

function App() {
  const [cages, setCages] = useState(initialCages)
  const [statusFilter, setStatusFilter] = useState('全部')
  const [genotypeFilter, setGenotypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    cageName: '',
    status: '配对中',
    source: '繁殖',
    maleCount: 1,
    femaleCount: 1,
    pupCount: 0,
    genotype: '',
    birthDate: '',
    note: '',
  })

  const filteredCages = useMemo(() => {
    return cages.filter((cage) => {
      const matchStatus =
        statusFilter === '全部' ? true : cage.status === statusFilter

      const matchGenotype = genotypeFilter.trim()
        ? cage.genotype === genotypeFilter.trim()
        : true

      const keyword = search.trim().toLowerCase()
      const matchSearch = keyword
        ? [
            cage.cageName,
            cage.status,
            cage.source,
            cage.genotype,
            cage.note,
          ]
            .join(' ')
            .toLowerCase()
            .includes(keyword)
        : true

      return matchStatus && matchGenotype && matchSearch
    })
  }, [cages, statusFilter, genotypeFilter, search])

  const summary = useMemo(() => {
    return {
      totalCages: cages.length,
      totalMice: cages.reduce(
        (sum, cage) => sum + cage.maleCount + cage.femaleCount + cage.pupCount,
        0
      ),
      pairing: cages.filter((cage) => cage.status === '配对中').length,
      waitingTail: cages.filter((cage) => cage.note.includes('待剪尾')).length,
      waitingResult: cages.filter((cage) => cage.status === '待结果').length,
      pups: cages.reduce((sum, cage) => sum + cage.pupCount, 0),
    }
  }, [cages])

  const genotypeOptions = useMemo(() => {
    return [...new Set(cages.map((cage) => cage.genotype).filter(Boolean))]
  }, [cages])

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.cageName.trim()) return
    if (!form.genotype.trim()) return

    const newCage = {
      id: Date.now(),
      cageName: form.cageName.trim(),
      status: form.status,
      source: form.source,
      maleCount: Number(form.maleCount),
      femaleCount: Number(form.femaleCount),
      pupCount: Number(form.pupCount),
      genotype: form.genotype.trim(),
      birthDate: form.birthDate,
      note: form.note.trim(),
    }

    setCages((prev) => [newCage, ...prev])
    setForm({
      cageName: '',
      status: '配对中',
      source: '繁殖',
      maleCount: 1,
      femaleCount: 1,
      pupCount: 0,
      genotype: '',
      birthDate: '',
      note: '',
    })
  }

  const handleDelete = (id) => {
    setCages((prev) => prev.filter((cage) => cage.id !== id))
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>基因小鼠繁殖管理</h1>
            <p style={styles.subtitle}>按笼位管理配对、幼鼠、基因型与待办事项</p>
          </div>
        </header>

        <section style={styles.statsGrid}>
          <StatCard title="总笼数" value={summary.totalCages} sub="当前系统记录" />
          <StatCard title="总只数" value={summary.totalMice} sub="成鼠 + 幼鼠" />
          <StatCard title="配对中" value={summary.pairing} sub="正在繁殖观察" />
          <StatCard title="幼鼠数" value={summary.pups} sub="所有笼位合计" />
          <StatCard title="待剪尾" value={summary.waitingTail} sub="尽快安排" />
          <StatCard title="待结果" value={summary.waitingResult} sub="PCR未回或待录入" />
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>筛选</h2>
          <div style={styles.filterGrid}>
            <div>
              <label style={styles.label}>状态</label>
              <select
                style={styles.input}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>全部</option>
                <option>配对中</option>
                <option>已配对</option>
                <option>待剪尾</option>
                <option>待结果</option>
                <option>外购</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>精确基因型筛选</label>
              <select
                style={styles.input}
                value={genotypeFilter}
                onChange={(e) => setGenotypeFilter(e.target.value)}
              >
                <option value="">全部</option>
                {genotypeOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>关键词搜索</label>
              <input
                style={styles.input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="笼号 / 备注 / 基因型"
              />
            </div>
          </div>
        </section>

        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>新增笼位</h2>
          <form onSubmit={handleAdd} style={styles.formGrid}>
            <div>
              <label style={styles.label}>笼号</label>
              <input
                style={styles.input}
                value={form.cageName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cageName: e.target.value }))
                }
                placeholder="例如 A305"
              />
            </div>

            <div>
              <label style={styles.label}>状态</label>
              <select
                style={styles.input}
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option>配对中</option>
                <option>已配对</option>
                <option>待剪尾</option>
                <option>待结果</option>
                <option>外购</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>来源</label>
              <select
                style={styles.input}
                value={form.source}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, source: e.target.value }))
                }
              >
                <option>繁殖</option>
                <option>外购</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>雄鼠数</label>
              <input
                type="number"
                min="0"
                style={styles.input}
                value={form.maleCount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, maleCount: e.target.value }))
                }
              />
            </div>

            <div>
              <label style={styles.label}>雌鼠数</label>
              <input
                type="number"
                min="0"
                style={styles.input}
                value={form.femaleCount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, femaleCount: e.target.value }))
                }
              />
            </div>

            <div>
              <label style={styles.label}>幼鼠数</label>
              <input
                type="number"
                min="0"
                style={styles.input}
                value={form.pupCount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, pupCount: e.target.value }))
                }
              />
            </div>

            <div>
              <label style={styles.label}>基因型</label>
              <input
                style={styles.input}
                value={form.genotype}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, genotype: e.target.value }))
                }
                placeholder="例如 Cre+ / Snapin flox/flox"
              />
            </div>

            <div>
              <label style={styles.label}>出生日期</label>
              <input
                type="date"
                style={styles.input}
                value={form.birthDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, birthDate: e.target.value }))
                }
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={styles.label}>备注</label>
              <input
                style={styles.input}
                value={form.note}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="例如 待剪尾 / 插栓阳性 / 分笼时间21天"
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" style={styles.primaryButton}>
                添加笼位
              </button>
            </div>
          </form>
        </section>

        <section style={styles.panel}>
          <div style={styles.tableHeader}>
            <h2 style={styles.panelTitle}>笼位列表</h2>
            <div style={styles.smallText}>当前显示 {filteredCages.length} 个笼位</div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>笼号</th>
                  <th style={styles.th}>状态</th>
                  <th style={styles.th}>来源</th>
                  <th style={styles.th}>♂</th>
                  <th style={styles.th}>♀</th>
                  <th style={styles.th}>幼鼠</th>
                  <th style={styles.th}>基因型</th>
                  <th style={styles.th}>出生后时间</th>
                  <th style={styles.th}>备注</th>
                  <th style={styles.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredCages.map((cage) => (
                  <tr key={cage.id}>
                    <td style={styles.td}>{cage.cageName}</td>
                    <td style={styles.td}>{cage.status}</td>
                    <td style={styles.td}>{cage.source}</td>
                    <td style={styles.td}>{cage.maleCount}</td>
                    <td style={styles.td}>{cage.femaleCount}</td>
                    <td style={styles.td}>{cage.pupCount}</td>
                    <td style={styles.td}>{cage.genotype}</td>
                    <td style={styles.td}>{daysSince(cage.birthDate)}</td>
                    <td style={styles.td}>{cage.note || '-'}</td>
                    <td style={styles.td}>
                      <button
                        onClick={() => handleDelete(cage.id)}
                        style={styles.deleteButton}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e5e7eb',
    padding: '24px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    margin: 0,
    fontSize: '36px',
    fontWeight: 800,
  },
  subtitle: {
    marginTop: '8px',
    color: '#94a3b8',
    fontSize: '16px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  statCard: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '16px',
    padding: '18px',
  },
  statTitle: {
    color: '#94a3b8',
    fontSize: '14px',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 800,
    marginBottom: '6px',
  },
  statSub: {
    color: '#64748b',
    fontSize: '13px',
  },
  panel: {
    background: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '18px',
    padding: '20px',
    marginBottom: '24px',
  },
  panelTitle: {
    margin: 0,
    marginBottom: '16px',
    fontSize: '22px',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    color: '#cbd5e1',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f8fafc',
    fontSize: '14px',
  },
  primaryButton: {
    border: 'none',
    borderRadius: '12px',
    padding: '12px 18px',
    background: '#7c3aed',
    color: 'white',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  smallText: {
    color: '#94a3b8',
    fontSize: '14px',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '1px solid #334155',
    color: '#94a3b8',
    fontSize: '13px',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px',
    borderBottom: '1px solid #1f2937',
    fontSize: '14px',
    verticalAlign: 'top',
  },
  deleteButton: {
    border: '1px solid #7f1d1d',
    background: '#450a0a',
    color: '#fecaca',
    borderRadius: '10px',
    padding: '8px 12px',
    cursor: 'pointer',
  },
}

export default App
