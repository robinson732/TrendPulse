import * as admin from "firebase-admin";

let db: admin.firestore.Firestore | null = null;
let initialized = false;

function initFirebaseAdmin(): boolean {
  if (initialized) return !!db;

  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.log("[Firebase Admin] No project ID configured — Firestore sync disabled");
    initialized = true;
    return false;
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else if (serviceAccountPath) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
    } else {
      console.log("[Firebase Admin] No service account configured — add FIREBASE_SERVICE_ACCOUNT_KEY secret (JSON) or FIREBASE_SERVICE_ACCOUNT_PATH");
      console.log("[Firebase Admin] Firestore sync désactivé — les données restent en mémoire");
      initialized = true;
      return false;
    }

    db = admin.firestore();
    initialized = true;
    console.log(`[Firebase Admin] Firestore connecté — projet: ${projectId}`);
    return true;
  } catch (error: any) {
    console.log(`[Firebase Admin] Initialisation échouée: ${error.message} — sync Firestore désactivé`);
    initialized = true;
    return false;
  }
}

export interface BidDocument {
  brand: string;
  trend_id: string;
  trend_keyword: string;
  final_cpm: number;
  market_benchmark: number;
  status: string;
  ratio: number;
  velocity: string;
  category: string;
  price_validated: boolean;
  timestamp: admin.firestore.FieldValue;
}

export async function saveBidToFirebase(analysisResult: {
  brand: string;
  trendId: string;
  trendKeyword: string;
  calculatedCPM: number;
  marketBenchmark: number;
  status: string;
  ratio: number;
  velocity: string;
  category: string;
  priceValidated: boolean;
}): Promise<boolean> {
  if (!initialized) initFirebaseAdmin();
  if (!db) return false;

  try {
    const docRef = db.collection("bidding_history").doc();
    await docRef.set({
      brand: analysisResult.brand,
      trend_id: analysisResult.trendId,
      trend_keyword: analysisResult.trendKeyword,
      final_cpm: analysisResult.calculatedCPM,
      market_benchmark: analysisResult.marketBenchmark,
      status: analysisResult.status,
      ratio: analysisResult.ratio,
      velocity: analysisResult.velocity,
      category: analysisResult.category,
      price_validated: analysisResult.priceValidated,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    } as BidDocument);

    console.log(`[Firebase] 💾 Données synchronisées avec Firebase pour ${analysisResult.brand} — ${analysisResult.trendKeyword} (CPM $${analysisResult.calculatedCPM})`);
    return true;
  } catch (error: any) {
    console.log(`[Firebase] ❌ Erreur sync: ${error.message}`);
    return false;
  }
}

export async function saveBatchToFirebase(results: Array<{
  brand: string;
  trendId: string;
  trendKeyword: string;
  calculatedCPM: number;
  marketBenchmark: number;
  status: string;
  ratio: number;
  velocity: string;
  category: string;
  priceValidated: boolean;
}>): Promise<number> {
  if (!initialized) initFirebaseAdmin();
  if (!db || results.length === 0) return 0;

  try {
    const batch = db.batch();
    let count = 0;

    for (const result of results) {
      const docRef = db.collection("bidding_history").doc();
      batch.set(docRef, {
        brand: result.brand,
        trend_id: result.trendId,
        trend_keyword: result.trendKeyword,
        final_cpm: result.calculatedCPM,
        market_benchmark: result.marketBenchmark,
        status: result.status,
        ratio: result.ratio,
        velocity: result.velocity,
        category: result.category,
        price_validated: result.priceValidated,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      } as BidDocument);
      count++;
    }

    await batch.commit();
    console.log(`[Firebase] 💾 Batch sync: ${count} enchères sauvegardées dans Firestore`);
    return count;
  } catch (error: any) {
    console.log(`[Firebase] ❌ Erreur batch sync: ${error.message}`);
    return 0;
  }
}

export async function linkVideoToBrand(brandId: string, videoUrl: string): Promise<boolean> {
  if (!initialized) initFirebaseAdmin();
  if (!db) return false;

  try {
    const brandRef = db.collection("brands").doc(brandId);
    await brandRef.set({
      video_url: videoUrl,
      last_updated: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`[Firebase] 🎥 Vidéo liée avec succès à la marque : ${brandId}`);
    return true;
  } catch (error: any) {
    console.log(`[Firebase] ❌ Erreur liaison vidéo : ${error.message}`);
    return false;
  }
}

export async function getBrandVideoContent(brandId: string): Promise<string | null> {
  if (!initialized) initFirebaseAdmin();
  if (!db) return null;

  try {
    const brandDoc = await db.collection("brands").doc(brandId).get();
    if (brandDoc.exists) {
      return brandDoc.data()?.video_url || null;
    }
    return null;
  } catch (error: any) {
    console.log(`[Firebase] ❌ Erreur récupération vidéo : ${error.message}`);
    return null;
  }
}

export async function updateBrandLiveStatus(brandName: string, analysis: {
  status: string;
  calculatedCPM: number;
  aiGeneratedCopy?: string;
}): Promise<boolean> {
  if (!initialized) initFirebaseAdmin();
  if (!db) return false;

  try {
    const brandId = brandName.toLowerCase().replace(/\s+/g, "-");
    const brandRef = db.collection("brands").doc(brandId);
    await brandRef.set({
      current_status: analysis.status,
      last_cpm: analysis.calculatedCPM,
      ...(analysis.aiGeneratedCopy ? { ai_generated_copy: analysis.aiGeneratedCopy } : {}),
      last_update: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[Firebase] 🔥 Live status synchronisé pour ${brandName}`);
    return true;
  } catch (error: any) {
    console.log(`[Firebase] ❌ Erreur update live status: ${error.message}`);
    return false;
  }
}

export async function optimizeABTests(): Promise<number> {
  if (!initialized) initFirebaseAdmin();
  if (!db) return 0;

  try {
    const brandsWithTests = await db.collection("brands").where("ab_test.active", "==", true).get();
    if (brandsWithTests.empty) return 0;

    let optimized = 0;

    for (const doc of brandsWithTests.docs) {
      const data = doc.data().ab_test;
      if (!data?.variants?.a || !data?.variants?.b) continue;

      const ctrA = data.variants.a.clicks / (data.variants.a.views || 1);
      const ctrB = data.variants.b.clicks / (data.variants.b.views || 1);
      const winner = ctrA > ctrB ? "a" : "b";

      await doc.ref.update({
        dynamic_headline: data.variants[winner].text,
        "ab_test.active": false,
        last_winner: winner,
        ab_test_completed_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[A/B Test] 🏆 Le vainqueur pour ${doc.id} est la variante ${winner.toUpperCase()} (CTR A: ${(ctrA * 100).toFixed(1)}% vs B: ${(ctrB * 100).toFixed(1)}%)`);
      optimized++;
    }

    return optimized;
  } catch (error: any) {
    console.log(`[A/B Test] ❌ Erreur optimisation: ${error.message}`);
    return 0;
  }
}

export class BudgetGuardian {
  static async checkAndLockBudget(brandId: string, projectedCost: number): Promise<{ allowed: boolean; reason?: string }> {
    if (!initialized) initFirebaseAdmin();
    if (!db) return { allowed: false, reason: "Firestore non connecté" };

    try {
      const brandRef = db.collection("brands").doc(brandId);

      return await db.runTransaction(async (transaction) => {
        const brandDoc = await transaction.get(brandRef);
        if (!brandDoc.exists) return { allowed: false, reason: "Marque introuvable" };

        const data = brandDoc.data()!;
        const dailyLimit = data.daily_limit || 100;
        const lastReset = data.last_reset?.toDate().toDateString();
        const today = new Date().toDateString();

        let spentToday = data.spent_today || 0;

        if (lastReset !== today) {
          spentToday = 0;
        }

        if (spentToday + projectedCost > dailyLimit) {
          console.log(`[BudgetGuardian] 🛑 Limite journalière atteinte pour ${brandId} (${spentToday.toFixed(2)}€/${dailyLimit}€)`);
          return {
            allowed: false,
            reason: `Limite journalière atteinte (${spentToday.toFixed(2)}€/${dailyLimit}€)`,
          };
        }

        transaction.update(brandRef, {
          spent_today: spentToday + projectedCost,
          last_reset: admin.firestore.Timestamp.now(),
          updated_at: admin.firestore.Timestamp.now(),
        });

        console.log(`[BudgetGuardian] ✅ Budget réservé pour ${brandId}: ${projectedCost.toFixed(2)}€ (total: ${(spentToday + projectedCost).toFixed(2)}€/${dailyLimit}€)`);
        return { allowed: true };
      });
    } catch (error: any) {
      console.log(`[BudgetGuardian] ❌ Erreur transaction: ${error.message}`);
      return { allowed: false, reason: `Erreur: ${error.message}` };
    }
  }
}

export function isFirestoreConnected(): boolean {
  if (!initialized) initFirebaseAdmin();
  return !!db;
}
