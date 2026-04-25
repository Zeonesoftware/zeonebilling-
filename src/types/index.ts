export interface BusinessSettings {
  companyName: string;
  gstin: string;
  address: string;
  stateCode: string; // Add state code for GST calculation
  phone: string;
  email: string;
  logoUrl?: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId?: string;
  signatureUrl?: string;
  terms: string;
  autoUploadToDrive: boolean;
  googleDriveFolderId?: string;
  currency: string; // DEFAULT: 'INR'
  invoicePrefix: string;
  invoiceSeparator: string;
  invoicePadding: number;
  lowStockThreshold: number;
}

export interface Client {
  id: string;
  name: string;
  gstin: string;
  stateCode: string; // Add state code for IGST vs CGST/SGST
  email: string;
  phone: string;
  address: string;
}

export interface Item {
  id: string;
  name: string;
  hsn: string;
  price: number;
  gstRate: number; // e.g., 18 for 18%
  stock: number;
  unit: string;
  category: string; 
  description?: string;
  barcode?: string; // Add barcode
}

export interface InvoiceItem {
  itemId: string;
  name: string;
  hsn: string;
  quantity: number;
  price: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number; // Added for inter-state
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'Tax Invoice' | 'Proforma' | 'Bill of Supply' | 'Credit Note' | 'Delivery Challan' | 'E-invoice';
  date: string;
  dueDate: string;
  clientId: string;
  clientName: string;
  clientEmail: string; // Add email
  clientGstin: string;
  clientAddress: string;
  clientStateCode: string;
  currency: string;
  items: InvoiceItem[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalAmount: number;
  status: 'Draft' | 'Paid' | 'Pending' | 'Cancelled';
  notes?: string;
  internalNotes?: string; // Private
  extraPages?: string; // Rich text extra content
  pdfStyle?: 'Professional' | 'Classic' | 'Modern';
  paymentMethod?: string;
  irn?: string;
  irnDate?: string;
  // E-Way Bill Fields
  ewayBillNo?: string;
  ewayBillDate?: string;
  ewayBillStatus?: 'Generated' | 'Pending' | 'Cancelled';
  transporterName?: string;
  transporterId?: string;
  vehicleNo?: string;
  distance?: number;
  transportMode?: 'Road' | 'Rail' | 'Air' | 'Ship';
}

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  gstin?: string;
  itcClaimed: boolean;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  supplierGstin?: string;
  items: InvoiceItem[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalAmount: number;
  status: 'Paid' | 'Pending' | 'Cancelled';
  notes?: string;
}
