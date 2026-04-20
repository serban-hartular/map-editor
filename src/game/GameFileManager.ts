import { formatGameJson, sanitizeGameData } from './utils';
import type { GameData } from './types';

export class GameFileManager {
  saveJson(data: GameData, filename: string): void {
    const blob = new Blob([formatGameJson(data)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename.trim() || 'game.json';
    a.click();
    URL.revokeObjectURL(href);
  }

  async loadJsonFromFile(file: File): Promise<GameData> {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return sanitizeGameData(parsed);
  }
}
