import http from 'node:http';
import { URL } from 'node:url';
import type {
  ZwizInboundPayload,
  ZwizOutboundMessage,
  ZwizBotStateUpdate,
  InjectedError
} from './mock-types';

export class ZwizMockServer {
  private server: http.Server | null = null;
  public capturedMessages: ZwizOutboundMessage[] = [];
  public capturedTemplates: ZwizOutboundMessage[] = [];
  public capturedStateUpdates: ZwizBotStateUpdate[] = [];
  public injectedErrors: Map<string, InjectedError> = new Map();
  public port: number;

  constructor(port = 4010) {
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
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Zwiz-Signature');

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
          res.end(JSON.stringify({ status: 'healthy', service: 'mock-zwiz', port: this.port }));
          return;
        }

        // 2. Reset control endpoint
        if (path === '/mock/zwiz/control/reset' && method === 'DELETE') {
          this.capturedMessages = [];
          this.capturedTemplates = [];
          this.capturedStateUpdates = [];
          this.injectedErrors.clear();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ reset: true, timestamp: new Date().toISOString() }));
          return;
        }

        // 3. Inject error control endpoint
        if (path === '/mock/zwiz/control/inject-error' && method === 'POST') {
          const { endpoint, statusCode = 500, count = 1 } = data;
          this.injectedErrors.set(endpoint, { statusCode, count });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ configured: true, endpoint, statusCode, count }));
          return;
        }

        // 4. Simulate inbound webhook: forward LINE/FB/IG inbound event to CRM
        if (path === '/mock/zwiz/simulate/inbound' && method === 'POST') {
          const crmUrl = data.crmWebhookUrl || 'http://127.0.0.1:3001/api/webhooks/zwiz';
          const payload: ZwizInboundPayload = data.payload || data;

          try {
            const crmResponse = await fetch(crmUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Zwiz-Signature': data.signature || 'mock-valid-zwiz-signature'
              },
              body: JSON.stringify(payload)
            });

            let responseBody: any = null;
            try {
              responseBody = await crmResponse.json();
            } catch {
              responseBody = await crmResponse.text();
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              eventId: payload.eventId,
              crmStatus: crmResponse.status,
              crmResponse: responseBody
            }));
          } catch (e: any) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: `Failed to forward webhook to CRM: ${e.message}`,
              crmUrl
            }));
          }
          return;
        }

        // 4.1 Simulate interactive postback event (Zwiz -> CRM)
        if (path === '/mock/zwiz/simulate/postback' && method === 'POST') {
          const crmUrl = data.crmWebhookUrl || 'http://127.0.0.1:3001/api/webhooks/zwiz';
          const nowIso = new Date().toISOString();
          const inboundPayload: ZwizInboundPayload = {
            eventId: `evt_postback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            timestamp: nowIso,
            source: {
              channel: data.channel || 'LINE',
              pageId: data.pageId || 'central_department_store',
              pageName: data.pageName || 'Central Department Store',
              businessUnit: data.businessUnit || 'Central',
              senderId: data.senderId || 'U_test_customer',
              senderName: data.senderName || 'Khun Somchai',
            },
            session: {
              sessionId: data.sessionId || `sess_pb_${Date.now()}`,
              sessionStart: nowIso,
              botState: 'AGENT_HANDOFF',
            },
            message: {
              messageId: `msg_pb_${Date.now()}`,
              type: 'TEXT',
              text: data.text || `[POSTBACK] ${data.data || data.action || ''}`,
            }
          };

          try {
            const crmResponse = await fetch(crmUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Zwiz-Signature': data.signature || 'mock-valid-zwiz-signature'
              },
              body: JSON.stringify(inboundPayload)
            });

            let responseBody: any = null;
            try {
              responseBody = await crmResponse.json();
            } catch {
              responseBody = await crmResponse.text();
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              eventId: inboundPayload.eventId,
              crmStatus: crmResponse.status,
              crmResponse: responseBody
            }));
          } catch (e: any) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: false,
              error: `Failed to forward postback webhook to CRM: ${e.message}`,
              crmUrl
            }));
          }
          return;
        }

        // 5. Outbound message receiver (CRM -> Zwiz)
        if (path === '/mock/zwiz/v1/messages' && method === 'POST') {
          const msgType = (data.message?.messageType || '').toUpperCase();
          const isTemplate =
            msgType === 'TEMPLATE' ||
            msgType === 'BUTTON_CARD' ||
            msgType === 'CAROUSEL' ||
            Boolean(data.message?.template) ||
            Boolean(data.message?.card) ||
            Boolean(data.message?.carousel) ||
            Boolean(data.message?.quickReplies);

          if (isTemplate) {
            const tmpl = data.message?.template || data.message?.card;
            const carouselObj = data.message?.carousel;
            const effectiveType = (
              tmpl?.templateType ||
              (carouselObj ? 'CAROUSEL' : null) ||
              (data.message?.quickReplies ? 'QUICK_REPLIES' : null) ||
              msgType ||
              'BUTTONS'
            ).toUpperCase();

            // A. Validate BUTTONS / BUTTON_CARD
            if (effectiveType === 'BUTTONS' || effectiveType === 'BUTTON_CARD' || effectiveType === 'PAYMENT_LINK' || effectiveType === 'PAYMENT_REMINDER' || effectiveType === 'PAYMENT_CONFIRMATION' || effectiveType === 'ORDER_SUMMARY') {
              const actions = tmpl?.actions || data.message?.actions || [];
              if (!Array.isArray(actions) || actions.length < 1 || actions.length > 4) {
                res.writeHead(422, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  error: 'Invalid BUTTONS template: requires 1-4 actions with valid labels and targets',
                  code: 'INVALID_BUTTONS_TEMPLATE',
                  actualActionsCount: actions.length
                }));
                return;
              }

              for (const act of actions) {
                if (!act.label || typeof act.label !== 'string' || act.label.trim().length === 0 || act.label.length > 20) {
                  res.writeHead(422, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    error: 'Invalid BUTTONS action: label must be 1-20 characters',
                    code: 'INVALID_ACTION_LABEL'
                  }));
                  return;
                }
                const hasTarget = Boolean(act.url || act.data || act.text);
                if (!hasTarget) {
                  res.writeHead(422, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    error: 'Invalid BUTTONS action: target url, data, or text is required',
                    code: 'MISSING_ACTION_TARGET'
                  }));
                  return;
                }
              }
            }

            // B. Validate QUICK_REPLIES
            if (effectiveType === 'QUICK_REPLIES' || Boolean(data.message?.quickReplies)) {
              const qrs = data.message?.quickReplies || tmpl?.quickReplies || [];
              if (!Array.isArray(qrs) || qrs.length < 1 || qrs.length > 13) {
                res.writeHead(422, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  error: 'Invalid QUICK_REPLIES template: requires 1-13 quick reply items',
                  code: 'INVALID_QUICK_REPLIES_TEMPLATE',
                  actualCount: qrs.length
                }));
                return;
              }

              for (const item of qrs) {
                const label = item.label || item.action?.label;
                if (!label || label.length > 20) {
                  res.writeHead(422, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    error: 'Invalid QUICK_REPLIES item: label must be 1-20 characters',
                    code: 'INVALID_QUICK_REPLY_LABEL'
                  }));
                  return;
                }
              }
            }

            // C. Validate CAROUSEL
            if (effectiveType === 'CAROUSEL' || Boolean(carouselObj)) {
              const columns = carouselObj?.items || tmpl?.columns || tmpl?.items || [];
              if (!Array.isArray(columns) || columns.length < 2 || columns.length > 10) {
                res.writeHead(422, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  error: 'Invalid CAROUSEL template: requires 2-10 items with uniform action count',
                  code: 'INVALID_CAROUSEL_COUNT',
                  actualCount: columns.length
                }));
                return;
              }

              const standardActionCount = columns[0].actions?.length ?? 0;
              if (standardActionCount < 1 || standardActionCount > 3) {
                res.writeHead(422, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  error: 'Invalid CAROUSEL item: each item requires 1-3 actions',
                  code: 'INVALID_CAROUSEL_ACTIONS_COUNT'
                }));
                return;
              }

              for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                const colActionCount = col.actions?.length ?? 0;
                if (colActionCount !== standardActionCount) {
                  res.writeHead(422, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    error: `Invalid CAROUSEL template: items must have uniform action count (item 0 has ${standardActionCount}, item ${i} has ${colActionCount})`,
                    code: 'NON_UNIFORM_CAROUSEL_ACTIONS'
                  }));
                  return;
                }
              }
            }
          }

          const record: ZwizOutboundMessage = {
            caseId: data.caseId,
            recipientId: data.recipientId,
            channel: data.channel,
            pageId: data.pageId,
            message: data.message,
            metadata: data.metadata,
            receivedAt: new Date().toISOString()
          };

          this.capturedMessages.push(record);
          if (isTemplate) {
            this.capturedTemplates.push(record);
          }

          const generatedId = `zwiz_out_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            messageId: generatedId,
            status: 'DELIVERED',
            timestamp: record.receivedAt
          }));
          return;
        }

        // 6. Bot state update receiver (CRM -> Zwiz: POST /mock/zwiz/v1/users/:id/state)
        if (path.startsWith('/mock/zwiz/v1/users/') && path.endsWith('/state') && method === 'POST') {
          const parts = path.split('/');
          const userId = parts[4];
          const record: ZwizBotStateUpdate = {
            userId,
            sessionId: data.sessionId,
            caseId: data.caseId,
            botState: data.botState || 'ACTIVE',
            action: data.action || 'RESET_TO_MAIN_MENU',
            closedAt: data.closedAt || new Date().toISOString(),
            closureReason: data.closureReason,
            receivedAt: new Date().toISOString()
          };
          this.capturedStateUpdates.push(record);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'UPDATED',
            userId,
            botState: record.botState,
            timestamp: record.receivedAt
          }));
          return;
        }

        // 7. Inspect captured outbound messages
        if ((path === '/mock/zwiz/inspect/outbound' || path === '/mock/zwiz/v1/inspect/messages') && method === 'GET') {
          const caseId = url.searchParams.get('caseId');
          const recipientId = url.searchParams.get('recipientId');
          const channel = url.searchParams.get('channel');

          let filtered = this.capturedMessages;
          if (caseId) filtered = filtered.filter(m => m.caseId === caseId);
          if (recipientId) filtered = filtered.filter(m => m.recipientId === recipientId);
          if (channel) filtered = filtered.filter(m => m.channel === channel);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            count: filtered.length,
            total: filtered.length,
            messages: filtered,
            outboundMessages: filtered
          }));
          return;
        }

        // 7.1 Inspect captured templates
        if (path === '/mock/zwiz/inspect/templates' && method === 'GET') {
          const caseId = url.searchParams.get('caseId');
          const templateType = url.searchParams.get('templateType');
          const quotationNumber = url.searchParams.get('quotationNumber');

          let filtered = this.capturedTemplates;
          if (caseId) filtered = filtered.filter(m => m.caseId === caseId);
          if (templateType) {
            filtered = filtered.filter(m => {
              const tmpl = m.message?.template || m.message?.card;
              const effective = (tmpl?.templateType || m.message?.messageType || '').toUpperCase();
              return effective === templateType.toUpperCase();
            });
          }
          if (quotationNumber) {
            filtered = filtered.filter(m => {
              const tmpl = m.message?.template || m.message?.card;
              return tmpl?.quotationNumber === quotationNumber || m.metadata?.quotationNumber === quotationNumber;
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ templates: filtered, total: filtered.length }));
          return;
        }

        // 8. Inspect captured bot state updates
        if ((path === '/mock/zwiz/inspect/state-updates' || path === '/mock/zwiz/v1/inspect/state-updates') && method === 'GET') {
          const userId = url.searchParams.get('userId');
          const caseId = url.searchParams.get('caseId');

          let filtered = this.capturedStateUpdates;
          if (userId) filtered = filtered.filter(u => u.userId === userId);
          if (caseId) filtered = filtered.filter(u => u.caseId === caseId);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            count: filtered.length,
            total: filtered.length,
            updates: filtered,
            stateUpdates: filtered
          }));
          return;
        }

        // Default 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Not found: ${method} ${path} on Mock Zwiz Server` }));
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
if (process.argv[1]?.endsWith('zwiz-mock-server.ts') || process.argv[1]?.endsWith('zwiz-mock-server.js')) {
  const port = parseInt(process.env.ZWIZ_MOCK_PORT || '4010', 10);
  const server = new ZwizMockServer(port);
  server.start().then(() => {
    console.log(`[Mock Zwiz] Server listening on http://127.0.0.1:${port}`);
  }).catch((err) => {
    console.error(`[Mock Zwiz] Failed to start:`, err);
    process.exit(1);
  });

  const cleanup = async () => {
    console.log(`[Mock Zwiz] Shutting down...`);
    await server.stop();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
