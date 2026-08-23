// fix_repetition_count.cjs
// 목적: CoreHub(클로4)와 합의된 repetition_count 스키마 구현.
//   repetition_count       : 최근 repetition_window_sec 내 동일 device_id가
//                             동일 intent로 보낸 메시지 수 (이번 메시지 포함)
//   repetition_window_sec  : 300 (초기값)
//   repetition_basis       : 'intent'
//   집계 범위: messages 테이블만 (tb_trans_logs 제외)
//
// 설계 메모:
//   - 백그라운드 분석 블록(Promise.resolve().then)이 메시지 INSERT보다 코드상
//     먼저 스케줄되는 구조라, 방금 INSERT된 메시지의 실제 DB id를 그 클로저
//     안에서 안전하게 참조할 방법이 없음 (result 변수 TDZ/레이스 위험).
//     → room_id + device_id + content로 재조회하는 방식으로 우회.
//     동일 텍스트를 아주 짧은 간격으로 두 번 보내는 경우에만 부정확할 수 있음
//     (초기 구현 수준에서는 감수).
//   - 기존 tb_trans_logs UPDATE 로직은 무수정, 같은 try 블록 안에 형제로 추가.
//
// 실행: 저장소 루트에서 `node fix_repetition_count.cjs`

const fs = require('fs');
const path = require('path');

console.log('🛡️ repetition_count 구현 시작...\n');

// ── STEP 1: app/api/chat/route.ts 패치 ────────────────────────────
const routePath = path.join('app', 'api', 'chat', 'route.ts');
let routeSrc = fs.readFileSync(routePath, 'utf8');

const routeBefore = `                } else {
                  // fallback: source_text로 기존 행 찾아서 UPDATE 또는 INSERT
                  const { data: existing } = await db
                    .from('tb_trans_logs').select('id')
                    .eq('source_text', original).eq('direction', direction)
                    .order('created_at', { ascending: false }).limit(1);
                  const existingId = existing?.[0]?.id;
                  if (existingId) {
                    await db.from('tb_trans_logs').update(updatePayload).eq('id', existingId);
                  } else {
                    await db.from('tb_trans_logs').insert({
                      source_text: original,
                      standard_vi: ctx.payload?.translatedText || original,
                      direction,
                      ...updatePayload,
                    });
                  }
                }
              }
            } catch (e: any) {
              console.warn('[chat/send] 백그라운드 분석 실패:', e.message);
            }`;

const routeAfter = `                } else {
                  // fallback: source_text로 기존 행 찾아서 UPDATE 또는 INSERT
                  const { data: existing } = await db
                    .from('tb_trans_logs').select('id')
                    .eq('source_text', original).eq('direction', direction)
                    .order('created_at', { ascending: false }).limit(1);
                  const existingId = existing?.[0]?.id;
                  if (existingId) {
                    await db.from('tb_trans_logs').update(updatePayload).eq('id', existingId);
                  } else {
                    await db.from('tb_trans_logs').insert({
                      source_text: original,
                      standard_vi: ctx.payload?.translatedText || original,
                      direction,
                      ...updatePayload,
                    });
                  }
                }
              }

              // ── repetition_count 계산 (CoreHub 합의 스키마) ──────
              // intent 기준, 300초 윈도우, messages 테이블 한정.
              // tb_trans_logs의 frequency/consistency(배치 집계)와는 별개 로직.
              try {
                if (db && ap?.intent) {
                  const REPETITION_WINDOW_SEC = 300;
                  const windowStart = new Date(Date.now() - REPETITION_WINDOW_SEC * 1000).toISOString();

                  const { count, error: countError } = await db
                    .from('messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('room_id', roomId)
                    .eq('device_id', userId)
                    .eq('meta->>intent', ap.intent)
                    .gte('created_at', windowStart);

                  if (countError) {
                    console.warn('[chat/send] repetition_count 조회 실패:', countError.message);
                  } else {
                    // 방금 보낸 메시지 행을 room_id+device_id+content로 재특정
                    const { data: targetRow, error: findError } = await db
                      .from('messages')
                      .select('id, meta')
                      .eq('room_id', roomId)
                      .eq('device_id', userId)
                      .eq('content', original)
                      .order('created_at', { ascending: false })
                      .limit(1)
                      .maybeSingle();

                    if (!findError && targetRow?.id) {
                      const repetitionCount = (count ?? 0) + 1; // 이번 메시지(자기 자신) 포함
                      const mergedMeta = {
                        ...(targetRow.meta || {}),
                        intent: ap.intent,
                        repetitionCount,
                        repetitionWindowSec: REPETITION_WINDOW_SEC,
                        repetitionBasis: 'intent',
                      };
                      const { error: updateError } = await db
                        .from('messages')
                        .update({ meta: mergedMeta })
                        .eq('id', targetRow.id);
                      if (updateError) {
                        console.warn('[chat/send] repetition_count 저장 실패:', updateError.message);
                      } else {
                        console.log(\`[chat/send] repetition_count=\${repetitionCount} intent=\${ap.intent} messageId=\${targetRow.id}\`);
                      }
                    }
                  }
                }
              } catch (e: any) {
                console.warn('[chat/send] repetition_count 계산 예외:', e.message);
              }
            } catch (e: any) {
              console.warn('[chat/send] 백그라운드 분석 실패:', e.message);
            }`;

if (routeSrc.includes('repetition_count 계산')) {
  console.log('SKIP route.ts: repetition_count 로직 이미 있음');
} else if (routeSrc.includes(routeBefore)) {
  routeSrc = routeSrc.replace(routeBefore, routeAfter);
  fs.writeFileSync(routePath, routeSrc, 'utf8');
  console.log('OK route.ts: repetition_count 계산 로직 추가 완료');
} else {
  console.log('X route.ts: anchor 못 찾음 — 수동 확인 필요 (해당 구간을 붙여넣어 주시면 재조정하겠습니다)');
}

// ── STEP 2: brain-engine/engines/chat/message.js — getHistory 응답에 필드 노출 ──
const messagePath = path.join('brain-engine', 'engines', 'chat', 'message.js');
let msgSrc = fs.readFileSync(messagePath, 'utf8');

const msgBefore = `      detectedDialect: m.meta?.detectedDialect || 'unknown',
      isSouthern:   m.meta?.isSouthern ?? false,
      culturalNote: m.meta?.culturalNote || null,
      timestamp:    m.created_at,
    };
  })};
}`;

const msgAfter = `      detectedDialect: m.meta?.detectedDialect || 'unknown',
      isSouthern:   m.meta?.isSouthern ?? false,
      culturalNote: m.meta?.culturalNote || null,
      repetitionCount:      m.meta?.repetitionCount ?? null,
      repetitionWindowSec:  m.meta?.repetitionWindowSec ?? null,
      repetitionBasis:      m.meta?.repetitionBasis ?? null,
      timestamp:    m.created_at,
    };
  })};
}`;

if (msgSrc.includes('repetitionCount:')) {
  console.log('SKIP message.js: repetitionCount 필드 이미 노출됨');
} else if (msgSrc.includes(msgBefore)) {
  msgSrc = msgSrc.replace(msgBefore, msgAfter);
  fs.writeFileSync(messagePath, msgSrc, 'utf8');
  console.log('OK message.js: getHistory에 repetitionCount 필드 노출 완료');
} else {
  console.log('X message.js: anchor 못 찾음 — 수동 확인 필요');
}

console.log('\n✅ 완료. `npx next build`로 빌드 확인 후 커밋하세요.');
console.log('   실제 확인은 채팅방에서 비슷한 의도의 메시지를 5분 내 여러 번 보낸 뒤');
console.log('   Supabase messages 테이블의 meta 컬럼에서 repetitionCount 증가를 확인하면 됩니다.');
