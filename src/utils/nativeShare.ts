import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export const shareNatively = async (blob: Blob, platform: string) => {
  // Convert blob to base64
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  
  await new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
  });

  const base64Data = reader.result as string;
  const base64String = base64Data.split(',')[1];

  // Save to filesystem temporarily
  const fileName = `workout-biopeak-${Date.now()}.png`;
  const savedFile = await Filesystem.writeFile({
    path: fileName,
    data: base64String,
    directory: Directory.Cache
  });

  // Share using native share dialog
  await Share.share({
    title: 'Meu Treino BioPeak',
    text: 'Confira meu treino no BioPeak! 🏃‍♂️💪',
    url: savedFile.uri,
    dialogTitle: 'Compartilhar no Instagram ou Facebook'
  });
};
