import http from 'node:http';
import { URL } from 'node:url';
import type {
  CourierCarrier,
  ShipmentStatus,
  ShipmentRecord,
  CapturedCourierWebhook,
  InjectedError,
} from './mock-types';

export class CourierMockServer {
  private server: http.Server | null = null;
  public capturedShipments: Map<string, ShipmentRecord> = new Map();
  public capturedWebhooks: CapturedCourierWebhook[] = [];
  public injectedErrors: Map<string, InjectedError> = new Map();
  public port: number;

  constructor(port = 4040) {
    this.port = port;
  }

  public generateTrackingNumber(carrier: CourierCarrier): string {
    switch (carrier) {
      case 'KERRY': {
        const digits = Math.floor(100000000 + Math.random() * 900000000);
        return `KEX${digits}TH`;
      }
      case 'FLASH': {
        const digits = Math.floor(100000000000 + Math.random() * 900000000000);
        return `TH${digits}`;
      }
      case 'CENTRAL_EXPRESS': {
        const digits = Math.floor(10000000 + Math.random() * 90000000);
        return `CTX${digits}TH`;
      }
      default:
        throw new Error(`Unsupported carrier: ${carrier}`);
    }
  }

  public async simulateMilestones(params: {
    trackingNumber: string;
    carrier?: CourierCarrier;
    milestones?: ShipmentStatus[];
    crmWebhookUrl?: string;
    signature?: string;
    orderId?: string;
    orderNumber?: string;
    delayMs?: number;
  }): Promise<CapturedCourierWebhook[]> {
    const {
      trackingNumber,
      carrier = 'KERRY',
      milestones = ['PACKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'],
      crmWebhookUrl = 'http://127.0.0.1:3001/api/shipping/tracking/webhook',
      signature = 'sha256=mock-courier-valid-signature',
      orderId,
      orderNumber,
      delayMs = 0,
    } = params;

    const results: CapturedCourierWebhook[] = [];

    for (const status of milestones) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const nowIso = new Date().toISOString();
      const shipment = this.capturedShipments.get(trackingNumber);
      const effectiveCarrier = shipment ? shipment.carrier : carrier;
      const desc = status === 'DELIVERED'
        ? 'Delivery completed with recipient signature'
        : `Carrier status update: ${status}`;

      if (shipment) {
        shipment.status = status;
        shipment.updatedAt = nowIso;
        shipment.events.push({
          status,
          location: shipment.sortingCode || 'Bangkok Hub',
          notes: desc,
          timestamp: nowIso,
        });
      }

      const webhookPayload = {
        trackingNumber,
        carrier: effectiveCarrier,
        status,
        statusCode: status.substring(0, 3),
        location: 'Bangkok Central Sorting Facility',
        description: desc,
        notes: desc,
        timestamp: nowIso,
        orderId: orderId || shipment?.orderNumber || orderNumber || `ord_${Date.now()}`,
        orderNumber: orderNumber || shipment?.orderNumber || orderId,
        estimatedDelivery: new Date(Date.now() + 86400000).toISOString(),
      };

      try {
        const crmRes = await fetch(crmWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Courier-Signature': signature,
            'X-Carrier-Code': effectiveCarrier,
          },
          body: JSON.stringify(webhookPayload),
        });

        let responseData: any = null;
        try {
          responseData = await crmRes.json();
        } catch {
          responseData = await crmRes.text();
        }

        const capturedRecord: CapturedCourierWebhook = {
          trackingNumber,
          carrier: effectiveCarrier,
          status,
          statusCode: webhookPayload.statusCode,
          location: webhookPayload.location,
          notes: webhookPayload.notes,
          description: webhookPayload.description,
          orderId: webhookPayload.orderId,
          estimatedDelivery: webhookPayload.estimatedDelivery,
          timestamp: nowIso,
          crmWebhookUrl,
          crmStatus: crmRes.status,
          crmResponse: responseData,
          dispatchedAt: nowIso,
        };
        this.capturedWebhooks.push(capturedRecord);
        results.push(capturedRecord);
      } catch (err: any) {
        const failedRecord: CapturedCourierWebhook = {
          trackingNumber,
          carrier: effectiveCarrier,
          status,
          statusCode: 'ERR',
          location: 'Network error',
          notes: err.message,
          description: err.message,
          orderId: webhookPayload.orderId,
          estimatedDelivery: null,
          timestamp: nowIso,
          crmWebhookUrl,
          crmStatus: 502,
          crmResponse: { error: err.message },
          dispatchedAt: nowIso,
        };
        this.capturedWebhooks.push(failedRecord);
        results.push(failedRecord);
      }
    }

    return results;
  }

  private resolveSortingCode(postalCode: string): string {
    if (!postalCode) return 'BKK-HUB-01';
    const prefix = postalCode.substring(0, 2);
    switch (prefix) {
      case '10':
        return 'BKK-PTW-01'; // Pathumwan / Chidlom
      case '11':
        return 'NON-PKK-02'; // Nonthaburi
      case '12':
        return 'PTE-RSG-03'; // Pathum Thani
      case '13':
        return 'AYA-AYT-04'; // Ayutthaya
      case '50':
        return 'CNX-MEP-01'; // Chiang Mai
      case '83':
        return 'HKT-PKT-01'; // Phuket
      case '20':
        return 'CBI-PAT-01'; // Chonburi / Pattaya
      default:
        return `HUB-${postalCode.substring(0, 3)}-01`;
    }
  }

  public renderThermalLabelHtml(shipment: ShipmentRecord): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Shipping Label - ${shipment.trackingNumber}</title>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    @media print {
      body { margin: 0; -webkit-print-color-adjust: exact; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 6mm;
      box-sizing: border-box;
      width: 100mm;
      height: 150mm;
      color: #000;
      background: #fff;
    }
    .label-container {
      border: 2px solid #000;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 4mm;
    }
    .header-carrier {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 3mm;
    }
    .carrier-badge {
      font-size: 16pt;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .sorting-code {
      font-size: 16pt;
      font-weight: 900;
      border: 2px solid #000;
      padding: 1mm 3mm;
      background: #eee;
    }
    .barcode-section {
      text-align: center;
      padding: 3mm 0;
      border-bottom: 2px solid #000;
    }
    .barcode-bars {
      font-family: monospace;
      font-size: 26pt;
      letter-spacing: 4px;
      font-weight: bold;
      user-select: none;
    }
    .tracking-text {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 1mm;
      letter-spacing: 1.5px;
    }
    .address-section {
      padding: 3mm 0;
      border-bottom: 1px dashed #000;
      flex-grow: 1;
    }
    .section-title {
      font-size: 8pt;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 1mm;
    }
    .recipient-name {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 1mm;
    }
    .recipient-phone {
      font-size: 11pt;
      font-weight: bold;
    }
    .recipient-addr {
      font-size: 9.5pt;
      line-height: 1.25;
      margin-top: 1mm;
    }
    .sender-section {
      padding: 2mm 0;
      font-size: 8pt;
      border-bottom: 1px solid #000;
    }
    .footer-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 2mm;
      font-size: 8pt;
    }
    .badge-service {
      background: #000;
      color: #fff;
      padding: 1mm 2mm;
      font-weight: bold;
      font-size: 8pt;
    }
  </style>
</head>
<body>
  <div class="label-container" data-tracking="${shipment.trackingNumber}" data-format="thermal_4x6">
    <div class="header-carrier">
      <div class="carrier-badge">[${shipment.carrier}]</div>
      <div class="sorting-code">${shipment.sortingCode}</div>
    </div>

    <div class="barcode-section">
      <div class="barcode-bars">||| | | |||| || | ||| ||</div>
      <div class="tracking-text">${shipment.trackingNumber}</div>
    </div>

    <div class="address-section">
      <div class="section-title">SHIP TO / ผู้รับ</div>
      <div class="recipient-name">${shipment.recipient.name}</div>
      <div class="recipient-phone">Tel: ${shipment.recipient.phone}</div>
      <div class="recipient-addr">
        ${shipment.recipient.address}<br>
        ${shipment.recipient.subdistrict ? shipment.recipient.subdistrict + ', ' : ''}
        ${shipment.recipient.district ? shipment.recipient.district + ', ' : ''}
        ${shipment.recipient.province ? shipment.recipient.province + ' ' : ''}
        <strong>${shipment.recipient.postalCode}</strong>
      </div>
    </div>

    <div class="sender-section">
      <div class="section-title">SHIP FROM / ผู้ส่ง</div>
      <div><strong>${shipment.sender.name}</strong> (${shipment.sender.phone})</div>
      <div>${shipment.sender.address}</div>
    </div>

    <div class="footer-section">
      <div>Order: <strong>${shipment.orderNumber}</strong></div>
      <div class="badge-service">${shipment.serviceType}</div>
      <div>Weight: <strong>${shipment.parcel.weightKg.toFixed(2)} kg</strong></div>
    </div>
  </div>
</body>
</html>`;
  }

  public renderA4ManifestHtml(shipment: ShipmentRecord): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>A4 Shipping Manifest - ${shipment.trackingNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    @media print {
      body { margin: 0; }
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      color: #333;
      margin: 0;
      padding: 10mm;
    }
    .manifest-header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #b91c1c;
      padding-bottom: 5mm;
      margin-bottom: 5mm;
    }
    .company-title {
      font-size: 18pt;
      font-weight: bold;
      color: #b91c1c;
    }
    .manifest-title {
      font-size: 14pt;
      font-weight: bold;
      text-align: right;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5mm;
      margin-bottom: 5mm;
      border: 1px solid #ddd;
      padding: 4mm;
      border-radius: 4px;
    }
    .box-title {
      font-weight: bold;
      border-bottom: 1px solid #ccc;
      padding-bottom: 1mm;
      margin-bottom: 2mm;
      color: #111;
    }
    .barcode-box {
      text-align: center;
      margin: 6mm 0;
      padding: 4mm;
      background: #f9f9f9;
      border: 1px solid #eee;
    }
    .barcode-code {
      font-family: monospace;
      font-size: 24pt;
      font-weight: bold;
      letter-spacing: 3px;
    }
    .signature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10mm;
      margin-top: 15mm;
      padding-top: 5mm;
    }
    .signature-line {
      border-top: 1px solid #000;
      margin-top: 20mm;
      text-align: center;
      padding-top: 2mm;
      font-size: 9pt;
    }
  </style>
</head>
<body>
  <div class="manifest-header">
    <div>
      <div class="company-title">CENTRAL DEPARTMENT STORE</div>
      <div>Central Retail Corporation - Omnichannel Fulfillment</div>
    </div>
    <div>
      <div class="manifest-title">SHIPPING WAYBILL & PACKING MANIFEST</div>
      <div>Date: ${new Date(shipment.createdAt).toLocaleDateString()}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div>
      <div class="box-title">SENDER (ผู้ส่ง)</div>
      <div><strong>${shipment.sender.name}</strong></div>
      <div>${shipment.sender.address}</div>
      <div>Phone: ${shipment.sender.phone}</div>
    </div>
    <div>
      <div class="box-title">RECIPIENT (ผู้รับ)</div>
      <div><strong>${shipment.recipient.name}</strong></div>
      <div>${shipment.recipient.address}</div>
      <div>${shipment.recipient.province || ''} ${shipment.recipient.postalCode}</div>
      <div>Phone: ${shipment.recipient.phone}</div>
    </div>
  </div>

  <div class="barcode-box">
    <div>Carrier: <strong>${shipment.carrier}</strong> | Sorting Hub: <strong>${shipment.sortingCode}</strong></div>
    <div class="barcode-code">|||| | | ||| |||| | ||| ||</div>
    <div>Tracking Number: <strong>${shipment.trackingNumber}</strong></div>
    <div>Order Reference: <strong>${shipment.orderNumber}</strong> | Weight: <strong>${shipment.parcel.weightKg.toFixed(2)} kg</strong></div>
  </div>

  <div class="signature-grid">
    <div>
      <div class="signature-line">Carrier Driver Signature / Signature du Chauffeur</div>
    </div>
    <div>
      <div class="signature-line">Recipient Signature / Signature du Destinataire</div>
    </div>
  </div>
</body>
</html>`;
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
        const path = url.pathname;
        const method = req.method;

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Carrier-Code, X-Courier-Signature');

        if (method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // Parse JSON body
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }
        let data: any = {};
        if (body) {
          try {
            data = JSON.parse(body);
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
            return;
          }
        }

        // Injected error check
        if (this.injectedErrors.has(path)) {
          const err = this.injectedErrors.get(path)!;
          if (err.count > 0) {
            err.count--;
            res.writeHead(err.statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Injected mock error ${err.statusCode}`, path }));
            return;
          }
        }

        // 1. Health check
        if (path === '/health' || path === '/mock/courier/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'healthy', service: 'mock-courier', port: this.port }));
          return;
        }

        // 2. Reset control endpoint
        if ((path === '/mock/courier/control/reset' || path === '/mock/courier/v1/control/reset') && (method === 'DELETE' || method === 'POST')) {
          this.capturedShipments.clear();
          this.capturedWebhooks = [];
          this.injectedErrors.clear();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reset: true, timestamp: new Date().toISOString() }));
          return;
        }

        // 3. Inject error control endpoint
        if (path === '/mock/courier/control/inject-error' && method === 'POST') {
          const { endpoint, statusCode = 500, count = 1 } = data;
          this.injectedErrors.set(endpoint, { statusCode, count });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ configured: true, endpoint, statusCode, count }));
          return;
        }

        // 4. Create Shipment & Generate Tracking (POST /mock/courier/v1/shipments/create)
        if (path === '/mock/courier/v1/shipments/create' && method === 'POST') {
          const carrier = (data.carrier || '').toUpperCase() as CourierCarrier;
          if (!['KERRY', 'FLASH', 'CENTRAL_EXPRESS'].includes(carrier)) {
            res.writeHead(422, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: `Invalid carrier code: '${data.carrier}'. Supported carriers: KERRY, FLASH, CENTRAL_EXPRESS`,
              code: 'INVALID_CARRIER'
            }));
            return;
          }

          if (!data.orderNumber) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'orderNumber is required', code: 'MISSING_ORDER_NUMBER' }));
            return;
          }

          if (!data.recipient || !data.recipient.name || !data.recipient.phone || !data.recipient.address || !data.recipient.postalCode) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: 'Recipient name, phone, address, and postalCode are required',
              code: 'INCOMPLETE_RECIPIENT_ADDRESS'
            }));
            return;
          }

          const weightKg = Number(data.parcel?.weightKg ?? 1.0);
          if (isNaN(weightKg) || weightKg <= 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Parcel weightKg must be greater than 0', code: 'INVALID_WEIGHT' }));
            return;
          }

          const trackingNumber = data.customTrackingNumber || this.generateTrackingNumber(carrier);
          const sortingCode = this.resolveSortingCode(data.recipient.postalCode);
          const nowIso = new Date().toISOString();

          const shipment: ShipmentRecord = {
            trackingNumber,
            carrier,
            orderNumber: data.orderNumber,
            quotationId: data.quotationId,
            caseId: data.caseId,
            status: 'MANIFEST_CREATED',
            sortingCode,
            serviceType: data.serviceType || (carrier === 'CENTRAL_EXPRESS' ? 'SAME_DAY_3HR' : 'STANDARD_EXPRESS'),
            recipient: {
              name: data.recipient.name,
              phone: data.recipient.phone,
              address: data.recipient.address,
              subdistrict: data.recipient.subdistrict,
              district: data.recipient.district,
              province: data.recipient.province || 'Bangkok',
              postalCode: data.recipient.postalCode,
            },
            sender: {
              name: data.sender?.name || 'Central Department Store (Chidlom)',
              phone: data.sender?.phone || '02-793-7000',
              address: data.sender?.address || '1027 Ploenchit Rd, Lumpini, Pathumwan, Bangkok 10330',
            },
            parcel: {
              weightKg,
              dimensions: data.parcel?.dimensions || { width: 20, length: 30, height: 15 },
              declaredValue: data.parcel?.declaredValue,
              itemsCount: data.parcel?.itemsCount || 1,
            },
            labelUrls: {
              a4: `http://127.0.0.1:${this.port}/mock/courier/v1/labels/${trackingNumber}?format=a4`,
              thermal4x6: `http://127.0.0.1:${this.port}/mock/courier/v1/labels/${trackingNumber}?format=thermal_4x6`,
              json: `http://127.0.0.1:${this.port}/mock/courier/v1/labels/${trackingNumber}/json`,
            },
            events: [
              {
                status: 'MANIFEST_CREATED',
                location: sortingCode,
                notes: 'Shipment manifest generated via CRM fulfillment engine',
                timestamp: nowIso,
              }
            ],
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          this.capturedShipments.set(trackingNumber, shipment);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            carrier,
            trackingNumber,
            orderNumber: shipment.orderNumber,
            status: shipment.status,
            sortingCode,
            serviceType: shipment.serviceType,
            labelUrls: shipment.labelUrls,
            createdAt: shipment.createdAt,
          }));
          return;
        }

        // 5. Printable Label Rendering (GET /mock/courier/v1/labels/:trackingNumber)
        if (path.startsWith('/mock/courier/v1/labels/') && method === 'GET') {
          const subPath = path.replace('/mock/courier/v1/labels/', '');
          const isJson = subPath.endsWith('/json');
          const trackingNumber = isJson ? subPath.replace('/json', '') : subPath;

          const shipment = this.capturedShipments.get(trackingNumber);
          if (!shipment) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Tracking number '${trackingNumber}' not found`, code: 'TRACKING_NOT_FOUND' }));
            return;
          }

          if (isJson) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              trackingNumber: shipment.trackingNumber,
              carrier: shipment.carrier,
              orderNumber: shipment.orderNumber,
              format: 'thermal_4x6',
              dimensions: { widthMm: 100, heightMm: 150 },
              sortingCode: shipment.sortingCode,
              barcodeData: `*${shipment.trackingNumber}*`,
              recipient: {
                name: shipment.recipient.name,
                postalCode: shipment.recipient.postalCode,
                address: shipment.recipient.address,
              },
              weightKg: shipment.parcel.weightKg,
            }));
            return;
          }

          const format = url.searchParams.get('format') || 'a4';
          if (format === 'thermal_4x6') {
            const html = this.renderThermalLabelHtml(shipment);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
          } else {
            const html = this.renderA4ManifestHtml(shipment);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(html);
            return;
          }
        }

        // 6. Tracking Status & History (GET /mock/courier/v1/tracking/:trackingNumber)
        if (path.startsWith('/mock/courier/v1/tracking/') && method === 'GET') {
          const trackingNumber = path.replace('/mock/courier/v1/tracking/', '');
          const shipment = this.capturedShipments.get(trackingNumber);
          if (!shipment) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Tracking number '${trackingNumber}' not found` }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            trackingNumber: shipment.trackingNumber,
            carrier: shipment.carrier,
            orderNumber: shipment.orderNumber,
            status: shipment.status,
            sortingCode: shipment.sortingCode,
            events: shipment.events,
            updatedAt: shipment.updatedAt,
          }));
          return;
        }

        // 7. Hermetic Courier Webhook Simulation (POST /mock/courier/v1/simulate/webhook)
        if (path === '/mock/courier/v1/simulate/webhook' && method === 'POST') {
          const {
            trackingNumber,
            status = 'DELIVERED',
            statusCode = 'DLV',
            location,
            notes,
            description,
            orderId,
            orderNumber,
            estimatedDelivery,
            signature,
          } = data;
          const crmUrl = data.crmWebhookUrl || 'http://127.0.0.1:3001/api/shipping/tracking/webhook';

          const shipment = trackingNumber ? this.capturedShipments.get(trackingNumber) : null;
          const carrier = shipment ? shipment.carrier : (data.carrier || 'KERRY');
          const nowIso = new Date().toISOString();
          const desc = description || notes || (status === 'DELIVERED' ? 'Delivery completed with recipient signature' : `Carrier status update: ${status}`);

          // Update in-memory shipment status
          if (shipment) {
            shipment.status = status as ShipmentStatus;
            shipment.updatedAt = nowIso;
            shipment.events.push({
              status: status as ShipmentStatus,
              location: location || shipment.sortingCode,
              notes: desc,
              timestamp: nowIso,
            });
          }

          const webhookPayload = {
            trackingNumber: trackingNumber || 'KEX_SIM_001',
            carrier,
            status,
            statusCode,
            location: location || 'Bangkok Central Hub',
            description: desc,
            notes: desc,
            timestamp: nowIso,
            orderId: orderId || shipment?.orderNumber || orderNumber,
            orderNumber: orderNumber || shipment?.orderNumber || orderId,
            estimatedDelivery: estimatedDelivery || null,
          };

          const signatureHeader = signature || data['X-Courier-Signature'] || (req.headers['x-courier-signature'] as string) || 'sha256=mock-courier-valid-signature';

          try {
            const crmRes = await fetch(crmUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Courier-Signature': signatureHeader,
                'X-Carrier-Code': carrier,
              },
              body: JSON.stringify(webhookPayload),
            });

            let responseData: any = null;
            try {
              responseData = await crmRes.json();
            } catch {
              responseData = await crmRes.text();
            }

            const capturedRecord: CapturedCourierWebhook = {
              trackingNumber: webhookPayload.trackingNumber,
              carrier,
              status: status as ShipmentStatus,
              statusCode,
              location: webhookPayload.location,
              notes: webhookPayload.notes,
              description: webhookPayload.description,
              orderId: webhookPayload.orderId,
              estimatedDelivery: webhookPayload.estimatedDelivery,
              timestamp: nowIso,
              crmWebhookUrl: crmUrl,
              crmStatus: crmRes.status,
              crmResponse: responseData,
              dispatchedAt: nowIso,
            };
            this.capturedWebhooks.push(capturedRecord);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              trackingNumber: webhookPayload.trackingNumber,
              status,
              crmStatus: crmRes.status,
              crmResponse: responseData,
            }));
          } catch (e: any) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: `Failed to dispatch webhook to CRM: ${e.message}`,
              crmUrl,
            }));
          }
          return;
        }

        // 7b. Sequential Milestone Simulation Generator (POST /mock/courier/v1/simulate/milestones)
        if (path === '/mock/courier/v1/simulate/milestones' && method === 'POST') {
          const {
            trackingNumber,
            carrier = 'KERRY',
            milestones = ['PACKED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'],
            crmWebhookUrl = 'http://127.0.0.1:3001/api/shipping/tracking/webhook',
            signature,
            orderId,
            orderNumber,
            delayMs = 0,
          } = data;

          if (!trackingNumber) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'trackingNumber is required' }));
            return;
          }

          const dispatched = await this.simulateMilestones({
            trackingNumber,
            carrier,
            milestones,
            crmWebhookUrl,
            signature,
            orderId,
            orderNumber,
            delayMs,
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            trackingNumber,
            carrier,
            totalDispatched: dispatched.length,
            dispatchedMilestones: dispatched.map((d) => ({ status: d.status, crmStatus: d.crmStatus })),
          }));
          return;
        }

        // 8. Inspect shipments
        if (path === '/mock/courier/v1/inspect/shipments' && method === 'GET') {
          const carrier = url.searchParams.get('carrier');
          const trackingNumber = url.searchParams.get('trackingNumber');
          const orderNumber = url.searchParams.get('orderNumber');

          let list = Array.from(this.capturedShipments.values());
          if (carrier) list = list.filter(s => s.carrier === carrier.toUpperCase());
          if (trackingNumber) list = list.filter(s => s.trackingNumber === trackingNumber);
          if (orderNumber) list = list.filter(s => s.orderNumber === orderNumber);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ shipments: list, total: list.length }));
          return;
        }

        // 9. Inspect webhooks
        if (path === '/mock/courier/v1/inspect/webhooks' && method === 'GET') {
          const trackingNumber = url.searchParams.get('trackingNumber');
          const status = url.searchParams.get('status');

          let list = this.capturedWebhooks;
          if (trackingNumber) list = list.filter(w => w.trackingNumber === trackingNumber);
          if (status) list = list.filter(w => w.status === status);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ webhooks: list, total: list.length }));
          return;
        }

        // Default 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Not found: ${method} ${path} on Mock Courier Server` }));
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        resolve();
      });
      this.server.on('error', (err) => reject(err));
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// CLI entrypoint
if (process.argv[1]?.endsWith('courier-mock-server.ts') || process.argv[1]?.endsWith('courier-mock-server.js')) {
  const port = parseInt(process.env.COURIER_MOCK_PORT || '4040', 10);
  const server = new CourierMockServer(port);
  server.start().then(() => {
    console.log(`[Mock Courier] Server listening on http://127.0.0.1:${port}`);
  }).catch((err) => {
    console.error(`[Mock Courier] Failed to start:`, err);
    process.exit(1);
  });

  const cleanup = async () => {
    console.log(`[Mock Courier] Shutting down...`);
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
