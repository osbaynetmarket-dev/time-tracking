import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import DashboardLayout from '@/components/DashboardLayout';
import { ReportFilters } from '@/components/ReportFilters';
import { FileText } from 'lucide-react';
import { ReportsTableClient } from './ReportsTableClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }
) {
  const searchParams = await props.searchParams;
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;

  if (!userId) redirect('/login');

  const currentUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!currentUser) redirect('/login');

  const isAdminOrAccounting = ['SUPERADMIN', 'ADMIN', 'ACCOUNTING'].includes(currentUser.role);
  // Parse filters
  const filterUserId = typeof searchParams?.userId === 'string' ? searchParams.userId : undefined;
  const filterDateStr = typeof searchParams?.date === 'string' ? searchParams.date : undefined;
  const filterStatus = typeof searchParams?.status === 'string' ? searchParams.status : undefined;

  let dateFilter = {};
  if (filterDateStr) {
    const startOfDay = new Date(`${filterDateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${filterDateStr}T23:59:59.999Z`);
    dateFilter = {
      date: {
        gte: startOfDay,
        lte: endOfDay
      }
    };
  }

  // Base where clause depends on role
  const baseWhere: Record<string, unknown> = isAdminOrAccounting ? {} : { userId: currentUser.id };
  
  // Apply explicit filters if present
  if (filterUserId && isAdminOrAccounting) {
    baseWhere.userId = filterUserId;
  }

  // Apply status filter if present
  if (filterStatus) {
    baseWhere.status = filterStatus;
  }
  
  const finalWhere = {
    ...baseWhere,
    ...dateFilter
  };

  const allReports = await prisma.report.findMany({
    where: finalWhere,
    include: {
      user: true,
      project: true,
      timeLogs: {
        include: { project: true },
        distinct: ['projectId'],
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const allUsers = isAdminOrAccounting 
    ? await prisma.user.findMany({ 
        where: { role: { notIn: ['SUPERADMIN', 'ADMIN'] } },
        orderBy: { name: 'asc' }, 
        select: { id: true, name: true, role: true } 
      })
    : [];

  return (
    <DashboardLayout userName={currentUser.name} role={currentUser.role}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileText className="text-primary" size={28} />
            Daily Reports
          </h1>
          <p className="text-slate-400 mt-1">Review and approve submitted time reports.</p>
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-bold">Report Inbox</h2>
        </div>
        
        {isAdminOrAccounting && <ReportFilters users={allUsers} />}

        <ReportsTableClient
          reports={allReports.map(report => ({
            id: report.id,
            date: report.date.toISOString(),
            status: report.status,
            totalHours: report.totalHours,
            user: { id: report.user.id, name: report.user.name },
            project: { id: report.project.id, name: report.project.name },
            timeLogs: report.timeLogs.map(log => ({
              project: { id: log.project.id, name: log.project.name }
            }))
          }))}
          isAdminOrAccounting={isAdminOrAccounting}
        />
      </div>
    </DashboardLayout>
  );
}
