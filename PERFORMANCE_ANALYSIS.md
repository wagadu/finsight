# Performance Analysis: Report Loading Bottlenecks

## Executive Summary

Analysis of the report loading flow reveals **multiple performance bottlenecks** causing slow load times (11-13 seconds) when loading pre-built analysis reports from the database. The data is already stored, but inefficient queries, redundant API calls, and lack of optimization are causing delays.

---

## 🔍 Identified Bottlenecks

### 1. **N+1 Query Problem in `/equity-analyst/runs` Endpoint** ⚠️ CRITICAL
**Location:** `backend/main.py:1220-1232`

**Problem:**
- For each run in the list, a separate database query is made to fetch sections
- If you have 12 reports, that's **12 separate queries** to `equity_analyst_sections` table
- Each query adds ~50-200ms of database latency

**Code:**
```python
for run in runs_result.data:
    # This runs N times (once per run) - N+1 problem!
    sections_result = supabase.table("equity_analyst_sections").select(
        "id, response_time_ms"
    ).eq("run_id", run["id"]).execute()
```

**Impact:** High - Can add 600ms-2.4s for 12 reports

---

### 2. **Redundant API Calls in Frontend** ⚠️ HIGH
**Location:** `components/equity-analyst-copilot.tsx:108-120`

**Problem:**
- When loading a specific report, the frontend makes **2 sequential API calls**:
  1. `/api/equity-analyst/runs/${runId}` - Gets full report with sections
  2. `/api/equity-analyst/runs?documentId=${documentId}` - Gets all runs just to find run metadata

**Code:**
```typescript
const reportResponse = await fetch(`/api/equity-analyst/runs/${runId}`)
// ... then immediately after:
const runsResponse = await fetch(`/api/equity-analyst/runs?documentId=${documentId}`)
const runInfo = runs.find((r: any) => r.id === runId) // Redundant!
```

**Impact:** Medium-High - Adds 1-3 seconds (network round-trip + N+1 query from #1)

---

### 3. **Large JSONB Field Serialization** ⚠️ MEDIUM
**Location:** `backend/main.py:1279-1281`

**Problem:**
- `citations` field is JSONB and can contain large arrays with full excerpts
- `model_answer` is TEXT and can be 2000-5000+ characters per section
- All sections are fetched and serialized even if not immediately needed
- JSON serialization overhead for large text fields

**Code:**
```python
sections_result = supabase.table("equity_analyst_sections").select(
    "id, section_type, question_text, model_answer, citations, response_time_ms"
).eq("run_id", run_id).order("created_at").execute()
```

**Impact:** Medium - Can add 500ms-1s for serialization of large text fields

---

### 4. **Multiple Network Hops** ⚠️ MEDIUM
**Flow:** Browser → Next.js API Route → Python Backend → Supabase → Response

**Problem:**
- Each network hop adds latency (50-200ms per hop)
- No connection pooling optimization visible
- Sequential requests instead of parallel

**Impact:** Medium - Adds 200-800ms total network latency

---

### 5. **No Caching Layer** ⚠️ MEDIUM
**Problem:**
- Every request hits the database
- No Redis/memory caching for frequently accessed reports
- No HTTP caching headers
- Reports are static once completed but always fetched fresh

**Impact:** Medium - Could save 500ms-2s on repeat loads

---

### 6. **Missing Database Indexes** ⚠️ LOW-MEDIUM
**Location:** `backend/equity_analyst_schema.sql`

**Problem:**
- No composite index on `(run_id, created_at)` for sections query
- Citations JSONB not indexed (though this is less critical)
- Ordering by `created_at` without optimized index

**Impact:** Low-Medium - Could save 50-200ms per query

---

## 🚀 Improvement Options

### **Option 1: Fix N+1 Query with JOIN (Quick Win)** ⭐ RECOMMENDED
**Effort:** Low | **Impact:** High | **Time:** 30-60 minutes

**Solution:**
Use a single query with aggregation to get section counts and avg response times:

```python
# Single query with aggregation
sections_agg = supabase.table("equity_analyst_sections").select(
    "run_id, response_time_ms"
).in_("run_id", [run["id"] for run in runs_result.data]).execute()

# Group by run_id in Python
from collections import defaultdict
sections_by_run = defaultdict(lambda: {"count": 0, "times": []})
for section in sections_agg.data:
    run_id = section["run_id"]
    sections_by_run[run_id]["count"] += 1
    if section.get("response_time_ms"):
        sections_by_run[run_id]["times"].append(section["response_time_ms"])

# Calculate averages
for run in runs_result.data:
    run_id = run["id"]
    section_data = sections_by_run[run_id]
    section_count = section_data["count"]
    avg_response_time = int(sum(section_data["times"]) / len(section_data["times"])) if section_data["times"] else None
```

**Expected Improvement:** 600ms-2.4s → ~100-200ms (80-90% faster)

---

### **Option 2: Include Run Metadata in Single Response** ⭐ RECOMMENDED
**Effort:** Low | **Impact:** Medium-High | **Time:** 15-30 minutes

**Solution:**
Modify `/equity-analyst/runs/{runId}` endpoint to include run metadata:

```python
# In get_equity_analyst_run endpoint
return EquityAnalystRunResponse(
    runId=run["id"],
    status=run["status"],
    sections=sections,
    # Add these fields:
    model_name=run["model_name"],
    run_type=run["run_type"],
    created_at=run["created_at"],
    completed_at=run.get("completed_at")
)
```

Then remove the redundant API call in frontend.

**Expected Improvement:** Eliminates 1-3 second redundant call

---

### **Option 3: Add Response Caching** ⭐ RECOMMENDED
**Effort:** Medium | **Impact:** High | **Time:** 2-4 hours

**Solution Options:**

**A. HTTP Caching (Simplest):**
```typescript
// In Next.js API route
export async function GET(request: NextRequest, { params }) {
    const response = NextResponse.json(data)
    // Cache for 5 minutes
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return response
}
```

**B. Redis Caching (More robust):**
```python
# In Python backend
import redis
redis_client = redis.Redis(host='localhost', port=6379, db=0)

async def get_equity_analyst_run(run_id: str):
    cache_key = f"run:{run_id}"
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Fetch from DB
    data = fetch_from_db(run_id)
    redis_client.setex(cache_key, 3600, json.dumps(data))  # Cache 1 hour
    return data
```

**Expected Improvement:** 500ms-2s saved on repeat loads

---

### **Option 4: Lazy Load Sections** 
**Effort:** Medium | **Impact:** Medium | **Time:** 1-2 hours

**Solution:**
Load sections on-demand when user expands a section, or load sections in background after showing report metadata:

```typescript
// Load metadata first (fast)
const runMetadata = await fetch(`/api/equity-analyst/runs/${runId}/metadata`)
// Show UI immediately with metadata

// Load sections in background
const sections = await fetch(`/api/equity-analyst/runs/${runId}/sections`)
```

**Expected Improvement:** Perceived load time drops from 11s to ~500ms

---

### **Option 5: Optimize Database Queries with Indexes**
**Effort:** Low | **Impact:** Low-Medium | **Time:** 15 minutes

**Solution:**
Add composite index for common query pattern:

```sql
CREATE INDEX IF NOT EXISTS idx_equity_sections_run_created 
ON equity_analyst_sections(run_id, created_at);

-- For aggregations
CREATE INDEX IF NOT EXISTS idx_equity_sections_run_response_time 
ON equity_analyst_sections(run_id, response_time_ms) 
WHERE response_time_ms IS NOT NULL;
```

**Expected Improvement:** 50-200ms per query

---

### **Option 6: Parallelize API Calls**
**Effort:** Low | **Impact:** Low-Medium | **Time:** 30 minutes

**Solution:**
If multiple calls are needed, make them in parallel:

```typescript
const [reportData, runsData] = await Promise.all([
    fetch(`/api/equity-analyst/runs/${runId}`),
    fetch(`/api/equity-analyst/runs?documentId=${documentId}`)
])
```

**Expected Improvement:** If 2 calls needed, saves ~1-2s

---

### **Option 7: Add Database Connection Pooling**
**Effort:** Medium | **Impact:** Medium | **Time:** 1-2 hours

**Solution:**
Configure Supabase client with connection pooling:

```python
from supabase import create_client, Client
import os

# Use connection pooler URL
SUPABASE_URL = os.getenv("SUPABASE_URL")
if "pooler" not in SUPABASE_URL:
    SUPABASE_URL = SUPABASE_URL.replace(".supabase.co", ".pooler.supabase.co")
    SUPABASE_URL = SUPABASE_URL.replace(":5432", ":6543")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
```

**Expected Improvement:** 100-300ms per request

---

### **Option 8: Compress Large Text Fields**
**Effort:** Medium | **Impact:** Low-Medium | **Time:** 2-3 hours

**Solution:**
Compress `model_answer` and `citations` before storing, decompress on read:

```python
import gzip
import json

# Store compressed
compressed = gzip.compress(json.dumps(citations).encode())
# Decompress on read
```

**Expected Improvement:** 200-500ms for large reports

---

## 📊 Recommended Implementation Order

### **Phase 1: Quick Wins (1-2 hours)**
1. ✅ Fix N+1 Query (#1) - **Biggest impact**
2. ✅ Include metadata in single response (#2) - **Eliminates redundant call**
3. ✅ Add database indexes (#5) - **Easy optimization**

**Expected Result:** 11-13s → **2-4s** (70-80% improvement)

### **Phase 2: Caching (2-4 hours)**
4. ✅ Add HTTP caching (#3A) - **Simple, effective**
5. ✅ Consider Redis for production (#3B)

**Expected Result:** 2-4s → **500ms-1s** on repeat loads (90%+ improvement)

### **Phase 3: Advanced (Optional, 4-8 hours)**
6. ✅ Lazy load sections (#4) - **Better UX**
7. ✅ Connection pooling (#7) - **Production ready**

---

## 📈 Performance Targets

| Metric | Current | After Phase 1 | After Phase 2 | Target |
|--------|---------|---------------|--------------|--------|
| Initial Load | 11-13s | 2-4s | 2-4s | <2s |
| Cached Load | 11-13s | 2-4s | 500ms-1s | <500ms |
| API Calls | 2-3 | 1 | 1 | 1 |
| DB Queries | 13+ | 2 | 2 (cached) | 1-2 |

---

## 🔧 Implementation Notes

1. **Test with realistic data:** Use reports with 5 sections, large text fields
2. **Monitor database query times:** Add logging to measure actual query performance
3. **Consider pagination:** If reports grow large, consider paginating sections
4. **Add metrics:** Track load times in production to measure improvements

---

## 🎯 Conclusion

The primary bottlenecks are:
1. **N+1 query problem** (biggest impact)
2. **Redundant API calls** (easy fix)
3. **No caching** (high value)

Implementing Phase 1 alone should reduce load times by **70-80%**, bringing 11-13s down to **2-4s**. Adding caching in Phase 2 will make repeat loads nearly instant.

