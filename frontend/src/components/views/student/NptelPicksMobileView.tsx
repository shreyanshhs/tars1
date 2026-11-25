import React, { useState } from 'react';
import {
  Sparkles,
  Brain,
  Code2,
  Lightbulb,
  Bookmark,
  Check,
  Home,
  Inbox,
  Calendar,
  Award,
} from 'lucide-react';

interface RecommendedCourse {
  id: string;
  title: string;
  duration: string;
  credits: number;
  why: string;
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  iconText: string;
  enrolled: boolean;
  bookmarked: boolean;
}

export const NptelPicksMobileView: React.FC = () => {
  const [courses, setCourses] = useState<RecommendedCourse[]>([
    {
      id: 'c_ml',
      title: 'Introduction to Machine Learning',
      duration: '12 weeks',
      credits: 3,
      why: 'Builds on your Intro to AI course',
      icon: <Brain className="w-5 h-5" />,
      iconBg: 'bg-[#F5F3FF]',
      iconBorder: 'border-[#DDD6FE]',
      iconText: 'text-[#5B21B6]',
      enrolled: false,
      bookmarked: false,
    },
    {
      id: 'c_dsa',
      title: 'Programming, Data Structures and Algorithms using Python',
      duration: '8 weeks',
      credits: 2,
      why: 'Next step after your Python lab',
      icon: <Code2 className="w-5 h-5" />,
      iconBg: 'bg-[#EEF2FF]',
      iconBorder: 'border-[#C7D2FE]',
      iconText: 'text-[#3730A3]',
      enrolled: false,
      bookmarked: false,
    },
    {
      id: 'c_web',
      title: 'Modern Application Development',
      duration: '12 weeks',
      credits: 3,
      why: 'Matches your interest in web; fits your free Fri P4–P7',
      icon: <Lightbulb className="w-5 h-5" />,
      iconBg: 'bg-[#FFFBEB]',
      iconBorder: 'border-[#FDE68A]',
      iconText: 'text-[#92400E]',
      enrolled: false,
      bookmarked: false,
    },
  ]);

  const toggleEnroll = (id: string) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enrolled: !c.enrolled } : c))
    );
  };

  const toggleBookmark = (id: string) => {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, bookmarked: !c.bookmarked } : c))
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] max-w-md mx-auto border-x border-[#E2E8F0]">
      {/* Mobile Header matching Stitch courses_picked_for_you_shreyansh */}
      <header className="sticky top-0 z-10 bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3.5 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-bold text-[#0F172A]">NPTEL · Jan 2027</h1>
          <p className="text-xs text-[#475569] tabular-nums">Enrollment closes 15 Dec</p>
        </div>
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#4F46E5] text-white text-xs font-semibold shrink-0">
          S
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-4 flex flex-col gap-4 pb-20">
        {/* TARS Insight Card */}
        <section aria-label="TARS recommendation summary" className="p-3.5 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-[#4F46E5] shrink-0 mt-0.5" />
          <p className="text-xs text-[#3730A3] leading-relaxed">
            Picked from your subjects, your interests (AI, web) and your lighter Wed/Fri afternoons.
          </p>
        </section>

        {/* 3 Course Cards */}
        <section aria-label="Recommended courses" className="flex flex-col gap-3.5">
          {courses.map((course) => (
            <article
              key={course.id}
              className="bg-white border border-[#E2E8F0] rounded-xl p-4 flex flex-col gap-3 shadow-xs"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${course.iconBg} border ${course.iconBorder} ${course.iconText} shrink-0`}
                >
                  {course.icon}
                </span>

                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <h2 className="text-sm font-semibold text-[#0F172A] leading-snug">
                    {course.title}
                  </h2>
                  <p className="text-xs text-[#475569] tabular-nums font-medium">
                    {course.duration} · {course.credits} credits
                  </p>
                  <p className="text-xs text-[#64748B]">
                    Why: {course.why}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => toggleEnroll(course.id)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                    course.enrolled
                      ? 'bg-[#DCFCE7] text-[#15803D] border border-[#BBF7D0]'
                      : 'bg-[#4F46E5] text-white hover:bg-[#4338CA]'
                  }`}
                >
                  {course.enrolled ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Enrolled on NPTEL
                    </>
                  ) : (
                    'Enroll on NPTEL'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggleBookmark(course.id)}
                  aria-label={`Save ${course.title}`}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white border border-[#E2E8F0] transition-colors ${
                    course.bookmarked
                      ? 'text-[#4F46E5] border-[#4F46E5] bg-[#EEF2FF]'
                      : 'text-[#475569] hover:text-[#4F46E5]'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${course.bookmarked ? 'fill-current' : ''}`} />
                </button>
              </div>
            </article>
          ))}
        </section>

        <div className="text-center py-1">
          <button type="button" className="text-xs text-[#64748B] hover:text-[#4F46E5]">
            Not for me — show other courses
          </button>
        </div>
      </main>

      {/* Sticky Bottom Navigation matching Stitch */}
      <nav aria-label="Mobile navigation" className="sticky bottom-0 z-10 bg-white border-t border-[#E2E8F0] px-2 py-2 grid grid-cols-4 gap-1">
        <button type="button" className="flex flex-col items-center justify-center gap-0.5 py-1 rounded text-[#64748B]">
          <Home className="w-5 h-5" />
          <span className="text-[11px]">Home</span>
        </button>
        <button type="button" className="flex flex-col items-center justify-center gap-0.5 py-1 rounded text-[#64748B]">
          <Inbox className="w-5 h-5" />
          <span className="text-[11px]">Inbox</span>
        </button>
        <button type="button" className="flex flex-col items-center justify-center gap-0.5 py-1 rounded text-[#64748B]">
          <Calendar className="w-5 h-5" />
          <span className="text-[11px]">Schedule</span>
        </button>
        <button type="button" aria-current="page" className="flex flex-col items-center justify-center gap-0.5 py-1 rounded text-[#4F46E5]">
          <Award className="w-5 h-5" />
          <span className="text-[11px] font-semibold">Requests</span>
        </button>
      </nav>
    </div>
  );
};

export default NptelPicksMobileView;
