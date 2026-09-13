import http from 'node:http';
import { URL } from 'node:url';

export type PaymentGatewayType = 'CREDIT_CARD' | 'PROMPTPAY' | 'BANK_TRANSFER';
export type PaymentBusinessUnit = 'CENTRAL' | 'MUJI' | 'SSP' | 'B2S' | 'Central' | 'Muji';

export interface CardDetails {
  brand?: string;
  maskedPan?: string;
  authCode?: string;
  bankIssuer?: string;
}

export interface PromptPayDetails {
  billerId?: string;
  referenceNo1?: string;
  referenceNo2?: string;
  slipHash?: string;
}

export interface PaymentCallbackPayload {
  gateway: PaymentGatewayType | string;
  merchantId: string;
  businessUnit: string;
  transactionNumber: string;
  quotationNumber: string;
  quotationId?: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  cardDetails?: CardDetails;
  promptPayDetails?: PromptPayDetails;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  paidAt?: string;
  gatewayReference?: string;
  [key: string]: any;
}

export interface CapturedPaymentRecord {
  payload: PaymentCallbackPayload;
  forwardedAt: string;
  crmStatus?: number;
  crmResponse?: any;
}

export interface PaymentInjectedError {
  statusCode: number;
  count: number;
}

export const BU_MERCHANT_ACCOUNTS: Record<string, { merchantId: string; billerId: string; priority: number }> = {
  MUJI: { merchantId: 'MERCHANT_MUJI_01', billerId: '010753600026902', priority: 1 },
  Muji: { merchantId: 'MERCHANT_MUJI_01', billerId: '010753600026902', priority: 1 },
  CENTRAL: { merchantId: 'MERCHANT_CENTRAL_01', billerId: '010753600026901', priority: 2 },
  Central: { merchantId: 'MERCHANT_CENTRAL_01', billerId: '010753600026901', priority: 2 },
  SSP: { merchantId: 'MERCHANT_SSP_01', billerId: '010753600026903', priority: 3 },
  B2S: { merchantId: 'MERCHANT_B2S_01', billerId: '010753600026904', priority: 4 }
};

export class PaymentMockServer {
  private server: http.Server | null = null;
  public capturedTransactions: CapturedPaymentRecord[] = [];
  public injectedErrors: Map<string, PaymentInjectedError> = new Map();
  public port: number;

  constructor(port = 4030) {
    this.port = port;
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
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment-Signature, X-Merchant-Id');

        if (method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        // Parse JSON request body
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

        // Check for injected errors
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
        if (path === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'healthy', service: 'mock-payment', port: this.port }));
          return;
        }

        // 2. Reset control endpoint
        if ((path === '/mock/payment/control/reset' || path === '/mock/payment/v1/control/reset') && (method === 'DELETE' || method === 'POST')) {
          this.capturedTransactions = [];
          this.injectedErrors.clear();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reset: true, timestamp: new Date().toISOString() }));
          return;
        }

        // 3. Inject error control endpoint
        if ((path === '/mock/payment/control/inject-error' || path === '/mock/payment/v1/control/inject-error') && method === 'POST') {
          const { endpoint, statusCode = 500, count = 1 } = data;
          this.injectedErrors.set(endpoint, { statusCode, count });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ configured: true, endpoint, statusCode, count }));
          return;
        }

        // 4. Simulate Callback API (Dispatches to CRM /api/webhooks/payment)
        if ((path === '/mock/payment/v1/simulate-callback' || path === '/mock/payment/simulate/callback') && method === 'POST') {
          const crmUrl = data.crmWebhookUrl || process.env.CRM_WEBHOOK_URL || 'http://127.0.0.1:3001/api/webhooks/payment';
          const payload: PaymentCallbackPayload = this.normalizeCallbackPayload(data.payload || data);

          try {
            const signature = data.signature || 'mock-hmac-sha256-valid-signature';
            const crmResponse = await fetch(crmUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Payment-Signature': signature,
                'X-Merchant-Id': payload.merchantId
              },
              body: JSON.stringify(payload)
            });

            let responseBody: any = null;
            try {
              responseBody = await crmResponse.json();
            } catch {
              responseBody = await crmResponse.text();
            }

            const record: CapturedPaymentRecord = {
              payload,
              forwardedAt: new Date().toISOString(),
              crmStatus: crmResponse.status,
              crmResponse: responseBody
            };
            this.capturedTransactions.push(record);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              transactionNumber: payload.transactionNumber,
              quotationNumber: payload.quotationNumber,
              crmStatus: crmResponse.status,
              crmResponse: responseBody
            }));
          } catch (e: any) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: `Failed to forward payment webhook to CRM: ${e.message}`,
              crmUrl
            }));
          }
          return;
        }

        // 5. Direct Credit Card Simulation Endpoint
        if (path === '/mock/payment/simulate/credit-card' && method === 'POST') {
          const payload = this.createCreditCardPayload(data);
          const crmUrl = data.crmWebhookUrl || 'http://127.0.0.1:3001/api/webhooks/payment';

          try {
            const crmResponse = await fetch(crmUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Payment-Signature': 'mock-valid-cc-signature',
                'X-Merchant-Id': payload.merchantId
              },
              body: JSON.stringify(payload)
            });
            const responseBody = await crmResponse.json().catch(() => null);

            this.capturedTransactions.push({
              payload,
              forwardedAt: new Date().toISOString(),
              crmStatus: crmResponse.status,
              crmResponse: responseBody
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, payload, crmStatus: crmResponse.status, crmResponse: responseBody }));
          } catch (e: any) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
          return;
        }

        // 6. Direct PromptPay Simulation Endpoint
        if (path === '/mock/payment/simulate/promptpay' && method === 'POST') {
          const payload = this.createPromptPayPayload(data);
          const crmUrl = data.crmWebhookUrl || 'http://127.0.0.1:3001/api/webhooks/payment';

          try {
            const crmResponse = await fetch(crmUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Payment-Signature': 'mock-valid-promptpay-signature',
                'X-Merchant-Id': payload.merchantId
              },
              body: JSON.stringify(payload)
            });
            const responseBody = await crmResponse.json().catch(() => null);

            this.capturedTransactions.push({
              payload,
              forwardedAt: new Date().toISOString(),
              crmStatus: crmResponse.status,
              crmResponse: responseBody
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, payload, crmStatus: crmResponse.status, crmResponse: responseBody }));
          } catch (e: any) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
          return;
        }

        // 7. Inspect store
        if ((path === '/mock/payment/v1/inspect/transactions' || path === '/mock/payment/history') && method === 'GET') {
          const qNum = url.searchParams.get('quotationNumber');
          const txNum = url.searchParams.get('transactionNumber');
          const bu = url.searchParams.get('businessUnit');
          const gateway = url.searchParams.get('gateway');

          let filtered = this.capturedTransactions;
          if (qNum) filtered = filtered.filter(t => t.payload.quotationNumber === qNum);
          if (txNum) filtered = filtered.filter(t => t.payload.transactionNumber === txNum);
          if (bu) filtered = filtered.filter(t => t.payload.businessUnit?.toUpperCase() === bu.toUpperCase());
          if (gateway) filtered = filtered.filter(t => t.payload.gateway === gateway);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            transactions: filtered,
            total: filtered.length
          }));
          return;
        }

        // Default 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Not found: ${method} ${path}` }));
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

  public createCreditCardPayload(options: Partial<PaymentCallbackPayload> = {}): PaymentCallbackPayload {
    const bu = (options.businessUnit || 'MUJI').toUpperCase();
    const buAccount = BU_MERCHANT_ACCOUNTS[bu] || BU_MERCHANT_ACCOUNTS.MUJI;
    const txNumber = options.transactionNumber || `TXN-CC-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const qNumber = options.quotationNumber || `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      gateway: 'CREDIT_CARD',
      merchantId: options.merchantId || buAccount.merchantId,
      businessUnit: options.businessUnit || bu,
      transactionNumber: txNumber,
      quotationNumber: qNumber,
      quotationId: options.quotationId,
      amount: options.amount ?? 27890.00,
      currency: options.currency || 'THB',
      paymentMethod: 'CREDIT_CARD',
      cardDetails: {
        brand: 'VISA',
        maskedPan: '411111******1111',
        authCode: 'AUTH998877',
        bankIssuer: 'KBANK',
        ...options.cardDetails
      },
      status: options.status || 'SUCCESS',
      paidAt: options.paidAt || new Date().toISOString(),
      gatewayReference: options.gatewayReference || `GW-REF-CC-${Date.now()}`
    };
  }

  public createPromptPayPayload(options: Partial<PaymentCallbackPayload> = {}): PaymentCallbackPayload {
    const bu = (options.businessUnit || 'CENTRAL').toUpperCase();
    const buAccount = BU_MERCHANT_ACCOUNTS[bu] || BU_MERCHANT_ACCOUNTS.CENTRAL;
    const txNumber = options.transactionNumber || `TXN-PP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const qNumber = options.quotationNumber || `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      gateway: 'PROMPTPAY',
      merchantId: options.merchantId || buAccount.merchantId,
      businessUnit: options.businessUnit || bu,
      transactionNumber: txNumber,
      quotationNumber: qNumber,
      quotationId: options.quotationId,
      amount: options.amount ?? 3500.00,
      currency: options.currency || 'THB',
      paymentMethod: 'PROMPTPAY',
      promptPayDetails: {
        billerId: options.promptPayDetails?.billerId || buAccount.billerId,
        referenceNo1: qNumber.replace(/[^a-zA-Z0-9]/g, ''),
        referenceNo2: bu,
        slipHash: `mock-slip-hash-${Date.now()}`,
        ...options.promptPayDetails
      },
      status: options.status || 'SUCCESS',
      paidAt: options.paidAt || new Date().toISOString(),
      gatewayReference: options.gatewayReference || `GW-REF-PP-${Date.now()}`
    };
  }

  private normalizeCallbackPayload(data: any): PaymentCallbackPayload {
    if (data.gateway && data.transactionNumber && data.quotationNumber) {
      return data as PaymentCallbackPayload;
    }
    if (data.gateway === 'PROMPTPAY') {
      return this.createPromptPayPayload(data);
    }
    return this.createCreditCardPayload(data);
  }
}

// CLI entrypoint
if (process.argv[1]?.endsWith('payment-mock-server.ts') || process.argv[1]?.endsWith('payment-mock-server.js')) {
  const port = parseInt(process.env.PAYMENT_MOCK_PORT || '4030', 10);
  const server = new PaymentMockServer(port);
  server.start().then(() => {
    console.log(`[PaymentMockServer] Listening on http://127.0.0.1:${port}`);
  }).catch((err) => {
    console.error('[PaymentMockServer] Startup failed:', err);
    process.exit(1);
  });
}
