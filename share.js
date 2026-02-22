// ============================================================
// BRAINPOOL | CoreRing share.js v1.0
// 공유 버튼 → 앱 링크 + 피드백 폼 링크 복사
// ============================================================

const SHARE_TEXT = `CoreRing 번역기 써봐요 😊
한↔베 방언 번역 앱
👉 https://corering.vercel.app

써보고 피드백 부탁드려요 🙏
👉 https://docs.google.com/forms/d/e/1FAIpQLSfYcgRHsR_22BwZPEnzslTWONhN_O4BoXGnNMxp7MekIeEO1A/viewform`;

document.getElementById('share-btn').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(SHARE_TEXT);
        showShareToast('📋 복사됐어요! 카카오톡에 붙여넣기 하세요');
    } catch (e) {
        // clipboard API 실패 시 fallback
        const textarea = document.createElement('textarea');
        textarea.value = SHARE_TEXT;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showShareToast('📋 복사됐어요! 카카오톡에 붙여넣기 하세요');
    }
});

function showShareToast(message) {
    // 기존 토스트 제거
    const existing = document.getElementById('share-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'share-toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 90px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(30, 30, 30, 0.92);
        color: #fff;
        padding: 12px 20px;
        border-radius: 24px;
        font-size: 14px;
        z-index: 9999;
        white-space: nowrap;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        animation: fadeInUp 0.2s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
}