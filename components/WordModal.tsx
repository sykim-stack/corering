'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './WordModal.module.css';
import { speakIfVoiceAvailable } from '@/lib/tts';

interface WordModalProps {
  data: {
    sentence: string;
    translated?: string;
    sourceLang?: string;
    emotion?: string;
    riskScore?: number;
    intent?: string;
    culturalNote?: string;
    sessionId?: string;
    wordDetail?: any;
  } | null;
  onClose: () => void;
  userId?: string;
}

const saveWord = async (payload: { user_id?: string; word: string; meaning_kr?: string; source_session_id?: string }) => {
  const res = await fetch('/api/phrase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ action: 'save-word', ...payload }),
  }).catch(() => null);
  if (!res || !res.ok) return false;
  const json = await res.json().catch(() => null);
  return json?.success === true;
};

const uploadVoice = async (blob: Blob, mimeType: string, userId: string) => {
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const fileName = `voice/${userId}/${Date.now()}.${ext}`;
  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('fileName', fileName);
  formData.append('mimeType', mimeType);
  const res = await fetch('/api/voice/upload', { method: 'POST', body: formData }).catch(() => null);
  const json = res ? await res.json().catch(() => null) : null;
  return json?.url || null;
};

export default function WordModal({ data, onClose, userId }: WordModalProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [wordDetail, setWordDetail] = useState<any>(null);
  const [ttsUnavailable, setTtsUnavailable] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // 모달 열릴 때 기존 발음 조회 (return null 이전 — Hook 규칙)
  const word_for_effect = data?.sentence || '';
  const sourceLang_for_effect = data?.sourceLang || '';

  // 마운트 시 getWordData 자동 호출 — 사전 데이터 + 분석값 병합
  useEffect(() => {
    if (!word_for_effect) return;
    setWordDetail(null);

    const fetchWordData = async () => {
      const res = await fetch('/api/phrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ action: 'getWordData', word: word_for_effect }),
      }).catch(() => null);
      const json = res ? await res.json().catch(() => null) : null;
      if (json?.success && json.payload) {
        setWordDetail(json.payload);
        // 분석값(riskScore)이 아직 없으면 Gemini 백그라운드 완료 후 재조회
        if (!json.payload.riskScore || json.payload.riskScore === 0) {
          setTimeout(async () => {
            const res2 = await fetch('/api/phrase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
              body: JSON.stringify({ action: 'getWordData', word: word_for_effect }),
            }).catch(() => null);
            const json2 = res2 ? await res2.json().catch(() => null) : null;
            if (json2?.success && json2.payload?.riskScore) {
              setWordDetail(json2.payload);
            }
          }, 2500); // Gemini 분석 완료 대기
        }
      }
    };

    fetchWordData();
  }, [word_for_effect]);
  useEffect(() => {
    if (!word_for_effect) return;
    setAudioUrl(null);
    const dialect = sourceLang_for_effect === 'ko' ? 'vietnamese' : 'korean';
    fetch('/api/phrase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'get-audio', word: word_for_effect, dialect }),
    })
      .then(r => r.json())
      .catch(() => null)
      .then(json => {
        if (json?.payload?.audio_url) {
          setAudioUrl(json.payload.audio_url);
        }
      });
  }, [word_for_effect]);

  if (!data) return null;

  const word = data.sentence;
  // 내부 state wordDetail 우선(마운트 시 자동 조회), 없으면 props wordDetail, 없으면 message 분석값
  const detail = wordDetail || data.wordDetail;
  // 뜻: tp_translations 사전 우선, 없으면 DeepL 번역 결과 fallback
  const meaning = detail?.meaning || data.translated;
  const emotion = detail?.emotion || data.emotion;
  const riskScore = detail?.riskScore ?? data.riskScore;
  const intent = detail?.intent || data.intent;
  const culturalNote = detail?.culturalNote || data.culturalNote;
  const sourceLang = data.sourceLang;

  const pronunciationTarget = sourceLang === 'ko'
    ? '🇻🇳 베트남어 발음을 알려주세요'
    : '🇰🇷 한국어 발음을 알려주세요';

  const intentLabel: Record<string, string> = {
    NEUTRAL: '일반적인 표현',
    COMPLAINT: '불만/불평이 담긴 표현',
    THREAT: '경고성 표현 (주의 필요)',
    AFFECTION: '애정이 담긴 표현',
    REQUEST: '요청/부탁의 표현',
  };
  const usage = intent ? (intentLabel[intent] || null) : null;

  const handlePlayAudio = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => { window.open(audioUrl, '_blank'); });
    } else if (typeof window !== 'undefined' && window.speechSynthesis && meaning) {
      const targetLang = sourceLang === 'ko' ? 'vi-VN' : 'ko-KR';
      const voices = window.speechSynthesis.getVoices();
      const hasVoice = voices.some(v => v.lang === targetLang || v.lang.startsWith(targetLang.split('-')[0]));
      if (voices.length > 0 && !hasVoice) {
        alert('이 기기에는 ' + (targetLang === 'vi-VN' ? '베트남어' : '한국어') + ' 음성이 설치되어 있지 않아요. 설정 > 손쉬운 사용 > 음성 콘텐츠에서 추가할 수 있어요.');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(meaning);
      utterance.lang = targetLang;
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSave = async () => {
    if (isSaved || isSaving) return;
    setIsSaving(true);
    const ok = await saveWord({
      user_id: userId,
      word,
      meaning_kr: meaning,
      source_session_id: data.sessionId,
    });
    setIsSaving(false);
    if (ok) setIsSaved(true);
  };

  const startRecording = async () => {
    try {
      audioChunks.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        setIsUploading(true);
        try {
          const mType = recorder.mimeType || mimeType;
          const blob = new Blob(audioChunks.current, { type: mType });
          if (blob.size <= 1000) {
            alert('녹음이 제대로 저장되지 않았어요. 이 기기에서는 녹음 기능이 원활하지 않을 수 있습니다.');
          }
          if (blob.size > 1000) {
            const url = await uploadVoice(blob, mType, userId || 'anon');
            if (url) {
              setAudioUrl(url);
              fetch('/api/phrase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify({
                  action: 'save-audio',
                  user_id: userId,
                  word: word,
                  dialect: sourceLang === 'ko' ? 'korean' : 'vietnamese',
                  audio_url: url,
                  session_id: data.sessionId || null,
                }),
              }).catch(() => null);
            }
          }
        } finally {
          setIsUploading(false);
          mediaRecorder.current = null;
          audioChunks.current = [];
        }
      };
      recorder.start(100);
      setIsRecording(true);
    } catch (e) {
      console.warn('마이크 실패:', e);
      alert('이 기기에서는 음성 녹음이 지원되지 않아요. 텍스트로 저장해주세요.');
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    setIsRecording(false);
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.requestData();
      setTimeout(() => mediaRecorder.current?.stop(), 100);
    }
  };

  const riskClass = (score?: number) => {
    if (!score) return styles.riskNone;
    if (score >= 0.7) return styles.riskHigh;
    if (score >= 0.4) return styles.riskMid;
    return styles.riskLow;
  };

  return (
    <div className={`modal-overlay open ${styles.overlay}`} onClick={onClose}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <h2 className={styles.title}>📖 {word}</h2>
          <button
            onClick={handlePlayAudio}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', opacity: audioUrl ? 1 : 0.5, minWidth: '36px', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '5px' }}
            title={audioUrl ? '원어민 발음' : '기계음 발음 (TTS)'}
          >🔊</button>
        </div>
        <p className={styles.subtitle}>단어 학습 카드</p>
        {ttsUnavailable && (
          <p className={styles.subtitle} style={{ color: 'var(--color-warn)', marginTop: '-8px' }}>
            🔇 이 기기에 발음 음성팩이 없어요
          </p>
        )}

        <Section title="💡 뜻과 쓰임새">
          <Row label="뜻" value={meaning || '아직 데이터가 없습니다'} />
          {usage && <Row label="쓰임새" value={usage} />}
          {/* meaning_score UI — Phase 1 */}
          {detail?.meaningScore != null && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-sub)' }}>
              {detail.meaningScore >= 0.8
                ? '🟢 의미 전달 우수'
                : detail.meaningScore >= 0.6
                  ? '🟡 약간의 뉘앙스 손실'
                  : '🔴 문화적 표현으로 완전한 번역 어려움'}
              {detail.meaningScore < 0.8 && detail.meaningReason && (
                <p style={{ marginTop: '4px', opacity: 0.8 }}>{detail.meaningReason}</p>
              )}
            </div>
          )}
        </Section>

        {riskScore !== undefined && riskScore > 0 && (
          <Section title="⚠ 위험 분석">
            <div className={styles.riskRow}>
              <div className={styles.riskTrack}>
                <div
                  className={`${styles.riskBar} ${riskClass(riskScore)}`}
                  style={{ width: `${Math.round(riskScore * 100)}%` }}
                />
              </div>
              <span className={`${styles.riskValue} ${riskClass(riskScore)}`}>
                {Math.round(riskScore * 100)}%
              </span>
            </div>
            {/* risk_reason 표시 — Phase 1 */}
            {detail?.riskReason && Array.isArray(detail.riskReason) && detail.riskReason.length > 0 && (
              <ul style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-sub)', paddingLeft: '16px' }}>
                {detail.riskReason.map((r: string, i: number) => (
                  <li key={i}>✓ {r}</li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {culturalNote && (
          <Section title="🔍 문화 메모">
            <p className={styles.culturalNote}>{culturalNote}</p>
          </Section>
        )}

        {emotion && (
          <Section title="🎭 감정">
            <span className={styles.emotionTag}>{emotion}</span>
          </Section>
        )}

        {/* 발음 녹음 섹션 */}
        <Section title="🎤 친구에게 발음을 알려주세요">
          <p className={styles.culturalNote} style={{ marginBottom: '8px' }}>
            {pronunciationTarget}
          </p>
          {audioUrl ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={handlePlayAudio}
                className={styles.saveBtn}
                style={{ flex: 1 }}
              >
                🔊 발음 듣기
              </button>
              <button
                onClick={() => { setAudioUrl(null); }}
                className={styles.closeBtn}
                style={{ flex: 1, marginTop: 0 }}
              >
                다시 녹음
              </button>
            </div>
          ) : (
            <button
              onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); startRecording(); }}
              onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); stopRecording(); }}
              onContextMenu={(e) => e.preventDefault()}
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              style={{ width: '100%', userSelect: 'none', WebkitUserSelect: 'none' }}
              disabled={isUploading}
              className={`${styles.saveBtn} ${isRecording ? styles.recordingBtn : ''}`}
            >
              {isUploading ? '⏳ 저장 중...' : isRecording ? '🔴 녹음 중... (떼면 완료)' : '🎤 누르고 말하세요'}
            </button>
          )}
        </Section>

        <div className={styles.btnRow}>
          <button
            onClick={handleSave}
            disabled={isSaved || isSaving}
            className={`${styles.saveBtn} ${isSaved ? styles.savedBtn : ''}`}
          >
            {isSaving ? '저장 중...' : isSaved ? '✅ 저장됨' : '🔖 단어장에 저장'}
          </button>
          <button onClick={onClose} className={styles.closeBtn}>확인</button>
        </div>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}