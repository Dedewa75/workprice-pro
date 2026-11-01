// ============================================================
// Génération PDF des devis et factures (pdf-lib, 100 % navigateur)
// 3 modèles : modern, classic, minimal
// ============================================================
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB, type PDFImage } from 'pdf-lib';
import { computeTotals, lineTotal } from './docs';
import type { Client, Doc, Settings, PdfTemplate } from './types';

const A4 = { w: 595.28, h: 841.89 };
const M = 42;

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x7c5cff;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
const mix = (c: RGB, t: number): RGB => rgb(c.red + (1 - c.red) * t, c.green + (1 - c.green) * t, c.blue + (1 - c.blue) * t);
const INK = rgb(0.09, 0.1, 0.13);
const MUTED = rgb(0.42, 0.45, 0.52);
const LINE = rgb(0.86, 0.87, 0.9);

const fmtMoney = (n: number, s: Settings) => {
  let out: string;
  try { out = new Intl.NumberFormat(s.locale || 'fr-BE', { style: 'currency', currency: s.currency || 'EUR' }).format(n); }
  catch { out = n.toFixed(2) + ' ' + s.currency; }
  return out.replace(/[  ]/g, ' ');
};
const fmtNum = (n: number) => new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 2 }).format(n).replace(/[  ]/g, ' ');
const fmtDate = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

class Writer {
  pdf: PDFDocument; page!: PDFPage; y = 0; pages: PDFPage[] = [];
  font: PDFFont; bold: PDFFont; ok = new Map<string, boolean>();
  constructor(pdf: PDFDocument, font: PDFFont, bold: PDFFont) { this.pdf = pdf; this.font = font; this.bold = bold; }
  addPage() { this.page = this.pdf.addPage([A4.w, A4.h]); this.pages.push(this.page); this.y = A4.h - M; return this.page; }
  clean(t: string, f: PDFFont): string {
    let out = '';
    for (const ch of String(t ?? '').replace(/[  \t]/g, ' ').replace(/\r/g, '').replace(/\u2212/g, '-')) {
      const key = (f === this.bold ? 'b' : 'r') + ch;
      let ok = this.ok.get(key);
      if (ok === undefined) { try { f.encodeText(ch); ok = true; } catch { ok = false; } this.ok.set(key, ok); }
      out += ok ? ch : (ch === '\n' ? '\n' : '');
    }
    return out;
  }
  width(t: string, size: number, f = this.font) { return f.widthOfTextAtSize(this.clean(t, f), size); }
  text(t: string, x: number, y: number, o: { size?: number; font?: PDFFont; color?: RGB; align?: 'left' | 'right' | 'center' } = {}) {
    const f = o.font || this.font, size = o.size || 9.5;
    const s = this.clean(t, f);
    let xx = x;
    if (o.align === 'right') xx = x - f.widthOfTextAtSize(s, size);
    if (o.align === 'center') xx = x - f.widthOfTextAtSize(s, size) / 2;
    this.page.drawText(s, { x: xx, y, size, font: f, color: o.color || INK });
  }
  wrap(t: string, maxW: number, size: number, f = this.font): string[] {
    const out: string[] = [];
    for (const para of this.clean(t, f).split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(test, size) <= maxW) { line = test; continue; }
        if (line) out.push(line);
        // mot trop long : coupe
        let rest = w;
        while (f.widthOfTextAtSize(rest, size) > maxW && rest.length > 1) {
          let k = rest.length;
          while (k > 1 && f.widthOfTextAtSize(rest.slice(0, k), size) > maxW) k--;
          out.push(rest.slice(0, k)); rest = rest.slice(k);
        }
        line = rest;
      }
      out.push(line);
    }
    return out;
  }
  rect(x: number, y: number, w: number, h: number, color: RGB, border?: RGB) {
    this.page.drawRectangle({ x, y, width: w, height: h, color, borderColor: border, borderWidth: border ? 0.6 : 0 });
  }
  hline(y: number, x1 = M, x2 = A4.w - M, color = LINE, t = 0.6) { this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: t, color }); }
}

export interface PdfOptions { template?: PdfTemplate; quoteNumber?: string }

export async function buildDocPdf(doc: Doc, client: Client | null, s: Settings, opts: PdfOptions = {}): Promise<Uint8Array> {
  const tpl: PdfTemplate = opts.template || doc.template || s.pdfTemplate || 'modern';
  const pdf = await PDFDocument.create();
  const isQuote = doc.kind === 'quote';
  const title = isQuote ? 'DEVIS' : 'FACTURE';
  pdf.setTitle(`${title} ${doc.number || 'brouillon'}`);
  pdf.setAuthor(s.company.name || 'WORKPRICE PRO');
  pdf.setCreator('WORKPRICE PRO');
  pdf.setProducer('WORKPRICE PRO');

  const serif = tpl === 'classic';
  const font = await pdf.embedFont(serif ? StandardFonts.TimesRoman : StandardFonts.Helvetica);
  const bold = await pdf.embedFont(serif ? StandardFonts.TimesRomanBold : StandardFonts.HelveticaBold);
  const W = new Writer(pdf, font, bold);
  const accent = tpl === 'minimal' ? INK : hexToRgb(s.accentColor);
  const accentSoft = mix(accent, tpl === 'minimal' ? 0.94 : 0.9);

  let logo: PDFImage | null = null;
  if (s.company.logo?.startsWith('data:image/')) {
    try {
      const b64 = s.company.logo.split(',')[1];
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      logo = s.company.logo.startsWith('data:image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    } catch { logo = null; }
  }

  const t = computeTotals(doc);
  const vatOn = s.vat.enabled;
  const anyLineDiscount = doc.lines.some(l => (l.discountPct || 0) > 0);
  const right = A4.w - M;
  const c = s.company;

  // ---------------- EN-TÊTE ----------------
  W.addPage();
  if (tpl === 'modern') W.rect(0, A4.h - 8, A4.w, 8, accent);
  let y = A4.h - M - (tpl === 'modern' ? 6 : 0);

  // Logo + entreprise (gauche)
  let leftY = y;
  if (logo) {
    const maxH = 52, maxW = 150;
    const sc = Math.min(maxW / logo.width, maxH / logo.height, 1);
    const lw = logo.width * sc, lh = logo.height * sc;
    W.page.drawImage(logo, { x: M, y: leftY - lh, width: lw, height: lh });
    leftY -= lh + 10;
  }
  W.text(c.name || 'Votre entreprise', M, leftY - 12, { font: bold, size: 13 });
  leftY -= 26;
  const compLines = [
    [c.legalForm, c.owner].filter(Boolean).join(' — '),
    c.address, [c.zip, c.city].filter(Boolean).join(' '), c.country,
    c.phone && `Tél. ${c.phone}`, c.email, c.website,
    c.companyNumber && `N° d'entreprise : ${c.companyNumber}`,
    c.vatNumber && `N° TVA : ${c.vatNumber}`,
  ].filter(Boolean) as string[];
  for (const l of compLines) { W.text(l, M, leftY, { size: 8.5, color: MUTED }); leftY -= 11.5; }

  // Titre + numéro (droite)
  if (tpl === 'classic') {
    W.rect(right - 190, y - 46, 190, 46, rgb(1, 1, 1), INK);
    W.text(title, right - 95, y - 22, { font: bold, size: 18, align: 'center' });
    W.text(doc.number ? `N° ${doc.number}` : 'BROUILLON', right - 95, y - 38, { size: 10, align: 'center' });
  } else {
    W.text(title, right, y - 20, { font: bold, size: 24, color: accent, align: 'right' });
    W.text(doc.number ? `N° ${doc.number}` : 'BROUILLON — non numérotée', right, y - 36, { size: 10, color: MUTED, align: 'right' });
  }
  let metaY = y - 62;
  const meta: [string, string][] = [
    ['Date d\'émission', fmtDate(doc.issueDate)],
    isQuote ? ['Valable jusqu\'au', fmtDate((doc as any).validUntil)] : ['Échéance', fmtDate((doc as any).dueDate)],
  ];
  if (!isQuote && opts.quoteNumber) meta.push(['Réf. devis', opts.quoteNumber]);
  for (const [k, v] of meta) {
    if (!v) continue;
    W.text(k, right - 95, metaY, { size: 8.5, color: MUTED, align: 'right' });
    W.text(v, right, metaY, { size: 9, font: bold, align: 'right' });
    metaY -= 13;
  }

  // Client
  const boxW = 230, boxX = right - boxW;
  let boxTop = Math.min(metaY - 8, y - 96);
  const cl: string[] = client ? [
    client.company && client.name ? client.name : '',
    client.address, [client.zip, client.city].filter(Boolean).join(' '), client.country,
    client.email, client.phone, client.vatNumber && `N° TVA : ${client.vatNumber}`,
  ].filter(Boolean) as string[] : ['Client non renseigné'];
  const clientName = client ? (client.company || client.name) : '';
  const boxH = 30 + (clientName ? 14 : 0) + cl.length * 11.5;
  if (tpl === 'minimal') W.hline(boxTop, boxX, right, INK, 0.8);
  else W.rect(boxX, boxTop - boxH, boxW, boxH, tpl === 'modern' ? accentSoft : rgb(1, 1, 1), tpl === 'classic' ? INK : undefined);
  W.text(isQuote ? 'DEVIS ADRESSÉ À' : 'FACTURÉ À', boxX + 12, boxTop - 16, { size: 7.5, font: bold, color: tpl === 'modern' ? accent : MUTED });
  let cy = boxTop - 31;
  if (clientName) { W.text(clientName, boxX + 12, cy, { font: bold, size: 10.5 }); cy -= 14; }
  for (const l of cl) { for (const wl of W.wrap(l, boxW - 24, 8.5)) { W.text(wl, boxX + 12, cy, { size: 8.5, color: INK }); cy -= 11.5; } }

  y = Math.min(leftY, boxTop - boxH) - 20;
  if (doc.title) {
    W.text(isQuote ? 'Objet' : 'Objet', M, y, { size: 8, color: MUTED });
    y -= 13;
    for (const l of W.wrap(doc.title, right - M, 11, bold)) { W.text(l, M, y, { font: bold, size: 11 }); y -= 14; }
    y -= 6;
  }

  // ---------------- TABLEAU ----------------
  type Col = { key: string; label: string; w: number; align: 'left' | 'right' };
  const cols: Col[] = [
    { key: 'desc', label: 'Description', w: 0, align: 'left' },
    { key: 'qty', label: 'Qté', w: 42, align: 'right' },
    { key: 'unit', label: 'Unité', w: 50, align: 'left' },
    { key: 'pu', label: 'Prix unit. HT', w: 72, align: 'right' },
    ...(anyLineDiscount ? [{ key: 'disc', label: 'Remise', w: 44, align: 'right' as const }] : []),
    ...(vatOn ? [{ key: 'vat', label: 'TVA', w: 36, align: 'right' as const }] : []),
    { key: 'total', label: vatOn ? 'Total HT' : 'Total', w: 76, align: 'right' },
  ];
  const fixed = cols.reduce((s2, c2) => s2 + c2.w, 0);
  cols[0].w = right - M - fixed;
  const colX: number[] = [];
  { let x = M; for (const c2 of cols) { colX.push(x); x += c2.w; } }
  const cellX = (i: number) => (cols[i].align === 'right' ? colX[i] + cols[i].w - 6 : colX[i] + 6);

  const drawHeader = () => {
    const h = 22;
    if (tpl === 'modern') W.rect(M, y - h, right - M, h, accent);
    else if (tpl === 'classic') W.rect(M, y - h, right - M, h, rgb(0.93, 0.93, 0.93), INK);
    else W.hline(y - h, M, right, INK, 0.9);
    const col = tpl === 'modern' ? rgb(1, 1, 1) : INK;
    cols.forEach((c2, i) => W.text(c2.label, cellX(i), y - 14.5, { size: 8, font: bold, color: col, align: c2.align }));
    y -= h;
  };
  const bottomLimit = M + 60;
  const newPage = () => { W.addPage(); y = A4.h - M; drawHeader(); };
  drawHeader();

  doc.lines.forEach((l, idx) => {
    const descLines = W.wrap(l.description || '—', cols[0].w - 12, 9.5, bold);
    const detLines = l.detail ? W.wrap(l.detail, cols[0].w - 12, 8) : [];
    const rowH = 10 + descLines.length * 12 + detLines.length * 10.5 + 4;
    if (y - rowH < bottomLimit) newPage();
    if (tpl === 'modern' && idx % 2 === 1) W.rect(M, y - rowH, right - M, rowH, mix(accent, 0.96));
    let ty = y - 15;
    for (const d of descLines) { W.text(d, cellX(0), ty, { font: bold, size: 9.5 }); ty -= 12; }
    for (const d of detLines) { W.text(d, cellX(0), ty + 1, { size: 8, color: MUTED }); ty -= 10.5; }
    const vals: Record<string, string> = {
      qty: fmtNum(l.qty), unit: l.unit || '', pu: fmtMoney(l.unitPrice, s),
      disc: l.discountPct ? `${fmtNum(l.discountPct)} %` : '', vat: `${fmtNum(l.vatRate)} %`, total: fmtMoney(lineTotal(l), s),
    };
    cols.forEach((c2, i) => { if (i) W.text(vals[c2.key], cellX(i), y - 15, { size: 9, align: c2.align, font: c2.key === 'total' ? bold : font }); });
    y -= rowH;
    if (tpl === 'classic') { W.hline(y, M, right, INK, 0.4); }
    else W.hline(y);
  });

  // ---------------- TOTAUX ----------------
  const rows: [string, string, boolean?][] = [];
  if (t.globalDiscount > 0) {
    rows.push(['Sous-total', fmtMoney(t.subtotal, s)]);
    rows.push([`Remise globale (${fmtNum(doc.globalDiscountPct)} %)`, `- ${fmtMoney(t.globalDiscount, s)}`]);
  }
  if (vatOn) {
    rows.push(['Total HT', fmtMoney(t.totalHT, s)]);
    for (const v of t.vat) rows.push([`TVA ${fmtNum(v.rate)} % (base ${fmtMoney(v.base, s)})`, fmtMoney(v.vat, s)]);
    rows.push(['Total TTC', fmtMoney(t.totalTTC, s), true]);
  } else {
    rows.push(['Total', fmtMoney(t.totalTTC, s), true]);
  }
  if (!isQuote && t.paid > 0) {
    rows.push(['Déjà payé', `- ${fmtMoney(t.paid, s)}`]);
    rows.push(['Reste à payer', fmtMoney(Math.max(0, t.balance), s), true]);
  }
  const totH = rows.length * 17 + 16;
  if (y - totH < bottomLimit) { W.addPage(); y = A4.h - M; }
  y -= 12;
  const tx = right - 250;
  for (const [k, v, strong] of rows) {
    if (strong) {
      W.rect(tx, y - 21, 250, 22, tpl === 'minimal' ? rgb(0.95, 0.95, 0.96) : tpl === 'classic' ? rgb(0.93, 0.93, 0.93) : accent);
      const col = tpl === 'modern' ? rgb(1, 1, 1) : INK;
      W.text(k, tx + 10, y - 14.5, { font: bold, size: 10, color: col });
      W.text(v, right - 10, y - 14.5, { font: bold, size: 11, color: col, align: 'right' });
      y -= 26;
    } else {
      W.text(k, tx + 10, y - 12, { size: 9, color: MUTED });
      W.text(v, right - 10, y - 12, { size: 9.5, align: 'right' });
      y -= 17;
    }
  }
  y -= 8;

  // ---------------- MENTIONS ----------------
  const blocks: { title: string; body: string }[] = [];
  if (!vatOn && s.vat.exemptionMention) blocks.push({ title: '', body: s.vat.exemptionMention });
  if (!isQuote && (c.iban || c.bic)) {
    blocks.push({ title: 'Paiement', body: [c.iban && `IBAN : ${c.iban}`, c.bic && `BIC : ${c.bic}`, doc.number && `Communication : ${doc.number}`, `Échéance : ${fmtDate((doc as any).dueDate)}`].filter(Boolean).join('\n') });
  }
  if (doc.notes) blocks.push({ title: 'Notes', body: doc.notes });
  if (doc.conditions) blocks.push({ title: 'Conditions', body: doc.conditions });
  for (const b of blocks) {
    const lines = W.wrap(b.body, right - M, 8.5);
    const need = (b.title ? 14 : 0) + lines.length * 11 + 8;
    if (y - need < M + 30) { W.addPage(); y = A4.h - M; }
    if (b.title) { W.text(b.title.toUpperCase(), M, y - 10, { size: 7.5, font: bold, color: tpl === 'modern' ? accent : MUTED }); y -= 14; }
    for (const l of lines) { W.text(l, M, y - 10, { size: 8.5, color: INK }); y -= 11; }
    y -= 10;
  }

  if (isQuote) {
    const h = 74;
    if (y - h < M + 30) { W.addPage(); y = A4.h - M; }
    const bx = right - 230;
    W.rect(bx, y - h, 230, h, rgb(1, 1, 1), LINE);
    W.text('Bon pour accord — date et signature du client', bx + 10, y - 14, { size: 8, color: MUTED });
  }

  // ---------------- PIED DE PAGE ----------------
  const foot = [c.name, c.legalForm, c.companyNumber && `N° ent. ${c.companyNumber}`, c.vatNumber && `TVA ${c.vatNumber}`, c.iban && `IBAN ${c.iban}`].filter(Boolean).join(' · ');
  const legal = s.legalFooter;
  W.pages.forEach((p, i) => {
    W.page = p;
    W.hline(M + 22, M, right, LINE, 0.5);
    const fl = W.wrap([foot, legal].filter(Boolean).join(' — '), right - M - 60, 7);
    fl.slice(0, 2).forEach((l, k) => W.text(l, M, M + 11 - k * 9, { size: 7, color: MUTED }));
    W.text(`Page ${i + 1}/${W.pages.length}`, right, M + 11, { size: 7, color: MUTED, align: 'right' });
  });

  return pdf.save();
}

export function pdfFileName(doc: Doc, client: Client | null): string {
  const kind = doc.kind === 'quote' ? 'Devis' : 'Facture';
  const who = client ? (client.company || client.name) : '';
  return `${kind}_${doc.number || 'brouillon'}${who ? '_' + who : ''}.pdf`.replace(/[^\w.\-À-ÿ]+/g, '_');
}
