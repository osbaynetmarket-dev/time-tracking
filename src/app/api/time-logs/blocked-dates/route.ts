import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ReportStatus } from '@prisma/client';

/**
 * GET /api/time-logs/blocked-dates
 * Returns dates where the user has time logs in approved reports.
 * Staff cannot create new time logs on these dates.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Calculate the 3-day window (today, yesterday, day before yesterday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - 2);
    const maxDate = new Date(today);
    maxDate.setHours(23, 59, 59, 999);

    // Find all time logs for the user within the 3-day window that are part of approved reports
    const timeLogs = await prisma.timeLog.findMany({
      where: {
        userId,
        date: {
          gte: minDate,
          lte: maxDate,
        },
        reportId: {
          not: null, // Has a report
        },
        report: {
          status: {
            in: [ReportStatus.APPROVED, ReportStatus.LATE], // Report is approved or late (both are locked)
          },
        },
      },
      select: {
        date: true,
      },
    });

    // Extract unique dates and format them as YYYY-MM-DD
    const blockedDates = Array.from(
      new Set(
        timeLogs.map((log) => {
          const d = new Date(log.date);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        })
      )
    );

    return NextResponse.json({ blockedDates });
  } catch (error) {
    console.error('Failed to fetch blocked dates:', error);
    return NextResponse.json({ error: 'Failed to fetch blocked dates' }, { status: 500 });
  }
}
