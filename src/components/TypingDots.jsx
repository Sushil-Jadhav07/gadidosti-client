import { Bot } from "lucide-react";

// Animated three-dot "typing" bubble — styled like whichever kind of message it's standing in
// for (an other-party bubble, or the bot's own indigo one) so it reads as part of the thread
// rather than a system-y status line.
export default function TypingDots({ isBot = false, label }) {
  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[75%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 ${
          isBot ? "bg-indigo-50 border border-indigo-100" : "bg-neutral-100"
        }`}
      >
        {label && (
          <p className={`text-[10px] font-semibold mb-1 flex items-center gap-1 ${isBot ? "text-indigo-600" : "opacity-70 text-neutral-500"}`}>
            {isBot && <Bot className="w-3 h-3" />}
            {label}
          </p>
        )}
        <div className="flex items-center gap-1 h-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-typing-dot"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
