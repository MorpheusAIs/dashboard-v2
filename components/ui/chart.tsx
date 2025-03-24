"use client"

import React from "react"

export interface ChartConfig {
  [key: string]: {
    label: string
    color?: string
  }
}

interface ChartContainerProps {
  config: ChartConfig
  children: React.ReactNode
  className?: string
}

export function ChartContainer({ 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  config, 
  children, 
  className = "" 
}: ChartContainerProps) {
  return (
    <div className={`relative ${className}`}>
      {children}
    </div>
  )
} 