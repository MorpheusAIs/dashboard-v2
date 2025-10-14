'use client'

import React from 'react'

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
    const message = (error.message || '').toLowerCase()
    const isProposalExpired = message.includes('proposal expired')
    const isSessionExpired = message.includes('session expired')
    const isWalletConnectionIssue = message.includes('walletconnect') || message.includes('user rejected')

    if (isProposalExpired || isSessionExpired || isWalletConnectionIssue) {
      // Clear any expired wallet data silently, then safely reset the boundary
      try {
        Object.keys(localStorage).forEach(key => {
          if (key.toLowerCase().includes('walletconnect') ||
              key.includes('wc@2') ||
              key.includes('@walletconnect')) {
            localStorage.removeItem(key)
          }
        })
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
