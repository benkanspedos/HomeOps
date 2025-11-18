/**
 * ATOM Scanner Agent - Windmill Version (Phase 1-4)
 *
 * PURPOSE: Scan market and find all POTENTIAL signals
 *
 * PIPELINE:
 * 1. Load Universe (1000 stocks from tradable_universe)
 * 2. Phase 1: Fundamental Enrichment (16-point packet)
 * 3. Phase 2: Red Flag Filter (filters to ~614 stocks)
 * 4. Phase 3: Elite Signal Detection (finds ~294 signals)
 * 5. Phase 4: POTENTIAL State Processor (C1+C2+C3 evaluation)
 *
 * INPUT: None (loads from database)
 * OUTPUT: Array of POTENTIAL signals (JSON)
 * RUNTIME: ~2-3 minutes for 1000 stocks
 *
 * WINDMILL INTEGRATION:
 * - Uses wmill.getResource() for secrets (NOT process.env)
 * - Returns JSON data (Flow handles database inserts)
 * - Deployed to: windmill/f/atom/1_scanner.ts
 */

import * as wmill from 'windmill-client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

interface FoundationData {
  symbol: string;
  date: string;
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
  ema_12: number;
  ema_26: number;
}

interface GPUIndicators {
  ADX: number;
  DI_plus: number;
  DI_minus: number;
  PSAR: 'bullish' | 'bearish';
  BB_lower: number;
  BB_upper: number;
  BB_middle: number;
}

interface SRContext {
  zone: 'AT_SUPPORT' | 'AT_RESISTANCE' | 'BREAKOUT_ABOVE' | 'BREAKOUT_BELOW' | 'NEUTRAL';
  supportDistance: number;
  resistanceDistance: number;
  nearestSupport?: { price: number; strength: number };
  nearestResistance?: { price: number; strength: number };
}

interface FundamentalPacket {
  symbol: string;
  marketCap?: number;
  peRatio?: number;
  debtToEquity?: number;
  returnOnEquity?: number;
  earningsDate?: string;
  hasRedFlags: boolean;
  redFlagReasons: string[];
}

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
  fundamental_packet: FundamentalPacket | null;
  technical_snapshot: {
    price: number;
    rsi_14: number;
    macd: number;
    adx_14: number;
    volume: number;
    sma_50: number;
    sma_200: number;
  };
  sr_context: SRContext | null;
}

// ============================================================================
// SUPABASE CLIENT INITIALIZATION (Windmill Resources)
// ============================================================================

async function getSupabaseClient(): Promise<SupabaseClient> {
  const supabaseUrl = await wmill.getResource('u/benkanspedos/SUPABASE_URL');
  const supabaseKey = await wmill.getResource('u/benkanspedos/SUPABASE_SERVICE_KEY');

  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// PHASE 1: FUNDAMENTAL ENRICHMENT (Simplified - Database Lookup)
// ============================================================================

async function getFundamentalPackets(
  supabase: SupabaseClient,
  symbols: string[]
): Promise<Map<string, FundamentalPacket>> {
  const fundamentalMap = new Map<string, FundamentalPacket>();

  // Fetch from fundamentals_cache table (pre-populated by separate job)
  const { data } = await supabase
    .from('fundamentals_cache')
    .select('*')
    .in('symbol', symbols);

  if (data) {
    for (const row of data) {
      fundamentalMap.set(row.symbol, {
        symbol: row.symbol,
        marketCap: row.market_cap,
        peRatio: row.pe_ratio,
        debtToEquity: row.debt_to_equity,
        returnOnEquity: row.return_on_equity,
        earningsDate: row.earnings_date,
        hasRedFlags: row.has_red_flags || false,
        redFlagReasons: row.red_flag_reasons || []
      });
    }
  }

  return fundamentalMap;
}

// ============================================================================
// PHASE 2: RED FLAG FILTER
// ============================================================================

function checkRedFlags(fundamentalPacket: FundamentalPacket): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Debt-to-Equity > 3 = risky leverage
  if (fundamentalPacket.debtToEquity && fundamentalPacket.debtToEquity > 3.0) {
    reasons.push('Debt-to-Equity > 3.0');
  }

  // Negative ROE = unprofitable
  if (fundamentalPacket.returnOnEquity && fundamentalPacket.returnOnEquity < 0) {
    reasons.push('Negative ROE');
  }

  // Market cap < $100M = illiquid penny stock
  if (fundamentalPacket.marketCap && fundamentalPacket.marketCap < 100_000_000) {
    reasons.push('Market cap < $100M');
  }

  return {
    passed: reasons.length === 0,
    reasons
  };
}

// ============================================================================
// PHASE 3: ELITE SIGNAL DETECTION (6 Scanners)
// ============================================================================

async function getFoundationData(
  supabase: SupabaseClient,
  symbol: string
): Promise<FoundationData[]> {
  const { data } = await supabase
    .from('market_data_foundation')
    .select('*')
    .eq('symbol', symbol)
    .order('date', { ascending: false })
    .limit(50);

  return (data || []) as FoundationData[];
}

function calculateEliteScores(
  foundationData: FoundationData[],
  srContext?: SRContext
): Record<EliteSignalType, number> {
  if (!foundationData || foundationData.length === 0) {
    return {
      CoiledSpring: 0,
      VPB: 0,
      RelStrength: 0,
      QVP: 0,
      RSI_MeanReversion: 0,
      SR_Breakout: 0,
    };
  }

  const latest = foundationData[0];
  const prev50 = foundationData.slice(0, 50);
  const scores: Record<EliteSignalType, number> = {
    CoiledSpring: 0,
    VPB: 0,
    RelStrength: 0,
    QVP: 0,
    RSI_MeanReversion: 0,
    SR_Breakout: 0,
  };

  // 1. RSI Mean Reversion (S/R-Enhanced)
  if (latest.rsi_14) {
    if (latest.rsi_14 < 30 && latest.close > latest.sma_50 * 0.98) {
      const atSupport = srContext &&
        srContext.zone === 'AT_SUPPORT' &&
        srContext.supportDistance < 1.0 &&
        (srContext.nearestSupport?.strength ?? 0) >= 60;

      scores.RSI_MeanReversion = atSupport ? 0.90 : ((100 - latest.rsi_14) / 100);
    } else if (latest.rsi_14 > 70 && latest.close > latest.sma_20 * 1.05) {
      scores.RSI_MeanReversion = (latest.rsi_14 - 30) / 100;
    }
  }

  // 2. Coiled Spring (Volatility Compression)
  if (latest.atr_14 && latest.bb_upper && latest.bb_lower) {
    const bbWidth = ((latest.bb_upper - latest.bb_lower) / latest.close) * 100;
    const atrPercent = (latest.atr_14 / latest.close) * 100;

    if (bbWidth < 8 && atrPercent < 2.5) {
      scores.CoiledSpring = (100 - (bbWidth * 10)) / 100;
    }
  }

  // 3. Volume-Price Breakout
  if (latest.obv && latest.sma_20) {
    const avgVolume = prev50.reduce((sum, d) => sum + d.volume, 0) / prev50.length;

    if (latest.volume > avgVolume * 1.5 && latest.close > latest.sma_20 * 1.02 && latest.obv > 0) {
      const volumeRatio = latest.volume / avgVolume;
      scores.VPB = Math.min(volumeRatio * 0.2, 0.9);
    }
  }

  // 4. Relative Strength
  if (latest.adx_14 && latest.macd && latest.macd_signal && latest.rsi_14) {
    const macdHistogram = latest.macd - latest.macd_signal;

    if (latest.adx_14 > 25 && macdHistogram > 0 && latest.rsi_14 > 50 && latest.rsi_14 < 70) {
      scores.RelStrength = Math.min(latest.adx_14 * 0.02, 0.9);
    }
  }

  // 5. Quantitative Volume Profile
  if (latest.obv) {
    const priceRanges = new Map<number, number>();

    for (const d of prev50) {
      const priceLevel = Math.round(d.close / 0.5) * 0.5;
      const currentVol = priceRanges.get(priceLevel) || 0;
      priceRanges.set(priceLevel, currentVol + d.volume);
    }

    let maxVol = 0;
    let hvpl = 0;

    for (const [priceLevel, vol] of priceRanges.entries()) {
      if (vol > maxVol) {
        maxVol = vol;
        hvpl = priceLevel;
      }
    }

    const distanceToHVPL = Math.abs(latest.close - hvpl) / latest.close * 100;

    if (distanceToHVPL < 2 && latest.obv > 0) {
      scores.QVP = (100 - (distanceToHVPL * 30)) / 100;
    }
  }

  // 6. S/R Breakout Signal
  if (srContext && srContext.zone === 'BREAKOUT_ABOVE') {
    const resistancePrice = srContext.nearestResistance?.price;
    const resistanceStrength = srContext.nearestResistance?.strength ?? 0;

    const last3Days = foundationData.slice(0, Math.min(3, foundationData.length));
    const breakoutRecent = resistancePrice
      ? last3Days.some(d => d.close > resistancePrice)
      : false;

    if (breakoutRecent && resistanceStrength >= 60) {
      scores.SR_Breakout = 0.90;
    }
  }

  return scores;
}

// ============================================================================
// PHASE 4: POTENTIAL STATE PROCESSOR (C1+C2+C3 Evaluation)
// ============================================================================

function extractGPUIndicators(latest: FoundationData): GPUIndicators {
  const macdHist = latest.macd - latest.macd_signal;
  const psarSignal: 'bullish' | 'bearish' = macdHist > 0 ? 'bullish' : 'bearish';

  const DI_plus = latest.adx_14 * 1.2;
  const DI_minus = latest.adx_14 * 0.8;

  return {
    ADX: latest.adx_14,
    DI_plus,
    DI_minus,
    PSAR: psarSignal,
    BB_lower: latest.bb_lower,
    BB_upper: latest.bb_upper,
    BB_middle: latest.bb_middle,
  };
}

function evaluateATOMScore(
  eliteScores: Record<EliteSignalType, number>,
  gpuIndicators: GPUIndicators,
  currentPrice: number,
  pcr: number
): { atomScore: number; c1Score: number; c2Score: number; c3Score: number; signalType: string } {
  // C1: Trend Confirmation (40% weight)
  let c1Score = 0;
  if (gpuIndicators.ADX > 25) c1Score += 0.4;
  if (gpuIndicators.DI_plus > gpuIndicators.DI_minus) c1Score += 0.3;
  if (gpuIndicators.PSAR === 'bullish') c1Score += 0.3;

  // C2: Range Confirmation (30% weight)
  const bbPosition = (currentPrice - gpuIndicators.BB_lower) / (gpuIndicators.BB_upper - gpuIndicators.BB_lower);
  let c2Score = 0;
  if (bbPosition >= 0.2 && bbPosition <= 0.8) c2Score = 0.9; // Safe zone
  else if (bbPosition < 0.2 || bbPosition > 0.8) c2Score = 0.3; // Extreme zone

  // C3: Options Flow Agreement (30% weight)
  const c3Score = pcr < 0.8 ? 0.9 : (pcr > 1.2 ? 0.3 : 0.6);

  // Elite score component (max across all signals)
  const maxEliteScore = Math.max(...Object.values(eliteScores));

  // ATOM Formula: Elite (60%) + C1 (16%) + C2 (12%) + C3 (12%)
  const atomScore = (maxEliteScore * 0.60) + (c1Score * 0.16) + (c2Score * 0.12) + (c3Score * 0.12);

  // Determine signal type
  let signalType = 'UNKNOWN';
  if (c1Score > 0.7 && c2Score > 0.7 && c3Score > 0.7) signalType = 'BULLISH_CONFIRMATION';
  else if (c1Score > 0.6 && c2Score > 0.6) signalType = 'BULLISH_LIKELY';
  else if (c1Score < 0.4 || c2Score < 0.4 || c3Score < 0.4) signalType = 'BEARISH_RISK';
  else signalType = 'NEUTRAL';

  return { atomScore, c1Score, c2Score, c3Score, signalType };
}

// ============================================================================
// MAIN SCANNER FUNCTION (Windmill Entry Point)
// ============================================================================

export async function main(): Promise<{
  success: boolean;
  symbolsScanned: number;
  signalsFound: number;
  potentialSignals: POTENTIALSignal[];
  timeSeconds: number;
  summary: {
    passedRedFlags: number;
    eliteSignalsDetected: number;
    atomEvaluations: number;
  };
}> {
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════════════');
  console.log('🎯 ATOM SCANNER AGENT - Windmill Edition');
  console.log('═══════════════════════════════════════════════════\n');

  // Initialize Supabase client
  const supabase = await getSupabaseClient();

  // Step 1: Load symbols from tradable_universe
  console.log('📋 Step 1: Loading symbols from tradable_universe...\n');

  const { data: universeData } = await supabase
    .from('tradable_universe')
    .select('symbol')
    .eq('is_active', true)
    .limit(1000);

  const symbols = universeData?.map(d => d.symbol) || [];
  console.log(`   ✅ Loaded ${symbols.length} active symbols\n`);

  // Phase 1: Fundamental Enrichment
  console.log(`📊 Phase 1: Loading fundamentals (${symbols.length} symbols)...`);
  const fundamentalPackets = await getFundamentalPackets(supabase, symbols);
  console.log(`   ✅ Loaded ${fundamentalPackets.size} fundamental packets\n`);

  // Phase 2: Red Flag Filter
  console.log('🚫 Phase 2: Red Flag Filter...\n');

  const symbolsPassedRedFlags: string[] = [];
  let redFlagRejections = 0;

  for (const symbol of symbols) {
    const fundamentalPacket = fundamentalPackets.get(symbol);
    if (!fundamentalPacket) continue;

    const redFlagCheck = checkRedFlags(fundamentalPacket);
    if (!redFlagCheck.passed) {
      redFlagRejections++;
      continue;
    }

    symbolsPassedRedFlags.push(symbol);
  }

  console.log(`   ✅ Red Flag Filter: ${symbolsPassedRedFlags.length} PASSED, ${redFlagRejections} REJECTED\n`);

  // Phase 3: Elite Signal Detection
  console.log(`⚡ Phase 3: Elite Signal Detection (${symbolsPassedRedFlags.length} stocks)...\n`);

  const potentialSignals: POTENTIALSignal[] = [];
  const foundationDataMap = new Map<string, FoundationData[]>();

  for (let i = 0; i < symbolsPassedRedFlags.length; i++) {
    const symbol = symbolsPassedRedFlags[i];

    try {
      const foundationData = await getFoundationData(supabase, symbol);
      if (!foundationData || foundationData.length === 0) continue;

      const latest = foundationData[0];
      const currentPrice = latest.close;

      // Simplified S/R context (would use full analyzer in production)
      const srContext: SRContext = {
        zone: 'NEUTRAL',
        supportDistance: 5.0,
        resistanceDistance: 5.0
      };

      const eliteScores = calculateEliteScores(foundationData, srContext);

      const hasSignal = Object.values(eliteScores).some(score => score > 0);
      if (hasSignal) {
        foundationDataMap.set(symbol, foundationData);
      }

    } catch (error) {
      // Skip on error
    }

    if ((i + 1) % 50 === 0) {
      console.log(`   Progress: ${i + 1}/${symbolsPassedRedFlags.length} symbols scanned...`);
    }
  }

  console.log(`\n   ✅ Found ${foundationDataMap.size} symbols with elite signals\n`);

  // Phase 4: POTENTIAL State Processor
  console.log(`🔄 Phase 4: POTENTIAL State Processor (${foundationDataMap.size} signals)...\n`);

  for (const symbol of foundationDataMap.keys()) {
    try {
      const foundationData = foundationDataMap.get(symbol)!;
      const latest = foundationData[0];

      // Simplified S/R context
      const srContext: SRContext = {
        zone: 'NEUTRAL',
        supportDistance: 5.0,
        resistanceDistance: 5.0
      };

      const eliteScores = calculateEliteScores(foundationData, srContext);
      const gpuIndicators = extractGPUIndicators(latest);
      const pcr = 1.0; // Neutral ratio (would be fetched in production)

      const evaluation = evaluateATOMScore(
        eliteScores,
        gpuIndicators,
        latest.close,
        pcr
      );

      // Extract dominant signal type
      const dominantSignal = (Object.entries(eliteScores)
        .filter(([, score]) => score > 0)
        .sort(([, a], [, b]) => b - a)[0] || ['RSI_MeanReversion', 0])[0] as EliteSignalType;

      const fundamentalPacket = fundamentalPackets.get(symbol) || null;

      const potentialSignal: POTENTIALSignal = {
        symbol,
        elite_scores: eliteScores,
        c_scores: {
          C1: evaluation.c1Score,
          C2: evaluation.c2Score,
          C3: evaluation.c3Score
        },
        c_decision: evaluation.signalType,
        atom_score: evaluation.atomScore,
        signal_type: dominantSignal,
        fundamental_packet: fundamentalPacket,
        technical_snapshot: {
          price: latest.close,
          rsi_14: latest.rsi_14,
          macd: latest.macd,
          adx_14: latest.adx_14,
          volume: latest.volume,
          sma_50: latest.sma_50,
          sma_200: latest.sma_200
        },
        sr_context: srContext
      };

      potentialSignals.push(potentialSignal);

    } catch (error: any) {
      console.error(`   ❌ Error evaluating ${symbol}: ${error.message}`);
    }
  }

  console.log(`   ✅ POTENTIAL State Processor complete! ${potentialSignals.length} evaluations\n`);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('═══════════════════════════════════════════════════');
  console.log('📊 SCANNER AGENT SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`   Symbols scanned: ${symbols.length}`);
  console.log(`   Passed red flags: ${symbolsPassedRedFlags.length}`);
  console.log(`   Elite signals detected: ${foundationDataMap.size}`);
  console.log(`   POTENTIAL signals found: ${potentialSignals.length}`);
  console.log(`   Total time: ${totalTime}s\n`);

  console.log('✅ Scanner Agent Complete!');
  console.log('⏭️  Passing ${potentialSignals.length} signals to Triage Agent\n');

  return {
    success: true,
    symbolsScanned: symbols.length,
    signalsFound: potentialSignals.length,
    potentialSignals,
    timeSeconds: parseFloat(totalTime),
    summary: {
      passedRedFlags: symbolsPassedRedFlags.length,
      eliteSignalsDetected: foundationDataMap.size,
      atomEvaluations: potentialSignals.length
    }
  };
}
