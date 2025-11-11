import { useQuery } from '@tanstack/react-query'
import { generateEnhancedSkills } from '@/lib/enhancedSkills'
import type { JobApplicationData } from '@/components/job-application/types'

export function useEnhancedSkills(
  applicationData: JobApplicationData,
  applicationId?: string
) {
  return useQuery({
    queryKey: ['enhanced-skills', applicationId, applicationData.skillsExperience?.skills],
    queryFn: () => generateEnhancedSkills(applicationData, applicationId),
    staleTime: Infinity, // Cache forever since it's deterministic
    enabled: !!applicationData,
  })
}