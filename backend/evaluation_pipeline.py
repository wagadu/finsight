"""
PySpark-based evaluation pipeline for FinSight RAG system.

This module processes evaluation data using PySpark for scalable computation.
In production, this would run as a separate Spark job that:
1. Reads evaluation questions and answers from PostgreSQL
2. Computes metrics (accuracy, semantic similarity, response times)
3. Writes aggregated metrics back to PostgreSQL
"""

from typing import List, Dict, Optional
from datetime import datetime
import os

try:
    from pyspark.sql import SparkSession
    from pyspark.sql.functions import col, avg, count, when, sum as spark_sum
    PYSPARK_AVAILABLE = True
except ImportError:
    PYSPARK_AVAILABLE = False
    print("Warning: PySpark not available. Evaluation pipeline will use basic Python computation.")


def create_spark_session() -> Optional[SparkSession]:
    """Create a Spark session for evaluation processing."""
    if not PYSPARK_AVAILABLE:
        return None
    
    try:
        spark = SparkSession.builder \
            .appName("FinSightEvaluationPipeline") \
            .config("spark.sql.adaptive.enabled", "true") \
            .config("spark.sql.adaptive.coalescePartitions.enabled", "true") \
            .getOrCreate()
        return spark
    except Exception as e:
        print(f"Warning: Failed to create Spark session: {str(e)}")
        return None


def compute_metrics_with_pyspark(
    evaluation_data: List[Dict],
    spark: Optional[SparkSession] = None
) -> Dict:
    """
    Compute evaluation metrics using PySpark.
    
    Args:
        evaluation_data: List of evaluation question/answer records
        spark: Optional SparkSession (will create if not provided)
    
    Returns:
        Dictionary of computed metrics
    """
    if not PYSPARK_AVAILABLE or not spark:
        # Fallback to basic Python computation
        return compute_metrics_basic(evaluation_data)
    
    try:
        # Create DataFrame from evaluation data
        df = spark.createDataFrame(evaluation_data)
        
        # Compute metrics
        metrics = {}
        
        # Total questions
        total_questions = df.count()
        metrics["total_questions"] = total_questions
        
        # Success rate (percentage of correct answers)
        if "is_correct" in df.columns:
            correct_count = df.filter(col("is_correct") == True).count()
            metrics["success_rate"] = correct_count / total_questions if total_questions > 0 else 0.0
            metrics["successful_answers"] = correct_count
        
        # Average response time
        if "response_time_ms" in df.columns:
            avg_response_time = df.agg(avg(col("response_time_ms"))).collect()[0][0]
            metrics["avg_response_time_ms"] = avg_response_time if avg_response_time else 0
        
        # Semantic similarity (if available)
        if "similarity_score" in df.columns:
            avg_similarity = df.agg(avg(col("similarity_score"))).collect()[0][0]
            metrics["avg_similarity_score"] = avg_similarity if avg_similarity else 0.0
        
        # Questions by document
        if "document_id" in df.columns:
            questions_by_doc = df.groupBy("document_id").agg(
                count("*").alias("question_count")
            ).collect()
            metrics["questions_by_document"] = {
                row["document_id"]: row["question_count"] 
                for row in questions_by_doc
            }
        
        return metrics
        
    except Exception as e:
        print(f"Error computing metrics with PySpark: {str(e)}")
        # Fallback to basic computation
        return compute_metrics_basic(evaluation_data)


def compute_metrics_basic(evaluation_data: List[Dict]) -> Dict:
    """
    Compute evaluation metrics using basic Python (fallback when PySpark unavailable).
    
    Args:
        evaluation_data: List of evaluation question/answer records
    
    Returns:
        Dictionary of computed metrics
    """
    if not evaluation_data:
        return {
            "total_questions": 0,
            "success_rate": 0.0,
            "successful_answers": 0,
            "avg_response_time_ms": 0,
            "avg_similarity_score": 0.0
        }
    
    total_questions = len(evaluation_data)
    correct_count = sum(1 for record in evaluation_data if record.get("is_correct", False))
    success_rate = correct_count / total_questions if total_questions > 0 else 0.0
    
    response_times = [r.get("response_time_ms", 0) for r in evaluation_data if r.get("response_time_ms")]
    avg_response_time = sum(response_times) / len(response_times) if response_times else 0
    
    similarity_scores = [r.get("similarity_score", 0.0) for r in evaluation_data if r.get("similarity_score")]
    avg_similarity = sum(similarity_scores) / len(similarity_scores) if similarity_scores else 0.0
    
    return {
        "total_questions": total_questions,
        "success_rate": success_rate,
        "successful_answers": correct_count,
        "avg_response_time_ms": avg_response_time,
        "avg_similarity_score": avg_similarity
    }


def process_evaluation_run(
    run_id: str,
    evaluation_data: List[Dict],
    use_pyspark: bool = True
) -> Dict:
    """
    Process an evaluation run and compute all metrics.
    
    Args:
        run_id: Evaluation run ID
        evaluation_data: List of evaluation records
        use_pyspark: Whether to use PySpark (if available)
    
    Returns:
        Dictionary of computed metrics
    """
    spark = None
    if use_pyspark and PYSPARK_AVAILABLE:
        spark = create_spark_session()
    
    metrics = compute_metrics_with_pyspark(evaluation_data, spark)
    
    if spark:
        try:
            spark.stop()
        except:
            pass
    
    return metrics

