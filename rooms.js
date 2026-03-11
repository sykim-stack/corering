// ============================================================
// BRAINPOOL | CoreRing rooms.js v1.0
// Chat Room 토글 레이어
// ============================================================

const roomLayer  = document.getElementById("room-layer")
const roomList   = document.getElementById("room-list")
const roomToggle = document.getElementById("room-toggle")

let rooms       = []
let currentRoom = null

roomToggle.addEventListener("click", toggleRooms)

function toggleRooms() {
    if (roomLayer.style.display === "none") {
        loadRooms()
        roomLayer.style.display = "block"
    } else {
        roomLayer.style.display = "none"
    }
}

async function loadRooms() {
    const res = await fetch("/api/corechat?action=get-rooms")
    rooms = await res.json()
    renderRooms()
}

function renderRooms() {
    roomList.innerHTML = ""

    rooms.forEach(room => {
        const div = document.createElement("div")
        div.className = "room-item"
        div.style = `
            padding:14px;
            border-bottom:1px solid #222;
            cursor:pointer;
        `
        div.innerText = "ROOM : " + room.id.slice(0, 8)
        div.onclick = () => enterRoom(room.id)
        roomList.appendChild(div)
    })
}

function enterRoom(roomId) {
    currentRoom = roomId
    roomLayer.style.display = "none"
    loadMessages(roomId)
}

async function loadMessages(roomId) {
    const res = await fetch(`/api/corechat?action=get-messages&room_id=${roomId}`)
    const messages = await res.json()
    // 메시지 렌더링은 engine.js에서 처리
    if (typeof renderMessages === 'function') renderMessages(messages)
}

async function sendRoomMessage(roomId, senderId, message) {
    await fetch("/api/corechat?action=send-message", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, sender_id: senderId, message })
    })
}