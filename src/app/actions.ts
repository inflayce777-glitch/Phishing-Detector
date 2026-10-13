'use server';

import { analyzeCoreHeuristics } from '@/core/heuristics';

export async function analyzePhishing(text: string) {
  try {
    // Імітація затримки для ефекту "роботи" та плавних 3D-анімацій (1-2 секунди)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Локальний, швидкий та безкоштовний аналіз без LLM
    const result = analyzeCoreHeuristics(text, '', '');
    
    // Повертаємо формат, який очікує XState (масив vectors)
    return result;
  } catch (error) {
    console.error('Heuristic Analyzer Error:', error);
    return {
      vectors: []
    };
  }
}
