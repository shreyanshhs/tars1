export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced'
export type Course = {
  id: string
  title: string
  topics: string[]
  level: CourseLevel
  weeklyHours: number
  prerequisites: string[]
}
export type RecommendationRequest = {
  interests: string[]
  skills: string[]
  maxWeeklyHours: number
  level: CourseLevel
  limit?: number
}
export type Recommendation = { course: Course; matchedTopics: string[]; reason: string }
export type RecommendationResponse = { source: 'mock' | 'live'; recommendations: Recommendation[] }
const levels: CourseLevel[] = ['Beginner', 'Intermediate', 'Advanced']
const normalise = (values: string[]) => new Set(values.map(value => value.trim().toLowerCase()).filter(Boolean))

export function recommendCourses(catalog: Course[], request: RecommendationRequest): Recommendation[] {
  const interests = normalise(request.interests)
  const skills = normalise(request.skills)
  const limit = Math.max(0, Math.min(20, Math.floor(request.limit ?? 5)))
  return catalog
    .filter(course => course.weeklyHours <= request.maxWeeklyHours &&
      levels.indexOf(course.level) <= levels.indexOf(request.level) &&
      course.prerequisites.every(skill => skills.has(skill.toLowerCase())))
    .map(course => ({ course, matchedTopics: [...new Set(course.topics.filter(topic => interests.has(topic.toLowerCase())))] }))
    .sort((a,b) => b.matchedTopics.length - a.matchedTopics.length ||
      a.course.weeklyHours - b.course.weeklyHours || a.course.id.localeCompare(b.course.id))
    .slice(0, limit)
    .map(({ course, matchedTopics }) => ({
      course, matchedTopics,
      reason: matchedTopics.length
        ? `Matches ${matchedTopics.join(', ')} and fits your ${request.maxWeeklyHours}-hour weekly budget.`
        : `${course.level} option within your weekly budget and current prerequisites.`,
    }))
}
