/**
 * Builds the exact body `/api/chat` accepts. `hasExactKeys` rejects extra keys
 * at the body, message, or part level, so nothing beyond these fields may be sent.
 *
 * Only the current question travels. The route accepts `role: 'user'` and
 * nothing else, so sending the session's history put a list of questions with
 * no answers between them in front of the model, which read them as all still
 * open and answered every one again.
 */

export type Turn = {
  id: string
  question: string
  state: 'processing' | 'done' | 'failed'
}

export function requestBody(question: Pick<Turn, 'id' | 'question'>) {
  return JSON.stringify({
    messages: [
      {
        id: question.id,
        role: 'user',
        parts: [{ type: 'text', text: question.question }],
      },
    ],
  })
}

export function requestBodyFromLastUser(
  messages: readonly { id: string; role: string; parts: readonly { type: string; text?: string }[] }[],
) {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')
  if (!lastUser) {
    return JSON.stringify({ messages: [] })
  }

  const question = lastUser.parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string' && part.text.length > 0)
    .map((part) => part.text as string)
    .join('')

  return requestBody({ id: lastUser.id, question })
}
