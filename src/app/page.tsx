// src/app/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, ArrowRight, Loader2 } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleVolunteerAccess = async () => {
    try {
      const res = await fetch('/api/auth');
      const data = await res.json();
      
      if (data.isLoggedIn) {
        router.push('/scanner'); 
      } else {
        setShowModal(true); 
      }
    } catch (err) {
      setShowModal(true); 
    }
  };

  const handleVolunteerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setError(false);
    
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        router.push("/scanner");
      } else {
        setError(true);
        setPassword("");
        setTimeout(() => setError(false), 2000);
      }
    } catch (err) {
      // Safely catch offline/network failures
      setError(true);
      setPassword("");
      setTimeout(() => setError(false), 2000);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1] font-sans antialiased flex flex-col items-center justify-center relative px-4">
      
      <div className="w-full max-w-sm flex flex-col items-center z-10">
        <div className="flex flex-col items-center text-center space-y-1 mb-10">
          <h1 className="text-4xl tracking-tight text-[#e5e2e1] font-light">
            Cloud Nexus
          </h1>
          <p className="text-sm text-[#cfc4c5] font-light tracking-wide pt-1">
            First Commit
          </p>
        </div>

        <button
          onClick={() => router.push("/pass")}
          className="group w-full max-w-[280px] py-4 px-6 bg-[#e5e2e1] text-[#313030] rounded-lg flex items-center justify-center space-x-2 transition-all duration-300 hover:opacity-90 active:scale-[0.99] shadow-md"
        >
          <span className="text-[11px] uppercase tracking-widest font-bold">Get My Entry Pass</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </div>

      <button
        onClick={handleVolunteerAccess}
        className="absolute bottom-6 w-20 h-20 right-6 bg-[#1c1b1b] hover:bg-[#252525] border border-white/10 text-[#cfc4c5] hover:text-white p-3.5 rounded-full shadow-lg transition-all duration-200 active:scale-110 flex items-center justify-center group"
        aria-label="Volunteer Scanner Access"
      >
        <ScanLine className="w-10 h-10 group-hover:scale-110 transition-transform duration-300" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#131313] rounded-3xl border border-white/10 p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-[#e5e2e1] font-medium tracking-wide">
                <ScanLine className="w-5 h-5 text-[#c6c6c6]" />
                <span className="text-sm uppercase tracking-widest">Scanner Portal</span>
              </div>
              <button 
                onClick={() => { setShowModal(false); setError(false); }} 
                className="text-[#cfc4c5]/50 hover:text-white transition-colors text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleVolunteerLogin} className="space-y-5">
              <div>
                <label className="block text-[10px] font-mono tracking-wider text-[#cfc4c5]/60 uppercase mb-2">
                  Volunteer_ID
                </label>
                <input
                  type="email"
                  required
                  disabled={isAuthenticating}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1c1b1b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50"
                  placeholder="Vol_Id"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono tracking-wider text-[#cfc4c5]/60 uppercase mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  disabled={isAuthenticating}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1c1b1b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50"
                  placeholder="pass"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs text-center bg-red-950/30 border border-red-900/50 p-3 rounded-xl">
                  Invalid credentials or offline
                </p>
              )}

              <button 
                type="submit" 
                disabled={isAuthenticating}
                className="w-full flex items-center justify-center gap-2 bg-[#e5e2e1] text-[#0e0e0e] font-semibold py-3.5 rounded-xl hover:bg-white transition-all active:scale-[0.99] disabled:opacity-70 text-sm mt-4 shadow-md"
              >
                {isAuthenticating ? <Loader2 size={16} className="animate-spin" /> : "Authenticate"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}