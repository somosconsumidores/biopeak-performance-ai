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
    try {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            const t = window.setTimeout(() => {
              setIsVisible(true);
            }, delay);
          }
        },
        {
          threshold: 0.1,
          rootMargin: '0px 0px -50px 0px',
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