import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'

export interface RegistroParaPdf {
  dataLeitura: Date
  periodo: string
  ambienteNome: string
  temperaturaGraus: number
  umidadePercent: number | null
  nomeUsuario: string
  alertaDisparado: boolean
  observacao: string | null
  tempMin: number
  tempMax: number
}

export interface PdfTemperaturaInput {
  tenantNome: string
  tenantCnpj?: string
  dataInicio: string
  dataFim: string
  registros: RegistroParaPdf[]
}

const AZUL = rgb(0.06, 0.27, 0.62)
const CINZA_CLARO = rgb(0.93, 0.94, 0.96)
const CINZA_ESCURO = rgb(0.15, 0.15, 0.15)
const VERMELHO = rgb(0.85, 0.15, 0.15)
const BRANCO = rgb(1, 1, 1)

function fmtData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function fmtCnpj(cnpj: string): string {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export async function generateTemperaturaPdf(d: PdfTemperaturaInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const reg = await doc.embedFont(StandardFonts.Helvetica)

  const ML = 40
  const MR = 40
  const PAGE_W = PageSizes.A4[0]
  const PAGE_H = PageSizes.A4[1]
  const CW = PAGE_W - ML - MR

  // Column widths
  const cols = [52, 42, 110, 48, 48, 90, 60] // data, periodo, ambiente, temp, umid, responsavel, alerta
  const colHeaders = ['Data', 'Período', 'Ambiente', 'Temp (°C)', 'Umid (%)', 'Responsável', 'Status']

  let page = doc.addPage(PageSizes.A4)
  let y = PAGE_H - 40

  function addPage() {
    page = doc.addPage(PageSizes.A4)
    y = PAGE_H - 40
  }

  function checkSpace(needed: number) {
    if (y - needed < 50) addPage()
  }

  // ── Cabeçalho ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: ML - 8, y: y - 50, width: CW + 16, height: 60, color: AZUL })
  page.drawText('Controle de Temperatura e Umidade', {
    x: ML, y: y - 14, size: 14, font: bold, color: BRANCO,
  })
  page.drawText(d.tenantCnpj ? `${d.tenantNome} — CNPJ ${fmtCnpj(d.tenantCnpj)}` : d.tenantNome, {
    x: ML, y: y - 30, size: 9, font: reg, color: BRANCO,
  })
  page.drawText(`Período: ${d.dataInicio} a ${d.dataFim}`, {
    x: ML, y: y - 42, size: 8, font: reg, color: BRANCO,
  })
  y -= 68

  // ── Estatísticas rápidas ──────────────────────────────────────────────────────
  const total = d.registros.length
  const alertas = d.registros.filter(r => r.alertaDisparado).length
  page.drawText(`Total de registros: ${total}   |   Alertas disparados: ${alertas}`, {
    x: ML, y, size: 8, font: reg, color: CINZA_ESCURO,
  })
  y -= 18

  // ── Cabeçalho da tabela ───────────────────────────────────────────────────────
  function drawTableHeader() {
    page.drawRectangle({ x: ML - 4, y: y - 14, width: CW + 8, height: 18, color: AZUL })
    let cx = ML
    for (let i = 0; i < colHeaders.length; i++) {
      page.drawText(colHeaders[i], { x: cx + 2, y: y - 10, size: 7, font: bold, color: BRANCO })
      cx += cols[i]
    }
    y -= 18
  }

  drawTableHeader()

  // ── Linhas ────────────────────────────────────────────────────────────────────
  let rowIndex = 0
  for (const r of d.registros) {
    checkSpace(16)
    if (y === PAGE_H - 40) drawTableHeader() // nova página com cabeçalho

    const bg = rowIndex % 2 === 0 ? CINZA_CLARO : BRANCO
    page.drawRectangle({ x: ML - 4, y: y - 12, width: CW + 8, height: 14, color: bg })

    const tempFora = r.temperaturaGraus < r.tempMin || r.temperaturaGraus > r.tempMax
    const tempColor = tempFora ? VERMELHO : CINZA_ESCURO

    const cells = [
      fmtData(r.dataLeitura),
      r.periodo === 'MANHA' ? 'Manhã' : 'Tarde',
      r.ambienteNome.length > 18 ? r.ambienteNome.slice(0, 17) + '…' : r.ambienteNome,
      r.temperaturaGraus.toFixed(1),
      r.umidadePercent != null ? r.umidadePercent.toFixed(1) : '—',
      r.nomeUsuario.length > 14 ? r.nomeUsuario.slice(0, 13) + '…' : r.nomeUsuario,
      r.alertaDisparado ? 'ALERTA' : 'OK',
    ]

    let cx = ML
    for (let i = 0; i < cells.length; i++) {
      const color = (i === 3 && tempFora) || (i === 6 && r.alertaDisparado) ? VERMELHO : CINZA_ESCURO
      page.drawText(cells[i], { x: cx + 2, y: y - 9, size: 7, font: reg, color })
      cx += cols[i]
    }

    if (r.observacao) {
      y -= 13
      checkSpace(12)
      page.drawText(`  Obs: ${r.observacao}`, { x: ML + 4, y: y - 9, size: 6, font: reg, color: CINZA_ESCURO })
    }

    y -= 14
    rowIndex++
  }

  // ── Rodapé ────────────────────────────────────────────────────────────────────
  const pageCount = doc.getPageCount()
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  for (let i = 0; i < pageCount; i++) {
    const p = doc.getPage(i)
    p.drawText(`Gerado em: ${geradoEm}   |   Página ${i + 1} de ${pageCount}   |   FarmaSign`, {
      x: ML, y: 20, size: 7, font: reg, color: CINZA_ESCURO,
    })
  }

  return doc.save()
}
