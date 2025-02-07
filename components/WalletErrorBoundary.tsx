'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

class WalletErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Wallet Error:', error)
    console.error('Error Info:', errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <h2 className="text-red-800 font-semibold mb-2">Wallet Connection Error</h2>
          <p className="text-red-600 mb-4">
            {this.state.error?.message || 'An error occurred with the wallet connection'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              // Force reload the page to clear any bad state
              window.location.reload()
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default WalletErrorBoundary 
