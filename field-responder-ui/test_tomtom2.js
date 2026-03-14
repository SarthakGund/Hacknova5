const https = require('https');
const url = new URL("https://api.tomtom.com/routing/1/calculateRoute/19.0760,72.8777:19.0860,72.8877/json?key=rPkINXjVqYkxPzUSfIKO2U8AvW3iKD6f");
const data = JSON.stringify({
  avoidAreas: {
    rectangles: [
      {
        southWestCorner: { latitude: 19.0750, longitude: 72.8760 },
        northEastCorner: { latitude: 19.0770, longitude: 72.8780 }
      }
    ]
  }
});
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};
const req = https.request(url, options, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(res.statusCode, body.substring(0, 500)));
});
req.on('error', e => console.error(e));
req.write(data);
req.end();
