# Project 11: MCP Powered IaC Security Remediation

An innovative Model Context Protocol (MCP) server that connects Claude Desktop to GitHub Actions, analyses Checkov security findings, and provides instant Terraform remediation guidance.

## TLDR

I gave Claude access to my GitHub Action workflows, asked him to present findings and fix vulnerabilties. He did this in a matter of seconds.

[Findings]



## 🚀 Overview

This project demonstrates the future of AI-augmented DevSecOps by creating an MCP server that:
- **Analyses** Checkov security scan results from GitHub Actions
- **Categorises** findings by severity (Critical → Low)
- **Generates** specific Terraform remediation code
- **Explains** security impacts and implementation notes

### Key Innovation
Transforms hours of manual security remediation into seconds of AI-powered analysis, providing exact code fixes for infrastructure vulnerabilities.

## 🛠️ Technical Stack

- **MCP SDK**: Anthropic's Model Context Protocol for AI integration
- **Node.js**: MCP server runtime
- **GitHub Actions**: CI/CD pipeline with Checkov scanning
- **Terraform**: Infrastructure as Code
- **Checkov**: Static security scanner for IaC

## 📋 Prerequisites

- Node.js 18+ installed
- GitHub account with Personal Access Token
- Claude Desktop application
- Basic understanding of Terraform

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/Project-11-MCP-Powered-IaC-Security-Remediation.git
cd Project-11-MCP-Powered-IaC-Security-Remediation
```

### 2. Install MCP Server Dependencies
```bash
cd mcp-server
npm install
```

### 3. Configure Environment
Create a `.env` file in the `mcp-server` directory:
```env
GITHUB_TOKEN=your_github_personal_access_token
```

### 4. Configure Claude Desktop
Add to your Claude Desktop configuration file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "checkov-analyzer": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token"
      }
    }
  }
}
```

## 🚦 Usage

### 1. Trigger a Checkov Scan
Push code to the repository or manually trigger the GitHub Actions workflow:
```bash
git push origin main
```

### 2. Analyse Results in Claude
Open Claude Desktop and try these commands:

```
Analyse the latest Checkov scan for my terraform project
```

```
Show me how to fix the critical S3 security findings
```

```
Generate a complete security report with remediations
```

### 3. Example Interaction

**You**: "What security issues did Checkov find in my latest scan?"

**Claude**: "I'll analyse your latest Checkov scan results...

Found **15 security issues** in your Terraform configuration:

**🔴 Critical (7)**
- CKV_AWS_16: RDS instance storage not encrypted
- CKV_AWS_17: Hardcoded database password
- CKV_AWS_53-56: S3 bucket allows public access

**🟠 High (5)**
- CKV_AWS_23: Security group allows unrestricted access
- CKV_AWS_63: IAM policy uses wildcard permissions

Would you like me to show you how to fix the critical issues?"

## 📁 Project Structure

```
├── vulnerable-terraform/     # Intentionally vulnerable IaC for testing
│   └── main.tf
├── .github/
│   └── workflows/
│       └── checkov-scan.yml # Automated security scanning
├── mcp-server/             # MCP implementation
│   ├── index.js           # Main server
│   ├── package.json       # Dependencies
│   └── tools/            # Modular components
│       ├── github-client.js
│       ├── checkov-parser.js
│       └── remediation-engine.js
└── README.md
```

## 🔍 How It Works

1. **GitHub Actions** runs Checkov on every push
2. **Checkov** scans Terraform files and uploads results as artefacts
3. **MCP Server** connects Claude to GitHub's API
4. **Claude** uses MCP tools to fetch and analyse results
5. **Remediation Engine** provides specific fixes for each finding

## 📊 Example Vulnerabilities Detected

The demo Terraform includes common security misconfigurations:

- **S3**: Public access, missing encryption, no versioning
- **RDS**: Unencrypted storage, hardcoded passwords, no backups
- **IAM**: Wildcard permissions, overly permissive policies
- **EC2**: Public IPs, missing monitoring, no IMDSv2
- **VPC**: Missing flow logs
- **Security Groups**: Unrestricted ingress (0.0.0.0/0)

## 🛡️ Security Remediations

The MCP server provides specific fixes like:

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

## 🎯 MCP Tools Available

### `analyze_latest_scan`
Fetches and categorises the latest Checkov findings

### `get_remediation`
Provides specific fix for a single security issue

### `generate_security_report`
Creates comprehensive report with all findings and fixes

## 🚀 Future Enhancements

- [ ] Support for other IaC tools (CloudFormation, Pulumi)
- [ ] Auto-generate Pull Requests with fixes
- [ ] Integration with other security scanners (Terrascan, TFSec)
- [ ] Cost impact analysis of security remediations
- [ ] Compliance mapping (CIS, PCI-DSS, HIPAA)

## 📈 Impact Metrics

- **Time Savings**: 4 hours manual analysis → 30 seconds with AI
- **Coverage**: 40+ Checkov security rules supported
- **Accuracy**: Specific remediation code for each finding

## 🤝 Contributing

This is a portfolio project demonstrating MCP capabilities. Feel free to fork and extend!

## 📄 Licence

MIT Licence - See LICENCE file for details

## 🙏 Acknowledgements

- Anthropic for the MCP SDK and Claude
- Bridgecrew for Checkov
- The DevSecOps community

---

**Note**: This project contains intentionally vulnerable Terraform code for demonstration purposes. Do not deploy the vulnerable configurations to production environments.

## Author

**Noah Frost**  
DevSecOps Engineer | Former Police Constable  
[LinkedIn](https://www.linkedin.com/in/noahfrost-devsecops)

---

> "Shifting security left, one MCP tool at a time."