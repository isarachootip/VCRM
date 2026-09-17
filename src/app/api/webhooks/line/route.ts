import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getLineConfig } from '@/lib/line/config';
import { verifyLineSignature } from '@/lib/line/signature';
import {
  BusinessUnit,
  ChannelType,
  CaseStatus,
  PriorityLevel,
  generateCaseNumber,
} from '@/lib/cases/service';
import { MessageType, MessageDirection, MessageAuthorType } from '@prisma/client';

interface LineWebhookEvent {
  type: string;
  mode?: string;
  timestamp: number;
  source: {
    type: 'user' | 'group' | 'room';
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  webhookEventId?: string;
  deliveryContext?: {
    isRedelivery: boolean;
  };
  replyToken?: string;
  message?: {
    id: string;
    type: string;
    text?: string;
    quoteToken?: string;
    packageId?: string;
    stickerId?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Helper to fetch LINE User Profile if access token is available
 */
async function fetchLineUserProfile(userId: string, accessToken: string) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error(`Failed to fetch LINE profile for user ${userId}:`, err);
  }
  return null;
}

/**
 * Helper to send reply message via LINE Messaging API
 */
async function replyLineMessage(replyToken: string, text: string, accessToken: string) {
  if (!replyToken || !accessToken || !text) return;
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [
          {
            type: 'text',
            text,
          },
        ],
      }),
    });
  } catch (err) {
    console.error('Failed to send LINE reply message:', err);
  }
}

export async function POST(request: NextRequest) {
  const config = getLineConfig();
  const signature = request.headers.get('x-line-signature');

  // 1. Read raw body for signature verification & JSON parsing
  let rawBody = '';
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // 2. Verify signature if Channel Secret is configured
  if (config.channelSecret) {
    const isValid = verifyLineSignature(rawBody, signature, config.channelSecret);
    if (!isValid) {
      console.warn('[LINE Webhook] Invalid x-line-signature detected');
      return NextResponse.json({ error: 'Invalid x-line-signature' }, { status: 401 });
    }
  }

  // 3. Parse JSON payload
  let payload: { destination?: string; events?: LineWebhookEvent[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
  }

  const events = payload.events || [];

  // 4. LINE Webhook Verification ping (events is empty array)
  if (events.length === 0) {
    return NextResponse.json({ message: 'Webhook verified successfully' }, { status: 200 });
  }

  // 5. Process incoming events asynchronously
  for (const event of events) {
    try {
      const { type, source, message, replyToken } = event;
      const lineUserId = source?.userId;

      if (!lineUserId) continue;

      // Handle message events
      if (type === 'message' && message) {
        let senderName = `LINE User (${lineUserId.substring(0, 6)})`;
        let profilePic: string | null = null;

        // Try to fetch profile from LINE API if token is configured
        if (config.channelAccessToken) {
          const profile = await fetchLineUserProfile(lineUserId, config.channelAccessToken);
          if (profile?.displayName) {
            senderName = profile.displayName;
          }
          if (profile?.pictureUrl) {
            profilePic = profile.pictureUrl;
          }
        }

        // Find or create customer
        let customer = await prisma.customer.findFirst({
          where: {
            OR: [
              { externalId: lineUserId },
              { lineUserId: lineUserId },
            ],
          },
        });

        if (!customer) {
          try {
            customer = await prisma.customer.create({
              data: {
                externalId: lineUserId,
                lineUserId: lineUserId,
                channel: ChannelType.LINE,
                displayName: senderName,
                name: senderName,
                avatarUrl: profilePic,
              },
            });
          } catch (err: any) {
            customer = await prisma.customer.findFirst({
              where: {
                OR: [
                  { externalId: lineUserId },
                  { lineUserId: lineUserId },
                ],
              },
            });
          }
        }

        if (!customer) continue;

        // Find open case or create a new case for this customer
        let activeCase = await prisma.case.findFirst({
          where: {
            customerId: customer.id,
            channel: ChannelType.LINE,
            status: {
              in: [CaseStatus.OPEN, CaseStatus.IN_PROGRESS],
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const isNewCase = !activeCase;
        if (!activeCase) {
          // Find or create default queue for LINE
          let targetQueue = await prisma.queue.findFirst({
            where: { businessUnit: BusinessUnit.MUJI },
          });

          if (!targetQueue) {
            targetQueue = await prisma.queue.findFirst();
          }

          if (!targetQueue) {
            targetQueue = await prisma.queue.create({
              data: {
                id: 'queue_line_muji',
                code: 'queue_line_muji',
                name: 'LINE Muji Support',
                businessUnit: BusinessUnit.MUJI,
                slaResponseMin: 15,
                slaResolveMin: 120,
              },
            });
          }

          const caseNumber = await generateCaseNumber();
          activeCase = await prisma.case.create({
            data: {
              caseNumber,
              title: `LINE Chat: ${senderName}`,
              status: CaseStatus.OPEN,
              priority: PriorityLevel.MEDIUM,
              businessUnit: BusinessUnit.MUJI,
              channel: ChannelType.LINE,
              pageId: 'line_oa',
              page: 'LINE Official Account',
              queueId: targetQueue.id,
              customerId: customer.id,
            },
          });
        }

        // Ingest Message
        const messageText =
          message.type === 'text'
            ? message.text || ''
            : `[${message.type.toUpperCase()}] ${message.id}`;

        const msgId = message.id || `line_msg_${Date.now()}`;

        // Check for duplicate message
        const existingMsg = await prisma.message.findUnique({
          where: { messageId: msgId },
        });

        if (!existingMsg) {
          await prisma.message.create({
            data: {
              caseId: activeCase.id,
              messageId: msgId,
              content: messageText,
              type: message.type === 'image' ? MessageType.IMAGE : MessageType.TEXT,
              direction: MessageDirection.INBOUND,
              authorType: MessageAuthorType.CUSTOMER,
              senderId: lineUserId,
              senderName: senderName,
            },
          });
        }

        // If new case and welcome reply is enabled, send auto-reply
        if (isNewCase && config.autoReplyEnabled && replyToken && config.channelAccessToken) {
          const replyText = config.welcomeMessage || 'สวัสดีครับ ยินดีต้อนรับสู่ VCRM Customer Service เจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุดครับ';
          await replyLineMessage(replyToken, replyText, config.channelAccessToken);
        }
      }
    } catch (eventErr) {
      console.error('[LINE Webhook] Error processing event:', eventErr);
    }
  }

  // Return HTTP 200 OK to acknowledge receipt
  return NextResponse.json({ success: true, processed: events.length }, { status: 200 });
}
