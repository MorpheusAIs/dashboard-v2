"use client";

interface EmptyAssetsStateProps {
  userAddress?: string;
  onDepositAction: () => void;
  isProcessing: boolean;
  isModalTransitioning: boolean;
}

export function EmptyAssetsState({
  userAddress,
  onDepositAction,
  isProcessing,
  isModalTransitioning
}: EmptyAssetsStateProps) {
  return (
    <div className="flex flex-col panel-gradient-base items-center h-[260px] justify-center py-12 px-6 rounded-xl border border-emerald-400/[0.1] bac">
      <h3 className={userAddress ? "text-lg font-semibold text-white mb-2" : "text-lg font-semibold text-gray-400 mb-2"}>
        {userAddress ? "Deposit an asset to start earning" : "Please connect your wallet"}
      </h3>
      {userAddress && (
        <button
          className="copy-button"
          onClick={onDepositAction}
          disabled={!userAddress || isProcessing || isModalTransitioning}
        >
          {isModalTransitioning ? 'Opening...' : 'Deposit'}
        </button>
      )}
    </div>
  );
}
