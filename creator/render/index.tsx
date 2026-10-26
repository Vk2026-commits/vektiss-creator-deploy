import {Composition,OffthreadVideo,registerRoot,useCurrentFrame} from 'remotion';
import {EditComposition} from '../src/components/EditComposition';
function Edit({sourceUrl,...props}:any){return <EditComposition {...props} frame={useCurrentFrame()} media={<OffthreadVideo src={sourceUrl} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/>}/>;}
registerRoot(()=> <Composition id="CreatorEdit" component={Edit} width={1080} height={1920} fps={30} durationInFrames={30} defaultProps={{sourceUrl:'',source:{duration:1,words:[]},proposal:{beats:[]}}} calculateMetadata={({props})=>({durationInFrames:Math.ceil(props.source.duration*30)})}/>);
