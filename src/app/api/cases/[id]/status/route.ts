import { NextRequest, NextResponse } from 'next/server';
import { transitionCaseStatus, parseCaseStatus, getCaseById, parseBusinessUnit } from '@/lib/cases/service';
import { createAuditLog } from '@/lib/audit/logger';
import { prisma } from '@/lib/db';
import { qualtricsClient } from '@/lib/qualtrics/client';

async function handleStatusTransition(
  request: NextRequest,
  params: { id: string }
) {
  try {
    const caseId = params.id;
    const body = await request.json().catch(() => ({}));

    if (!body.status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    const targetStatus = parseCaseStatus(body.status);
    if (!targetStatus) {
      return NextResponse.json(
        { error: `Invalid status transition: ${body.status}` },
        { status: 400 }
      );
    }

    const result = await transitionCaseStatus(caseId, targetStatus, {
      closureReason: body.closureReason,
      resolutionCategory: body.resolutionCategory,
      resolutionNotes: body.resolutionNotes,
      actorId: body.actorId,
      actorName: body.actorName,
    });

    // Optional Side-effects on Case Closure (Hook for Zwiz bot sync and Qualtrics CSAT)
    const targetCase = result.case;
    if (targetStatus === 'CLOSED' && targetCase && !result.idempotent) {
      const caseIdForSync = targetCase.id;
      const zwizBase = process.env.ZWIZ_API_BASE_URL || process.env.ZWIZ_API_BASE || process.env.ZWIZ_MOCK_URL || 'http://127.0.0.1:4010';
      const qualtricsBase = process.env.QUALTRICS_API_BASE || process.env.QUALTRICS_MOCK_URL || 'http://127.0.0.1:4020';

      const channelUserId = targetCase.customer?.channelUserId || targetCase.customer?.externalId;
      if (channelUserId) {
        try {
          const zwizResp = await fetch(`${zwizBase}/mock/zwiz/v1/users/${channelUserId}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: channelUserId,
              sessionId: targetCase.session?.sessionId || targetCase.sessionId,
              caseId: caseIdForSync,
              botState: 'ACTIVE',
              action: 'RESET_TO_MAIN_MENU',
              closedAt: targetCase.closedAt
                ? (targetCase.closedAt instanceof Date ? targetCase.closedAt.toISOString() : targetCase.closedAt)
                : new Date().toISOString(),
              closureReason: body.closureReason || 'RESOLVED_BY_AGENT',
            }),
            signal: AbortSignal.timeout(1500),
          });

          await createAuditLog({
            caseId: caseIdForSync,
            action: zwizResp.ok ? 'BOT_STATE_SYNC_SUCCESS' : 'BOT_STATE_SYNC_FAILED',
            entityType: 'Case',
            entityId: caseIdForSync,
          });
        } catch {
          await createAuditLog({
            caseId: caseIdForSync,
            action: 'BOT_STATE_SYNC_FAILED',
            entityType: 'Case',
            entityId: caseIdForSync,
          });
        }
      }

      const isSpam =
        body.closureReason === 'SPAM_OR_WRONG_NUMBER' ||
        body.resolutionCategory === 'SPAM';

      if (isSpam) {
        // Spam suppression: record survey dispatch as EXEMPT and do not contact Qualtrics
        await prisma.surveyDispatch.create({
          data: {
            caseId: caseIdForSync,
            surveyId: 'SV_qualtrics_exempt',
            status: 'EXEMPT',
          },
        });

        await createAuditLog({
          caseId: caseIdForSync,
          action: 'CSAT_SURVEY_EXEMPT',
          entityType: 'Case',
          entityId: caseIdForSync,
          details: JSON.stringify({
            reason: body.closureReason || body.resolutionCategory || 'SPAM',
            surveyId: 'SV_qualtrics_exempt',
            status: 'EXEMPT',
          }),
        });
      } else {
        // 24-hour customer cooldown check
        const customerId = targetCase.customerId || targetCase.customer?.id;
        const inCooldown = customerId
          ? await qualtricsClient.isCustomerInCooldown(customerId, 24)
          : false;

        if (inCooldown) {
          await prisma.surveyDispatch.create({
            data: {
              caseId: caseIdForSync,
              surveyId: 'SV_qualtrics_exempt',
              status: 'EXEMPT',
            },
          });

          await createAuditLog({
            caseId: caseIdForSync,
            action: 'CSAT_SURVEY_COOLDOWN_EXEMPT',
            entityType: 'Case',
            entityId: caseIdForSync,
            details: JSON.stringify({
              reason: 'Customer in 24-hour survey cooldown',
              customerId,
              status: 'EXEMPT',
            }),
          });
        } else {
          // Derive surveyId based on relational SurveyConfig or business unit fallback (Tier 5 Remediation)
          const buCode = String(targetCase.bu || targetCase.businessUnit || 'central')
            .toLowerCase()
            .replace(/\s+/g, '_');
          let surveyId = `SV_qualtrics_${buCode}`;

          if (targetCase.queueId) {
            try {
              const parsedBU = parseBusinessUnit(targetCase.businessUnit || targetCase.bu);
              const targetBU = (parsedBU || targetCase.businessUnit) as any;
              const surveyConfig = await prisma.surveyConfig.findFirst({
                where: {
                  queueId: targetCase.queueId,
                  businessUnit: targetBU,
                  isActive: true,
                },
              });
              if (surveyConfig) {
                surveyId = surveyConfig.qualtricsSurveyId || surveyConfig.surveyId || surveyId;
              }
            } catch (err) {
              console.warn('Could not resolve survey config:', err);
            }
          }

          try {
            const qualtricsResp = await qualtricsClient.triggerDistribution({
              surveyId,
              caseId: caseIdForSync,
              caseNumber: targetCase.caseNumber,
              businessUnit: targetCase.bu || targetCase.businessUnit,
              queueId: targetCase.queueId,
              channel: targetCase.channel,
              recipient: {
                customerId: targetCase.customerId || targetCase.customer?.id,
                name: targetCase.customer?.name || targetCase.customer?.displayName || 'Customer',
                channelUserId:
                  targetCase.customer?.channelUserId ||
                  targetCase.customer?.externalId ||
                  targetCase.customerId,
              },
              embeddedData: {
                agentId: targetCase.ownerId || 'unassigned',
                agentName: targetCase.owner?.name,
                closureTimestamp: targetCase.closedAt
                  ? (targetCase.closedAt instanceof Date
                      ? targetCase.closedAt.toISOString()
                      : targetCase.closedAt)
                  : new Date().toISOString(),
              },
            });

            const distributionId =
              qualtricsResp.result?.id || (qualtricsResp as any).id;

            await prisma.surveyDispatch.create({
              data: {
                caseId: caseIdForSync,
                surveyId,
                distributionId,
                status: 'DISPATCHED',
                dispatchedAt: new Date(),
              },
            });

            await createAuditLog({
              caseId: caseIdForSync,
              action: 'CSAT_SURVEY_DISPATCHED',
              entityType: 'Case',
              entityId: caseIdForSync,
              details: JSON.stringify({
                distributionId,
                surveyId,
                queueId: targetCase.queueId,
                businessUnit: targetCase.businessUnit,
              }),
            });
          } catch (err: any) {
            console.error('Failed to dispatch Qualtrics survey:', err.message);
            await prisma.surveyDispatch.create({
              data: {
                caseId: caseIdForSync,
                surveyId,
                status: 'FAILED_RETRY',
                errorMessage: err.message || 'Qualtrics dispatch failed',
                retryCount: 1,
              },
            });

            await createAuditLog({
              caseId: caseIdForSync,
              action: 'CSAT_SURVEY_FAILED',
              entityType: 'Case',
              entityId: caseIdForSync,
              details: JSON.stringify({
                error: err.message,
                surveyId,
              }),
            });
          }
        }
      }
    }

    // Refresh case to include newly logged sync events if any
    const latestCase = (await getCaseById(caseId)) || result.case;

    return NextResponse.json({
      success: true,
      case: latestCase,
      idempotent: result.idempotent ?? false,
    });
  } catch (error: any) {
    console.error('Error transitioning case status:', error);
    const msg = error.message || 'Status transition failed';
    const isNotFound = msg.includes('not found');
    return NextResponse.json(
      { error: msg },
      { status: isNotFound ? 404 : 400 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleStatusTransition(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleStatusTransition(request, params);
}
