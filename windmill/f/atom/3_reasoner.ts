/**
 * ATOM Reasoner Agent - Windmill Version (Phase 9-10)
 *
 * PURPOSE: Perform final deep AI analysis and decide GO / NO-GO / STANDBY
 *
 * PIPELINE:
 * 1. Receive PRIMED candidates from Triage (as input parameter)
 * 2. Phase 9: AI Sequential Reasoner (5-step analysis, 8 parallel workers)
 * 3. Phase 10: V12 Priority Scoring + Decision Routing
 * 4. Return final trading decisions (Flow handles database inserts)
 *
 * DECISION ROUTING:
 * - GO (Priority ≥65) → Ready for immediate execution
 * - STANDBY → Awaiting confirmation trigger (Pouncer monitoring)
 * - NO-GO → Rejected (insufficient priority or risk)
 *
 * INPUT: Array of PRIMED candidates (from Triage)
 * OUTPUT: Array of trading signals with GO/STANDBY/NO-GO decisions (JSON)
 * RUNTIME: ~8-10 minutes (parallel processing, 8 workers)
 *
 * WINDMILL INTEGRATION:
 * - Receives input from Triage via Flow parameter
 * - Uses wmill.getResource() for secrets (NOT process.env)
 * - Uses Qwen 2.5 14B Finance for deep AI analysis
 * - Returns JSON data (Flow handles database inserts and execution)
 * - Deployed to: windmill/f/atom/3_reasoner.ts
 */

import * as wmill from 'windmill-client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Ollama } from 'ollama';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PRIMEDCandidate {
  symbol: string;
  atom_score: number;
  triage_confidence: number;
  news_packet: {
    general_hazard_report: string;
    insider_sales_report: string;
    fraud_investigation_report: string;
  };
  technical_data: {
    price: number;
    rsi_14: number;
    macd: number;
    adx_14: number;
    volume: number;
    sma_50: number;
    sma_200: number;
  };
  fundamental_data: any;
}

interface SequentialReasonerInput {
  symbol: string;
  atomScore: number;
  signalType: string;
  technicalData: {
    price: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    rsi_14: number;
    macd: number;
    macd_signal: number;
    adx_14: number;
    atr_14: number;
    bb_upper: number;
    bb_middle: number;
    bb_lower: number;
    obv: number;
    sma_20: number;
    sma_50: number;
    sma_200: number;
    avg_volume_20: number;
  };
  fundamental_data?: {
    debt_to_equity?: number;
    current_ratio?: number;
    interest_coverage?: number;
    net_income?: number;
    operating_cash_flow?: number;
    revenue_growth?: number;
    gross_profit_margin?: number;
    return_on_equity?: number;
    earnings_date?: string;
    insider_selling?: boolean;
    analyst_rating?: string;
    news_headlines?: string[];
  };
  news_packet: {
    general_hazard_report: string;
    insider_sales_report: string;
    fraud_investigation_report: string;
  };
}

interface SequentialDecision {
  decision: 'GO' | 'NO-GO' | 'STANDBY';
  confidence: number;
  reasoning: string;
  risk_level: number;
  standby_payload?: {
    pattern: string;
    confirmation_signal: string;
    confirmation_level: number;
    pre_calculated_stop_loss: number;
  };
}

interface TradingSignal {
  symbol: string;
  decision: 'GO' | 'NO-GO' | 'STANDBY';
  atom_score: number;
  ai_confidence: number;
  priority_score: number;
  reasoning: string;
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  risk_reward_ratio?: number;
  standby_payload?: {
    pattern: string;
    confirmation_signal: string;
    confirmation_level: number;
    pre_calculated_stop_loss: number;
  };
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
  return new Ollama({ host: 'http://localhost:11434' });
}

// ============================================================================
// PHASE 9: AI SEQUENTIAL REASONER (5-Step Deep Analysis)
// ============================================================================

async function evaluateSignal(input: SequentialReasonerInput): Promise<SequentialDecision> {
  const ollama = await getOllamaClient();

  console.log(`\n🧠 AI Sequential Reasoner: ${input.symbol} (ATOM: ${(input.atomScore * 100).toFixed(1)}%)`);

  // Step 1: Technical Confluence Assessment
  console.log(`   Step 1: Technical Confluence...`);
  const step1Prompt = `You are a technical analysis expert. Assess technical confluence for ${input.symbol}.

Technical Data:
- Price: $${input.technicalData.close.toFixed(2)}
- RSI(14): ${input.technicalData.rsi_14.toFixed(1)} (oversold <30, overbought >70)
- MACD: ${input.technicalData.macd.toFixed(2)} / Signal: ${input.technicalData.macd_signal.toFixed(2)}
- ADX(14): ${input.technicalData.adx_14.toFixed(1)} (trending >25)
- ATR(14): $${input.technicalData.atr_14.toFixed(2)}
- Price vs SMA50: ${((input.technicalData.close / input.technicalData.sma_50 - 1) * 100).toFixed(1)}%
- Price vs SMA200: ${((input.technicalData.close / input.technicalData.sma_200 - 1) * 100).toFixed(1)}%

Question: Is there strong technical confluence suggesting a high-probability move?
Output: STRONG / MODERATE / WEAK
Reasoning: One sentence`;

  const step1Response = await ollama.generate({
    model: 'qwen2.5:14b-instruct',
    prompt: step1Prompt,
    stream: false,
    options: { temperature: 0.3 }
  });

  // Step 2: Fundamental Context Check
  console.log(`   Step 2: Fundamental Context...`);
  const step2Prompt = `You are a fundamental analyst. Assess business health for ${input.symbol}.

Fundamental Data:
${input.fundamental_data ? `
- Debt/Equity: ${input.fundamental_data.debt_to_equity?.toFixed(2) || 'N/A'}
- ROE: ${input.fundamental_data.return_on_equity?.toFixed(1) || 'N/A'}%
- Revenue Growth: ${input.fundamental_data.revenue_growth?.toFixed(1) || 'N/A'}%
- Earnings Date: ${input.fundamental_data.earnings_date || 'Unknown'}
- Insider Selling: ${input.fundamental_data.insider_selling ? 'Yes' : 'No'}
` : 'No fundamental data available'}

Question: Are fundamentals supportive or concerning?
Output: SUPPORTIVE / NEUTRAL / CONCERNING
Reasoning: One sentence`;

  const step2Response = await ollama.generate({
    model: 'qwen2.5:14b-instruct',
    prompt: step2Prompt,
    stream: false,
    options: { temperature: 0.3 }
  });

  // Step 3: Risk Assessment
  console.log(`   Step 3: Risk Assessment...`);
  const step3Prompt = `You are a risk manager. Assess trade risk for ${input.symbol}.

News & Hazards:
${input.news_packet.general_hazard_report}
${input.news_packet.insider_sales_report}
${input.news_packet.fraud_investigation_report}

Technical Risk:
- ATR: $${input.technicalData.atr_14.toFixed(2)} (volatility measure)
- RSI: ${input.technicalData.rsi_14.toFixed(1)} (extreme levels = risky)

Question: What is the risk level for entering this trade?
Output: LOW / MODERATE / HIGH
Reasoning: One sentence`;

  const step3Response = await ollama.generate({
    model: 'qwen2.5:14b-instruct',
    prompt: step3Prompt,
    stream: false,
    options: { temperature: 0.3 }
  });

  // Step 4: Historical Pattern Matching
  console.log(`   Step 4: Historical Patterns...`);
  const step4Prompt = `You are a pattern recognition expert. Identify setup type for ${input.symbol}.

Signal Type: ${input.signalType}
Price Action: ${input.technicalData.close > input.technicalData.sma_50 ? 'Above' : 'Below'} 50 SMA
Trend: ADX ${input.technicalData.adx_14.toFixed(1)}

Common Setups:
- Breakout_Retest: Price broke above resistance, retesting as new support
- Momentum_Continuation: Strong uptrend with pullback to moving average
- Mean_Reversion: Oversold bounce from support
- Volatility_Expansion: Coiled spring ready to explode

Question: Which setup best matches this pattern?
Output: [Setup Name]
Confidence: [0-100%]`;

  const step4Response = await ollama.generate({
    model: 'qwen2.5:14b-instruct',
    prompt: step4Prompt,
    stream: false,
    options: { temperature: 0.3 }
  });

  // Step 5: Final Synthesis
  console.log(`   Step 5: Final Synthesis...`);
  const step5Prompt = `You are the final decision maker. Based on all analysis, make GO/NO-GO/STANDBY decision for ${input.symbol}.

Summary:
- ATOM Score: ${(input.atomScore * 100).toFixed(1)}%
- Technical Confluence: ${step1Response.response.substring(0, 200)}
- Fundamental Context: ${step2Response.response.substring(0, 200)}
- Risk Assessment: ${step3Response.response.substring(0, 200)}
- Pattern Match: ${step4Response.response.substring(0, 200)}

Decision Rules:
- GO: High conviction, low risk, immediate entry recommended
- STANDBY: Good setup but needs confirmation trigger (e.g., breakout above resistance)
- NO-GO: Insufficient confidence or excessive risk

Output format:
DECISION: [GO/NO-GO/STANDBY]
CONFIDENCE: [0-100%]
REASONING: [one sentence explaining decision]
RISK_LEVEL: [stop-loss price based on ATR]

${input.technicalData.close > input.technicalData.sma_50 ? `
If STANDBY, also provide:
PATTERN: [Breakout_Retest/Momentum_Continuation/etc]
CONFIRMATION_SIGNAL: [hold_above_level_5min/volume_surge/etc]
CONFIRMATION_LEVEL: [price level to hold above]
` : ''}`;

  const step5Response = await ollama.generate({
    model: 'qwen2.5:14b-instruct',
    prompt: step5Prompt,
    stream: false,
    options: { temperature: 0.3, num_predict: 200 }
  });

  // Parse final decision
  const output = step5Response.response;
  const decisionMatch = output.match(/DECISION:\s*(GO|NO-GO|STANDBY)/i);
  const confidenceMatch = output.match(/CONFIDENCE:\s*(\d+)/i);
  const reasoningMatch = output.match(/REASONING:\s*(.+)/i);
  const riskLevelMatch = output.match(/RISK_LEVEL:\s*\$?(\d+\.?\d*)/i);

  const decision = (decisionMatch ? decisionMatch[1].toUpperCase() : 'NO-GO') as 'GO' | 'NO-GO' | 'STANDBY';
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) / 100 : 0.50;
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'Unable to parse reasoning';
  const riskLevel = riskLevelMatch
    ? parseFloat(riskLevelMatch[1])
    : input.technicalData.close - (input.technicalData.atr_14 * 2);

  // Parse STANDBY payload if applicable
  let standbyPayload: SequentialDecision['standby_payload'] | undefined;
  if (decision === 'STANDBY') {
    const patternMatch = output.match(/PATTERN:\s*(\w+)/i);
    const confirmationSignalMatch = output.match(/CONFIRMATION_SIGNAL:\s*(\w+)/i);
    const confirmationLevelMatch = output.match(/CONFIRMATION_LEVEL:\s*\$?(\d+\.?\d*)/i);

    standbyPayload = {
      pattern: patternMatch ? patternMatch[1] : 'Breakout_Retest',
      confirmation_signal: confirmationSignalMatch ? confirmationSignalMatch[1] : 'hold_above_level_5min',
      confirmation_level: confirmationLevelMatch
        ? parseFloat(confirmationLevelMatch[1])
        : input.technicalData.close * 1.02,
      pre_calculated_stop_loss: riskLevel
    };
  }

  console.log(`   ✅ Decision: ${decision} (${(confidence * 100).toFixed(0)}% confidence)`);

  return {
    decision,
    confidence,
    reasoning,
    risk_level: riskLevel,
    standby_payload
  };
}

// ============================================================================
// PHASE 10: V12 PRIORITY SCORING
// ============================================================================

function calculateSignalPriority(params: {
  symbol: string;
  ai_confidence: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
}): { priorityScore: number; isPrimed: boolean } {
  const risk = params.entry_price - params.stop_loss;
  const reward = params.take_profit - params.entry_price;
  const rrRatio = reward / risk;

  // V12 Formula: 70% AI Confidence + 30% R:R Ratio (capped at 3.0)
  const rrComponent = Math.min(rrRatio / 3.0, 1.0) * 30;
  const aiComponent = params.ai_confidence * 70;

  const priorityScore = aiComponent + rrComponent;
  const isPrimed = priorityScore >= 65; // Threshold for execution

  return { priorityScore, isPrimed };
}

// ============================================================================
// MAIN REASONER FUNCTION (Windmill Entry Point)
// ============================================================================

export async function main(primedCandidates: PRIMEDCandidate[]): Promise<{
  success: boolean;
  primedCandidatesAnalyzed: number;
  goDecisions: number;
  standbyDecisions: number;
  noGoDecisions: number;
  tradingSignals: TradingSignal[];
  timeSeconds: number;
}> {
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════════════');
  console.log('🎯 ATOM REASONER AGENT - Windmill Edition');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`📋 Received ${primedCandidates.length} PRIMED candidates from Triage\n`);

  if (primedCandidates.length === 0) {
    console.log('   ℹ️  No PRIMED candidates for reasoning. Exiting.\n');
    return {
      success: true,
      primedCandidatesAnalyzed: 0,
      goDecisions: 0,
      standbyDecisions: 0,
      noGoDecisions: 0,
      tradingSignals: [],
      timeSeconds: 0
    };
  }

  // Initialize Supabase client
  const supabase = await getSupabaseClient();

  // Phase 9: AI Sequential Reasoner (Parallel)
  console.log(`🧠 Phase 9: AI Sequential Reasoner (Parallel batch analysis of ${primedCandidates.length} candidates)...\n`);

  const reasonerDecisions: Map<string, SequentialDecision> = new Map();

  // Prepare all inputs
  console.log('   Preparing inputs for parallel analysis...\n');
  const reasonerInputs: Array<{ candidate: PRIMEDCandidate; input: SequentialReasonerInput }> = [];

  for (const candidate of primedCandidates) {
    try {
      // Fetch foundation data for this candidate
      const { data: foundationData } = await supabase
        .from('market_data_foundation')
        .select('*')
        .eq('symbol', candidate.symbol)
        .order('date', { ascending: false })
        .limit(50);

      if (!foundationData || foundationData.length === 0) continue;

      const latest = foundationData[0];

      const reasonerInput: SequentialReasonerInput = {
        symbol: candidate.symbol,
        atomScore: candidate.atom_score,
        signalType: 'RSI_MeanReversion', // Would be extracted from candidate in production
        technicalData: {
          price: latest.close,
          open: latest.open || latest.close,
          high: latest.high || latest.close,
          low: latest.low || latest.close,
          close: latest.close,
          volume: latest.volume,
          rsi_14: latest.rsi_14,
          macd: latest.macd,
          macd_signal: latest.macd_signal,
          adx_14: latest.adx_14,
          atr_14: latest.atr_14,
          bb_upper: latest.bb_upper,
          bb_middle: latest.bb_middle,
          bb_lower: latest.bb_lower,
          obv: latest.obv,
          sma_20: latest.sma_20,
          sma_50: latest.sma_50,
          sma_200: latest.sma_200 || latest.sma_50,
          avg_volume_20: foundationData.slice(0, 20).reduce((sum: number, d: any) => sum + d.volume, 0) / Math.min(20, foundationData.length)
        },
        fundamental_data: candidate.fundamental_data,
        news_packet: candidate.news_packet
      };

      reasonerInputs.push({ candidate, input: reasonerInput });

    } catch (error: any) {
      console.error(`   ❌ Error preparing input for ${candidate.symbol}: ${error.message}`);
    }
  }

  console.log(`   ✅ Prepared ${reasonerInputs.length} inputs for analysis\n`);

  // Parallel batch processing with 8 workers
  console.log(`   🚀 Starting parallel batch processing with 8 workers...\n`);

  const CONCURRENCY_LIMIT = 8;
  const results: Array<{ status: 'fulfilled' | 'rejected'; value?: { symbol: string; decision: SequentialDecision }; reason?: { symbol: string; error: string } }> = [];
  const taskQueue = [...reasonerInputs];

  async function worker(workerId: number) {
    while (taskQueue.length > 0) {
      const job = taskQueue.shift();
      if (!job) continue;

      const { candidate, input } = job;
      console.log(`   [Worker ${workerId}] Analyzing ${input.symbol} (${taskQueue.length} remaining)...`);

      try {
        const decision = await evaluateSignal(input);
        results.push({
          status: 'fulfilled',
          value: { symbol: input.symbol, decision }
        });
      } catch (error: any) {
        results.push({
          status: 'rejected',
          reason: { symbol: input.symbol, error: error.message || 'Unknown error' }
        });
      }
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
    workers.push(worker(i + 1));
  }

  const reasonerStartTime = Date.now();
  await Promise.all(workers);
  const reasonerTime = ((Date.now() - reasonerStartTime) / 1000).toFixed(1);

  // Collect results
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const { symbol, decision } = result.value;
      reasonerDecisions.set(symbol, decision);
    }
  }

  console.log(`\n   ✅ AI Sequential Reasoner complete! Analyzed ${reasonerDecisions.size} stocks in ${reasonerTime}s\n`);

  // Phase 10: V12 Priority Scoring + Routing
  console.log('🎯 Phase 10: V12 Priority Scoring and Decision Routing...\n');

  const tradingSignals: TradingSignal[] = [];
  let goCount = 0;
  let standbyCount = 0;
  let noGoCount = 0;

  for (const candidate of primedCandidates) {
    const decision = reasonerDecisions.get(candidate.symbol);

    if (!decision) {
      noGoCount++;
      continue;
    }

    if (decision.decision === 'GO') {
      // Calculate V12 priority score
      const entry_price = candidate.technical_data.price;
      const atr = 1.0; // Would fetch from foundation data
      const stop_loss = decision.risk_level;

      const baseRR = 1.5 + ((candidate.atom_score - 0.55) / 0.20) * 1.5;
      const rrRatio = Math.max(1.5, Math.min(3.0, baseRR));
      const risk = entry_price - stop_loss;
      const take_profit = entry_price + (risk * rrRatio);

      const priorityResult = calculateSignalPriority({
        symbol: candidate.symbol,
        ai_confidence: decision.confidence,
        entry_price,
        stop_loss,
        take_profit
      });

      if (priorityResult.isPrimed) {
        tradingSignals.push({
          symbol: candidate.symbol,
          decision: 'GO',
          atom_score: candidate.atom_score,
          ai_confidence: decision.confidence,
          priority_score: priorityResult.priorityScore,
          reasoning: decision.reasoning,
          entry_price,
          stop_loss,
          take_profit,
          risk_reward_ratio: rrRatio
        });

        console.log(`   [GO] ${candidate.symbol}: Priority ${priorityResult.priorityScore.toFixed(1)}/100 ✅ PRIMED`);
        goCount++;
      } else {
        console.log(`   [REJECTED] ${candidate.symbol}: Priority ${priorityResult.priorityScore.toFixed(1)}/100 < 65`);
        noGoCount++;
      }

    } else if (decision.decision === 'STANDBY') {
      // Calculate STANDBY priority score: 70% AI + 30% ATOM
      const standbyPriority = (decision.confidence * 0.7) + (candidate.atom_score * 0.3);
      const standbyPriorityScore = Math.round(standbyPriority * 100);

      tradingSignals.push({
        symbol: candidate.symbol,
        decision: 'STANDBY',
        atom_score: candidate.atom_score,
        ai_confidence: decision.confidence,
        priority_score: standbyPriorityScore,
        reasoning: decision.reasoning,
        standby_payload: decision.standby_payload
      });

      console.log(`   [STANDBY] ${candidate.symbol}: Priority ${standbyPriorityScore}/100 (awaiting ${decision.standby_payload?.confirmation_signal})`);
      standbyCount++;

    } else {
      // NO-GO decision
      console.log(`   [NO-GO] ${candidate.symbol}: ${(decision.confidence * 100).toFixed(0)}% confidence`);
      noGoCount++;
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 REASONER AGENT SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`   PRIMED candidates received: ${primedCandidates.length}`);
  console.log(`   AI GO decisions: ${goCount}`);
  console.log(`   AI STANDBY decisions: ${standbyCount}`);
  console.log(`   AI NO-GO decisions: ${noGoCount}`);
  console.log(`   Total time: ${totalTime}s\n`);

  console.log('✅ Reasoner Agent Complete!');
  console.log('🎯 GO signals ready for execution');
  console.log('⏸️  STANDBY signals saved (Pouncer monitoring)\n');

  return {
    success: true,
    primedCandidatesAnalyzed: primedCandidates.length,
    goDecisions: goCount,
    standbyDecisions: standbyCount,
    noGoDecisions: noGoCount,
    tradingSignals,
    timeSeconds: parseFloat(totalTime)
  };
}
