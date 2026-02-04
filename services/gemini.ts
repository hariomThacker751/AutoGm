import { GoogleGenAI, Type } from "@google/genai";
import { FormData, EmailResponse } from "../types";

// Initialize Gemini client using the environment variable API key
// Initialize Gemini client lazily to prevent top-level crashes
let aiClient: GoogleGenAI | null = null;

const getAIClient = () => {
  if (!aiClient) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY;
    if (!apiKey) {
      console.warn("Gemini API Key is missing! Check .env.local");
    }
    aiClient = new GoogleGenAI({ apiKey: apiKey || "dummy_key_to_prevent_crash" });
  }
  return aiClient;
};

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
You are the world's most advanced Cold Email Architect.
**MISSION:** Construct an email that gets opened and replied to.
**GOAL:** Highest possible Open Rate and Reply Rate.

**INPUT DATA:**
- Recipient: ${data.recipientName}
- Company: ${data.companyName}
- Industry: ${data.industry}
- Pain Point: ${data.keyPainPoint || "Manual lead generation"}
- Sender: ${data.senderName} (${data.senderCompany})

---

### STRATEGY: ULTRA-PERSONALIZATION & IRRESISTIBLE OFFER

**1. THE SUBJECT LINE:**
   - **GOAL:** Maximize open rate through pure relevance and curiosity.
   - **STRATEGY:** Analyze the input data. Write a subject line that proves you know exactly who they are and what they care about.
   - **AVOID:** Generic marketing phrases ("Solution for...", "Partnership").
   - **FOCUS:** A specific observation, a relevant question, or a direct value proposition.

**2. THE EMAIL BODY:**
   - **HOOK:** Open with a specific observation about their company or industry to prove you did your research.
   - **PROBLEM:** Briefly touch on the pain point (${data.keyPainPoint}) in a way that resonates with a founder/decision-maker.
   - **IRRESISTIBLE OFFER:** "I have built an AI that automates this. I want to let you use it for **FREE** to prove it works."
     - *Key Psychology:* Remove all risk. It's not a sales pitch, it's a "free trial to prove value."
   - **CALL TO ACTION:** Low friction. "Open to a quick look?" or "Worth a chat?"

**TONE:** Professional, confident, concise. Like a busy founder emailing another busy founder.

---

**GENERATE JSON OUTPUT:**
{
  "subjectLine": "The highly personalized subject line",
  "emailBody": "The HTML body with <br><br> for breaks",
  "strategyExplanation": "Why this specific subject line will get the highest open rate."
}
`;

  try {
    const response = await getAIClient().models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.8, // Balanced creativity
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subjectLine: { type: Type.STRING },
            emailBody: { type: Type.STRING },
            strategyExplanation: { type: Type.STRING }
          },
          required: ["subjectLine", "emailBody", "strategyExplanation"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as EmailResponse;
    }

    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Error generating email:", error);
    throw error;
  }
};

// Generate follow-up email
export const generateFollowUpEmail = async (
  data: FormData,
  followUpNumber: number,
  originalSubject?: string
): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const styles: { [key: number]: string } = {
    1: "The 'Quick Bump'. Just 1 sentence. Super casual. Like 'Hey, just bringing this to top of inbox.'",
    2: "The 'Value Add'. 'Saw this article and thought of you' angle or similar valuable insight.",
    3: "The 'Break-up'. 'Assuming this isn't a priority right now. I'll stop reaching out.'"
  };

  const style = styles[followUpNumber] || styles[1];

  const prompt = `
Write a short, effective follow-up email (follow-up #${followUpNumber}).
**GOAL:** Get a reply.
**TONE:** Professional but persistent. Normal human communication.

**STYLE:** ${style}

**SUBJECT:** "Re: ${originalSubject}"

**OUTPUT (JSON):**
{
  "subjectLine": "Re: ${originalSubject}",
  "emailBody": "The email content with <br><br> if needed",
  "strategyExplanation": "why this works"
}
`;

  try {
    const response = await getAIClient().models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subjectLine: { type: Type.STRING },
            emailBody: { type: Type.STRING },
            strategyExplanation: { type: Type.STRING }
          },
          required: ["subjectLine", "emailBody", "strategyExplanation"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as EmailResponse;
    }
    throw new Error("Empty response from AI");
  } catch (error) {
    console.error("Error generating follow-up:", error);
    throw error;
  }
};