import React from "react";
import { Check } from "lucide-react";

const STEP_NAMES = ["Transport", "Locations", "Load Info", "Truck", "Review", "Broker"];

export default function StepIndicator({ currentStep, onStepClick }) {
  return (
    <div className="bg-white rounded-2xl shadow-card px-4 md:px-6 py-4 mb-6">
      <div className="flex items-center justify-between">
        {[1, 2, 3, 4, 5, 6].map((step, index) => {
          const isDone = step < currentStep;
          const isCurrent = step === currentStep;
          const clickable = isDone && typeof onStepClick === "function";

          const circle = (
            <div
              className={`flex items-center justify-center font-semibold transition-all duration-300 rounded-full ${
                isCurrent
                  ? "w-10 h-10 text-sm bg-primary text-white ring-[5px] ring-primary/15 shadow-glow-blue"
                  : isDone
                  ? "w-9 h-9 text-sm bg-success text-white"
                  : "w-9 h-9 text-sm bg-neutral-100 text-neutral-300"
              } ${clickable ? "group-hover:ring-4 group-hover:ring-success/25" : ""}`}
            >
              {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : step}
            </div>
          );

          const label = (
            <span
              className={`text-[11px] font-semibold whitespace-nowrap tracking-wide ${
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
              {index < 5 && (
                <div className="flex-1 h-1 mx-2 md:mx-3 mb-5 rounded-full bg-neutral-100 overflow-hidden">
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
