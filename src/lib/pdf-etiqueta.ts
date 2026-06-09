import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import QRCode from 'qrcode'

export interface DadosEtiqueta {
  fracionamentoId: string
  fracaoId: string
  numero: number
  totalFracoes: number
  nomeProduto: string
  fabricante: string
  lote: string
  validade: Date
  quantidade: number
  unidade: string
  destinacao: string | null
  nomeFantasia: string
  dataFracionamento: Date
}

function fmt(d: Date) {
  return new Date(d).toLocaleDateString('pt-BR')
}

// Etiqueta 80mm × 50mm em pontos (1mm ≈ 2.835pt)
const W = Math.round(80 * 2.835)  // 227pt
const H = Math.round(50 * 2.835)  // 142pt
const PAD = 8

export async function gerarEtiquetaPDF(fracoes: DadosEtiqueta[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const reg  = await doc.embedFont(StandardFonts.Helvetica)
  const PRETO = rgb(0, 0, 0)
  const CINZA = rgb(0.4, 0.4, 0.4)

  for (const d of fracoes) {
    const page = doc.addPage([W, H])

    // Borda
    page.drawRectangle({ x: 1, y: 1, width: W - 2, height: H - 2, borderColor: PRETO, borderWidth: 0.5 })

    // QR Code
    const qrPayload = JSON.stringify({
      fid: d.fracaoId,
      p: d.nomeProduto,
      lot: d.lote,
      val: fmt(d.validade),
      qty: `${d.quantidade}${d.unidade}`,
      fr: `${d.numero}/${d.totalFracoes}`,
    })
    let qrSize = 60
    try {
      const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: qrSize * 2, margin: 1 })
      const qrBytes = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
      const qrImage = await doc.embedPng(qrBytes)
      page.drawImage(qrImage, { x: W - PAD - qrSize, y: H - PAD - qrSize, width: qrSize, height: qrSize })
    } catch { /* QR opcional */ }

    const xTxt = PAD
    const maxW = W - PAD * 2 - qrSize - 4

    let y = H - PAD - 10

    // Nome do estabelecimento
    page.drawText(d.nomeFantasia.toUpperCase().slice(0, 28), {
      x: xTxt, y, size: 7, font: bold, color: CINZA,
    })
    y -= 12

    // Nome do produto
    const nomeProduto = d.nomeProduto.length > 30 ? d.nomeProduto.slice(0, 30) + '…' : d.nomeProduto
    page.drawText(nomeProduto, { x: xTxt, y, size: 9, font: bold, color: PRETO })
    y -= 10

    // Fabricante
    page.drawText(d.fabricante.slice(0, 28), { x: xTxt, y, size: 7, font: reg, color: CINZA })
    y -= 11

    // Lote | Validade
    page.drawText(`Lote: ${d.lote}`, { x: xTxt, y, size: 8, font: reg, color: PRETO })
    page.drawText(`Val: ${fmt(d.validade)}`, { x: xTxt + maxW / 2, y, size: 8, font: reg, color: PRETO })
    y -= 10

    // Quantidade
    page.drawText(`Qtd: ${d.quantidade} ${d.unidade}`, { x: xTxt, y, size: 8, font: bold, color: PRETO })
    y -= 10

    // Fração número
    page.drawText(`Fração ${d.numero} de ${d.totalFracoes}`, { x: xTxt, y, size: 8, font: reg, color: CINZA })
    y -= 10

    // Destinação (se houver)
    if (d.destinacao) {
      page.drawText(`Dest: ${d.destinacao.slice(0, 28)}`, { x: xTxt, y, size: 7, font: reg, color: CINZA })
      y -= 9
    }

    // Data de fracionamento
    page.drawText(`Fracionado em: ${fmt(d.dataFracionamento)}`, {
      x: xTxt, y: PAD + 2, size: 6, font: reg, color: CINZA,
    })
  }

  return doc.save()
}
