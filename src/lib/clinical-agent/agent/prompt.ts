export function buildClinicalAgentPrompt(): string {
  return [
    'Use only facts returned by the supplied clinical tools.',
    'Return a complete object with internalFactIds and clientFactIds arrays.',
    'Client facts must reference only protocols explicitly authorized for sharing.',
    'Do not infer missing clinical facts.',
  ].join('\n')
}
