'use client';
import { useState, useRef } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  userId?: string;
  onVoiceSend?: (audioUrl: string) => void;
}

const SILENCE_TIMEOUT_MS = 5000;

export default function ChatInput({ onSend, onTypingChange }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // press-and-hold → tap-to-toggle 전환에 따른 가드.
  // 탭이 아주 짧은 간격으로 두 번 들어오는 것(더블탭 등)을 대비해
  // start/stop이 각각 정확히 1회만 실행되도록 막는다.
  const recordingGuardRef = useRef(false);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
    if (onTypingChange) onTypingChange(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (onTypingChange) {
      onTypingChange(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => onTypingChange(false), 1500);
    }
  };

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // 마지막 onresult로부터 SILENCE_TIMEOUT_MS 동안 새 결과가 없으면 자동 종료
  const resetSilenceTimer = () => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      stopRecording();
    }, SILENCE_TIMEOUT_MS);
  };

  const startRecording = async () => {
    if (recordingGuardRef.current) return;
    recordingGuardRef.current = true;

    try {
      transcriptRef.current = '';
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
        recordingGuardRef.current = false;
        return;
      }
      const rec = new SpeechRecognition();
      rec.lang = 'ko-KR';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e: any) => {
        let final = '';
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
        }
        if (final) transcriptRef.current = final;
        // 말이 계속 들어오는 동안은 무음 타이머를 계속 뒤로 미룸
        resetSilenceTimer();
      };
      rec.onerror = (e: any) => {
        console.warn('[STT] 오류:', e.error);
        // iOS 등에서 stop 이벤트 없이 인식이 끊기는 경우
        // 가드/상태가 영구히 "녹음 중"으로 남지 않도록 강제 해제
        clearSilenceTimer();
        recordingGuardRef.current = false;
        setIsRecording(false);
      };
      rec.start();
      recognitionRef.current = rec;
      setIsRecording(true);
      // 녹음 시작 직후에도 무음 타이머를 걸어둠 (탭만 하고 아예 말을 안 하는 경우 대비)
      resetSilenceTimer();
    } catch (e) {
      console.warn('음성 인식 실패:', e);
      recordingGuardRef.current = false;
    }
  };

  const stopRecording = () => {
    if (!recordingGuardRef.current) return;
    recordingGuardRef.current = false;

    clearSilenceTimer();
    setIsRecording(false);
    try { recognitionRef.current?.stop(); } catch (e) {}
    setTimeout(() => {
      if (transcriptRef.current) {
        onSend(transcriptRef.current);
        transcriptRef.current = '';
      }
    }, 500);
  };

  // tap-to-toggle: 녹음 중이 아니면 시작, 녹음 중이면 종료
  const handleMicTap = () => {
    if (recordingGuardRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className={styles.wrapper}>
      <textarea
        ref={inputRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="메시지를 입력하세요..."
        className={styles.textarea}
        rows={1}
      />
      <button
        onClick={handleMicTap}
        className={`${styles.voiceBtn} ${isRecording ? styles.recording : ''}`}
        type="button"
        aria-label={isRecording ? '녹음 종료' : '음성 입력 시작'}
      >
        {isRecording ? '🔴' : '🎙️'}
      </button>
      <button
        onClick={handleSend}
        className={styles.button}
        disabled={!text.trim()}
        aria-label="전송"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </button>
    </div>
  );
}