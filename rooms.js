// ============================================================
// BRAINPOOL | CoreRing rooms.js v6.0
// - 방 목록 → 방 클릭 → 채팅 화면 (레이어)
// - 닉네임 표시, 내 메시지 왼쪽 / 상대 오른쪽
// - 3초 폴링 실시간 수신
// - 나가기 → 번역기로 복귀
// - 방 삭제 (방장만)
// - 번역 결과 자동 저장
// ============================================================

const roomLayer  = document.getElementById("room-layer")
const roomList   = document.getElementById("room-list")
const roomToggle = document.getElementById("room-toggle")

let rooms            = []
let currentRoom      = null
let pollingTimer     = null
let lastMsgTimestamp = null
const sentMsgIds     = new Set()  // 내가 보낸 메시지 ID 추적

// ─── device_id / nickname ────────────────────────────────────
function getDeviceId() {
    let id = localStorage.getItem('cr_device_id')
    if (!id) {
        id = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        localStorage.setItem('cr_device_id', id)
    }
    return id
}
function getNickname()        { return localStorage.getItem('cr_nickname') || null }
function saveNickname(name)   { localStorage.setItem('cr_nickname', name) }

const DEVICE_ID = getDeviceId()

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
        showRoomListView()
        roomLayer.style.display = "block"
    } else {
        roomLayer.style.display = "none"
    }
}

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
        div.onclick = () => enterRoomWithNickname(room)
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
            if (typeof switchToChatMode === 'function') switchToChatMode(room)  // ← 추가
            const layer = document.getElementById('room-layer')
            if (layer) layer.style.display = 'none'  // ← 레이어 닫기
        } else {
            showRoomToast('존재하지 않는 코드입니다.')
        }
    } catch(e) { showRoomToast('입장 실패') }
}

// ─── 닉네임 확인 후 입장 ─────────────────────────────────────
function enterRoomWithNickname(room) {
    const nickname = getNickname()
    if (nickname && nickname.trim()) {
        openChatView(room, nickname.trim())
    } else {
        localStorage.removeItem('cr_nickname')  // 혹시 빈 값 제거
        showNicknameModal({ onConfirm: (name) => {
            saveNickname(name.trim())
            openChatView(room, name.trim())
        }})
    }
}

// ============================================================
// VIEW: 채팅 화면
// ============================================================
function openChatView(room, nickname) {
    currentRoom = { ...room, nickname }
    // 폴링 기준시각 먼저 설정 (loadMessages 완료 전 새 메시지 유실 방지)
    lastMsgTimestamp = new Date().toISOString()

    roomList.innerHTML = `
        <!-- 헤더 -->
        <div style="
            display:flex; align-items:center; gap:12px;
            margin:-20px -20px 16px -20px; padding:16px 20px;
            background:#0d1a0d; border-bottom:1px solid #1a3a1a;
        ">
            <button onclick="exitChatView()" style="
                background:none; border:none; color:#4a9a4a;
                font-size:20px; cursor:pointer; padding:4px 8px;
            ">←</button>
            <div style="flex:1;">
                <div style="font-size:16px; font-family:monospace; letter-spacing:3px; color:#6aba6a; font-weight:700;">
                    💬 ${room.invite_code}
                </div>
                <div style="font-size:12px; color:#4a7a4a; margin-top:2px;">
                    ${nickname} 으로 입장 중
                </div>
            </div>
            <button onclick="shareInviteCode('${room.invite_code}')" style="
                background:#1a3a1a; border:1px solid #2a5a2a; color:#6aba6a;
                padding:6px 14px; border-radius:12px;
                font-size:11px; cursor:pointer; font-family:monospace;
            ">+ 초대</button>
        </div>

        <!-- 메시지 영역 -->
        <div id="chat-messages" style="
            flex:1; overflow-y:auto;
            display:flex; flex-direction:column; gap:12px;
            padding-bottom:16px;
            height: calc(100% - 140px);
        ">
            <div style="color:#333; font-size:12px; text-align:center; padding:20px 0;">불러오는 중...</div>
        </div>

        <!-- 입력 영역 -->
        <div style="
            position:sticky; bottom:0;
            background:#0a0a0a; padding:12px 0 0;
            border-top:1px solid #1a1a1a;
            display:flex; gap:8px;
        ">
            <input id="chat-input" type="text" placeholder="메시지 입력..."
                style="
                    flex:1; background:#111; border:1px solid #2a2a2a;
                    border-radius:24px; padding:12px 18px;
                    color:#fff; font-size:14px; outline:none;
                "
            />
            <button onclick="sendChatMessage()" style="
                background:none; border:1px solid #333; color:#888;
                width:44px; height:44px; border-radius:50%;
                font-size:18px; cursor:pointer; flex-shrink:0;
            ">↑</button>
        </div>
    `

    const inp = document.getElementById("chat-input")
    if (inp) inp.onkeypress = (e) => { if (e.key === "Enter") sendChatMessage() }

    updateRoomHeader(room.invite_code)
    loadMessages()
    startPolling(room.id)
}

// ─── 나가기 → 번역기로 복귀 ──────────────────────────────────
function exitChatMode() {
    stopPolling()
    currentRoom = null
    clearRoomHeader()
    // room-layer 닫기
    const layer = document.getElementById('room-layer')
    if (layer) layer.style.display = 'none'
    if (typeof switchToRingMode === 'function') switchToRingMode()
    showRoomToast('번역기로 돌아왔습니다.')
}

// ─── 메시지 로드 ─────────────────────────────────────────────
async function loadMessages() {
    if (!currentRoom) return
    try {
        const res = await fetch(`/api/corechat?action=get-messages&room_id=${currentRoom.id}`)
        const messages = await res.json()
        renderMessages(messages)
    } catch(e) {
        const el = document.getElementById("chat-messages")
        if (el) el.innerHTML = `<div style="color:#555; font-size:12px; text-align:center; padding:20px;">메시지를 불러올 수 없습니다.</div>`
    }
}

function renderMessages(messages) {
    const container = document.getElementById("chat-messages")
    if (!container) return
    if (!messages || messages.length === 0) {
        container.innerHTML = `<div style="color:#333; font-size:12px; text-align:center; padding:40px 0;">
            아직 메시지가 없어요.<br><span style="color:#2a2a2a;">번역하면 자동으로 저장됩니다.</span>
        </div>`
        return
    }

    container.innerHTML = ""
    messages.forEach(msg => appendMessage(msg, false))
    container.scrollTop = container.scrollHeight

    // 기존 메시지 중 가장 최신 타임스탬프로 업데이트 (폴링 기준점)
    if (messages.length > 0) {
        const latest = messages[messages.length - 1].created_at
        if (latest > lastMsgTimestamp) lastMsgTimestamp = latest
    }
}

function appendMessage(msg, scroll = true) {
    const container = document.getElementById("chat-messages")
    if (!container) return

    const isMe      = msg.device_id === DEVICE_ID
    const nickname  = msg.nickname || '익명'
    const content   = msg.translated_ko || msg.translated_vi || msg.message
    const original  = (msg.translated_ko || msg.translated_vi) ? msg.message : null
    const time      = new Date(msg.created_at).toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'})

    // 중복 방지: data-msg-id로 이미 있으면 skip
    if (msg.id && container.querySelector(`[data-msg-id="${msg.id}"]`)) return

    const wrapper = document.createElement('div')
    wrapper.style.cssText = `
        display:flex;
        flex-direction:column;
        align-items:${isMe ? 'flex-end' : 'flex-start'};
    `
    if (msg.id) wrapper.dataset.msgId = msg.id

    wrapper.innerHTML = `
        <div style="font-size:11px; color:${isMe ? '#6aba6a' : '#8a8aaa'}; margin-bottom:4px;
            font-family:monospace; font-weight:600; letter-spacing:1px;">
            ${isMe ? '👤 ' : '💬 '}${nickname}
        </div>
        <div style="
            max-width:75%; padding:12px 16px;
            background:${isMe ? '#0d1a0d' : '#111'};
            border:1px solid ${isMe ? '#2a5a2a' : '#2a2a3a'};
            border-radius:${isMe ? '20px 4px 20px 20px' : '4px 20px 20px 20px'};
            color:${isMe ? '#b0d8b0' : '#c0c0dd'}; font-size:14px; line-height:1.6;
        ">
            ${content}
            ${original ? `<div style="font-size:11px; color:#556; margin-top:6px; border-top:1px solid #2a2a3a; padding-top:6px;">${original}</div>` : ''}
        </div>
        <div style="font-size:10px; color:#444; margin-top:4px;">${time}</div>
    `

    container.appendChild(wrapper)
    if (scroll) container.scrollTop = container.scrollHeight
}

// ─── 메시지 전송 ─────────────────────────────────────────────
async function sendChatMessage() {
    const inp = document.getElementById("chat-input")
    if (!inp || !currentRoom) return
    const text = inp.value.trim()
    if (!text) return
    inp.value = ""

    const msg = {
        room_id:   currentRoom.id,
        nickname:  currentRoom.nickname,
        device_id: DEVICE_ID,
        message:   text,
    }

    // 낙관적 UI (바로 표시) - 임시 id로 중복 방지
    const tempId = 'temp_' + Date.now()
    appendMessage({ ...msg, id: tempId, created_at: new Date().toISOString() })

    try {
        const res  = await fetch("/api/corechat?action=send-message", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg)
        })
        const data = await res.json()
        if (data?.[0]?.id) sentMsgIds.add(data[0].id)
    } catch(e) { console.error('[chat] 전송 실패', e) }
}

// ─── 폴링 ────────────────────────────────────────────────────
function startPolling(roomId) {
    stopPolling()
    if (!lastMsgTimestamp) {
        lastMsgTimestamp = new Date().toISOString()
    }
    pollingTimer = setInterval(async () => {
        if (!currentRoom || !document.getElementById("chat-history")) {
            stopPolling(); return
        }
        try {
            const url = `/api/corechat?action=get-messages&room_id=${currentRoom.id}&after=${encodeURIComponent(lastMsgTimestamp)}`
            const res  = await fetch(url)
            const msgs = await res.json()
            if (!msgs || msgs.length === 0) return

            msgs.filter(m => m.device_id !== DEVICE_ID && !sentMsgIds.has(m.id))
                .forEach(m => {
                    if (typeof appendChatToHistory === 'function') {
                        appendChatToHistory(m)   // engine.js로 전달
                    }
                })
            lastMsgTimestamp = msgs[msgs.length - 1].created_at
        } catch(e) {}
    }, 3000)
}

function stopPolling() {
    if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null }
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
            if (currentRoom) {
                showRoomListView()
                roomLayer.style.display = "block"
            } else {
                toggleRooms()
            }
        }
        roomToggle.parentNode.insertBefore(indicator, roomToggle)
    }
    indicator.textContent = `● ${code}`
}

function clearRoomHeader() {
    const el = document.getElementById("room-indicator")
    if (el) el.remove()
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
                console.error('방 생성 API 오류:', data)
                showRoomToast('방 생성 실패: ' + (data.error || data.detail || res.status))
                return
            }

            const room = data.room || data
            if (room?.id) {
                const layer = document.getElementById('room-layer')
                if (layer) layer.style.display = 'none'   // ← 추가
                if (typeof switchToChatMode === 'function') switchToChatMode(room)
                shareInviteCode(room.invite_code)
            } else {
                console.error('room.id 없음:', data)
                showRoomToast('방 생성 실패')
            }
        } catch(e) {
            console.error('방 생성 예외:', e)
            showRoomToast('방 생성 실패')
        }
    }
    // ↓ 이 2줄이 빠져있었음
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
            if (currentRoom?.id === roomId) exitChatView()
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
                <a href="https://open.kakao.com/o/share?text=${encodedText}"
                   target="_blank" style="display:block; text-align:center; background:#FAE100;
                   color:#3A1D1D; padding:14px; border-radius:16px; font-size:14px;
                   text-decoration:none; font-weight:600;">카카오로 공유</a>
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

// ─── 번역 결과 자동 저장 (engine.js에서 호출) ────────────────
async function sendTranslationToRoom(original, translated, direction) {
    if (!currentRoom) return
    if (!original || !translated) return
    const isKoResult = direction === 'VI→KO'
    try {
        const tres = await fetch("/api/corechat?action=send-message", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                room_id:       currentRoom.id,
                nickname:      currentRoom.nickname,
                device_id:     DEVICE_ID,
                message:       original,
                translated_ko: isKoResult ? translated : null,
                translated_vi: !isKoResult ? translated : null,
            })
        })
        const tdata = await tres.json()
        if (tdata?.[0]?.id) sentMsgIds.add(tdata[0].id)
        // 번역 결과 채팅창에 직접 표시 (내 것)
        if (document.getElementById('chat-messages')) {
            appendMessage({
                id: tdata?.[0]?.id || 'trans_' + Date.now(),
                device_id: DEVICE_ID,
                nickname: currentRoom.nickname,
                message: original,
                translated_ko: isKoResult ? translated : null,
                translated_vi: !isKoResult ? translated : null,
                created_at: new Date().toISOString()
            })
        }
    } catch(e) { console.error('[rooms] 번역 저장 실패', e) }
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
            <input id="nickname-input" type="text" maxlength="20" placeholder="상요이"
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