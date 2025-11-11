import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Settings } from 'lucide-react';

interface ApplicationSettingsRedirectProps {
  settingType: string;
  title: string;
  description: string;
}

export function ApplicationSettingsRedirect({ settingType, title, description }: ApplicationSettingsRedirectProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          {description}
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800 mb-3">
            This settings category has been moved to the unified Job Application Settings interface for better management and consistency.
          </p>
          <Button 
            onClick={() => navigate('/settings?tab=application')}
            className="w-full"
          >
            Go to Unified Settings
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}