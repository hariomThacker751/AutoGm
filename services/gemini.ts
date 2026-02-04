import { FormData, EmailResponse } from "../types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export const generateSalesEmail = async (data: FormData): Promise<EmailResponse> => {
  try {
    const response = await fetch(`${API_URL}/generate-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error generating email:", error);
    throw error;
  }
};

export const generateFollowUpEmail = async (
  data: FormData,
  followUpNumber: number,
  originalSubject?: string
): Promise<EmailResponse> => {
  try {
    const response = await fetch(`${API_URL}/generate-followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, followUpNumber, originalSubject })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error generating follow-up:", error);
    throw error;
  }
};