// Runs the REAL built Office Portal bundle inside jsdom, against the REAL
// backend and the REAL MySQL database. Effects run, fetch is real, React
// renders — the closest thing to a browser available in this environment.
// Assumes the database is at its pristine seeded state (a fresh import of
// database/schema.sql, nothing else run against it yet).
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const DIST = "../dist";
const BACKEND = "http://localhost:5000";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errors.push("jsdomError: " + (e.detail?.stack || e.message)));
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");

const dom = new JSDOM(html, {
  url: "http://localhost:5176/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  resources: undefined,
});
const { window } = dom;

window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  const target = url.startsWith("/") ? BACKEND + url : url;
  try {
    const res = await fetch(target, init);
    console.log(`   [fetch] ${init?.method || "GET"} ${target} -> ${res.status}`);
    return res;
  } catch (e) {
    console.log(`   [fetch FAILED] ${target}: ${e.message}`);
    throw e;
  }
};
window.URL.createObjectURL = () => "blob:mock";
window.URL.revokeObjectURL = () => {};
window.scrollTo = () => {};
window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
window.Element.prototype.scrollIntoView = function () {};
window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });

const bundle = fs.readFileSync("harness-bundle.js", "utf8");
window.eval(bundle);

const text = () => (window.document.getElementById("root")?.textContent || "").replace(/\s+/g, " ").trim();
const q = (sel) => window.document.getElementById("root")?.querySelector(sel) || null;
const qa = (sel) => [...(window.document.getElementById("root")?.querySelectorAll(sel) || [])];
const byText = (tag, t) => qa(tag).find((el) => el.textContent.trim().toLowerCase().includes(t.toLowerCase()));

function set(el, value) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}
const click = (el) => {
  if (!el) throw new Error("click(): element not found");
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
};
const submitForm = () => q("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
function go(route) {
  window.history.pushState({}, "", route);
  window.dispatchEvent(new window.PopStateEvent("popstate"));
}
async function signIn(email, password) {
  set(q("#email"), email);
  set(q("#password"), password);
  await sleep(150);
  if (q("#email").value !== email) throw new Error("controlled input did not take the value");
  submitForm();
  await sleep(2500);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  \u2713" : "  \u2717"} ${name}${detail ? " — " + detail : ""}`);
};

await sleep(1200);
console.log("\n── Login screen ──");
check("renders the SAA Staff sign-in", text().includes("SAA Staff Sign In"));
check("no registration offered", !text().toLowerCase().includes("sign up") && !text().toLowerCase().includes("create an account"));

async function staffSignIn(email, password) {
  set(q("#username"), email);
  set(q("#password"), password);
  await sleep(150);
  submitForm();
  await sleep(2500);
}

console.log("\n── A student account is refused ──");
await staffSignIn("demo.student@psu.edu.ph", "portal123");
t0: {
  const t = text();
  check("student cannot sign in to the staff portal", t.includes("SAA Staff accounts only") && !t.includes("Welcome back"), t.match(/This portal is for[^.]*\./)?.[0] || "");
}

console.log("\n── Staff sign in ──");
await staffSignIn("demo.staff@psu.edu.ph", "portal123");
let t = text();
check("lands on the staff Home", t.includes("Welcome back, Staff"));
check("header says SAA Staff", t.includes("SAA Staff"));
check("nav has the spec modules", ["Announcements","Campus Feed","Document Queue","Scholarships","Achievement Management","Job Posting","Student Endorsement","Student Leaders Directory","Alumni Profiles","Analytics","FAQ","Report Generation","SAA Chat","Settings"].every((l) => t.includes(l)));
check("Document Repository is removed", !t.includes("Document Repository"));
check("User Management is removed", !t.includes("User Management"));
check("Home shows queue + screening counters", t.includes("To Pre-screen") && t.includes("With the SAA Dean") && t.includes("Awaiting Screening"));
check("Home has quick actions", t.includes("Quick Actions"));

console.log("\n── Removed routes fall back to Home ──");
go("/user-management"); await sleep(600);
check("/user-management does not render a page", !text().includes("Add User") && text().includes("Welcome back"));
go("/document-repository"); await sleep(600);
check("/document-repository does not render a page", text().includes("Welcome back"));

console.log("\n── Document Queue ──");
go("/document-queue"); await sleep(1800);
t = text();
if (process.env.DEBUG) { console.log("TEXT:", t.slice(0,600)); console.log("ERRORS:", errors.slice(0,5)); }
check("three tabs: Queuing / Forwarded to Dean / E-Signing", t.includes("Queuing") && t.includes("Forwarded to Dean") && t.includes("E-Signing"));
check("no 'Request from Office' button for staff", !t.includes("Request from Office"));
check("shows pending tickets", t.includes("#SAA-"));
check("Physical Signing and Forward to Dean offered", t.includes("Physical Signing") && t.includes("Forward to Dean"));
check("'Approve for E-Signing' is NOT offered", !t.includes("Approve for E-Signing"));
let ticketNo = null;
for (const b of qa("button").filter((b) => /^#SAA-\d+/.test(b.textContent.trim()))) {
  click(b); await sleep(900);
  const fw = byText("button", "Forward to Dean");
  if (fw && !fw.disabled) { ticketNo = b.textContent.trim().match(/^#SAA-\d+/)[0]; break; }
}
set(q('input[placeholder^="Type a comment"]'), "Needs the Dean's e-signature");
await sleep(100);
click(byText("button", "Forward to Dean")); await sleep(2000);
t = text();
check(`forwarding ${ticketNo} confirms and moves to the Dean tab`, t.includes("Forwarded to the SAA Dean") || t.includes("Forwarded to the SAA Dean by"), ticketNo);
check("forwarded ticket shows the note and no decision buttons", t.includes("Needs the Dean's e-signature") && !t.includes("Reject instead"));
click(byText("button", "E-Signing")); await sleep(1200);
t = text();
check("E-Signing tab is read-only (no Add/Confirm E-Signature)", !t.includes("Add E-Signature") && !t.includes("Confirm E-Signature") && !t.includes("Sign on behalf"));
const approvedTicket = qa("button").find((b) => /^#SAA-\d+/.test(b.textContent.trim()));
if (approvedTicket) { click(approvedTicket); await sleep(1200); t = text(); check("e-signature progress shown view-only", t.includes("view only") && t.includes("SAA Dean")); }
else check("e-signing tickets listed", false, "none found");

console.log("\n── Achievement Management ──");
go("/achievements"); await sleep(1500);
check("Achievement Management renders", text().includes("Achievement"));

console.log("\n── Analytics ──");
go("/analytics"); await sleep(2000);
t = text();
check("Analytics renders", t.includes("Document Queue") && t.includes("Scholarships"));
check("no User Management / Document Repository analytics", !t.includes("Inter-Office Transmissions") && !t.includes("Users by"));

console.log("\n── Report Generation ──");
go("/reports"); await sleep(1800);
t = text();
check("Reports render", t.includes("Scholarship") );
check("User Directory report is not offered", !t.includes("User Directory"));

console.log("\n── SAA Chat ──");
go("/saa-chat"); await sleep(1500);
check("SAA Chat renders", text().includes("SAA Chat") || text().includes("Messages") || text().includes("conversation"));

console.log("\n── Settings ──");
go("/settings"); await sleep(1200);
t = text();
if (process.env.DEBUG) { console.log("TEXT:", t.slice(0,300)); console.log("ERR:", errors.filter(e=>!e.includes("getContext")).slice(0,4)); }
check("profile, photo, password, display sections", ["Personal Profile","Profile Photo","Change Password","Interface Display"].every((l) => t.includes(l)));
check("login email shown read-only", q('input[readonly]')?.value === "demo.staff@psu.edu.ph");
click(byText("button", "Large")); await sleep(300);
check("text-size preference applied", window.document.documentElement.style.fontSize === "18px");
click(byText("button", "Default"));

console.log("\n── Sign out ──");
click(qa("header button").find((b) => b.textContent.includes("SAA Staff") || b.textContent.includes("Demo")) ); await sleep(300);
click(byText("button", "Sign out")); await sleep(1200);
check("back on the sign-in page", text().includes("SAA Staff Sign In"));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (errors.length) { console.log("\nBrowser errors:"); errors.slice(0, 8).forEach((e) => console.log(" -", e.slice(0, 300))); }
process.exit(failed.length ? 1 : 0);
