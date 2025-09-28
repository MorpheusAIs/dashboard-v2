"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface CapitalTutorialProps {
  isActive: boolean;
  onCompleteAction: () => void;
}

export function CapitalTutorial({ isActive, onCompleteAction }: CapitalTutorialProps) {
  useEffect(() => {
    if (!isActive) return;

    const driverObj = driver({
      showProgress: true,
      overlayColor: 'rgba(16, 185, 129, 0.25)',
      popoverClass: 'morpheus-tutorial-popover',
      steps: [
        {
          element: 'w3m-button',
          popover: {
            title: 'Wallet Connection',
            description: 'Connect your wallet here to interact with the Morpheus protocol. You can also switch networks using this button.'
          }
        },
        {
          element: '.mor-balance',
          popover: {
            title: 'MOR Balance',
            description: 'View your MOR token balance across all supported networks. This shows your total MOR holdings.'
          }
        },
        {
          element: '.cowswap-modal-trigger',
          popover: {
            title: 'Buy MOR Tokens',
            description: 'Purchase MOR tokens directly through our integrated CowSwap modal. This opens a decentralized exchange interface.'
          }
        },
        {
          element: '.capital-info-panel',
          popover: {
            title: 'Capital Dashboard',
            description: 'This is the main Capital dashboard where you can deposit assets to earn MOR rewards. Below you\'ll see all available assets for staking.'
          }
        },
        {
          element: '.assets-table-header',
          popover: {
            title: 'Asset Information',
            description: 'Here you can see all supported assets, total deposited amounts, and deposit buttons. Click "Deposit" on any asset to start earning rewards.'
          }
        },
        {
          element: '.metric-cards-row',
          popover: {
            title: 'Key Metrics',
            description: 'Track important metrics like Total Value Locked (TVL), daily MOR emissions, average APR rates, and active depositors.'
          }
        },
        {
          element: '.cumulative-deposits-chart',
          popover: {
            title: 'Cumulative Deposits Chart',
            description: 'This chart shows the historical growth of deposits over time. Use the time range controls to zoom in on specific periods.'
          }
        }
      ],
      // Handle tour completion using the onDestroyed callback
      onDestroyed: () => {
        onCompleteAction();
      }
    });

    // Start the tour
    driverObj.drive();

    // Cleanup
    return () => {
      driverObj.destroy();
    };
  }, [isActive, onCompleteAction]);

  return null; // This component doesn't render anything
}
