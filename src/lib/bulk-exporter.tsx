import { Invoice, BusinessSettings } from '@/types';
import JSZip from 'jszip';
import React from 'react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { createRoot } from 'react-dom/client';
import { InvoiceView } from '@/components/invoices/InvoiceView';
import { AuthContext } from '@/contexts/AuthContext';

export async function exportInvoices(
  invoices: Invoice[], 
  settings: BusinessSettings, 
  type: 'pdf' | 'zip',
  onProgress?: (current: number, total: number) => void
) {
  try {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '200vh'; // off-screen
    container.style.left = '0';
    container.style.pointerEvents = 'none';
    container.style.opacity = '0';
    document.body.appendChild(container);
    
    // Default paper size logic matching InvoiceView
    const paperSize = (settings as any).defaultPaperSize || 'A4';
    const idealHeight = paperSize === 'A5' ? 148 : 297;
    
    const root = createRoot(container);
    
    let mergedPdf: jsPDF | null = null;
    const zip = new JSZip();

    for (let i = 0; i < invoices.length; i++) {
      const invoice = invoices[i];
      if (onProgress) onProgress(i + 1, invoices.length);
      
      // Render InvoiceView. We pass initialStyle as Simple to ensure it uses the desired format by default,
      // or falls back appropriately if the invoice has a style. We can force it to use the saved style.
      // Wait for React to render
      await new Promise<void>((resolve) => {
        root.render(
          <AuthContext.Provider value={{ 
            user: null, 
            profile: null, 
            loading: false, 
            signIn: async () => {}, 
            signInWithEmail: async () => {}, 
            signUpWithEmail: async () => {}, 
            signInWithPhone: async () => ({} as any), 
            logout: async () => {} 
          }}>
            <InvoiceView 
              invoice={invoice} 
              settings={settings} 
              onClose={() => {}} 
            />
          </AuthContext.Provider>
        );
        // Wait for rendering and images to load
        setTimeout(resolve, 500);
      });

      const element = container.querySelector('#invoice-print-area') as HTMLElement;
      if (!element) continue;

      const originalWidth = element.style.width;
      const originalHeight = element.style.height;
      const originalTransform = element.style.transform;
      
      element.style.width = paperSize === 'A5' ? '210mm' : '210mm';
      element.style.minHeight = paperSize === 'A5' ? '148mm' : '297mm';
      element.style.transform = 'none';

      const noPrintElements = element.querySelectorAll('.no-print');
      noPrintElements.forEach(el => (el as HTMLElement).style.display = 'none');

      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        style: { transform: 'none', boxShadow: 'none' }
      });

      noPrintElements.forEach(el => (el as HTMLElement).style.display = '');
      element.style.width = originalWidth;
      element.style.minHeight = originalHeight;
      element.style.transform = originalTransform;

      // Handle individual page PDF generation
      const pdf = new jsPDF({
        orientation: paperSize === 'A5' ? 'landscape' : 'portrait',
        unit: 'mm',
        format: paperSize === 'A5' ? 'a5' : 'a4'
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (element.offsetHeight * pdfWidth) / element.offsetWidth;
      
      let finalDoc = pdf;

      if (pdfHeight > idealHeight && (pdfHeight - idealHeight > 20)) {
        finalDoc = new jsPDF({
          orientation: paperSize === 'A5' ? 'landscape' : 'portrait',
          unit: 'mm',
          format: [pdfWidth, Math.max(idealHeight, pdfHeight + 10)]
        });
        finalDoc.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      } else {
        finalDoc.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, Math.min(idealHeight, pdfHeight));
      }

      if (type === 'zip') {
        const arrayBuffer = finalDoc.output('arraybuffer');
        zip.file(`Invoice-${invoice.invoiceNumber}.pdf`, arrayBuffer);
      } else {
        if (!mergedPdf) {
          mergedPdf = finalDoc;
        } else {
          // Add a new page to the merged PDF matching the new finalDoc's format
          mergedPdf.addPage(
            [finalDoc.internal.pageSize.getWidth(), finalDoc.internal.pageSize.getHeight()],
            paperSize === 'A5' ? 'landscape' : 'portrait'
          );
          mergedPdf.addImage(dataUrl, 'PNG', 0, 0, finalDoc.internal.pageSize.getWidth(), finalDoc.internal.pageSize.getHeight());
        }
      }
    }

    // Cleanup container
    root.unmount();
    document.body.removeChild(container);

    if (type === 'zip') {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoices_Export_${new Date().getTime()}.zip`;
      link.click();
      window.URL.revokeObjectURL(url);
    } else if (mergedPdf) {
      mergedPdf.save(`Invoices_Merged_${new Date().getTime()}.pdf`);
    }

  } catch (error) {
    console.error('Bulk Export Error:', error);
    throw error;
  }
}
