export async function onRequest(context) {
  const url = new URL(context.request.url);
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');

  const API_TOKEN = "57b0d36e37034e2787d2e95e38da306d";

  try {
    const res = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&competitions=2021,2014,2002,2019,2015,2001,2146,2152`,
      { headers: { 'X-Auth-Token': API_TOKEN } }
    );
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
