import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type NavigationStyle = "sidebar" | "floating";

interface UserPreferences {
  navigationStyle: NavigationStyle;
}

interface UserPreferencesContextType {
  preferences: UserPreferences;
  updateNavigationStyle: (style: NavigationStyle) => void;
  loading: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

const STORAGE_KEY = "user_preferences";

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    navigationStyle: "sidebar",
  });
  const [loading, setLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences(parsed);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateNavigationStyle = (style: NavigationStyle) => {
    const newPreferences = { ...preferences, navigationStyle: style };
    setPreferences(newPreferences);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
  };

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        updateNavigationStyle,
        loading,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error("useUserPreferences must be used within a UserPreferencesProvider");
  }
  return context;
}
