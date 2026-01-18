import { GoogleGenAI, Type } from "@google/genai";
import { FormData, EmailResponse } from "../types";

// Initialize Gemini client using the environment variable API key
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
You are writing a cold email that reads like a text from a friend, not a marketing pitch.

**THE GOAL:** Generate a response. That's it. No selling. Just start a conversation.

**CONTEXT:**
- You are: ${data.senderName} from ${data.senderCompany}
- Writing to: ${data.recipientName} at ${data.companyName} (${data.industry})
- Your offer: AI-powered sales automation (like an AI employee that does outreach 24/7)
${data.keyPainPoint ? `- Their pain point: ${data.keyPainPoint}` : ''}

**THE WINNING FORMULA (FOLLOW THIS EXACTLY):**

Email Body Structure (3-4 sentences MAX):
1. **Opening:** Start with a simple observation. Something like "I was checking out your profile..." or "Saw you're in ${data.industry}..."
2. **The Pitch (1 sentence):** Explain what you built and how it helps. Compare to something they know. Example: "We built X, which is like [known thing] but [key difference]."
3. **The Ask:** One simple question. "Are you open to trying it out at no cost?" or "Worth a quick look?"

Signature:
${data.senderName}<br>${data.senderCompany}

**WRITING RULES:**
- MAX 50 words in the body (before signature). Shorter = better.
- Write like you're texting a friend who happens to be a business owner.
- NO formal greetings. NO "I hope this finds you well".
- NO buzzwords. NO "leverage", "unlock", "boost", "transform", "comprehensive".
- NO multiple CTAs. Just ONE simple question.
- Use <br><br> between paragraphs.

**SUBJECT LINE:**
- Just their first name. "Hi ${data.recipientName}" or just "${data.recipientName}"
- OR: A 2-3 word casual phrase like "quick thought" or "saw your stuff"

**EXAMPLE OF A PERFECT EMAIL:**

Subject: Hi James

I was checking out your LinkedIn profile and thought this could be of value to you.<br><br>We built a tool called Uple, which is like ZoomInfo but with real-time email verification, and we're really affordable.<br><br>Are you open to trying it out at no cost?<br><br>${data.senderName}<br>${data.senderCompany}

**OUTPUT (JSON):**
{
  "subjectLine": "short casual subject",
  "emailBody": "ultra-short email body with <br><br> breaks",
  "strategyExplanation": "why this will get a reply"
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