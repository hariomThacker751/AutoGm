import { GoogleGenAI, Type } from "@google/genai";
import { FormData, EmailResponse } from "../types";

// Initialize Gemini client using the environment variable API key
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
You are a top 0.1% cold email copywriter. Your goal: 35%+ reply rate.

**THE STRATEGY: "THE FOUNDER BETA"**
Most "free" offers sound like scams. To get replies, you must justify WHY it's free.
The best reason? "We're new and want case studies/feedback."

This frame builds:
1.  **Credibility:** You're a builder, not a salesperson.
2.  **Scarcity:** "Beta" implies limited spots.
3.  **Reciprocity:** You give value (free tool), they give value (feedback/case study).

---

**THE EMAIL STRUCTURE (Follow EXACTLY):**

**Subject:**
- "question"
- "outreach"
- "leads"
- "${data.companyName} + ${data.senderCompany}"
*(Keep it lowercase or simple. No "Great Offer!" styles)*

**Sentence 1: The Context (Why you're here)**
"I'm building a new tool for [Industry] teams that combines Apollo and Outreach into one automated platform."

**Sentence 2: The Value (The 'Better Way')**
"It handles lead sourcing and sending automatically, so you don't have to glue tools together."
*OR*
"It generates leads and runs outreach on autopilot, replacing your current manual stack."

**Sentence 3: The Ask (The 'Credible Free Offer')**
"I'm looking for early users to test it out (at $0 cost) in exchange for some feedback. Open to it?"

---

**STRICT RULES FOR TOP 1% RESULTS:**
1.  **NO "I hope you're well"**. Instant delete.
2.  **NO "I was checking out your LinkedIn"**. Everyone says this.
3.  **Under 50 words**. Respect their time.
4.  **Tone:** Peer-to-peer. Founder-to-Founder. Casual but professional.
5.  **The Deal:** Must be clear it's FREE in exchange for FEEDBACK/TESTING. This is the hook.

---

**CONTEXT:**
- Sender: ${data.senderName} (${data.senderCompany})
- Recipient: ${data.recipientName} (${data.companyName})
- Industry: ${data.industry}

---

**EXAMPLE OUTPUT (What 'Perfect' looks like):**

Subject: leads

Hi Rajendra,

I'm building a consolidated sales platform that combines lead sourcing and outreach - essentially Apollo + Outreach in one.<br><br>We're looking for a few early users to run it for free in exchange for feedback.<br><br>Would you be open to testing it out?<br><br>Hariom<br>Autonerve

---

**OUTPUT (JSON):**
{
  "subjectLine": "question" OR "leads" OR "outreach",
  "emailBody": "[Context]<br><br>[Value Prop]<br><br>[The Ask]<br><br>${data.senderName}<br>${data.senderCompany}",
  "strategyExplanation": "Why this specific email will get a reply"
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