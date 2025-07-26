#!/usr/bin/env node
import { GitConfig } from './types/index.js';
declare class GitAutoMCP {
    private gitOps;
    private config;
    private watcher?;
    private debounceTimer?;
    private isProcessing;
    constructor(configPath?: string);
    private configPath?;
    private loadConfig;
    initialize(): Promise<void>;
    startWatching(): Promise<void>;
    private handleFileChange;
    processChanges(files?: string[]): Promise<void>;
    private displayDetailedResult;
    runOnce(files?: string[]): Promise<void>;
    stop(): Promise<void>;
    private getEnabledAgents;
    getStatus(): {
        enabled: boolean;
        watching: boolean;
        processing: boolean;
        agents: string[];
        config: GitConfig;
    };
}
export { GitAutoMCP };
export default GitAutoMCP;
//# sourceMappingURL=index.d.ts.map