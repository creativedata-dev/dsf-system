import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import { TIPO_SERVICO_LABELS } from './tipo-servico'

export interface PdfDsfInput {
  numeroDsf: string
  dataEmissao: Date
  drogariaNome: string
  drogariaCnpj?: string
  drogariaTelefone?: string
  rtNome: string
  rtCrf: string | null
  clienteNome: string
  clienteCpf: string
  clienteDataNasc: Date
  clienteTelefone: string
  clienteEndereco: string
  tipoServico: string
  observacoes?: string
  insumos: {
    nomeProduto: string
    lote: string
    fabricante: string
    validade: Date
  }[]
}

const AZUL = rgb(0.06, 0.27, 0.62)
const CINZA_ESCURO = rgb(0.15, 0.15, 0.15)
const CINZA_MEDIO = rgb(0.4, 0.4, 0.4)
const CINZA_CLARO = rgb(0.93, 0.94, 0.96)
const BRANCO = rgb(1, 1, 1)

function fmtData(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function fmtCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

// pdf-lib StandardFonts usam WinAnsiEncoding (cobre todos os caracteres do português)
// Se houver problemas de renderização em algum leitor, adicionar fonte TTF customizada aqui.

export interface DsfAssinaturas {
  paciente?: string  // base64 PNG data URL
  rt?: string        // base64 PNG data URL
}

export interface DsfComprovante {
  hash: string
  timestamp: string  // ISO 8601 UTC
}

function base64ToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
  const binary = Buffer.from(base64, 'base64')
  return new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength)
}

export async function generateDsfPdf(
  d: PdfDsfInput,
  assinaturas?: DsfAssinaturas,
  comprovante?: DsfComprovante
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage(PageSizes.A4)
  const { width, height } = page.getSize()

  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const reg = await doc.embedFont(StandardFonts.Helvetica)
  const oblique = await doc.embedFont(StandardFonts.HelveticaOblique)

  const ML = 48   // margem esquerda
  const MR = 48   // margem direita
  const CW = width - ML - MR  // largura do conteúdo

  let y = height - 48

  // ── Cabeçalho azul ──────────────────────────────────────────────────────────
  page.drawRectangle({ x: ML - 10, y: y - 52, width: CW + 20, height: 62, color: AZUL })
  page.drawText('DECLARACAO DE SERVICO FARMACEUTICO', {
    x: ML, y: y - 16, size: 12, font: bold, color: BRANCO,
  })
  page.drawText(`N: ${d.numeroDsf}`, {
    x: ML, y: y - 33, size: 9, font: reg, color: BRANCO,
  })
  page.drawText(
    `Data: ${fmtData(d.dataEmissao)}  Hora: ${d.dataEmissao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    { x: width - MR - 150, y: y - 33, size: 9, font: reg, color: BRANCO },
  )

  y -= 72

  // ── Linha drogaria ───────────────────────────────────────────────────────────
  page.drawText(d.drogariaNome, { x: ML, y, size: 10, font: bold, color: CINZA_ESCURO })
  const infoLine = [d.drogariaCnpj ? `CNPJ: ${d.drogariaCnpj}` : '', d.drogariaTelefone ? `Tel: ${d.drogariaTelefone}` : ''].filter(Boolean).join('   ')
  page.drawText(infoLine, {
    x: ML, y: y - 14, size: 8, font: reg, color: CINZA_MEDIO,
  })
  const rtLabel = d.rtCrf ? `RT: ${d.rtNome}  |  ${d.rtCrf}` : `RT: ${d.rtNome}`
  page.drawText(rtLabel, { x: ML, y: y - 26, size: 8, font: reg, color: CINZA_MEDIO })

  y -= 48

  // ── Divisor ──────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML, y }, end: { x: width - MR, y }, thickness: 0.5, color: CINZA_CLARO })
  y -= 14

  // ── Paciente ─────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: ML - 6, y: y - 4, width: 80, height: 13, color: CINZA_CLARO })
  page.drawText('PACIENTE', { x: ML, y, size: 8, font: bold, color: AZUL })
  y -= 16

  const col2 = ML + CW / 2

  page.drawText('Nome:', { x: ML, y, size: 8, font: bold, color: CINZA_MEDIO })
  page.drawText(d.clienteNome, { x: ML + 35, y, size: 9, font: reg, color: CINZA_ESCURO })
  y -= 14

  page.drawText('CPF:', { x: ML, y, size: 8, font: bold, color: CINZA_MEDIO })
  page.drawText(fmtCpf(d.clienteCpf), { x: ML + 28, y, size: 9, font: reg, color: CINZA_ESCURO })
  page.drawText('Nasc:', { x: col2, y, size: 8, font: bold, color: CINZA_MEDIO })
  page.drawText(fmtData(d.clienteDataNasc), { x: col2 + 30, y, size: 9, font: reg, color: CINZA_ESCURO })
  y -= 14

  page.drawText('Tel:', { x: ML, y, size: 8, font: bold, color: CINZA_MEDIO })
  page.drawText(d.clienteTelefone, { x: ML + 22, y, size: 9, font: reg, color: CINZA_ESCURO })
  y -= 14

  // Endereço pode ser longo — truncar se necessário
  const endTrunc = d.clienteEndereco.length > 85 ? d.clienteEndereco.slice(0, 82) + '...' : d.clienteEndereco
  page.drawText('End:', { x: ML, y, size: 8, font: bold, color: CINZA_MEDIO })
  page.drawText(endTrunc, { x: ML + 26, y, size: 9, font: reg, color: CINZA_ESCURO })
  y -= 20

  // ── Serviço ──────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML, y }, end: { x: width - MR, y }, thickness: 0.5, color: CINZA_CLARO })
  y -= 14

  page.drawRectangle({ x: ML - 6, y: y - 4, width: 100, height: 13, color: CINZA_CLARO })
  page.drawText('SERVICO PRESTADO', { x: ML, y, size: 8, font: bold, color: AZUL })
  y -= 16

  const tipoLabel = TIPO_SERVICO_LABELS[d.tipoServico] ?? d.tipoServico
  page.drawText('Tipo:', { x: ML, y, size: 8, font: bold, color: CINZA_MEDIO })
  page.drawText(tipoLabel, { x: ML + 30, y, size: 10, font: bold, color: CINZA_ESCURO })
  y -= 22

  // ── Insumos ──────────────────────────────────────────────────────────────────
  if (d.insumos.length > 0) {
    page.drawLine({ start: { x: ML, y }, end: { x: width - MR, y }, thickness: 0.5, color: CINZA_CLARO })
    y -= 14

    page.drawRectangle({ x: ML - 6, y: y - 4, width: 120, height: 13, color: CINZA_CLARO })
    page.drawText('INSUMOS UTILIZADOS', { x: ML, y, size: 8, font: bold, color: AZUL })
    y -= 16

    // Cabeçalho da tabela
    const C = [ML, ML + 170, ML + 300, ML + 390]
    page.drawRectangle({ x: ML - 4, y: y - 3, width: CW + 8, height: 14, color: AZUL })
    ;['Produto / Descricao', 'Lote', 'Fabricante', 'Validade'].forEach((h, i) => {
      page.drawText(h, { x: C[i], y, size: 7.5, font: bold, color: BRANCO })
    })
    y -= 16

    for (const ins of d.insumos) {
      const bg = d.insumos.indexOf(ins) % 2 === 0 ? rgb(0.97, 0.97, 0.99) : BRANCO
      page.drawRectangle({ x: ML - 4, y: y - 3, width: CW + 8, height: 13, color: bg })

      const nomeTrunc = ins.nomeProduto.length > 28 ? ins.nomeProduto.slice(0, 25) + '...' : ins.nomeProduto
      page.drawText(nomeTrunc, { x: C[0], y, size: 8, font: reg, color: CINZA_ESCURO })
      page.drawText(ins.lote, { x: C[1], y, size: 8, font: reg, color: CINZA_ESCURO })
      page.drawText(ins.fabricante, { x: C[2], y, size: 8, font: reg, color: CINZA_ESCURO })
      page.drawText(fmtData(ins.validade), { x: C[3], y, size: 8, font: reg, color: CINZA_ESCURO })
      y -= 14
    }
    y -= 6
  }

  // ── Observações ───────────────────────────────────────────────────────────────
  if (d.observacoes?.trim()) {
    page.drawLine({ start: { x: ML, y }, end: { x: width - MR, y }, thickness: 0.5, color: CINZA_CLARO })
    y -= 14

    page.drawRectangle({ x: ML - 6, y: y - 4, width: 130, height: 13, color: CINZA_CLARO })
    page.drawText('OBSERVACOES E ANAMNESE', { x: ML, y, size: 8, font: bold, color: AZUL })
    y -= 16

    // Quebra de linha simples (máx ~90 chars por linha)
    const words = d.observacoes.trim().split(' ')
    let line = ''
    for (const word of words) {
      if ((line + ' ' + word).length > 90) {
        page.drawText(line.trim(), { x: ML, y, size: 8.5, font: oblique, color: CINZA_ESCURO })
        y -= 13
        line = word
      } else {
        line += ' ' + word
      }
    }
    if (line.trim()) {
      page.drawText(line.trim(), { x: ML, y, size: 8.5, font: oblique, color: CINZA_ESCURO })
      y -= 13
    }
    y -= 8
  }

  // ── Assinaturas ───────────────────────────────────────────────────────────────
  y -= 10
  page.drawLine({ start: { x: ML, y }, end: { x: width - MR, y }, thickness: 0.5, color: CINZA_CLARO })
  y -= 14

  page.drawRectangle({ x: ML - 6, y: y - 4, width: 100, height: 13, color: CINZA_CLARO })
  page.drawText('ASSINATURAS', { x: ML, y, size: 8, font: bold, color: AZUL })
  y -= 14

  const sigBoxW = (CW - 20) / 2
  const sigBoxH = 60
  const sigPacienteX = ML
  const sigRtX = ML + sigBoxW + 20

  // caixa paciente
  page.drawRectangle({ x: sigPacienteX, y: y - sigBoxH, width: sigBoxW, height: sigBoxH, borderColor: CINZA_CLARO, borderWidth: 0.5, color: rgb(0.98, 0.98, 0.99) })
  if (assinaturas?.paciente) {
    try {
      const imgBytes = base64ToBytes(assinaturas.paciente)
      const img = await doc.embedPng(imgBytes)
      const imgDim = img.scaleToFit(sigBoxW - 16, sigBoxH - 16)
      page.drawImage(img, { x: sigPacienteX + (sigBoxW - imgDim.width) / 2, y: y - sigBoxH + (sigBoxH - imgDim.height) / 2, width: imgDim.width, height: imgDim.height })
    } catch { /* assinatura inválida — deixa caixa em branco */ }
  }
  page.drawText('Assinatura do Paciente', { x: sigPacienteX + 4, y: y - sigBoxH - 12, size: 7.5, font: bold, color: CINZA_MEDIO })
  page.drawText(d.clienteNome, { x: sigPacienteX + 4, y: y - sigBoxH - 22, size: 7, font: reg, color: CINZA_ESCURO })

  // caixa RT
  page.drawRectangle({ x: sigRtX, y: y - sigBoxH, width: sigBoxW, height: sigBoxH, borderColor: CINZA_CLARO, borderWidth: 0.5, color: rgb(0.98, 0.98, 0.99) })
  if (assinaturas?.rt) {
    try {
      const imgBytes = base64ToBytes(assinaturas.rt)
      const img = await doc.embedPng(imgBytes)
      const imgDim = img.scaleToFit(sigBoxW - 16, sigBoxH - 16)
      page.drawImage(img, { x: sigRtX + (sigBoxW - imgDim.width) / 2, y: y - sigBoxH + (sigBoxH - imgDim.height) / 2, width: imgDim.width, height: imgDim.height })
    } catch { /* assinatura inválida — deixa caixa em branco */ }
  }
  const rtSig = d.rtCrf ? `${d.rtNome}  |  CRF: ${d.rtCrf}` : d.rtNome
  page.drawText('Responsavel Tecnico / Farmaceutico', { x: sigRtX + 4, y: y - sigBoxH - 12, size: 7.5, font: bold, color: CINZA_MEDIO })
  page.drawText(rtSig, { x: sigRtX + 4, y: y - sigBoxH - 22, size: 7, font: reg, color: CINZA_ESCURO })

  y -= sigBoxH + 32

  // ── Rodapé legal ANVISA ──────────────────────────────────────────────────────
  const footerY = comprovante ? 54 : 40
  page.drawLine({
    start: { x: ML, y: footerY + 24 },
    end: { x: width - MR, y: footerY + 24 },
    thickness: 0.5,
    color: CINZA_CLARO,
  })
  const footer1 = 'Este procedimento constitui monitoramento/triagem e NAO substitui o diagnostico medico ou prescricao de tratamento.'
  const footer2 = 'Declaracao emitida em conformidade com a ANVISA RDC 44/2009 e legislacao vigente. Dados protegidos conforme LGPD (Lei 13.709/2018).'
  page.drawText(footer1, { x: ML, y: footerY + 12, size: 6.5, font: oblique, color: CINZA_MEDIO })
  page.drawText(footer2, { x: ML, y: footerY, size: 6.5, font: oblique, color: CINZA_MEDIO })

  if (comprovante) {
    page.drawText(`SHA-256: ${comprovante.hash}`, { x: ML, y: footerY - 12, size: 5.5, font: reg, color: CINZA_MEDIO })
    page.drawText(`Assinado em: ${comprovante.timestamp} (UTC)`, { x: ML, y: footerY - 22, size: 5.5, font: reg, color: CINZA_MEDIO })
  }

  return doc.save()
}
