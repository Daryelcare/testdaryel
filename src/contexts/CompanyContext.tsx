
import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/queries/useCompanyQueries';
import { useToast } from "@/hooks/use-toast";

interface CompanySettings {
  id?: string;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
}

interface CompanyContextType {
  companySettings: CompanySettings;
  updateCompanySettings: (settings: Partial<CompanySettings>) => Promise<void>;
  loading: boolean;
  refetchCompanySettings: () => Promise<void>;
}

const defaultSettings: CompanySettings = {
  name: "",
  tagline: "",
  address: "",
  phone: "",
  email: "",
};

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { data: companyData, isLoading: loading, refetch } = useCompanySettings();
  const updateMutation = useUpdateCompanySettings();
  const { toast } = useToast();

  // Use fetched data or fallback to defaults
  const companySettings = companyData || defaultSettings;

  // Update document title when company settings change
  useEffect(() => {
    document.title = companySettings.name || '';
  }, [companySettings.name]);

  // Update favicon when company logo changes
  useEffect(() => {
    if (companySettings.logo) {
      // Remove existing favicon links
      const existingLinks = document.querySelectorAll('link[rel*="icon"]');
      existingLinks.forEach(link => link.remove());

      // Add new favicon with company logo
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = companySettings.logo;
      document.head.appendChild(link);
      
      // Store in localStorage to persist across refreshes
      localStorage.setItem('companyFavicon', companySettings.logo);
    }
  }, [companySettings.logo]);

  const refetchCompanySettings = async () => {
    await refetch();
  };

  const updateCompanySettings = async (newSettings: Partial<CompanySettings>) => {
    try {
      const updatedSettings = { ...companySettings, ...newSettings };
      
      if (companySettings.id) {
        // Update existing record
        await updateMutation.mutateAsync({
          id: companySettings.id,
          name: updatedSettings.name,
          tagline: updatedSettings.tagline,
          address: updatedSettings.address,
          phone: updatedSettings.phone,
          email: updatedSettings.email,
          logo: updatedSettings.logo
        });
      } else {
        // Create new record if none exists
        await updateMutation.mutateAsync({
          name: updatedSettings.name,
          tagline: updatedSettings.tagline,
          address: updatedSettings.address,
          phone: updatedSettings.phone,
          email: updatedSettings.email,
          logo: updatedSettings.logo
        });
      }
      
      toast({
        title: "Success",
        description: "Company settings saved successfully",
      });
    } catch (error) {
      console.error('Error saving company settings:', error);
      toast({
        title: "Error", 
        description: "Failed to save company settings",
        variant: "destructive",
      });
    }
  };

  return (
    <CompanyContext.Provider value={{ 
      companySettings, 
      updateCompanySettings, 
      loading, 
      refetchCompanySettings 
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
