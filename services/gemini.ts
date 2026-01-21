import { GoogleGenAI, Type } from "@google/genai";
import { FormData, EmailResponse } from "../types";

// Initialize Gemini client using the environment variable API key
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
Write a cold email from a founder to a founder.

**THE OUTCOME WE WANT:** 
A reply saying "Sure, send me a demo" or "I'm open to seeing it".

**THE PROBLEM WITH MOST EMAILS:**
They sound like sales pitches ("We help you do X").
They are generic ("I saw your LinkedIn").
They focus on features ("We have AI").

**THE WINNING ANGLE (THE "FOUNDER FRAME"):**
You are a builder who solved a problem. You are sharing it with a peer.
- **Identify the pain:** Paying for Apollo + Outreach + heavily manual work.
- **The solution:** A single tool that does both, automatically.
- **The specific benefit:** "You don't touch a thing" / "Runs on autopilot".

**WRITE THIS EXACT EMAIL STRUCTURE:**

Subject: Hi ${data.recipientName}

[OPENING - The "Pattern Interrupt"]
Start by calling out the current messy state of sales tech.
Examples:
- "Quick question - are you currently stitching together Apollo and Outreach?"
- "Curious how you're handling outbound right now - manual or automated?"
- "Quick one - building something that might kill your Apollo bill."

[THE PITCH - "The Better Way"]
Explain you built a unified system.
Structure: "We built a system that [does X and Y] automatically, so you don't have to [pain point]."
Example: "We built an autopilot for sales that finds the leads AND sends the emails - basically replacing the Apollo + Outreach stack for $0 upfront."

[THE ASK - Low Friction]
- "Mind if I send a quick video?"
- "Open to testing it out?"
- "Worth a peek?"

[SIGNATURE]
${data.senderName}
${data.senderCompany}

---

**STRICT RULES:**
- Tone: Casual, direct, peer-to-peer (no "Dear", no "Best regards")
- Length: Under 50 words.
- NO "I hope this finds you well".
- NO "I was checking out your LinkedIn".
- MUST mention replacing/combining Apollo/Outreach.
- MUST highlight the "Automated / Hands-free" aspect.

**OUTPUT JSON:**
{
  "subjectLine": "Hi ${data.recipientName}",
  "emailBody": "[Opening question]<br><br>[The Pitch: Apollo+Outreach replacement]<br><br>[The Ask]<br><br>${data.senderName}<br>${data.senderCompany}",
  "strategyExplanation": "Why this specific angle works"
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