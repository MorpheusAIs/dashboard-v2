"use client"

import { useEffect } from 'react'

interface FeaturebaseConfig {
  organization: string
  theme: 'light' | 'dark'
  placement?: 'left' | 'right'
  email?: string
  defaultBoard?: string
  locale?: string
  metadata?: Record<string, unknown> | null
}

interface FeaturebaseCallback {
  action: 'widgetReady' | 'widgetOpened' | 'feedbackSubmitted'
  post?: Record<string, unknown>
}

declare global {
  interface Window {
    Featurebase: (
      action: string, 
      config: FeaturebaseConfig, 
      callback?: (err: Error | null, callback: FeaturebaseCallback) => void
    ) => void
  }
}

interface FeaturebaseWidgetProps {
  organization?: string
  theme?: 'light' | 'dark'
  placement?: 'left' | 'right'
  defaultBoard?: string
  email?: string
  locale?: string
}

export function FeaturebaseWidget({
  organization = 'morpheus',
  theme = 'dark',
  placement = 'right',
  defaultBoard = 'bugs',
  locale = 'en'
}: FeaturebaseWidgetProps) {
  useEffect(() => {
    // Load the Featurebase SDK script
    const loadFeaturebaseSDK = () => {
      const scriptId = 'featurebase-sdk'
      
      // Check if script is already loaded
      if (document.getElementById(scriptId)) {
        initializeWidget()
        return
      }

      // Create and inject the SDK script
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://do.featurebase.app/js/sdk.js'
      script.onload = () => {
        // Initialize widget after SDK loads
        setTimeout(initializeWidget, 100) // Small delay to ensure SDK is fully ready
      }
      
      const firstScript = document.getElementsByTagName('script')[0]
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript)
      }
    }

    const initializeWidget = () => {
      if (typeof window.Featurebase !== 'undefined') {
        window.Featurebase('initialize_feedback_widget', {
          organization,
          theme,
          placement,
          defaultBoard,
          locale,
          // Note: email is intentionally omitted as per user requirements
        })
      }
    }

    // Load after all other elements are loaded
    if (document.readyState === 'complete') {
      loadFeaturebaseSDK()
    } else {
      window.addEventListener('load', loadFeaturebaseSDK)
    }

    // Cleanup
    return () => {
      window.removeEventListener('load', loadFeaturebaseSDK)
    }
  }, [organization, theme, placement, defaultBoard, locale])

  // This component doesn't render any visible content
  return null
}
