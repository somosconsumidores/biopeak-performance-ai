export const shareNatively = async (blob: Blob, platform: string) => {
  const file = new File([blob], `workout-biopeak-${Date.now()}.png`, { type: 'image/png' });
  
  // Try Web Share API first (works in Android WebView and modern browsers)
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: 'Meu Treino BioPeak',
        text: 'Confira meu treino no BioPeak! 🏃‍♂️💪',
        files: [file],
      });
      return;
    } catch (error) {
      // User cancelled or share failed, continue to fallback
      if ((error as Error).name !== 'AbortError') {
        console.error('Web Share failed:', error);
      }
    }
  }
  
  // Fallback: download the image
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `workout-biopeak-${platform}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
