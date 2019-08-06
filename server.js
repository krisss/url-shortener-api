const express = require('express');
const mongoose = require('mongoose');

const { Schema } = mongoose;
const bodyParser = require('body-parser');
const dns = require('dns');
require('dotenv').config();

const cors = require('cors');

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });
mongoose.set('useCreateIndex', true);
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Database
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('We are connected');
});

const schema = new Schema({
  shortURL: { type: String, required: true, unique: true },
  url: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: Date,
});

const Url = mongoose.model('urls', schema);

// Helper

const randomUrl = () =>
  Math.random()
    .toString(36)
    .substring(2, 4) +
  Math.random()
    .toString(36)
    .substring(2, 4);

// URL Shortener Routes

app.get('/', (req, res) => {
  res.json({ status: 'working' });
});

// When URL gets submitted
function checkDNS(dbURL, dnsURL, shortURL, req, res) {
  dns.resolve(dnsURL, (err, results) => {
    if (err) return res.json({ error: 'invalid URL' });
    const createURL = new Url({
      shortURL,
      url: dbURL,
      createdAt: new Date(),
    });
    createURL.save(function(err) {
      if (err) return console.log(err);
      console.log('Success!');
    });
    return res.json({ original_url: dbURL, short_url: shortURL });
  });
}

app.post('/api/shorturl/new', function(req, res) {
  let dbURL = req.body.url;
  let dnsURL = '';

  if (dbURL) {
    const test = /^https?:\/\//.test(dbURL);
    if (!test) {
      dbURL = `https://${dbURL}`;
    }
    [dnsURL] = dbURL.match(
      /(?:[-a-zA-Z0-9@:%_+~.#=]{2,256}\.)?([-a-zA-Z0-9@:%_+~#=]*)\.[a-z]{2,6}/
    );
  }

  const shortURL = randomUrl();
  Url.findOne({ url: dbURL }, (err, docs) => {
    if (err) return console.log(err);
    return docs
      ? res.json({ original_url: docs.url, short_url: docs.shortURL })
      : checkDNS(dbURL, dnsURL, shortURL, req, res);
  });
});

// When accessing short url
app.get('/:id', (req, res) => {
  const { id } = req.params;
  if (id === 'new') return res.json({ error: 'invalid URL' });
  Url.findOne({ shortURL: id }, (err, docs) => {
    if (err) return console.log(err);
    return docs
      ? res.redirect(docs.url)
      : res.json({ error: 'No short url found for given input' });
  });
});

// Get count
app.get('/api/count', (req, res) => {
  Url.estimatedDocumentCount((err, count) => {
    if (err) return console.log(err);
    return res.json({ count });
  });
});

app.listen(port, function() {
  console.log(`Node.js listening on port: ${port}`);
});
