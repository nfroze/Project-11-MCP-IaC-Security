terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = "eu-west-2"  # London region
}

# VPC - maintaining same structure
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "secure-vpc"
  }
}

# FIXED: Restrictive security group instead of wide open
resource "aws_security_group" "web" {
  name        = "web_security_group"
  description = "Security group for web servers with restricted access"
  vpc_id      = aws_vpc.main.id

  # HTTPS from VPC only
  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  # HTTP from VPC only (if needed)
  ingress {
    description = "HTTP from VPC"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  # SSH from specific management subnet only
  ingress {
    description = "SSH from management subnet"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.1.0/24"]  # Adjust to your management subnet
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "web-security-group"
  }
}

# Security group for RDS
resource "aws_security_group" "rds" {
  name        = "rds_security_group"
  description = "Security group for RDS database with restricted access"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "MySQL/Aurora from web security group"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "rds-security-group"
  }
}

# S3 bucket for logs
resource "aws_s3_bucket" "logs" {
  bucket = "mcp-demo-logs-bucket-${random_string.suffix.result}"

  tags = {
    Name = "Log Storage Bucket"
  }
}

# S3 bucket ACL for logs
resource "aws_s3_bucket_acl" "logs" {
  bucket     = aws_s3_bucket.logs.id
  acl        = "log-delivery-write"
  depends_on = [aws_s3_bucket_ownership_controls.logs]
}

# S3 bucket ownership controls for logs
resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# Main S3 bucket with security improvements
resource "aws_s3_bucket" "data" {
  bucket = "mcp-demo-secure-bucket-${random_string.suffix.result}"

  tags = {
    Name = "Secure Data Bucket"
  }
}

resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# FIXED: Enable S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# FIXED: Enable S3 versioning
resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

# FIXED: Enable S3 access logging
resource "aws_s3_bucket_logging" "data" {
  bucket = aws_s3_bucket.data.id
  
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "access-logs/"
}

# FIXED: Block all public access
resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# FIXED: Generate secure random password for RDS
resource "random_password" "db" {
  length  = 16
  special = true
}

# FIXED: Store password in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name_prefix = "rds-password-"
  description = "Password for RDS MySQL instance"

  tags = {
    Name = "RDS Database Password"
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

# Create subnet for RDS (required for db_subnet_group)
resource "aws_subnet" "rds_subnet_1" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "eu-west-2a"

  tags = {
    Name = "RDS Subnet 1"
  }
}

resource "aws_subnet" "rds_subnet_2" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.3.0/24"
  availability_zone = "eu-west-2b"

  tags = {
    Name = "RDS Subnet 2"
  }
}

resource "aws_db_subnet_group" "rds" {
  name       = "rds-subnet-group"
  subnet_ids = [aws_subnet.rds_subnet_1.id, aws_subnet.rds_subnet_2.id]

  tags = {
    Name = "RDS DB subnet group"
  }
}

# FIXED: RDS with security improvements
resource "aws_db_instance" "database" {
  identifier     = "secure-db"
  engine         = "mysql"
  engine_version = "5.7"
  instance_class = "db.t3.micro"
  
  allocated_storage = 20
  username          = "admin"
  password          = random_password.db.result  # FIXED: Using generated password
  
  storage_encrypted       = true   # FIXED: Enable encryption
  backup_retention_period = 7      # FIXED: Enable backups (7 days)
  publicly_accessible     = false  # FIXED: Not publicly accessible
  skip_final_snapshot     = true
  deletion_protection     = false  # Consider enabling in production
  
  vpc_security_group_ids = [aws_security_group.rds.id]  # FIXED: Using restrictive security group
  db_subnet_group_name   = aws_db_subnet_group.rds.name

  tags = {
    Name = "Secure RDS Instance"
  }
}

# FIXED: Least-privilege IAM policy
resource "aws_iam_policy" "s3_access" {
  name        = "s3-bucket-access-policy"
  description = "Policy for accessing specific S3 bucket with least privileges"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ]
      Resource = [
        aws_s3_bucket.data.arn,
        "${aws_s3_bucket.data.arn}/*"
      ]
    }]
  })
}

# Create subnet for EC2
resource "aws_subnet" "web" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "eu-west-2a"

  tags = {
    Name = "Web Subnet"
  }
}

# EC2 instance with security improvements
resource "aws_instance" "web" {
  ami           = "ami-0eb260c4d5475b901"  # Ubuntu 22.04 in eu-west-2
  instance_type = "t2.micro"
  
  monitoring                  = false  # Consider enabling in production
  associate_public_ip_address = true   # Consider using private IP with NAT gateway in production
  
  vpc_security_group_ids = [aws_security_group.web.id]  # FIXED: Using restrictive security group
  subnet_id              = aws_subnet.web.id
  
  # Note: For production, consider:
  # - Enabling IMDSv2 with metadata_options block
  # - Using encrypted EBS volumes
  # - Attaching an IAM role

  tags = {
    Name = "Secure Web Server"
  }
}

# Output the secret ARN for reference
output "db_password_secret_arn" {
  value       = aws_secretsmanager_secret.db_password.arn
  description = "ARN of the secret containing the RDS password"
  sensitive   = true
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.data.id
  description = "Name of the secure S3 bucket"
}