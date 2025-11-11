import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface MinimalistHeaderProps {
  isConnected: boolean;
}

export function MinimalistHeader({ isConnected }: MinimalistHeaderProps) {
  const [greeting, setGreeting] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-8 py-8 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-2xl shadow-lg">
      {/* Left: Greeting */}
      <div className="text-2xl font-semibold text-white">
        {greeting}
      </div>

      {/* Right: Date & Time */}
      <div className="flex items-center gap-3 text-base">
        <span className="text-white/90 font-medium">
          {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
        <span className="text-white/60">•</span>
        <span className="text-white/90 font-medium">
          {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
