"use client"

import React from "react"

interface StakeVsTotalChartProps {
  userStake: number
  totalStaked: number
  className?: string
}

export function StakeVsTotalChart({ userStake, totalStaked, className = "" }: StakeVsTotalChartProps) {
  // Calculate percentage of user stake vs total
  const percentage = userStake && totalStaked ? Math.round((userStake / totalStaked) * 100) : 0
  
  // Format numbers for display
  const formattedUserStake = userStake.toLocaleString()
  const formattedTotalStaked = totalStaked.toLocaleString()

  // Create the conic gradient style for the progress circle
  const conicGradient = `conic-gradient(
    rgb(52, 211, 153) 0% ${percentage}%, 
    rgba(16, 185, 129, 0.15) ${percentage}% 100%
  )`;

  return (
    <div className={`flex items-center ${className}`}>
      <div 
        className="relative flex h-10 w-10 items-center justify-center rounded-full rotate-[-90deg]"
        style={{ background: conicGradient }}
      >
        {/* Inner circle to create donut effect */}
        <div className="absolute h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-full bg-[#111827]"></div>
        
        {/* Percentage text in the middle */}
        <div className="z-10 text-[10px] font-semibold text-white rotate-90">
          {percentage}%
        </div>
      </div>
      
      <div className="ml-3">
        <span className="text-sm text-gray-200">{formattedUserStake} / {formattedTotalStaked} MOR</span>
      </div>
    </div>
  )
} 