import { ZwizMockServer } from '../mocks/zwiz-mock-server';
import { QualtricsMockServer } from '../mocks/qualtrics-mock-server';
import { TestCrmServer } from './test-crm-server';
import { waitFor } from './wait-for';

export interface SupervisorConfig {
  crmPort?: number;
  zwizPort?: number;
  qualtricsPort?: number;
  courierPort?: number;
}

export class TestSupervisor {
  public zwizServer: ZwizMockServer;
  public qualtricsServer: QualtricsMockServer;
  public crmServer: TestCrmServer | null = null;
  public crmPort: number;
  public zwizPort: number;
  public qualtricsPort: number;
  public courierPort: number;
  private isRunning = false;

  constructor(config: SupervisorConfig = {}) {
    this.crmPort = config.crmPort ?? parseInt(process.env.CRM_PORT || '3001', 10);
    this.zwizPort = config.zwizPort ?? parseInt(process.env.ZWIZ_MOCK_PORT || '4010', 10);
    this.qualtricsPort = config.qualtricsPort ?? parseInt(process.env.QUALTRICS_MOCK_PORT || '4020', 10);
    this.courierPort = config.courierPort ?? parseInt(process.env.COURIER_MOCK_PORT || '4040', 10);

    this.zwizServer = new ZwizMockServer(this.zwizPort);
    this.qualtricsServer = new QualtricsMockServer(this.qualtricsPort);
  }

  public async isPortOpen(url: string): Promise<boolean> {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(1000) });
      return resp.ok || resp.status < 500;
    } catch {
      return false;
    }
  }

  public async startAll(): Promise<void> {
    if (this.isRunning) return;

    // 1. Start Mock Zwiz Server
    await this.zwizServer.start();
    await waitFor(async () => {
      return await this.isPortOpen(`http://127.0.0.1:${this.zwizPort}/health`);
    }, { description: `Mock Zwiz health on port ${this.zwizPort}`, timeoutMs: 3000 });

    // 2. Start Mock Qualtrics Server
    await this.qualtricsServer.start();
    await waitFor(async () => {
      return await this.isPortOpen(`http://127.0.0.1:${this.qualtricsPort}/health`);
    }, { description: `Mock Qualtrics health on port ${this.qualtricsPort}`, timeoutMs: 3000 });

    // 3. Check if CRM App (e.g. Next.js) is already listening on crmPort
    const crmAlreadyActive = await this.isPortOpen(`http://127.0.0.1:${this.crmPort}/health`);
    if (!crmAlreadyActive) {
      this.crmServer = new TestCrmServer(
        this.crmPort,
        `http://127.0.0.1:${this.zwizPort}`,
        `http://127.0.0.1:${this.qualtricsPort}`
      );
      await this.crmServer.start();
      await waitFor(async () => {
        return await this.isPortOpen(`http://127.0.0.1:${this.crmPort}/health`);
      }, { description: `Test CRM Server health on port ${this.crmPort}`, timeoutMs: 3000 });
    }

    this.isRunning = true;
  }

  public async resetAll(): Promise<void> {
    // Reset Zwiz logs
    await fetch(`http://127.0.0.1:${this.zwizPort}/mock/zwiz/control/reset`, { method: 'DELETE' });
    // Reset Qualtrics logs
    await fetch(`http://127.0.0.1:${this.qualtricsPort}/mock/qualtrics/control/reset`, { method: 'DELETE' });
    // Reset Courier mock captured history
    try {
      await fetch(`http://127.0.0.1:${this.courierPort}/mock/courier/control/reset`, { method: 'DELETE' });
    } catch {
      // Ignore if courier mock server is offline in earlier tier tests
    }
    // Reset CRM database
    if (this.crmServer) {
      await this.crmServer.resetDatabase();
    } else {
      try {
        await fetch(`http://127.0.0.1:${this.crmPort}/api/test/reset`, { method: 'DELETE' });
      } catch {
        // Ignore if endpoint not present on live Next.js
      }
    }
  }

  public async stopAll(): Promise<void> {
    const promises: Promise<void>[] = [
      this.zwizServer.stop(),
      this.qualtricsServer.stop(),
    ];
    if (this.crmServer) {
      promises.push(this.crmServer.stop());
      this.crmServer = null;
    }
    await Promise.all(promises);
    this.isRunning = false;
  }
}

// Global singleton for test files
export const globalSupervisor = new TestSupervisor();
