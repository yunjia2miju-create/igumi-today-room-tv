import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAppStore } from '../store';

import PannellumViewer from './PannellumViewer';

export const DetailTab = ({ 
    openPhoneSelectModal,
    showToast
}: { 
    openPhoneSelectModal: (e: React.MouseEvent, mobilePhone: string, ownerPhone?: string) => void,
    showToast?: (msg: string, type?: 'success'|'error') => void
}) => {
    const { posts, isAdminLoggedIn, selectedPostId, setSelectedPostId, setActiveSection, isMobileSimulationMode } = useAppStore();

    const [isFetchingDetail, setIsFetchingDetail] = React.useState(true);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
        if (selectedPostId) {
            window.scrollTo(0, 0);
            setIsFetchingDetail(true);
            const t = setTimeout(() => setIsFetchingDetail(false), 500);
            return () => clearTimeout(t);
        }
    }, [selectedPostId]);

    const p = posts.find(post => post.id === selectedPostId);
    
    React.useEffect(() => {
        if (!p && selectedPostId) {
            // Only redirect if we are sure it's not just a loading phase
            const timer = setTimeout(() => {
                if (!p && selectedPostId) {
                    setActiveSection('main');
                }
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [p, selectedPostId, setActiveSection]);

    if (!selectedPostId) return null;

    if (!p) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-20 text-center">
                <div className="animate-spin inline-block w-8 h-8 border-[3px] border-current border-t-transparent text-emerald-600 rounded-full mb-4" role="status">
                    <span className="sr-only">Loading...</span>
                </div>
                <p className="text-slate-500 font-bold">매물 정보를 찾는 중입니다...</p>
            </div>
        );
    }

    const formatDisplayPrice = (price: string, transactionType: string) => {
        if (transactionType === '매매') return `매매 ${price}만원`;
        if (transactionType === '전세') return `전세 ${price}만원`;
        if (transactionType === '월세' && price.includes('/')) {
            const parts = price.split('/');
            return `보 ${parts[0]}만 / 월 ${parts[1]}만`;
        }
        return price;
    };

    const [isMobile, setIsMobile] = React.useState(window.innerWidth < 1024 || isMobileSimulationMode);

    React.useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024 || isMobileSimulationMode);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobileSimulationMode]);

    const defaultImg = "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&h=675&q=80";
    const imgUrls = React.useMemo(() => {
        return p.images 
            ? p.images.split('|').map(i => i.trim()).filter(i => i && i !== defaultImg) 
            : [];
    }, [p.images]);

    const panoUrls = React.useMemo(() => {
        return p.panoramas
            ? p.panoramas.split('|').map(i => i.trim()).filter(i => i)
            : (p.panoImage ? [p.panoImage] : []);
    }, [p.panoramas, p.panoImage]);

    const [activePanoIndex, setActivePanoIndex] = React.useState(0);

    let embedUrl = p.video || '';
    if (embedUrl.includes('watch?v=')) {
        const vid = embedUrl.split('v=')[1]?.split('&')[0];
        embedUrl = `https://www.youtube.com/embed/${vid}`;
    } else if (embedUrl.includes('youtu.be/')) {
        const vid = embedUrl.split('youtu.be/')[1]?.split('?')[0];
        embedUrl = `https://www.youtube.com/embed/${vid}`;
    }

    // Recommendation logic
    let potentialRecs = posts.filter(item => item && item.id !== p.id);
    let matchingRecs = [];
    if (['원룸', '미투', '투룸', '쓰리룸'].includes(p.category)) {
        matchingRecs = potentialRecs.filter(item => item && item.dong === p.dong);
        if (matchingRecs.length < 3) {
            const extraCategory = potentialRecs.filter(item => item && item.category === p.category && !matchingRecs.some(m => m.id === item.id));
            matchingRecs = [...matchingRecs, ...extraCategory];
        }
    } else {
        matchingRecs = potentialRecs.filter(item => item && item.category === p.category);
    }
    if (matchingRecs.length < 3) {
        const anyExtra = potentialRecs.filter(item => item && !matchingRecs.some(m => m.id === item.id));
        matchingRecs = [...matchingRecs, ...anyExtra];
    }
    matchingRecs = matchingRecs.slice(0, 3);

    return (
        <section id="detail-section" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 transition-opacity duration-300 w-full">
            <button onClick={() => setActiveSection('main')} className="inline-flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-emerald-950/20 text-xs sm:text-sm mb-4 sm:mb-6 w-full">
                <i className="fa-solid fa-chevron-left"></i>
                <span>매물 대장으로 돌아가기</span>
            </button>

            <article className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-xl overflow-hidden p-5 sm:p-10 w-full">
                {isFetchingDetail ? (
                    <div className="animate-pulse space-y-6">
                        <div className="flex space-x-2 mb-4">
                            <div className="h-6 w-16 bg-slate-200 rounded"></div>
                            <div className="h-6 w-12 bg-slate-200 rounded"></div>
                        </div>
                        <div className="h-10 w-3/4 bg-slate-200 rounded mb-2"></div>
                        <div className="h-8 w-1/2 bg-slate-200 rounded border-b border-slate-100 pb-4 mb-6"></div>
                        
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-8 space-y-2">
                            <div className="h-3 w-1/4 bg-slate-200 rounded"></div>
                            <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
                        </div>

                        <div className="aspect-[16/9] w-full bg-slate-200 rounded-2xl mb-8"></div>
                        
                        <div className="space-y-6">
                            <div className="p-6 bg-slate-50 border-l-4 border-slate-300 rounded-r-2xl space-y-2">
                                <div className="h-3 w-full bg-slate-200 rounded"></div>
                                <div className="h-3 w-5/6 bg-slate-200 rounded"></div>
                            </div>
                            <div className="space-y-3">
                                <div className="h-4 w-full bg-slate-200 rounded"></div>
                                <div className="h-4 w-full bg-slate-200 rounded"></div>
                                <div className="h-4 w-4/5 bg-slate-200 rounded"></div>
                                <div className="h-4 w-full bg-slate-200 rounded"></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center space-x-2 mb-4">
                            <span className={`px-2.5 py-1 rounded text-[10px] font-black border ${
                                p.transactionType === '매매' ? 'bg-indigo-600 text-white border-indigo-700' :
                                p.transactionType === '전세' ? 'bg-amber-500 text-white border-amber-600' :
                                'bg-emerald-600 text-white border-emerald-700'
                            }`}>
                                {p.transactionType || '월세'}
                            </span>
                            <span className="bg-slate-900 text-white text-xs font-black px-2.5 py-1 rounded">{p.category}</span>
                            <span className="bg-emerald-50 text-emerald-600 text-xs font-black px-2.5 py-1 rounded border border-emerald-100">
                                {p.floor && p.totalFloor ? `${p.floor}/${p.totalFloor}층` : (p.floor ? `${p.floor}층` : (p.room ? `${p.room}호` : '지상층'))}
                            </span>
                            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded">{p.dong || '구미시'}</span>
                        </div>

                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight mb-2 flex items-center gap-2">
                    <span>{p.building}</span>
                    {((p.panoramas && p.panoramas.trim()) || (p.panoImage && p.panoImage.trim())) && (
                        <span className="shrink-0 bg-emerald-600 text-white text-[10px] sm:text-xs font-black px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg shadow-emerald-900/20 animate-pulse">
                            <i className="fa-solid fa-vr-cardboard"></i>
                            <span>VR 투어 가능</span>
                        </span>
                    )}
                </h1>
                <p className="text-xl font-bold text-emerald-600 border-b border-slate-100 pb-4 mb-6">{formatDisplayPrice(p.price, p.transactionType || '월세')}</p>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-400">책임중개 소장 한마디 및 블로그 원고</span>
                        <p className="text-sm font-black text-slate-800">"{p.title}"</p>
                    </div>
                    {isAdminLoggedIn ? (
                        <button 
                            onClick={() => {
                                const titleText = p.title || "";
                                const introText = p.intro || "";
                                const bodyText = p.body || "";
                                
                                const formatToDoubleSpacing = (text: string) => {
                                    if (!text) return "";
                                    return text
                                        .replace(/\\n/g, '\n')
                                        .split('\n')
                                        .map(line => line.trim())
                                        .filter(line => line.length > 0)
                                        .join('\n\n');
                                };
                                
                                const formattedTitle = formatToDoubleSpacing(titleText);
                                const formattedIntro = formatToDoubleSpacing(introText);
                                const formattedBody = formatToDoubleSpacing(bodyText);
                                
                                // Build the final optimized blog post
                                const fullContent = `📢 [블로그 홍보 제목]\n\n${formattedTitle}\n\n🟢 [체험적 서론]\n\n${formattedIntro}\n\n🏠 [상세한 관찰 본론 및 법정 고시]\n\n${formattedBody}`;
                                
                                navigator.clipboard.writeText(fullContent).then(() => {
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }).catch(err => {
                                    console.error("Copy failed: ", err);
                                });
                            }}
                            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 select-none shadow-sm cursor-pointer border ${
                                copied 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-emerald-950/25 shadow-sm'
                            }`}
                        >
                            {copied ? (
                                <>
                                    <i className="fa-solid fa-circle-check"></i>
                                    <span>이중 개행 원고 복사 성공!</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-paste"></i>
                                    <span>블로그 원고 복사 (원스톱)</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <button 
                            onClick={() => {
                                if (showToast) {
                                    showToast("소장님(관리자) 로그인 상태에서만 원고 복사 기능을 사용할 수 있습니다.", "error");
                                } else {
                                    alert("소장님(관리자) 로그인 상태에서만 원고 복사 기능을 사용할 수 있습니다.");
                                }
                            }}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shrink-0 select-none shadow-sm cursor-pointer border bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-200"
                        >
                            <i className="fa-solid fa-lock text-slate-400"></i>
                            <span>원고 복사 (소장님 전용 🔒)</span>
                        </button>
                    )}
                </div>

                <div className="aspect-[16/9] overflow-hidden rounded-2xl border border-slate-100 shadow-sm mb-8 watermark-container">
                    <img src={p.thumbnail} className="w-full h-full object-cover" />
                    <div className="watermark-overlay">
                        <i className="fa-solid fa-house-shield text-[10px]"></i>
                        <span>태왕공인중개사</span>
                    </div>
                </div>

                {panoUrls.length > 0 && (
                    <div className="mb-8">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 border-b border-dashed border-emerald-500/10 pb-3">
                            <h4 className="text-lg sm:text-2xl font-black text-slate-900 flex items-center gap-2 sm:gap-2.5">
                                <i className="fa-solid fa-vr-cardboard text-emerald-600 text-xl sm:text-3xl animate-vr-icon"></i>
                                <span className="animate-vr-glow text-emerald-600 sm:text-emerald-700">공간 실감 360° 현장 VR 투어</span>
                            </h4>
                            {panoUrls.length > 1 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {panoUrls.map((_, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => setActivePanoIndex(idx)}
                                            className={`px-3 py-1 rounded-full text-[10px] font-black transition-all ${activePanoIndex === idx ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                        >
                                            공간 {idx + 1}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <PannellumViewer 
                            key={`${p.id}-${activePanoIndex}`}
                            images={panoUrls} 
                            activeIndex={activePanoIndex} 
                            onSceneChange={(idx) => setActivePanoIndex(idx)} 
                        />
                        {panoUrls.length > 1 && (
                            <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
                                {panoUrls.map((pano, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => setActivePanoIndex(idx)}
                                        className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${activePanoIndex === idx ? 'border-emerald-600 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                    >
                                        <img src={pano} className="w-full h-full object-cover" alt={`Scene ${idx + 1}`} />
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                            <span className="text-[8px] font-black text-white bg-black/40 px-1.5 py-0.5 rounded">Sc-{idx + 1}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed space-y-6">
                    <div className="p-6 bg-emerald-50/50 border-l-4 border-emerald-500 rounded-r-2xl">
                        <p className="text-sm font-semibold text-emerald-900 italic">"{p.intro}"</p>
                    </div>
                    <div className="text-sm sm:text-base text-slate-600 markdown-content whitespace-pre-wrap leading-relaxed space-y-4">
                        {p.body ? (() => {
                            let cleared = p.body.replace(/\\n/g, '\n');
                            // 마크다운 헤더가 깨지거나 날것 그대로 텍스트 (#, ##, ###)로 나오는 것을 방지하기 위해 깔끔하게 정제
                            cleared = cleared.replace(/(?:^|\n)###\s*(.*?)(?=\n|$)/g, '\n\n[ $1 ]\n');
                            cleared = cleared.replace(/(?:^|\n)##\s*(.*?)(?=\n|$)/g, '\n\n[ $1 ]\n');
                            cleared = cleared.replace(/(?:^|\n)#\s*(.*?)(?=\n|$)/g, '\n\n[ $1 ]\n');

                            // Detect legal disclosures section
                            const legalKeywords = ['중개대상물', '법정 고시', '표시광고', '법정표시사항', '표시사항 고시란', '표시 광고'];
                            let splitIndex = -1;
                            for (const keyword of legalKeywords) {
                                const idx = cleared.indexOf(keyword);
                                if (idx !== -1) {
                                    // Search backward for the start of the section
                                    let startIdx = idx;
                                    while (startIdx > 0 && cleared[startIdx] !== '\n') {
                                        startIdx--;
                                    }
                                    splitIndex = startIdx;
                                    break;
                                }
                            }

                            if (splitIndex !== -1) {
                                const mainBody = cleared.substring(0, splitIndex).trim();
                                const legalDisclosures = cleared.substring(splitIndex).trim();
                                return (
                                    <div className="space-y-6">
                                        <div className="whitespace-pre-wrap leading-relaxed">{mainBody}</div>
                                        <div className="mt-8 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm text-left">
                                            <div className="flex items-center gap-2 mb-3 text-slate-800 border-b border-slate-200 pb-2 flex-wrap">
                                                <i className="fa-solid fa-file-shield text-emerald-600 text-base"></i>
                                                <h4 className="text-xs sm:text-sm font-black uppercase tracking-tight text-slate-900">📋 법정 중개대상물 표시광고 확인서</h4>
                                            </div>
                                            <div className="text-[11px] sm:text-xs text-slate-600 whitespace-pre-wrap leading-loose font-mono bg-white border border-slate-100 p-4 rounded-xl shadow-inner max-h-[350px] overflow-y-auto w-full break-all">
                                                {legalDisclosures}
                                            </div>
                                            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-2 font-bold leading-relaxed flex items-center gap-1">
                                                <i className="fa-solid fa-circle-exclamation text-amber-500"></i>
                                                <span>공인중개사법시행령 제17조의2(중개대상물 명시의무)를 준수하는 공식 기재 고시란입니다.</span>
                                            </p>
                                         </div>
                                    </div>
                                );
                            }

                            return <div className="whitespace-pre-wrap leading-relaxed">{cleared.trim()}</div>;
                        })() : ""}
                    </div>
                </div>

                {imgUrls.length > 0 && (
                    <div className="mt-8">
                        <h4 className="text-md font-bold text-slate-900 mb-4 flex items-center space-x-1.5">
                            <i className="fa-solid fa-camera text-emerald-600"></i>
                            <span>실사 추가 사진첩</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {imgUrls.map((url, i) => (
                                <div key={i} className="aspect-[16/9] overflow-hidden rounded-xl border border-slate-100 shadow-sm bg-slate-50 watermark-container">
                                    <img src={url.trim()} onError={(e) => (e.currentTarget.src='https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&h=675&q=80')} className="w-full h-full object-cover" />
                                    <div className="watermark-overlay">
                                        <i className="fa-solid fa-house-shield text-[10px]"></i>
                                        <span>태왕공인중개사</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {p.video && (
                    <div className="mt-8">
                        <h4 className="text-md font-bold text-slate-900 mb-4 flex items-center space-x-1.5">
                            <i className="fa-solid fa-circle-play text-red-500"></i>
                            <span>소장의 고화질 동영상 브리핑</span>
                        </h4>
                        <div className="aspect-[16/9] overflow-hidden rounded-2xl border border-slate-100 shadow-md">
                            <iframe src={embedUrl} className="w-full h-full" frameBorder="0" allowFullScreen></iframe>
                        </div>
                    </div>
                )}

                <div className="mt-8">
                    <h4 className="text-md font-bold text-slate-900 mb-4 flex items-center space-x-1.5">
                        <i className="fa-solid fa-map-location-dot text-emerald-600"></i>
                        <span>실시간 대화형 정밀 위치</span>
                    </h4>
                    <div className="aspect-[16/9] overflow-hidden rounded-2xl border border-slate-100 shadow-md relative bg-slate-100">
                        <iframe width="100%" height="100%" frameBorder="0" style={{border:0}} src={`https://maps.google.com/maps?q=${encodeURIComponent(p.address)}&t=&z=18&ie=UTF8&iwloc=&output=embed`} allowFullScreen></iframe>
                    </div>
                </div>

                <div className="mt-12 p-6 sm:p-10 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white rounded-3xl shadow-xl flex flex-col justify-center items-center gap-6 border border-emerald-950/20 w-full max-w-sm sm:max-w-none mx-auto">
                    <div className="text-center w-full overflow-hidden py-2">
                        <h4 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight animate-consult-glow flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap">
                            <i className="fa-solid fa-headset text-xl sm:text-2xl md:text-3xl shrink-0 opacity-90"></i>
                            <span>이 매물 관련 상세 중개 상담이 필요하신가요?</span>
                        </h4>
                        <p className="text-[11px] sm:text-base text-slate-300 mt-3 sm:mt-4 font-black">태왕 대표 공인중개사 직통 무료 상담</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full">
                        <a 
                            href={`tel:${p.phone || '010-7590-0111'}`} 
                            onClick={(e) => { 
                                if (isAdminLoggedIn) {
                                    e.preventDefault(); 
                                    openPhoneSelectModal(e, p.phone || '010-7590-0111', p.ownerPhone); 
                                }
                            }} 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 sm:py-4.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black text-center flex items-center justify-center gap-2 shadow-md shadow-emerald-900/30 transition-all select-none cursor-pointer">
                            <i className="fa-solid fa-mobile-screen"></i>
                            <span>모바일 연결</span>
                        </a>
                        <a 
                            href="tel:054-455-6789" 
                            className="bg-[#2a3547] hover:bg-[#344259] text-white px-6 py-3.5 sm:py-4.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black text-center flex items-center justify-center gap-2 border border-slate-700/50 transition-all select-none cursor-pointer">
                            <i className="fa-solid fa-phone"></i>
                            <span>유선전화 연결</span>
                        </a>
                        <button 
                            onClick={() => { 
                                setActiveSection('main'); 
                                setTimeout(() => {
                                    const el = document.getElementById('quick-inquiry');
                                    if (el) el.scrollIntoView({behavior: 'smooth'});
                                }, 150); 
                            }} 
                            className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3.5 sm:py-4.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black text-center flex items-center justify-center gap-2 transition-all w-full select-none cursor-pointer">
                            <i className="fa-solid fa-clipboard-question"></i>
                            <span>의뢰하기</span>
                        </button>
                    </div>
                </div>
                </>
                )}
            </article>

            <div className="mt-6 sm:mt-10 text-center w-full">
                <button onClick={() => setActiveSection('main')} className="w-full inline-flex items-center justify-center space-x-2 sm:space-x-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-emerald-950/20 text-xs sm:text-sm">
                    <i className="fa-solid fa-list-ul"></i>
                    <span>다른 구미 알짜 매물 장부 구경하러 가기</span>
                </button>
            </div>

            {matchingRecs.length > 0 && (
                <div className="mt-8 sm:mt-12 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-md p-5 sm:p-8 w-full">
                    <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100">
                        <span className="text-emerald-600 text-lg"><i className="fa-solid fa-wand-magic-sparkles"></i></span>
                        <h3 className="text-sm sm:text-base font-black text-slate-900">태왕 공인중개사가 추천하는 또 다른 구미 알짜 매물</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {matchingRecs.map(rec => (
                            <div key={rec.id} onClick={() => setSelectedPostId(rec.id)} className="bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col group">
                                <div className="relative aspect-[16/9] overflow-hidden bg-slate-200 watermark-container">
                                    <img src={rec.thumbnail} onError={(e) => (e.currentTarget.src='https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&h=675&q=80')} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    <div className="absolute top-3 left-3 flex gap-1">
                                        <span className={`text-white text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-sm border ${
                                            rec.transactionType === '매매' ? 'bg-indigo-600/90 border-indigo-500' :
                                            rec.transactionType === '전세' ? 'bg-amber-600/90 border-amber-500' :
                                            'bg-emerald-600/90 border-emerald-500'
                                        }`}>
                                            {rec.transactionType || '월세'}
                                        </span>
                                        <span className="bg-slate-900/90 text-white text-[10px] font-black px-2 py-0.5 rounded-md backdrop-blur-sm">
                                            {rec.category}
                                        </span>
                                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                                            {rec.dong || '구미시'}
                                        </span>
                                        {((rec.panoramas && rec.panoramas.trim()) || (rec.panoImage && rec.panoImage.trim())) && (
                                            <span className="bg-white/90 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm border border-emerald-100 flex items-center gap-1 animate-pulse">
                                                <i className="fa-solid fa-vr-cardboard text-[8px]"></i>
                                                <span>360°</span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="watermark-overlay">
                                        <i className="fa-solid fa-house-shield text-[10px]"></i>
                                        <span>태왕공인중개사</span>
                                    </div>
                                </div>
                                <div className="p-4 flex-grow flex flex-col justify-between">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-slate-900 group-hover:text-emerald-600 transition-colors flex items-center gap-1.5 flex-wrap">
                                            <span className="truncate">{rec.building}</span>
                                            {(rec.floor || rec.totalFloor) && (
                                                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-black border border-emerald-100 shrink-0">
                                                    {rec.floor && rec.totalFloor ? `${rec.floor}/${rec.totalFloor}층` : (rec.floor ? `${rec.floor}층` : `${rec.totalFloor}층`)}
                                                </span>
                                            )}
                                        </h4>
                                        <p className="text-slate-500 text-[11px] line-clamp-1">
                                            {rec.title}
                                        </p>
                                    </div>
                                    <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-slate-200/60">
                                        <span className="text-sm font-black text-red-500">{formatDisplayPrice(rec.price, rec.transactionType || '월세')}</span>
                                        <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-0.5">
                                            <span>구경하기</span>
                                            <i className="fa-solid fa-chevron-right text-[9px] group-hover:translate-x-0.5 transition-transform"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};
