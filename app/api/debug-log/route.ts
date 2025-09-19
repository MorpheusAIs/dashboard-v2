/**
 * Simple Debug Log API - Only for Development
 * Receives client-side debug logs and prints them to terminal
 */

import { NextRequest, NextResponse } from 'next/server';

// Colors for terminal output
const colors = {
  info: '\x1b[36m',    // Cyan
  warn: '\x1b[33m',    // Yellow
  error: '\x1b[31m',   // Red
  group: '\x1b[35m',   // Magenta
  reset: '\x1b[0m',    // Reset
  bold: '\x1b[1m',     // Bold
};

let groupIndent = 0;

export async function POST(request: NextRequest) {
  // Only work in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Debug logging only available in development' }, { status: 404 });
  }

  try {
    const { level, message, data, timestamp } = await request.json();
    
    const time = new Date(timestamp).toLocaleTimeString();
    const indent = '  '.repeat(groupIndent);
    
    switch (level) {
      case 'group':
        console.log(`${colors.bold}${colors.group}${indent}┌── ${message}${colors.reset}`);
        if (data) {
          console.log(`${colors.group}${indent}│   ${JSON.stringify(data, null, 2).split('\n').join(`\n${colors.group}${indent}│   `)}${colors.reset}`);
        }
        groupIndent++;
        break;
        
      case 'groupEnd':
        groupIndent = Math.max(0, groupIndent - 1);
        const endIndent = '  '.repeat(groupIndent);
        console.log(`${colors.group}${endIndent}└──${colors.reset}\n`);
        break;
        
      case 'warn':
        console.log(`${colors.bold}${colors.warn}${indent}🚨 [${time}] ${message}${colors.reset}`);
        if (data) {
          console.log(`${colors.warn}${indent}   ${JSON.stringify(data, null, 2).split('\n').join(`\n${colors.warn}${indent}   `)}${colors.reset}`);
        }
        break;
        
      case 'error':
        console.log(`${colors.bold}${colors.error}${indent}❌ [${time}] ${message}${colors.reset}`);
        if (data) {
          console.log(`${colors.error}${indent}   ${JSON.stringify(data, null, 2).split('\n').join(`\n${colors.error}${indent}   `)}${colors.reset}`);
        }
        break;
        
      default: // info
        console.log(`${colors.info}${indent}ℹ️  [${time}] ${message}${colors.reset}`);
        if (data) {
          console.log(`${colors.info}${indent}   ${JSON.stringify(data, null, 2).split('\n').join(`\n${colors.info}${indent}   `)}${colors.reset}`);
        }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Debug log API error:', error);
    return NextResponse.json({ error: 'Failed to log' }, { status: 500 });
  }
}
