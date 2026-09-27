// src/app/pass/page.tsx
"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Image from "next/image"; // MED-06: Fix performance
import { Cloud, Ticket, Loader2, ShieldAlert, LogOut, CheckCircle2, Mail, Phone } from "lucide-react";

interface StudentRecord {
  name: string;
  section: string;
  entry_count: number;
  id?: string;
}

export default function StudentPassPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [appState, setAppState] = useState<"form" | "loading" | "pass">("form");
  const [error, setError] = useState("");
  
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [secureQr, setSecureQr] = useState("");
  
  const MAX_ENTRIES = parseInt(process.env.NEXT_PUBLIC_MAX_ENTRIES || "3", 10);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAppState("loading");

    try {
      const res = await fetch("/api/pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || "Invalid credentials.");

      setStudent(data.student);
      setSecureQr(data.secureQrValue); // Highly secure HMAC string
      setAppState("pass");
    } catch (err: any) {
      setError(err.message);
      setAppState("form");
    }
  };

  const handleLogout = () => {
    setEmail("");
    setPhone("");
    setStudent(null);
    setAppState("form");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      {/* Subtle background glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-sm w-full">
        {/* ── Header ── */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-3 tracking-wide">
            <Cloud size={13} strokeWidth={2.5} />
            CLOUD NEXUS
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
            First Commit
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            October 6th, 2026 · Official Pass Portal
          </p>
        </div>

        {/* ══════════════ FORM STATE ══════════════ */}
        {(appState === "form" || appState === "loading") && (
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/80 border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white">
              <Ticket size={28} strokeWidth={1.8} className="mb-2 opacity-90" />
              <h2 className="text-lg font-bold">Get Your Entry Pass</h2>
              <p className="text-indigo-200 text-xs mt-0.5">
                Enter your registered details to generate your verified QR pass.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wider mb-1.5">
                  Registered Email
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    disabled={appState === "loading"}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 text-black rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition bg-slate-50 placeholder:text-slate-300 disabled:opacity-60"
                    placeholder="student@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-black uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="tel"
                    required
                    value={phone}
                    disabled={appState === "loading"}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 text-black rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition bg-slate-50 placeholder:text-slate-300 disabled:opacity-60"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-600 text-xs text-center bg-red-50 border border-red-200 p-2.5 rounded-xl">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={appState === "loading"}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-70 text-sm shadow-md shadow-indigo-200"
              >
                {appState === "loading" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Verifying Credentials&hellip;
                  </>
                ) : (
                  "Generate Pass →"
                )}
              </button>
            </form>
          </div>
        )}

        {/* ══════════════ PASS STATE ══════════════ */}
        {appState === "pass" && student && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            
            {/* Student Verified Indicator */}
            <div className="w-full mb-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">{student.name}</h3>
                  <p className="text-xs text-slate-500 font-medium">Section: {student.section || "N/A"}</p>
                </div>
              </div>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                VERIFIED
              </span>
            </div>

            {/* Custom Graphical Pass */}
            <div className="relative w-full rounded-2xl shadow-2xl overflow-hidden border border-slate-200 bg-white">
              {/* Pass artwork */}
             <Image
                src="/pass-bg.jpg"
                alt="Cloud Nexus Entry Pass"
                width={400}
                height={600}
                priority
                className={`w-full h-auto block select-none pointer-events-none transition-all duration-300 ${
                  student.entry_count >= MAX_ENTRIES ? "filter grayscale contrast-75 opacity-70" : ""
                }`}
              />

              {/* Responsive Embedded QR Code */}
              <div
                className="absolute flex items-center justify-center bg-white p-1 rounded-sm shadow-sm"
                style={{
                  top: "70.5%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "33.5%",
                  aspectRatio: "1/1",
                }}
              >
               <QRCodeSVG
                    value={secureQr}
                    style={{ width: "100%", height: "100%" }}
                    level="H"
                    fgColor={student.entry_count >= MAX_ENTRIES ? "#64748b" : "#0f172a"}
                />
              </div>

              {/* Scanned Badge Overlay */}
              {student.entry_count >= MAX_ENTRIES && (
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4">
                  <div className="bg-red-600 text-white font-black px-5 py-2 rounded-xl text-center transform -rotate-6 border-2 border-white shadow-2xl">
                    <p className="text-lg tracking-widest uppercase">ALREADY SCANNED</p>
                    <p className="text-[10px] font-medium opacity-90 tracking-normal">Used at Auditorium Door</p>
                  </div>
                </div>
              )}
            </div>

            {student.entry_count > 0 ? (
              <div className="mt-4 w-full flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-xs font-semibold">
                <ShieldAlert size={16} className="shrink-0" />
                This entry pass has already completed door verification.
              </div>
            ) : (
              <p className="text-slate-400 text-xs text-center mt-4 leading-relaxed">
                Take a screenshot of this card to present at entry. <br />
                The QR will be checked against the live registry.
              </p>
            )}

            <button
              onClick={handleLogout}
              className="mt-4 flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-xs font-semibold transition-colors"
            >
              <LogOut size={13} />
              Look up another pass
            </button>
          </div>
        )}

        <p className="text-center text-slate-400 text-xs mt-6">
          Need help? Visit the registration help desk.
        </p>
      </div>
    </div>
  );
}