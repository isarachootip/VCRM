import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { BusinessUnit, UserRole, PresenceStatus, ChannelType } from '@prisma/client';

export async function seedBaseline(prismaClient: typeof prisma) {
  // 1. Users & Agent Profiles
  const users = [
    {
      id: 'agent_sarah',
      email: 'sarah.connor@central.co.th',
      name: 'Sarah Connor',
      role: UserRole.AGENT,
      bus: [BusinessUnit.CENTRAL, BusinessUnit.CENTRAL_BEAUTY_CLUB, BusinessUnit.CDS],
      isVipEligible: true,
    },
    {
      id: 'agent_sarah_01',
      email: 'sarah.01@central.co.th',
      name: 'Sarah Connor (Sales & Support)',
      role: UserRole.AGENT,
      bus: [BusinessUnit.CENTRAL, BusinessUnit.CENTRAL_BEAUTY_CLUB, BusinessUnit.CDS],
      isVipEligible: false,
    },
    {
      id: 'agent_sarah_connor',
      email: 'sarah.connor.vip@central.co.th',
      name: 'Sarah Connor (VIP Luxury)',
      role: UserRole.AGENT,
      bus: [BusinessUnit.CENTRAL, BusinessUnit.CENTRAL_BEAUTY_CLUB, BusinessUnit.CDS],
      isVipEligible: true,
    },
    {
      id: 'agent_ploi',
      email: 'ploi.beauty@central.co.th',
      name: 'Ploi Beauty Specialist',
      role: UserRole.AGENT,
      bus: [BusinessUnit.CENTRAL_BEAUTY_CLUB, BusinessUnit.CENTRAL],
      isVipEligible: false,
    },
    {
      id: 'agent_ploi_02',
      email: 'ploi.02@central.co.th',
      name: 'Ploi Specialist 02',
      role: UserRole.AGENT,
      bus: [BusinessUnit.CENTRAL_BEAUTY_CLUB, BusinessUnit.CENTRAL],
      isVipEligible: false,
    },
    {
      id: 'agent_ken',
      email: 'ken.tanaka@muji.co.th',
      name: 'Ken Tanaka',
      role: UserRole.AGENT,
      bus: [BusinessUnit.MUJI],
      isVipEligible: false,
    },
    {
      id: 'agent_ken_03',
      email: 'ken.03@muji.co.th',
      name: 'Ken Tanaka 03',
      role: UserRole.AGENT,
      bus: [BusinessUnit.MUJI],
      isVipEligible: false,
    },
    {
      id: 'agent_boy',
      email: 'boy.sports@supersports.co.th',
      name: 'Boy Supersports Specialist',
      role: UserRole.AGENT,
      bus: [BusinessUnit.SSP, BusinessUnit.B2S],
      isVipEligible: false,
    },
    {
      id: 'agent_boy_04',
      email: 'boy.04@supersports.co.th',
      name: 'Boy Specialist 04',
      role: UserRole.AGENT,
      bus: [BusinessUnit.SSP, BusinessUnit.B2S],
      isVipEligible: false,
    },
  ];

  for (const u of users) {
    await prismaClient.user.upsert({
      where: { id: u.id },
      update: {
        email: u.email,
        name: u.name,
        role: u.role,
        businessUnits: u.bus,
        presence: PresenceStatus.ONLINE,
        maxChatCapacity: 5,
        maxConcurrentChats: 5,
        activeChatCount: 0,
        isVipEligible: Boolean(u.isVipEligible),
      },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        businessUnits: u.bus,
        presence: PresenceStatus.ONLINE,
        maxChatCapacity: 5,
        maxConcurrentChats: 5,
        activeChatCount: 0,
        isVipEligible: Boolean(u.isVipEligible),
      },
    });

    await prismaClient.agentProfile.upsert({
      where: { userId: u.id },
      update: {
        role: u.role,
        presence: PresenceStatus.ONLINE,
        maxConcurrentChats: 5,
        activeChatCount: 0,
        isVipEligible: Boolean(u.isVipEligible),
        breakExpectedEndAt: null,
      },
      create: {
        userId: u.id,
        role: u.role,
        presence: PresenceStatus.ONLINE,
        maxConcurrentChats: 5,
        activeChatCount: 0,
        isVipEligible: Boolean(u.isVipEligible),
        breakExpectedEndAt: null,
      },
    });
  }

  // 2. Queues & Queue Members
  const queues = [
    {
      id: 'queue_central_general',
      name: 'Central General Inquiry',
      code: 'queue_central_general',
      businessUnit: BusinessUnit.CENTRAL,
      description: 'General inquiry and omni-commerce queue for Central Department Store',
      slaResponseMin: 15,
      slaResolveMin: 120,
      agentId: 'agent_sarah',
    },
    {
      id: 'queue_central_sales',
      name: 'Central Sales & Orders',
      code: 'queue_central_sales',
      businessUnit: BusinessUnit.CENTRAL,
      description: 'Central Department Store sales desk and omnichannel ordering queue',
      slaResponseMin: 15,
      slaResolveMin: 120,
      agentId: 'agent_sarah_01',
    },
    {
      id: 'queue_central_luxury',
      name: 'Central Luxury Personal Shopper',
      code: 'queue_central_luxury',
      businessUnit: BusinessUnit.CENTRAL,
      description: 'High-touch personal shopper queue for Central Luxury brands',
      slaResponseMin: 5,
      slaResolveMin: 60,
      agentId: 'agent_sarah',
    },
    {
      id: 'queue_beauty_advisory',
      name: 'Central Beauty Club Advisory',
      code: 'queue_beauty_advisory',
      businessUnit: BusinessUnit.CENTRAL_BEAUTY_CLUB,
      description: 'Skincare, cosmetics and fragrance consultation desk',
      slaResponseMin: 10,
      slaResolveMin: 90,
      agentId: 'agent_ploi',
    },
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
    const queue = await prismaClient.queue.upsert({
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

    await prismaClient.queueMember.upsert({
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

    if (q.id === 'queue_central_sales' || q.id === 'queue_central_general') {
      const aliasAgentId = q.agentId === 'agent_sarah' ? 'agent_sarah_01' : 'agent_sarah';
      await prismaClient.queueMember.upsert({
        where: {
          queueId_userId: {
            queueId: queue.id,
            userId: aliasAgentId,
          },
        },
        update: {},
        create: {
          queueId: queue.id,
          userId: aliasAgentId,
        },
      });
    }
  }

  // 3. SurveyConfigs
  const surveyConfigs = [
    {
      queueCode: 'queue_central_general',
      businessUnit: BusinessUnit.CENTRAL,
      qualtricsSurveyId: 'SV_qualtrics_central_general',
      surveyId: 'SV_qualtrics_central_general',
      cooldownHours: 24,
    },
    {
      queueCode: 'queue_central_sales',
      businessUnit: BusinessUnit.CENTRAL,
      qualtricsSurveyId: 'SV_qualtrics_central_general',
      surveyId: 'SV_qualtrics_central_general',
      cooldownHours: 24,
    },
    {
      queueCode: 'queue_central_luxury',
      businessUnit: BusinessUnit.CENTRAL,
      qualtricsSurveyId: 'SV_qualtrics_central_luxury',
      surveyId: 'SV_qualtrics_central_luxury',
      cooldownHours: 24,
    },
    {
      queueCode: 'queue_beauty_advisory',
      businessUnit: BusinessUnit.CENTRAL_BEAUTY_CLUB,
      qualtricsSurveyId: 'SV_qualtrics_beauty_advisory',
      surveyId: 'SV_qualtrics_beauty_advisory',
      cooldownHours: 24,
    },
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
    const queue = await prismaClient.queue.findUnique({ where: { code: cfg.queueCode } });
    if (!queue) continue;

    await prismaClient.surveyConfig.upsert({
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
  }

  // 4. Sample customer
  await prismaClient.customer.upsert({
    where: { externalId: 'U1234567890abcdef' },
    update: {
      displayName: 'K. Somchai Suksan',
      name: 'Somchai Suksan',
      phone: '0812345678',
      email: 'somchai@example.com',
      lineUserId: 'U1234567890abcdef',
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
    },
  });

  // 5. Baseline Portal Links (Phase 3)
  const portalLinks = [
    {
      id: 'portal_aipx',
      title: 'AIPX',
      description: 'AI Product Experience & Catalog Search',
      url: 'https://aipx.central.co.th',
      icon: 'sparkles',
      category: 'CATALOG',
      businessUnits: ['CENTRAL', 'CDS', 'CENTRAL_BEAUTY_CLUB', 'MUJI', 'SSP', 'B2S'],
      allowedRoles: [],
      order: 1,
      isActive: true,
    },
    {
      id: 'portal_the1',
      title: 'The 1 Portal',
      description: 'The 1 Loyalty Member CRM & Points Redemption',
      url: 'https://the1.central.co.th/portal',
      icon: 'users',
      category: 'LOYALTY',
      businessUnits: ['CENTRAL', 'CDS', 'CENTRAL_BEAUTY_CLUB', 'MUJI', 'SSP', 'B2S'],
      allowedRoles: [],
      order: 2,
      isActive: true,
    },
    {
      id: 'portal_operations',
      title: 'Operation Portal',
      description: 'Store Fulfillment & Back-Office Operations Management',
      url: 'https://ops.central.co.th',
      icon: 'briefcase',
      category: 'OPERATIONS',
      businessUnits: ['CENTRAL', 'CDS', 'MUJI', 'SSP', 'B2S'],
      allowedRoles: [],
      order: 3,
      isActive: true,
    },
    {
      id: 'portal_qr',
      title: 'QR Portal',
      description: 'Payment QR Generator & EDC POS Terminal Bridge',
      url: 'https://qr.central.co.th/pos',
      icon: 'qr-code',
      category: 'PAYMENT',
      businessUnits: ['CENTRAL', 'CDS', 'CENTRAL_BEAUTY_CLUB', 'MUJI', 'SSP', 'B2S'],
      allowedRoles: [],
      order: 4,
      isActive: true,
    },
    {
      id: 'portal_delivery',
      title: 'Central Delivery Portal',
      description: 'Omnichannel Express Delivery & Courier Tracking Hub',
      url: 'https://delivery.central.co.th',
      icon: 'truck',
      category: 'LOGISTICS',
      businessUnits: ['CENTRAL', 'CDS', 'CENTRAL_BEAUTY_CLUB', 'MUJI', 'SSP', 'B2S'],
      allowedRoles: [],
      order: 5,
      isActive: true,
    },
  ];

  if ((prismaClient as any).portalLink) {
    for (const pl of portalLinks) {
      await (prismaClient as any).portalLink.upsert({
        where: { id: pl.id },
        update: {
          title: pl.title,
          description: pl.description,
          url: pl.url,
          icon: pl.icon,
          category: pl.category,
          businessUnits: pl.businessUnits,
          allowedRoles: pl.allowedRoles,
          order: pl.order,
          isActive: pl.isActive,
        },
        create: {
          id: pl.id,
          title: pl.title,
          description: pl.description,
          url: pl.url,
          icon: pl.icon,
          category: pl.category,
          businessUnits: pl.businessUnits,
          allowedRoles: pl.allowedRoles,
          order: pl.order,
          isActive: pl.isActive,
        },
      });
    }
  }
}

export async function executeReset() {
  // 1. Transactional wipe of mutable test records in safe foreign-key dependency order (leaf-to-root)
  await prisma.$transaction([
    // Phase 3 child tables (must precede ShippingFulfillment, AgentShift, Quotation, User)
    (prisma as any).shippingTrackingEvent
      ? (prisma as any).shippingTrackingEvent.deleteMany()
      : prisma.case.deleteMany({ where: { id: 'nonexistent' } }),
    (prisma as any).shippingFulfillment
      ? (prisma as any).shippingFulfillment.deleteMany()
      : prisma.case.deleteMany({ where: { id: 'nonexistent' } }),
    (prisma as any).agentBreakSession
      ? (prisma as any).agentBreakSession.deleteMany()
      : prisma.case.deleteMany({ where: { id: 'nonexistent' } }),
    (prisma as any).agentShift
      ? (prisma as any).agentShift.deleteMany()
      : prisma.case.deleteMany({ where: { id: 'nonexistent' } }),
    (prisma as any).portalLink
      ? (prisma as any).portalLink.deleteMany()
      : prisma.case.deleteMany({ where: { id: 'nonexistent' } }),

    // Phase 2 child tables
    (prisma as any).promotion
      ? (prisma as any).promotion.deleteMany()
      : prisma.case.deleteMany({ where: { id: 'nonexistent' } }),

    // Phase 1 and Phase 0 tables
    prisma.cSATResponse.deleteMany(),
    prisma.surveyDispatch.deleteMany(),
    prisma.message.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.quotationItem.deleteMany(),
    prisma.pOSTicket.deleteMany(),
    (prisma as any).pOSBatchUpload
      ? (prisma as any).pOSBatchUpload.deleteMany()
      : prisma.case.deleteMany({ where: { id: 'nonexistent' } }),
    prisma.paymentTransaction.deleteMany(),
    prisma.quotation.deleteMany(),
    prisma.case.deleteMany(),
    prisma.sessionTraffic.deleteMany(),
    prisma.customer.deleteMany({
      where: { externalId: { not: 'U1234567890abcdef' } },
    }),
  ]);

  // 2. Ensure baseline seeded entities
  await seedBaseline(prisma);

  return {
    success: true,
    reset: true,
    backend: 'prisma-postgresql',
    timestamp: new Date().toISOString(),
  };
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await executeReset();
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Failed to reset test database:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reset database' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return DELETE(request);
}
