import React from 'react';
import { NewInterview, Interview, InterviewType } from '../types';
import { Calendar, Clock, X, Save, Timer, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface InterviewFormProps {
  formData: NewInterview;
  setFormData: (data: NewInterview) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  editingInterview: Interview | null;
  companyName: string;
}

export const InterviewForm: React.FC<InterviewFormProps> = ({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  editingInterview,
  companyName
}) => {
  const INTERVIEW_TYPES: InterviewType[] = [
    'Phone Screen', 
    'Recruiter Screen', 
    'Technical', 
    'OnSite', 
    'Panel', 
    'Final'
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-200 overflow-hidden">
        <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider">
                Interview
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                {companyName}
              </h2>
            </div>
            <h3 className="text-2xl font-black text-slate-900">
              {editingInterview ? 'Update Interview' : 'Schedule Interview'}
            </h3>
          </div>
          <button 
            onClick={onCancel}
            className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-all"
            id="close-interview-form-btn"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 block ml-1 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Date *
              </label>
              <input 
                required
                type="date" 
                value={formData.date ?? ''}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 block ml-1 flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Time *
              </label>
              <input 
                required
                type="time" 
                value={formData.time ?? ''}
                onChange={e => setFormData({...formData, time: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 block ml-1 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-500" />
                Interview Type *
              </label>
              <select 
                required
                value={formData.type ?? ''}
                onChange={e => setFormData({...formData, type: e.target.value as InterviewType})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              >
                {INTERVIEW_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 block ml-1 flex items-center gap-2">
                <Timer className="w-4 h-4 text-indigo-500" />
                Duration (minutes) *
              </label>
              <input 
                required
                type="number" 
                value={formData.duration ?? ''}
                onChange={e => setFormData({...formData, duration: Number(e.target.value)})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="e.g. 45"
                min="1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 block ml-1">Notes & Preparation</label>
            <textarea 
              rows={6}
              value={formData.notes ?? ''}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none placeholder:text-slate-400"
              placeholder="Questions to ask, topics to cover, or feedback from the interview..."
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-8 border-t border-slate-100">
            <button 
              type="button"
              onClick={onCancel}
              className="px-8 py-4 text-slate-600 font-black hover:bg-slate-100 rounded-2xl transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              <span>{editingInterview ? 'Update Interview' : 'Save Interview'}</span>
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};
