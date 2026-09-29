// src/app/pass/page.tsx
"use client";

import { useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { Loader2, LogOut , Download  } from "lucide-react";

interface StudentRecord {
  id?: string;
  name: string;
  section: string;
  entry_count: number;
}

export default function StudentPassPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [appState, setAppState] = useState<"form" | "loading" | "pass">("form");
  const [error, setError] = useState("");
  
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [secureQr, setSecureQr] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  
  const passRef = useRef<HTMLDivElement>(null);
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
      setSecureQr(data.secureQrValue);
      setAppState("pass");
    } catch (err: any) {
      setError(err.message);
      setAppState("form");
    }
  };

  const handleDownload = async () => {
    if (!passRef.current || !student) return;
    
    setIsDownloading(true);
    try {
      // Capture the pass with the dark background to respect the rounded corners
      const dataUrl = await toPng(passRef.current, { 
        quality: 1.0,
        pixelRatio: 3, 
        backgroundColor: '#0e0e0e' 
      });
      
      const link = document.createElement("a");
      const safeName = student.name.split(" ")[0].toLowerCase();
      link.download = `cloud-nexus-${safeName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to download pass", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLogout = () => {
    setEmail("");
    setPhone("");
    setStudent(null);
    setAppState("form");
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#e5e2e1] font-sans antialiased flex flex-col items-center justify-center p-4 sm:p-8">
      
      {/* ══════════════ FORM STATE ══════════════ */}
      {(appState === "form" || appState === "loading") && (
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-medium tracking-[0.18em] text-white uppercase">Cloud Nexus</h1>
            <p className="text-[10px] font-mono tracking-[0.25em] text-[#cfc4c5]/70 uppercase mt-2">
              Delegate Portal
            </p>
          </div>

          <div className="bg-[#131313] rounded-3xl border border-white/10 p-6 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[10px] font-mono tracking-wider text-[#cfc4c5]/60 uppercase mb-2">
                  Registered Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  disabled={appState === "loading"}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1c1b1b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30 transition-colors"
                  placeholder="Email ID"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono tracking-wider text-[#cfc4c5]/60 uppercase mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  disabled={appState === "loading"}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#1c1b1b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500  focus:outline-none focus:border-white/30 transition-colors"
                  placeholder="10-digit mobile number"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs text-center bg-red-950/30 border border-red-900/50 p-3 rounded-xl">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={appState === "loading"}
                className="w-full flex items-center justify-center gap-2 bg-[#e5e2e1] text-[#0e0e0e] font-semibold py-3.5 rounded-xl hover:bg-white transition-all disabled:opacity-70 text-sm mt-4"
              >
                {appState === "loading" ? <Loader2 size={16} className="animate-spin" /> : "Access Credential"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ VIP PASS STATE ══════════════ */}
      {appState === "pass" && student && (
        <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 w-full">
          
          {/* passRef captures the Lanyard AND the Card */}
          <div ref={passRef} className="flex flex-col items-center p-4 bg-[#0e0e0e]">
            
            {/* Lanyard Hardware */}
            <aside aria-hidden="true" className="w-full max-w-[370px] flex flex-col items-center pointer-events-none select-none z-20 -mb-2.5">
              <div className="w-12 h-6 bg-gradient-to-b from-[#090909] to-[#1c1c1c] border-x border-white/10 rounded-t-sm shadow-inner" />
              <div className="w-10 h-3 rounded-sm bg-gradient-to-r from-[#2a2a2a] via-[#3a3a3a] to-[#252525] border border-white/20 shadow-md" />
            </aside>

            {/* Badge Card */}
            <main className={`w-full max-w-[370px] aspect-[2/3] bg-[#131313] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_25px_60px_-15px_rgba(0,0,0,0.85)] rounded-[32px] overflow-hidden relative flex flex-col justify-between p-7 select-none transition-all duration-300 ${student.entry_count >= MAX_ENTRIES ? "filter grayscale opacity-80" : ""}`}>
              
              {/* Exhausted Void Overlay */}
              {student.entry_count >= MAX_ENTRIES && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 z-50">
                  <div className="bg-red-600/90 text-white font-black px-6 py-3 rounded-xl text-center transform -rotate-6 border border-red-400 shadow-2xl">
                    <p className="text-xl tracking-[0.2em] uppercase">VOIDED</p>
                    <p className="text-[9px] font-mono opacity-80 tracking-widest mt-1">Credential Exhausted</p>
                  </div>
                </div>
              )}

              {/* Top Region: Lanyard Slot & Brand */}
              <div className="flex flex-col items-center w-full">
                <div aria-hidden="true" className="w-12 h-1.5 rounded-full bg-black/90 border border-white/15 mb-6 shadow-inner" />
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-mono tracking-[0.25em] text-[#cfc4c5]/70 uppercase">Lloyd Institute Of Engineering And Technology</p>
                  <h1 className="text-xl font-medium tracking-[0.18em] text-white uppercase">Cloud Nexus - First Commit</h1>
                </div>
              </div>

              {/* Hero Element: QR Code */}
              <section aria-label="Delegate Credential QR Code" className="flex flex-col items-center justify-center my-auto">
                <div className="bg-white p-3 rounded-[20px] shadow-[0_12px_32px_rgba(0,0,0,0.5)] border border-white flex items-center justify-center">
                  <QRCodeSVG
                    value={secureQr}
                    size={195}
                    level="H"
                    fgColor="#000000"
                    bgColor="#ffffff"
                  />
                </div>
                <p className="mt-4 text-[9px] font-mono tracking-[0.2em] text-[#cfc4c5]/60 uppercase">
                  Scan at Entrance
                </p>
              </section>

              {/* Bottom Region: Metadata */}
              <div className="w-full space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <div>
                    <span className="text-[9px] font-mono tracking-[0.16em] text-[#cfc4c5]/60 uppercase block">Credential</span>
                    {/* First Name Extracted */}
                    <span className="text-xl font-bold text-white uppercase tracking-wider block mt-1">
                      {student.name.split(" ")[0]}
                    </span>
                  </div>
                  <div className="text-right">
                    {/* Old Code Section Data Injected Here */}
                    <span className="text-[9px] font-mono tracking-[0.16em] text-[#cfc4c5]/60 uppercase block">Section</span>
                    <span className="text-xs font-medium text-emerald-400 uppercase tracking-widest block mt-1">
                      {student.section || "VIP"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-left pt-0.5">
                  <div>
                    <span className="text-[8.5px] font-mono tracking-wider text-[#cfc4c5]/50 uppercase block">Date</span>
                    <span className="text-[12px] font-medium text-white block mt-0.5">6 Oct 2026</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-mono tracking-wider text-[#cfc4c5]/50 uppercase block">Time</span>
                    <span className="text-[12px] font-medium text-white block mt-0.5">09:30 AM</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] font-mono tracking-wider text-[#cfc4c5]/50 uppercase block">Venue</span>
                    <span className="text-[12px] font-medium text-white block mt-0.5 truncate">Auditorium</span>
                  </div>
                </div>
              </div>

            </main>
          </div>

          {/* Action Buttons */}
         <div className="flex flex-col items-center space-y-5 pt-8 w-full max-w-xs mx-auto">
            {student.entry_count < MAX_ENTRIES && (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="group w-full py-4 px-6 bg-white text-[#313030] rounded-lg flex items-center justify-center space-x-2 transition-all duration-300 hover:opacity-70 active:scale-[0.99] disabled:opacity-50 shadow-md"
              >
                <span className="text-[11px] uppercase tracking-widest font-bold">
                  {isDownloading ? "Saving Image..." : "Download Pass"}
                </span>
                {isDownloading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} className="transition-transform duration-300 group-hover:translate-y-0.5" />
                )}
              </button>
            )}

            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 text-[#cfc4c5]/40 hover:text-[#e5e2e1] text-[10px] tracking-widest uppercase transition-colors"
              >
                <LogOut size={12} />
                <span>Exit Portal</span>
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}