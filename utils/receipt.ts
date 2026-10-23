import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface ReceiptData {
    id: string;
    type: 'DEPOSIT' | 'WITHDRAWAL' | string;
    amount: number;
    memberName: string;
    accountName: string;
    date: string;
    balanceAfter: number;
    agentName?: string;
    reference?: string;
}

const fmt = (n: number) => 
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

export const generateReceiptPDF = async (data: ReceiptData) => {
    const isDeposit = data.type.toUpperCase() === 'DEPOSIT';
    const qrData = `BUKOZO-${data.id}-${data.amount}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <style>
            @page { margin: 0; }
            body { 
                font-family: 'DM Sans', sans-serif; 
                padding: 10px; 
                color: #000; 
                width: 300px; /* Approx 80mm standard POS width */
                margin: 0 auto;
                background: #fff;
                font-size: 11px;
                line-height: 1.3;
            }
            .header { text-align: center; margin-bottom: 10px; }
            .brand-name { font-size: 16px; font-weight: 800; color: #1A6B47; margin-bottom: 2px; text-transform: uppercase; }
            .location { font-size: 11px; font-weight: 700; color: #1A6B47; margin-bottom: 2px; }
            .info { font-size: 8px; color: #1A6B47; margin-bottom: 1px; }

            
            .divider { border-bottom: 1px solid #ddd; margin: 8px 0; }
            
            .metadata-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
            .meta-label { font-weight: 500; color: #333; }
            .meta-value { font-weight: 700; text-align: right; }
            
            .section-title { 
                text-align: center; 
                color: #1A6B47; 
                font-weight: 800; 
                text-transform: uppercase; 
                margin: 15px 0 10px 0; 
                letter-spacing: 2px;
                font-size: 12px;
                border-top: 1px solid #1A6B47;
                border-bottom: 1px solid #1A6B47;
                padding: 4px 0;
            }

            
            .table-header { display: flex; border-bottom: 1px solid #000; padding-bottom: 3px; font-weight: 800; margin-bottom: 5px; }
            .col-id { width: 10%; }
            .col-name { width: 40%; }
            .col-price { width: 25%; text-align: right; }
            .col-qty { width: 10%; text-align: right; }
            .col-total { width: 15%; text-align: right; }
            
            .item-row { display: flex; margin-bottom: 3px; }
            .item-name { font-weight: 700; margin-bottom: 2px; }
            .item-details { display: flex; font-size: 9px; color: #444; }

            .summary-section { margin-top: 15px; border-top: 1px solid #000; padding-top: 5px; }
            .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .summary-label { font-weight: 700; font-size: 10px; }
            .summary-value { font-weight: 700; font-size: 10px; }
            
            .grand-total { font-size: 13px; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
            .balance-row { font-size: 13px; margin-top: 4px; }

            .footer { text-align: center; margin-top: 20px; font-size: 9px; }
            .barcode-container { text-align: center; margin-top: 15px; }
            .barcode-img { height: 40px; width: 180px; }
            .sacco-details { font-size: 7px; color: #666; font-style: italic; margin-top: 5px; }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="brand-name">Bukonzo United Teachers</div>
            <div class="location">Kasese - Uganda</div>
            <div class="info">+256 779021565</div>
            <div class="info">Masikawinfred2004@gmail.com</div>
        </div>

        <div class="divider"></div>

        <div class="metadata-row">
            <span class="meta-label">Invoice No:</span>
            <span class="meta-value">${data.id}</span>
        </div>
        <div class="metadata-row" style="margin-top: 5px; background: #f9f9f9; padding: 5px; border-radius: 4px;">
            <span class="meta-label">CUSTOMER:</span>
            <span class="meta-value" style="font-size: 13px;">${data.memberName.toUpperCase()}</span>
        </div>

        <div class="metadata-row">
            <span class="meta-label">Admin / TELLER:</span>
            <span class="meta-value">${data.agentName || 'BUKOZO-AGENT'}</span>
        </div>
        <div class="metadata-row">
            <span class="meta-label">Date:</span>
            <span class="meta-value">${data.date}</span>
        </div>

        <div class="section-title">Invoice Items</div>

        <div class="table-header">
            <div class="col-name">PRODUCT NAME</div>
        </div>
        
        <div class="item-row" style="flex-direction: column;">
            <div class="item-name">01. ${data.type.toLowerCase()} - ${data.accountName}</div>
            <div class="item-details">
                <div class="col-id">${data.id.slice(-4)}</div>
                <div class="col-price">${fmt(data.amount)}</div>
                <div class="col-qty">1.00</div>
                <div class="col-total">${fmt(data.amount)}</div>
            </div>
        </div>

        <div class="summary-section">
            <div class="summary-row">
                <span class="summary-label">Total:</span>
                <span class="summary-value">${fmt(data.amount)}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Total Tax:</span>
                <span class="summary-value">0.00</span>
            </div>
            <div class="summary-row grand-total">
                <span class="summary-label">GRAND TOTAL:</span>
                <span class="summary-value">${fmt(data.amount)}</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">Tendered:</span>
                <span class="summary-value">${fmt(data.amount)}</span>
            </div>
            <div class="summary-row balance-row" style="background: #1A6B47; color: #fff; padding: 8px 5px; border-radius: 4px; margin-top: 10px;">
                <span class="summary-label">CLOSING BALANCE:</span>
                <span class="summary-value" style="font-size: 15px;">UGX ${fmt(data.balanceAfter)}</span>
            </div>

        </div>

        <div class="footer">
            <div class="metadata-row">
                <span class="meta-label">Sale Type:</span>
                <span class="meta-value">LEDGER</span>
            </div>
            <div class="metadata-row">
                <span class="meta-label">Total Items:</span>
                <span class="meta-value">01</span>
            </div>
            
            <p style="margin: 15px 0 5px 0; font-weight: 700;">Thank You! Come Again!</p>
            <p style="margin: 0; color: #666; font-size: 8px;">Software by Bukonzo SACCO</p>
            
            <div class="barcode-container">
                <img src="https://barcodeapi.org/api/128/${data.id}" class="barcode-img" />
                <div style="font-size: 7px; margin-top: 2px; letter-spacing: 1px;">${data.id}</div>
            </div>

            <div class="sacco-details">
                BUKONZO UNITED TEACHERS' COOPERATIVE SAVINGS AND CREDIT SOCIETY LTD<br/>
                REG NO. 9668/RCS | P. O. Box 142, Kasese
            </div>
        </div>
    </body>
    </html>
    `;

    try {
        const { uri } = await Print.printToFileAsync({ html });
        console.log('PDF generated at:', uri);
        
        if (Platform.OS === 'ios') {
            await Sharing.shareAsync(uri);
        } else {
            // On Android, we might need to rename the file to something more descriptive before sharing
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};
