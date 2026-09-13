import http from 'node:http';
import { URL } from 'node:url';
import type {
  QualtricsDistribution,
  QualtricsInboundWebhookPayload,
  InjectedError
} from './mock-types';

export class QualtricsMockServer {
  private server: http.Server | null = null;
  public capturedDistributions: QualtricsDistribution[] = [];
  public injectedErrors: Map<string, InjectedError> = new Map();
  public port: number;

  constructor(port = 4020) {
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
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-TOKEN, Authorization');

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
          res.end(JSON.stringify({ status: 'healthy', service: 'mock-qualtrics', port: this.port }));
          return;
        }

        // 2. Reset control endpoint
        if (path === '/mock/qualtrics/control/reset' && method === 'DELETE') {
          this.capturedDistributions = [];
          this.injectedErrors.clear();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reset: true, timestamp: new Date().toISOString() }));
          return;
        }

        // 3. Inject error control endpoint
        if (path === '/mock/qualtrics/control/inject-error' && method === 'POST') {
          const { endpoint = '/mock/qualtrics/v3/distributions', statusCode = 503, count = 1 } = data;
          this.injectedErrors.set(endpoint, { statusCode, count });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ configured: true, endpoint, statusCode, count }));
          return;
        }

        // 4. Qualtrics Survey Trigger Receiver (CRM -> Qualtrics: POST /mock/qualtrics/v3/distributions)
        if (path === '/mock/qualtrics/v3/distributions' && method === 'POST') {
          const distributionId = `EMD_dist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const record: QualtricsDistribution = {
            distributionId,
            surveyId: data.surveyId || 'SV_qualtrics_default',
            caseId: data.caseId,
            caseNumber: data.caseNumber || '',
            businessUnit: data.businessUnit || '',
            queueId: data.queueId || '',
            channel: data.channel || 'LINE',
            recipient: data.recipient || {},
            embeddedData: data.embeddedData || {},
            receivedAt: new Date().toISOString()
          };
          this.capturedDistributions.push(record);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            result: {
              id: distributionId,
              status: 'Scheduled',
              sendDate: record.receivedAt
            }
          }));
          return;
        }

        // 5. Inspect captured distributions (GET /mock/qualtrics/inspect/distributions or /mock/qualtrics/v1/inspect/dispatches)
        if ((path === '/mock/qualtrics/inspect/distributions' || path === '/mock/qualtrics/v1/inspect/dispatches') && method === 'GET') {
          const ticketId = url.searchParams.get('ticketId') || url.searchParams.get('caseId');
          const queueId = url.searchParams.get('queueId');
          const bu = url.searchParams.get('bu') || url.searchParams.get('businessUnit');

          let filtered = this.capturedDistributions;
          if (ticketId) filtered = filtered.filter(d => d.caseId === ticketId || (d as any).ticketId === ticketId);
          if (queueId) filtered = filtered.filter(d => d.queueId === queueId);
          if (bu) filtered = filtered.filter(d => d.businessUnit === bu);

          const formatted = filtered.map(d => ({
            ...d,
            ticketId: (d as any).ticketId || d.caseId,
          }));

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            count: formatted.length,
            total: formatted.length,
            distributions: formatted,
            dispatches: formatted,
          }));
          return;
        }

        // 5b. Inspect distribution by caseId (GET /mock/qualtrics/inspect/distributions/:caseId)
        if (path.startsWith('/mock/qualtrics/inspect/distributions/') && method === 'GET') {
          const targetCaseId = path.replace('/mock/qualtrics/inspect/distributions/', '');
          const distribution = this.capturedDistributions.find(d => d.caseId === targetCaseId) || null;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ distribution }));
          return;
        }

        // 6. Simulate customer submitting CSAT rating back to CRM webhook
        if (path === '/mock/qualtrics/simulate/response' && method === 'POST') {
          const {
            crmWebhookUrl = 'http://127.0.0.1:3001/api/webhooks/qualtrics',
            caseId,
            surveyId = 'SV_qualtrics_phase0',
            distributionId = `EMD_${Date.now()}`,
            responseId = `R_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            csatScore = 5,
            npsScore = 10,
            cesScore = 1,
            comment = 'Great service',
            language = 'th',
            embeddedData = {}
          } = data;

          const webhookPayload: QualtricsInboundWebhookPayload = {
            eventId: `evt_csat_${Date.now()}`,
            surveyId,
            responseId,
            distributionId,
            caseId,
            submittedAt: new Date().toISOString(),
            metrics: {
              csatScore,
              npsScore,
              cesScore,
              ratingCategory: csatScore >= 4 ? 'SATISFIED' : 'DISSATISFIED'
            },
            feedback: {
              comment,
              language
            },
            embeddedData
          };

          try {
            const crmResponse = await fetch(crmWebhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Qualtrics-Signature': data.signature || 'mock-valid-qualtrics-signature'
              },
              body: JSON.stringify(webhookPayload)
            });

            let responseBody: any = null;
            try {
              responseBody = await crmResponse.json();
            } catch {
              responseBody = await crmResponse.text();
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              dispatched: true,
              crmStatus: crmResponse.status,
              crmResponse: responseBody,
              payload: webhookPayload
            }));
          } catch (e: any) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              dispatched: false,
              error: `Failed to forward CSAT webhook to CRM: ${e.message}`,
              crmWebhookUrl
            }));
          }
          return;
        }

        // Default 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Not found: ${method} ${path} on Mock Qualtrics Server` }));
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
if (process.argv[1]?.endsWith('qualtrics-mock-server.ts') || process.argv[1]?.endsWith('qualtrics-mock-server.js')) {
  const port = parseInt(process.env.QUALTRICS_MOCK_PORT || '4020', 10);
  const server = new QualtricsMockServer(port);
  server.start().then(() => {
    console.log(`[Mock Qualtrics] Server listening on http://127.0.0.1:${port}`);
  }).catch((err) => {
    console.error(`[Mock Qualtrics] Failed to start:`, err);
    process.exit(1);
  });

  const cleanup = async () => {
    console.log(`[Mock Qualtrics] Shutting down...`);
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
