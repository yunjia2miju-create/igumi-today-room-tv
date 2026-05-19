import React from 'react';

declare global {
    interface Window {
        pannellum: any;
    }
}

interface PannellumViewerProps {
    images: string[];
    activeIndex: number;
    onSceneChange?: (idx: number) => void;
    height?: string;
}

const PannellumViewer: React.FC<PannellumViewerProps> = ({ images, activeIndex, onSceneChange, height = "aspect-[16/9] md:aspect-[1920/800] min-h-[500px] md:h-[600px] lg:h-[800px]" }) => {
    const viewerRef = React.useRef<HTMLDivElement>(null);
    const [viewerInstance, setViewerInstance] = React.useState<any>(null);

    React.useEffect(() => {
        let v: any = null;
        if (viewerRef.current && window.pannellum) {
            try {
                v = window.pannellum.viewer(viewerRef.current, {
                    type: 'equirectangular',
                    panorama: images[activeIndex] || '',
                    autoLoad: true,
                    autoRotate: -1,
                    showFullscreenCtrl: true,
                    showZoomCtrl: true,
                    compass: true,
                    hfov: 100,
                    minHfov: 50,
                    maxHfov: 120,
                    hotSpots: []
                });
                setViewerInstance(v);
            } catch (err) {
                console.error("Pannellum init error:", err);
            }
        }
        return () => {
            if (v) {
                try {
                    v.destroy();
                } catch (e) {}
            }
        };
    }, []);

    React.useEffect(() => {
        if (viewerInstance && images[activeIndex]) {
            try {
                const currentConfig = viewerInstance.getConfig();
                
                // If the panorama didn't change, we still might need to refresh hotspots
                if (currentConfig.panorama !== images[activeIndex]) {
                    viewerInstance.setPanorama(images[activeIndex], {
                        autoLoad: true
                    });
                }
                
                // Clear existing nav hotspots
                if (currentConfig.hotSpots) {
                    const hotspotIdsToRemove = currentConfig.hotSpots
                        .filter((hs: any) => hs.id && String(hs.id).startsWith('nav-'))
                        .map((hs: any) => hs.id);
                    
                    hotspotIdsToRemove.forEach((id: string) => {
                        try {
                            viewerInstance.removeHotSpot(id);
                        } catch (e) {}
                    });
                }

                if (images.length > 1 && onSceneChange) {
                    // Next Hotspot
                    viewerInstance.addHotSpot({
                        id: 'nav-next',
                        pitch: -20,
                        yaw: 35,
                        type: 'info',
                        cssClass: 'pnlm-hotspot-nav next',
                        text: activeIndex < images.length - 1 
                            ? `다음 공간 (공간 ${activeIndex + 2})으로 이동` 
                            : `처음 공간 (공간 1)으로 이동`,
                        clickHandlerFunc: () => onSceneChange(activeIndex < images.length - 1 ? activeIndex + 1 : 0)
                    });
                    
                    // Prev Hotspot
                    viewerInstance.addHotSpot({
                        id: 'nav-prev',
                        pitch: -20,
                        yaw: -35,
                        type: 'info',
                        cssClass: 'pnlm-hotspot-nav prev',
                        text: activeIndex > 0 
                            ? `이전 공간 (공간 ${activeIndex})으로 이동` 
                            : `마지막 공간 (공간 ${images.length})으로 이동`,
                        clickHandlerFunc: () => onSceneChange(activeIndex > 0 ? activeIndex - 1 : images.length - 1)
                    });
                }
            } catch (err) {
                console.error("Pannellum update error:", err);
            }
        }
    }, [viewerInstance, activeIndex, images, onSceneChange]);

    return (
        <div className="relative group">
            <style dangerouslySetInnerHTML={{ __html: `
                .pnlm-hotspot-nav {
                    background-color: #10b981 !important;
                    border: 4px solid white !important;
                    width: 48px !important;
                    height: 48px !important;
                    border-radius: 50% !important;
                    cursor: pointer !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.6) !important;
                    transition: background-color 0.2s ease !important;
                    z-index: 10;
                }
                .pnlm-hotspot-nav:hover {
                    background-color: #059669 !important;
                    box-shadow: 0 4px 25px rgba(16, 185, 129, 0.5) !important;
                }
                .pnlm-hotspot-nav:after {
                    content: '➜' !important;
                    color: white !important;
                    font-size: 24px !important;
                    font-weight: bold !important;
                    line-height: 1 !important;
                }
                .pnlm-hotspot-nav.prev:after {
                    content: '⬅' !important;
                }
                .pnlm-hotspot-nav.next:after {
                    content: '➡' !important;
                }
            `}} />
            <div ref={viewerRef} className={`w-full bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-200 ${height}`}></div>
            
            <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                <div className="bg-black/50 backdrop-blur-md text-white text-[10px] sm:text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 group-hover:bg-emerald-600 transition-colors w-fit">
                    <i className="fa-solid fa-arrows-spin animate-spin-slow"></i>
                    <span>화면을 드래그하여 360° 둘러보세요</span>
                </div>
                {images.length > 1 && onSceneChange && (
                    <div className="bg-blue-600/80 backdrop-blur-md text-white text-[10px] sm:text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 w-fit animate-bounce shadow-lg">
                        <i className="fa-solid fa-hand-pointer"></i>
                        <span>화살표를 클릭하여 공간을 이동하세요</span>
                    </div>
                )}
            </div>

            <div className="absolute top-4 right-4 flex flex-col items-end gap-2 pointer-events-none">
                <div className="bg-emerald-600/90 backdrop-blur-md text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-white/20 group-hover:scale-105 transition-transform">
                    <i className="fa-solid fa-vr-cardboard text-sm sm:text-lg"></i>
                    <div className="flex flex-col">
                        <span className="text-[8px] sm:text-[10px] font-black leading-none opacity-80 uppercase tracking-tighter">Realistic VR Experience</span>
                        <span className="text-[10px] sm:text-xs font-black leading-none mt-0.5">360° 공간 투어 중</span>
                    </div>
                </div>
            </div>

            <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[10px] sm:text-xs font-black px-4 py-2 rounded-xl border border-white/20 shadow-xl flex items-center gap-2">
                <span className="text-emerald-400">TOUR</span>
                <span className="w-px h-3 bg-white/20"></span>
                <span>공간 {activeIndex + 1} / {images.length}</span>
            </div>

            <div className="absolute bottom-4 right-4 bg-emerald-600 text-white text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                360° 가상 실감 투어
            </div>
        </div>
    );
};

export default PannellumViewer;
