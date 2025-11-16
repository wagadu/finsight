/**
 * Get the AI service URL with proper protocol handling.
 * Automatically adds https:// if no protocol is provided.
 */
export function getAIServiceUrl(): string {
  const url = process.env.AI_SERVICE_URL || 'http://localhost:8001'
  
  // If URL doesn't start with http:// or https://, add https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`
  }
  
  return url
}

