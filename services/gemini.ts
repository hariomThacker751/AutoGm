import { GoogleGenAI, Type } from "@google/genai";
import { FormData, EmailResponse } from "../types";

// Initialize Gemini client using the environment variable API key
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
Generate a 3-sentence cold email. Follow the template EXACTLY.

---

**TEMPLATE TO FOLLOW:**

Subject: Hi ${data.recipientName}

[SENTENCE 1 - Pick one of these EXACTLY:]
- "I was checking out your LinkedIn profile and thought this could be of value to you."
- "Came across ${data.companyName} and had a quick thought."

[SENTENCE 2 - USE THIS EXACT STRUCTURE:]
"We build [automations/AI tools] that [what it does], like [Outreach.io/Apollo/Salesloft] but [differentiator]."

PICK ONE OF THESE FOR SENTENCE 2:
- "We build automations that run your outreach on autopilot, like Outreach.io but completely hands-off."
- "We build AI that handles your sales pipeline end-to-end, like Apollo but without lifting a finger."
- "We build lead gen systems that work around the clock, like Salesloft but fully automated."

[SENTENCE 3 - USE THIS EXACTLY:]
"Are you open to trying it out at no cost?"

[SIGNATURE:]
${data.senderName}
${data.senderCompany}

---

**FORBIDDEN PHRASES (NEVER USE THESE):**
❌ "like having a dedicated employee"
❌ "like an extra salesperson"
❌ "like having a team member"
❌ "like a tireless worker"
❌ "24/7 to get you more conversations"
❌ "AI sales automation"

These phrases are BANNED. If you use them, YOU FAIL.

---

**REQUIRED COMPETITOR NAMES (MUST USE ONE):**
✅ Outreach.io
✅ Apollo
✅ Salesloft
✅ ZoomInfo
✅ HubSpot

You MUST mention one of these competitor names in sentence 2.

---

**CONTEXT:**
- From: ${data.senderName} at ${data.senderCompany}
- To: ${data.recipientName} at ${data.companyName} (${data.industry})
${data.keyPainPoint ? `- Note: ${data.keyPainPoint}` : ''}

---

**RULES:**
1. Subject = "Hi ${data.recipientName}" (nothing else)
2. DO NOT use ${data.recipientName}'s name in the body
3. Sentence 2 MUST contain Outreach.io, Apollo, Salesloft, ZoomInfo, or HubSpot
4. Use <br><br> between each sentence
5. Max 40 words in body (before signature)

---

**EXAMPLE OUTPUT:**

Subject: Hi James

I was checking out your LinkedIn profile and thought this could be of value to you.<br><br>We build automations that run your outreach on autopilot, like Outreach.io but completely hands-off.<br><br>Are you open to trying it out at no cost?<br><br>Will<br>UpLead

---

**YOUR OUTPUT (JSON):**
{
  "subjectLine": "Hi ${data.recipientName}",
  "emailBody": "[Sentence 1]<br><br>[Sentence 2 with Outreach.io/Apollo/Salesloft]<br><br>[Sentence 3]<br><br>${data.senderName}<br>${data.senderCompany}",
  "strategyExplanation": "Brief reason"
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