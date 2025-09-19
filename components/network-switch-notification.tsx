"use client";

interface NetworkSwitchNotificationProps {
  show: boolean;
  networkName: string;
}

export function NetworkSwitchNotification({ show, networkName }: NetworkSwitchNotificationProps) {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 text-sm font-semibold bg-emerald-500/90 text-black px-4 py-3 rounded-lg shadow-lg z-50 max-w-md transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
      <p>Switching to {networkName}</p>
    </div>
  );
} 