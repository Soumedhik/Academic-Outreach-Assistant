export enum Step {
  Input = 1,
  Select = 2,
  Review = 3,
}

export interface ResumeData {
  name: string;
  mimeType: string;
  data: string;
  skills: string[];
  educationLevel: string;
  projects: string[];
}

export interface Contact {
  name: string;
  title: string;
  email: string | null;
  researchInterests: string;
  labWebsite: string | null;
  recentPublication: string | null;
  linkedinProfile: string | null;
}

export interface Email {
  to: string;
  subject: string;
  body: string;
  sent: boolean;
}

export interface HistoryEntry {
  to: string;
  subject: string;
  body: string;
  dateSent: string;
}