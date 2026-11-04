/**
 * Runs a Netlify-style handler (event → { statusCode, headers, body }) on Vercel,
 * so the same function code serves both hosts.
 */
export function fromNetlifyHandler(handler) {
  return async function vercelHandler(req, res) {
    const url = new URL(req.url, "http://localhost");
    const body =
      req.body == null
        ? ""
        : typeof req.body === "string"
          ? req.body
          : Buffer.isBuffer(req.body)
            ? req.body.toString("utf8")
            : JSON.stringify(req.body);

    const event = {
      httpMethod: req.method,
      headers: req.headers,
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams.entries()),
      body,
      isBase64Encoded: false,
    };

    try {
      const result = (await handler(event, {})) || {};
      for (const [key, value] of Object.entries(result.headers || {})) {
        res.setHeader(key, value);
      }
      res.statusCode = result.statusCode || 200;
      const out = result.isBase64Encoded
        ? Buffer.from(result.body || "", "base64")
        : (result.body ?? "");
      res.end(out);
    } catch (err) {
      console.error("Function error:", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal server error." }));
    }
  };
}
