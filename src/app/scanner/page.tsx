"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import { Camera, CheckCircle, AlertTriangle, LogOut, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

// Added ALREADY_SCANNED and PROCESSING to the type definition
type ScanStatus = "SCANNING" | "PROCESSING" | "GRANTED" | "ALREADY_SCANNED" | "INVALID" | "ERROR";

export default function ScannerPage() {
  const router = useRouter();
  const MAX_ENTRIES = parseInt(process.env.NEXT_PUBLIC_MAX_ENTRIES || "3", 10);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  
  const isProcessing = useRef(false); 
  const lastScanned = useRef<{ id: string; time: number }>({ id: "", time: 0 });
  const clearTimer = useRef<NodeJS.Timeout | null>(null);
  
  const [status, setStatus] = useState<ScanStatus>("SCANNING");
  const [studentInfo, setStudentInfo] = useState({ name: "", section: "", count: 0 });
  const [message, setMessage] = useState("");

  // Wrapped in useCallback to prevent stale closures and React 19 strict mode bugs
  const handleVerification = useCallback(async (qrUuid: string) => {
    const now = Date.now();
    if (lastScanned.current.id === qrUuid && (now - lastScanned.current.time) < 3000) return; 
    if (isProcessing.current) return;
    
    isProcessing.current = true;
    lastScanned.current = { id: qrUuid, time: now };
    setStatus("PROCESSING"); // Provide immediate UI feedback during network request
    
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: qrUuid }),
      });

      const result = await response.json();

      if (result.status === "GRANTED") {
        setStudentInfo({ name: result.name, section: result.section, count: result.count });
        setStatus("GRANTED");
        navigator.vibrate?.([100]);
      } else if (result.status === "ALREADY_SCANNED") {
        // Now correctly catching the API's duplicate flag (NEW-03)
        setStudentInfo({ name: result.name || "Unknown", section: result.section || "", count: result.count || 0 });
        setStatus("ALREADY_SCANNED");
        navigator.vibrate?.([200, 100, 200]);
      } else {
        setStatus("INVALID");
        setMessage("INVALID PASS");
        navigator.vibrate?.([200, 100, 200]);
      }
    } catch (error) {
      setStatus("ERROR");
      setMessage("Network Error.");
    } finally {
      isProcessing.current = false;
      
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(() => {
        setStatus("SCANNING");
        setStudentInfo({ name: "", section: "", count: 0 });
        setMessage("");
        lastScanned.current = { id: "", time: 0 }; 
      }, 10000);
    }
  }, [MAX_ENTRIES]);

  useEffect(() => {
    const codeReader = new BrowserQRCodeReader();
    
    const startCamera = async () => {
      try {
        controlsRef.current = await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          async (result) => {
            if (result) await handleVerification(result.getText());
          }
        );
      } catch (err) {
        setStatus("ERROR");
        setMessage("Camera access denied.");
      }
    };
    startCamera();

    return () => { 
      controlsRef.current?.stop(); 
      if (clearTimer.current) clearTimeout(clearTimer.current); // Prevent unmounted state updates
    };
  }, [handleVerification]);

  const handleLogout = async () => {
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

        <div className="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border-4 border-slate-800 shadow-2xl">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          
          {/* Swapped massive box-shadow for a clean CSS border to fix performance (MED-11) */}
          <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none flex items-center justify-center">
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
                  <AlertTriangle className="w-4 h-4" /> Pass Exhausted
                </p>
                <p className="text-orange-600 text-[11px] mt-1 font-medium leading-tight">
                  This student has entered {studentInfo.count} times.
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