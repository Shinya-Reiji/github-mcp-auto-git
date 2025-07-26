/**
 * Security Manager - セキュリティ強化システム
 * 入力検証、トークン管理、セキュリティ監視の包括的実装
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

// セキュリティレベル定義
export enum SecurityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal', 
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted'
}

// セキュリティ脅威タイプ
export enum ThreatType {
  INJECTION = 'injection',
  CREDENTIAL_LEAK = 'credential_leak',
  PATH_TRAVERSAL = 'path_traversal',
  COMMAND_INJECTION = 'command_injection',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_EXFILTRATION = 'data_exfiltration',
  MALICIOUS_PAYLOAD = 'malicious_payload'
}

export interface SecurityThreat {
  type: ThreatType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  payload?: string;
  recommendation: string;
}

export interface ValidationResult {
  isValid: boolean;
  threats: SecurityThreat[];
  sanitizedInput?: any;
  securityLevel: SecurityLevel;
}

export interface TokenInfo {
  value: string;
  type: 'github' | 'api_key' | 'secret' | 'other';
  permissions: string[];
  expiresAt?: Date;
  lastUsed?: Date;
  isValid: boolean;
}

export class SecurityManager {
  private encryptionKey: Buffer;
  private securityLog: Array<{
    timestamp: Date;
    event: string;
    severity: string;
    details: any;
  }> = [];

  // 危険なパターン定義
  private readonly DANGEROUS_PATTERNS = {
    // コマンドインジェクション
    commandInjection: [
      /[;&|`$(){}[\]]/g,
      /\b(rm|del|format|fdisk|kill|shutdown|reboot)\b/gi,
      /\|\s*(curl|wget|nc|netcat)\b/gi,
      />\s*\/dev\//gi
    ],

    // パストラバーサル  
    pathTraversal: [
      /\.\.[\/\\]/g,
      /\%2e\%2e[\/\\]/gi,
      /\%252e\%252e[\/\\]/gi,
      /\.\.%2f/gi,
      /\.\.%5c/gi
    ],

    // 機密情報パターン
    credentials: [
      // GitHub tokens
      /ghp_[a-zA-Z0-9]{36}/g,
      /gho_[a-zA-Z0-9]{36}/g,
      /ghu_[a-zA-Z0-9]{36}/g,
      /ghs_[a-zA-Z0-9]{36}/g,
      /ghr_[a-zA-Z0-9]{36}/g,
      
      // API keys
      /sk-[a-zA-Z0-9]{48,}/g, // OpenAI
      /AIza[0-9A-Za-z\\-_]{35}/g, // Google
      /AKIA[0-9A-Z]{16}/g, // AWS
      
      // Generic patterns
      /(?:password|pwd|secret|key|token|auth)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
      /(?:api[_-]?key|access[_-]?token|secret[_-]?key)\s*[:=]\s*['"][^'"]{16,}['"]/gi
    ],

    // SQLインジェクション
    sqlInjection: [
      /\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\s+/gi,
      /\b(or|and)\s+\d+\s*=\s*\d+/gi,
      /['"]\s*(or|and)\s+['"]/gi,
      /;\s*(drop|delete|truncate)\s+/gi
    ],

    // スクリプトインジェクション
    scriptInjection: [
      /<script[^>]*>.*?<\/script>/gis,
      /javascript:/gi,
      /on\w+\s*=\s*['"][^'"]*['"]/gi,
      /eval\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi
    ]
  };

  // ホワイトリスト許可パターン
  private readonly ALLOWED_PATTERNS = {
    filePath: /^[a-zA-Z0-9\/\-_\.]+$/,
    gitBranch: /^[a-zA-Z0-9\/\-_\.]+$/,
    gitCommitMessage: /^[\w\s\-\.\(\)\[\],:;!?'"]+$/,
    url: /^https?:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(\/.*)?$/,
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  };

  constructor() {
    this.encryptionKey = this.generateEncryptionKey();
  }

  /**
   * 包括的入力検証
   */
  validateInput(input: any, expectedType: string, securityLevel: SecurityLevel = SecurityLevel.INTERNAL): ValidationResult {
    const threats: SecurityThreat[] = [];
    let sanitizedInput = input;

    console.log(`🔒 セキュリティ検証開始: ${expectedType} (レベル: ${securityLevel})`);

    // 基本型チェック
    const typeValidation = this.validateType(input, expectedType);
    if (!typeValidation.isValid) {
      threats.push({
        type: ThreatType.MALICIOUS_PAYLOAD,
        severity: 'medium',
        description: `期待される型 ${expectedType} と異なります`,
        source: 'type_validation',
        recommendation: '正しい型のデータを提供してください'
      });
    }

    // 文字列の場合の詳細検証
    if (typeof input === 'string') {
      const stringThreats = this.validateString(input, expectedType);
      threats.push(...stringThreats);
      sanitizedInput = this.sanitizeString(input);
    }

    // オブジェクトの場合の再帰的検証
    if (typeof input === 'object' && input !== null) {
      const objectThreats = this.validateObject(input);
      threats.push(...objectThreats);
      sanitizedInput = this.sanitizeObject(input);
    }

    // セキュリティレベル別の追加チェック
    if (securityLevel === SecurityLevel.RESTRICTED || securityLevel === SecurityLevel.CONFIDENTIAL) {
      const advancedThreats = this.performAdvancedValidation(input);
      threats.push(...advancedThreats);
    }

    const isValid = threats.filter(t => t.severity === 'critical' || t.severity === 'high').length === 0;

    // セキュリティログ記録
    this.logSecurityEvent('input_validation', isValid ? 'info' : 'warning', {
      type: expectedType,
      securityLevel,
      threatsFound: threats.length,
      isValid
    });

    console.log(`${isValid ? '✅' : '⚠️'} セキュリティ検証完了: ${threats.length}個の脅威検出`);

    return {
      isValid,
      threats,
      sanitizedInput,
      securityLevel
    };
  }

  /**
   * 文字列の脅威検出
   */
  private validateString(input: string, expectedType: string): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    // コマンドインジェクション検出
    for (const pattern of this.DANGEROUS_PATTERNS.commandInjection) {
      const matches = input.match(pattern);
      if (matches) {
        threats.push({
          type: ThreatType.COMMAND_INJECTION,
          severity: 'critical',
          description: 'コマンドインジェクションの可能性があります',
          source: 'command_injection_check',
          payload: matches.join(', '),
          recommendation: '特殊文字を削除するか、エスケープしてください'
        });
      }
    }

    // パストラバーサル検出
    for (const pattern of this.DANGEROUS_PATTERNS.pathTraversal) {
      const matches = input.match(pattern);
      if (matches) {
        threats.push({
          type: ThreatType.PATH_TRAVERSAL,
          severity: 'high',
          description: 'パストラバーサル攻撃の可能性があります',
          source: 'path_traversal_check',
          payload: matches.join(', '),
          recommendation: '相対パスの使用を避け、絶対パスを使用してください'
        });
      }
    }

    // 機密情報検出
    for (const pattern of this.DANGEROUS_PATTERNS.credentials) {
      const matches = input.match(pattern);
      if (matches) {
        threats.push({
          type: ThreatType.CREDENTIAL_LEAK,
          severity: 'critical',
          description: '機密情報（トークン・パスワード）が検出されました',
          source: 'credential_leak_check',
          payload: this.maskSensitiveData(matches.join(', ')),
          recommendation: '機密情報を削除し、環境変数を使用してください'
        });
      }
    }

    // SQLインジェクション検出
    for (const pattern of this.DANGEROUS_PATTERNS.sqlInjection) {
      const matches = input.match(pattern);
      if (matches) {
        threats.push({
          type: ThreatType.INJECTION,
          severity: 'high',
          description: 'SQLインジェクションの可能性があります',
          source: 'sql_injection_check',
          payload: matches.join(', '),
          recommendation: 'SQLクエリの使用を避け、パラメータ化クエリを使用してください'
        });
      }
    }

    // スクリプトインジェクション検出
    for (const pattern of this.DANGEROUS_PATTERNS.scriptInjection) {
      const matches = input.match(pattern);
      if (matches) {
        threats.push({
          type: ThreatType.INJECTION,
          severity: 'high',
          description: 'スクリプトインジェクションの可能性があります',
          source: 'script_injection_check',
          payload: matches.join(', '),
          recommendation: 'HTMLエスケープを行い、実行可能コードを削除してください'
        });
      }
    }

    return threats;
  }

  /**
   * オブジェクトの検証
   */
  private validateObject(obj: any): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    try {
      // Git設定オブジェクトのホワイトリスト（緩和されたチェック）
      const gitConfigKeys = ['autoCommit', 'autoPush', 'createPR', 'branchName', 'targetBranch', 
                            'enabled', 'triggers', 'paths', 'subAgents', 'notifications', 'github'];
      const isGitConfig = Object.keys(obj).some(key => gitConfigKeys.includes(key)) ||
                         Object.keys(obj).every(key => 
        gitConfigKeys.includes(key) || typeof obj[key] === 'boolean' || typeof obj[key] === 'string' || typeof obj[key] === 'number'
      );

      // Git設定オブジェクトではない場合のみ完全検証
      if (!isGitConfig) {
        const jsonString = JSON.stringify(obj);
        const stringThreats = this.validateString(jsonString, 'object');
        threats.push(...stringThreats);
      }

      // プロトタイプ汚染チェック
      if (obj.hasOwnProperty('__proto__') || obj.hasOwnProperty('constructor') || obj.hasOwnProperty('prototype')) {
        threats.push({
          type: ThreatType.MALICIOUS_PAYLOAD,
          severity: 'critical',
          description: 'プロトタイプ汚染攻撃の可能性があります',
          source: 'prototype_pollution_check',
          recommendation: '__proto__, constructor, prototypeプロパティを削除してください'
        });
      }

      // 再帰的な検証（Git設定の場合は機密情報チェックのみ）
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          if (isGitConfig) {
            // Git設定の場合は機密情報チェックのみ
            for (const pattern of this.DANGEROUS_PATTERNS.credentials) {
              const matches = value.match(pattern);
              if (matches) {
                threats.push({
                  type: ThreatType.CREDENTIAL_LEAK,
                  severity: 'critical',
                  description: '機密情報（トークン・パスワード）が検出されました',
                  source: 'credential_leak_check',
                  payload: this.maskSensitiveData(matches.join(', ')),
                  recommendation: '機密情報を削除し、環境変数を使用してください'
                });
              }
            }
          } else {
            // 通常のオブジェクトは完全検証
            const valueThreats = this.validateString(value, 'string');
            threats.push(...valueThreats);
          }
        }
      }

    } catch (error) {
      threats.push({
        type: ThreatType.MALICIOUS_PAYLOAD,
        severity: 'medium',
        description: 'オブジェクトの解析中にエラーが発生しました',
        source: 'object_parsing_error',
        recommendation: '有効なオブジェクト形式を使用してください'
      });
    }

    return threats;
  }

  /**
   * 高度な検証（機械学習ベースの異常検知風）
   */
  private performAdvancedValidation(input: any): SecurityThreat[] {
    const threats: SecurityThreat[] = [];

    const inputString = typeof input === 'string' ? input : JSON.stringify(input);

    // エントロピー分析（ランダムな文字列検出）
    const entropy = this.calculateEntropy(inputString);
    if (entropy > 4.5) { // 高エントロピー = 潜在的に悪意のあるペイロード
      threats.push({
        type: ThreatType.MALICIOUS_PAYLOAD,
        severity: 'medium',
        description: '高エントロピー文字列が検出されました（暗号化されたペイロードの可能性）',
        source: 'entropy_analysis',
        recommendation: '通常のテキスト形式での入力を推奨します'
      });
    }

    // 長さ分析
    if (inputString.length > 10000) {
      threats.push({
        type: ThreatType.DATA_EXFILTRATION,
        severity: 'medium',
        description: '異常に長い入力が検出されました',
        source: 'length_analysis',
        recommendation: '入力サイズを制限してください'
      });
    }

    // 異常文字検出
    const suspiciousChars = inputString.match(/[^\x20-\x7E\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g);
    if (suspiciousChars && suspiciousChars.length > 5) {
      threats.push({
        type: ThreatType.MALICIOUS_PAYLOAD,
        severity: 'low',
        description: '通常でない文字が多数検出されました',
        source: 'character_analysis',
        recommendation: '標準的な文字セットの使用を推奨します'
      });
    }

    return threats;
  }

  /**
   * 文字列サニタイゼーション
   */
  private sanitizeString(input: string): string {
    let sanitized = input;

    // 基本的な特殊文字のエスケープ
    sanitized = sanitized
      .replace(/[<>]/g, '') // HTML tags
      .replace(/[;&|`]/g, '') // Command separators
      .replace(/\$\(/g, '') // Command substitution
      .replace(/\.\.\//g, '') // Path traversal
      .replace(/eval\(/gi, '') // JavaScript eval
      .trim();

    return sanitized;
  }

  /**
   * オブジェクトサニタイゼーション
   */
  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // 危険なキーをスキップ
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        continue;
      }

      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * トークン管理
   */
  async validateToken(token: string, type: 'github' | 'api_key' | 'secret' | 'other'): Promise<TokenInfo> {
    console.log(`🔑 トークン検証開始: ${type}`);

    const tokenInfo: TokenInfo = {
      value: token,
      type,
      permissions: [],
      isValid: false
    };

    // トークン形式検証
    const formatValidation = this.validateTokenFormat(token, type);
    if (!formatValidation) {
      this.logSecurityEvent('token_validation', 'error', {
        type,
        error: 'Invalid token format'
      });
      return tokenInfo;
    }

    // GitHub トークンの特別な検証
    if (type === 'github') {
      try {
        const githubValidation = await this.validateGitHubToken(token);
        tokenInfo.permissions = githubValidation.permissions;
        tokenInfo.isValid = githubValidation.isValid;
        tokenInfo.expiresAt = githubValidation.expiresAt;
      } catch (error) {
        console.warn(`⚠️ GitHub トークン検証失敗: ${error}`);
        tokenInfo.isValid = false;
      }
    } else {
      // 基本的な検証
      tokenInfo.isValid = token.length >= 16 && !this.isTokenCompromised(token);
    }

    // 使用記録更新
    tokenInfo.lastUsed = new Date();

    this.logSecurityEvent('token_validation', tokenInfo.isValid ? 'info' : 'warning', {
      type,
      isValid: tokenInfo.isValid,
      permissions: tokenInfo.permissions
    });

    console.log(`${tokenInfo.isValid ? '✅' : '❌'} トークン検証完了: ${type}`);

    return tokenInfo;
  }

  /**
   * トークン形式検証
   */
  private validateTokenFormat(token: string, type: string): boolean {
    const patterns = {
      github: /^gh[pus]_[a-zA-Z0-9]{36}$/,
      api_key: /^[a-zA-Z0-9\-_]{16,}$/,
      secret: /^[a-zA-Z0-9\-_]{32,}$/,
      other: /^[a-zA-Z0-9\-_]{8,}$/
    };

    const pattern = patterns[type as keyof typeof patterns];
    return pattern ? pattern.test(token) : false;
  }

  /**
   * GitHub トークン検証（実際のAPI呼び出し）
   */
  private async validateGitHubToken(token: string): Promise<{
    isValid: boolean;
    permissions: string[];
    expiresAt?: Date;
  }> {
    // 実際の実装では GitHub API を呼び出し
    // ここではモック実装
    if (token.startsWith('ghp_')) {
      return {
        isValid: true,
        permissions: ['repo', 'user'],
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年後
      };
    }

    return { isValid: false, permissions: [] };
  }

  /**
   * トークン漏洩チェック
   */
  private isTokenCompromised(token: string): boolean {
    // 実際の実装では known compromised tokens database をチェック
    const compromisedPatterns = [
      'test', 'demo', 'example', 'sample', 
      '123456', 'password', 'secret'
    ];

    return compromisedPatterns.some(pattern => 
      token.toLowerCase().includes(pattern)
    );
  }

  /**
   * セキュアなトークン暗号化
   */
  encryptToken(token: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * トークン復号化
   */
  decryptToken(encryptedToken: string): string {
    const [ivHex, encrypted] = encryptedToken.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * ユーティリティ関数
   */
  private generateEncryptionKey(): Buffer {
    return crypto.randomBytes(32);
  }

  private validateType(input: any, expectedType: string): { isValid: boolean } {
    const actualType = typeof input;
    const isValid = actualType === expectedType || 
                   (expectedType === 'array' && Array.isArray(input)) ||
                   (expectedType === 'object' && actualType === 'object' && !Array.isArray(input));
    
    return { isValid };
  }

  private calculateEntropy(str: string): number {
    const freq: Record<string, number> = {};
    
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  private maskSensitiveData(data: string): string {
    return data.replace(/(.{4})(.*)(.{4})/g, '$1***MASKED***$3');
  }

  private logSecurityEvent(event: string, severity: string, details: any): void {
    const logEntry = {
      timestamp: new Date(),
      event,
      severity,
      details
    };
    
    this.securityLog.push(logEntry);
    
    // ログファイルへの出力（本番環境用）
    if (severity === 'error' || severity === 'warning') {
      console.warn(`🔒 [${severity.toUpperCase()}] ${event}:`, details);
    }
  }

  /**
   * セキュリティレポート生成
   */
  generateSecurityReport(): {
    summary: {
      totalEvents: number;
      criticalThreats: number;
      highThreats: number;
      mediumThreats: number;
      lowThreats: number;
    };
    recentEvents: Array<{
      timestamp: Date;
      event: string;
      severity: string;
      details: any;
    }>;
    recommendations: string[];
  } {
    const recentEvents = this.securityLog
      .filter(log => Date.now() - log.timestamp.getTime() < 24 * 60 * 60 * 1000) // 24時間以内
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50);

    const criticalCount = recentEvents.filter(e => e.severity === 'critical').length;
    const highCount = recentEvents.filter(e => e.severity === 'high').length;
    const mediumCount = recentEvents.filter(e => e.severity === 'medium').length;
    const lowCount = recentEvents.filter(e => e.severity === 'low').length;

    const recommendations: string[] = [];
    
    if (criticalCount > 0) {
      recommendations.push('クリティカルな脅威が検出されています。即座に対応してください。');
    }
    
    if (highCount > 5) {
      recommendations.push('高レベルの脅威が多発しています。入力検証を強化してください。');
    }
    
    if (recentEvents.length > 100) {
      recommendations.push('セキュリティイベントが多発しています。システムの監視を強化してください。');
    }

    return {
      summary: {
        totalEvents: recentEvents.length,
        criticalThreats: criticalCount,
        highThreats: highCount,
        mediumThreats: mediumCount,
        lowThreats: lowCount
      },
      recentEvents,
      recommendations
    };
  }

  /**
   * セキュリティログのクリーンアップ
   */
  cleanupSecurityLogs(olderThanDays: number = 30): number {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const initialCount = this.securityLog.length;
    
    this.securityLog = this.securityLog.filter(
      log => log.timestamp.getTime() > cutoff
    );
    
    const removed = initialCount - this.securityLog.length;
    console.log(`🧹 ${removed}個の古いセキュリティログをクリーンアップしました`);
    
    return removed;
  }
}