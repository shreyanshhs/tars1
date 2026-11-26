import type { NptelExtraction, NptelRequest, NptelSubmission } from '../types/api'
import { sampleCourses } from './nptelCourses'

export const demoRequest: NptelRequest = {
  id: 'demo-nptel', faculty_id: 'demo-faculty', faculty_name: 'Demo faculty',
  title: 'NPTEL certificate', item: 'NPTEL course certificate', sections: ['CSE-10'],
  due_date: '2026-12-05', total_students: 46, submitted_count: 40,
  verified_count: 38, flagged_count: 2, created_at: '2026-11-25',
}

export const demoSubmissions: NptelSubmission[] = Array.from({ length: 46 }, (_, index) => {
  const number = index + 1
  const status = index < 38 ? 'verified' : index < 44 ? 'pending' : 'flagged'
  return {
    id: `submission-${number}`, request_id: demoRequest.id,
    student_name: index === 38 ? 'Aarav Demo' : `Demo student ${number}`,
    usn: index === 38 ? 'DEMO-CSE10-001' : `NPTEL-DEMO-${number}`, section: 'CSE-10',
    course_name: status === 'pending' ? '' : sampleCourses[index % sampleCourses.length].title,
    score: status === 'pending' ? 0 : 70 + index % 21,
    status, certificate_id: status === 'pending' ? '' : `DEMO-CERT-${number}`,
    uploaded_at: status === 'pending' ? '' : '2026-11-25',
    flags: status === 'flagged' ? [index === 44 ? 'Name on certificate differs from the roster' : 'Course requires faculty review'] : [],
  }
})

export const demoExtraction: NptelExtraction = {
  status: 'verified',
  fields: [
    { name:'Name', value:'Aarav Demo', ok:true },
    { name:'USN', value:'DEMO-CSE10-001', ok:true },
    { name:'Course', value:sampleCourses[0].title, ok:true },
    { name:'Score', value:'88%', ok:true },
    { name:'Certificate ID', value:'DEMO-CERT-39', ok:true },
  ],
}
