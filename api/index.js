import express from 'express';
import multer from 'multer';
import { OpenAI } from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Initialize OpenAI client
const client = new OpenAI({
  baseURL: "https://router.huggingface.co/v1",
  apiKey: process.env.HF_TOKEN,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'ArsyChat API is running' });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model = "moonshotai/Kimi-K2-Thinking:novita" } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const chatCompletion = await client.chat.completions.create({
      model: model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = chatCompletion.choices[0].message;
    res.json({ response });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message 
    });
  }
});

// Image upload endpoint
app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    // Here you can:
    // 1. Save to a cloud storage (like Cloudinary, AWS S3, etc.)
    // 2. Process the image
    // 3. Or return it directly for now
    
    res.json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: imageUrl,
      fileName: req.file.originalname,
      size: req.file.size,
      mimeType: mimeType
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload image',
      details: error.message 
    });
  }
});

// Available models endpoint
app.get('/api/models', (req, res) => {
  const models = [
    {
      id: "moonshotai/Kimi-K2-Thinking:novita",
      name: "Moonshot Kimi K2",
      description: "Advanced thinking model with strong reasoning capabilities"
    },
    {
      id: "deepseek-ai/DeepSeek-V3.2:novita",
      name: "DeepSeek V3.2",
      description: "Latest DeepSeek model with excellent performance"
    },
    {
      id: "meta-llama/Llama-3.3-70B-Instruct:novita",
      name: "Llama 3.3 70B",
      description: "Meta's powerful open-source model"
    },
    {
      id: "Qwen/Qwen2.5-72B-Instruct:novita",
      name: "Qwen 2.5 72B",
      description: "Alibaba's advanced multilingual model"
    }
  ];
  
  res.json({ models });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum is 10MB' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    details: err.message 
  });
});

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
