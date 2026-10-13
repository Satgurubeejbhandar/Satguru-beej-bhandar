// src/components/admin/SalesBillTemplate.tsx

import React from 'react'

export interface BillTemplateItem {
  id?: string
  product_name: string
  batch_number?: string | null
  quantity: number
  rate: number
  total_amount: number
  hsn_code?: string | null
  gst_percent?: number | null
  cgst_amount?: number | null
  sgst_amount?: number | null
  pack_size?: number | null
  pack_unit?: string | null
  company_name?: string | null
}

export interface BillTemplateData {
  bill_number: string
  bill_date: string
  total_amount: number
  is_gst_bill: boolean
  bill_type?: string
  farmer?: {
    farmer_name?: string | null
    farmer_id?: string | null
    father_name?: string | null
    village?: string | null
    mobile?: string | null
  } | null
  items: BillTemplateItem[]
  warning_message?: string
}

// --- UTILITY FUNCTIONS & CONSTANTS ---
const BUSINESS = {
  name: 'SATGURU BEEJ BHANDAR',
  mobile1: '7414085050',
  mobile2: '7988950257',
  gstin: '08KFBK9580K1Z0',
  stateCode: '08 — Rajasthan',
  firmLicense: '1072',
  seedLicense: '31692',
  fertilizerLicense: '2784',
  bankName: 'State Bank of India, Bhanipura',
  accountNo: '42713336643',
  ifsc: 'SBIN0032255',
}

const formatAmount = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

const amountInWords = (amount: number): string => {
  const number = Math.floor(Number(amount || 0))
  if (number === 0) return 'Zero Rupees Only'

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ]
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const twoDigit = (n: number): string => {
    if (n < 20) return ones[n]
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`
  }

  const convert = (n: number): string => {
    if (n < 100) return twoDigit(n)
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${convert(n % 100)}` : ''}`
    if (n < 100000) return `${convert(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${convert(n % 1000)}` : ''}`
    if (n < 10000000) return `${convert(Math.floor(n / 100000))} Lakh${n % 100000 ? ` ${convert(n % 100000)}` : ''}`
    return `${convert(Math.floor(n / 10000000))} Crore${n % 10000000 ? ` ${convert(n % 10000000)}` : ''}`
  }

  return `${convert(number)} Rupees Only`
}

export const SalesBillTemplate: React.FC<{
  bill: BillTemplateData
  containerId?: string
}> = ({ bill, containerId = 'printable-bill-area' }) => {
  
  // Data Extraction Logic
  const rawBillNumber = String(bill.bill_number || '')
  const baseNumber = rawBillNumber.replace(/^(SALES|BILL|GST|EST)-/, '')
  const displayBillNo = bill.is_gst_bill ? `GST-${baseNumber}` : `EST-${baseNumber}`
  
  const rawDate = bill.bill_date ? bill.bill_date.split('T')[0] : new Date().toISOString().split('T')[0]
  const dateParts = rawDate.split('-')
  const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : rawDate

  const fullAddress = [bill.farmer?.village, bill.farmer?.mobile ? `Mob: ${bill.farmer.mobile}` : '']
    .filter(Boolean)
    .join(', ')

  // Calculate Table Rows (Reduced blank rows to fit exactly on 1 page)
  const EST_ROWS = 12 // Changed from 14 to 12
  const GST_ROWS = 7  // Changed from 9 to 7 to stop 2nd page break
  const tableRowsEst = Math.max(EST_ROWS, bill.items.length)
  const tableRowsGst = Math.max(GST_ROWS, bill.items.length)

  return (
    <div id={containerId} className="print-container" style={{ margin: 0, padding: 0, width: '100%' }}>
      
      <style>{`
        @media print {
          html, body { 
            margin: 0 !important; 
            padding: 0 !important; 
            background: #ffffff !important; 
            color: #000000 !important;
          }
          * { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            color: #000000 !important;
            border-color: #000000 !important;
          }
          .print-container {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* ======================================================= */}
      {/* 1. ESTIMATE BILL — A5 PORTRAIT                          */}
      {/* ======================================================= */}
      {!bill.is_gst_bill && (
        <div
          className="estimate-bill"
          style={{
           width: '100%',
           maxWidth: '560px', // Exact width for A5 Portrait
            margin: '0 auto',
            padding: '20px', // Reduced from 30px to prevent overflow
            background: '#ffffff',
            color: '#000000',
            fontFamily: 'Arial, Helvetica, sans-serif',
            boxSizing: 'border-box',
            boxShadow: '0 0 10px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}
        >
          {bill.warning_message && (
            <div style={{ color: '#000', fontSize: '11px', textAlign: 'center', marginBottom: '6px', fontWeight: 800 }}>
              {bill.warning_message}
            </div>
          )}

          {/* HEADER */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '6px' }}>
            <div style={{ textAlign: 'left', fontSize: '14px', fontWeight: 800, color: '#000' }}>Prof. Rajpal</div>
            <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 900, color: '#000' }}>Estimate</div>
            <div style={{ textAlign: 'right', fontSize: '11px', lineHeight: 1.4, fontWeight: 700, color: '#000' }}>
              <div>Mob. {BUSINESS.mobile1}</div>
              <div>Mob. {BUSINESS.mobile2}</div>
            </div>
          </div>

          {/* CUSTOMER DETAILS */}
          <div style={{ marginTop: '10px', marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#000' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr 40px 90px', gap: '4px', alignItems: 'end', marginBottom: '6px' }}>
              <strong>Est. No.</strong>
              <div style={{ borderBottom: '1.5px dotted #000', minHeight: '16px', paddingLeft: '4px' }}>{displayBillNo}</div>
              <strong>Date</strong>
              <div style={{ borderBottom: '1.5px dotted #000', minHeight: '16px', paddingLeft: '4px' }}>{formattedDate}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '4px', alignItems: 'end', marginBottom: '6px' }}>
              <strong>Mr./Mrs.</strong>
              <div style={{ borderBottom: '1.5px dotted #000', minHeight: '16px', paddingLeft: '4px' }}>{bill.farmer?.farmer_name || ''}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '4px', alignItems: 'end' }}>
              <strong>Address</strong>
              <div style={{ borderBottom: '1.5px dotted #000', minHeight: '16px', paddingLeft: '4px' }}>{fullAddress}</div>
            </div>
          </div>

          {/* ITEMS TABLE */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '11px', color: '#000' }}>
            <thead>
              <tr>
                <th style={{ width: '8%', border: '1.5px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 800 }}>S.N.</th>
                <th style={{ width: '42%', border: '1.5px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 800 }}>Description</th>
                <th style={{ width: '15%', border: '1.5px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 800 }}>Size</th>
                <th style={{ width: '10%', border: '1.5px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 800 }}>Qty.</th>
                <th style={{ width: '11%', border: '1.5px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 800 }}>Rate</th>
                <th style={{ width: '14%', border: '1.5px solid #000', padding: '5px 3px', textAlign: 'center', fontWeight: 800 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: tableRowsEst }).map((_, index) => {
                const item = bill.items[index]
                const packing = item?.pack_size ? `${item.pack_size} ${item.pack_unit || ''}` : ''
                
                return (
                  <tr key={item?.id ?? `row-${index}`}>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', textAlign: 'center', padding: '3px', height: '20px', verticalAlign: 'top', fontWeight: 700 }}>
                      {item ? index + 1 : ''}
                    </td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', textAlign: 'left', padding: '3px', verticalAlign: 'top', fontWeight: 700, wordWrap: 'break-word' }}>
                      {item?.product_name ?? ''}
                    </td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', textAlign: 'center', padding: '3px', verticalAlign: 'top', fontWeight: 700 }}>
                      {packing}
                    </td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', textAlign: 'center', padding: '3px', verticalAlign: 'top', fontWeight: 700 }}>
                      {item?.quantity ?? ''}
                    </td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', textAlign: 'right', padding: '3px', verticalAlign: 'top', fontWeight: 700 }}>
                      {item?.rate !== undefined ? formatAmount(Number(item.rate)) : ''}
                    </td>
                    <td style={{ borderLeft: '1.5px solid #000', borderRight: '1.5px solid #000', textAlign: 'right', padding: '3px', verticalAlign: 'top', fontWeight: 800 }}>
                      {item?.total_amount !== undefined ? formatAmount(Number(item.total_amount)) : ''}
                    </td>
                  </tr>
                )
              })}

              {/* TOTAL ROW */}
              <tr>
                <td colSpan={4} style={{ borderTop: '1.5px solid #000', borderLeft: '1.5px solid #000', borderBottom: '1.5px solid #000', height: '24px' }} />
                <td style={{ border: '1.5px solid #000', textAlign: 'center', fontWeight: 800, padding: '4px' }}>Total</td>
                <td style={{ border: '1.5px solid #000', textAlign: 'right', fontWeight: 900, padding: '4px' }}>
                  ₹ {formatAmount(bill.total_amount)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* FOOTER SIGNATURES */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '30px', fontSize: '11px', fontWeight: 700, color: '#000' }}>
            <div style={{ width: '130px', textAlign: 'center' }}>
              <div style={{ borderTop: '1.5px solid #000', paddingTop: '4px' }}>Customer's Signature</div>
            </div>
            <div style={{ width: '130px', textAlign: 'center' }}>
              <div style={{ borderTop: '1.5px solid #000', paddingTop: '4px' }}>Seller's Signature</div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 2. GST BILL — A5 LANDSCAPE                              */}
      {/* ======================================================= */}
      {bill.is_gst_bill && (
        <div
          className="gst-bill"
          style={{
            width: '100%',
            maxWidth: '794px', // Maximum width for A5 Landscape
            margin: '0 auto',
            background: '#ffffff',
            border: '1.5px solid #000',
            padding: '12px 16px', // Reduced padding prevents the page split
            position: 'relative',
            fontFamily: 'Arial, Helvetica, sans-serif',
            color: '#000000',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <style>{`
            .top-header { display: grid; grid-template-columns: 1fr 1.2fr 1fr; align-items: start; gap: 4px; padding-bottom: 2px; border-bottom: 1.5px solid #000; margin-bottom: 3px; }
            .contact-block { font-size: 10px; line-height: 1.3; font-weight: 700; color: #000; }
            .contact-block.right { text-align: right; }
            .bill-title { text-align: center; color: #000; }
            .bill-title .memo { font-size: 12px; font-weight: 900; letter-spacing: 0.5px; }
            .bill-title .supply { font-size: 10px; font-weight: 700; }
            
            .business-name { text-align: center; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; margin: 2px 0; text-transform: uppercase; color: #000; }
            .business-description { text-align: center; font-size: 9px; font-weight: 700; color: #000; margin-bottom: 2px;}
            
            .license-heading { text-align: center; font-size: 10px; font-weight: 900; margin: 2px 0; color: #000; }
            .license-box { display: grid; grid-template-columns: 1fr 1fr; border: 1.5px solid #000; margin-bottom: 4px; }
            .license-column { padding: 2px 6px; }
            .license-column + .license-column { border-left: 1.5px solid #000; }
            .license-row { display: grid; grid-template-columns: 130px 1fr; font-size: 9px; line-height: 1.4; color: #000; }
            .license-label { font-weight: 800; }
            
            .customer-box { border: 1.5px solid #000; display: grid; grid-template-columns: 1fr 150px; align-items: center; margin-bottom: 4px; }
            .customer-field { padding: 3px 6px; font-size: 10px; font-weight: 700; color: #000; }
            .customer-field + .customer-field { border-left: 1.5px solid #000; }
            
            .product-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; color: #000; }
            .product-table th { border: 1.5px solid #000; padding: 4px 2px; text-align: center; font-weight: 900; background: #ffffff; }
            
            .product-table td { 
              border-left: 1.5px solid #000; 
              border-right: 1.5px solid #000; 
              border-top: none; 
              border-bottom: none; 
              padding: 3px 4px; 
              height: 18px; /* Tighter rows */
              vertical-align: top; 
              font-weight: 700;
              word-wrap: break-word;
            }
            .product-table .blank-row td { height: 18px; }
            
            .product-table .description { width: 23%; }
            .product-table .hsn { width: 10%; text-align: center;}
            .product-table .company { width: 13%; }
            .product-table .batch { width: 13%; text-align: center;}
            .product-table .qty { width: 8%; text-align: center; }
            .product-table .packing { width: 9%; text-align: center; }
            .product-table .rate { width: 9%; text-align: right; }
            .product-table .amount { width: 15%; text-align: right; }
            
            .bottom-section { display: grid; grid-template-columns: 1fr 150px; border-left: 1.5px solid #000; border-right: 1.5px solid #000; border-bottom: 1.5px solid #000; border-top: 1.5px solid #000; }
            .bank-details { padding: 4px 6px; font-size: 9px; line-height: 1.4; font-weight: 700; color: #000; }
            .bank-title { font-weight: 900; }
            
            .total-box { border-left: 1.5px solid #000; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 3px; font-weight: 900; font-size: 11px; color: #000; }
            .total-value { font-size: 13px; }
            
            .amount-words { border: 1.5px solid #000; border-top: 0; padding: 4px 6px; font-size: 10px; font-weight: 800; color: #000; }
            .notes { border: 1.5px solid #000; border-top: 0; padding: 4px 6px; font-size: 8px; line-height: 1.3; color: #000; font-weight: 700; }
            .notes-title { font-weight: 900; font-size: 9px; margin-bottom: 1px; }
            .declaration { margin-top: 2px; font-weight: 800; }
            
            .signature-row { display: grid; grid-template-columns: 1fr 1fr; margin-top: 6px; align-items: end; }
            .signature { font-size: 10px; font-weight: 900; color: #000; }
            .signature.right { text-align: right; }
          `}</style>

          {bill.warning_message && (
            <div style={{ color: '#000', fontSize: '10px', textAlign: 'center', marginBottom: '2px', fontWeight: 900 }}>
              {bill.warning_message}
            </div>
          )}

          {/* HEADER */}
          <div className="top-header">
            <div className="contact-block">
              <div>Mobile : {BUSINESS.mobile1}</div>
              <div>Mobile : {BUSINESS.mobile2}</div>
            </div>
            <div className="bill-title">
              <div className="memo">CASH/CREDIT MEMO</div>
              <div className="supply">BILL OF SUPPLY</div>
              <div style={{ marginTop: 1, fontSize: 10, fontWeight: 900 }}>
                Bill No.: {displayBillNo}
              </div>
            </div>
            <div className="contact-block right">
              <div>GSTIN : {BUSINESS.gstin}</div>
              <div>State Code : {BUSINESS.stateCode}</div>
            </div>
          </div>

          {/* BUSINESS NAME */}
          <div className="business-name">{BUSINESS.name}</div>
          <div className="business-description">
            We deal in all types of Certified Seeds, Fertilizers, Plant Nutrients and Crop Protection Products. Wholesale &amp; Retail Dealer
          </div>

          <div className="license-heading">SHOP REGISTRATION / LICENSE DETAILS</div>

          {/* LICENSE DETAILS */}
          <div className="license-box">
            <div className="license-column">
              <div className="license-row"><span className="license-label">GSTIN</span><span>{BUSINESS.gstin}</span></div>
              <div className="license-row"><span className="license-label">State Code</span><span>{BUSINESS.stateCode}</span></div>
            </div>
            <div className="license-column">
              <div className="license-row"><span className="license-label">Firm License No.</span><span>{BUSINESS.firmLicense}</span></div>
              <div className="license-row"><span className="license-label">Seed License No.</span><span>{BUSINESS.seedLicense}</span></div>
              <div className="license-row"><span className="license-label">Fertilizer License No.</span><span>{BUSINESS.fertilizerLicense}</span></div>
            </div>
          </div>

          {/* CUSTOMER */}
          <div className="customer-box">
            <div className="customer-field">
              <span className="field-label">Customer Name: </span>
              <span>{bill.farmer?.farmer_name || ''} {bill.farmer?.village ? `(${bill.farmer.village})` : ''}</span>
            </div>
            <div className="customer-field">
              <span className="field-label">Date: </span>
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* PRODUCT TABLE */}
          <table className="product-table">
            <thead>
              <tr>
                <th className="description">Description</th>
                <th className="hsn">HSN Code</th>
                <th className="company">Company</th>
                <th className="batch">Batch / Lot</th>
                <th className="qty">Qty.</th>
                <th className="packing">Packing</th>
                <th className="rate">Rate (₹)</th>
                <th className="amount">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: tableRowsGst }).map((_, index) => {
                const item = bill.items[index]
                const packing = item?.pack_size ? `${item.pack_size} ${item.pack_unit || ''}` : ''
                
                return (
                  <tr key={item?.id || `gst-row-${index}`} className={!item ? "blank-row" : ""}>
                    <td>{item?.product_name || ''}</td>
                    <td style={{ textAlign: 'center' }}>{item?.hsn_code || ''}</td>
                    <td>{item?.company_name || ''}</td>
                    <td style={{ textAlign: 'center' }}>{item?.batch_number || ''}</td>
                    <td style={{ textAlign: 'center' }}>{item?.quantity || ''}</td>
                    <td style={{ textAlign: 'center' }}>{packing}</td>
                    <td style={{ textAlign: 'right' }}>{item?.rate !== undefined ? formatAmount(item.rate) : ''}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900 }}>{item?.total_amount !== undefined ? formatAmount(item.total_amount) : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* BANK + TOTAL */}
          <div className="bottom-section">
            <div className="bank-details">
              <div><span className="bank-title">Bank Name:</span> {BUSINESS.bankName}</div>
              <div><span className="bank-title">A/c No.:</span> {BUSINESS.accountNo}</div>
              <div><span className="bank-title">IFSC:</span> {BUSINESS.ifsc}</div>
            </div>
            <div className="total-box">
              <span>Total Amount</span>
              <span className="total-value">₹ {formatAmount(bill.total_amount)}</span>
            </div>
          </div>

          {/* AMOUNT IN WORDS */}
          <div className="amount-words">
            Amount in Words: {amountInWords(bill.total_amount)}
          </div>

          {/* TERMS */}
          <div className="notes">
            <div className="notes-title">TERMS &amp; CONDITIONS / NOTE:</div>
            <div>1. All disputes shall be subject to jurisdiction at Sardarshahar. 2. Goods once sold will not be taken back. 3. Payment of the bill shall be made immediately. 4. Otherwise, interest shall be charged at ₹2 per ₹100 per month from the due date.</div>
            <div className="declaration">
              I have purchased the above-mentioned medicines, fertilizers and seeds for application on the crop at my own responsibility. I have completely checked the seal and expiry/date of the products and found them satisfactory. Therefore, I shall be solely responsible for any good or adverse results arising from their use.
            </div>
            {/* SIGNATURES */}
            <div className="signature-row">
              <div className="signature">Buyer's Signature</div>
              <div className="signature right">Seller: {BUSINESS.name}</div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}