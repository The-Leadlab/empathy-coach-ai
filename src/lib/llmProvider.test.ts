import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { coachLlmProvider, resolveVaultEndpoint } = require("../../skills/llmProvider.cjs");

const KEYS = ["LLM_PROVIDER", "VAULT_LLM_API_URL", "VAULT_LLM_API_KEY", "VAULT_LORA_ADAPTER", "VAULT_BASE_MODEL"];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("coach LLM provider", () => {
  it("keeps the default on RunPod so Vercel training hosts do not move", () => {
    delete process.env.LLM_PROVIDER;
    expect(coachLlmProvider()).toBe("runpod");
  });

  it("treats vault and dummy as the private host", () => {
    process.env.LLM_PROVIDER = "vault";
    expect(coachLlmProvider()).toBe("vault");
    process.env.LLM_PROVIDER = "dummy";
    expect(coachLlmProvider()).toBe("vault");
  });

  it("is not ready until the scale-to-zero URL and key exist", () => {
    delete process.env.VAULT_LLM_API_URL;
    delete process.env.VAULT_LLM_API_KEY;
    expect(resolveVaultEndpoint().ready).toBe(false);
  });

  it("sends the LoRA adapter name as the model id", () => {
    process.env.VAULT_LLM_API_URL = "https://vault.example/v1/chat/completions";
    process.env.VAULT_LLM_API_KEY = "test-key";
    process.env.VAULT_BASE_MODEL = "empathy-coach-qwen14";
    process.env.VAULT_LORA_ADAPTER = "empathy-coach-lora-v3";
    const vault = resolveVaultEndpoint();
    expect(vault.ready).toBe(true);
    expect(vault.model).toBe("empathy-coach-lora-v3");
  });
});
