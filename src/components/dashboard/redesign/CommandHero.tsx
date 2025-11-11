import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CommandHeroProps {
  isConnected: boolean;
}

export function CommandHero({ isConnected }: CommandHeroProps) {
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
    <div className="relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-primary/60 rounded-3xl"></div>
      
      {/* Floating orbs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full blur-3xl animate-pulse delay-700"></div>
      
      <div className="relative z-10 p-8 md:p-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                {greeting}
              </h1>
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-xl">
                <Zap className="w-3 h-3 mr-1" />
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Badge>
              {isConnected && (
                <Badge className="bg-success/20 text-white border-success/30 backdrop-blur-xl animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-success mr-2" />
                  Live
                </Badge>
              )}
            </div>
            <p className="text-xl text-white/90">
              Welcome to your HR Control Center
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl text-white text-sm font-medium">
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
