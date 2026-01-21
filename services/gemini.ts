import { GoogleGenAI, Type } from "@google/genai";
import { FormData, EmailResponse } from "../types";

// Initialize Gemini client using the environment variable API key
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
You are writing a cold email that will actually get a response.

Here's the thing: Most cold emails fail because they SOUND like cold emails.
- "I was checking out your LinkedIn profile" = DEAD. Everyone says this.
- "We build solutions that..." = CORPORATE. No one talks like this.
- "I hope this finds you well" = INSTANT DELETE.

Your email needs to feel like a quick note from someone who genuinely thinks they can help. Not a pitch. Not a template. A real message.

---

**THE PSYCHOLOGY:**

The recipient gets 50+ emails a day. They scan for 2 seconds and decide: delete or read?

What makes them read:
- It's SHORT (under 35 words)
- It feels PERSONAL (not mass-sent)
- It's EASY to respond to (yes/no question)
- There's NO RISK (free offer)

What makes them delete:
- Long paragraphs
- Corporate speak
- Obvious templates
- Pushy asks

---

**YOUR EMAIL (3 PARTS):**

**OPENING (Pick the vibe that fits):**
Choose ONE. Make it feel natural, not templated:

- "Quick thought for you."
- "Hey - stumbled across your company and had an idea."
- "Random, but I think this could help."
- "Saw what you're doing at ${data.companyName} - pretty cool."

DO NOT say "I was checking out your LinkedIn profile" - it's overused and sounds fake.

**THE PITCH (One sentence, conversational):**
Explain what you do like you're telling a friend at a coffee shop. Compare to something they know.

Good examples:
- "We built something that basically runs your outreach for you - like Outreach.io but on autopilot."
- "We've got this tool that handles cold email end-to-end - think Apollo but you don't have to touch anything."
- "Basically, we automate the boring parts of sales outreach - like having Salesloft but hands-free."

Notice the casual language: "basically", "we've got", "think X but Y". This is how humans talk.

**THE ASK (Super easy to say yes to):**
- "Open to trying it at no cost?"
- "Interested in a free trial?"

---

**SIGNATURE:**
${data.senderName}
${data.senderCompany}

---

**THE FINAL EMAIL SHOULD LOOK LIKE THIS:**

Subject: Hi ${data.recipientName}

Quick thought for you.<br><br>We built something that runs your outreach on autopilot - basically like Outreach.io but hands-free.<br><br>Open to trying it at no cost?<br><br>${data.senderName}<br>${data.senderCompany}

That's it. 28 words. No fluff. Easy yes or no.

---

**CONTEXT:**
- From: ${data.senderName} at ${data.senderCompany}
- To: ${data.recipientName} at ${data.companyName}
- Industry: ${data.industry}
${data.keyPainPoint ? `- Note: ${data.keyPainPoint}` : ''}

---

**RULES:**
1. Subject line = "Hi ${data.recipientName}" ONLY
2. NEVER use their name in the body (subject already greets them)
3. MUST mention Outreach.io, Apollo, or Salesloft as comparison
4. Under 35 words in body (excluding signature)
5. Use <br><br> between sentences
6. Sound like a quick note, not a sales pitch

---

**BANNED PHRASES (these scream "TEMPLATE"):**
- "I was checking out your LinkedIn profile"
- "I hope this email finds you well"
- "I wanted to reach out"
- "We build automations that..."
- "AI-powered sales automation"
- "drive leads and generate sales"
- "like having a dedicated employee"

---

**OUTPUT (JSON):**
{
  "subjectLine": "Hi ${data.recipientName}",
  "emailBody": "[Natural opening]<br><br>[Conversational pitch with competitor comparison]<br><br>[Easy ask]<br><br>${data.senderName}<br>${data.senderCompany}",
  "strategyExplanation": "Why this will get a reply"
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