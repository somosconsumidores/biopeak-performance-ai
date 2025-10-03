import html2canvas from 'html2canvas';
import biopeakLogo from '@/assets/biopeak-logo.png';

export async function shareStrategyImage(
  strategyName: string,
  distance: number,
  totalTime: string,
  avgPace: string,
  strategyType: string
) {
  // Create a temporary div for the share image
  const shareDiv = document.createElement('div');
  shareDiv.style.position = 'absolute';
  shareDiv.style.left = '-9999px';
  shareDiv.style.width = '800px';
  shareDiv.style.padding = '40px';
  shareDiv.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2d3748 100%)';
  shareDiv.style.borderRadius = '16px';
  shareDiv.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  const getStrategyLabel = (type: string): string => {
    switch (type) {
      case 'constant':
        return 'Pace Constante';
      case 'negative':
        return 'Negative Split';
      case 'positive':
        return 'Positive Split';
      default:
        return type;
    }
  };

  shareDiv.innerHTML = `
    <div style="text-align: center;">
      <!-- Logo -->
      <img src="${biopeakLogo}" alt="BioPeak" style="width: 200px; height: auto; margin-bottom: 30px;" />
      
      <!-- Title -->
      <h1 style="color: #00E0FF; font-size: 32px; font-weight: bold; margin-bottom: 10px;">
        ${strategyName}
      </h1>
      
      <p style="color: #94A3B8; font-size: 18px; margin-bottom: 40px;">
        Planejamento de Prova
      </p>
      
      <!-- Stats Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
        <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 12px; backdrop-filter: blur(10px);">
          <p style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">Distância</p>
          <p style="color: #FFFFFF; font-size: 28px; font-weight: bold; font-family: 'Courier New', monospace;">
            ${distance.toFixed(2)} km
          </p>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 12px; backdrop-filter: blur(10px);">
          <p style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">Tempo Total</p>
          <p style="color: #00E0FF; font-size: 28px; font-weight: bold; font-family: 'Courier New', monospace;">
            ${totalTime}
          </p>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 12px; backdrop-filter: blur(10px);">
          <p style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">Pace Médio</p>
          <p style="color: #00E0FF; font-size: 28px; font-weight: bold; font-family: 'Courier New', monospace;">
            ${avgPace}/km
          </p>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.1); padding: 20px; border-radius: 12px; backdrop-filter: blur(10px);">
          <p style="color: #94A3B8; font-size: 14px; margin-bottom: 8px;">Estratégia</p>
          <p style="color: #FFFFFF; font-size: 22px; font-weight: bold;">
            ${getStrategyLabel(strategyType)}
          </p>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px; margin-top: 20px;">
        <p style="color: #94A3B8; font-size: 14px;">
          Criado com BioPeak AI • ${new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(shareDiv);

  try {
    const canvas = await html2canvas(shareDiv, {
      backgroundColor: null,
      scale: 2,
      logging: false,
    });

    document.body.removeChild(shareDiv);

    // Convert canvas to blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      }, 'image/png');
    });
  } catch (error) {
    document.body.removeChild(shareDiv);
    throw error;
  }
}

export async function downloadStrategyImage(
  strategyName: string,
  distance: number,
  totalTime: string,
  avgPace: string,
  strategyType: string
) {
  const blob = await shareStrategyImage(
    strategyName,
    distance,
    totalTime,
    avgPace,
    strategyType
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${strategyName.replace(/\s+/g, '_')}_BioPeak.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function shareStrategyNative(
  strategyName: string,
  distance: number,
  totalTime: string,
  avgPace: string,
  strategyType: string
) {
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await shareStrategyImage(
        strategyName,
        distance,
        totalTime,
        avgPace,
        strategyType
      );

      const file = new File([blob], `${strategyName}_BioPeak.png`, {
        type: 'image/png',
      });

      const shareData = {
        title: `${strategyName} - BioPeak`,
        text: `Minha estratégia de corrida: ${distance.toFixed(2)}km em ${totalTime} (Pace: ${avgPace}/km)`,
        files: [file],
      };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      } else {
        // Fallback to download
        await downloadStrategyImage(strategyName, distance, totalTime, avgPace, strategyType);
        return true;
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error sharing:', error);
        return false;
      }
      return true; // User cancelled
    }
  } else {
    // Fallback to download
    await downloadStrategyImage(strategyName, distance, totalTime, avgPace, strategyType);
    return true;
  }
}
