import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { text, images } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set in environment variables' }, { status: 500 })

    const client = new Anthropic({ apiKey })

    const userContent: Anthropic.MessageParam['content'] = []

    for (const img of (images ?? [])) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mediaType,
          data: img.data,
        },
      })
    }

    const inputText = (text ?? '').trim()
    userContent.push({
      type: 'text',
      text: `${inputText ? inputText + '\n\n' : ''}Generate flashcard question/answer pairs from the above content. Return ONLY a valid JSON array with no other text, markdown, or code fences:\n[{"question": "...", "answer": "..."}, ...]\n\nMake questions specific and clear. Make answers concise but complete. Generate as many cards as makes sense for the content provided.`,
    })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: userContent }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    const cards = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return NextResponse.json({ cards })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
