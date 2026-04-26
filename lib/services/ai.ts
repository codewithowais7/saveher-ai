const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

/** A single applicable law entry returned by the AI */
export interface ApplicableLaw {
  act: string;
  section: string;
  description: string;
}

export interface HarassmentAnalysis {
  harassment_type:
    | "Abuse"
    | "Threat"
    | "Sexual Harassment"
    | "Stalking"
    | "Blackmail"
    | "Impersonation"
    | "Spam"
    | "Morphed Content"
    | "None"
    | "Unknown";
  severity: "Low" | "Medium" | "High" | "Critical" | "Unknown";
  suggested_action:
    | "Ignore"
    | "Block"
    | "Report to Platform"
    | "File Police Complaint"
    | "Immediate Action Required"
    | "Report"
    | "Immediate Action";
  summary: string;
  applicable_laws: ApplicableLaw[];
  complaint_points: string[];
  platform_report_steps: string;
  urgency_note: string;
}

const FALLBACK_ANALYSIS: HarassmentAnalysis = {
  harassment_type: "Unknown",
  severity: "Unknown",
  suggested_action: "Report",
  summary: "Analysis failed. Please try again or describe the incident manually.",
  applicable_laws: [],
  complaint_points: [],
  platform_report_steps: "Visit the platform's Help Center and report the user or content directly.",
  urgency_note: "Unable to determine urgency — please review manually.",
};

/**
 * Analyze extracted screenshot text for harassment using Gemini.
 *
 * @param extractedText    - Raw text extracted from the screenshot via OCR
 * @param userDescription  - Optional user-provided description of the incident
 * @returns                  Structured harassment analysis object
 */
export async function analyzeHarassment(
  extractedText: string,
  userDescription: string
): Promise<HarassmentAnalysis> {

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    console.warn("[AI] analyzeHarassment → no API key configured, returning fallback");
    return FALLBACK_ANALYSIS;
  }

  const prompt = `You are an expert cybercrime legal analyst specializing in Indian law. 
Analyze the following harassment content with precision.

Extracted text from screenshot: ${extractedText}
Additional context from user: ${userDescription}

Perform deep analysis and respond ONLY in this exact JSON format, no markdown, no extra text:
{
  "harassment_type": "one of: Threat | Abuse | Sexual Harassment | Stalking | Blackmail | Impersonation | Spam | Morphed Content | None",
  "severity": "one of: Low | Medium | High | Critical",
  "suggested_action": "one of: Ignore | Block | Report to Platform | File Police Complaint | Immediate Action Required",
  "summary": "3-4 sentences describing exactly what happened and why it is harmful",
  "applicable_laws": [
    {
      "act": "IT Act 2000",
      "section": "Section 66C",
      "description": "Identity theft"
    }
  ],
  "complaint_points": [
    "Specific evidence point 1 with exact quote if available",
    "Specific evidence point 2",
    "Specific evidence point 3"
  ],
  "platform_report_steps": "Brief instructions on how to report this on the platform where harassment occurred",
  "urgency_note": "One sentence on how urgent this matter is"
}

For applicable_laws, pick ALL relevant ones from this list based on actual content:
- IT Act 2000 Section 66A: Offensive/threatening electronic messages
- IT Act 2000 Section 66C: Identity theft / impersonation
- IT Act 2000 Section 66E: Privacy violation / morphed images
- IT Act 2000 Section 67: Obscene content online
- IT Act 2000 Section 67A: Sexually explicit content
- IT Act 2000 Section 67B: Child exploitation content  
- IPC Section 292: Obscene material
- IPC Section 354A: Sexual harassment
- IPC Section 354D: Cyberstalking
- IPC Section 499: Defamation
- IPC Section 503: Criminal intimidation / threats
- IPC Section 506: Punishment for criminal intimidation
- IPC Section 507: Anonymous criminal threats
- IPC Section 509: Words or gestures insulting modesty of a woman
- POCSO Act: If victim is a minor
- Protection of Women from Domestic Violence Act: If from intimate partner

Only include sections that are genuinely applicable. Do not include irrelevant ones.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let cleaned = rawText.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
    }

    const parsed: HarassmentAnalysis = JSON.parse(cleaned);

    // Back-fill optional fields if AI omitted them
    if (!parsed.applicable_laws) parsed.applicable_laws = [];
    if (!parsed.platform_report_steps) parsed.platform_report_steps = FALLBACK_ANALYSIS.platform_report_steps;
    if (!parsed.urgency_note) parsed.urgency_note = FALLBACK_ANALYSIS.urgency_note;

    return parsed;
  } catch (error) {
    console.error("[AI] analyzeHarassment → failed, returning fallback:", error);
    return FALLBACK_ANALYSIS;
  }
}

/**
 * Classify threat severity level from raw content.
 * Lightweight wrapper around analyzeHarassment for quick severity checks.
 *
 * @param content - Content string to classify
 */
export async function classifyThreat(
  content: string
): Promise<HarassmentAnalysis["severity"]> {
  const result = await analyzeHarassment(content, "");
  return result.severity;
}
