import React from 'react';

function LoadingSpinner({ size = 'large', className = '' }) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`
          ${sizeClasses[size]} 
          border-4 border-gray-200 border-t-primary-600 
          rounded-full animate-spin
        `}
      >
      </div>
    </div>
  );
}

export default LoadingSpinner; 