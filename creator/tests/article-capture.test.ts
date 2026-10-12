import {describe,expect,it} from 'vitest';
import {articleCardText} from '../server/article-capture';

describe('article fallback card',()=>{
 it('derives a readable visual label from the canonical URL without inventing article facts',()=>{
  expect(articleCardText('https://www.example.com/news/a-useful-business-story?utm_source=test')).toEqual({
   title:'A Useful Business Story',
   host:'example.com'
  });
 });
});
