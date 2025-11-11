import { Sidebar, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

export function LayoutToggle() {
  const { preferences, updateNavigationStyle } = useUserPreferences();
  const isSidebar = preferences.navigationStyle === "sidebar";

  return (
    <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => updateNavigationStyle("sidebar")}
        className={cn(
          "flex-1 gap-2 transition-all",
          isSidebar && "bg-background shadow-sm"
        )}
      >
        <Sidebar className="w-4 h-4" />
        <span className="text-xs">Sidebar</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => updateNavigationStyle("floating")}
        className={cn(
          "flex-1 gap-2 transition-all",
          !isSidebar && "bg-background shadow-sm"
        )}
      >
        <LayoutGrid className="w-4 h-4" />
        <span className="text-xs">Floating</span>
      </Button>
    </div>
  );
}
