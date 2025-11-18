"""
Script for generating a distillation dataset for Equity Analyst Copilot.

This script:
1. Samples documents and generates synthetic questions
2. Calls the "teacher" model (best performing model, e.g., fine-tuned)
3. Stores (input → teacher_output) pairs for training a smaller "student" model

TODO: Implement the full pipeline:
- Document sampling strategy
- Synthetic question generation
- Teacher model inference
- Dataset storage (table or file)
- Format conversion for fine-tuning
"""

import os
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI
from typing import List, Dict, Optional
import json

load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Teacher model (best performing model)
TEACHER_MODEL = os.getenv("FT_MODEL", "gpt-4o-mini")  # Use fine-tuned model as teacher
STUDENT_MODEL = os.getenv("DISTILLED_MODEL", "gpt-4o-mini")  # Target student model

# Initialize clients
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

openai_client = None
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)


def sample_documents(limit: int = 10) -> List[Dict]:
    """
    Sample documents from the database for distillation dataset generation.
    
    TODO: Implement sampling strategy:
    - Random sampling
    - Diversity sampling (different industries, document types)
    - High-quality document selection (based on evaluation metrics)
    """
    if not supabase:
        return []
    
    # For now, just get recent documents
    result = supabase.table("documents").select("*").order("uploaded_at", desc=True).limit(limit).execute()
    return result.data if result.data else []


def generate_synthetic_questions(document_id: str, document_name: str) -> List[str]:
    """
    Generate synthetic questions for a document.
    
    TODO: Implement question generation:
    - Use GPT to generate diverse questions based on document content
    - Cover different question types (factual, analytical, comparative)
    - Ensure questions are answerable from the document
    """
    # Placeholder: return standard equity analyst questions
    return [
        "What are the main revenue drivers?",
        "What are the key risks?",
        "What are the unit economics and margins?",
        "Provide a 3-bullet investment thesis.",
        "What are the notable financial trends?"
    ]


def call_teacher_model(document_id: str, question: str, document_context: str) -> Optional[str]:
    """
    Call the teacher model to generate an answer.
    
    TODO: Implement:
    - Retrieve relevant chunks (similar to RAG pipeline)
    - Call teacher model with context
    - Return high-quality answer
    """
    if not openai_client:
        return None
    
    system_content = f"""You are an Equity Analyst Copilot. Answer the question based on the document context:

{document_context}

Provide a detailed, accurate answer."""
    
    try:
        response = openai_client.chat.completions.create(
            model=TEACHER_MODEL,
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": question}
            ],
            temperature=0.2
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error calling teacher model: {str(e)}")
        return None


def store_distillation_pair(
    document_id: str,
    question: str,
    teacher_answer: str,
    context: str
) -> bool:
    """
    Store a distillation pair (input → teacher_output).
    
    TODO: Implement storage:
    - Option 1: Store in a new table (distillation_dataset)
    - Option 2: Store in equity_analyst_sections with a flag
    - Option 3: Export directly to JSONL file
    """
    # Placeholder: could store in a new table or export to file
    return True


def generate_distillation_dataset(
    num_documents: int = 10,
    questions_per_document: int = 5,
    output_file: Optional[str] = None
):
    """
    Main function to generate distillation dataset.
    
    Args:
        num_documents: Number of documents to sample
        questions_per_document: Number of questions per document
        output_file: Optional output file path for JSONL export
    """
    print(f"Generating distillation dataset...")
    print(f"Teacher model: {TEACHER_MODEL}")
    print(f"Student model: {STUDENT_MODEL}")
    
    # Sample documents
    documents = sample_documents(num_documents)
    print(f"Sampled {len(documents)} documents")
    
    distillation_pairs = []
    
    for doc in documents:
        doc_id = doc["id"]
        doc_name = doc["name"]
        
        print(f"\nProcessing document: {doc_name}")
        
        # Generate synthetic questions
        questions = generate_synthetic_questions(doc_id, doc_name)
        
        for question in questions[:questions_per_document]:
            # TODO: Retrieve document context (chunks)
            context = ""  # Placeholder
            
            # Call teacher model
            teacher_answer = call_teacher_model(doc_id, question, context)
            
            if teacher_answer:
                pair = {
                    "document_id": doc_id,
                    "question": question,
                    "teacher_answer": teacher_answer,
                    "context": context
                }
                distillation_pairs.append(pair)
                store_distillation_pair(doc_id, question, teacher_answer, context)
                print(f"  ✓ Generated answer for: {question[:50]}...")
            else:
                print(f"  ✗ Failed to generate answer for: {question[:50]}...")
    
    # Export to JSONL if output file specified
    if output_file and distillation_pairs:
        with open(output_file, 'w') as f:
            for pair in distillation_pairs:
                # Convert to fine-tuning format
                example = {
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are an Equity Analyst Copilot."
                        },
                        {
                            "role": "user",
                            "content": f"{pair['question']}\n\nContext:\n{pair['context']}"
                        },
                        {
                            "role": "assistant",
                            "content": pair["teacher_answer"]
                        }
                    ]
                }
                f.write(json.dumps(example) + "\n")
        
        print(f"\n✓ Exported {len(distillation_pairs)} pairs to {output_file}")
    
    print(f"\n✓ Generated {len(distillation_pairs)} distillation pairs")
    return distillation_pairs


if __name__ == "__main__":
    # Example usage
    generate_distillation_dataset(
        num_documents=10,
        questions_per_document=5,
        output_file="distillation_dataset.jsonl"
    )

