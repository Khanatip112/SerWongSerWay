import { QuestionConfig, QuestionData } from '../types/survey.js';

export interface AnswerData {
  ratingValue?: number | null;
  textValue?: string | null;
  jsonValue?: unknown;
}

const ICON_LABELS: Record<string, string> = {
  STAR: '★',
  HEART: '♥',
  THUMBS_UP: '👍',
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionLabel(config: QuestionConfig, optionId: string): string {
  if (optionId === 'OTHER') return 'Other';
  return config.options?.find((opt) => opt.id === optionId)?.label || optionId;
}

function formatFileList(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value
    .map((file) => (typeof file === 'object' && file !== null ? String((file as { name?: string }).name || '') : String(file)))
    .filter(Boolean)
    .join(', ');
}

/**
 * Converts a persisted Answer row into a human-readable string for the results dashboard.
 * Option UUIDs are resolved to their labels, rating values get their icon, and grid answers
 * become "Row: Column" pairs.
 */
export function formatAnswer(question: QuestionData, answer: AnswerData): string {
  const config = (question.config || {}) as QuestionConfig;
  const { ratingValue, textValue, jsonValue } = answer;

  switch (question.type) {
    case 'RATING_5':
    case 'RATING': {
      const max = config.rating?.maxRating || 5;
      const value = ratingValue ?? (typeof jsonValue === 'number' ? jsonValue : null);
      if (value === null || value === undefined) return '';
      const icon = ICON_LABELS[config.rating?.icon || 'STAR'] || '★';
      return `${value} / ${max} ${icon}`;
    }

    case 'LINEAR_SCALE': {
      const min = config.linearScale?.min ?? 1;
      const max = config.linearScale?.max ?? 5;
      const value = ratingValue ?? (typeof jsonValue === 'number' ? jsonValue : null);
      if (value === null || value === undefined) return '';
      const labels =
        config.linearScale?.minLabel || config.linearScale?.maxLabel
          ? ` (${config.linearScale?.minLabel || min} → ${config.linearScale?.maxLabel || max})`
          : '';
      return `${value} / ${max}${labels}`;
    }

    case 'MULTIPLE_CHOICE':
    case 'DROPDOWN': {
      const record = asRecord(jsonValue);
      const optionId = typeof record.selectedOptionId === 'string' ? record.selectedOptionId : textValue || '';
      if (!optionId) return '';
      if (optionId === 'OTHER') {
        return `Other: ${String(record.otherText || textValue || '').trim()}`.trim();
      }
      return optionLabel(config, optionId);
    }

    case 'CHECKBOXES': {
      const selected = Array.isArray(jsonValue) ? jsonValue.map(String) : [];
      const labels = selected.map((id) => optionLabel(config, id));
      if (selected.includes('OTHER') && textValue) {
        return `${labels.filter((l) => l !== 'Other').join(', ')}${labels.length > 1 ? ', ' : ''}Other: ${textValue}`;
      }
      return labels.join(', ');
    }

    case 'MULTIPLE_CHOICE_GRID':
    case 'CHECKBOX_GRID': {
      const record = asRecord(jsonValue);
      const rows = config.grid?.rows || [];
      const columns = config.grid?.columns || [];
      const columnLabel = (id: string) => columns.find((c) => c.id === id)?.label || id;

      const parts: string[] = [];
      for (const row of rows) {
        const value = record[row.id];
        if (Array.isArray(value)) {
          if (value.length > 0) parts.push(`${row.label}: ${value.map((id) => columnLabel(String(id))).join(', ')}`);
        } else if (typeof value === 'string' && value) {
          parts.push(`${row.label}: ${columnLabel(value)}`);
        }
      }
      return parts.join('; ');
    }

    case 'FILE_UPLOAD':
      return formatFileList(jsonValue);

    case 'DATE':
    case 'TIME':
    case 'SHORT_ANSWER':
    case 'PARAGRAPH':
    case 'TEXT':
    default: {
      if (typeof textValue === 'string' && textValue.trim()) return textValue.trim();
      if (typeof jsonValue === 'string') return jsonValue.trim();
      if (jsonValue !== null && jsonValue !== undefined) return JSON.stringify(jsonValue);
      return '';
    }
  }
}
