import {
  QuestionData,
  QuestionConfig,
  TextValidationConfig,
  FileUploadConfig,
} from '../types/survey.js';

export interface ValidationError {
  questionId: string;
  prompt: string;
  message: string;
}

export const FILE_TYPE_EXTENSIONS: Record<string, string[]> = {
  Document: ['doc', 'docx', 'txt', 'rtf', 'odt'],
  Spreadsheet: ['xls', 'xlsx', 'csv', 'ods'],
  PDF: ['pdf'],
  Video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'],
  Presentation: ['ppt', 'pptx', 'odp'],
  Drawing: ['drawio', 'svg'],
  Image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
  Audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
};

const FILE_TYPE_MIME_PREFIXES: Record<string, string[]> = {
  Document: ['text/plain', 'application/msword', 'application/rtf', 'application/vnd.oasis.opendocument.text'],
  Spreadsheet: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.spreadsheet'],
  PDF: ['application/pdf'],
  Video: ['video/'],
  Presentation: ['application/vnd.ms-powerpoint', 'application/vnd.oasis.opendocument.presentation'],
  Drawing: ['image/svg+xml'],
  Image: ['image/'],
  Audio: ['audio/'],
};

export function fileMatchesAllowedTypes(
  file: { name?: string; type?: string },
  allowedTypes: string[]
): boolean {
  if (allowedTypes.length === 0) return true;
  const name = (file.name || '').toLowerCase();
  const extension = name.includes('.') ? name.split('.').pop() || '' : '';
  const mime = (file.type || '').toLowerCase();

  return allowedTypes.some((category) => {
    const extensions = FILE_TYPE_EXTENSIONS[category] || [];
    if (extension && extensions.includes(extension)) return true;
    const prefixes = FILE_TYPE_MIME_PREFIXES[category] || [];
    return prefixes.some((prefix) => (prefix.endsWith('/') ? mime.startsWith(prefix) : mime === prefix));
  });
}

function isAnswerBlank(answer: { ratingValue?: number | null; textValue?: string | null; jsonValue?: unknown } | undefined): boolean {
  if (!answer) return true;
  const hasRating = answer.ratingValue !== null && answer.ratingValue !== undefined;
  const hasText = typeof answer.textValue === 'string' && answer.textValue.trim() !== '';
  const json = answer.jsonValue;

  if (hasRating || hasText) return false;
  if (json === null || json === undefined) return true;
  if (typeof json === 'string') return json.trim() === '';
  if (Array.isArray(json)) return json.length === 0;
  if (typeof json === 'object') return Object.keys(json as Record<string, unknown>).length === 0;
  return false;
}

function error(question: QuestionData, message: string): ValidationError {
  return { questionId: question.id, prompt: question.prompt, message };
}

export function validateAnswer(
  question: QuestionData,
  answer: { ratingValue?: number | null; textValue?: string | null; jsonValue?: unknown } | undefined
): ValidationError | null {
  const config = (question.config || {}) as QuestionConfig;

  const ratingValue = answer?.ratingValue;
  const textValue = answer?.textValue ? answer.textValue.trim() : null;
  const jsonValue = answer?.jsonValue;

  // Required Check
  if (question.required && isAnswerBlank(answer)) {
    return error(question, `Answer required for question: "${question.prompt}"`);
  }

  // If blank and not required, pass validation
  if (isAnswerBlank(answer)) {
    return null;
  }

  switch (question.type) {
    case 'RATING_5':
    case 'RATING': {
      const max = config.rating?.maxRating || 5;
      const num = ratingValue ?? (typeof jsonValue === 'number' ? jsonValue : null);
      if (num === null || num === undefined) {
        if (question.required) {
          return error(question, `Rating score required for question: "${question.prompt}"`);
        }
      } else if (!Number.isInteger(num) || num < 1 || num > max) {
        return error(question, `Rating value must be an integer between 1 and ${max} inclusive.`);
      }
      break;
    }

    case 'LINEAR_SCALE': {
      const min = config.linearScale?.min ?? 1;
      const max = config.linearScale?.max ?? 5;
      const num = ratingValue ?? (typeof jsonValue === 'number' ? jsonValue : null);
      if (num === null || num === undefined) {
        if (question.required) {
          return error(question, `Scale rating required for question: "${question.prompt}"`);
        }
      } else if (!Number.isInteger(num) || num < min || num > max) {
        return error(question, `Scale value must be between ${min} and ${max}.`);
      }
      break;
    }

    case 'SHORT_ANSWER':
    case 'TEXT':
    case 'PARAGRAPH': {
      const text = textValue ?? (typeof jsonValue === 'string' ? jsonValue.trim() : '');
      if (question.required && (!text || text === '')) {
        return error(question, `Text feedback required for question: "${question.prompt}"`);
      }

      if (text && config.textValidation) {
        const valErr = validateTextRules(text, config.textValidation);
        if (valErr) {
          return error(question, config.textValidation.errorText || valErr);
        }
      }
      break;
    }

    case 'CHECKBOXES': {
      const selected = Array.isArray(jsonValue) ? jsonValue.map(String) : [];
      if (question.required && selected.length === 0) {
        return error(question, `Please select at least one option for: "${question.prompt}"`);
      }

      if (selected.includes('OTHER') && !textValue) {
        return error(question, `Please specify the "Other" response for: "${question.prompt}"`);
      }

      if (config.checkboxValidation && selected.length > 0) {
        const { type, count, errorText } = config.checkboxValidation;
        if (type === 'AT_LEAST' && selected.length < count) {
          return error(question, errorText || `Select at least ${count} options.`);
        }
        if (type === 'AT_MOST' && selected.length > count) {
          return error(question, errorText || `Select at most ${count} options.`);
        }
        if (type === 'EXACTLY' && selected.length !== count) {
          return error(question, errorText || `Select exactly ${count} options.`);
        }
      }
      break;
    }

    case 'MULTIPLE_CHOICE':
    case 'DROPDOWN': {
      const sel =
        typeof jsonValue === 'object' && jsonValue !== null
          ? (jsonValue as { selectedOptionId?: string; otherText?: string })
          : null;
      const selectedOptionId = sel?.selectedOptionId || textValue;

      if (question.required && !selectedOptionId) {
        return error(question, `Please choose an option for: "${question.prompt}"`);
      }

      if (selectedOptionId) {
        if (selectedOptionId === 'OTHER') {
          if (!config.hasOtherOption) {
            return error(question, `Invalid option selected for: "${question.prompt}"`);
          }
          if (!sel?.otherText || !sel.otherText.trim()) {
            return error(question, `Please specify the "Other" response for: "${question.prompt}"`);
          }
        } else if (
          config.options &&
          config.options.length > 0 &&
          !config.options.some((opt) => opt.id === selectedOptionId)
        ) {
          return error(question, `Invalid option selected for: "${question.prompt}"`);
        }
      }
      break;
    }

    case 'FILE_UPLOAD': {
      const files = Array.isArray(jsonValue) ? jsonValue : [];
      if (question.required && files.length === 0) {
        return error(question, `Please upload required file(s) for: "${question.prompt}"`);
      }
      if (config.fileUpload && files.length > 0) {
        const { maxFiles, maxFileSizeMb, allowedTypesOnly, allowedTypes } = config.fileUpload;
        const fileLimit = maxFiles || 10;
        if (files.length > fileLimit) {
          return error(question, `Maximum ${fileLimit} files allowed.`);
        }
        const maxBytes = (maxFileSizeMb || 10) * 1024 * 1024;
        for (const file of files as Array<{ size?: number; name?: string; type?: string }>) {
          if (file.size && file.size > maxBytes) {
            return error(
              question,
              `File "${file.name || 'uploaded'}" exceeds maximum size of ${maxFileSizeMb}MB.`
            );
          }
          if (allowedTypesOnly && !fileMatchesAllowedTypes(file, allowedTypes || [])) {
            return error(question, `File "${file.name || 'uploaded'}" is not an allowed file type.`);
          }
        }
      }
      break;
    }

    case 'MULTIPLE_CHOICE_GRID': {
      const gridMap = (typeof jsonValue === 'object' && jsonValue !== null ? jsonValue : {}) as Record<
        string,
        string
      >;
      const rows = config.grid?.rows || [];
      const answeredRows = rows.filter((r) => !!gridMap[r.id]);

      if (config.grid?.requireEachRow) {
        for (const r of rows) {
          if (!gridMap[r.id]) {
            return error(question, `This question requires one response per row: "${r.label}"`);
          }
        }
      } else if (question.required && answeredRows.length === 0) {
        return error(question, `Please fill in at least one row for: "${question.prompt}"`);
      }

      if (config.grid?.limitOnePerColumn) {
        const colValues = Object.values(gridMap).filter(Boolean);
        if (new Set(colValues).size !== colValues.length) {
          return error(question, `Don't select more than one response per column.`);
        }
      }
      break;
    }

    case 'CHECKBOX_GRID': {
      const gridMap = (typeof jsonValue === 'object' && jsonValue !== null ? jsonValue : {}) as Record<
        string,
        string[]
      >;
      const rows = config.grid?.rows || [];
      const rowHasValue = (rowId: string) => Array.isArray(gridMap[rowId]) && gridMap[rowId].length > 0;
      const answeredRows = rows.filter((r) => rowHasValue(r.id));

      if (config.grid?.requireEachRow) {
        for (const r of rows) {
          if (!rowHasValue(r.id)) {
            return error(question, `This question requires at least one response per row: "${r.label}"`);
          }
        }
      } else if (question.required && answeredRows.length === 0) {
        return error(question, `Please fill in at least one row for: "${question.prompt}"`);
      }

      if (config.grid?.limitOnePerColumn) {
        const colCounts: Record<string, number> = {};
        for (const cols of Object.values(gridMap)) {
          if (Array.isArray(cols)) {
            for (const colId of cols) {
              colCounts[colId] = (colCounts[colId] || 0) + 1;
              if (colCounts[colId] > 1) {
                return error(question, `Don't select more than one response per column.`);
              }
            }
          }
        }
      }
      break;
    }

    case 'DATE': {
      const dateStr = textValue || (typeof jsonValue === 'string' ? jsonValue : '');
      if (!dateStr) {
        if (question.required) {
          return error(question, `Please enter a valid date for: "${question.prompt}"`);
        }
        break;
      }
      const includeTime = config.date?.includeTime;
      const includeYear = config.date?.includeYear !== false;
      const datePattern = includeYear
        ? includeTime
          ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
          : /^\d{4}-\d{2}-\d{2}$/
        : includeTime
          ? /^\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
          : /^\d{2}-\d{2}$/;
      if (!datePattern.test(dateStr)) {
        return error(question, `Please enter a valid date for: "${question.prompt}"`);
      }
      break;
    }

    case 'TIME': {
      const timeStr = textValue || (typeof jsonValue === 'string' ? jsonValue : '');
      if (!timeStr) {
        if (question.required) {
          return error(question, `Please enter a valid time for: "${question.prompt}"`);
        }
        break;
      }
      const pattern = config.time?.mode === 'DURATION' ? /^\d{1,3}:\d{2}:\d{2}$/ : /^\d{2}:\d{2}$/;
      if (!pattern.test(timeStr)) {
        return error(question, `Please enter a valid time for: "${question.prompt}"`);
      }
      break;
    }
  }

  return null;
}

export function validateTextRules(text: string, rule: TextValidationConfig): string | null {
  const { category, operator, value, secondValue } = rule;

  if (category === 'NUMBER') {
    const num = Number(text);
    if (isNaN(num)) return 'Must be a valid number.';
    const valNum = Number(value);
    const secNum = Number(secondValue);

    switch (operator) {
      case 'GT':
        if (!(num > valNum)) return `Must be greater than ${valNum}.`;
        break;
      case 'GTE':
        if (!(num >= valNum)) return `Must be greater than or equal to ${valNum}.`;
        break;
      case 'LT':
        if (!(num < valNum)) return `Must be less than ${valNum}.`;
        break;
      case 'LTE':
        if (!(num <= valNum)) return `Must be less than or equal to ${valNum}.`;
        break;
      case 'EQ':
        if (!(num === valNum)) return `Must be equal to ${valNum}.`;
        break;
      case 'NEQ':
        if (!(num !== valNum)) return `Must not be equal to ${valNum}.`;
        break;
      case 'BETWEEN':
        if (!(num >= valNum && num <= secNum)) return `Must be between ${valNum} and ${secNum}.`;
        break;
      case 'NOT_BETWEEN':
        if (num >= valNum && num <= secNum) return `Must not be between ${valNum} and ${secNum}.`;
        break;
      case 'IS_NUMBER':
        if (isNaN(num)) return 'Must be a number.';
        break;
      case 'WHOLE_NUMBER':
        if (!Number.isInteger(num)) return 'Must be a whole number.';
        break;
    }
  } else if (category === 'TEXT') {
    switch (operator) {
      case 'CONTAINS':
        if (!text.includes(String(value || ''))) return `Must contain "${value}".`;
        break;
      case 'NOT_CONTAINS':
        if (text.includes(String(value || ''))) return `Must not contain "${value}".`;
        break;
      case 'EMAIL':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return 'Must be a valid email address.';
        break;
      case 'URL':
        if (!/^https?:\/\/.+/i.test(text)) return 'Must be a valid URL starting with http:// or https://.';
        break;
    }
  } else if (category === 'LENGTH') {
    const minOrMax = Number(value);
    if (operator === 'MIN_CHAR_COUNT' && text.length < minOrMax) {
      return `Must be at least ${minOrMax} characters.`;
    }
    if (operator === 'MAX_CHAR_COUNT' && text.length > minOrMax) {
      return `Must be at most ${minOrMax} characters.`;
    }
  } else if (category === 'REGEX') {
    try {
      const reg = new RegExp(String(value || ''));
      if (operator === 'CONTAINS' && !reg.test(text)) return 'Pattern does not match.';
      if (operator === 'NOT_CONTAINS' && reg.test(text)) return 'Pattern must not match.';
      if (operator === 'MATCHES' && !new RegExp('^' + String(value || '') + '$').test(text)) return 'Must match pattern.';
      if (operator === 'NOT_MATCHES' && new RegExp('^' + String(value || '') + '$').test(text)) return 'Must not match pattern.';
    } catch {
      // Invalid patterns configured by a creator are ignored rather than blocking respondents.
    }
  }

  return null;
}
