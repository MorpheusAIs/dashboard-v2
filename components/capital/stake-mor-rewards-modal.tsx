"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Dialog, 
  DialogPortal, 
  DialogContent, 
  DialogTitle, 
  DialogDescription, 
} from "@/components/ui/dialog";
import { ChevronRight} from "lucide-react";
import { useCapitalContext } from "@/context/CapitalPageContext";

export function StakeMorRewardsModal() {
  const router = useRouter();
  const {
    activeModal,
    setActiveModal,
    totalClaimableAmountFormatted,
  } = useCapitalContext();

  const isOpen = activeModal === 'stakeMorRewards';

  const handleClose = () => {
    setActiveModal(null);
  };

  const handleNavigateToBuilders = () => {
    handleClose();
    router.push('/builders');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogPortal>
        <DialogContent className="sm:max-w-[425px] bg-background border-gray-800 p-0">
          {/* Custom header with close button */}
          <div className="flex items-center justify-between p-6 pb-2">
            <DialogTitle className="text-xl font-bold text-emerald-400">
              Stake MOR Rewards
            </DialogTitle>
          </div>

          <div className="px-6 pb-6">
            <DialogDescription className="text-gray-400 text-sm leading-relaxed mb-6">
              Earn additional benefits and support the growing ecosystem of developers building on Morpheus by staking your MOR to a builder subnet.
            </DialogDescription>

            {/* Total Rewards Earned */}
            <div className="mb-4">
              <div className="flex items-center justify-between py-4 px-4 rounded-lg bg-gray-800/50">
                <span className="text-gray-300">Total Rewards Earned</span>
                <span className="text-white font-semibold">
                  {totalClaimableAmountFormatted || "0"} MOR
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Link href="/builders">
                <button 
                  className="w-full copy-button flex items-center justify-center gap-2"
                  onClick={handleNavigateToBuilders}
                >
                  Stake to Builders Subnets
                  <ChevronRight className="h-5 w-5" />
                </button>
              </Link>

              {/* <button
                // variant="ghost"
                className="w-full py-4 px-4 text-emerald-400 hover:copy-button-secondary"
                onClick={handleClose}
              >
                Close
              </button> */}
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
} 