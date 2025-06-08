"use client";

import { useState, useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAccount, useChainId } from 'wagmi';
import Link from "next/link";
import { RiProgress4Fill } from "@remixicon/react";
import { AlertCircle } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

// Import the form schemas
import { formSchema, FormData, FORM_STEPS } from "@/components/subnet-form/schemas";

// Import the form step components
import Step1PoolConfig from "@/components/subnet-form/Step1PoolConfig";
import Step2ProjectMetadata from "@/components/subnet-form/Step2ProjectMetadata";
import ProgressStepper from "@/components/subnet-form/ProgressStepper";

// Import custom hooks
import useSubnetContractInteractions from "@/hooks/useSubnetContractInteractions";

// Import network config
import { arbitrumSepolia, arbitrum, base } from 'wagmi/chains';

// Import useBalance hook
import { useBalance } from 'wagmi';

export default function NewSubnetPage() {
  // --- State --- //
  const [currentStep, setCurrentStep] = useState(1);
  const [hasValidationError, setHasValidationError] = useState(false);
  const { address: connectedAddress } = useAccount();
  const walletChainId = useChainId();

  // Determine the initial network: use wallet network if supported, otherwise default to Arbitrum Sepolia
  const getInitialNetworkId = () => {
    const supportedChainIds = [arbitrumSepolia.id, arbitrum.id, base.id] as const;
    if (walletChainId && supportedChainIds.includes(walletChainId as typeof supportedChainIds[number])) {
      return walletChainId;
    }
    return arbitrumSepolia.id; // Fallback to Arbitrum Sepolia
  };

  // --- Form Setup --- //
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subnet: {
        name: "",
        minStake: 0.001,
        fee: 0,
        feeTreasury: undefined as unknown as `0x${string}` | undefined,
        networkChainId: getInitialNetworkId(),
        withdrawLockPeriod: 7,
        withdrawLockUnit: "days",
        startsAt: new Date(),
        maxClaimLockEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
      builderPool: {
        name: "",
        minimalDeposit: 0,
      },
      metadata: { slug: "", description: "", website: "", image: "" },
      projectOffChain: { email: "", discordLink: "", twitterLink: "", rewards: [] },
    },
    mode: "onChange",
  });

    // Get the selected chain ID from the form
  const selectedChainId = form.watch("subnet.networkChainId");

  // --- Balance Check --- //
  const { data: balanceData, isLoading: isLoadingBalance } = useBalance({
    address: connectedAddress,
    chainId: selectedChainId,
    query: {
      enabled: !!connectedAddress && !!selectedChainId,
    }
  });
  const hasNoEth = balanceData && balanceData.value === BigInt(0);

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
    getNetworkName,
    handleNetworkSwitch,
    handleApprove,
    handleCreateSubnet
  } = useSubnetContractInteractions({ 
    selectedChainId,
    onTxSuccess: () => {
      // Get the subnet name based on network type
      const isTestnet = selectedChainId === arbitrumSepolia.id;
      const subnetName = isTestnet 
        ? form.getValues("subnet.name")
        : form.getValues("builderPool.name");
      
      // Store the new subnet name in localStorage for the builders page to pick up
      if (subnetName) {
        localStorage.setItem('new_subnet_created', JSON.stringify({
          name: subnetName,
          timestamp: Date.now()
        }));
      }
      
      // Navigate to builders page with subnets tab
      window.location.href = '/builders?tab=subnets';
    }
  });

  // --- Action Handlers --- //

  // Handles stepping through form or triggering final action (approve/submit)
  const handleNext = useCallback(async () => {
    console.log("handleNext called. Current step:", currentStep);
    console.log("Form errors before trigger:", JSON.stringify(form.formState.errors, null, 2)); // Log existing errors
    console.log("Is form valid before trigger?:", form.formState.isValid);

    let fieldsToValidate: string[] = [];

    if (currentStep === 1) {
      const isTestnet = form.getValues("subnet.networkChainId") === arbitrumSepolia.id;
      // Define base fields common to both networks for Step 1 validation
      const baseStep1Fields = [
        "subnet.networkChainId",
        "subnet.startsAt",
        "subnet.withdrawLockPeriod",
        "subnet.withdrawLockUnit",
        "subnet.maxClaimLockEnd"
      ];

      if (isTestnet) {
        fieldsToValidate = [
          ...baseStep1Fields,
          "subnet.name", // Testnet name field
          "subnet.minStake", // Testnet stake field
          "subnet.fee", // Testnet only
          "subnet.feeTreasury" // Testnet only
        ];
      } else {
        // Mainnet uses different names for some fields and omits others
        fieldsToValidate = [
          ...baseStep1Fields,
          // --- IMPORTANT: Map to the names REGISTERED by Step1PoolConfig --- 
          "builderPool.name", // Mainnet name field (as registered)
          "builderPool.minimalDeposit" // Mainnet deposit field (as registered)
          // No fee or treasury for mainnet validation
        ];
      }
      // Filter out any potential duplicates if base fields somehow overlap
      fieldsToValidate = Array.from(new Set(fieldsToValidate));
    } else {
      // Explicitly list fields for Step 2 validation
      const isTestnet = form.getValues("subnet.networkChainId") === arbitrumSepolia.id;
      const step2BaseFields = [
        "metadata.description",
        "metadata.website",
        "metadata.image",
        "projectOffChain.email",
        "projectOffChain.discordLink",
        "projectOffChain.twitterLink",
        "projectOffChain.rewards"
      ];
      if (isTestnet) {
        fieldsToValidate = [...step2BaseFields, "metadata.slug"]; // Add slug only for testnet
      } else {
        fieldsToValidate = [...step2BaseFields];
      }
    }

    console.log("Fields to validate:", fieldsToValidate); // Debugging log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await form.trigger(fieldsToValidate as any, { shouldFocus: true });
    console.log("Validation trigger result:", result); // Log validation result
    if (!result) {
      console.log("Validation failed. Form errors after trigger:", JSON.stringify(form.formState.errors, null, 2));
      return; // Don't proceed if validation fails
    }

    console.log("Validation passed. Proceeding with network switch or action...");

    // Ensure correct network first
    if (!isCorrectNetwork()) {
      console.log("Incorrect network, attempting switch...");
      const switchSuccessful = await handleNetworkSwitch();
      if (!switchSuccessful) {
        console.log("Network switch failed or was cancelled.");
        return;
      }
      console.log("Network switch successful.");
    }

    // On final step, decide whether to approve or submit based on current state
    if (currentStep === FORM_STEPS.length) {
      console.log("Final step. Needs approval:", needsApproval);
      if (needsApproval) {
        console.log("Calling handleApprove...");
        handleApprove();
      } else {
        console.log("Calling form.handleSubmit(handleCreateSubnet)...");
        console.log("Current form values:", form.getValues());
        console.log("Form validation state:", {
          isValid: form.formState.isValid,
          errors: form.formState.errors
        });
        form.handleSubmit((data) => {
          console.log("Form data submitted to handleCreateSubnet:", data);
          handleCreateSubnet(data);
        }, (errors) => {
          console.error("Form submission failed validation:", errors);
        })();
      }
    } else {
      console.log("Moving to next step.");
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

  // --- Inline Debug Logger ---
  type ExtendedFormValues = FormData & {
    builderPool?: {
      name?: string;
      minimalDeposit?: number;
    };
  };

  useEffect(() => {
    const dbgValues = {
      currentStep,
      isSubmitting,
      formIsValid: form.formState.isValid,
      formErrors: form.formState.errors,
      needsApproval,
      selectedChainId,
      subnetName: form.getValues("subnet.name"),
      subnetMinStake: form.getValues("subnet.minStake"),
      builderPoolName: (form.getValues() as ExtendedFormValues).builderPool?.name,
      builderPoolDeposit: (form.getValues() as ExtendedFormValues).builderPool?.minimalDeposit,
    };

    if (process.env.NODE_ENV !== 'production') {
      console.group("[Subnet Form Debug]");
      console.log(dbgValues);
      console.groupEnd();
    }
  }, [currentStep, isSubmitting, form.formState.isValid, form.formState.errors, needsApproval, selectedChainId, form]);

  // --- Render --- //
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-400 mb-2">Create Builder Subnet</h1>
        <p className="text-gray-400">Configure your builder subnet and project details.</p>
        {!connectedAddress && <p className="text-yellow-500 mt-2">Please connect your wallet.</p>}
        {/* Display ETH warning badge if needed */}      
        {connectedAddress && selectedChainId && !isLoadingBalance && hasNoEth && isCorrectNetwork() && (
          <Badge variant="destructive" className="mt-4 inline-flex items-center">
            <AlertCircle className="h-4 w-4 mr-1.5" />
            No ETH detected on {getNetworkName(selectedChainId)} for network fees.
          </Badge>
        )}
      </div>

      {/* Progress Steps */}
      <ProgressStepper currentStep={currentStep} isSubmitting={isSubmitting} />

      {/* Form Content */}
      <Form {...form}>
        <form className="space-y-6">
          {/* Step 1: Subnet Config */}
          {currentStep === 1 && (
            <Step1PoolConfig 
              isSubmitting={isSubmitting} 
              tokenSymbol={tokenSymbol}
              onValidationChange={setHasValidationError}
            />
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
              (currentStep === FORM_STEPS.length && hasNoEth && isCorrectNetwork()) || // Disable final button if no ETH on correct network
              hasValidationError // Disable if there are validation errors (e.g., duplicate subnet name)
              // Don't pre-disable on isValid; we validate inside handleNext
            }
          >
            {(isApproving || isCreating) && <RiProgress4Fill className="size-4 mr-2 animate-spin" />}
            {/* Dynamically set button text based on state */}
            {isCreating
              ? 'Creating Subnet...'
              : isApproving
              ? 'Approving...'
              : currentStep < FORM_STEPS.length
              ? "Next"
              : needsApproval
              ? `Approve ${tokenSymbol}` // Show Approve if needed
              : "Confirm & Create Subnet" // Otherwise, show Confirm
            }
          </Button>
        </div>
      </div>
      {!connectedAddress && <p className="text-center text-yellow-500 mt-4">Please connect your wallet.</p>}

      {/* Inline console logs will appear in the browser dev-tools */}
    </div>
  );
} 