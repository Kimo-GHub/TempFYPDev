export async function askExpensi(messages) {
  try {
    const response = await fetch("http://127.0.0.1:8000/api/expensi/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error("Expensi API error");
    }

   const data = await response.json();

// --- Detect if Expensi is sending an action JSON ---
let parsed = null;
let raw = (data.reply || "").trim();

try {
  // Strip ```json ... ``` fences if they exist
  if (raw.startsWith("```")) {
    // remove leading ```json or ``` 
    raw = raw.replace(/^```(?:json)?\s*/i, "");
    // remove trailing ```
    if (raw.endsWith("```")) {
      raw = raw.slice(0, -3).trim();
    }
  }

  parsed = JSON.parse(raw);
} catch (_) {
  // treat as normal text
}


    if (parsed && parsed.action) {
      return {
        type: "action",
        action: parsed.action,
        params: parsed.params,
      };
    }

    return {
      type: "text",
      text: data.reply,
    };

  } catch (err) {
    console.error("Expensi error:", err);
    return {
      type: "text",
      text: "Sorry, something went wrong.",
    };
  }
}
