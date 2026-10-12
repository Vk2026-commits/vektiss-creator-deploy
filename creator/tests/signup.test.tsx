import {describe,it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {nameValidation,normalizeName,normalizePhone,phoneValidation,signupValidation,signupError,setupStep} from '../src/lib/signup';
import {PasswordSignup} from '../src/components/PasswordSignup';
import {SignIn} from '../src/App';
vi.mock('../src/lib/supabase',()=>({supabase:{auth:{}},localPreviewAvailable:false}));
describe('password signup',()=>{
 it('resumes setup from saved records without re-onboarding existing profiles',()=>{
  expect(setupStep(false,0)).toBe('creator');expect(setupStep(true,0)).toBe('audience');
  expect(setupStep(true,1)).toBeNull();expect(setupStep(true,5)).toBeNull();
 });
 it('requires twelve characters and matching confirmation',()=>{
  expect(signupValidation('short','short')).toContain('12');
  expect(signupValidation('long-enough-password','different')).toContain('match');
  expect(signupValidation('long-enough-password','long-enough-password')).toBe('');
 });
 it('requires and normalizes first and last names',()=>{
  expect(nameValidation('', 'Doe')).toContain('first name');
  expect(nameValidation('Jane', '')).toContain('last name');
  expect(nameValidation('  Jane  ', '  van   Doe ')).toBe('');
  expect(normalizeName('  Jane   van Doe ')).toBe('Jane van Doe');
 });
 it('requires and normalizes an international contact phone number',()=>{
  expect(phoneValidation('')).toContain('international');
  expect(phoneValidation('415 555 2671')).toContain('international');
  expect(phoneValidation('+1 (415) 555-2671')).toBe('');
  expect(normalizePhone('+1 (415) 555-2671')).toBe('+14155552671');
 });
 it('does not disclose duplicate-account information',()=>{
  expect(signupError({code:'user_already_exists',message:'Registered'})).toBe(signupError(new TypeError('Network')));
  expect(signupError({code:'over_email_send_rate_limit'})).toContain('wait');
 });
 it('provides labelled password-manager compatible signup fields',()=>{
  const html=renderToStaticMarkup(<PasswordSignup onSignIn={()=>{}}/>);
  expect(html).toContain('Create your account');expect(html.match(/autoComplete="new-password"/g)).toHaveLength(2);
  expect(html).toContain('First name');expect(html).toContain('autoComplete="given-name"');expect(html).toContain('Last name');expect(html).toContain('autoComplete="family-name"');expect(html).toContain('Phone number');expect(html).toContain('autoComplete="tel"');expect(html).toContain('Confirm password');expect(html).toContain('Show passwords');expect(html).toContain('Back to sign in');
 });
 it('shows password sign-in without requiring a mode switch',()=>{
  const html=renderToStaticMarkup(<SignIn onPreview={async()=>{}} initialError=""/>);
  expect(html).toContain('Sign in with your email and password.');
  expect(html).toContain('autoComplete="current-password"');
  expect(html).toContain('New to Creator? Create an account');
  expect(html).not.toContain('Use an email sign-in link instead');
  expect(html).not.toContain('Continue with email');
  expect(html).toContain('Forgot your password? Set or reset it');
 });
 it('uses a bounded session recovery fallback instead of leaving the loading screen indefinitely',()=>{
  const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  expect(source).toContain('12_000');expect(source).toContain('took too long to restore');
 });
});
