// ============================================================
// BRAINPOOL | CoreRing rooms.js v5.0
// - 닉네임 입력 → 방 입장
// - device_id 기반 내/상대 구분
// - 내 메시지 왼쪽 / 상대방 오른쪽
// - Supabase Realtime 실시간 수신
// - 방 삭제 (방장만) / 나가기
// - 번역 결과 자동 저장
// - URL 링크로 자동 입장
// ============================================================

const roomLayer  = document.getElementById("room-layer")
const roomList   = document.getElementById("room-list")
const roomToggle = document.getElementById("room-toggle")

let rooms       = []
let currentRoom = null
let realtimeChannel = null

// ─── device_id 생성/로드 ─────────────────────────────────────
function getDeviceId() {
    let id = localStorage.getItem('cr_device_id')
    if (!id) {
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        localStorage.setItem('cr_device_id', id)
    }
    return id
}

function getNickname() {
    return localStorage.getItem('cr_nickname') || null
}

function saveNickname(name) {
    localStorage.setItem('cr_nickname', name)
}

const DEVICE_ID = getDeviceId()

// ─── Supabase Realtime 설정 ──────────────────────────────────
const SUPABASE_URL = 'https://' + (()=>{
    // URL에서 supabase 프로젝트 ID 추출 불가 → API 통해 처리
    return ''
})()

// ─── URL 자동 입장 ───────────────────────────────────────────
;(async function autoJoinFromURL() {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('room')
    if (!code) return

    window.history.replaceState({}, '', window.location.pathname)

    const nickname = getNickname()
    if (nickname) {
        await doJoin(code.toUpperCase(), nickname)
    } else {
        // 닉네임 없으면 입력 모달 표시
        showNicknameModal({ onConfirm: async (name) => {
            saveNickname(name)
            await doJoin(code.toUpperCase(), name)
        }})
    }
})()

// ─── 토글 ────────────────────────────────────────────────────
roomToggle.addEventListener("click", toggleRooms)

function toggleRooms() {
    if (roomLayer.style.display === "none") {
        loadRooms()
        roomLayer.style.display = "block"
    } else {
        roomLayer.style.display = "none"
    }
}

// ─── 방 목록 ─────────────────────────────────────────────────
async function loadRooms() {
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
        renderRoomList()
    } catch(e) {
        const el = document.getElementById("room-items")
        if (el) el.innerHTML = `<div style="color:#555; font-size:12px; padding:20px 0; text-align:center;">불러올 수 없습니다.</div>`
    }
}

function renderRoomList() {
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
        const isActive = currentRoom?.id === room.id
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
                    background:none; border:1px solid #2a2a2a;
                    color:#555; padding:4px 10px; border-radius:12px;
                    font-size:10px; cursor:pointer; font-family:monospace;
                ">공유</button>
                ${isActive ? `
                <button onclick="event.stopPropagation(); leaveRoom()" style="
                    background:none; border:1px solid #2a2a2a;
                    color:#666; padding:4px 10px; border-radius:12px;
                    font-size:10px; cursor:pointer; font-family:monospace;
                ">나가기</button>` : ''}
                ${isOwner ? `
                <button onclick="event.stopPropagation(); deleteRoom('${room.id}')" style="
                    background:none; border:1px solid #3a1a1a;
                    color:#a55; padding:4px 10px; border-radius:12px;
                    font-size:10px; cursor:pointer; font-family:monospace;
                ">삭제</button>` : ''}
            </div>
        `
        div.onclick = () => enterRoomWithNickname(room)
        container.appendChild(div)
    })
}

// ─── 닉네임 확인 후 입장 ─────────────────────────────────────
function enterRoomWithNickname(room) {
    const nickname = getNickname()
    if (nickname) {
        enterRoom(room, nickname)
    } else {
        showNicknameModal({ onConfirm: (name) => {
            saveNickname(name)
            enterRoom(room, name)
        }})
    }
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
        <div style="
            background:#111; border:1px solid #2a2a2a;
            border-radius:24px; padding:32px 24px;
            width:100%; max-width:320px;
        ">
            <div style="font-size:11px; letter-spacing:3px; color:#555; margin-bottom:16px;">NICKNAME</div>
            <div style="font-size:18px; font-weight:700; color:#fff; margin-bottom:24px;">
                채팅에서 사용할 이름
            </div>
            <input id="nickname-input" type="text" maxlength="20"
                placeholder="상요이"
                style="
                    width:100%; background:#0a0a0a; border:1px solid #333;
                    border-radius:12px; padding:14px 16px;
                    color:#fff; font-size:16px; outline:none;
                    box-sizing:border-box; margin-bottom:16px;
                "
            />
            <button id="nickname-confirm" style="
                width:100%; background:#fff; border:none;
                border-radius:16px; padding:16px;
                color:#000; font-size:16px; font-weight:800;
                cursor:pointer;
            ">입장</button>
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
                <input id="join-code-input" type="text" maxlength="6"
                    placeholder="A3K9X2"
                    style="
                        flex:1; background:#0a0a0a; border:1px solid #333;
                        border-radius:10px; padding:10px 14px;
                        color:#fff; font-size:16px; font-family:monospace;
                        letter-spacing:3px; outline:none; text-transform:uppercase;
                    "
                />
                <button onclick="joinByCode()" style="
                    background:none; border:1px solid #444;
                    color:#aaa; padding:10px 16px; border-radius:10px;
                    font-size:12px; cursor:pointer;
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
    await doJoin(code)
}

async function doJoin(code, nickname) {
    const name = nickname || getNickname()
    try {
        const res = await fetch("/api/corechat?action=join-room", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invite_code: code,
                nickname:    name || '익명',
                device_id:   DEVICE_ID
            })
        })
        const room = await res.json()
        if (room.id) {
            enterRoom(room, name || '익명')
        } else {
            showRoomToast('존재하지 않는 코드입니다.')
        }
    } catch(e) {
        showRoomToast('입장 실패')
    }
}

// ─── 방 입장 ─────────────────────────────────────────────────
function enterRoom(room, nickname) {
    currentRoom = { ...room, nickname: nickname || getNickname() || '익명' }
    roomLayer.style.display = "none"
    updateRoomHeader(room.invite_code)
    subscribeRealtime(room.id)
    showRoomToast(`${room.invite_code} 연결됨`)
}

// ─── 방 나가기 ───────────────────────────────────────────────
function leaveRoom() {
    unsubscribeRealtime()
    currentRoom = null
    clearRoomHeader()
    showRoomToast('방에서 나왔습니다.')
    loadRooms()
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
            if (currentRoom?.id === roomId) leaveRoom()
            else loadRooms()
            showRoomToast('방이 삭제됐습니다.')
        } else {
            showRoomToast('삭제 권한이 없습니다.')
        }
    } catch(e) {
        showRoomToast('삭제 실패')
    }
}

// ─── 헤더 표시 ───────────────────────────────────────────────
function updateRoomHeader(code) {
    let indicator = document.getElementById("room-indicator")
    if (!indicator) {
        indicator = document.createElement("div")
        indicator.id = "room-indicator"
        indicator.style.cssText = `
            font-size:10px; font-family:monospace; letter-spacing:2px;
            color:#4a9a4a; border:1px solid #2a4a2a;
            padding:3px 10px; border-radius:12px; cursor:pointer;
        `
        indicator.onclick = () => {
            roomLayer.style.display = "block"
            loadRooms()
        }
        roomToggle.parentNode.insertBefore(indicator, roomToggle)
    }
    indicator.textContent = `● ${code}`
}

function clearRoomHeader() {
    const el = document.getElementById("room-indicator")
    if (el) el.remove()
}

// ─── 새 방 생성 ──────────────────────────────────────────────
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
            const room = await res.json()
            if (room.id) {
                enterRoom(room, name || nickname)
                shareInviteCode(room.invite_code)
                loadRooms()
            }
        } catch(e) { showRoomToast('방 생성 실패') }
    }

    if (nickname) { await create(nickname) }
    else { showNicknameModal({ onConfirm: create }) }
}

// ─── 공유 ────────────────────────────────────────────────────
function shareInviteCode(code) {
    const link      = `https://corering.vercel.app/?room=${code}`
    const shareText = `CoreRing 채팅방 초대\n👉 ${link}`
    if (navigator.share) {
        navigator.share({ title: 'CoreRing 초대', text: shareText, url: link })
            .catch(() => copyToClipboard(shareText, code))
    } else {
        copyToClipboard(shareText, code)
    }
}

function copyToClipboard(text, code) {
    navigator.clipboard.writeText(text)
        .then(() => showRoomToast(`📋 ${code} 링크 복사됨!`))
        .catch(() => {
            const ta = document.createElement('textarea')
            ta.value = text
            ta.style.cssText = 'position:fixed; opacity:0;'
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
            showRoomToast(`📋 ${code} 링크 복사됨!`)
        })
}

// ─── Supabase Realtime 구독 ──────────────────────────────────
function subscribeRealtime(roomId) {
    unsubscribeRealtime()

    // Supabase Realtime은 API에서 처리 → 폴링으로 대체 (Phase 0)
    realtimeChannel = setInterval(async () => {
        if (!currentRoom) return
        try {
            const res = await fetch(`/api/corechat?action=get-messages&room_id=${roomId}`)
            const messages = await res.json()
            showIncomingMessages(messages)
        } catch(e) {}
    }, 3000)
}

function unsubscribeRealtime() {
    if (realtimeChannel) { clearInterval(realtimeChannel); realtimeChannel = null }
}

// ─── 수신 메시지 표시 ────────────────────────────────────────
let lastMessageCount = 0

function showIncomingMessages(messages) {
    if (!messages || messages.length === 0) return
    if (messages.length <= lastMessageCount) return

    // 새 메시지만
    const newMessages = messages.slice(lastMessageCount)
    lastMessageCount  = messages.length

    newMessages.forEach(msg => {
        const isMe = msg.device_id === DEVICE_ID
        if (isMe) return  // 내 메시지는 이미 표시됨

        // 상대방 메시지 → 번역기 화면에 토스트로 표시
        showMessageToast(msg)
    })
}

function showMessageToast(msg) {
    const existing = document.getElementById('msg-toast')
    if (existing) existing.remove()

    const nickname = msg.nickname || '상대방'
    const content  = msg.translated_ko || msg.translated_vi || msg.message

    const toast = document.createElement('div')
    toast.id = 'msg-toast'
    toast.style.cssText = `
        position:fixed; top:70px; left:50%;
        transform:translateX(-50%);
        background:#111; border:1px solid #2a2a2a;
        border-radius:16px; padding:12px 18px;
        max-width:80%; z-index:100;
        cursor:pointer;
    `
    toast.innerHTML = `
        <div style="font-size:10px; color:#555; font-family:monospace; margin-bottom:4px;">
            ${nickname}
        </div>
        <div style="font-size:14px; color:#ddd;">${content}</div>
    `
    toast.onclick = () => toast.remove()
    document.body.appendChild(toast)
    setTimeout(() => { if (toast.parentNode) toast.remove() }, 4000)
}

// ─── 번역 결과 채팅방 저장 (engine.js에서 호출) ──────────────
async function sendTranslationToRoom(original, translated, direction) {
    if (!currentRoom) return
    try {
        await fetch("/api/corechat?action=send-message", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                room_id:       currentRoom.id,
                sender_id:     null,
                nickname:      currentRoom.nickname,
                device_id:     DEVICE_ID,
                message:       original,
                translated_ko: direction === 'VI→KO' ? translated : null,
                translated_vi: direction === 'KO→VI' ? translated : null,
            })
        })
    } catch(e) {
        console.error('[rooms] 번역 저장 실패', e)
    }
}

// ─── 토스트 ──────────────────────────────────────────────────
function showRoomToast(msg) {
    const existing = document.getElementById('room-toast')
    if (existing) existing.remove()
    const toast = document.createElement('div')
    toast.id = 'room-toast'
    toast.textContent = msg
    toast.style.cssText = `
        position:fixed; bottom:100px; left:50%;
        transform:translateX(-50%);
        background:#1a1a1a; color:#aaa;
        border:1px solid #2a2a2a;
        padding:10px 20px; border-radius:20px;
        font-size:12px; font-family:monospace;
        z-index:9999; white-space:nowrap; letter-spacing:1px;
    `
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2500)
}