import { create } from 'zustand';
import { Post, Inquiry, defaultPosts } from './data';

interface AppState {
    posts: Post[];
    inquiries: Inquiry[];
    isAdminLoggedIn: boolean;
    showOnlyRecommended: boolean;
    activeCategory: string;
    activeDong: string;
    searchVal: string;
    currentPage: number;
    isMobileSimulationMode: boolean;
    activeSection: 'main' | 'detail';
    selectedPostId: string | null;

    setPosts: (posts: Post[]) => void;
    setInquiries: (inqs: Inquiry[]) => void;
    setIsAdminLoggedIn: (val: boolean) => void;
    setShowOnlyRecommended: (val: boolean) => void;
    setActiveCategory: (cat: string) => void;
    setActiveDong: (dong: string) => void;
    setSearchVal: (val: string) => void;
    setCurrentPage: (page: number) => void;
    setIsMobileSimulationMode: (val: boolean) => void;
    setActiveSection: (sec: 'main' | 'detail') => void;
    setSelectedPostId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
    posts: defaultPosts,
    inquiries: [],
    isAdminLoggedIn: false,
    showOnlyRecommended: false,
    activeCategory: 'all',
    activeDong: 'all',
    searchVal: '',
    currentPage: 1,
    isMobileSimulationMode: false,
    activeSection: 'main',
    selectedPostId: null,

    setPosts: (posts) => set({ posts }),
    setInquiries: (inqs) => set({ inquiries: inqs }),
    setIsAdminLoggedIn: (val) => set({ isAdminLoggedIn: val }),
    setShowOnlyRecommended: (val) => set({ showOnlyRecommended: val, currentPage: 1 }),
    setActiveCategory: (cat) => set({ activeCategory: cat, activeDong: 'all', currentPage: 1 }),
    setActiveDong: (dong) => set({ activeDong: dong, currentPage: 1 }),
    setSearchVal: (val) => set({ searchVal: val, currentPage: 1, activeCategory: 'all', activeDong: 'all' }),
    setCurrentPage: (page) => set({ currentPage: page }),
    setIsMobileSimulationMode: (val) => set({ isMobileSimulationMode: val }),
    setActiveSection: (sec) => set((state) => ({ 
        activeSection: sec,
        selectedPostId: sec === 'main' ? null : state.selectedPostId 
    })),
    setSelectedPostId: (id) => set({ 
        selectedPostId: id, 
        activeSection: id ? 'detail' : 'main' 
    }),
}));
