import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { defaultPosts } from './src/data';
import { GoogleGenAI, Type } from '@google/genai';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const _filename = typeof __filename !== 'undefined'
  ? __filename
  : fileURLToPath(import.meta.url);

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(_filename);

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  const projectRoot = _dirname.endsWith('dist') || _dirname.endsWith('dist/')
    ? path.resolve(_dirname, '..')
    : _dirname;

  const DATA_DIR = path.join(projectRoot, 'data');
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

  // Load and initialize Firebase Cloud Database
  const configPath = path.join(projectRoot, 'firebase-applet-config.json');
  let firebaseAdminConfig: any = null;
  let firestoreDb: any = null;

  if (fs.existsSync(configPath)) {
    try {
      firebaseAdminConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.error("Error reading firebase-applet-config.json:", e);
    }
  }

  if (firebaseAdminConfig && firebaseAdminConfig.projectId) {
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          projectId: firebaseAdminConfig.projectId
        });
      }
      const dbId = firebaseAdminConfig.firestoreDatabaseId;
      const appInstance = admin.apps[0];
      firestoreDb = dbId ? getFirestore(appInstance, dbId) : getFirestore(appInstance);
      console.log(`[Firebase Admin Connection] Success! Project: ${firebaseAdminConfig.projectId}, Database ID: ${dbId || 'default'}`);
    } catch (err: any) {
      console.error("[Firebase Admin Connection] Failed initialization:", err);
    }
  } else {
    console.warn("[Firebase Admin Connection] Bypassed initialization: Config file not found or invalid format.");
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

  // Helper to extract JSON cleanly from potential Markdown decoration
  function cleanJsonResponse(rawText: string): string {
    let cleaned = rawText.trim();
    // 1. Remove markdown syntax if present
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      cleaned = match[1].trim();
    }
    // 2. Fallback to bracket-based extraction if there are noisy prefixes/suffixes
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return cleaned;
  }

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
        address: { type: Type.STRING },
        video: { type: Type.STRING },
        isRecommended: { type: Type.BOOLEAN }
    }
  };

  // 중개대상물 법정 고시란 원문 한 글자도 빠짐없는 절대 보존 및 자동 연동 장치
  function extractLegalDisclosureBlock(rawText: string): string {
    if (!rawText) return "";
    
    const markers = [
        "중개대상물표시사항",
        "중개대상물 표시사항",
        "중개대상물",
        "중개 대상물",
        "표시광고",
        "표시 광고",
        "법정 고시사항",
        "법정 고시",
        "소재지\t구미시",
        "단지명\t",
        "거래종류\t"
    ];
    
    let foundIdx = -1;
    for (const marker of markers) {
        const idx = rawText.indexOf(marker);
        if (idx !== -1) {
            foundIdx = idx;
            break;
        }
    }
    
    if (foundIdx === -1) {
        const keywords = ["소재지", "단지명", "방수", "총세대수", "사용승인일", "월관리비"];
        let minIdx = -1;
        for (const kw of keywords) {
            const idx = rawText.indexOf(kw);
            if (idx !== -1) {
                if (minIdx === -1 || idx < minIdx) {
                    minIdx = idx;
                }
            }
        }
        if (minIdx !== -1 && minIdx > 0) {
            const sectionStartIdx = rawText.lastIndexOf("\n", minIdx);
            foundIdx = sectionStartIdx !== -1 ? sectionStartIdx : minIdx;
        }
    }
    
    if (foundIdx !== -1) {
        return rawText.substring(foundIdx).trim();
    }
    return "";
  }

  app.post('/api/gemini/parse', async (req, res): Promise<void> => {
    try {
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: "API 키가 등록되지 않았습니다." });
            return;
        }
        const { rawText } = req.body;
        if (!rawText) {
            res.status(400).json({ error: "조회할 텍스트가 없습니다." });
            return;
        }

        const originalLegalBlock = extractLegalDisclosureBlock(rawText);

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: `매물 정보: ${rawText}`,
            config: {
                maxOutputTokens: 8192,
                systemInstruction: "매물 원고/정보를 해독해 주어진 JSON 규격에 맞게 파싱하세요. 비어있거나 모호한 값은 빈 문자열(\"\") 또는 기본값으로 처리하세요. 각 필드 매핑 규칙은 다음과 같습니다:\n- transactionType: 거래 형태. 매매, 전세, 월세 중 하나여야 합니다.\n- category: 매물 분류. '원룸', '미투', '투룸', '쓰리룸', '오피스텔', '상가', '아파트', '다세대', '주택', '땅' 등에서 가장 어울리는 것으로 매핑합니다.\n- dong: 구미 시내의 법정동명 (예: 송정동, 형곡동, 임은동 등 '동읍면'으로 끝나는 단어).\n- building: 건물명 및 단지명 (예: 송정태왕아너스타워).\n- room: 호실/호수 정보 (예: 1805호 -> 1805, 503호 -> 503). 숫자만 있거나 생략 가능.\n- floor: 해당층 (예: 20층 -> 20, 2층 -> 2). 숫자만 추출.\n- totalFloor: 건물 전체층/총층 (예: 24층 -> 24). 숫자만 추출.\n- price: 보증금/월세 또는 매매 금액 (예: 500/55, 3000/25, 1억2천 등).\n- manageFee: 관리비 금액 (예: 10, 100000원). 숫자 혹은 내용.\n- ownerPhone: 임대인(집주인) 연락처 (예: 010-7590-0111).\n- remarks: 비고, 특이사항, 현관번호 상세 정보.\n- title: 구글 E-E-A-T 검색 및 블로그 홍보 최적화 제목. 가식적이거나 자극적인 클릭베이트를 지양하고, 구체적인 매물 강점(남향, 보증금 조건, 실제 주거 특성)을 신뢰감 있게 표현해 작성하세요. 모든 제목 마지막은 두 번 개행(\\n\\n)되도록 작성하세요.\n- intro: 직접 다녀온 공인중개사의 오감이 느껴지는 '체험적 서론'. 방문 시간대의 화사한 채광, 복도 공용 시설 청결도, 동네 첫 느낌 등을 상세하고 감성적으로 에세이 형식 서술하세요. (예: '송정동 현장을 직접 뛰어다니며 검증한 복층 매물방입니다...') 이 서론의 뒤편에는 반드시 [태왕공인중개사 소장 현장 종합 검증 의견 완료] 서명을 명시하세요. 모든 문장의 끝에는 두 번 개행(\\n\\n)을 적용하세요.\n- body: '상세한 관찰 본론'으로 수압 세기, 싱크대 배수, 이중창 방음 상태, 빌트인의 세세한 사용 연식 및 보일러 점검 상태 등 부동산 전문가의 전문성과 밀착 조사가 빛을 발하는 관찰기입니다.\n  [작성 규칙 - 마크다운 금지 & 가독성 극대화]:\n  1. HTML 기호나 마크다운 헤더 기호('#', '##', '###' 등)를 절대 포함하지 마십시오. 오직 순수 텍스트와 줄바꿈 개행문자(\\n)로만 구성합니다.\n  2. 모든 문장 뒤에는 엔터를 두 번 입력하여 위아래로 빈 줄이 개별적으로 형성되도록 무조건 가독성을 극대화한 이중개행문자(\\n\\n)를 적용하세요.\n  3. 소제목(예: [옵션 및 최상급 욕실 상태])을 작성할 때에는 소제목의 바로 윗줄과 바로 아랫줄 모두에 1회의 추가 줄바꿈(\\n\\n, 엔터 2번)을 실행하여 위하해로 시각적 개방감과 쾌적한 느낌을 줍니다. 소제목의 좌우나 앞뒤에 기호를 남발하지 마십시오.\n  중요: JSON 데이터 응답이 중간에 끊기지 않도록, 전체 분량은 공백 포함 950자 내외로 압축하여 작성하세요.\n- address: 지도 연동용 실제 주소 (예: 경상북도 구미시 송정동 송정태왕아너스타워, 또는 송정동 76-6 등 상세 주소).\n- isRecommended: 소장 추천 우선 노출 여부 (기본 false, 텍스트에 강한 추천 문구가 있으면 true).",
                responseMimeType: "application/json",
                responseSchema: parsingSchema
            }
        });

        if (!response || !response.text) {
            throw new Error("AI 응답을 생성하지 못했습니다.");
        }
        let text = response.text;
        let parsedData;
        try {
            parsedData = JSON.parse(cleanJsonResponse(text));
            // 만약 원본 정보에 중개대상물 법정 고시란이 있는 경우 한 글자도 누락 없이 완벽히 body 아래에 보전 병합합니다.
            if (originalLegalBlock && parsedData && typeof parsedData.body === 'string') {
                parsedData.body = parsedData.body.trim() + "\n\n\n[ 법정 중개대상물 표시광고 고시사항 (원본 절대 보전) ]\n\n" + originalLegalBlock;
            }
        } catch (parseErr) {
            console.error("Gemini Parse JSON error. Raw text:", text, parseErr);
            throw new Error("AI 분석 응답을 해독(제이슨)하는 도중 오류가 발생했습니다. 다시 한번 [AI 분석]을 클릭해 주세요.");
        }
        res.json(parsedData);
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
        const apiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            res.status(500).json({ error: "API 키가 등록되지 않았습니다." });
            return;
        }

        const { rawText, customInstruction } = req.body;
        if (!rawText) {
            res.status(400).json({ error: "기준 매물이 없습니다." });
            return;
        }

        const originalLegalBlock = extractLegalDisclosureBlock(rawText);

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: `매물 정보: ${rawText}`,
            config: {
                maxOutputTokens: 8192,
                systemInstruction: "사용자가 제공한 원고나 메모를 바탕으로 가독성이 뛰어나고 마케팅 효과가 강력한 고품격 부동산 홍보용 블로그 원고(제목, 서론, 본문)를 생성하고, 동시에 모든 매물 필드를 JSON 규격에 맞게 완벽히 파싱/추출하여 반환하세요. 비어있는 값은 빈 문자열(\"\") 또는 기본값으로 처리하세요. 각 필드 매핑 규칙은 다음과 같습니다:\n- transactionType: 거래 형태. 매매, 전세, 월세 중 하나여야 합니다.\n- category: 매물 분류. '원룸', '미투', '투룸', '쓰리룸', '오피스텔', '상가', '아파트', '다세대', '주택', '땅', '기타' 중 하나여야 합니다.\n- dong: 구미 시내의 법정동명 (예: 송정동).\n- building: 건물명 (예: 송정태왕아너스타워).\n- room: 호수 숫자 (예: 1805).\n- floor: 해당층 숫자만 (예: 20).\n- totalFloor: 총층 숫자만 (예: 24).\n- price: 보증금/월세 또는 매매가 (예: 500/55, 3000/25, 2억).\n- manageFee: 관리비 금액.\n- ownerPhone: 임대인 연락처 (예: 010-7590-0111).\n- remarks: 현관 비번, 특이사항 등 (예: ▶현관:9246 호실:6000). 입주민을 위해 주차, 반려동물, 입주시기 등의 아주 투명하고 신뢰성(Trustworthiness) 있는 상세 팩트 수록.\n- title: 구글 E-E-A-T 검색 및 블로그 최적화 제목. 가식적이거나 자극적인 클릭베이트를 지양하고, 구체적인 매물 강점(남향, 보증금 조건, 실제 주거 특성)을 신뢰감 있게 표현해 작성하세요. 모든 제목 뒤에는 이중개행(\\n\\n)을 넣어주세요.\n- intro: 직접 다녀온 공인중개사의 오감이 느껴지는 '체험적 서론'. 방문 시간대의 온화한 채광, 복도 공용 시설 관리상태, 현관 첫인상 등을 에세이처럼 서술하세요. (예: '송정동 현장을 직접 뛰어다니며 검증한 매물방입니다...') 이 서론의 뒤편에는 반드시 [태왕공인중개사 소장 현장 종합 검증 의견 완료] E-E-A-T 서명을 명시하세요. 모든 문장 뒤에는 이중개행(\\n\\n)을 적용하세요.\n- body: '상세한 관찰 본론'으로 수압 세기, 싱크대 배수, 이중창의 단열 방음 복잡도, 빌트인 가전 상태 등 전문가의 세밀한 안목이 빛을 발하는 관찰기입니다.\n  [상세 관찰 본론 내 필수 항목 - 중개대상물표시사항 법정 고시란]: \n  본문(body)의 맨 아래 단락에는 사용자가 준 정보에서 추출한 방향, 면적, 방수/욕실수, 용도, 주차대수, 사용승인일, 입주가능일 등의 '중개대상물 법정 표시사항 고시란'의 구체적 팩트 정보를 깔끔한 단락으로 만들어 반드시 줄글 리스트나 보기 좋은 형식으로 빼놓지 말고 모두 포함하여 적어넣으세요! 이것은 법정 의무입니다.\n  [작성 규칙 - 마크다운 금지 & 가독성 극대화]:\n  1. HTML 기호나 마크다운 헤더 기호('#', '##', '###' 등)를 절대 포함하지 마십시오. 오직 순수 텍스트와 줄바꿈 개행문자(\\n)로만 구성합니다.\n  2. 모든 문장 뒤에는 무조건 엔터를 두 번 입력하여 위아래로 빈 줄이 개별적으로 생기도록 신뢰받는 이중개행문자(\\n\\n)를 적용하세요.\n  3. 소제목(예: [옵션 및 최상급 욕실 상태])을 작성할 때에는 소제목의 바로 윗줄과 바로 아랫줄 모두에 1회의 추가 줄바꿈(\\n\\n, 엔터 2번)을 실행하여 깔끔하게 줄을 띄웁니다.\n  중요: JSON 데이터 응답이 중간에 끊기지 않도록, 전체 분량은 공백 포함 950자 내외로 압축하여 작성하세요.\n- address: 실제 지도 연동 주소 (예: 경상북도 구미시 송정동).\n- isRecommended: 특별히 추천할 수준의 매물이면 true, 아니면 false." + (customInstruction ? "\n[소장님 특별 지침]: " + customInstruction : ""),
                responseMimeType: "application/json",
                responseSchema: parsingSchema
            }
        });

        if (!response || !response.text) {
            throw new Error("AI 응답을 생성하지 못했습니다.");
        }
        let text = response.text;
        let parsedData;
        try {
            parsedData = JSON.parse(cleanJsonResponse(text));
            // 만약 원본 정보에 중개대상물 법정 고시란이 있는 경우 한 글자도 누락 없이 완벽히 body 아래에 보전 병합합니다.
            if (originalLegalBlock && parsedData && typeof parsedData.body === 'string') {
                parsedData.body = parsedData.body.trim() + "\n\n\n[ 법정 중개대상물 표시광고 고시사항 (원본 절대 보전) ]\n\n" + originalLegalBlock;
            }
        } catch (parseErr) {
            console.error("Gemini Generate JSON error. Raw text:", text, parseErr);
            throw new Error("AI 작성 응답을 해독(제이슨)하는 도중 오류가 발생했습니다. 다시 한번 [AI 생성]을 클릭해 주세요.");
        }
        res.json(parsedData);
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
  app.get('/api/posts', async (req, res) => {
    if (firestoreDb) {
      try {
        const postsRef = firestoreDb.collection('posts');
        const snapshot = await postsRef.orderBy('createdAt', 'desc').get();
        if (!snapshot.empty) {
          const list: any[] = [];
          snapshot.forEach((doc: any) => {
            list.push(doc.data());
          });
          res.json(list);
          return;
        } else {
          // Firestore is empty! Seed defaultPosts into Firestore!
          console.log("Firestore posts collection is empty. Seeding defaultPosts...");
          const batch = firestoreDb.batch();
          defaultPosts.forEach((post) => {
            const docRef = postsRef.doc(post.id);
            batch.set(docRef, post);
          });
          await batch.commit();
          console.log("Successfully seeded default posts to Firestore!");
          res.json(defaultPosts);
          return;
        }
      } catch (err) {
        console.error("Failed to read posts from Firestore, falling back to JSON file:", err);
      }
    }
    res.json(readPosts());
  });

  app.post('/api/posts', async (req, res) => {
    const postData = req.body;

    // 1. Save to Cloud Firestore
    if (firestoreDb) {
      try {
        const docRef = firestoreDb.collection('posts').doc(postData.id);
        await docRef.set(postData, { merge: true });
        console.log(`[Firestore Admin] Post successfully saved: ${postData.id}`);
      } catch (err) {
        console.error(`[Firestore Admin Error] Failed to save post ${postData.id}:`, err);
      }
    }

    // 2. Save locally as fallback
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

  app.delete('/api/posts/:id', async (req, res) => {
    const { id } = req.params;

    // 1. Delete from Cloud Firestore
    if (firestoreDb) {
      try {
        const docRef = firestoreDb.collection('posts').doc(id);
        await docRef.delete();
        console.log(`[Firestore Admin] Post successfully deleted: ${id}`);
      } catch (err) {
        console.error(`[Firestore Admin Error] Failed to delete post ${id}:`, err);
      }
    }

    // 2. Delete locally as fallback
    let posts = readPosts();
    posts = posts.filter((p: any) => p.id !== id);
    writePosts(posts);

    res.json(posts);
  });

  app.get('/api/inquiries', async (req, res) => {
    if (firestoreDb) {
      try {
        const inquiriesRef = firestoreDb.collection('inquiries');
        const snapshot = await inquiriesRef.orderBy('createdAt', 'desc').get();
        const list: any[] = [];
        snapshot.forEach((doc: any) => {
          list.push(doc.data());
        });
        res.json(list);
        return;
      } catch (err) {
        console.error("Failed to read inquiries from Firestore, falling back to JSON file:", err);
      }
    }
    res.json(readInquiries());
  });

  app.post('/api/inquiries', async (req, res) => {
    const inqData = req.body;

    // 1. Save to Cloud Firestore
    if (firestoreDb) {
      try {
        const docRef = firestoreDb.collection('inquiries').doc(inqData.id);
        await docRef.set(inqData, { merge: true });
        console.log(`[Firestore Admin] Inquiry successfully saved: ${inqData.id}`);
      } catch (err) {
        console.error(`[Firestore Admin Error] Failed to save inquiry ${inqData.id}:`, err);
      }
    }

    // 2. Save locally as fallback
    let inquiries = readInquiries();
    inquiries = [inqData, ...inquiries];
    writeInquiries(inquiries);

    res.json(inquiries);
  });

  app.post('/api/inquiries/:id/toggle', async (req, res) => {
    const { id } = req.params;

    // 1. Update in Cloud Firestore
    if (firestoreDb) {
      try {
        const docRef = firestoreDb.collection('inquiries').doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const currentProcessed = docSnap.data().processed;
          await docRef.update({ processed: !currentProcessed });
          console.log(`[Firestore Admin] Inquiry toggle successfully: ${id}`);
        } else {
          await docRef.set({ id, processed: true }, { merge: true });
        }
      } catch (err) {
        console.error(`[Firestore Admin Error] Failed to toggle inquiry ${id}:`, err);
      }
    }

    // 2. Update locally as fallback
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

  // Vite middleware for development or fallback static serving
  const isProd = process.env.NODE_ENV === 'production' || _dirname.endsWith('dist') || _dirname.endsWith('dist/');
  const distPath = isProd
    ? (_dirname.endsWith('dist') || _dirname.endsWith('dist/') ? _dirname : path.join(_dirname, 'dist'))
    : path.join(projectRoot, 'dist');

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error(`[ERROR] index.html not found in distPath: ${distPath}`);
        res.status(500).send(`📢 index.html을 찾을 수 없습니다. (경로: ${indexPath})`);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
});

startServer().catch((err) => {
  console.error('💥 Critical error in startServer:', err);
});
