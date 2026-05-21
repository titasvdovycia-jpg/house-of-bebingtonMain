import { parseLine } from '@recipecloudapp/ingredient-parser';

/**
 * Parses raw ingredient text into a structured list.
 * Expects a string containing multiple ingredients separated by newlines.
 */
export function parseIngredientsText(text) {
  if (!text || !text.trim()) return [];

  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  return lines.map(line => {
    try {
      const parsed = parseLine(line);
      // The parser returns quantity, unit, ingredient, and notes.
      return {
        original: line,
        quantity: parsed.quantity || 1, // Default to 1 if not found
        unit: (parsed.unit && parsed.unit.display) ? parsed.unit.display : (parsed.unit || ''),
        ingredient: parsed.ingredient || line, // Fallback to raw text if name parsing fails
        notes: (parsed.notes && parsed.notes.length) ? parsed.notes.join(', ') : '',
        checked: false // Added for UI interactions (cupboard check)
      };
    } catch (err) {
      console.warn('Failed to parse line:', line, err);
      return {
        original: line,
        quantity: 1,
        unit: '',
        ingredient: line,
        notes: '',
        checked: false
      };
    }
  });
}
