import { NextResponse } from "next/server"

export interface EvalSummary {
  totalQuestions: number
  successRate: number
  lastRunAt?: string
}

export async function GET() {
  const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8001"
  
  try {
    const response = await fetch(`${aiServiceUrl}/eval/summary`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Python service error: ${response.status} ${errorText}`)
      
      // Return default values if service is unavailable
      return NextResponse.json({
        totalQuestions: 0,
        successRate: 0.0,
        lastRunAt: undefined,
      })
    }

    const data = await response.json()
    
    const summary: EvalSummary = {
      totalQuestions: data.totalQuestions || 0,
      successRate: data.successRate || 0.0,
      lastRunAt: data.lastRunAt || undefined,
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error("Error fetching evaluation summary:", error)
    
    // Return default values on error
    return NextResponse.json({
      totalQuestions: 0,
      successRate: 0.0,
      lastRunAt: undefined,
    })
  }
}
