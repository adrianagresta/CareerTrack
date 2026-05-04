import React from 'react';
import {
  Plus,
  Search,
  Briefcase,
  MapPin,
  Calendar,
  ExternalLink,
  Trash2,
  Edit2,
  Loader2,
  DollarSign,
  FileText,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JobApplicationModel } from '../models';
import { StatCard } from './StatCard';
import { STATUS_COLORS, STATUS_ICONS } from '../constants';

interface MainViewProps {
  stats: {
    total: number;
    applied: number;
    interviewing: number;
    offers: number;
    closed: number;
  };
  activeFilter: string | null;
  setActiveFilter: (filter: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loading: boolean;
  apps: JobApplicationModel[];
  onEdit: (app: JobApplicationModel) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  viewPdf: (pdfData: string) => void;
}

export const MainView: React.FC<MainViewProps> = ({
  stats,
  activeFilter,
  setActiveFilter,
  searchQuery,
  setSearchQuery,
  loading,
  apps,
  onEdit,
  onDelete,
  onAdd,
  viewPdf
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
      {/* Welcome & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Your Pipeline</h2>
          <p className="text-slate-500 mt-1 text-lg">Track and manage your professional opportunities.</p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-2xl transition-all shadow-xl shadow-indigo-200 font-bold active:scale-95 shrink-0"
          id="add-app-main-btn"
        >
          <Plus className="w-5 h-5" />
          <span>Add New Application</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        {[
          { label: 'Total', value: stats.total, color: 'text-indigo-600', filter: 'Total' },
          { label: 'Applied', value: stats.applied, color: 'text-blue-600', filter: 'Applied' },
          { label: 'Interviewing', value: stats.interviewing, color: 'text-amber-600', filter: 'Interviewing' },
          { label: 'Offers', value: stats.offers, color: 'text-emerald-600', filter: 'Offer' },
          { label: 'Closed', value: stats.closed, color: 'text-slate-600', filter: 'Closed' },
        ].map((stat, i) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            color={stat.color}
            filter={stat.filter}
            isActive={activeFilter === stat.filter}
            onClick={() => setActiveFilter(activeFilter === stat.filter ? null : stat.filter)}
            index={i}
          />
        ))}
      </div>

      {/* Search & Filter Header */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 w-5 h-5 transition-colors" />
          <input
            type="text"
            placeholder="Search by company, position, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Job List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Loading your applications...</p>
          </div>
        ) : apps.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Briefcase className="text-slate-300 w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">No applications found</h3>
            <p className="text-slate-500 text-lg max-w-sm mx-auto mb-8">
              {searchQuery || activeFilter
                ? "Try adjusting your filters or search terms to find what you're looking for."
                : "Your pipeline is empty! Click the 'Add New' button to track your first opportunity."}
            </p>
            {(searchQuery || activeFilter) && (
              <button
                onClick={() => { setSearchQuery(''); setActiveFilter(null); }}
                className="text-indigo-600 font-bold hover:text-indigo-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {apps.map((app) => (
              <motion.div
                key={app.id}
                layout
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 hover:shadow-xl hover:border-indigo-100 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-100 group-hover:bg-indigo-500 transition-colors" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pl-2">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shrink-0 shadow-sm group-hover:bg-white transition-colors">
                      <span className="text-2xl font-bold text-indigo-600">{app.company[0]}</span>
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-slate-900 text-xl leading-tight truncate group-hover:text-indigo-600 transition-colors">
                        {app.position}
                      </h3>
                      <p className="text-slate-600 font-semibold text-lg">{app.company}</p>
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1.5 font-medium">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {app.location || 'Remote'}
                          {app.location_type && (
                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded ml-1 text-slate-500 border border-slate-200">
                              {app.location_type}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1.5 font-medium">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          Applied {new Date(app.applied_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {(app.salary_min || app.salary_max) ? (
                          <span className="flex items-center gap-1.5 font-medium text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-100">
                            <DollarSign className="w-3.5 h-3.5" />
                            {app.salary_min && app.salary_max
                              ? `${(app.salary_min / 1000).toFixed(0)}k - ${(app.salary_max / 1000).toFixed(0)}k`
                              : app.salary_min
                                ? `${(app.salary_min / 1000).toFixed(0)}k+`
                                : `Up to ${(app.salary_max! / 1000).toFixed(0)}k`}
                          </span>
                        ) : app.salary && (
                          <span className="flex items-center gap-1.5 font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                            <DollarSign className="w-4 h-4" />
                            {app.salary}
                          </span>
                        )}
                        {app.pdf_data && (
                          <button
                            onClick={(e) => { e.stopPropagation(); viewPdf(app.pdf_data!); }}
                            className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-bold decoration-indigo-600/30 underline underline-offset-4"
                          >
                            <FileText className="w-4 h-4" />
                            Job PDF
                          </button>
                        )}
                        {app.interviews && app.interviews.length > 0 && (
                          <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 font-bold">
                            <Clock className="w-3.5 h-3.5" />
                            {app.interviews.length} {app.interviews.length === 1 ? 'Interview' : 'Interviews'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl text-xs font-bold border-2 ${STATUS_COLORS[app.status]}`}>
                      {STATUS_ICONS[app.status]}
                      {app.status}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEdit(app)}
                        className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all active:scale-95 bg-slate-50 md:bg-transparent"
                        title="Edit Application"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onDelete(app.id)}
                        className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all active:scale-95 bg-slate-50 md:bg-transparent"
                        title="Delete Application"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      {app.url && (
                        <a
                          href={app.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all active:scale-95 bg-slate-50 md:bg-transparent"
                          title="View Online Listing"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};
