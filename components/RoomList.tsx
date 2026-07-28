'use client';
import { useState } from 'react';
import styles from './RoomList.module.css';

interface Room {
  roomId: string;
  title: string;
  inviteCode?: string;
  messageCount?: number;
  isPublic?: boolean;
  ownerDeviceId?: string; 
}

interface RoomListProps {
  rooms: Room[];
  myRooms?: Room[];
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: (title: string, isPublic: boolean) => void;
  onJoinByCode: (inviteCode: string) => void;
  onDeleteRoom: (roomId: string) => void;
  visible: boolean;
  deviceId?: string;
}

export default function RoomList({ rooms, myRooms = [], onSelectRoom, onCreateRoom, onJoinByCode, onDeleteRoom, visible, deviceId }: RoomListProps) {
  const [codeError, setCodeError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  if (!visible) return null;

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed.length !== 6) {
      setCodeError('6자리 코드를 입력해주세요.');
      return;
    }
    setCodeError('');
    onJoinByCode(trimmed);
    setCode('');
  };

  const handleCreate = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onCreateRoom(trimmed, isPublic);
    setNewTitle('');
    setIsPublic(true);
    setShowCreateForm(false);
  };

  return (
    <div className="room-overlay">
      <div className={styles.inner}>

        {/* 초대코드 입장 */}
        <div className={styles.joinSection}>
          <div className={styles.joinRow}>
            <input
              className={styles.joinInput}
              type="text"
              placeholder="초대코드 6자리"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <button className={styles.joinBtn} onClick={handleJoin}>입장</button>
          </div>
          {codeError && <p className={styles.joinError}>{codeError}</p>}
        </div>

        {/* 내가 참여한 방 */}
        {myRooms.length > 0 && (
          <>
            <div className={styles.divider}>내가 참여한 방</div>
            {myRooms.map((room) => (
              <div
                key={room.roomId}
                className={`room-item ${styles.roomItem}`}
              >
                <div onClick={() => onSelectRoom(room.roomId)} style={{ flex: 1 }}>
                  {!room.isPublic && '🔒 '}{room.title}
                  {room.inviteCode && (
                    <div className={`room-meta ${styles.inviteCode}`}>
                      코드: {room.inviteCode}
                    </div>
                  )}
                </div>
                {room.ownerDeviceId === deviceId && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => { e.stopPropagation(); onDeleteRoom(room.roomId); }}
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        <div className={styles.divider}>공개 방 목록</div>

        {/* 방 생성 폼 */}
        {!showCreateForm ? (
          <button onClick={() => setShowCreateForm(true)} className={styles.createBtn}>
            + 새 채팅방 만들기
          </button>
        ) : (
          <div className={styles.createForm}>
            <input
              className={styles.createInput}
              type="text"
              placeholder="방 제목"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <label className={styles.privateCheck}>
              <input
                type="checkbox"
                checked={!isPublic}
                onChange={(e) => setIsPublic(!e.target.checked)}
              />
              비공개방으로 만들기
            </label>
            <div className={styles.createActions}>
              <button className={styles.cancelBtn} onClick={() => { setShowCreateForm(false); setNewTitle(''); }}>취소</button>
              <button className={styles.confirmBtn} onClick={handleCreate} disabled={!newTitle.trim()}>만들기</button>
            </div>
          </div>
        )}

        {/* 공개 방 목록 */}
        {rooms.length === 0 && (
          <p className={styles.empty}>공개 방이 없습니다</p>
        )}
        {rooms.map((room) => (
          <div
            key={room.roomId}
            className={`room-item ${styles.roomItem}`}
          >
            <div onClick={() => onSelectRoom(room.roomId)} style={{ flex: 1 }}>
              {room.title}
              {room.inviteCode && (
                <div className={`room-meta ${styles.inviteCode}`}>
                  코드: {room.inviteCode}
                </div>
              )}
            </div>
            <button
              className={styles.deleteBtn}
              onClick={(e) => { e.stopPropagation(); onDeleteRoom(room.roomId); }}
            >
              삭제
            </button>
          </div>
        ))}

      </div>
    </div>
  );
}