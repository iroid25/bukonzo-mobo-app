import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Ledger → Excel export.
 *
 * Ships a genuinely styled workbook (not a flat CSV): SACCO masthead, colour
 * bands, bold header strip, section breaks and a totals row. We build it as an
 * HTML table in a `.xls` container — every Excel build renders that natively
 * (same trick Word uses for .doc), with no spreadsheet engine required on
 * device and no server round-trip.
 */

export type LedgerRow = {
  date: string; // display date
  time?: string;
  type: string; // DEPOSIT | WITHDRAWAL | ...
  member: string;
  reference: string;
  amount: number;
  status: string;
  isCredit?: boolean;
};

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const num = (v: number): string =>
  new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(Math.round(v || 0));

const STYLE = `
  <style>
    body { font-family: Calibri, Arial, sans-serif; margin: 0; color: #101A14; }
    .masthead { background: #0D3D2B; color: #fff; padding: 14px 24px; }
    .masthead h1 { margin: 0; font-size: 20px; letter-spacing: 1px; }
    .masthead p { margin: 4px 0 0; font-size: 11px; color: #C6F24E; }
    .meta { display: block; margin: 10px 24px 2px; font-size: 11px; color: #6B7F72; }
    table { border-collapse: collapse; width: 100%; margin: 0 0 10px; }
    th { background: #0D3D2B; color: #fff; text-align: left; padding: 8px 12px;
         font-size: 10px; letter-spacing: 0.6px; text-transform: uppercase; border: 1px solid #0D3D2B; }
    td { padding: 7px 12px; font-size: 11px; border: 1px solid #DDE7D8; }
    tr:nth-child(even) td { background: #F3F7EC; }
    .amt { text-align: right; font-variant-numeric: tabular-nums; }
    .credit { color: #1A6B47; font-weight: bold; }
    .debit { color: #C0392B; font-weight: bold; }
    .mono { font-family: Consolas, monospace; font-size: 10px; }
    .badge { font-weight: bold; }
    tr.total td { background: #E9F8C4 !important; font-weight: bold; border-top: 2px solid #0D3D2B; }
    .foot { margin: 4px 24px 24px; font-size: 9px; color: #9BB0A2; }
  </style>
`;

export const buildLedgerHtml = (opts: {
  title: string;
  subtitle?: string;
  exportedBy?: string;
  rows: LedgerRow[];
  summary?: { label: string; value: string }[];
}): string => {
  const { title, subtitle, exportedBy, rows, summary } = opts;
  const generatedAt = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const body = rows
    .map((r) => {
      const isCredit = r.isCredit ?? /^DEPOSIT|^(LOAN_DISBURSEMENT|FLOAT_PURCHASE)$/i.test(r.type);
      const sign = isCredit ? '' : '-';
      return (
        `<tr>` +
        `<td>${esc(r.date)}</td>` +
        `<td>${esc(r.time || '')}</td>` +
        `<td class="badge">${esc(r.type)}</td>` +
        `<td>${esc(r.member)}</td>` +
        `<td class="mono">${esc(r.reference)}</td>` +
        `<td class="amt ${isCredit ? 'credit' : 'debit'}">${sign}UGX ${num(r.amount)}</td>` +
        `<td>${esc(r.status || 'COMPLETED')}</td>` +
        `</tr>`
      );
    })
    .join('\n');

  const rowsSummary = summary || [];

  const summaryRows = rowsSummary.length
    ? `<tr class="total">` +
      `<td colspan="6" style="text-align:right">${esc(rowsSummary.map((s) => s.label).join(' · '))}</td>` +
      `<td class="amt" style="color:#0D3D2B">${esc(rowsSummary.map((s) => s.value).join(' · '))}</td>` +
      `</tr>`
    : '';

  return (
    `<!doctype html><html><head><meta charset="utf-8" />${STYLE}</head><body>` +
    `<div class="masthead"><h1>${esc(title)}</h1>` +
    (subtitle ? `<p>${esc(subtitle)}</p>` : '') +
    `</div>` +
    `<span class="meta">Generated: ${esc(generatedAt)}${exportedBy ? ` · Exported by: ${esc(exportedBy)}` : ''} · ${rows.length} record${rows.length === 1 ? '' : 's'}</span>` +
    `<table>` +
    `<thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Member</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead>` +
    `<tbody>${body}${summaryRows}</tbody></table>` +
    `<div class="foot">Bukonzo United Teachers SACCO — Agency Float Ledger. Recorded amounts are terminal entries; fees and net positions are reconciled at branch level.</div>` +
    `</body></html>`
  );
};

export const exportLedgerXls = async (opts: {
  title: string;
  subtitle?: string;
  fileName: string;
  rows: LedgerRow[];
  summary?: { label: string; value: string }[];
  exportedBy?: string;
}): Promise<{ ok: boolean; message: string }> => {
  try {
    const html = buildLedgerHtml(opts);

    const file = new File(Paths.cache, `${opts.fileName}.xls`);
    file.create({ overwrite: true, intermediates: true });
    file.write(html);

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'Sharing is not available on this device' };
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.ms-excel',
      dialogTitle: opts.title,
      UTI: 'com.microsoft.excel.xls',
    });
    return { ok: true, message: 'Ledger exported' };
  } catch (e: any) {
    return { ok: false, message: e?.message || 'Could not export ledger' };
  }
};