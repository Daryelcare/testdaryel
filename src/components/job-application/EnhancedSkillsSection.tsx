import { useEnhancedSkills } from '@/hooks/useEnhancedSkills'
import type { JobApplicationData } from './types'

interface EnhancedSkillsSectionProps {
  data: JobApplicationData
  applicationId?: string
}

export function EnhancedSkillsSection({ data, applicationId }: EnhancedSkillsSectionProps) {
  const { data: enhancedSkills, isLoading } = useEnhancedSkills(data, applicationId)

  if (isLoading) {
    return (
      <section>
        <h3 className="text-lg font-semibold">Skills & Experience</h3>
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">Loading skills...</p>
        </div>
      </section>
    )
  }

  const skillEntries = Object.entries(enhancedSkills || {})

  return (
    <section>
      <h3 className="text-lg font-semibold">Skills & Experience</h3>
      <div className="mt-3">
        {skillEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No skills listed.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {skillEntries.map(([skill, level]) => (
              <li key={skill} className="flex items-center justify-between text-sm">
                <span className="font-medium">{skill}</span>
                <span className="text-muted-foreground">{String(level)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}