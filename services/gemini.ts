import { GoogleGenAI, Type } from "@google/genai";
import { FormData, EmailResponse } from "../types";

// Initialize Gemini client using the environment variable API key
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
You are a top 0.1% cold email strategist. The goal is simple: MAXIMIZE REPLIES.
Forget "email rules". Focus on PSYCHOLOGY.

**THE SITUATION:**
1. You are a founder building an end-to-end automation tool.
2. It does EVERYTHING: Finds leads -> Qualifies them -> Sends the emails.
3. You have no clients yet, so you must offer an IRRESISTIBLE DEAL to get the first ones.
4. The Offer: "I will let you use this for FREE to prove it works."

**THE "IRRESISTIBLE OFFER" FRAME:**
"I've built a system that automates your entire outbound stack (finding leads + outreach). I'm confident it works, so I want to let you run a campaign for free to prove it."

**WHY THIS WINS:**
- It removes ALL risk (free).
- It promises the holy grail (end-to-end automation, not just another tool).
- It shows confidence ("prove it works").

---

**WRITE AN EMAIL THAT FEELS LIKE A "GOLDEN TICKET":**

**Subject Line:**
Must be short, intriguing, and look internal.
- "leads for ${data.companyName}"
- "your outreach"
- "question re: outbound"

**The Body Structure:**

1.  **The Hook (Pattern Interrupt):**
    Acknowledges the pain of doing this manually or paying for expensive tools.
    - "Most teams burn hours manually finding leads and sequencing them in Apollo."
    - "Quick question - are you handling your lead gen manually right now?"

2.  **The Solution (The "Magic Pill"):**
    Describe the end-to-end value.
    - "I built an automation that handles the whole loop: it identifies your ideal leads, qualifies them, and reaches out - completely on autopilot."
    - "We built a system that auto-finds qualified leads and starts conversations with them, so you don't have to touch a thing."

3.  **The Irresistible Offer (The "No-Brainer"):**
    Since you're new, trade access for success.
    - "Since we're just opening this up, I'd love to let you run a free campaign to see the results firsthand."
    - "I'm looking for a few case studies, so I'm happy to give you a free trial to prove it works."

4.  **The Call to Action (Low Friction):**
    - "Open to testing it out?"
    - "Worth a quick test run?"

---

**CONTEXT:**
- Sender: ${data.senderName} (${data.senderCompany})
- Recipient: ${data.recipientName} (${data.companyName})
- Industry: ${data.industry}

**CRITICAL GUIDELINES:**
- **NO FLUFF.** Every word must earn its place.
- **Tone:** Confident Founder. Not "sales rep hoping for a meeting".
- **Focus:** The RESULT (Leads/Outreach done for you), not the features.

---

**EXAMPLE OUTPUT:**

Subject: your outbound

Hi Rajendra,

Quick question - are you currently manually sourcing leads and uploading them to your sequencer?

I built a system that automates the entire loop: it finds qualified leads and reaches out to them for you, completely on autopilot.

I'd love to prove it works by letting you run a campaign for free.

Open to testing it out?

Hariom
Autonerve

---

**OUTPUT (JSON):**
{
  "subjectLine": "Short, intriguing subject",
  "emailBody": "[Hook]<br><br>[End-to-End Solution]<br><br>[Irresistible Free Offer]<br><br>${data.senderName}<br>${data.senderCompany}",
  "strategyExplanation": "Why this specific angle makes saying 'no' almost impossible"
}
`;



  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subjectLine: {
              type: Type.STRING,
              description: "The single highest-converting subject line using psychological triggers."
            },
            emailBody: {
              type: Type.STRING,
              description: "The final HTML email body."
            },
            strategyExplanation: {
              type: Type.STRING,
              description: "Explanation of the psychological trigger used and why it will convert."
            }
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

// Generate follow-up email with different tones based on follow-up number
export const generateFollowUpEmail = async (
  data: FormData,
  followUpNumber: number,
  originalSubject?: string
): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const followUpStyles: { [key: number]: string } = {
    1: "Gentle bump. 1-2 sentences. Example: 'Hey, just wanted to bump this. Still interested? No worries if not.'",
    2: "Share something helpful. Example: 'Quick thought - just helped a similar company with X. Made me think of you.'",
    3: "Break-up email. Last shot. Example: 'Looks like this isn't a priority. Totally get it. Here if things change!'"
  };

  const style = followUpStyles[followUpNumber] || followUpStyles[1];

  const prompt = `
Write a SUPER SHORT follow-up email (follow-up #${followUpNumber}).

**WHO:**
- From: ${data.senderName} (${data.senderCompany})
- To: ${data.recipientName} at ${data.companyName}
- Original subject: "${originalSubject || 'previous email'}"

**STYLE FOR #${followUpNumber}:** ${style}

**RULES:**
- MAX 2-3 sentences. No fluff.
- Sound like you're texting a friend.
- Use <br><br> for breaks.
- Signature: ${data.senderName}<br>${data.senderCompany}

**SUBJECT:** Use "Re: ${originalSubject}" OR something super short like "bump" or "quick follow up"

**OUTPUT (JSON):**
{
  "subjectLine": "short subject",
  "emailBody": "ultra-short follow-up with <br><br> breaks",
  "strategyExplanation": "why this works"
}
`;

  try {
    const response = await ai.models.generateContent({
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