import React from "react";

export default function MobileContainer({ children }) {
  return (
    <div className="min-h-screen w-full bg-neutral-200 flex justify-center items-start">
      <div className="w-full max-w-[430px] min-h-screen bg-neutral relative overflow-x-hidden shadow-device">
        {children}
      </div>
    </div>
  );
}
