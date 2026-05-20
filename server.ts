import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { defaultPosts } from './src/data';
dotenv.config();

function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  
  // 1. Remove markdown code block fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/, "");
  }
  
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("Standard JSON.parse failed, attempting control-character clean and parse...");
    
    // 2. Escape literal carriage returns and newlines that are inside JSON string values.
    let inString = false;
    let escaped = "";
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (char === '"' && (i === 0 || cleaned[i - 1] !== '\\')) {
        inString = !inString;
        escaped += char;
      } else if (inString) {
        if (char === '\n') {
          escaped += '\\n';
        } else if (char === '\r') {
          escaped += '\\r';
        } else {
          escaped += char;
        }
      } else {
        escaped += char;
      }
    }
    
    try {
      return JSON.parse(escaped);
    } catch (secondErr) {
      console.error("Advanced JSON parsing failure:", secondErr);
      throw secondErr;
    }
  }
}

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
                    model: "gemini-3.5-flash",
                    contents: `매물 정보: ${rawText}`,
                    config: {
                        maxOutputTokens: 8192,
                        systemInstruction: "매물 원고/정보를 해독해 주어진 JSON 규격에 맞게 파싱하세요. 비어있거나 모호한 값은 빈 문자열(\"\") 또는 기본값으로 처리하세요. 각 필드 매핑 규칙은 다음과 같습니다:\n- transactionType: 거래 형태. 매매, 전세, 월세 중 하나여야 합니다.\n- category: 매물 분류. '원룸', '미투', '투룸', '쓰리룸', '오피스텔', '상가', '아파트', '다세대', '주택', '땅' 등에서 가장 어울리는 것으로 매핑합니다.\n- dong: 구미 시내의 법정동명 (예: 송정동, 형곡동, 임은동 등 '동읍면'으로 끝나는 단어).\n- building: 건물명 및 단지명 (예: 송정태왕아너스타워).\n- room: 호실/호수 정보 (예: 1805호 -> 1805, 503호 -> 503). 숫자만 있거나 생략 가능.\n- floor: 해당층 (예: 20층 -> 20, 2층 -> 2. 숫자만 추출).\n- totalFloor: 건물 전체층/총층 (예: 24층 -> 24. 숫자만 추출).\n- price: 보증금/월세 또는 매매 금액 (예: 500/55, 3000/25, 1억2천 등).\n- manageFee: 관리비 금액 (예: 5, 10). 숫자 혹은 내용.\n- ownerPhone: 임대인(집주인) 연락처 (예: 010-7590-0111).\n- remarks: 비고, 특이사항, 현관번호 등 (예: ▶현관:9246 호실:6000).\n- title: 블로그 홍보 제목 (예: 남향 채광 가득한 햇살 원룸 실사). 존재하지 않거나 비었으면 매물의 장점을 담아 매력적인 제목을 창작해 주세요.\n- intro: 체험적 서론 (방문 시 느낀 채광, 첫인상 등을 상세한 에세이 형식으로 작성한 서론). 존재하지 않거나 빈 경우, 건물명이나 거래조건을 바탕으로 자연스럽게 생성해 채워주세요.\n- body: 상세한 관찰 본론 (수압 체크, 옵션 상태, 내부 관찰 결과 등을 마크다운 헤더를 활용해 가독성 높게 입체적으로 묘사한 공간 상세 설명 본문). 존재하지 않거나 정보가 부족한 경우 주거 환경과 편의 조건들을 자세히 풀어서 매끄럽게 창작해 작성해 채워주세요. 중요: JSON 데이터 응답이 중간에 끊기지 않도록, 제목, 서론, 본문의 전체 분량은 공백 포함 800자 내외로 압축하여 작성하세요.\n- address: 지도 연동용 실제 주소 (예: 경상북도 구미시 송정동 송정태왕아너스타워, 또는 송정동 76-6 등 상세 주소).\n- isRecommended: 소장 추천 우선 노출 여부 (기본 false, 텍스트에 강한 추천 문구가 있으면 true).",
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
            res.json(cleanAndParseJson(text));
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
                    model: "gemini-3.5-flash",
                    contents: `매물 정보: ${rawText}`,
                    config: {
                        maxOutputTokens: 8192,
                        systemInstruction: "사용자가 제공한 원고나 메모를 바탕으로 가독성이 뛰어나고 마케팅 효과가 강력한 고품격 부동산 홍보용 블로그 원고(제목, 서론, 본문)를 생성하고, 동시에 모든 매물 필드를 JSON 규격에 맞게 완벽히 파싱/추출하여 반환하세요. 비어있는 값은 빈 문자열(\"\") 또는 기본값으로 처리하세요. 각 필드 매핑 규칙은 다음과 같습니다:\n- transactionType: 거래 형태. 매매, 전세, 월세 중 하나여야 합니다.\n- category: 매물 분류. '원룸', '미투', '투룸', '쓰리룸', '오피스텔', '상가', '아파트', '다세대', '주택', '땅', '기타' 중 하나여야 합니다.\n- dong: 구미 시내의 법정동명 (예: 송정동).\n- building: 건물명 (예: 송정태왕아너스타워).\n- room: 호수 숫자 (예: 1805).\n- floor: 해당층 숫자만 (예: 20).\n- totalFloor: 총층 숫자만 (예: 24).\n- price: 보증금/월세 또는 매매가 (예: 500/55, 3000/25, 2억).\n- manageFee: 관리비 금액.\n- ownerPhone: 임대인 연락처 (예: 010-7590-0111).\n- remarks: 현관 비번, 특이사항 등 (예: ▶현관:9246 호실:6000).\n- title: 매물의 매력을 극대화하는 블로그 최적화 홍보 제목을 아름답고 창의적으로 가공하여 작성하세요.\n- intro: 풍부한 첫인상과 기승전결 묘사를 담은 따뜻한 '체험적 서론'을 상세하게 작성하세요.\n- body: '상세한 관찰 본론'으로 수압, 채광, 부엌 구조, 옵션 수준 등을 마크다운 문법(#, ##, ###)을 가미하여 감성적이면서도 분석적으로 입체감 있게 작성하세요. 중요: JSON 데이터 응답이 중간에 끊기지 않도록, 제목, 서론, 본문의 전체 분량은 공백 포함 800자 내외로 압축하여 작성하세요. 단락 끝은 1회 줄바꿈 처리합니다.\n- address: 실제 지도 연동 주소 (예: 경상북도 구미시 송정동).\n- isRecommended: 특별히 추천할 수준의 매물이면 true, 아니면 false." + (customInstruction ? "\n[소장님 특별 지침]: " + customInstruction : ""),
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
            res.json(cleanAndParseJson(text));
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
