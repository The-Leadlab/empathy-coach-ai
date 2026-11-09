# ShiftED AI — Weekly WhatsApp Update

**Week ending:** 25 July 2026  
**Copy the message below into WhatsApp**

---

📋 *ShiftED AI — Weekly Update (25 Jul)*

*1. Client Brief*
ShiftED AI is a practice-based empathy coaching platform for first-time managers. Users sign in, open coaching journeys, chat with an AI coach (Socratic style — not therapy), track tasks, and follow a sustainability path when stuck. Trainers (Simon) can review sessions, star good replies, and shape behaviour for all users. MVP is live on Netlify with Supabase + RunPod fine-tuned model (Groq fallback).

*2. What has been done?*
✅ Multi-journey dashboard + session workspace
✅ AI coach (3-phase protocol, goal ladder, task sync)
✅ Sustainability Path UI (right rail, unlockable skills)
✅ Guidance widget + belief before/after tracking
✅ Transcript download (PDF/TXT) for all users
✅ PDF / Word / transcript upload in chat
✅ Admin trainer panel (feedback, stars, export)
✅ Context-limit fixes for long chats & uploads
✅ Fine-tuned Qwen2.5-7B deployed on RunPod

*3. What is left to do?*
🔲 Lock coaching protocol — team review & sign-off (Simon/Kara)
🔲 Goal gate + stage lock + plain-language tone polish
🔲 Wire survey & progress dashboard into app menu (pages built, not linked)
🔲 Retrain model after protocol is stable (need 100+ reviewed examples)
🔲 Simon testing round + screenshot feedback loop
🔲 Production voice (TTS) — target August
🔲 Avatar, roleplay, analytics — later roadmap

*4. Bottleneck issues*
⚠️ *Protocol sign-off* — biggest blocker. Until the knowledge base is locked, prompt changes risk rework and model retrain should wait.
⚠️ *Trainer feedback throughput* — quality depends on Simon’s ongoing review and saved feedback.
⚠️ *RunPod cold starts* — 1–3 min warm-up on scale-to-zero; use Groq for demos.
⚠️ *Survey/dashboard not wired* — quick win, but still not in live navigation.
⚠️ *Deploy discipline* — git push alone doesn’t update live site; Netlify must redeploy after coach changes.

*Next week focus:* Close P1 protocol items → deploy → Simon test → wire survey routes.

— Ali
