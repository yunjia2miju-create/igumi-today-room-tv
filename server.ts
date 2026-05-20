import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { defaultPosts } from './src/data';
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  const DATA_DIR = path.join(process.cwd(), 'data');
  const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
  const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Ensure posts.json exists with default posts
  if (!fs.existsSync(POSTS_FILE)) {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(defaultPosts, null, 2), 'utf-8');
  }

  // Ensure inquiries.json exists
  if (!fs.existsSync(INQUIRIES_FILE)) {
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }

  // Helper functions for reading/writing
  function readPosts() {
    try {
      if (fs.existsSync(POSTS_FILE)) {
        const data = fs.readFileSync(POSTS_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Error reading posts:", err);
    }
    return defaultPosts;
  }

  function writePosts(posts: any) {
    try {
      fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf-8');
    } catch (err) {
      console.error("Error writing posts:", err);
    }
  }

  function readInquiries() {
    try {
      if (fs.existsSync(INQUIRIES_FILE)) {
        const data = fs.readFileSync(INQUIRIES_FILE, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error("Error reading inquiries:", err);
    }
    return [];
  }

  function writeInquiries(inqs: any) {
    try {
      fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inqs, null, 2), 'utf-8');
    } catch (err) {
      console.error("Error writing inquiries:", err);
    }
  }
  
  app.use(express.json({ limit: '50mb' }));

  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  const parsingSchema = {
    type: Type.OBJECT,
    properties: {
        transactionType: { type: Type.STRING },
        category: { type: Type.STRING },
        dong: { type: Type.STRING },
        building: { type: Type.STRING },
        room: { type: Type.STRING },
        floor: { type: Type.STRING },
        totalFloor: { type: Type.STRING },
        price: { type: Type.STRING },
        manageFee: { type: Type.STRING },
        phone: { type: Type.STRING },
        ownerPhone: { type: Type.STRING },
        title: { type: Type.STRING },
        remarks: { type: Type.STRING },
        intro: { type: Type.STRING },
        body: { type: Type.STRING },
        panoImage: { type: Type.STRING },
        address: { type: Type.STRING },
        isRecommended: { type: Type.BOOLEAN }
    }
  };

  app.post('/api/gemini/parse', async (req, res): Promise<void> => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
           res.status(500).json({ error: "API 키 설정 누락: 오른쪽 상단 'Settings > Secrets'에서 GEMINI_API_KEY를 설정했는지 확인해 주세요. 이미 설정했다면 페이지를 새로고침 하거나, 기존 키를 삭제하고 다시 등록해 보세요." });
           return;
        }
        const ai = new GoogleGenAI({ 
            apiKey,
            httpOptions: {
                headers: {
                    'User-Agent': 'aistudio-build',
                }
            }
        });

        const { rawText } = req.body;
        console.log("Processing /api/gemini/parse request");
        
        let response;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount <= maxRetries) {
            try {
                response = await ai.models.generateContent({
                    model: "gemini-1.5-flash",
                    contents: `매물 정보: ${rawText}`,
                    config: {
                        systemInstruction: "매물 원고를 해독해 JSON 규격에 맞게 파싱하세요. 비어있거나 모호한 값은 빈 문자열(\"\")로 처리하세요. 거래형태는 '매매', '전세', '월세' 중 하나여야 합니다. 매물 분류와 소재지 동은 한국어로 정확히 추출하세요. 해당층(floor)과 총층(totalFloor) 정보를 '3/4층' 같은 텍스트에서 분리하여 정확히 추출하세요.",
                        responseMimeType: "application/json",
                        responseSchema: parsingSchema
                    }
                });
                break; // Success, exit loop
            } catch (error: any) {
                if ((error.message?.includes("429") || error.message?.includes("quota")) && retryCount < maxRetries) {
                    retryCount++;
                    const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
                    console.warn(`Quota exceeded, retrying in ${delay}ms... (Attempt ${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }
        
        if (!response) throw new Error("AI 응답을 생성하지 못했습니다.");
        const text = response.text;
        if (!text) {
            console.error("Gemini Response Empty. Finish Reason:", response.candidates?.[0]?.finishReason);
            throw new Error("AI로부터 응답을 받지 못했습니다. (사유: " + (response.candidates?.[0]?.finishReason || "알 수 없음") + ")");
        }

        try {
            res.json(JSON.parse(text));
        } catch (parseError) {
            console.error("JSON Parse Error. Data:", text);
            res.status(500).json({ error: "AI가 유효한 JSON 형식을 생성하지 못했습니다. 다시 시도해 주세요." });
        }
    } catch (e: any) {
        console.error("Gemini API Parse Error:", e);
        let errorMessage = e.message || "AI 처리 중 오류가 발생했습니다.";
        if (errorMessage.includes("429") || errorMessage.includes("quota")) {
            errorMessage = "AI 무료 티어 할당량을 모두 사용했습니다. 잠시 후 다시 시도하시거나, 보다 높은 한도가 필요하시면 'Settings > Secrets'에서 유료 모델 API 키 설정을 고려해 보세요. (현재 일일 한도 약 15~20회)";
        }
        res.status(500).json({ error: errorMessage });
    }
  });

  app.post('/api/gemini/generate', async (req, res): Promise<void> => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
           res.status(500).json({ error: "API 키 설정 누락: 오른쪽 상단 'Settings > Secrets'에서 GEMINI_API_KEY를 설정했는지 확인해 주세요. 이미 설정했다면 페이지를 새로고침 하거나, 기존 키를 삭제하고 다시 등록해 보세요." });
           return;
        }
        const ai = new GoogleGenAI({ 
            apiKey,
            httpOptions: {
                headers: {
                    'User-Agent': 'aistudio-build',
                }
            }
        });

        const { rawText, customInstruction } = req.body;
        console.log("Processing /api/gemini/generate request");
        
        let response;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount <= maxRetries) {
            try {
                response = await ai.models.generateContent({
                    model: "gemini-1.5-flash",
                    contents: `매물 정보: ${rawText}`,
                    config: {
                        systemInstruction: "고품격 스토리텔링 형식의 부동산 원고를 작성하고, 모든 매물 필드를 JSON으로 추출하세요. 거래형태('매매', '전세', '월세'), 카테고리, 동, 건물명, 가격, 해당층(floor), 총층(totalFloor) 등 모든 정보를 꼼꼼히 파싱해야 합니다. 상세 본론(body)은 마크다운 헤더(#, ##, ###)를 사용하여 섹션을 나누고 가독성 있게 작성하세요. 비어있는 값은 빈 문자열(\"\")로 처리하세요. 체험적 서론과 상세 본론은 문장 끝에 반드시 1회 줄바꿈하고, 문장들 사이에 빈 줄을 두어 가독성을 높이세요." + (customInstruction ? "\n[소장님 특별 지침]: " + customInstruction : ""),
                        responseMimeType: "application/json",
                        responseSchema: parsingSchema
                    }
                });
                break; // Success
            } catch (error: any) {
                if ((error.message?.includes("429") || error.message?.includes("quota")) && retryCount < maxRetries) {
                    retryCount++;
                    const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
                    console.warn(`Quota exceeded, retrying in ${delay}ms... (Attempt ${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }

        if (!response) throw new Error("AI 응답을 생성하지 못했습니다.");
        const text = response.text;
        if (!text) {
            console.error("Gemini Response Empty. Finish Reason:", response.candidates?.[0]?.finishReason);
            throw new Error("AI로부터 응답을 받지 못했습니다. (사유: " + (response.candidates?.[0]?.finishReason || "알 수 없음") + ")");
        }

        try {
            res.json(JSON.parse(text));
        } catch (parseError) {
            console.error("JSON Parse Error. Data:", text);
            res.status(500).json({ error: "AI가 유효한 JSON 형식을 생성하지 못했습니다. 다시 시도해 주세요." });
        }
    } catch (e: any) {
        console.error("Gemini API Generate Error:", e);
        let errorMessage = e.message || "AI 처리 중 오류가 발생했습니다.";
        if (errorMessage.includes("429") || errorMessage.includes("quota")) {
            errorMessage = "AI 무료 티어 할당량을 모두 사용했습니다. 잠시 후 다시 시도하시거나, 보다 높은 한도가 필요하시면 'Settings > Secrets'에서 유료 모델 API 키 설정을 고려해 보세요. (현재 일일 한도 약 15~20회)";
        }
        res.status(500).json({ error: errorMessage });
    }
  });

  // DB REST API Endpoints
  app.get('/api/posts', (req, res) => {
    res.json(readPosts());
  });

  app.post('/api/posts', (req, res) => {
    const postData = req.body;
    let posts = readPosts();
    
    const existingIndex = posts.findIndex((p: any) => p.id === postData.id);
    if (existingIndex !== -1) {
      posts[existingIndex] = { ...posts[existingIndex], ...postData };
    } else {
      posts = [postData, ...posts];
    }
    
    writePosts(posts);
    res.json(posts);
  });

  app.delete('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    let posts = readPosts();
    posts = posts.filter((p: any) => p.id !== id);
    writePosts(posts);
    res.json(posts);
  });

  app.get('/api/inquiries', (req, res) => {
    res.json(readInquiries());
  });

  app.post('/api/inquiries', (req, res) => {
    const inqData = req.body;
    let inquiries = readInquiries();
    inquiries = [inqData, ...inquiries];
    writeInquiries(inquiries);
    res.json(inquiries);
  });

  app.post('/api/inquiries/:id/toggle', (req, res) => {
    const { id } = req.params;
    let inquiries = readInquiries();
    inquiries = inquiries.map((inq: any) => {
      if (inq.id === id) {
        return { ...inq, processed: !inq.processed };
      }
      return inq;
    });
    writeInquiries(inquiries);
    res.json(inquiries);
  });

  // API 404 Fallback
  // 2FA in-memory storage for admin authentication
  const verificationCodes = new Map<string, { code: string; expiresAt: number }>();

  app.post('/api/v2fa/send', (req, res) => {
    const { phone } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins limit
    
    verificationCodes.set('admin', { code, expiresAt });
    console.log(`[2FA SMS LOG] SMS verification code sent to admin phone: ${phone}, code: ${code}`);
    
    res.json({
      success: true,
      message: "인증번호가 문자(SMS)로 발송되었습니다.",
      code: code // Passed to front-end to simulate a real SMS notification toast
    });
  });

  app.post('/api/v2fa/verify', (req, res) => {
    const { code } = req.body;
    const stored = verificationCodes.get('admin');
    
    if (!stored) {
      res.status(400).json({ error: "활성화된 인증 세션이 없습니다. 인증번호를 재발송해 주세요." });
      return;
    }
    
    if (Date.now() > stored.expiresAt) {
      verificationCodes.delete('admin');
      res.status(400).json({ error: "인증 유효 시간(5분)이 경과했습니다. 다시 시도해 주세요." });
      return;
    }
    
    if (stored.code !== code.trim()) {
      res.status(400).json({ error: "인증번호 6자리가 정확하지 않습니다." });
      return;
    }
    
    verificationCodes.delete('admin');
    res.json({ success: true, message: "2차 모바일 인증이 최종 완료되었습니다." });
  });

  app.all('/api/*', (req, res) => {
    console.warn(`[404 NOT FOUND] API Route not caught: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API 경로를 찾을 수 없습니다: ${req.url}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
