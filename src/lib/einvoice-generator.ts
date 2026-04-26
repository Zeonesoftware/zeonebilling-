import { Invoice, BusinessSettings } from '../types';

/**
 * Generates the JSON format required for E-Invoice Portal (Schema v1.1)
 */
export function generateEInvoiceJSON(invoice: Invoice, settings: BusinessSettings) {
  // Map GST rates to standard codes if needed, but usually it's just the number
  
  const json = {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: "B2B", // Default to B2B, can be SEZWP, SEZWOP, EXPWP, EXPWOP, DXP
      RegRev: "N",
      EcmGstin: null,
      IgstOnIntra: "N"
    },
    DocDtls: {
      Typ: "INV", // INV for Invoice, CRN for Credit Note, DBN for Debit Note
      No: invoice.invoiceNumber,
      Dt: formatDate(invoice.date)
    },
    SellerDtls: {
      Gstin: settings.gstin,
      LglNm: settings.companyName,
      TrdNm: settings.companyName,
      Addr1: settings.address.substring(0, 100),
      Loc: settings.address.split(',').pop()?.trim() || "City",
      Pin: 0, // Should ideally be part of settings
      Stcd: settings.stateCode.substring(0, 2),
      Ph: settings.phone.replace(/[^0-9]/g, '').substring(0, 12),
      Em: settings.email
    },
    BuyerDtls: {
      Gstin: invoice.clientGstin,
      LglNm: invoice.clientName,
      TrdNm: invoice.clientName,
      Pos: invoice.clientStateCode.substring(0, 2),
      Addr1: invoice.clientAddress.substring(0, 100),
      Loc: invoice.clientAddress.split(',').pop()?.trim() || "City",
      Pin: 0,
      Stcd: invoice.clientStateCode.substring(0, 2)
    },
    ItemList: invoice.items.map((item, index) => ({
      SlNo: (index + 1).toString(),
      PrdDesc: item.name,
      IsServc: "N",
      HsnCd: item.hsn,
      Barcde: null,
      Qty: item.quantity,
      FreeQty: 0,
      Unit: item.name.toLowerCase().includes('service') ? "OTH" : "NOS",
      UnitPrice: item.price,
      TotAmt: item.quantity * item.price,
      Discount: 0,
      PreTaxVal: 0,
      AssAmt: item.quantity * item.price,
      GstRt: item.gstRate,
      IgstAmt: item.igst || 0,
      CgstAmt: item.cgst || 0,
      SgstAmt: item.sgst || 0,
      CesRt: 0,
      CesAmt: 0,
      CesNonAdvlAmt: 0,
      StateCesRt: 0,
      StateCesAmt: 0,
      TotItemVal: item.total
    })),
    ValDtls: {
      AssVal: invoice.subtotal,
      CgstVal: invoice.totalCgst,
      SgstVal: invoice.totalSgst,
      IgstVal: invoice.totalIgst,
      CesVal: 0,
      StCesVal: 0,
      Discount: 0,
      RndOffAmt: 0,
      TotInvVal: invoice.totalAmount,
      TotInvValFc: 0
    }
  };

  return json;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
