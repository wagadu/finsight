# RAG with Embeddings Setup Guide

This guide explains how to set up and use the RAG (Retrieval-Augmented Generation) system with embeddings.

## What is RAG?

RAG improves chat responses by:
- **Chunking**: Splitting large documents into smaller, manageable pieces
- **Embeddings**: Converting text into numerical vectors that capture meaning
- **Semantic Search**: Finding relevant chunks based on meaning, not just keywords
- **Citations**: Providing page references for answers

## Database Setup

### Step 1: Update Your Supabase Schema

1. Go to your Supabase dashboard → **SQL Editor**
2. Run the updated `schema.sql` file which includes:
   - `pgvector` extension for vector search
   - `document_chunks` table for storing chunks and embeddings
   - Vector indexes for fast similarity search

### Step 2: Verify the Schema

After running the SQL, verify the tables exist:
- `documents` table (should already exist)
- `document_chunks` table (new)
- `pgvector` extension enabled

## How It Works

### Document Upload Process

1. **PDF Parsing**: Document is parsed page by page
2. **Chunking**: Each page is split into chunks (~1000 tokens each, with 200 token overlap)
3. **Embedding Generation**: Each chunk is converted to a 1536-dimensional vector using OpenAI's `text-embedding-3-small` model
4. **Storage**: Chunks and embeddings are stored in the `document_chunks` table

### Chat Process

1. **Query Embedding**: User's question is converted to an embedding
2. **Semantic Search**: System finds the 5 most similar chunks using cosine similarity
3. **Context Building**: Relevant chunks are combined into context
4. **LLM Response**: OpenAI GPT model generates answer using only relevant context
5. **Citations**: Page numbers and excerpts are included in the response

## Testing

1. **Upload a document**: The system will automatically chunk and embed it
2. **Ask a question**: The system will find relevant chunks and provide citations
3. **Check citations**: Each answer includes page references

## Performance Notes

- **Embedding Generation**: Takes a few seconds per document (depends on size)
- **Search Speed**: Vector similarity search is very fast (<100ms typically)
- **Token Efficiency**: Only relevant chunks are sent to the LLM, saving tokens

## Troubleshooting

### "No chunks found" error
- Make sure the document was uploaded after RAG was implemented
- Check that embeddings were generated (look for log messages)
- Verify the `document_chunks` table has data

### Slow embedding generation
- This is normal for large documents
- Embeddings are cached - subsequent queries are fast
- Consider processing in background for very large documents

### Citations not showing
- Check that chunks have `page_number` set
- Verify the chat response includes citations array
- Check browser console for errors

## Next Steps

- **Optimize chunking**: Adjust chunk size and overlap for your use case
- **Improve search**: Use Supabase's native vector search RPC for better performance
- **Add metadata**: Store additional chunk metadata (section titles, etc.)
- **Batch processing**: Process multiple documents in parallel

