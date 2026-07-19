import React from 'react';


const Spinner: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => {
  return (
    <div
      className={`inline-block border-2 border-white/[0.06] border-t-emerald-400 rounded-full animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

export default Spinner;
