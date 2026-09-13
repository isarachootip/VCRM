/**
 * API Route: POST /api/chat/outbound
 * Path: src/app/api/chat/outbound/route.ts
 *
 * Implements Manual Outbound Chat Initiation (Phase 1 R4):
 * - Dispatches proactive message to customer via zwizClient.sendMessage.
 * - Creates or attaches to an active Case and logs message with direction = 'OUTBOUND'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  CaseStatus,
  BusinessUnit,
  ChannelType,
  MessageDirection,
  MessageType,
  MessageAuthorType,
  DeliveryStatus,
} from '@prisma/client';
import { zwizClient } from '@/lib/zwiz/client';
import { createAuditLog } from '@/lib/audit/logger';
import {
  formatCaseForResponse,
  formatMessage,
  parseBusinessUnit,
  parseChannel,
  serializeChannel,
} from '@/lib/cases/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const recipientId = body.recipientId || body.channelUserId || body.customerId;
    const text = body.text || body.message || body.content;
    const rawChannel = body.channel || 'LINE';
    const rawBU = body.businessUnit || body.bu || 'Central';
    const pageId = body.pageId || 'central_official';
    const agentId = body.agentId || body.ownerId || null;
    const caseId = body.caseId;
    const templateId = body.templateId;

    if (!recipientId || typeof recipientId !== 'string' || !recipientId.trim()) {
      return NextResponse.json(
        { error: 'recipientId is required for outbound chat initiation' },
        { status: 400 }
      );
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Message text cannot be empty for outbound chat' },
        { status: 400 }
      );
    }

    const trimmedText = text.trim();
    const parsedChannel = parseChannel(rawChannel) || ChannelType.LINE;
    const parsedBU = parseBusinessUnit(rawBU) || BusinessUnit.CENTRAL;

    // 1. Resolve or create Customer
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { externalId: recipientId },
          { lineUserId: recipientId },
          { id: recipientId },
        ],
      },
    });

    if (!customer) {
      const defaultName = body.recipientName || `Customer (${recipientId.slice(0, 8)})`;
      try {
        customer = await prisma.customer.create({
          data: {
            externalId: recipientId,
            lineUserId: parsedChannel === ChannelType.LINE ? recipientId : null,
            channel: parsedChannel,
            displayName: defaultName,
            name: defaultName,
          },
        });
      } catch (err: any) {
        customer = await prisma.customer.findFirst({
          where: { externalId: recipientId },
        });
      }
    }

    if (!customer) {
      return NextResponse.json(
        { error: 'Failed to resolve customer for outbound initiation' },
        { status: 500 }
      );
    }

    // 2. Resolve or create active Case
    let targetCase: any = null;
    if (caseId) {
      targetCase = await prisma.case.findFirst({
        where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
        include: { customer: true, queue: true, owner: true },
      });
    }

    if (!targetCase) {
      // Find existing active case for this customer
      targetCase = await prisma.case.findFirst({
        where: {
          customerId: customer.id,
          status: { in: [CaseStatus.OPEN, CaseStatus.IN_PROGRESS] },
        },
        include: { customer: true, queue: true, owner: true },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!targetCase) {
      // Find default queue for BU
      let queue = await prisma.queue.findFirst({
        where: { businessUnit: parsedBU },
      });
      if (!queue) {
        queue = await prisma.queue.findFirst();
      }

      const caseNumber = `CAS-OUT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      targetCase = await prisma.case.create({
        data: {
          caseNumber,
          title: `Outbound: ${trimmedText.substring(0, 45)}...`,
          businessUnit: parsedBU,
          channel: parsedChannel,
          pageId,
          status: CaseStatus.IN_PROGRESS,
          queueId: queue ? queue.id : 'queue_central_sales',
          ownerId: agentId || null,
          customerId: customer.id,
        },
        include: { customer: true, queue: true, owner: true },
      });
    }

    // 3. Dispatch proactive message to Zwiz Outbound Gateway
    const targetRecipientId = (customer as any).channelUserId || customer.externalId || recipientId;
    const zwizResult = await zwizClient.sendMessage({
      caseId: targetCase.id,
      recipientId: targetRecipientId,
      channel: serializeChannel(parsedChannel),
      pageId,
      message: {
        messageType: 'TEXT',
        content: { text: trimmedText },
      },
      metadata: {
        agentId: agentId || 'AGENT_OUTBOUND',
        templateId,
        sentAt: new Date().toISOString(),
      },
    });

    // 4. Persist Outbound Message in Database
    const message = await prisma.message.create({
      data: {
        caseId: targetCase.id,
        authorId: agentId,
        authorType: MessageAuthorType.AGENT,
        senderId: agentId || 'AGENT_OUTBOUND',
        senderName: agentId || 'Agent',
        direction: MessageDirection.OUTBOUND,
        type: MessageType.TEXT,
        content: trimmedText,
        deliveryStatus: DeliveryStatus.DELIVERED,
        isInternal: false,
        zwizMessageId: zwizResult?.messageId || null,
      },
    });

    // 5. Create Audit Log
    await createAuditLog({
      caseId: targetCase.id,
      action: 'OUTBOUND_CHAT_INITIATED',
      actionType: 'OUTBOUND_CHAT_INITIATED',
      entityType: 'Case',
      entityId: targetCase.id,
      actorId: agentId,
      details: JSON.stringify({
        recipientId: targetRecipientId,
        channel: serializeChannel(parsedChannel),
        templateId,
        textPreview: trimmedText.substring(0, 80),
        messageId: message.id,
      }),
    });

    return NextResponse.json(
      {
        success: true,
        caseId: targetCase.id,
        messageId: message.id,
        case: formatCaseForResponse(targetCase),
        message: formatMessage(message),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error initiating outbound chat:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to dispatch outbound chat' },
      { status: 500 }
    );
  }
}
