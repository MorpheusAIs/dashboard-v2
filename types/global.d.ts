interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request?: (...args: unknown[]) => Promise<unknown>;
    on?: (event: string, callback: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, callback: (...args: unknown[]) => void) => void;
    selectedAddress?: string;
    chainId?: string;
    networkVersion?: string;
    isConnected?: () => boolean;
    enable?: () => Promise<string[]>;
    [key: string]: unknown;
  };
}

interface ErrorEvent {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  error?: Error;
} 

// React 19: scope JSX augmentation under the runtime module per upgrade guide
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'w3m-button': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: 'sm' | 'md' | 'lg'
      };
    }
  }
}