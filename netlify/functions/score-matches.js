const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
function initFirebase() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return getFirestore();
}

const API_TOKEN = "57b0d36e37034e2787d2e95e38da306d";

exports.handler = async function(event) {
  const db = initFirebase();

  try {
    // Fetch finished matches from last 2 days
    const yesterday = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const res = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${yesterday}&dateTo=${today}&status=FINISHED&competitions=2021,2014,2002,2019,2015,2001,2146,2152`,
      { headers: { 'X-Auth-Token': API_TOKEN } }
    );

    const data = await res.json();
    const finishedMatches = data.matches || [];

    if (finishedMatches.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No finished matches' }) };
    }

    let scored = 0;

    for (const match of finishedMatches) {
      const matchId = String(match.id);
      const realHome = match.score?.fullTime?.home;
      const realAway = match.score?.fullTime?.away;

      if (realHome === null || realAway === null) continue;

      // Real winner: 'home', 'away', or 'draw'
      const realWinner = realHome > realAway ? 'home' : realAway > realHome ? 'away' : 'draw';

      // Get all predictions for this match
      const predsSnap = await db.collection('predictions')
        .where('matchId', '==', matchId)
        .where('scored', '==', false)
        .get();

      if (predsSnap.empty) continue;

      const batch = db.batch();

      for (const predDoc of predsSnap.docs) {
        const pred = predDoc.data();
        let points = 0;

        const predWinner = pred.homeScore > pred.awayScore ? 'home'
          : pred.awayScore > pred.homeScore ? 'away' : 'draw';

        // 3 pts for correct winner
        if (predWinner === realWinner) points += 3;

        // +5 pts for exact score
        if (pred.homeScore === realHome && pred.awayScore === realAway) points += 5;

        // +5 pts for first scorer (manual check — stored as string, case-insensitive)
        if (pred.scorer && match.goals?.length > 0) {
          const firstGoal = match.goals[0];
          const scorerName = firstGoal?.scorer?.name?.toLowerCase() || '';
          if (scorerName && pred.scorer.toLowerCase().trim().split(' ').some(w => scorerName.includes(w))) {
            points += 5;
          }
        }

        // Update prediction doc
        batch.update(predDoc.ref, {
          points,
          scored: true,
          realHome,
          realAway,
        });

        // Update user total points
        const userRef = db.collection('users').doc(pred.userId);
        batch.update(userRef, {
          totalPoints: (await userRef.get()).data()?.totalPoints + points || points,
          exactScores: points >= 8 
            ? ((await userRef.get()).data()?.exactScores || 0) + 1 
            : (await userRef.get()).data()?.exactScores || 0,
          correctResults: predWinner === realWinner
            ? ((await userRef.get()).data()?.correctResults || 0) + 1
            : (await userRef.get()).data()?.correctResults || 0,
        });

        scored++;
      }

      await batch.commit();
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Scored ${scored} predictions` }),
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
