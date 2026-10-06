import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList, Search, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight,
  FileText, Paperclip, Download, PenLine, Upload, CheckCircle,
  Archive, Loader2, Forward, Lock,
} from "lucide-react";
import { api, ApiError, fetchProtectedFile } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLiveRefresh } from "../context/LiveUpdatesContext.jsx";
import { useDashboardSummary } from "../context/DashboardContext.jsx";
import { timeAgo } from "../utils/time.js";
import LoadingState from "../components/ui/LoadingState.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import FilePreviewBody from "../components/ui/FilePreviewBody.jsx";
import FileDropzone from "../components/ui/FileDropzone.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import Tooltip from "../components/ui/Tooltip.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// SAA Staff Document Queue. Staff pre-screen every incoming ticket:
//  - Queuing   — tickets waiting for a first decision (and requests the SAA
//                is still waiting on an office for).
//  - Forwarded to Dean — complex / high-level documents staff have passed up
//                to the SAA Dean's Specialized Evaluation tab. Read-only here:
//                from that point the Dean decides.
//  - E-Signing — tickets the Dean approved for e-signing, shown so staff can
//                follow where a document is. Read-only: final e-signatures are
//                issued by the Dean alone.
// Reject / revise / physical signing leave the inbox for the Queuing Archive.
const TABS = [
  { key: "queuing", label: "Queuing" },
  { key: "dean", label: "Forwarded to Dean" },
  { key: "approved", label: "E-Signing" },
];

function relativeTime(iso) {
  return timeAgo(iso);
}

const TYPE_BADGE = {
  student: "bg-cyan-100 text-cyan-700",
  alumni: "bg-orange-100 text-orange-800",
  offices: "bg-indigo-100 text-indigo-700",
};

export default function DocumentQueue() {
  const { handleSessionInvalidated } = useAuth();
  const { notify } = useToast();
  const { refresh: refreshSummary } = useDashboardSummary();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("queuing");
  const [state, setState] = useState("loading");
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null); // { item, routes }

  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const detailSigRef = useRef("");

  const loadedOnce = useRef(false);

  async function load(opts) {
    if (!loadedOnce.current) setState("loading");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("tab", tab);
      const data = await api.get(`/api/staff/document-queue?${params.toString()}`);
      setItems(data.items);
      setState("ready");
      loadedOnce.current = true;
      // Keep the current selection if it's still in this tab's list;
      // otherwise fall back to the first item (or clear the panel).
      setSelectedId((prev) => {
        if (prev && data.items.some((t) => t.id === prev)) return prev;
        return data.items[0]?.id ?? null;
      });
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (loadedOnce.current) { if (!opts?.background) notify("Could not refresh the queue.", "error"); }
      else setState("error");
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tab]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    refreshDetail(selectedId);
    setZoom(1);
    setRotation(0);
    setComment("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function refreshDetail(id, opts) {
    try {
      const data = await api.get(`/api/staff/document-queue/${id}`);
      // A quiet, pushed-in refresh only swaps the panel when something in the
      // ticket actually changed — so the document viewer isn't reloaded (and
      // its zoom/scroll reset) every time an unrelated change happens elsewhere.
      const sig = JSON.stringify(data);
      if (opts?.background && sig === detailSigRef.current) return;
      detailSigRef.current = sig;
      setDetail(data);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      if (!opts?.background) notify("Could not load ticket.", "error");
    }
  }

  // Live: the queue list, the open ticket, and the routing offices track
  // every change instantly — including a student submitting a new request.
  useLiveRefresh(["document-queue"], (o) => {
    load(o);
    if (selectedId) refreshDetail(selectedId, o);
  });
  async function decide(action) {
    if ((action === "reject" || action === "revise") && !comment.trim()) {
      notify(action === "reject" ? "Add a comment explaining the rejection." : "Add a comment with revision instructions.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/api/staff/document-queue/${detail.item.id}/decide`, { action, remarks: comment });
      const messages = {
        approve: "Approved for physical signing — moved to the Queuing Archive.",
        reject: "Ticket rejected — moved to the Queuing Archive.",
        revise: "Revision requested — moved to the Queuing Archive.",
      };
      notify(messages[action]);
      setComment("");
      refreshSummary();
        // Reject / revise / approve-for-physical-signing all leave the
        // inbox entirely for the Queuing Archive — clear the panel so a
        // stale, no-longer-actionable ticket doesn't linger on screen.
        setSelectedId(null);
        setDetail(null);
        load();
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Action failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAttach(files) {
    const f = files[files.length - 1];
    if (!f) return;
    try {
      await api.post(`/api/staff/document-queue/${detail.item.id}/attach-file`, { fileId: f.id });
      notify("Document attached.");
      refreshDetail(detail.item.id);
    } catch {
      notify("Could not attach file.", "error");
    }
  }

  // Pass a complex / high-level document up to the SAA Dean's evaluation tab.
  // The comment box doubles as an optional note to the Dean.
  async function forwardToDean() {
    setBusy(true);
    try {
      await api.post(`/api/staff/document-queue/${detail.item.id}/forward-to-dean`, { note: comment });
      notify("Forwarded to the SAA Dean for evaluation.");
      setComment("");
      refreshSummary();
      setTab("dean");
      setSelectedId(detail.item.id);
      await refreshDetail(detail.item.id);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify(err instanceof ApiError ? err.message : "Could not forward the document.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(fileObj) {
    try {
      const blob = await fetchProtectedFile(`/api/staff/uploads/${fileObj.id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileObj.original_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (handleSessionInvalidated(err)) return;
      notify("Download failed.", "error");
    }
  }

  const forwarded = Boolean(detail?.item.forwarded_to_dean_at);
  const canDecide = detail && detail.item.status === "pending" && !forwarded;
  const tabLabel = { queuing: "Pending", dean: "With the Dean", approved: "In E-Signing" }[tab];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-status-indigo/10 text-status-indigo">
            <ClipboardList size={22} />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-slate-800 sm:text-2xl">Document Queue</h1>
            <p className="text-sm text-slate-500">Sequential ticketing and initial compliance pre-screening</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            to="/document-queue/archive"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-card hover:bg-slate-50"
          >
            <Archive size={14} /> Queuing Archive
          </Link>
        </div>
      </div>

      <div className="flex h-[calc(100vh-220px)] min-h-[560px] gap-6">
        {/* ── Left: inbox panel ─────────────────────────────────────── */}
        <div className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
          <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
            <p className="text-sm font-semibold text-slate-800">Document Queue Inbox</p>
            {items.length > 0 && (
              <span className="rounded-full bg-status-danger px-2.5 py-0.5 text-[11px] font-bold text-white">{items.length} {tabLabel}</span>
            )}
          </div>

          <div className="border-b border-slate-100 px-4 py-3">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Document"
                className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex gap-1.5 border-b border-slate-100 px-4 py-3">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  tab === t.key ? "bg-status-indigo text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {state === "loading" && <div className="p-5"><LoadingState label="Loading tickets..." /></div>}
            {state === "ready" && items.length === 0 && (
              <div className="p-5">
                <EmptyState
                  icon={ClipboardList}
                  title={{ queuing: "No tickets awaiting pre-screening", dean: "Nothing forwarded to the Dean", approved: "Nothing in e-signing right now" }[tab]}
                  description={{ queuing: "New requests will show up here.", dean: "Documents you forward to the SAA Dean appear here while they await evaluation.", approved: "Documents the Dean approves for e-signing appear here so you can follow them." }[tab]}
                />
              </div>
            )}
            {state === "ready" && items.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`block w-full border-b border-l-[3px] px-4 py-3.5 text-left transition ${
                  selectedId === t.id ? "border-l-status-indigo bg-status-indigo/[0.06]" : "border-l-transparent hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-slate-800">{t.ticket_no}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${TYPE_BADGE[t.requester_type]}`}>{t.requester_type}</span>
                </div>
                <p className="mt-1 truncate text-[11px] text-slate-500">{t.requester_name}</p>
                <p className="mt-0.5 truncate text-xs text-slate-700">{t.document_type}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {t.file_id ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                      <span className="flex size-3.5 items-center justify-center rounded bg-status-danger text-[6px] font-bold text-white">PDF</span>
                      attached
                    </span>
                  ) : t.status === "awaiting_submission" ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                      Awaiting office upload
                    </span>
                  ) : <span />}
                  <span className="text-[10px] text-slate-400">{relativeTime(t.submitted_at)}</span>
                </div>
              </button>
            ))}
          </div>

          {detail && canDecide && (
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <div className="mb-2 flex gap-2">
                <Tooltip text="Sends the request back to the requester with your comment so they can fix and resubmit it." className="flex-1">
                  <button
                    onClick={() => decide("revise")}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-status-danger py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    <PenLine size={13} /> Request Revision
                  </button>
                </Tooltip>
                <Tooltip text="For documents that just need to be picked up and signed in person — no e-signature involved." className="flex-1">
                  <button
                    onClick={() => decide("approve")}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-status-success py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    <CheckCircle size={13} /> Physical Signing
                  </button>
                </Tooltip>
              </div>
              <Tooltip text="For complex or high-level documents (or anything needing an e-signature): passes it to the SAA Dean's evaluation tab. Your comment is sent along as a note." className="w-full">
                <button
                  onClick={forwardToDean}
                  disabled={busy || !detail.item.file}
                  className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-blue py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  <Forward size={13} /> Forward to Dean
                </button>
              </Tooltip>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Type a comment (required to reject or request revision)..."
                className="h-9 w-full rounded-xl border border-slate-200 px-3 text-xs text-slate-700 placeholder:text-slate-400"
              />
              <Tooltip text="Declines the request outright — the requester is notified and must start a new ticket if needed." side="right">
                <button onClick={() => decide("reject")} disabled={busy} className="mt-2 text-[11px] font-medium text-status-danger hover:underline">
                  Reject instead
                </button>
              </Tooltip>
            </div>
          )}
        </div>

        {/* ── Right: document viewer panel ──────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl2 border border-slate-200 bg-white shadow-card">
          {!detail ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">Select a ticket to view its document</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-6 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[13px] font-semibold text-slate-700">{detail.item.file?.original_name || "No document attached"}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${TYPE_BADGE[detail.item.requester_type]}`}>{detail.item.requester_type}</span>
                  <StatusBadge status={detail.item.status} />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))} className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <ZoomIn size={13} /> Zoom In
                  </button>
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <ZoomOut size={13} /> Zoom Out
                  </button>
                  <button onClick={() => setRotation((r) => (r + 90) % 360)} className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                    <RotateCw size={13} /> Rotate
                  </button>
                  <div className="ml-1 flex items-center gap-1 opacity-40">
                    <button disabled className="flex size-7 items-center justify-center rounded-xl border border-slate-200"><ChevronLeft size={13} /></button>
                    <span className="px-1 text-xs text-slate-500">Page 1 of 1</span>
                    <button disabled className="flex size-7 items-center justify-center rounded-xl border border-slate-200"><ChevronRight size={13} /></button>
                  </div>
                </div>
              </div>

              <div className="flex flex-1 items-start justify-center overflow-auto bg-[#e8eaed] p-8">
                {!detail.item.file ? (
                  <div className="mt-16 w-full max-w-sm">
                    {detail.item.status === "awaiting_submission" ? (
                      <EmptyState
                        icon={FileText}
                        title="Waiting on the office"
                        description={`${detail.item.requester_name} has been asked to upload this document. It joins the review queue as soon as they submit it.`}
                      />
                    ) : (
                      <EmptyState icon={FileText} title="No document attached yet" description="Attach the requester's submitted file below." />
                    )}
                  </div>
                ) : (
                  <div style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: "top center", transition: "transform 0.15s" }}>
                    <div className="w-[560px] bg-white shadow-[0_25px_25px_rgba(0,0,0,0.25)]">
                      {/* Once anyone has signed, show the signed copy so every signature is visible right here. */}
                      <FilePreviewBody
                        fileName={(detail.item.signedFile || detail.item.file).original_name}
                        viewUrl={`/api/staff/uploads/${(detail.item.signedFile || detail.item.file).id}/view`}
                        className="h-[720px] w-[560px]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 bg-white px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {!detail.item.file && detail.item.status !== "awaiting_submission" && (
                    <div className="w-full max-w-xs">
                      <FileDropzone files={[]} onChange={handleAttach} multiple={false} label="Attach requester's document" />
                    </div>
                  )}
                  {detail.item.file && (
                    <button onClick={() => handleDownload(detail.item.file)} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      <Download size={13} /> Download
                    </button>
                  )}
                  {detail.item.signedFile && (
                    <button onClick={() => handleDownload(detail.item.signedFile)} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                      <Download size={13} /> Download Signed Copy
                    </button>
                  )}
                  {detail.item.confirmed_at && (
                    <span className="flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle size={13} /> Done &mdash; released to requester
                    </span>
                  )}
                </div>

                {forwarded && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3.5 py-2.5 text-xs text-indigo-800">
                    <Forward size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">
                        Forwarded to the SAA Dean{detail.item.forwarded_by_name ? ` by ${detail.item.forwarded_by_name}` : ""} &middot; {relativeTime(detail.item.forwarded_to_dean_at)}
                      </p>
                      {detail.item.forward_note && <p className="mt-0.5 text-indigo-700">Note: {detail.item.forward_note}</p>}
                      {detail.item.status === "pending" && <p className="mt-0.5 text-indigo-700">Awaiting the Dean&rsquo;s evaluation — no further action is needed from staff.</p>}
                    </div>
                  </div>
                )}

                {detail.item.status === "approved_for_esigning" && (
                  <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Lock size={12} /> E-signature progress <span className="font-normal text-slate-400">(issued by the SAA Dean &mdash; view only)</span>
                    </p>
                    <ul className="space-y-1.5">
                      <li className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                        <span className="text-xs font-medium text-slate-700">SAA Dean</span>
                        {detail.item.confirmed_at ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">Released</span>
                        ) : detail.item.signed_at ? (
                          <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">Signed &middot; awaiting release</span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Pending</span>
                        )}
                      </li>
                      {(detail.routes || []).map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <span className="min-w-0 truncate text-xs font-medium text-slate-700">{r.office_name}</span>
                          {r.confirmed_at ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"><CheckCircle size={11} /> Done</span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">Pending</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
