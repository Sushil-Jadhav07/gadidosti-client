import React from "react";
import { Check } from "lucide-react";

const STEP_NAMES = ["Location", "Load Info", "Truck", "Review", "Broker"];

// Compact and left-aligned (inline-flex, shrink-to-content) rather than stretched full page
// width — sits as a small top-left badge above the step content instead of spanning the
// whole row.
export default function StepIndicator({ currentStep, onStepClick }) {
  return (
    <div className="inline-flex bg-white rounded-2xl shadow-card px-3 md:px-4 py-2.5 mb-6">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((step, index) => {
          const isDone = step < currentStep;
          const isCurrent = step === currentStep;
          const clickable = isDone && typeof onStepClick === "function";

          const circle = (
            <div
              className={`flex items-center justify-center font-semibold transition-all duration-300 rounded-full ${
                isCurrent
                  ? "w-7 h-7 text-xs bg-primary text-white ring-[3px] ring-primary/15 shadow-glow-blue"
                  : isDone
                  ? "w-6 h-6 text-xs bg-success text-white"
                  : "w-6 h-6 text-xs bg-neutral-100 text-neutral-300"
              } ${clickable ? "group-hover:ring-4 group-hover:ring-success/25" : ""}`}
            >
              {isDone ? <Check className="w-3 h-3" strokeWidth={3} /> : step}
            </div>
          );

          const label = (
            <span
              className={`text-[10px] font-semibold whitespace-nowrap tracking-wide ${
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
                  className="group flex flex-col items-center gap-1 flex-shrink-0 focus:outline-none"
                >
                  {circle}
                  {label}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {circle}
                  {label}
                </div>
              )}
              {index < 4 && (
                <div className="w-8 md:w-12 h-0.5 mx-1.5 md:mx-2 mb-4 rounded-full bg-neutral-100 overflow-hidden flex-shrink-0">
                  <div
                    className={`h-full rounded-full bg-success transition-all duration-500 ${
                      step < currentStep ? "w-full" : "w-0"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
