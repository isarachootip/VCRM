import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  parseBusinessUnit,
  parseChannel,
  serializeBusinessUnit,
  serializeChannel,
  generateCaseNumber,
  BusinessUnit,
  ChannelType,
  CaseStatus,
  PriorityLevel,
} from '@/lib/cases/service';
import { createAuditLog } from '@/lib/audit/logger';

const ALLOWED_CHANNELS = new Set(['LINE', 'FB', 'IG', 'FACEBOOK', 'INSTAGRAM']);

// Concurrency mutex lock per sessionId to prevent simultaneous case creation races
const sessionLocks = new Map<string, Promise<void>>();

async function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  while (sessionLocks.has(sessionId)) {
    try {
      await sessionLocks.get(sessionId);
    } catch {
      // ignore
    }
  }
  let resolveLock!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  sessionLocks.set(sessionId, lockPromise);
  try {
    return await fn();
  } finally {
    sessionLocks.delete(sessionId);
    resolveLock();
  }
}

export async function POST(request: NextRequest) {
  // 1. JSON parse & malformed check (T2.2.1)
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const { source, session, message, queueId: requestedQueueId, timestamp } = payload;

  // 2. Channel validation (T2.2.2)
  const rawChannel = source?.channel;
  if (rawChannel && !ALLOWED_CHANNELS.has(String(rawChannel).toUpperCase())) {
    return NextResponse.json(
      { error: `Unsupported social channel: ${rawChannel}` },
      { status: 422 }
    );
  }

  // 3. Message validation (T2.1.1, T2.3.1)
  if (message) {
    const rawText = message.text;
    const hasText = typeof rawText === 'string' && rawText.trim().length > 0;
    const hasMedia = Boolean(message.media?.url);

    if (!hasText && !hasMedia) {
      return NextResponse.json(
        { error: 'Message payload cannot be empty' },
        { status: 400 }
      );
    }

    if (typeof rawText === 'string' && rawText.length > 8000) {
      return NextResponse.json(
        { error: 'Message text exceeds maximum length' },
        { status: 413 }
      );
    }
  }

  const messageId = message?.messageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 4. Duplicate check by messageId (T2.5.1)
  if (message?.messageId) {
    const existingMsg = await prisma.message.findUnique({
      where: { messageId: message.messageId },
      include: { case: true },
    });

    if (existingMsg && existingMsg.case) {
      return NextResponse.json(
        {
          success: true,
          caseId: existingMsg.case.id,
          caseNumber: existingMsg.case.caseNumber,
          messageId: existingMsg.messageId,
          duplicate: true,
        },
        { status: 200 }
      );
    }
  }

  // 5. Source extraction & defaults (T2.1.2, T2.1.4)
  const parsedBU = parseBusinessUnit(source?.businessUnit) || BusinessUnit.MUJI;
  const parsedChannel = parseChannel(rawChannel) || ChannelType.LINE;
  const senderId = source?.senderId || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  let senderName = (source?.senderName ?? '').trim();
  if (!senderName) {
    senderName = `Guest Customer (${senderId.substring(0, 6)})`;
  }
  const senderProfileUrl = source?.senderProfileUrl || null;
  const pageId = source?.pageId || 'default_page';
  const pageName = source?.pageName || source?.pageId || 'Default Page';

  // 6. Session extraction
  const sessionId = session?.sessionId || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const sessionStartStr = session?.sessionStart;
  const sessionStartDate = sessionStartStr ? new Date(sessionStartStr) : new Date();

  // 7. Customer resolution & session processing wrapped in session concurrency lock
  return await withSessionLock(sessionId, async () => {
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { externalId: senderId },
          { lineUserId: parsedChannel === ChannelType.LINE ? senderId : undefined },
          { fbPsid: parsedChannel === ChannelType.FACEBOOK ? senderId : undefined },
        ],
      },
    });

    if (!customer) {
      try {
        customer = await prisma.customer.create({
          data: {
            externalId: senderId,
            lineUserId: parsedChannel === ChannelType.LINE ? senderId : null,
            fbPsid: parsedChannel === ChannelType.FACEBOOK ? senderId : null,
            channel: parsedChannel,
            displayName: senderName,
            name: senderName,
            avatarUrl: senderProfileUrl,
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002' || String(err?.message || '').includes('P2002') || String(err?.message || '').includes('Unique constraint failed')) {
          customer = await prisma.customer.findFirst({
            where: {
              OR: [
                { externalId: senderId },
                { lineUserId: parsedChannel === ChannelType.LINE ? senderId : undefined },
                { fbPsid: parsedChannel === ChannelType.FACEBOOK ? senderId : undefined },
              ],
            },
          });
        } else {
          throw err;
        }
      }
    }

    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: { externalId: senderId },
      });
    }

    if (customer) {
      const updates: any = {};
      if (senderProfileUrl && !customer.avatarUrl) {
        updates.avatarUrl = senderProfileUrl;
      }
      if ((!customer.name || customer.name === 'Customer') && senderName) {
        updates.name = senderName;
        updates.displayName = senderName;
      }
      if (Object.keys(updates).length > 0) {
        try {
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: updates,
          });
        } catch {
          // Ignore concurrent update conflicts
        }
      }
    }

    // 8. SessionTraffic Stamping (T1.1.5, T2.5.5)
    let sessionRecord = await prisma.sessionTraffic.findUnique({
      where: { sessionId },
    });

    if (!sessionRecord) {
      try {
        sessionRecord = await prisma.sessionTraffic.create({
          data: {
            sessionId,
            customerId: customer!.id,
            channel: parsedChannel,
            inboundChannel: parsedChannel,
            inboundSource: session?.inboundSource || 'ORGANIC_CHAT',
            pageId,
            businessUnit: parsedBU,
            startDateTime: sessionStartDate,
          },
        });
      } catch (err: any) {
        if (err.code === 'P2002' || String(err?.message || '').includes('P2002') || String(err?.message || '').includes('Unique constraint failed')) {
          sessionRecord = await prisma.sessionTraffic.findUnique({
            where: { sessionId },
          });
        } else {
          throw err;
        }
      }
    }

    // 9. Active Session Reuse (T1.1.4, T2.4.1)
    let targetCase = await prisma.case.findFirst({
      where: {
        customerId: customer!.id,
        sessionId: sessionId,
        status: { in: [CaseStatus.OPEN, CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED] },
      },
      include: {
        customer: true,
        sessionTraffic: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (targetCase && targetCase.status === CaseStatus.RESOLVED) {
      targetCase = await prisma.case.update({
        where: { id: targetCase.id },
        data: {
          status: CaseStatus.IN_PROGRESS,
          resolvedAt: null,
          updatedAt: new Date(),
        },
        include: {
          customer: true,
          sessionTraffic: true,
        },
      });

      await createAuditLog({
        caseId: targetCase.id,
        actorId: null,
        actorName: 'SYSTEM',
        action: 'STATUS_CHANGE',
        actionType: 'CASE_REOPENED',
        entityType: 'Case',
        entityId: targetCase.id,
        field: 'status',
        oldValue: CaseStatus.RESOLVED,
        newValue: CaseStatus.IN_PROGRESS,
        details: JSON.stringify({
          event: 'CASE_REOPENED',
          oldStatus: 'RESOLVED',
          newStatus: 'IN_PROGRESS',
          reason: 'Customer follow-up message received on resolved case',
          messageId,
          sessionId,
        }),
      });
    }

    if (!targetCase) {
      // 10. Queue Routing (T1.1.1, T3.1, T4.1)
      let queueIdToUse = requestedQueueId;
      let targetQueue = null;

      if (queueIdToUse) {
        targetQueue = await prisma.queue.findFirst({
          where: { OR: [{ id: queueIdToUse }, { code: queueIdToUse }] },
        });
        if (!targetQueue) {
          try {
            targetQueue = await prisma.queue.create({
              data: {
                id: queueIdToUse,
                code: queueIdToUse,
                name: queueIdToUse.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                businessUnit: parsedBU,
                slaResponseMin: 15,
                slaResolveMin: 120,
              },
            });
          } catch {
            targetQueue = await prisma.queue.findFirst({
              where: { OR: [{ id: queueIdToUse }, { code: queueIdToUse }] },
            });
          }
        }
      }

      if (!targetQueue) {
        targetQueue = await prisma.queue.findFirst({
          where: { businessUnit: parsedBU },
        });
      }

      if (!targetQueue) {
        targetQueue = await prisma.queue.findFirst();
      }

      if (!targetQueue) {
        targetQueue = await prisma.queue.create({
          data: {
            id: `queue_${parsedBU.toLowerCase()}_default`,
            code: `queue_${parsedBU.toLowerCase()}_default`,
            name: `${serializeBusinessUnit(parsedBU)} General Queue`,
            businessUnit: parsedBU,
            slaResponseMin: 15,
            slaResolveMin: 120,
          },
        });
      }

      queueIdToUse = targetQueue.id;

      // 11. Create Case
      const caseNumber = await generateCaseNumber();
      const caseTitle = message?.text
        ? (message.text.length > 60 ? message.text.substring(0, 60) + '...' : message.text)
        : `Inquiry from ${senderName}`;

      const isCustomerVip = Boolean(customer?.isVip);
      const queuePriority = isCustomerVip ? 100 : 0;

      targetCase = await prisma.case.create({
        data: {
          caseNumber,
          title: caseTitle,
          businessUnit: parsedBU,
          channel: parsedChannel,
          pageId,
          page: pageName,
          status: CaseStatus.OPEN,
          priority: PriorityLevel.MEDIUM,
          queueId: queueIdToUse,
          customerId: customer!.id,
          sessionId: sessionRecord!.sessionId,
          isVip: isCustomerVip,
          queuePriority,
          lastCustomerMessageAt: timestamp ? new Date(timestamp) : new Date(),
        },
        include: {
          customer: true,
          sessionTraffic: true,
        },
      });

      await createAuditLog({
        caseId: targetCase.id,
        actorId: null,
        actorName: 'SYSTEM',
        action: 'CASE_CREATED',
        actionType: 'CASE_CREATED',
        entityType: 'Case',
        entityId: targetCase.id,
        field: 'status',
        oldValue: null as any,
        newValue: CaseStatus.OPEN,
        details: JSON.stringify({
          caseNumber: targetCase.caseNumber,
          channel: serializeChannel(parsedChannel),
          businessUnit: serializeBusinessUnit(parsedBU),
          queueId: queueIdToUse,
          senderId,
        }),
      });
    }

    // 12. Create Inbound Message Record (T1.1.1, T1.1.2, T1.1.3)
    const rawType = message?.type || (message?.media?.url ? 'IMAGE' : 'TEXT');
    const msgText = message?.text || '';
    const mediaUrl = message?.media?.url || null;
    const fileName = message?.media?.fileName || null;
    const mimeType = message?.media?.mimeType || null;
    const fileSize = message?.media?.fileSize ? Number(message.media.fileSize) : null;
    const mediaMetadata: any = message?.media ? { ...message.media } : null;

    let createdMessage;
    try {
      createdMessage = await prisma.message.create({
        data: {
          messageId,
          caseId: targetCase.id,
          authorId: null,
          authorType: 'CUSTOMER',
          direction: 'INBOUND',
          senderId,
          senderName,
          type: rawType === 'AUDIO' ? 'TEXT' : (rawType as any),
          content: msgText,
          mediaUrl,
          fileName,
          mimeType,
          fileSize,
          mediaMetadata,
          isInternal: false,
          deliveryStatus: 'DELIVERED',
          createdAt: timestamp ? new Date(timestamp) : new Date(),
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002' && (err.meta?.target?.includes('messageId') || String(err.message).includes('messageId'))) {
        return NextResponse.json(
          {
            success: true,
            caseId: targetCase.id,
            caseNumber: targetCase.caseNumber,
            messageId,
            duplicate: true,
          },
          { status: 200 }
        );
      }
      throw err;
    }

    // 12.5 Update Case with latest customer activity & sync VIP status
    const isCustVip = Boolean(customer?.isVip);
    await prisma.case.update({
      where: { id: targetCase.id },
      data: {
        lastCustomerMessageAt: timestamp ? new Date(timestamp) : new Date(),
        idleWarningSentAt: null, // Reset idle warning on customer reply (T1.1.6)
        isVip: isCustVip,
        queuePriority: isCustVip ? 100 : 0,
        updatedAt: new Date(),
      },
    });

    // 13. Webhook Response (T1.1.1)
    return NextResponse.json(
      {
        success: true,
        caseId: targetCase.id,
        caseNumber: targetCase.caseNumber,
        status: targetCase.status,
        messageId: createdMessage.messageId || createdMessage.id,
      },
      { status: 200 }
    );
  });
}
