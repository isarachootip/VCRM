import { ZwizMockServer } from './zwiz-mock-server';
import { QualtricsMockServer } from './qualtrics-mock-server';
import { PaymentMockServer } from './payment-mock-server';
import { CourierMockServer } from './courier-mock-server';

export { ZwizMockServer } from './zwiz-mock-server';
export { QualtricsMockServer } from './qualtrics-mock-server';
export { PaymentMockServer } from './payment-mock-server';
export { CourierMockServer } from './courier-mock-server';
export * from './mock-types';

export interface MockSupervisorOptions {
  zwizPort?: number;
  qualtricsPort?: number;
  paymentPort?: number;
  courierPort?: number;
}

export class MockSupervisor {
  public zwizServer: ZwizMockServer;
  public qualtricsServer: QualtricsMockServer;
  public paymentServer: PaymentMockServer;
  public courierServer: CourierMockServer;
  private running = false;

  constructor(options: MockSupervisorOptions = {}) {
    const zwizPort = options.zwizPort ?? parseInt(process.env.ZWIZ_MOCK_PORT || '4010', 10);
    const qualtricsPort = options.qualtricsPort ?? parseInt(process.env.QUALTRICS_MOCK_PORT || '4020', 10);
    const paymentPort = options.paymentPort ?? parseInt(process.env.PAYMENT_MOCK_PORT || '4030', 10);
    const courierPort = options.courierPort ?? parseInt(process.env.COURIER_MOCK_PORT || '4040', 10);

    this.zwizServer = new ZwizMockServer(zwizPort);
    this.qualtricsServer = new QualtricsMockServer(qualtricsPort);
    this.paymentServer = new PaymentMockServer(paymentPort);
    this.courierServer = new CourierMockServer(courierPort);
  }

  public async start(): Promise<void> {
    if (this.running) return;

    await Promise.all([
      this.zwizServer.start(),
      this.qualtricsServer.start(),
      this.paymentServer.start(),
      this.courierServer.start(),
    ]);
    this.running = true;
    console.log(`[MockSupervisor] Mock Zwiz running on port ${this.zwizServer.port}`);
    console.log(`[MockSupervisor] Mock Qualtrics running on port ${this.qualtricsServer.port}`);
    console.log(`[MockSupervisor] Mock Payment running on port ${this.paymentServer.port}`);
    console.log(`[MockSupervisor] Mock Courier running on port ${this.courierServer.port}`);
  }

  public async stop(): Promise<void> {
    if (!this.running) return;

    await Promise.all([
      this.zwizServer.stop(),
      this.qualtricsServer.stop(),
      this.paymentServer.stop(),
      this.courierServer.stop(),
    ]);
    this.running = false;
    console.log(`[MockSupervisor] All mock servers stopped cleanly.`);
  }

  public async resetAll(): Promise<void> {
    this.zwizServer.capturedMessages = [];
    this.zwizServer.capturedTemplates = [];
    this.zwizServer.capturedStateUpdates = [];
    this.zwizServer.injectedErrors.clear();

    this.qualtricsServer.capturedDistributions = [];
    this.qualtricsServer.injectedErrors.clear();

    this.paymentServer.capturedTransactions = [];
    this.paymentServer.injectedErrors.clear();

    this.courierServer.capturedShipments.clear();
    this.courierServer.capturedWebhooks = [];
    this.courierServer.injectedErrors.clear();
  }
}

// CLI entrypoint
if (process.argv[1]?.endsWith('mocks/index.ts') || process.argv[1]?.endsWith('mocks\\index.ts')) {
  const supervisor = new MockSupervisor();
  supervisor.start().then(() => {
    console.log('[MockSupervisor] All 4 mock services ready for test traffic (:4010, :4020, :4030, :4040).');
  }).catch((err) => {
    console.error('[MockSupervisor] Startup failed:', err);
    process.exit(1);
  });

  const cleanup = async () => {
    console.log('\n[MockSupervisor] Stopping services...');
    await supervisor.stop();
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
