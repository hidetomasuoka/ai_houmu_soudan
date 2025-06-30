const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// API routes
app.use('/api', require('./routes/api'));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`法務相談ツールが起動しました:`);
  console.log(`  - http://localhost:${PORT}`);
  console.log(`  - http://172.17.67.185:${PORT}`);
  console.log('プロセスID:', process.pid);
  console.log('開発モード:', process.env.NODE_ENV || 'development');
  console.log('Gemini APIキー:', process.env.GEMINI_API_KEY ? '設定済み' : '未設定');
  console.log('起動時刻:', new Date().toISOString());
  console.log('監視モード: nodemon自動再起動対応');
});