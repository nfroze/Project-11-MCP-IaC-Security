#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';
import AdmZip from 'adm-zip';
import dotenv from 'dotenv';
import { CheckovParser } from './tools/checkov-parser.js';
import { RemediationEngine } from './tools/remediation-engine.js';

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env.GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Initialize parser and remediation engine
const parser = new CheckovParser();
const remediation = new RemediationEngine();

// Tool implementations
async function analyzeLatestScan({ owner, repo }) {
  try {
    // Get the latest workflow run
    const { data } = await octokit.actions.listWorkflowRuns({
      owner,
      repo,
      workflow_id: 'checkov-scan.yml',
      per_page: 1,
      status: 'completed'
    });

    const latestRun = data.workflow_runs[0];
    
    if (!latestRun) {
      return JSON.stringify({
        error: 'No Checkov scan runs found',
        suggestion: 'Push code to trigger the GitHub Actions workflow'
      }, null, 2);
    }

    // Get artifacts
    const { data: { artifacts } } = await octokit.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: latestRun.id
    });

    const checkovArtifact = artifacts.find(
      artifact => artifact.name === 'checkov-results-json'
    );

    if (!checkovArtifact) {
      return JSON.stringify({
        error: 'No Checkov results found in the workflow run',
        runUrl: latestRun.html_url
      }, null, 2);
    }

    // Download artifact
    const { data: artifactData } = await octokit.actions.downloadArtifact({
      owner,
      repo,
      artifact_id: checkovArtifact.id,
      archive_format: 'zip'
    });

    // Extract JSON from zip
    const zip = new AdmZip(Buffer.from(artifactData));
    const zipEntries = zip.getEntries();
    let checkovResults = null;
    
    for (const entry of zipEntries) {
      if (entry.entryName === 'results_json.json') {
        const content = entry.getData().toString('utf8');
        checkovResults = JSON.parse(content);
        break;
      }
    }

    if (!checkovResults) {
      return JSON.stringify({
        error: 'Could not parse Checkov results from artifact'
      }, null, 2);
    }

    // Parse and categorize findings
    const categorized = parser.categorizeFindings(checkovResults);
    
    return JSON.stringify({
      summary: checkovResults.summary,
      runUrl: latestRun.html_url,
      runStatus: latestRun.status,
      runConclusion: latestRun.conclusion,
      timestamp: latestRun.created_at,
      findings: categorized,
      totalIssues: checkovResults.summary.failed
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: `Failed to analyze scan: ${error.message}`
    }, null, 2);
  }
}

async function getRemediation({ owner, repo, check_id, file_path }) {
  try {
    // Fix the path if it starts with / and doesn't include vulnerable-terraform
    let correctedPath = file_path;
    if (file_path.startsWith('/') && !file_path.includes('vulnerable-terraform')) {
      correctedPath = `vulnerable-terraform${file_path}`;
    }
    
    // Get the terraform file content
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: correctedPath  // Use the corrected path
    });

    const fileContent = Buffer.from(data.content, 'base64').toString('utf-8');
    
    // Generate remediation
    const remediationResult = remediation.getRemediation(check_id, fileContent, file_path);
    
    return JSON.stringify(remediationResult, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: `Failed to get remediation: ${error.message}`,
      attempted_path: correctedPath,  // Show what path we tried
      original_path: file_path
    }, null, 2);
  }
}

async function generateSecurityReport({ owner, repo }) {
  try {
    // First get the analysis
    const analysisJson = await analyzeLatestScan({ owner, repo });
    const analysis = JSON.parse(analysisJson);
    
    if (analysis.error) {
      return analysisJson;
    }

    // Get terraform files
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: 'vulnerable-terraform'
    });

    const tfFiles = Array.isArray(data) ? data.filter(file => file.name.endsWith('.tf')) : [];
    
    // Generate remediations for critical and high findings
    const remediations = [];
    const criticalAndHigh = [
      ...(analysis.findings.critical || []),
      ...(analysis.findings.high || [])
    ];

    for (const finding of criticalAndHigh) {
      try {
        const remediationJson = await getRemediation({
          owner,
          repo,
          check_id: finding.check_id,
          file_path: finding.file_path
        });
        const remediationData = JSON.parse(remediationJson);
        
        remediations.push({
          ...finding,
          remediation: remediationData
        });
      } catch (error) {
        console.error(`Failed to get remediation for ${finding.check_id}:`, error);
      }
    }

    return JSON.stringify({
      ...analysis,
      remediations,
      terraformFiles: tfFiles.length
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: `Failed to generate report: ${error.message}`
    }, null, 2);
  }
}

// Create server
const server = new Server(
  {
    name: 'checkov-analyser',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler for listing tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
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
  };
});

// Handler for calling tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    
    switch (name) {
      case 'analyze_latest_scan':
        result = await analyzeLatestScan(args);
        break;
      case 'get_remediation':
        result = await getRemediation(args);
        break;
      case 'generate_security_report':
        result = await generateSecurityReport(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ]
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Checkov Analyser MCP Server started');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});