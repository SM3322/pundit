const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const webpush = require('web-push');

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

exports.handler = async function() {
  const db = initFirebase();

  webpush.setVapidDetails(
    'mailto:admin@pundit.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  try {
    const now = Date.now();
    const in60 = now + 60 * 60 * 1000;
    const in90 = now + 90 * 60 * 1000;

    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${today}&competitions=2021,2014,2002,2019,2015,2001,2146,2152`,
      { headers: { 'X-Auth-Token': API_TOKEN } }
    );
    const data = await res.json();

    const upcomingMatches = (data.matches || []).filter(m => {
      const kickoff = new Date(m.utcDate).getTime();
      return kickoff >= in60 && kickoff <= in90;
    });

    if (upcomingMatches.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No upcoming matches in 60-90 min' }) };
    }

    const subsSnap = await db.collection('pushSubscriptions').get();
    if (subsSnap.empty) {
      return { statusCode: 200, body: JSON.stringify({ message:
