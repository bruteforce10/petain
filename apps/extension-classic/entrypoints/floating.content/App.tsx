import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number, moved: boolean } | null>(null);

  useEffect(() => {
    // Handle window resize to keep button in bounds
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - 60),
        y: Math.min(prev.y, window.innerHeight - 60)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const STATUS_KEY = 'terramap.lastScrape';
    const checkStatus = (stored: any) => {
      const s = stored[STATUS_KEY];
      if (s && s.state === 'running') {
        setIsOpen(true);
      }
    };
    
    // Check initial status
    chrome.storage.local.get(STATUS_KEY).then(checkStatus);
    
    // Listen for storage changes
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local') {
        if (changes[STATUS_KEY]) {
          checkStatus({ [STATUS_KEY]: changes[STATUS_KEY].newValue });
        }
        if (changes['terramap.topBarOpenedAt']) {
          setIsOpen(false);
        }
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
      moved: false
    };
    setIsDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragRef.current) return;
    
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragRef.current.moved = true;
    }

    const newX = dragRef.current.initialX + dx;
    const newY = dragRef.current.initialY + dy;
    
    // Clamp to window bounds
    const clampedX = Math.max(0, Math.min(newX, window.innerWidth - 50));
    const clampedY = Math.max(0, Math.min(newY, window.innerHeight - 50));

    setPosition({ x: clampedX, y: clampedY });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    if (dragRef.current && !dragRef.current.moved) {
      // It was a click
      setIsOpen(!isOpen);
    }
    
    dragRef.current = null;
  };
  
  const onPointerCancel = (e: React.PointerEvent) => {
    if (isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    dragRef.current = null;
  };

  const isLeftSide = position.x < window.innerWidth / 2;

  // Use the logo from public folder
  const logoUrl = chrome.runtime.getURL('/logo.svg');
  const popupUrl = chrome.runtime.getURL('/popup.html?floating=1');

  return (
    <div 
      className="petain-floating-container"
      style={{ left: position.x, top: position.y }}
    >
      <div 
        className="petain-floating-btn"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerOut={onPointerCancel}
        onPointerLeave={onPointerCancel}
      >
        <img src={logoUrl} alt="Petain" />
      </div>

      {isOpen && (
        <div className={`petain-popup-overlay ${isLeftSide ? 'left-side' : ''}`}>
          <iframe src={popupUrl} title="Petain Extension" />
        </div>
      )}
    </div>
  );
}
