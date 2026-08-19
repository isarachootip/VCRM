import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        assignments: {
          include: {
            job: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, employees });
  } catch (error: any) {
    console.error('Failed to fetch employees:', error?.message);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, role, skills } = body;

    const employee = await prisma.employee.create({
      data: {
        name,
        role: role || 'TECHNICIAN',
        skills: Array.isArray(skills) ? skills : [skills],
      },
    });

    return NextResponse.json({ success: true, employee });
  } catch (error: any) {
    console.error('Failed to create employee:', error?.message);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create employee' },
      { status: 500 }
    );
  }
}
