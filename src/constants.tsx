import React from 'react';
import { Clock, CheckCircle2, Sparkles, XCircle } from 'lucide-react';
import { ApplicationStatus } from './types';

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  'Wishlist': 'bg-slate-100 text-slate-600 border-slate-200',
  'Applied': 'bg-blue-50 text-blue-600 border-blue-100',
  'Interviewing': 'bg-amber-50 text-amber-600 border-amber-100',
  'Offer': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'Rejected': 'bg-rose-50 text-rose-600 border-rose-100',
  'Withdrawn': 'bg-slate-50 text-slate-500 border-slate-200',
};

export const STATUS_ICONS: Record<ApplicationStatus, React.ReactNode> = {
  'Wishlist': <Clock className="w-4 h-4" />,
  'Applied': <CheckCircle2 className="w-4 h-4" />,
  'Interviewing': <Clock className="w-4 h-4" />,
  'Offer': <Sparkles className="w-4 h-4" />,
  'Rejected': <XCircle className="w-4 h-4" />,
  'Withdrawn': <XCircle className="w-4 h-4" />,
};
