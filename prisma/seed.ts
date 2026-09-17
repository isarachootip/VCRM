import { PrismaClient, BusinessUnit, UserRole, PresenceStatus, ChannelType } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

export async function main() {
  console.log('🌱 Starting database seed for Omnichannel Social Commerce CRM...');

  // 1. SEED AGENT USERS
  const users = [
    {
      id: 'agent_ken',
      email: 'ken.tanaka@muji.co.th',
      name: 'Ken Tanaka',
      role: UserRole.AGENT,
      businessUnits: [BusinessUnit.MUJI],
      presence: PresenceStatus.ONLINE,
      maxChatCapacity: 5,
      maxConcurrentChats: 5,
    },
    {
      id: 'agent_ken_03',
      email: 'ken.03@muji.co.th',
      name: 'Ken Tanaka 03',
      role: UserRole.AGENT,
      businessUnits: [BusinessUnit.MUJI],
      presence: PresenceStatus.ONLINE,
      maxChatCapacity: 5,
      maxConcurrentChats: 5,
    },
    {
      id: 'agent_boy',
      email: 'boy.sports@supersports.co.th',
      name: 'Boy Supersports Specialist',
      role: UserRole.AGENT,
      businessUnits: [BusinessUnit.SSP, BusinessUnit.B2S],
      presence: PresenceStatus.ONLINE,
      maxChatCapacity: 5,
      maxConcurrentChats: 5,
    },
    {
      id: 'agent_boy_04',
      email: 'boy.04@supersports.co.th',
      name: 'Boy Specialist 04',
      role: UserRole.AGENT,
      businessUnits: [BusinessUnit.SSP, BusinessUnit.B2S],
      presence: PresenceStatus.ONLINE,
      maxChatCapacity: 5,
      maxConcurrentChats: 5,
    },
    {
      id: 'user_sysadmin',
      username: 'sysadmin',
      email: 'sysadmin@vcrm.internal',
      name: 'System Administrator',
      role: UserRole.ADMIN,
      passwordHash: hashPassword('SysAdmin@2026!'),
      businessUnits: [BusinessUnit.MUJI, BusinessUnit.SSP, BusinessUnit.B2S],
      presence: PresenceStatus.ONLINE,
      maxChatCapacity: 10,
      maxConcurrentChats: 10,
    },
    {
      id: 'user_admin',
      username: 'admin',
      email: 'admin@vcrm.internal',
      name: 'CRM Administrator',
      role: UserRole.ADMIN,
      passwordHash: hashPassword('Admin@2026!'),
      businessUnits: [BusinessUnit.MUJI, BusinessUnit.SSP, BusinessUnit.B2S],
      presence: PresenceStatus.ONLINE,
      maxChatCapacity: 10,
      maxConcurrentChats: 10,
    },
    {
      id: 'user_manager',
      username: 'manager',
      email: 'manager@vcrm.internal',
      name: 'Sales & Service Manager',
      role: UserRole.SUPERVISOR,
      passwordHash: hashPassword('Manager@2026!'),
      businessUnits: [BusinessUnit.MUJI, BusinessUnit.SSP, BusinessUnit.B2S],
      presence: PresenceStatus.ONLINE,
      maxChatCapacity: 5,
      maxConcurrentChats: 5,
    },
    {
      id: 'user_sales',
      username: 'sales',
      email: 'sales@vcrm.internal',
      name: 'Sales Executive',
      role: UserRole.AGENT,
      passwordHash: hashPassword('Sales@2026!'),
      businessUnits: [BusinessUnit.MUJI, BusinessUnit.SSP, BusinessUnit.B2S],
      presence: PresenceStatus.ONLINE,
      maxChatCapacity: 5,
      maxConcurrentChats: 5,
    },
  ];

  for (const user of users) {
    const upsertedUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email,
        username: (user as any).username || null,
        passwordHash: (user as any).passwordHash || null,
        name: user.name,
        role: user.role,
        businessUnits: user.businessUnits,
        presence: user.presence,
        maxChatCapacity: user.maxChatCapacity,
        maxConcurrentChats: user.maxConcurrentChats,
      },
      create: {
        id: user.id,
        email: user.email,
        username: (user as any).username || null,
        passwordHash: (user as any).passwordHash || null,
        name: user.name,
        role: user.role,
        businessUnits: user.businessUnits,
        presence: user.presence,
        maxChatCapacity: user.maxChatCapacity,
        maxConcurrentChats: user.maxConcurrentChats,
      },
    });

    // Create or update 1:1 AgentProfile
    await prisma.agentProfile.upsert({
      where: { userId: upsertedUser.id },
      update: {
        role: user.role,
        presence: user.presence,
        maxConcurrentChats: user.maxConcurrentChats,
      },
      create: {
        userId: upsertedUser.id,
        role: user.role,
        presence: user.presence,
        maxConcurrentChats: user.maxConcurrentChats,
      },
    });
    console.log(`  ✓ User & Profile seeded: ${user.name} (${user.email})`);
  }

  // 2. SEED QUEUES
  const queues = [
    {
      id: 'queue_muji_furniture',
      name: 'Muji Furniture & Interior',
      code: 'queue_muji_furniture',
      businessUnit: BusinessUnit.MUJI,
      description: 'Muji minimalist furniture, storage, and home lifestyle consultation',
      slaResponseMin: 15,
      slaResolveMin: 180,
      agentId: 'agent_ken',
    },
    {
      id: 'queue_ssp_specialist',
      name: 'Supersports Specialist',
      code: 'queue_ssp_specialist',
      businessUnit: BusinessUnit.SSP,
      description: 'Specialist queue for athletic gear, running shoes, and fitness equipment',
      slaResponseMin: 15,
      slaResolveMin: 120,
      agentId: 'agent_boy',
    },
    {
      id: 'queue_b2s_general',
      name: 'B2S General & Stationery',
      code: 'queue_b2s_general',
      businessUnit: BusinessUnit.B2S,
      description: 'Books, stationery, art supplies and educational materials queue',
      slaResponseMin: 20,
      slaResolveMin: 120,
      agentId: 'agent_boy',
    },
  ];

  for (const q of queues) {
    const queue = await prisma.queue.upsert({
      where: { code: q.code },
      update: {
        name: q.name,
        businessUnit: q.businessUnit,
        description: q.description,
        slaResponseMin: q.slaResponseMin,
        slaResolveMin: q.slaResolveMin,
      },
      create: {
        id: q.id,
        name: q.name,
        code: q.code,
        businessUnit: q.businessUnit,
        description: q.description,
        slaResponseMin: q.slaResponseMin,
        slaResolveMin: q.slaResolveMin,
      },
    });

    // Assign primary agent to queue
    await prisma.queueMember.upsert({
      where: {
        queueId_userId: {
          queueId: queue.id,
          userId: q.agentId,
        },
      },
      update: {},
      create: {
        queueId: queue.id,
        userId: q.agentId,
      },
    });

    console.log(`  ✓ Queue seeded: ${queue.name} [${queue.code}] with agent ${q.agentId}`);
  }

  // 3. SEED QUALTRICS SURVEY CONFIGURATIONS
  const surveyConfigs = [
    {
      queueCode: 'queue_muji_furniture',
      businessUnit: BusinessUnit.MUJI,
      qualtricsSurveyId: 'SV_qualtrics_muji_furniture',
      surveyId: 'SV_qualtrics_muji_furniture',
      cooldownHours: 24,
    },
    {
      queueCode: 'queue_ssp_specialist',
      businessUnit: BusinessUnit.SSP,
      qualtricsSurveyId: 'SV_qualtrics_ssp_specialist',
      surveyId: 'SV_qualtrics_ssp_specialist',
      cooldownHours: 24,
    },
    {
      queueCode: 'queue_b2s_general',
      businessUnit: BusinessUnit.B2S,
      qualtricsSurveyId: 'SV_qualtrics_b2s_general',
      surveyId: 'SV_qualtrics_b2s_general',
      cooldownHours: 24,
    },
  ];

  for (const cfg of surveyConfigs) {
    const queue = await prisma.queue.findUnique({ where: { code: cfg.queueCode } });
    if (!queue) continue;

    await prisma.surveyConfig.upsert({
      where: {
        queueId_businessUnit: {
          queueId: queue.id,
          businessUnit: cfg.businessUnit,
        },
      },
      update: {
        qualtricsSurveyId: cfg.qualtricsSurveyId,
        surveyId: cfg.surveyId,
        cooldownHours: cfg.cooldownHours,
        isActive: true,
      },
      create: {
        queueId: queue.id,
        businessUnit: cfg.businessUnit,
        qualtricsSurveyId: cfg.qualtricsSurveyId,
        surveyId: cfg.surveyId,
        cooldownHours: cfg.cooldownHours,
        isActive: true,
      },
    });
    console.log(`  ✓ Qualtrics SurveyConfig seeded: ${cfg.queueCode} -> ${cfg.qualtricsSurveyId}`);
  }

  // 4. SEED SAMPLE CUSTOMER WITH THE 1 LOYALTY
  const customer = await prisma.customer.upsert({
    where: { externalId: 'U1234567890abcdef' },
    update: {
      displayName: 'K. Somchai Suksan',
      name: 'Somchai Suksan',
      phone: '0812345678',
      email: 'somchai@example.com',
      lineUserId: 'U1234567890abcdef',
      the1CardNumber: '880012345678',
      the1Mobile: '0812345678',
      the1Points: 12500,
      the1Tier: 'THE1_EXCLUSIVE',
      the1SyncedAt: new Date(),
    },
    create: {
      id: 'cust_seed_001',
      externalId: 'U1234567890abcdef',
      lineUserId: 'U1234567890abcdef',
      channel: ChannelType.LINE,
      displayName: 'K. Somchai Suksan',
      name: 'Somchai Suksan',
      phone: '0812345678',
      email: 'somchai@example.com',
      the1CardNumber: '880012345678',
      the1Mobile: '0812345678',
      the1Points: 12500,
      the1Tier: 'THE1_EXCLUSIVE',
      the1SyncedAt: new Date(),
    },
  });
  console.log(`  ✓ Sample customer seeded with The 1 profile: ${customer.displayName}`);

  // Additional The 1 test customers
  await prisma.customer.upsert({
    where: { externalId: 'U_t1_classic_001' },
    update: {
      displayName: 'K. Somchai Classic',
      name: 'Somchai Classic',
      phone: '0891112222',
      the1CardNumber: '880012340001',
      the1Mobile: '0891112222',
      the1Points: 2500,
      the1Tier: 'CLASSIC',
      the1SyncedAt: new Date(),
    },
    create: {
      id: 'cust_t1_classic',
      externalId: 'U_t1_classic_001',
      channel: ChannelType.LINE,
      displayName: 'K. Somchai Classic',
      name: 'Somchai Classic',
      phone: '0891112222',
      the1CardNumber: '880012340001',
      the1Mobile: '0891112222',
      the1Points: 2500,
      the1Tier: 'CLASSIC',
      the1SyncedAt: new Date(),
    },
  });

  await prisma.customer.upsert({
    where: { externalId: 'U_t1_vip_001' },
    update: {
      displayName: 'Khun Arak VIP',
      name: 'Arak Wongsuwan',
      phone: '0863334444',
      the1CardNumber: '880012340003',
      the1Mobile: '0863334444',
      the1Points: 120000,
      the1Tier: 'VIP',
      the1SyncedAt: new Date(),
    },
    create: {
      id: 'cust_t1_vip',
      externalId: 'U_t1_vip_001',
      channel: ChannelType.LINE,
      displayName: 'Khun Arak VIP',
      name: 'Arak Wongsuwan',
      phone: '0863334444',
      the1CardNumber: '880012340003',
      the1Mobile: '0863334444',
      the1Points: 120000,
      the1Tier: 'VIP',
      the1SyncedAt: new Date(),
    },
  });

  console.log('✅ Omnichannel Social Commerce CRM database seed completed successfully.');
}

if (require.main === module) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('❌ Error during seed execution:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
