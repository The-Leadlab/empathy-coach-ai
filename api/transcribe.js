import { createRequire } from "node:module";
import { fromNetlifyHandler } from "./_netlifyAdapter.js";

const require = createRequire(import.meta.url);
const { handler } = require("../netlify/functions/transcribe.js");

export const config = { maxDuration: 60 };
export default fromNetlifyHandler(handler);
