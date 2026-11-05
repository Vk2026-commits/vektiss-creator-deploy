import {useRef,useState} from 'react';

type SavedKeywords = {profileId: string | undefined; searchQuery: string; keywordDraft: string};
const key = (profileId: string) => `creator-search-keywords-v1:${profileId}`;
function read(profileId: string | undefined): SavedKeywords {
  const empty = {profileId, searchQuery: '', keywordDraft: ''};
  if (!profileId) return empty;
  try {
    const saved = JSON.parse(localStorage.getItem(key(profileId)) ?? '{}');
    return {...empty,
      searchQuery: typeof saved.searchQuery === 'string' ? saved.searchQuery.slice(0,300) : '',
      keywordDraft: typeof saved.keywordDraft === 'string' ? saved.keywordDraft.slice(0,300) : ''};
  } catch { return empty; }
}

// Save each edit, including an unfinished phrase. Profile IDs prevent searches
// from leaking into another creator's profile on a shared browser.
export function useSavedSearchKeywords(profileId: string | undefined) {
  const [saved,setSaved] = useState(() => read(profileId));
  let current = saved;
  if (saved.profileId !== profileId) {
    current = read(profileId);
    setSaved(current);
  }
  const latest = useRef(current);
  latest.current = current;
  function update(field: 'searchQuery' | 'keywordDraft', value: string) {
    const next = {...latest.current, [field]: value};
    latest.current = next;
    setSaved(next);
      if (profileId) {
        try { localStorage.setItem(key(profileId), JSON.stringify({searchQuery:next.searchQuery,keywordDraft:next.keywordDraft})); }
        catch { /* Keep edits usable when browser storage is unavailable. */ }
      }

  }
  return {...current,
    setSearchQuery: (value: string) => update('searchQuery',value),
    setKeywordDraft: (value: string) => update('keywordDraft',value)};
}
