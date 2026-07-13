import React from "react";
import { Check } from "lucide-react";

const STEP_NAMES = ["Transport", "Locations", "Load Info", "Truck", "Review"];

export default function StepIndicator({ currentStep, onStepClick }) {
  return (
    <div className="flex items-center justify-between mb-8 px-2">
      {[1, 2, 3, 4, 5].map((step, index) => {
        const isDone = step < currentStep;
        const isCurrent = step === currentStep;
        const clickable = isDone && typeof onStepClick === "function";

        const circle = (
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
              isDone
                ? "bg-success text-white"
                : isCurrent
                ? "bg-primary text-white ring-4 ring-primary/20"
                : "bg-neutral-100 text-neutral-300"
            } ${clickable ? "group-hover:ring-4 group-hover:ring-success/30" : ""}`}
          >
            {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : step}
          </div>
        );

        const label = (
          <span
            className={`text-[11px] font-medium whitespace-nowrap ${
              isCurrent
                ? "text-primary"
                : isDone
                ? `text-success ${clickable ? "group-hover:underline" : ""}`
                : "text-neutral-300"
            }`}
          >
            {STEP_NAMES[index]}
          </span>
        );

        return (
          <React.Fragment key={step}>
            {clickable ? (
              <button
                type="button"
                onClick={() => onStepClick(step)}
                className="group flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none"
              >
                {circle}
                {label}
              </button>
            ) : (
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                {circle}
                {label}
              </div>
            )}
            {index < 4 && (
              <div
                className={`flex-1 h-0.5 mx-3 mb-5 transition-colors duration-300 ${
                  step < currentStep ? "bg-success" : "bg-neutral-100"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
