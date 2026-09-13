import { NextRequest, NextResponse } from 'next/server';
import { listCases, createCase } from '@/lib/cases/service';
import { getUserRole, redactCaseFields } from '@/lib/audit/redactor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessUnit = searchParams.get('bu') || searchParams.get('businessUnit') || undefined;
    const queueId = searchParams.get('queueId') || undefined;
    const team = searchParams.get('team') || searchParams.get('queueTeam') || undefined;
    const status = searchParams.get('status') || undefined;
    const channel = searchParams.get('channel') || undefined;
    const ownerId = searchParams.get('ownerId') || undefined;
    const search = searchParams.get('search') || searchParams.get('q') || undefined;
    const page = searchParams.get('page') || undefined;
    const limit = searchParams.get('limit') || undefined;
    const orderBy = (searchParams.get('orderBy') as any) || undefined;
    const orderDir = (searchParams.get('orderDir') as any) || undefined;
    const isVip = searchParams.get('isVip') !== null ? searchParams.get('isVip')! : undefined;

    const result = await listCases({
      businessUnit,
      queueId,
      team,
      status,
      channel,
      ownerId,
      search,
      page,
      limit,
      orderBy,
      orderDir,
      isVip,
    });

    // Apply role-based field redaction on cases
    const role = getUserRole(request);
    const redactedCases = result.cases.map((c: any) =>
      redactCaseFields(c, role, c.queue?.team)
    );

    return NextResponse.json({
      ...result,
      cases: redactedCases,
    });
  } catch (error: any) {
    console.error('Error fetching cases:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch cases' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const newCase = await createCase(body);

    if (!newCase) {
      return NextResponse.json(
        { error: 'Failed to create case' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        case: newCase,
        caseId: newCase.id,
        caseNumber: newCase.caseNumber,
        status: newCase.status,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating case:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create case' },
      { status: 400 }
    );
  }
}
