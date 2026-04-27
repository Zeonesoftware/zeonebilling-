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


interface InvoicePDFProps {
  invoice: Invoice;
  settings: BusinessSettings;
  pdfStyle?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Inter',
    fontSize: 9,
    color: '#1f2937',
    lineHeight: 1.4,
  },
  // Simple Style (GST / Boxed)
  simpleContainer: {
    border: 1,
    borderColor: '#000',
  },
  simpleHeader: {
    padding: 10,
    borderBottom: 1,
    borderColor: '#000',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  simpleHeadline: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  simpleGrid: {
    flexDirection: 'row',
    borderBottom: 1,
    borderColor: '#000',
  },
  simpleGridCol: {
    flex: 1,
    padding: 8,
    borderRight: 1,
    borderColor: '#000',
  },
  simpleTable: {
    width: '100%',
  },
  simpleTableHeader: {
    flexDirection: 'row',
    borderBottom: 1,
    borderColor: '#000',
    backgroundColor: '#f3f4f6',
    fontWeight: 700,
  },
  simpleTableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderColor: '#000',
    minHeight: 25,
  },
  simpleCol: {
    padding: 4,
    borderRight: 1,
    borderColor: '#000',
    justifyContent: 'center',
  },

  // Professional Style (Current modern look)
  modernHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    backgroundColor: '#237227',
    padding: 30,
    marginHorizontal: -30,
    marginTop: -30,
    color: '#fff',
  },
  modernTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#fff',
  },
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  infoBlock: {
    width: '45%',
  },
  label: {
    fontSize: 8,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
    fontWeight: 700,
  },
  value: {
    fontSize: 10,
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottom: 2,
    borderBottomColor: '#237227',
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 10,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTop: 1,
    borderTopColor: '#f3f4f6',
  }
});

const SimpleLayout = ({ invoice, settings }: { invoice: Invoice, settings: BusinessSettings }) => (
  <View style={styles.simpleContainer}>
    <View style={styles.simpleHeader}>
      <View>
        <Text style={{ fontSize: 8 }}>GSTIN: {settings.gstin}</Text>
        <Text style={{ fontSize: 8 }}>FSSAI: {settings.fssai || 'N/A'}</Text>
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 10, fontWeight: 700, borderBottom: 1, marginBottom: 2 }}>TAX INVOICE</Text>
        <Text style={{ fontSize: 18, fontWeight: 700 }}>{settings.companyName.toUpperCase()}</Text>
        <Text style={{ fontSize: 8 }}>{settings.address}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 8 }}>MOBILE: {settings.phone}</Text>
      </View>
    </View>

    <View style={styles.simpleGrid}>
      <View style={styles.simpleGridCol}>
        <Text style={styles.label}>Invoice No</Text>
        <Text style={{ fontWeight: 700 }}>{invoice.invoiceNumber}</Text>
      </View>
      <View style={{ ...styles.simpleGridCol, borderRight: 0 }}>
        <Text style={styles.label}>Date</Text>
        <Text style={{ fontWeight: 700 }}>{format(new Date(invoice.date), 'dd-MM-yyyy')}</Text>
      </View>
    </View>

    <View style={styles.simpleGrid}>
      <View style={styles.simpleGridCol}>
        <Text style={styles.label}>Bill To</Text>
        <Text style={{ fontWeight: 700 }}>{invoice.clientName}</Text>
        <Text style={{ fontSize: 8 }}>{invoice.clientAddress}</Text>
        <Text style={{ fontSize: 8 }}>GSTIN: {invoice.clientGstin}</Text>
      </View>
      <View style={{ ...styles.simpleGridCol, borderRight: 0 }}>
        <Text style={styles.label}>State Details</Text>
        <Text style={{ fontSize: 9 }}>State: {invoice.clientState}</Text>
        <Text style={{ fontSize: 9 }}>Code: {invoice.clientStateCode}</Text>
        <Text style={{ fontSize: 9 }}>Salesman: {invoice.salesmanName || 'N/A'}</Text>
      </View>
    </View>

    <View style={styles.simpleTable}>
      <View style={styles.simpleTableHeader}>
        <View style={{ ...styles.simpleCol, width: '5%' }}><Text style={{ fontWeight: 700 }}>#</Text></View>
        <View style={{ ...styles.simpleCol, width: '40%' }}><Text style={{ fontWeight: 700 }}>Particulars</Text></View>
        <View style={{ ...styles.simpleCol, width: '10%' }}><Text style={{ fontWeight: 700 }}>HSN</Text></View>
        <View style={{ ...styles.simpleCol, width: '10%' }}><Text style={{ fontWeight: 700 }}>Qty</Text></View>
        <View style={{ ...styles.simpleCol, width: '10%' }}><Text style={{ fontWeight: 700 }}>Rate</Text></View>
        <View style={{ ...styles.simpleCol, width: '10%' }}><Text style={{ fontWeight: 700 }}>GST %</Text></View>
        <View style={{ ...styles.simpleCol, width: '15%', borderRight: 0 }}><Text style={{ fontWeight: 700 }}>Total</Text></View>
      </View>

      {invoice.items.map((item, idx) => (
        <View key={idx} style={styles.simpleTableRow}>
          <View style={{ ...styles.simpleCol, width: '5%' }}><Text>{idx + 1}</Text></View>
          <View style={{ ...styles.simpleCol, width: '40%' }}><Text>{item.name}</Text></View>
          <View style={{ ...styles.simpleCol, width: '10%' }}><Text>{item.hsn}</Text></View>
          <View style={{ ...styles.simpleCol, width: '10%' }}><Text>{item.quantity}</Text></View>
          <View style={{ ...styles.simpleCol, width: '10%' }}><Text>{item.price.toFixed(2)}</Text></View>
          <View style={{ ...styles.simpleCol, width: '10%' }}><Text>{item.gstRate}%</Text></View>
          <View style={{ ...styles.simpleCol, width: '15%', borderRight: 0, textAlign: 'right' }}><Text>{item.total.toFixed(2)}</Text></View>
        </View>
      ))}

      {/* Summary Row */}
      <View style={{ ...styles.simpleTableRow, backgroundColor: '#f9fafb' }}>
        <View style={{ ...styles.simpleCol, width: '75%', alignItems: 'flex-end' }}>
          <Text style={{ fontWeight: 700 }}>TOTAL AMOUNT</Text>
        </View>
        <View style={{ ...styles.simpleCol, width: '25%', borderRight: 0, textAlign: 'right' }}>
          <Text style={{ fontWeight: 700 }}>{formatCurrency(invoice.totalAmount, invoice.currency)}</Text>
        </View>
      </View>
    </View>

    <View style={{ padding: 10 }}>
      <Text style={{ fontSize: 9, fontWeight: 700 }}>Amount in words: {amountToWords(invoice.totalAmount, invoice.currency)} Only</Text>
      
      <View style={{ flexDirection: 'row', marginTop: 20, justifyContent: 'space-between' }}>
        <View style={{ width: '60%' }}>
          <Text style={styles.label}>Bank Details</Text>
          <Text style={{ fontSize: 8 }}>{settings.bankName} | A/c: {settings.accountNumber}</Text>
          <Text style={{ fontSize: 8 }}>IFSC: {settings.ifscCode} | UPI: {settings.upiId}</Text>
        </View>
        <View style={{ width: '30%', alignItems: 'center' }}>
          <Text style={{ fontSize: 8, marginBottom: 30 }}>For {settings.companyName.toUpperCase()}</Text>
          <View style={{ borderTop: 1, width: '100%', textAlign: 'center' }}>
            <Text style={{ fontSize: 7, marginTop: 2 }}>Authorised Signatory</Text>
          </View>
        </View>
      </View>
    </View>
  </View>
);

const ModernLayout = ({ invoice, settings, currentStyle = 'Professional' }: { invoice: Invoice, settings: BusinessSettings, currentStyle?: string }) => {
  const isProfessional = currentStyle === 'Professional';
  const accentColor = isProfessional ? '#237227' : '#1f2937';
  const headerBg = isProfessional ? '#237227' : '#f9fafb';
  const headerColor = isProfessional ? '#fff' : '#1f2937';

  return (
    <>
      <View style={{
        ...styles.modernHeader,
        backgroundColor: headerBg,
        color: headerColor,
        borderBottom: isProfessional ? 0 : 1,
        borderColor: '#e5e7eb',
      }}>
        <View>
          {settings.logoUrl ? (
            <Image src={settings.logoUrl} style={{ width: 60, height: 60, objectFit: 'contain' }} />
          ) : (
            <Text style={{ fontSize: 24, fontWeight: 700 }}>{settings.companyName}</Text>
          )}
          <Text style={{ fontSize: 10, marginTop: 10 }}>{settings.address}</Text>
          <Text style={{ fontSize: 9, opacity: 0.8 }}>GSTIN: {settings.gstin}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ ...styles.modernTitle, color: headerColor }}>INVOICE</Text>
          <Text style={{ fontSize: 14 }}>#{invoice.invoiceNumber}</Text>
          <Text style={{ fontSize: 10 }}>Date: {format(new Date(invoice.date), 'dd MMM yyyy')}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoBlock}>
          <Text style={styles.label}>Bill To</Text>
          <Text style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{invoice.clientName}</Text>
          <Text style={styles.value}>{invoice.clientAddress}</Text>
          <Text style={styles.value}>GSTIN: {invoice.clientGstin}</Text>
        </View>
        <View style={{ ...styles.infoBlock, alignItems: 'flex-end' }}>
          <Text style={styles.label}>Payment Method</Text>
          <Text style={{ fontSize: 10 }}>{invoice.paymentMethod || 'Wire Transfer'}</Text>
        </View>
      </View>

      <View style={{ ...styles.tableHeader, borderBottomColor: accentColor }}>
        <View style={{ width: '50%' }}><Text style={{ fontWeight: 700 }}>Description</Text></View>
        <View style={{ width: '15%', textAlign: 'center' }}><Text style={{ fontWeight: 700 }}>Qty</Text></View>
        <View style={{ width: '15%', textAlign: 'right' }}><Text style={{ fontWeight: 700 }}>Price</Text></View>
        <View style={{ width: '20%', textAlign: 'right' }}><Text style={{ fontWeight: 700 }}>Total</Text></View>
      </View>

      {invoice.items.map((item, index) => (
        <View key={index} style={styles.tableRow}>
          <View style={{ width: '50%' }}><Text>{item.name}</Text></View>
          <View style={{ width: '15%', textAlign: 'center' }}><Text>{item.quantity}</Text></View>
          <View style={{ width: '15%', textAlign: 'right' }}><Text>{formatCurrency(item.price, invoice.currency)}</Text></View>
          <View style={{ width: '20%', textAlign: 'right' }}><Text style={{ fontWeight: 700 }}>{formatCurrency(item.total, invoice.currency)}</Text></View>
        </View>
      ))}

      <View style={{ marginTop: 30, alignItems: 'flex-end' }}>
        <View style={{ width: '40%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={styles.label}>Subtotal</Text>
            <Text>{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={styles.label}>Tax ({invoice.items[0]?.gstRate}%)</Text>
            <Text>{formatCurrency(invoice.totalCgst + invoice.totalSgst + invoice.totalIgst, invoice.currency)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTop: 1, borderColor: '#e5e7eb', marginTop: 10 }}>
            <Text style={{ fontWeight: 700 }}>Total</Text>
            <Text style={{ fontWeight: 700, fontSize: 16, color: accentColor }}>{formatCurrency(invoice.totalAmount, invoice.currency)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={{ fontSize: 10, fontWeight: 700 }}>{amountToWords(invoice.totalAmount, invoice.currency)} Only</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 }}>
          <View>
            <Text style={styles.label}>Terms</Text>
            <Text style={{ fontSize: 8, color: '#6b7280' }}>Please pay within 15 days of receiving this invoice.</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {settings.signatureUrl ? (
               <Image src={settings.signatureUrl} style={{ width: 80, height: 40, objectFit: 'contain' }} />
            ) : <View style={{ borderTop: 1, width: 100, marginTop: 30 }} />}
            <Text style={{ fontSize: 9, fontWeight: 700 }}>{settings.companyName}</Text>
          </View>
        </View>
      </View>
    </>
  );
};

interface InvoicePDFProps {
  invoice: Invoice;
  settings: BusinessSettings;
  pdfStyle?: string;
}

export const InvoicePDFPage = ({ invoice, settings, pdfStyle }: { invoice: Invoice; settings: BusinessSettings; pdfStyle?: string }) => {
  const currentStyle = pdfStyle || invoice.pdfStyle || settings.defaultPdfStyle || 'Professional';
  
  return (
    <Page size="A4" style={styles.page}>
      {currentStyle === 'Simple' ? (
        <SimpleLayout invoice={invoice} settings={settings} />
      ) : (
        <ModernLayout invoice={invoice} settings={settings} currentStyle={currentStyle} />
      )}
    </Page>
  );
};

export const InvoicePDF = ({ invoice, settings, pdfStyle }: InvoicePDFProps) => {
  return (
    <Document>
      <InvoicePDFPage invoice={invoice} settings={settings} pdfStyle={pdfStyle} />
    </Document>
  );
};
