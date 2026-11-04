/**
 * Shared workbook authoring actions used by Netlify and the local server.
 */

const { callLlm, pollRunPodJobResult, resolveSyncEndpoint } = require("./llmProvider.cjs");
const {
  searchPassages,
  formatPassagesForPrompt,
} = require("./safeCorpus.cjs");
const {
  buildWorkbookAuthorSystemPrompt,
  buildOutlineUserPrompt,
  buildSectionUserPrompt,
  needsCrisisBox,
} = require("./workbookAuthorPrompt.cjs");
const { parseRunPodEndpointId } = require("./runpodAsync.cjs");

function stripJsonFence(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseOutline(text) {
  const raw = stripJsonFence(text);
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.sections)) {
    throw new Error("Outline response missing sections.");
  }
  return {
    title: String(data.title || "Untitled workbook"),
    sections: data.sections.slice(0, 10).map((s, i) => ({
      position: i,
      kind: String(s.kind || "intro"),
      title: String(s.title || `Section ${i + 1}`),
      purpose: String(s.purpose || ""),
      searchQuery: String(s.searchQuery || s.title || ""),
      body_md: "",
      sources: [],
    })),
  };
}

function outlineSummary(sections) {
  return sections
    .map((s, i) => `${i + 1}. [${s.kind}] ${s.title} — ${s.purpose || ""}`)
    .join("\n");
}

function previousSummary(sections, index) {
  if (index <= 0) return "";
  const prev = sections[index - 1];
  const body = String(prev.body_md || "").replace(/\s+/g, " ").trim();
  return `${prev.title}: ${body.slice(0, 280)}`;
}

async function runAuthorAction(body) {
  const action = String(body.action || "").trim();
  const topic = String(body.topic || "").trim();
  const method = String(body.method || "").trim();
  const audience = String(body.audience || "adult client").trim();
  const length = String(body.length || "medium").trim();

  if (action === "poll" && body.jobId) {
    const { apiUrl, apiKey } = resolveSyncEndpoint("workbook");
    const endpointId = parseRunPodEndpointId(apiUrl);
    if (!endpointId || !apiKey) throw new Error("Cannot poll: RunPod not configured.");
    return pollRunPodJobResult(body.jobId, endpointId, apiKey);
  }

  const system = {
    role: "system",
    content: buildWorkbookAuthorSystemPrompt({ topic, method, audience }),
  };

  if (action === "outline") {
    const messages = [
      system,
      { role: "user", content: buildOutlineUserPrompt({ topic, method, audience, length }) },
    ];
    const result = await callLlm({
      messages,
      sampling: { temperature: 0.4, max_tokens: 1200 },
      purpose: "workbook",
    });
    if (result.async) return result;
    const parsed = parseOutline(result.text);
    return { ...result, outline: parsed };
  }

  if (action === "draft_section" || action === "rewrite_section" || action === "continue_section") {
    const section = body.section || {};
    const sections = Array.isArray(body.sections) ? body.sections : [];
    const index = Number(body.sectionIndex) || 0;
    const query = section.searchQuery || section.title || topic;
    const hits = searchPassages(query, { topK: 4 });
    const passagesBlock = formatPassagesForPrompt(hits);
    const continueFrom =
      action === "continue_section" || body.continue
        ? String(section.body_md || "").replace(/\nDraft — clinician review required\s*$/i, "")
        : "";

    let userContent = buildSectionUserPrompt({
      section,
      outlineSummary: outlineSummary(sections.length ? sections : [section]),
      previousSummary: previousSummary(sections, index),
      passagesBlock,
      continueFrom: action === "rewrite_section" ? "" : continueFrom,
    });

    if (action === "rewrite_section" && body.instruction) {
      userContent += `\n\nRewrite instruction from clinician: ${body.instruction}`;
    }

    if (needsCrisisBox(topic, method, section.title) && !/Samaritans/i.test(userContent)) {
      userContent += "\nInclude the UK crisis signposting box in this section.";
    }

    const messages = [system, { role: "user", content: userContent }];
    const result = await callLlm({
      messages,
      sampling: { temperature: 0.45, max_tokens: Number(process.env.WORKBOOK_MAX_TOKENS) || 1500 },
      purpose: "workbook",
    });
    if (result.async) return { ...result, sources: hits.map((h) => ({ cite: h.cite, ...h.passage })) };
    return {
      ...result,
      body_md: result.text,
      sources: hits.map((h) => ({
        cite: h.cite,
        agency: h.passage.agency,
        title: h.passage.title,
        url: h.passage.url,
        licence: h.passage.licence,
      })),
    };
  }

  if (action === "chat") {
    const history = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    const messages = [system, ...history.map((m) => ({ role: m.role, content: m.content || "" }))];
    if (body.message) {
      messages.push({ role: "user", content: String(body.message) });
    }
    const result = await callLlm({
      messages,
      sampling: { temperature: 0.5, max_tokens: 900 },
      purpose: "workbook",
    });
    return result;
  }

  throw new Error(`Unknown action: ${action}`);
}

module.exports = {
  runAuthorAction,
  parseOutline,
  stripJsonFence,
};
