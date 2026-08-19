import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('type');

    const jobs = await prisma.jobTicket.findMany({
      where: serviceType ? { serviceType: serviceType as any } : undefined,
      include: {
        customer: true,
        assignments: {
          include: {
            employee: true,
          },
        },
        milestones: true,
        materials: {
          include: {
            inventory: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, jobs });
  } catch (error: any) {
    console.error('Failed to fetch jobs from DB:', error?.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch from DB', fallback: true },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      serviceType,
      description,
      scheduledDate,
      totalAmount,
      employeeId,
    } = body;

    // 1. Find or create customer
    let customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { phone: customerPhone },
          { name: customerName },
        ],
      },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerName || 'General Customer',
          phone: customerPhone,
          email: customerEmail,
          address: customerAddress,
        },
      });
    }

    // 2. Create Job Ticket
    const job = await prisma.jobTicket.create({
      data: {
        customerId: customer.id,
        serviceType: serviceType || 'INSTALL',
        status: 'PENDING',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
        description,
        totalAmount: parseFloat(totalAmount) || 0,
        assignments: employeeId
          ? {
              create: [
                {
                  employeeId,
                },
              ],
            }
          : undefined,
      },
      include: {
        customer: true,
        assignments: {
          include: {
            employee: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, job });
  } catch (error: any) {
    console.error('Failed to create job ticket:', error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create job' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { jobId, status, scheduledDate, description } = body;

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const updatedJob = await prisma.jobTicket.update({
      where: { id: jobId },
      data: {
        status: status ? status : undefined,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        description: description !== undefined ? description : undefined,
      },
    });

    return NextResponse.json({ success: true, job: updatedJob });
  } catch (error: any) {
    console.error('Failed to update job ticket:', error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update job' },
      { status: 500 }
    );
  }
}
