// Bound the export to the full source duration plus one silent second. Pad the
// picture generously so a slightly shorter video stream cannot cut off audio.
export function endingVideoFilter(duration:number,hold:number){
 return hold?`,tpad=stop_mode=clone:stop_duration=${duration+hold}`:'';
}
export function endingAudioFilter(duration:number){
 return `aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${duration},asetpts=PTS-STARTPTS`;
}
