import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ReportStatus } from '@prisma/client';

async function recalculateMonthlyPayroll(userId: string, reportDate: Date) {
  const month = reportDate.getMonth() + 1;
  const year = reportDate.getFullYear();
  const monthStart = new Date(year, reportDate.getMonth(), 1);
  const monthEnd = new Date(year, reportDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const [user, reports] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { costPerHour: true }
    }),
    prisma.report.findMany({
      where: {
        userId,
        date: {
          gte: monthStart,
          lte: monthEnd
        },
        status: {
          in: [ReportStatus.APPROVED, ReportStatus.LATE]
        }
      },
      select: {
        id: true,
        totalHours: true,
        status: true
      }
    })
  ]);

  const baseRate = user?.costPerHour ?? 0;
  let totalHours = 0;
  let lateHours = 0;
  let totalAmount = 0;

  for (const monthReport of reports) {
    totalHours += monthReport.totalHours;
    const isLate = monthReport.status === ReportStatus.LATE;
    if (isLate) {
      lateHours += monthReport.totalHours;
    }
    const reportCost = monthReport.totalHours * (isLate ? baseRate * 0.5 : baseRate);
    totalAmount += reportCost;

    await prisma.report.update({
      where: { id: monthReport.id },
      data: { totalCost: reportCost }
    });
  }

  if (reports.length === 0) {
    await prisma.monthlyPayroll.deleteMany({
      where: { userId, month, year }
    });
    return;
  }

  await prisma.monthlyPayroll.upsert({
    where: {
      userId_month_year: { userId, month, year }
    },
    update: {
      totalHours,
      lateHours,
      totalAmount
    },
    create: {
      userId,
      month,
      year,
      totalHours,
      lateHours,
      totalAmount,
      status: 'DRAFT'
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { reportIds } = body;

    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      return NextResponse.json({ error: 'No report IDs provided' }, { status: 400 });
    }

    // Fetch all target reports
    const reports = await prisma.report.findMany({
      where: {
        id: { in: reportIds },
        status: { in: [ReportStatus.PENDING, ReportStatus.LATE] }
      },
      include: { user: true }
    });

    if (reports.length === 0) {
      return NextResponse.json({ error: 'No eligible reports found' }, { status: 400 });
    }

    const results = [];

    for (const report of reports) {
      // Preserve LATE status when admin "approves" a late report.
      const nextStatus =
        report.status === ReportStatus.LATE
          ? ReportStatus.LATE
          : ReportStatus.APPROVED;

      const updatedReport = await prisma.report.update({
        where: { id: report.id },
        data: {
          status: nextStatus
        }
      });

      // Recalculate monthly payroll
      await recalculateMonthlyPayroll(report.userId, new Date(report.date));

      results.push(updatedReport);
    }

    return NextResponse.json({
      approved: results.length,
      results
    });
  } catch (error) {
    console.error('Failed to bulk approve reports:', error);
    return NextResponse.json({ error: 'Failed to bulk approve reports' }, { status: 500 });
  }
}