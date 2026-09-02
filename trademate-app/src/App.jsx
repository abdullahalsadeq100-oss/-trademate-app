import React, { useState, useEffect, useCallback } from "react";
import {
  Wrench, Phone, MessageCircle, Globe, Plus, Loader2, CheckCircle2,
  Calendar as CalendarIcon, FileText, Receipt, Send, ChevronRight, ChevronLeft,
  MapPin, Camera, X, Sparkles, ArrowLeft, Euro, Clock, LogOut, Download,
  Search, ShieldAlert, HardHat, UserRound, Settings, Navigation, Compass
} from "lucide-react";
import { supabase } from "./supabaseClient";
import jsPDF from "jspdf";

/* ---------------------------------------------------------
   TradeMate Ireland — live version (Supabase backend)
   Same design language as the prototype: navy/paper/safety-orange,
   work-order-pad styling. Data now lives in a real Postgres
   database via Supabase, auth is real (email + password), and
   the AI call goes through a Supabase Edge Function so the
   Anthropic API key never reaches the browser.
--------------------------------------------------------- */

const CHANNELS = [
  { id: "web", label: "Web form", icon: Globe },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "sms", label: "SMS", icon: Phone },
];

const AREAS = [
  { name: "Galway City Centre", lat: 53.2707, lng: -9.0568 },
  { name: "Salthill", lat: 53.2606, lng: -9.0805 },
  { name: "Knocknacarra", lat: 53.2740, lng: -9.1090 },
  { name: "Renmore", lat: 53.2775, lng: -9.0270 },
  { name: "Oranmore", lat: 53.2733, lng: -8.9350 },
  { name: "Ballybane", lat: 53.2820, lng: -9.0170 },
  { name: "Barna", lat: 53.2530, lng: -9.1660 },
  { name: "Moycullen", lat: 53.3390, lng: -9.1780 },
  { name: "Oughterard", lat: 53.4230, lng: -9.3310 },
  { name: "Tuam", lat: 53.5150, lng: -8.8510 },
  { name: "Athenry", lat: 53.2980, lng: -8.7460 },
  { name: "Loughrea", lat: 53.1950, lng: -8.5670 },
  { name: "Gort", lat: 53.0670, lng: -8.8210 },
  { name: "Clarinbridge", lat: 53.2260, lng: -8.8940 },
];

const SERVICES = [
  "Boiler repair & servicing", "Leak & pipe repair", "Bathroom fitting",
  "Heating installation", "Emergency call-out", "Drain unblocking",
  "Water heater / immersion", "Radiator installation",
  "General plumbing maintenance", "Gas fitting",
];

const STATUS_LABEL = { new: "NEW ENQUIRY", quoted: "QUOTED", booked: "BOOKED", invoiced: "INVOICED", paid: "PAID", declined: "DECLINED" };
const STATUS_COLOR = { new: "#FF6A13", quoted: "#5B6B7D", booked: "#10233B", invoiced: "#C2410C", paid: "#2F8F5B", declined: "#8b8474" };

const TERMS_TEXT = `Last updated: ${new Date().getFullYear()}

TradeMate Ireland is a booking and quoting tool that connects customers with independent tradespeople. TradeMate is not itself a tradesperson, does not employ or supervise the tradespeople listed, and is not a party to any agreement between a customer and a tradesperson.

WHO WE ARE
TradeMate provides the platform only. All quotes, bookings, work performed, and payments are agreements directly between the customer and the tradesperson.

TRADESPERSON RESPONSIBILITIES
Tradespeople using this platform are solely responsible for the accuracy of their listing, the quotes they provide, the work they perform, and compliance with any licensing, insurance, or regulatory requirements applicable to their trade in Ireland.

CUSTOMER RESPONSIBILITIES
Customers are responsible for verifying a tradesperson's suitability for their job before booking, and for the accuracy of the information they submit (contact details, job description, address).

PAYMENTS
Card payments are processed by Stripe. TradeMate does not store card details. Disputes about the quality or completion of work are between the customer and the tradesperson; TradeMate does not adjudicate these disputes.

LIMITATION OF LIABILITY
TradeMate is provided "as is." To the maximum extent permitted by law, TradeMate is not liable for the acts, omissions, or work quality of any tradesperson listed on the platform, or for any loss arising from use of the platform.

ACCOUNTS
You are responsible for keeping your login credentials secure. One account should represent one real business or one real customer — do not create accounts on behalf of others without their consent.

CHANGES
These terms may be updated from time to time. Continued use of the platform after a change constitutes acceptance of the updated terms.

CONTACT
Questions about these terms can be directed to the business operating this platform.

This is a general template and has not been reviewed by a lawyer. Before relying on it for a live commercial service, have it reviewed by a qualified solicitor familiar with Irish and EU consumer law.`;

const PRIVACY_TEXT = `Last updated: ${new Date().getFullYear()}

WHAT WE COLLECT
- From tradespeople: name, email, business name, address/location, services offered, phone number (optional), and account password (stored securely, never in plain text).
- From customers: name, phone number, address, job description, email (optional), and any photos you choose to upload.
- Payment information is collected and processed directly by Stripe — TradeMate does not see or store your card details.

WHY WE COLLECT IT
To connect you with a tradesperson or customer, to send you updates about a job (by SMS and/or email), to process payments, and to operate the "find a tradesperson near me" feature (which uses either your device's location or an address you type in).

WHO WE SHARE IT WITH
- The tradesperson or customer relevant to your job.
- Service providers who help us operate: Supabase (database and hosting), Stripe (payments), Twilio (SMS), Resend (email), Anthropic (AI-assisted quote drafting), and OpenStreetMap (address lookup). Each processes only what's needed to perform their function.
- We do not sell personal data to third parties.

YOUR RIGHTS (GDPR)
If you are in the EU/EEA, you have the right to access, correct, or request deletion of your personal data. Contact the business operating this platform to make a request.

DATA RETENTION
Job and account data is kept for as long as your account is active, or as needed to comply with legal or accounting obligations.

PHOTOS
Photos you upload for a job enquiry are stored and are visible to the tradesperson you sent them to.

COOKIES / LOCAL STORAGE
This site uses your browser's local session storage to keep you logged in. No third-party advertising trackers are used.

CONTACT
Questions about this policy or your data can be directed to the business operating this platform.

This is a general template and has not been reviewed by a lawyer. Before relying on it for a live commercial service handling real customer data, have it reviewed by a qualified solicitor familiar with GDPR and Irish data protection law.`;

function slugify(name) {
  const letters = name.toUpperCase().replace(/[^A-Z ]/g, "").split(" ").filter(Boolean);
  let base = letters.map((w) => w[0]).join("").slice(0, 4);
  return base || "JOB";
}
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function downloadInvoicePdf(lead, businessName) {
  const doc = new jsPDF();
  const navy = [16, 35, 59];
  const orange = [255, 106, 19];
  const grey = [91, 107, 125];
  const q = lead.quote || {};
  const partsAvg = Math.round(((q.partsMin || 0) + (q.partsMax || 0)) / 2);
  const rows = [
    ["Labour", q.labour || 0],
    ["Call-out", q.callout || 0],
    ["Parts", partsAvg],
  ];
  const total = lead.invoice?.total ?? rows.reduce((s, [, v]) => s + v, 0);

  doc.setFillColor(...navy);
  doc.rect(0, 0, 210, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(businessName || "TradeMate", 14, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("INVOICE", 196, 20, { align: "right" });

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Job ${lead.job_no}`, 14, 44);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grey);
  doc.setFontSize(9);
  const issued = lead.invoice?.issuedAt ? new Date(lead.invoice.issuedAt) : new Date();
  doc.text(`Issued ${issued.toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" })}`, 14, 50);

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BILL TO", 14, 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(lead.name, 14, 70);
  doc.setTextColor(...grey);
  doc.setFontSize(9);
  doc.text(lead.phone, 14, 75);
  doc.text(doc.splitTextToSize(lead.address, 90), 14, 80);

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("JOB", 14, 100);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grey);
  doc.setFontSize(9);
  const problemLines = doc.splitTextToSize(lead.problem, 182);
  doc.text(problemLines, 14, 106);

  let y = 106 + problemLines.length * 5 + 14;
  doc.setDrawColor(227, 219, 200);
  doc.line(14, y, 196, y);
  y += 8;
  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESCRIPTION", 14, y);
  doc.text("AMOUNT", 196, y, { align: "right" });
  y += 4;
  doc.line(14, y, 196, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...grey);
  rows.forEach(([label, value]) => {
    doc.text(label, 14, y);
    doc.text(`€${value}`, 196, y, { align: "right" });
    y += 7;
  });
  y += 2;
  doc.line(14, y, 196, y);
  y += 9;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...navy);
  doc.text("TOTAL", 14, y);
  doc.text(`€${total}`, 196, y, { align: "right" });

  y += 14;
  const paid = !!lead.invoice?.paid;
  doc.setFontSize(10);
  doc.setTextColor(...(paid ? [47, 143, 91] : orange));
  doc.setFont("helvetica", "bold");
  doc.text(paid ? `PAID${lead.invoice?.paidAt ? " — " + new Date(lead.invoice.paidAt).toLocaleDateString("en-IE") : ""}` : "PAYMENT DUE", 14, y);

  doc.setTextColor(...grey);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Generated by TradeMate Ireland", 14, 285);

  doc.save(`invoice-${lead.job_no}.pdf`);
}

async function uploadPhotos(files) {
  const urls = [];
  for (const file of files) {
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
    const { error } = await supabase.storage.from("job-photos").upload(path, file);
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
    const { data } = supabase.storage.from("job-photos").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

async function geocodeAddress(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ie&q=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error("Location lookup failed");
  const data = await res.json();
  if (!data || data.length === 0) return null;
  const r = data[0];
  return { label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
}

function AddressLookup({ initialLabel, onResolved }) {
  const [query, setQuery] = useState(initialLabel || "");
  const [status, setStatus] = useState("idle"); // idle | loading | found | error
  const [resolved, setResolved] = useState(null);

  const lookup = async () => {
    if (!query.trim()) return;
    setStatus("loading");
    try {
      const result = await geocodeAddress(query.trim());
      if (!result) { setStatus("error"); return; }
      setResolved(result);
      setStatus("found");
      onResolved(result);
    } catch (e) {
      setStatus("error");
    }
  };

  return (
    <div>
      <div className="flex gap-2 mt-1">
        <input value={query} onChange={(e) => { setQuery(e.target.value); setStatus("idle"); }}
          className="tm-input flex-1 !mt-0" placeholder="e.g. 12 Main Street, Salthill, Galway" />
        <button type="button" onClick={lookup} disabled={status === "loading"} style={{ background: "#10233B" }}
          className="text-white text-xs font-semibold px-3 rounded-sm shrink-0">
          {status === "loading" ? <Loader2 className="animate-spin" size={14} /> : "Locate"}
        </button>
      </div>
      {status === "found" && resolved && (
        <p className="text-xs mt-1 flex items-start gap-1" style={{ color: "#2F8F5B" }}><MapPin size={12} className="mt-0.5 shrink-0" /> {resolved.label}</p>
      )}
      {status === "error" && (
        <p className="text-xs mt-1" style={{ color: "#C2410C" }}>Couldn't find that address — try adding more detail (town, county).</p>
      )}
      {status === "idle" && !resolved && (
        <p className="text-[11px] mt-1" style={{ color: "#8b8474" }}>Type your address or nearest town, then click Locate to confirm the exact spot.</p>
      )}
    </div>
  );
}

async function edgeFunctionCall(name, body) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Notifications are best-effort — never block the app if they fail
    console.warn(`${name} notification failed`, e);
  }
}
const notifyNewEnquiry = (leadId) => edgeFunctionCall("notify-new-enquiry", { lead_id: leadId });
const notifyCustomer = (leadId, message) => edgeFunctionCall("notify-update", { lead_id: leadId, message });

async function callCreateCheckout(leadId) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ lead_id: leadId, origin: window.location.origin }),
  });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.error || "Could not start checkout");
  return data.url;
}

async function callAiAssess({ problem, hasPhotos, conversation }) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assess`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ problem, hasPhotos, conversation }),
  });
  if (!res.ok) throw new Error("AI request failed");
  return res.json(); // { question, notes, quote }
}

/* ---------------- Small UI atoms ---------------- */

function Stamp({ status }) {
  return (
    <div style={{ border: `2px solid ${STATUS_COLOR[status]}`, color: STATUS_COLOR[status], transform: "rotate(-4deg)" }}
      className="inline-block px-2 py-0.5 rounded-sm text-[10px] tracking-widest font-bold uppercase select-none">
      {STATUS_LABEL[status]}
    </div>
  );
}
function ChannelBadge({ channel }) {
  const c = CHANNELS.find((x) => x.id === channel) || CHANNELS[0];
  const Icon = c.icon;
  return <span className="inline-flex items-center gap-1 text-xs" style={{ color: "#5B6B7D" }}><Icon size={13} strokeWidth={2.2} />{c.label}</span>;
}
function ServiceChip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-xs px-2 py-1 rounded-sm font-medium"
      style={{ border: `1.5px solid ${active ? "#FF6A13" : "#e3dbc8"}`, background: active ? "#FFF1E6" : "white", color: active ? "#FF6A13" : "#5B6B7D" }}>
      {label}
    </button>
  );
}
function PerforatedTop() {
  return (
    <div className="flex justify-between px-3 -mt-3 mb-1 select-none pointer-events-none">
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#F6F1E7", border: "1px solid #d8d0bd" }} />
      ))}
    </div>
  );
}
function Field({ label, children }) {
  return <div><label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5B6B7D" }}>{label}</label>{children}</div>;
}
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
      .tm-display { font-family: 'Archivo Black', sans-serif; }
      .tm-mono { font-family: 'IBM Plex Mono', monospace; }
      .tm-input { width:100%; margin-top:4px; border:1.5px solid #e3dbc8; border-radius:2px; padding:8px 10px; font-size:14px; background:white; }
      .tm-input:focus{outline:2px solid #FF6A13; outline-offset:1px;}
    `}</style>
  );
}

/* ================= TOP-LEVEL APP ================= */

export default function App() {
  const [phase, setPhase] = useState("loading"); // loading|role|pro-auth|pro-app|cust-lookup|cust-view|browse|reset-password|terms|privacy
  const [session, setSession] = useState(null);
  const [business, setBusiness] = useState(null);
  const [customerLead, setCustomerLead] = useState(null);
  const [customerBusinessName, setCustomerBusinessName] = useState(null);
  const [paymentReturn, setPaymentReturn] = useState(null); // { jobNo, outcome }
  const [returnPhase, setReturnPhase] = useState("role"); // where to go back to after terms/privacy

  useEffect(() => {
    // Returning from Stripe Checkout? Show the result before anything else.
    const params = new URLSearchParams(window.location.search);
    const paid = params.get("paid");
    const jobNo = params.get("job_no");
    if (paid && jobNo) {
      window.history.replaceState({}, "", window.location.pathname); // clean the URL
      setPaymentReturn({ jobNo, outcome: paid });
      setPhase("payment-result");
      return;
    }

    const oauthReturn = params.get("oauth_return");
    if (oauthReturn) {
      window.history.replaceState({}, "", window.location.pathname); // clean the URL
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        if (session) loadMyBusiness(session.user.id);
        else setPhase("role");
      });
    }

    // Password reset links land here with a PASSWORD_RECOVERY auth event
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") setPhase("reset-password");
    });

    if (!oauthReturn) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setPhase((p) => (p === "loading" ? "role" : p)); // always start here — session is checked later, only if they choose "I'm a tradesperson"
      });
    }
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadMyBusiness = async (userId) => {
    const { data } = await supabase.rpc("get_my_businesses", { p_user_id: userId });
    if (data && data.length > 0) { setBusiness(data[0]); setPhase("pro-app"); }
    else setPhase("pro-auth"); // logged in but no business yet — finish setup
  };

  const handleChoosePro = async () => {
    setPhase("pro-auth");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setBusiness(null);
    setPhase("role");
  };
  const goToStatus = (bizName, lead) => { setCustomerBusinessName(bizName); setCustomerLead(lead); setPhase("cust-view"); };
  const openLegal = (page, fromPhase) => { setReturnPhase(fromPhase); setPhase(page); };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#F6F1E7", color: "#1E1B16", minHeight: "100vh" }} className="w-full">
      <GlobalStyle />
      {phase === "loading" && <div className="flex items-center justify-center py-24 text-sm" style={{ color: "#5B6B7D" }}><Loader2 className="animate-spin mr-2" size={16} /> Loading…</div>}
      {phase === "role" && <RoleSelect onPro={handleChoosePro} onCustomer={() => setPhase("cust-lookup")} onBrowse={() => setPhase("browse")} onLegal={(p) => openLegal(p, "role")} />}
      {phase === "pro-auth" && <ProAuth session={session} onDone={(biz) => { setBusiness(biz); setPhase("pro-app"); }} onBack={() => setPhase("role")} onLegal={(p) => openLegal(p, "pro-auth")} />}
      {phase === "pro-app" && business && <ProDashboard business={business} onLogout={logout} onBusinessUpdate={setBusiness} />}
      {phase === "cust-lookup" && <CustomerLookup onBack={() => setPhase("role")} onFound={goToStatus} />}
      {phase === "cust-view" && customerLead && <CustomerView businessName={customerBusinessName} lead={customerLead} onBack={() => setPhase("cust-lookup")} />}
      {phase === "browse" && <BrowseTrades onBack={() => setPhase("role")} onViewStatus={goToStatus} onLegal={(p) => openLegal(p, "browse")} />}
      {phase === "payment-result" && paymentReturn && <PaymentResult jobNo={paymentReturn.jobNo} outcome={paymentReturn.outcome} onDone={() => setPhase("role")} />}
      {phase === "reset-password" && <ResetPassword onDone={() => setPhase("role")} />}
      {phase === "terms" && <LegalPage title="Terms of Service" body={TERMS_TEXT} onBack={() => setPhase(returnPhase)} />}
      {phase === "privacy" && <LegalPage title="Privacy Policy" body={PRIVACY_TEXT} onBack={() => setPhase(returnPhase)} />}
    </div>
  );
}

function PaymentResult({ jobNo, outcome, onDone }) {
  const [status, setStatus] = useState("checking"); // checking|confirmed|unconfirmed
  const [info, setInfo] = useState(null);

  useEffect(() => {
    (async () => {
      if (outcome !== "success") { setStatus("unconfirmed"); return; }
      const { data } = await supabase.rpc("get_payment_confirmation", { p_job_no: jobNo });
      setInfo(data);
      setStatus(data && data.paid ? "confirmed" : "unconfirmed");
    })();
  }, [jobNo, outcome]);

  return (
    <div className="max-w-md mx-auto px-4 py-10 text-center">
      {outcome === "cancelled" && (
        <>
          <div className="tm-display text-lg mb-2" style={{ color: "#10233B" }}>PAYMENT CANCELLED</div>
          <p className="text-sm mb-4" style={{ color: "#5B6B7D" }}>No charge was made. You can try again any time from your job status page.</p>
        </>
      )}
      {outcome === "success" && status === "checking" && (
        <div className="flex items-center justify-center gap-2 text-sm py-8" style={{ color: "#5B6B7D" }}><Loader2 className="animate-spin" size={16} /> Confirming your payment…</div>
      )}
      {outcome === "success" && status === "confirmed" && (
        <>
          <CheckCircle2 size={40} color="#2F8F5B" className="mx-auto mb-3" />
          <div className="tm-display text-lg mb-2" style={{ color: "#10233B" }}>PAYMENT RECEIVED</div>
          <p className="text-sm mb-1" style={{ color: "#5B6B7D" }}>Thanks — {info?.business_name} has been paid €{info?.total} for job {jobNo}.</p>
        </>
      )}
      {outcome === "success" && status === "unconfirmed" && (
        <>
          <div className="tm-display text-lg mb-2" style={{ color: "#10233B" }}>PAYMENT PROCESSING</div>
          <p className="text-sm mb-1" style={{ color: "#5B6B7D" }}>Stripe is still confirming this — it can take a few seconds. Check your job status shortly if this doesn't update.</p>
        </>
      )}
      <button onClick={onDone} style={{ background: "#FF6A13" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm mt-4">Done</button>
    </div>
  );
}

function LegalPage({ title, body, onBack }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#5B6B7D" }}><ArrowLeft size={14} /> Back</button>
      <div className="tm-display text-lg mb-4" style={{ color: "#10233B" }}>{title.toUpperCase()}</div>
      <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm p-5">
        <pre className="text-sm whitespace-pre-wrap" style={{ fontFamily: "'Inter', sans-serif", color: "#1E1B16", lineHeight: 1.6 }}>{body}</pre>
      </div>
    </div>
  );
}

function LegalLinks({ onLegal }) {
  return (
    <div className="text-center mt-6 text-[11px]" style={{ color: "#8b8474" }}>
      <button onClick={() => onLegal("terms")} className="underline">Terms of Service</button>
      {" · "}
      <button onClick={() => onLegal("privacy")} className="underline">Privacy Policy</button>
    </div>
  );
}

function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  };

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center">
        <CheckCircle2 size={40} color="#2F8F5B" className="mx-auto mb-3" />
        <div className="tm-display text-lg mb-2" style={{ color: "#10233B" }}>PASSWORD UPDATED</div>
        <button onClick={onDone} style={{ background: "#FF6A13" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm mt-2">Continue</button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="tm-display text-lg mb-1" style={{ color: "#10233B" }}>SET A NEW PASSWORD</div>
      <p className="text-sm mb-4" style={{ color: "#5B6B7D" }}>Choose a new password for your account.</p>
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5B6B7D" }}>New password</label>
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="tm-input" placeholder="At least 6 characters" />
      <label className="text-xs font-semibold uppercase tracking-wide mt-3 block" style={{ color: "#5B6B7D" }}>Confirm password</label>
      <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" className="tm-input" />
      {error && <p className="text-xs mt-2" style={{ color: "#C2410C" }}>{error}</p>}
      <button onClick={submit} disabled={busy} style={{ background: "#FF6A13" }} className="w-full text-white font-semibold py-2.5 rounded-sm mt-4 flex items-center justify-center gap-2">
        {busy ? <Loader2 className="animate-spin" size={16} /> : null} Update password
      </button>
    </div>
  );
}

/* ---------------- Role select ---------------- */

function RoleSelect({ onPro, onCustomer, onBrowse, onLegal }) {
  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <div style={{ background: "#FF6A13" }} className="w-12 h-12 rounded flex items-center justify-center rotate-[-3deg] mx-auto mb-3">
          <Wrench size={24} color="#10233B" strokeWidth={2.5} />
        </div>
        <div className="tm-display text-xl" style={{ color: "#10233B" }}>TRADEMATE</div>
        <div className="text-xs tracking-[0.2em] mt-1" style={{ color: "#8b8474" }}>IRELAND</div>
      </div>

      <button onClick={onBrowse} style={{ background: "white", border: "1.5px solid #FF6A13" }} className="w-full rounded-sm p-4 mb-3 flex items-center gap-3 text-left">
        <Compass size={22} color="#FF6A13" />
        <div><div className="font-semibold text-sm" style={{ color: "#10233B" }}>Find a tradesperson near me</div>
        <div className="text-xs" style={{ color: "#5B6B7D" }}>Browse by location & service — no account needed</div></div>
        <ChevronRight className="ml-auto" size={18} color="#5B6B7D" />
      </button>

      <button onClick={onPro} style={{ background: "#10233B" }} className="w-full text-white rounded-sm p-4 mb-3 flex items-center gap-3 text-left">
        <HardHat size={22} />
        <div><div className="font-semibold text-sm">I'm a tradesperson</div><div className="text-xs text-white/70">Log in or set up your workspace</div></div>
        <ChevronRight className="ml-auto" size={18} />
      </button>

      <button onClick={onCustomer} style={{ background: "white", border: "1.5px solid #e3dbc8" }} className="w-full rounded-sm p-4 flex items-center gap-3 text-left">
        <UserRound size={22} color="#10233B" />
        <div><div className="font-semibold text-sm">Check on a job I already booked</div><div className="text-xs" style={{ color: "#5B6B7D" }}>Look up every job with just your phone number</div></div>
        <ChevronRight className="ml-auto" size={18} color="#5B6B7D" />
      </button>
      <LegalLinks onLegal={onLegal} />
    </div>
  );
}

/* ---------------- Professional auth (real Supabase Auth) ---------------- */

function ProAuth({ session, onDone, onBack, onLegal }) {
  const [mode, setMode] = useState("login"); // login|signup|setup|forgot — always start at login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bizName, setBizName] = useState("");
  const [location, setLocation] = useState(null); // {label, lat, lng}
  const [services, setServices] = useState([]);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const toggleService = (s) => setServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const sendResetEmail = async () => {
    setError("");
    if (!email.trim()) { setError("Enter your email first."); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setResetSent(true);
  };

  const submitAuth = async () => {
    setError(""); setBusy(true);
    if (mode === "signup") {
      if (!agreedTerms) { setBusy(false); setError("Please agree to the Terms and Privacy Policy to continue."); return; }
      const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (error) { setError(error.message); return; }
      if (!signUpData.session) {
        // Supabase accepts signup silently for an already-registered email (no error, no session)
        // to avoid confirming which emails exist. If there's no session, this wasn't a real signup.
        setError("This email may already have an account. Try Log in instead, or check your inbox to confirm a new account.");
        return;
      }
      setMode("setup"); // after email/password created, collect business details
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) { setBusy(false); setError(signInError.message); return; }
      const { data: { user } } = await supabase.auth.getUser();
      const { data: myBusinesses } = await supabase.rpc("get_my_businesses", { p_user_id: user.id });
      setBusy(false);
      if (myBusinesses && myBusinesses.length > 0) onDone(myBusinesses[0]);
      else setMode("setup"); // logged in, but no business yet — finish setup
    }
  };

  const submitSetup = async () => {
    setError("");
    if (!bizName.trim()) { setError("Enter your business name."); return; }
    if (!location) { setError("Enter your address and click Locate."); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      setError("Your session has expired — please go back and log in again.");
      return;
    }
    let slug = slugify(bizName);
    // ensure uniqueness by checking existing slugs
    const { data: clashes } = await supabase.from("businesses").select("slug").ilike("slug", `${slug}%`);
    if (clashes && clashes.some((c) => c.slug === slug)) slug += Math.floor(Math.random() * 9);
    const { data, error } = await supabase.from("businesses").insert({
      owner_id: user.id, name: bizName.trim(), slug, area: location.label, lat: location.lat, lng: location.lng, services,
    }).select().single();
    setBusy(false);
    if (error) { setError(error.message); return; }
    onDone(data);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#5B6B7D" }}><ArrowLeft size={14} /> Back</button>

      {mode === "forgot" && (
        <>
          <div className="tm-display text-lg mb-1" style={{ color: "#10233B" }}>RESET PASSWORD</div>
          {resetSent ? (
            <p className="text-sm" style={{ color: "#5B6B7D" }}>Check your email for a reset link.</p>
          ) : (
            <>
              <p className="text-sm mb-3" style={{ color: "#5B6B7D" }}>Enter your email and we'll send a reset link.</p>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5B6B7D" }}>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="tm-input" placeholder="you@business.ie" />
              {error && <p className="text-xs mt-2" style={{ color: "#C2410C" }}>{error}</p>}
              <button onClick={sendResetEmail} disabled={busy} style={{ background: "#FF6A13" }} className="w-full text-white font-semibold py-2.5 rounded-sm mt-4 flex items-center justify-center gap-2">
                {busy ? <Loader2 className="animate-spin" size={16} /> : null} Send reset link
              </button>
            </>
          )}
          <button onClick={() => { setMode("login"); setError(""); setResetSent(false); }} className="text-xs mt-4 underline" style={{ color: "#5B6B7D" }}>Back to log in</button>
        </>
      )}

      {mode !== "setup" && mode !== "forgot" && (
        <>
          <div className="flex mb-4 rounded-sm overflow-hidden border" style={{ borderColor: "#e3dbc8" }}>
            {["login", "signup"].map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} className="flex-1 py-2 text-sm font-semibold"
                style={{ background: mode === m ? "#10233B" : "white", color: mode === m ? "white" : "#5B6B7D" }}>
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5B6B7D" }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="tm-input" placeholder="you@business.ie" />
          <label className="text-xs font-semibold uppercase tracking-wide mt-3 block" style={{ color: "#5B6B7D" }}>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="tm-input" placeholder="At least 6 characters" />
          {mode === "login" && (
            <button onClick={() => { setMode("forgot"); setError(""); }} className="text-xs mt-1 underline" style={{ color: "#5B6B7D" }}>Forgot password?</button>
          )}
          {mode === "signup" && (
            <label className="flex items-start gap-2 text-xs mt-3" style={{ color: "#5B6B7D" }}>
              <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5" />
              <span>I agree to the Terms of Service and Privacy Policy</span>
            </label>
          )}
          {error && <p className="text-xs mt-2" style={{ color: "#C2410C" }}>{error}</p>}
          <button onClick={submitAuth} disabled={busy} style={{ background: "#FF6A13" }} className="w-full text-white font-semibold py-2.5 rounded-sm mt-4 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            {mode === "login" ? "Log in" : "Create account"}
          </button>

          <div className="flex items-center gap-2 my-4">
            <div className="flex-1 h-px" style={{ background: "#e3dbc8" }} />
            <span className="text-[11px] uppercase tracking-wide" style={{ color: "#8b8474" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "#e3dbc8" }} />
          </div>
          <button
            onClick={() => supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}?oauth_return=1` } })}
            style={{ background: "white", border: "1.5px solid #e3dbc8" }}
            className="w-full font-semibold py-2.5 rounded-sm flex items-center justify-center gap-2 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3c-7.7 0-14.4 4.4-17.7 11.7z"/><path fill="#4CAF50" d="M24 45c5.4 0 10.3-1.8 14.1-5.4l-6.5-5.5C29.5 35.7 26.9 36.5 24 36.5c-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.5 40.4 16.2 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.5 5.5C41.5 36.1 45 30.8 45 24c0-1.4-.1-2.7-.4-3.5z"/></svg>
            Continue with Google
          </button>
          <LegalLinks onLegal={onLegal} />
        </>
      )}

      {mode === "setup" && (
        <>
          <div className="tm-display text-lg mb-1" style={{ color: "#10233B" }}>SET UP YOUR WORKSPACE</div>
          <p className="text-sm mb-3" style={{ color: "#5B6B7D" }}>One more step — tell customers who you are.</p>
          <Field label="Business name"><input value={bizName} onChange={(e) => setBizName(e.target.value)} className="tm-input" placeholder="Byrne Plumbing & Heating" /></Field>
          <Field label="Where are you based?">
            <AddressLookup onResolved={setLocation} />
          </Field>
          <Field label="What do you offer?">
            <div className="flex flex-wrap gap-1.5 mt-1">{SERVICES.map((s) => <ServiceChip key={s} label={s} active={services.includes(s)} onClick={() => toggleService(s)} />)}</div>
          </Field>
          {error && <p className="text-xs mt-2" style={{ color: "#C2410C" }}>{error}</p>}
          <button onClick={submitSetup} disabled={busy} style={{ background: "#FF6A13" }} className="w-full text-white font-semibold py-2.5 rounded-sm mt-4 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={16} /> : null} Finish setup
          </button>
        </>
      )}
    </div>
  );
}

/* ---------------- Browse trades (public) ---------------- */

function BrowseTrades({ onBack, onViewStatus, onLegal }) {
  const [businesses, setBusinesses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [myLoc, setMyLoc] = useState(null);
  const [geoState, setGeoState] = useState("checking");
  const [manualLoc, setManualLoc] = useState(null); // {label, lat, lng}
  const [serviceFilter, setServiceFilter] = useState([]);
  const [enquiryBiz, setEnquiryBiz] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [ratings, setRatings] = useState({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("businesses").select("*").not("area", "is", null);
      const { data: reviewData } = await supabase.from("reviews").select("business_id, rating");
      const ratingsByBusiness = {};
      (reviewData || []).forEach((r) => {
        ratingsByBusiness[r.business_id] = ratingsByBusiness[r.business_id] || [];
        ratingsByBusiness[r.business_id].push(r.rating);
      });
      setRatings(ratingsByBusiness);
      setBusinesses(data || []);
      setLoaded(true);
    })();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoState("granted"); },
        () => setGeoState("denied"),
        { timeout: 6000 }
      );
    } else setGeoState("denied");
  }, []);

  const effectiveLoc = myLoc || manualLoc;
  const toggleService = (s) => setServiceFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const listed = businesses
    .filter((b) => serviceFilter.length === 0 || (b.services || []).some((s) => serviceFilter.includes(s)))
    .map((b) => ({ ...b, distance: effectiveLoc ? distanceKm(effectiveLoc.lat, effectiveLoc.lng, b.lat, b.lng) : null }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

  if (confirmation) {
    return (
      <div className="max-w-md mx-auto px-4 py-8 text-center">
        <CheckCircle2 size={40} color="#2F8F5B" className="mx-auto mb-3" />
        <div className="tm-display text-lg mb-2" style={{ color: "#10233B" }}>REQUEST SENT</div>
        <p className="text-sm mb-1" style={{ color: "#5B6B7D" }}>{confirmation.business.name} will be in touch shortly.</p>
        <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm p-3 my-4 inline-block">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "#8b8474" }}>Your job number</div>
          <div className="tm-mono text-lg" style={{ color: "#10233B" }}>{confirmation.lead.job_no}</div>
        </div>
        <p className="text-xs mb-4" style={{ color: "#8b8474" }}>Save this and your phone number — you'll need both to check status later.</p>
        <div className="flex flex-col gap-2">
          <button onClick={() => onViewStatus(confirmation.business.name, confirmation.lead)} style={{ background: "#FF6A13" }} className="text-white text-sm font-semibold py-2.5 rounded-sm">Check status now</button>
          <button onClick={() => setConfirmation(null)} className="text-sm py-2" style={{ color: "#5B6B7D" }}>Back to browsing</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#5B6B7D" }}><ArrowLeft size={14} /> Back</button>
      <div className="tm-display text-lg mb-1" style={{ color: "#10233B" }}>TRADESPEOPLE NEAR YOU</div>

      <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "#5B6B7D" }}>
        {geoState === "checking" && <><Loader2 className="animate-spin" size={13} /> Finding your location…</>}
        {geoState === "granted" && <><Navigation size={13} /> Using your device location</>}
        {geoState === "denied" && !manualLoc && (
          <>
            <MapPin size={13} /><span>Location off — enter your area to sort by distance:</span>
          </>
        )}
        {geoState === "denied" && manualLoc && (
          <><MapPin size={13} /><span>Showing distance from {manualLoc.label}</span></>
        )}
      </div>

      {geoState === "denied" && (
        <div className="mb-3 max-w-sm">
          <AddressLookup onResolved={setManualLoc} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {SERVICES.map((s) => <ServiceChip key={s} label={s} active={serviceFilter.includes(s)} onClick={() => toggleService(s)} />)}
      </div>

      {!loaded && <div className="text-sm py-8 text-center" style={{ color: "#5B6B7D" }}>Loading…</div>}
      {loaded && listed.length === 0 && <div className="text-center py-16 text-sm" style={{ color: "#5B6B7D" }}>No tradespeople match yet.</div>}

      <div className="space-y-3">
        {listed.map((b) => (
          <div key={b.id} style={{ background: "white", border: "1px solid #e3dbc8", borderLeft: `4px solid ${b.theme_color || "#FF6A13"}` }} className="rounded-sm p-4 pt-5 relative">
            <PerforatedTop />
            <div className="flex items-start justify-between mb-1">
              <div className="font-semibold text-sm" style={{ color: "#10233B" }}>{b.name}</div>
              {b.distance != null && <div className="tm-mono text-xs shrink-0" style={{ color: "#5B6B7D" }}>{b.distance.toFixed(1)} km away</div>}
            </div>
            {ratings[b.id] && ratings[b.id].length > 0 && (
              <div className="flex items-center gap-1 mb-1 text-xs" style={{ color: "#8b8474" }}>
                <span style={{ color: "#FF6A13" }}>★</span>
                <span className="font-semibold" style={{ color: "#1E1B16" }}>{(ratings[b.id].reduce((a, c) => a + c, 0) / ratings[b.id].length).toFixed(1)}</span>
                <span>({ratings[b.id].length} review{ratings[b.id].length > 1 ? "s" : ""})</span>
              </div>
            )}
            <div className="text-xs mb-2 flex items-center gap-1" style={{ color: "#5B6B7D" }}><MapPin size={11} /> {b.area}</div>
            {b.blurb && <p className="text-sm mb-2">{b.blurb}</p>}
            {(b.services || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">{b.services.map((s) => <span key={s} className="text-[11px] px-1.5 py-0.5 rounded-sm" style={{ background: "#F6F1E7", color: "#5B6B7D" }}>{s}</span>)}</div>
            )}
            <button onClick={() => setEnquiryBiz(b)} style={{ background: b.theme_color || "#FF6A13" }} className="text-white text-xs font-semibold px-3 py-2 rounded-sm">Request a quote</button>
          </div>
        ))}
      </div>

      {enquiryBiz && (
        <PublicEnquiryModal business={enquiryBiz} onClose={() => setEnquiryBiz(null)}
          onSubmitted={(lead) => { setEnquiryBiz(null); setConfirmation({ business: enquiryBiz, lead }); }} />
      )}
      <LegalLinks onLegal={onLegal} />
    </div>
  );
}

function PhotoPicker({ files, onChange }) {
  const inputRef = React.useRef(null);
  const addFiles = (fileList) => {
    const next = [...files, ...Array.from(fileList)].slice(0, 5); // cap at 5 photos
    onChange(next);
  };
  const removeAt = (i) => onChange(files.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5B6B7D" }}>Photos (optional)</label>
      <div className="flex flex-wrap gap-2 mt-1">
        {files.map((f, i) => (
          <div key={i} className="relative w-16 h-16 rounded-sm overflow-hidden border" style={{ borderColor: "#e3dbc8" }}>
            <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => removeAt(i)} className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-sm p-0.5">
              <X size={12} />
            </button>
          </div>
        ))}
        {files.length < 5 && (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="w-16 h-16 rounded-sm border-2 border-dashed flex flex-col items-center justify-center"
            style={{ borderColor: "#e3dbc8", color: "#8b8474" }}>
            <Camera size={18} />
            <span className="text-[9px] mt-0.5">Add</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => { if (e.target.files.length) addFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function PhotoThumbnails({ photos }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {photos.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-sm overflow-hidden border block" style={{ borderColor: "#e3dbc8" }}>
          <img src={url} alt="" className="w-full h-full object-cover" />
        </a>
      ))}
    </div>
  );
}

function PublicEnquiryModal({ business, onClose, onSubmitted }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", problem: "" });
  const [photos, setPhotos] = useState([]);
  const [website, setWebsite] = useState(""); // honeypot — real users never fill this in
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.name && form.phone && form.address && form.problem && agreedTerms;

  const submit = async () => {
    if (website) { onSubmitted({ job_no: "—" }); return; } // bot caught by honeypot — pretend success, do nothing
    setSaving(true); setError("");
    try {
      const photoUrls = photos.length ? await uploadPhotos(photos) : [];
      const { data, error } = await supabase.rpc("create_lead", {
        p_business_id: business.id, p_name: form.name, p_phone: form.phone, p_address: form.address,
        p_problem: form.problem, p_has_photos: photoUrls.length > 0, p_channel: "web", p_photos: photoUrls,
        p_email: form.email || null,
      });
      if (error) throw error;
      notifyNewEnquiry(data.id);
      onSubmitted(data);
    } catch (e) {
      setError(e.message || "Something went wrong — please try again.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div style={{ background: "#F6F1E7" }} className="w-full sm:max-w-md rounded-t-lg sm:rounded-sm max-h-[90vh] overflow-y-auto">
        <div style={{ background: "#10233B" }} className="text-white px-4 py-3 flex items-center justify-between">
          <div className="tm-display text-sm">REQUEST A QUOTE</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm" style={{ color: "#5B6B7D" }}>Sending to <strong style={{ color: "#10233B" }}>{business.name}</strong></p>
          <Field label="Your name"><input value={form.name} onChange={(e) => set("name", e.target.value)} className="tm-input" placeholder="Sarah Byrne" /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="tm-input" placeholder="087 123 4567" /></Field>
          <Field label="Email (optional — for updates by email too)"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className="tm-input" placeholder="sarah@email.com" /></Field>
          <Field label="Address"><input value={form.address} onChange={(e) => set("address", e.target.value)} className="tm-input" placeholder="5km from Galway city centre" /></Field>
          <Field label="What's the problem?"><textarea value={form.problem} onChange={(e) => set("problem", e.target.value)} rows={3} className="tm-input" placeholder="Boiler isn't firing up, no hot water since this morning" /></Field>
          <PhotoPicker files={photos} onChange={setPhotos} />
          <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
          <label className="flex items-start gap-2 text-xs" style={{ color: "#5B6B7D" }}>
            <input type="checkbox" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} className="mt-0.5" />
            <span>I agree to the Terms of Service and Privacy Policy</span>
          </label>
          {error && <p className="text-xs" style={{ color: "#C2410C" }}>{error}</p>}
          <button disabled={!canSubmit || saving} onClick={submit} style={{ background: canSubmit ? "#FF6A13" : "#d8d0bd" }} className="w-full text-white font-semibold py-2.5 rounded-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Send request
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Customer lookup + view (public) ---------------- */

function CustomerLookup({ onBack, onFound }) {
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(""); setResults(null);
    if (!phone.trim()) { setError("Enter your phone number."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("get_jobs_by_phone", { p_phone: phone.trim() });
    setBusy(false);
    if (error) { setError("Something went wrong — please try again."); return; }
    setResults(data || []);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#5B6B7D" }}><ArrowLeft size={14} /> Back</button>
      <div className="tm-display text-lg mb-1" style={{ color: "#10233B" }}>CHECK YOUR JOBS</div>
      <p className="text-sm mb-4" style={{ color: "#5B6B7D" }}>Enter your phone number to see every job you've requested — across any tradesperson.</p>
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5B6B7D" }}>Phone number</label>
      <div className="flex gap-2 mt-1">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} className="tm-input !mt-0 flex-1" placeholder="087 123 4567" />
        <button onClick={submit} disabled={busy} style={{ background: "#FF6A13" }} className="text-white font-semibold px-4 rounded-sm flex items-center justify-center shrink-0">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
        </button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: "#C2410C" }}>{error}</p>}

      {results && results.length === 0 && (
        <p className="text-sm mt-6 text-center" style={{ color: "#5B6B7D" }}>No jobs found for that number.</p>
      )}

      {results && results.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#5B6B7D" }}>{results.length} job{results.length > 1 ? "s" : ""} found</div>
          {results.map(({ lead, business_name }) => (
            <button key={lead.id} onClick={() => onFound(business_name, lead)} className="w-full text-left">
              <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="tm-mono text-xs" style={{ color: "#5B6B7D" }}>{lead.job_no} · {business_name}</div>
                  <div className="text-sm font-semibold truncate max-w-[220px]">{lead.problem}</div>
                </div>
                <Stamp status={lead.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerView({ businessName, lead: initialLead, onBack }) {
  const [lead, setLead] = useState(initialLead);
  const [answerDraft, setAnswerDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const submitReview = async () => {
    if (reviewRating < 1) return;
    setReviewSaving(true);
    const { error } = await supabase.rpc("submit_review", { p_lead_id: lead.id, p_phone: lead.phone, p_rating: reviewRating, p_comment: reviewComment || null });
    setReviewSaving(false);
    if (!error) setReviewSubmitted(true);
  };

  const payNow = async () => {
    setPayLoading(true); setPayError("");
    try {
      const url = await callCreateCheckout(lead.id);
      window.location.href = url; // hand off to Stripe Checkout
    } catch (e) {
      setPayError(e.message || "Couldn't start payment — please try again.");
      setPayLoading(false);
    }
  };
  const q = lead.quote;
  const total = q ? (q.labour || 0) + (q.callout || 0) + Math.round(((q.partsMin || 0) + (q.partsMax || 0)) / 2) : null;
  const messages = lead.messages || [];
  const lastMsg = messages[messages.length - 1];
  const awaitingReply = lastMsg && lastMsg.role === "assistant";

  const sendReply = async () => {
    if (!answerDraft.trim()) return;
    setSending(true);
    const { error } = await supabase.rpc("add_customer_reply", { p_lead_id: lead.id, p_phone: lead.phone, p_message: answerDraft.trim() });
    if (!error) {
      setLead({ ...lead, messages: [...messages, { role: "customer", text: answerDraft.trim(), time: new Date().toISOString() }] });
      edgeFunctionCall("notify-new-enquiry", { lead_id: lead.id, message: `${lead.name} replied on job ${lead.job_no}: "${answerDraft.trim()}"` });
      setAnswerDraft("");
    }
    setSending(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#5B6B7D" }}><ArrowLeft size={14} /> Check another job</button>
      <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm p-4 pt-5 relative">
        <PerforatedTop />
        <div className="flex items-start justify-between mb-2">
          <div><div className="tm-mono text-xs" style={{ color: "#5B6B7D" }}>{lead.job_no}</div><div className="text-sm font-semibold" style={{ color: "#10233B" }}>{businessName}</div></div>
          <Stamp status={lead.status} />
        </div>
        <p className="text-sm mb-3">{lead.problem}</p>
        <PhotoThumbnails photos={lead.photos} />

        {messages.length > 0 && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-3 mb-3">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>Messages</div>
            <div className="space-y-2">
              {messages.map((m, i) => (
                <div key={i} className="text-sm px-3 py-2 rounded-sm max-w-[90%]" style={{ background: m.role === "assistant" ? "#FFF1E6" : "#EEF2F6", marginLeft: m.role === "customer" ? "auto" : 0 }}>{m.text}</div>
              ))}
            </div>
            {awaitingReply && (
              <div className="flex gap-2 mt-2">
                <input value={answerDraft} onChange={(e) => setAnswerDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendReply()}
                  placeholder="Type your reply…" className="flex-1 text-sm border rounded-sm px-2 py-1.5" style={{ borderColor: "#e3dbc8" }} />
                <button onClick={sendReply} disabled={sending} style={{ background: "#FF6A13" }} className="text-white px-3 rounded-sm">
                  {sending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                </button>
              </div>
            )}
          </div>
        )}

        {q && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-3 mb-3">
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#5B6B7D" }}>Estimate</div>
            <div className="tm-mono text-lg flex items-center gap-1" style={{ color: "#10233B" }}><Euro size={16} />{total}</div>
          </div>
        )}
        {lead.booking && <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-3 mb-3 text-sm flex items-center gap-2"><Clock size={14} /> {lead.booking.date} · {lead.booking.time}</div>}
        {lead.invoice && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-3 text-sm">
            <div className="tm-mono text-lg flex items-center gap-1" style={{ color: "#10233B" }}><Euro size={16} />{lead.invoice.total}</div>
            <button onClick={() => downloadInvoicePdf(lead, businessName)} style={{ background: "white", border: "1.5px solid #10233B", color: "#10233B" }} className="mt-2 mb-2 text-xs font-semibold px-3 py-1.5 rounded-sm flex items-center gap-1">
              <Download size={13} /> Download PDF
            </button>
            {lead.invoice.paid ? (
              <>
                <div className="font-semibold text-xs mt-1" style={{ color: "#2F8F5B" }}>Paid — thank you</div>
                {reviewSubmitted ? (
                  <p className="text-xs mt-3" style={{ color: "#5B6B7D" }}>Thanks for your review!</p>
                ) : (
                  <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-3 mt-3">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>How was the job?</div>
                    <div className="flex gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} onClick={() => setReviewRating(n)} style={{ color: n <= reviewRating ? "#FF6A13" : "#e3dbc8", fontSize: 22, lineHeight: 1 }}>★</button>
                      ))}
                    </div>
                    <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={2} className="tm-input" placeholder="Optional comment about the work…" />
                    <button onClick={submitReview} disabled={reviewRating < 1 || reviewSaving} style={{ background: reviewRating >= 1 ? "#FF6A13" : "#d8d0bd" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm mt-2 flex items-center gap-2">
                      {reviewSaving ? <Loader2 className="animate-spin" size={14} /> : null} Submit review
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-semibold text-xs mt-1 mb-2" style={{ color: "#C2410C" }}>Payment due</div>
                {payError && <p className="text-xs mb-2" style={{ color: "#C2410C" }}>{payError}</p>}
                <button onClick={payNow} disabled={payLoading} style={{ background: "#FF6A13" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm flex items-center gap-2">
                  {payLoading ? <Loader2 className="animate-spin" size={14} /> : null} Pay €{lead.invoice.total} now
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================= PRO DASHBOARD ================= */

function ProDashboard({ business, onLogout, onBusinessUpdate }) {
  const [leads, setLeads] = useState([]);
  const [tab, setTab] = useState("inbox");
  const [selectedId, setSelectedId] = useState(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const theme = business.theme_color || "#FF6A13";

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase.from("leads").select("*").eq("business_id", business.id).order("created_at", { ascending: false });
    setLeads(data || []);
    setLoaded(true);
  }, [business.id]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const selected = leads.find((l) => l.id === selectedId) || null;

  const createLead = async (form) => {
    const { data, error } = await supabase.rpc("create_lead", {
      p_business_id: business.id, p_name: form.name, p_phone: form.phone, p_address: form.address,
      p_problem: form.problem, p_has_photos: (form.photos || []).length > 0, p_channel: form.channel, p_photos: form.photos || [],
    });
    if (!error && data) {
      setLeads((prev) => [data, ...prev]);
      setShowNewLead(false); setSelectedId(data.id); setTab("inbox");
    }
  };

  const patchLead = async (id, patch) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))); // optimistic
    await supabase.from("leads").update(patch).eq("id", id);
  };

  const saveProfile = async (patch) => {
    const { data, error } = await supabase.from("businesses").update(patch).eq("id", business.id).select().single();
    if (!error) { onBusinessUpdate(data); setShowProfile(false); }
  };

  return (
    <div>
      <div style={{ background: "#10233B" }} className="text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div style={{ background: theme }} className="w-8 h-8 rounded flex items-center justify-center rotate-[-3deg]"><Wrench size={18} color="#10233B" strokeWidth={2.5} /></div>
          <div>
            <div className="tm-display text-sm tracking-tight leading-none">{business.name.toUpperCase()}</div>
            <div className="text-[10px] tracking-[0.2em] text-white/60 leading-none mt-1">TRADEMATE WORKSPACE</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowNewLead(true)} style={{ background: theme }} className="text-white text-xs font-semibold px-3 py-2 rounded-sm flex items-center gap-1"><Plus size={14} strokeWidth={3} /> New</button>
          <button onClick={() => setShowProfile(true)} title="Public profile" className="text-white/70 p-2"><Settings size={16} /></button>
          <button onClick={onLogout} title="Log out" className="text-white/70 p-2"><LogOut size={16} /></button>
        </div>
      </div>

      <div className="flex border-b" style={{ borderColor: "#e3dbc8", background: "#EFE9DA" }}>
        {[
          { id: "inbox", label: "Inbox", icon: MessageCircle },
          { id: "calendar", label: "Calendar", icon: CalendarIcon },
          { id: "quotes", label: "Quotes", icon: FileText },
          { id: "invoices", label: "Invoices", icon: Receipt },
        ].map((t) => {
          const Icon = t.icon; const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setSelectedId(null); }} className="flex-1 flex flex-col items-center gap-1 py-2 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: active ? "#10233B" : "#8b8474", borderBottom: active ? `3px solid ${theme}` : "3px solid transparent" }}>
              <Icon size={16} strokeWidth={active ? 2.6 : 2} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="p-3 max-w-5xl mx-auto">
        {!loaded && <div className="flex items-center justify-center py-16 text-sm" style={{ color: "#5B6B7D" }}><Loader2 className="animate-spin mr-2" size={16} /> Loading your jobs…</div>}
        {loaded && tab === "inbox" && !selected && <StatsBar leads={leads} theme={theme} />}
        {loaded && tab === "inbox" && !selected && <Inbox leads={leads} onSelect={setSelectedId} onNew={() => setShowNewLead(true)} />}
        {loaded && tab === "inbox" && selected && <LeadDetail lead={selected} businessName={business.name} onBack={() => setSelectedId(null)} onPatch={(p) => patchLead(selected.id, p)} />}
        {loaded && tab === "calendar" && <CalendarView leads={leads} />}
        {loaded && tab === "quotes" && <QuoteList leads={leads} onOpen={(id) => { setTab("inbox"); setSelectedId(id); }} />}
        {loaded && tab === "invoices" && <InvoiceList leads={leads} onOpen={(id) => { setTab("inbox"); setSelectedId(id); }} />}
      </div>

      {showNewLead && <NewLeadModal onClose={() => setShowNewLead(false)} onCreate={createLead} />}
      {showProfile && <ProfileModal business={business} onClose={() => setShowProfile(false)} onSave={saveProfile} />}
    </div>
  );
}

function ProfileModal({ business, onClose, onSave }) {
  const [location, setLocation] = useState({ label: business.area, lat: business.lat, lng: business.lng });
  const [services, setServices] = useState(business.services || []);
  const [blurb, setBlurb] = useState(business.blurb || "");
  const [notifyPhone, setNotifyPhone] = useState(business.notify_phone || "");
  const [themeColor, setThemeColor] = useState(business.theme_color || "#FF6A13");
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null); // {ok, text}
  const toggleService = (s) => setServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  const swatches = ["#FF6A13", "#2F8F5B", "#1D4ED8", "#C2410C", "#7C3AED", "#0F766E", "#DB2777"];

  const save = async () => {
    setSaving(true);
    await onSave({ area: location.label, lat: location.lat, lng: location.lng, services, blurb, notify_phone: notifyPhone || null, theme_color: themeColor });
    setSaving(false);
  };

  const inviteTeammate = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteMsg(null);
    const { data, error } = await supabase.rpc("invite_team_member", { p_business_id: business.id, p_email: inviteEmail.trim() });
    setInviting(false);
    if (error) { setInviteMsg({ ok: false, text: error.message }); return; }
    if (data?.success) { setInviteMsg({ ok: true, text: `${inviteEmail} added to your team.` }); setInviteEmail(""); }
    else setInviteMsg({ ok: false, text: data?.error || "Couldn't add that person." });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div style={{ background: "#F6F1E7" }} className="w-full sm:max-w-md rounded-t-lg sm:rounded-sm max-h-[90vh] overflow-y-auto">
        <div style={{ background: "#10233B" }} className="text-white px-4 py-3 flex items-center justify-between">
          <div className="tm-display text-sm">PUBLIC PROFILE</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs" style={{ color: "#8b8474" }}>This is what customers browsing nearby see about you.</p>
          <Field label="Based near">
            <p className="text-xs mt-1 mb-1" style={{ color: "#5B6B7D" }}>Currently: {business.area || "not set"}</p>
            <AddressLookup initialLabel={business.area} onResolved={setLocation} />
          </Field>
          <Field label="Services offered"><div className="flex flex-wrap gap-1.5 mt-1">{SERVICES.map((s) => <ServiceChip key={s} label={s} active={services.includes(s)} onClick={() => toggleService(s)} />)}</div></Field>
          <Field label="Short description (optional)"><textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={2} className="tm-input" placeholder="Family-run plumbing business, 15 years serving Galway city & suburbs." /></Field>
          <Field label="Your theme color">
            <div className="flex flex-wrap gap-2 mt-1 items-center">
              {swatches.map((c) => (
                <button key={c} type="button" onClick={() => setThemeColor(c)}
                  className="w-8 h-8 rounded-full"
                  style={{ background: c, border: themeColor === c ? "3px solid #10233B" : "1px solid #e3dbc8" }} />
              ))}
              <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-8 h-8 rounded-full cursor-pointer" style={{ border: "1px solid #e3dbc8" }} />
            </div>
            <p className="text-[11px] mt-1" style={{ color: "#8b8474" }}>Colors your dashboard and your card in the public directory.</p>
          </Field>
          <Field label="Phone for SMS alerts (optional)">
            <input value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} className="tm-input" placeholder="087 123 4567" />
            <p className="text-[11px] mt-1" style={{ color: "#8b8474" }}>You'll always get email alerts at your login email. Add a phone here for SMS too.</p>
          </Field>
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-3">
            <Field label="Add a team member">
              <p className="text-[11px] mt-1 mb-1" style={{ color: "#8b8474" }}>They need a TradeMate account already (any email that's signed up before) — this gives them full access to your jobs.</p>
              <div className="flex gap-2">
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" className="tm-input !mt-0 flex-1" placeholder="teammate@email.com" />
                <button onClick={inviteTeammate} disabled={inviting} style={{ background: "#10233B" }} className="text-white text-xs font-semibold px-3 rounded-sm shrink-0">
                  {inviting ? <Loader2 className="animate-spin" size={14} /> : "Add"}
                </button>
              </div>
              {inviteMsg && <p className="text-xs mt-1" style={{ color: inviteMsg.ok ? "#2F8F5B" : "#C2410C" }}>{inviteMsg.text}</p>}
            </Field>
          </div>
          <button onClick={save} disabled={saving} style={{ background: themeColor }} className="w-full text-white font-semibold py-2.5 rounded-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={16} /> : null} Save profile
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inbox ---------------- */

function Inbox({ leads, onSelect, onNew }) {
  const [showDeclined, setShowDeclined] = useState(false);
  const active = leads.filter((l) => l.status !== "declined");
  const declined = leads.filter((l) => l.status === "declined");
  const visible = showDeclined ? leads : active;

  if (leads.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="tm-display text-lg mb-2" style={{ color: "#10233B" }}>NO JOBS ON THE PAD YET</div>
        <p className="text-sm mb-4" style={{ color: "#5B6B7D" }}>Log your first enquiry, or set up your public profile so customers nearby can find you.</p>
        <button onClick={onNew} style={{ background: "#FF6A13" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm">+ New enquiry</button>
      </div>
    );
  }
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((lead) => (
        <button key={lead.id} onClick={() => onSelect(lead.id)} className="text-left">
          <div style={{ background: "white", border: "1px solid #e3dbc8", opacity: lead.status === "declined" ? 0.6 : 1 }} className="rounded-sm shadow-sm px-4 py-3 pt-4 relative hover:shadow-md transition">
            <PerforatedTop />
            <div className="flex items-start justify-between mb-1">
              <div className="tm-mono text-xs" style={{ color: "#5B6B7D" }}>{lead.job_no}</div>
              <Stamp status={lead.status} />
            </div>
            <div className="font-semibold text-sm mb-0.5">{lead.name}</div>
            <div className="text-xs mb-2 flex items-center gap-1" style={{ color: "#5B6B7D" }}><MapPin size={11} /> {lead.address}</div>
            <p className="text-sm mb-2 line-clamp-2">{lead.problem}</p>
            <div className="flex items-center justify-between"><ChannelBadge channel={lead.channel} /><ChevronRight size={16} color="#5B6B7D" /></div>
          </div>
        </button>
        ))}
      </div>
      {declined.length > 0 && (
        <button onClick={() => setShowDeclined((s) => !s)} className="text-xs mt-3" style={{ color: "#8b8474" }}>
          {showDeclined ? "Hide declined" : `Show declined (${declined.length})`}
        </button>
      )}
    </div>
  );
}


/* ---------------- New Lead Modal (internal) ---------------- */

function NewLeadModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", channel: "web", problem: "" });
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.name && form.phone && form.address && form.problem;

  const submit = async () => {
    setSaving(true); setError("");
    try {
      const photoUrls = photos.length ? await uploadPhotos(photos) : [];
      await onCreate({ ...form, photos: photoUrls });
    } catch (e) {
      setError(e.message || "Something went wrong — please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div style={{ background: "#F6F1E7" }} className="w-full sm:max-w-md rounded-t-lg sm:rounded-sm max-h-[90vh] overflow-y-auto">
        <div style={{ background: "#10233B" }} className="text-white px-4 py-3 flex items-center justify-between">
          <div className="tm-display text-sm">NEW ENQUIRY</div>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5B6B7D" }}>Came in via</label>
            <div className="flex gap-2 mt-1">
              {CHANNELS.map((c) => {
                const Icon = c.icon; const active = form.channel === c.id;
                return (
                  <button key={c.id} onClick={() => set("channel", c.id)} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-sm text-xs font-medium"
                    style={{ border: `1.5px solid ${active ? "#FF6A13" : "#e3dbc8"}`, background: active ? "#FFF1E6" : "white", color: active ? "#FF6A13" : "#5B6B7D" }}>
                    <Icon size={16} /> {c.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] mt-1" style={{ color: "#8b8474" }}>WhatsApp/SMS shown here as a log of the enquiry. Auto-capturing real messages needs Twilio wired into the backend.</p>
          </div>
          <Field label="Customer name"><input value={form.name} onChange={(e) => set("name", e.target.value)} className="tm-input" placeholder="Sarah Byrne" /></Field>
          <Field label="Phone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="tm-input" placeholder="087 123 4567" /></Field>
          <Field label="Address"><input value={form.address} onChange={(e) => set("address", e.target.value)} className="tm-input" placeholder="5km from Galway city centre" /></Field>
          <Field label="What's the problem?"><textarea value={form.problem} onChange={(e) => set("problem", e.target.value)} rows={3} className="tm-input" placeholder="Boiler isn't firing up, no hot water since this morning" /></Field>
          <PhotoPicker files={photos} onChange={setPhotos} />
          {error && <p className="text-xs" style={{ color: "#C2410C" }}>{error}</p>}
          <button disabled={!canSubmit || saving} onClick={submit} style={{ background: canSubmit ? "#FF6A13" : "#d8d0bd" }} className="w-full text-white font-semibold py-2.5 rounded-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Log enquiry
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Lead Detail ---------------- */

function LeadDetail({ lead, businessName, onBack, onPatch }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [quoteDraft, setQuoteDraft] = useState(lead.quote);
  const [bookingDraft, setBookingDraft] = useState({ date: "", time: "" });

  useEffect(() => setQuoteDraft(lead.quote), [lead.quote]);
  const messages = lead.messages || [];

  const askAI = async () => {
    setAiLoading(true); setAiError(null);
    try {
      const conversation = messages.map((m) => `${m.role}: ${m.text}`).join("\n");
      const parsed = await callAiAssess({ problem: lead.problem, hasPhotos: lead.has_photos, conversation });
      const newMessages = [...messages, { role: "assistant", text: parsed.question, time: new Date().toISOString() }];
      onPatch({ messages: newMessages, quote: lead.quote || parsed.quote });
      setQuoteDraft(lead.quote || parsed.quote);
      notifyCustomer(lead.id, `${lead.name}, we have a quick question about your job: "${parsed.question}" — reply on your job status page.`);
    } catch (e) {
      setAiError("Couldn't reach the AI just now — you can still fill in the quote manually below.");
    }
    setAiLoading(false);
  };

  const sendAnswer = () => { if (!answerDraft.trim()) return; onPatch({ messages: [...messages, { role: "customer", text: answerDraft, time: new Date().toISOString() }] }); setAnswerDraft(""); };
  const startManualQuote = () => setQuoteDraft({ labour: 0, callout: 0, partsMin: 0, partsMax: 0 });
  const quoteEditable = !lead.quote || lead.status === "new" || lead.status === "quoted";
  const saveQuote = () => {
    onPatch({ quote: quoteDraft, status: lead.status === "new" ? "quoted" : lead.status });
    const total = (quoteDraft.labour || 0) + (quoteDraft.callout || 0) + Math.round(((quoteDraft.partsMin || 0) + (quoteDraft.partsMax || 0)) / 2);
    notifyCustomer(lead.id, `Your quote is ready: approx €${total}. Check your job status page for details and to book a time.`);
  };
  const [showBookingForm, setShowBookingForm] = useState(false);
  const confirmBooking = () => {
    if (!bookingDraft.date || !bookingDraft.time) return;
    onPatch({ booking: bookingDraft, status: lead.status === "new" || lead.status === "quoted" ? "booked" : lead.status });
    setShowBookingForm(false);
    notifyCustomer(lead.id, `Your appointment is confirmed for ${bookingDraft.date} at ${bookingDraft.time}.`);
  };
  const markComplete = () => {
    const total = quoteDraft ? (quoteDraft.labour || 0) + (quoteDraft.callout || 0) + Math.round(((quoteDraft.partsMin || 0) + (quoteDraft.partsMax || 0)) / 2) : 0;
    onPatch({ status: "invoiced", invoice: { total, issuedAt: new Date().toISOString(), paid: false } });
    notifyCustomer(lead.id, `Job complete! Your invoice is ready: €${total}. Pay online from your job status page.`);
  };
  const markPaid = () => onPatch({ status: "paid", invoice: { ...lead.invoice, paid: true, paidAt: new Date().toISOString() } });
  const declineLead = () => {
    if (!window.confirm("Decline this enquiry? The customer won't be notified automatically.")) return;
    onPatch({ status: "declined" });
  };
  const [rescheduling, setRescheduling] = useState(false);
  const cancelBooking = () => {
    if (!window.confirm("Cancel this booking? The job will go back to unbooked.")) return;
    onPatch({ booking: null, status: lead.quote ? "quoted" : "new" });
    notifyCustomer(lead.id, `Your appointment for job ${lead.job_no} has been cancelled. We'll be in touch to rebook.`);
  };
  const saveReschedule = () => {
    if (!bookingDraft.date || !bookingDraft.time) return;
    onPatch({ booking: bookingDraft });
    setRescheduling(false);
    notifyCustomer(lead.id, `Your appointment has been rescheduled to ${bookingDraft.date} at ${bookingDraft.time}.`);
  };

  return (
    <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #e3dbc8" }}>
        <button onClick={onBack}><ArrowLeft size={18} color="#5B6B7D" /></button>
        <div className="tm-mono text-xs" style={{ color: "#5B6B7D" }}>{lead.job_no}</div>
        <div className="ml-auto flex items-center gap-2">
          {!["invoiced", "paid", "declined"].includes(lead.status) && (
            <button onClick={declineLead} className="text-xs" style={{ color: "#8b8474" }}>Decline</button>
          )}
          <Stamp status={lead.status} />
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <div className="font-semibold">{lead.name} · {lead.phone}</div>
          <div className="text-sm flex items-center gap-1" style={{ color: "#5B6B7D" }}><MapPin size={12} /> {lead.address}</div>
          <div className="mt-1"><ChannelBadge channel={lead.channel} /></div>
          <p className="mt-2 text-sm">{lead.problem}</p>
          <PhotoThumbnails photos={lead.photos} />
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>Conversation</div>
          <div className="space-y-2">
            {messages.map((m, i) => (
              <div key={i} className="text-sm px-3 py-2 rounded-sm max-w-[85%]" style={{ background: m.role === "assistant" ? "#FFF1E6" : m.role === "customer" ? "#EEF2F6" : "#F6F1E7", marginLeft: m.role === "customer" ? "auto" : 0 }}>
                <div className="text-[10px] uppercase font-semibold mb-0.5" style={{ color: "#8b8474" }}>{m.role === "assistant" ? "AI (to customer)" : m.role}</div>{m.text}
              </div>
            ))}
            {messages.length === 0 && <p className="text-sm" style={{ color: "#8b8474" }}>No AI assessment yet — optional, you can quote and book without it below.</p>}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={askAI} disabled={aiLoading} style={{ background: "#10233B" }} className="text-white text-xs font-semibold px-3 py-2 rounded-sm flex items-center gap-1">
              {aiLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
              {messages.length === 0 ? "Get AI assessment" : "Ask AI to refine"}
            </button>
          </div>
          {aiError && <p className="text-xs mt-1" style={{ color: "#C2410C" }}>{aiError}</p>}
          <div className="flex gap-2 mt-2">
            <input value={answerDraft} onChange={(e) => setAnswerDraft(e.target.value)} placeholder="Log customer's reply…" className="flex-1 text-sm border rounded-sm px-2 py-1.5" style={{ borderColor: "#e3dbc8" }} />
            <button onClick={sendAnswer} style={{ background: "#5B6B7D" }} className="text-white px-3 rounded-sm"><Send size={14} /></button>
          </div>
        </div>

        <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>Quote</div>
          {!quoteDraft ? (
            <button onClick={startManualQuote} style={{ background: "#10233B" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm flex items-center gap-1">
              <FileText size={14} /> Create a quote
            </button>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <MoneyField label="Labour" value={quoteDraft.labour} onChange={(v) => setQuoteDraft({ ...quoteDraft, labour: v })} disabled={!quoteEditable} />
                <MoneyField label="Call-out" value={quoteDraft.callout} onChange={(v) => setQuoteDraft({ ...quoteDraft, callout: v })} disabled={!quoteEditable} />
                <MoneyField label="Parts (min)" value={quoteDraft.partsMin} onChange={(v) => setQuoteDraft({ ...quoteDraft, partsMin: v })} disabled={!quoteEditable} />
                <MoneyField label="Parts (max)" value={quoteDraft.partsMax} onChange={(v) => setQuoteDraft({ ...quoteDraft, partsMax: v })} disabled={!quoteEditable} />
              </div>
              {quoteEditable && (
                <button onClick={saveQuote} style={{ background: "#FF6A13" }} className="mt-3 text-white text-sm font-semibold px-4 py-2 rounded-sm">
                  {lead.quote ? "Update quote" : "Approve quote & send"}
                </button>
              )}
            </>
          )}
        </div>

        {!lead.booking && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>Book the job</div>
            {!showBookingForm ? (
              <button onClick={() => setShowBookingForm(true)} style={{ background: "#10233B" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm flex items-center gap-1">
                <CalendarIcon size={14} /> Book an appointment
              </button>
            ) : (
              <>
                <div className="flex gap-2">
                  <input type="date" value={bookingDraft.date} onChange={(e) => setBookingDraft({ ...bookingDraft, date: e.target.value })} className="border rounded-sm px-2 py-1.5 text-sm" style={{ borderColor: "#e3dbc8" }} />
                  <select value={bookingDraft.time} onChange={(e) => setBookingDraft({ ...bookingDraft, time: e.target.value })} className="border rounded-sm px-2 py-1.5 text-sm" style={{ borderColor: "#e3dbc8" }}>
                    <option value="">Time slot</option>
                    {["08:00–10:00","10:00–12:00","12:00–14:00","14:00–16:00","16:00–18:00"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <button onClick={confirmBooking} style={{ background: "#FF6A13" }} className="mt-3 text-white text-sm font-semibold px-4 py-2 rounded-sm flex items-center gap-1"><CalendarIcon size={14} /> Confirm booking</button>
              </>
            )}
          </div>
        )}

        {lead.booking && lead.status !== "invoiced" && lead.status !== "paid" && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-4">
            <div className="text-sm flex items-center gap-2 mb-2"><Clock size={14} /> {lead.booking.date} · {lead.booking.time}</div>
            {!rescheduling ? (
              <div className="flex gap-2 mb-3">
                <button onClick={() => { setBookingDraft(lead.booking); setRescheduling(true); }} className="text-xs font-semibold px-3 py-1.5 rounded-sm" style={{ background: "white", border: "1px solid #e3dbc8", color: "#5B6B7D" }}>Reschedule</button>
                <button onClick={cancelBooking} className="text-xs font-semibold px-3 py-1.5 rounded-sm" style={{ background: "white", border: "1px solid #e3dbc8", color: "#C2410C" }}>Cancel booking</button>
              </div>
            ) : (
              <div className="mb-3">
                <div className="flex gap-2">
                  <input type="date" value={bookingDraft.date} onChange={(e) => setBookingDraft({ ...bookingDraft, date: e.target.value })} className="border rounded-sm px-2 py-1.5 text-sm" style={{ borderColor: "#e3dbc8" }} />
                  <select value={bookingDraft.time} onChange={(e) => setBookingDraft({ ...bookingDraft, time: e.target.value })} className="border rounded-sm px-2 py-1.5 text-sm" style={{ borderColor: "#e3dbc8" }}>
                    {["08:00–10:00","10:00–12:00","12:00–14:00","14:00–16:00","16:00–18:00"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={saveReschedule} style={{ background: "#10233B" }} className="text-white text-xs font-semibold px-3 py-1.5 rounded-sm">Save new time</button>
                  <button onClick={() => setRescheduling(false)} className="text-xs" style={{ color: "#8b8474" }}>Cancel</button>
                </div>
              </div>
            )}
            {quoteDraft ? (
              <button onClick={markComplete} style={{ background: "#FF6A13" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm flex items-center gap-1"><CheckCircle2 size={14} /> Mark job complete & invoice</button>
            ) : (
              <p className="text-xs" style={{ color: "#8b8474" }}>Add a quote above before invoicing this job.</p>
            )}
          </div>
        )}

        {(lead.status === "invoiced" || lead.status === "paid") && lead.invoice && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>Invoice</div>
            <div className="tm-mono text-2xl flex items-center gap-1" style={{ color: "#10233B" }}><Euro size={20} />{lead.invoice.total}</div>
            <div className="text-xs mt-1" style={{ color: "#5B6B7D" }}>Issued {new Date(lead.invoice.issuedAt).toLocaleDateString("en-IE")}</div>
            <button onClick={() => downloadInvoicePdf(lead, businessName)} style={{ background: "white", border: "1.5px solid #10233B", color: "#10233B" }} className="mt-2 text-sm font-semibold px-4 py-2 rounded-sm flex items-center gap-1">
              <Download size={14} /> Download PDF
            </button>
            {lead.status === "invoiced" ? (
              <div className="mt-3">
                <button onClick={markPaid} style={{ background: "#2F8F5B" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm">Mark as paid (cash / bank transfer)</button>
                <p className="text-[11px] mt-1" style={{ color: "#8b8474" }}>Card payments made through the customer's status page confirm automatically — no need to click this for those.</p>
              </div>
            ) : (
              <div className="mt-2 text-sm font-semibold" style={{ color: "#2F8F5B" }}>Paid {new Date(lead.invoice.paidAt).toLocaleDateString("en-IE")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function MoneyField({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="text-[11px]" style={{ color: "#8b8474" }}>{label}</label>
      <div className="flex items-center border rounded-sm px-2" style={{ borderColor: "#e3dbc8", background: disabled ? "#F6F1E7" : "white" }}>
        <Euro size={12} color="#8b8474" />
        <input type="number" disabled={disabled} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} className="tm-mono w-full py-1 px-1 text-sm bg-transparent outline-none" />
      </div>
    </div>
  );
}

/* ---------------- Calendar / Quotes / Invoices ---------------- */

function isoDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function startOfWeekMonday(d) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 0 = Monday
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addMonths(d, n) { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; }

function CalendarView({ leads }) {
  const [viewMode, setViewMode] = useState("month");
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const booked = leads.filter((l) => l.booking && ["booked", "invoiced", "paid"].includes(l.status));
  const byDate = {};
  booked.forEach((l) => { byDate[l.booking.date] = byDate[l.booking.date] || []; byDate[l.booking.date].push(l); });

  const shift = (dir) => setAnchorDate((d) => (viewMode === "month" ? addMonths(d, dir) : addDays(d, dir * 7)));
  const goToday = () => { setAnchorDate(new Date()); setSelectedDate(null); };

  const headerLabel = viewMode === "month"
    ? anchorDate.toLocaleDateString("en-IE", { month: "long", year: "numeric" })
    : (() => {
        const start = startOfWeekMonday(anchorDate), end = addDays(start, 6);
        const sameMonth = start.getMonth() === end.getMonth();
        return sameMonth
          ? `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString("en-IE", { month: "long" })}`
          : `${start.toLocaleDateString("en-IE", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-IE", { day: "numeric", month: "short" })}`;
      })();

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex rounded-sm overflow-hidden border" style={{ borderColor: "#e3dbc8" }}>
          {["month", "week"].map((v) => (
            <button key={v} onClick={() => { setViewMode(v); setSelectedDate(null); }}
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
              style={{ background: viewMode === v ? "#10233B" : "white", color: viewMode === v ? "white" : "#5B6B7D" }}>
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-sm" style={{ background: "white", border: "1px solid #e3dbc8" }}><ChevronLeft size={14} color="#5B6B7D" /></button>
          <div className="tm-display text-sm px-1 min-w-[130px] text-center" style={{ color: "#10233B" }}>{headerLabel}</div>
          <button onClick={() => shift(1)} className="p-1.5 rounded-sm" style={{ background: "white", border: "1px solid #e3dbc8" }}><ChevronRight size={14} color="#5B6B7D" /></button>
        </div>
        <button onClick={goToday} className="text-xs font-semibold px-2 py-1" style={{ color: "#FF6A13" }}>Today</button>
      </div>

      {viewMode === "month" ? (
        <MonthGrid anchorDate={anchorDate} byDate={byDate} selectedDate={selectedDate} onSelect={setSelectedDate} />
      ) : (
        <WeekList anchorDate={anchorDate} byDate={byDate} />
      )}

      {viewMode === "month" && selectedDate && (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>
            {new Date(selectedDate).toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <DayJobList jobs={(byDate[selectedDate] || []).sort((a, b) => a.booking.time.localeCompare(b.booking.time))} />
        </div>
      )}
    </div>
  );
}

function MonthGrid({ anchorDate, byDate, selectedDate, onSelect }) {
  const firstOfMonth = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const gridStart = startOfWeekMonday(firstOfMonth);
  const today = isoDate(new Date());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const dots = ["#FF6A13", "#10233B", "#5B6B7D"];

  return (
    <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm overflow-hidden">
      <div className="grid grid-cols-7" style={{ background: "#EFE9DA" }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold uppercase py-1.5" style={{ color: "#8b8474" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const iso = isoDate(day);
          const jobs = byDate[iso] || [];
          const inMonth = day.getMonth() === anchorDate.getMonth();
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          return (
            <button key={i} onClick={() => onSelect(jobs.length ? iso : null)}
              className="aspect-square flex flex-col items-center justify-start pt-1.5 relative"
              style={{
                background: isSelected ? "#FFF1E6" : "white",
                borderTop: "1px solid #f0ebdd", borderLeft: i % 7 !== 0 ? "1px solid #f0ebdd" : "none",
                opacity: inMonth ? 1 : 0.35,
              }}>
              <div className="text-xs tm-mono" style={{
                color: isToday ? "white" : "#1E1B16",
                background: isToday ? "#FF6A13" : "transparent",
                width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              }}>{day.getDate()}</div>
              <div className="flex gap-0.5 mt-1">
                {jobs.slice(0, 3).map((_, idx) => (
                  <div key={idx} style={{ width: 4, height: 4, borderRadius: "50%", background: dots[idx % dots.length] }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekList({ anchorDate, byDate }) {
  const start = startOfWeekMonday(anchorDate);
  const today = isoDate(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="space-y-3">
      {days.map((day) => {
        const iso = isoDate(day);
        const jobs = (byDate[iso] || []).sort((a, b) => a.booking.time.localeCompare(b.booking.time));
        const isToday = iso === today;
        return (
          <div key={iso}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="tm-display text-sm" style={{ color: isToday ? "#FF6A13" : "#10233B" }}>
                {day.toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "short" })}
              </div>
              {isToday && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm" style={{ background: "#FF6A13", color: "white" }}>TODAY</span>}
            </div>
            {jobs.length === 0 ? (
              <div className="text-xs pl-1" style={{ color: "#8b8474" }}>No jobs booked</div>
            ) : (
              <DayJobList jobs={jobs} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatsBar({ leads, theme }) {
  const now = new Date();
  const thisMonth = leads.filter((l) => {
    const d = new Date(l.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const enquiries = thisMonth.length;
  const invoicedTotal = thisMonth.filter((l) => l.invoice).reduce((s, l) => s + (l.invoice.total || 0), 0);
  const won = thisMonth.filter((l) => ["booked", "invoiced", "paid"].includes(l.status)).length;
  const conversion = enquiries > 0 ? Math.round((won / enquiries) * 100) : 0;

  const stats = [
    { label: "Enquiries this month", value: enquiries },
    { label: "Invoiced this month", value: `€${invoicedTotal}` },
    { label: "Conversion rate", value: `${conversion}%` },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      {stats.map((s) => (
        <div key={s.label} style={{ background: "white", border: "1px solid #e3dbc8", borderTop: `3px solid ${theme}` }} className="rounded-sm px-3 py-2">
          <div className="tm-mono text-lg" style={{ color: "#10233B" }}>{s.value}</div>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "#8b8474" }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function DayJobList({ jobs }) {
  return (
    <div className="space-y-2">
      {jobs.map((l) => (
        <div key={l.id} style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm px-3 py-2 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">{l.booking.time} · {l.name}</div>
            <div className="text-xs flex items-center gap-1" style={{ color: "#5B6B7D" }}><MapPin size={11} />{l.address}</div>
          </div>
          <Stamp status={l.status} />
        </div>
      ))}
    </div>
  );
}

function QuoteList({ leads, onOpen }) {
  const quoted = leads.filter((l) => l.quote);
  if (quoted.length === 0) return <div className="text-center py-16 text-sm" style={{ color: "#5B6B7D" }}>No quotes yet.</div>;
  return (
    <div className="space-y-2">
      {quoted.map((l) => {
        const total = (l.quote.labour || 0) + (l.quote.callout || 0) + Math.round(((l.quote.partsMin || 0) + (l.quote.partsMax || 0)) / 2);
        return (
          <button key={l.id} onClick={() => onOpen(l.id)} className="w-full text-left">
            <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm px-4 py-3 flex items-center justify-between">
              <div><div className="tm-mono text-xs" style={{ color: "#5B6B7D" }}>{l.job_no}</div><div className="text-sm font-semibold">{l.name}</div></div>
              <div className="text-right"><div className="tm-mono text-sm">~€{total}</div><Stamp status={l.status} /></div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
function InvoiceList({ leads, onOpen }) {
  const invoiced = leads.filter((l) => l.invoice);
  if (invoiced.length === 0) return <div className="text-center py-16 text-sm" style={{ color: "#5B6B7D" }}>No invoices yet.</div>;
  const outstanding = invoiced.filter((l) => !l.invoice.paid).reduce((s, l) => s + l.invoice.total, 0);
  return (
    <div>
      {outstanding > 0 && <div style={{ background: "#FFF1E6", border: "1px solid #FF6A13" }} className="rounded-sm px-3 py-2 text-sm font-semibold mb-3">€{outstanding} outstanding across {invoiced.filter((l) => !l.invoice.paid).length} invoice(s)</div>}
      <div className="space-y-2">
        {invoiced.map((l) => (
          <button key={l.id} onClick={() => onOpen(l.id)} className="w-full text-left">
            <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm px-4 py-3 flex items-center justify-between">
              <div><div className="tm-mono text-xs" style={{ color: "#5B6B7D" }}>{l.job_no}</div><div className="text-sm font-semibold">{l.name}</div></div>
              <div className="text-right"><div className="tm-mono text-sm">€{l.invoice.total}</div><Stamp status={l.status} /></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
