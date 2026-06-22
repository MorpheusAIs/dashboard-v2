"use client"

import { useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'

interface FeaturebaseConfig {
  organization: string
  theme: 'light' | 'dark'
  placement?: 'left' | 'right'
  defaultBoard?: string
  locale?: string
  metadata?: Record<string, unknown> | null
  featurebaseJwt?: string
}

interface FeaturebaseIdentifyConfig {
  organization: string
  featurebaseJwt: string
}

interface FeaturebaseCallback {
  action: 'widgetReady' | 'widgetOpened' | 'feedbackSubmitted'
  post?: Record<string, unknown>
}

declare global {
  interface Window {
    Featurebase: (
      action: string, 
      config: FeaturebaseConfig | FeaturebaseIdentifyConfig, 
      callback?: (err: Error | null, callback: FeaturebaseCallback) => void
    ) => void
  }
}

interface FeaturebaseWidgetProps {
  organization?: string
  theme?: 'light' | 'dark'
  placement?: 'left' | 'right'
  defaultBoard?: string
  locale?: string
}

interface FeaturebaseChallengeResponse {
  nonce: string
  message: string
  expiresAt: number
  challengeToken: string
}

interface FeaturebaseTokenResponse {
  featurebaseJwt: string
  expiresAt: number
}

interface CachedFeaturebaseJwt {
  token: string
  expiresAt: number
}

let featurebaseSdkPromise: Promise<void> | null = null
let lastInitializedKey: string | null = null
const featurebaseJwtCache = new Map<string, CachedFeaturebaseJwt>()
const featurebaseJwtRequests = new Map<string, Promise<CachedFeaturebaseJwt>>()
const featurebaseAuthCooldowns = new Map<string, number>()

function isFeaturebaseChallengeResponse(value: unknown): value is FeaturebaseChallengeResponse {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'nonce' in value &&
    'message' in value &&
    'expiresAt' in value &&
    'challengeToken' in value &&
    typeof value.nonce === 'string' &&
    typeof value.message === 'string' &&
    typeof value.expiresAt === 'number' &&
    typeof value.challengeToken === 'string',
  )
}

function isFeaturebaseTokenResponse(value: unknown): value is FeaturebaseTokenResponse {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'featurebaseJwt' in value &&
    'expiresAt' in value &&
    typeof value.featurebaseJwt === 'string' &&
    typeof value.expiresAt === 'number',
  )
}

function loadFeaturebaseSdk(): Promise<void> {
  if (typeof window.Featurebase !== 'undefined') {
    return Promise.resolve()
  }

  if (featurebaseSdkPromise) {
    return featurebaseSdkPromise
  }

  featurebaseSdkPromise = new Promise((resolve, reject) => {
    const scriptId = 'featurebase-sdk'
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null
    const script = existingScript ?? document.createElement('script')

    script.id = scriptId
    script.src = 'https://do.featurebase.app/js/sdk.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load Featurebase SDK'))

    if (!existingScript) {
      const firstScript = document.getElementsByTagName('script')[0]
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript)
      } else {
        document.head.appendChild(script)
      }
    }
  })

  return featurebaseSdkPromise
}

export function FeaturebaseWidget({
  organization = 'morpheus',
  theme = 'dark',
  placement = 'right',
  defaultBoard = 'bugs',
  locale = 'en'
}: FeaturebaseWidgetProps) {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  useEffect(() => {
    let cancelled = false

    const createFeaturebaseJwt = async (): Promise<CachedFeaturebaseJwt | null> => {
      if (!isConnected || !address) {
        return null
      }

      const normalizedAddress = address.toLowerCase()
      const cachedJwt = featurebaseJwtCache.get(normalizedAddress)
      const nowInSeconds = Math.floor(Date.now() / 1000)
      const cooldownUntil = featurebaseAuthCooldowns.get(normalizedAddress) ?? 0

      if (cachedJwt && cachedJwt.expiresAt > nowInSeconds + 60) {
        return cachedJwt
      }

      if (cooldownUntil > Date.now()) {
        return null
      }

      const inFlightRequest = featurebaseJwtRequests.get(normalizedAddress)
      if (inFlightRequest) {
        return inFlightRequest
      }

      const request = (async () => {
        const challengeResponse = await fetch('/api/featurebase/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: address }),
          cache: 'no-store',
        })

        if (!challengeResponse.ok) {
          throw new Error('Unable to create Featurebase challenge')
        }

        const challengeData: unknown = await challengeResponse.json()

        if (!isFeaturebaseChallengeResponse(challengeData)) {
          throw new Error('Invalid Featurebase challenge response')
        }

        const signature = await signMessageAsync({ message: challengeData.message })
        const tokenResponse = await fetch('/api/featurebase/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address,
            challengeToken: challengeData.challengeToken,
            signature,
          }),
          cache: 'no-store',
        })

        if (!tokenResponse.ok) {
          throw new Error('Unable to create Featurebase token')
        }

        const tokenData: unknown = await tokenResponse.json()

        if (!isFeaturebaseTokenResponse(tokenData)) {
          throw new Error('Invalid Featurebase token response')
        }

        const cachedToken = {
          token: tokenData.featurebaseJwt,
          expiresAt: tokenData.expiresAt,
        }

        featurebaseJwtCache.set(normalizedAddress, cachedToken)
        return cachedToken
      })()

      featurebaseJwtRequests.set(normalizedAddress, request)

      try {
        return await request
      } catch (error) {
        featurebaseAuthCooldowns.set(normalizedAddress, Date.now() + 5 * 60 * 1000)
        throw error
      } finally {
        featurebaseJwtRequests.delete(normalizedAddress)
      }
    }

    const initializeWidget = async () => {
      try {
        await loadFeaturebaseSdk()
      } catch (error) {
        console.warn('Featurebase SDK is unavailable.', error)
        return
      }

      if (!window.Featurebase) {
        return
      }

      if (cancelled) {
        return
      }

      const initializedKey = [
        organization,
        theme,
        placement,
        defaultBoard,
        locale,
        address?.toLowerCase() ?? 'anonymous',
      ].join(':')

      if (lastInitializedKey === initializedKey) {
        return
      }

      window.Featurebase('initialize_feedback_widget', {
        organization,
        theme,
        placement,
        defaultBoard,
        locale,
      }, (err, callback) => {
        if (err || callback?.action !== 'widgetOpened') {
          return
        }

        void (async () => {
          try {
            const featurebaseJwt = await createFeaturebaseJwt()

            if (!featurebaseJwt || cancelled || !window.Featurebase) {
              return
            }

            window.Featurebase('identify', {
              organization,
              featurebaseJwt: featurebaseJwt.token,
            })
          } catch (error) {
            console.warn('Featurebase secure identity is unavailable; continuing anonymously.', error)
          }
        })()
      })
      lastInitializedKey = initializedKey
    }

    if (document.readyState === 'complete') {
      void initializeWidget()
    } else {
      window.addEventListener('load', initializeWidget)
    }

    return () => {
      cancelled = true
      window.removeEventListener('load', initializeWidget)
    }
  }, [organization, theme, placement, defaultBoard, locale, address, isConnected, signMessageAsync])

  return null
}
