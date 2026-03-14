// ============================================================
// BRAINPOOL | CoreRing rooms.js v6.2
// - 채팅 알림 기능 추가 (탭 뱃지 + 진동 + Notification API)
// ============================================================

const roomLayer  = document.getElementById("room-layer")
const roomList   = document.getElementById("room-list")

let rooms            = []
let pollingTimer     = null
let lastMsgTimestamp = null
const sentMsgIds     = new Set()

// ─── window.currentRoom 전역 공유 ────────────────────────────
window.currentRoom = null

// ─── device_id / nickname ────────────────────────────────────
function getDeviceId() {
    let id = localStorage.getItem('cr_device_id')
    if (!id) {
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        localStorage.setItem('cr_device_id', id)
    }
    return id
}
function getNickname()      { return localStorage.getItem('cr_nickname') || null }
function saveNickname(name) { localStorage.setItem('cr_nickname', name) }

const DEVICE_ID = getDeviceId()

// ─── 알림 권한 요청 ───────────────────────────────────────────
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission()
    }
}
requestNotificationPermission()

// ─── 새 메시지 알림 ───────────────────────────────────────────
let unreadCount = 0

function notifyNewMessage(msg) {
    unreadCount++

    // 탭 타이틀 뱃지
    document.title = `(${unreadCount}) CoreChat`

    // 진동 (모바일)
    if (navigator.vibrate) navigator.vibrate([100, 50, 100])

    // 브라우저 알림 (탭 비활성화 상태일 때만)
    if (document.hidden && Notification.permission === 'granted') {
        new Notification('CoreChat', {
            body: msg.nickname
                ? `${msg.nickname}: ${msg.message}`
                : msg.message,
            icon: '/icon-192.png',
            tag:  'corechat-msg',   // 같은 tag면 덮어씌움 (스팸 방지)
        })
    }
}

// 탭 포커스 시 뱃지 초기화
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        unreadCount = 0
        document.title = 'CoreChat'
    }
})

// ─── URL 자동 입장 ───────────────────────────────────────────
window.addEventListener('load', async function autoJoinFromURL() {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('room')
    if (!code) return
    window.history.replaceState({}, '', window.location.pathname)

    await new Promise(r => setTimeout(r, 300))

    const nickname = getNickname()
    if (nickname) {
        await doJoin(code.toUpperCase(), nickname)
    } else {
        showNicknameModal({ onConfirm: async (name) => {
            saveNickname(name)
            await doJoin(code.toUpperCase(), name)
        }})
    }
})

// ─── 토글 ────────────────────────────────────────────────────
function toggleRooms() {
    if (roomLayer.style.display === "none" || !roomLayer.style.display) {
        showRoomListView()
        roomLayer.style.display = "block"
    } else {
        roomLayer.style.display = "none"
    }
}

// 초기 room-toggle 이벤트 등록
const initialToggle = document.getElementById('room-toggle')
if (initialToggle) initialToggle.addEventListener('click', toggleRooms)

// ============================================================
// VIEW: 방 목록
// ============================================================
async function showRoomListView() {
    roomLayer.style.display = "block"
    roomList.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <span style="font-size:11px; letter-spacing:3px; color:#555;">CHAT ROOMS</span>
            <div style="display:flex; gap:8px;">
                <button onclick="showJoinInput()" style="
                    background:none; border:1px solid rgba(255,255,255,0.1);
                    color:#777; padding:6px 12px; border-radius:20px;
                    font-size:10px; letter-spacing:1px; cursor:pointer; font-family:monospace;
                ">코드 입력</button>
                <button onclick="createNewRoom()" style="
                    background:none; border:1px solid rgba(255,255,255,0.15);
                    color:#aaa; padding:6px 14px; border-radius:20px;
                    font-size:10px; letter-spacing:2px; cursor:pointer; font-family:monospace;
                ">+ NEW</button>
            </div>
        </div>
        <div id="room-items">
            <div style="color:#333; font-size:12px; text-align:center; padding:20px 0;">불러오는 중...</div>
        </div>
    `
    try {
        const res = await fetch("/api/corechat?action=get-rooms")
        rooms = await res.json()
        renderRoomItems()
    } catch(e) {
        const el = document.getElementById("room-items")
        if (el) el.innerHTML = `<div style="color:#555; font-size:12px; padding:20px 0; text-align:center;">불러올 수 없습니다.</div>`
    }
}

function renderRoomItems() {
    const container = document.getElementById("room-items")
    if (!container) return
    if (!rooms || rooms.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 0; color:#444; font-size:12px; line-height:2;">
                아직 채팅방이 없어요.<br>
                <span style="color:#555;">NEW로 방을 만들거나 코드로 입장하세요.</span>
            </div>`
        return
    }
    container.innerHTML = ""
    rooms.forEach(room => {
        const isActive = window.currentRoom?.id === room.id
        const isOwner  = room.owner_device_id === DEVICE_ID
        const div = document.createElement("div")
        div.style.cssText = `
            padding:14px 12px; border-bottom:1px solid #1a1a1a;
            cursor:pointer; display:flex; align-items:center;
            justify-content:space-between;
            background:${isActive ? '#111' : 'none'};
        `
        div.onmouseenter = () => div.style.background = "#111"
        div.onmouseleave = () => div.style.background = isActive ? "#111" : "none"
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="
                    width:36px; height:36px; border-radius:50%;
                    background:${isActive ? '#1a2a1a' : '#1a1a1a'};
                    border:1px solid ${isActive ? '#2a4a2a' : '#2a2a2a'};
                    display:flex; align-items:center; justify-content:center; font-size:14px;
                ">${isActive ? '🟢' : '💬'}</div>
                <div>
                    <div style="font-size:14px; color:#ddd; font-family:monospace; letter-spacing:2px;">
                        ${room.invite_code}
                    </div>
                    <div style="font-size:11px; color:#444; margin-top:2px;">
                        ${new Date(room.created_at).toLocaleDateString('ko-KR', {month:'short', day:'numeric'})}
                        ${isOwner ? ' · 방장' : ''}
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:6px;">
                <button onclick="event.stopPropagation(); shareInviteCode('${room.invite_code}')" style="
                    background:none; border:1px solid #2a2a2a; color:#555;
                    padding:4px 10px; border-radius:12px;
                    font-size:10px; cursor:pointer; font-family:monospace;
                ">공유</button>
                ${isOwner ? `
                <button onclick="event.stopPropagation(); deleteRoom('${room.id}')" style="
                    background:none; border:1px solid #3a1a1a; color:#a55;
                    padding:4px 10px; border-radius:12px;
                    font-size:10px; cursor:pointer; font-family:monospace;
                ">삭제</button>` : ''}
            </div>
        `
        div.onclick = () => {
            const nickname = getNickname() || '익명'
            window.currentRoom = { ...room, nickname }
            lastMsgTimestamp = new Date().toISOString()
            roomLayer.style.display = 'none'
            if (typeof switchToChatMode === 'function') switchToChatMode(room)
            startPolling(room.id)
        }
        container.appendChild(div)
    })
}

// ─── 코드 입력 박스 ──────────────────────────────────────────
function showJoinInput() {
    const container = document.getElementById("room-items")
    if (!container || document.getElementById("join-box")) return
    container.insertAdjacentHTML('afterbegin', `
        <div id="join-box" style="
            background:#111; border:1px solid #2a2a2a;
            border-radius:16px; padding:16px; margin-bottom:16px;
        ">
            <div style="font-size:11px; color:#555; letter-spacing:2px; margin-bottom:10px;">초대 코드 입력</div>
            <div style="display:flex; gap:8px;">
                <input id="join-code-input" type="text" maxlength="6" placeholder="A3K9X2"
                    style="flex:1; background:#0a0a0a; border:1px solid #333; border-radius:10px;
                    padding:10px 14px; color:#fff; font-size:16px; font-family:monospace;
                    letter-spacing:3px; outline:none; text-transform:uppercase;"
                />
                <button onclick="joinByCode()" style="
                    background:none; border:1px solid #444; color:#aaa;
                    padding:10px 16px; border-radius:10px; font-size:12px; cursor:pointer;
                ">입장</button>
            </div>
        </div>
    `)
    const inp = document.getElementById("join-code-input")
    if (!inp) return
    inp.focus()
    inp.oninput    = (e) => { e.target.value = e.target.value.toUpperCase() }
    inp.onkeypress = (e) => { if (e.key === "Enter") joinByCode() }
    inp.onblur     = () => {
        setTimeout(() => {
            const box = document.getElementById("join-box")
            if (box && !inp.value.trim()) box.remove()
        }, 3000)
    }
}

async function joinByCode() {
    const inp  = document.getElementById("join-code-input")
    if (!inp) return
    const code = inp.value.trim().toUpperCase()
    if (code.length !== 6) { showRoomToast('6자리 코드를 입력하세요'); return }
    const nickname = getNickname()
    if (nickname) {
        await doJoin(code, nickname)
    } else {
        showNicknameModal({ onConfirm: async (name) => {
            saveNickname(name)
            await doJoin(code, name)
        }})
    }
}

async function doJoin(code, nickname) {
    try {
        const res = await fetch("/api/corechat?action=join-room", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invite_code: code, nickname: nickname || '익명', device_id: DEVICE_ID })
        })
        const room = await res.json()
        if (room.id) {
            window.currentRoom = { ...room, nickname: nickname || '익명' }
            lastMsgTimestamp   = new Date().toISOString()
            roomLayer.style.display = 'none'
            if (typeof switchToChatMode === 'function') switchToChatMode(room)
            startPolling(room.id)
        } else {
            showRoomToast('존재하지 않는 코드입니다.')
        }
    } catch(e) { showRoomToast('입장 실패') }
}

// ─── 폴링 ────────────────────────────────────────────────────
function startPolling(roomId) {
    stopPolling()
    if (!lastMsgTimestamp) lastMsgTimestamp = new Date().toISOString()

    pollingTimer = setInterval(async () => {
        if (!window.currentRoom) { stopPolling(); return }
        try {
            const url  = `/api/corechat?action=get-messages&room_id=${roomId}&after=${encodeURIComponent(lastMsgTimestamp)}`
            const res  = await fetch(url)
            const msgs = await res.json()
            if (!msgs || msgs.length === 0) return

            const newMsgs = msgs.filter(m => m.device_id !== DEVICE_ID && !sentMsgIds.has(m.id))
            newMsgs.forEach(m => {
                if (typeof appendChatToHistory === 'function') appendChatToHistory(m)
                notifyNewMessage(m)
            })

            lastMsgTimestamp = msgs[msgs.length - 1].created_at
        } catch(e) {}
    }, 3000)
}

function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null }
}

// ─── 나가기 ──────────────────────────────────────────────────
function exitChatMode() {
    stopPolling()
    window.currentRoom = null
    unreadCount = 0
    document.title = 'CoreChat'
    roomLayer.style.display = 'none'
    if (typeof switchToRingMode === 'function') switchToRingMode()
    showRoomToast('번역기로 돌아왔습니다.')
}

// ─── 방 생성 ─────────────────────────────────────────────────
async function createNewRoom() {
    const nickname = getNickname()
    const create = async (name) => {
        if (name) saveNickname(name)
        try {
            const res = await fetch("/api/corechat?action=create-room", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ room_type: "dm", device_id: DEVICE_ID })
            })
            const data = await res.json()

            if (!res.ok) {
                showRoomToast('방 생성 실패: ' + (data.error || res.status))
                return
            }

            const room = data.room || data
            if (room?.id) {
                window.currentRoom = { ...room, nickname: name || nickname || '익명' }
                lastMsgTimestamp   = new Date().toISOString()
                roomLayer.style.display = 'none'
                if (typeof switchToChatMode === 'function') switchToChatMode(room)
                startPolling(room.id)
                shareInviteCode(room.invite_code)
            } else {
                showRoomToast('방 생성 실패')
            }
        } catch(e) {
            console.error('방 생성 예외:', e)
            showRoomToast('방 생성 실패')
        }
    }
    if (nickname) await create(nickname)
    else showNicknameModal({ onConfirm: create })
}

// ─── 방 삭제 ─────────────────────────────────────────────────
async function deleteRoom(roomId) {
    if (!confirm('방을 삭제하면 모든 메시지가 사라집니다. 삭제할까요?')) return
    try {
        const res = await fetch("/api/corechat?action=delete-room", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_id: roomId, device_id: DEVICE_ID })
        })
        const data = await res.json()
        if (data.ok) {
            if (window.currentRoom?.id === roomId) exitChatMode()
            else showRoomListView()
            showRoomToast('방이 삭제됐습니다.')
        } else {
            showRoomToast('삭제 권한이 없습니다.')
        }
    } catch(e) { showRoomToast('삭제 실패') }
}

// ─── 공유 ────────────────────────────────────────────────────
function shareInviteCode(code) {
    const link      = `https://corering.vercel.app/?room=${code}`
    const shareText = `CoreRing 채팅방 초대\n👉 ${link}`
    const canShare  = navigator.share && window.isSecureContext &&
                      /android|iphone|ipad|ipod/i.test(navigator.userAgent)
    if (canShare) {
        navigator.share({ title: 'CoreRing 초대', text: shareText, url: link })
            .catch(() => showShareOptions(shareText, code, link))
    } else {
        showShareOptions(shareText, code, link)
    }
}

function showShareOptions(shareText, code, link) {
    const existing = document.getElementById('share-modal')
    if (existing) existing.remove()
    const modal = document.createElement('div')
    modal.id = 'share-modal'
    modal.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.85);
        display:flex; align-items:flex-end; justify-content:center;
        z-index:300; padding:20px;
    `
    const encodedText = encodeURIComponent(shareText)
    modal.innerHTML = `
        <div style="background:#111; border:1px solid #2a2a2a; border-radius:24px; padding:24px;
            width:100%; max-width:400px; margin-bottom:20px;">
            <div style="font-size:11px; letter-spacing:3px; color:#555; margin-bottom:16px;">초대 코드</div>
            <div style="font-size:28px; font-family:monospace; letter-spacing:6px; color:#fff;
                text-align:center; background:#0a0a0a; border-radius:16px; padding:20px; margin-bottom:20px;">
                ${code}
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <a href="https://zalo.me/share?text=${encodedText}"
                   target="_blank" style="display:block; text-align:center; background:#0068FF;
                   color:#fff; padding:14px; border-radius:16px; font-size:14px;
                   text-decoration:none; font-weight:600;">잘로(Zalo)로 공유</a>
                <button onclick="navigator.clipboard.writeText('${link}').then(()=>{document.getElementById('share-modal').remove();showRoomToast('📋 링크 복사됨!')})" style="
                    background:#FAE100; border:none; color:#3A1D1D;
                    padding:14px; border-radius:16px; font-size:14px;
                    cursor:pointer; font-weight:600; width:100%;">카카오에 붙여넣기용 링크 복사</button>
                <button onclick="navigator.clipboard.writeText('${link}').then(()=>{document.getElementById('share-modal').remove();showRoomToast('📋 링크 복사됨!')})" style="
                    background:#1a1a1a; border:1px solid #333; color:#aaa;
                    padding:14px; border-radius:16px; font-size:14px; cursor:pointer;">링크 복사</button>
            </div>
            <button onclick="document.getElementById('share-modal').remove()" style="
                width:100%; margin-top:12px; background:none; border:1px solid #2a2a2a; color:#555;
                padding:12px; border-radius:16px; font-size:13px; cursor:pointer;">닫기</button>
        </div>
    `
    document.body.appendChild(modal)
    modal.onclick = (e) => { if (e.target === modal) modal.remove() }
}

// ─── 닉네임 모달 ─────────────────────────────────────────────
function showNicknameModal({ onConfirm }) {
    const existing = document.getElementById('nickname-modal')
    if (existing) existing.remove()
    const overlay = document.createElement('div')
    overlay.id = 'nickname-modal'
    overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.85);
        display:flex; align-items:center; justify-content:center;
        z-index:200; padding:20px;
    `
    overlay.innerHTML = `
        <div style="background:#111; border:1px solid #2a2a2a; border-radius:24px;
            padding:32px 24px; width:100%; max-width:320px;">
            <div style="font-size:11px; letter-spacing:3px; color:#555; margin-bottom:16px;">NICKNAME</div>
            <div style="font-size:18px; font-weight:700; color:#fff; margin-bottom:24px;">채팅에서 사용할 이름</div>
            <input id="nickname-input" type="text" maxlength="20" placeholder="닉네임 입력"
                style="width:100%; background:#0a0a0a; border:1px solid #333; border-radius:12px;
                padding:14px 16px; color:#fff; font-size:16px; outline:none;
                box-sizing:border-box; margin-bottom:16px;"
            />
            <button id="nickname-confirm" style="width:100%; background:#fff; border:none;
                border-radius:16px; padding:16px; color:#000; font-size:16px;
                font-weight:800; cursor:pointer;">입장</button>
        </div>
    `
    document.body.appendChild(overlay)
    const inp = document.getElementById('nickname-input')
    const btn = document.getElementById('nickname-confirm')
    inp.focus()
    const confirm = () => {
        const name = inp.value.trim()
        if (!name) { inp.style.borderColor = '#a55'; return }
        overlay.remove()
        onConfirm(name)
    }
    btn.onclick    = confirm
    inp.onkeypress = (e) => { if (e.key === 'Enter') confirm() }
}

// ─── 토스트 ──────────────────────────────────────────────────
function showRoomToast(msg) {
    const existing = document.getElementById('room-toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.id = 'room-toast'
    toast.textContent = msg
    toast.style.cssText = `
        position:fixed; bottom:100px; left:50%; transform:translateX(-50%);
        background:#1a1a1a; color:#aaa; border:1px solid #2a2a2a;
        padding:10px 20px; border-radius:20px; font-size:12px;
        font-family:monospace; z-index:9999; white-space:nowrap; letter-spacing:1px;
    `
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2500)
}