export type UserRole = 'CREATOR' | 'RESPONDENT';

export type CampaignStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

export type QuestionType =
  | 'RATING_5'
  | 'TEXT'
  | 'SHORT_ANSWER'
  | 'PARAGRAPH'
  | 'MULTIPLE_CHOICE'
  | 'CHECKBOXES'
  | 'DROPDOWN'
  | 'FILE_UPLOAD'
  | 'LINEAR_SCALE'
  | 'RATING'
  | 'MULTIPLE_CHOICE_GRID'
  | 'CHECKBOX_GRID'
  | 'DATE'
  | 'TIME';

export type SectionNextAction = 'NEXT_SECTION' | 'GO_TO_SECTION' | 'SUBMIT_FORM';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface QuestionOption {
  id: string;
  label: string;
  imageUrl?: string;
  targetSectionId?: string;
}

export interface GridItem {
  id: string;
  label: string;
}

export type TextValidationCategory = 'NUMBER' | 'TEXT' | 'LENGTH' | 'REGEX';

export interface TextValidationConfig {
  category: TextValidationCategory;
  operator: string;
  value?: string | number;
  secondValue?: string | number;
  errorText?: string;
}

export interface CheckboxValidationConfig {
  type: 'AT_LEAST' | 'AT_MOST' | 'EXACTLY';
  count: number;
  errorText?: string;
}

export interface FileUploadConfig {
  allowedTypesOnly?: boolean;
  allowedTypes?: string[];
  maxFiles?: number;
  maxFileSizeMb?: number;
}

export interface LinearScaleConfig {
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface RatingConfig {
  maxRating: number;
  icon: 'STAR' | 'HEART' | 'THUMBS_UP';
}

export interface GridConfig {
  rows: GridItem[];
  columns: GridItem[];
  requireEachRow?: boolean;
  limitOnePerColumn?: boolean;
  shuffleRows?: boolean;
}

export interface DateConfig {
  includeYear?: boolean;
  includeTime?: boolean;
}

export interface TimeConfig {
  mode?: 'TIME' | 'DURATION';
}

export interface QuestionImageConfig {
  url: string;
  alignment: 'left' | 'center' | 'right';
  width?: number;
  caption?: string;
}

export interface QuestionConfig {
  options?: QuestionOption[];
  hasOtherOption?: boolean;
  shuffleOptions?: boolean;
  goToSectionBasedOnAnswer?: boolean;
  textValidation?: TextValidationConfig;
  checkboxValidation?: CheckboxValidationConfig;
  fileUpload?: FileUploadConfig;
  linearScale?: LinearScaleConfig;
  rating?: RatingConfig;
  grid?: GridConfig;
  date?: DateConfig;
  time?: TimeConfig;
  [key: string]: unknown;
}

export interface Section {
  id: string;
  campaignId?: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  nextAction: SectionNextAction;
  targetSectionId?: string | null;
}

export interface ContentBlock {
  id: string;
  campaignId?: string;
  sectionId?: string | null;
  type: 'TEXT_BLOCK' | 'IMAGE_BLOCK';
  title?: string | null;
  description?: string | null;
  config?: {
    imageUrl?: string;
    alignment?: 'left' | 'center' | 'right';
    width?: number;
    caption?: string;
  } | null;
  orderIndex: number;
}

export interface Question {
  id: string;
  campaignId?: string;
  sectionId?: string | null;
  prompt: string;
  description?: string | null;
  type: QuestionType;
  required: boolean;
  orderIndex: number;
  config?: QuestionConfig | null;
  image?: QuestionImageConfig | null;
}

export interface AnswerItem {
  questionId?: string;
  questionPrompt?: string;
  type?: QuestionType;
  ratingValue?: number | null;
  textValue?: string | null;
  jsonValue?: unknown;
  formattedAnswer?: string;
}

export interface MySubmission {
  id: string;
  submittedAt: string;
  answers: AnswerItem[];
}

export interface Campaign {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  status: CampaignStatus;
  closesAt: string | null;
  createdAt: string;
  sections?: Section[];
  questions?: Question[];
  contentBlocks?: ContentBlock[];
  creator?: {
    id?: string;
    fullName: string;
    email?: string;
  };
  hasSubmitted?: boolean;
  mySubmission?: MySubmission | null;
  _count?: {
    submissions: number;
  };
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
