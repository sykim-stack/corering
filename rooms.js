// ============================================================
// BRAINPOOL | CoreRing rooms.js v4.0
// - 링크 클릭 → 바로 입장 (부부용)
// - 6자리 코드 입력 → 입장 (제3자용)
// - 코드 입력 박스 blur 시 자동 닫힘
// - 번역 결과 자동으로 채팅방 저장
// ============================================================

const roomLayer  = document.getElementById("room-layer")
const roomList   = document.getElementById("room-list")
const roomToggle = document.getElementById("room-toggle")

let rooms       = []
let currentRoom = null
let chatPolling = null

roomToggle.addEventListener("click", toggleRooms)

// ─── 앱 시작 시 URL 파라미터로 자동 입장 ────────────────────
;(async function autoJoinFromURL() {
    const params = new URLSearchParams(window.location.search)
    const code   = params.get('room')
    if (!code) return

    // URL에서 room 파라미터 제거 (뒤로가기 방지)
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, '', cleanUrl)

    try {
        const res = await fetch("/api/corechat?action=join-room", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invite_code: code.toUpperCase(), role: 'guest' })
        })
        const room = await res.json()
        if (room.id) {
            enterRoom(room)
            showRoomToast(`${room.invite_code} 방에 입장했습니다`)
        }
    } catch(e) {
        console.error('[rooms] URL 자동 입장 실패', e)
    }
})()

// ─── 토글 ────────────────────────────────────────────────────
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
            <div style="display:flex; align-items:center; gap:12px;" onclick="">
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
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:6px;">
                <button onclick="event.stopPropagation(); shareInviteCode('${room.invite_code}')" style="
                    background:none; border:1px solid #2a2a2a;
                    color:#555; padding:4px 10px; border-radius:12px;
                    font-size:10px; cursor:pointer; font-family:monospace;
                ">공유</button>
                ${isActive ? `<button onclick="event.stopPropagation(); leaveRoom()" style="
                    background:none; border:1px solid #3a1a1a;
                    color:#a55; padding:4px 10px; border-radius:12px;
                    font-size:10px; cursor:pointer; font-family:monospace;
                ">나가기</button>` : ''}
            </div>
        `
        div.onclick = () => enterRoom(room)
        container.appendChild(div)
    })
}

// ─── 코드 입력 박스 (blur 시 자동 닫힘) ─────────────────────
function showJoinInput() {
    const container = document.getElementById("room-items")
    if (!container || document.getElementById("join-box")) return

    container.insertAdjacentHTML('afterbegin', `
        <div id="join-box" style="
            background:#111; border:1px solid #2a2a2a;
            border-radius:16px; padding:16px; margin-bottom:16px;
        ">
            <div style="font-size:11px; color:#555; letter-spacing:2px; margin-bottom:10px;">
                제3자 초대 코드 입력
            </div>
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

    // blur 시 입력값 없으면 3초 후 자동 닫힘
    inp.onblur = () => {
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
    if (code.length !== 6) {
        showRoomToast('6자리 코드를 입력하세요')
        return
    }

    try {
        const res = await fetch("/api/corechat?action=join-room", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invite_code: code, role: 'guest' })
        })
        const room = await res.json()
        if (room.id) {
            enterRoom(room)
        } else {
            showRoomToast('존재하지 않는 코드입니다.')
        }
    } catch(e) {
        showRoomToast('입장 실패')
    }
}

// ─── 방 입장 ─────────────────────────────────────────────────
function enterRoom(room) {
    currentRoom = room
    roomLayer.style.display = "none"
    updateRoomHeader(room.invite_code)
    startPolling(room.id)
}

// ─── 방 나가기 ───────────────────────────────────────────────
function leaveRoom() {
    currentRoom = null
    stopPolling()
    clearRoomHeader()
    showRoomToast('방에서 나왔습니다.')
    loadRooms()
}

// ─── 헤더 방 표시 ────────────────────────────────────────────
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
    const indicator = document.getElementById("room-indicator")
    if (indicator) indicator.remove()
}

// ─── 새 방 생성 ──────────────────────────────────────────────
async function createNewRoom() {
    try {
        const res = await fetch("/api/corechat?action=create-room", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_type: "dm" })
        })
        const room = await res.json()
        if (room.id) {
            enterRoom(room)
            shareInviteCode(room.invite_code)
        }
    } catch(e) {
        showRoomToast('방 생성 실패')
    }
}

// ─── 초대 코드 공유 (링크 방식) ──────────────────────────────
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
                sender_role:   'translator',
                message:       original,
                translated_ko: direction === 'VI→KO' ? translated : null,
                translated_vi: direction === 'KO→VI' ? translated : null,
            })
        })
    } catch(e) {
        console.error('[rooms] 번역 저장 실패', e)
    }
}

// ─── 폴링 ────────────────────────────────────────────────────
function startPolling(roomId) {
    stopPolling()
    chatPolling = setInterval(() => {
        if (!currentRoom) stopPolling()
    }, 5000)
}

function stopPolling() {
    if (chatPolling) { clearInterval(chatPolling); chatPolling = null }
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