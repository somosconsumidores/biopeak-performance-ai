import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Função auxiliar para converter Blob em Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao converter blob para base64'));
      }
    };
    reader.readAsDataURL(blob);
  });
};

export const shareNatively = async (blob: Blob, platform: string) => {
  const fileName = `workout-biopeak-${Date.now()}.png`;
  
  try {
    // 1. Verifica se estamos no Nativo (Android/iOS)
    if (Capacitor.isNativePlatform()) {
      
      // Converte o blob para base64 para poder salvar
      const base64Data = await blobToBase64(blob);
      
      // Salva no diretório de cache (não requer permissões extras)
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      // Compartilha usando a URI do arquivo salvo
      await Share.share({
        title: 'Meu Treino BioPeak',
        text: 'Confira meu treino no BioPeak! 🏃‍♂️💪',
        url: savedFile.uri, // A mágica: passa o caminho do arquivo (file://...)
      });

    } else {
      // 2. Fallback para Web (Desktop/Browser Móvel)
      const file = new File([blob], fileName, { type: blob.type });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Meu Treino BioPeak',
        });
      } else {
        // Fallback clássico de download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
    }
  } catch (error) {
    console.error('Erro ao compartilhar:', error);
    throw error; // Re-throw para que o componente possa mostrar toast de erro
  }
};
