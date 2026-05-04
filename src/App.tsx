import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { initDB } from './db';
import { ApplicationService, InterviewService } from './services';
import { getSyncManager, SyncState } from './syncManager';
import { getViewStateManager } from './viewStateManager';
import { getEventBus } from './eventBus';
import { logError } from './errors';
import { JobApplicationModel } from './models';

import { MainView } from './components/MainView';
import { ApplicationForm } from './components/ApplicationForm';
import { InterviewForm } from './components/InterviewForm';

export default function App() {
  // Services and managers
  const [appService, setAppService] = useState<ApplicationService | null>(null);
  const [interviewService, setInterviewService] = useState<InterviewService | null>(null);
  const syncManager = getSyncManager();
  const viewStateManager = getViewStateManager();
  const eventBus = getEventBus();

  // UI state
  const [, setRenderTrigger] = useState({});
  const [applications, setApplications] = useState<JobApplicationModel[]>([]);
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncTime: null,
    failedAttempts: 0,
  });

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        const db = await initDB();
        setAppService(new ApplicationService(db));
        setInterviewService(new InterviewService(db));
      } catch (error) {
        logError(error);
      }
    };
    initializeServices();
  }, []);

  // Load applications
  const fetchApplications = useCallback(async () => {
    if (!appService) return;
    try {
      viewStateManager.setLoading(true);
      const apps = await appService.getAllApplications();
      setApplications(apps);
    } catch (error) {
      logError(error);
    } finally {
      viewStateManager.setLoading(false);
    }
  }, [appService, viewStateManager]);

  // Setup subscriptions and effects
  useEffect(() => {
    fetchApplications();
    const unsubscribeSyncState = syncManager.subscribeToSync((state) => {
      setSyncState(state);
      if (state.status === 'success') {
        fetchApplications();
      }
    });

    const unsubscribeViewState = viewStateManager.subscribe(() => {
      setRenderTrigger({});
    });

    return () => {
      unsubscribeSyncState();
      unsubscribeViewState();
    };
  }, [syncManager, viewStateManager, fetchApplications]);

  // Handle application submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appService) return;

    try {
      const formData = viewStateManager.getFormData();
      const editingApp = viewStateManager.getEditingApp();

      await appService.saveApplication({
        ...formData,
        id: editingApp?.id,
      });

      await fetchApplications();
      viewStateManager.setView('main');
      viewStateManager.resetFormData();
      syncManager.performSync();
    } catch (error) {
      logError(error);
    }
  };

  // Handle interview submission
  const handleInterviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewService || !appService) return;

    try {
      const interviewData = viewStateManager.getInterviewData();
      const editingInterview = viewStateManager.getEditingInterview();
      const editingApp = viewStateManager.getEditingApp();

      const { statusChanged } = await interviewService.saveInterview(
        {
          ...interviewData,
          id: editingInterview?.id,
        },
        appService
      );

      if (statusChanged && editingApp) {
        const updated = await appService.getApplication(editingApp.id);
        if (updated) viewStateManager.setEditingApp(updated);
      }

      await fetchApplications();
      viewStateManager.setView('form');
      viewStateManager.resetInterviewData(interviewData.application_id);
      syncManager.performSync();
    } catch (error) {
      logError(error);
    }
  };

  // Handle delete application
  const handleDelete = async (id: string) => {
    if (!appService) return;
    try {
      await appService.deleteApplication(id);
      await fetchApplications();
      viewStateManager.setDeleteConfirmId(null);
      syncManager.performSync();
    } catch (error) {
      logError(error);
    }
  };

  // Handle delete interview
  const handleDeleteInterview = async (id: string) => {
    if (!interviewService) return;
    try {
      await interviewService.deleteInterview(id);
      const editingApp = viewStateManager.getEditingApp();
      if (editingApp) {
        const updated = await appService?.getApplication(editingApp.id);
        if (updated) viewStateManager.setEditingApp(updated);
      }
      await fetchApplications();
      viewStateManager.setDeleteInterviewId(null);
      syncManager.performSync();
    } catch (error) {
      logError(error);
    }
  };

  // Handle edit application
  const handleEdit = (app: JobApplicationModel) => {
    viewStateManager.loadFormDataFromApp(app);
    viewStateManager.setView('form');
  };

  // Handle add interview
  const handleAddInterview = (applicationId: string) => {
    viewStateManager.resetInterviewData(applicationId);
    viewStateManager.setView('interview');
  };

  // Handle edit interview
  const handleEditInterview = (interviewId: string) => {
    const editingApp = viewStateManager.getEditingApp();
    if (editingApp?.interviews) {
      const interview = editingApp.interviews.find(i => i.id === interviewId);
      if (interview) {
        viewStateManager.loadInterviewDataFromModel(interview);
        viewStateManager.setView('interview');
      }
    }
  };

  // Get filtered applications
  const filteredApps = appService
    ? appService.filterApplications(
      applications,
      viewStateManager.getSearchQuery(),
      viewStateManager.getActiveFilter()
    )
    : [];

  // Calculate stats
  const stats = viewStateManager.calculateStats(applications);

  // View PDF
  const viewPdf = (pdfData: string) => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<iframe src="${pdfData}" width="100%" height="100%" style="border:none;"></iframe>`);
    }
  };

  // Get current view and state values
  const view = viewStateManager.getView();
  const loading = viewStateManager.isLoading();
  const editingApp = viewStateManager.getEditingApp();
  const editingInterview = viewStateManager.getEditingInterview();
  const deleteConfirmId = viewStateManager.getDeleteConfirmId();
  const deleteInterviewId = viewStateManager.getDeleteInterviewId();
  const formData = viewStateManager.getFormData();
  const interviewData = viewStateManager.getInterviewData();
  const searchQuery = viewStateManager.getSearchQuery();
  const activeFilter = viewStateManager.getActiveFilter();

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-[40]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <button
              onClick={() => viewStateManager.setView('main')}
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
                  {stats.total} OPPORTUNITIES
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
                setActiveFilter={(f) => viewStateManager.setActiveFilter(f)}
                searchQuery={searchQuery}
                setSearchQuery={(q) => viewStateManager.setSearchQuery(q)}
                loading={loading}
                apps={filteredApps}
                onEdit={handleEdit}
                onDelete={(id) => viewStateManager.setDeleteConfirmId(id)}
                onAdd={() => { viewStateManager.resetFormData(); viewStateManager.setView('form'); }}
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
                setFormData={(data) => viewStateManager.setFormData(data)}
                onSubmit={handleSubmit}
                onCancel={() => viewStateManager.setView('main')}
                editingApp={editingApp}
                onAddInterview={handleAddInterview}
                onEditInterview={handleEditInterview}
                onDeleteInterview={(id) => viewStateManager.setDeleteInterviewId(id)}
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
                setFormData={(data) => viewStateManager.setInterviewData(data)}
                onSubmit={handleInterviewSubmit}
                onCancel={() => viewStateManager.setView('form')}
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
              onClick={() => {
                viewStateManager.setDeleteConfirmId(null);
                viewStateManager.setDeleteInterviewId(null);
              }}
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
                    onClick={() => {
                      viewStateManager.setDeleteConfirmId(null);
                      viewStateManager.setDeleteInterviewId(null);
                    }}
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
              onClick={() => syncManager.manualSync()}
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
