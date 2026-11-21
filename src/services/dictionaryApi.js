import {
  extractLookupTerm,
  lookupDictionaryTerm,
} from './dictionaryService.js';

export { extractLookupTerm };

export async function lookupReaderTerm(rawSelection, { signal } = {}) {
  return lookupDictionaryTerm(rawSelection, { signal });
}
