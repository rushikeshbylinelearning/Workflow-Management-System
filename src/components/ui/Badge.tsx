import React, { memo } from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge = memo(function Badge({ children, variant = 'default', size = 'sm', className = '' }: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full';
  const variants = {
    default: 'bg-gray-100 text-gray-800', primary: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800', success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800', danger: 'bg-red-100 text-red-800',
  };
  const sizes = { sm: 'px-2.5 py-0.5 text-xs', md: 'px-3 py-1 text-sm' };
  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
});
