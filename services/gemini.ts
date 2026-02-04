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
# ROLE & EXPERTISE
You are a B2B cold email expert with 15+ years of experience writing high-converting outreach emails for lead generation agencies. You specialize in personalized, research-driven emails that achieve 15-25% reply rates.

# TASK
Generate a personalized cold email for B2B outreach based on the provided prospect data and context.

# CONTEXT & DATA INPUTS
- Prospect Name: ${data.recipientName}
- Company Name: ${data.companyName}
- Industry/Vertical: ${data.industry}
- Key Pain Point: ${data.keyPainPoint || "Manual lead generation"}
- Sender's Company Name: ${data.senderName} (${data.senderCompany})
- Business Model: Infer from industry (e.g., SaaS, E-commerce, Agency)

# CONSTRAINTS & REQUIREMENTS

## MUST-HAVE Elements:
1. **Local Connection Hook (Priority #1)**: If sender and prospect are in the same city/region, ALWAYS lead with this ("Fellow [City] founder...", "Another [City]-based entrepreneur here...")
2. **Business Model Vocabulary Precision**: 
   - B2B/SaaS companies → use "leads", "pipeline", "qualified prospects"
   - D2C/E-commerce → use "customers", "conversions", "sales"
   - Fashion/Retail → use "retail partners", "distributors", "influencers", "brand collaborations"
3. **Specificity Over Generic**: Reference their EXACT business model, not just industry
4. **Problem-First, Not Feature-First**: Lead with the pain point we solve, not our tool's capabilities
5. **Confident Tone**: Replace uncertain phrases ("I can only imagine...") with assertive statements ("Scaling X manually typically diverts...")
6. **Clear CTA**: Always end with ONE specific, low-commitment action (10-min call, demo link, pilot offer)

## FORBIDDEN Elements:
- Generic flattery ("I've been impressed by...")
- Vague value props ("help you grow", "increase efficiency")
- Multiple CTAs in one email
- Wall-of-text paragraphs (max 2-3 lines per paragraph)
- Overuse of bold/italics (max 1-2 instances)
- Salesy language ("game-changer", "revolutionary", "cutting-edge")

# OUTPUT FORMAT

## Subject Line Requirements:
- Max 8 words
- Include prospect's first name OR company name
- Format: "[Name/Company], [Benefit/Question]"
- Examples: "Rajendra, automate Fashion Dream's retail outreach?", "Ompax, AI for wholesale partner discovery"

## Email Body Structure:
1. **Opening (1-2 sentences)**: Local connection (if applicable) + specific observation about their business
2. **Problem Statement (1-2 sentences)**: The exact bottleneck they face (based on business model)
3. **Solution (2 sentences)**: What our AI does + who/what it finds (be SPECIFIC)
4. **Proof/Credibility (1 sentence)**: Social proof, result, or risk-reversal ("I'll let you run a campaign for **free** to prove it works.")
5. **CTA (1 sentence)**: Single, clear ask with low commitment

## Tone Guidelines:
- Conversational but professional
- Founder-to-founder (peer-level, not vendor-to-buyer)
- Confident without arrogance
- Helpful without being pushy
- 150-180 words max

**GENERATE JSON OUTPUT:**
{
  "subjectLine": "The personalized subject line",
  "emailBody": "The HTML body with <br><br> for breaks",
  "strategyExplanation": "Explain how you used the business model vocabulary and specific data points."
}
`;

  try {
    const response = await getAIClient().models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.7,
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