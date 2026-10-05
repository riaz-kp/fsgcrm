import { FIRM_NAME } from './meta'

export interface PdfList {
  title: string
  note?: string
  sections: Array<{ title: string; items: Array<{ text: string; note?: string; parts?: string[] }> }>
}

export interface PdfInput {
  /** Who the list is for; left out for a general list. */
  forName?: string
  preparedBy: string
  /** Already formatted, e.g. "5 Oct 2026". */
  date: string
  /** What the lists cover, in words: "GST registration (LLP) and LLP incorporation". */
  summary: string
  generalNote: string
  lists: PdfList[]
}

// A4 in millimetres.
const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 18
const BOTTOM = PAGE_H - 20
const WIDTH = PAGE_W - MARGIN * 2

// The app's own colours: FSG blue for headings, charcoal for text, grey for notes.
const BRAND: [number, number, number] = [21, 87, 152]
const INK: [number, number, number] = [27, 29, 33]
const MUTED: [number, number, number] = [107, 114, 124]
const RULE: [number, number, number] = [221, 224, 229]
const WASH: [number, number, number] = [246, 247, 249]

/** The built-in PDF fonts cover Latin-1 only, so curly quotes and long dashes become plain ones. */
function plain(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\xFF\n]/g, '')
}

async function loadLogo(): Promise<{ data: string; ratio: number } | undefined> {
  try {
    const blob = await (await fetch('/logo-mark.jpeg')).blob()
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    const ratio = await new Promise<number>((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 2.27)
      img.onerror = () => resolve(2.27)
      img.src = data
    })
    return { data, ratio }
  } catch {
    // The list still goes out, just without the logo.
    return undefined
  }
}

/** Builds the checklist as a PDF and downloads it. jsPDF is loaded only when someone exports. */
export async function downloadRequirementsPdf(input: PdfInput): Promise<void> {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), loadLogo()])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  const color = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2])
  const font = (style: 'normal' | 'bold' | 'italic', size: number) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
  }
  /** Line height in mm for the current font size. */
  const lh = () => doc.getFontSize() * 0.3528 * 1.35
  /** Start a new page if `need` mm will not fit on this one. */
  const room = (need: number) => {
    if (y + need <= BOTTOM) return
    doc.addPage()
    y = MARGIN
  }
  /** Wrapped text at x; returns nothing, moves y down. */
  const para = (text: string, x: number, width: number) => {
    const lines = doc.splitTextToSize(plain(text), width) as string[]
    for (const line of lines) {
      room(lh())
      doc.text(line, x, y + lh() * 0.75)
      y += lh()
    }
  }

  // Letterhead: logo on the left, firm and title on the right.
  if (logo) {
    const h = 13
    doc.addImage(logo.data, 'JPEG', MARGIN, y, h * logo.ratio, h)
  }
  font('bold', 12)
  color(INK)
  doc.text(FIRM_NAME, PAGE_W - MARGIN, y + 5, { align: 'right' })
  font('normal', 9.5)
  color(MUTED)
  doc.text('Documents & information required', PAGE_W - MARGIN, y + 10, { align: 'right' })
  y += 17
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, PAGE_W - MARGIN, y)
  y += 7

  // Who it is for.
  font('bold', 16)
  color(INK)
  para(input.forName ? `Documents required from ${input.forName}` : 'Documents required', MARGIN, WIDTH)
  y += 1
  font('normal', 9.5)
  color(MUTED)
  para(`${input.summary}  ·  ${input.date}  ·  prepared by ${input.preparedBy}`, MARGIN, WIDTH)
  y += 4

  // The general note, in a shaded box.
  font('normal', 9.5)
  const noteLines = doc.splitTextToSize(plain(input.generalNote), WIDTH - 8) as string[]
  const boxH = noteLines.length * lh() + 6
  room(boxH)
  doc.setFillColor(...WASH)
  doc.setDrawColor(...RULE)
  doc.roundedRect(MARGIN, y, WIDTH, boxH, 1.5, 1.5, 'FD')
  color(INK)
  noteLines.forEach((line, i) => doc.text(line, MARGIN + 4, y + 3 + lh() * (i + 0.75)))
  y += boxH + 6

  const BOX = 3.4
  for (const list of input.lists) {
    // Keep a heading with at least its first few lines.
    room(22)
    font('bold', 13)
    color(BRAND)
    para(list.title, MARGIN, WIDTH)
    y += 1.5

    for (const section of list.sections) {
      room(14)
      font('bold', 9)
      color(MUTED)
      para(section.title.toUpperCase(), MARGIN, WIDTH)
      y += 1

      // Documents sit two to a row, as on screen; one made up of parts (an address) gets a row to itself.
      const rows: Array<typeof section.items> = []
      for (const item of section.items) {
        const last = rows.at(-1)
        if (!item.parts && last && last.length === 1 && !last[0].parts) last.push(item)
        else rows.push([item])
      }
      for (const row of rows) {
        const wide = row.length === 1 && !!row[0].parts
        const colW = wide ? WIDTH : (WIDTH - 6) / 2
        font('normal', 10.5)
        const cells = row.map((item) => doc.splitTextToSize(plain(item.note ? `${item.text} (${item.note})` : item.text), colW - 7) as string[])
        room(Math.max(...cells.map((c) => c.length)) * lh() + (wide ? lh() * 2 : 0) + 1.5)
        const top = y
        cells.forEach((lines, n) => {
          const x = MARGIN + n * (colW + 6)
          // An empty box to tick on paper.
          doc.setDrawColor(...MUTED)
          doc.setLineWidth(0.3)
          doc.rect(x + 0.5, top + lh() * 0.75 - BOX + 0.4, BOX, BOX)
          color(INK)
          lines.forEach((line, i) => doc.text(line, x + 7, top + lh() * (i + 0.75)))
        })
        y = top + Math.max(...cells.map((c) => c.length)) * lh()
        if (wide) {
          font('normal', 9.5)
          color(MUTED)
          para(row[0].parts!.join('  ·  '), MARGIN + 7, WIDTH - 7)
        }
        y += 1.5
      }
      y += 2.5
    }

    if (list.note) {
      font('italic', 9)
      color(MUTED)
      para(list.note, MARGIN, WIDTH)
    }
    y += 5
  }

  // Footer on every page.
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    font('normal', 8)
    color(MUTED)
    doc.text(`${FIRM_NAME}  ·  page ${p} of ${pages}`, PAGE_W / 2, PAGE_H - 10, { align: 'center' })
  }

  const name = plain(input.forName ? `Documents required - ${input.forName}` : 'Documents required').replace(/[\\/:*?"<>|]/g, '')
  doc.save(`${name}.pdf`)
}
