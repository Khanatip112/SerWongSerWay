export type UserRole = 'CREATOR' | 'RESPONDENT';

export type CampaignStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

export type QuestionType = 'RATING_5' | 'TEXT';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface Question {
  id: string;
  campaignId?: string;
  prompt: string;
  type: QuestionType;
  required: boolean;
  orderIndex: number;
}

export interface Campaign {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  status: CampaignStatus;
  closesAt: string | null;
  createdAt: string;
  questions?: Question[];
  creator?: {
    id?: string;
    fullName: string;
    email?: string;
  };
  hasSubmitted?: boolean;
  _count?: {
    submissions: number;
  };
}

export interface AnswerItem {
  questionPrompt?: string;
  type?: QuestionType;
  ratingValue?: number | null;
  textValue?: string | null;
}

export interface SubmissionItem {
  id: string;
  respondentName: string;
  submittedAt: string;
  answers: AnswerItem[];
}

export interface CampaignResults {
  campaign: {
    id: string;
    title: string;
    status: CampaignStatus;
  };
  summary: {
    totalSubmissions: number;
    averageRating: number;
  };
  submissions: SubmissionItem[];
}
