import { SectionData, QuestionData, QuestionOption } from '../types/survey.js';

export interface SectionRoutingResult {
  action: 'NEXT_SECTION' | 'GO_TO_SECTION' | 'SUBMIT_FORM';
  targetSectionId?: string;
  isLastSection: boolean;
}

type AnswerMap = Record<string, { ratingValue?: number | null; textValue?: string | null; jsonValue?: unknown }>;

/**
 * Resolves the destination when advancing from a given section based on:
 * 1. Question-level branching ("Go to section based on answer" in MULTIPLE_CHOICE or DROPDOWN)
 * 2. Section footer setting ("After section X: Continue to next section | Go to section ... | Submit form")
 *
 * `visitedSectionIds` is the ordered path the respondent has already walked. A jump that would
 * revisit a visited section is treated as a cycle and degrades to the next section in order
 * (or submission when none remains), which makes every path terminate deterministically.
 */
export function resolveNextSection(
  currentSection: SectionData,
  allSections: SectionData[],
  questionsInSection: QuestionData[],
  answers: AnswerMap,
  visitedSectionIds: string[] = []
): SectionRoutingResult {
  const sortedSections = [...allSections].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentIndex = sortedSections.findIndex((s) => s.id === currentSection.id);
  const nextSectionInOrder =
    currentIndex >= 0 && currentIndex + 1 < sortedSections.length ? sortedSections[currentIndex + 1] : null;

  // 1. Question-level branching
  for (const question of questionsInSection) {
    if (
      (question.type === 'MULTIPLE_CHOICE' || question.type === 'DROPDOWN') &&
      question.config?.goToSectionBasedOnAnswer &&
      question.config.options
    ) {
      const answer = answers[question.id];
      const selectedOptionId =
        typeof answer?.jsonValue === 'object' && answer.jsonValue !== null
          ? (answer.jsonValue as { selectedOptionId?: string }).selectedOptionId
          : answer?.textValue;

      if (selectedOptionId) {
        const option = question.config.options.find((opt: QuestionOption) => opt.id === selectedOptionId);
        if (option?.targetSectionId) {
          if (option.targetSectionId === 'SUBMIT_FORM') {
            return { action: 'SUBMIT_FORM', isLastSection: true };
          }
          if (option.targetSectionId === 'NEXT_SECTION') {
            if (nextSectionInOrder) {
              return {
                action: 'GO_TO_SECTION',
                targetSectionId: nextSectionInOrder.id,
                isLastSection: currentIndex + 1 === sortedSections.length - 1,
              };
            }
            return { action: 'SUBMIT_FORM', isLastSection: true };
          }

          const targetExists = sortedSections.some((s) => s.id === option.targetSectionId);
          if (targetExists) {
            // Cycle guard: never walk back into an already visited section.
            if (visitedSectionIds.includes(option.targetSectionId)) {
              if (nextSectionInOrder) {
                return { action: 'GO_TO_SECTION', targetSectionId: nextSectionInOrder.id, isLastSection: false };
              }
              return { action: 'SUBMIT_FORM', isLastSection: true };
            }

            const targetIdx = sortedSections.findIndex((s) => s.id === option.targetSectionId);
            return {
              action: 'GO_TO_SECTION',
              targetSectionId: option.targetSectionId,
              isLastSection: targetIdx === sortedSections.length - 1,
            };
          }
        }
      }
    }
  }

  // 2. Section footer setting
  if (currentSection.nextAction === 'SUBMIT_FORM') {
    return { action: 'SUBMIT_FORM', isLastSection: true };
  }

  if (currentSection.nextAction === 'GO_TO_SECTION' && currentSection.targetSectionId) {
    const targetExists = sortedSections.some((s) => s.id === currentSection.targetSectionId);
    if (targetExists) {
      if (visitedSectionIds.includes(currentSection.targetSectionId)) {
        if (nextSectionInOrder) {
          return { action: 'GO_TO_SECTION', targetSectionId: nextSectionInOrder.id, isLastSection: false };
        }
        return { action: 'SUBMIT_FORM', isLastSection: true };
      }

      const targetIdx = sortedSections.findIndex((s) => s.id === currentSection.targetSectionId);
      return {
        action: 'GO_TO_SECTION',
        targetSectionId: currentSection.targetSectionId,
        isLastSection: targetIdx === sortedSections.length - 1,
      };
    }
  }

  // 3. Default: continue in order
  if (nextSectionInOrder) {
    return {
      action: 'NEXT_SECTION',
      targetSectionId: nextSectionInOrder.id,
      isLastSection: currentIndex + 1 === sortedSections.length - 1,
    };
  }

  return { action: 'SUBMIT_FORM', isLastSection: true };
}

/**
 * Walks the form from its first section using the submitted answers and returns every
 * section the respondent actually visited. Only questions in visited sections (plus legacy
 * questions with no section) must pass validation, which is what makes conditional branching
 * skip required questions in bypassed sections.
 */
export function computeVisitedSections(
  sections: SectionData[],
  questions: QuestionData[],
  answers: AnswerMap
): { visitedSectionIds: string[]; questionsToValidate: QuestionData[] } {
  const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);

  if (sortedSections.length === 0) {
    return {
      visitedSectionIds: [],
      questionsToValidate: questions,
    };
  }

  const visitedSectionIds: string[] = [];
  let current: SectionData | undefined = sortedSections[0];
  // Hard cap prevents pathological payloads from looping even if a section graph is cyclic.
  const maxHops = Math.max(sortedSections.length * 2, 8);

  for (let hop = 0; current && hop < maxHops; hop++) {
    visitedSectionIds.push(current.id);

    const questionsInSection = questions.filter((q) => q.sectionId === current!.id);
    const routing = resolveNextSection(current, sortedSections, questionsInSection, answers, visitedSectionIds);

    if (routing.action === 'SUBMIT_FORM' || !routing.targetSectionId) {
      break;
    }

    const next = sortedSections.find((s) => s.id === routing.targetSectionId);
    if (!next) {
      break;
    }
    current = next;
  }

  const visitedSet = new Set(visitedSectionIds);
  const questionsToValidate = questions.filter((q) => !q.sectionId || visitedSet.has(q.sectionId));

  return { visitedSectionIds, questionsToValidate };
}

/** Pushes the current section onto the back-navigation history stack. */
export function pushVisitedSection(visited: string[], currentSectionId: string): string[] {
  return [...visited, currentSectionId];
}

/** Pops the previous section off the back-navigation history stack. */
export function popVisitedSection(visited: string[]): {
  previousSectionId: string | null;
  visited: string[];
} {
  if (visited.length === 0) {
    return { previousSectionId: null, visited };
  }
  return {
    previousSectionId: visited[visited.length - 1],
    visited: visited.slice(0, -1),
  };
}

/**
 * Cleans up any references to a deleted section in section footers and question options.
 */
export function cleanSectionReferencesOnDelete(
  deletedSectionId: string,
  sections: SectionData[],
  questions: QuestionData[]
): { updatedSections: SectionData[]; updatedQuestions: QuestionData[] } {
  const updatedSections = sections.map((sec) => {
    if (sec.targetSectionId === deletedSectionId) {
      return {
        ...sec,
        nextAction: 'NEXT_SECTION' as const,
        targetSectionId: null,
      };
    }
    return sec;
  });

  const updatedQuestions = questions.map((q) => {
    if (q.config?.options) {
      let hasChanges = false;
      const newOptions = q.config.options.map((opt) => {
        if (opt.targetSectionId === deletedSectionId) {
          hasChanges = true;
          return { ...opt, targetSectionId: 'NEXT_SECTION' };
        }
        return opt;
      });

      if (hasChanges) {
        return {
          ...q,
          config: {
            ...q.config,
            options: newOptions,
          },
        };
      }
    }
    return q;
  });

  return { updatedSections, updatedQuestions };
}
