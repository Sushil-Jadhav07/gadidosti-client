import React from "react";
import { Check } from "lucide-react";

const STEP_NAMES = ["Transport", "Locations", "Load Info", "Truck", "Review"];

export default function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-between mb-8 px-2">
      {[1, 2, 3, 4, 5].map((step, index) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                step < currentStep
                  ? "bg-success text-white"
                  : step === currentStep
                  ? "bg-primary text-white ring-4 ring-primary/20"
                  : "bg-neutral-100 text-neutral-300"
              }`}
            >
              {step < currentStep ? (
                <Check className="w-4 h-4" strokeWidth={3} />
              ) : (
                step
              )}
            </div>
            <span
              className={`text-[11px] font-medium whitespace-nowrap ${
                step === currentStep
                  ? "text-primary"
                  : step < currentStep
                  ? "text-success"
                  : "text-neutral-300"
              }`}
            >
              {STEP_NAMES[index]}
            </span>
          </div>
          {index < 4 && (
            <div
              className={`flex-1 h-0.5 mx-3 mb-5 transition-colors duration-300 ${
                step < currentStep ? "bg-success" : "bg-neutral-100"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
