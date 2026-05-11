function exportPrintableTable() {
  const cageMap = new Map(state.cages.map((c) => [c.id, c]))

  const grouped = [...state.mice].sort((a, b) => {
    const cageA = cageMap.get(a.cageId)?.cageNo || ''
    const cageB = cageMap.get(b.cageId)?.cageNo || ''
    if (cageA !== cageB) {
      return cageA.localeCompare(cageB, 'zh-CN', { numeric: true })
    }
    return String(a.mouseId).localeCompare(String(b.mouseId), 'zh-CN', {
      numeric: true,
    })
  })

  const rows = grouped
    .map((m) => {
      const cage = cageMap.get(m.cageId)
      const noteText = [m.note, cage?.note].filter(Boolean).join('；')

      return `
        <tr>
          <td>${cage?.cageNo || '-'}</td>
          <td>${m.mouseId || '-'}</td>
          <td>${m.sex || '-'}</td>
          <td>${m.genotype || '-'}</td>
          <td>${noteText}</td>
        </tr>
      `
    })
    .join('')

  const now = new Date()
  const dateText = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <title>基因小鼠笼位打印表</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
          margin: 24px;
          color: #111;
        }
        h1 {
          text-align: center;
          margin: 0 0 8px;
          font-size: 24px;
        }
        .sub {
          text-align: center;
          margin-bottom: 20px;
          font-size: 14px;
          color: #444;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th, td {
          border: 1px solid #333;
          padding: 8px 10px;
          font-size: 14px;
          text-align: center;
          word-break: break-word;
        }
        th {
          background: #f3f4f6;
          font-weight: 700;
        }
        @media print {
          body {
            margin: 12mm;
          }
        }
      </style>
    </head>
    <body>
      <h1>基因小鼠笼位打印表</h1>
      <div class="sub">导出日期：${dateText}</div>
      <table>
        <thead>
          <tr>
            <th>笼位</th>
            <th>小鼠编号</th>
            <th>性别</th>
            <th>基因型</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5">暂无数据</td></tr>'}
        </tbody>
      </table>
    </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    showToast('打印窗口打开失败')
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
