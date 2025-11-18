/**
 * Slack Notification - ATOM Pipeline Summary
 *
 * PURPOSE: Send pipeline execution summary to Slack
 *
 * INPUT: Results from all three agents
 * OUTPUT: Slack message sent confirmation
 * RUNTIME: ~30 seconds
 */

import * as wmill from 'windmill-client';
import axios from 'axios';

interface ScannerResults {
  symbolsScanned: number;
  signalsFound: number;
  timeSeconds: number;
}

interface TriageResults {
  potentialSignalsProcessed: number;
  primedCandidatesSaved: number;
  timeSeconds: number;
}

interface ReasonerResults {
  primedCandidatesAnalyzed: number;
  goDecisions: number;
  standbyDecisions: number;
  noGoDecisions: number;
  timeSeconds: number;
}

async function sendSlackMessage(message: string): Promise<void> {
  const webhookUrl = await wmill.getResource('u/benkanspedos/SLACK_WEBHOOK_URL');

  await axios.post(webhookUrl, {
    text: message,
    mrkdwn: true
  });
}

export async function main(
  scannerResults: ScannerResults,
  triageResults: TriageResults,
  reasonerResults: ReasonerResults
): Promise<{
  success: boolean;
  messageSent: boolean;
}> {
  console.log('📢 Sending pipeline summary to Slack...\n');

  const totalTime = scannerResults.timeSeconds + triageResults.timeSeconds + reasonerResults.timeSeconds;

  const message = `
*🚀 ATOM Pipeline Execution Complete*

*📊 Scanner Agent (Phase 1-4)*
• Symbols Scanned: ${scannerResults.symbolsScanned}
• POTENTIAL Signals Found: ${scannerResults.signalsFound}
• Runtime: ${scannerResults.timeSeconds.toFixed(1)}s

*🎯 Triage Agent (Phase 5-8)*
• POTENTIAL Signals Processed: ${triageResults.potentialSignalsProcessed}
• PRIMED Candidates: ${triageResults.primedCandidatesSaved}
• Runtime: ${triageResults.timeSeconds.toFixed(1)}s

*🧠 Reasoner Agent (Phase 9-10)*
• PRIMED Candidates Analyzed: ${reasonerResults.primedCandidatesAnalyzed}
• GO Decisions: ${reasonerResults.goDecisions} ✅
• STANDBY Decisions: ${reasonerResults.standbyDecisions} ⏸️
• NO-GO Decisions: ${reasonerResults.noGoDecisions} ❌
• Runtime: ${reasonerResults.timeSeconds.toFixed(1)}s

*⏱️ Total Pipeline Runtime*: ${(totalTime / 60).toFixed(1)} minutes

*🎯 Action Items*:
${reasonerResults.goDecisions > 0 ? `• ${reasonerResults.goDecisions} GO signals ready for immediate execution` : ''}
${reasonerResults.standbyDecisions > 0 ? `• ${reasonerResults.standbyDecisions} STANDBY signals awaiting confirmation (Pouncer monitoring)` : ''}
${reasonerResults.goDecisions === 0 && reasonerResults.standbyDecisions === 0 ? '• No signals ready for execution at this time' : ''}
`;

  try {
    await sendSlackMessage(message);
    console.log('   ✅ Slack notification sent successfully\n');

    return {
      success: true,
      messageSent: true
    };
  } catch (error: any) {
    console.error(`   ❌ Error sending Slack notification: ${error.message}\n`);

    return {
      success: false,
      messageSent: false
    };
  }
}
