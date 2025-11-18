/**
 * Save Trading Signals - Windmill Database Persistence
 *
 * PURPOSE: Save final trading signals to database
 *
 * ROUTING:
 * - GO signals → trading_signals table (ready for execution)
 * - STANDBY signals → standby_trades table (Pouncer monitoring)
 * - NO-GO signals → Logged only (not saved)
 *
 * INPUT: Array of trading signals (from Reasoner Agent)
 * OUTPUT: Database insert confirmation
 * RUNTIME: ~1 minute for batch insert
 */

import * as wmill from 'windmill-client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

async function getSupabaseClient(): Promise<SupabaseClient> {
  const supabaseUrl = await wmill.getResource('u/benkanspedos/SUPABASE_URL');
  const supabaseKey = await wmill.getResource('u/benkanspedos/SUPABASE_SERVICE_KEY');

  return createClient(supabaseUrl, supabaseKey);
}

export async function main(tradingSignals: TradingSignal[]): Promise<{
  success: boolean;
  goSignalsSaved: number;
  standbySignalsSaved: number;
  errors: string[];
}> {
  console.log('💾 Saving trading signals to database...\n');

  const supabase = await getSupabaseClient();

  let goSignalsSaved = 0;
  let standbySignalsSaved = 0;
  const errors: string[] = [];

  for (const signal of tradingSignals) {
    try {
      if (signal.decision === 'GO') {
        // Save to trading_signals table
        const { error } = await supabase
          .from('trading_signals')
          .insert({
            symbol: signal.symbol,
            strategy: 'ATOM_V12',
            direction: 'long',
            entry_price: signal.entry_price,
            stop_loss: signal.stop_loss,
            take_profit: signal.take_profit,
            confidence: signal.ai_confidence,
            status: 'APPROVED',
            multi_strategy: {
              atom_score: signal.atom_score,
              ai_confidence: signal.ai_confidence,
              v12_priority: signal.priority_score,
              reasoning: signal.reasoning
            }
          });

        if (error) {
          errors.push(`Error saving GO signal ${signal.symbol}: ${error.message}`);
        } else {
          console.log(`   ✅ Saved GO signal: ${signal.symbol}`);
          goSignalsSaved++;
        }

      } else if (signal.decision === 'STANDBY') {
        // Save to standby_trades table
        const { error } = await supabase
          .from('standby_trades')
          .insert({
            symbol: signal.symbol,
            pattern: signal.standby_payload?.pattern || 'Breakout_Retest',
            confirmation_signal: signal.standby_payload?.confirmation_signal || 'hold_above_level_5min',
            confirmation_level: signal.standby_payload?.confirmation_level || 0,
            pre_calculated_stop_loss: signal.standby_payload?.pre_calculated_stop_loss || 0,
            status: 'ACTIVE',
            atom_score: signal.atom_score,
            ai_confidence: signal.ai_confidence,
            v12_priority_score: signal.priority_score,
            reasoning: signal.reasoning
          });

        if (error) {
          errors.push(`Error saving STANDBY signal ${signal.symbol}: ${error.message}`);
        } else {
          console.log(`   ✅ Saved STANDBY signal: ${signal.symbol}`);
          standbySignalsSaved++;
        }
      }

    } catch (error: any) {
      errors.push(`Error processing ${signal.symbol}: ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 DATABASE SAVE SUMMARY');
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`   GO signals saved: ${goSignalsSaved}`);
  console.log(`   STANDBY signals saved: ${standbySignalsSaved}`);
  console.log(`   Errors: ${errors.length}\n`);

  if (errors.length > 0) {
    console.error('Errors encountered:');
    errors.forEach(err => console.error(`   - ${err}`));
  }

  return {
    success: errors.length === 0,
    goSignalsSaved,
    standbySignalsSaved,
    errors
  };
}
