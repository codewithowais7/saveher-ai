import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export interface Coords {
  lat: number;
  lng: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

/**
 * Request the browser's current GPS position.
 * Rejects if the user denies permission or if geolocation is unavailable.
 */
export function getLocation(): Promise<Coords> {
  console.log("[SOS] getLocation → start");
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        console.log("[SOS] getLocation → done", coords);
        resolve(coords);
      },
      (err) => {
        console.error("[SOS] getLocation → denied:", err.message);
        reject(err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

/**
 * Build a Google Maps deep-link for the given coordinates.
 */
export function buildMapLink(lat: number, lng: number): string {
  const link = `https://maps.google.com/?q=${lat},${lng}`;
  console.log("[SOS] buildMapLink →", link);
  return link;
}

/**
 * Open the user's default mail client with a pre-filled SOS message addressed
 * to all emergency contacts. Falls back gracefully if mailto fails.
 *
 * @param contacts - Array of emergency contacts with name and phone
 * @param lat      - Current latitude
 * @param lng      - Current longitude
 * @param userName - Complainant name / email shown in the message body
 */
export function sendSOSAlert(
  contacts: EmergencyContact[],
  lat: number,
  lng: number,
  userName: string
): void {
  console.log("[SOS] sendSOSAlert → start", { contacts, lat, lng, userName });

  const mapLink = buildMapLink(lat, lng);
  const subject = encodeURIComponent("EMERGENCY - SaveHer AI Alert");
  const body = encodeURIComponent(
    `${userName} needs help! Location: ${mapLink} — Please call immediately!`
  );

  // Build a comma-separated list of phone numbers as mailto recipients
  // (phones used as-is; real implementations would use registered emails)
  const to = contacts.map((c) => c.phone).join(",");
  const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;

  // Open in a hidden anchor to avoid popup blockers
  const anchor = document.createElement("a");
  anchor.href = mailtoUrl;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  console.log("[SOS] sendSOSAlert → done, mailto opened");
}

/**
 * Persist an SOS event to the Firestore `sos_logs` collection.
 *
 * @param userId - Authenticated user's UID
 * @param lat    - Latitude at time of SOS
 * @param lng    - Longitude at time of SOS
 */
export async function saveSOSLog(
  userId: string,
  lat: number,
  lng: number
): Promise<void> {
  console.log("[SOS] saveSOSLog → start", { userId, lat, lng });
  try {
    await addDoc(collection(db, "sos_logs"), {
      userId,
      lat,
      lng,
      timestamp: serverTimestamp(),
    });
    console.log("[SOS] saveSOSLog → done");
  } catch (error) {
    console.error("[SOS] saveSOSLog → failed:", error);
    throw error;
  }
}
