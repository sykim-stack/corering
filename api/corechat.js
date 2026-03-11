// ============================================================
// BRAINPOOL | CoreRing rooms.js v2.0
// 번역기 사용 중 채팅방으로 전환하는 레이어
// - ROOM 버튼 → 방 목록
// - 방 선택 → room-layer 안에서 채팅
// - 번역 UI는 아래에 그대로 유지
// ============================================================

const roomLayer  = document.getElementById("room-layer")
const roomList   = document.getElementById("room-list")
const roomToggle = document.getElementById("room-toggle")

let rooms       = []
let currentRoom = null
let chatPolling = null

roomToggle.addEventListener("click", toggleRooms)

// ─── 토글 ────────────────────────────────────────────────────
function toggleRooms() {
    if (roomLayer.style.display === "none") {
        if (currentRoom) {
            showChatView(currentRoom)
        } else {
            loadRooms()
            showListView()
        }
        roomLayer.style.display = "block"
    } else {
        roomLayer.style.display = "none"
        stopPolling()
    }
}

// ─── 방 목록 뷰 ──────────────────────────────────────────────
function showListView() {
    roomList.innerHTML = `
        <div style="
            display:flex; justify-content:space-between;
            align-items:center; margin-bottom:20px;
        ">
            <span style="font-size:11px; letter-spacing:3px; color:#555;">CHAT ROOMS</span>
            <button onclick="createNewRoom()" style="
                background:none; border:1px solid rgba(255,255,255,0.15);
                color:#aaa; padding:6px 14px; border-radius:20px;
                font-size:10px; letter-spacing:2px; cursor:pointer;
                font-family:monospace;
            ">+ NEW ROOM</button>
        </div>
        <div id="room-items"></div>
    `
}

async function loadRooms() {
    showListView()
    try {
        const res = await fetch("/api/corechat?action=get-rooms")
        rooms = await res.json()
        renderRoomList()
    } catch(e) {
        document.getElementById("room-items").innerHTML =
            `<div style="color:#555; font-size:12px; padding:20px 0;">방 목록을 불러올 수 없습니다.</div>`
    }
}

function renderRoomList() {
    const container = document.getElementById("room-items")
    if (!container) return

    if (!rooms || rooms.length === 0) {
        container.innerHTML = `
            <div style="
                text-align:center; padding:40px 0;
                color:#444; font-size:12px; line-height:2;
            ">
                아직 채팅방이 없어요.<br>
                <span style="color:#666;">NEW ROOM으로 시작해보세요.</span>
            </div>
        `
        return
    }

    container.innerHTML = ""
    rooms.forEach(room => {
        const div = document.createElement("div")
        div.style.cssText = `
            padding:16px 12px;
            border-bottom:1px solid #1a1a1a;
            cursor:pointer;
            display:flex;
            align-items:center;
            gap:12px;
            transition:background 0.15s;
        `
        div.onmouseenter = () => div.style.background = "#111"
        div.onmouseleave = () => div.style.background = "none"

        const created = new Date(room.created_at).toLocaleDateString('ko-KR', {
            month:'short', day:'numeric'
        })

        div.innerHTML = `
            <div style="
                width:36px; height:36px; border-radius:50%;
                background:#1a1a1a; border:1px solid #2a2a2a;
                display:flex; align-items:center; justify-content:center;
                font-size:14px; flex-shrink:0;
            ">💬</div>
            <div>
                <div style="font-size:13px; color:#ddd; font-family:monospace;">
                    ${room.id.slice(0,8).toUpperCase()}
                </div>
                <div style="font-size:11px; color:#444; margin-top:2px;">${created}</div>
            </div>
        `
        div.onclick = () => enterRoom(room.id)
        container.appendChild(div)
    })
}

// ─── 방 입장 ─────────────────────────────────────────────────
function enterRoom(roomId) {
    currentRoom = roomId
    showChatView(roomId)
    loadMessages(roomId)
    startPolling(roomId)
}

// ─── 채팅 뷰 렌더 ────────────────────────────────────────────
function showChatView(roomId) {
    roomList.innerHTML = `
        <div style="
            display:flex; align-items:center; gap:12px;
            padding-bottom:16px; border-bottom:1px solid #1a1a1a;
            margin-bottom:16px;
        ">
            <button onclick="backToList()" style="
                background:none; border:none; color:#555;
                cursor:pointer; padding:0; font-size:18px;
            ">←</button>
            <span style="font-size:11px; letter-spacing:2px; color:#555; font-family:monospace;">
                ${roomId.slice(0,8).toUpperCase()}
            </span>
        </div>

        <div id="chat-messages" style="
            overflow-y:auto;
            padding-bottom:70px;
            min-height:200px;
        "></div>

        <div style="
            position:fixed; bottom:70px; left:0; right:0;
            padding:10px 16px;
            background:#0a0a0a;
            border-top:1px solid #1a1a1a;
            display:flex; gap:8px;
            z-index:60;
        ">
            <input id="room-input" type="text"
                placeholder="메시지 입력..."
                style="
                    flex:1; background:#111; border:1px solid #222;
                    border-radius:20px; padding:10px 16px;
                    color:#fff; font-size:14px; outline:none;
                "
            />
            <button onclick="submitRoomMessage()" style="
                background:none; border:1px solid #333;
                border-radius:50%; width:40px; height:40px;
                color:#aaa; cursor:pointer; font-size:16px;
                display:flex; align-items:center; justify-content:center;
                flex-shrink:0;
            ">↑</button>
        </div>
    `

    setTimeout(() => {
        const inp = document.getElementById("room-input")
        if (inp) inp.onkeypress = (e) => { if (e.key === "Enter") submitRoomMessage() }
    }, 100)
}

// ─── 메시지 로드 ─────────────────────────────────────────────
async function loadMessages(roomId) {
    try {
        const res = await fetch(`/api/corechat?action=get-messages&room_id=${roomId}`)
        const messages = await res.json()
        renderMessages(messages)
    } catch(e) {
        console.error('[rooms] 메시지 로드 실패', e)
    }
}

function renderMessages(messages) {
    const container = document.getElementById("chat-messages")
    if (!container) return

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div style="
                text-align:center; padding:40px 0;
                color:#333; font-size:12px;
            ">첫 메시지를 보내보세요.</div>
        `
        return
    }

    container.innerHTML = ""
    messages.forEach(msg => {
        const div = document.createElement("div")
        const time = new Date(msg.created_at).toLocaleTimeString('ko-KR', {
            hour:'2-digit', minute:'2-digit'
        })

        div.style.cssText = `
            margin-bottom:12px;
            display:flex;
            flex-direction:column;
            align-items:flex-start;
        `
        div.innerHTML = `
            <div style="
                background:#151515; border:1px solid #222;
                border-radius:16px 16px 16px 4px;
                padding:10px 14px; max-width:80%;
                font-size:14px; color:#ddd; line-height:1.5;
            ">${msg.message}</div>
            <div style="font-size:10px; color:#333; margin-top:4px; padding-left:4px;">
                ${time}
            </div>
        `
        container.appendChild(div)
    })

    container.scrollTop = container.scrollHeight
}

// ─── 메시지 전송 ─────────────────────────────────────────────
async function submitRoomMessage() {
    const inp = document.getElementById("room-input")
    if (!inp) return

    const message = inp.value.trim()
    if (!message || !currentRoom) return

    inp.value = ""

    try {
        await fetch("/api/corechat?action=send-message", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                room_id:   currentRoom,
                sender_id: null,
                message
            })
        })
        await loadMessages(currentRoom)
    } catch(e) {
        console.error('[rooms] 메시지 전송 실패', e)
    }
}

// ─── 새 방 생성 ──────────────────────────────────────────────
async function createNewRoom() {
    try {
        const res = await fetch("/api/corechat?action=create-room", {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id:        null,
                target_user_id: null,
                room_type:      "dm"
            })
        })
        const room = await res.json()
        if (room.id) {
            enterRoom(room.id)
        }
    } catch(e) {
        console.error('[rooms] 방 생성 실패', e)
    }
}

// ─── 목록으로 돌아가기 ───────────────────────────────────────
function backToList() {
    currentRoom = null
    stopPolling()
    loadRooms()
}

// ─── 폴링 (3초마다 새 메시지 확인) ──────────────────────────
function startPolling(roomId) {
    stopPolling()
    chatPolling = setInterval(() => {
        if (currentRoom && roomLayer.style.display !== "none") {
            loadMessages(roomId)
        }
    }, 3000)
}

function stopPolling() {
    if (chatPolling) {
        clearInterval(chatPolling)
        chatPolling = null
    }
}