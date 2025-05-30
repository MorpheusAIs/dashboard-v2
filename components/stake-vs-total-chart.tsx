"use client"

import React from "react"

interface StakeVsTotalChartProps {
  userStake: number
  totalStaked: number
  className?: string
}

export function StakeVsTotalChart({ userStake, totalStaked, className = "" }: StakeVsTotalChartProps) {
  // Calculate percentage of user stake vs total
  const percentage = userStake && totalStaked ? Math.round((userStake / totalStaked) * 100) : 0;
  
  // Helper function to add commas to numbers
  const addThousandSeparators = (numStr: string) => {
    const parts = numStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };
  
  // Helper function to format number with decimals only if less than 1
  const formatNumber = (num: number) => {
    if (num < 1) {
      // For numbers less than 1, show one decimal place
      return num.toString().includes('.') 
        ? num.toString().split('.')[0] + '.' + num.toString().split('.')[1].substring(0, 1)
        : num.toString();
    } else {
      // For numbers >= 1, show only whole number
      return Math.floor(num).toString();
    }
  };
  
  // Format numbers and add commas
  const formattedUserStake = addThousandSeparators(formatNumber(userStake));
  const formattedTotalStaked = addThousandSeparators(formatNumber(totalStaked));

  // Create the conic gradient style for the progress circle
  const conicGradient = `conic-gradient(
    rgb(52, 211, 153) 0% ${percentage}%, 
    rgba(11, 11, 11, 0.05) ${percentage}% 100%
  )`;

  return (
    <div className={`flex items-center ${className}`}>
      <div 
        className="relative flex h-10 w-10 items-center justify-center rounded-full rotate-[-90deg] aspect-square"
        style={{ background: conicGradient }}
      >
        {/* Inner circle to create donut effect */}
        <div className="absolute h-[calc(100%-6px)] w-[calc(100%-6px)] rounded-full bg-[#111111]"></div>
        
        {/* Percentage text in the middle */}
        <div className="z-10 text-[8px] sm:text-[11px] font-semibold text-white rotate-90">
          {percentage}<span className="text-[8px] sm:text-[10px]">%</span>
        </div>
      </div>
      
      <div className="ml-3">
        <span className="text-sm text-gray-200">{formattedUserStake} / {formattedTotalStaked} MOR</span>
      </div>
    </div>
  )
} 