import { Palette, Sidebar, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

export function AppearanceSettings() {
  const { preferences, updateNavigationStyle } = useUserPreferences();

  return (
    <Card className="card-premium animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Palette className="w-6 h-6 text-primary" />
          Appearance & Layout
        </CardTitle>
        <CardDescription>
          Customize how your workspace looks and feels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-base">Navigation Style</Label>
          <p className="text-sm text-muted-foreground">
            Choose between a traditional sidebar or a modern floating navigation bar
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Sidebar Option */}
            <button
              onClick={() => updateNavigationStyle("sidebar")}
              className={cn(
                "group relative overflow-hidden rounded-xl border-2 transition-all hover:scale-[1.02]",
                preferences.navigationStyle === "sidebar"
                  ? "border-primary shadow-glow"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="aspect-video bg-gradient-to-br from-muted/50 to-muted p-4 flex items-start gap-3">
                {/* Sidebar Preview */}
                <div className="w-1/4 h-full bg-card border border-border rounded-lg shadow-md" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-card/60 rounded w-3/4" />
                  <div className="h-2 bg-card/40 rounded w-1/2" />
                  <div className="h-16 bg-card/60 rounded mt-4" />
                </div>
              </div>
              <div className="p-4 bg-background">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    preferences.navigationStyle === "sidebar"
                      ? "bg-gradient-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    <Sidebar className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold">Classic Sidebar</h3>
                    <p className="text-xs text-muted-foreground">
                      Traditional left navigation
                    </p>
                  </div>
                  {preferences.navigationStyle === "sidebar" && (
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
              </div>
            </button>

            {/* Floating Nav Option */}
            <button
              onClick={() => updateNavigationStyle("floating")}
              className={cn(
                "group relative overflow-hidden rounded-xl border-2 transition-all hover:scale-[1.02]",
                preferences.navigationStyle === "floating"
                  ? "border-primary shadow-glow"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="aspect-video bg-gradient-to-br from-muted/50 to-muted p-4 space-y-2">
                {/* Floating Nav Preview */}
                <div className="h-10 bg-card/80 backdrop-blur-sm border border-border rounded-full shadow-lg mx-auto" />
                <div className="flex-1 space-y-2 mt-4">
                  <div className="h-3 bg-card/60 rounded w-3/4 mx-auto" />
                  <div className="h-2 bg-card/40 rounded w-1/2 mx-auto" />
                  <div className="h-16 bg-card/60 rounded mt-4" />
                </div>
              </div>
              <div className="p-4 bg-background">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                    preferences.navigationStyle === "floating"
                      ? "bg-gradient-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold">Floating Navigation</h3>
                    <p className="text-xs text-muted-foreground">
                      Modern pill-shaped nav bar
                    </p>
                  </div>
                  {preferences.navigationStyle === "floating" && (
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
              </div>
            </button>
          </div>

          <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              💡 <span className="font-medium">Tip:</span> You can also switch navigation styles from your profile menu in the top right corner
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
