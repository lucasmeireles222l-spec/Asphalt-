// Cole no seu Worker (servidor do multiplayer). A chave service_role NUNCA vai no HTML.
// Configure uma vez:  npx wrangler secret put SUPABASE_SERVICE_KEY   (e SUPABASE_URL em [vars])
//
// Chame no fim de cada corrida online, depois de decidir a classificação final:
//   await applyRankedMatch(env, room.id + ':' + room.raceNumber, room.durationMs, [
//     { user_id: 'uuid-do-jogador', rank: 1, finished: true,  time_ms: 88123, abandon: null },
//     { user_id: 'uuid-do-outro',   rank: 2, finished: false, time_ms: null,  abandon: 'left' }  // 'left' ou 'disconnect'
//   ]);
// - match_id: texto único por corrida (6 a 64 letras/números/_/:/-). Repetir o mesmo id não pontua duas vezes.
// - rank: 1..N sem repetir; quem terminou vem antes de quem não terminou, ordenado por tempo.
// - de 2 a 8 jogadores, todos com conta (uuid do Supabase). Corridas com menos de 15 s são rejeitadas.
export async function applyRankedMatch(env, matchId, durationMs, rows) {
  try {
    const r = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/ranked_apply_match', {
      method: 'POST',
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p: { match_id: matchId, duration_ms: durationMs, rows } })
    });
    return await r.json();   // { ok:true, results:[{user_id, delta, points, division, promoted, demoted}] }
  } catch (e) { return { ok: false, error: String(e) }; }
}
