import { useEffect, useRef, useState } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const ScrollReveal = ({ children, className = '', delay = 0 }: ScrollRevealProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Graceful fallback for environments without IntersectionObserver (older iOS WKWebView)
    if (typeof window === 'undefined' || typeof (window as any).IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    let observer: IntersectionObserver | null = null;
    let timeoutId: NodeJS.Timeout;
    
    try {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            timeoutId = setTimeout(() => {
              setIsVisible(true);
            }, delay);
          }
        },
        {
          threshold: 0.05, // Reduced from 0.1 for faster trigger
          rootMargin: '0px 0px -30px 0px', // Reduced from -50px
        }
      );
    } catch (err) {
      // In case constructing the observer throws in some engines
      setIsVisible(true);
      return;
    }

    if (ref.current && observer) {
      observer.observe(ref.current);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (ref.current && observer) {
        try {
          observer.unobserve(ref.current);
          observer.disconnect();
        } catch {}
      }
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`reveal ${isVisible ? 'revealed' : ''} ${className}`}
    >
      {children}
    </div>
  );
};