// src/app/scanner/page.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { Camera, CheckCircle, AlertTriangle, LogOut, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type ScanStatus = "SCANNING" | "PROCESSING" | "GRANTED" | "ALREADY_SCANNED" | "INVALID" | "ERROR";

export default function ScannerPage() {
  const router = useRouter();
  const MAX_ENTRIES = parseInt(process.env.NEXT_PUBLIC_MAX_ENTRIES || "3", 10);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  
  const isProcessing = useRef(false); 
  const lastScanned = useRef<{ id: string; time: number }>({ id: "", time: 0 });
  const clearTimer = useRef<number | null>(null);
  
  const [status, setStatus] = useState<ScanStatus>("SCANNING");
  const [studentInfo, setStudentInfo] = useState({ name: "", section: "", count: 0 });
  const [message, setMessage] = useState("");

   const playFeedback = useCallback((type: "success" | "error") => {
    // 1. Try to vibrate (Works on Android)
    if (type === "success") navigator.vibrate?.([100]);
    else navigator.vibrate?.([200, 100, 200]);

    // 2. Play Audio Beep (Works on iOS & Android)
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0.1; // Volume

      if (type === "success") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, ctx.currentTime); // High pitch beep
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = "square";
        osc.frequency.setValueAtTime(300, ctx.currentTime); // Low pitch error buzz
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (err) {
      console.error("Audio feedback failed");
    }
  }, []);


  const handleVerification = useCallback(async (qrUuid: string) => {
    const now = Date.now();
    
    // Anti-spam lock
    if (lastScanned.current.id === qrUuid && (now - lastScanned.current.time) < 3000) return; 
    if (isProcessing.current) return;
    
    isProcessing.current = true;
    lastScanned.current = { id: qrUuid, time: now };
    setStatus("PROCESSING");
    
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: qrUuid }),
      });

      const result = await response.json();

     if (result.status === "GRANTED") {
        setStudentInfo({ name: result.name, section: result.section, count: result.count });
        
        if (result.count > MAX_ENTRIES) {
          setStatus("ALREADY_SCANNED");
          playFeedback("error"); // <--- Replaced vibration
        } else {
          setStatus("GRANTED");
          playFeedback("success"); // <--- Replaced vibration
        }
      } else {
        setStatus("INVALID");
        setMessage(result.message || "INVALID PASS");
        playFeedback("error"); // <--- Replaced vibration
      }
    } catch (error) {
      setStatus("ERROR");
      setMessage("Network Error.");
    } finally {
      isProcessing.current = false;
      
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      
      clearTimer.current = window.setTimeout(() => {
        setStatus("SCANNING");
        setStudentInfo({ name: "", section: "", count: 0 });
        setMessage("");
        lastScanned.current = { id: "", time: 0 }; 
      }, 10000); 
    }
  }, [MAX_ENTRIES]);

  useEffect(() => {
    let isUnmounted = false; // Track if the user leaves while the camera is loading
    const codeReader = new BrowserQRCodeReader();
    
    const startCamera = async () => {
      try {
        const controls = await codeReader.decodeFromConstraints(
          {
            audio: false,
            video: { facingMode: "environment" },
          },
          videoRef.current!,
          async (result) => {
            if (result) await handleVerification(result.getText());
          }
        );

        // RACE CONDITION CATCHER: If the user left the page while the camera 
        // was starting up, kill the hardware immediately and abort.
        if (isUnmounted) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
      } catch (err: any) {
        if (!isUnmounted) {
          console.error("Camera hardware error:", err);
          setStatus("ERROR");
          setMessage(err?.name === 'NotAllowedError' ? "Permission Blocked by OS" : "Hardware Not Supported");
        }
      }
    };
    
    startCamera();

    return () => { 
      isUnmounted = true; // Mark the component as dead

      // 1. Stop the ZXing Scanner
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      
      // 2. Hard-kill the physical camera tracks
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // 3. Clear the UI timers
      if (clearTimer.current) window.clearTimeout(clearTimer.current); 
    };
  }, [handleVerification]);

const handleLogout = async () => {
    // 1. Proactively kill the camera before changing pages
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

    // 2. Process logout
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  const getBgColor = () => {
    if (status === "GRANTED") return "bg-green-600";
    if (status === "ALREADY_SCANNED") return "bg-orange-600";
    if (status === "INVALID" || status === "ERROR") return "bg-red-600";
    return "bg-slate-900"; 
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300 ${getBgColor()}`}>
      <div className="w-full max-w-md flex flex-col items-center space-y-6">
        
        <div className="text-white text-center w-full flex justify-between items-center px-2">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-left">SCANNER</h1>
            <p className="text-xs opacity-80 text-left">First Commit</p>
          </div>
          <button onClick={handleLogout} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition">
            <LogOut className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border-[15px] sm:border-[30px] border-black/50 shadow-2xl">
          {/* Added autoPlay per mobile requirements */}
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
          
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {(status === "SCANNING" || status === "PROCESSING") && (
              <div className="w-full h-0.5 bg-blue-500 animate-[pulse_1s_ease-in-out_infinite] shadow-[0_0_8px_2px_rgba(59,130,246,0.5)]" />
            )}
          </div>
        </div>

        <div className="w-full bg-white rounded-xl p-6 shadow-xl text-center min-h-[220px] flex flex-col items-center justify-center transition-all">
          
          {status === "SCANNING" && (
             <div className="flex flex-col items-center text-slate-500">
               <Camera className="w-10 h-10 mb-2 animate-pulse" />
               <p className="font-semibold tracking-widest text-sm">POINT AT QR CODE</p>
             </div>
          )}

          {status === "PROCESSING" && (
             <div className="flex flex-col items-center text-blue-600">
               <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
               <p className="font-bold tracking-widest text-sm">VERIFYING...</p>
             </div>
          )}

          {status === "GRANTED" && (
            <div className="flex flex-col items-center w-full">
              <CheckCircle className="w-10 h-10 mb-2 text-green-600" />
              <h2 className="text-2xl font-black text-slate-900">{studentInfo.name}</h2>
              <p className="text-base font-bold text-slate-600">Section: {studentInfo.section}</p>
              <div className="mt-3 px-4 py-1.5 rounded-full text-sm font-bold border-2 bg-green-100 text-green-700 border-green-300">
                {studentInfo.count}/{MAX_ENTRIES} Entries
              </div>
            </div>
          )}

          {status === "ALREADY_SCANNED" && (
            <div className="flex flex-col items-center w-full">
              <XCircle className="w-10 h-10 mb-2 text-orange-600" />
              <h2 className="text-2xl font-black text-slate-900">{studentInfo.name}</h2>
              <p className="text-base font-bold text-slate-600">Section: {studentInfo.section}</p>
              
              <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg w-full">
                <p className="text-orange-700 text-xs font-bold uppercase flex items-center justify-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Limit Exceeded
                </p>
                <p className="text-orange-600 text-[11px] mt-1 font-medium leading-tight">
                  This student has entered {studentInfo.count} times. (Max: {MAX_ENTRIES})
                </p>
              </div>
            </div>
          )}

          {(status === "INVALID" || status === "ERROR") && (
            <div className="flex flex-col items-center text-red-600 w-full">
              <AlertTriangle className="w-12 h-12 mb-2" />
              <h2 className="text-xl font-black">{message}</h2>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}