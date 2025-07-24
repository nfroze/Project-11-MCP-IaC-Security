export class RemediationEngine {
  constructor() {
    this.remediations = this.loadRemediations();
  }

  loadRemediations() {
    return {
      // S3 Bucket Security
      'CKV_AWS_53': {
        title: 'Enable S3 Block Public ACLs',
        impact: 'Prevents public access via ACLs',
        fix: {
          code: 'block_public_acls = true',
          resource: 'aws_s3_bucket_public_access_block',
          attribute: 'block_public_acls'
        }
      },
      'CKV_AWS_54': {
        title: 'Enable S3 Block Public Policy',
        impact: 'Prevents public bucket policies',
        fix: {
          code: 'block_public_policy = true',
          resource: 'aws_s3_bucket_public_access_block',
          attribute: 'block_public_policy'
        }
      },
      'CKV_AWS_55': {
        title: 'Enable S3 Ignore Public ACLs',
        impact: 'Ignores all public ACLs on the bucket',
        fix: {
          code: 'ignore_public_acls = true',
          resource: 'aws_s3_bucket_public_access_block',
          attribute: 'ignore_public_acls'
        }
      },
      'CKV_AWS_56': {
        title: 'Enable S3 Restrict Public Buckets',
        impact: 'Restricts public bucket policies',
        fix: {
          code: 'restrict_public_buckets = true',
          resource: 'aws_s3_bucket_public_access_block',
          attribute: 'restrict_public_buckets'
        }
      },
      'CKV_AWS_18': {
        title: 'Enable S3 Bucket Logging',
        impact: 'Provides audit trail for bucket access',
        fix: {
          code: `resource "aws_s3_bucket_logging" "data" {
  bucket = aws_s3_bucket.data.id
  
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "access-logs/"
}`,
          resource: 'aws_s3_bucket_logging',
          attribute: null,
          additional: 'You will need a separate S3 bucket for logs'
        }
      },
      'CKV_AWS_21': {
        title: 'Enable S3 Versioning',
        impact: 'Enables version control and recovery',
        fix: {
          code: `resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  
  versioning_configuration {
    status = "Enabled"
  }
}`,
          resource: 'aws_s3_bucket_versioning',
          attribute: null
        }
      },
      'CKV2_AWS_67': {
        title: 'Enable S3 Default Encryption',
        impact: 'Encrypts all objects at rest',
        fix: {
          code: `resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}`,
          resource: 'aws_s3_bucket_server_side_encryption_configuration',
          attribute: null
        }
      },
      
      // RDS Security
      'CKV_AWS_16': {
        title: 'Enable RDS Encryption',
        impact: 'Encrypts database storage at rest',
        fix: {
          code: 'storage_encrypted = true',
          resource: 'aws_db_instance',
          attribute: 'storage_encrypted',
          additional: 'Note: Cannot be applied to existing unencrypted instances'
        }
      },
      'CKV_AWS_17': {
        title: 'Remove Hardcoded Database Password',
        impact: 'Prevents credential exposure in code',
        fix: {
          code: `# Option 1: Use AWS Secrets Manager
password = random_password.db.result

resource "random_password" "db" {
  length  = 16
  special = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "rds-password"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

# Option 2: Use variable
password = var.db_password  # Define in terraform.tfvars or environment`,
          resource: 'aws_db_instance',
          attribute: 'password'
        }
      },
      'CKV2_AWS_59': {
        title: 'Disable RDS Public Access',
        impact: 'Prevents direct internet access to database',
        fix: {
          code: 'publicly_accessible = false',
          resource: 'aws_db_instance',
          attribute: 'publicly_accessible'
        }
      },
      'CKV_AWS_133': {
        title: 'Enable RDS Backup Retention',
        impact: 'Enables point-in-time recovery',
        fix: {
          code: 'backup_retention_period = 7  # Minimum 7 days recommended',
          resource: 'aws_db_instance',
          attribute: 'backup_retention_period'
        }
      },
      'CKV_AWS_293': {
        title: 'Enable RDS Deletion Protection',
        impact: 'Prevents accidental database deletion',
        fix: {
          code: 'deletion_protection = true',
          resource: 'aws_db_instance',
          attribute: 'deletion_protection'
        }
      },
      
      // Security Group
      'CKV_AWS_23': {
        title: 'Restrict Security Group Ingress',
        impact: 'Implements least privilege network access',
        fix: {
          code: `ingress {
  description = "HTTPS from VPC"
  from_port   = 443
  to_port     = 443
  protocol    = "tcp"
  cidr_blocks = [aws_vpc.main.cidr_block]  # Restrict to VPC
}

ingress {
  description = "SSH from bastion"
  from_port   = 22
  to_port     = 22
  protocol    = "tcp"
  cidr_blocks = ["10.0.1.0/24"]  # Restrict to bastion subnet
}`,
          resource: 'aws_security_group',
          attribute: 'ingress',
          additional: 'Remove the wildcard (0.0.0.0/0) ingress rule'
        }
      },
      'CKV_AWS_260': {
        title: 'Remove Unrestricted Security Group Ingress',
        impact: 'Prevents unauthorized access',
        fix: {
          code: '# Remove any ingress rules with cidr_blocks = ["0.0.0.0/0"]',
          resource: 'aws_security_group',
          attribute: 'ingress'
        }
      },
      
      // IAM
      'CKV_AWS_63': {
        title: 'Remove IAM Wildcard Actions',
        impact: 'Implements least privilege permissions',
        fix: {
          code: `Action = [
  "s3:GetObject",
  "s3:PutObject",
  "s3:DeleteObject",
  "s3:ListBucket"
]  # Specify only required actions`,
          resource: 'aws_iam_policy',
          attribute: 'policy.Statement.Action'
        }
      },
      'CKV_AWS_1': {
        title: 'Remove IAM Wildcard Resources',
        impact: 'Restricts access to specific resources',
        fix: {
          code: `Resource = [
  "arn:aws:s3:::my-bucket",
  "arn:aws:s3:::my-bucket/*"
]  # Specify exact resources`,
          resource: 'aws_iam_policy',
          attribute: 'policy.Statement.Resource'
        }
      },
      
      // EC2
      'CKV_AWS_126': {
        title: 'Enable EC2 Detailed Monitoring',
        impact: 'Provides 1-minute monitoring intervals',
        fix: {
          code: 'monitoring = true',
          resource: 'aws_instance',
          attribute: 'monitoring'
        }
      },
      'CKV_AWS_88': {
        title: 'Disable EC2 Public IP',
        impact: 'Prevents direct internet exposure',
        fix: {
          code: 'associate_public_ip_address = false',
          resource: 'aws_instance',
          attribute: 'associate_public_ip_address',
          additional: 'Use a NAT gateway or bastion host for outbound access'
        }
      },
      'CKV_AWS_79': {
        title: 'Enforce IMDSv2',
        impact: 'Prevents SSRF attacks on metadata service',
        fix: {
          code: `metadata_options {
  http_endpoint               = "enabled"
  http_tokens                 = "required"  # Enforce IMDSv2
  http_put_response_hop_limit = 1
}`,
          resource: 'aws_instance',
          attribute: 'metadata_options'
        }
      },
      'CKV_AWS_8': {
        title: 'Enable EBS Encryption',
        impact: 'Encrypts data at rest on EBS volumes',
        fix: {
          code: `root_block_device {
  encrypted = true
}`,
          resource: 'aws_instance',
          attribute: 'root_block_device'
        }
      },
      
      // VPC
      'CKV2_AWS_11': {
        title: 'Enable VPC Flow Logs',
        impact: 'Provides network traffic visibility',
        fix: {
          code: `resource "aws_flow_log" "main" {
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.flow_log.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id
}

resource "aws_cloudwatch_log_group" "flow_log" {
  name = "vpc-flow-logs"
}`,
          resource: 'aws_flow_log',
          attribute: null
        }
      }
    };
  }

  getRemediation(checkId, fileContent, filePath) {
    const remediation = this.remediations[checkId];
    
    if (!remediation) {
      return {
        check_id: checkId,
        status: 'no_remediation_available',
        message: 'No automated remediation available for this check'
      };
    }

    // Extract the resource block that needs fixing
    const resourceContext = this.extractResourceContext(fileContent, remediation.resource);
    
    return {
      check_id: checkId,
      title: remediation.title,
      impact: remediation.impact,
      fix: remediation.fix,
      file_path: filePath,
      current_configuration: resourceContext,
      implementation_notes: this.getImplementationNotes(checkId),
      example: this.generateExample(checkId, remediation)
    };
  }

  extractResourceContext(fileContent, resourceType) {
    if (!fileContent || !resourceType) return null;
    
    // Simple regex to find resource blocks
    const resourceRegex = new RegExp(
      `resource\\s+"${resourceType}"\\s+"[^"]+\\s*{[^}]*}`,
      'gs'
    );
    
    const matches = fileContent.match(resourceRegex);
    return matches ? matches[0] : null;
  }

  getImplementationNotes(checkId) {
    const notes = {
      'CKV_AWS_16': 'Encryption cannot be enabled on existing RDS instances. You must create a snapshot and restore to a new encrypted instance.',
      'CKV_AWS_17': 'After implementing, rotate the password immediately and update any applications using the database.',
      'CKV_AWS_18': 'Requires a separate S3 bucket for storing logs. Consider lifecycle policies for log retention.',
      'CKV_AWS_23': 'Review application requirements before restricting. May need multiple ingress rules for different services.',
      'CKV2_AWS_11': 'Flow logs incur additional costs. Consider using S3 as destination for cost optimization.',
      'CKV_AWS_79': 'Applications must be updated to use IMDSv2. Test thoroughly before applying to production.'
    };
    
    return notes[checkId] || 'Test changes in a non-production environment first.';
  }

  generateExample(checkId, remediation) {
    // For complex remediations, provide a complete example
    if (remediation.fix.code.includes('resource')) {
      return {
        type: 'new_resource',
        description: 'Add this new resource to your Terraform configuration',
        code: remediation.fix.code
      };
    }
    
    return {
      type: 'attribute_update',
      description: `Update the ${remediation.fix.attribute} attribute in your ${remediation.resource} resource`,
      code: remediation.fix.code
    };
  }

  generatePullRequestContent(findings, remediations) {
    const prTitle = `Security: Fix ${remediations.length} critical Checkov findings`;
    
    const prBody = `## Security Improvements

This PR addresses ${remediations.length} security findings identified by Checkov.

### Summary of Changes

${remediations.map(r => `- **${r.check_id}**: ${r.title}`).join('\n')}

### Detailed Changes

${remediations.map(r => `
#### ${r.check_id}: ${r.title}
- **Impact**: ${r.impact}
- **File**: \`${r.file_path}\`
- **Implementation Notes**: ${r.implementation_notes}
`).join('\n')}

### Testing
- [ ] Changes have been tested in development environment
- [ ] No breaking changes to existing infrastructure
- [ ] Applications have been updated for any required changes

### Security Impact
This PR improves our security posture by addressing critical infrastructure vulnerabilities.
`;

    return { title: prTitle, body: prBody };
  }
}