import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Award, Bell, CheckCircle2, GraduationCap, MessageCircle, PenLine, Rss, Send, Zap } from "lucide-react";
import saaSeal from "../assets/saa-seal.png";
import { useDashboardSummary } from "../context/DashboardContext.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import LoadingState from "../components/ui/LoadingState.jsx";
import ErrorState from "../components/ui/ErrorState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { phNow } from "../utils/time.js";

const QUICK_ACTIONS = [
  { label: "Review Document Queue", to: "/document-queue", icon: PenLine },
  { label: "Screen Achievements", to: "/achievements", icon: Award },
  { label: "Post an Announcement", to: "/announcements", icon: Bell },
  { label: "Share on Campus Feed", to: "/campus-feed", icon: Rss },
  { label: "Open SAA Chat", to: "/saa-chat", icon: MessageCircle },
];

export default function Dashboard() {
  const { summary, state, refresh } = useDashboardSummary();
  // "Today" in the Philippines, whatever the device's own clock zone is.
  const today = useMemo(() => phNow(), []);

  // Refetch every time the Home page is actually visited, not just once
  // per login — so the cards and activity feed never show stale numbers
  // after adding/deciding/deleting something in another module.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      {/* hero */}
      <div
        className="relative overflow-hidden rounded-2xl px-6 py-9 sm:px-10 sm:py-11"
        style={{ backgroundImage: "linear-gradient(171deg, rgb(202,182,92) 0%, rgb(24,54,210) 50%, rgb(2,14,88) 100%)" }}
      >
        <div className="pointer-events-none absolute -top-24 right-[-40px] size-[380px] rounded-full bg-white/[0.05]" />
        <div className="pointer-events-none absolute -top-16 right-[80px] size-[220px] rounded-full bg-white/[0.03]" />
        <img
          src={saaSeal}
          alt=""
          className="pointer-events-none absolute -top-24 right-[-40px] size-[380px] rounded-full object-cover opacity-[0.14]"
        />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white sm:text-[30px]">
              Welcome back, Staff! 👋
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-[15px]">
              Here&rsquo;s today&rsquo;s overview of what is waiting for you &mdash; incoming documents, submissions to
              screen, and recent activity across the SAA office.
            </p>
          </div>
          <div className="text-left text-white/70 sm:text-right">
            <p className="font-sans text-2xl font-bold text-white sm:text-[32px]">{today.shortWeekday}</p>
            <p className="text-sm">{today.longDate}</p>
          </div>
        </div>
      </div>

      {state === "loading" && <LoadingState label="Loading dashboard..." />}
      {state === "error" && <ErrorState message="Unable to load dashboard data." onRetry={refresh} />}

      {state === "ready" && summary && (
        <>
          {/* quick snaps */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              icon={PenLine}
              iconClass="bg-status-indigo/10 text-status-indigo"
              title="Document Queue"
              to="/document-queue"
              metrics={[
                { label: "To Pre-screen", value: `${summary.documentQueue.toScreen} Documents`, tone: "warning" },
                { label: "With the SAA Dean", value: `${summary.documentQueue.withDean} Documents`, tone: "success" },
              ]}
            />
            <StatCard
              icon={Award}
              iconClass="bg-status-danger/10 text-status-danger"
              title="Achievement Management"
              to="/achievements"
              metrics={[
                { label: "Awaiting Screening", value: `${summary.achievements.toScreen} Achievements`, tone: "warning" },
                { label: "Routed to the Dean", value: summary.achievements.withDean, tone: "success" },
              ]}
            />
            <StatCard
              icon={Send}
              iconClass="bg-status-info/10 text-status-info"
              title="Student Endorsement"
              to="/student-endorsement"
              metrics={[
                { label: "Pending Endorsements", value: summary.endorsements.pending, tone: "warning" },
                { label: "Inbound / Outbound", value: `${summary.endorsements.inbound} / ${summary.endorsements.outbound}`, tone: "default" },
              ]}
            />
            <StatCard
              icon={GraduationCap}
              iconClass="bg-status-success/10 text-status-success"
              title="Scholarships"
              to="/scholarships"
              metrics={[
                { label: "Active Scholarships", value: summary.scholarships.active, tone: "default" },
                { label: "New Applications", value: summary.scholarships.newApplications, tone: "warning" },
              ]}
            />
            <StatCard
              icon={Bell}
              iconClass="bg-status-warning/10 text-status-warning"
              title="Announcements"
              to="/announcements"
              metrics={[
                { label: "Drafts", value: summary.announcements.drafts, tone: "warning" },
                { label: "Published", value: summary.announcements.published, tone: "success" },
              ]}
            />
            <StatCard
              icon={MessageCircle}
              iconClass="bg-status-indigo/10 text-status-indigo"
              title="SAA Chat"
              to="/saa-chat"
              metrics={[
                { label: "Waiting for a Reply", value: `${summary.chat.waiting} Conversations`, tone: "warning" },
              ]}
            />
          </div>

          {/* quick actions */}
          <div className="rounded-xl2 border border-slate-200 bg-white p-6 shadow-card sm:p-7">
            <h2 className="mb-4 flex items-center gap-2 font-heading text-base font-semibold text-slate-800">
              <Zap size={18} className="text-slate-400" />
              Quick Actions
            </h2>
            <div className="flex flex-wrap gap-3">
              {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-status-indigo/40 hover:bg-white hover:text-status-indigo"
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* activity feed */}
          <div className="rounded-xl2 border border-slate-200 bg-white p-6 shadow-card sm:p-7">
            <h2 className="mb-4 flex items-center gap-2 font-heading text-base font-semibold text-slate-800">
              <AlertCircle size={18} className="text-slate-400" />
              Activity Updates
            </h2>
            {summary.activity.length === 0 ? (
              <EmptyState title="All caught up" description="No pending items need your attention right now." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {summary.activity.map((item) => {
                  const Icon = item.tone === "success" ? CheckCircle2 : AlertCircle;
                  const iconClass = item.tone === "success" ? "bg-status-success/10 text-status-success" : "bg-status-warning/10 text-status-warning";
                  return (
                    <li key={item.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl2 ${iconClass}`}>
                        <Icon size={18} />
                      </span>
                      <p className="pt-2 text-sm leading-relaxed text-slate-600">{item.message}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
