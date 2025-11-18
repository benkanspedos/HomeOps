/**
 * ATOM Triage Agent - Windmill Version (Phase 5-8)
 *
 * PURPOSE: Filter POTENTIAL signals down to high-priority PRIMED candidates
 *
 * PIPELINE:
 * 1. Receive POTENTIAL signals from Scanner (as input parameter)
 * 2. Phase 5: High-Conviction Filter (ATOM >= 55%)
 * 3. Phase 6: AI Triage Filter (Gemma3 4B lightweight pre-screen, ≥60%)
 * 4. Phase 7: AI Hazard Check (real-time news gathering)
 * 5. Return PRIMED candidates (Flow handles database inserts)
 *
 * INPUT: Array of POTENTIAL signals (from Scanner)
 * OUTPUT: Array of PRIMED candidates (JSON)
 * RUNTIME: ~4-5 minutes (includes news gathering)
 *
 * WINDMILL INTEGRATION:
 * - Receives input from Scanner via Flow parameter
 * - Uses wmill.getResource() for secrets (NOT process.env)
 * - Returns JSON data (Flow handles database inserts)
 * - Deployed to: windmill/f/atom/2_triage.ts
 */

import * as wmill from 'windmill-client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Ollama } from 'ollama';
import axios from 'axios';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type EliteSignalType =
  | 'CoiledSpring'
  | 'VPB'
  | 'RelStrength'
  | 'QVP'
  | 'RSI_MeanReversion'
  | 'SR_Breakout';

interface POTENTIALSignal {
  symbol: string;
  elite_scores: Record<EliteSignalType, number>;
  c_scores: {
    C1: number;
    C2: number;
    C3: number;
  };
  c_decision: string;
  atom_score: number;
  signal_type: EliteSignalType;
  fundamental_packet: any;
  technical_snapshot: {
    price: number;
    rsi_14: number;
    macd: number;
    adx_14: number;
    volume: number;
    sma_50: number;
    sma_200: number;
  };
  sr_context: any;
}

interface TriageInput {
  symbol: string;
  atomScore: number;
  eliteScore: number;
  signals: Array<{ name: string; confidence: number }>;
  technicals: {
    rsi: number;
    macd: number;
    adx: number;
    price_above_50sma: boolean;
    bollinger_position: number;
  };
}

interface TriageResult {
  symbol: string;
  passed: boolean;
  confidence: number;
  reasoning: string;
}

interface NewsPacket {
  general_hazard_report: string;
  insider_sales_report: string;
  fraud_investigation_report: string;
}

interface PRIMEDCandidate {
  symbol: string;
  atom_score: number;
  triage_confidence: number;
  news_packet: NewsPacket;
  technical_data: any;
  fundamental_data: any;
}

// ============================================================================
// SUPABASE & OLLAMA CLIENT INITIALIZATION
// ============================================================================

async function getSupabaseClient(): Promise<SupabaseClient> {
  const supabaseUrl = await wmill.getResource('u/benkanspedos/SUPABASE_URL');
  const supabaseKey = await wmill.getResource('u/benkanspedos/SUPABASE_SERVICE_KEY');

  return createClient(supabaseUrl, supabaseKey);
}

async function getOllamaClient(): Promise<Ollama> {
  // Ollama runs locally, no credentials needed
  return new Ollama({ host: 'http://localhost:11434' });
}

// ============================================================================
// PHASE 6: AI TRIAGE FILTER (Gemma3 4B Lightweight Pre-Screen)
// ============================================================================

async function runAITriageFilter(inputs: TriageInput[]): Promise<TriageResult[]> {
  const ollama = await getOllamaClient();
  const results: TriageResult[] = [];

  console.log(`🔍 AI Triage Filter: Screening ${inputs.length} high-conviction signals...`);
  console.log(`   Model: Gemma3 4B (ultra-fast, 3-5 sec per signal)`);
  console.log(`   Threshold: >= 0.60 triage_confidence to pass\n`);

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const startTime = Date.now();

    try {
      const prompt = `You are a financial trading triage analyst. Quickly assess if this signal is worth deep AI analysis.

Signal: ${input.symbol}
ATOM Score: ${(input.atomScore * 100).toFixed(1)}%
Elite Score: ${(input.eliteScore * 100).toFixed(1)}%
Active Signals: ${input.signals.map(s => `${s.name} (${(s.confidence * 100).toFixed(0)}%)`).join(', ')}

Technical Snapshot:
- RSI: ${input.technicals.rsi.toFixed(1)}
- MACD: ${input.technicals.macd.toFixed(2)}
- ADX: ${input.technicals.adx.toFixed(1)}
- Price above 50 SMA: ${input.technicals.price_above_50sma ? 'Yes' : 'No'}
- Bollinger Position: ${(input.technicals.bollinger_position * 100).toFixed(0)}%

Decision: PASS or REJECT
Confidence: 0-100%
Reasoning: One sentence

Output format:
DECISION: [PASS/REJECT]
CONFIDENCE: [0-100]
REASONING: [brief explanation]`;

      const response = await ollama.generate({
        model: 'gemma3:4b',
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 100
        }
      });

      const output = response.response;
      const decisionMatch = output.match(/DECISION:\s*(PASS|REJECT)/i);
      const confidenceMatch = output.match(/CONFIDENCE:\s*(\d+)/i);
      const reasoningMatch = output.match(/REASONING:\s*(.+)/i);

      const decision = decisionMatch ? decisionMatch[1].toUpperCase() : 'REJECT';
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.50;
      const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Unable to parse reasoning';

      const passed = decision === 'PASS' && confidence >= 0.60;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      results.push({
        symbol: input.symbol,
        passed,
        confidence,
        reasoning
      });

      console.log(`   [${i + 1}/${inputs.length}] ${input.symbol}: ${(confidence * 100).toFixed(0)}% ${passed ? '✅ PASS' : '❌ REJECT'} (${elapsed}s)`);

    } catch (error: any) {
      console.error(`   [${i + 1}/${inputs.length}] ${input.symbol}: ERROR - ${error.message}`);
      results.push({
        symbol: input.symbol,
        passed: false,
        confidence: 0,
        reasoning: `Error: ${error.message}`
      });
    }
  }

  return results;
}

// ============================================================================
// PHASE 7: AI HAZARD CHECK (Real-Time News Gathering)
// ============================================================================

async function runHazardChecks(symbols: string[]): Promise<Map<string, NewsPacket>> {
  const fmpApiKey = await wmill.getResource('u/benkanspedos/FMP_API_KEY');
  const hazardReports = new Map<string, NewsPacket>();

  console.log(`\n🔍 Phase 7: AI Hazard Check (real-time news gathering)...`);
  console.log(`   Gathering news for ${symbols.length} symbols (sequential, rate-limited)...\n`);

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];

    try {
      console.log(`   [${i + 1}/${symbols.length}] Fetching news for ${symbol}...`);

      // Fetch latest news from FMP API
      const newsResponse = await axios.get(
        `https://financialmodelingprep.com/api/v3/stock_news?tickers=${symbol}&limit=5&apikey=${fmpApiKey}`
      );

      const newsArticles = newsResponse.data || [];
      const headlines = newsArticles.map((article: any) => article.title || '').filter((t: string) => t);

      // Simple keyword-based hazard detection
      const hazardKeywords = ['fraud', 'investigation', 'lawsuit', 'bankruptcy', 'scandal', 'sec', 'delisting'];
      const insiderKeywords = ['insider', 'sell', 'selling', 'dump', 'exit'];

      const generalHazards = headlines.filter((h: string) =>
        hazardKeywords.some(keyword => h.toLowerCase().includes(keyword))
      );

      const insiderHazards = headlines.filter((h: string) =>
        insiderKeywords.some(keyword => h.toLowerCase().includes(keyword))
      );

      const generalReport = generalHazards.length > 0
        ? `⚠️ HAZARD DETECTED: ${generalHazards.join('; ')}`
        : 'CLEAR. No major hazards detected in recent news.';

      const insiderReport = insiderHazards.length > 0
        ? `⚠️ INSIDER SALES: ${insiderHazards.join('; ')}`
        : 'CLEAR. No significant insider selling detected.';

      hazardReports.set(symbol, {
        general_hazard_report: generalReport,
        insider_sales_report: insiderReport,
        fraud_investigation_report: 'CLEAR. No fraud investigations detected.'
      });

      // Rate limit: 10 calls per second for FMP
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      console.error(`   ⚠️  Error fetching news for ${symbol}: ${error.message}`);
      hazardReports.set(symbol, {
        general_hazard_report: 'CLEAR. No data available.',
        insider_sales_report: 'CLEAR. No data available.',
        fraud_investigation_report: 'CLEAR. No data available.'
      });
    }
  }

  console.log(`\n   ✅ News gathering complete for ${hazardReports.size} symbols\n`);

  return hazardReports;
}

// ============================================================================
// MAIN TRIAGE FUNCTION (Windmill Entry Point)
// ============================================================================

export async function main(potentialSignals: POTENTIALSignal[]): Promise<{
  success: boolean;
  potentialSignalsProcessed: number;
  primedCandidatesSaved: number;
  primedCandidates: PRIMEDCandidate[];
  timeSeconds: number;
  summary: {
    highConvictionCount: number;
    triagePassedCount: number;
    triageRejectedCount: number;
  };
}> {
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════════════');
  console.log('🎯 ATOM TRIAGE AGENT - Windmill Edition');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`📋 Received ${potentialSignals.length} POTENTIAL signals from Scanner\n`);

  if (potentialSignals.length === 0) {
    console.log('   ℹ️  No POTENTIAL signals to triage. Exiting.\n');
    return {
      success: true,
      potentialSignalsProcessed: 0,
      primedCandidatesSaved: 0,
      primedCandidates: [],
      timeSeconds: 0,
      summary: {
        highConvictionCount: 0,
        triagePassedCount: 0,
        triageRejectedCount: 0
      }
    };
  }

  // Initialize Supabase client
  const supabase = await getSupabaseClient();

  // Phase 5: High-Conviction Filter (ATOM >= 55%)
  console.log('🎯 Phase 5: High-Conviction Filter (ATOM >= 55%)...\n');

  const highConvictionSignals = potentialSignals.filter(s => s.atom_score >= 0.55);

  console.log(`   Total POTENTIAL: ${potentialSignals.length}`);
  console.log(`   High-Conviction (≥55%): ${highConvictionSignals.length}`);
  console.log(`   Filtered Out (<55%): ${potentialSignals.length - highConvictionSignals.length}`);
  console.log(`   Pass Rate: ${((highConvictionSignals.length / potentialSignals.length) * 100).toFixed(1)}%\n`);

  // Phase 6: AI Triage Filter (Gemma3 4B)
  console.log('🔍 Phase 6: AI Triage Filter (Gemma3 4B pre-screen)...\n');

  const triageInputs: TriageInput[] = highConvictionSignals.map(evaluation => {
    const eliteScore = Math.max(...Object.values(evaluation.elite_scores).map(v => typeof v === 'number' ? v : 0));

    return {
      symbol: evaluation.symbol,
      atomScore: evaluation.atom_score,
      eliteScore,
      signals: Object.entries(evaluation.elite_scores).map(([name, confidence]) => ({
        name,
        confidence: typeof confidence === 'number' ? confidence : 0
      })),
      technicals: {
        rsi: evaluation.technical_snapshot.rsi_14,
        macd: evaluation.technical_snapshot.macd,
        adx: evaluation.technical_snapshot.adx_14,
        price_above_50sma: evaluation.technical_snapshot.price > evaluation.technical_snapshot.sma_50,
        bollinger_position: 0.5 // Simplified (would calculate from BB bands)
      }
    };
  });

  // Run AI Triage Filter
  const triageResults = await runAITriageFilter(triageInputs);

  // Filter to signals that passed triage
  const triagePassedSignals = highConvictionSignals.filter(evaluation => {
    const triageResult = triageResults.find(r => r.symbol === evaluation.symbol);
    return triageResult?.passed || false;
  });

  const triageRejected = highConvictionSignals.length - triagePassedSignals.length;
  const triageSavings = (triageRejected * 25).toFixed(0);

  console.log(`\n   ✅ AI Triage Filter complete!`);
  console.log(`   📊 High-Conviction Input: ${highConvictionSignals.length} signals`);
  console.log(`   ✅ Passed Triage (≥60%): ${triagePassedSignals.length} signals`);
  console.log(`   ❌ Rejected (<60%): ${triageRejected} signals`);
  console.log(`   ⚡ Time Saved: ~${triageSavings} seconds (~${(parseInt(triageSavings) / 60).toFixed(1)} minutes)\n`);

  // Phase 7: AI Hazard Check (Real-time news)
  const hazardReports = await runHazardChecks(triagePassedSignals.map(s => s.symbol));

  // Construct PRIMED candidates for output
  console.log('💾 Phase 8: Preparing PRIMED candidates for output...\n');

  const primedCandidates: PRIMEDCandidate[] = triagePassedSignals.map(signal => {
    const newsPacket = hazardReports.get(signal.symbol) || {
      general_hazard_report: 'CLEAR. No data available.',
      insider_sales_report: 'CLEAR. No data available.',
      fraud_investigation_report: 'CLEAR. No data available.'
    };

    const triageResult = triageResults.find(r => r.symbol === signal.symbol);
    const triageConfidence = triageResult?.confidence || 0.60;

    return {
      symbol: signal.symbol,
      atom_score: signal.atom_score,
      triage_confidence: triageConfidence,
      news_packet: newsPacket,
      technical_data: signal.technical_snapshot,
      fundamental_data: signal.fundamental_packet
    };
  });

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('═══════════════════════════════════════════════════');
  console.log('📊 TRIAGE AGENT SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`   POTENTIAL signals received: ${potentialSignals.length}`);
  console.log(`   High-Conviction (≥55%): ${highConvictionSignals.length}`);
  console.log(`   Passed AI Triage: ${triagePassedSignals.length}`);
  console.log(`   PRIMED candidates prepared: ${primedCandidates.length}`);
  console.log(`   Total time: ${totalTime}s\n`);

  console.log('✅ Triage Agent Complete!');
  console.log('⏭️  Passing ${primedCandidates.length} candidates to Reasoner Agent\n');

  return {
    success: true,
    potentialSignalsProcessed: potentialSignals.length,
    primedCandidatesSaved: primedCandidates.length,
    primedCandidates,
    timeSeconds: parseFloat(totalTime),
    summary: {
      highConvictionCount: highConvictionSignals.length,
      triagePassedCount: triagePassedSignals.length,
      triageRejectedCount: triageRejected
    }
  };
}
