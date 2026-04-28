import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { Invoice, BusinessSettings } from '@/types';
import { format } from 'date-fns';
import { formatCurrency, amountToWords } from '@/lib/invoice-utils';

// No font registration needed for built-in fonts like Helvetica

interface InvoicePDFProps {
  invoice: Invoice;
  settings: BusinessSettings;
  pdfStyle?: string;
  qrCodeDataUrl?: string;
  upiQrCodeDataUrl?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
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

  // Standard Style (Complex matching preview)
  standardHeader: {
    padding: 20,
    borderBottom: 2,
    borderColor: '#000',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  standardSubHeader: {
    flexDirection: 'row',
    borderBottom: 2,
    borderColor: '#000',
    fontSize: 8,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  standardInfoSection: {
    flexDirection: 'row',
    borderBottom: 2,
    borderColor: '#000',
    minHeight: 120,
  },
  standardInfoBox: {
    flex: 1,
    padding: 10,
    borderRight: 2,
    borderColor: '#000',
  },
  standardTable: {
    width: '100%',
    borderBottom: 2,
    borderColor: '#000',
  },
  standardTableHeader: {
    flexDirection: 'row',
    borderBottom: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    fontSize: 7,
    fontWeight: 700,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  standardTableRow: {
    flexDirection: 'row',
    borderBottom: 1,
    borderColor: '#ccc',
    minHeight: 25,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  standardCol: {
    padding: 4,
    borderRight: 2,
    borderColor: '#000',
    justifyContent: 'center',
  },
  qrSection: {
    flexDirection: 'row',
    gap: 10,
    padding: 5,
    border: 1,
    borderColor: '#008080',
    borderRadius: 2,
    width: 200,
  },

  // Professional / Modern Style
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
    fontSize: 7,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
    fontWeight: 700,
  },
  value: {
    fontSize: 9,
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
    paddingVertical: 8,
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

const StandardLayout = ({ invoice, settings, qrCodeDataUrl, upiQrCodeDataUrl }: { invoice: Invoice, settings: BusinessSettings, qrCodeDataUrl?: string, upiQrCodeDataUrl?: string }) => (
  <View style={{ border: 2, borderColor: '#000' }}>
    <View style={styles.standardHeader}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 22, fontWeight: 700, color: '#1e3a8a' }}>{settings.companyName.toUpperCase()}</Text>
        <Text style={{ fontSize: 8, marginTop: 4 }}>{settings.address}</Text>
        <Text style={{ fontSize: 9, fontWeight: 700, marginTop: 4 }}>GSTIN: {settings.gstin} | MOBILE: {settings.phone}</Text>
      </View>
      <View style={{ width: 220, alignItems: 'flex-end' }}>
        {settings.logoUrl ? (
          <Image src={settings.logoUrl} style={{ width: 80, height: 40, objectFit: 'contain' }} />
        ) : null}
        
        {(invoice.irn || invoice.ackNo) && (
          <View style={{ ...styles.qrSection, marginTop: 5 }}>
            {qrCodeDataUrl ? (
              <Image src={qrCodeDataUrl} style={{ width: 60, height: 60 }} />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: 700, color: '#008080' }}>GST E-INVOICE</Text>
              <Text style={{ fontSize: 6, color: '#666', marginTop: 2 }}>IRN / ACK NO</Text>
              <Text style={{ fontSize: 7, fontWeight: 700 }}>{invoice.irn || invoice.ackNo}</Text>
              <Text style={{ fontSize: 6, color: '#666', marginTop: 2 }}>DATE: {invoice.ackDate ? format(new Date(invoice.ackDate), 'dd/MM/yyyy HH:mm') : format(new Date(invoice.date), 'dd/MM/yyyy HH:mm')}</Text>
            </View>
          </View>
        )}
      </View>
    </View>

    <View style={styles.standardSubHeader}>
      <View style={{ flex: 1, padding: 4, borderRight: 2, borderColor: '#000' }}>
        <Text>FSSAI: {settings.fssai || 'N/A'}</Text>
      </View>
      <View style={{ flex: 2, padding: 4, textAlign: 'center', borderRight: 2, borderColor: '#000' }}>
        <Text style={{ fontSize: 12 }}>TAX INVOICE</Text>
      </View>
      <View style={{ flex: 1, padding: 4, textAlign: 'right' }}>
        <Text>ORIGINAL FOR RECIPIENT</Text>
      </View>
    </View>

    <View style={styles.standardInfoSection}>
      <View style={styles.standardInfoBox}>
        <Text style={{ ...styles.label, marginBottom: 5 }}>Customer Detail</Text>
        <Text style={{ fontSize: 10, fontWeight: 700 }}>M/S: {invoice.clientName}</Text>
        <Text style={{ fontSize: 8 }}>Address: {invoice.clientAddress}</Text>
        <Text style={{ fontSize: 8 }}>Mobile: {invoice.clientPhone || '-'}</Text>
        <Text style={{ fontSize: 8 }}>GSTIN: {invoice.clientGstin}</Text>
        <Text style={{ fontSize: 8 }}>Place of Supply: {invoice.clientStateCode}</Text>
      </View>
      <View style={{ ...styles.standardInfoBox, borderRight: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={styles.label}>Invoice No.</Text>
          <Text style={{ fontWeight: 700, fontSize: 9 }}>{invoice.invoiceNumber}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={styles.label}>Invoice Date</Text>
          <Text style={{ fontWeight: 700, fontSize: 9 }}>{format(new Date(invoice.date), 'dd/MM/yyyy')}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={styles.label}>Challan No/Date</Text>
          <Text style={{ fontWeight: 700, fontSize: 8 }}>{invoice.challanNo || '-'} / {invoice.challanDate ? format(new Date(invoice.challanDate), 'dd/MM/yyyy') : '-'}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={styles.label}>E-Way Bill No.</Text>
          <Text style={{ fontWeight: 700, fontSize: 8 }}>{invoice.ewayBillNo || '-'}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={styles.label}>Transporter</Text>
          <Text style={{ fontWeight: 700, fontSize: 8 }}>{invoice.transporterName || '-'}</Text>
        </View>
      </View>
    </View>

    <View style={styles.standardTable}>
      <View style={styles.standardTableHeader}>
        <View style={{ ...styles.standardCol, width: '5%' }}><Text>Sr.</Text></View>
        <View style={{ ...styles.standardCol, width: '35%' }}><Text>Product Description</Text></View>
        <View style={{ ...styles.standardCol, width: '10%' }}><Text>HSN</Text></View>
        <View style={{ ...styles.standardCol, width: '5%' }}><Text>Qty</Text></View>
        <View style={{ ...styles.standardCol, width: '10%' }}><Text>Rate</Text></View>
        <View style={{ ...styles.standardCol, width: '10%' }}><Text>Taxable</Text></View>
        <View style={{ ...styles.standardCol, width: '10%' }}><Text>GST%</Text></View>
        <View style={{ ...styles.standardCol, width: '15%', borderRight: 0 }}><Text>Total</Text></View>
      </View>

      {invoice.items.map((item, idx) => (
        <View key={idx} style={styles.standardTableRow}>
          <View style={{ ...styles.standardCol, width: '5%', textAlign: 'center' }}><Text>{idx + 1}</Text></View>
          <View style={{ ...styles.standardCol, width: '35%', alignItems: 'flex-start' }}><Text style={{ fontWeight: 700 }}>{item.name}</Text></View>
          <View style={{ ...styles.standardCol, width: '10%', textAlign: 'center' }}><Text>{item.hsn}</Text></View>
          <View style={{ ...styles.standardCol, width: '5%', textAlign: 'center' }}><Text>{item.quantity}</Text></View>
          <View style={{ ...styles.standardCol, width: '10%', textAlign: 'right' }}><Text>{item.price.toFixed(2)}</Text></View>
          <View style={{ ...styles.standardCol, width: '10%', textAlign: 'right' }}><Text>{(item.quantity * item.price).toFixed(2)}</Text></View>
          <View style={{ ...styles.standardCol, width: '10%', textAlign: 'center' }}>
            <Text>{item.gstRate}%</Text>
            <Text style={{ fontSize: 6, opacity: 0.6 }}>C:{(item.cgst || 0).toFixed(1)} S:{(item.sgst || 0).toFixed(1)}</Text>
          </View>
          <View style={{ ...styles.standardCol, width: '15%', borderRight: 0, textAlign: 'right' }}><Text style={{ fontWeight: 700 }}>{item.total.toFixed(2)}</Text></View>
        </View>
      ))}

      <View style={{ flexDirection: 'row', backgroundColor: '#f9fafb', fontSize: 9, fontWeight: 700 }}>
        <View style={{ ...styles.standardCol, width: '50%', textAlign: 'right' }}><Text>TOTALS</Text></View>
        <View style={{ ...styles.standardCol, width: '5%', textAlign: 'center' }}><Text>{invoice.items.reduce((acc, i) => acc + i.quantity, 0)}</Text></View>
        <View style={{ ...styles.standardCol, width: '10%' }}></View>
        <View style={{ ...styles.standardCol, width: '10%', textAlign: 'right' }}><Text>{invoice.subtotal.toFixed(2)}</Text></View>
        <View style={{ ...styles.standardCol, width: '10%', textAlign: 'center' }}><Text>GST: {(invoice.totalCgst + invoice.totalSgst + invoice.totalIgst).toFixed(2)}</Text></View>
        <View style={{ ...styles.standardCol, width: '15%', borderRight: 0, textAlign: 'right' }}><Text>{invoice.totalAmount.toFixed(2)}</Text></View>
      </View>
    </View>

    <View style={{ flexDirection: 'row', minHeight: 120 }}>
      <View style={{ flex: 1, padding: 10, borderRight: 2, borderColor: '#000' }}>
        <Text style={styles.label}>Amount in Words</Text>
        <Text style={{ fontSize: 8, fontWeight: 700, fontStyle: 'italic', marginBottom: 10 }}>{amountToWords(invoice.totalAmount, invoice.currency)} Only</Text>
        
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Bank Details</Text>
            <Text style={{ fontSize: 7 }}>Bank: {settings.bankName}</Text>
            <Text style={{ fontSize: 7 }}>A/c: {settings.accountNumber}</Text>
            <Text style={{ fontSize: 7 }}>IFSC: {settings.ifscCode}</Text>
            <Text style={{ fontSize: 7 }}>UPI: {settings.upiId}</Text>
          </View>
          {upiQrCodeDataUrl && (
            <View style={{ alignItems: 'center', border: 1, padding: 2 }}>
              <Image src={upiQrCodeDataUrl} style={{ width: 50, height: 50 }} />
              <Text style={{ fontSize: 5, marginTop: 2 }}>SCAN TO PAY</Text>
            </View>
          )}
        </View>
      </View>
      <View style={{ width: '35%', padding: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, marginBottom: 4 }}>
          <Text>Taxable Value:</Text>
          <Text>{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, marginBottom: 4 }}>
          <Text>CGST:</Text>
          <Text>{formatCurrency(invoice.totalCgst || 0, invoice.currency)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, marginBottom: 4 }}>
          <Text>SGST:</Text>
          <Text>{formatCurrency(invoice.totalSgst || 0, invoice.currency)}</Text>
        </View>
        {invoice.totalIgst > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, marginBottom: 4 }}>
            <Text>IGST:</Text>
            <Text>{formatCurrency(invoice.totalIgst, invoice.currency)}</Text>
          </View>
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, marginTop: 5, borderTop: 1, borderColor: '#000', paddingTop: 5 }}>
          <Text>Total Amount:</Text>
          <Text>{formatCurrency(invoice.totalAmount, invoice.currency)}</Text>
        </View>
      </View>
    </View>

    <View style={{ padding: 10, borderTop: 2, borderColor: '#000', flexDirection: 'row', justifyContent: 'space-between' }}>
      <View style={{ width: '60%' }}>
        <Text style={{ fontSize: 7, fontStyle: 'italic', marginBottom: 5 }}>Certified that the particulars given above are true and correct.</Text>
        <Text style={{ fontSize: 6, color: '#999' }}>Software maintained by Zeone Software Mobile: 8667586727</Text>
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 8, fontWeight: 700 }}>For {settings.companyName.toUpperCase()}</Text>
        {settings.signatureUrl ? (
          <Image src={settings.signatureUrl} style={{ width: 80, height: 40, marginTop: 5, objectFit: 'contain' }} />
        ) : <View style={{ height: 40 }} />}
        <Text style={{ fontSize: 7, marginTop: 2, borderTop: 1, borderColor: '#000', width: 100, textAlign: 'center', paddingTop: 2 }}>Authorised Signatory</Text>
      </View>
    </View>
  </View>
);

export const InvoicePDFPage = ({ invoice, settings, pdfStyle, qrCodeDataUrl, upiQrCodeDataUrl }: { invoice: Invoice; settings: BusinessSettings; pdfStyle?: string; qrCodeDataUrl?: string; upiQrCodeDataUrl?: string }) => {
  const currentStyle = pdfStyle || invoice.pdfStyle || settings.defaultPdfStyle || 'Professional';
  
  return (
    <Page size="A4" style={styles.page}>
      {currentStyle === 'Simple' ? (
        <SimpleLayout invoice={invoice} settings={settings} />
      ) : currentStyle === 'Standard' ? (
        <StandardLayout invoice={invoice} settings={settings} qrCodeDataUrl={qrCodeDataUrl} upiQrCodeDataUrl={upiQrCodeDataUrl} />
      ) : (
        <ModernLayout invoice={invoice} settings={settings} currentStyle={currentStyle} />
      )}
    </Page>
  );
};

export const InvoicePDF = ({ invoice, settings, pdfStyle, qrCodeDataUrl, upiQrCodeDataUrl }: InvoicePDFProps) => {
  return (
    <Document>
      <InvoicePDFPage invoice={invoice} settings={settings} pdfStyle={pdfStyle} qrCodeDataUrl={qrCodeDataUrl} upiQrCodeDataUrl={upiQrCodeDataUrl} />
    </Document>
  );
};

