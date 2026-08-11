################################################################################
# CloudWatch Alarms for EKS Upgrade Service
################################################################################

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "alarm_sns_arn" {
  description = "SNS topic ARN for alarm notifications"
  type        = string
}

variable "api_ecs_cluster" {
  description = "ECS cluster name running the API"
  type        = string
}

variable "api_ecs_service" {
  description = "ECS service name for the API"
  type        = string
}

# API Service CPU Alarm
resource "aws_cloudwatch_metric_alarm" "api_cpu_high" {
  alarm_name          = "eks-upgrade-api-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "EKS Upgrade API CPU utilization exceeded 80%"
  alarm_actions       = [var.alarm_sns_arn]
  ok_actions          = [var.alarm_sns_arn]
  dimensions = {
    ClusterName = var.api_ecs_cluster
    ServiceName = var.api_ecs_service
  }
}

# API Service Memory Alarm
resource "aws_cloudwatch_metric_alarm" "api_memory_high" {
  alarm_name          = "eks-upgrade-api-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "EKS Upgrade API memory utilization exceeded 85%"
  alarm_actions       = [var.alarm_sns_arn]
  dimensions = {
    ClusterName = var.api_ecs_cluster
    ServiceName = var.api_ecs_service
  }
}

# RDS CPU Alarm
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "eks-upgrade-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 75
  alarm_description   = "EKS Upgrade RDS CPU utilization exceeded 75%"
  alarm_actions       = [var.alarm_sns_arn]
  dimensions = {
    DBInstanceIdentifier = "eks-upgrade-db"
  }
}

# RDS Storage Alarm
resource "aws_cloudwatch_metric_alarm" "rds_storage_low" {
  alarm_name          = "eks-upgrade-rds-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240  # 10 GB in bytes
  alarm_description   = "EKS Upgrade RDS free storage < 10 GB"
  alarm_actions       = [var.alarm_sns_arn]
  dimensions = {
    DBInstanceIdentifier = "eks-upgrade-db"
  }
}

# Redis CPU Alarm
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "eks-upgrade-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 70
  alarm_description   = "EKS Upgrade Redis CPU exceeded 70%"
  alarm_actions       = [var.alarm_sns_arn]
  dimensions = {
    CacheClusterId = "eks-upgrade-redis"
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "eks_upgrade_dashboard" {
  dashboard_name = "EKSUpgradeService"
  dashboard_body = jsonencode({
    widgets = [
      {
        type       = "metric"
        x          = 0; y = 0; width = 12; height = 6
        properties = {
          title   = "API Service CPU & Memory"
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.api_ecs_cluster, "ServiceName", var.api_ecs_service],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.api_ecs_cluster, "ServiceName", var.api_ecs_service]
          ]
          period = 300; stat = "Average"; view = "timeSeries"
        }
      },
      {
        type       = "metric"
        x          = 12; y = 0; width = 12; height = 6
        properties = {
          title   = "RDS Metrics"
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "eks-upgrade-db"],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "eks-upgrade-db"]
          ]
          period = 300; stat = "Average"; view = "timeSeries"
        }
      },
      {
        type       = "alarm"
        x          = 0; y = 6; width = 24; height = 4
        properties = {
          title  = "Alarm Status"
          alarms = [
            "arn:aws:cloudwatch:${var.aws_region}:*:alarm:eks-upgrade-api-cpu-high",
            "arn:aws:cloudwatch:${var.aws_region}:*:alarm:eks-upgrade-rds-cpu-high",
            "arn:aws:cloudwatch:${var.aws_region}:*:alarm:eks-upgrade-redis-cpu-high"
          ]
        }
      }
    ]
  })
}
