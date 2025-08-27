# Project 11: MCP IaC Security

## Overview

MCP server that analyses Checkov findings and generates Terraform fixes. Connects Claude Desktop to GitHub Actions to retrieve security scan results.

## Technologies

- MCP SDK: Model Context Protocol for AI integration
- Node.js: MCP server runtime
- GitHub Actions: CI/CD pipeline with Checkov scanning
- Terraform: Infrastructure as Code
- Checkov: Static security scanner for IaC

## Installation

### Clone Repository
```bash
git clone https://github.com/nfroze/Project-11-MCP-Powered-IaC-Security-Remediation.git
cd Project-11-MCP-Powered-IaC-Security-Remediation
```

### Install Dependencies
```bash
cd mcp-server
npm install
```

### Configure Environment
Create `.env` file in `mcp-server` directory:
```env
GITHUB_TOKEN=your_github_personal_access_token
```

### Configure Claude Desktop

Add to configuration file:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "checkov-analyser": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token"
      }
    }
  }
}
```

## How It Works

1. GitHub Actions runs Checkov on push
2. Checkov scans Terraform files and uploads results
3. MCP Server connects Claude to GitHub's API
4. Claude uses MCP tools to fetch and analyse results
5. Server provides specific fixes for findings

## MCP Tools

### `analyze_latest_scan`
Fetches and categorises Checkov findings

### `get_remediation`
Provides fix for specific security issue

### `generate_security_report`
Creates report with findings and fixes

### `get_terraform_file`
Retrieves Terraform files from repository

## Example Remediation

```hcl
# Fix for CKV_AWS_16: Enable RDS Encryption
storage_encrypted = true

# Fix for CKV_AWS_53-56: Block S3 Public Access
resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

## Project Structure

```
Project-11-MCP-IaC-Security/
├── mcp-server/
│   └── index.js          # MCP server implementation
├── terraform/
│   └── main.tf           # Intentionally vulnerable for demo
├── .github/
│   └── workflows/
│       └── checkov.yml   # Security scanning pipeline
└── documents/            # Generated reports and fixes
```

## Detected Vulnerabilities

The demo Terraform includes security misconfigurations:

- S3: Public access, missing encryption, no versioning
- RDS: Unencrypted storage, hardcoded passwords, no backups
- IAM: Wildcard permissions
- EC2: Public IPs, missing monitoring
- VPC: Missing flow logs
- Security Groups: Unrestricted ingress

## Prerequisites

- Node.js 18+
- GitHub account with Personal Access Token
- Claude Desktop application
- Terraform knowledge

Note: Contains intentionally vulnerable Terraform code for demonstration. Do not deploy to production.