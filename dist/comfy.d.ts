type Workflow = Record<string, any>;
export declare function queuePrompt(workflow: Workflow): Promise<any>;
export declare function getHistory(promptId: string): Promise<any>;
export declare function waitForResult(promptId: string, timeoutMs?: number): Promise<any>;
export {};
//# sourceMappingURL=comfy.d.ts.map