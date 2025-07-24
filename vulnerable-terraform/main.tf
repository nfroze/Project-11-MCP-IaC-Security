terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2"  # London region
}

# VPC without flow logs - CKV2_AWS_11
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "vulnerable-vpc"
  }
}

# Overly permissive security group - CKV_AWS_23, CKV_AWS_260
resource "aws_security_group" "wide_open" {
  name        = "allow_all"
  description = "Allow all traffic"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# S3 bucket with multiple vulnerabilities
resource "aws_s3_bucket" "data" {
  bucket = "mcp-demo-vulnerable-bucket-${random_string.suffix.result}"
}

resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# Public access not blocked - CKV_AWS_53, CKV_AWS_54, CKV_AWS_55, CKV_AWS_56
resource "aws_s3_bucket_public_access_block" "data" {
  bucket = aws_s3_bucket.data.id
  
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Missing encryption - CKV2_AWS_67
# Missing versioning - CKV_AWS_21
# Missing logging - CKV_AWS_18

# RDS with multiple vulnerabilities
resource "aws_db_instance" "database" {
  identifier     = "vulnerable-db"
  engine         = "mysql"
  engine_version = "5.7"
  instance_class = "db.t3.micro"
  
  allocated_storage = 20
  username          = "admin"
  password          = "changeme123!"  # CKV_AWS_17 - Hardcoded password
  
  storage_encrypted       = false  # CKV_AWS_16
  backup_retention_period = 0      # CKV_AWS_133
  publicly_accessible     = true   # CKV2_AWS_59
  skip_final_snapshot     = true
  deletion_protection     = false  # CKV_AWS_293
  
  vpc_security_group_ids = [aws_security_group.wide_open.id]
}

# Overly permissive IAM policy - CKV_AWS_63, CKV_AWS_1
resource "aws_iam_policy" "admin" {
  name = "overly-permissive-policy"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "*"
      Resource = "*"
    }]
  })
}

# EC2 instance without monitoring - CKV_AWS_8
resource "aws_instance" "web" {
  ami           = "ami-0eb260c4d5475b901"  # Ubuntu 22.04 in eu-west-2
  instance_type = "t2.micro"
  
  monitoring                  = false  # CKV_AWS_126
  associate_public_ip_address = true   # CKV_AWS_88
  
  vpc_security_group_ids = [aws_security_group.wide_open.id]
  
  # Missing IMDSv2 enforcement - CKV_AWS_79
  # Missing EBS encryption - CKV_AWS_8
}