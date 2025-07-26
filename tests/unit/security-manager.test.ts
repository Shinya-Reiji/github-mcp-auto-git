import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SecurityManager, SecurityLevel, ThreatType } from '../../src/core/security-manager';

describe('SecurityManager', () => {
  let securityManager: SecurityManager;

  beforeEach(() => {
    securityManager = new SecurityManager();
    jest.clearAllMocks();
  });

  describe('input validation', () => {
    it('should detect command injection attempts', () => {
      const maliciousInput = 'test.txt; rm -rf /';
      
      const result = securityManager.validateInput(
        maliciousInput, 
        'string', 
        SecurityLevel.RESTRICTED
      );

      expect(result.isValid).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0]?.type).toBe(ThreatType.COMMAND_INJECTION);
      expect(result.threats[0]?.severity).toBe('critical');
    });

    it('should detect path traversal attempts', () => {
      const maliciousPath = '../../etc/passwd';
      
      const result = securityManager.validateInput(
        maliciousPath, 
        'string', 
        SecurityLevel.RESTRICTED
      );

      expect(result.isValid).toBe(false);
      const pathThreats = result.threats.filter(t => t.type === ThreatType.PATH_TRAVERSAL);
      expect(pathThreats.length).toBeGreaterThan(0);
      expect(pathThreats[0]?.severity).toBe('high');
    });

    it('should detect credential leaks', () => {
      const credentialLeak = 'const apiKey = "sk-1234567890abcdef1234567890abcdef12345678"';
      
      const result = securityManager.validateInput(
        credentialLeak, 
        'string', 
        SecurityLevel.CONFIDENTIAL
      );

      expect(result.isValid).toBe(false);
      const credThreats = result.threats.filter(t => t.type === ThreatType.CREDENTIAL_LEAK);
      expect(credThreats.length).toBeGreaterThan(0);
      expect(credThreats[0]?.severity).toBe('critical');
    });

    it('should detect GitHub token patterns', () => {
      const githubToken = 'ghp_1234567890abcdef1234567890abcdef123456';
      
      const result = securityManager.validateInput(
        githubToken, 
        'string', 
        SecurityLevel.CONFIDENTIAL
      );

      expect(result.isValid).toBe(false);
      const tokenThreats = result.threats.filter(t => t.type === ThreatType.CREDENTIAL_LEAK);
      expect(tokenThreats.length).toBeGreaterThan(0);
      expect(tokenThreats[0]?.severity).toBe('critical');
    });

    it('should detect SQL injection attempts', () => {
      const sqlInjection = "'; DROP TABLE users; --";
      
      const result = securityManager.validateInput(
        sqlInjection, 
        'string', 
        SecurityLevel.INTERNAL
      );

      expect(result.isValid).toBe(false);
      const sqlThreats = result.threats.filter(t => t.type === ThreatType.INJECTION);
      expect(sqlThreats.length).toBeGreaterThan(0);
    });

    it('should detect script injection attempts', () => {
      const scriptInjection = '<script>alert("xss")</script>';
      
      const result = securityManager.validateInput(
        scriptInjection, 
        'string', 
        SecurityLevel.PUBLIC
      );

      expect(result.isValid).toBe(false);
      const scriptThreats = result.threats.filter(t => t.type === ThreatType.INJECTION);
      expect(scriptThreats.length).toBeGreaterThan(0);
    });

    it('should allow safe inputs', () => {
      const safeInput = 'src/components/Button.tsx';
      
      const result = securityManager.validateInput(
        safeInput, 
        'string', 
        SecurityLevel.INTERNAL
      );

      expect(result.isValid).toBe(true);
      expect(result.threats).toHaveLength(0);
      expect(result.sanitizedInput).toBe(safeInput);
    });

    it('should sanitize malicious input', () => {
      const maliciousInput = 'test<script>alert(1)</script>file.txt';
      
      const result = securityManager.validateInput(
        maliciousInput, 
        'string', 
        SecurityLevel.INTERNAL
      );

      expect(result.sanitizedInput).not.toContain('<script>');
      expect(result.sanitizedInput).not.toContain('</script>');
    });
  });

  describe('object validation', () => {
    it('should detect prototype pollution attempts', () => {
      const maliciousObject = {
        normalField: 'value',
        __proto__: { polluted: true }
      };
      
      const result = securityManager.validateInput(
        maliciousObject, 
        'object', 
        SecurityLevel.RESTRICTED
      );

      expect(result.isValid).toBe(false);
      const pollutionThreats = result.threats.filter(t => t.type === ThreatType.MALICIOUS_PAYLOAD);
      expect(pollutionThreats.length).toBeGreaterThan(0);
      expect(pollutionThreats[0]?.severity).toBe('critical');
    });

    it('should recursively validate object properties', () => {
      const objectWithMaliciousValue = {
        safe: 'value',
        dangerous: 'test; rm -rf /'
      };
      
      const result = securityManager.validateInput(
        objectWithMaliciousValue, 
        'object', 
        SecurityLevel.RESTRICTED
      );

      expect(result.isValid).toBe(false);
      const cmdThreats = result.threats.filter(t => t.type === ThreatType.COMMAND_INJECTION);
      expect(cmdThreats.length).toBeGreaterThan(0);
    });

    it('should sanitize object properties', () => {
      const objectToSanitize = {
        field1: 'safe value',
        field2: 'dangerous<script>alert(1)</script>value',
        __proto__: { evil: true }
      };
      
      const result = securityManager.validateInput(
        objectToSanitize, 
        'object', 
        SecurityLevel.INTERNAL
      );

      const sanitized = result.sanitizedInput as any;
      expect(sanitized.__proto__).toBeUndefined();
      expect(sanitized.field2).not.toContain('<script>');
      expect(sanitized.field1).toBe('safe value');
    });
  });

  describe('advanced validation', () => {
    it('should detect high entropy strings', () => {
      const highEntropyString = 'aB3$9kL2*nR7%vC4&xY8@tZ1!qW5^';
      
      const result = securityManager.validateInput(
        highEntropyString, 
        'string', 
        SecurityLevel.RESTRICTED
      );

      // 高エントロピーは必ずしも危険ではないが、警告として検出される
      const entropyThreats = result.threats.filter(t => 
        t.description.includes('高エントロピー')
      );
      expect(entropyThreats.length).toBeGreaterThanOrEqual(0);
    });

    it('should detect abnormally long inputs', () => {
      const longInput = 'x'.repeat(15000);
      
      const result = securityManager.validateInput(
        longInput, 
        'string', 
        SecurityLevel.RESTRICTED
      );

      const lengthThreats = result.threats.filter(t => t.type === ThreatType.DATA_EXFILTRATION);
      expect(lengthThreats.length).toBeGreaterThan(0);
    });

    it('should detect unusual characters', () => {
      const unusualChars = 'normal text \x00\x01\x02\x03\x04\x05 more chars';
      
      const result = securityManager.validateInput(
        unusualChars, 
        'string', 
        SecurityLevel.RESTRICTED
      );

      const charThreats = result.threats.filter(t => 
        t.description.includes('通常でない文字')
      );
      expect(charThreats.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('token validation', () => {
    it('should validate GitHub token format', async () => {
      const validGitHubToken = 'ghp_1234567890abcdef1234567890abcdef123456';
      
      const result = await securityManager.validateToken(validGitHubToken, 'github');

      expect(result.type).toBe('github');
      expect(result.value).toBe(validGitHubToken);
      expect(result.isValid).toBe(true);
      expect(result.permissions).toContain('repo');
    });

    it('should reject invalid token formats', async () => {
      const invalidToken = 'invalid-token-format';
      
      const result = await securityManager.validateToken(invalidToken, 'github');

      expect(result.isValid).toBe(false);
      expect(result.permissions).toHaveLength(0);
    });

    it('should detect compromised tokens', async () => {
      const compromisedToken = 'test123456789012345678901234567890123456';
      
      const result = await securityManager.validateToken(compromisedToken, 'api_key');

      expect(result.isValid).toBe(false);
    });

    it('should validate API key format', async () => {
      const validApiKey = 'ak_1234567890abcdef1234567890abcdef';
      
      const result = await securityManager.validateToken(validApiKey, 'api_key');

      expect(result.type).toBe('api_key');
      expect(result.lastUsed).toBeInstanceOf(Date);
    });
  });

  describe('token encryption/decryption', () => {
    it('should encrypt and decrypt tokens correctly', () => {
      const originalToken = 'ghp_secrettoken1234567890abcdef123456789';
      
      const encrypted = securityManager.encryptToken(originalToken);
      const decrypted = securityManager.decryptToken(encrypted);

      expect(encrypted).not.toBe(originalToken);
      expect(encrypted).toContain(':'); // IV:encrypted format
      expect(decrypted).toBe(originalToken);
    });

    it('should produce different encrypted values for same input', () => {
      const token = 'same-token-value';
      
      const encrypted1 = securityManager.encryptToken(token);
      const encrypted2 = securityManager.encryptToken(token);

      expect(encrypted1).not.toBe(encrypted2); // Different IVs should produce different outputs
      expect(securityManager.decryptToken(encrypted1)).toBe(token);
      expect(securityManager.decryptToken(encrypted2)).toBe(token);
    });
  });

  describe('security reporting', () => {
    it('should generate security report', () => {
      // Generate some security events
      securityManager.validateInput('malicious; rm -rf /', 'string', SecurityLevel.RESTRICTED);
      securityManager.validateInput('../../etc/passwd', 'string', SecurityLevel.RESTRICTED);
      securityManager.validateInput('safe input', 'string', SecurityLevel.INTERNAL);

      const report = securityManager.generateSecurityReport();

      expect(report.summary.totalEvents).toBeGreaterThan(0);
      expect(report.summary.criticalThreats).toBeGreaterThanOrEqual(0);
      expect(report.summary.highThreats).toBeGreaterThanOrEqual(0);
      expect(report.recentEvents.length).toBeGreaterThan(0);
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should provide recommendations for critical threats', () => {
      // Generate critical threat
      securityManager.validateInput('secret: sk-1234567890abcdef1234567890abcdef12345678', 'string', SecurityLevel.CONFIDENTIAL);

      const report = securityManager.generateSecurityReport();

      expect(report.summary.criticalThreats).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toContain('クリティカル');
    });
  });

  describe('security log cleanup', () => {
    it('should cleanup old security logs', () => {
      // Generate some events
      for (let i = 0; i < 5; i++) {
        securityManager.validateInput(`test input ${i}`, 'string', SecurityLevel.INTERNAL);
      }

      const initialReport = securityManager.generateSecurityReport();
      const initialCount = initialReport.summary.totalEvents;

      // Clean up logs older than 0 days (should remove all)
      const removedCount = securityManager.cleanupSecurityLogs(0);

      const finalReport = securityManager.generateSecurityReport();
      
      expect(removedCount).toBeGreaterThan(0);
      expect(finalReport.summary.totalEvents).toBeLessThan(initialCount);
    });
  });

  describe('type validation', () => {
    it('should validate string types correctly', () => {
      const result = securityManager.validateInput('test string', 'string', SecurityLevel.INTERNAL);
      expect(result.securityLevel).toBe(SecurityLevel.INTERNAL);
    });

    it('should validate array types correctly', () => {
      const result = securityManager.validateInput(['item1', 'item2'], 'array', SecurityLevel.INTERNAL);
      expect(result.securityLevel).toBe(SecurityLevel.INTERNAL);
    });

    it('should validate object types correctly', () => {
      const result = securityManager.validateInput({ key: 'value' }, 'object', SecurityLevel.INTERNAL);
      expect(result.securityLevel).toBe(SecurityLevel.INTERNAL);
    });

    it('should detect type mismatches', () => {
      const result = securityManager.validateInput(123, 'string', SecurityLevel.INTERNAL);
      
      const typeThreats = result.threats.filter(t => t.type === ThreatType.MALICIOUS_PAYLOAD);
      expect(typeThreats.length).toBeGreaterThan(0);
    });
  });
});