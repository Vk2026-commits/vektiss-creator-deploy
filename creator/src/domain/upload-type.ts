const supported=['video/mp4','video/webm','image/png','image/jpeg','image/webp'];
const extensions:Record<string,string>={mp4:'video/mp4',webm:'video/webm',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
// iOS Files may supply an empty, generic, or QuickTime MIME for an MP4.
// This is an upload hint only; the server still probes/decodes the actual bytes.
export function sourceUploadType(file:{name:string;type:string}):string|null{
 const mime=file.type.toLowerCase().split(';')[0].trim();
 if(supported.includes(mime))return mime;
 return extensions[file.name.split('.').pop()?.toLowerCase()??'']??null;
}

export function editVideoUploadType(file:{name:string;type:string}):string{
 const type=sourceUploadType(file);
 if(type!=='video/mp4'&&type!=='video/webm')throw Error('Choose an MP4 or WebM video. For an iPhone MOV recording, export it as MP4 first.');
 return type;
}
