import { GoogleGenAI, Type } from "@google/genai";
import { FormData, EmailResponse } from "../types";

// Initialize Gemini client using the environment variable API key
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
Write a cold email that gets replies.

**THE ORIGINAL EMAIL THAT GENERATED $1M ARR:**

Subject: Hi James

I was checking out your LinkedIn profile and thought this could be of value to you.

We built a tool called Uple, which is like ZoomInfo but with real-time email verification, and we're really affordable.

Are you open to trying it out at no cost?

Will
UpLead

**WHY IT WORKS:**
1. Simple opening - no fake flattery
2. Clear comparison - "like ZoomInfo but..." (instant understanding)
3. Specific differentiator - "real-time email verification" + "affordable"
4. Zero-risk ask - "at no cost"
5. 35 words - respects their time

---

**YOUR USP:**
You build an automation system that:
1. Finds and generates leads for them
2. Reaches out to those leads automatically
3. They can try it at zero cost

This is like having Apollo + Outreach.io combined, running on autopilot.

---

**WRITE THIS EMAIL:**

Subject: Hi ${data.recipientName}

[OPENING - one of these:]
- "Quick one for you."
- "Thought this might help."
- "Random reach out, but hear me out."

[PITCH - be SPECIFIC about value:]
The pitch must clearly say WHAT it does. Not vague "automation" - specific value.

GOOD: "We built a system that finds leads and reaches out to them for you - like having Apollo and Outreach.io running together, hands-free."

BAD: "We build automation that helps with outreach" (too vague)

[ASK - zero risk:]
"Want to try it at zero cost?"

[SIGNATURE:]
${data.senderName}
${data.senderCompany}

---

**EXACT OUTPUT EXAMPLE:**

Subject: Hi Rajendra

Quick one for you.<br><br>We built a system that finds leads and reaches out to them automatically - like Apollo + Outreach.io combined, but you don't touch a thing.<br><br>Want to try it at zero cost?<br><br>Hariom<br>Autonerve

---

**CONTEXT:**
- From: ${data.senderName} at ${data.senderCompany}
- To: ${data.recipientName} at ${data.companyName}
- Industry: ${data.industry}
${data.keyPainPoint ? `- Note: ${data.keyPainPoint}` : ''}

---

**STRICT RULES:**
1. Subject = "Hi ${data.recipientName}" only
2. NO name in body
3. Pitch MUST mention "finds leads" AND "reaches out" - both parts of the value
4. MUST compare to Apollo, Outreach.io, or Salesloft
5. ASK must include "zero cost" or "no cost"
6. Under 40 words in body
7. Use <br><br> between sentences

---

**BANNED (instant delete triggers):**
- "I was checking out your LinkedIn" (overused)
- "I hope this finds you well"
- "We build automations that..."
- "AI-powered" / "AI sales automation"
- Any sentence over 20 words

---

**OUTPUT (JSON):**
{
  "subjectLine": "Hi ${data.recipientName}",
  "emailBody": "[Short opening]<br><br>[Specific pitch: finds leads + reaches out + comparison]<br><br>[Zero cost ask]<br><br>${data.senderName}<br>${data.senderCompany}",
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