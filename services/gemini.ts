import { GoogleGenAI, Type } from "@google/genai";
import { FormData, EmailResponse } from "../types";

// Initialize Gemini client using the environment variable API key
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_API_KEY });

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  const modelId = "gemini-2.5-flash";

  const prompt = `
    You are an elite Direct Response Copywriter executing a strict **Multi-Agent Workflow** to generate a "Grand Slam Offer" cold email.
    
    **GOAL:** The email must be so irresistibly good that the recipient would "feel stupid saying no". 
    **CRITICAL:** This is a 1-to-1 personal email. It must NOT sound like a newsletter, a blast, or "marketing".
    
    **AGENT 1: THE STRATEGIST (VALUE EQUATION)**
    Construct the "Grand Slam Offer" using Alex Hormozi's Value Equation:
    - **Dream Outcome:** ${data.keyPainPoint ? "Fixing " + data.keyPainPoint : "Automated Sales / Saved Time"}.
    - **Perceived Likelihood of Achievement:** High credibility.
    - **Time Delay:** Immediate (e.g., "Installed today").
    - **Effort/Sacrifice:** Zero (e.g., "Done-for-you", "No new tools").
    - **RISK REVERSAL (MANDATORY):** You must include a "Safe" guarantee. Focus on "Free Trial" or "Full Refund". Examples: "Free 7-day pilot", "Full refund if no results", "Pay nothing until you see value". Do NOT offer cash payouts.
    
    *Context:*
    - Sender: ${data.senderName} (${data.senderCompany}) -> Offer: "Automated AI Sales Agents".
    - Recipient: ${data.recipientName} (${data.companyName}, ${data.industry}).
    
    **AGENT 2: THE "ANTI-MARKETING" WRITER**
    Draft the email body.
    **STRICT PROHIBITIONS (Instant Fail if used):**
    - ❌ "I hope this email finds you well"
    - ❌ "Allow me to introduce myself"
    - ❌ "We are a leading agency"
    - ❌ "Unlock your potential"
    - ❌ "Boost your growth"
    - ❌ buzzwords like "synergy", "paradigm shift", "comprehensive solution".
    
    **REQUIRED TONE:**
    - **Blunt & Casual:** Like a busy CEO text-messaging another CEO.
    - **Formatting:** Use <br><br> for every visual break. Max 2 sentences per paragraph.
    - **Structure:**
      1. **The Hook (Spear):** A hyper-specific observation about ${data.companyName} or ${data.industry}.
      2. **The Gap:** "I noticed [Problem]. Most [Industry] companies bleed cash here."
      3. **The Grand Slam Offer:** "I built a system to fix it. I'll deploy it for you. You only pay if it works." (Make this shine).
      4. **The Soft Ask:** "Worth a quick chat?" or "Open to a demo?"
      5. **The Sign-off:** "Best,<br>${data.senderName}<br>${data.senderCompany}"
    
    **AGENT 3: THE SUBJECT LINE MASTER (MOST CRITICAL)**
    Generate a **KILLER** subject line that gets 60%+ open rates.
    
    **PSYCHOLOGICAL TRIGGERS TO USE (Pick 1-2):**
    1. **Curiosity Gap:** Create intrigue without revealing everything. Example: "found something about ${data.companyName}..."
    2. **Personalization:** Include their name or company. Example: "${data.recipientName} - quick idea"
    3. **Pattern Interrupt:** Break the expected format. Example: "weird ask", "bad timing?", "probably wrong but..."
    4. **Social Proof/Name Drop:** Example: "what [competitor] did", "saw your competitor doing..."
    5. **Question Format:** Open loops in their mind. Example: "${data.companyName} still doing X manually?"
    6. **Urgency/Scarcity (subtle):** Example: "before friday", "just noticed"
    7. **Re: or Fwd: Hack:** Makes it look like a reply. Example: "re: ${data.companyName} growth"
    
    **SUBJECT LINE RULES:**
    - Case: Use natural capitalization OR lowercase (both can work - match recipient's style if known)
    - Length: 4-8 words is ideal (not too short, not too long)
    - NO exclamation marks or ALL CAPS
    - NEVER use: "free", "offer", "limited", "exclusive", "opportunity", "partnership"
    - Sound personal and human - like a real person wrote it
    - Create ONE of: Curiosity, Urgency, Relevance, or Personal Connection
    
    **BANNED SUBJECT LINES:**
    ❌ "Partnership opportunity" ❌ "Quick question for you" ❌ "Introduction" 
    ❌ "Proposal" ❌ "Exciting opportunity" ❌ Any generic corporate speak
    ❌ Anything that sounds like marketing
    
    **HIGH-PERFORMING FORMULAS:**
    ✅ Name only: "${data.recipientName}" or "Hey ${data.recipientName}"
    ✅ Re-format: "Re: ${data.companyName}" or "Re: your ${data.industry} strategy"
    ✅ Question: "Question about ${data.companyName}" or "Is ${data.companyName} still...?"
    ✅ Observation: "Noticed something on your site" or "Saw your recent post"
    ✅ Mutual connection style: "${data.companyName} <> ${data.senderCompany}"
    ✅ Intrigue: "This might be off base..." or "Probably wrong timing"
    ✅ Specificity: "3 ${data.industry} leads you're missing" or "${data.companyName}'s weekend traffic"
    ✅ Competitor mention: "What [competitor name] is doing"
    
    **FINAL OUTPUT FORMAT (JSON):**
    {
      "subjectLine": "lowercase killer subject line here",
      "emailBody": "HTML body string",
      "strategyExplanation": "Explain which psychological trigger you used and why it will work for this specific recipient."
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

  const followUpStyles: { [key: number]: { tone: string; example: string } } = {
    1: {
      tone: "Gentle bump - very short, casual, just checking in",
      example: "Hey ${name}, just floating this back up. Still interested in chatting about [topic]? No worries if not."
    },
    2: {
      tone: "Value add - share a quick insight, case study, or relevant news",
      example: "Quick thought: I just helped a similar ${industry} company [achieve result]. Made me think of you. Worth a quick call?"
    },
    3: {
      tone: "Break-up email - last attempt, create urgency, very short",
      example: "Hey ${name}, I'll assume this isn't a priority right now. If things change, just reply to this thread. Wishing you the best!"
    }
  };

  const style = followUpStyles[followUpNumber] || followUpStyles[1];

  const prompt = `
    You are writing a FOLLOW-UP email #${followUpNumber} to someone who hasn't responded to your initial outreach.
    
    **CONTEXT:**
    - Sender: ${data.senderName} (${data.senderCompany})
    - Recipient: ${data.recipientName} (${data.companyName}, ${data.industry})
    - Original subject: "${originalSubject || 'previous email'}"
    - This is follow-up #${followUpNumber}
    
    **FOLLOW-UP STYLE FOR #${followUpNumber}:**
    ${style.tone}
    
    **EXAMPLE STRUCTURE:**
    ${style.example}
    
    **RULES:**
    1. Keep it SHORT - max 3-4 sentences
    2. Reference that you reached out before (but don't be annoying)
    3. Sound human and casual, not corporate
    4. Use <br><br> for paragraph breaks
    5. End with signature: "Best,<br>${data.senderName}"
    
    **SUBJECT LINE:**
    - Use "Re: " prefix to make it look like a reply thread
    - Or use something super short like "bump" or "following up"
    
    **OUTPUT FORMAT (JSON):**
    {
      "subjectLine": "re: previous subject or short follow-up",
      "emailBody": "HTML body - keep it SHORT",
      "strategyExplanation": "Why this approach works for follow-up #${followUpNumber}"
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