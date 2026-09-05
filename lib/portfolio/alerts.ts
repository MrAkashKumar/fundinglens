import type { ClientReview, Finding } from './contracts';
export function alertDraft(
  client: ClientReview,
  finding: Finding,
  purpose: 'review' | 'request' | 'followup' = 'review',
) {
  if (finding.audience !== 'client_review')
    throw new Error(
      'Resolve internal data checks before preparing a client alert.',
    );
  const opening =
    purpose === 'request'
      ? 'Could you help us confirm the current information for the portfolio review below?'
      : purpose === 'followup'
        ? 'I would like to check whether there are any updates relevant to the portfolio review below.'
        : 'I would like to discuss a point identified in our portfolio review.';
  const action =
    purpose === 'request'
      ? 'Please confirm whether your objectives, cash needs, timing or relevant account information have changed. We can agree a secure channel for any supporting documents.'
      : purpose === 'followup'
        ? 'Please let us know whether this remains relevant and a convenient time to review the next step together.'
        : 'Please let us know a convenient time to discuss this.';
  return `Dear ${client.name},\n\n${opening} Portfolio ${finding.portfolioId}, based on the records dated ${client.asOf}.\n\n${finding.detail}\n\n${finding.reason}\n\nProposed next step\n${finding.nextStep}\n\n${action} No portfolio changes have been made through this review.\n\n${client.rm}`;
}
