// Type declarations for AppKit (Reown) web components
// These are custom elements used by @reown/appkit for wallet connection UI

import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'appkit-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        size?: 'sm' | 'md';
        disabled?: boolean;
        balance?: 'show' | 'hide';
        label?: string;
        loadingLabel?: string;
      }, HTMLElement>;
      'appkit-network-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        disabled?: boolean;
      }, HTMLElement>;
      'appkit-account-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        disabled?: boolean;
        balance?: 'show' | 'hide';
      }, HTMLElement>;
      'appkit-connect-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        size?: 'sm' | 'md';
        label?: string;
        loadingLabel?: string;
      }, HTMLElement>;
      // Legacy w3m components (for backward compatibility)
      'w3m-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        size?: 'sm' | 'md';
        disabled?: boolean;
        balance?: 'show' | 'hide';
        label?: string;
        loadingLabel?: string;
      }, HTMLElement>;
    }
  }
}
