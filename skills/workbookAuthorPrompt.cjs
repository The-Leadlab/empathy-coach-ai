/**
 * System prompt for clinician workbook drafting (admin / Simon).
 * Not for client coaching — do not reuse coach phase prompts here.
 */

const CRISIS_TOPICS = /\b(suicid\w*|self[- ]?harm|kill (myself|himself|herself)|ending (my|their) life)\b/i;

function needsCrisisBox(topic, method, sectionTitle) {
  const blob = `${topic || ""} ${method || ""} ${sectionTitle || ""}`;
  return CRISIS_TOPICS.test(blob);
}

function buildWorkbookAuthorSystemPrompt({ topic, method, audience } = {}) {
  const crisis =
    needsCrisisBox(topic, method, "")
      ? `
For this topic, include a clearly labelled crisis signposting box:
- Emergency: 999
- Samaritans: 116 123
- NHS 111
State that ShiftED materials are training drafts and not a substitute for clinical care.
`
      : "";

  return `You are assisting a clinician who is writing a CBT-style workbook for ShiftED AI.

Audience of this draft: ${audience || "adult client"} (the person reading the workbook later).
You are writing for the clinician authoring tool — British English, clinician-style language is allowed.
Topic: ${topic || "general wellbeing"}.
Method: ${method || "cognitive behavioural skills"}.

Rules:
1. Every factual claim must come from the provided source passages. Cite them as [S1], [S2], etc.
2. Paraphrase. Do not quote more than two sentences from any passage.
3. Never use blocked or commercial worksheet packs. If a fact is missing from passages, say so and mark it for clinician review.
4. End every section with exactly this footer line:
Draft — clinician review required
5. Prefer clear worksheets, short explanations, and practical exercises.
${crisis}`;
}

function buildOutlineUserPrompt({ topic, method, audience, length }) {
  return `Create a workbook outline as JSON only (no markdown fences).
Topic: ${topic}
Method: ${method}
Audience: ${audience}
Target length: ${length || "medium"}

Return an object:
{
  "title": "...",
  "sections": [
    { "kind": "intro|psychoeducation|worksheet|practice|relapse|resources", "title": "...", "purpose": "...", "searchQuery": "keywords for retrieval" }
  ]
}
Use 5 to 10 sections. searchQuery should help find US public-domain passages.`;
}

function buildSectionUserPrompt({
  section,
  outlineSummary,
  previousSummary,
  passagesBlock,
  continueFrom,
}) {
  const continueNote = continueFrom
    ? `\nContinue from this partial draft (do not repeat the footer until the end):\n${continueFrom}\n`
    : "";

  return `Draft ONE workbook section in Markdown.
Section kind: ${section.kind}
Section title: ${section.title}
Purpose: ${section.purpose}

Compact outline:
${outlineSummary}

Previous section summary:
${previousSummary || "(none — this is the first section)"}

Allowed source passages:
${passagesBlock}
${continueNote}
Requirements:
- Use citations [S#] for factual claims drawn from passages.
- Include a short worksheet or practice table when kind is worksheet or practice.
- End with the footer: Draft — clinician review required
- Do not draft other sections.`;
}

module.exports = {
  CRISIS_TOPICS,
  needsCrisisBox,
  buildWorkbookAuthorSystemPrompt,
  buildOutlineUserPrompt,
  buildSectionUserPrompt,
};
