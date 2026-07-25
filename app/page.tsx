'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import BrainHeader from '@/components/BrainHeader';
import ChatBubble from '@/components/ChatBubble';
import ChatInput from '@/components/ChatInput';
import RoomList from '@/components/RoomList';
import RoomBar from '@/components/RoomBar';
import WordModal from '@/components/WordModal';
import CorePhrase from '@/components/CorePhrase';
import ShareRoomModal from '@/components/ShareRoomModal';
import styles from './page.module.css';

interface Message {
  messageId: string;
  original: string;
  translated: string;
  translations?: { ko?: string; vi?: string; en?: string };
  sourceLang?: string;
  targetLang?: string;
  emotion?: string;
  riskScore?: number;
  intent?: string;
  culturalNote?: string;
  timestamp: string;
  userId?: string;
  audioUrl?: string;
}

interface Room {
  roomId: string;
  title: string;
  inviteCode?: string;
  messageCount?: number;
  isPublic?: boolean;
}

interface DailyWord {
  word: string;
  meaning?: string;
  usage?: string;
  culturalNote?: string;
}

// ── 푸시 구독 ────────────────────────────────────────────────────────
const subscribePush = async (deviceId: string) => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: deviceId, subscription: sub }),
    });
  } catch (e) {
    console.warn('[Push] 구독 실패:', e);
  }
};

// ── device_id ────────────────────────────────────────────────────────
const getDeviceId = () => {
  if (typeof window === 'undefined') return 'anonymous';
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    localStorage.setItem('deviceId', id);
  }
  return id;
};

// ── 오늘의 단어 ──────────────────────────────────────────────────────
const fetchDailyWord = async (): Promise<DailyWord & { _error?: string }> => {
  const res = await fetch('/api/phrase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ action: 'get-random-word' }),
  }).catch(() => null);

  if (!res || !res.ok) return { word: '', _error: 'fetch_failed' };
  const text = await res.text().catch(() => null);
  if (!text) return { word: '', _error: 'empty' };

  const json = JSON.parse(text) as {
    success?: boolean;
    payload?: { word?: string; meaning?: string; usage?: string; culturalNote?: string };
  };
  if (!json.success || !json.payload?.word) return { word: '', _error: 'no_payload' };

  return {
    word:        json.payload.word,
    meaning:     json.payload.meaning,
    usage:       json.payload.usage,
    culturalNote: json.payload.culturalNote,
  };
};

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
export default function Home({ initialRoomId }: { initialRoomId?: string } = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [rooms,          setRooms]          = useState<Room[]>([]);
  const [currentRoomId,  setCurrentRoomId]  = useState<string | null>(null);
  const [currentRoomCode,setCurrentRoomCode]= useState('------');
  const [isRoomMode,     setIsRoomMode]     = useState(false);
  const [isTyping,       setIsTyping]       = useState(false);
  const [nickname,       setNickname]       = useState('익명');
  const [selectedMessage,setSelectedMessage]= useState<Message | null>(null);
  const [selectedWord,   setSelectedWord]   = useState<any>(null);
  const [isLoading,      setIsLoading]      = useState(false);
  const [deviceId]                          = useState(getDeviceId);
  const chatRef                             = useRef<HTMLDivElement>(null);
  const [firstLanguage,  setFirstLanguage]  = useState<string | null>(null);
  const [dailyWord,      setDailyWord]      = useState<DailyWord>({
    word: 'xin chào', meaning: '안녕하세요',
    usage: '처음 만나는 사람에게 쓰는 인사',
    culturalNote: '남부에서는 "chào" 만으로도 자연스러워요',
  });
  const [showDaily, setShowDaily]   = useState(true);
  const [showRoomBanner, setShowRoomBanner] = useState(false);
  const [shareRoomCode, setShareRoomCode] = useState<string | null>(null);
  const [shareRoomId, setShareRoomId] = useState<string | null>(null);
  const [langHistory, setLangHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab]   = useState<'ring' | 'phrase'>('ring');
  const [myRooms,   setMyRooms]     = useState<Room[]>(() => {
    if (typeof window === 'undefined') return [];
    return JSON.parse(localStorage.getItem('myRooms') || '[]');
  });

  const saveMyRoom = (room: Room) => {
    setMyRooms(prev => {
      const exists = prev.find(r => r.roomId === room.roomId);
      if (exists) return prev;
      const updated = [room, ...prev].slice(0, 10);
      localStorage.setItem('myRooms', JSON.stringify(updated));
      return updated;
    });
  };
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIOSGuide,   setShowIOSGuide]   = useState(false);
  
  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);
  
  const handleInstall = useCallback(async () => {
    const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const isKakao = /KAKAOTALK/i.test(navigator.userAgent);
  
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else if (isKakao) {
      window.open(
        `intent://${location.href.replace(/https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
      );
    }
  }, [deferredPrompt]);
  // ── 스크롤 ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // ── 마운트 시 번역기 기록 복원 (localStorage) ─────────────────────
  // useState 초기값에서 읽으면 SSR hydration 불일치 에러 발생
  // useEffect는 클라이언트에서만 실행되므로 안전함
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentTranslations');
      if (saved) setMessages(JSON.parse(saved));
    } catch { /* 복원 실패 무시 */ }
  }, []);

  // ── 번역기 모드 기록 localStorage 저장 (P2: 새로고침 복원) ───────────
  // 채팅방 모드는 저장 안 함 (폴링으로 복원됨)
  // Identity Layer 완성 후 owner_key 기반 동기화로 교체 예정 (P3)
  useEffect(() => {
    if (currentRoomId) return; // 채팅방 모드 제외
    try {
      // 최근 30개만 저장 (localStorage 용량 절약)
      const toSave = messages.slice(-30);
      localStorage.setItem('recentTranslations', JSON.stringify(toSave));
    } catch { /* 저장 실패 무시 */ }
  }, [messages, currentRoomId]);

  // ── 오늘의 단어 로드 ───────────────────────────────────────────────
  useEffect(() => {
    fetchDailyWord().then(result => {
      if (!result._error && result.word) setDailyWord(result);
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) setShowDaily(false);
  }, [messages.length]);

  // ── 방 목록 로드 ───────────────────────────────────────────────────
  // /api/chat GET 으로 변경 (list rooms는 ChatRoomEngine LIST_ROOMS 활용)
  // 단, GET /api/chat은 poll 전용이므로 rooms 조회는 별도 처리
  // → ChatRoomEngine LIST_ROOMS를 /api/chat POST action=list 로 추가하거나
  //   아래처럼 /api/chat/rooms GET 임시 유지 (TASK-02 완전 전환 후 제거)
  const loadRooms = useCallback(async () => {
    const res = await fetch('/api/chat/rooms', {
      headers: { 'x-device-id': deviceId },
    }).catch(() => null);
    if (!res) return;
    const data = await res.json().catch(() => null);
    if (data?.payload?.rooms) setRooms(data.payload.rooms);
  }, [deviceId]);

  // myRooms(localStorage 캐시)에 남아있는 방이 실제로 삭제됐는지 조용히 검증하고 정리
  const validateMyRooms = useCallback(async () => {
    setMyRooms(prev => {
      if (prev.length === 0) return prev;
      (async () => {
        const checks = await Promise.all(
          prev.map(async (room) => {
            const res = await fetch('/api/chat/rooms/' + room.roomId).catch(() => null);
            if (!res || !res.ok) return null;
            const data = await res.json().catch(() => null);
            return data?.payload?.room ? room : null;
          })
        );
        const alive = checks.filter(Boolean) as Room[];
        if (alive.length !== prev.length) {
          setMyRooms(alive);
          localStorage.setItem('myRooms', JSON.stringify(alive));
        }
      })();
      return prev;
    });
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);
  useEffect(() => { validateMyRooms(); }, [validateMyRooms]);

  // ── 푸시 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!deviceId) return;
    if (typeof Notification !== 'undefined' && Notification.requestPermission) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') subscribePush(deviceId);
        }).catch(() => {});
      }
  }, [deviceId]);

  // ── 폴링: /api/chat POST action=poll ────────────────────────────
  useEffect(() => {
    if (!currentRoomId) return;

    let isPolling = false;
    let cancelled = false;

    const poll = async () => {
      if (isPolling || cancelled) return;
      isPolling = true;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ action: 'poll', roomId: currentRoomId, limit: 50 }),
        });
        if (cancelled || !res || !res.ok) return;

        const data = await res.json().catch(() => null);
        if (cancelled || !data) return;

        if (data._error === 'ROOM_DELETED') {
          alert('이 방은 삭제되었습니다.');
          handleExitRoom();
          return;
        }
        const rawMsgs = data.payload?.messages || [];
        if (!rawMsgs.length) return;

        const msgs     = [...rawMsgs].reverse();
        const enriched = msgs.map((m: any) => {
          const srcLang    = m.sourceLang || (/[가-힣]/.test(m.original || '') ? 'ko' : 'vi');
          const tgtLang    = m.targetLang || (srcLang === 'ko' ? 'vi' : 'ko');
          const translated = m.translated
            || m.translations?.[tgtLang]
            || m.translations?.[srcLang]
            || m.original;

          return {
            messageId:   m.messageId || m.id,
            original:    m.original || '',
            translated,
            sourceLang:  srcLang,
            targetLang:  tgtLang,
            emotion:     typeof m.emotion === 'string' ? m.emotion : m.emotion?.primary || 'neutral',
            riskScore:   m.riskScore ?? 0,
            intent:      m.intent || undefined,
            culturalNote: m.culturalNote || undefined,
            timestamp:   m.timestamp || m.createdAt,
            userId:      m.userId || '',
            audioUrl:    m.audioUrl || undefined,
          };
        });

        if (!cancelled) setMessages(enriched);
      } catch (e: any) {
        if (!cancelled) console.warn('[poll] 에러:', e.message);
      } finally {
        isPolling = false;
      }
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentRoomId]);

  useEffect(() => {
    if (messages.length > 0 && messages[0].sourceLang && !firstLanguage) {
      setFirstLanguage(messages[0].sourceLang);
    }
  }, [messages.length, firstLanguage]);

  // ── 메시지 전송: /api/chat POST action=send ──────────────────────
  const sendMessageToRoom = async (roomId: string, text: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'send', roomId, userId: deviceId, original: text, analyze: true }),
    }).catch(err => { console.error('메시지 전송 실패:', err); return null; });
    const data = res ? await res.json().catch(() => null) : null;
    if (data?._error === 'ROOM_DELETED') {
      alert('이 방은 삭제되었습니다.');
      handleExitRoom();
    }
  };

  // ── 방 생성: /api/chat POST action=create ────────────────────────
  const handleSend = useCallback(async (text: string) => {
    setIsLoading(true);
    if (!currentRoomId) {
      try {
        const res = await fetch('/api/brainpool', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ text }),
        }).catch(() => null);
        const data = res ? await res.json().catch(() => null) : null;
        if (data?.payload) {
          const p = data.payload;
          const srcLang = p.sourceLang || null;
          const tgtLang = p.targetLang || (srcLang === 'ko' ? 'vi' : 'ko');
          setMessages(prev => [...prev, {
            messageId: p.id || crypto.randomUUID(),
            original: p.original || text,
            translated: p.translated || text,
            sourceLang: srcLang,
            targetLang: tgtLang,
            emotion: p.emotion || 'neutral',
            riskScore: p.riskScore ?? 0,
            intent: p.intent || undefined,
            culturalNote: p.culturalNote || undefined,
            timestamp: new Date().toISOString(),
            userId: deviceId,
          }]);
          // 양방향 대화 감지
          setLangHistory(prev => {
            const updated = [...prev, srcLang || 'unknown'];
            const hasKo = updated.includes('ko');
            const hasVi = updated.includes('vi');
            if (hasKo && hasVi) setShowRoomBanner(true);
            return updated;
          });
        }
      } catch (e) {}
      setIsLoading(false);
      return;
    } else {
      await sendMessageToRoom(currentRoomId, text);
    }
    setIsLoading(false);
  }, [currentRoomId, deviceId, loadRooms]);

  // ── 초대코드 입장: /api/chat POST action=join ────────────────────
  const handleJoinByCode = useCallback(async (inviteCode: string) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'join', inviteCode }),
    }).catch(() => null);

    const data = res ? await res.json().catch(() => null) : null;
    if (data && data.payload && data.payload.room) {
      setCurrentRoomId(data.payload.room.roomId);
      setCurrentRoomCode(data.payload.room.inviteCode || '------');
      saveMyRoom(data.payload.room);
      setIsRoomMode(false);
    } else {
      alert('방을 찾을 수 없습니다. 코드를 확인해주세요.');
    }
  }, []);

  // -- URL 딥링크 처리 (초대링크 ?code=, 알림 ?room=, SEO /rooms/{id}) -----------------
  useEffect(() => {
  if (initialRoomId) {
    (async () => {
      const res = await fetch('/api/chat/rooms/' + initialRoomId).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;
      if (data?.payload?.room) {
        setMessages([]);
        setCurrentRoomId(data.payload.room.roomId);
        setCurrentRoomCode(data.payload.room.inviteCode || '------');
        saveMyRoom(data.payload.room);
      }
    })();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const roomParam = params.get('room');

  if (code) {
    handleJoinByCode(code.toUpperCase());
    window.history.replaceState({}, '', window.location.pathname);
  } else if (roomParam) {
    (async () => {
      const res = await fetch('/api/chat/rooms/' + roomParam).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;
      if (data?.payload?.room) {
        setMessages([]);
        setCurrentRoomId(data.payload.room.roomId);
        setCurrentRoomCode(data.payload.room.inviteCode || '------');
        saveMyRoom(data.payload.room);
      }
      window.history.replaceState({}, '', window.location.pathname);
    })();
  }
}, [initialRoomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 방 삭제 ───────────────────────────────────────────────────────
  const handleDeleteRoom = useCallback(async (roomId: string) => {
    const res = await fetch(`/api/chat/rooms/${roomId}`, {
      method: 'DELETE',
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (data?.payload?.deleted) {
      setMyRooms(prev => {
        const updated = prev.filter(r => r.roomId !== roomId);
        localStorage.setItem('myRooms', JSON.stringify(updated));
        return updated;
      });
      loadRooms();
    }
  }, [loadRooms]);

  // ── 버블 클릭 ─────────────────────────────────────────────────────

  const handleVoiceSend = useCallback(async (audioUrl: string) => {
    // 음성 메시지 즉시 화면에 추가
    const voiceMsg = {
      messageId: crypto.randomUUID(),
      original: '🎤 음성 메시지',
      translated: '🎤 음성 메시지',
      sourceLang: 'ko',
      targetLang: 'vi',
      emotion: 'neutral',
      riskScore: 0,
      timestamp: new Date().toISOString(),
      userId: deviceId,
      audioUrl,
    };
    setMessages(prev => [...prev, voiceMsg]);
    // 방 있으면 채팅 전송
    if (currentRoomId) {
      await sendMessageToRoom(currentRoomId, '🎤 음성 메시지');
    }
    // 마지막 메시지에 audioUrl 붙이기 (dummy)
    setMessages(prev => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, audioUrl }];
    });
  }, [currentRoomId]);

  const handleBubbleClick = useCallback((msg: Message) => {
    setSelectedMessage(msg);
    setSelectedWord(null);
  }, []);

  const handleWordClick = useCallback(async (msg: Message, word: string) => {
    setSelectedMessage(msg);
    setSelectedWord(null);
    const res = await fetch('/api/phrase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ action: 'getWordData', word }),
    }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    if (json?.success && json.payload) setSelectedWord(json.payload);
  }, []);

  const handleExitRoom = useCallback(() => {
    setCurrentRoomId(null);
    setCurrentRoomCode('------');
    // 채팅방 퇴장 시 localStorage의 번역기 기록 복원
    try {
      const saved = localStorage.getItem('recentTranslations');
      setMessages(saved ? JSON.parse(saved) : []);
    } catch {
      setMessages([]);
    }
    setIsRoomMode(false);
    setFirstLanguage(null);
    setShowDaily(true);
  }, []);

  // ── 렌더 ─────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <BrainHeader
        project={(isRoomMode || currentRoomId) ? 'chat' : 'ring'}
        isRoomMode={isRoomMode || !!currentRoomId}
        onRoomToggle={() => {
          if (currentRoomId) handleExitRoom();
          else setIsRoomMode(prev => !prev);
        }}
        isTyping={isTyping}
        onClear={async () => {
          if (!currentRoomId) {
            if (!window.confirm('번역 기록을 모두 지울까요?')) return;
            setMessages([]);
            localStorage.removeItem('recentTranslations');
            return;
          }
          setMessages([]);
          await fetch(`/api/chat/rooms/${currentRoomId}`, { method: 'PATCH' }).catch(() => null);
        }}
        onShare={async () => {
          await navigator.share?.({ title: 'BRAINPOOL', text: 'CORE-RING', url: location.href })
            .catch(() => navigator.clipboard.writeText(location.href));
        }}
        onInstall={handleInstall}
      />

      <RoomList
        rooms={rooms}
        myRooms={myRooms}
        onSelectRoom={(id) => {
          const room = rooms.find(r => r.roomId === id) || myRooms.find(r => r.roomId === id);
          setMessages([]); // 채팅방 진입 시 번역기 기록 비움 (localStorage는 유지)
          setCurrentRoomId(id);
          setCurrentRoomCode(room?.inviteCode || '------');
        }}
        onJoinByCode={handleJoinByCode}
        onCreateRoom={async (title: string, isPublic: boolean) => {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ action: 'create', title, isPublic }),
          }).catch(() => null);
          const data = res ? await res.json().catch(() => null) : null;
          if (data?.payload?.room) {
            loadRooms();
            setCurrentRoomId(data.payload.room.roomId);
            setCurrentRoomCode(data.payload.room.inviteCode || '------');
            saveMyRoom(data.payload.room);
            setShareRoomCode(data.payload.room.inviteCode || null);
            setShareRoomId(data.payload.room.roomId || null);
            setIsRoomMode(false);
          }
        }}
        onDeleteRoom={handleDeleteRoom}
        visible={isRoomMode && !currentRoomId}
      />

      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'ring' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('ring')}
        >CoreRing</button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'phrase' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('phrase')}
        >CorePhrase</button>
      </div>

      {activeTab === 'phrase' && <CorePhrase userId={deviceId} />}

      <div className="chat-container" ref={chatRef}
        style={{ display: activeTab === 'ring' ? 'flex' : 'none' }}>

        {showDaily && messages.length === 0 && !isLoading && (
          <div className={styles.dailyCard}>
            <p className={styles.dailyLabel}>오늘의 단어</p>
            <p className={styles.dailyWord}>{dailyWord.word}</p>
            {dailyWord.meaning    && <p className={styles.dailyMeaning}>{dailyWord.meaning}</p>}
            {dailyWord.usage      && <p className={styles.dailyUsage}>{dailyWord.usage}</p>}
            {dailyWord.culturalNote && <p className={styles.dailyNote}>{dailyWord.culturalNote}</p>}
          </div>
        )}

        {messages.length === 0 && !isLoading && !showDaily && (
          <div className={styles.emptyState}>
            <p>심장을 분석합니다...</p>
            <p className={styles.emptyStateSub}>한국어 ↔ 베트남어 방언까지</p>
          </div>
        )}

        {isLoading && <div className={styles.loadingState}>번역 분석 중...</div>}

        {messages.map((msg) => {
          const isFirstLang = msg.sourceLang === firstLanguage;
          return (
            <ChatBubble
              key={msg.messageId}
              original={msg.original}
              translated={msg.translated}
              sourceLang={msg.sourceLang}
              targetLang={msg.targetLang}
              emotion={msg.emotion}
              riskScore={msg.riskScore}
              timestamp={msg.timestamp}
              deviceId={deviceId}
              messageId={msg.messageId}
              isFirstLang={isFirstLang}
              onClick={() => handleBubbleClick(msg)}
              audioUrl={msg.audioUrl}
              onWordClick={(word) => handleWordClick(msg, word)}
            />
          );
        })}
      </div>

      <RoomBar
        nickname={nickname}
        roomCode={currentRoomCode}
        onChangeNickname={() => {
          const name = prompt('닉네임:', nickname);
          if (name) setNickname(name);
        }}
        onCopyCode={() => navigator.clipboard.writeText(currentRoomCode)}
        onExit={handleExitRoom}
        visible={!!currentRoomId}
      />

      <ChatInput onSend={handleSend} onTypingChange={setIsTyping} userId={deviceId} onVoiceSend={handleVoiceSend} />

      {showRoomBanner && !currentRoomId && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-accent)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 20px',
          width: '90%',
          maxWidth: '400px',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <p style={{ color: 'var(--color-text)', fontSize: 'var(--font-sm)', margin: 0 }}>
            상대방과 함께 사용하시나요?
          </p>
          <button
            onClick={() => {
              setShowRoomBanner(false);
              setIsRoomMode(true);
            }}
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-bg)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '10px',
              cursor: 'pointer',
              fontSize: 'var(--font-sm)',
            }}
          >
            💬 채팅방 만들기
          </button>
          <button
            onClick={() => setShowRoomBanner(false)}
            style={{
              background: 'transparent',
              color: 'var(--color-text-muted)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 'var(--font-xs)',
            }}
          >
            닫기
          </button>
        </div>
      )}

      {shareRoomCode && shareRoomId && (
        <ShareRoomModal
          roomId={shareRoomId}
          roomCode={shareRoomCode}
          onClose={() => { setShareRoomCode(null); setShareRoomId(null); }}
        />
      )}


      <WordModal
        data={selectedMessage ? {
          sentence:    selectedMessage.original,
          translated:  selectedMessage.translated,
          sourceLang:  selectedMessage.sourceLang,
          emotion:     selectedMessage.emotion,
          riskScore:   selectedMessage.riskScore,
          intent:      selectedMessage.intent,
          culturalNote:selectedMessage.culturalNote,
          sessionId:   currentRoomId || undefined,
          wordDetail:  selectedWord || undefined,
        } : null}
        userId={deviceId}
        onClose={() => { setSelectedMessage(null); setSelectedWord(null); }}
      />
      {showIOSGuide && (
  <div style={{
    position: 'fixed', bottom: '80px', left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-accent)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 20px', width: '90%', maxWidth: '400px', zIndex: 50,
  }}>
    <p style={{ color: 'var(--color-text)', fontSize: 'var(--font-sm)', margin: '0 0 10px' }}>
      📲 Safari 하단 공유버튼 → "홈 화면에 추가"
    </p>
    <button onClick={() => setShowIOSGuide(false)}
      style={{ background: 'transparent', color: 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>
      닫기
    </button>
  </div>
)}
    </div>
  );
}