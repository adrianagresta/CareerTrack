import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { JobApplication, NewApplication, NewInterview, Interview } from './types';
import * as db from './db';
import * as sync from './syncService';

import { MainView } from './components/MainView';
import { ApplicationForm } from './components/ApplicationForm';
import { InterviewForm } from './components/InterviewForm';

export default function App() {
  const [view, setView] = useState<'main' | 'form' | 'interview'>('main');
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingApp, setEditingApp] = useState<JobApplication | null>(null);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);

  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteInterviewId, setDeleteInterviewId] = useState<string | null>(null);
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
    location_type: 'OnSite',
    salary: '',
    salary_min: undefined,
    salary_max: undefined,
    desired_salary_min: undefined,
    desired_salary_max: undefined,
    notes: '',
    pdf_data: ''
  });

  const [interviewData, setInterviewData] = useState<NewInterview>({
    application_id: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    type: 'Phone Screen',
    duration: 30,
    notes: ''
  });

  useEffect(() => {
    fetchApplications();
    const unsubscribe = sync.subscribeToSync((state) => {
      setSyncState(state);
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

      await fetchApplications();
      setView('main');
      setEditingApp(null);
      resetForm();
      sync.performSync();
    } catch (error) {
      console.error('Failed to save application:', error);
    }
  };

  const handleInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check if this is the first interview for this application
      const isFirstInterview = !editingInterview && (!editingApp?.interviews || editingApp.interviews.length === 0);

      await db.saveInterview({
        ...interviewData,
        id: editingInterview?.id
      });

      // Auto-update status to Interviewing if it's the first interview
      if (isFirstInterview && editingApp) {
        await db.saveApplication({
          ...editingApp,
          status: 'Interviewing'
        });
        setFormData(prev => ({ ...prev, status: 'Interviewing' }));
      }

      await fetchApplications();

      // Update editingApp if we are editing
      if (editingApp) {
        const updated = await db.getApplications();
        const freshApp = updated.find(a => a.id === editingApp.id);
        if (freshApp) setEditingApp(freshApp);
      }

      setView('form');
      setEditingInterview(null);
      sync.performSync();
    } catch (error) {
      console.error('Failed to save interview:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      company: '',
      position: '',
      status: 'Applied',
      applied_date: new Date().toISOString().split('T')[0],
      url: '',
      location: '',
      location_type: 'OnSite',
      salary: '',
      salary_min: undefined,
      salary_max: undefined,
      desired_salary_min: undefined,
      desired_salary_max: undefined,
      notes: '',
      pdf_data: ''
    });
  };

  const resetInterviewForm = (applicationId: string) => {
    setInterviewData({
      application_id: applicationId,
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      type: 'Phone Screen',
      duration: 30,
      notes: ''
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await db.deleteApplication(id);
      fetchApplications();
      setDeleteConfirmId(null);
      sync.performSync();
    } catch (error) {
      console.error('Failed to delete application:', error);
    }
  };

  const handleDeleteInterview = async (id: string) => {
    try {
      await db.deleteInterview(id);
      await fetchApplications();

      if (editingApp) {
        const updated = await db.getApplications();
        const freshApp = updated.find(a => a.id === editingApp.id);
        if (freshApp) setEditingApp(freshApp);
      }

      setDeleteInterviewId(null);
      sync.performSync();
    } catch (error) {
      console.error('Failed to delete interview:', error);
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
      location_type: app.location_type || 'OnSite',
      salary: app.salary,
      salary_min: app.salary_min,
      salary_max: app.salary_max,
      desired_salary_min: app.desired_salary_min,
      desired_salary_max: app.desired_salary_max,
      notes: app.notes,
      pdf_data: app.pdf_data
    });
    setView('form');
  };

  const handleAddInterview = (applicationId: string) => {
    resetInterviewForm(applicationId);
    setEditingInterview(null);
    setView('interview');
  };

  const handleEditInterview = (interview: Interview) => {
    setEditingInterview(interview);
    setInterviewData({
      application_id: interview.application_id,
      date: interview.date,
      time: interview.time,
      type: interview.type,
      duration: interview.duration,
      notes: interview.notes
    });
    setView('interview');
  };

  const filteredApps = applications.filter(app => {
    const matchesSearch =
      app.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.location && app.location.toLowerCase().includes(searchQuery.toLowerCase()));

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

  const viewPdf = (pdfData: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<iframe src="${pdfData}" width="100%" height="100%" style="border:none;"></iframe>`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[40]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <button
              onClick={() => setView('main')}
              className="flex items-center gap-3 transition-transform active:scale-95 group"
            >
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:rotate-3 transition-transform">
                <Briefcase className="text-white w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">CareerTrack</h1>
            </button>
            <div className="flex items-center gap-4">
              {view === 'main' && (
                <span className="hidden sm:inline-flex items-center px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-500">
                  {stats.total - stats.closed} OPPORTUNITIES
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {view === 'main' ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <MainView
                stats={stats}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                loading={loading}
                apps={filteredApps}
                onEdit={handleEdit}
                onDelete={setDeleteConfirmId}
                onAdd={() => { setEditingApp(null); resetForm(); setView('form'); }}
                viewPdf={viewPdf}
              />
            </motion.div>
          ) : view === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="py-12 px-4"
            >
              <ApplicationForm
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                onCancel={() => { setView('main'); setEditingApp(null); }}
                editingApp={editingApp}
                onAddInterview={handleAddInterview}
                onEditInterview={handleEditInterview}
                onDeleteInterview={setDeleteInterviewId}
              />
            </motion.div>
          ) : (
            <motion.div
              key="interview"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="py-12 px-4"
            >
              <InterviewForm
                formData={interviewData}
                setFormData={setInterviewData}
                onSubmit={handleInterviewSubmit}
                onCancel={() => setView('form')}
                editingInterview={editingInterview}
                companyName={editingApp?.company || 'Unknown Company'}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {(deleteConfirmId || deleteInterviewId) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setDeleteConfirmId(null); setDeleteInterviewId(null); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden p-10"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="text-rose-600 w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  {deleteInterviewId ? 'Delete Interview?' : 'Remove Application?'}
                </h3>
                <p className="text-slate-500 mb-10 text-lg">
                  {deleteInterviewId
                    ? 'This will permanently remove this interview from your records.'
                    : 'This will permanently delete this opportunity from your tracker. This action cannot be reversed.'}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => { setDeleteConfirmId(null); setDeleteInterviewId(null); }}
                    className="flex-1 px-8 py-4 text-slate-600 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteInterviewId ? handleDeleteInterview(deleteInterviewId) : handleDelete(deleteConfirmId!)}
                    className="flex-1 px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-xl shadow-rose-200 transition-all active:scale-95"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Bar */}
      <footer className="bg-white border-t border-slate-200 h-12 shrink-0 flex items-center px-6 text-xs font-bold text-slate-400 uppercase tracking-widest z-[40]">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-6">
            <button
              onClick={() => sync.manualSync()}
              disabled={syncState.status === 'syncing'}
              className={`flex items-center gap-2 group ${syncState.status === 'syncing' ? 'text-indigo-600' : 'hover:text-indigo-600'
                } transition-colors`}
            >
              <RefreshCw className={`w-4 h-4 ${syncState.status === 'syncing' ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              <span>{syncState.status === 'syncing' ? 'Syncing...' : 'Sync Data'}</span>
            </button>
            {syncState.lastSyncTime && (
              <span className="hidden sm:inline border-l border-slate-200 pl-6">
                Updated: {new Date(syncState.lastSyncTime).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {syncState.status === 'offline' ? (
                <div className="flex items-center gap-2 text-rose-500">
                  <WifiOff className="w-4 h-4" />
                  <span>Offline</span>
                </div>
              ) : syncState.status === 'error' ? (
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertCircle className="w-4 h-4" />
                  <span>Sync Error</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-500">
                  <Wifi className="w-4 h-4" />
                  <span>Connected</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
