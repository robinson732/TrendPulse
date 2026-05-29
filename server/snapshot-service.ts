import pg from "pg";
import type { RawTrend, Velocity } from "./data-sources";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function saveSnapshot(trends: RawTrend[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const t of trends) {
      await client.query(
        `INSERT INTO trend_snapshots
          (trend_id, keyword, category, volume, volume_change, velocity, sentiment, region, platforms, related_keywords, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          t.id, t.keyword, t.category, t.volume, t.volumeChange,
          t.velocity, t.sentiment, t.region,
          JSON.stringify(t.platform),
          JSON.stringify(t.relatedKeywords),
          t.source,
        ]
      );
    }
    await client.query("COMMIT");
    console.log(`[Snapshot] Saved ${trends.length} trends at ${new Date().toISOString()}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[Snapshot] Save failed:", err);
  } finally {
    client.release();
  }
}

interface VelocityDelta {
  trendId: string;
  currentVolume: number;
  previousVolume: number;
  deltaPercent: number;
  calculatedVelocity: Velocity;
}

export async function calculateVelocity(trendIds: string[]): Promise<Map<string, VelocityDelta>> {
  const result = new Map<string, VelocityDelta>();
  if (trendIds.length === 0) return result;

  try {
    const placeholders = trendIds.map((_, i) => `$${i + 1}`).join(",");

    const latestRes = await pool.query(
      `SELECT DISTINCT ON (trend_id)
        trend_id, volume, captured_at
       FROM trend_snapshots
       WHERE trend_id IN (${placeholders})
       ORDER BY trend_id, captured_at DESC`,
      trendIds
    );

    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const previousRes = await pool.query(
      `SELECT DISTINCT ON (trend_id)
        trend_id, volume, captured_at
       FROM trend_snapshots
       WHERE trend_id IN (${placeholders}) AND captured_at <= $${trendIds.length + 1}
       ORDER BY trend_id, captured_at DESC`,
      [...trendIds, fifteenMinAgo]
    );

    const prevMap = new Map<string, number>();
    for (const row of previousRes.rows) {
      prevMap.set(row.trend_id, Number(row.volume));
    }

    for (const row of latestRes.rows) {
      const currentVol = Number(row.volume);
      const prevVol = prevMap.get(row.trend_id);
      if (prevVol === undefined) continue;

      const deltaPercent = prevVol > 0
        ? Math.round(((currentVol - prevVol) / prevVol) * 100)
        : 0;

      let calculatedVelocity: Velocity;
      if (deltaPercent > 100) calculatedVelocity = "exploding";
      else if (deltaPercent > 20) calculatedVelocity = "rising";
      else if (deltaPercent < -15) calculatedVelocity = "falling";
      else calculatedVelocity = "stable";

      result.set(row.trend_id, {
        trendId: row.trend_id,
        currentVolume: currentVol,
        previousVolume: prevVol,
        deltaPercent,
        calculatedVelocity,
      });
    }
  } catch (err) {
    console.error("[Velocity] Calculation failed:", err);
  }

  return result;
}

export async function getVolumeHistory(trendId: string, limit = 12): Promise<number[]> {
  try {
    const res = await pool.query(
      `SELECT volume FROM trend_snapshots
       WHERE trend_id = $1
       ORDER BY captured_at DESC
       LIMIT $2`,
      [trendId, limit]
    );
    return res.rows.map((r) => Number(r.volume)).reverse();
  } catch {
    return [];
  }
}

export async function cleanOldSnapshots(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await pool.query("DELETE FROM trend_snapshots WHERE captured_at < $1", [cutoff]);
  } catch (err) {
    console.error("[Snapshot] Cleanup failed:", err);
  }
}

export { pool };
