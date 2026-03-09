exports.handler = async function(event) {
  const API_TOKEN = "57b0d36e37034e2787d2e95e38da306d";
  const { dateFrom, dateTo } = event.queryStringParameters || {};

  const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&competitions=2021,2014,2002,2019,2015,2001,2146,2152`;

  try {
    const res = await fetch(url, {
      headers: { "X-Auth-Token": API_TOKEN }
    });

    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
