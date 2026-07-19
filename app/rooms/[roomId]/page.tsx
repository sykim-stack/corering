import { getRoomMetadata } from '@/lib/seo/room';
import Home from '@/app/page'; // default export 재사용

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return getRoomMetadata(roomId);
}

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <Home initialRoomId={roomId} />;
}