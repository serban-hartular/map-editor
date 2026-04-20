import { formatScenarioJson, sanitizeScenarioData } from './utils';
import type { ScenarioData } from './types';

export class ScenarioFileManager {
  saveJson(data: ScenarioData, filename: string): void {
    const blob = new Blob([formatScenarioJson(data)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename.trim() || 'scenario.json';
    a.click();
    URL.revokeObjectURL(href);
  }

  async loadJsonFromFile(file: File): Promise<ScenarioData> {
    const text = await file.text();
    const parsed = JSON.parse(text);
    return sanitizeScenarioData(parsed);
  }
}
