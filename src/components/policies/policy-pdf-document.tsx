import {
  Document,
  Link as PdfLink,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import React from 'react';

import {
  BitsmithsMark,
  BottomBar,
  ContactIcon,
  TopBar,
} from '@/components/payroll/payslip-pdf-graphics';
import { payslipPdfStyles as payslipStyles } from '@/components/payroll/payslip-pdf-styles';

import {
  payslipPdfColors as c,
  payslipPdfContact as contact,
  payslipPdfMetrics as metrics,
} from '@/constants/payslip-pdf';

import { Policy, PolicyVersion } from '@/types/hrm';

// Policy PDFs share the payslip footer treatment but do not include its
// signature block, so they reserve only the space the compact contact footer
// actually occupies. The page number sits immediately above its top rule.
const policyFooterHeight =
  metrics.barHeight +
  metrics.wedgeDrop +
  metrics.footerPadY * 2 +
  metrics.footerTextSize * metrics.footerLineHeight * 2 +
  1;
const policyFooterReserve = Math.ceil(policyFooterHeight) + 12;

const styles = StyleSheet.create({
  page: {
    paddingTop: 0,
    paddingBottom: policyFooterReserve,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: c.textBody,
  },
  body: { paddingHorizontal: metrics.pageX, paddingTop: 10 },
  documentTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: c.textStrong,
    marginTop: 14,
    marginBottom: 4,
  },
  mainHeadingRule: {
    borderBottomWidth: 1.5,
    borderBottomColor: c.brandGreen,
    marginBottom: 8,
  },
  h2Block: { marginTop: 11, marginBottom: 6 },
  h3Block: { marginTop: 9, marginBottom: 5 },
  h2: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.45,
    color: c.textStrong,
  },
  h3: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: c.textStrong,
  },
  headingRule: {
    borderBottomWidth: 1.25,
    borderBottomColor: c.brandGreen,
    marginTop: 4,
  },
  p: { marginBottom: 3, lineHeight: 1.15, color: c.textBody },
  list: { marginBottom: 3 },
  listItem: { flexDirection: 'row', marginBottom: 0 },
  bullet: { width: 14, color: c.textMuted, lineHeight: 1.15 },
  listText: { flex: 1, lineHeight: 1.15, color: c.textBody },
  link: { color: c.brandGreenDeep, textDecoration: 'underline' },
  watermark: { position: 'absolute', top: 300, left: 250 },
  pageNumber: {
    position: 'absolute',
    bottom: Math.ceil(policyFooterHeight) + 8,
    right: metrics.pageX,
    fontSize: 8,
    color: c.textMuted,
  },
});

/** Policy content is CKEditor-authored HTML with a small, known tag set
 *  (headings, paragraphs, bold/italic, links, lists). This maps it onto
 *  react-pdf primitives directly — no HTML-to-PDF dependency needed.
 *  Runs client-side only (DOMParser), which is fine: PDFs are generated
 *  in the browser on click. */
function renderInline(node: ChildNode, key: number): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof HTMLElement)) return null;

  const children = Array.from(node.childNodes).map((child, index) =>
    renderInline(child, index),
  );
  switch (node.tagName) {
    case 'STRONG':
    case 'B':
      return (
        <Text key={key} style={{ fontWeight: 700, color: c.textStrong }}>
          {children}
        </Text>
      );
    case 'EM':
    case 'I':
      return (
        <Text key={key} style={{ fontFamily: 'Helvetica-Oblique' }}>
          {children}
        </Text>
      );
    case 'A':
      return (
        <PdfLink
          key={key}
          src={node.getAttribute('href') ?? ''}
          style={styles.link}
        >
          {children}
        </PdfLink>
      );
    default:
      return <Text key={key}>{children}</Text>;
  }
}

function renderBlock(node: ChildNode, key: number): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text) return null;
    return (
      <Text key={key} style={styles.p}>
        {text}
      </Text>
    );
  }
  if (!(node instanceof HTMLElement)) return null;

  const inline = Array.from(node.childNodes).map((child, index) =>
    renderInline(child, index),
  );
  switch (node.tagName) {
    case 'H1':
    case 'H2':
      return (
        <View key={key} style={styles.h2Block} wrap={false}>
          <Text style={styles.h2}>{inline}</Text>
          <View style={styles.headingRule} />
        </View>
      );
    case 'H3':
    case 'H4':
      return (
        <View key={key} style={styles.h3Block} wrap={false}>
          <Text style={styles.h3}>{inline}</Text>
          <View style={styles.headingRule} />
        </View>
      );
    case 'UL':
    case 'OL': {
      const ordered = node.tagName === 'OL';
      return (
        <View key={key} style={styles.list}>
          {Array.from(node.children).map((item, index) => (
            <View key={index} style={styles.listItem}>
              <Text style={styles.bullet}>
                {ordered ? `${index + 1}.` : '•'}
              </Text>
              <Text style={styles.listText}>
                {Array.from(item.childNodes).map((child, childIndex) =>
                  renderInline(child, childIndex),
                )}
              </Text>
            </View>
          ))}
        </View>
      );
    }
    default:
      return (
        <Text key={key} style={styles.p}>
          {inline}
        </Text>
      );
  }
}

function htmlToPdfBlocks(
  html: string,
  documentTitle: string,
): React.ReactNode[] {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const blocks = Array.from(parsed.body.childNodes).filter((node, index) => {
    if (index !== 0 || !(node instanceof HTMLElement)) return true;
    const isHeading = node.tagName === 'H1' || node.tagName === 'H2';
    return !(
      isHeading &&
      node.textContent?.trim().toLocaleLowerCase() ===
        documentTitle.trim().toLocaleLowerCase()
    );
  });

  return blocks.map((node, index) => renderBlock(node, index));
}

type PolicyPdfDocumentProps = {
  policy: Pick<Policy, 'title' | 'category'>;
  version: PolicyVersion;
};

export function PolicyPdfDocument({ policy, version }: PolicyPdfDocumentProps) {
  const metaFields = [
    { label: 'DOCUMENT', value: 'POLICY' },
    { label: 'CATEGORY', value: policy.category.toUpperCase() },
    {
      label: 'PUBLISHED',
      value: new Date(version.publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    },
  ];

  return (
    <Document title={`${policy.title} — Policy`} author='Bitsmiths Studios LLC'>
      <Page size='A4' style={styles.page}>
        <View style={styles.watermark}>
          <BitsmithsMark size={metrics.watermarkSize} variant='watermark' />
        </View>

        <View fixed>
          <TopBar />
          <View style={payslipStyles.masthead}>
            <View style={payslipStyles.markWrap}>
              <BitsmithsMark size={metrics.logoSize} />
            </View>
            <View style={payslipStyles.lockup}>
              <Text style={payslipStyles.companyName}>
                BITSMITHS STUDIOS LLC
              </Text>
              <Text style={payslipStyles.docTitle}>POLICY DOCUMENT</Text>
            </View>
          </View>
          <View style={payslipStyles.mastheadRule} />

          <View style={payslipStyles.headerMeta}>
            <View style={payslipStyles.metaGrid}>
              {metaFields.map((field, index) => (
                <View
                  key={field.label}
                  style={
                    index === metaFields.length - 1
                      ? [payslipStyles.metaCell, payslipStyles.metaCellLast]
                      : payslipStyles.metaCell
                  }
                >
                  <Text style={payslipStyles.metaLabel}>{field.label}</Text>
                  <Text style={payslipStyles.metaValue}>{field.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.documentTitle}>{policy.title}</Text>
          <View style={styles.mainHeadingRule} />
          {htmlToPdfBlocks(version.contentHtml, policy.title)}
        </View>

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
        <View style={payslipStyles.footer} fixed>
          <View style={payslipStyles.footerRule} />
          <View style={payslipStyles.footerInner}>
            <View style={payslipStyles.footerItem}>
              <ContactIcon kind='site' />
              <Text style={payslipStyles.footerText}>{contact.site}</Text>
            </View>
            <View style={payslipStyles.footerItem}>
              <ContactIcon kind='phone' />
              <Text style={payslipStyles.footerText}>{contact.phone}</Text>
            </View>
            <View style={payslipStyles.footerItem}>
              <ContactIcon kind='pin' />
              <Text style={payslipStyles.footerText}>{contact.address}</Text>
            </View>
          </View>
          <BottomBar />
        </View>
      </Page>
    </Document>
  );
}
