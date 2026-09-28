// src/app/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, ShieldCheck, ArrowRight, Lock, Mail } from "lucide-react";


export default function LandingPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleVolunteerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Send credentials to the secure backend
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      // The backend API already set the secure HTTP-only cookie, so just redirect
      router.push("/scanner");
    } else {
      setError(true);
      setPassword("");
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center relative px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 p-8 text-center z-10">
        <div className="mx-auto bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mb-6 border border-indigo-100">
          <QrCode className="w-8 h-8 text-indigo-600" />
        </div>
        
        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">Cloud Nexus</h1>
        <h2 className="text-lg font-semibold text-slate-500 mb-8 tracking-wide">FIRST COMMIT</h2>

        <button
          onClick={() => router.push("/pass")}
          className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-2 group shadow-md"
        >
          Get My Entry Pass
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      <button
        onClick={() => setShowModal(true)}
        className="absolute bottom-6 right-6 bg-slate-200 hover:bg-slate-300 text-slate-600 p-3 rounded-full shadow-lg transition flex items-center justify-center"
      >
        <ShieldCheck className="w-6 h-6" />
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2 text-slate-800 font-bold">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                Volunteer Portal
              </div>
              <button onClick={() => { setShowModal(false); setError(false); }} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button>
            </div>

            <form onSubmit={handleVolunteerLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-black" />
                <input
                  type="email"
                  placeholder="Volunteer Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 text-black border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-black" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl text-black  focus:outline-none ${error ? "border-red-500 bg-red-50" : "border-slate-200 focus:border-indigo-500"}`}
                  required
                />
              </div>
              
              {error && <p className="text-red-500 text-sm text-center font-medium">Invalid credentials</p>}
              
              <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition shadow-md">
                Secure Login
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}