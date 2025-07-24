
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/collab-editor';

// ----- Mongo -----
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

const DocumentSchema = new mongoose.Schema({
  _id: String,
  content: { type: String, default: '' },
}, { timestamps: true });

const Document = mongoose.model('Document', DocumentSchema);

async function findOrCreateDocument(id) {
  if (id == null) return;
  const doc = await Document.findById(id);
  if (doc) return doc;
  return await Document.create({ _id: id, content: '' });
}

// ----- Sockets -----
io.on('connection', socket => {
  console.log('🔌 Client connected', socket.id);

  socket.on('get-document', async docId => {
    const document = await findOrCreateDocument(docId);
    socket.join(docId);
    socket.emit('load-document', document.content);

    socket.on('send-changes', delta => {
      socket.to(docId).emit('receive-changes', delta);
    });

    socket.on('save-document', async data => {
      await Document.findByIdAndUpdate(docId, { content: data });
    });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
