import React from 'react';
import { JobApplication, ApplicationStatus, NewApplication, Interview } from '../types';
import { CheckCircle2, Upload, X, Plus, Calendar, Clock, Timer, MessageSquare, Trash2, Edit3, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ApplicationFormProps {
  formData: NewApplication;
  setFormData: (data: NewApplication) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  editingApp: JobApplication | null;
  onAddInterview: (applicationId: string) => void;
  onEditInterview: (interview: Interview) => void;
  onDeleteInterview: (id: string) => void;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  editingApp,
  onAddInterview,
  onEditInterview,
  onDeleteInterview
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isFetchingPdf, setIsFetchingPdf] = React.useState(false);

  const isValidUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleFetchPdf = async () => {
    const jobUrl = formData.url;
    if (!jobUrl || !isValidUrl(jobUrl)) {
      alert('Please enter a valid URL in the Job URL field first.');
      return;
    }

    setIsFetchingPdf(true);
    try {
      const response = await fetch('/api/fetch-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: jobUrl }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch and generate PDF.');
      }

      const blob = await response.blob();
      
      if (blob.size > 5 * 1024 * 1024) {
        alert('Generated PDF size is greater than 5MB.');
        return;
      }

      const file = new File([blob], 'fetched_job.pdf', { type: 'application/pdf' });

      // Programmatically attach to the hidden file input
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
      }

      // Convert to Base64 and store in formData.pdf_data
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, pdf_data: reader.result as string });
      };
      reader.readAsDataURL(file);

    } catch (error: any) {
      console.error(error);
      alert(`Error fetching job PDF: ${error.message || error}`);
    } finally {
      setIsFetchingPdf(false);
    }
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {editingApp ? 'Edit Application' : 'Add New Application'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {editingApp ? 'Update the details of your job application.' : 'Tell us about the role you\'re pursuing.'}
            </p>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
            id="close-form-btn"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 block ml-1">Company Name *</label>
              <input 
                required
                type="text" 
                value={formData.company ?? ''}
                onChange={e => setFormData({...formData, company: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                placeholder="e.g. Google"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 block ml-1">Position *</label>
              <input 
                required
                type="text" 
                value={formData.position ?? ''}
                onChange={e => setFormData({...formData, position: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                placeholder="e.g. Senior Frontend Engineer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 block ml-1">Status</label>
              <select 
                value={formData.status ?? ''}
                onChange={e => setFormData({...formData, status: e.target.value as ApplicationStatus})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
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
              <label className="text-sm font-semibold text-slate-700 block ml-1">Status Date</label>
              <input 
                type="date" 
                value={formData.status_date ?? ''}
                onChange={e => setFormData({...formData, status_date: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 block ml-1">Location</label>
              <input 
                type="text" 
                value={formData.location ?? ''}
                onChange={e => setFormData({...formData, location: e.target.value})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                placeholder="e.g. New York, NY or Remote"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 block ml-1">Work Location Type</label>
              <select 
                value={formData.location_type ?? ''}
                onChange={e => setFormData({...formData, location_type: e.target.value as any})}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="OnSite">OnSite</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Remote">Remote</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-50">
            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-700 block ml-1">Job Listing Salary Range</label>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number" 
                  value={formData.salary_min ?? ''}
                  onChange={e => setFormData({...formData, salary_min: e.target.value ? Number(e.target.value) : undefined})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                  placeholder="Min ($)"
                />
                <input 
                  type="number" 
                  value={formData.salary_max ?? ''}
                  onChange={e => setFormData({...formData, salary_max: e.target.value ? Number(e.target.value) : undefined})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                  placeholder="Max ($)"
                />
              </div>
            </div>
            <div className="space-y-4">
              <label className="text-sm font-semibold text-slate-700 block ml-1">Your Desired Salary Range</label>
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="number" 
                  value={formData.desired_salary_min ?? ''}
                  onChange={e => setFormData({...formData, desired_salary_min: e.target.value ? Number(e.target.value) : undefined})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                  placeholder="Min ($)"
                />
                <input 
                  type="number" 
                  value={formData.desired_salary_max ?? ''}
                  onChange={e => setFormData({...formData, desired_salary_max: e.target.value ? Number(e.target.value) : undefined})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
                  placeholder="Max ($)"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 block ml-1">Job URL</label>
            <input 
              type="url" 
              value={formData.url ?? ''}
              onChange={e => setFormData({...formData, url: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
              placeholder="https://company.com/careers/job-123"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700 block ml-1">Job Advertisement PDF</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-all group">
                <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800">
                  {formData.pdf_data ? 'Replace PDF' : 'Upload job description PDF'}
                </span>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleFetchPdf}
                disabled={!isValidUrl(formData.url || '') || isFetchingPdf}
                className={`flex items-center justify-center gap-2 px-6 py-3 border rounded-2xl font-semibold transition-all ${
                  isValidUrl(formData.url || '') && !isFetchingPdf
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 cursor-pointer shadow-sm active:scale-95'
                    : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Globe className="w-5 h-5" />
                <span>{isFetchingPdf ? 'Fetching PDF...' : 'Fetch job PDF'}</span>
              </button>
              {formData.pdf_data && (
                <div className="flex items-center gap-3 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex-1">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium truncate">PDF Attached Successfully</span>
                  <button 
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, pdf_data: '' });
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-rose-500 hover:text-rose-600 p-1 hover:bg-rose-100/50 rounded-lg transition-colors ml-auto"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 ml-1">Max file size: 5MB. Only PDF supported.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 block ml-1">Notes</label>
            <textarea 
              rows={4}
              value={formData.notes ?? ''}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none placeholder:text-slate-400"
              placeholder="Add details about role, skills, process, etc."
            />
          </div>

          {editingApp && (
            <div className="space-y-6 pt-8 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Interviews</h3>
                  <p className="text-sm text-slate-500">Track your interview stages and feedback.</p>
                </div>
                <button 
                  type="button"
                  onClick={() => onAddInterview(editingApp.id)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-bold transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Interview</span>
                </button>
              </div>

              <div className="space-y-4">
                {editingApp.interviews && editingApp.interviews.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {editingApp.interviews.map(interview => (
                      <div key={interview.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                            <Calendar className="w-6 h-6 text-indigo-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                                {interview.type}
                              </span>
                              <span className="text-xs font-bold text-slate-400">
                                {formatDate(interview.date)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                {interview.time}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Timer className="w-3.5 h-3.5 text-slate-400" />
                                {interview.duration}m
                              </span>
                            </div>
                            {interview.notes && (
                              <p className="text-sm text-slate-500 mt-2 line-clamp-1 italic">
                                "{interview.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button 
                            type="button"
                            onClick={() => onEditInterview(interview)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => onDeleteInterview(interview.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                    <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium italic">No interviews recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button"
              onClick={onCancel}
              className="px-8 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-10 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
            >
              {editingApp ? 'Update Application' : 'Create Application'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};
