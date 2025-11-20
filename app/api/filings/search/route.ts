import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface FilingSearchRequest {
  query: string
}

interface FilingSearchResponse {
  message: string
  candidate?: {
    id: string
    ticker: string
    company_name: string
    filing_type: string
    filing_year: number
    status: string
  }
  error?: string
}

/**
 * Helper function to search SEC filings using the SEC API
 */
async function searchSECFiling(
  ticker: string,
  cik: string,
  filingType: string,
  filingYear: number
): Promise<{
  source_url: string
  accession_number: string | null
  filing_date: string | null
} | null> {
  try {
    // Format CIK to 10 digits with leading zeros
    const formattedCIK = cik.replace(/\D/g, '').padStart(10, '0')
    
    // SEC API endpoint for company submissions
    const secUrl = `https://data.sec.gov/submissions/CIK${formattedCIK}.json`
    
    const response = await fetch(secUrl, {
      headers: {
        'User-Agent': process.env.SEC_USER_AGENT || 'FinSight Filing Search (contact@example.com)',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`SEC API error: ${response.status}`)
      return null
    }

    const data = await response.json()
    const filings = data.filings?.recent || {}
    const forms = filings.form || []
    const filingDates = filings.filingDate || []
    const accessionNumbers = filings.accessionNumber || []
    const primaryDocuments = filings.primaryDocument || []

    // Find matching filing
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i]
      const filingDate = filingDates[i]
      const accessionNumber = accessionNumbers[i]
      const primaryDoc = primaryDocuments[i]

      // Check if form type and year match
      if (form === filingType) {
        const filingYearFromDate = filingDate ? parseInt(filingDate.substring(0, 4)) : null
        if (filingYearFromDate === filingYear) {
          // Construct SEC URL - use the primary document URL if available
          // Format: https://www.sec.gov/Archives/edgar/data/{CIK}/{accession_number}/{primary_document}
          let sourceUrl: string
          if (primaryDoc && accessionNumber) {
            const accessionNoClean = accessionNumber.replace(/-/g, '')
            sourceUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(formattedCIK)}/${accessionNoClean}/${primaryDoc}`
          } else {
            // Fallback to viewer URL
            sourceUrl = `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${formattedCIK}&accession_number=${accessionNumber}&xbrl_type=v`
          }

          return {
            source_url: sourceUrl,
            accession_number: accessionNumber,
            filing_date: filingDate,
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error searching SEC filing:', error)
    return null
  }
}

/**
 * Helper function to resolve company ticker/name to CIK
 */
async function resolveCompanyToCIK(companyIdentifier: string): Promise<{
  ticker: string
  cik: string
  company_name: string
} | null> {
  try {
    // Try to find in watchlist first
    const supabase = getSupabaseServerClient()
    const watchlistResult = await supabase
      .from('filing_watchlist')
      .select('ticker, cik, company_name')
      .or(`ticker.ilike.%${companyIdentifier}%,company_name.ilike.%${companyIdentifier}%`)
      .limit(1)
      .single()

    if (watchlistResult.data) {
      return {
        ticker: watchlistResult.data.ticker,
        cik: watchlistResult.data.cik || '',
        company_name: watchlistResult.data.company_name,
      }
    }

    // If not in watchlist, try SEC company tickers API
    const tickersUrl = 'https://www.sec.gov/files/company_tickers.json'
    const response = await fetch(tickersUrl, {
      headers: {
        'User-Agent': process.env.SEC_USER_AGENT || 'FinSight Filing Search (contact@example.com)',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    const tickersData = await response.json()
    const identifierUpper = companyIdentifier.toUpperCase()

    // Search through tickers
    for (const [key, value] of Object.entries(tickersData)) {
      const company = value as any
      if (
        company.ticker === identifierUpper ||
        company.title?.toUpperCase().includes(identifierUpper)
      ) {
        return {
          ticker: company.ticker,
          cik: company.cik_str.toString().padStart(10, '0'),
          company_name: company.title,
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error resolving company:', error)
    return null
  }
}

/**
 * Main API handler for filing search
 */
export async function POST(request: NextRequest) {
  try {
    const body: FilingSearchRequest = await request.json()
    const { query } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Use Agent SDK if configured, otherwise fall back to Chat API
    const agentId = process.env.OPENAI_AGENT_ID
    const isWorkflow = agentId?.startsWith('wf_') || false
    let parsedData: {
      company: string
      filing_type: string
      year: number | null
    } | undefined

    if (agentId) {
      // Use OpenAI Workflow/Agent API
      try {
        console.log('🤖 Using Agent Builder with ID:', agentId)
        console.log('📝 Query:', query)
        
        // Try to access the API - workflows might be under different paths
        let run: any
        let retrieveRun: (workflowId: string, runId: string) => Promise<any> | undefined
        
        // Try different API paths
        if (isWorkflow) {
          // Initialize retrieveRun to avoid TypeScript errors
          retrieveRun = async () => ({ status: 'failed' })
          // For workflows, try the /v1/agents/{id}/invoke endpoint
          // Workflows might be accessible through the agents invoke endpoint
          try {
            console.log('📦 Trying /v1/agents/{id}/invoke endpoint for workflow')
            
            const response = await fetch(`https://api.openai.com/v1/agents/${agentId}/invoke`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                input: query,
              }),
            })
            
            if (!response.ok) {
              const errorText = await response.text()
              console.error('Agents invoke API error:', response.status, errorText)
              
              // If that fails, workflows might not be directly accessible via REST API
              // In that case, we'll use Chat API with the workflow's instructions
              console.log('⚠️ Workflow not accessible via REST API, using Chat API with workflow instructions')
              throw new Error('Workflow API not available - will use Chat API')
            }
            
            const responseData = await response.json()
            console.log('📥 Workflow response:', JSON.stringify(responseData).substring(0, 200))
            
            // Extract the output from the response
            let outputContent: string = ''
            
            if (responseData.output) {
              outputContent = typeof responseData.output === 'string' 
                ? responseData.output 
                : JSON.stringify(responseData.output)
            } else if (responseData.result) {
              outputContent = typeof responseData.result === 'string'
                ? responseData.result
                : JSON.stringify(responseData.result)
            } else if (responseData.messages && responseData.messages.length > 0) {
              const lastMessage = responseData.messages[responseData.messages.length - 1]
              outputContent = typeof lastMessage.content === 'string'
                ? lastMessage.content
                : JSON.stringify(lastMessage.content)
            } else {
              outputContent = JSON.stringify(responseData)
            }
            
            // Parse JSON from the output
            const jsonMatch = outputContent.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              parsedData = JSON.parse(jsonMatch[0])
              console.log('✅ Successfully parsed workflow response:', parsedData)
              // Skip the polling section since we have the data
              run = { status: 'completed' }
              retrieveRun = async () => run
            } else {
              throw new Error(`No JSON found in workflow output: ${outputContent.substring(0, 100)}`)
            }
          } catch (workflowError: any) {
            console.log('⚠️ Workflow not accessible via REST API')
            console.log('💡 Note: Workflows created in Agent Builder may only be accessible via ChatKit (client-side)')
            console.log('📝 Falling back to Chat API with equivalent instructions...')
            // Don't throw - let it fall through to Chat API
            // The Chat API will use the same instructions you configured in Agent Builder
            parsedData = undefined
          }
        } else {
          // For agents, try the agents API
          const agentsApi = (openai as any).beta?.agents
          if (agentsApi) {
            run = await agentsApi.createRun({
              agent_id: agentId,
              additional_messages: [
                {
                  role: 'user',
                  content: query,
                },
              ],
            })
            retrieveRun = (agentId: string, runId: string) => 
              agentsApi.retrieveRun(agentId, runId)
          } else {
            // Fallback: Use direct HTTP API for agents
            const response = await fetch(`https://api.openai.com/v1/agents/${agentId}/runs`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                additional_messages: [
                  {
                    role: 'user',
                    content: query,
                  },
                ],
              }),
            })
            
            if (!response.ok) {
              const errorText = await response.text()
              throw new Error(`Agent API error: ${response.status} - ${errorText}`)
            }
            
            run = await response.json()
            retrieveRun = async (agentId: string, runId: string) => {
              const resp = await fetch(`https://api.openai.com/v1/agents/${agentId}/runs/${runId}`, {
                headers: {
                  'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                },
              })
              return resp.json()
            }
          }
        }

        // Only poll if we don't already have parsedData (workflow might return directly)
        if (!parsedData && run) {
          // Wait for the run to complete (polling)
          let currentRun = run
          let attempts = 0
          const maxAttempts = 30 // 30 seconds max wait

          while (
            currentRun.status !== 'completed' &&
            currentRun.status !== 'failed' &&
            attempts < maxAttempts
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1000)) // Wait 1 second
            currentRun = await retrieveRun(agentId, run.id)
            attempts++
          }

          if (currentRun.status === 'failed') {
            console.error('❌ Agent/Workflow run failed:', currentRun)
            return NextResponse.json(
              { error: 'Agent run failed. Please try again.' },
              { status: 500 }
            )
          }

          // Extract the response - structure might vary
          let responseContent: string
          if (currentRun.output) {
            // Workflow output format
            responseContent = typeof currentRun.output === 'string' 
              ? currentRun.output 
              : JSON.stringify(currentRun.output)
          } else if (currentRun.messages && currentRun.messages.length > 0) {
            // Agent message format
            const lastMessage = currentRun.messages[currentRun.messages.length - 1]
            responseContent = typeof lastMessage?.content === 'string'
              ? lastMessage.content
              : JSON.stringify(lastMessage?.content || {})
          } else {
            throw new Error('No response found in run output')
          }

          // Parse JSON from response
          try {
            console.log('📥 Agent/Workflow response:', responseContent)
            // Try to extract JSON from the response (might be wrapped in markdown code blocks)
            const jsonMatch = responseContent.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              parsedData = JSON.parse(jsonMatch[0])
              console.log('✅ Successfully parsed agent response:', parsedData)
            } else {
              throw new Error('No JSON found in agent response')
            }
          } catch (parseError) {
            console.error('❌ Error parsing agent response:', parseError, 'Response:', responseContent)
            return NextResponse.json(
              {
                error: 'Agent returned invalid format. Please check agent configuration in Agent Builder.',
              },
              { status: 500 }
            )
          }
        }
      } catch (agentError: any) {
        console.error('❌ Agent SDK error:', agentError.message || agentError)
        console.error('Full error:', agentError)
        // Fall back to Chat API if agent fails
        console.log('⚠️ Falling back to Chat API due to agent error')
        parsedData = undefined // Reset to trigger Chat API fallback
      }
    }

    // Use Chat API (either as fallback or primary if no agent configured)
    if (!parsedData) {
      if (agentId && isWorkflow) {
        console.log('💬 Using Chat API (workflow fallback mode)')
        console.log('📋 Note: Using equivalent instructions to your Agent Builder workflow')
      } else if (agentId) {
        console.log('💬 Using Chat API (agent fallback mode)')
      } else {
        console.log('💬 Using Chat API (direct mode)')
      }
      
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a financial filing search assistant. Extract information from user queries about SEC filings.

Extract:
- Company name or ticker symbol (e.g., "Apple", "AAPL", "Microsoft", "MSFT")
- Filing type: "10-K" for annual reports, "10-Q" for quarterly reports, or other SEC form types
- Year: the filing year if specified, or null if not specified

Return a JSON object with: company, filing_type, year

Examples:
- "Find Apple's 2023 10-K annual report" -> {"company": "Apple", "filing_type": "10-K", "year": 2023}
- "Search Microsoft quarterly 2024" -> {"company": "Microsoft", "filing_type": "10-Q", "year": 2024}
- "Get Tesla latest annual report" -> {"company": "Tesla", "filing_type": "10-K", "year": null}
- "Find GOOGL 10-K 2022" -> {"company": "GOOGL", "filing_type": "10-K", "year": 2022}`,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      })

      const responseContent = completion.choices[0]?.message?.content
      if (!responseContent) {
        return NextResponse.json(
          { error: 'Failed to parse query' },
          { status: 500 }
        )
      }

      try {
        parsedData = JSON.parse(responseContent)
      } catch (error) {
        console.error('Error parsing OpenAI response:', error)
        return NextResponse.json(
          { error: 'Failed to parse query. Please try rephrasing your request.' },
          { status: 400 }
        )
      }
    }

    if (!parsedData || !parsedData.company) {
      return NextResponse.json(
        { error: 'Could not extract company information from query. Please be more specific (e.g., "Find Apple\'s 2023 10-K annual report").' },
        { status: 400 }
      )
    }

    // Resolve company to CIK
    const companyInfo = await resolveCompanyToCIK(parsedData.company)
    if (!companyInfo) {
      return NextResponse.json(
        { error: `Could not find company "${parsedData.company}". Please check the company name or ticker.` },
        { status: 404 }
      )
    }

    // Determine filing type
    const filingType = parsedData.filing_type || '10-K'
    const filingYear = parsedData.year || new Date().getFullYear() - 1 // Default to last year if not specified

    // Search for the filing
    const filingInfo = await searchSECFiling(
      companyInfo.ticker,
      companyInfo.cik,
      filingType,
      filingYear
    )

    if (!filingInfo) {
      return NextResponse.json(
        { error: `Could not find ${filingType} filing for ${companyInfo.company_name} (${companyInfo.ticker}) for year ${filingYear}.` },
        { status: 404 }
      )
    }

    // Check if candidate already exists
    const supabase = getSupabaseServerClient()
    const existingCheck = await supabase
      .from('filing_candidates')
      .select('id, status')
      .eq('ticker', companyInfo.ticker)
      .eq('filing_type', filingType)
      .eq('filing_year', filingYear)
      .maybeSingle()

    if (existingCheck.data) {
      return NextResponse.json<FilingSearchResponse>({
        message: `Filing already exists in candidates list.`,
        candidate: {
          id: existingCheck.data.id,
          ticker: companyInfo.ticker,
          company_name: companyInfo.company_name,
          filing_type: filingType,
          filing_year: filingYear,
          status: existingCheck.data.status,
        },
      })
    }

    // Create new filing candidate
    const candidateData = {
      ticker: companyInfo.ticker,
      cik: companyInfo.cik,
      company_name: companyInfo.company_name,
      source: 'sec',
      source_url: filingInfo.source_url,
      filing_type: filingType,
      filing_year: filingYear,
      filing_date: filingInfo.filing_date,
      accession_number: filingInfo.accession_number,
      status: 'pending',
      metadata: {
        search_query: query,
        discovered_via: 'chat_search',
      },
    }

    const insertResult = await supabase
      .from('filing_candidates')
      .insert(candidateData)
      .select()
      .single()

    if (insertResult.error) {
      console.error('Error inserting candidate:', insertResult.error)
      return NextResponse.json(
        { error: 'Failed to create filing candidate' },
        { status: 500 }
      )
    }

    return NextResponse.json<FilingSearchResponse>({
      message: `Successfully found and added ${companyInfo.ticker} ${filingType} ${filingYear} to filing candidates.`,
      candidate: {
        id: insertResult.data.id,
        ticker: companyInfo.ticker,
        company_name: companyInfo.company_name,
        filing_type: filingType,
        filing_year: filingYear,
        status: insertResult.data.status,
      },
    })
  } catch (error: any) {
    console.error('Error in /api/filings/search:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

