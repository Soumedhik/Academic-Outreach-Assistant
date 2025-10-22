import { GoogleGenAI, Type } from "@google/genai";
import { Contact, ResumeData, Email } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const cleanJsonString = (str: string): string => {
  // Remove markdown backticks and 'json' language identifier
  const cleaned = str.replace(/^```json\s*|```$/g, '').trim();

  // Find the substring that starts with the first '{' or '[' and ends with the last '}' or ']'
  const firstOpen = cleaned.indexOf('[');
  const firstCurly = cleaned.indexOf('{');
  
  let start = -1;
  if (firstOpen === -1) start = firstCurly;
  else if (firstCurly === -1) start = firstOpen;
  else start = Math.min(firstOpen, firstCurly);

  if (start === -1) return cleaned; // No JSON found

  const lastClose = cleaned.lastIndexOf(']');
  const lastCurly = cleaned.lastIndexOf('}');
  
  const end = Math.max(lastClose, lastCurly);

  if (end === -1 || end < start) return cleaned; // No valid JSON structure.

  return cleaned.substring(start, end + 1);
};


export const parseResume = async (resume: { name: string; mimeType: string; data: string }): Promise<ResumeData> => {
    const model = 'gemini-2.5-flash';
    const resumePart = { inlineData: { mimeType: resume.mimeType, data: resume.data } };

    const prompt = `
        Analyze the provided resume and extract the following information.
        Return the result as a single JSON object.
        
        1.  "skills": An array of strings listing the key technical skills, languages, and technologies.
        2.  "educationLevel": A string representing the highest level of education mentioned (e.g., "PhD in Computer Science", "Master of Science in Biology", "Bachelor of Arts in English").
        3.  "projects": An array of strings, where each string is a concise one-sentence summary of a key project mentioned in the resume. Extract up to 3 of the most relevant projects.
        
        Your response MUST be only a valid JSON object. Do not include any other text, explanations, or markdown formatting.
    `;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }, resumePart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                    educationLevel: { type: Type.STRING },
                    projects: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['skills', 'educationLevel', 'projects']
            }
        },
    });

    try {
        const cleanedText = cleanJsonString(response.text);
        const parsedJson = JSON.parse(cleanedText);
        return {
            ...resume,
            skills: parsedJson.skills || [],
            educationLevel: parsedJson.educationLevel || "Not found",
            projects: parsedJson.projects || [],
        };
    } catch (error) {
        console.error("Failed to parse resume analysis response:", response.text, error);
        throw new Error("The model's response for resume analysis was not valid JSON.");
    }
};


export const findContacts = async (university: string, department: string, resume: ResumeData): Promise<Contact[]> => {
  const model = "gemini-2.5-pro";
  const resumePart = {
    inlineData: {
      mimeType: resume.mimeType,
      data: resume.data,
    },
  };

  const prompt = `
    Your task is to act as an expert academic researcher. Based on the provided applicant profile and target university/department, find relevant academic contacts.

    **Target:**
    - **University:** ${university}
    - **Department / Field of Study:** ${department}

    **Applicant Profile:**
    - **Key Skills:** ${resume.skills.join(', ')}
    - **Education:** ${resume.educationLevel}
    - **Project Experience:** ${resume.projects.join('; ')}

    **Search Strategy:**
    1.  **Identify Potential Contacts:** Find contacts at the specified university and department whose research strongly aligns with the applicant's profile. Search for a diverse range of personnel: Professors, Assistant/Associate Professors, Research Scientists, Lab Managers, and senior PhD students.
    2.  **Prioritize Email Retrieval:** Finding a valid academic email address is the highest priority. Use multiple search queries to find it. Look for official university directory pages, faculty profile pages, lab websites, and publications. An email is crucial for outreach.
    3.  **Gather Supporting Information:** For each contact, find their official title, a summary of their relevant research interests, their lab/personal website, a recent publication, and their LinkedIn profile URL.
    4.  **Verify Information:** Cross-reference information from multiple sources to ensure accuracy, especially for email addresses.

    **Output Format:**
    Return the result as a JSON array of objects. Each object must have these properties: "name", "title", "email", "researchInterests", "labWebsite", "recentPublication", and "linkedinProfile".
    - "name": The contact's full name.
    - "title": The contact's official title (e.g., "Professor of Computer Science", "PhD Candidate").
    - "email": The contact's verified academic email address. If a valid email cannot be found after a thorough search, this MUST be null.
    - "researchInterests": A concise one-sentence summary of their key research areas relevant to the applicant's resume.
    - "labWebsite": The URL to their lab or personal academic website. Set to null if not found.
    - "recentPublication": The title of one of their recent, relevant publications. Set to null if not found.
    - "linkedinProfile": The full URL to their LinkedIn profile. Set to null if not found.

    **CRITICAL INSTRUCTIONS:**
    - Your response MUST be only a valid JSON array. Do not include any other text, explanations, or markdown formatting.
    - If, after a thorough search, you cannot find any suitable contacts, you MUST return an empty JSON array: [].
  `;

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text: prompt }, resumePart] },
    config: {
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 32768 },
    },
  });

  try {
    const cleanedText = cleanJsonString(response.text);
    const result = JSON.parse(cleanedText);
    if (Array.isArray(result)) {
        // Basic check if the items (if any) look like contact objects.
        if (result.length > 0 && !result.every(item => 'name' in item && 'title' in item && 'researchInterests' in item)) {
             throw new Error('Parsed JSON is not in the expected format.');
        }
        return result as Contact[];
    }
    throw new Error('Parsed JSON is not an array.');
  } catch (error) {
    console.error("Failed to parse Gemini response:", response.text, error);
    throw new Error("The model's response was not valid JSON. Please try again.");
  }
};

export const generateEmailForContact = async (contact: Contact, purpose: string, resume: ResumeData): Promise<Omit<Email, 'sent'>> => {
    const model = 'gemini-2.5-pro';
    const studentName = "the applicant"; // In a real app, this would be parsed from the resume or input by user.

    const resumePart = {
        inlineData: {
          mimeType: resume.mimeType,
          data: resume.data,
        },
    };

    const prompt = `
        You are an expert academic writing assistant. Your task is to draft a personalized, professional, and concise cold email.

        **Instructions:**
        1.  **Recipient:** ${contact.name}, who is a ${contact.title}.
        2.  **Their Research:** ${contact.researchInterests}. Their recent work may include "${contact.recentPublication}".
        3.  **Sender Profile:**
            - **Key Skills:** ${resume.skills.join(', ')}
            - **Education:** ${resume.educationLevel}
            - **Relevant Project:** "${resume.projects[0] || 'a relevant project'}"
        4.  **Purpose:** The student is writing to ${purpose}.
        5.  **Tone:** Respectful, professional, and enthusiastic.
        
        **Email Content:**
        -   Create a concise and compelling subject line.
        -   Address the contact formally and appropriately based on their title (e.g., "Dear Professor ${contact.name.split(' ').pop()}," or "Dear Dr. ${contact.name.split(' ').pop()}," for faculty, or "Dear ${contact.name}," for students).
        -   In the first paragraph, state the purpose of the email directly.
        -   In the second paragraph, briefly connect the student's background to the contact's specific research. Explicitly mention one or two of the applicant's key skills or a specific project to demonstrate clear alignment.
        -   Conclude by expressing enthusiasm for their work, attaching the resume for their convenience, and politely suggesting a next step (e.g., a brief meeting).
        -   Keep the entire email body under 200 words.
        -   Sign off professionally as ${studentName}.

        Return the result as a single JSON object with two properties: "subject" and "body". Do not include any other text or markdown formatting.
        Example format:
        {
            "subject": "Inquiry from a Prospective PhD Student",
            "body": "Dear Dr. ${contact.name.split(' ').pop()},\\n\\nI am writing to express my keen interest in your research..."
        }
    `;

    const response = await ai.models.generateContent({
        model,
        contents: { parts: [{text: prompt}, resumePart] },
        config: {
            thinkingConfig: { thinkingBudget: 32768 },
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    subject: { type: Type.STRING },
                    body: { type: Type.STRING }
                },
                required: ['subject', 'body']
            }
        },
    });

    try {
        const cleanedText = cleanJsonString(response.text);
        const emailContent = JSON.parse(cleanedText);
        return {
            to: contact.email!,
            subject: emailContent.subject,
            body: emailContent.body
        };
    } catch (error) {
        console.error("Failed to parse email generation response:", response.text, error);
        throw new Error("The model's response for email generation was not valid JSON.");
    }
};