'use client';
import { useState, useRef } from 'react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
  onSend: (text: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  userId?: string;
  onVoiceSend?: (audioUrl: string) => void;
}

export default function ChatInput({ onSend, onTypingChange }: ChatInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  // iOS Safari에서 pointer/touch 이벤트가 동시에 발화하는 경우가 있어
  // start/stop이 각각 정확히 1회만 실행되도록 막는 가드.
  // useState(isRecording)은 비동기라 연속 이벤트 사이에 최신값이 아닐 수 있으므로
  // 즉시 읽고 쓸 수 있는 ref로 별도 관리한다.
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

  const startRecording = async () => {
    // 가드: 이미 녹음 중이면 (pointerdown + touchstart 등 중복 발화) 무시
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
      };
      rec.onerror = (e: any) => {
        console.warn('[STT] 오류:', e.error);
        // 인식 자체가 실패로 끝난 경우 가드/상태를 반드시 풀어준다
        // (iOS에서 stop 이벤트가 씹혀 recording 상태가 영구히 멈추는 것 방지)
        recordingGuardRef.current = false;
        setIsRecording(false);
      };
      rec.start();
      recognitionRef.current = rec;
      setIsRecording(true);
    } catch (e) {
      console.warn('음성 인식 실패:', e);
      recordingGuardRef.current = false;
    }
  };

  const stopRecording = () => {
    // 가드: 이미 정지됐거나 애초에 시작되지 않았으면 중복 실행 방지
    if (!recordingGuardRef.current) return;
    recordingGuardRef.current = false;

    setIsRecording(false);
    try { recognitionRef.current?.stop(); } catch (e) {}
    setTimeout(() => {
      if (transcriptRef.current) {
        onSend(transcriptRef.current);
        transcriptRef.current = '';
      }
    }, 500);
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
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={stopRecording}
        onPointerCancel={stopRecording}
        onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); stopRecording(); }}
        onTouchCancel={(e) => { e.preventDefault(); e.stopPropagation(); stopRecording(); }}
        onContextMenu={(e) => e.preventDefault()}
        className={`${styles.voiceBtn} ${isRecording ? styles.recording : ''}`}
        type="button"
      >
        {isRecording ? '🔴' : '🎤'}
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