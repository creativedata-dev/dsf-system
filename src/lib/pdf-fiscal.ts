import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import QRCode from 'qrcode'

const AZUL    = rgb(0.06, 0.27, 0.62)
const CINZA   = rgb(0.93, 0.94, 0.96)
const ESCURO  = rgb(0.12, 0.12, 0.16)
const VERMELHO= rgb(0.85, 0.15, 0.15)
const LARANJA = rgb(0.9,  0.45, 0.0)
const VERDE   = rgb(0.08, 0.55, 0.25)
const BRANCO  = rgb(1, 1, 1)

function fmtData(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}
function fmtCnpj(c: string): string {
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RegistroTemp {
  dataLeitura: Date | string
  periodo: string
  ambienteNome: string
  temperaturaGraus: number
  umidadePercent: number | null
  nomeUsuario: string
  alertaDisparado: boolean
}

export interface Equipamento {
  nome: string
  marcaModelo: string
  numeroSerie: string | null
  status: string
  dataUltimaCalibracao: Date | string
  dataProximaCalibracao: Date | string
  numeroCertificado: string | null
  laboratorio: string | null
}

export interface PopAssinatura {
  nomeUsuario: string
  aprovado: boolean
  acertos: number
  totalQuestoes: number
  createdAt: Date | string
}

export interface PopResumo {
  codigo: string
  titulo: string
  versao: string
  assinaturas: PopAssinatura[]
  totalUsuarios: number
}

export interface LoteValidade {
  nomeProduto: string
  fabricante: string
  lote: string
  validade: Date | string
  quantidade: number
  unidade: string
  status: string
  descarte?: { numeroAuto: string; motivo: string; dataDescarte: Date | string; responsavel: string } | null
}

export interface PdfFiscalInput {
  tenantNome: string
  tenantCnpj: string
  tenantEndereco: string
  tenantAlvara: string
  dataInicio: string
  dataFim: string
  geradoEm: Date
  tokenUrl: string
  secoes: string[]
  temperatura?: RegistroTemp[]
  equipamentos?: Equipamento[]
  pops?: PopResumo[]
  validade?: LoteValidade[]
}

// ─── PDF Builder ─────────────────────────────────────────────────────────────

export async function generateFiscalPdf(d: PdfFiscalInput): Promise<Uint8Array> {
  const doc  = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const reg  = await doc.embedFont(StandardFonts.Helvetica)

  const ML = 40
  const MR = 40
  const PAGE_W = PageSizes.A4[0]
  const PAGE_H = PageSizes.A4[1]
  const CW = PAGE_W - ML - MR

  let page = doc.addPage(PageSizes.A4)
  let y = PAGE_H - 40

  const newPage = () => {
    page = doc.addPage(PageSizes.A4)
    y = PAGE_H - 40
  }

  const ensureSpace = (needed: number) => {
    if (y - needed < 40) newPage()
  }

  const text = (t: string, x: number, fontSize: number, font = reg, color = ESCURO) => {
    page.drawText(t, { x, y, size: fontSize, font, color })
  }

  const rect = (x: number, ry: number, w: number, h: number, color = CINZA) => {
    page.drawRectangle({ x, y: ry, width: w, height: h, color })
  }

  const line = (x1: number, x2: number, ly: number, color = CINZA, thickness = 0.5) => {
    page.drawLine({ start: { x: x1, y: ly }, end: { x: x2, y: ly }, thickness, color })
  }

  // ── Capa ──────────────────────────────────────────────────────────────────
  rect(0, PAGE_H - 100, PAGE_W, 100, AZUL)
  page.drawText('PACOTE DE CONFORMIDADE', { x: ML, y: PAGE_H - 45, size: 18, font: bold, color: BRANCO })
  page.drawText('Farmácia — RDC 44/2009 / ANVISA', { x: ML, y: PAGE_H - 65, size: 10, font: reg, color: rgb(0.8, 0.87, 0.97) })
  page.drawText(`Gerado em: ${d.geradoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, {
    x: ML, y: PAGE_H - 82, size: 8, font: reg, color: rgb(0.8, 0.87, 0.97),
  })
  y = PAGE_H - 120

  // Dados do estabelecimento
  text(d.tenantNome, ML, 13, bold, AZUL); y -= 18
  text(`CNPJ: ${fmtCnpj(d.tenantCnpj)}`, ML, 9); y -= 12
  text(d.tenantEndereco, ML, 9); y -= 12
  text(`Alvará Sanitário: ${d.tenantAlvara}`, ML, 9); y -= 20
  text(`Período de referência: ${fmtData(d.dataInicio + 'T00:00:00Z')} a ${fmtData(d.dataFim + 'T00:00:00Z')}`, ML, 10, bold, ESCURO)
  y -= 16

  // Seções incluídas
  text('Seções incluídas neste pacote:', ML, 9, reg, rgb(0.4, 0.4, 0.4)); y -= 12
  const SECAO_LABELS: Record<string, string> = {
    TEMPERATURA: 'Temperatura e Umidade',
    EQUIPAMENTOS: 'Equipamentos e Calibração',
    POPS: 'POPs e Treinamentos',
    VALIDADE: 'Controle de Validade',
  }
  for (const s of d.secoes) {
    text(`• ${SECAO_LABELS[s] ?? s}`, ML + 8, 9); y -= 11
  }
  y -= 10

  // QR Code no canto inferior da capa
  try {
    const qrDataUrl = await QRCode.toDataURL(d.tokenUrl, { width: 120, margin: 1 })
    const qrBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '')
    const qrBytes  = Buffer.from(qrBase64, 'base64')
    const qrImage  = await doc.embedPng(qrBytes)
    page.drawImage(qrImage, { x: PAGE_W - MR - 90, y: 50, width: 90, height: 90 })
    page.drawText('Verificar autenticidade', { x: PAGE_W - MR - 90, y: 43, size: 7, font: reg, color: rgb(0.5, 0.5, 0.5) })
  } catch { /* QR opcional */ }

  line(ML, PAGE_W - MR, y, AZUL, 1); y -= 16

  // ── Seção: Temperatura ────────────────────────────────────────────────────
  if (d.secoes.includes('TEMPERATURA') && d.temperatura) {
    ensureSpace(40)
    rect(ML, y - 4, CW, 18, AZUL)
    page.drawText('1. CONTROLE DE TEMPERATURA E UMIDADE', { x: ML + 6, y: y + 2, size: 10, font: bold, color: BRANCO })
    y -= 22

    const alertas = d.temperatura.filter(r => r.alertaDisparado).length
    text(`Total de leituras: ${d.temperatura.length}   Alertas disparados: ${alertas}`, ML, 8, reg, rgb(0.4, 0.4, 0.4)); y -= 14

    const headers = ['Data', 'Período', 'Ambiente', 'Temp', 'Umid', 'Responsável', 'Status']
    const cw = [48, 38, 120, 40, 40, 100, 60]
    let cx = ML
    rect(ML, y - 2, CW, 13, rgb(0.22, 0.4, 0.7))
    for (let i = 0; i < headers.length; i++) {
      page.drawText(headers[i], { x: cx + 2, y: y + 1, size: 7, font: bold, color: BRANCO })
      cx += cw[i]
    }
    y -= 14

    for (const r of d.temperatura) {
      ensureSpace(12)
      cx = ML
      const rowColor = r.alertaDisparado ? rgb(1, 0.93, 0.93) : (d.temperatura.indexOf(r) % 2 === 0 ? CINZA : BRANCO)
      rect(ML, y - 2, CW, 12, rowColor)
      const vals = [
        fmtData(r.dataLeitura),
        r.periodo,
        r.ambienteNome.slice(0, 18),
        `${r.temperaturaGraus}°C`,
        r.umidadePercent != null ? `${r.umidadePercent}%` : '—',
        r.nomeUsuario.slice(0, 16),
        r.alertaDisparado ? 'ALERTA' : 'OK',
      ]
      for (let i = 0; i < vals.length; i++) {
        const color = i === 6 && r.alertaDisparado ? VERMELHO : ESCURO
        page.drawText(vals[i], { x: cx + 2, y: y + 2, size: 7, font: i === 6 && r.alertaDisparado ? bold : reg, color })
        cx += cw[i]
      }
      y -= 12
    }
    y -= 10
  }

  // ── Seção: Equipamentos ───────────────────────────────────────────────────
  if (d.secoes.includes('EQUIPAMENTOS') && d.equipamentos) {
    ensureSpace(40)
    newPage()
    rect(ML, y - 4, CW, 18, AZUL)
    page.drawText('2. EQUIPAMENTOS E CALIBRAÇÃO', { x: ML + 6, y: y + 2, size: 10, font: bold, color: BRANCO })
    y -= 22

    const vencidos = d.equipamentos.filter(e => e.status === 'VENCIDO').length
    const vencendo = d.equipamentos.filter(e => e.status === 'VENCENDO').length
    text(`Total: ${d.equipamentos.length}   Vencidos: ${vencidos}   Vencendo: ${vencendo}`, ML, 8, reg, rgb(0.4, 0.4, 0.4)); y -= 14

    for (const eq of d.equipamentos) {
      ensureSpace(40)
      const statusColor = eq.status === 'VENCIDO' ? VERMELHO : eq.status === 'VENCENDO' ? LARANJA : VERDE
      const bgColor = eq.status === 'VENCIDO' ? rgb(1, 0.93, 0.93) : CINZA
      rect(ML, y - 2, CW, 30, bgColor)
      page.drawText(eq.nome, { x: ML + 6, y: y + 16, size: 9, font: bold, color: ESCURO })
      page.drawText(eq.marcaModelo + (eq.numeroSerie ? ` — Série: ${eq.numeroSerie}` : ''), { x: ML + 6, y: y + 6, size: 8, font: reg, color: ESCURO })
      page.drawText(`Última calibração: ${fmtData(eq.dataUltimaCalibracao)}  Próxima: ${fmtData(eq.dataProximaCalibracao)}`, { x: ML + 6, y: y - 3, size: 7, font: reg, color: rgb(0.4, 0.4, 0.4) })
      if (eq.numeroCertificado) {
        page.drawText(`Cert: ${eq.numeroCertificado}  Lab: ${eq.laboratorio ?? '—'}`, { x: ML + 6, y: y - 11, size: 7, font: reg, color: rgb(0.4, 0.4, 0.4) })
      }
      page.drawText(eq.status, { x: PAGE_W - MR - 50, y: y + 10, size: 8, font: bold, color: statusColor })
      y -= 36
    }
    y -= 6
  }

  // ── Seção: POPs ───────────────────────────────────────────────────────────
  if (d.secoes.includes('POPS') && d.pops) {
    ensureSpace(40)
    newPage()
    rect(ML, y - 4, CW, 18, AZUL)
    page.drawText('3. POPs E TREINAMENTOS', { x: ML + 6, y: y + 2, size: 10, font: bold, color: BRANCO })
    y -= 22

    for (const pop of d.pops) {
      ensureSpace(30)
      const concluidos = pop.assinaturas.filter(a => a.aprovado).length
      const pct = pop.totalUsuarios > 0 ? Math.round((concluidos / pop.totalUsuarios) * 100) : 0
      const bgColor = pct < 100 ? rgb(1, 0.96, 0.88) : rgb(0.92, 1, 0.95)
      rect(ML, y - 2, CW, 20, bgColor)
      page.drawText(`${pop.codigo} — ${pop.titulo}`, { x: ML + 6, y: y + 10, size: 9, font: bold, color: ESCURO })
      page.drawText(`v${pop.versao}  |  ${concluidos}/${pop.totalUsuarios} funcionários concluíram (${pct}%)`, { x: ML + 6, y: y + 1, size: 8, font: reg, color: pct < 100 ? LARANJA : VERDE })
      y -= 24

      for (const ass of pop.assinaturas) {
        ensureSpace(11)
        rect(ML + 10, y - 1, CW - 10, 10, BRANCO)
        const statusTxt = ass.aprovado ? `✓ ${ass.acertos}/${ass.totalQuestoes}` : `✗ ${ass.acertos}/${ass.totalQuestoes}`
        page.drawText(`${ass.nomeUsuario}`, { x: ML + 14, y: y + 1, size: 7, font: reg, color: ESCURO })
        page.drawText(statusTxt, { x: ML + 180, y: y + 1, size: 7, font: bold, color: ass.aprovado ? VERDE : VERMELHO })
        page.drawText(fmtData(ass.createdAt), { x: ML + 230, y: y + 1, size: 7, font: reg, color: rgb(0.5, 0.5, 0.5) })
        y -= 10
      }
      y -= 6
    }
  }

  // ── Seção: Validade ───────────────────────────────────────────────────────
  if (d.secoes.includes('VALIDADE') && d.validade) {
    ensureSpace(40)
    newPage()
    rect(ML, y - 4, CW, 18, AZUL)
    page.drawText('4. CONTROLE DE VALIDADE', { x: ML + 6, y: y + 2, size: 10, font: bold, color: BRANCO })
    y -= 22

    const vencidos = d.validade.filter(l => l.status === 'DESCARTADO').length
    const quarentena = d.validade.filter(l => l.status === 'QUARENTENA').length
    text(`Total de lotes: ${d.validade.length}   Descartados: ${vencidos}   Quarentena: ${quarentena}`, ML, 8, reg, rgb(0.4, 0.4, 0.4)); y -= 14

    const headers2 = ['Produto', 'Lote', 'Validade', 'Qtd', 'Status']
    const cw2 = [160, 70, 60, 50, 70]
    let cx2 = ML
    rect(ML, y - 2, CW, 13, rgb(0.22, 0.4, 0.7))
    for (let i = 0; i < headers2.length; i++) {
      page.drawText(headers2[i], { x: cx2 + 2, y: y + 1, size: 7, font: bold, color: BRANCO })
      cx2 += cw2[i]
    }
    y -= 14

    for (const l of d.validade) {
      ensureSpace(12)
      cx2 = ML
      const rowBg = l.status === 'DESCARTADO' ? rgb(0.95, 0.95, 0.95) : l.status === 'QUARENTENA' ? rgb(1, 0.95, 0.88) : CINZA
      rect(ML, y - 2, CW, 12, rowBg)
      const vals2 = [
        l.nomeProduto.slice(0, 24),
        l.lote.slice(0, 12),
        fmtData(l.validade),
        `${l.quantidade} ${l.unidade}`,
        l.status,
      ]
      for (let i = 0; i < vals2.length; i++) {
        const color = i === 4 ? (l.status === 'DESCARTADO' ? rgb(0.5, 0.5, 0.5) : l.status === 'QUARENTENA' ? LARANJA : VERDE) : ESCURO
        page.drawText(vals2[i], { x: cx2 + 2, y: y + 2, size: 7, font: i === 4 ? bold : reg, color })
        cx2 += cw2[i]
      }
      y -= 12
    }

    // Autos de descarte
    const comDescarte = d.validade.filter(l => l.descarte)
    if (comDescarte.length > 0) {
      y -= 10
      ensureSpace(20)
      text('Autos de Descarte registrados:', ML, 8, bold, ESCURO); y -= 12
      for (const l of comDescarte) {
        ensureSpace(11)
        const desc = l.descarte!
        text(`• ${l.nomeProduto} (Lote ${l.lote}) — Auto nº ${desc.numeroAuto} — ${desc.motivo} — ${fmtData(desc.dataDescarte)} — Resp: ${desc.responsavel}`, ML + 4, 7)
        y -= 10
      }
    }
  }

  // ── Rodapé em todas as páginas ────────────────────────────────────────────
  const pages = doc.getPages()
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    p.drawLine({ start: { x: ML, y: 30 }, end: { x: PAGE_W - MR, y: 30 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) })
    p.drawText(`${d.tenantNome} | FarmaSign — Pacote de Conformidade | Pág. ${i + 1}/${pages.length}`, {
      x: ML, y: 18, size: 7, font: reg, color: rgb(0.5, 0.5, 0.5),
    })
    p.drawText(`Gerado em ${d.geradoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, {
      x: PAGE_W - MR - 150, y: 18, size: 7, font: reg, color: rgb(0.5, 0.5, 0.5),
    })
  }

  return doc.save()
}
