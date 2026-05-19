export interface Post {
    id: string;
    category: string;
    dong: string;
    building: string;
    room: string;
    floor?: string;
    totalFloor?: string;
    price: string;
    manageFee: string;
    phone: string;
    ownerPhone?: string;
    title: string;
    remarks?: string;
    thumbnail?: string;
    intro?: string;
    body?: string;
    images?: string;
    panoImage?: string;
    panoramas?: string;
    video?: string;
    address: string;
    transactionType: string;
    isRecommended: boolean;
    createdAt: number;
}

export interface Inquiry {
    id: string;
    name: string;
    phone: string;
    message: string;
    processed: boolean;
    createdAt: number;
}

export const gumiDongs = ["거의동", "고아읍", "공단동", "광평동", "구평동", "구포동", "금전동", "남통동", "도개면", "도량동", "무을면", "봉곡동", "부곡동", "비산동", "사곡동", "산동읍", "상모동", "선기동", "선산읍", "송정동", "수점동", "시미동", "신동", "신평동", "양호동", "오태동", "옥계동", "옥성면", "원평동", "인의동", "임수동", "임은동", "장천면", "지산동", "진평동", "해평면", "형곡동", "황상동", "칠곡군 석적읍", "칠곡군 북삼읍"];

export const defaultPosts: Post[] = [
    {
        id: 'default-1',
        category: '원룸',
        building: '정우해오름',
        room: '205',
        floor: '2',
        totalFloor: '4',
        price: '200/23',
        manageFee: '5만', 
        address: '광평동 76-6',
        transactionType: '월세',
        dong: '광평동',
        phone: '010-7590-0111',
        ownerPhone: '010-9999-8888', 
        remarks: '▶현관:9246 호실:6000, P2달, 원하는 옵션 맞춰 드림! 조절가, 단기, 전, 반, 월 가능',
        title: '남향 햇살 가득한 가성비 최상 보장 원룸',
        thumbnail: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&h=675&q=80',
        intro: '오후 2시 무렵 정우해오름 205호실을 직접 방문하여 일조량을 체크해 보았습니다.\\n\\n남향 창을 통해 들어오는 채광이 무척 풍부했습니다.',
        body: '싱크대 물을 직접 틀어 배수와 수압 상태를 점검하였는데 아주 시원하게 작동하였습니다.\\n\\n방음 이중창 설계로 이면 도로 통행 소음도 조용하게 걸러졌습니다.\\n\\n또한 독자분들이 가장 면밀히 살펴보시는 욕실 내부의 실측 수치와 배수 설비의 기울기까지 직접 측정하여 안심하고 계약하실 수 있도록 검증을 완료했습니다.',
        images: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&h=675&q=80|https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&h=675&q=80',
        video: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        isRecommended: true, 
        createdAt: Date.now()
    },
    {
        id: 'default-2',
        category: '투룸',
        building: '정우해오름',
        room: '206',
        floor: '2',
        totalFloor: '4',
        price: '500/50',
        manageFee: '5만',
        address: '광평동 76-6',
        transactionType: '월세',
        dong: '광평동',
        phone: '010-7590-0111',
        ownerPhone: '010-1111-2222',
        remarks: '▶현관:9246 호실:6000, P2달, 원하는 옵션 맞춰 드림! 조절가, 단기, 전, 반, 월 가능',
        title: '거실이 유독 넓게 잘 빠진 신축급 투룸 실사 리뷰',
        thumbnail: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&h=675&q=80',
        intro: '정우해오름 206호 투룸 구조를 직접 둘러보았습니다.\\n\\n주방과 넓은 거실 공간이 완전히 분리되어 있어 쾌적한 주거 분리감을 자랑하는 훌륭한 평면입니다.',
        body: '거실 전면에 설치된 넓은 샤시를 통해 자연광이 부드럽게 유입되는 것을 체크했습니다.\\n\\n또한 이중 섀시 시공 덕분에 대로변 소음이 완벽히 차단되어 무척 정숙했습니다.\\n\\n침실 내부의 드레스룸 폭도 1.8미터로 깊어 부부용 의류 수납에 충분합니다.',
        images: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&h=675&q=80',
        video: '',
        isRecommended: false,
        createdAt: Date.now() - 100000
    },
    {
        id: 'default-3',
        category: '원룸',
        building: '정우해오름',
        room: '301',
        floor: '3',
        totalFloor: '4',
        price: '200/23',
        manageFee: '5만',
        address: '광평동 76-6',
        transactionType: '월세',
        dong: '광평동',
        phone: '010-7590-0111',
        ownerPhone: '010-3333-4444',
        remarks: '▶현관:9246 호실:6000, P2달, 원하는 옵션 맞춰 드림! 조절가, 단기, 전, 반, 월 가능',
        title: '로열층 조용하고 시야 가림이 전혀 없는 알짜배기 방',
        thumbnail: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&h=675&q=80',
        intro: '전면 동 가림이 없어 뛰어난 사생활 보호가 특징인 301호의 저녁 프라이버시 상태를 점검하였습니다.',
        body: '창밖으로 이웃 세대의 시선이 전혀 닿지 않아 블라인드를 걷어두어도 무척 안심할 수 있는 특별한 호실입니다.\\n\\n욕실 환기창이 크게 나 있어 습기 제거에 대단히 효율적이며 수납 선반도 정밀 시공되었습니다.',
        images: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&h=675&q=80',
        video: '',
        isRecommended: true, 
        createdAt: Date.now() - 200000
    },
    {
        id: 'default-4',
        category: '미투',
        building: '반딧불',
        room: '205',
        floor: '2',
        totalFloor: '4',
        price: '300/34',
        manageFee: '없음',
        address: '원평동 412-1',
        transactionType: '월세',
        dong: '원평동',
        phone: '010-7590-0111',
        ownerPhone: '010-5555-6666',
        remarks: '▶현관: 경비+열쇠 +4121+종 호실: 6000 P 문의',
        title: '풀옵션 분리형 미니투룸, 철저한 이중 보안 세대',
        thumbnail: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&h=675&q=80',
        intro: '반딧불 205호실 주변 보행자 도로 상태와 주간 일조 변화를 관찰했습니다.\\n\\n역세권 도보 5분 거리이면서도 골목 안쪽에 독립적으로 위치하여 무척 정숙합니다.',
        body: '현관은 외부 보안 키 패드 및 경비 센서로 철저하게 통제되어 여성 고객분들도 마음 놓고 계약하실 실 수 있는 안전한 보금자리입니다.\\n\\n세탁 베란다가 별도로 넓게 빠져서 가을철 빨래 건조 효율도 대단히 우수하게 평가됩니다.',
        images: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&h=675&q=80',
        video: '',
        isRecommended: false,
        createdAt: Date.now() - 300000
    }
];
