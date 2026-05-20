import React, { useState, useEffect } from 'react';
import { useAppStore } from './store';
import { MainTab } from './components/MainTab';
import { DetailTab } from './components/DetailTab';
import { Modals } from './components/Modals';
import { getPostsService, getInquiriesService } from './firebaseService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

// --- Toast Context Helper ---
export const ToastContext = React.createContext<{ showToast: (msg: string, type?: 'success'|'error') => void } | null>(null);

export default function App() {
    const { 
        isAdminLoggedIn, 
        setIsAdminLoggedIn, 
        isMobileSimulationMode, 
        setIsMobileSimulationMode, 
        activeSection, 
        setActiveSection, 
        selectedPostId,
        setPosts,
        setInquiries
    } = useAppStore();

    // Modals state
    const [writeModalOpen, setWriteModalOpen] = useState(false);
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [adminLoginOpen, setAdminLoginOpen] = useState(false);
    const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
    const [phoneModalOpen, setPhoneModalOpen] = useState(false);
    const [phoneModalData, setPhoneModalData] = useState<{mobile: string, owner: string} | null>(null);

    // Toast state
    const [toasts, setToasts] = useState<{id: number, msg: string, type: 'success'|'error'}[]>([]);

    useEffect(() => {
        // Fetch posts through unified cloud database service
        getPostsService()
            .then(data => {
                setPosts(data);
            })
            .catch(err => console.error("매물 목록을 불러오는 중 오류 발생:", err));

        // Fetch inquiries through unified cloud database service
        getInquiriesService()
            .then(data => {
                setInquiries(data);
            })
            .catch(err => console.error("의뢰 목록을 불러오는 중 오류 발생:", err));

        // Automatically restore session if verified Google Admin user is logged in
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user && user.email === 'yunjia2miju@gmail.com' && user.emailVerified) {
                setIsAdminLoggedIn(true);
            }
        });
        return () => unsubscribe();
    }, []);

    const showToast = (msg: string, type: 'success'|'error' = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    };

    const openPhoneSelectModal = (e: React.MouseEvent, mobilePhone: string, ownerPhone: string = '') => {
        e.stopPropagation();
        setPhoneModalData({ mobile: mobilePhone, owner: ownerPhone });
        setPhoneModalOpen(true);
    };

    const handleAdminLogout = () => {
        setIsAdminLoggedIn(false);
        showToast("소장님 모드가 안전하게 해제되었습니다. 소유자 연락처가 비공개 처리되었습니다.", "success");
    };

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [activeSection]);

    const mainWrapperClass = isMobileSimulationMode
        ? "flex-grow flex flex-col transition-all duration-300 w-full max-w-[430px] border-x-8 border-slate-950 shadow-2xl mx-auto bg-white rounded-[36px] my-6 relative overflow-hidden"
        : "flex-grow flex flex-col transition-all duration-300 w-full structural-border";

    return (
        <ToastContext.Provider value={{ showToast }}>


            {/* Main Shell */}
            <div id="main-simulation-wrapper" className={mainWrapperClass}>
                {isMobileSimulationMode && (
                    <div className="bg-slate-950 text-slate-300 text-[10px] py-2 px-6 flex justify-between items-center font-bold tracking-tight select-none border-b border-slate-900">
                        <span>10:25 AM</span>
                        <div className="w-24 h-4 bg-slate-950 rounded-b-xl absolute left-1/2 -translate-x-1/2 top-0 border-x border-b border-slate-800"></div>
                        <div className="flex items-center gap-1.5 text-slate-400">
                            <i className="fa-solid fa-signal text-[9px]"></i>
                            <i className="fa-solid fa-wifi text-[9px]"></i>
                            <i className="fa-solid fa-battery-three-quarters text-emerald-500 text-xs"></i>
                        </div>
                    </div>
                )}

                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-[11px] sm:text-xs py-2 px-4 text-center font-medium shadow-sm w-full">
                    <i className="fa-solid fa-bullhorn mr-1"></i> 정직한 발걸음과 생생한 관찰 기록, 태왕공인중개사가 전문적인 중개를 약속합니다.
                </div>

                <header className="sticky top-0 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100 z-40 w-full transition-all">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex justify-between items-center">
                        <div className="flex items-center justify-between w-full lg:w-auto cursor-pointer" onClick={() => setActiveSection('main')}>
                            <div className="flex items-center space-x-2 group">
                                <span className="bg-emerald-600 text-white p-2 sm:p-2.5 rounded-xl shadow-md shadow-emerald-600/20 group-hover:bg-emerald-700 transition-colors">
                                    <i className="fa-solid fa-house-chimney text-lg sm:text-xl"></i>
                                </span>
                                <div className="flex flex-col">
                                    <span className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">태왕<span className="text-emerald-600">공인중개사</span></span>
                                    <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">Taewang Real Estate</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-grow w-full">
                    {activeSection === 'main' && <MainTab openPhoneSelectModal={openPhoneSelectModal} showToast={showToast} />}
                    {activeSection === 'detail' && <DetailTab openPhoneSelectModal={openPhoneSelectModal} />}
                </main>

                <footer className="bg-slate-950 text-slate-500 py-12 border-t border-slate-900 w-full font-medium mt-auto">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left w-full">
                        <div className="space-y-2">
                            <p className="text-base font-black text-slate-300">태왕공인중개사사무소</p>
                            <div className="text-xs text-slate-500 leading-relaxed space-y-1">
                                <p>대표 : 유정화 | 등록번호 : 47190-2016-00027</p>
                                <p>소재지 : 구미시 송정대로 6길18 (송정동 472-10번지)</p>
                                <p>연락처 : <a href="tel:054-455-6789" className="hover:text-emerald-500 transition-colors">054-455-6789</a>, <a href="tel:010-7590-0111" className="hover:text-emerald-500 transition-colors">010-7590-0111</a></p>
                            </div>
                            <p className="text-[11px] text-slate-700 pt-1">© 2026 Taewang Real Estate. All rights reserved.</p>
                        </div>
                        <div className="w-full md:w-auto flex justify-center mt-4 md:mt-0">
                            {isAdminLoggedIn ? (
                                <div className="flex flex-col gap-2.5 w-full max-w-[280px] mx-auto md:mx-0">
                                    <button onClick={() => { setEditingPostId(null); setWriteModalOpen(true); }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all">
                                        <i className="fa-solid fa-pen-nib text-xs"></i><span>1. 새 매물 등록</span>
                                    </button>
                                    <button onClick={() => setAdminDashboardOpen(true)} className="w-full bg-amber-500 hover:bg-amber-400 text-white py-3 px-4 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all">
                                        <i className="fa-solid fa-chart-line text-xs"></i><span>2. 관리 센터</span>
                                    </button>
                                    <button onClick={handleAdminLogout} className="w-full bg-red-600 hover:bg-red-500 text-white py-3 px-4 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all">
                                        <i className="fa-solid fa-unlock text-xs"></i><span>3. 소장님 로그아웃</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2.5 w-full max-w-[280px] mx-auto md:mx-0">
                                    <button onClick={() => setAdminLoginOpen(true)} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 px-4 rounded-xl text-xs font-black shadow-md border border-slate-700 flex items-center justify-center gap-2 transition-all">
                                        <i className="fa-solid fa-lock text-xs"></i><span>관리자 대시보드</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </footer>
            </div>

            <Modals
                showToast={showToast}
                writeModalOpen={writeModalOpen} setWriteModalOpen={setWriteModalOpen}
                editingPostId={editingPostId} setEditingPostId={setEditingPostId}
                adminLoginOpen={adminLoginOpen} setAdminLoginOpen={setAdminLoginOpen}
                adminDashboardOpen={adminDashboardOpen} setAdminDashboardOpen={setAdminDashboardOpen}
                phoneModalOpen={phoneModalOpen} setPhoneModalOpen={setPhoneModalOpen} phoneModalData={phoneModalData}
            />

            <div id="toast-container" className="fixed bottom-5 right-5 z-[200] flex flex-col space-y-2 pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className={`px-5 py-3.5 rounded-2xl text-xs font-bold shadow-2xl transition-all block ${toast.type === 'success' ? 'bg-slate-900 text-white' : 'bg-red-50 text-red-600'}`}>
                        {toast.msg}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
