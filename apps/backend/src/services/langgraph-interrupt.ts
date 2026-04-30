const interruptedConversations = new Set<string>();

export function interruptConversation(conversationId: string) {
  interruptedConversations.add(conversationId);
}

export function resumeConversation(conversationId: string) {
  interruptedConversations.delete(conversationId);
}

export function isConversationInterrupted(conversationId: string): boolean {
  return interruptedConversations.has(conversationId);
}
