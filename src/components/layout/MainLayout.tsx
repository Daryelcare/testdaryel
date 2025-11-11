import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ProfileDropdown } from "./ProfileDropdown";
import { NotificationPopover } from "./NotificationPopover";
import { FloatingNavBar } from "./FloatingNavBar";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { theme, setTheme } = useTheme();
  const { preferences, loading } = useUserPreferences();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Floating Navigation Layout
  if (preferences.navigationStyle === "floating") {
    return (
      <div className="min-h-screen w-full bg-gradient-subtle">
        <FloatingNavBar />
        <main className="px-6 pb-6 pt-20">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  // Sidebar Layout (Default)
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header */}
          <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="lg:hidden" />
              </div>

              <div className="flex items-center gap-2">
                {/* Notifications */}
                <NotificationPopover />

                {/* Theme Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="w-9 h-9 p-0"
                >
                  {theme === "dark" ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                </Button>

                {/* Profile */}
                <ProfileDropdown />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}