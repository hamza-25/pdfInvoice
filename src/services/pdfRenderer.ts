import type { TranslationKey } from '../locales/en';
import type { clientData, companyData } from '../interfaces';
import { formatDate, formatMoney } from './currency';
import { t } from './i18n';
import type { InvoiceLine, InvoiceModel } from './invoiceModel';
import { COLORS, COLUMNS, FONTS, FOOTER, NOTES, PAGE, SPACE, TOTALS, TYPE } from './pdfLayout';

const LEFT_WIDTH = 250;
const META_WIDTH = 210;
const TABLE_HEADER_HEIGHT = 24;
const TABLE_HEADER_PADDING = 8;
const ROW_PADDING = 7;
const CONTINUATION_HEIGHT = 38;
const CONTINUATION_RULE_OFFSET = 20;
/** Right column of the totals ledger (label sits left of it). */
const TOTALS_VALUE_WIDTH = 110;
/** Breathing room between a ledger label and its value column. */
const TOTALS_LABEL_GAP = 8;
/** Separator between the non-empty company, phone and email footer fields. */
const FOOTER_SEPARATOR = ' · ';

interface MetaRow {
  label: string;
  value: string;
}

interface NoteBlock {
  label: string;
  value: string;
}

interface NoteMetrics {
  /** Measured label height. */
  labelHeight: number;
  /** Full block height: label + gap + wrapped value. */
  height: number;
}

type Party = companyData | clientData;
type NameStyle = { font: string; size: number };

/** Stack every non-empty contact field on its own line, like the live sheet. */
const contactText = (party: Party): string =>
  [party.address, party.city, party.phone, party.email]
    .filter((line): line is string => Boolean(line && line.trim()))
    .map((line) => line.trim())
    .join('\n');

/**
 * Draw the invoice onto an existing PDFKit document.
 *
 * P2 rebuilt the header and bill-to block; P3 draws measured five-column item
 * rows; P4 adds the right-aligned totals ledger. The footer remains legacy
 * until P5.
 */
export const renderInvoicePdf = (doc: PDFKit.PDFDocument, model: InvoiceModel): void => {
  const { lang, style } = model;
  const contentRight = doc.page.width - PAGE.margin;
  const contentBottom = doc.page.height - PAGE.margin - PAGE.footerReserved;
  const metaX = contentRight - META_WIDTH;

  /** The full-bleed accent rule at the top of every page. */
  const drawPageChrome = (): void => {
    doc.rect(0, 0, doc.page.width, 3).fill(COLORS.accent);
  };

  /** Draw an accent section label and return its measured height. */
  const drawSectionLabel = (text: string, y: number): number => {
    doc.font(TYPE.sectionLabel.font).fontSize(TYPE.sectionLabel.size);
    const height = doc.heightOfString(text, {
      width: LEFT_WIDTH,
      characterSpacing: TYPE.sectionLabel.tracking,
    });
    doc.fillColor(COLORS.accent).text(text, PAGE.margin, y, {
      width: LEFT_WIDTH,
      characterSpacing: TYPE.sectionLabel.tracking,
    });
    return height;
  };

  /**
   * Draw a party block (FROM / BILL TO): label, name, then every non-empty
   * contact line. Returns the measured block height.
   */
  const drawPartyBlock = (
    label: string,
    name: string,
    party: Party,
    nameStyle: NameStyle,
    top: number,
  ): number => {
    let cursor = top;
    cursor += drawSectionLabel(label, cursor) + SPACE.xs;

    doc.font(nameStyle.font).fontSize(nameStyle.size).fillColor(COLORS.ink);
    const nameHeight = doc.heightOfString(name, { width: LEFT_WIDTH });
    doc.text(name, PAGE.margin, cursor, { width: LEFT_WIDTH });
    cursor += nameHeight;

    const contact = contactText(party);
    if (contact) {
      cursor += SPACE.xs;
      doc.font(TYPE.metaValue.font).fontSize(TYPE.metaValue.size);
      const contactHeight = doc.heightOfString(contact, { width: LEFT_WIDTH, lineGap: 1 });
      doc.fillColor(COLORS.inkSoft).text(contact, PAGE.margin, cursor, {
        width: LEFT_WIDTH,
        lineGap: 1,
      });
      cursor += contactHeight;
    }

    return cursor - top;
  };

  /** Primary date label: quote-without-due falls back from VALID UNTIL to DATE. */
  const primaryDateKey = (): TranslationKey =>
    style.kind === 'quote' && model.primaryDate?.role === 'issue'
      ? 'pdf.date.invoice'
      : style.dateKey;

  const secondaryDateKey = (): TranslationKey =>
    style.kind === 'invoice' && model.secondaryDate?.role === 'due'
      ? 'pdf.dueDate'
      : 'pdf.date.invoice';

  const buildMetaRows = (): MetaRow[] => {
    const rows: MetaRow[] = [{ label: t(style.idKey, lang), value: model.number }];

    if (model.primaryDate) {
      rows.push({
        label: `${t(primaryDateKey(), lang)}:`,
        value: formatDate(model.primaryDate.value, lang),
      });
    }
    if (model.secondaryDate) {
      rows.push({
        label: `${t(secondaryDateKey(), lang)}:`,
        value: formatDate(model.secondaryDate.value, lang),
      });
    }

    return rows;
  };

  /** Draw label/value pairs with their baselines aligned. */
  const drawMetaRows = (rows: MetaRow[], top: number): number => {
    const rowHeight = TYPE.metaValue.leading + SPACE.xxs;
    const labelOffset = (TYPE.metaValue.size - TYPE.metaLabel.size) * 0.72;
    let cursor = top;

    for (const row of rows) {
      doc
        .font(TYPE.metaLabel.font)
        .fontSize(TYPE.metaLabel.size)
        .fillColor(COLORS.inkSoft)
        .text(row.label, metaX, cursor + labelOffset, {
          width: META_WIDTH,
          characterSpacing: TYPE.metaLabel.tracking,
        });
      doc
        .font(TYPE.metaValue.font)
        .fontSize(TYPE.metaValue.size)
        .fillColor(COLORS.ink)
        .text(row.value, metaX, cursor, { width: META_WIDTH, align: 'right' });
      cursor += rowHeight;
    }

    return cursor - top;
  };

  /** Draw the letterhead plus right-hand meta block; return the hairline y. */
  const drawHeader = (): number => {
    const top = PAGE.margin;
    const leftHeight = drawPartyBlock(
      t('pdf.from', lang),
      model.company.name,
      model.company,
      TYPE.company,
      top,
    );

    const title = t(style.titleKey, lang);
    doc.font(TYPE.title.font).fontSize(TYPE.title.size);
    const titleHeight = doc.heightOfString(title, {
      width: META_WIDTH,
      characterSpacing: TYPE.title.tracking,
    });
    doc.fillColor(COLORS.ink).text(title, metaX, top, {
      width: META_WIDTH,
      align: 'right',
      characterSpacing: TYPE.title.tracking,
    });

    const metaTop = top + titleHeight + SPACE.sm;
    const rightHeight = metaTop - top + drawMetaRows(buildMetaRows(), metaTop);
    const headerBottom = top + Math.max(leftHeight, rightHeight) + SPACE.lg;

    doc
      .moveTo(PAGE.margin, headerBottom)
      .lineTo(contentRight, headerBottom)
      .lineWidth(1)
      .strokeColor(COLORS.rule)
      .stroke()
      .strokeColor(COLORS.ink);

    return headerBottom;
  };

  drawPageChrome();
  const headerBottom = drawHeader();

  // ---- Bill To ----
  const billToTop = headerBottom + SPACE.xl;
  const billToHeight = drawPartyBlock(
    t('pdf.billTo', lang),
    model.client.name,
    model.client,
    TYPE.client,
    billToTop,
  );

  /** Five-column table header, with a hairline above and below. */
  const drawTableHeader = (y: number): number => {
    const headerBottom = y + TABLE_HEADER_HEIGHT;
    doc
      .moveTo(PAGE.margin, y)
      .lineTo(contentRight, y)
      .lineWidth(1)
      .strokeColor(COLORS.rule)
      .stroke();

    const labelY = y + TABLE_HEADER_PADDING;
    doc.font(TYPE.tableHeader.font).fontSize(TYPE.tableHeader.size).fillColor(COLORS.inkSoft);

    const label = (
      text: string,
      column: { x: number; width: number; align: 'left' | 'right' },
    ): void => {
      doc.text(text, column.x, labelY, {
        width: column.width,
        align: column.align,
        characterSpacing: TYPE.tableHeader.tracking,
      });
    };

    label('#', COLUMNS.index);
    label(t('pdf.column.description', lang), COLUMNS.description);
    label(t('pdf.column.quantity', lang), COLUMNS.quantity);
    label(t('pdf.column.unitPrice', lang), COLUMNS.unitPrice);
    label(t('pdf.column.amount', lang), COLUMNS.amount);

    doc
      .moveTo(PAGE.margin, headerBottom)
      .lineTo(contentRight, headerBottom)
      .strokeColor(COLORS.rule)
      .stroke();

    return headerBottom;
  };

  /** Empty descriptions still get a visible cell rather than a blank gap. */
  const descriptionFor = (line: InvoiceLine): string => line.description.trim() || '—';

  /** Measure a row before drawing so a page break never splits it. */
  const rowHeightFor = (line: InvoiceLine): number => {
    doc.font(TYPE.tableBody.font).fontSize(TYPE.tableBody.size);
    return Math.max(
      22,
      doc.heightOfString(descriptionFor(line), { width: COLUMNS.description.width }) +
        ROW_PADDING * 2,
    );
  };

  /** Draw one complete row and its bottom hairline; return the next row's y. */
  const drawTableRow = (line: InvoiceLine, y: number, rowHeight: number): number => {
    const textY = y + ROW_PADDING;
    doc
      .font(TYPE.tableBody.font)
      .fontSize(TYPE.tableBody.size)
      .fillColor(COLORS.inkSoft)
      .text(String(line.index).padStart(2, '0'), COLUMNS.index.x, textY, {
        width: COLUMNS.index.width,
        align: COLUMNS.index.align,
      });

    doc
      .fillColor(COLORS.ink)
      .text(descriptionFor(line), COLUMNS.description.x, textY, {
        width: COLUMNS.description.width,
        align: COLUMNS.description.align,
      })
      .text(String(line.quantity), COLUMNS.quantity.x, textY, {
        width: COLUMNS.quantity.width,
        align: COLUMNS.quantity.align,
      })
      .text(formatMoney(line.price, model.currency), COLUMNS.unitPrice.x, textY, {
        width: COLUMNS.unitPrice.width,
        align: COLUMNS.unitPrice.align,
      })
      .text(formatMoney(line.amount, model.currency), COLUMNS.amount.x, textY, {
        width: COLUMNS.amount.width,
        align: COLUMNS.amount.align,
      });

    const bottom = y + rowHeight;
    doc
      .moveTo(PAGE.margin, bottom)
      .lineTo(contentRight, bottom)
      .lineWidth(1)
      .strokeColor(COLORS.rule)
      .stroke();

    return bottom;
  };

  /**
   * Compact header for pages after the first: company name on the left,
   * document type + number on the right, then a hairline.
   */
  const drawContinuationHeader = (): void => {
    const top = PAGE.margin;
    doc
      .font(FONTS.sansBold)
      .fontSize(10)
      .fillColor(COLORS.ink)
      .text(model.company.name, PAGE.margin, top, { width: LEFT_WIDTH, ellipsis: true });

    doc
      .font(FONTS.display)
      .fontSize(12)
      .fillColor(COLORS.ink)
      .text(t(style.titleKey, lang), contentRight - 200, top, { width: 100, align: 'right' });

    doc
      .font(FONTS.sans)
      .fontSize(9)
      .fillColor(COLORS.inkSoft)
      .text(model.number, contentRight - 100, top + 2, { width: 100, align: 'right' });

    const lineY = top + CONTINUATION_RULE_OFFSET;
    doc
      .moveTo(PAGE.margin, lineY)
      .lineTo(contentRight, lineY)
      .lineWidth(1)
      .strokeColor(COLORS.rule)
      .stroke();
  };

  /** Start a new page with the page rule + continuation header + table header. */
  const newPageWithHeader = (): number => {
    doc.addPage();
    drawPageChrome();
    drawContinuationHeader();
    return drawTableHeader(PAGE.margin + CONTINUATION_HEIGHT);
  };

  /** Add a page when `needed` points would overflow, and return the new y. */
  const ensureSpace = (y: number, needed: number): number => {
    if (y + needed > contentBottom) {
      doc.addPage();
      drawPageChrome();
      drawContinuationHeader();
      return PAGE.margin + CONTINUATION_HEIGHT;
    }
    return y;
  };

  /**
   * Right-aligned totals ledger: subtotal, tax, an ink rule, and the accent
   * grand total. Callers reserve `TOTALS.height` first so the block never
   * splits across pages.
   */
  const drawTotals = (top: number): number => {
    const x = contentRight - TOTALS.width;
    const valueX = contentRight - TOTALS_VALUE_WIDTH;
    const labelWidth = TOTALS.width - TOTALS_VALUE_WIDTH - TOTALS_LABEL_GAP;
    let y = top + TOTALS.gap;

    const moneyRow = (label: string, value: string): void => {
      doc
        .font(TYPE.metaValue.font)
        .fontSize(TYPE.metaValue.size)
        .fillColor(COLORS.inkSoft)
        .text(label, x, y, { width: labelWidth });
      doc
        .fillColor(COLORS.ink)
        .text(value, valueX, y, { width: TOTALS_VALUE_WIDTH, align: 'right' });
      y += TOTALS.rowHeight;
    };

    moneyRow(t('pdf.subtotal', lang), formatMoney(model.subtotal, model.currency));
    moneyRow(
      `${t('pdf.tax', lang)} (${model.taxRate}%)`,
      formatMoney(model.taxValue, model.currency),
    );

    y += TOTALS.ruleGap;
    doc.moveTo(x, y).lineTo(contentRight, y).lineWidth(1).strokeColor(COLORS.ink).stroke();
    y += TOTALS.totalGap;

    doc
      .font(TYPE.grandTotal.font)
      .fontSize(TYPE.grandTotal.size)
      .fillColor(COLORS.accent)
      .text(t('pdf.total', lang), x, y, { width: labelWidth });
    doc.fillColor(COLORS.accent).text(formatMoney(model.grandTotal, model.currency), valueX, y, {
      width: TOTALS_VALUE_WIDTH,
      align: 'right',
    });

    return y + TOTALS.totalHeight;
  };

  /** Measure a payment/notes block before reserving space for it. */
  const measureNoteBlock = (block: NoteBlock, width: number): NoteMetrics => {
    doc.font(TYPE.sectionLabel.font).fontSize(TYPE.sectionLabel.size);
    const labelHeight = doc.heightOfString(block.label, {
      width,
      characterSpacing: TYPE.sectionLabel.tracking,
    });

    doc.font(TYPE.metaValue.font).fontSize(TYPE.metaValue.size);
    const valueHeight = doc.heightOfString(block.value, { width, lineGap: 1 });

    return { labelHeight, height: labelHeight + NOTES.labelGap + valueHeight };
  };

  /** Draw an accent label and its wrapped value. */
  const drawNoteBlock = (
    block: NoteBlock,
    x: number,
    y: number,
    width: number,
    metrics: NoteMetrics,
  ): void => {
    doc
      .font(TYPE.sectionLabel.font)
      .fontSize(TYPE.sectionLabel.size)
      .fillColor(COLORS.accent)
      .text(block.label, x, y, { width, characterSpacing: TYPE.sectionLabel.tracking });
    doc
      .font(TYPE.metaValue.font)
      .fontSize(TYPE.metaValue.size)
      .fillColor(COLORS.ink)
      .text(block.value, x, y + metrics.labelHeight + NOTES.labelGap, { width, lineGap: 1 });
  };

  /** Payment and notes are only printed when the payload actually has text. */
  const closingBlocks = (): NoteBlock[] => {
    const blocks: NoteBlock[] = [];
    const payment = model.paymentType.trim();
    const notes = model.notes.trim();
    if (payment) {
      blocks.push({ label: t('pdf.payment', lang), value: payment });
    }
    if (notes) {
      blocks.push({ label: t('pdf.notes', lang), value: notes });
    }
    return blocks;
  };

  /**
   * Trim a footer line to one line, appending an ellipsis if needed. Drawing it
   * without a width afterwards guarantees PDFKit never wraps it into the page
   * margin.
   */
  const fitSingleLine = (text: string, width: number): string => {
    const oneLine = text.replace(/[\r\n\t]+/g, ' ');
    doc.font(TYPE.footer.font).fontSize(TYPE.footer.size);
    if (doc.widthOfString(oneLine) <= width) {
      return oneLine;
    }

    const characters = [...oneLine];
    while (characters.length > 0 && doc.widthOfString(`${characters.join('')}…`) > width) {
      characters.pop();
    }
    return `${characters.join('').trimEnd()}…`;
  };

  /**
   * Stamp the footer strip on every buffered page: hairline and page number
   * everywhere, thanks/contact copy on the final page. Bottom margins are
   * disabled while stamping so PDFKit never spills an extra page.
   */
  const drawFooters = (): void => {
    const range = doc.bufferedPageRange();
    const lastPage = range.start + range.count - 1;
    const ruleY = contentBottom;
    const textWidth = contentRight - PAGE.margin - FOOTER.pageNumberWidth - FOOTER.columnGap;
    const thanksY = ruleY + FOOTER.topGap;
    const pageNumberY = thanksY + (TYPE.footerLead.size - TYPE.footer.size) * 0.72;
    const contactNoteY = thanksY + TYPE.footerLead.leading;
    const contactY = contactNoteY + TYPE.footer.leading;
    const contactLine = fitSingleLine(
      [model.company.name, model.company.phone, model.company.email]
        .map((part) => part?.trim() ?? '')
        .filter(Boolean)
        .join(FOOTER_SEPARATOR),
      textWidth,
    );

    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const savedBottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;

      doc
        .moveTo(PAGE.margin, ruleY)
        .lineTo(contentRight, ruleY)
        .lineWidth(1)
        .strokeColor(COLORS.rule)
        .stroke();

      if (i === lastPage) {
        doc
          .font(TYPE.footerLead.font)
          .fontSize(TYPE.footerLead.size)
          .fillColor(COLORS.ink)
          .text(t('pdf.thanks', lang), PAGE.margin, thanksY, { width: textWidth });
        doc
          .font(TYPE.footer.font)
          .fontSize(TYPE.footer.size)
          .fillColor(COLORS.inkSoft)
          .text(t('pdf.contactNote', lang), PAGE.margin, contactNoteY, { width: textWidth });
        doc.text(contactLine, PAGE.margin, contactY, { lineBreak: false });
      }

      doc
        .font(TYPE.footer.font)
        .fontSize(TYPE.footer.size)
        .fillColor(COLORS.inkSoft)
        .text(
          t('pdf.pageOf', lang, { current: i - range.start + 1, total: range.count }),
          contentRight - FOOTER.pageNumberWidth,
          pageNumberY,
          { width: FOOTER.pageNumberWidth, align: 'right' },
        );

      doc.page.margins.bottom = savedBottomMargin;
    }
  };

  // ---- Items table ----
  let tableBottom = drawTableHeader(billToTop + billToHeight + SPACE.xl);

  for (const line of model.lines) {
    const rowHeight = rowHeightFor(line);
    if (tableBottom + rowHeight > contentBottom) {
      tableBottom = newPageWithHeader();
    }
    tableBottom = drawTableRow(line, tableBottom, rowHeight);
  }

  // ---- Totals ledger (P4) ----
  const ledgerTop = ensureSpace(tableBottom, TOTALS.height);
  const ledgerBottom = drawTotals(ledgerTop);

  // ---- Payment and notes (P5) ----
  const blocks = closingBlocks();
  if (blocks.length > 0) {
    const blockWidth = blocks.length === 2 ? NOTES.columnWidth : PAGE.contentWidth;
    const metrics = blocks.map((block) => measureNoteBlock(block, blockWidth));
    const blockHeight = Math.max(...metrics.map((metric) => metric.height));

    const blockTop = ensureSpace(ledgerBottom, NOTES.topGap + blockHeight) + NOTES.topGap;
    blocks.forEach((block, index) => {
      const x = PAGE.margin + index * (blockWidth + NOTES.columnGap);
      drawNoteBlock(block, x, blockTop, blockWidth, metrics[index]);
    });
  }

  // ---- Footer and page numbers (P5) ----
  drawFooters();
};
