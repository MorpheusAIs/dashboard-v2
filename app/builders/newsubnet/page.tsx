"use client";

import { useState, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import Link from "next/link";
import { RiProgress4Fill } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";

// Import the form schemas
import { formSchema, FormData, FORM_STEPS } from "@/components/subnet-form/schemas";

// Import the form step components
import Step1PoolConfig from "@/components/subnet-form/Step1PoolConfig";
import Step2ProjectMetadata from "@/components/subnet-form/Step2ProjectMetadata";
import ProgressStepper from "@/components/subnet-form/ProgressStepper";
import FeeDisplayCard from "@/components/subnet-form/FeeDisplayCard";

// Import custom hooks
import useSubnetContractInteractions from "@/hooks/useSubnetContractInteractions";

// Import network config
import { arbitrumSepolia } from 'wagmi/chains';

export default function NewSubnetPage() {
  // --- State --- //
  const [currentStep, setCurrentStep] = useState(1);
  const router = useRouter();
  const { address: connectedAddress } = useAccount();

  // --- Form Setup --- //
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subnet: {
        name: "",
        minStake: 0,
        fee: 0,
        feeTreasury: "0x0000000000000000000000000000000000000000", // Default to the zero address
        networkChainId: arbitrumSepolia.id,
        withdrawLockPeriod: 1,
        withdrawLockUnit: "days",
        startsAt: new Date(),
        maxClaimLockEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      metadata: { slug: "", description: "", website: "", image: "" },
      projectOffChain: { email: "", discordLink: "", twitterLink: "", rewards: [] },
    },
    mode: "onChange",
  });

  // Get the selected chain ID from the form
  const selectedChainId = form.watch("subnet.networkChainId");

  // --- Contract Interactions Hook --- //
  const {
    isCorrectNetwork,
    isNetworkSwitching,
    tokenSymbol,
      needsApproval,
      isLoadingFeeData,
    isApproving,
    isCreating,
    isAnyTxPending,
    isSubmitting,
    formatCreationFee,
    getNetworkName,
    handleNetworkSwitch,
    handleApprove,
    handleCreateSubnet
  } = useSubnetContractInteractions({ 
    selectedChainId,
    onTxSuccess: () => router.push('/builders')
  });

  // --- Action Handlers --- //

  // Handles stepping through form or triggering final action (approve/submit)
  const handleNext = useCallback(async () => {
    const currentStepConfig = FORM_STEPS[currentStep - 1];
    const result = await form.trigger(currentStepConfig.fields, { shouldFocus: true });
    if (!result) return; // Don't proceed if validation fails

    // Ensure correct network first
    if (!isCorrectNetwork()) {
      const switchSuccessful = await handleNetworkSwitch();
      if (!switchSuccessful) return;
    }

    // On final step, decide whether to approve or submit based on current state
    if (currentStep === FORM_STEPS.length) {
      if (needsApproval) {
          handleApprove();
        } else {
        form.handleSubmit((data) => handleCreateSubnet(data))();
      }
    } else {
      // Move to next step if not the final step
      setCurrentStep(currentStep + 1);
    }
  }, [
    currentStep,
    form,
    isCorrectNetwork,
    handleNetworkSwitch,
    handleApprove,
    handleCreateSubnet,
    needsApproval,
  ]);

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // --- Render --- //
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-400 mb-2">Create Builder Subnet</h1>
        <p className="text-gray-400">Configure your builder subnet and project details.</p>
        {!connectedAddress && <p className="text-yellow-500 mt-2">Please connect your wallet.</p>}
      </div>

      {/* Fee Card - Only show if connected */}
      {connectedAddress && (
        <FeeDisplayCard 
          formattedFee={formatCreationFee()}
          needsApproval={needsApproval}
          isLoading={isLoadingFeeData}
          tokenSymbol={tokenSymbol}
        />
      )}

      {/* Progress Steps */}
      <ProgressStepper currentStep={currentStep} isSubmitting={isSubmitting} />

      {/* Form Content */}
      <Form {...form}>
        <form className="space-y-6">
          {/* Step 1: Subnet Config */}
          {currentStep === 1 && (
            <Step1PoolConfig isSubmitting={isSubmitting} tokenSymbol={tokenSymbol} />
          )}

          {/* Step 2: Project & Metadata */}          
          {currentStep === 2 && (
            <Step2ProjectMetadata isSubmitting={isSubmitting} />
          )}
        </form>
      </Form>

      {/* Footer Buttons */}
      <div className="mt-8 flex justify-between items-center">
        {/* Back/Cancel */}
        <div>
          {currentStep > 1 ? (
            <Button type="button" variant="outline" onClick={handleBack} disabled={isSubmitting}>Back</Button>
          ) : (
            <Link href="/builders" passHref>
              <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </Link>
          )}
        </div>
        {/* Network Switch / Next / Approve / Submit */}
        <div className="flex items-center space-x-2">
          {!isCorrectNetwork() && connectedAddress && (
            <Button type="button" onClick={handleNetworkSwitch} disabled={isNetworkSwitching || isSubmitting} variant="secondary">
              {isNetworkSwitching ? 'Switching...' : `Switch to ${getNetworkName(selectedChainId)}`}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleNext}
            disabled={
              isNetworkSwitching ||
              isAnyTxPending || // Covers isApproving and isCreating
              !connectedAddress ||
              !isCorrectNetwork() ||
              (currentStep === FORM_STEPS.length && isLoadingFeeData) || // Disable final button if fee data loading
              (currentStep === FORM_STEPS.length && !form.formState.isValid) // Disable final step if form invalid
            }
          >
            {(isApproving || isCreating) && <RiProgress4Fill className="size-4 mr-2 animate-spin" />}
            {/* Dynamically set button text based on state */}
            {isCreating
              ? 'Creating Pool...'
              : isApproving
              ? 'Approving...'
              : currentStep < FORM_STEPS.length
              ? "Next"
              : needsApproval
              ? `Approve ${tokenSymbol}` // Show Approve if needed
              : "Confirm & Create Pool" // Otherwise, show Confirm
            }
          </Button>
        </div>
      </div>
      {!connectedAddress && <p className="text-center text-yellow-500 mt-4">Please connect your wallet.</p>}
    </div>
  );
} 