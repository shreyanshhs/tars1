import { recommendCourses } from '../components/views/nptel/recommendations'
import type { Course, RecommendationRequest, RecommendationResponse } from '../components/views/nptel/recommendations'

// Sample catalogue. Workload, level and prerequisites are demo fixtures.
export const sampleCourses: Course[] = [
  { id:'python-joy', title:'The Joy of Computing using Python', topics:['python','programming'], level:'Beginner', weeklyHours:4, prerequisites:[] },
  { id:'dbms', title:'Database Management System', topics:['databases','sql'], level:'Beginner', weeklyHours:4, prerequisites:[] },
  { id:'ml-foundations', title:'Introduction to Machine Learning', topics:['python','machine learning'], level:'Intermediate', weeklyHours:6, prerequisites:['python'] },
  { id:'programming-structures', title:'Programming, Data Structures and Algorithms Using Python', topics:['python','algorithms'], level:'Intermediate', weeklyHours:5, prerequisites:['python'] },
  { id:'cloud-computing', title:'Cloud Computing', topics:['cloud','systems'], level:'Intermediate', weeklyHours:5, prerequisites:['networks'] },
]

export function getMockRecommendations(request: RecommendationRequest): RecommendationResponse {
  return { source:'mock', recommendations:recommendCourses(sampleCourses, request) }
}
