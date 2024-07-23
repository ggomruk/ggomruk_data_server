const { default: axios } = require('axios');

async function fetchData() {
  const symbol = 'BTCUSDT';
  const interval = '1m';
  const endTime = new Date().getTime();
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const startTime = threeMonthsAgo.getTime();
  const limit = 4000000;

  const url = `/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;

  while (true) {
    let response = await axios.get(`https://api.binance.com${url}`);
    const responseStatus = response.status;
    const responseHeader = response.headers;
    console.log(
      `Status => ${responseStatus} || Weight => ${responseHeader['x-mbx-used-weight']}`,
    );
    if (response.status === 429 || response.status == 418) {
      console.log(responseStatus);
      console.log(responseHeader);
      break;
    }
  }
}

fetchData();
