import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export const ParticleBackground = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Lazy load particles after 1 second
    const timer = setTimeout(() => {
      setIsVisible(true);
      const newParticles: Particle[] = [];
      for (let i = 0; i < 30; i++) { // Reduced from 50 to 30
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * 3 + 1,
          duration: Math.random() * 20 + 15,
          delay: Math.random() * 20,
        });
      }
      setParticles(newParticles);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="particles fixed inset-0 pointer-events-none z-0">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="particle absolute rounded-full bg-primary opacity-20"
          style={{
            left: `${particle.x}%`,
            bottom: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
};