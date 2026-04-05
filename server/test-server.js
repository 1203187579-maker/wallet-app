import express from "express";
const app = express();
const port = 9092;

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Test server listening at http://localhost:${port}/`);
});