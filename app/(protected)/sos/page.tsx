"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// ── Types ──────────────────────────────────────────────────────────────────────
interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

interface NearbyPlace {
  id: number;
  lat: number;
  lon: number;
  name: string;
  type: "police" | "hospital" | "clinic";
  distance: number; // metres
}

// ── Haversine distance ─────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Format seconds → m:ss ──────────────────────────────────────────────────────
function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ── Initials helper ────────────────────────────────────────────────────────────
function initials(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "#7c6af7", "#c7bfff", "#dc2626", "#16a34a", "#d97706", "#0284c7",
];

export default function Page() {
  const { user } = useAuth();

  // ── Mount guard (prevents SSR/prerender mismatch in static export) ───────────
  const [mounted, setMounted] = useState(false);

  // ── Core toggle ───────────────────────────────────────────────────────────────
  const [sosActive, setSosActive] = useState(false);
  const [activating, setActivating] = useState(false);

  // ── Timer ─────────────────────────────────────────────────────────────────────
  const [activeSeconds, setActiveSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── GPS ───────────────────────────────────────────────────────────────────────
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [gpsError, setGpsError] = useState<string>("");
  const watchIdRef = useRef<number | null>(null);

  // ── Nearby ────────────────────────────────────────────────────────────────────
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [fetchingNearby, setFetchingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState(false);

  // ── Audio ─────────────────────────────────────────────────────────────────────
  const [audioActive, setAudioActive] = useState(false);
  const [audioError, setAudioError] = useState<string>("");
  const [audioSeconds, setAudioSeconds] = useState(0);
  const [audioBars, setAudioBars] = useState<number[]>(Array(20).fill(3));
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Contacts ──────────────────────────────────────────────────────────────────
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [alertsSent, setAlertsSent] = useState(false);

  // ── False alarm confirm ───────────────────────────────────────────────────────
  const [showFalseAlarmConfirm, setShowFalseAlarmConfirm] = useState(false);

  // ── Mount effect (must be first) ──────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ── Load contacts ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadingContacts(true);
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setContacts(
            Array.isArray(data.emergencyContacts) ? data.emergencyContacts : []
          );
        } else {
          setContacts([]);
        }
      } catch {
        toast.error("Failed to load emergency contacts.");
      } finally {
        setLoadingContacts(false);
      }
    };
    load();
  }, [user]);

  // ── Reverse geocode ───────────────────────────────────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      const a = data.address ?? {};
      const parts = [
        a.road ?? a.suburb,
        a.city ?? a.town ?? a.village ?? a.district,
        a.state,
        "India",
      ].filter(Boolean);
      setAddress(parts.join(", "));
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    }
  }, []);

  // ── Fetch nearby emergency services ──────────────────────────────────────────
  const fetchNearby = useCallback(async (lat: number, lon: number) => {
    setFetchingNearby(true);
    setNearbyError(false);
    try {
      const query = `[out:json][timeout:25];(node["amenity"="hospital"](around:3000,${lat},${lon});node["amenity"="police"](around:3000,${lat},${lon});node["amenity"="clinic"](around:3000,${lat},${lon}););out body;`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query,
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      const data = await res.json();
      const places: NearbyPlace[] = (data.elements ?? [])
        .filter((e: any) => e.lat && e.lon)
        .map((e: any) => ({
          id: e.id,
          lat: e.lat,
          lon: e.lon,
          name: e.tags?.name ?? (e.tags?.amenity === "police" ? "Police Station" : e.tags?.amenity === "hospital" ? "Hospital" : "Clinic"),
          type: e.tags?.amenity as "police" | "hospital" | "clinic",
          distance: haversine(lat, lon, e.lat, e.lon),
        }))
        .sort((a: NearbyPlace, b: NearbyPlace) => a.distance - b.distance)
        .slice(0, 8);
      setNearbyPlaces(places);
    } catch (err) {
      console.error("[SOS] Overpass fetch failed:", err);
      setNearbyError(true);
    } finally {
      setFetchingNearby(false);
    }
  }, []);

  // ── Start GPS watch ───────────────────────────────────────────────────────────
  const startGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    // Don't start a second watch if one is already running
    if (watchIdRef.current !== null) return;
    setGpsError("");
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setCoords({ lat, lng, accuracy });
        reverseGeocode(lat, lng);
        fetchNearby(lat, lng);
      },
      (err) => {
        if (err.code === 1) {
          setGpsError("Location access denied.");
        } else {
          setGpsError("Could not acquire location.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, [reverseGeocode, fetchNearby]);

  // ── Auto-start GPS on mount ───────────────────────────────────────────────────
  useEffect(() => {
    startGPS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Start audio recording ──────────────────────────────────────────────────────
  const startAudio = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setAudioError("Audio recording not supported in your browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(1000);
      setAudioActive(true);
      setAudioSeconds(0);

      // Timer
      audioTimerRef.current = setInterval(() => {
        setAudioSeconds((s) => s + 1);
      }, 1000);

      // Waveform visualizer
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const drawBars = () => {
        const buf = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buf);
        const bars = Array.from({ length: 20 }, (_, i) => {
          const val = buf[Math.floor((i * buf.length) / 20)] ?? 0;
          return Math.max(3, Math.round((val / 255) * 40));
        });
        setAudioBars(bars);
        animFrameRef.current = requestAnimationFrame(drawBars);
      };
      drawBars();
    } catch {
      setAudioError("Microphone access denied — audio evidence unavailable.");
    }
  }, []);

  // ── Stop audio recording ───────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
      };
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setAudioActive(false);
    setAudioBars(Array(20).fill(3));
  }, []);

  // ── Download audio ────────────────────────────────────────────────────────────
  const downloadAudio = useCallback(() => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saveher-sos-audio-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [audioBlob]);

  // ── Send alerts to contacts ───────────────────────────────────────────────────
  const sendAlerts = useCallback(() => {
    if (!contacts.length) return;
    const lat = coords?.lat;
    const lon = coords?.lng;
    const mapUrl = lat && lon ? `https://www.google.com/maps?q=${lat},${lon}` : "";
    const locationStr = address || (lat ? `${lat.toFixed(5)}, ${lon?.toFixed(5)}` : "Unknown location");
    const userName = user?.displayName ?? user?.email ?? "A SaveHer AI user";

    contacts.forEach((c) => {
      const body = `${c.name}, ${userName} needs immediate help!\n\n📍 Location: ${locationStr}\n🗺️ Live Map: ${mapUrl}\n\nPlease call them immediately.\nThis alert was sent via SaveHer AI Safety Platform.`;
      window.open(
        `https://wa.me/${c.phone.replace(/\D/g, "")}?text=${encodeURIComponent(body)}`,
        "_blank"
      );
    });

    setAlertsSent(true);
    toast.success("WhatsApp alert opened for all contacts. Please send them.", { duration: 6000 });
  }, [contacts, coords, address, user]);

  // ── ACTIVATE SOS ─────────────────────────────────────────────────────────────
  const handleSOS = async () => {
    if (activating || sosActive) return;
    setActivating(true);
    try {
      toast.loading("Activating emergency mode…", { id: "sos-activate" });
      startGPS();
      await startAudio();
      sendAlerts();
      setSosActive(true);
      setActiveSeconds(0);
      timerRef.current = setInterval(() => setActiveSeconds((s) => s + 1), 1000);
      toast.success("SOS ACTIVE — Stay on the line!", { id: "sos-activate", duration: 5000 });
    } catch {
      toast.error("SOS activation failed. Try again.", { id: "sos-activate" });
    } finally {
      setActivating(false);
    }
  };

  // ── CANCEL SOS ────────────────────────────────────────────────────────────────
  const handleFalseAlarm = () => {
    if (!sosActive) { window.location.href = '/'; return; }
    setShowFalseAlarmConfirm(true);
  };

  const confirmFalseAlarm = () => {
    stopAudio();
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setSosActive(false);
    setAlertsSent(false);
    setActiveSeconds(0);
    setNearbyPlaces([]);
    setShowFalseAlarmConfirm(false);
    toast.success("Alert cancelled. Stay safe. 💜", { duration: 5000 });
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioTimerRef.current) clearInterval(audioTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ── Map URLs ──────────────────────────────────────────────────────────────────
  // OSM embed — no API key required
  const osmEmbedUrl = coords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.01},${coords.lat - 0.01},${coords.lng + 0.01},${coords.lat + 0.01}&layer=mapnik&marker=${coords.lat},${coords.lng}`
    : null;
  const googleMapsUrl = coords
    ? `https://www.google.com/maps?q=${coords.lat},${coords.lng}`
    : null;

  if (!mounted) return null;

  return (
    <>
      {/* ── False alarm confirm overlay ── */}
      {showFalseAlarmConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center px-6">
          <div className="bg-[#1a1a22] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <span className="material-symbols-outlined text-[#dc2626] text-5xl mb-4 block">warning</span>
            <h2 className="text-xl font-extrabold text-white mb-2">Cancel Emergency?</h2>
            <p className="text-white/60 text-sm mb-8">Are you sure this is a false alarm? All active recording and GPS tracking will stop.</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowFalseAlarmConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 font-bold text-sm hover:bg-white/5 transition-colors"
              >
                Stay Active
              </button>
              <button
                onClick={confirmFalseAlarm}
                className="flex-1 py-3 rounded-xl bg-[#dc2626] text-white font-bold text-sm active:scale-95 transition-transform"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="fixed top-0 w-full z-50 bg-[#0a0a0f]/60 backdrop-blur-3xl shadow-[0_0_40px_rgba(199,191,255,0.06)]">
        <div className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
          <Link href="/" className="text-xl font-extrabold tracking-tighter text-white">SaveHer AI</Link>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-all ${sosActive ? "bg-[#dc2626] shadow-[0_0_8px_#dc2626] animate-pulse" : "bg-white/20"}`} />
            <span className={`font-semibold text-sm tracking-tight uppercase transition-colors ${sosActive ? "text-[#dc2626]" : "text-white/40"}`}>
              {sosActive ? `Emergency Active · ${fmtTime(activeSeconds)}` : "Standby"}
            </span>
          </div>
          <button
            onClick={handleFalseAlarm}
            className="text-white/60 hover:text-white transition-colors font-semibold text-sm"
          >
            {sosActive ? "False Alarm" : "Cancel"}
          </button>
        </div>
      </header>

      <main className="flex-grow pt-24 pb-56 md:pb-40 px-4 sm:px-6 max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start overflow-hidden">

        {/* ── Left: SOS button + audio status ── */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center py-12">
          <div className="relative flex items-center justify-center mb-16">
            <div className={`sos-ring-outer absolute w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] rounded-full border border-[#dc2626]/20 ${sosActive ? "animate-ping opacity-20" : "opacity-10"}`} />
            <div className={`sos-ring-inner absolute w-[160px] h-[160px] sm:w-[240px] sm:h-[240px] rounded-full border border-[#dc2626]/40 ${sosActive ? "animate-pulse opacity-30" : "opacity-10"}`} />

            <button
              onClick={handleSOS}
              disabled={activating || sosActive}
              className="relative z-10 w-36 h-36 sm:w-48 sm:h-48 rounded-full bg-[#dc2626] flex flex-col items-center justify-center active:scale-95 transition-transform duration-200 shadow-[0_0_60px_rgba(220,38,36,0.4)] disabled:opacity-70 select-none"
            >
              {activating ? (
                <>
                  <span className="w-8 h-8 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                  <span className="text-white font-bold text-[10px] uppercase tracking-widest mt-2">Activating…</span>
                </>
              ) : sosActive ? (
                <>
                  <span className="text-white font-extrabold text-4xl tracking-tighter">SOS</span>
                  <span className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-1">Active</span>
                </>
              ) : (
                <span className="text-white font-extrabold text-5xl tracking-tighter">SOS</span>
              )}
            </button>
          </div>

          <div className="text-center space-y-4 w-full max-w-md mx-auto px-4 overflow-hidden">
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {sosActive
                ? `Alert sent to ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`
                : "Tap SOS to send emergency alert"}
            </h1>
            <p className="text-white/60 text-lg">
              {sosActive
                ? "GPS is tracking your location. Emergency contacts have been notified."
                : "Your live location and an emergency message will be sent to all saved contacts."}
            </p>

            {/* GPS status */}
            {gpsError ? (
              <div className="flex items-center gap-2 justify-center text-amber-400 text-sm">
                <span className="material-symbols-outlined text-sm">warning</span>
                {gpsError}
              </div>
            ) : coords && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full border border-white/5">
                  <span className="material-symbols-outlined text-[#dc2626] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  <span className="text-xs font-semibold text-white/60 font-mono">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} · ±{Math.round(coords.accuracy)}m
                  </span>
                </div>
                {address && (
                  <p className="text-xs text-white/40 text-center">{address}</p>
                )}
              </div>
            )}

            {/* Audio waveform / status */}
            <div className="flex items-center justify-center gap-3">
              {audioActive ? (
                <div className="flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full border border-[#dc2626]/30">
                  <div className="flex items-end gap-[2px] h-6">
                    {audioBars.map((h, i) => (
                      <div
                        key={i}
                        className="w-[3px] bg-[#dc2626] rounded-sm transition-all duration-75"
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#dc2626]">
                    Recording {fmtTime(audioSeconds)}
                  </span>
                </div>
              ) : audioError ? (
                <div className="flex items-center gap-2 text-white/40 text-xs">
                  <span className="material-symbols-outlined text-sm">mic_off</span>
                  {audioError}
                </div>
              ) : audioBlob ? (
                <button
                  onClick={downloadAudio}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download audio evidence
                </button>
              ) : null}

              <span className={`flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-full border border-white/5 text-xs font-semibold uppercase tracking-widest ${sosActive ? "text-emerald-400" : "text-white/40"}`}>
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                {sosActive ? "GPS Active" : "GPS Ready"}
              </span>
            </div>

            {/* Alert sent message */}
            {alertsSent && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-left">
                <p className="text-amber-400 text-sm font-semibold mb-1">📧 Alert emails opened for all contacts — please send them.</p>
                <p className="text-amber-400/70 text-xs">WhatsApp sharing available below per contact.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="lg:col-span-5 space-y-6">

          {/* Map card */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-2xl border border-white/5">
            <div className="relative h-48 w-full bg-surface-container-highest">
              {osmEmbedUrl ? (
                <iframe
                  src={osmEmbedUrl}
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                  title="Live Location Map"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white/20">
                    <span className="material-symbols-outlined text-4xl block mb-2">map</span>
                    <span className="text-xs uppercase tracking-widest">
                      {gpsError ? gpsError : "Waiting for GPS…"}
                    </span>
                  </div>
                </div>
              )}
              {!osmEmbedUrl && <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low to-transparent" />}
              <div className="absolute bottom-4 left-4">
                <div className="text-white font-bold">Current Location</div>
                <div className="text-white/60 text-xs">
                  {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Not yet acquired"}
                </div>
              </div>
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-4 right-4 bg-white text-black p-2 rounded-lg hover:bg-primary hover:text-white transition-colors"
                  title="Open Live Map"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                </a>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#dc2626]/10">
                    <span className="material-symbols-outlined text-[#dc2626]" style={{ fontVariationSettings: "'FILL' 1" }}>my_location</span>
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">GPS Accuracy</div>
                    <div className="text-white/40 text-xs">
                      {coords ? `± ${Math.round(coords.accuracy)} metres` : "Waiting…"}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold text-sm">
                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-white/40 text-xs">{coords ? "Live" : "Standby"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Nearby emergency services */}
          <div className="bg-surface-container-low rounded-xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Nearby Services</h3>
              {fetchingNearby && (
                <span className="w-3 h-3 rounded-full border-2 border-white/20 border-t-primary animate-spin" />
              )}
            </div>
            {nearbyPlaces.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {nearbyPlaces.map((p) => (
                  <a
                    key={p.id}
                    href={`https://www.google.com/maps/dir/${coords?.lat},${coords?.lng}/${p.lat},${p.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-high hover:bg-surface-container-highest transition-colors group"
                  >
                    <span className="text-xl leading-none">
                      {p.type === "police" ? "🚔" : "🏥"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-semibold truncate">{p.name}</div>
                      <div className="text-white/40 text-[10px]">
                        {p.distance < 1000 ? `${Math.round(p.distance)} m away` : `${(p.distance / 1000).toFixed(1)} km away`}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-white/20 group-hover:text-primary text-sm transition-colors">directions</span>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-xs text-center py-4">
                {nearbyError
                  ? "Could not load nearby services."
                  : coords
                  ? (fetchingNearby ? "Searching…" : "No services found nearby.")
                  : "Acquiring location…"}
              </p>
            )}
          </div>

          {/* Indian Emergency Numbers */}
          <div className="bg-surface-container-low rounded-xl p-5 border border-[#dc2626]/20">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Indian Emergency Services</h3>
            <div className="space-y-2">
              {[
                { emoji: "🚔", label: "Police", number: "112" },
                { emoji: "🚑", label: "Ambulance", number: "108" },
                { emoji: "🔥", label: "Fire", number: "101" },
              ].map((s) => (
                <a
                  key={s.number}
                  href={`tel:${s.number}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#dc2626]/20 hover:bg-[#dc2626]/10 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{s.emoji}</span>
                    <span className="text-white font-semibold text-sm">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#dc2626] font-extrabold text-lg tracking-tight">{s.number}</span>
                    <span className="material-symbols-outlined text-[#dc2626] text-sm group-hover:scale-110 transition-transform">call</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Notified contacts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">Notified Contacts</h2>
              <Link href="/profile" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-white transition-colors">
                Edit Contacts
              </Link>
            </div>

            {loadingContacts ? (
              [0, 1].map((i) => (
                <div key={i} className="bg-surface-container-high/40 rounded-xl border border-white/5 p-4 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-surface-container-highest" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 bg-surface-container-highest rounded w-1/2" />
                      <div className="h-2 bg-surface-container-highest rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ))
            ) : contacts.length === 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 text-center">
                <span className="material-symbols-outlined text-amber-400 text-3xl block mb-2">group_off</span>
                <p className="text-amber-400 font-semibold text-sm mb-3">No emergency contacts saved.</p>
                <p className="text-amber-400/70 text-xs mb-4">Add contacts in Profile to notify them during SOS.</p>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-400 font-bold text-xs rounded-lg hover:bg-amber-500/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">person_add</span>
                  Add Contacts
                </Link>
              </div>
            ) : (
              contacts.map((c, i) => {
                const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const waMsg = encodeURIComponent(
                  `${c.name}, ${user?.displayName ?? user?.email ?? "Someone"} needs help immediately!\n📍 ${address || "Location unknown"}\n🗺️ ${googleMapsUrl ?? ""}\n\nThis was sent via SaveHer AI.`
                );
                return (
                  <div key={c.id} className="bg-surface-container-high/40 backdrop-blur-xl p-4 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0"
                          style={{ backgroundColor: color + "33", border: `2px solid ${color}` }}
                        >
                          {initials(c.name)}
                        </div>
                        <div>
                          <div className="text-white font-bold text-sm">{c.name}</div>
                          <div className="text-white/40 text-xs">{c.relationship} · {c.phone}</div>
                          {sosActive && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Alert Sent</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sosActive && (
                          <a
                            href={`https://wa.me/${c.phone.replace(/\D/g, "")}?text=${waMsg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-full bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 transition-colors"
                            title="WhatsApp"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </a>
                        )}
                        <a
                          href={`tel:${c.phone}`}
                          className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
                          title={`Call ${c.name}`}
                        >
                          <span className="material-symbols-outlined text-base">call</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* ── False Alarm / Cancel CTA fixed at bottom ── */}
      <div className="fixed bottom-6 sm:bottom-12 left-1/2 -translate-x-1/2 w-full max-w-xs px-6 z-40">
        <button
          onClick={handleFalseAlarm}
          className="w-full bg-surface-container-highest border border-white/10 py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-2xl backdrop-blur-xl group"
        >
          <span className="material-symbols-outlined text-white/40 group-hover:text-[#dc2626] transition-colors">cancel</span>
          <span className="text-white font-bold uppercase tracking-[0.2em] text-sm">
            {sosActive ? "False Alarm" : "Cancel"}
          </span>
        </button>
        <p className="text-center mt-3 text-[10px] text-white/20 uppercase tracking-widest">
          {sosActive ? "Tap to deactivate emergency mode" : "Return to home"}
        </p>
      </div>

      <footer className="w-full border-t border-white/5 bg-[#0a0a0f] mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center px-12 py-10 w-full">
          <div className="text-lg font-black text-white/80 mb-6 md:mb-0">SaveHer AI</div>
          <div className="flex flex-wrap justify-center gap-8 mb-8 md:mb-0">
            <Link className="font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-colors" href="/">Privacy Policy</Link>
            <Link className="font-normal text-xs text-white/40 uppercase tracking-widest hover:text-white transition-colors" href="/">Terms of Service</Link>
            <Link className="font-normal text-xs text-[#7c6af7] uppercase tracking-widest" href="/sos">Emergency Protocol</Link>
          </div>
          <p className="font-normal text-xs text-white/40 uppercase tracking-widest">© 2026 SaveHer AI. Protected by The Sentinel&apos;s Veil.</p>
        </div>
      </footer>
    </>
  );
}
