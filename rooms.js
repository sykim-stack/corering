const roomLayer = document.getElementById("room-layer")
const roomList = document.getElementById("room-list")
const roomToggle = document.getElementById("room-toggle")

let rooms = []
let currentRoom = null

roomToggle.addEventListener("click", toggleRooms)

function toggleRooms(){

    if(roomLayer.style.display === "none"){
        loadRooms()
        roomLayer.style.display = "block"
    }else{
        roomLayer.style.display = "none"
    }

}

async function loadRooms(){

    const res = await fetch("/api/get_rooms")
    rooms = await res.json()

    renderRooms()

}

function renderRooms(){

    roomList.innerHTML = ""

    rooms.forEach(room=>{

        const div = document.createElement("div")

        div.className = "room-item"

        div.style = `
        padding:14px;
        border-bottom:1px solid #222;
        cursor:pointer;
        `

        div.innerText = "ROOM : " + room.id.slice(0,8)

        div.onclick = ()=> enterRoom(room.id)

        roomList.appendChild(div)

    })

}

function enterRoom(roomId){

    currentRoom = roomId

    roomLayer.style.display = "none"

    loadMessages(roomId)

}