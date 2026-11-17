// Multipart source inspection is independent from user-directed writing.
export function aiRequestBucket(multipart: boolean, action?: string | null): 'writing' | 'analysis' {
 return multipart && !['edit-plan','edit-illustration'].includes(action??'') ? 'analysis' : 'writing';
}
