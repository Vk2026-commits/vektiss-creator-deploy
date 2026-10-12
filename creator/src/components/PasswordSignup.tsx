import {useRef,useState,type FormEvent} from 'react';
import {supabase} from '../lib/supabase';
import {authRedirectUrl} from '../lib/auth-redirect';
import {normalizePhone,phoneValidation,signupValidation,signupError} from '../lib/signup';

export function PasswordSignup({onSignIn}:{onSignIn:()=>void}) {
 const [email,setEmail]=useState('');const [phone,setPhone]=useState('');const [password,setPassword]=useState('');const [confirmation,setConfirmation]=useState('');
 const [show,setShow]=useState(false);const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const lock=useRef(false);const lastSent=useRef(0);
 async function submit(event:FormEvent){event.preventDefault();if(lock.current||!supabase)return;
  const invalid=phoneValidation(phone)||signupValidation(password,confirmation);if(invalid){setError(invalid);return;}
  lock.current=true;setBusy(true);setError('');
  try{const result=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:authRedirectUrl(window.location.origin),data:{contact_phone:normalizePhone(phone)}}});
   if(result.error)throw result.error;setPhone('');setPassword('');setConfirmation('');setSent(true);lastSent.current=Date.now();
  }catch(e){setError(signupError(e));}finally{lock.current=false;setBusy(false);}
 }
 async function resend(){if(lock.current||!supabase)return;if(Date.now()-lastSent.current<60000){setError('Please wait a minute before requesting another email.');return;}
  lock.current=true;setBusy(true);setError('');try{const result=await supabase.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:authRedirectUrl(window.location.origin)}});if(result.error)throw result.error;lastSent.current=Date.now();}catch(e){setError(signupError(e));}finally{lock.current=false;setBusy(false);}
 }
 return <section aria-label="Create account">
  <h2>{sent?'Check your email':'Create your account'}</h2>
  {sent?<><p>If this address is eligible, a confirmation link will arrive at <strong>{email}</strong>. Check your spam folder too. Verify your email to begin your creator and audience setup.</p><p>Already registered? Sign in or reset your password instead.</p><button className="button secondary" disabled={busy} onClick={()=>void resend()}>{busy?'Sending…':'Resend confirmation'}</button></>:<>
   <p>Your own workspace, profiles, and videos—all saved to your account.</p>
   <form onSubmit={submit}>
    <label className="field"><span>Email address</span><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
    <label className="field"><span>Phone number</span><input required type="tel" inputMode="tel" autoComplete="tel" placeholder="+1 555 123 4567" value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy} aria-describedby="signup-phone-help"/></label>
    <p id="signup-phone-help">Use international format, including country code. This is your account contact number and is not used to sign in.</p>
    <label className="field"><span>Password</span><input required type={show?'text':'password'} autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} aria-describedby="signup-password-help"/></label>
    <p id="signup-password-help">Use at least 12 characters.</p>
    <label className="field"><span>Confirm password</span><input required type={show?'text':'password'} autoComplete="new-password" minLength={12} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy}/></label>
    <button type="button" className="text-button" aria-pressed={show} onClick={()=>setShow(!show)}>{show?'Hide passwords':'Show passwords'}</button>
    <button className="button primary" disabled={busy}>{busy?'Creating account…':'Create account'}</button>
   </form>
  </>}
  {error&&<p role="alert" className="error-message">{error}</p>}
  <button type="button" className="text-button" disabled={busy} onClick={onSignIn}>Back to sign in</button>
 </section>;
}
