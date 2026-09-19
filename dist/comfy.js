const COMFY_URL = "http://127.0.0.1:8188";
export async function queuePrompt(workflow) {
    const response = await fetch(`${COMFY_URL}/prompt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            prompt: workflow,
        }),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`ComfyUI error ${response.status}: ${text}`);
    }
    return response.json();
}
export async function getHistory(promptId) {
    const response = await fetch(`${COMFY_URL}/history/${promptId}`);
    if (!response.ok) {
        throw new Error(`ComfyUI history error ${response.status}`);
    }
    return response.json();
}
export async function waitForResult(promptId, timeoutMs = 10 * 60 * 1000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const history = await getHistory(promptId);
        if (history[promptId]) {
            return history[promptId];
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("ComfyUI generation timeout");
}
//# sourceMappingURL=comfy.js.map