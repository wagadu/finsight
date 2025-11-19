from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from uuid import uuid4, UUID
import os
import json
from dotenv import load_dotenv
from openai import OpenAI
from pypdf import PdfReader
import io
from supabase import create_client, Client
from evaluation_pipeline import process_evaluation_run

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="FinSight AI Service")

# CORS middleware - allow origins from environment variable or default to localhost
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI client initialization
openai_client = None
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Supabase client initialization
supabase: Optional[Client] = None
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
else:
    print("Warning: SUPABASE_URL and SUPABASE_KEY not set. Database operations will fail.")

# Model configuration for Equity Analyst Copilot
BASE_MODEL = os.getenv("BASE_MODEL", "gpt-4o-mini")
FT_MODEL = os.getenv("FT_MODEL", "gpt-4o-mini")  # Default to base if not set
DISTILLED_MODEL = os.getenv("DISTILLED_MODEL", "gpt-4o-mini")  # Default to base if not set

def get_model_name(model_key: str) -> str:
    """Map model key to actual model name."""
    model_map = {
        "baseline": BASE_MODEL,
        "ft": FT_MODEL,
        "distilled": DISTILLED_MODEL
    }
    return model_map.get(model_key, BASE_MODEL)


# Helper functions for RAG
def chunk_text(text: str, chunk_size: int = 1500, overlap: int = 200) -> List[dict]:
    """
    Split text into chunks with overlap.
    Returns list of dicts with 'content' and approximate 'token_count'.
    Uses larger chunks (1500 chars ≈ 375 tokens) for better context.
    """
    if not text:
        return []
    
    # Simple character-based chunking (approximate 4 chars per token)
    # Using larger chunks for better context retention
    chunks = []
    words = text.split()
    current_chunk = []
    current_length = 0
    
    for word in words:
        word_length = len(word) + 1  # +1 for space
        if current_length + word_length > chunk_size and current_chunk:
            # Save current chunk
            chunk_text = " ".join(current_chunk)
            chunks.append({
                "content": chunk_text,
                "token_count": len(chunk_text) // 4  # Approximate
            })
            # Start new chunk with overlap (keep last ~200 chars worth of words)
            overlap_chars = overlap
            overlap_words = []
            overlap_length = 0
            for w in reversed(current_chunk):
                if overlap_length + len(w) + 1 <= overlap_chars:
                    overlap_words.insert(0, w)
                    overlap_length += len(w) + 1
                else:
                    break
            current_chunk = overlap_words + [word]
            current_length = sum(len(w) + 1 for w in current_chunk)
        else:
            current_chunk.append(word)
            current_length += word_length
    
    # Add final chunk
    if current_chunk:
        chunk_text = " ".join(current_chunk)
        chunks.append({
            "content": chunk_text,
            "token_count": len(chunk_text) // 4
        })
    
    return chunks


def chunk_text_by_pages(pages: List[str]) -> List[dict]:
    """
    Chunk text preserving page numbers.
    Returns list of dicts with 'content', 'page_number', and 'token_count'.
    Uses larger chunks for better context.
    """
    chunks = []
    chunk_size = 1500  # Characters (≈375 tokens) - larger for better context
    overlap = 200
    
    for page_num, page_text in enumerate(pages, start=1):
        if not page_text.strip():
            continue
        
        # Chunk this page
        page_chunks = chunk_text(page_text, chunk_size, overlap)
        for chunk in page_chunks:
            # Only include chunks with meaningful content (at least 50 chars)
            if len(chunk["content"]) >= 50:
                chunks.append({
                    "content": chunk["content"],
                    "page_number": page_num,
                    "token_count": chunk["token_count"]
                })
    
    return chunks


async def generate_embedding(text: str) -> Optional[List[float]]:
    """
    Generate embedding for text using OpenAI embeddings API.
    Returns embedding vector or None if error.
    """
    if not openai_client:
        return None
    
    try:
        response = openai_client.embeddings.create(
            model="text-embedding-3-small",  # 1536 dimensions
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        print(f"Error generating embedding: {str(e)}")
        return None


async def retrieve_relevant_chunks(document_id: str, query: str, top_k: int = 5) -> List[dict]:
    """
    Retrieve relevant document chunks using semantic search.
    Returns list of chunks with content, page_number, and similarity score.
    """
    if not supabase or not openai_client:
        print("Warning: Supabase or OpenAI client not available")
        return []
    
    # Expand query with financial term synonyms for better retrieval
    query_expansions = {
        "cogs": ["cost of goods sold", "cost of sales", "COGS", "cost of goods"],
        "revenue": ["net sales", "sales", "revenue", "total revenue"],
        "profit": ["net income", "earnings", "profit", "net profit"],
        "expenses": ["operating expenses", "expenses", "costs"]
    }
    
    # Check if query contains financial terms and expand
    expanded_query = query.lower()
    for term, synonyms in query_expansions.items():
        if term in expanded_query:
            # Add synonyms to help find related content
            expanded_query = f"{query} {' '.join(synonyms)}"
            break
    
    print(f"Original query: '{query}' | Expanded: '{expanded_query[:100]}...'")
    
    # Generate embedding for expanded query
    query_embedding = await generate_embedding(expanded_query)
    if not query_embedding:
        print("Warning: Failed to generate query embedding")
        return []
    
    try:
        # Fetch all chunks for this document
        result = supabase.table("document_chunks").select(
            "id, content, page_number, embedding"
        ).eq("document_id", document_id).execute()
        
        if not result.data:
            print(f"No chunks found for document {document_id}")
            return []
        
        print(f"Found {len(result.data)} chunks for document {document_id}")
        
        # Calculate cosine similarity for each chunk
        chunks_with_similarity = []
        chunks_without_embedding = 0
        
        for chunk in result.data:
            embedding = chunk.get("embedding")
            
            # Handle different embedding formats from Supabase
            if embedding is None:
                chunks_without_embedding += 1
                continue
            
            # Supabase might return embeddings as a list or as a string representation
            if isinstance(embedding, str):
                try:
                    import json
                    embedding = json.loads(embedding)
                except:
                    print(f"Warning: Could not parse embedding string for chunk {chunk.get('id')}")
                    continue
            
            # Ensure embedding is a list
            if not isinstance(embedding, list):
                print(f"Warning: Embedding is not a list for chunk {chunk.get('id')}, type: {type(embedding)}")
                continue
            
            # Calculate cosine similarity
            if len(embedding) == len(query_embedding):
                try:
                    dot_product = sum(a * b for a, b in zip(embedding, query_embedding))
                    norm_a = sum(a * a for a in embedding) ** 0.5
                    norm_b = sum(b * b for b in query_embedding) ** 0.5
                    similarity = dot_product / (norm_a * norm_b) if (norm_a * norm_b) > 0 else 0
                    
                    chunks_with_similarity.append({
                        "id": chunk["id"],
                        "content": chunk["content"],
                        "page_number": chunk.get("page_number"),
                        "similarity": similarity
                    })
                except Exception as e:
                    print(f"Error calculating similarity: {str(e)}")
                    continue
            else:
                print(f"Warning: Embedding dimension mismatch: {len(embedding)} vs {len(query_embedding)}")
        
        if chunks_without_embedding > 0:
            print(f"Warning: {chunks_without_embedding} chunks without embeddings")
        
        # Sort by similarity and return top_k
        chunks_with_similarity.sort(key=lambda x: x["similarity"], reverse=True)
        top_chunks = chunks_with_similarity[:top_k]
        
        if top_chunks:
            print(f"Retrieved {len(top_chunks)} relevant chunks (similarity range: {top_chunks[-1]['similarity']:.3f} - {top_chunks[0]['similarity']:.3f})")
        else:
            print("Warning: No chunks with valid embeddings found")
        
        return top_chunks
    
    except Exception as e:
        print(f"Error retrieving chunks: {str(e)}")
        import traceback
        traceback.print_exc()
        return []


# Pydantic models for chat
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    documentId: str
    messages: List[ChatMessage]


class ChatResponseCitation(BaseModel):
    id: str
    label: Optional[str] = None
    excerpt: str


class ChatResponse(BaseModel):
    answer: str
    citations: List[ChatResponseCitation] = []


# Pydantic models for documents
class Document(BaseModel):
    id: str
    name: str
    uploaded_at: datetime
    text_content: Optional[str] = None  # Extracted PDF text


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "ok"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint with RAG (Retrieval-Augmented Generation).
    Uses semantic search to find relevant document chunks and includes citations.
    """
    if not openai_client:
        raise HTTPException(
            status_code=500,
            detail="OPENAI_API_KEY environment variable is not set"
        )
    
    # Get the user's latest message for query
    user_query = ""
    if request.messages:
        # Get the last user message
        for msg in reversed(request.messages):
            if msg.role == "user":
                user_query = msg.content
                break
    
    # Retrieve relevant document chunks using RAG
    relevant_chunks = []
    citations = []
    
    if request.documentId and user_query and supabase:
        try:
            # Retrieve more chunks for better context (increased from 5 to 8)
            relevant_chunks = await retrieve_relevant_chunks(request.documentId, user_query, top_k=8)
            
            # Build citations from retrieved chunks
            for idx, chunk in enumerate(relevant_chunks):
                page_label = f"Page {chunk['page_number']}" if chunk.get('page_number') else "Document"
                # Include more context in excerpt (300 chars)
                excerpt = chunk["content"][:300] + "..." if len(chunk["content"]) > 300 else chunk["content"]
                citations.append(ChatResponseCitation(
                    id=f"cite-{idx+1}",
                    label=page_label,
                    excerpt=excerpt
                ))
            
            print(f"Retrieved {len(relevant_chunks)} chunks for query: {user_query[:50]}...")
        except Exception as e:
            print(f"Error retrieving chunks: {str(e)}")
            import traceback
            traceback.print_exc()
            # Continue without chunks if retrieval fails
    
    # Prepare context from retrieved chunks
    document_context = ""
    if relevant_chunks:
        context_parts = []
        for idx, chunk in enumerate(relevant_chunks, 1):
            page_info = f"[Page {chunk['page_number']}]" if chunk.get('page_number') else "[Document]"
            # Include full chunk content for better context
            chunk_text = chunk['content']
            # If chunk contains numbers, highlight that
            if any(char.isdigit() for char in chunk_text):
                context_parts.append(f"{page_info} [Contains financial data/numbers]\n{chunk_text}")
            else:
                context_parts.append(f"{page_info}\n{chunk_text}")
        document_context = "\n\n---\n\n".join(context_parts)
        print(f"Context length: {len(document_context)} characters from {len(relevant_chunks)} chunks")
        # Log first 500 chars of context for debugging
        print(f"Context preview: {document_context[:500]}...")
    else:
        print("Warning: No relevant chunks retrieved, falling back to full document or generic response")
    
    # Prepare system message with document context
    if document_context:
        system_content = f"""You are FinSight Copilot, an AI assistant specialized in helping financial analysts understand and analyze financial documents.

IMPORTANT: The user is asking about a specific document. Below are the most relevant sections extracted from that document:

{document_context}

INSTRUCTIONS:
1. Answer the user's question using ONLY the information provided in the document sections above
2. For financial terms, understand that:
   - COGS = Cost of Goods Sold = Cost of Sales
   - Revenue = Net Sales = Sales
   - Look for related terms and synonyms
3. CRITICAL: Extract and provide specific numbers, figures, and financial data from the document
4. If you see financial statements, tables, or lists with numbers:
   - Look for the relevant line item (e.g., "cost of sales", "cost of goods sold")
   - Extract the actual number value, even if it's in a table format
   - Numbers may be in parentheses (negative) or without parentheses (positive)
   - Look for dollar amounts, percentages, or other numerical values
5. If you see related terms (e.g., "cost of sales" when asked about COGS):
   - Find the associated number in the same section, table, or nearby text
   - Extract that number and provide it
   - Explain: "According to [Page X], the cost of sales (COGS) was [number]"
6. Always mention the page number when referencing information
7. If you find tables or financial statements, read them carefully and extract the relevant numbers
8. If the answer cannot be found in the provided sections, explicitly state: "I cannot find this specific information in the document sections I have access to. The document may contain this information on other pages."
9. Do NOT make up numbers or facts - only use what's in the document
10. Be specific and cite page numbers when available"""
    else:
        system_content = "You are FinSight Copilot, an AI assistant specialized in helping financial analysts understand and analyze financial documents. The user is asking about a document, but I don't have access to the document content. Please ask them to upload the document or provide more context."
    
    system_message = {
        "role": "system",
        "content": system_content
    }
    
    # Convert messages to OpenAI format
    openai_messages = [system_message]
    for msg in request.messages:
        openai_messages.append({
            "role": msg.role,
            "content": msg.content
        })
    
    # Call OpenAI API
    try:
        start_time = datetime.now()
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=openai_messages,
            temperature=0.2
        )
        end_time = datetime.now()
        response_time_ms = int((end_time - start_time).total_seconds() * 1000)
        
        answer = response.choices[0].message.content or ""
        
        # Log chat interaction (async, don't block response)
        if supabase and user_query:
            try:
                # Convert citations to JSONB format
                citations_json = []
                for citation in citations:
                    citations_json.append({
                        "id": citation.id,
                        "label": citation.label,
                        "excerpt": citation.excerpt
                    })
                
                supabase.table("chat_logs").insert({
                    "document_id": request.documentId,
                    "user_message": user_query,
                    "assistant_message": answer,
                    "model_name": "gpt-4o-mini",
                    "citations": citations_json,
                    "response_time_ms": response_time_ms
                }).execute()
            except Exception as log_error:
                # Don't fail the request if logging fails
                print(f"Warning: Failed to log chat interaction: {str(log_error)}")
        
        return ChatResponse(
            answer=answer,
            citations=citations
        )
    except Exception as e:
        # Extract more helpful error message from OpenAI errors
        error_message = str(e)
        if "insufficient_quota" in error_message or "429" in error_message:
            error_message = "OpenAI API quota exceeded. Please check your billing and plan details at https://platform.openai.com/account/billing"
        elif "invalid_api_key" in error_message or "401" in error_message:
            error_message = "Invalid OpenAI API key. Please check your API key in the .env file."
        elif "rate_limit" in error_message:
            error_message = "OpenAI API rate limit exceeded. Please try again in a moment."
        
        raise HTTPException(
            status_code=500,
            detail=error_message
        )


@app.post("/documents", response_model=Document)
async def create_document(
    file: UploadFile = File(...),
    name: str = Form(...)
):
    """
    Create a new document entry and parse PDF content.
    Stores the document in Supabase/PostgreSQL.
    """
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Database connection not configured. Please set SUPABASE_URL and SUPABASE_KEY."
        )
    
    doc_id = str(uuid4())
    uploaded_at = datetime.utcnow()
    
    # Read and parse PDF file
    text_content = None
    pages = []
    try:
        file_content = await file.read()
        pdf_file = io.BytesIO(file_content)
        reader = PdfReader(pdf_file)
        
        # Extract text from each page (preserving page structure)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text.strip():
                pages.append(page_text.strip())
        
        # Combine all pages for full text content
        text_content = "\n\n".join(pages)
        
        # Clean up text (remove excessive whitespace)
        if text_content:
            text_content = "\n".join(line.strip() for line in text_content.split("\n") if line.strip())
    except Exception as e:
        # If PDF parsing fails, still create the document but without text content
        print(f"Warning: Failed to parse PDF: {str(e)}")
        text_content = None
    
    # Insert document into Supabase
    try:
        result = supabase.table("documents").insert({
            "id": doc_id,
            "name": name,
            "uploaded_at": uploaded_at.isoformat(),
            "text_content": text_content
        }).execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(
                status_code=500,
                detail="Failed to save document to database"
            )
        
        # Chunk the document and generate embeddings
        if pages and openai_client:
            try:
                chunks = chunk_text_by_pages(pages)
                print(f"Created {len(chunks)} chunks for document {doc_id}")
                
                # Generate embeddings and store chunks
                chunk_records = []
                failed_embeddings = 0
                
                for idx, chunk in enumerate(chunks):
                    embedding = await generate_embedding(chunk["content"])
                    if embedding:
                        # Ensure embedding is a list of floats
                        if not isinstance(embedding, list):
                            print(f"Warning: Embedding is not a list for chunk {idx}")
                            failed_embeddings += 1
                            continue
                        
                        if len(embedding) != 1536:
                            print(f"Warning: Embedding dimension is {len(embedding)}, expected 1536")
                            failed_embeddings += 1
                            continue
                        
                        chunk_records.append({
                            "document_id": doc_id,
                            "chunk_index": idx,
                            "content": chunk["content"],
                            "page_number": chunk.get("page_number"),
                            "embedding": embedding,  # Supabase will handle vector conversion
                            "token_count": chunk.get("token_count", 0)
                        })
                    else:
                        failed_embeddings += 1
                
                # Batch insert chunks
                if chunk_records:
                    # Insert in batches to avoid payload size limits
                    batch_size = 20  # Smaller batches for embeddings
                    inserted_count = 0
                    for i in range(0, len(chunk_records), batch_size):
                        batch = chunk_records[i:i + batch_size]
                        try:
                            supabase.table("document_chunks").insert(batch).execute()
                            inserted_count += len(batch)
                        except Exception as e:
                            print(f"Error inserting batch {i//batch_size + 1}: {str(e)}")
                            # Try inserting one by one to identify problematic chunks
                            for single_chunk in batch:
                                try:
                                    supabase.table("document_chunks").insert(single_chunk).execute()
                                    inserted_count += 1
                                except Exception as e2:
                                    print(f"Error inserting single chunk: {str(e2)}")
                    
                    print(f"Stored {inserted_count}/{len(chunk_records)} chunks with embeddings")
                    if failed_embeddings > 0:
                        print(f"Warning: {failed_embeddings} chunks failed to generate embeddings")
                else:
                    print(f"Warning: No chunks with embeddings to store")
            except Exception as e:
                print(f"Warning: Failed to chunk and embed document: {str(e)}")
                # Continue even if chunking fails - document is still saved
        
        # Return the created document
        db_doc = result.data[0]
        return Document(
            id=db_doc["id"],
            name=db_doc["name"],
            uploaded_at=datetime.fromisoformat(db_doc["uploaded_at"].replace("Z", "+00:00")),
            text_content=db_doc.get("text_content")
        )
    except Exception as e:
        print(f"Database error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save document: {str(e)}"
        )


@app.get("/documents", response_model=List[Document])
async def get_documents():
    """Get all documents from Supabase/PostgreSQL"""
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Database connection not configured. Please set SUPABASE_URL and SUPABASE_KEY."
        )
    
    try:
        # Fetch all documents, ordered by uploaded_at descending
        result = supabase.table("documents").select("*").order("uploaded_at", desc=True).execute()
        
        documents = []
        for db_doc in result.data:
            documents.append(Document(
                id=db_doc["id"],
                name=db_doc["name"],
                uploaded_at=datetime.fromisoformat(db_doc["uploaded_at"].replace("Z", "+00:00")),
                text_content=db_doc.get("text_content")
            ))
        
        return documents
    except Exception as e:
        print(f"Database error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch documents: {str(e)}"
        )


# Pydantic models for evaluation
class EvalSummaryResponse(BaseModel):
    totalQuestions: int
    successRate: float
    lastRunAt: Optional[str] = None


class EvalQuestion(BaseModel):
    question: str
    expectedAnswer: Optional[str] = None

class EvalRunRequest(BaseModel):
    documentId: Optional[str] = None
    questions: Optional[List[str]] = None  # Simple format: just questions
    evalQuestions: Optional[List[EvalQuestion]] = None  # Advanced format: questions with expected answers
    runName: Optional[str] = None


# Evaluation endpoints
@app.get("/eval/summary", response_model=EvalSummaryResponse)
async def get_eval_summary():
    """
    Get evaluation summary metrics from PostgreSQL.
    Aggregates data from evaluation_runs and evaluation_questions tables.
    """
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Database connection not configured. Please set SUPABASE_URL and SUPABASE_KEY."
        )
    
    try:
        # Get the most recent completed evaluation run
        result = supabase.table("evaluation_runs").select(
            "id, total_questions, successful_answers, completed_at"
        ).eq("status", "completed").order("completed_at", desc=True).limit(1).execute()
        
        if not result.data or len(result.data) == 0:
            # No evaluation runs yet, return default values
            return EvalSummaryResponse(
                totalQuestions=0,
                successRate=0.0,
                lastRunAt=None
            )
        
        run = result.data[0]
        total_questions = run.get("total_questions", 0)
        successful_answers = run.get("successful_answers", 0)
        success_rate = successful_answers / total_questions if total_questions > 0 else 0.0
        completed_at = run.get("completed_at")
        
        return EvalSummaryResponse(
            totalQuestions=total_questions,
            successRate=round(success_rate, 2),
            lastRunAt=completed_at
        )
    except Exception as e:
        print(f"Error fetching evaluation summary: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch evaluation summary: {str(e)}"
        )


@app.post("/eval/run")
async def run_evaluation(request: EvalRunRequest):
    """
    Run an evaluation on the RAG system.
    This endpoint triggers the evaluation pipeline which:
    1. Runs questions through the RAG system
    2. Evaluates answers (using PySpark for processing if available)
    3. Stores results in PostgreSQL
    """
    if not supabase or not openai_client:
        raise HTTPException(
            status_code=500,
            detail="Database or OpenAI client not configured"
        )
    
    try:
        # Create evaluation run record
        run_id = str(uuid4())
        run_name = request.runName or f"Evaluation Run {datetime.now().isoformat()}"
        
        # Insert evaluation run
        run_result = supabase.table("evaluation_runs").insert({
            "id": run_id,
            "run_name": run_name,
            "status": "running",
            "total_questions": 0,
            "successful_answers": 0
        }).execute()
        
        if not run_result.data:
            raise HTTPException(status_code=500, detail="Failed to create evaluation run")
        
        # Process questions - support both simple list and advanced format with expected answers
        eval_questions_list = []
        if request.evalQuestions:
            # Advanced format: questions with expected answers
            eval_questions_list = [
                {"question": eq.question, "expected_answer": eq.expectedAnswer}
                for eq in request.evalQuestions
            ]
        elif request.questions:
            # Simple format: just questions
            eval_questions_list = [
                {"question": q, "expected_answer": None}
                for q in request.questions
            ]
        else:
            # Default questions
            default_questions = [
                "What was the total revenue?",
                "What was the cost of sales?",
                "What was the net income?",
                "What are the key risks mentioned?",
                "What was the operating income?"
            ]
            eval_questions_list = [
                {"question": q, "expected_answer": None}
                for q in default_questions
            ]
        
        total_questions = len(eval_questions_list)
        successful_answers = 0
        
        # Collect evaluation data for PySpark processing
        evaluation_data = []
        
        # Run each question through the RAG system
        for eval_q in eval_questions_list:
            question = eval_q["question"]
            expected_answer = eval_q.get("expected_answer")
            try:
                start_time = datetime.now()
                
                # Call the chat endpoint logic (simplified)
                if request.documentId:
                    # Retrieve relevant chunks
                    relevant_chunks = await retrieve_relevant_chunks(
                        request.documentId, 
                        question, 
                        top_k=5
                    )
                    
                    # Generate answer using OpenAI
                    document_context = ""
                    if relevant_chunks:
                        context_parts = []
                        for chunk in relevant_chunks:
                            page_info = f"[Page {chunk['page_number']}]" if chunk.get('page_number') else "[Document]"
                            context_parts.append(f"{page_info}\n{chunk['content']}")
                        document_context = "\n\n---\n\n".join(context_parts)
                    
                    system_content = f"""You are FinSight Copilot. Answer the question based on the document context:
                    
{document_context}

Provide a clear, accurate answer."""
                    
                    response = openai_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": system_content},
                            {"role": "user", "content": question}
                        ],
                        temperature=0.2
                    )
                    
                    model_answer = response.choices[0].message.content
                else:
                    model_answer = "No document specified"
                
                end_time = datetime.now()
                response_time_ms = int((end_time - start_time).total_seconds() * 1000)
                
                # Determine if answer is correct
                is_correct = None
                similarity_score = None
                
                if expected_answer:
                    # If we have an expected answer, compute semantic similarity
                    if model_answer and openai_client:
                        try:
                            # Generate embeddings for both answers
                            model_embedding = await generate_embedding(model_answer)
                            expected_embedding = await generate_embedding(expected_answer)
                            
                            if model_embedding and expected_embedding:
                                # Calculate cosine similarity
                                dot_product = sum(a * b for a, b in zip(model_embedding, expected_embedding))
                                norm_a = sum(a * a for a in model_embedding) ** 0.5
                                norm_b = sum(b * b for b in expected_embedding) ** 0.5
                                similarity_score = dot_product / (norm_a * norm_b) if (norm_a * norm_b) > 0 else 0
                                
                                # Consider correct if similarity > 0.7 (adjustable threshold)
                                is_correct = similarity_score > 0.7
                        except Exception as e:
                            print(f"Error computing similarity: {str(e)}")
                            # Fallback to basic check
                            is_correct = model_answer and len(model_answer) > 10
                    else:
                        # Fallback: basic check
                        is_correct = model_answer and len(model_answer) > 10
                else:
                    # No expected answer: just check if we got a reasonable response
                    is_correct = model_answer and len(model_answer) > 10
                
                if is_correct:
                    successful_answers += 1
                
                # Store evaluation question
                supabase.table("evaluation_questions").insert({
                    "evaluation_run_id": run_id,
                    "document_id": request.documentId,
                    "question": question,
                    "expected_answer": expected_answer,
                    "model_answer": model_answer,
                    "is_correct": is_correct,
                    "similarity_score": similarity_score,
                    "response_time_ms": response_time_ms
                }).execute()
                
                # Collect data for PySpark processing
                evaluation_data.append({
                    "evaluation_run_id": run_id,
                    "document_id": request.documentId,
                    "question": question,
                    "expected_answer": expected_answer,
                    "model_answer": model_answer,
                    "is_correct": is_correct,
                    "similarity_score": similarity_score,
                    "response_time_ms": response_time_ms
                })
                
            except Exception as e:
                print(f"Error evaluating question '{question}': {str(e)}")
                # Store failed question
                supabase.table("evaluation_questions").insert({
                    "evaluation_run_id": run_id,
                    "document_id": request.documentId,
                    "question": question,
                    "model_answer": None,
                    "is_correct": False,
                    "response_time_ms": 0
                }).execute()
                
                # Add failed question to evaluation data
                evaluation_data.append({
                    "evaluation_run_id": run_id,
                    "document_id": request.documentId,
                    "question": question,
                    "expected_answer": None,
                    "model_answer": None,
                    "is_correct": False,
                    "similarity_score": None,
                    "response_time_ms": 0
                })
        
        # Compute metrics using PySpark pipeline (with fallback to basic Python)
        print(f"Computing metrics for {len(evaluation_data)} evaluation records using PySpark pipeline...")
        computed_metrics = process_evaluation_run(run_id, evaluation_data, use_pyspark=True)
        
        # Extract metrics from PySpark computation
        total_questions_computed = computed_metrics.get("total_questions", total_questions)
        success_rate = computed_metrics.get("success_rate", 0.0)
        successful_answers_computed = computed_metrics.get("successful_answers", successful_answers)
        avg_response_time_ms = computed_metrics.get("avg_response_time_ms", 0)
        avg_similarity_score = computed_metrics.get("avg_similarity_score", 0.0)
        
        # Use computed values (PySpark may have more accurate counts)
        final_total_questions = total_questions_computed if total_questions_computed > 0 else total_questions
        final_successful_answers = successful_answers_computed if successful_answers_computed >= 0 else successful_answers
        final_success_rate = success_rate if success_rate >= 0 else (final_successful_answers / final_total_questions if final_total_questions > 0 else 0.0)
        
        # Update evaluation run with results
        supabase.table("evaluation_runs").update({
            "status": "completed",
            "total_questions": final_total_questions,
            "successful_answers": final_successful_answers,
            "completed_at": datetime.now().isoformat()
        }).eq("id", run_id).execute()
        
        # Store metrics computed by PySpark pipeline
        metrics = [
            {"metric_name": "accuracy", "metric_value": final_success_rate, "metric_type": "percentage"},
            {"metric_name": "success_rate", "metric_value": final_success_rate, "metric_type": "percentage"},
            {"metric_name": "total_questions", "metric_value": float(final_total_questions), "metric_type": "count"},
            {"metric_name": "successful_answers", "metric_value": float(final_successful_answers), "metric_type": "count"},
            {"metric_name": "avg_response_time_ms", "metric_value": float(avg_response_time_ms), "metric_type": "time_ms"},
            {"metric_name": "avg_similarity_score", "metric_value": float(avg_similarity_score), "metric_type": "score"}
        ]
        
        # Add document-level metrics if available
        if "questions_by_document" in computed_metrics:
            for doc_id, question_count in computed_metrics["questions_by_document"].items():
                metrics.append({
                    "metric_name": f"questions_by_document_{doc_id}",
                    "metric_value": float(question_count),
                    "metric_type": "count"
                })
        
        for metric in metrics:
            supabase.table("evaluation_metrics").upsert({
                "evaluation_run_id": run_id,
                "metric_name": metric["metric_name"],
                "metric_value": metric["metric_value"],
                "metric_type": metric["metric_type"]
            }, on_conflict="evaluation_run_id,metric_name").execute()
        
        print(f"Evaluation completed: {final_successful_answers}/{final_total_questions} successful ({(final_success_rate*100):.1f}%)")
        
        return {
            "runId": run_id,
            "status": "completed",
            "totalQuestions": final_total_questions,
            "successfulAnswers": final_successful_answers,
            "successRate": round(final_success_rate, 2),
            "avgResponseTimeMs": int(avg_response_time_ms),
            "avgSimilarityScore": round(avg_similarity_score, 3) if avg_similarity_score else None
        }
        
    except Exception as e:
        print(f"Error running evaluation: {str(e)}")
        # Mark run as failed
        if 'run_id' in locals():
            supabase.table("evaluation_runs").update({
                "status": "failed"
            }).eq("id", run_id).execute()
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to run evaluation: {str(e)}"
        )


# Pydantic models for Equity Analyst Copilot
class EquityAnalystRunRequest(BaseModel):
    documentId: str
    modelKey: str  # 'baseline', 'ft', or 'distilled'


class EquityAnalystSectionResponse(BaseModel):
    id: str
    section_type: str
    question_text: str
    model_answer: str
    citations: List[dict] = []
    response_time_ms: Optional[int] = None


class EquityAnalystRunResponse(BaseModel):
    runId: str
    status: str
    sections: List[EquityAnalystSectionResponse]


class EquityAnalystRunSummary(BaseModel):
    id: str
    document_id: str
    model_name: str
    run_type: str
    status: str
    created_at: str
    completed_at: Optional[str] = None
    section_count: int = 0
    avg_response_time_ms: Optional[int] = None


# Fixed checklist of analyst questions
EQUITY_ANALYST_QUESTIONS = [
    {
        "section_type": "revenue_drivers",
        "question": "What are the main revenue drivers for this company? Identify the key products, services, or business segments that generate the most revenue."
    },
    {
        "section_type": "key_risks",
        "question": "What are the key risks mentioned in this document? Include both operational and financial risks."
    },
    {
        "section_type": "unit_economics",
        "question": "What are the unit economics and margins? Provide specific numbers for gross margin, operating margin, and net margin if available."
    },
    {
        "section_type": "investment_thesis",
        "question": "Provide a 3-bullet investment thesis (bullish or bearish) based on the information in this document. Be concise and specific."
    },
    {
        "section_type": "financial_trends",
        "question": "What are the notable financial trends compared to the previous year? Highlight significant changes in revenue, expenses, or profitability."
    }
]


@app.post("/equity-analyst/run", response_model=EquityAnalystRunResponse)
async def run_equity_analyst(request: EquityAnalystRunRequest):
    """
    Run the Equity Analyst Copilot analysis on a document.
    Executes a fixed checklist of analyst questions and stores results.
    """
    if not openai_client or not supabase:
        raise HTTPException(
            status_code=500,
            detail="OpenAI client or database not configured"
        )
    
    # Validate model key
    if request.modelKey not in ["baseline", "ft", "distilled"]:
        raise HTTPException(
            status_code=400,
            detail="modelKey must be 'baseline', 'ft', or 'distilled'"
        )
    
    model_name = get_model_name(request.modelKey)
    run_id = str(uuid4())
    
    try:
        # Create equity analyst run record
        run_result = supabase.table("equity_analyst_runs").insert({
            "id": run_id,
            "document_id": request.documentId,
            "model_name": model_name,
            "run_type": request.modelKey,
            "status": "running"
        }).execute()
        
        if not run_result.data:
            raise HTTPException(status_code=500, detail="Failed to create equity analyst run")
        
        sections = []
        
        # Process each question in the checklist
        for question_config in EQUITY_ANALYST_QUESTIONS:
            section_type = question_config["section_type"]
            question = question_config["question"]
            
            try:
                start_time = datetime.now()
                
                # Retrieve relevant chunks
                relevant_chunks = await retrieve_relevant_chunks(
                    request.documentId,
                    question,
                    top_k=8
                )
                
                # Build document context
                document_context = ""
                citations_list = []
                
                if relevant_chunks:
                    context_parts = []
                    for idx, chunk in enumerate(relevant_chunks):
                        page_info = f"[Page {chunk['page_number']}]" if chunk.get('page_number') else "[Document]"
                        context_parts.append(f"{page_info}\n{chunk['content']}")
                        
                        # Build citation
                        citations_list.append({
                            "id": chunk.get("id", f"chunk-{idx}"),
                            "chunk_id": chunk.get("id"),
                            "page_number": chunk.get("page_number"),
                            "excerpt": chunk["content"][:300] + "..." if len(chunk["content"]) > 300 else chunk["content"],
                            "label": f"Page {chunk['page_number']}" if chunk.get('page_number') else "Document"
                        })
                    
                    document_context = "\n\n---\n\n".join(context_parts)
                
                # Prepare system message
                system_content = f"""You are an Equity Analyst Copilot, an AI assistant specialized in analyzing financial documents and annual reports.

You are analyzing a specific document. Below are the most relevant sections extracted from that document:

{document_context}

INSTRUCTIONS:
1. Answer the question using ONLY the information provided in the document sections above
2. Be specific and cite page numbers when available
3. For financial data, extract actual numbers and figures
4. For the investment thesis, clearly state whether it's bullish or bearish
5. Be concise and professional, using equity analyst terminology
6. If information is not available in the provided sections, state that explicitly"""
                
                # Call OpenAI API
                response = openai_client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": question}
                    ],
                    temperature=0.2
                )
                
                model_answer = response.choices[0].message.content or ""
                end_time = datetime.now()
                response_time_ms = int((end_time - start_time).total_seconds() * 1000)
                
                # Store section in database
                section_result = supabase.table("equity_analyst_sections").insert({
                    "run_id": run_id,
                    "section_type": section_type,
                    "question_text": question,
                    "model_answer": model_answer,
                    "citations": citations_list,
                    "response_time_ms": response_time_ms,
                    "is_gold": False
                }).execute()
                
                if section_result.data:
                    section_id = section_result.data[0]["id"]
                    sections.append(EquityAnalystSectionResponse(
                        id=section_id,
                        section_type=section_type,
                        question_text=question,
                        model_answer=model_answer,
                        citations=citations_list,
                        response_time_ms=response_time_ms
                    ))
                
            except Exception as e:
                print(f"Error processing section {section_type}: {str(e)}")
                # Continue with other sections even if one fails
                continue
        
        # Update run status
        supabase.table("equity_analyst_runs").update({
            "status": "completed",
            "completed_at": datetime.now().isoformat()
        }).eq("id", run_id).execute()
        
        return EquityAnalystRunResponse(
            runId=run_id,
            status="completed",
            sections=sections
        )
        
    except Exception as e:
        print(f"Error running equity analyst copilot: {str(e)}")
        # Mark run as failed
        if 'run_id' in locals():
            supabase.table("equity_analyst_runs").update({
                "status": "failed"
            }).eq("id", run_id).execute()
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to run equity analyst copilot: {str(e)}"
        )


@app.get("/equity-analyst/runs")
async def get_equity_analyst_runs(document_id: str):
    """
    Get all equity analyst runs for a specific document.
    Returns summary information for each run.
    """
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Database connection not configured"
        )
    
    try:
        # Get all runs for the document, ordered by most recent first
        runs_result = supabase.table("equity_analyst_runs").select(
            "id, document_id, model_name, run_type, status, created_at, completed_at"
        ).eq("document_id", document_id).order("created_at", desc=True).execute()
        
        if not runs_result.data:
            return {"runs": []}
        
        runs = []
        for run in runs_result.data:
            # Get section count and average response time
            sections_result = supabase.table("equity_analyst_sections").select(
                "id, response_time_ms"
            ).eq("run_id", run["id"]).execute()
            
            section_count = len(sections_result.data) if sections_result.data else 0
            response_times = [
                s["response_time_ms"] 
                for s in (sections_result.data or []) 
                if s.get("response_time_ms")
            ]
            avg_response_time = int(sum(response_times) / len(response_times)) if response_times else None
            
            runs.append(EquityAnalystRunSummary(
                id=run["id"],
                document_id=run["document_id"],
                model_name=run["model_name"],
                run_type=run["run_type"],
                status=run["status"],
                created_at=run["created_at"],
                completed_at=run.get("completed_at"),
                section_count=section_count,
                avg_response_time_ms=avg_response_time
            ))
        
        return {"runs": runs}
        
    except Exception as e:
        print(f"Error fetching equity analyst runs: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch equity analyst runs: {str(e)}"
        )


@app.get("/equity-analyst/runs/{run_id}")
async def get_equity_analyst_run(run_id: str):
    """
    Get a specific equity analyst run with all its sections.
    """
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Database connection not configured"
        )
    
    try:
        # Get the run
        run_result = supabase.table("equity_analyst_runs").select(
            "id, document_id, model_name, run_type, status, created_at, completed_at"
        ).eq("id", run_id).execute()
        
        if not run_result.data:
            raise HTTPException(status_code=404, detail="Run not found")
        
        run = run_result.data[0]
        
        # Get all sections for this run
        sections_result = supabase.table("equity_analyst_sections").select(
            "id, section_type, question_text, model_answer, citations, response_time_ms"
        ).eq("run_id", run_id).order("created_at").execute()
        
        sections = []
        if sections_result.data:
            for section in sections_result.data:
                sections.append(EquityAnalystSectionResponse(
                    id=section["id"],
                    section_type=section["section_type"],
                    question_text=section["question_text"],
                    model_answer=section["model_answer"],
                    citations=section.get("citations", []),
                    response_time_ms=section.get("response_time_ms")
                ))
        
        return EquityAnalystRunResponse(
            runId=run["id"],
            status=run["status"],
            sections=sections
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching equity analyst run: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch equity analyst run: {str(e)}"
        )


@app.get("/export-finetune-dataset")
async def export_finetune_dataset(
    model_name: Optional[str] = None,
    is_gold_only: bool = False,
    limit: Optional[int] = None
):
    """
    Export fine-tuning dataset in OpenAI format (JSONL).
    Reads from equity_analyst_sections and optionally chat_logs.
    """
    if not supabase:
        raise HTTPException(
            status_code=500,
            detail="Database connection not configured"
        )
    
    try:
        # First, get run IDs if filtering by model_name
        run_ids = None
        if model_name:
            runs_result = supabase.table("equity_analyst_runs").select("id").eq("model_name", model_name).execute()
            if runs_result.data:
                run_ids = [run["id"] for run in runs_result.data]
            else:
                # No runs with this model, return empty dataset
                run_ids = []
        
        # Build query for equity_analyst_sections
        query = supabase.table("equity_analyst_sections").select(
            "id, run_id, section_type, question_text, model_answer, citations"
        )
        
        if is_gold_only:
            query = query.eq("is_gold", True)
        
        if run_ids is not None:
            if len(run_ids) == 0:
                # No matching runs, return empty
                result_data = []
            else:
                query = query.in_("run_id", run_ids)
                result = query.execute()
                result_data = result.data if result.data else []
        else:
            result = query.execute()
            result_data = result.data if result.data else []
        
        # Get run information for each section
        if result_data:
            run_ids_to_fetch = list(set([section["run_id"] for section in result_data]))
            runs_result = supabase.table("equity_analyst_runs").select("id, model_name, run_type").in_("id", run_ids_to_fetch).execute()
            runs_dict = {run["id"]: run for run in (runs_result.data if runs_result.data else [])}
            
            # Add run info to each section
            for section in result_data:
                run_info = runs_dict.get(section["run_id"], {})
                section["model_name"] = run_info.get("model_name")
                section["run_type"] = run_info.get("run_type")
        
        if limit and result_data:
            result_data = result_data[:limit]
        
        examples = []
        
        for row in result_data:
            question = row["question_text"]
            answer = row["model_answer"]
            citations = row.get("citations", [])
            
            # Build context from citations
            context_parts = []
            if citations:
                for citation in citations:
                    page_info = f"[Page {citation.get('page_number', 'N/A')}]" if citation.get('page_number') else "[Document]"
                    excerpt = citation.get("excerpt", "")
                    context_parts.append(f"{page_info}: {excerpt[:200]}")
            
            context = "\n".join(context_parts) if context_parts else ""
            
            # Format question with minimal context
            user_content = question
            if context:
                user_content = f"{question}\n\nRelevant context:\n{context}"
            
            # Create fine-tuning example
            example = {
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an Equity Analyst Copilot, an AI assistant specialized in analyzing financial documents and annual reports. Answer questions based on the provided document context."
                    },
                    {
                        "role": "user",
                        "content": user_content
                    },
                    {
                        "role": "assistant",
                        "content": answer
                    }
                ]
            }
            
            examples.append(example)
        
        # Convert to JSONL format (one JSON object per line)
        jsonl_lines = []
        for example in examples:
            jsonl_lines.append(json.dumps(example))
        
        jsonl_content = "\n".join(jsonl_lines)
        
        # Return as downloadable file
        from fastapi.responses import Response
        return Response(
            content=jsonl_content,
            media_type="application/x-ndjson",
            headers={
                "Content-Disposition": f"attachment; filename=finetune_dataset_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
            }
        )
        
    except Exception as e:
        print(f"Error exporting fine-tuning dataset: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export dataset: {str(e)}"
        )

