/**
 * Case Notes Route Handler: /api/cases/[id]/notes
 * Path: src/app/api/cases/[id]/notes/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatMessage } from '@/lib/cases/service';
import { createAuditLog } from '@/lib/audit/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = params.id;
    const targetCase = await prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
    });

    if (!targetCase) {
      return NextResponse.json(
        { error: `Case ${caseId} not found` },
        { status: 404 }
      );
    }

    const notes = await prisma.message.findMany({
      where: {
        caseId: targetCase.id,
        isInternal: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      notes: notes.map(formatMessage),
      total: notes.length,
    });
  } catch (error: any) {
    console.error('Error fetching case notes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = params.id;
    const body = await request.json().catch(() => ({}));

    // 1. Verify Case exists
    const targetCase = await prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { caseNumber: caseId }] },
    });

    if (!targetCase) {
      return NextResponse.json(
        { error: `Case ${caseId} not found` },
        { status: 404 }
      );
    }

    // 2. Closed case guard (T2.6.4: "Cannot send messages or add notes to a closed case")
    if (targetCase.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Cannot send messages or add notes to a closed case' },
        { status: 400 }
      );
    }

    // 3. Extract content & media
    const rawContent = body.content;
    const text = typeof rawContent === 'object' && rawContent !== null
      ? (rawContent.text ?? '')
      : (typeof rawContent === 'string' ? rawContent : (body.text ?? ''));

    const mediaUrl = body.mediaUrl || body.media?.url || (typeof rawContent === 'object' ? rawContent?.mediaUrl : null) || null;
    const fileName = body.fileName || body.media?.fileName || (typeof rawContent === 'object' ? rawContent?.fileName : null) || null;
    const mimeType = body.mimeType || body.media?.mimeType || (typeof rawContent === 'object' ? rawContent?.mimeType : null) || null;
    const fileSize = body.fileSize !== undefined ? body.fileSize : (body.media?.fileSize !== undefined ? body.media.fileSize : (typeof rawContent === 'object' ? rawContent?.fileSize : null));
    const duration = body.duration ?? body.media?.duration ?? (typeof rawContent === 'object' ? rawContent?.duration : null) ?? null;
    const width = body.width ?? body.media?.width ?? (typeof rawContent === 'object' ? rawContent?.width : null) ?? null;
    const height = body.height ?? body.media?.height ?? (typeof rawContent === 'object' ? rawContent?.height : null) ?? null;

    const trimmedText = typeof text === 'string' ? text.trim() : '';

    // 4. Content empty check
    if (!trimmedText && !mediaUrl) {
      return NextResponse.json(
        { error: 'Message or note content cannot be empty' },
        { status: 400 }
      );
    }

    // 5. Max attachment size and character limit check (Tier 5 Remediation)
    const MAX_ATTACHMENT_SIZE = 150 * 1024 * 1024;
    if (fileSize !== null && fileSize !== undefined && Number(fileSize) > MAX_ATTACHMENT_SIZE) {
      return NextResponse.json(
        { error: 'Payload Too Large: maximum attachment size is 150MB' },
        { status: 413 }
      );
    }

    if (typeof text === 'string' && text.length > 50000) {
      return NextResponse.json(
        { error: 'Note exceeds maximum character limit' },
        { status: 413 }
      );
    }

    // 6. Parse @mentions
    const mentions: string[] = [];
    const mentionMatches = (typeof text === 'string' ? text : '').match(/@([a-zA-Z0-9_-]+)/g);
    if (mentionMatches) {
      for (const m of mentionMatches) {
        mentions.push(m.substring(1));
      }
    }

    const agentId = body.agentId || targetCase.ownerId || 'agent_sarah_01';
    let authorId: string | null = null;
    if (agentId) {
      const user = await prisma.user.findUnique({ where: { id: agentId } });
      if (user) {
        authorId = user.id;
      }
    }

    const messageType = body.type || (mediaUrl ? 'IMAGE' : 'TEXT');

    // 7. Create internal whisper note (strictly internal, zero Zwiz dispatch)
    const createdMessage = await prisma.message.create({
      data: {
        caseId: targetCase.id,
        authorId,
        authorType: 'AGENT',
        senderId: agentId,
        direction: 'OUTBOUND',
        type: messageType === 'AUDIO' ? 'TEXT' : (messageType as any),
        content: text,
        mediaUrl,
        fileName,
        mimeType,
        fileSize: fileSize ? Number(fileSize) : null,
        mediaMetadata: {
          mentions,
          isInternal: true,
          originalType: messageType,
          ...(mediaUrl ? { url: mediaUrl, mediaUrl } : {}),
          ...(fileName ? { fileName } : {}),
          ...(mimeType ? { mimeType } : {}),
          ...(fileSize ? { fileSize: Number(fileSize) } : {}),
          ...(width !== null && width !== undefined ? { width: Number(width) } : {}),
          ...(height !== null && height !== undefined ? { height: Number(height) } : {}),
          ...(duration !== null && duration !== undefined ? { duration: Number(duration) } : {}),
        },
        isInternal: true,
        deliveryStatus: 'INTERNAL_ONLY',
      },
    });

    await createAuditLog({
      caseId: targetCase.id,
      actorId: authorId,
      actorName: agentId,
      action: 'NOTE_ADDED',
      actionType: 'NOTE_ADDED',
      entityType: 'Case',
      entityId: targetCase.id,
      details: JSON.stringify({
        messageId: createdMessage.id,
        isInternal: true,
        mentions,
        actorId: body.agentId || agentId,
        actorName: agentId,
      }),
    });

    await prisma.case.update({
      where: { id: targetCase.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(
      {
        success: true,
        message: formatMessage(createdMessage),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error adding case note:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error while adding note' },
      { status: 500 }
    );
  }
}
