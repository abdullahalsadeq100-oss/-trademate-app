import React, { useState, useEffect, useCallback } from "react";
import {
  Wrench, Phone, MessageCircle, Globe, Plus, Loader2, CheckCircle2,
  Calendar as CalendarIcon, FileText, Receipt, Send, ChevronRight,
  MapPin, Camera, X, Sparkles, ArrowLeft, Euro, Clock, LogOut,
  Search, ShieldAlert, HardHat, UserRound, Settings, Navigation, Compass
} from "lucide-react";
import { supabase } from "./supabaseClient";

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

const STATUS_LABEL = { new: "NEW ENQUIRY", quoted: "QUOTED", booked: "BOOKED", invoiced: "INVOICED", paid: "PAID" };
const STATUS_COLOR = { new: "#FF6A13", quoted: "#5B6B7D", booked: "#10233B", invoiced: "#C2410C", paid: "#2F8F5B" };

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
  const [phase, setPhase] = useState("loading"); // loading|role|pro-auth|pro-app|cust-lookup|cust-view|browse
  const [session, setSession] = useState(null);
  const [business, setBusiness] = useState(null);
  const [customerLead, setCustomerLead] = useState(null);
  const [customerBusinessName, setCustomerBusinessName] = useState(null);
  const [paymentReturn, setPaymentReturn] = useState(null); // { jobNo, outcome }

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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadOwnedBusiness(session.user.id);
      else setPhase("role");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadOwnedBusiness = async (userId) => {
    const { data } = await supabase.from("businesses").select("*").eq("owner_id", userId).limit(1).maybeSingle();
    if (data) { setBusiness(data); setPhase("pro-app"); }
    else setPhase("pro-auth"); // logged in but no business yet — finish setup
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setBusiness(null);
    setPhase("role");
  };
  const goToStatus = (bizName, lead) => { setCustomerBusinessName(bizName); setCustomerLead(lead); setPhase("cust-view"); };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#F6F1E7", color: "#1E1B16", minHeight: "100vh" }} className="w-full">
      <GlobalStyle />
      {phase === "loading" && <div className="flex items-center justify-center py-24 text-sm" style={{ color: "#5B6B7D" }}><Loader2 className="animate-spin mr-2" size={16} /> Loading…</div>}
      {phase === "role" && <RoleSelect onPro={() => setPhase("pro-auth")} onCustomer={() => setPhase("cust-lookup")} onBrowse={() => setPhase("browse")} />}
      {phase === "pro-auth" && <ProAuth session={session} onDone={(biz) => { setBusiness(biz); setPhase("pro-app"); }} onBack={() => setPhase("role")} />}
      {phase === "pro-app" && business && <ProDashboard business={business} onLogout={logout} onBusinessUpdate={setBusiness} />}
      {phase === "cust-lookup" && <CustomerLookup onBack={() => setPhase("role")} onFound={goToStatus} />}
      {phase === "cust-view" && customerLead && <CustomerView businessName={customerBusinessName} lead={customerLead} onBack={() => setPhase("cust-lookup")} />}
      {phase === "browse" && <BrowseTrades onBack={() => setPhase("role")} onViewStatus={goToStatus} />}
      {phase === "payment-result" && paymentReturn && <PaymentResult jobNo={paymentReturn.jobNo} outcome={paymentReturn.outcome} onDone={() => setPhase("role")} />}
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

/* ---------------- Role select ---------------- */

function RoleSelect({ onPro, onCustomer, onBrowse }) {
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
        <div><div className="font-semibold text-sm">Check on a job I already booked</div><div className="text-xs" style={{ color: "#5B6B7D" }}>Look up with your job number & phone</div></div>
        <ChevronRight className="ml-auto" size={18} color="#5B6B7D" />
      </button>
    </div>
  );
}

/* ---------------- Professional auth (real Supabase Auth) ---------------- */

function ProAuth({ session, onDone, onBack }) {
  const [mode, setMode] = useState(session ? "setup" : "login"); // login|signup|setup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bizName, setBizName] = useState("");
  const [area, setArea] = useState(AREAS[0].name);
  const [services, setServices] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleService = (s) => setServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const submitAuth = async () => {
    setError(""); setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (error) { setError(error.message); return; }
      setMode("setup"); // after email/password created, collect business details
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { setError(error.message); return; }
      // onAuthStateChange in App will pick up the session and load/redirect
    }
  };

  const submitSetup = async () => {
    setError("");
    if (!bizName.trim()) { setError("Enter your business name."); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const areaObj = AREAS.find((a) => a.name === area);
    let slug = slugify(bizName);
    // ensure uniqueness by checking existing slugs
    const { data: clashes } = await supabase.from("businesses").select("slug").ilike("slug", `${slug}%`);
    if (clashes && clashes.some((c) => c.slug === slug)) slug += Math.floor(Math.random() * 9);
    const { data, error } = await supabase.from("businesses").insert({
      owner_id: user.id, name: bizName.trim(), slug, area: areaObj.name, lat: areaObj.lat, lng: areaObj.lng, services,
    }).select().single();
    setBusy(false);
    if (error) { setError(error.message); return; }
    onDone(data);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#5B6B7D" }}><ArrowLeft size={14} /> Back</button>

      {mode !== "setup" && (
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
          {error && <p className="text-xs mt-2" style={{ color: "#C2410C" }}>{error}</p>}
          <button onClick={submitAuth} disabled={busy} style={{ background: "#FF6A13" }} className="w-full text-white font-semibold py-2.5 rounded-sm mt-4 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            {mode === "login" ? "Log in" : "Create account"}
          </button>
        </>
      )}

      {mode === "setup" && (
        <>
          <div className="tm-display text-lg mb-1" style={{ color: "#10233B" }}>SET UP YOUR WORKSPACE</div>
          <p className="text-sm mb-3" style={{ color: "#5B6B7D" }}>One more step — tell customers who you are.</p>
          <Field label="Business name"><input value={bizName} onChange={(e) => setBizName(e.target.value)} className="tm-input" placeholder="Byrne Plumbing & Heating" /></Field>
          <Field label="Where are you based?">
            <select value={area} onChange={(e) => setArea(e.target.value)} className="tm-input">{AREAS.map((a) => <option key={a.name}>{a.name}</option>)}</select>
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

function BrowseTrades({ onBack, onViewStatus }) {
  const [businesses, setBusinesses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [myLoc, setMyLoc] = useState(null);
  const [geoState, setGeoState] = useState("checking");
  const [manualArea, setManualArea] = useState(AREAS[0].name);
  const [serviceFilter, setServiceFilter] = useState([]);
  const [enquiryBiz, setEnquiryBiz] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("businesses").select("*").not("area", "is", null);
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

  const effectiveLoc = myLoc || AREAS.find((a) => a.name === manualArea);
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
        {geoState === "denied" && (
          <>
            <MapPin size={13} /><span>Location off — showing distance from</span>
            <select value={manualArea} onChange={(e) => setManualArea(e.target.value)} className="border rounded-sm px-1 py-0.5" style={{ borderColor: "#e3dbc8" }}>
              {AREAS.map((a) => <option key={a.name}>{a.name}</option>)}
            </select>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {SERVICES.map((s) => <ServiceChip key={s} label={s} active={serviceFilter.includes(s)} onClick={() => toggleService(s)} />)}
      </div>

      {!loaded && <div className="text-sm py-8 text-center" style={{ color: "#5B6B7D" }}>Loading…</div>}
      {loaded && listed.length === 0 && <div className="text-center py-16 text-sm" style={{ color: "#5B6B7D" }}>No tradespeople match yet.</div>}

      <div className="space-y-3">
        {listed.map((b) => (
          <div key={b.id} style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm p-4 pt-5 relative">
            <PerforatedTop />
            <div className="flex items-start justify-between mb-1">
              <div className="font-semibold text-sm" style={{ color: "#10233B" }}>{b.name}</div>
              {b.distance != null && <div className="tm-mono text-xs shrink-0" style={{ color: "#5B6B7D" }}>{b.distance.toFixed(1)} km away</div>}
            </div>
            <div className="text-xs mb-2 flex items-center gap-1" style={{ color: "#5B6B7D" }}><MapPin size={11} /> {b.area}</div>
            {b.blurb && <p className="text-sm mb-2">{b.blurb}</p>}
            {(b.services || []).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">{b.services.map((s) => <span key={s} className="text-[11px] px-1.5 py-0.5 rounded-sm" style={{ background: "#F6F1E7", color: "#5B6B7D" }}>{s}</span>)}</div>
            )}
            <button onClick={() => setEnquiryBiz(b)} style={{ background: "#FF6A13" }} className="text-white text-xs font-semibold px-3 py-2 rounded-sm">Request a quote</button>
          </div>
        ))}
      </div>

      {enquiryBiz && (
        <PublicEnquiryModal business={enquiryBiz} onClose={() => setEnquiryBiz(null)}
          onSubmitted={(lead) => { setEnquiryBiz(null); setConfirmation({ business: enquiryBiz, lead }); }} />
      )}
    </div>
  );
}

function PublicEnquiryModal({ business, onClose, onSubmitted }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", problem: "", hasPhotos: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.name && form.phone && form.address && form.problem;

  const submit = async () => {
    setSaving(true); setError("");
    const { data, error } = await supabase.rpc("create_lead", {
      p_business_id: business.id, p_name: form.name, p_phone: form.phone, p_address: form.address,
      p_problem: form.problem, p_has_photos: form.hasPhotos, p_channel: "web",
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onSubmitted(data);
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
          <Field label="Address"><input value={form.address} onChange={(e) => set("address", e.target.value)} className="tm-input" placeholder="5km from Galway city centre" /></Field>
          <Field label="What's the problem?"><textarea value={form.problem} onChange={(e) => set("problem", e.target.value)} rows={3} className="tm-input" placeholder="Boiler isn't firing up, no hot water since this morning" /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.hasPhotos} onChange={(e) => set("hasPhotos", e.target.checked)} />
            <span className="flex items-center gap-1"><Camera size={14} /> I have photos to send</span>
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
  const [jobNo, setJobNo] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!jobNo.trim() || !phone.trim()) { setError("Enter both your job number and phone number."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("get_job_status", { p_job_no: jobNo.trim(), p_phone: phone.trim() });
    setBusy(false);
    if (error || !data) { setError("No job matches that job number and phone number."); return; }
    onFound(data.business.name, data.lead);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-1 text-sm mb-4" style={{ color: "#5B6B7D" }}><ArrowLeft size={14} /> Back</button>
      <div className="tm-display text-lg mb-1" style={{ color: "#10233B" }}>CHECK YOUR JOB</div>
      <p className="text-sm mb-4" style={{ color: "#5B6B7D" }}>Enter the job number your tradesperson gave you, plus your phone number.</p>
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5B6B7D" }}>Job number</label>
      <input value={jobNo} onChange={(e) => setJobNo(e.target.value)} className="tm-input tm-mono" placeholder="BYR-0007" />
      <label className="text-xs font-semibold uppercase tracking-wide mt-3 block" style={{ color: "#5B6B7D" }}>Phone number</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} className="tm-input" placeholder="087 123 4567" />
      {error && <p className="text-xs mt-2" style={{ color: "#C2410C" }}>{error}</p>}
      <button onClick={submit} disabled={busy} style={{ background: "#FF6A13" }} className="w-full text-white font-semibold py-2.5 rounded-sm mt-4 flex items-center justify-center gap-2">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} Check status
      </button>
    </div>
  );
}

function CustomerView({ businessName, lead: initialLead, onBack }) {
  const [lead, setLead] = useState(initialLead);
  const [answerDraft, setAnswerDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");

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
            {lead.invoice.paid ? (
              <div className="font-semibold text-xs mt-1" style={{ color: "#2F8F5B" }}>Paid — thank you</div>
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
      p_problem: form.problem, p_has_photos: form.hasPhotos, p_channel: form.channel,
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
          <div style={{ background: "#FF6A13" }} className="w-8 h-8 rounded flex items-center justify-center rotate-[-3deg]"><Wrench size={18} color="#10233B" strokeWidth={2.5} /></div>
          <div>
            <div className="tm-display text-sm tracking-tight leading-none">{business.name.toUpperCase()}</div>
            <div className="text-[10px] tracking-[0.2em] text-white/60 leading-none mt-1">TRADEMATE WORKSPACE</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowNewLead(true)} style={{ background: "#FF6A13" }} className="text-white text-xs font-semibold px-3 py-2 rounded-sm flex items-center gap-1"><Plus size={14} strokeWidth={3} /> New</button>
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
              style={{ color: active ? "#10233B" : "#8b8474", borderBottom: active ? "3px solid #FF6A13" : "3px solid transparent" }}>
              <Icon size={16} strokeWidth={active ? 2.6 : 2} />{t.label}
            </button>
          );
        })}
      </div>

      <div className="p-3 max-w-5xl mx-auto">
        {!loaded && <div className="flex items-center justify-center py-16 text-sm" style={{ color: "#5B6B7D" }}><Loader2 className="animate-spin mr-2" size={16} /> Loading your jobs…</div>}
        {loaded && tab === "inbox" && !selected && <Inbox leads={leads} onSelect={setSelectedId} onNew={() => setShowNewLead(true)} />}
        {loaded && tab === "inbox" && selected && <LeadDetail lead={selected} onBack={() => setSelectedId(null)} onPatch={(p) => patchLead(selected.id, p)} />}
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
  const [area, setArea] = useState(business.area || AREAS[0].name);
  const [services, setServices] = useState(business.services || []);
  const [blurb, setBlurb] = useState(business.blurb || "");
  const [saving, setSaving] = useState(false);
  const toggleService = (s) => setServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const save = async () => {
    setSaving(true);
    const areaObj = AREAS.find((a) => a.name === area);
    await onSave({ area: areaObj.name, lat: areaObj.lat, lng: areaObj.lng, services, blurb });
    setSaving(false);
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
          <Field label="Based near"><select value={area} onChange={(e) => setArea(e.target.value)} className="tm-input">{AREAS.map((a) => <option key={a.name}>{a.name}</option>)}</select></Field>
          <Field label="Services offered"><div className="flex flex-wrap gap-1.5 mt-1">{SERVICES.map((s) => <ServiceChip key={s} label={s} active={services.includes(s)} onClick={() => toggleService(s)} />)}</div></Field>
          <Field label="Short description (optional)"><textarea value={blurb} onChange={(e) => setBlurb(e.target.value)} rows={2} className="tm-input" placeholder="Family-run plumbing business, 15 years serving Galway city & suburbs." /></Field>
          <button onClick={save} disabled={saving} style={{ background: "#FF6A13" }} className="w-full text-white font-semibold py-2.5 rounded-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={16} /> : null} Save profile
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inbox ---------------- */

function Inbox({ leads, onSelect, onNew }) {
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
    <div className="grid gap-3 sm:grid-cols-2">
      {leads.map((lead) => (
        <button key={lead.id} onClick={() => onSelect(lead.id)} className="text-left">
          <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm shadow-sm px-4 py-3 pt-4 relative hover:shadow-md transition">
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
  );
}

/* ---------------- New Lead Modal (internal) ---------------- */

function NewLeadModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", channel: "web", problem: "", hasPhotos: false });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.name && form.phone && form.address && form.problem;

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
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.hasPhotos} onChange={(e) => set("hasPhotos", e.target.checked)} />
            <span className="flex items-center gap-1"><Camera size={14} /> Customer sent photos</span>
          </label>
          <button disabled={!canSubmit || saving} onClick={async () => { setSaving(true); await onCreate(form); setSaving(false); }} style={{ background: canSubmit ? "#FF6A13" : "#d8d0bd" }} className="w-full text-white font-semibold py-2.5 rounded-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Log enquiry
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Lead Detail ---------------- */

function LeadDetail({ lead, onBack, onPatch }) {
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
    } catch (e) {
      setAiError("Couldn't reach the AI just now — you can still fill in the quote manually below.");
    }
    setAiLoading(false);
  };

  const sendAnswer = () => { if (!answerDraft.trim()) return; onPatch({ messages: [...messages, { role: "customer", text: answerDraft, time: new Date().toISOString() }] }); setAnswerDraft(""); };
  const approveQuote = () => onPatch({ quote: quoteDraft, status: "quoted" });
  const confirmBooking = () => { if (!bookingDraft.date || !bookingDraft.time) return; onPatch({ booking: bookingDraft, status: "booked" }); };
  const markComplete = () => { const total = (quoteDraft.labour || 0) + (quoteDraft.callout || 0) + Math.round(((quoteDraft.partsMin || 0) + (quoteDraft.partsMax || 0)) / 2); onPatch({ status: "invoiced", invoice: { total, issuedAt: new Date().toISOString(), paid: false } }); };
  const markPaid = () => onPatch({ status: "paid", invoice: { ...lead.invoice, paid: true, paidAt: new Date().toISOString() } });

  return (
    <div style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #e3dbc8" }}>
        <button onClick={onBack}><ArrowLeft size={18} color="#5B6B7D" /></button>
        <div className="tm-mono text-xs" style={{ color: "#5B6B7D" }}>{lead.job_no}</div>
        <div className="ml-auto"><Stamp status={lead.status} /></div>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <div className="font-semibold">{lead.name} · {lead.phone}</div>
          <div className="text-sm flex items-center gap-1" style={{ color: "#5B6B7D" }}><MapPin size={12} /> {lead.address}</div>
          <div className="mt-1"><ChannelBadge channel={lead.channel} /></div>
          <p className="mt-2 text-sm">{lead.problem}</p>
          {lead.has_photos && <div className="text-xs mt-1 flex items-center gap-1" style={{ color: "#5B6B7D" }}><Camera size={12} /> Photos attached</div>}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>Conversation</div>
          <div className="space-y-2">
            {messages.map((m, i) => (
              <div key={i} className="text-sm px-3 py-2 rounded-sm max-w-[85%]" style={{ background: m.role === "assistant" ? "#FFF1E6" : m.role === "customer" ? "#EEF2F6" : "#F6F1E7", marginLeft: m.role === "customer" ? "auto" : 0 }}>
                <div className="text-[10px] uppercase font-semibold mb-0.5" style={{ color: "#8b8474" }}>{m.role === "assistant" ? "AI (to customer)" : m.role}</div>{m.text}
              </div>
            ))}
            {messages.length === 0 && <p className="text-sm" style={{ color: "#8b8474" }}>No AI assessment yet.</p>}
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

        {quoteDraft && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>Quote</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MoneyField label="Labour" value={quoteDraft.labour} onChange={(v) => setQuoteDraft({ ...quoteDraft, labour: v })} disabled={lead.status !== "new"} />
              <MoneyField label="Call-out" value={quoteDraft.callout} onChange={(v) => setQuoteDraft({ ...quoteDraft, callout: v })} disabled={lead.status !== "new"} />
              <MoneyField label="Parts (min)" value={quoteDraft.partsMin} onChange={(v) => setQuoteDraft({ ...quoteDraft, partsMin: v })} disabled={lead.status !== "new"} />
              <MoneyField label="Parts (max)" value={quoteDraft.partsMax} onChange={(v) => setQuoteDraft({ ...quoteDraft, partsMax: v })} disabled={lead.status !== "new"} />
            </div>
            {lead.status === "new" && <button onClick={approveQuote} style={{ background: "#FF6A13" }} className="mt-3 text-white text-sm font-semibold px-4 py-2 rounded-sm">Approve quote & send</button>}
          </div>
        )}

        {lead.status === "quoted" && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>Book the job</div>
            <div className="flex gap-2">
              <input type="date" value={bookingDraft.date} onChange={(e) => setBookingDraft({ ...bookingDraft, date: e.target.value })} className="border rounded-sm px-2 py-1.5 text-sm" style={{ borderColor: "#e3dbc8" }} />
              <select value={bookingDraft.time} onChange={(e) => setBookingDraft({ ...bookingDraft, time: e.target.value })} className="border rounded-sm px-2 py-1.5 text-sm" style={{ borderColor: "#e3dbc8" }}>
                <option value="">Time slot</option>
                {["08:00–10:00","10:00–12:00","12:00–14:00","14:00–16:00","16:00–18:00"].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={confirmBooking} style={{ background: "#10233B" }} className="mt-3 text-white text-sm font-semibold px-4 py-2 rounded-sm flex items-center gap-1"><CalendarIcon size={14} /> Confirm booking</button>
          </div>
        )}

        {lead.status === "booked" && lead.booking && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-4">
            <div className="text-sm flex items-center gap-2 mb-2"><Clock size={14} /> {lead.booking.date} · {lead.booking.time}</div>
            <button onClick={markComplete} style={{ background: "#FF6A13" }} className="text-white text-sm font-semibold px-4 py-2 rounded-sm flex items-center gap-1"><CheckCircle2 size={14} /> Mark job complete & invoice</button>
          </div>
        )}

        {(lead.status === "invoiced" || lead.status === "paid") && lead.invoice && (
          <div style={{ borderTop: "1px dashed #d8d0bd" }} className="pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#5B6B7D" }}>Invoice</div>
            <div className="tm-mono text-2xl flex items-center gap-1" style={{ color: "#10233B" }}><Euro size={20} />{lead.invoice.total}</div>
            <div className="text-xs mt-1" style={{ color: "#5B6B7D" }}>Issued {new Date(lead.invoice.issuedAt).toLocaleDateString("en-IE")}</div>
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

function CalendarView({ leads }) {
  const booked = leads.filter((l) => l.booking && ["booked", "invoiced", "paid"].includes(l.status));
  const grouped = {};
  booked.forEach((l) => { grouped[l.booking.date] = grouped[l.booking.date] || []; grouped[l.booking.date].push(l); });
  const dates = Object.keys(grouped).sort();
  if (dates.length === 0) return <div className="text-center py-16 text-sm" style={{ color: "#5B6B7D" }}>No jobs booked yet.</div>;
  return (
    <div className="space-y-4">
      {dates.map((date) => (
        <div key={date}>
          <div className="tm-display text-sm mb-2" style={{ color: "#10233B" }}>{new Date(date).toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}</div>
          <div className="space-y-2">
            {grouped[date].sort((a, b) => a.booking.time.localeCompare(b.booking.time)).map((l) => (
              <div key={l.id} style={{ background: "white", border: "1px solid #e3dbc8" }} className="rounded-sm px-3 py-2 flex items-center justify-between">
                <div><div className="text-sm font-semibold">{l.booking.time} · {l.name}</div><div className="text-xs flex items-center gap-1" style={{ color: "#5B6B7D" }}><MapPin size={11} />{l.address}</div></div>
                <Stamp status={l.status} />
              </div>
            ))}
          </div>
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
