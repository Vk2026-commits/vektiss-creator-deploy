import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {CreatorForm} from '../../src/components/StrategyForms';
import {emptyCreator,type CreatorInput} from '../../src/domain/strategy';
import '../../src/styles.css';
import '../../src/brand.css';
function Fixture(){
 const [saved,setSaved]=useState<CreatorInput>({...emptyCreator,display_name:'Test creator'});
 return <main style={{maxWidth:650,margin:'auto',padding:16,fontFamily:'system-ui'}}><CreatorForm initial={saved} onboarding onSave={async value=>setSaved(value)} onClose={()=>{}}/><output aria-label="Saved profile" hidden>{JSON.stringify(saved)}</output></main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
