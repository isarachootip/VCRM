import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/audit/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const {
      eventId,
      surveyId,
      responseId,
      distributionId,
      caseId,
      submittedAt,
      metrics,
      feedback,
    } = body;

    // 1. Metric Validation
    let csatScore: number | undefined = undefined;
    if (metrics?.csatScore !== undefined && metrics?.csatScore !== null) {
      csatScore = Number(metrics.csatScore);
      if (isNaN(csatScore) || csatScore < 1 || csatScore > 5) {
        return NextResponse.json(
          { error: 'csatScore must be between 1 and 5' },
          { status: 422 }
        );
      }
    }

    let npsScore: number | null = null;
    if (metrics?.npsScore !== undefined && metrics?.npsScore !== null) {
      npsScore = Number(metrics.npsScore);
      if (isNaN(npsScore) || npsScore < 0 || npsScore > 10) {
        return NextResponse.json(
          { error: 'npsScore must be between 0 and 10' },
          { status: 422 }
        );
      }
    }

    let cesScore: number | null = null;
    if (metrics?.cesScore !== undefined && metrics?.cesScore !== null) {
      cesScore = Number(metrics.cesScore);
      if (isNaN(cesScore) || cesScore < 1 || cesScore > 5) {
        return NextResponse.json(
          { error: 'cesScore must be between 1 and 5' },
          { status: 422 }
        );
      }
    }

    // Default csatScore to 5 if not supplied in metrics
    const finalCsatScore = csatScore !== undefined ? csatScore : 5;

    // 2. Validate Case ID
    if (!caseId) {
      return NextResponse.json(
        { error: 'Missing required field: caseId' },
        { status: 400 }
      );
    }

    // 3. Idempotency Guard (T1.8.5, T2.5.3)
    if (responseId) {
      const existing = await prisma.cSATResponse.findFirst({
        where: {
          OR: [
            { responseId },
            { qualtricsResponseId: responseId },
          ],
        },
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          caseId: existing.caseId,
          idempotent: true,
          recordedAt: existing.createdAt
            ? existing.createdAt.toISOString()
            : new Date().toISOString(),
        });
      }
    }

    // 4. Resolve Target Case
    const targetCase = await prisma.case.findFirst({
      where: {
        OR: [{ id: caseId }, { caseNumber: caseId }],
      },
      include: { customer: true },
    });

    if (!targetCase) {
      return NextResponse.json(
        { error: `Case ${caseId} not found` },
        { status: 404 }
      );
    }

    const resolvedCaseId = targetCase.id;

    // 5. Normalise feedback comment
    const rawComment = feedback?.comment;
    const comment =
      rawComment !== undefined && rawComment !== null && String(rawComment).trim() !== ''
        ? String(rawComment)
        : null;

    // Submitted at timestamp
    const submittedAtDate = submittedAt ? new Date(submittedAt) : new Date();

    // Final responseId
    const finalResponseId =
      responseId || `R_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 6. Upsert CSATResponse Record
    await prisma.cSATResponse.upsert({
      where: { caseId: resolvedCaseId },
      update: {
        responseId: finalResponseId,
        qualtricsResponseId: finalResponseId,
        distributionId: distributionId || undefined,
        csatScore: finalCsatScore,
        npsScore: npsScore ?? undefined,
        cesScore: cesScore ?? undefined,
        comment,
        feedbackComments: comment,
        submittedAt: submittedAtDate,
        completedAt: new Date(),
      },
      create: {
        caseId: resolvedCaseId,
        responseId: finalResponseId,
        qualtricsResponseId: finalResponseId,
        distributionId: distributionId || null,
        customerId: targetCase.customerId || null,
        agentId: targetCase.ownerId || null,
        businessUnit: targetCase.businessUnit,
        csatScore: finalCsatScore,
        npsScore: npsScore ?? null,
        cesScore: cesScore ?? null,
        comment,
        feedbackComments: comment,
        submittedAt: submittedAtDate,
        completedAt: new Date(),
      },
    });

    // 7. Update Related SurveyDispatches to RESPONDED
    await prisma.surveyDispatch.updateMany({
      where: { caseId: resolvedCaseId },
      data: { status: 'RESPONDED' },
    });

    // 8. Low Score Supervisor Alert Flagging (<= 2 triggers alert)
    const supervisorAlert = Boolean(finalCsatScore <= 2);

    // 9. Log Immutable Audit Log Entry
    await createAuditLog({
      caseId: resolvedCaseId,
      action: 'CSAT_RECORDED',
      actionType: 'CSAT_RECORDED',
      entityType: 'Case',
      entityId: resolvedCaseId,
      details: JSON.stringify({
        csatScore: finalCsatScore,
        npsScore,
        cesScore,
        feedbackComment: comment,
        supervisorAlert,
      }),
    });

    // 10. Return HTTP 200 Success Response
    return NextResponse.json({
      success: true,
      caseId: resolvedCaseId,
      recordedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error processing Qualtrics CSAT webhook:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error processing Qualtrics webhook' },
      { status: 500 }
    );
  }
}
