import React from 'react';
import { StatCard } from './StatCard';

export interface StatsData {
  total: number;
  wishlist: number;
  applied: number;
  interviewing: number;
  offers: number;
  closed: number;
}

interface StatsCardsProps {
  stats: StatsData;
  activeFilter: string | null;
  setActiveFilter: (filter: string | null) => void;
  setSearchQuery: (query: string) => void;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  activeFilter,
  setActiveFilter,
  setSearchQuery,
}) => {
  const statItems = [
    { label: 'Total', value: stats.total, color: 'text-indigo-600', filter: 'Total' },
    { label: 'Wishlist', value: stats.wishlist, color: 'text-slate-600', filter: 'Wishlist' },
    { label: 'Applied', value: stats.applied, color: 'text-blue-600', filter: 'Applied' },
    { label: 'Interviewing', value: stats.interviewing, color: 'text-amber-600', filter: 'Interviewing' },
    { label: 'Offers', value: stats.offers, color: 'text-emerald-600', filter: 'Offer' },
    { label: 'Closed', value: stats.closed, color: 'text-slate-600', filter: 'Closed' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-10">
      {statItems.map((stat, i) => (
        <StatCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          color={stat.color}
          filter={stat.filter}
          isActive={activeFilter === stat.filter}
          onClick={() => {
            setSearchQuery('');
            setActiveFilter(activeFilter === stat.filter ? null : stat.filter);
          }}
          index={i}
        />
      ))}
    </div>
  );
};
