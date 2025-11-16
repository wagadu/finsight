import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8001"
  
  try {
    const body = await request.json()
    
    const response = await fetch(`${aiServiceUrl}/eval/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Python service error: ${response.status} ${errorText}`)
      
      return NextResponse.json(
        { error: "Failed to run evaluation" },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error running evaluation:", error)
    return NextResponse.json(
      { error: "Failed to run evaluation" },
      { status: 500 }
    )
  }
}

