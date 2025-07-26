/**
 * TypeScript First Checker
 * 型安全性検証、strict mode準拠、型定義完全性チェック
 */

import {
  TypeSafetyReport,
  TypeError,
  TypeWarning,
  StrictModeReport,
  StrictModeViolation,
  CompletenessReport,
  MissingType,
  InferenceReport,
  UnnecessaryType,
  MissingInference,
  RuntimeTypeReport,
  MissingValidation,
  ConstitutionalViolation
} from '../../types/constitutional-ai.js';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface TypeScriptFirstConfig {
  enabled: boolean;
  strictMode: boolean;
  enforceExplicitTypes: boolean;
  autoInference: boolean;
}

export interface TypeScriptFirstResult {
  score: number;
  violations: ConstitutionalViolation[];
  recommendations: string[];
  details: {
    typeSafety: TypeSafetyReport;
    strictMode: StrictModeReport;
    completeness: CompletenessReport;
    inference: InferenceReport;
    runtimeTypes: RuntimeTypeReport;
  };
}

export class TypeScriptFirstChecker {
  private workingDir: string;
  private config: TypeScriptFirstConfig;

  constructor(workingDir: string, config: TypeScriptFirstConfig) {
    this.workingDir = workingDir;
    this.config = config;
  }

  /**
   * TypeScript First原則の型分析
   */
  async performTypeAnalysis(context?: {
    files?: string[];
    operation?: string;
    metadata?: Record<string, any>;
  }): Promise<TypeScriptFirstResult> {
    if (!this.config.enabled) {
      return this.getDisabledResult();
    }

    try {
      console.log('🔷 TypeScript First Checker 実行中...');

      const files = context?.files || await this.findTypeScriptFiles();

      // 各分析を並列実行
      const [typeSafety, strictMode, completeness, inference, runtimeTypes] = await Promise.all([
        this.validateTypeSafety(files),
        this.verifyStrictMode(),
        this.checkTypeCompleteness(files),
        this.optimizeTypeInference(files),
        this.validateRuntimeTypes(files)
      ]);

      const violations = this.analyzeTypeResults(typeSafety, strictMode, completeness, inference, runtimeTypes);
      const score = this.calculateTypeScore(typeSafety, strictMode, completeness, inference, runtimeTypes);
      const recommendations = this.generateTypeRecommendations(violations);

      console.log(`✅ TypeScript First チェック完了 (スコア: ${score}/100)`);

      return {
        score,
        violations,
        recommendations,
        details: {
          typeSafety,
          strictMode,
          completeness,
          inference,
          runtimeTypes
        }
      };

    } catch (error) {
      console.error('❌ TypeScript First Checker エラー:', error);
      return this.getErrorResult(error);
    }
  }

  /**
   * 型安全性検証
   */
  async validateTypeSafety(files: string[]): Promise<TypeSafetyReport> {
    const allTypeErrors: TypeError[] = [];
    const allWarnings: TypeWarning[] = [];
    let totalScore = 0;
    let fileCount = 0;

    for (const file of files) {
      try {
        const fullPath = join(this.workingDir, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        const typeErrors: TypeError[] = [];
        const warnings: TypeWarning[] = [];

        // 基本的な型エラーパターンの検出
        const anyUsage = content.match(/:\s*any\b/g) || [];
        anyUsage.forEach((match, index) => {
          const lineNumber = this.getLineNumber(content, content.indexOf(match));
          typeErrors.push({
            code: 'TS7006',
            message: 'Use of "any" type reduces type safety',
            lineNumber,
            column: 0,
            severity: 'warning'
          });
        });

        // 未定義型の検出
        const undefTypes = content.match(/:\s*undefined\b/g) || [];
        undefTypes.forEach((match, index) => {
          const lineNumber = this.getLineNumber(content, content.indexOf(match));
          warnings.push({
            code: 'TS2322',
            message: 'Consider using optional properties instead of undefined',
            lineNumber,
            column: 0,
            suggestion: 'Use "property?: Type" instead of "property: Type | undefined"'
          });
        });

        // 型アサーションの過度な使用
        const assertions = content.match(/as\s+\w+/g) || [];
        if (assertions.length > 5) {
          warnings.push({
            code: 'TS2352',
            message: 'Excessive use of type assertions',
            lineNumber: 1,
            column: 0,
            suggestion: 'Consider improving type inference or using type guards'
          });
        }

        // 型ガードの不足
        const typeGuards = content.match(/typeof\s+\w+\s*===|instanceof\s+\w+|\w+\s+in\s+\w+/g) || [];
        const conditionals = content.match(/if\s*\(/g) || [];
        if (conditionals.length > 3 && typeGuards.length === 0) {
          warnings.push({
            code: 'TS2345',
            message: 'Consider using type guards for runtime type checking',
            lineNumber: 1,
            column: 0,
            suggestion: 'Implement type guards for safer type narrowing'
          });
        }

        allTypeErrors.push(...typeErrors);
        allWarnings.push(...warnings);

        // ファイルスコア計算
        const fileScore = Math.max(0, 100 - (typeErrors.length * 10) - (warnings.length * 5));
        totalScore += fileScore;
        fileCount++;

      } catch (error) {
        allTypeErrors.push({
          code: 'FILE_ERROR',
          message: `Unable to analyze file: ${file}`,
          lineNumber: 1,
          column: 0,
          severity: 'error'
        });
      }
    }

    const averageScore = fileCount > 0 ? Math.round(totalScore / fileCount) : 100;

    const recommendations = [
      ...(allTypeErrors.some(e => e.message.includes('any')) ? 
        ['Replace "any" types with specific types'] : []),
      ...(allWarnings.some(w => w.suggestion.includes('type guards')) ? 
        ['Implement type guards for runtime safety'] : []),
      ...(allWarnings.some(w => w.message.includes('assertions')) ? 
        ['Reduce reliance on type assertions'] : [])
    ];

    return {
      filePath: files.join(', '),
      typeErrors: allTypeErrors,
      warnings: allWarnings,
      score: averageScore,
      recommendations
    };
  }

  /**
   * strict mode準拠チェック
   */
  async verifyStrictMode(): Promise<StrictModeReport> {
    try {
      const tsconfigPath = join(this.workingDir, 'tsconfig.json');
      let isStrictMode = false;
      const nonCompliantFiles: string[] = [];
      const violations: StrictModeViolation[] = [];

      try {
        const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(tsconfigContent);
        
        isStrictMode = tsconfig.compilerOptions?.strict === true ||
                      (tsconfig.compilerOptions?.noImplicitAny && 
                       tsconfig.compilerOptions?.strictNullChecks &&
                       tsconfig.compilerOptions?.strictFunctionTypes);

        if (!isStrictMode) {
          violations.push({
            file: 'tsconfig.json',
            rule: 'strict',
            lineNumber: 1,
            description: 'TypeScript strict mode is not enabled',
            autoFixable: true
          });
        }

        // 個別のstrictオプションチェック
        const strictOptions = [
          'noImplicitAny',
          'strictNullChecks',
          'strictFunctionTypes',
          'strictBindCallApply',
          'strictPropertyInitialization',
          'noImplicitReturns',
          'noImplicitThis'
        ];

        strictOptions.forEach(option => {
          if (!tsconfig.compilerOptions?.[option]) {
            violations.push({
              file: 'tsconfig.json',
              rule: option,
              lineNumber: 1,
              description: `${option} is not enabled`,
              autoFixable: true
            });
          }
        });

      } catch (error) {
        violations.push({
          file: 'tsconfig.json',
          rule: 'existence',
          lineNumber: 1,
          description: 'tsconfig.json not found or invalid',
          autoFixable: true
        });
      }

      // TypeScriptファイルのstrictモード違反をチェック
      const tsFiles = await this.findTypeScriptFiles();
      for (const file of tsFiles.slice(0, 10)) { // サンプル検査
        try {
          const content = await fs.readFile(join(this.workingDir, file), 'utf-8');
          
          // 暗黙的anyの検出
          if (content.match(/function\s+\w+\s*\([^)]*\)\s*\{/) && !content.includes(': ')) {
            nonCompliantFiles.push(file);
            violations.push({
              file,
              rule: 'noImplicitAny',
              lineNumber: 1,
              description: 'Function parameters lack type annotations',
              autoFixable: false
            });
          }

          // null/undefined チェックの不足
          if (content.includes('.') && !content.includes('?.') && !content.includes('!')) {
            const potentialNullable = content.match(/\w+\.\w+/g) || [];
            if (potentialNullable.length > 5) {
              violations.push({
                file,
                rule: 'strictNullChecks',
                lineNumber: 1,
                description: 'Potential null/undefined access without null checks',
                autoFixable: false
              });
            }
          }

        } catch (error) {
          // ファイル読み込みエラーは無視
        }
      }

      const score = Math.max(0, 100 - (violations.length * 10));

      return {
        isStrictMode,
        nonCompliantFiles,
        violations,
        score
      };

    } catch (error) {
      return {
        isStrictMode: false,
        nonCompliantFiles: [],
        violations: [{
          file: 'system',
          rule: 'analysis',
          lineNumber: 1,
          description: 'Strict mode analysis failed',
          autoFixable: false
        }],
        score: 0
      };
    }
  }

  /**
   * 型定義完全性チェック
   */
  async checkTypeCompleteness(files: string[]): Promise<CompletenessReport> {
    let totalInterfaces = 0;
    let completeInterfaces = 0;
    const missingTypes: MissingType[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(join(this.workingDir, file), 'utf-8');
        
        // インターフェース定義の検出
        const interfaces = content.match(/interface\s+\w+\s*\{[^}]*\}/g) || [];
        totalInterfaces += interfaces.length;

        interfaces.forEach(interfaceStr => {
          // プロパティの型定義チェック
          const properties = interfaceStr.match(/\w+\s*:\s*\w+/g) || [];
          const anyTypes = interfaceStr.match(/:\s*any\b/g) || [];
          
          if (anyTypes.length === 0) {
            completeInterfaces++;
          } else {
            missingTypes.push({
              location: file,
              expectedType: 'specific type',
              currentType: 'any',
              impact: 'medium',
              suggestion: 'Replace any types with specific types'
            });
          }
        });

        // 関数の戻り値型チェック
        const functions = content.match(/function\s+\w+\s*\([^)]*\)\s*\{|=>\s*\{|\w+\s*\([^)]*\)\s*\{/g) || [];
        functions.forEach(func => {
          if (!func.includes(':') || !func.match(/:\s*\w+\s*[=>{]/)) {
            missingTypes.push({
              location: file,
              expectedType: 'return type annotation',
              currentType: 'inferred',
              impact: 'low',
              suggestion: 'Add explicit return type annotation'
            });
          }
        });

        // 変数の型注釈チェック
        const variables = content.match(/(let|const|var)\s+\w+\s*=/g) || [];
        variables.forEach(variable => {
          if (!variable.includes(':')) {
            missingTypes.push({
              location: file,
              expectedType: 'explicit type',
              currentType: 'inferred',
              impact: 'low',
              suggestion: 'Consider adding explicit type annotation'
            });
          }
        });

      } catch (error) {
        missingTypes.push({
          location: file,
          expectedType: 'readable file',
          currentType: 'error',
          impact: 'high',
          suggestion: 'Fix file access issues'
        });
      }
    }

    const score = totalInterfaces > 0 ? Math.round((completeInterfaces / totalInterfaces) * 100) : 100;

    const recommendations = [
      ...(missingTypes.some(m => m.currentType === 'any') ? 
        ['Replace all "any" types with specific types'] : []),
      ...(missingTypes.some(m => m.expectedType.includes('return')) ? 
        ['Add explicit return type annotations to functions'] : []),
      ...(missingTypes.length > files.length * 2 ? 
        ['Consider enforcing explicit type annotations'] : [])
    ];

    return {
      totalInterfaces,
      completeInterfaces,
      missingTypes,
      score,
      recommendations
    };
  }

  /**
   * 型推論最適化
   */
  async optimizeTypeInference(files: string[]): Promise<InferenceReport> {
    let totalInferences = 0;
    let explicitTypes = 0;
    const unnecessaryExplicitTypes: UnnecessaryType[] = [];
    const missingInferences: MissingInference[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(join(this.workingDir, file), 'utf-8');
        
        // 明示的型注釈の検出
        const explicitTypeAnnotations = content.match(/:\s*[A-Z]\w*/g) || [];
        explicitTypes += explicitTypeAnnotations.length;

        // 不要な明示的型の検出
        const simpleAssignments = content.match(/(let|const)\s+\w+:\s*(string|number|boolean)\s*=\s*(["'`]\w*["'`]|\d+|true|false)/g) || [];
        simpleAssignments.forEach(assignment => {
          unnecessaryExplicitTypes.push({
            location: file,
            currentType: 'explicit annotation',
            inferredType: 'automatically inferred',
            recommendation: 'Remove redundant type annotation'
          });
        });

        // 推論が困難な箇所の検出
        const complexExpressions = content.match(/=\s*[^;]+\?\s*[^:]+:\s*[^;]+/g) || [];
        complexExpressions.forEach(expr => {
          if (!expr.includes(':')) {
            missingInferences.push({
              location: file,
              reason: 'Complex conditional expression without type annotation',
              suggestion: 'Add explicit type annotation for clarity'
            });
          }
        });

        totalInferences += explicitTypeAnnotations.length + simpleAssignments.length;

      } catch (error) {
        missingInferences.push({
          location: file,
          reason: 'File analysis failed',
          suggestion: 'Ensure file is accessible and valid TypeScript'
        });
      }
    }

    const score = totalInferences > 0 ? 
      Math.max(0, 100 - (unnecessaryExplicitTypes.length * 5) - (missingInferences.length * 10)) : 100;

    return {
      totalInferences,
      explicitTypes,
      unnecessaryExplicitTypes,
      missingInferences,
      score
    };
  }

  /**
   * 実行時型検証
   */
  async validateRuntimeTypes(files: string[]): Promise<RuntimeTypeReport> {
    let totalChecks = 0;
    let validatedChecks = 0;
    const missingValidations: MissingValidation[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(join(this.workingDir, file), 'utf-8');
        
        // 型ガードの検出
        const typeGuards = content.match(/(typeof\s+\w+\s*===|instanceof\s+\w+|\w+\s+in\s+\w+)/g) || [];
        validatedChecks += typeGuards.length;

        // 外部入力の検出
        const externalInputs = [
          ...content.match(/process\.argv/g) || [],
          ...content.match(/JSON\.parse\(/g) || [],
          ...content.match(/req\.(body|query|params)/g) || [],
          ...content.match(/fs\.readFile/g) || []
        ];
        totalChecks += externalInputs.length;

        // 検証が不足している外部入力
        externalInputs.forEach((input, index) => {
          const inputContext = content.substring(
            Math.max(0, content.indexOf(input) - 100),
            content.indexOf(input) + 100
          );
          
          if (!inputContext.includes('typeof') && !inputContext.includes('instanceof')) {
            missingValidations.push({
              location: file,
              type: input.includes('argv') ? 'command line argument' :
                    input.includes('JSON') ? 'JSON data' :
                    input.includes('req') ? 'HTTP request' : 'file data',
              riskLevel: input.includes('JSON') || input.includes('req') ? 'high' : 'medium',
              suggestion: 'Add runtime type validation for external input'
            });
          }
        });

        // API境界の検出
        const apiBoundaries = content.match(/(export\s+function|export\s+async\s+function)/g) || [];
        apiBoundaries.forEach((boundary, index) => {
          const boundaryContext = content.substring(
            content.indexOf(boundary),
            content.indexOf(boundary) + 200
          );
          
          if (!boundaryContext.includes('typeof') && !boundaryContext.includes('instanceof')) {
            missingValidations.push({
              location: file,
              type: 'exported function',
              riskLevel: 'medium',
              suggestion: 'Add parameter validation for exported functions'
            });
          }
        });

      } catch (error) {
        missingValidations.push({
          location: file,
          type: 'file analysis',
          riskLevel: 'low',
          suggestion: 'Ensure file is accessible for runtime type validation analysis'
        });
      }
    }

    const score = totalChecks > 0 ? Math.round((validatedChecks / totalChecks) * 100) : 100;

    return {
      totalChecks,
      validatedChecks,
      missingValidations,
      score
    };
  }

  /**
   * TypeScriptファイル検索
   */
  private async findTypeScriptFiles(): Promise<string[]> {
    try {
      const files = await this.getAllFiles(this.workingDir, []);
      return files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
                 .filter(f => !f.includes('node_modules'))
                 .filter(f => !f.includes('.d.ts'));
    } catch (error) {
      return [];
    }
  }

  /**
   * 全ファイル取得（再帰）
   */
  private async getAllFiles(dir: string, files: string[]): Promise<string[]> {
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      
      for (const dirent of dirents) {
        const fullPath = join(dir, dirent.name);
        if (dirent.isDirectory() && !dirent.name.startsWith('.') && dirent.name !== 'node_modules') {
          await this.getAllFiles(fullPath, files);
        } else if (dirent.isFile()) {
          files.push(fullPath.replace(this.workingDir + '/', ''));
        }
      }
    } catch (error) {
      // ディレクトリアクセスエラーは無視
    }
    
    return files;
  }

  /**
   * 行番号取得
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * TypeScriptスコア計算
   */
  private calculateTypeScore(
    typeSafety: TypeSafetyReport,
    strictMode: StrictModeReport,
    completeness: CompletenessReport,
    inference: InferenceReport,
    runtimeTypes: RuntimeTypeReport
  ): number {
    // 重み付き平均（型安全性30%、strict mode25%、完全性20%、推論15%、実行時10%）
    return Math.round(
      typeSafety.score * 0.30 +
      strictMode.score * 0.25 +
      completeness.score * 0.20 +
      inference.score * 0.15 +
      runtimeTypes.score * 0.10
    );
  }

  /**
   * 型結果分析
   */
  private analyzeTypeResults(
    typeSafety: TypeSafetyReport,
    strictMode: StrictModeReport,
    completeness: CompletenessReport,
    inference: InferenceReport,
    runtimeTypes: RuntimeTypeReport
  ): ConstitutionalViolation[] {
    const violations: ConstitutionalViolation[] = [];

    // 型安全性違反
    typeSafety.typeErrors.forEach((error, index) => {
      violations.push({
        id: `type-safety-${index}`,
        principle: 'typescript-first',
        severity: error.severity === 'error' ? 'high' : 'medium',
        description: error.message,
        filePath: typeSafety.filePath,
        lineNumber: error.lineNumber,
        autoFixable: error.code !== 'FILE_ERROR',
        recommendation: 'Fix type safety violation'
      });
    });

    // strict mode違反
    strictMode.violations.forEach((violation, index) => {
      violations.push({
        id: `strict-mode-${index}`,
        principle: 'typescript-first',
        severity: violation.rule === 'strict' ? 'high' : 'medium',
        description: violation.description,
        filePath: violation.file,
        lineNumber: violation.lineNumber,
        autoFixable: violation.autoFixable,
        recommendation: `Enable ${violation.rule} in TypeScript configuration`
      });
    });

    // 型完全性違反
    if (completeness.score < 80) {
      violations.push({
        id: 'type-completeness',
        principle: 'typescript-first',
        severity: completeness.score < 50 ? 'high' : 'medium',
        description: `Type completeness is ${completeness.score}% (target: 80%+)`,
        autoFixable: false,
        recommendation: 'Improve type annotations and eliminate any types'
      });
    }

    // 実行時型検証違反
    runtimeTypes.missingValidations.forEach((validation, index) => {
      if (validation.riskLevel === 'high' || validation.riskLevel === 'critical') {
        violations.push({
          id: `runtime-validation-${index}`,
          principle: 'typescript-first',
          severity: validation.riskLevel as any,
          description: `Missing runtime validation for ${validation.type}`,
          filePath: validation.location,
          autoFixable: false,
          recommendation: validation.suggestion
        });
      }
    });

    return violations;
  }

  /**
   * 型推奨事項生成
   */
  private generateTypeRecommendations(violations: ConstitutionalViolation[]): string[] {
    const recommendations = new Set<string>();

    violations.forEach(violation => {
      recommendations.add(violation.recommendation);
    });

    // 一般的な推奨事項
    if (violations.some(v => v.description.includes('any'))) {
      recommendations.add('Eliminate all "any" types and use specific types');
    }

    if (violations.some(v => v.description.includes('strict'))) {
      recommendations.add('Enable all TypeScript strict mode options');
    }

    if (violations.some(v => v.description.includes('runtime'))) {
      recommendations.add('Implement comprehensive runtime type validation');
    }

    if (violations.length > 10) {
      recommendations.add('Consider systematic TypeScript improvements across the codebase');
    }

    return Array.from(recommendations);
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<TypeScriptFirstConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 無効時の結果
   */
  private getDisabledResult(): TypeScriptFirstResult {
    return {
      score: 0,
      violations: [],
      recommendations: ['TypeScript First checker is disabled'],
      details: {
        typeSafety: {
          filePath: 'disabled',
          typeErrors: [],
          warnings: [],
          score: 0,
          recommendations: []
        },
        strictMode: {
          isStrictMode: false,
          nonCompliantFiles: [],
          violations: [],
          score: 0
        },
        completeness: {
          totalInterfaces: 0,
          completeInterfaces: 0,
          missingTypes: [],
          score: 0,
          recommendations: []
        },
        inference: {
          totalInferences: 0,
          explicitTypes: 0,
          unnecessaryExplicitTypes: [],
          missingInferences: [],
          score: 0
        },
        runtimeTypes: {
          totalChecks: 0,
          validatedChecks: 0,
          missingValidations: [],
          score: 0
        }
      }
    };
  }

  /**
   * エラー時の結果
   */
  private getErrorResult(error: any): TypeScriptFirstResult {
    return {
      score: 0,
      violations: [{
        id: 'checker-error',
        principle: 'typescript-first',
        severity: 'critical',
        description: `TypeScript First checker error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        autoFixable: false,
        recommendation: 'Check TypeScript First checker configuration and dependencies'
      }],
      recommendations: ['Fix TypeScript First checker error'],
      details: {
        typeSafety: {
          filePath: 'error',
          typeErrors: [],
          warnings: [],
          score: 0,
          recommendations: []
        },
        strictMode: {
          isStrictMode: false,
          nonCompliantFiles: [],
          violations: [],
          score: 0
        },
        completeness: {
          totalInterfaces: 0,
          completeInterfaces: 0,
          missingTypes: [],
          score: 0,
          recommendations: []
        },
        inference: {
          totalInferences: 0,
          explicitTypes: 0,
          unnecessaryExplicitTypes: [],
          missingInferences: [],
          score: 0
        },
        runtimeTypes: {
          totalChecks: 0,
          validatedChecks: 0,
          missingValidations: [],
          score: 0
        }
      }
    };
  }
}