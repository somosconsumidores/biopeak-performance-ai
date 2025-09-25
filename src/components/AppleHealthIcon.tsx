import React from 'react';

interface AppleHealthIconProps {
  className?: string;
}

export const AppleHealthIcon: React.FC<AppleHealthIconProps> = ({ className = "h-5 w-5" }) => {
  return (
    <svg 
      className={className}
      viewBox="0 0 24 24" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M7.8 3.2c-2.2 0-4 1.8-4 4 0 3.6 4 8.2 8.2 11.7 4.2-3.5 8.2-8.1 8.2-11.7 0-2.2-1.8-4-4-4-1.5 0-2.9.8-3.7 2-.8-1.2-2.2-2-3.7-2z"/>
      <rect x="4" y="11" width="16" height="2" rx="1"/>
      <rect x="11" y="6" width="2" height="12" rx="1"/>
    </svg>
  );
};