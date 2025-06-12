import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  count: number;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
  subtitle?: string;
  isLoading?: boolean;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  count,
  icon: Icon,
  color,
  onClick,
  subtitle,
  isLoading = false
}) => {
  const colorVariants: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    green: 'from-green-500 to-green-600',
    pink: 'from-pink-500 to-pink-600',
    indigo: 'from-indigo-500 to-indigo-600'
  };

  return (
    <div
      onClick={onClick}
      className="group relative bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:bg-white/90 hover:shadow-xl hover:scale-105 hover:-translate-y-1"
    >
      {/* Gradient background overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${colorVariants[color]} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`} />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 bg-gradient-to-br ${colorVariants[color]} rounded-xl flex items-center justify-center shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900 transition-colors group-hover:text-gray-700">
                {count}
              </div>
            </div>
          )}
        </div>
        
        <div>
          <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-gray-700 transition-colors">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-600 group-hover:text-gray-500 transition-colors">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      
      {/* Hover effect indicator */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent group-hover:w-full transition-all duration-300 rounded-full" 
           style={{ color: `var(--${color}-500)` }} />
    </div>
  );
};