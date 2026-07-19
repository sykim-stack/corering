'use client';
import { useState } from 'react';
import styles from './ShareRoomModal.module.css';

interface ShareRoomModalProps {
  roomId: string;
  roomCode: string;
  onClose: () => void;
}

export default function ShareRoomModal({ roomId, roomCode, onClose }: ShareRoomModalProps) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const isKakao = () => /KAKAOTALK/i.test(navigator.userAgent);

  const handleShare = async () => {
    const shareUrl = 'https://corering.vercel.app/rooms/' + roomId;
    const shareText = `CoreRing 채팅방에 초대합니다!\n방 코드: ${roomCode}\n${shareUrl}`;

    if (navigator.share) {
      await navigator.share({
        title: 'CoreRing 채팅방 초대',
        text: shareText,
        url: shareUrl,
      }).catch(() => null);
    } else {
      navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCodeCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.emoji}>🎉</p>
        <h2 className={styles.title}>방이 만들어졌어요!</h2>
        <p className={styles.subtitle}>친구에게 공유해보세요</p>

        <div className={styles.codeBox}>
          <span className={styles.code}>{roomCode}</span>
        </div>

        <div className={styles.btnGroup}>
          <button className={styles.shareBtn} onClick={handleShare}>
            {copied ? '✅ 복사됨' : '📤 공유하기'}
          </button>
          <button className={styles.copyBtn} onClick={handleCodeCopy}>
            {codeCopied ? '✅ 복사됨' : '📋 코드 복사'}
          </button>
        </div>

        {isKakao() && (
          <p className={styles.kakaoNotice}>
            카카오에서 열리지 않으면<br />
            우측 메뉴 → <strong>다른 브라우저로 열기</strong>
          </p>
        )}

        <button className={styles.closeBtn} onClick={onClose}>
          나중에 할게요
        </button>
      </div>
    </div>
  );
}
