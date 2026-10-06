import {
  Home,
  Bell,
  Rss,
  ClipboardList,
  GraduationCap,
  Award,
  Briefcase,
  Send,
  Contact,
  Network,
  BarChart3,
  HelpCircle,
  FileBarChart2,
  MessageCircle,
  Settings,
} from "lucide-react";

// `badgeKey` maps to summary.badges.<key> from GET /api/staff/dashboard/summary.
// `hasFigma: false` items have no design reference yet (spec section 32) —
// their pages say so plainly rather than pretending otherwise.
export const NAV_GROUPS = [
  {
    label: "Main",
    items: [
      { label: "Home", to: "/", icon: Home, end: true, hasFigma: true },
      { label: "Announcements", to: "/announcements", icon: Bell, badgeKey: "announcements", hasFigma: true },
      { label: "Campus Feed", to: "/campus-feed", icon: Rss, hasFigma: false },
    ],
  },
  {
    label: "Documents",
    items: [
      { label: "Document Queue", to: "/document-queue", icon: ClipboardList, badgeKey: "documentQueue", hasFigma: true },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Scholarships", to: "/scholarships", icon: GraduationCap, hasFigma: true },
      { label: "Achievement Management", to: "/achievements", icon: Award, badgeKey: "achievementManagement", hasFigma: true },
      { label: "Job Posting", to: "/job-postings", icon: Briefcase, hasFigma: true },
      { label: "Student Endorsement", to: "/student-endorsement", icon: Send, badgeKey: "studentEndorsement", hasFigma: false },
      { label: "Student Leaders Directory", to: "/student-leaders", icon: Network, hasFigma: false },
      { label: "Alumni Profiles", to: "/alumni-profiles", icon: Contact, hasFigma: false },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", to: "/analytics", icon: BarChart3, hasFigma: false },
      { label: "FAQ", to: "/faq", icon: HelpCircle, hasFigma: false },
    ],
  },
  {
    label: "Reports",
    items: [{ label: "Report Generation", to: "/reports", icon: FileBarChart2, hasFigma: false }],
  },
  {
    label: "System",
    items: [
      { label: "SAA Chat", to: "/saa-chat", icon: MessageCircle, badgeKey: "saaChat", hasFigma: false },
      { label: "Settings", to: "/settings", icon: Settings, hasFigma: false },
    ],
  },
];
