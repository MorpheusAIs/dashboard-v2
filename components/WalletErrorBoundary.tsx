'use client'

import React from 'react'
import { isRecoverableWalletError, clearAllWalletData } from '@/lib/utils/error-suppression'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  resetKey: number
}

class WalletErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, resetKey: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Only log serious errors; recover from common wallet connection issues
    if (isRecoverableWalletError(error)) {
      // Clear any expired wallet data silently, then safely reset the boundary
      try {
        clearAllWalletData()
      } catch {}

      // Defer state update to avoid nested updates within the same render phase
      setTimeout(() => {
        this.setState(prev => ({ hasError: false, error: null, resetKey: (prev.resetKey ?? 0) + 1 }))
      }, 0)
      return
    }

    console.error('Wallet Error:', error)
    console.error('Error Info:', errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Temporary fallback while boundary resets after handled errors
      return null
    }

    return (
      <React.Fragment key={this.state.resetKey}>
        {this.props.children}
      </React.Fragment>
    )
  }
}

export default WalletErrorBoundary 
