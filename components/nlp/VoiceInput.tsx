'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2, Volume2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { VoiceProcessingStatus } from '@/hooks/useNLPWebSocket';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceInputProps {
  onVoiceData: (audioData: ArrayBuffer) => void;
  voiceStatus?: VoiceProcessingStatus | null;
  isConnected: boolean;
  isProcessing?: boolean;
}

export function VoiceInput({
  onVoiceData,
  voiceStatus,
  isConnected,
  isProcessing = false
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check browser support
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
      setError('Your browser does not support audio recording');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  // Monitor audio levels
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    setAudioLevel(Math.min(100, (average / 128) * 100));

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setError(null);
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000 // Optimal for speech recognition
        } 
      });
      
      streamRef.current = stream;

      // Set up audio context for visualization
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Set up media recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/ogg';
        
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const arrayBuffer = await audioBlob.arrayBuffer();
        onVoiceData(arrayBuffer);
        
        // Cleanup
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      // Start recording
      mediaRecorderRef.current.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);

      // Start monitoring audio level
      monitorAudioLevel();

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) { // Max 60 seconds
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error('Failed to start recording:', err);
      setError(err.message || 'Failed to access microphone');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setAudioLevel(0);
    setRecordingTime(0);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusMessage = () => {
    if (!voiceStatus) return null;
    
    switch (voiceStatus.status) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return voiceStatus.message || 'Processing audio...';
      case 'transcribing':
        return 'Converting speech to text...';
      case 'executing':
        return voiceStatus.message || 'Executing command...';
      case 'completed':
        return 'Completed successfully';
      case 'error':
        return voiceStatus.message || 'An error occurred';
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    if (!voiceStatus) return 'bg-gray-500';
    
    switch (voiceStatus.status) {
      case 'listening':
        return 'bg-blue-500';
      case 'processing':
      case 'transcribing':
        return 'bg-yellow-500';
      case 'executing':
        return 'bg-orange-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (!isSupported) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Voice input is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Recording Controls */}
        <div className="flex flex-col items-center space-y-4">
          <motion.div
            animate={isRecording ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1, repeat: isRecording ? Infinity : 0 }}
          >
            <Button
              onClick={toggleRecording}
              disabled={!isConnected || isProcessing}
              size="lg"
              className={`rounded-full h-20 w-20 ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {isRecording ? (
                <MicOff className="h-8 w-8 text-white" />
              ) : (
                <Mic className="h-8 w-8 text-white" />
              )}
            </Button>
          </motion.div>

          {/* Recording Status */}
          <div className="text-center">
            {isRecording ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-500">Recording...</p>
                <p className="text-2xl font-mono">{formatTime(recordingTime)}</p>
                <p className="text-xs text-gray-500">Max: 60 seconds</p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                {isConnected ? 'Click to start recording' : 'Connecting...'}
              </p>
            )}
          </div>
        </div>

        {/* Audio Level Visualization */}
        {isRecording && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-gray-500" />
              <div className="flex-1">
                <Progress value={audioLevel} className="h-2" />
              </div>
            </div>
            <p className="text-xs text-center text-gray-500">Audio Level</p>
          </div>
        )}

        {/* Processing Status */}
        {voiceStatus && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-center gap-2">
                <div className={`h-2 w-2 rounded-full ${getStatusColor()} animate-pulse`} />
                <span className="text-sm font-medium">{getStatusMessage()}</span>
              </div>
              
              {voiceStatus.progress !== undefined && (
                <Progress value={voiceStatus.progress} className="h-1" />
              )}
              
              {voiceStatus.status === 'error' && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{voiceStatus.message}</AlertDescription>
                </Alert>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Error Display */}
        {error && !voiceStatus && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Voice Commands:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• "Show system health" - Display system status</li>
            <li>• "List containers" - Show all Docker containers</li>
            <li>• "Restart [container]" - Restart a specific container</li>
            <li>• "Check DNS status" - View DNS performance</li>
            <li>• "Show recent alerts" - Display system alerts</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

export default VoiceInput;