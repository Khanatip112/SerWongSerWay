import { QuestionType as PrismaQuestionType, CampaignStatus as PrismaCampaignStatus } from '@prisma/client';

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

export interface QuestionOption {
  id: string;
  label: string;
  imageUrl?: string;
  targetSectionId?: string; // 'NEXT_SECTION' | 'SUBMIT_FORM' | section UUID
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
  allowedTypes?: string[]; // 'Document' | 'Spreadsheet' | 'PDF' | 'Video' | 'Presentation' | 'Drawing' | 'Image' | 'Audio'
  maxFiles?: number; // 1, 5, 10
  maxFileSizeMb?: number; // 1, 10, 100, 1000, 10000
}

export interface LinearScaleConfig {
  min: number; // 0 or 1
  max: number; // 2..10
  minLabel?: string;
  maxLabel?: string;
}

export interface RatingConfig {
  maxRating: number; // 3..10, default 5
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
  width?: number; // percentage or px
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

export interface SectionData {
  id: string;
  campaignId?: string;
  title: string;
  description?: string | null;
  orderIndex: number;
  nextAction: SectionNextAction;
  targetSectionId?: string | null;
}

export interface ContentBlockData {
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

export interface QuestionData {
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
