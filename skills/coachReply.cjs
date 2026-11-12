/**
 * Turns raw model output into the one user-facing coach reply.
 * Shared by netlify/functions/chat.js (RunPod async + sync + fallback) and server/server.js.
 */

const { naturalVoiceRejectReason, stripInstructionLeakPrefix } = require("./humanCoachVoice.cjs");

// Hot Cross Bun first (situation → trigger/thought → emotion/body/behaviour), then rules/beliefs.
const PHASE_ONE_ELEMENTS = ["situation", "trigger", "coping", "rule", "belief", "strength"];

const STOP_SEQUENCES = ["<think>", "\nUser:", "<|im_end|>"];

// ---------------------------------------------------------------------------
// Reasoning removal
// ---------------------------------------------------------------------------

/**
 * Removes Qwen3-style reasoning. Closed <think>…</think> blocks are dropped; an unclosed
 * <think> drops everything after it; a stray </think> means everything before it was reasoning.
 */
function stripThinking(text) {
  let out = String(text ?? "");
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const close = out.search(/<\/think>/i);
  if (close !== -1) out = out.slice(close + "</think>".length);
  const open = out.search(/<think>/i);
  if (open !== -1) out = out.slice(0, open);
  return out
    .replace(/<\|im_(start|end)\|>(assistant)?/gi, "")
    .replace(/\/no_think/gi, "")
    .trim();
}

/**
 * Streaming variant: emits only text outside <think> blocks. Holds back a possible partial tag
 * at the end of each chunk so a tag split across chunks never leaks. Until a think tag has been
 * seen, nothing is emitted (reasoning may arrive without its opening tag); a stream with no tags
 * at all is released by flush().
 */
function createThinkStreamFilter() {
  let buffer = "";
  let inThink = false;
  let released = false;

  const partialTagLength = (s, tag) => {
    for (let n = Math.min(tag.length - 1, s.length); n > 0; n--) {
      if (tag.toLowerCase().startsWith(s.slice(-n).toLowerCase())) return n;
    }
    return 0;
  };

  function push(chunk) {
    buffer += String(chunk ?? "");
    let emitted = "";
    for (;;) {
      if (inThink) {
        const end = buffer.toLowerCase().indexOf("</think>");
        if (end === -1) {
          buffer = buffer.slice(buffer.length - partialTagLength(buffer, "</think>"));
          return emitted;
        }
        buffer = buffer.slice(end + "</think>".length);
        inThink = false;
        continue;
      }
      const lower = buffer.toLowerCase();
      const start = lower.indexOf("<think>");
      const strayClose = lower.indexOf("</think>");
      if (strayClose !== -1 && (start === -1 || strayClose < start) && !released) {
        // Reasoning without an opening tag: discard everything before the close tag.
        buffer = buffer.slice(strayClose + "</think>".length);
        released = true;
        continue;
      }
      if (start !== -1) {
        emitted += buffer.slice(0, start);
        buffer = buffer.slice(start + "<think>".length);
        inThink = true;
        released = true;
        continue;
      }
      if (!released) return emitted;
      const hold = Math.max(partialTagLength(buffer, "<think>"), partialTagLength(buffer, "</think>"));
      emitted += buffer.slice(0, buffer.length - hold);
      buffer = buffer.slice(buffer.length - hold);
      return emitted;
    }
  }

  function flush() {
    const rest = inThink ? "" : buffer;
    buffer = "";
    return rest;
  }

  return { push, flush };
}

/** Assistant text from an OpenAI-style choice. Never returns reasoning / reasoning_content. */
function contentFromChoice(choice) {
  if (!choice) return "";
  const content = choice.message?.content ?? choice.text;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p) => p && (!p.type || p.type === "text" || p.type === "output_text") && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
  }
  return "";
}

// ---------------------------------------------------------------------------
// JSON output contract
// ---------------------------------------------------------------------------

/** Parses {"state_update":{…},"reply":"…"}; tolerates code fences and text around the object. */
function parseCoachJson(text) {
  const raw = String(text ?? "").replace(/```(?:json)?/gi, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!parsed || typeof parsed.reply !== "string" || !parsed.reply.trim()) return null;
    return {
      reply: parsed.reply.trim(),
      stateUpdate: parsed.state_update && typeof parsed.state_update === "object" ? parsed.state_update : null,
    };
  } catch {
    return null;
  }
}

/** Salvages a user-facing question from reasoning-shaped text. */
function fallbackExtractReply(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";

  const replyField = raw.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)+)"/);
  if (replyField) {
    try {
      return JSON.parse(`"${replyField[1]}"`).trim();
    } catch {
      // fall through
    }
  }

  const quoted = [...raw.matchAll(/["“]([^"“”]{8,400}\?)["”]/g)].map((m) => m[1].trim());
  if (quoted.length) return quoted[quoted.length - 1];

  const sentences = raw.match(/[^.!?\n]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) ?? [raw];
  const clean = sentences.filter((s) => !isMetaText(s));
  const lastQuestion = clean.map((s, i) => [s, i]).filter(([s]) => s.endsWith("?")).pop();
  if (lastQuestion) {
    const i = lastQuestion[1];
    return clean.slice(Math.max(0, i - 1), i + 1).join(" ");
  }
  return clean.slice(-2).join(" ");
}

// ---------------------------------------------------------------------------
// Meta / third-person guard
// ---------------------------------------------------------------------------

const META_PATTERN =
  /We need to|The user|Phase (One|Two|Three|1|2|3)\b|Let's ask|\binstruction|system prompt|\bstate_update\b|Reflective Handshake|Step 1\.\d/i;
// Goal ladders in later phases legitimately say "Step 1" and "next step", so these only count during intake.
const INTAKE_ONLY_PATTERN = /\bStep \d|next step/i;
const THIRD_PERSON_PATTERN = /\b(the user|the client|user's|the coachee)\b/i;

/** Hidden app tags are not shown to the user, so they are excluded from guard checks. */
function stripHiddenTags(text) {
  return String(text ?? "")
    .replace(/\[\[(PROGRESS|WORKBOOK)\]\][\s\S]*?\[\[\/\1\]\]/gi, "")
    .replace(/\[\[(PROGRESS|WORKBOOK)\]\][\s\S]*$/i, "")
    .trim();
}

function isMetaText(text, opts = {}) {
  const visible = stripHiddenTags(text);
  if (META_PATTERN.test(visible) || THIRD_PERSON_PATTERN.test(visible)) return true;
  return !!opts.phaseOne && INTAKE_ONLY_PATTERN.test(visible);
}

/** Why a reply should be rejected, or null when it is fine to show. */
function rejectReason(reply, opts = {}) {
  const visible = stripHiddenTags(reply);
  if (!visible) return "empty";
  if (isMetaText(visible, opts)) return "meta";
  if (opts.phaseOne && opts.element !== "summary" && !visible.includes("?")) return "no_question";
  const voiceReject = naturalVoiceRejectReason(visible);
  if (voiceReject) return voiceReject;
  return null;
}

// ---------------------------------------------------------------------------
// Phase One state (tracked in code, not by the model)
// ---------------------------------------------------------------------------

const ELEMENT_FOCUS_PATTERNS = {
  situation: /what happened|describe|tell me (more )?about (the|a|one) (situation|moment|time)/i,
  trigger: /trigger|sets? (it|this) off|right before|spike|in the moment|first thought|pops up/i,
  rule: /\bif\b.{0,40}\bthen\b|(?:\ban? |\bthe |\byour )rule\b|assumption you|inner rule/i,
  belief: /what would (that )?(mean|happen|say)|fear (it|that) (would|says)|deeper (fear|worry|belief)|not good enough|belief (that|behind|driving)/i,
  strength: /how strongly|0\s*(to|-|–)\s*100|out of 100|per ?cent/i,
  coping: /body|feel in your|what (emotion|feeling)|where do you feel|what do you (do|tend to do)|avoid|cope|scroll|phone/i,
};

const REPEAT_COMPLAINT_RE =
  /\b(asked (this|that|the same|this question)|quite a few times|keep asking|already (told|said|answered|asked)|same question|repeating)\b/i;

function detectAskedElement(assistantText) {
  const text = String(assistantText ?? "");
  // Compound "rule or belief" from the LoRA — treat as belief so we don't re-fill rule forever.
  if (/\brule\b.{0,20}\bbelief\b|\bbelief\b.{0,20}\brule\b/i.test(text)) {
    if (ELEMENT_FOCUS_PATTERNS.strength.test(text)) return "strength";
    return "belief";
  }
  // Strength wording often also mentions "believe", so check it first.
  for (const el of ["strength", "coping", "trigger", "belief", "rule", "situation"]) {
    if (ELEMENT_FOCUS_PATTERNS[el].test(text)) return el;
  }
  return null;
}

function parseStrength(text) {
  const m = String(text ?? "").match(/\b(100|[1-9]?\d)\s*(%|percent|per cent|\/\s*100|out of 100)?/i);
  return m ? Number(m[1]) : null;
}

function cleanCaptured(captured) {
  const out = {};
  if (!captured || typeof captured !== "object") return out;
  for (const el of PHASE_ONE_ELEMENTS) {
    const v = captured[el];
    if (el === "strength") {
      const n = typeof v === "number" ? v : parseStrength(v);
      if (Number.isFinite(n) && n >= 0 && n <= 100) out.strength = n;
    } else if (typeof v === "string" && v.trim()) {
      out[el] = v.trim().slice(0, 300);
    }
  }
  return out;
}

function nextMissingElement(captured) {
  return PHASE_ONE_ELEMENTS.find((el) => captured[el] === undefined) ?? "summary";
}

/** Explicit Reflective Handshake confirmation (summary was just offered). */
const HANDSHAKE_CONFIRM_RE =
  /^\s*(yes|yeah|yep|yup|correct|exactly|right|true|sure|ok|okay|agreed)\b|\b(yes|yeah|yep)\b.{0,40}\b(does|it does|that's right|that is right|exactly|capture|sound|fit|move on)\b|\b(that's right|that is right|sounds right|you've got it|spot on|that's it|that captures|that describes|move on)\b/i;

const HANDSHAKE_REJECT_RE =
  /\b(not quite|not really|nope|missing|wrong|incorrect|doesn't fit|does not fit|not accurate)\b/i;

function isHandshakeConfirm(text) {
  const t = String(text ?? "").trim();
  if (!t || HANDSHAKE_REJECT_RE.test(t)) return false;
  return HANDSHAKE_CONFIRM_RE.test(t);
}

/**
 * Advances Phase One state with the user's latest message, then picks the next element to ask.
 * `prior` comes from the last assistant message's stored metadata; if missing, it is rebuilt
 * from the visible history so older threads keep working.
 */
function advancePhaseOneState({ prior, history = [], userMessage = "", presentingChallenge = null }) {
  let captured = cleanCaptured(prior?.captured);
  let asking = typeof prior?.asking === "string" ? prior.asking : null;

  const record = (el, answerText) => {
    const text = String(answerText ?? "").trim();
    if (!el || !text || captured[el] !== undefined) return;
    if (el === "strength") {
      const n = parseStrength(text);
      if (n !== null) captured.strength = n;
    } else {
      captured[el] = text.slice(0, 300);
    }
  };

  if (!prior) {
    // Pair each earlier coach question with the user's next message.
    asking = null;
    for (const m of history) {
      if (m.role === "assistant") asking = detectAskedElement(m.content);
      else if (m.role === "user" && asking) {
        record(asking, m.content);
        asking = null;
      }
    }
  }

  const answer = String(userMessage ?? "").trim();
  if (presentingChallenge && captured.situation === undefined) {
    captured.situation = String(presentingChallenge).slice(0, 300);
  }

  // Summary is not a captured field — "yes" must exit intake, not re-ask forever.
  if (asking === "summary" && isHandshakeConfirm(answer)) {
    captured = cleanCaptured(captured);
    return { captured, asking: "summary", handshakeConfirmed: true };
  }

  // User called out a re-ask — do not store the complaint as the answer; skip ahead.
  if (asking && asking !== "summary" && REPEAT_COMPLAINT_RE.test(answer)) {
    if (captured[asking] === undefined) {
      captured[asking] = "(already covered — user asked not to repeat)";
    }
    captured = cleanCaptured(captured);
    return { captured, asking: nextMissingElement(captured) };
  }

  record(asking, answer);
  if (captured.situation === undefined && answer.split(/\s+/).length >= 12) {
    captured.situation = answer.slice(0, 300);
  }

  captured = cleanCaptured(captured);
  return { captured, asking: nextMissingElement(captured) };
}

/** Merges model-extracted elements into the code state without overwriting what code captured. */
function mergeStateUpdate(state, stateUpdate) {
  const fromModel = cleanCaptured(stateUpdate?.captured);
  const captured = { ...fromModel, ...cleanCaptured(state?.captured) };
  return { captured, asking: state?.asking ?? nextMissingElement(captured) };
}

/** Phase One intake turns (steps 1.1–1.2, plus the handshake summary) use the JSON contract. */
function isPhaseOneIntake(journeyContext, possibleCrisisLanguage) {
  if (possibleCrisisLanguage || !journeyContext || typeof journeyContext !== "object") return false;
  if ((journeyContext.platformPhase ?? 1) !== 1) return false;
  if (journeyContext.phaseOneConfirmed || (journeyContext.phaseOneStep ?? 1) >= 3) return false;
  if (journeyContext.sustainabilityPivotActive || journeyContext.architecturalBacktrackActive) return false;
  if (journeyContext.isResuming && journeyContext.activeMicroGoal) return false;
  return true;
}

const ELEMENT_ASK = {
  situation: "one concrete recent situation: what happened, who was there, when",
  trigger: "the first thought or image that shows up in that moment (before digging into deep rules)",
  coping:
    "how that thought feels emotionally and in the body, and what they do or avoid next (e.g. phone, scrolling) — Hot Cross Bun map before rules",
  rule: "only if still unclear: a light 'if… then…' assumption in everyday words — not clinical jargon",
  belief: "only if still unclear: the self-evaluation underneath (e.g. not good enough) in their words",
  strength: "how strongly they believe that thought right now, from 0 to 100",
  summary:
    "a short plain-language summary of what they shared (situation, thought, feelings/body, behaviour, any rule/belief, strength), then ask if it fits",
};

/** Appended to the system prompt on Phase One intake turns. */
function phaseOneTurnInstruction(state) {
  const captured = state.captured || {};
  const known = Object.entries(captured)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  return `# This turn
Ask about: ${ELEMENT_ASK[state.asking] || ELEMENT_ASK.trigger}
Already known (do not ask again): ${known || "nothing yet"}

Hard rules for this reply:
- Ask ONLY the element above. Do not ask about rule/belief if the target is trigger or coping.
- Never re-ask anything listed under Already known, even with different wording.
- Do not jump to core beliefs before situation, thought, emotion/body, and behaviour are on the table.
- Never invent a Tim scenario, panic-button framing, or workplace facts they did not say.

# Output format (required)
Return only one JSON object, no other text:
{"state_update":{"phase":1,"step":"${state.asking === "summary" ? "1.3" : state.asking === "situation" ? "1.1" : "1.2"}","captured":{"trigger":"","rule":"","belief":"","strength":null,"coping":""}},"reply":"..."}
Fill "captured" only with what the user has actually said. "reply" is what the user sees: second person, warm, natural, ${state.asking === "summary" ? "a short summary then one question" : "1-3 sentences, a brief reflection then exactly one question"}. Never mention phases, steps, the user in the third person, or your plan.
Never end with "What feels most pressing about that for you right now?" or open with "You are noticing something real…".
Example reply: When that repetitive task hits and the phone comes out, what do you notice in your body in that exact moment?`;
}

/** Stricter reminder used for the single regeneration attempt. */
const REGENERATE_REMINDER = `# Your last draft was rejected
Write only what the coach says to the user: second person, 1-3 natural sentences, one fresh question.
No reasoning, no phase or step names, no third-person "the user".
Do not use stock lines like "What feels most pressing about that for you right now?" or "You are noticing something real…".`;

// ---------------------------------------------------------------------------
// Deterministic last-resort replies
// ---------------------------------------------------------------------------

const TEMPLATE_QUESTIONS = {
  situation: "Could you tell me about one recent moment when this happened — what happened, and who was there?",
  trigger: "When that moment starts, what's the first thought or urge that shows up?",
  coping: "When that thought shows up, what do you notice in your body, and what do you tend to do next?",
  rule: "In that moment, is there a simple 'if… then…' assumption you notice — in your own words?",
  belief: "What does that moment seem to say about you, in your own words?",
  strength: "On a scale from 0 to 100, how strongly do you believe that thought right now?",
  summary: "Is there anything else about that moment you'd like to add before I sum up what I've heard?",
  general: "What feels most important for us to focus on next?",
};

const DOC_ANALYSIS_INSTRUCTION = `# This turn
The user uploaded a document for analysis. Do NOT continue Phase One intake questions (no rule/belief/strength loops).
Briefly summarise what matters from the document for their coaching situation, stay in their words, do not invent missing content or switch to a different person's case (e.g. Tim), and ask exactly one clear follow-up about how they want to use it.`;

const CRISIS_TEMPLATE =
  "I'm really sorry things feel this heavy. When you say that, do you mean you're having thoughts of ending your life, or is it more a way of saying how bad this feels right now?";

function templatedReply({ element, crisis } = {}) {
  if (crisis) return CRISIS_TEMPLATE;
  return `Thank you for sharing that. ${TEMPLATE_QUESTIONS[element] || TEMPLATE_QUESTIONS.general}`;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Raw model text → { reply, stateUpdate, rejected }.
 * `jsonMode` expects the JSON contract; otherwise plain text (which may carry hidden tags).
 */
function finalizeCoachReply(rawText, opts = {}) {
  const text = stripThinking(rawText);
  let reply = "";
  let stateUpdate = null;

  if (opts.jsonMode) {
    const parsed = parseCoachJson(text);
    if (parsed) {
      reply = parsed.reply;
      stateUpdate = parsed.stateUpdate;
    } else {
      reply = text.trim().startsWith("{") || isMetaText(text, opts) ? fallbackExtractReply(text) : text.trim();
    }
  } else {
    const tagStart = text.search(/\[\[(PROGRESS|WORKBOOK)\]\]/i);
    const visible = tagStart === -1 ? text : text.slice(0, tagStart);
    const hidden = tagStart === -1 ? "" : text.slice(tagStart).trim();
    reply = isMetaText(visible, opts) ? [fallbackExtractReply(visible), hidden].filter(Boolean).join("\n") : text.trim();
  }

  reply = stripInstructionLeakPrefix(reply);
  const reason = rejectReason(reply, opts);
  return { reply: reason ? "" : reply.trim(), stateUpdate, rejected: reason };
}

/** Backup for Qwen3-style templates that ignore chat_template_kwargs. */
function withNoThink(messages) {
  return messages.map((m, i) =>
    i === 0 && m.role === "system" && !/\/no_think/.test(m.content || "")
      ? { ...m, content: `${m.content}\n\n/no_think` }
      : m,
  );
}

function withRegenerateReminder(messages) {
  return messages.map((m, i) =>
    i === 0 && m.role === "system" ? { ...m, content: `${m.content}\n\n${REGENERATE_REMINDER}` } : m,
  );
}

/**
 * Decides, before the model runs, how this turn's reply is checked and (in Phase One intake)
 * which element to ask about.
 */
const HANDSHAKE_DONE_INSTRUCTION = `# This turn
The user just confirmed your Phase One summary (Reflective Handshake). Do NOT re-summarize or ask if it captures things again. Acknowledge briefly in one short sentence, then start Phase Two: ask what a successful resolution of this challenge would look like for them (their target outcome).`;

function isDocumentAnalysisTurn(userMessage) {
  return /^\[Uploaded document for analysis:/i.test(String(userMessage ?? "").trim());
}

function prepareCoachTurn({ mode, journeyContext, possibleCrisisLanguage, history, userMessage }) {
  const crisis = !!possibleCrisisLanguage;
  if (mode !== "chat" && mode !== "regenerate") return { guard: null, phaseOne: null, turnInstruction: "" };

  // PDF/transcript uploads are analysis turns — not Phase One element capture.
  if (mode === "chat" && isDocumentAnalysisTurn(userMessage)) {
    return {
      phaseOne: null,
      turnInstruction: DOC_ANALYSIS_INSTRUCTION,
      guard: { jsonMode: false, phaseOne: false, element: null, crisis },
    };
  }

  const phaseOne =
    mode === "chat" && isPhaseOneIntake(journeyContext, crisis)
      ? advancePhaseOneState({
          prior: journeyContext.phaseOneState,
          history,
          userMessage,
          presentingChallenge: journeyContext.presentingChallenge,
        })
      : null;

  if (phaseOne?.handshakeConfirmed) {
    return {
      phaseOne: { ...phaseOne, handshakeConfirmed: true },
      turnInstruction: HANDSHAKE_DONE_INSTRUCTION,
      guard: { jsonMode: false, phaseOne: false, element: null, crisis },
    };
  }

  return {
    phaseOne,
    turnInstruction: phaseOne ? phaseOneTurnInstruction(phaseOne) : "",
    guard: { jsonMode: !!phaseOne, phaseOne: !!phaseOne, element: phaseOne?.asking ?? null, crisis },
  };
}

/**
 * Calls generate(isRetry) up to maxAttempts times (default: once plus one regeneration) and
 * returns the first reply that passes the guard, or null.
 * @param {(isRetry: boolean) => Promise<string>} generate
 */
async function runGuarded(generate, guard, maxAttempts = 2) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const out = finalizeCoachReply(await generate(attempt > 1), guard);
    if (!out.rejected) return out;
    console.warn("Coach reply rejected:", out.rejected, "attempt", attempt);
  }
  return null;
}

module.exports = {
  PHASE_ONE_ELEMENTS,
  STOP_SEQUENCES,
  stripThinking,
  createThinkStreamFilter,
  contentFromChoice,
  parseCoachJson,
  fallbackExtractReply,
  isMetaText,
  rejectReason,
  stripHiddenTags,
  detectAskedElement,
  advancePhaseOneState,
  mergeStateUpdate,
  nextMissingElement,
  isPhaseOneIntake,
  phaseOneTurnInstruction,
  REGENERATE_REMINDER,
  templatedReply,
  finalizeCoachReply,
  withNoThink,
  withRegenerateReminder,
  prepareCoachTurn,
  runGuarded,
};
