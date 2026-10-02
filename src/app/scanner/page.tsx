// src/app/scanner/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { useRouter } from "next/navigation";
import { 
  LogOut, 
  QrCode, 
  Loader2, 
  CheckCircle2, 
  ShieldAlert, 
  XCircle 
} from "lucide-react";

export default function ScannerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const clearTimer = useRef<number | null>(null);

  const [status, setStatus] = useState<"SCANNING" | "PROCESSING" | "GRANTED" | "ALREADY_SCANNED" | "INVALID" | "ERROR">("SCANNING");
  const [studentInfo, setStudentInfo] = useState({ name: "", section: "", count: 0 });
  const [message, setMessage] = useState("");
  const MAX_ENTRIES = parseInt(process.env.NEXT_PUBLIC_MAX_ENTRIES || "3", 10);

  // ── Continuous Scanning & Audio Refs ──
  const isProcessing = useRef(false); 
  const lastScanned = useRef<{ id: string; time: number }>({ id: "", time: 0 });
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── 1. IOS Safari Audio Unlocker ──
  useEffect(() => {
    const initAudio = () => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext && !audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };

    document.addEventListener('touchstart', initAudio, { once: true });
    document.addEventListener('click', initAudio, { once: true });
    
    return () => {
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('click', initAudio);
    };
  }, []);

  // ── 2. Hardware Feedback (Soft Beeps & Vibes) ──
  const playFeedback = useCallback(async (type: "success" | "error") => {
    if (type === "success") navigator.vibrate?.([100]);
    else navigator.vibrate?.([200, 100, 200]);

    const ctx = audioCtxRef.current;
    if (!ctx) return;

    try {
      if (ctx.state === "suspended") await ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 1.0;

      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (err) {
      console.error("Audio feedback failed", err);
    }
  }, []);

  // ── 3. Continuous Verification Logic ──
  const handleVerification = useCallback(async (qrData: string) => {
    const now = Date.now();
    
    // Anti-Spam: Block the EXACT same pass from firing rapidly within 3 seconds
    if (lastScanned.current.id === qrData && (now - lastScanned.current.time) < 3000) return; 
    // Network Lock: Block overlapping API calls
    if (isProcessing.current) return;
    
    isProcessing.current = true;
    lastScanned.current = { id: qrData, time: now };
    
    // Clear any active UI reset timers because a new scan just happened!
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    
    setStatus("PROCESSING");

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrData }),
      });
      
      if (res.status === 401) {
        setStatus("ERROR");
        setMessage("SESSION EXPIRED. LOGGING OUT...");
        playFeedback("error");
        setTimeout(() => {
          handleLogout();
        }, 2000); // Give them 2 seconds to read the message before routing
        return; 
      }

      const result = await res.json();

      if (result.status === "GRANTED") {
        setStudentInfo({ name: result.name, section: result.section, count: result.count });
        if (result.count > MAX_ENTRIES) {
          setStatus("ALREADY_SCANNED");
          playFeedback("error");
        } else {
          setStatus("GRANTED");
          playFeedback("success");
        }
      } else if (result.status === "ALREADY_SCANNED") {
        setStudentInfo({
          name: result.name || "Delegate",
          section: result.section || "",
          count: result.count || MAX_ENTRIES,
        });
        setStatus("ALREADY_SCANNED");
        playFeedback("error");
      } else {
        setStatus("INVALID");
        setMessage(result.message || "INVALID PASS");
        playFeedback("error");
      }
    } catch (err) {
      setStatus("ERROR");
      setMessage("Network Error");
      playFeedback("error");
    } finally {
      isProcessing.current = false;
      

      clearTimer.current = window.setTimeout(() => {
        setStatus("SCANNING");
        setStudentInfo({ name: "", section: "", count: 0 });
        setMessage("");
        lastScanned.current = { id: "", time: 0 }; 
      }, 5000); 
    }
  }, [MAX_ENTRIES, playFeedback]);

  // ── 4. Always-On Camera Initialization ──
  useEffect(() => {
    let isUnmounted = false;
    const codeReader = new BrowserQRCodeReader();
    
    const startCamera = async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
      if (isUnmounted) return;

      try {
        const controls = await codeReader.decodeFromConstraints(
          {
            audio: false,
            video: { 
              facingMode: "environment",
              width: { ideal: 720 },
              height: { ideal: 720 }
            },
          },
          videoRef.current!,
          async (result) => {

            if (result) {
              await handleVerification(result.getText());
            }
          }
        );

        if (isUnmounted) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (err: any) {
        if (!isUnmounted) {
          if (err?.name === 'AbortError' || String(err).includes('AbortError')) return;
          console.error("Camera hardware error:", err);
          setStatus("ERROR");
          setMessage(err?.name === 'NotAllowedError' ? "Permission Blocked" : "Hardware Error");
        }
      }
    };
    
    startCamera();

    return () => { 
      isUnmounted = true;
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (clearTimer.current) window.clearTimeout(clearTimer.current); 
    };
  }, [handleVerification]);

  const handleLogout = async () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  return (
    <div className="bg-[#0b0b0d] text-zinc-100 font-sans antialiased min-h-screen flex flex-col justify-center items-center p-0 selection:bg-sky-500/20">
      
      {/* Dynamic Styles for Laser & Pulse */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes laserSweep {
          0% { top: 6%; opacity: 0.2; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 94%; opacity: 0.2; }
        }
        .animate-laser { animation: laserSweep 2.8s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate; }
        @keyframes pulseSoft {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.96); }
        }
        .pulse-status { animation: pulseSoft 2.4s ease-in-out infinite; }
        .reticle-corner { position: absolute; width: 22px; height: 22px; border-color: rgba(255, 255, 255, 0.85); pointer-events: none; z-index: 20; }
      `}} />

      {/* Mobile Device Wrapper */}
      <div className="w-full max-w-[420px] min-h-screen bg-[#0b0b0d] flex flex-col justify-between px-5 pt-10 pb-8 relative overflow-hidden border-x border-white/[0.04] shadow-2xl">
        
        {/* Header */}
        <header className="w-full flex items-center justify-between pt-1 pb-4">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold tracking-[0.18em] uppercase text-white leading-none">
                SCANNER
              </h1>
             
            </div>
            <p className="text-xs text-zinc-400 font-normal tracking-wide">
              Cloud Nexus · First Commit
            </p>
          </div>
          <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-[#1b1b1f] hover:bg-[#242429] border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors duration-150 active:scale-95">
            <LogOut className="w-4 h-4" strokeWidth={2.2} />
          </button>
        </header>

        <div className="flex flex-col w-full flex-1 justify-center -mt-2">
          {/* Viewfinder Section */}
          <main className="w-full flex flex-col items-center justify-center py-2">
            <div className="relative w-full aspect-square rounded-3xl bg-[#141417] p-3.5 border border-white/[0.08] shadow-[0_12px_48px_rgba(0,0,0,0.7)] flex items-center justify-center overflow-hidden">
            <div className="relative w-full h-full rounded-2xl bg-black overflow-hidden flex items-center justify-center border border-white/[0.06]">
              
              {/* Native Hardware Feed */}
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover z-0" playsInline muted autoPlay />
              
              {/* Optical Vignette & Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_60%,rgba(0,0,0,0.9)_100%)] pointer-events-none z-10"></div>
              <div className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] z-10"></div>

              {/* Targeting Reticle */}
              <div className="relative w-[98%] h-[98%] flex items-center justify-center z-20">
                <span className="reticle-corner top-0 left-0 border-t-2 border-l-2 rounded-tl-sm"></span>
                <span className="reticle-corner top-0 right-0 border-t-2 border-r-2 rounded-tr-sm"></span>
                <span className="reticle-corner bottom-0 left-0 border-b-2 border-l-2 rounded-bl-sm"></span>
                <span className="reticle-corner bottom-0 right-0 border-b-2 border-r-2 rounded-br-sm"></span>
                
                <div className="absolute inset-2 border border-dashed border-white/10 rounded-lg"></div>

                {/* Animated Laser (Only during active scanning) */}
                {(status === "SCANNING" || status === "PROCESSING") && (
                  <div className="absolute inset-x-1 animate-laser z-20 pointer-events-none">
                    <div className="w-full h-3 bg-gradient-to-b from-sky-400/25 via-sky-400/10 to-transparent blur-sm"></div>
                    <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-sky-300 to-transparent shadow-[0_0_10px_#38bdf8]"></div>
                  </div>
                )}
                
                <div className="w-3 h-3 border-t border-l border-white/20"></div>
              </div>

            </div>
          </div>
        </main>

        {/* Dynamic Action Card */}
        <footer className="w-full mt-4 min-h-[180px]">
          <div className="w-full h-full bg-white text-zinc-950 rounded-2xl p-5 shadow-[0_20px_40px_rgba(0,0,0,0.85)] flex flex-col items-center justify-center text-center transition-all duration-300">
            
            {status === "SCANNING" && (
              <>
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-800 mb-3 shadow-inner">
                  <QrCode className="w-6 h-6" strokeWidth={1.8} />
                </div>
                <h2 className="text-xs uppercase font-extrabold tracking-widest text-zinc-900 mb-1.5">POINT AT QR CODE</h2>
                <p className="text-xs text-zinc-500 font-medium">Hold steady to scan the Cloud Nexus badge.</p>
              </>
            )}

            {status === "PROCESSING" && (
              <>
                <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center text-sky-600 mb-3 shadow-inner">
                  <Loader2 className="w-6 h-6 animate-spin" strokeWidth={2} />
                </div>
                <h2 className="text-xs uppercase font-extrabold tracking-widest text-sky-700 mb-1.5">VERIFYING...</h2>
                <p className="text-xs text-zinc-500 font-medium">Checking cryptographic signature.</p>
              </>
            )}

            {status === "GRANTED" && (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3 shadow-inner">
                  <CheckCircle2 className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <h2 className="text-lg font-black text-zinc-900 uppercase tracking-wide leading-none mb-1">{studentInfo.name}</h2>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest mb-3">SEC: {studentInfo.section}</p>
                <div className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-[11px] font-bold uppercase tracking-wider">
                  {studentInfo.count} / {MAX_ENTRIES} Entries Logged
                </div>
              </>
            )}

            {status === "ALREADY_SCANNED" && (
              <>
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-3 shadow-inner">
                  <ShieldAlert className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <h2 className="text-lg font-black text-zinc-900 uppercase tracking-wide leading-none mb-1">{studentInfo.name}</h2>
                <div className="px-3 py-1 bg-[#93000a] text-white rounded-md text-[11px] font-black uppercase tracking-widest mt-2 mb-2">
                  VOIDED / EXHAUSTED
                </div>
                <p className="text-xs text-zinc-500 font-medium">Entered {studentInfo.count} times. (Max: {MAX_ENTRIES})</p>
              </>
            )}

            {(status === "INVALID" || status === "ERROR") && (
              <>
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-3 shadow-inner">
                  <XCircle className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <h2 className="text-sm uppercase font-extrabold tracking-widest text-red-600 mb-1.5">{message}</h2>
                <p className="text-xs text-zinc-500 font-medium">Please direct delegate to the help desk.</p>
              </>
            )}

          </div>
        </footer>
        </div>
      </div>
    </div>
  );
}