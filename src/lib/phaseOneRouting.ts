export type PhaseOneElement = "trigger" | "coping" | "rule" | "belief" | "strength" | "summary";

/** Match server Hot Cross Bun order: map before deep rules/beliefs. */
const PHASE_ONE_ELEMENT_ORDER: PhaseOneElement[] = ["trigger", "coping", "rule", "belief", "strength"];

const ELEMENT_ASK_PATTERNS: Record<Exclude<PhaseOneElement, "summary">, RegExp> = {
  trigger: /trigger|sets? it off|right before|what happens when|spike|sets this off|in the moment|first thought|pops up/i,
  coping: /body|emotion|feel in your body|what do you do|cope|avoid|response when|where do you feel/i,
  rule: /\bif\b.{0,40}\bthen\b|(?:\ban? |\bthe |\byour )rule\b|assumption you|inner rule/i,
  belief: /what.*believe|worst.*happen|expect.*happen|afraid.*would|deeper (fear|belief)|belief (that|behind|driving)/i,
  strength: /how strongly|0\s*to\s*100|0-100|strength of belief|%\s*right now/i,
};

export function detectAskedPhaseOneElements(assistantMessages: string[]): Set<PhaseOneElement> {
  const asked = new Set<PhaseOneElement>();
  for (const text of assistantMessages) {
    if (/\brule\b.{0,20}\bbelief\b|\bbelief\b.{0,20}\brule\b/i.test(text)) {
      asked.add("belief");
      continue;
    }
    for (const [element, pattern] of Object.entries(ELEMENT_ASK_PATTERNS) as [
      Exclude<PhaseOneElement, "summary">,
      RegExp,
    ][]) {
      if (pattern.test(text)) asked.add(element);
    }
  }
  return asked;
}

export function nextPhaseOneElement(assistantMessages: string[]): PhaseOneElement {
  const asked = detectAskedPhaseOneElements(assistantMessages);
  for (const element of PHASE_ONE_ELEMENT_ORDER) {
    if (!asked.has(element)) return element;
  }
  return "summary";
}

export function detectPhaseOneFocusFromAssistant(assistantText: string): PhaseOneElement | null {
  if (!assistantText.trim()) return null;
  if (/\brule\b.{0,20}\bbelief\b|\bbelief\b.{0,20}\brule\b/i.test(assistantText)) return "belief";
  for (const [element, pattern] of Object.entries(ELEMENT_ASK_PATTERNS) as [
    Exclude<PhaseOneElement, "summary">,
    RegExp,
  ][]) {
    if (pattern.test(assistantText)) return element;
  }
  return null;
}
