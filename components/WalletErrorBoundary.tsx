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
    // Only log serious errors, not common wallet connection issues
    const isProposalExpired = error.message?.toLowerCase().includes('proposal expired');
    const isSessionExpired = error.message?.toLowerCase().includes('session expired');
    const isWalletConnectionIssue = error.message?.toLowerCase().includes('walletconnect') ||
                                   error.message?.toLowerCase().includes('user rejected');
    
    if (!isProposalExpired && !isSessionExpired && !isWalletConnectionIssue) {
      console.error('Wallet Error:', error);
      console.error('Error Info:', errorInfo);
    } else {
      console.log('🤫 Suppressed common wallet error:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || '';
      const isProposalExpired = errorMessage.toLowerCase().includes('proposal expired');
      const isSessionExpired = errorMessage.toLowerCase().includes('session expired');
      
      // For proposal/session expired errors, silently clear data and render normally
      if (isProposalExpired || isSessionExpired) {
        // Clear any expired wallet data silently
        Object.keys(localStorage).forEach(key => {
          if (key.toLowerCase().includes('walletconnect') || 
              key.includes('wc@2') ||
              key.includes('@walletconnect')) {
            localStorage.removeItem(key);
          }
        });
        
        // Reset the error state and render children normally (showing wallet connect button)
        this.setState({ hasError: false, error: null });
        return this.props.children;
      }
      
      // For all other errors, reset state and render normally
      // Let React handle temporary errors naturally without showing error UI
      this.setState({ hasError: false, error: null });
    }

    return this.props.children
  }
}

export default WalletErrorBoundary 
