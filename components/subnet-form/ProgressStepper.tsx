import React from 'react';
import { RiCheckboxCircleFill, RiProgress4Fill } from "@remixicon/react";
import { FORM_STEPS } from './types/schemas';

interface ProgressStepperProps {
  currentStep: number;
  isSubmitting: boolean;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ currentStep, isSubmitting }) => {
  const stepsCount = FORM_STEPS.length;

  return (
    <div className="mb-6">
      <div className="h-2 w-full bg-emerald-500/20 rounded-full mb-2">
        <div
          className="h-full bg-emerald-400 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${(currentStep / stepsCount) * 100}%` }}
        />
      </div>
      <div className="flex justify-between">
        {FORM_STEPS.map((step) => (
          <div key={step.id} className="flex items-center gap-2">
            {currentStep > step.id ? (
              <RiCheckboxCircleFill className="size-4 text-emerald-400" />
            ) : currentStep === step.id ? (
              <RiProgress4Fill 
                className={`size-4 text-emerald-400 ${isSubmitting && step.id === stepsCount ? 'animate-spin' : ''}`} 
              />
            ) : (
              <div className="size-4 rounded-full border border-emerald-500/50" />
            )}
            <span className="text-sm text-gray-300">{step.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressStepper; 