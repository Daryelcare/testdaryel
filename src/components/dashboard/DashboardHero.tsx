import { useEffect, useState } from "react";
import { Command, Search, Plus, FileText, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function DashboardHero() {
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-8 text-white shadow-lg">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-bold animate-fade-in">
                {greeting} 👋
              </h1>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Badge>
            </div>
            <p className="text-lg text-white/90">
              Your comprehensive HR command center
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Quick Add
            </Button>
          </div>
        </div>

        {/* Command Bar */}
        <div className="relative group">
          <div className="absolute inset-0 bg-white/10 rounded-lg blur-xl group-hover:bg-white/20 transition-all"></div>
          <div className="relative flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg px-4 py-3 hover:bg-white/20 transition-all cursor-pointer">
            <Search className="w-5 h-5 text-white/70" />
            <input 
              type="text"
              placeholder="Search employees, documents, or type a command..."
              className="flex-1 bg-transparent text-white placeholder:text-white/60 outline-none"
            />
            <kbd className="hidden md:flex items-center gap-1 px-2 py-1 text-xs bg-white/10 rounded border border-white/20">
              <Command className="w-3 h-3" />
              K
            </kbd>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          {[
            { icon: Users, label: "Add Employee", color: "bg-white/10" },
            { icon: FileText, label: "Upload Document", color: "bg-white/10" },
            { icon: Calendar, label: "Approve Leave", color: "bg-white/10" }
          ].map((action, index) => (
            <button
              key={index}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all group"
            >
              <action.icon className="w-4 h-4 text-white/80 group-hover:text-white transition-colors" />
              <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
