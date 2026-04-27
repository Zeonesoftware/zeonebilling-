import { pdf } from '@react-pdf/renderer';
import JSZip from 'jszip';
import { Invoice, BusinessSettings } from '@/types';
import React from 'react';
import { Document } from '@react-pdf/renderer';
import { InvoicePDFPage } from '@/components/invoices/InvoicePDF';

export async function exportInvoices(
  invoices: Invoice[], 
  settings: BusinessSettings, 
  type: 'pdf' | 'zip',
  onProgress?: (current: number, total: number) => void
) {
  try {
    if (type === 'zip') {
      const zip = new JSZip();
      
      for (let i = 0; i < invoices.length; i++) {
        const invoice = invoices[i];
        if (onProgress) onProgress(i + 1, invoices.length);
        
        const blob = await pdf(
          <Document>
            <InvoicePDFPage invoice={invoice} settings={settings} />
          </Document>
        ).toBlob();
        
        zip.file(`Invoice-${invoice.invoiceNumber}.pdf`, blob);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoices_Export_${new Date().getTime()}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
    } else {
      // Merged PDF
      const blob = await pdf(
        <Document>
          {invoices.map((invoice, index) => (
             <InvoicePDFPage key={index} invoice={invoice} settings={settings} />
          ))}
        </Document>
      ).toBlob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoices_Merged_${new Date().getTime()}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error('Bulk Export Error:', error);
    throw error;
  }
}
