import type { HarassmentAnalysis } from "./ai";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

const GEMINI_STREAM_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:streamGenerateContent";

// ── Types ───────────────────────────────────────────────────────────────────────
export interface AdditionalDetails {
  victimAge?: string;
  platformName?: string;
  incidentDate?: string;
  incidentTime?: string;
  accusedProfile?: string;
}

/** Full user detail object for the pre-generation modal */
export interface UserDetails {
  fullName: string;
  age: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  accusedName: string;
  platform: string;
  incidentDate: string;
  incidentTime: string;
  signatureText?: string;
}

// ── Post-processing cleanup ─────────────────────────────────────────────────────
export function cleanComplaint(text: string): string {
  return text
    .replace(/\[.*?\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Format date as "DD Month YYYY" ─────────────────────────────────────────────
export function fmtDate(isoOrStr: string): string {
  try {
    const d = new Date(isoOrStr);
    if (isNaN(d.getTime())) return isoOrStr;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return isoOrStr;
  }
}

// ── Resolve "not provided" fallbacks gracefully ────────────────────────────────
function r(val: string | undefined, fallback: string): string {
  const v = (val ?? "").trim();
  return v.length > 0 ? v : fallback;
}

// ── Normalise params to UserDetails ───────────────────────────────────────────
function toUserDetails(
  userNameOrDetails: string | UserDetails,
  additionalDetails?: AdditionalDetails
): UserDetails {
  if (typeof userNameOrDetails !== "string") return userNameOrDetails;
  const ad = additionalDetails ?? {};
  return {
    fullName: userNameOrDetails,
    age: ad.victimAge ?? "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    accusedName: ad.accusedProfile ?? "",
    platform: ad.platformName ?? "",
    incidentDate: ad.incidentDate ?? new Date().toISOString().split("T")[0],
    incidentTime: ad.incidentTime ?? "",
    signatureText: userNameOrDetails,
  };
}

// ── Gemini fetch helper ────────────────────────────────────────────────────────
async function callGemini(prompt: string, maxTokens = 2048): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") throw new Error("No API key");
  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) throw new Error("Empty Gemini response");
  return cleanComplaint(text);
}

// ── Gemini streaming fetch helper ──────────────────────────────────────────────
async function callGeminiStream(
  prompt: string,
  maxTokens = 2048,
  onChunk: (text: string) => void
): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") throw new Error("No API key");
  const res = await fetch(`${GEMINI_STREAM_API_URL}?key=${apiKey}&alt=sse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("No response body for streaming");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const chunk: string =
          parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (chunk) {
          fullText += chunk;
          onChunk(chunk);
        }
      } catch { /* skip malformed SSE line */ }
    }
  }

  const cleaned = cleanComplaint(fullText);
  if (!cleaned) throw new Error("Empty Gemini streaming response");
  return cleaned;
}

// ════════════════════════════════════════════════════════════════════════════════
// FULL FIR-STYLE COMPLAINT (Police Station)
// ════════════════════════════════════════════════════════════════════════════════
function buildFIRPrompt(analysis: HarassmentAnalysis, ud: UserDetails): string {
  const today = fmtDate(new Date().toISOString());
  const incidentDate = fmtDate(ud.incidentDate) || today;
  const accusedDesc = ud.accusedName.trim()
    ? `"${ud.accusedName}"`
    : "an unidentified individual";
  const address = [ud.address, ud.city, ud.state].filter(Boolean).join(", ") || "On file";
  const evidenceList = analysis.complaint_points.map((p, i) => `${i + 1}. ${p}`).join("\n");
  const lawsList = analysis.applicable_laws.length > 0
    ? analysis.applicable_laws.map((l) => `- ${l.section} of ${l.act}: ${l.description}`).join("\n")
    : "- Section 66A of the Information Technology Act 2000\n- Section 351 of the Bharatiya Nyaya Sanhita 2023";

  return `You are a senior Indian cybercrime legal document drafter with 15 years experience.
Generate a complete, court-admissible FIR-style complaint.
Output MUST be 600-700 words. Output plain text ONLY. Zero placeholders. Zero brackets. Zero markdown asterisks. If any detail is missing, write naturally around it.

Fill every field with the provided data:

COMPLAINANT: ${r(ud.fullName, "Complainant")}, Age: ${r(ud.age, "not disclosed")}, Phone: ${r(ud.phone, "on file")}
ADDRESS: ${address}
EMAIL: ${r(ud.email, "not provided")}
DATE OF COMPLAINT: ${today}
INCIDENT DATE: ${incidentDate}${ud.incidentTime ? " at " + ud.incidentTime : ""}
PLATFORM: ${r(ud.platform, "an online platform")}
ACCUSED: ${accusedDesc}
HARASSMENT TYPE: ${analysis.harassment_type}
SEVERITY: ${analysis.severity}
AI ANALYSIS: ${analysis.summary}
EVIDENCE POINTS:
${evidenceList}

APPLICABLE LAWS:
${lawsList}

Write with these EXACT sections in order:

BEFORE THE STATION HOUSE OFFICER
CYBER CRIME POLICE STATION, ${r(ud.city, "LOCAL JURISDICTION")}, ${r(ud.state, "INDIA")}

FIR COMPLAINT — CYBER HARASSMENT / ONLINE ABUSE

DATE: ${today}
PLACE: ${r(ud.city, "India")}, ${r(ud.state, "India")}

1. PERSONAL PARTICULARS OF THE COMPLAINANT
[Write all complainant details in paragraph form, fully filled with all provided fields. No brackets.]

2. DETAILS OF THE INCIDENT
[Write 200 words describing what happened specifically, using exact harassment type and platform provided. Include specific quotes from the evidence points. Mention date, time, platform, accused handle. Use active voice: "The accused sent..." not "Messages were sent..."]

3. NATURE OF OFFENCE COMMITTED
[Explain specifically what laws were violated and how, referencing the harassment type and evidence]

4. LEGAL SECTIONS APPLICABLE
[Include only sections actually applicable to this harassment type from: IT Act 2000 Sections 66A/66C/66E/67; BNS 2023 Sections 351/356/79; IPC Sections 503/509. Write full section name and brief reason it applies.]

5. EVIDENCE AVAILABLE
[List all evidence points as numbered items]
[Add: "Digital screenshots have been preserved as evidence."]
[Add: "AI analysis report generated by SaveHer AI platform (cybercrime-grade analysis) is available as supporting evidence."]

6. PRAYER / RELIEF SOUGHT
i.   Immediate registration of FIR under the applicable sections listed above.
ii.  Investigation and identification of the accused ${accusedDesc}.
iii. Preservation and seizure of digital evidence from ${r(ud.platform, "the concerned platform")}.
iv.  Appropriate legal action and punishment as per law.
v.   Protection order for the complainant from further harassment and intimidation.
[Add this line exactly: "The complainant may also be reached via National Cyber Crime Helpline: 1930 or online at cybercrime.gov.in"]

7. DECLARATION
I, ${r(ud.fullName, "the complainant")}, do hereby declare that the information furnished above is true and correct to the best of my knowledge and belief. I understand that providing false information is an offence under law.

8. SIGNATURE

Signature: ${r(ud.signatureText ?? ud.fullName, r(ud.fullName, "Complainant"))}
Name: ${r(ud.fullName, "Complainant")}
Date: ${today}
Place: ${r(ud.city, "India")}, ${r(ud.state, "India")}
Contact: ${r(ud.phone, "On file")}

NATIONAL CYBER CRIME HELPLINE: 1930 (24x7, Free)
ONLINE PORTAL: cybercrime.gov.in`;
}

function defaultFIRComplaint(analysis: HarassmentAnalysis, ud: UserDetails): string {
  const today = fmtDate(new Date().toISOString());
  const incidentDate = fmtDate(ud.incidentDate) || today;
  const address = [ud.address, ud.city, ud.state].filter(Boolean).join(", ") || "On file";
  const accusedDesc = ud.accusedName.trim() ? `"${ud.accusedName}"` : "an unidentified individual";
  const evidenceList = analysis.complaint_points.map((p, i) => `${i + 1}. ${p}`).join("\n");
  const lawsList = analysis.applicable_laws.length > 0
    ? analysis.applicable_laws.map((l, i) => `${i + 1}. ${l.section} of ${l.act}: ${l.description}`).join("\n")
    : "1. Section 66A of the Information Technology Act, 2000: Offensive/threatening electronic communication\n2. Section 351 of the Bharatiya Nyaya Sanhita, 2023: Criminal intimidation";

  return `BEFORE THE STATION HOUSE OFFICER
CYBER CRIME POLICE STATION, ${r(ud.city, "LOCAL JURISDICTION")}, ${r(ud.state, "INDIA")}

FIR COMPLAINT — CYBER HARASSMENT / ONLINE ABUSE

DATE: ${today}
PLACE: ${r(ud.city, "India")}, ${r(ud.state, "India")}

1. PERSONAL PARTICULARS OF THE COMPLAINANT

The complainant, ${r(ud.fullName, "the undersigned")}, aged ${r(ud.age, "not disclosed")} years, residing at ${address}, contact number ${r(ud.phone, "on file")}, email ${r(ud.email, "not provided")}, respectfully submits this complaint.

2. DETAILS OF THE INCIDENT

On ${incidentDate}${ud.incidentTime ? " at approximately " + ud.incidentTime : ""}, the complainant was subjected to ${analysis.harassment_type.toLowerCase()} via the platform ${r(ud.platform, "an online platform")}. The accused, ${accusedDesc}, engaged in conduct assessed as "${analysis.severity}" severity. ${analysis.summary} This constitutes a serious violation of the complainant's rights and dignity, warranting immediate law enforcement intervention.

3. NATURE OF OFFENCE COMMITTED

The accused has committed ${analysis.harassment_type.toLowerCase()} against the complainant through electronic means. The conduct is deliberate, targeted, and falls within the purview of Indian cybercrime law. The AI forensic assessment corroborates the gravity of the offence and the credibility of the evidence.

4. LEGAL SECTIONS APPLICABLE

${lawsList}

5. EVIDENCE AVAILABLE

${evidenceList}
${analysis.complaint_points.length + 1}. Digital screenshots have been preserved as evidence.
${analysis.complaint_points.length + 2}. AI analysis report generated by SaveHer AI platform (cybercrime-grade analysis) is available as supporting evidence.

6. PRAYER / RELIEF SOUGHT

i.   Immediate registration of FIR under the applicable sections listed above.
ii.  Investigation and identification of the accused ${accusedDesc}.
iii. Preservation and seizure of digital evidence from ${r(ud.platform, "the concerned platform")}.
iv.  Appropriate legal action and punishment as per law.
v.   Protection order for the complainant from further harassment and intimidation.

The complainant may also be reached via National Cyber Crime Helpline: 1930 or online at cybercrime.gov.in.

7. DECLARATION

I, ${r(ud.fullName, "the complainant")}, do hereby declare that the information furnished above is true and correct to the best of my knowledge and belief. I understand that providing false information is an offence under law.

8. SIGNATURE

Signature: ${r(ud.signatureText ?? ud.fullName, r(ud.fullName, "Complainant"))}
Name: ${r(ud.fullName, "Complainant")}
Date: ${today}
Place: ${r(ud.city, "India")}, ${r(ud.state, "India")}
Contact: ${r(ud.phone, "On file")}

NATIONAL CYBER CRIME HELPLINE: 1930 (24x7, Free)
ONLINE PORTAL: cybercrime.gov.in`;
}

// ════════════════════════════════════════════════════════════════════════════════
// SHORT / ONLINE PORTAL complaint (cybercrime.gov.in)
// ════════════════════════════════════════════════════════════════════════════════
function buildPortalPrompt(analysis: HarassmentAnalysis, ud: UserDetails): string {
  const today = fmtDate(new Date().toISOString());
  const incidentDate = fmtDate(ud.incidentDate) || today;
  const address = [ud.address, ud.city, ud.state].filter(Boolean).join(", ") || "On file";
  const evidenceList = analysis.complaint_points.map((p, i) => `${i + 1}. ${p}`).join("\n");

  return `Generate a structured complaint for India's National Cybercrime Reporting Portal (cybercrime.gov.in).
Output plain text only. Zero placeholders. Zero brackets. Zero markdown.
If any detail is missing, write naturally around it.

COMPLAINANT: ${r(ud.fullName, "Complainant")}, ${r(ud.age, "not disclosed")} years, ${r(ud.phone, "on file")}, ${r(ud.email, "not provided")}
ADDRESS: ${address}
INCIDENT: ${incidentDate}, ${r(ud.platform, "online")}, Accused: ${ud.accusedName || "identity unknown"}
TYPE: ${analysis.harassment_type}, SEVERITY: ${analysis.severity}
SUMMARY: ${analysis.summary}
EVIDENCE:
${evidenceList}

Format EXACTLY as follows (fill all fields with provided data):

=== CYBERCRIME.GOV.IN — COMPLAINT FORM ===
Portal: https://cybercrime.gov.in
Helpline: 1930

SECTION A: COMPLAINANT INFORMATION
Full Name: ${r(ud.fullName, "Complainant")}
Age: ${r(ud.age, "Not disclosed")}
Gender: Not disclosed
Mobile: ${r(ud.phone, "On file")}
Email: ${r(ud.email, "Not provided")}
State: ${r(ud.state, "India")}
District: ${r(ud.city, "Local jurisdiction")}
Address: ${address}

SECTION B: INCIDENT DETAILS
Category: Cyber Harassment / Online Abuse
Sub-category: ${analysis.harassment_type}
Date of Incident: ${incidentDate}
Time of Incident: ${ud.incidentTime || "Not specified"}
Platform/Website: ${r(ud.platform, "Online platform")}
URL/Profile of Accused: ${ud.accusedName || "Identity unknown, to be investigated"}
Description of Incident (in own words):
[Write a 150-word natural first-person account. Start with "I am writing to report...". Use "I" perspective. Include exact phrases from evidence points. Zero placeholders. Describe the harassment specifically using the harassment type and evidence provided.]

SECTION C: ACCUSED DETAILS
Name/Handle: ${ud.accusedName || "Identity unknown, to be investigated"}
Platform: ${r(ud.platform, "Online")}
Any other known details: To be determined during investigation

SECTION D: EVIDENCE
${evidenceList}
${analysis.complaint_points.length + 1}. Digital screenshots preserved as evidence.
${analysis.complaint_points.length + 2}. AI harassment analysis report (SaveHer AI) available.

SECTION E: DECLARATION
I hereby declare the above information is true and correct.
Complainant: ${r(ud.fullName, "Complainant")}
Date: ${today}
Place: ${r(ud.city, "India")}, ${r(ud.state, "India")}

IMPORTANT: After submitting online, note your complaint ID.
You can track status at: cybercrime.gov.in/Grievance/trackStatus
For urgent help call: 1930 (24x7, Free)`;
}

function defaultPortalComplaint(analysis: HarassmentAnalysis, ud: UserDetails): string {
  const today = fmtDate(new Date().toISOString());
  const incidentDate = fmtDate(ud.incidentDate) || today;
  const address = [ud.address, ud.city, ud.state].filter(Boolean).join(", ") || "On file";
  const evidenceList = analysis.complaint_points.map((p, i) => `${i + 1}. ${p}`).join("\n");

  return `=== CYBERCRIME.GOV.IN — COMPLAINT FORM ===
Portal: https://cybercrime.gov.in
Helpline: 1930

SECTION A: COMPLAINANT INFORMATION
Full Name: ${r(ud.fullName, "Complainant")}
Age: ${r(ud.age, "Not disclosed")}
Gender: Not disclosed
Mobile: ${r(ud.phone, "On file")}
Email: ${r(ud.email, "Not provided")}
State: ${r(ud.state, "India")}
District: ${r(ud.city, "Local jurisdiction")}
Address: ${address}

SECTION B: INCIDENT DETAILS
Category: Cyber Harassment / Online Abuse
Sub-category: ${analysis.harassment_type}
Date of Incident: ${incidentDate}
Time of Incident: ${ud.incidentTime || "Not specified"}
Platform/Website: ${r(ud.platform, "Online platform")}
URL/Profile of Accused: ${ud.accusedName || "Identity unknown, to be investigated"}
Description of Incident (in own words):
I am writing to report an incident of ${analysis.harassment_type.toLowerCase()} that occurred on ${incidentDate} via ${r(ud.platform, "an online platform")}. ${analysis.summary} The accused, ${ud.accusedName || "whose identity is yet to be determined"}, engaged in conduct of "${analysis.severity}" severity. I request immediate investigation and appropriate legal action under the Information Technology Act 2000 and the Bharatiya Nyaya Sanhita 2023.

SECTION C: ACCUSED DETAILS
Name/Handle: ${ud.accusedName || "Identity unknown, to be investigated"}
Platform: ${r(ud.platform, "Online")}
Any other known details: To be determined during investigation

SECTION D: EVIDENCE
${evidenceList}
${analysis.complaint_points.length + 1}. Digital screenshots preserved as evidence.
${analysis.complaint_points.length + 2}. AI harassment analysis report (SaveHer AI) available.

SECTION E: DECLARATION
I hereby declare the above information is true and correct.
Complainant: ${r(ud.fullName, "Complainant")}
Date: ${today}
Place: ${r(ud.city, "India")}, ${r(ud.state, "India")}

IMPORTANT: After submitting online, note your complaint ID.
You can track status at: cybercrime.gov.in/Grievance/trackStatus
For urgent help call: 1930 (24x7, Free)`;
}

// ════════════════════════════════════════════════════════════════════════════════
// PUBLIC API — generateComplaint (overloaded for backwards compat)
// ════════════════════════════════════════════════════════════════════════════════
export async function generateComplaint(
  analysisResult: HarassmentAnalysis,
  userNameOrDetails: string | UserDetails,
  additionalDetails?: AdditionalDetails
): Promise<string> {
  const ud = toUserDetails(userNameOrDetails, additionalDetails);
  try {
    return await callGemini(buildFIRPrompt(analysisResult, ud), 2048);
  } catch (err) {
    console.error("[Complaint] generateComplaint failed, using fallback:", err);
    return defaultFIRComplaint(analysisResult, ud);
  }
}

export async function generateShortComplaint(
  analysisResult: HarassmentAnalysis,
  userNameOrDetails: string | UserDetails,
  additionalDetails?: AdditionalDetails
): Promise<string> {
  const ud = toUserDetails(userNameOrDetails, additionalDetails);
  try {
    return await callGemini(buildPortalPrompt(analysisResult, ud), 1500);
  } catch (err) {
    console.error("[Complaint] generateShortComplaint failed, using fallback:", err);
    return defaultPortalComplaint(analysisResult, ud);
  }
}

// ── Streaming public API ──────────────────────────────────────────────────────
export async function generateComplaintStream(
  analysisResult: HarassmentAnalysis,
  userNameOrDetails: string | UserDetails,
  additionalDetails: AdditionalDetails | undefined,
  onChunk: (text: string) => void
): Promise<string> {
  const ud = toUserDetails(userNameOrDetails, additionalDetails);
  try {
    return await callGeminiStream(buildFIRPrompt(analysisResult, ud), 2048, onChunk);
  } catch (err) {
    console.error("[Complaint] generateComplaintStream failed, using fallback:", err);
    const fallback = defaultFIRComplaint(analysisResult, ud);
    onChunk(fallback);
    return fallback;
  }
}

export async function generateShortComplaintStream(
  analysisResult: HarassmentAnalysis,
  userNameOrDetails: string | UserDetails,
  additionalDetails: AdditionalDetails | undefined,
  onChunk: (text: string) => void
): Promise<string> {
  const ud = toUserDetails(userNameOrDetails, additionalDetails);
  try {
    return await callGeminiStream(buildPortalPrompt(analysisResult, ud), 1500, onChunk);
  } catch (err) {
    console.error("[Complaint] generateShortComplaintStream failed, using fallback:", err);
    const fallback = defaultPortalComplaint(analysisResult, ud);
    onChunk(fallback);
    return fallback;
  }
}

// ── Stubs ───────────────────────────────────────────────────────────────────────
export async function saveComplaint(userId: string, complaintData: Record<string, unknown>): Promise<void> {
  console.log("[Complaint] saveComplaint → stub", { userId, complaintData });
}
export async function fetchComplaints(userId: string): Promise<void> {
  console.log("[Complaint] fetchComplaints → stub", { userId });
}
export async function submitComplaint(complaintId: string): Promise<void> {
  console.log("[Complaint] submitComplaint → stub", { complaintId });
}
export async function deleteComplaint(complaintId: string): Promise<void> {
  console.log("[Complaint] deleteComplaint → stub", { complaintId });
}
