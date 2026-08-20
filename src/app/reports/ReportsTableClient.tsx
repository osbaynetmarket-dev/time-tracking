'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, CheckCircle, Loader2 } from 'lucide-react';
import { ApprovalClient } from './ApprovalClient';

interface ReportData {
  id: string;
  date: string;
  status: string;
  totalHours: number;
  user: { id: string; name: string };
  project: { id: string; name: string };
  timeLogs: { project: { id: string; name: string } }[];
}

interface ReportsTableClientProps {
  reports: ReportData[];
  isAdminOrAccounting: boolean;
}

export function ReportsTableClient({ reports, isAdminOrAccounting }: ReportsTableClientProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  const approvableIds = reports
    .filter(r => r.status === 'PENDING' || r.status === 'LATE')
    .map(r => r.id);

  const allSelected = approvableIds.length > 0 && approvableIds.every(id => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(approvableIds));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkApproving(true);
    try {
      const res = await fetch('/api/reports/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportIds: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error('Bulk approve failed');
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      console.error(e);
      alert('An error occurred while approving reports.');
    } finally {
      setIsBulkApproving(false);
    }
  };

  return (
    <>
      {isAdminOrAccounting && someSelected && (
        <div className="flex items-center gap-3 px-6 py-3 bg-success/5 border-b border-success/10">
          <span className="text-sm text-slate-300">
            {selectedIds.size} report{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkApprove}
            disabled={isBulkApproving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-success hover:bg-success/90 text-white rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
          >
            {isBulkApproving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Approve Selected ({selectedIds.size})
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/5">
              {isAdminOrAccounting && (
                <th className="p-4 w-12">
                  {approvableIds.length > 0 && (
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 cursor-pointer accent-emerald-500" />
                  )}
                </th>
              )}
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Report Date</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Staff Member</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Projects</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Total Hours</th>
              <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
              {isAdminOrAccounting && (
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {reports.map(report => {
              const isApprovable = report.status === 'PENDING' || report.status === 'LATE';
              const isChecked = selectedIds.has(report.id);
              return (
                <tr key={report.id} className={`hover:bg-white/[0.02] ${isChecked ? 'bg-success/[0.03]' : ''}`}>
                  {isAdminOrAccounting && (
                    <td className="p-4">
                      {isApprovable ? (
                        <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(report.id)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 cursor-pointer accent-emerald-500" />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </td>
                  )}
                  <td className="p-4 text-sm font-medium text-white">
                    {new Date(report.date).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-sm text-slate-300">{report.user.name}</td>
                  <td className="p-4 text-sm text-slate-300">
                    <div className="flex flex-wrap gap-1">
                      {report.timeLogs.length > 0
                        ? report.timeLogs.map((log) => (
                            <span key={log.project.id} className="px-2 py-0.5 bg-white/5 rounded text-xs whitespace-nowrap">
                              {log.project.name}
                            </span>
                          ))
                        : <span className="px-2 py-0.5 bg-white/5 rounded text-xs">{report.project.name}</span>
                      }
                    </div>
                  </td>
                  <td className="p-4 text-sm font-medium">{report.totalHours} hrs</td>
                  <td className="p-4 text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      report.status === 'APPROVED' ? 'bg-success/10 text-success border-success/20' :
                      report.status === 'LATE' ? 'bg-danger/10 text-danger border-danger/20' :
                      report.status === 'PENDING' ? 'bg-warning/10 text-warning border-warning/20' :
                      report.status === 'REJECTED' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : ''
                    }`}>
                      {report.status}
                    </span>
                  </td>
                  {isAdminOrAccounting && (
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <Link href={`/reports/${report.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-md transition-colors text-sm">
                          <Eye size={14} />
                          View
                        </Link>
                        {isApprovable && (
                          <ApprovalClient action="APPROVE" reportId={report.id} />
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {reports.length === 0 && (
              <tr>
                <td colSpan={isAdminOrAccounting ? 7 : 5} className="p-8 text-center text-slate-400">
                  No reports found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
