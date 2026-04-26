import React from 'react';
import { Invoice, BusinessSettings } from '@/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/invoice-utils';
import { cn } from '@/lib/utils';

interface ThermalReceiptProps {
  invoice: Invoice;
  settings: BusinessSettings;
}

export const ThermalReceipt = React.forwardRef<HTMLDivElement, ThermalReceiptProps>(
  ({ invoice, settings }, ref) => {
    return (
      <div 
        ref={ref} 
        id="thermal-receipt"
        className="bg-white text-black font-mono text-[11px] leading-tight w-[58mm] sm:w-[80mm] p-2 mx-auto"
        style={{ width: '58mm' }} // Default to 58mm, common for small pos printers
      >
        {/* Header */}
        <div className="text-center space-y-1 mb-4">
          <div className="text-sm font-black uppercase">{settings.companyName}</div>
          <div className="text-[9px] leading-tight opacity-80">{settings.address}</div>
          {settings.gstin && (
            <div className="text-[9px] font-bold">GST: {settings.gstin}</div>
          )}
          {settings.phone && (
            <div className="text-[9px]">Ph: {settings.phone}</div>
          )}
        </div>

        <div className="border-t border-dashed border-black my-2" />

        {/* Invoice Info */}
        <div className="space-y-0.5 mb-2">
          <div className="flex justify-between">
            <span>RECEIPT:</span>
            <span className="font-bold">{invoice.invoiceNumber.split('-').pop()}</span>
          </div>
          <div className="flex justify-between">
            <span>DATE:</span>
            <span>{format(new Date(invoice.date), 'dd/MM/yy HH:mm')}</span>
          </div>
          <div className="flex justify-between">
            <span>CLIENT:</span>
            <span className="truncate max-w-[100px]">{invoice.clientName}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-2" />

        {/* Table Header */}
        <div className="flex font-bold mb-1">
          <span className="flex-1">ITEM</span>
          <span className="w-8 text-center">QTY</span>
          <span className="w-16 text-right">TOTAL</span>
        </div>

        {/* Items */}
        <div className="space-y-1 mb-2">
          {invoice.items.map((item, idx) => (
            <div key={idx}>
              <div className="flex justify-between">
                <span className="flex-1 uppercase truncate pr-1">{item.name}</span>
              </div>
              <div className="flex justify-between opacity-80 text-[10px]">
                <span>{item.quantity} x {item.price}</span>
                <span className="font-bold">₹{item.total.toFixed(0)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-black my-2" />

        {/* Totals */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span>₹{invoice.subtotal.toFixed(2)}</span>
          </div>
          {invoice.totalCgst > 0 && (
            <div className="flex justify-between text-[10px]">
              <span>CGST:</span>
              <span>₹{invoice.totalCgst.toFixed(2)}</span>
            </div>
          )}
          {invoice.totalSgst > 0 && (
            <div className="flex justify-between text-[10px]">
              <span>SGST:</span>
              <span>₹{invoice.totalSgst.toFixed(2)}</span>
            </div>
          )}
          {invoice.totalIgst > 0 && (
            <div className="flex justify-between text-[10px]">
              <span>IGST:</span>
              <span>₹{invoice.totalIgst.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-black pt-1">
            <span>TOTAL:</span>
            <span>₹{invoice.totalAmount.toFixed(0)}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-4" />

        {/* Footer */}
        <div className="text-center space-y-1 mb-8">
          <div className="font-bold uppercase">Thank You!</div>
          <div className="text-[8px] italic opacity-60">
            {invoice.createdBy ? `Operator: ${invoice.createdBy.name}` : 'Visit Again'}
          </div>
          {settings.upiId && (
            <div className="pt-2 text-[8px] opacity-60">UPI: {settings.upiId}</div>
          )}
        </div>

        {/* Cut line helper */}
        <div className="text-center text-[8px] opacity-20 select-none">
          - - - - - - - - - - - - - - - - - - - - - - - 
        </div>
      </div>
    );
  }
);

ThermalReceipt.displayName = 'ThermalReceipt';
