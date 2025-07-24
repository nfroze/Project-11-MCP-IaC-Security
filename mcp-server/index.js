import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GitHubClient } from './tools/github-client.js';
import { CheckovParser } from './tools/checkov-parser.js';
import { RemediationEngine } from './tools/remediation-engine.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class CheckovAnalyzerServer {
  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      console.error('GITHUB_TOKEN environment variable is required');
      process.exit(1);
    }
    
    this.github = new GitHubClient(process.env.GITHUB_TOKEN);
    this.parser = new CheckovParser();
    this.remediation = new RemediationEngine();
  }

  async analyzeLatestScan(owner, repo) {
    try {
      // Get the latest workflow run
      const latestRun = await this.github.getLatestWorkflowRun(owner, repo, 'checkov-scan.yml');
      
      if (!latestRun) {
        return {
          error: 'No Checkov scan runs found',
          suggestion: 'Push code to trigger the GitHub Actions workflow'
        };
      }

      // Download and parse Checkov results
      const checkovResults = await this.github.getCheckovResults(owner, repo, latestRun.id);
      
      if (!checkovResults) {
        return {
          error: 'No Checkov results found in the workflow run',
          runUrl: latestRun.html_url
        };
      }

      // Parse and categorize findings
      const categorized = this.parser.categorizeFindings(checkovResults);
      
      return {
        summary: checkovResults.summary,
        runUrl: latestRun.html_url,
        runStatus: latestRun.status,
        runConclusion: latestRun.conclusion,
        timestamp: latestRun.created_at,
        findings: categorized,
        totalIssues: checkovResults.summary.failed
      };
    } catch (error) {
      console.error('Error analyzing scan:', error);
      throw error;
    }
  }

  async getRemediationForFinding(owner, repo, checkId, filePath) {
    try {
      // Get the terraform file content
      const fileContent = await this.github.getFileContent(owner, repo, filePath);
      
      // Generate remediation
      const remediation = this.remediation.getRemediation(checkId, fileContent, filePath);
      
      return remediation;
    } catch (error) {
      console.error('Error getting remediation:', error);
      throw error;
    }
  }

  async generateFullReport(owner, repo) {
    try {
      // Get analysis
      const analysis = await this.analyzeLatestScan(owner, repo);
      
      if (analysis.error) {
        return analysis;
      }

      // Get terraform files
      const tfFiles = await this.github.getTerraformFiles(owner, repo, 'vulnerable-terraform');
      
      // Generate remediations for all critical and high findings
      const remediations = [];
      const criticalAndHigh = [
        ...(analysis.findings.critical || []),
        ...(analysis.findings.high || [])
      ];

      for (const finding of criticalAndHigh) {
        try {
          const remediation = await this.getRemediationForFinding(
            owner, 
            repo, 
            finding.check_id,
            finding.file_path
          );
          remediations.push({
            ...finding,
            remediation
          });
        } catch (error) {
          console.error(`Failed to get remediation for ${finding.check_id}:`, error);
        }
      }

      return {
        ...analysis,
        remediations,
        terraformFiles: tfFiles.length
      };
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }
}

// Initialize MCP server
const analyzer = new CheckovAnalyzerServer();

const server = new Server(
  {
    name: 'checkov-analyzer',
    version: '1.0.0',
    description: 'Analyze Checkov security findings and provide Terraform remediation'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Register available tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'analyze_latest_scan',
      description: 'Analyze the latest Checkov scan results from GitHub Actions',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'GitHub repository owner'
          },
          repo: {
            type: 'string',
            description: 'GitHub repository name'
          }
        },
        required: ['owner', 'repo']
      }
    },
    {
      name: 'get_remediation',
      description: 'Get specific remediation code for a Checkov finding',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'GitHub repository owner'
          },
          repo: {
            type: 'string',
            description: 'GitHub repository name'
          },
          check_id: {
            type: 'string',
            description: 'Checkov check ID (e.g., CKV_AWS_16)'
          },
          file_path: {
            type: 'string',
            description: 'Path to the Terraform file'
          }
        },
        required: ['owner', 'repo', 'check_id', 'file_path']
      }
    },
    {
      name: 'generate_security_report',
      description: 'Generate a comprehensive security report with remediations',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'GitHub repository owner'
          },
          repo: {
            type: 'string',
            description: 'GitHub repository name'
          }
        },
        required: ['owner', 'repo']
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_latest_scan': {
        const result = await analyzer.analyzeLatestScan(args.owner, args.repo);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'get_remediation': {
        const result = await analyzer.getRemediationForFinding(
          args.owner,
          args.repo,
          args.check_id,
          args.file_path
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'generate_security_report': {
        const result = await analyzer.generateFullReport(args.owner, args.repo);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, null, 2)
      }]
    };
  }
});

// Start the server
const transport = new StdioServerTransport();
server.connect(transport);

console.error('Checkov Analyzer MCP Server running...');