import type { TranslationKey } from '../locales/en';
import type { clientData, companyData } from '../interfaces';
import { formatDate, formatMoney } from './currency';
import { t } from './i18n';
import type { InvoiceModel } from './invoiceModel';
import { COLORS, FONTS, LAYOUT, PAGE, SPACE, TYPE } from './pdfLayout';

const LEFT_WIDTH = 250;
const META_WIDTH = 210;

interface MetaRow {
  label: string;
  value: string;
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
 * P2 replaces the header and bill-to block. The old items/totals/footer code is
 * still below, deliberately, until P3–P5 rebuild those sections.
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

  /**
   * Draw the legacy table header (rule, labels, rule) at `y` and return the y
   * at which the first row should start. P3 replaces this with five columns.
   */
  const drawTableHeader = (y: number): number => {
    doc
      .moveTo(LAYOUT.margin, y)
      .lineTo(contentRight, y)
      .lineWidth(1)
      .strokeColor(COLORS.ink)
      .stroke();

    const labelY = y + 5;
    doc
      .font(FONTS.sans)
      .fontSize(10)
      .fillColor(COLORS.ink)
      .text(t('pdf.column.description', lang), LAYOUT.columns.description.x, labelY)
      .text(t('pdf.column.quantity', lang), LAYOUT.columns.quantity.x, labelY)
      .text(t('pdf.column.amount', lang), LAYOUT.columns.amount.x, labelY);

    const lineY = y + 20;
    doc.moveTo(LAYOUT.margin, lineY).lineTo(contentRight, lineY).stroke();
    return lineY + LAYOUT.row.top;
  };

  /**
   * Compact header for pages after the first: company name on the left,
   * document type + number on the right. P3 adds the hairline.
   */
  const drawContinuationHeader = (): void => {
    doc
      .font(FONTS.sans)
      .fontSize(9)
      .fillColor(COLORS.ink)
      .text(model.company.name, LAYOUT.margin, LAYOUT.margin, { width: 250, ellipsis: true })
      .text(`${t(style.titleKey, lang)} ${model.number}`, contentRight - 200, LAYOUT.margin, {
        width: 200,
        align: 'right',
      });
  };

  /** Start a new page with the page rule + continuation header + table header. */
  const newPageWithHeader = (): number => {
    doc.addPage();
    drawPageChrome();
    drawContinuationHeader();
    return drawTableHeader(PAGE.margin + LAYOUT.continuation.height);
  };

  /** Add a page when `needed` points would overflow, and return the new y. */
  const ensureSpace = (y: number, needed: number): number => {
    if (y + needed > contentBottom) {
      doc.addPage();
      drawPageChrome();
      drawContinuationHeader();
      return PAGE.margin + LAYOUT.continuation.height;
    }
    return y;
  };

  // ---- Items table (legacy; P3 replaces this) ----
  let cursorY = drawTableHeader(billToTop + billToHeight + SPACE.xl);

  model.lines.forEach((line) => {
    const description = line.description;
    const descriptionHeight = doc.heightOfString(description, {
      width: LAYOUT.columns.description.width,
    });
    const rowHeight = Math.max(LAYOUT.row.minHeight, descriptionHeight + LAYOUT.row.paddingY);

    if (cursorY + rowHeight > contentBottom) {
      cursorY = newPageWithHeader();
    }

    doc
      .font(FONTS.sans)
      .fontSize(10)
      .fillColor(COLORS.ink)
      .text(description, LAYOUT.columns.description.x, cursorY, {
        width: LAYOUT.columns.description.width,
      })
      .text(String(line.quantity), LAYOUT.columns.quantity.x, cursorY)
      .text(formatMoney(line.price, model.currency), LAYOUT.columns.amount.x, cursorY);

    cursorY += rowHeight;
  });

  // ---- Totals (legacy; P4 replaces this) ----
  cursorY = ensureSpace(cursorY, LAYOUT.totals.height);

  doc
    .fillColor(COLORS.ink)
    .text(`${t('pdf.tax', lang)} (${model.taxRate}%)`, LAYOUT.columns.description.x, cursorY)
    .text(formatMoney(model.taxValue, model.currency), LAYOUT.columns.amount.x, cursorY);

  cursorY += LAYOUT.totals.lineGap;
  doc.moveTo(LAYOUT.margin, cursorY).lineTo(contentRight, cursorY).strokeColor(COLORS.ink).stroke();

  cursorY += LAYOUT.totals.lineGap;
  doc
    .font(FONTS.sansBold)
    .fillColor(COLORS.ink)
    .text(t('pdf.total', lang), 400, cursorY)
    .text(formatMoney(model.grandTotal, model.currency), LAYOUT.columns.amount.x, cursorY);

  // ---- Footer (legacy; P5 replaces this) ----
  cursorY += LAYOUT.totals.footerGap;
  cursorY = ensureSpace(cursorY, LAYOUT.totals.footerHeight);
  doc
    .font(FONTS.sans)
    .fontSize(10)
    .fillColor(COLORS.ink)
    .text(t('pdf.thanks', lang), LAYOUT.margin, cursorY)
    .fontSize(8)
    .text(t('pdf.contactNote', lang), LAYOUT.margin, cursorY + 40)
    .text(
      `[${model.company.name}, ${model.company.phone ?? ''}, ${model.company.email ?? ''}]`,
      LAYOUT.margin,
      cursorY + 50,
    );

  // ---- Page numbers ----
  // With bufferPages the content is already written but not yet flushed, so
  // every buffered page can be visited to stamp "Page X of Y".
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing this close to the page edge needs the bottom margin disabled,
    // otherwise PDFKit would spill the footer onto yet another page.
    const savedBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font(FONTS.sans)
      .fontSize(8)
      .fillColor(COLORS.ink)
      .text(
        t('pdf.pageOf', lang, { current: i - range.start + 1, total: range.count }),
        LAYOUT.margin,
        doc.page.height - LAYOUT.footer.fromBottom,
        { width: contentRight - LAYOUT.margin, align: 'center' },
      );
    doc.page.margins.bottom = savedBottomMargin;
  }
};
