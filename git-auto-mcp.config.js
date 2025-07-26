module.exports = {
  enabled: true,
  triggers: ['save', 'auto'],
  paths: ['src/**/*', '!node_modules/**'],
  subAgents: {
    gitSafetyAnalyzer: {
      enabled: true,
      safetyThreshold: 0.85
    },
    commitMessageGenerator: {
      enabled: true,
      language: 'ja',
      style: 'friendly'
    },
    prManagementAgent: {
      enabled: true,
      autoMergeThreshold: 0.85
    }
  },
  notifications: {
    success: true,
    warnings: true,
    detailed: false
  },
  github: {
    owner: process.env.GITHUB_OWNER || '',
    repo: process.env.GITHUB_REPO || '',
    token: process.env.GITHUB_TOKEN || ''
  }
};