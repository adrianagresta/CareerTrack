import React, { useMemo, useState } from 'react';
import { AlertCircle, Briefcase, Loader2 } from 'lucide-react';
import { JobApplication, ApplicationStatus } from '../types';
import { STATUS_COLORS, STATUS_ICONS } from '../constants';

interface TableViewProps {
  apps: JobApplication[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  onWithdrawSelected: () => void;
  updateError: string | null;
}

const statuses: ApplicationStatus[] = [
  'Wishlist',
  'Applied',
  'Interviewing',
  'Offer',
  'Rejected',
  'Withdrawn',
];

const formatDate = (date: string | null) => {
  if (!date) return '—';
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const TableView: React.FC<TableViewProps> = ({
  apps,
  loading,
  selectedIds,
  onSelectionChange,
  onWithdrawSelected,
  updateError,
}) => {
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | ''>('');
  const sortedApps = useMemo(() => apps
    .filter(app => !statusFilter || app.status === statusFilter)
    .sort((a, b) => (b.status_date ?? '').localeCompare(a.status_date ?? '')), [apps, statusFilter]);

  const toggleSelection = (id: string, checked: boolean) => {
    const nextSelection = new Set(selectedIds);
    if (checked) nextSelection.add(id);
    else nextSelection.delete(id);
    onSelectionChange(nextSelection);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Table View</h2>
          <p className="text-slate-500 mt-1">Review and manage your applications.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600">
            <span>Job status</span>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as ApplicationStatus | '')}
              className="bg-transparent text-slate-900 focus:outline-none"
            >
              <option value="">All statuses</option>
              {statuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={onWithdrawSelected}
            disabled={selectedIds.size === 0 || loading}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
          >
            Set selected to Withdrawn{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
          </button>
        </div>
      </div>

      {updateError && (
        <div role="alert" className="flex items-center gap-2 mb-5 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {updateError}
        </div>
      )}

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs uppercase tracking-wider text-slate-500">
              <th scope="col" className="w-12 px-5 py-4"><span className="sr-only">Select</span></th>
              <th scope="col" className="px-5 py-4 font-bold">Date</th>
              <th scope="col" className="px-5 py-4 font-bold">Job Title</th>
              <th scope="col" className="px-5 py-4 font-bold">Company</th>
              <th scope="col" className="px-5 py-4 font-bold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-slate-500">
                  <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mx-auto mb-3" />
                  Loading your applications...
                </td>
              </tr>
            ) : sortedApps.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-slate-500">
                  <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  No applications found.
                </td>
              </tr>
            ) : sortedApps.map(app => (
              <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-5 py-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${app.position} at ${app.company}`}
                    checked={selectedIds.has(app.id)}
                    onChange={event => toggleSelection(app.id, event.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                </td>
                <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">{formatDate(app.status_date)}</td>
                <td className="px-5 py-4 min-w-48 font-semibold text-slate-900">{app.position}</td>
                <td className="px-5 py-4 whitespace-nowrap text-slate-700">{app.company}</td>
                <td className="px-5 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold border ${STATUS_COLORS[app.status]}`}>
                    {STATUS_ICONS[app.status]}
                    {app.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
