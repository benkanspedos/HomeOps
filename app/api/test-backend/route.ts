import { NextRequest, NextResponse } from 'next/server';
import { testBackendConnection } from '@/lib/api/client';

export async function GET(request: NextRequest) {
  try {
    const backendResult = await testBackendConnection();
    
    if (backendResult.connected) {
      return NextResponse.json({
        frontend: 'ok',
        backend: backendResult.data,
        timestamp: new Date().toISOString()
      }, { status: 200 });
    } else {
      return NextResponse.json({
        frontend: 'ok',
        error: backendResult.error,
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }
  } catch (error: any) {
    return NextResponse.json({
      frontend: 'ok',
      error: error.message || 'Backend connection failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}