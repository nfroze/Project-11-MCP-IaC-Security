export class CheckovParser {
  constructor() {
    this.severityLevels = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1
    };
  }

  categorizeFindings(checkovResults) {
    if (!checkovResults || !checkovResults.results) {
      return {
        critical: [],
        high: [],
        medium: [],
        low: []
      };
    }

    const findings = checkovResults.results.failed_checks || [];
    
    // Group by severity
    const categorized = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    findings.forEach(finding => {
      // Enrich finding with additional context
      const enrichedFinding = {
        check_id: finding.check_id,
        check_name: finding.check_name,
        file_path: finding.file_path,
        resource: finding.resource,
        severity: this.determineSeverity(finding),
        line_range: finding.file_line_range,
        guideline: finding.guideline,
        description: this.getDescription(finding.check_id)
      };

      const severityKey = enrichedFinding.severity.toLowerCase();
      if (categorized[severityKey]) {
        categorized[severityKey].push(enrichedFinding);
      }
    });

    // Sort each category by check_id for consistency
    Object.keys(categorized).forEach(key => {
      categorized[key].sort((a, b) => a.check_id.localeCompare(b.check_id));
    });

    return categorized;
  }

  determineSeverity(finding) {
    // Checkov doesn't always provide severity, so we map based on check ID
    const severityMap = {
      // Critical - Data exposure, encryption, auth
      'CKV_AWS_16': 'CRITICAL',  // RDS encryption
      'CKV_AWS_17': 'CRITICAL',  // Hardcoded passwords
      'CKV_AWS_53': 'CRITICAL',  // S3 Block Public ACLs
      'CKV_AWS_54': 'CRITICAL',  // S3 Block Public Policy
      'CKV_AWS_55': 'CRITICAL',  // S3 Ignore Public ACLs
      'CKV_AWS_56': 'CRITICAL',  // S3 Restrict Public Buckets
      'CKV_AWS_18': 'CRITICAL',  // S3 access logging
      'CKV_AWS_21': 'HIGH',      // S3 versioning
      'CKV2_AWS_67': 'CRITICAL', // S3 encryption
      
      // High - Network security, access control
      'CKV_AWS_23': 'HIGH',      // Security group wide open
      'CKV_AWS_260': 'HIGH',     // Security group unrestricted ingress
      'CKV2_AWS_59': 'HIGH',     // RDS publicly accessible
      'CKV_AWS_133': 'HIGH',     // RDS backup retention
      'CKV_AWS_63': 'HIGH',      // IAM wildcard actions
      'CKV_AWS_1': 'HIGH',       // IAM wildcard resources
      
      // Medium - Best practices, monitoring
      'CKV_AWS_126': 'MEDIUM',   // EC2 detailed monitoring
      'CKV_AWS_88': 'MEDIUM',    // EC2 public IP
      'CKV_AWS_8': 'MEDIUM',     // EC2 instance monitoring
      'CKV_AWS_79': 'MEDIUM',    // EC2 IMDSv2
      'CKV_AWS_293': 'MEDIUM',   // RDS deletion protection
      'CKV2_AWS_11': 'MEDIUM',   // VPC flow logs
      
      // Default to medium if unknown
      'DEFAULT': 'MEDIUM'
    };

    const checkId = finding.check_id;
    return severityMap[checkId] || severityMap['DEFAULT'];
  }

  getDescription(checkId) {
    const descriptions = {
      'CKV_AWS_16': 'RDS instance storage should be encrypted to protect data at rest',
      'CKV_AWS_17': 'Database passwords should not be hardcoded in Terraform files',
      'CKV_AWS_53': 'S3 buckets should block public ACLs to prevent unauthorized access',
      'CKV_AWS_54': 'S3 buckets should block public bucket policies',
      'CKV_AWS_55': 'S3 buckets should ignore public ACLs',
      'CKV_AWS_56': 'S3 buckets should restrict public bucket policies',
      'CKV_AWS_18': 'S3 buckets should have access logging enabled for audit trails',
      'CKV_AWS_21': 'S3 buckets should have versioning enabled for data recovery',
      'CKV2_AWS_67': 'S3 buckets should have server-side encryption enabled',
      'CKV_AWS_23': 'Security groups should not allow unrestricted ingress on all ports',
      'CKV_AWS_260': 'Security groups should not allow ingress from 0.0.0.0/0 to all ports',
      'CKV2_AWS_59': 'RDS instances should not be publicly accessible',
      'CKV_AWS_133': 'RDS instances should have backup retention period greater than 0',
      'CKV_AWS_63': 'IAM policies should not use wildcard actions',
      'CKV_AWS_1': 'IAM policies should not use wildcard resources',
      'CKV_AWS_126': 'EC2 instances should have detailed monitoring enabled',
      'CKV_AWS_88': 'EC2 instances should not have public IP addresses in production',
      'CKV_AWS_8': 'EC2 instances should use encrypted EBS volumes',
      'CKV_AWS_79': 'EC2 instances should use IMDSv2 for enhanced security',
      'CKV_AWS_293': 'RDS instances should have deletion protection enabled',
      'CKV2_AWS_11': 'VPC should have flow logs enabled for network monitoring'
    };

    return descriptions[checkId] || 'Security best practice violation detected';
  }

  generateSummaryStats(checkovResults) {
    if (!checkovResults || !checkovResults.summary) {
      return {
        total_checks: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        pass_rate: '0%'
      };
    }

    const summary = checkovResults.summary;
    const total = summary.passed + summary.failed;
    const passRate = total > 0 ? ((summary.passed / total) * 100).toFixed(1) : 0;

    return {
      total_checks: total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      pass_rate: `${passRate}%`
    };
  }
}