import { useState, useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Shield,
  Settings,
  UserCog,
  BarChart3,
  Building2,
  Briefcase,
  FileSignature,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProfileDropdown } from "./ProfileDropdown";
import { NotificationPopover } from "./NotificationPopover";
import { useCompany } from "@/contexts/CompanyContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    requiredPage: "/"
  },
  {
    title: "Employees",
    url: "/employees",
    icon: Users,
    requiredPage: "/employees"
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Building2,
    requiredPage: "/clients"
  },
  {
    title: "Leaves",
    url: "/leaves",
    icon: Calendar,
    requiredPage: "/leaves"
  },
  {
    title: "Documents",
    url: "/documents",
    icon: FileText,
    requiredPage: "/documents"
  },
  {
    title: "Signing",
    url: "/document-signing",
    icon: FileSignature,
    requiredPage: "/document-signing"
  },
  {
    title: "Compliance",
    url: "/compliance",
    icon: Shield,
    requiredPage: "/compliance"
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    requiredPage: "/reports"
  },
  {
    title: "Applications",
    url: "/job-applications",
    icon: Briefcase,
    requiredPage: "/job-applications"
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    requiredPage: "/settings"
  },
  {
    title: "Users",
    url: "/user-management",
    icon: UserCog,
    requiredPage: "/user-management"
  },
];

export function FloatingNavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const location = useLocation();
  const { companySettings } = useCompany();
  const { hasPageAccess, loading: permissionsLoading } = usePermissions();

  // Handle scroll behavior - hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show if scrolling up or at top, hide if scrolling down
      if (currentScrollY < lastScrollY.current || currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const accessibleNavigationItems = permissionsLoading 
    ? [] 
    : navigationItems.filter(item => hasPageAccess(item.requiredPage));

  return (
    <>
      <nav 
        className={cn(
          "sticky top-4 z-50 mx-auto transition-transform duration-300",
          isVisible ? "translate-y-0" : "-translate-y-32"
        )}
        style={{ maxWidth: "fit-content" }}
      >
        <div className="floating-nav backdrop-blur-xl bg-card/80 border border-border/50 rounded-2xl shadow-lg px-3 py-2">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2 flex-shrink-0">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden",
                companySettings.logo ? "" : "bg-gradient-primary"
              )}>
                {companySettings.logo ? (
                  <img
                    src={companySettings.logo}
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Shield className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="hidden md:block">
                <h1 className="text-sm font-bold text-foreground truncate">
                  {companySettings.name}
                </h1>
              </div>
            </NavLink>

            {/* Desktop Navigation - Show ALL items */}
            <div className="hidden lg:flex items-center gap-1">
              {accessibleNavigationItems.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  className={cn(
                    "nav-item px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                    "hover:bg-primary/10 hover:text-primary hover:scale-105",
                    isActive(item.url)
                      ? "bg-gradient-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">{item.title}</span>
                  </div>
                </NavLink>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <NotificationPopover />
              <ProfileDropdown />
              
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden w-8 h-8 p-0"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                companySettings.logo ? "" : "bg-gradient-primary"
              )}>
                {companySettings.logo ? (
                  <img src={companySettings.logo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Shield className="w-4 h-4 text-white" />
                )}
              </div>
              {companySettings.name}
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-8 space-y-1">
            {accessibleNavigationItems.map((item) => (
              <NavLink
                key={item.title}
                to={item.url}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                  "hover:bg-primary/10 hover:text-primary",
                  isActive(item.url)
                    ? "bg-gradient-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.title}
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
