// ============================================================
// BRAINPOOL | CoreRing share.js v2.0
// ============================================================

const SHARE_CONFIG = {
    // ── 번역기 기본 공유
    translator: {
      text: () => `한국어 ↔ 베트남어, 사투리까지 번역돼요 🗣️
  남북 방언 자동 감지 · 감정 톤 분석 포함
  
  👉 corering.vercel.app
  
  써보고 솔직한 피드백 주시면 감사해요 🙏
  👉 https://docs.google.com/forms/d/e/1FAIpQLSfYcgRHsR_22BwZPEnzslTWONhN_O4BoXGnNMxp7MekIeEO1A/viewform`,
      toast: '📋 복사됐어요! 카카오톡에 붙여넣기 하세요'
    },
  
    // ── 채팅방 공유 (room 파라미터 있을 때)
    chat: {
      text: (roomCode) => `번역되는 채팅방에 초대합니다 💬
  한국어로 보내면 베트남어로, 베트남어로 보내면 한국어로 자동 번역돼요
  
  👉 corering.vercel.app/?room=${roomCode}`,
      toast: '💬 채팅방 링크가 복사됐어요!'
    }
  };
  
  // ── 복사 실행
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }
  
  // ── 토스트
  function showShareToast(message) {
    const existing = document.getElementById('share-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      background:rgba(30,30,30,.92);color:#fff;padding:12px 20px;
      border-radius:24px;font-size:14px;z-index:9999;
      white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.3);
      animation:fadeInUp .2s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  }
  
  // ── 버튼 이벤트
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('share-btn');
    if (!btn) return;
  
    btn.addEventListener('click', async () => {
      // 채팅방 연결 상태면 채팅방 링크 공유
      const roomCode = window.currentRoom?.invite_code || null;
  
      if (roomCode) {
        const cfg = SHARE_CONFIG.chat;
        await copyToClipboard(cfg.text(roomCode));
        showShareToast(cfg.toast);
      } else {
        const cfg = SHARE_CONFIG.translator;
        await copyToClipboard(cfg.text());
        showShareToast(cfg.toast);
      }
    });
  });