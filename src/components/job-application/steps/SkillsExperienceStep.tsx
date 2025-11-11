import { SkillsExperience } from '../types';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUnifiedJobApplicationSettings, transformSkillsSettings } from '@/hooks/queries/useUnifiedJobApplicationSettings';

interface SkillsExperienceStepProps {
  data: SkillsExperience;
  updateData: (field: keyof SkillsExperience, value: Record<string, 'Good' | 'Basic' | 'None'>) => void;
}

interface SkillsByCategory {
  [categoryName: string]: Array<{
    id: string;
    name: string;
    display_order: number;
  }>;
}

export function SkillsExperienceStep({ data, updateData }: SkillsExperienceStepProps) {
  const { data: settings, isLoading } = useUnifiedJobApplicationSettings('skills');
  const skillsByCategory = settings ? transformSkillsSettings(settings) : {};
  const handleSkillChange = (skill: string, level: 'Good' | 'Basic' | 'None') => {
    updateData('skills', { ...data.skills, [skill]: level });
  };

  if (isLoading) {
    return <div>Loading skills...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Skills & Experience</h3>
        <p className="text-muted-foreground mb-6">Please indicate if you have skills and experience in the following areas.</p>
      </div>

      <div className="space-y-6">
        {Object.entries(skillsByCategory).map(([categoryName, skills]) => (
          <Card key={categoryName} className="border">
            <CardHeader>
              <CardTitle className="text-base">{categoryName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {skills.map(skill => (
                <div key={skill.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <Label className="font-medium text-sm flex-1">{skill.name}</Label>
                  <div className="flex gap-2">
                    {(['Good', 'Basic', 'None'] as const).map(level => (
                      <Button
                        key={level}
                        variant={data.skills?.[skill.name] === level ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleSkillChange(skill.name, level)}
                        className="min-w-[60px]"
                      >
                        {level}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}