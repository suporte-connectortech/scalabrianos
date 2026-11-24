// Layout de impressão condensado, compartilhado pelos relatórios financeiros
// (Prestação de Contas do Missionário, da Casa Religiosa e Extratos Mensais).
// Gera uma página A4 enxuta: cabeçalho em uma faixa, tabelas compactas lado a lado
// e assinaturas, sem menus, botões ou espaçamentos de tela.

export const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string
  ));

export type PrintCell = string | { v: string; cls?: string; colspan?: number };

export interface PrintColumn {
  header: string;
  cls?: string;
}

export interface PrintTableOptions {
  columns: PrintColumn[];
  rows: PrintCell[][];
  footer?: PrintCell[][];
  className?: string;
  emptyText?: string;
}

const renderCell = (cell: PrintCell, tag: 'td' | 'th' = 'td') => {
  if (typeof cell === 'string') return `<${tag}>${escapeHtml(cell)}</${tag}>`;
  const cls = cell.cls ? ` class="${cell.cls}"` : '';
  const span = cell.colspan ? ` colspan="${cell.colspan}"` : '';
  return `<${tag}${cls}${span}>${escapeHtml(cell.v)}</${tag}>`;
};

export const buildPrintTable = ({ columns, rows, footer, className, emptyText }: PrintTableOptions): string => {
  const head = columns.map(c => `<th${c.cls ? ` class="${c.cls}"` : ''}>${escapeHtml(c.header)}</th>`).join('');
  const body = rows.length > 0
    ? rows.map(r => `<tr>${r.map(c => renderCell(c)).join('')}</tr>`).join('')
    : `<tr><td class="empty" colspan="${columns.length}">${escapeHtml(emptyText || '—')}</td></tr>`;
  const foot = footer && footer.length > 0
    ? `<tfoot>${footer.map(r => `<tr class="tot">${r.map(c => renderCell(c)).join('')}</tr>`).join('')}</tfoot>`
    : '';
  return `<table class="rp ${className || ''}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
};

export interface PrintSummaryItem {
  label: string;
  value: string;
  tone?: 'pos' | 'neg';
}

export const buildPrintSummary = (items: PrintSummaryItem[]): string =>
  `<div class="rp-summary" style="grid-template-columns: repeat(${items.length}, 1fr)">${items.map(i =>
    `<div><span>${escapeHtml(i.label)}</span><strong class="${i.tone || ''}">${escapeHtml(i.value)}</strong></div>`
  ).join('')}</div>`;

export const buildPrintSection = (title: string, content: string): string =>
  `<div class="rp-sec">${escapeHtml(title)}</div>${content}`;

export const buildPrintNote = (label: string, text: string): string =>
  `<div class="rp-note"><b>${escapeHtml(label)}</b> ${escapeHtml(text)}</div>`;

export interface PrintReportOptions {
  lang: string;
  docTitle: string;
  orgName: string;
  regionName?: string;
  title: string;
  status?: { label: string; tone: 'ok' | 'warn' | 'info' | 'bad' };
  issuedLabel: string;
  issuedAt: string;
  meta: { label: string; value: string }[];
  bodyHtml: string;
  signatures?: { title: string; role?: string }[];
  footerLeft: string;
  footerRight?: string;
  orientation?: 'portrait' | 'landscape';
  popupBlockedMessage: string;
}

export const CONDENSED_PRINT_CSS = `
  @page { size: A4 portrait; margin: 8mm 9mm 9mm 9mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         font-size: 8.5pt; line-height: 1.25; color: #0f172a; background: #fff; }
  .rp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 10px;
             border-bottom: 1.5pt solid #013375; padding-bottom: 3px; margin-bottom: 4px; }
  .rp-org { font-size: 6.8pt; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .3px; }
  .rp-title { font-size: 11.5pt; font-weight: 800; color: #013375; text-transform: uppercase; line-height: 1.15; }
  .rp-issued { font-size: 6.8pt; color: #64748b; text-align: right; white-space: nowrap; }
  .rp-badge { display: inline-block; margin-top: 2px; padding: 1px 6px; border-radius: 3px; font-size: 6.8pt;
              font-weight: 800; text-transform: uppercase; border: .5pt solid currentColor; }
  .rp-badge.ok { color: #166534; background: #dcfce7; } .rp-badge.warn { color: #92400e; background: #fef3c7; }
  .rp-badge.info { color: #1e40af; background: #dbeafe; } .rp-badge.bad { color: #991b1b; background: #fee2e2; }
  .rp-meta { display: flex; flex-wrap: wrap; gap: 1px 14px; font-size: 7.8pt; padding: 3px 6px; margin-bottom: 5px;
             background: #f1f5f9; border: .5pt solid #cbd5e1; border-radius: 2px; }
  .rp-meta span { color: #475569; } .rp-meta b { color: #0f172a; }
  .rp-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; align-items: start; }
  .rp-sec { font-size: 7.8pt; font-weight: 800; color: #013375; text-transform: uppercase; letter-spacing: .3px;
            border-bottom: .5pt solid #cbd5e1; margin: 7px 0 3px; padding-bottom: 1px; }
  table.rp { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
  table.rp th { background: #e2e8f0; font-size: 6.6pt; font-weight: 800; text-transform: uppercase; text-align: left;
                padding: 2px 4px; border: .5pt solid #94a3b8; }
  table.rp td { padding: 1.4px 4px; border: .5pt solid #cbd5e1; vertical-align: top; }
  table.rp.cred th { background: #dcfce7; color: #14532d; } table.rp.deb th { background: #fee2e2; color: #7f1d1d; }
  table.rp .c { width: 1%; white-space: nowrap; color: #475569; font-weight: 600; }
  table.rp .n { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  table.rp .z { color: #94a3b8; } table.rp .b { font-weight: 700; }
  table.rp .pos { color: #166534; font-weight: 700; } table.rp .neg { color: #991b1b; font-weight: 700; }
  table.rp td.empty { text-align: center; color: #94a3b8; font-style: italic; padding: 4px; }
  table.rp tr.tot td { background: #f1f5f9; font-weight: 800; border-top: 1pt solid #475569; }
  table.rp tr { page-break-inside: avoid; } table.rp thead { display: table-header-group; }
  .rp-summary { display: grid; border: .5pt solid #94a3b8; margin-top: 5px; page-break-inside: avoid; }
  .rp-summary div { padding: 2px 6px; border-right: .5pt solid #cbd5e1; }
  .rp-summary div:last-child { border-right: none; }
  .rp-summary span { display: block; font-size: 6.4pt; font-weight: 700; color: #64748b; text-transform: uppercase; }
  .rp-summary strong { font-size: 9.5pt; font-variant-numeric: tabular-nums; }
  .rp-summary .pos { color: #166534; } .rp-summary .neg { color: #991b1b; }
  .rp-note { font-size: 7.5pt; padding: 2px 5px; margin-top: 3px; border: .5pt solid #cbd5e1; background: #f8fafc;
             white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
  .rp-sign { display: grid; gap: 28px; margin-top: 26px; page-break-inside: avoid; }
  .rp-sign div { border-top: .8pt solid #0f172a; padding-top: 2px; text-align: center; font-size: 7.5pt; font-weight: 700; }
  .rp-sign small { display: block; font-size: 6.6pt; font-weight: 400; color: #64748b; }
  .rp-foot { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; padding-top: 2px;
             border-top: .5pt solid #cbd5e1; font-size: 6.4pt; color: #64748b; }
  @media screen { body { max-width: 210mm; margin: 0 auto; padding: 8mm; } }
`;

export const openPrintReport = (opts: PrintReportOptions): void => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert(opts.popupBlockedMessage);
    return;
  }

  const pageCss = opts.orientation === 'landscape'
    ? CONDENSED_PRINT_CSS.replace('size: A4 portrait', 'size: A4 landscape').replace('max-width: 210mm', 'max-width: 297mm')
    : CONDENSED_PRINT_CSS;

  const meta = opts.meta
    .filter(m => m.value)
    .map(m => `<span>${escapeHtml(m.label)}: <b>${escapeHtml(m.value)}</b></span>`)
    .join('');

  const signatures = opts.signatures && opts.signatures.length > 0
    ? `<div class="rp-sign" style="grid-template-columns: repeat(${opts.signatures.length}, 1fr)">${opts.signatures.map(s =>
        `<div>${escapeHtml(s.title)}${s.role ? `<small>${escapeHtml(s.role)}</small>` : ''}</div>`
      ).join('')}</div>`
    : '';

  printWindow.document.write(`<!DOCTYPE html>
<html lang="${escapeHtml(opts.lang)}">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(opts.docTitle)}</title>
<style>${pageCss}</style>
</head>
<body>
  <div class="rp-head">
    <div>
      <div class="rp-org">${escapeHtml(opts.orgName)}${opts.regionName ? ` · ${escapeHtml(opts.regionName)}` : ''}</div>
      <div class="rp-title">${escapeHtml(opts.title)}</div>
    </div>
    <div class="rp-issued">
      ${escapeHtml(opts.issuedLabel)}: ${escapeHtml(opts.issuedAt)}
      ${opts.status ? `<br><span class="rp-badge ${opts.status.tone}">${escapeHtml(opts.status.label)}</span>` : ''}
    </div>
  </div>
  ${meta ? `<div class="rp-meta">${meta}</div>` : ''}
  ${opts.bodyHtml}
  ${signatures}
  <div class="rp-foot"><span>${escapeHtml(opts.footerLeft)}</span><span>${escapeHtml(opts.footerRight || '')}</span></div>
  <script>
    window.addEventListener('load', function () { setTimeout(function () { window.focus(); window.print(); }, 250); });
  </script>
</body>
</html>`);
  printWindow.document.close();
};

export const formatIssuedAt = (locale: string, atLabel: string): string => {
  const now = new Date();
  const date = now.toLocaleDateString(locale);
  const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${atLabel} ${time}`;
};
