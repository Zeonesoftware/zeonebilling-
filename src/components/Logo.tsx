import React from 'react';

export function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 512 512" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* Outer Circle */}
      <circle cx="256" cy="256" r="210" stroke="#0077C2" strokeWidth="12" />
      
      {/* Stylized Z Ribbon - Middle Part */}
      <path 
        d="M340 210 L170 380 L350 380" 
        stroke="#0099EE" 
        strokeWidth="50" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        style={{ filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.1))' }}
      />
      
      {/* Stylized Z Ribbon - Top Part */}
      <path 
        d="M140 210 L340 210" 
        stroke="#5CC8FF" 
        strokeWidth="50" 
        strokeLinecap="round" 
        style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.1))' }}
      />

      {/* Stylized Z Ribbon - Bottom Part Extension (Ribbon look) */}
      <path 
        d="M350 380 C420 380 430 310 400 280" 
        stroke="#005082" 
        strokeWidth="40" 
        strokeLinecap="round" 
        opacity="0.8"
      />
      
      {/* Left Tail Extension */}
      <path 
        d="M140 210 C70 210 60 280 90 310" 
        stroke="#005082" 
        strokeWidth="40" 
        strokeLinecap="round" 
        opacity="0.8"
      />
    </svg>
  );
}
