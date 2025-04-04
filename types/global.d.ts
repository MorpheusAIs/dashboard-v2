interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request?: (...args: any[]) => Promise<any>;
    on?: (event: string, callback: (...args: any[]) => void) => void;
    removeListener?: (event: string, callback: (...args: any[]) => void) => void;
    selectedAddress?: string;
    chainId?: string;
    networkVersion?: string;
    isConnected?: () => boolean;
    enable?: () => Promise<string[]>;
    [key: string]: any;
  };
}

interface ErrorEvent {
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  error?: Error;
} 