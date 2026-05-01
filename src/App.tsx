import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Briefcase, 
  MapPin, 
  Calendar, 
  ExternalLink, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Sparkles,
  Loader2,
  DollarSign,
  FileText,
  Upload,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JobApplication, ApplicationStatus, NewApplication } from './types';
import * as db from './db';
import * as sync from './syncService';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  'Wishlist': 'bg-slate-100 text-slate-600 border-slate-200',
  'Applied': 'bg-blue-50 text-blue-600 border-blue-100',
  'Interviewing': 'bg-amber-50 text-amber-600 border-amber-100',
  'Offer': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'Rejected': 'bg-rose-50 text-rose-600 border-rose-100',
  'Withdrawn': 'bg-slate-50 text-slate-500 border-slate-200',
};

const STATUS_ICONS: Record<ApplicationStatus, React.ReactNode> = {
  'Wishlist': <Clock className="w-4 h-4" />,
  'Applied': <CheckCircle2 className="w-4 h-4" />,
  'Interviewing': <Clock className="w-4 h-4" />,
  'Offer': <Sparkles className="w-4 h-4" />,
  'Rejected': <XCircle className="w-4 h-4" />,
  'Withdrawn': <XCircle className="w-4 h-4" />,
};

export default function App() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<sync.SyncState>({
    status: 'idle',
    lastSyncTime: null,
    failedAttempts: 0,
  });

  const [formData, setFormData] = useState<NewApplication>({
    company: '',
    position: '',
    status: 'Applied',
    applied_date: new Date().toISOString().split('T')[0],
    url: '',
    location: '',
    salary: '',
    notes: '',
    pdf_data: ''
  });

  useEffect(() => {
    fetchApplications();
    const unsubscribe = sync.subscribeToSync((state) => {
      setSyncState(state);
      // Refresh data when sync succeeds
      if (state.status === 'success') {
        fetchApplications();
      }
    });
    return unsubscribe;
  }, []);

  const fetchApplications = async () => {
    try {
      const data = await db.getApplications();
      setApplications(data);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.saveApplication({
        ...formData,
        id: editingApp?.id
      });
      
      fetchApplications();
      setIsModalOpen(false);
      setEditingApp(null);
      setFormData({
        company: '',
        position: '',
        status: 'Applied',
        applied_date: new Date().toISOString().split('T')[0],
        url: '',
        location: '',
        salary: '',
        notes: '',
        pdf_data: ''
      });
      
      // Trigger background sync
      sync.performSync();
    } catch (error) {
      console.error('Failed to save application:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await db.deleteApplication(id);
      fetchApplications();
      setDeleteConfirmId(null);
      // Trigger background sync
      sync.performSync();
    } catch (error) {
      console.error('Failed to delete application:', error);
    }
  };

  const handleEdit = (app: JobApplication) => {
    setEditingApp(app);
    setFormData({
      company: app.company,
      position: app.position,
      status: app.status,
      applied_date: app.applied_date,
      url: app.url,
      location: app.location,
      salary: app.salary,
      notes: app.notes,
      pdf_data: app.pdf_data
    });
    setIsModalOpen(true);
  };

  const filteredApps = applications.filter(app => {
    const matchesSearch = app.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.position.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!activeFilter || activeFilter === 'Total') return matchesSearch;
    
    if (activeFilter === 'Closed') {
      return matchesSearch && (app.status === 'Rejected' || app.status === 'Withdrawn');
    }
    
    return matchesSearch && app.status === activeFilter;
  });

  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'Applied').length,
    interviewing: applications.filter(a => a.status === 'Interviewing').length,
    offers: applications.filter(a => a.status === 'Offer').length,
    closed: applications.filter(a => a.status === 'Rejected' || a.status === 'Withdrawn').length,
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, pdf_data: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const viewPdf = (pdfData: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<iframe src="${pdfData}" width="100%" height="100%" style="border:none;"></iframe>`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Briefcase className="text-white w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">CareerTrack</h1>
            </div>
            <button 
              onClick={() => { setEditingApp(null); setIsModalOpen(true); }}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-all shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Add Application</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'text-indigo-600', filter: 'Total' },
            { label: 'Applied', value: stats.applied, color: 'text-blue-600', filter: 'Applied' },
            { label: 'Interviewing', value: stats.interviewing, color: 'text-amber-600', filter: 'Interviewing' },
            { label: 'Offers', value: stats.offers, color: 'text-emerald-600', filter: 'Offer' },
            { label: 'Closed', value: stats.closed, color: 'text-slate-600', filter: 'Closed' },
          ].map((stat, i) => (
            <motion.button 
              key={stat.label}
              onClick={() => setActiveFilter(activeFilter === stat.filter ? null : stat.filter)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`bg-white p-4 rounded-2xl border transition-all text-left group ${
                activeFilter === stat.filter 
                  ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-md' 
                  : 'border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md'
              }`}
            >
              <p className="text-sm font-medium text-slate-500 mb-1 group-hover:text-slate-700 transition-colors">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </motion.button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by company or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Job List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="text-slate-300 w-8 h-8" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No applications found</h3>
              <p className="text-slate-500">Start your journey by adding your first job application.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredApps.map((app) => (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow group relative"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shrink-0">
                        <span className="text-xl font-bold text-indigo-600">{app.company[0]}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg leading-tight">{app.position}</h3>
                        <p className="text-slate-600 font-medium">{app.company}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {app.location || 'Remote'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {app.applied_date}
                          </span>
                          {app.salary && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5" />
                              {app.salary}
                            </span>
                          )}
                          {app.pdf_data && (
                            <button 
                              onClick={() => viewPdf(app.pdf_data!)}
                              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View Ad PDF
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[app.status]}`}>
                        {STATUS_ICONS[app.status]}
                        {app.status}
                      </span>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="relative group/tooltip">
                          <button 
                            onClick={() => handleEdit(app)}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-30">
                            Edit
                          </div>
                        </div>

                        <div className="relative group/tooltip">
                          <button 
                            onClick={() => setDeleteConfirmId(app.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-30">
                            Delete
                          </div>
                        </div>

                        {app.url && (
                          <div className="relative group/tooltip">
                            <a 
                              href={app.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-30">
                              View Job
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="text-rose-600 w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Application?</h3>
                <p className="text-slate-500 mb-8">
                  This action cannot be undone. This application will be permanently removed from your database.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 px-6 py-3 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleDelete(deleteConfirmId)}
                    className="flex-1 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl shadow-md shadow-rose-200 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingApp ? 'Edit Application' : 'New Application'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Company Name *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.company}
                      onChange={e => setFormData({...formData, company: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      placeholder="e.g. Google"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Position *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.position}
                      onChange={e => setFormData({...formData, position: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      placeholder="e.g. Senior Frontend Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Status</label>
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as ApplicationStatus})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    >
                      <option value="Wishlist">Wishlist</option>
                      <option value="Applied">Applied</option>
                      <option value="Interviewing">Interviewing</option>
                      <option value="Offer">Offer</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Withdrawn">Withdrawn</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Applied Date</label>
                    <input 
                      type="date" 
                      value={formData.applied_date}
                      onChange={e => setFormData({...formData, applied_date: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Location</label>
                    <input 
                      type="text" 
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      placeholder="e.g. New York, NY or Remote"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Salary Range</label>
                    <input 
                      type="text" 
                      value={formData.salary}
                      onChange={e => setFormData({...formData, salary: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      placeholder="e.g. $120k - $150k"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Job URL</label>
                  <input 
                    type="url" 
                    value={formData.url}
                    onChange={e => setFormData({...formData, url: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    placeholder="https://company.com/careers/job-123"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Job Advertisement PDF</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span className="text-sm text-slate-600">
                        {formData.pdf_data ? 'Change PDF' : 'Upload PDF'}
                      </span>
                      <input 
                        type="file" 
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    {formData.pdf_data && (
                      <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        PDF Attached
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, pdf_data: '' })}
                          className="text-rose-500 hover:text-rose-600 ml-2"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Notes</label>
                  <textarea 
                    rows={3}
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none"
                    placeholder="Add any details about the role, interview process, etc."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-200 transition-all"
                  >
                    {editingApp ? 'Save Changes' : 'Create Application'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-10 z-50 flex items-center px-4 text-xs font-medium text-slate-500">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => sync.manualSync()}
              disabled={syncState.status === 'syncing'}
              className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-100 transition-colors ${
                syncState.status === 'syncing' ? 'text-indigo-600' : ''
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncState.status === 'syncing' ? 'animate-spin' : ''}`} />
              <span>{syncState.status === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            {syncState.lastSyncTime && (
              <span className="text-slate-400">
                Last synced: {new Date(syncState.lastSyncTime).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {syncState.status === 'offline' ? (
                <div className="flex items-center gap-1.5 text-rose-500">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline Mode</span>
                </div>
              ) : syncState.status === 'error' ? (
                <div className="flex items-center gap-1.5 text-amber-500">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Sync Error</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </div>
              )}
            </div>
            <div className={`w-2 h-2 rounded-full ${
              syncState.status === 'syncing' ? 'bg-indigo-500 animate-pulse' :
              syncState.status === 'offline' ? 'bg-rose-500' :
              syncState.status === 'error' ? 'bg-amber-500' :
              'bg-emerald-500'
            }`} />
          </div>
        </div>
      </footer>
    </div>
  );
}
