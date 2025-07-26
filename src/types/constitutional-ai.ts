/**
 * Constitutional AI Checker型定義
 * 3原則（Fail Fast, Be Lazy, TypeScript First）チェック機能
 */

export interface ConstitutionalAIReport {
  overallScore: number; // 0-100
  principleScores: {
    failFast: number;
    beLazy: number;
    typeScriptFirst: number;
  };
  violations: ConstitutionalViolation[];
  recommendations: string[];
  autoFixAvailable: boolean;
  executionTime: number;
  timestamp: Date;
}

export interface ConstitutionalViolation {
  id: string;
  principle: 'fail-fast' | 'be-lazy' | 'typescript-first';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  filePath?: string;
  lineNumber?: number;
  autoFixable: boolean;
  recommendation: string;
}

// Fail Fast Checker関連
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  executionTime: number;
}

export interface ValidationError {
  code: string;
  message: string;
  filePath?: string;
  lineNumber?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AnomalyReport {
  anomalies: Anomaly[];
  systemHealth: 'healthy' | 'warning' | 'critical';
  recommendations: string[];
}

export interface Anomaly {
  type: 'performance' | 'memory' | 'error' | 'security';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  context?: Record<string, any>;
}

export interface CoverageReport {
  module: string;
  totalFunctions: number;
  errorHandledFunctions: number;
  coveragePercentage: number;
  missingErrorHandling: string[];
  recommendations: string[];
}

export interface BoundaryReport {
  boundaries: SecurityBoundary[];
  violations: BoundaryViolation[];
  score: number;
}

export interface SecurityBoundary {
  name: string;
  type: 'input' | 'output' | 'api' | 'file' | 'network';
  validated: boolean;
  sanitized: boolean;
}

export interface BoundaryViolation {
  boundary: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

// Be Lazy Checker関連
export interface PerformanceReport {
  operation: string;
  averageExecutionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  bottlenecks: Bottleneck[];
  optimizationSuggestions: string[];
  score: number; // 0-100
}

export interface Bottleneck {
  location: string;
  type: 'cpu' | 'memory' | 'io' | 'network';
  impact: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  solution: string;
}

export interface DuplicationReport {
  duplicates: DuplicateOperation[];
  totalWastedTime: number;
  potentialSavings: number;
  recommendations: string[];
}

export interface DuplicateOperation {
  operation: string;
  occurrences: number;
  wastedTime: number;
  locations: string[];
  consolidationSuggestion: string;
}

export interface AutomationReport {
  opportunities: AutomationOpportunity[];
  totalManualEffort: number;
  potentialAutomation: number;
  prioritizedRecommendations: string[];
}

export interface AutomationOpportunity {
  task: string;
  frequency: number;
  manualEffort: number; // minutes
  automationComplexity: 'low' | 'medium' | 'high';
  roi: number; // return on investment score
  description: string;
}

export interface CacheEfficiencyReport {
  cacheHitRate: number;
  missedOpportunities: CacheMissOpportunity[];
  recommendations: string[];
  score: number;
}

export interface CacheMissOpportunity {
  operation: string;
  frequency: number;
  computationCost: number;
  cacheability: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface ResourceOptimizationReport {
  currentUsage: ResourceUsage;
  optimizedUsage: ResourceUsage;
  savings: ResourceSavings;
  recommendations: string[];
}

export interface ResourceUsage {
  memory: number; // MB
  cpu: number; // percentage
  disk: number; // MB
  network: number; // KB/s
}

export interface ResourceSavings {
  memory: number;
  cpu: number;
  disk: number;
  network: number;
  cost: number; // estimated cost savings
}

// TypeScript First Checker関連
export interface TypeSafetyReport {
  filePath: string;
  typeErrors: TypeError[];
  warnings: TypeWarning[];
  score: number; // 0-100
  recommendations: string[];
}

export interface TypeError {
  code: string;
  message: string;
  lineNumber: number;
  column: number;
  severity: 'error' | 'warning';
}

export interface TypeWarning {
  code: string;
  message: string;
  lineNumber: number;
  column: number;
  suggestion: string;
}

export interface StrictModeReport {
  isStrictMode: boolean;
  nonCompliantFiles: string[];
  violations: StrictModeViolation[];
  score: number;
}

export interface StrictModeViolation {
  file: string;
  rule: string;
  lineNumber: number;
  description: string;
  autoFixable: boolean;
}

export interface CompletenessReport {
  totalInterfaces: number;
  completeInterfaces: number;
  missingTypes: MissingType[];
  score: number;
  recommendations: string[];
}

export interface MissingType {
  location: string;
  expectedType: string;
  currentType: string;
  impact: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface InferenceReport {
  totalInferences: number;
  explicitTypes: number;
  unnecessaryExplicitTypes: UnnecessaryType[];
  missingInferences: MissingInference[];
  score: number;
}

export interface UnnecessaryType {
  location: string;
  currentType: string;
  inferredType: string;
  recommendation: string;
}

export interface MissingInference {
  location: string;
  reason: string;
  suggestion: string;
}

export interface RuntimeTypeReport {
  totalChecks: number;
  validatedChecks: number;
  missingValidations: MissingValidation[];
  score: number;
}

export interface MissingValidation {
  location: string;
  type: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

// システム状態関連
export interface SystemState {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    processes: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  errors: {
    recent: number;
    critical: number;
  };
  performance: {
    averageResponseTime: number;
    throughput: number;
  };
}

export interface HealthStatus {
  overall: 'healthy' | 'warning' | 'critical';
  components: ComponentHealth[];
  recommendations: string[];
  lastChecked: Date;
}

export interface ComponentHealth {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  metrics: Record<string, number>;
  issues: string[];
}

// 設定関連
export interface ConstitutionalAIConfig {
  enabled: boolean;
  principles: {
    failFast: {
      enabled: boolean;
      strictness: 'low' | 'medium' | 'high';
      autoFix: boolean;
    };
    beLazy: {
      enabled: boolean;
      performanceThreshold: number; // ms
      duplicateThreshold: number;
      autoOptimize: boolean;
    };
    typeScriptFirst: {
      enabled: boolean;
      strictMode: boolean;
      enforceExplicitTypes: boolean;
      autoInference: boolean;
    };
  };
  reporting: {
    detailedReports: boolean;
    realTimeMonitoring: boolean;
    dashboard: boolean;
  };
  integration: {
    gitHooks: boolean;
    cicd: boolean;
    vscode: boolean;
  };
}

// 自動修復関連
export interface FixReport {
  totalViolations: number;
  fixedViolations: number;
  failedFixes: FailedFix[];
  appliedFixes: AppliedFix[];
  executionTime: number;
}

export interface FailedFix {
  violation: ConstitutionalViolation;
  reason: string;
  manualSteps: string[];
}

export interface AppliedFix {
  violation: ConstitutionalViolation;
  changes: FileChange[];
  verificationStatus: 'success' | 'partial' | 'failed';
}

export interface FileChange {
  filePath: string;
  lineNumber: number;
  oldContent: string;
  newContent: string;
  changeType: 'addition' | 'modification' | 'deletion';
}

export interface ImprovementReport {
  filePath: string;
  improvements: CodeImprovement[];
  qualityScore: {
    before: number;
    after: number;
    improvement: number;
  };
  executionTime: number;
}

export interface CodeImprovement {
  type: 'performance' | 'readability' | 'maintainability' | 'security';
  description: string;
  changes: FileChange[];
  impact: 'low' | 'medium' | 'high';
}

export interface ConfigOptimizationReport {
  currentConfig: ConstitutionalAIConfig;
  optimizedConfig: ConstitutionalAIConfig;
  improvements: ConfigImprovement[];
  estimatedImpact: string;
}

export interface ConfigImprovement {
  setting: string;
  currentValue: any;
  optimizedValue: any;
  reason: string;
  impact: 'low' | 'medium' | 'high';
}