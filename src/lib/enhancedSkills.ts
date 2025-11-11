import { fetchUnifiedJobApplicationSettings, transformSkillsSettings } from '@/hooks/queries/useUnifiedJobApplicationSettings'
import type { JobApplicationData } from '@/components/job-application/types'

// Enhanced skills generation function for consistent results
export async function generateEnhancedSkills(
  applicationData: JobApplicationData,
  applicationId?: string
): Promise<Record<string, 'Good' | 'Basic' | 'None'>> {
  try {
    // Get all available skills from settings
    const settings = await fetchUnifiedJobApplicationSettings('skills')
    const skillsByCategory = transformSkillsSettings(settings)
    
    // Create a flat list of all available skills
    const allSkills: string[] = []
    Object.values(skillsByCategory).forEach(skills => {
      skills.forEach(skill => allSkills.push(skill.name))
    })
    
    // Get existing skills from application
    const existingSkills = applicationData.skillsExperience?.skills || {}
    const enhancedSkills = { ...existingSkills }
    
    // Create a deterministic seed based on application ID or fallback
    const seed = applicationId || 'default-seed'
    let seedNum = 0
    for (let i = 0; i < seed.length; i++) {
      seedNum += seed.charCodeAt(i)
    }
    
    // Simple seeded random function
    let random = seedNum
    const seededRandom = () => {
      random = (random * 9301 + 49297) % 233280
      return random / 233280
    }
    
    // Add missing skills with weighted random selection
    allSkills.forEach((skillName, index) => {
      if (!enhancedSkills[skillName]) {
        // Add skill index to random for more variation per skill
        const skillRandom = seededRandom() + (index * 0.01)
        const normalizedRandom = skillRandom % 1
        
        if (normalizedRandom < 0.89) {
          enhancedSkills[skillName] = 'Good'
        } else if (normalizedRandom < 0.945) {
          enhancedSkills[skillName] = 'Basic'
        } else {
          enhancedSkills[skillName] = 'None'
        }
      }
    })
    
    return enhancedSkills
  } catch (error) {
    console.warn('Failed to generate enhanced skills:', error)
    // Fallback to original skills if enhancement fails
    return applicationData.skillsExperience?.skills || {}
  }
}