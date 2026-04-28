import { Invoice, BusinessSettings } from '../types';
import { generateEInvoiceJSON } from '../lib/einvoice-generator';

interface EInvoiceApiResponse {
  success: boolean;
  ackNo?: string;
  ackDate?: string;
  irn?: string;
  signedQrCode?: string;
  error?: string;
}

/**
 * Service to interact with GST E-Invoice API (via GSP or Direct)
 * Note: Real integration requires registered GSP credentials.
 */
export class EInvoiceService {
  private static API_ENDPOINT = (import.meta as any).env.VITE_GST_API_URL || 'https://api.sandbox.gst.gov.in/gsp/einvoice';
  private static CLIENT_ID = (import.meta as any).env.VITE_GST_CLIENT_ID;
  private static CLIENT_SECRET = (import.meta as any).env.VITE_GST_CLIENT_SECRET;

  /**
   * Registers an invoice with the GST Network
   */
  static async registerInvoice(invoice: Invoice, settings: BusinessSettings): Promise<EInvoiceApiResponse> {
    // 1. Map to Schema v1.1
    const payload = generateEInvoiceJSON(invoice, settings);

    // If no credentials, simulate a portal delay and success
    if (!this.CLIENT_ID) {
      console.warn('GST API Credentials missing. Running in Simulation Mode.');
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            ackNo: `ACK${Math.floor(Math.random() * 1000000000)}`,
            ackDate: new Date().toISOString(),
            irn: `IRN${Math.random().toString(36).substring(2, 15).toUpperCase()}${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
            signedQrCode: `MOCK_QR_CODE_${invoice.invoiceNumber}_${Date.now()}`
          });
        }, 2000);
      });
    }

    try {
      const response = await fetch(`${this.API_ENDPOINT}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client-id': this.CLIENT_ID,
          'client-secret': this.CLIENT_SECRET,
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to register with GSTN');
        } else {
          throw new Error(`GST Server Error (${response.status}): ${response.statusText}`);
        }
      }

      const result = await response.json();
      return {
        success: true,
        ackNo: result.AckNo,
        ackDate: result.AckDt,
        irn: result.Irn,
        signedQrCode: result.SignedQrCode
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection to GST network failed'
      };
    }
  }

  /**
   * Cancels a registered E-Invoice
   */
  static async cancelInvoice(irn: string, reason: string, remarks: string): Promise<{ success: boolean; error?: string }> {
    // If no credentials, simulate success
    if (!this.CLIENT_ID) {
      console.warn('GST API Credentials missing. Running in Simulation Mode.');
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, 1500);
      });
    }

    try {
      const response = await fetch(`${this.API_ENDPOINT}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client-id': this.CLIENT_ID,
          'client-secret': this.CLIENT_SECRET,
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({
          Irn: irn,
          CnlRsn: reason, 
          CnlRem: remarks
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to cancel E-Invoice');
        } else {
          throw new Error(`GST Server Error (${response.status}): ${response.statusText}`);
        }
      }

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection to GST network failed'
      };
    }
  }

  private static async getAuthToken(): Promise<string> {
    // Placeholder for OAuth/Session logic
    return 'SESSION_TOKEN';
  }
}
