
import { useState, useEffect, useRef } from "react";
import { Building2, Save, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmailSettings } from "./EmailSettings";

export function CompanySettings() {
  const { companySettings, updateCompanySettings, loading } = useCompany();
  const [formData, setFormData] = useState(companySettings);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setFormData(companySettings);
    
    // Apply favicon immediately if logo exists or restore from localStorage
    if (companySettings.logo) {
      updateFavicon(companySettings.logo);
    } else {
      const storedFavicon = localStorage.getItem('companyFavicon');
      if (storedFavicon) {
        updateFavicon(storedFavicon);
      }
    }
  }, [companySettings]);

  const handleSave = async () => {
    await updateCompanySettings(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resizeImage = (file: File, maxSizeKB: number = 5000): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        const aspectRatio = width / height;
        
        // Start with reasonable max dimensions
        const maxWidth = 1920;
        const maxHeight = 1920;
        
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            width = maxWidth;
            height = maxWidth / aspectRatio;
          } else {
            height = maxHeight;
            width = maxHeight * aspectRatio;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Function to resize with quality adjustment
        const tryQuality = (quality: number): void => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }
            
            // Check file size (convert to KB)
            const sizeKB = blob.size / 1024;
            
            if (sizeKB <= maxSizeKB || quality <= 0.1) {
              // Create a new File from the blob
              const resizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(resizedFile);
            } else {
              // Try with lower quality
              tryQuality(quality - 0.1);
            }
          }, 'image/jpeg', quality);
        };
        
        // Start with high quality and reduce if needed
        tryQuality(0.9);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a valid image file (JPEG, PNG, WebP, or SVG)",
        variant: "destructive",
      });
      return;
    }

    try {
      setLogoUploading(true);

      let fileToUpload = file;

      // Check if file is larger than 5MB and resize if needed (skip SVG files)
      if (file.size > 5 * 1024 * 1024 && file.type !== 'image/svg+xml') {
        toast({
          title: "Resizing image",
          description: "Image is large, resizing automatically...",
        });
        
        try {
          fileToUpload = await resizeImage(file);
          toast({
            title: "Image resized",
            description: `Original: ${(file.size / 1024 / 1024).toFixed(1)}MB → Resized: ${(fileToUpload.size / 1024 / 1024).toFixed(1)}MB`,
          });
        } catch (resizeError) {
          console.error('Error resizing image:', resizeError);
          toast({
            title: "Resize failed",
            description: "Could not resize image. Please use a smaller file.",
            variant: "destructive",
          });
          return;
        }
      }

      // Final size check for SVG files
      if (fileToUpload.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB",
          variant: "destructive",
        });
        return;
      }

      // Create a unique filename
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('company-assets')
        .upload(fileName, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName);

      // Update form data only
      setFormData(prev => ({ ...prev, logo: publicUrl }));

      // Update favicon
      updateFavicon(publicUrl);

      toast({
        title: "Logo uploaded successfully",
        description: "Click 'Save Company Settings' to save changes",
      });

    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLogoUploading(false);
    }
  };

  const updateFavicon = (logoUrl: string) => {
    // Remove existing favicon links
    const existingLinks = document.querySelectorAll('link[rel*="icon"]');
    existingLinks.forEach(link => link.remove());

    // Add new favicon
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = logoUrl;
    document.head.appendChild(link);
    
    // Store in localStorage to persist across refreshes
    localStorage.setItem('companyFavicon', logoUrl);
  };

  const removeLogo = () => {
    setFormData(prev => ({ ...prev, logo: '' }));
    
    // Reset favicon to default
    const existingLinks = document.querySelectorAll('link[rel*="icon"]');
    existingLinks.forEach(link => link.remove());
    
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = '/favicon.ico';
    document.head.appendChild(link);
    
    // Remove from localStorage
    localStorage.removeItem('companyFavicon');
  };

  if (loading) {
    return <div>Loading company settings...</div>;
  }

  return (
    <div className="space-y-8">
      <Card className="card-premium animate-fade-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            Company Information
          </CardTitle>
        </CardHeader>
      <CardContent className="space-y-6">
        {/* Logo Upload Section */}
        <div className="space-y-4">
          <Label>Company Logo</Label>
          <div className="flex items-center gap-4">
            {formData.logo ? (
              <div className="relative">
                <img
                  src={formData.logo}
                  alt="Company Logo"
                  className="w-16 h-16 object-contain rounded-lg bg-card p-2"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full"
                  onClick={removeLogo}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border bg-muted/50 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            
            <div className="flex-1">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {logoUploading ? "Uploading..." : "Upload Logo"}
              </Button>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a logo that will appear in the sidebar and as favicon. Supports JPEG, PNG, WebP, SVG. Large images will be automatically resized.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter company name"
            />
            <p className="text-sm text-muted-foreground">
              This will appear in the sidebar and throughout the application
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-tagline">Tagline</Label>
            <Input
              id="company-tagline"
              value={formData.tagline}
              onChange={(e) => handleInputChange('tagline', e.target.value)}
              placeholder="Enter company tagline"
            />
            <p className="text-sm text-muted-foreground">
              Short description shown below the company name
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-address">Company Address</Label>
          <Textarea
            id="company-address"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            placeholder="Enter full company address"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="company-phone">Phone Number</Label>
            <Input
              id="company-phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="Enter phone number"
            />
          </div>

        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} className="bg-gradient-primary hover:opacity-90">
            <Save className="w-4 h-4 mr-2" />
            Save Company Settings
          </Button>
        </div>
      </CardContent>
    </Card>
    
    <EmailSettings />
    </div>
  );
}
