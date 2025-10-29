import React from 'react';

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  icon,
  label,
  onClick,
  disabled = false,
  loading = false,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed group h-full"
    >
      <div className="text-4xl group-hover:scale-110 transition-transform h-10 w-10 flex items-center justify-center">
        {loading ? (
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        ) : (
          icon
        )}
      </div>
      <span className="text-sm font-semibold text-gray-300 text-center">{label}</span>
    </button>
  );
};
