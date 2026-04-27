import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Invoice, BusinessSettings } from '@/types';
import { format } from 'date-fns';
import { formatCurrency, amountToWords } from '@/lib/invoice-utils';

// Register standard fonts
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hiA.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2', fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 9,
    color: '#1f2937',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 20,
  },
  logoContainer: {
    width: 150,
  },
  titleContainer: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 4,
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  infoBlock: {
    width: '45%',
  },
  infoLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 400,
    marginBottom: 2,
  },
  infoValueBold: {
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 2,
    color: '#111827',
  },
  table: {
    marginTop: 20,
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 30,
  },
  col1: { width: '5%', textAlign: 'center' },
  col2: { width: '45%', textAlign: 'left' },
  col3: { width: '10%', textAlign: 'center' },
  col4: { width: '10%', textAlign: 'center' },
  col5: { width: '15%', textAlign: 'right' },
  col6: { width: '15%', textAlign: 'right' },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: '#4b5563',
    textTransform: 'uppercase',
  },
  tableRowText: {
    fontSize: 9,
    color: '#374151',
  },
  summarySection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  summaryTable: {
    width: '40%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 9,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 9,
    fontWeight: 600,
    color: '#111827',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTop: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#111827',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 700,
    color: '#111827',
  },
  footer: {
    marginTop: 50,
    borderTop: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 20,
  },
  notesTitle: {
    fontSize: 8,
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  notesContent: {
    fontSize: 8,
    color: '#9ca3af',
  },
  bankDetails: {
    marginTop: 20,
    fontSize: 8,
    color: '#6b7280',
  },
  amountInWords: {
    marginTop: 10,
    fontSize: 9,
    fontWeight: 700,
    color: '#4b5563',
  }
});

interface InvoicePDFProps {
  invoice: Invoice;
  settings: BusinessSettings;
}

export const InvoicePDFPage = ({ invoice, settings }: { invoice: Invoice; settings: BusinessSettings }) => (
  <Page size="A4" style={styles.page}>
    {/* Header */}
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        {settings.logoUrl ? (
          <Image src={settings.logoUrl} style={{ width: 60, height: 60, objectFit: 'contain' }} />
        ) : (
          <Text style={styles.companyName}>{settings.companyName}</Text>
        )}
        <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 4 }}>{settings.address}</Text>
        <Text style={{ fontSize: 8, color: '#6b7280' }}>GSTIN: {settings.gstin}</Text>
      </View>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>INVOICE</Text>
        <Text style={{ color: '#6b7280' }}>#{invoice.invoiceNumber}</Text>
        <Text style={{ color: '#6b7280', marginTop: 4 }}>
          Date: {format(new Date(invoice.date), 'dd MMM yyyy')}
        </Text>
      </View>
    </View>

    {/* Info Section */}
    <View style={styles.infoSection}>
      <View style={styles.infoBlock}>
        <Text style={styles.infoLabel}>Bill To</Text>
        <Text style={styles.infoValueBold}>{invoice.clientName}</Text>
        <Text style={styles.infoValue}>{invoice.clientAddress}</Text>
        <Text style={styles.infoValue}>{invoice.clientPhone}</Text>
        <Text style={styles.infoValue}>GSTIN: {invoice.clientGstin}</Text>
      </View>
      <View style={styles.infoBlock}>
        <Text style={{ ...styles.infoLabel, textAlign: 'right' }}>Business Details</Text>
        <Text style={{ ...styles.infoValue, textAlign: 'right' }}>Phone: {settings.phone}</Text>
        <Text style={{ ...styles.infoValue, textAlign: 'right' }}>Email: {settings.email}</Text>
        {settings.fssai && <Text style={{ ...styles.infoValue, textAlign: 'right' }}>FSSAI: {settings.fssai}</Text>}
      </View>
    </View>

    {/* Table */}
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <View style={styles.col1}><Text style={styles.tableHeaderText}>#</Text></View>
        <View style={styles.col2}><Text style={styles.tableHeaderText}>Items</Text></View>
        <View style={styles.col3}><Text style={styles.tableHeaderText}>HSN</Text></View>
        <View style={styles.col4}><Text style={styles.tableHeaderText}>Qty</Text></View>
        <View style={styles.col5}><Text style={styles.tableHeaderText}>Rate</Text></View>
        <View style={styles.col6}><Text style={styles.tableHeaderText}>Total</Text></View>
      </View>

      {invoice.items.map((item, index) => (
        <View key={index} style={styles.tableRow}>
          <View style={styles.col1}><Text style={styles.tableRowText}>{index + 1}</Text></View>
          <View style={styles.col2}><Text style={styles.tableRowText}>{item.name}</Text></View>
          <View style={styles.col3}><Text style={styles.tableRowText}>{item.hsn}</Text></View>
          <View style={styles.col4}><Text style={styles.tableRowText}>{item.quantity}</Text></View>
          <View style={styles.col5}><Text style={styles.tableRowText}>{formatCurrency(item.price, invoice.currency)}</Text></View>
          <View style={styles.col6}><Text style={styles.tableRowText}>{formatCurrency(item.total, invoice.currency)}</Text></View>
        </View>
      ))}
    </View>

    {/* Summary */}
    <View style={styles.summarySection}>
      <View style={styles.summaryTable}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>CGST ({(invoice.items[0]?.gstRate || 0) / 2}%)</Text>
          <Text style={styles.summaryValue}>{formatCurrency(invoice.totalCgst, invoice.currency)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>SGST ({(invoice.items[0]?.gstRate || 0) / 2}%)</Text>
          <Text style={styles.summaryValue}>{formatCurrency(invoice.totalSgst, invoice.currency)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(invoice.totalAmount, invoice.currency)}</Text>
        </View>
      </View>
    </View>

    <Text style={styles.amountInWords}>
      Amount in words: {amountToWords(invoice.totalAmount, invoice.currency)} Only
    </Text>

    {/* Footer */}
    <View style={styles.footer}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ width: '60%' }}>
          <Text style={styles.notesTitle}>Payment Information</Text>
          <View style={styles.bankDetails}>
            <Text>Bank: {settings.bankName}</Text>
            <Text>Account Number: {settings.accountNumber}</Text>
            <Text>IFSC Code: {settings.ifscCode}</Text>
            <Text>UPI ID: {settings.upiId}</Text>
          </View>
        </View>
        <View style={{ width: '30%', alignItems: 'center' }}>
          <Text style={{ ...styles.notesTitle, marginBottom: 40 }}>Authorised Signatory</Text>
          {settings.signatureUrl && (
            <Image src={settings.signatureUrl} style={{ width: 80, height: 40, objectFit: 'contain', position: 'absolute', top: 15 }} />
          )}
          <View style={{ borderTop: 1, borderTopColor: '#000', width: '100%', marginTop: 10 }} />
          <Text style={{ fontSize: 7, marginTop: 4 }}>{settings.companyName.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={{ marginTop: 30, alignItems: 'center' }}>
        <Text style={styles.notesContent}>Certified that the particulars given above are true and correct.</Text>
        <Text style={{ ...styles.notesContent, marginTop: 4 }}>Powered by Zeone Software</Text>
      </View>
    </View>
  </Page>
);

export const InvoicePDF = ({ invoice, settings }: InvoicePDFProps) => {
  return (
    <Document>
      <InvoicePDFPage invoice={invoice} settings={settings} />
    </Document>
  );
};
