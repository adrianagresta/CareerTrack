import React from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  filter: string;
  isActive: boolean;
  onClick: () => void;
  index: number;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  label, 
  value, 
  color, 
  filter, 
  isActive, 
  onClick, 
  index 
}) => {
  return (
    <motion.button 
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`bg-white p-4 rounded-2xl border transition-all text-left group ${
        isActive 
          ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-md' 
          : 'border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md'
      }`}
      id={`stat-card-${filter.toLowerCase()}`}
    >
      <p className="text-sm font-medium text-slate-500 mb-1 group-hover:text-slate-700 transition-colors">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color}`}>
        {value}
      </p>
    </motion.button>
  );
};
